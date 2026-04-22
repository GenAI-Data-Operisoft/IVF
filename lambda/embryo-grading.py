"""
embryo-grading.py

Analyses a microscope image using Amazon Bedrock (Qwen3 VL 235B) to provide
expert embryo grading. First identifies if the image is an embryo/oocyte,
then grades it using ESHRE/ASRM standards. Stores result in DynamoDB.

Trigger: POST /embryo-grading (API Gateway)
Table:   IVF-InjectedOocyteImages (DynamoDB)
"""

import json
import boto3
import os
import re
from datetime import datetime
from audit_helper import log_audit, extract_user_info

dynamodb = boto3.resource('dynamodb')
s3_client = boto3.client('s3')
bedrock = boto3.client('bedrock-runtime', region_name=os.environ.get('AWS_REGION', 'ap-south-1'))

images_table = dynamodb.Table(os.environ.get('IMAGES_TABLE', 'IVF-InjectedOocyteImages'))

CORS = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type,Authorization',
    'Access-Control-Allow-Methods': 'POST,OPTIONS'
}

GRADING_PROMPT = """You are an expert clinical embryologist. Analyze the provided image and respond ONLY with a valid JSON object. No text outside the JSON.

STEP 1 — Image Check:
Is this a microscope image of an embryo or oocyte? If it shows a dish, tube, equipment, person, or anything else, set is_embryo to false.

STEP 2 — Grading (only if is_embryo is true):
Grade the blastocyst using the Gardner & Schoolcraft classification system:
- Expansion stage (1–6): 1=early blastocyst, 2=blastocyst, 3=full blastocyst, 4=expanded, 5=hatching, 6=hatched
- ICM quality (A/B/C): A=tightly packed many cells, B=loosely grouped, C=very few cells
- TE quality (A/B/C): A=many cells cohesive layer, B=few cells loose, C=very few large cells
- Grade format: [Expansion][ICM][TE] e.g. "5AB", "4AA", "3BC"
- Quality: Excellent (4AA/5AA/6AA), Good (3AB/4AB/5AB), Fair (2BB/3BB), Poor (below 2BB or C grade)
- Recommendation: "Transfer" (Grade A/B quality), "Freeze" (Good quality, not ideal timing), "Discard" (Poor quality)
- Description: 1-2 sentences max. What you see in the image.
- Clinical notes: 1 sentence max. Key observation or caution.

If Day 3 cleavage stage (not blastocyst): use Grade 1-4 format instead, note stage clearly.

Respond with ONLY this JSON:
{
  "is_embryo": true or false,
  "not_embryo_reason": "what the image shows (only if not embryo, else empty string)",
  "stage": "Day 5 (Blastocyst)" or "Day 3 (Cleavage)" or "",
  "grade": "5AB" or "Grade 2" etc. or "",
  "quality": "Excellent" or "Good" or "Fair" or "Poor" or "",
  "recommendation": "Transfer" or "Freeze" or "Discard" or "",
  "description": "Short 1-2 sentence clinical description of what is observed.",
  "clinical_notes": "One key clinical note or observation."
}"""


def get_image_bytes(s3_path):
    """Download image from S3 and return raw bytes."""
    parts = s3_path.replace('s3://', '').split('/', 1)
    if len(parts) != 2:
        raise ValueError(f"Invalid S3 path: {s3_path}")
    bucket, key = parts
    response = s3_client.get_object(Bucket=bucket, Key=key)
    return response['Body'].read()


def call_bedrock(image_bytes):
    """Call Bedrock Qwen3 VL 235B with the grading prompt using Converse API."""
    response = bedrock.converse(
        modelId='qwen.qwen3-vl-235b-a22b',
        messages=[{
            'role': 'user',
            'content': [
                {
                    'image': {
                        'format': 'jpeg',
                        'source': {
                            'bytes': image_bytes
                        }
                    }
                },
                {
                    'text': GRADING_PROMPT
                }
            ]
        }],
        inferenceConfig={
            'maxTokens': 1024,
            'temperature': 0.1
        }
    )
    raw_text = response['output']['message']['content'][0]['text']
    return raw_text, response


