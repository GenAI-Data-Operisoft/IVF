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

GRADING_PROMPT = """You are an expert clinical embryologist with 20+ years of IVF laboratory experience. Your task is to analyze this embryo image and provide an accurate grade. This assessment directly influences patient treatment — accuracy is critical.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
PHASE 1 — IDENTIFY WHAT YOU SEE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
First, is this a microscopic embryo image?
- If you see a petri dish label, text, equipment, or anything non-biological → is_embryo: false
- If you see a biological specimen with a zona pellucida → is_embryo: true, continue below

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
PHASE 2 — DETERMINE THE STAGE (CRITICAL)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Look at the INTERNAL STRUCTURE of the embryo very carefully:

IS THERE A FLUID-FILLED CAVITY (blastocoel)?
→ YES — This is a BLASTOCYST (Day 5, 6, or 7). Go to BLASTOCYST GRADING below.
→ NO — This is a CLEAVAGE STAGE embryo (Day 1-4). Go to CLEAVAGE GRADING below.

Key visual difference:
- BLASTOCYST: You will see a large dark/clear fluid cavity taking up significant space inside the zona. The embryo looks like it has an "empty" or "hollow" area. Individual cells are NOT countable — instead you see a compact cell mass (ICM) on one side and a thin cell layer (TE) lining the cavity.
- CLEAVAGE: You can see and COUNT individual round cells (blastomeres) separated from each other. No large fluid cavity. Cells are distinct and countable.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
BLASTOCYST GRADING — Day 5 / 6 / 7
(Use ONLY if you confirmed a fluid cavity above)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Use Gardner & Schoolcraft classification. Grade = [Expansion][ICM][TE] e.g. "5AB"

EXPANSION (1–6) — How large is the blastocoel cavity and what is the zona status?
  1 = Early blastocyst: cavity present but <50% of embryo volume, zona normal thickness
  2 = Blastocyst: cavity >50% of volume, zona intact and normal thickness
  3 = Full blastocyst: cavity fills entire embryo, zona intact and normal thickness
  4 = Expanded: cavity larger than original embryo size, zona VISIBLY THINNING but still completely intact with NO breach or hole
  5 = Hatching: zona has a VISIBLE BREACH/HOLE/RUPTURE — trophectoderm cells are actively pushing through or herniated out. The zona is broken, not just thin.
  6 = Hatched: embryo completely outside the zona — zona is empty or absent

CRITICAL DISTINCTION between 4 and 5:
  Grade 4 = zona is thin but INTACT (no hole, no cells outside)
  Grade 5 = zona has a HOLE and cells are OUTSIDE or pushing through
  If you see ANY trophectoderm cells outside the zona boundary → it is grade 5, not 4

ICM — Inner Cell Mass (the compact cluster of cells on one side of the cavity):
  A = Prominent, tightly packed, many cells, clearly defined — looks like a solid dark mass
  B = Loosely grouped, fewer cells, less defined boundary
  C = Very few cells, barely visible, degenerate or fragmented appearance

TE — Trophectoderm (the thin layer of cells lining the inside of the cavity wall):
  A = Many small cells forming a cohesive, uniform, continuous epithelial layer
  B = Fewer cells, loose or irregular arrangement, gaps visible
  C = Very few large cells, sparse coverage, poor quality

BLASTOCYST QUALITY:
  Excellent: 4AA, 5AA, 4AB, 5AB, 4BA, 5BA
  Good: 3AA, 3AB, 3BA, 4BB, 5BB, 6AA, 6AB
  Fair: 2AA, 2AB, 3BB, any expansion with one C
  Poor: Any C in both ICM and TE, or expansion 1-2 with B/C grades

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
CLEAVAGE GRADING — Day 1 / 2 / 3 / 4
(Use ONLY if you confirmed individual countable cells above)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Identify the day:
  Day 1 (Zygote): 1 cell, 2 pronuclei visible, polar bodies present
  Day 2: 2-4 distinct blastomeres
  Day 3: 6-10 blastomeres (ideal: 7-8 cells)
  Day 4 (Morula): Cells compacted into a dense mass, individual cells hard to distinguish

For Day 3 specifically, assess:
1. CELL COUNT: Count every visible blastomere (ideal = 7-8)
2. FRAGMENTATION: Estimate % of cytoplasm as anucleate fragments
   Grade 1 = <10% | Grade 2 = 10-25% | Grade 3 = 25-50% | Grade 4 = >50%
3. SYMMETRY: Are blastomeres equal in size? (Even = good, Uneven = poor)
4. MULTINUCLEATION: Any cell with >1 nucleus? (Present = significantly reduces viability)

Grade format: "Grade [1-4], [X] cells" e.g. "Grade 1, 8 cells"
Quality: Excellent (Grade 1, 7-8 cells, even, no MN) | Good (Grade 1-2, 6-9 cells) | Fair (Grade 2-3) | Poor (Grade 3-4, <5 cells, or MN present)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
RECOMMENDATION
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Transfer — Excellent/Good quality, suitable for fresh transfer
Freeze — Good quality, suitable for vitrification
Continue Culture — Early stage or borderline, extend culture
Discard — Poor quality, not viable

CONFIDENCE: 0.9-1.0 = clear image, certain | 0.7-0.89 = minor artifacts, confident | 0.5-0.69 = some structures unclear | <0.5 = poor image, speculative

RESPOND WITH ONLY THIS JSON — NO OTHER TEXT:
{
  "is_embryo": true or false,
  "not_embryo_reason": "what the image shows if not embryo, else empty string",
  "stage": "Day 1 (Zygote)" or "Day 2 (2-4 cell)" or "Day 3 (Cleavage)" or "Day 4 (Morula)" or "Day 5 (Blastocyst)" or "Day 6 (Expanded Blastocyst)" or "Day 7 (Hatching/Hatched Blastocyst)",
  "grade": "Grade 1, 8 cells" or "4AA" or "5AB" etc.,
  "quality": "Excellent" or "Good" or "Fair" or "Poor",
  "recommendation": "Transfer" or "Freeze" or "Continue Culture" or "Discard",
  "description": "3-4 sentences: state stage, key morphological findings (cavity size/ICM/TE for blastocyst OR cell count/fragmentation/symmetry for cleavage), zona appearance, and any notable features.",
  "clinical_notes": "Most important clinical finding for the embryologist — e.g. hatching status, multinucleation, borderline grade, or image quality caveat.",
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
