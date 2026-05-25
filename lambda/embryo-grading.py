from datetime import datetime, timezone, timedelta
_IST = timezone(timedelta(hours=5, minutes=30))
def now_ist_iso(): return datetime.now(_IST).strftime('%Y-%m-%dT%H:%M:%S')
def now_ist_date(): return datetime.now(_IST).strftime('%Y-%m-%d')
def now_ist_timestamp(): return datetime.now(_IST).strftime('%Y%m%d_%H%M%S')
"""
embryo-grading.py

Analyses a microscope image using Amazon Bedrock (Qwen3 VL 235B) to provide
expert embryo grading. Identifies embryo stage and grades using ESHRE/ASRM standards.
Stores result in DynamoDB.

Trigger: POST /embryo-grading (API Gateway)
Table:   IVF-InjectedOocyteImages (DynamoDB)
"""

import json
import boto3
import os
import re
from datetime import datetime
from audit_helper import log_audit, extract_user_info, now_ist_iso, now_ist_date, now_ist_timestamp

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

GRADING_PROMPT = """You are an expert clinical embryologist. Analyze the provided embryo image and provide an accurate grade. This assessment directly influences patient treatment — accuracy is critical.

STEP 1 — IDENTIFY WHAT YOU SEE:
First determine if this is a microscopic embryo image.
- If the image shows a petri dish label, equipment, text, or anything NOT a biological specimen → set is_embryo: false
- If you see a biological specimen with zona pellucida, blastomeres, or blastocoel cavity → set is_embryo: true, continue below

STEP 2 — DETERMINE DEVELOPMENTAL STAGE:
Look at the INTERNAL STRUCTURE very carefully:

IS THERE A FLUID-FILLED CAVITY (blastocoel)?
YES → BLASTOCYST (Day 5, 6, or 7). Use BLASTOCYST GRADING below.
NO  → CLEAVAGE STAGE (Day 1-4). Use CLEAVAGE GRADING below.

Key visual difference:
- BLASTOCYST: Large hollow/fluid area inside. Individual cells NOT countable. Compact ICM on one side, thin TE layer lining the cavity.
- CLEAVAGE: Distinct countable round cells (blastomeres). No large fluid cavity.

BLASTOCYST GRADING — Gardner & Schoolcraft Classification
(Use ONLY if fluid cavity confirmed above)

Grade the blastocyst by assessing three parameters and output in format [Expansion][ICM][TE] e.g. "5AB":

(1) EXPANSION STAGE (1-6):
  1 = Early blastocyst: cavity <50% of embryo volume
  2 = Blastocyst: cavity >50% of volume, zona intact
  3 = Full blastocyst: cavity fills entire embryo, zona intact
  4 = Expanded: cavity larger than embryo, zona VISIBLY THINNING but INTACT — no hole, no cells outside
  5 = Hatching: zona has a VISIBLE HOLE — trophectoderm cells pushing through or herniated out
  6 = Hatched: embryo completely outside the zona

  CRITICAL — Grade 4 vs 5:
  Grade 4 = zona thin but INTACT (no hole, no cells outside)
  Grade 5 = zona has a HOLE and cells are OUTSIDE or pushing through
  If ANY trophectoderm cells are visible outside the zona boundary → Grade 5, not 4

(2) INNER CELL MASS quality (A/B/C):
  A = Prominent, tightly packed, many cells, clearly defined solid dark mass. Even during hatching, if ICM is a distinct compact cluster → Grade A.
  B = Loosely grouped, fewer cells, less defined boundary
  C = Very few cells, barely visible, degenerate appearance

(3) TROPHECTODERM quality (A/B/C):
  A = Many small cells forming a cohesive, continuous epithelial layer
  B = Fewer cells, loose or irregular arrangement, gaps visible
  C = Very few large cells, sparse coverage

Quality: Excellent (4AA/5AA/4AB/5AB/4BA/5BA) | Good (3AA/3AB/3BA/4BB/5BB) | Fair (2AA/2AB/3BB/any one C) | Poor (both C or expansion 1-2 with B/C)

CLEAVAGE GRADING — Day 1/2/3/4
(Use ONLY if individual countable cells confirmed above)

  Day 1 (Zygote): 1 cell, 2 pronuclei, polar bodies
  Day 2: 2-4 blastomeres
  Day 3: 6-10 blastomeres (ideal 7-8)
  Day 4 (Morula): Compacted mass, cells hard to distinguish

For Day 3: assess cell count, fragmentation % (Grade 1 <10%, Grade 2 10-25%, Grade 3 25-50%, Grade 4 >50%), symmetry, multinucleation
Grade format: "Grade [1-4], [X] cells" e.g. "Grade 1, 8 cells"
Quality: Excellent (Grade 1, 7-8 cells, even) | Good (Grade 1-2, 6-9 cells) | Fair (Grade 2-3) | Poor (Grade 3-4 or <5 cells)

RECOMMENDATION:
  Transfer — Excellent/Good quality, suitable for fresh transfer
  Freeze — Good quality, suitable for vitrification
  Continue Culture — Early stage or borderline
  Discard — Poor quality, not viable

CONFIDENCE: 0.9-1.0 = clear image | 0.7-0.89 = minor artifacts | 0.5-0.69 = some structures unclear | <0.5 = poor image

RESPOND WITH ONLY THIS JSON — NO OTHER TEXT:
{
  "is_embryo": true or false,
  "not_embryo_reason": "what the image shows if not embryo, else empty string",
  "stage": "Day 1 (Zygote)" or "Day 2 (2-4 cell)" or "Day 3 (Cleavage)" or "Day 4 (Morula)" or "Day 5 (Blastocyst)" or "Day 6 (Expanded Blastocyst)" or "Day 7 (Hatching/Hatched Blastocyst)",
  "grade": "5AB" or "4AA" or "Grade 1, 8 cells" etc.,
  "quality": "Excellent" or "Good" or "Fair" or "Poor",
  "recommendation": "Transfer" or "Freeze" or "Continue Culture" or "Discard",
  "description": "Structured justification for each parameter: (1) Expansion — observed cavity size and zona status with reasoning, (2) ICM — compactness and cell count observed, (3) TE — cohesion and cell arrangement observed. Include overall morphological assessment.",
  "clinical_notes": "Key clinical observation — hatching status, borderline grade, image quality caveat, or recommendation for the embryologist.",
  "confidence_score": 0.0 to 1.0
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
    """Call Qwen3 VL 235B via Converse API."""
    response = bedrock.converse(
        modelId='qwen.qwen3-vl-235b-a22b',
        messages=[{
            'role': 'user',
            'content': [
                {
                    'image': {
                        'format': 'jpeg',
                        'source': {'bytes': image_bytes}
                    }
                },
                {
                    'text': GRADING_PROMPT
                }
            ]
        }],
        inferenceConfig={
            'maxTokens': 1500,
            'temperature': 0.1
        }
    )
    raw_text = response['output']['message']['content'][0]['text']
    return raw_text, response


def parse_grading_response(raw_text):
    """Parse JSON from Bedrock response. Validates confidence_score."""
    clean = re.sub(r'```(?:json)?\s*', '', raw_text).strip()
    clean = clean.rstrip('`').strip()
    result = json.loads(clean)

    # Validate confidence_score
    confidence = result.get('confidence_score')
    if confidence is None or not isinstance(confidence, (int, float)):
        confidence = 0.5
    else:
        confidence = max(0.0, min(1.0, float(confidence)))
    result['confidence_score'] = confidence

    return result


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

        # Call Qwen3 VL via Converse API
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
            'confidence_score': str(grading.get('confidence_score', 0.5)),
            'model_used': 'Qwen3 VL 235B',
            'raw_response': raw_text[:2000],
            'graded_at': now_ist_iso() + 'Z'
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