def parse_grading_response(raw_text):
    """Parse JSON from Bedrock response."""
    # Strip markdown code blocks if present
    clean = re.sub(r'```(?:json)?\s*', '', raw_text).strip()
    clean = clean.rstrip('`').strip()
    return json.loads(clean)


def lambda_handler(event, context):
    if event.get('httpMethod') == 'OPTIONS':
        return {'statusCode': 200, 'headers': CORS, 'body': ''}

    try:
        body = json.loads(event.get('body') or '{}')
        image_id = body.get('imageId')
        session_id = body.get('sessionId')

        if not image_id or not session_id:
            return {'statusCode': 400, 'headers': CORS, 'body': json.dumps({'error': 'imageId and sessionId required'})}

        # Get image record from DynamoDB
        resp = images_table.get_item(Key={'imageId': image_id})
        if 'Item' not in resp:
            return {'statusCode': 404, 'headers': CORS, 'body': json.dumps({'error': 'Image not found'})}

        image_record = resp['Item']

        # If already graded, return existing result
        if image_record.get('ai_grade'):
            return {
                'statusCode': 200,
                'headers': CORS,
                'body': json.dumps({'ai_grade': image_record['ai_grade'], 'cached': True})
            }

        # Get original image from S3
        original_path = image_record.get('original_s3_path', '')
        if not original_path:
            return {'statusCode': 400, 'headers': CORS, 'body': json.dumps({'error': 'Original image not found'})}

        image_bytes = get_image_bytes(original_path)

        # Call Bedrock
        raw_text, raw_response = call_bedrock(image_bytes)

        # Parse response
        grading = parse_grading_response(raw_text)

        ai_grade = {
            'is_embryo': bool(grading.get('is_embryo', False)),
            'not_embryo_reason': grading.get('not_embryo_reason', ''),
            'stage': grading.get('stage', ''),
            'grade': grading.get('grade', ''),
            'quality': grading.get('quality', ''),
            'recommendation': grading.get('recommendation', ''),
            'description': grading.get('description', ''),
            'clinical_notes': grading.get('clinical_notes', ''),
            'raw_response': raw_text[:2000],
            'graded_at': datetime.utcnow().isoformat() + 'Z'
        }

        # Store in DynamoDB
        images_table.update_item(
            Key={'imageId': image_id},
            UpdateExpression='SET ai_grade = :g',
            ExpressionAttributeValues={':g': ai_grade}
        )

        # Audit log
        user_info, ip = extract_user_info(event)
        log_audit(
            user_info=user_info,
            action='AI_GRADING_COMPLETED',
            resource_type='image',
            resource_id=image_id,
            session_id=session_id,
            stage='icsi_documentation',
            result='success',
            ip_address=ip,
            metadata={
                'imageId': image_id,
                'oocyte_number': int(image_record.get('oocyte_number', 0)),
                'is_embryo': ai_grade['is_embryo'],
                'grade': ai_grade['grade'],
                'quality': ai_grade['quality']
            }
        )

        return {
            'statusCode': 200,
            'headers': CORS,
            'body': json.dumps({'ai_grade': ai_grade})
        }

    except json.JSONDecodeError as e:
        print(f"JSON parse error: {e}")
        return {'statusCode': 422, 'headers': CORS, 'body': json.dumps({'error': 'AI response could not be parsed', 'detail': str(e)})}
    except Exception as e:
        print(f"Error: {e}")
        import traceback; traceback.print_exc()
        # Audit failure
        try:
            user_info, ip = extract_user_info(event)
            body_data = json.loads(event.get('body') or '{}')
            log_audit(user_info=user_info, action='AI_GRADING_FAILED', resource_type='image',
                      resource_id=body_data.get('imageId', 'unknown'),
                      session_id=body_data.get('sessionId', 'unknown'),
                      stage='icsi_documentation', result='failure',
                      error_message=str(e), ip_address=ip)
        except: pass
        return {'statusCode': 500, 'headers': CORS, 'body': json.dumps({'error': str(e)})}
