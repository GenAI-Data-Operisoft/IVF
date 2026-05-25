from datetime import datetime, timezone, timedelta
_IST = timezone(timedelta(hours=5, minutes=30))
def now_ist_iso(): return datetime.now(_IST).strftime('%Y-%m-%dT%H:%M:%S')
def now_ist_date(): return datetime.now(_IST).strftime('%Y-%m-%d')
def now_ist_timestamp(): return datetime.now(_IST).strftime('%Y%m%d_%H%M%S')
"""
social-freezing-registration.py

Registers a new Social Embryo Freezing case.
Stores in IVF-SocialFreezing DynamoDB table (separate from IVF-Cases).
Only female patient details required.

Trigger: POST /social-freezing/register (API Gateway)
Table:   IVF-SocialFreezing (DynamoDB)
"""

import json
import boto3
import uuid
import os
from datetime import datetime
from audit_helper import log_audit, extract_user_info, now_ist_iso, now_ist_date, now_ist_timestamp

dynamodb = boto3.resource('dynamodb')
table = dynamodb.Table(os.environ.get('SOCIAL_FREEZING_TABLE', 'IVF-SocialFreezing'))

CORS = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type,Authorization',
    'Access-Control-Allow-Methods': 'POST,GET,OPTIONS'
}


def lambda_handler(event, context):
    if event.get('httpMethod') == 'OPTIONS':
        return {'statusCode': 200, 'headers': CORS, 'body': ''}

    method = event.get('httpMethod', 'POST')

    try:
        if method == 'POST':
            return handle_register(event)
        elif method == 'GET':
            return handle_get(event)
        else:
            return {'statusCode': 405, 'headers': CORS, 'body': json.dumps({'error': 'Method not allowed'})}
    except Exception as e:
        print(f"Error: {e}")
        import traceback; traceback.print_exc()
        return {'statusCode': 500, 'headers': CORS, 'body': json.dumps({'error': str(e)})}


def handle_register(event):
    body = json.loads(event.get('body') or '{}')

    female = body.get('female_patient', {})
    if not female.get('name') or not female.get('mpeid'):
        return {'statusCode': 400, 'headers': CORS, 'body': json.dumps({'error': 'female_patient name and mpeid required'})}

    session_id = str(uuid.uuid4())
    user_info, ip = extract_user_info(event)

    # Determine center
    center = body.get('center', '')
    if not center:
        center = user_info.get('userCenter', '')

    item = {
        'sessionId': session_id,
        'case_type': 'social_freezing',
        'female_patient': {
            'name': female.get('name', '').upper().strip(),
            'mpeid': female.get('mpeid', '').strip(),
            'type': female.get('type', 'self'),
        },
        'procedure_date': body.get('procedure_date', now_ist_date()),
        'doctor_name': body.get('doctor_name', ''),
        'center': center,
        'model_config': body.get('model_config', {
            'model_id': 'qwen.qwen3-vl-235b-a22b',
            'model_name': 'Qwen3 VL 235B'
        }),
        'created_at': now_ist_iso(),
        'created_by': user_info.get('userId', 'unknown'),
        'stages': {
            'label_validation': {'status': 'pending', 'images_required': 1, 'images_uploaded': 0},
            'culture':          {'status': 'pending', 'images_required': 1, 'images_uploaded': 0},
        },
        'status': 'active',
    }

    table.put_item(Item=item)

    log_audit(
        user_info=user_info,
        action='REGISTER_CASE',
        resource_type='social_freezing_case',
        resource_id=session_id,
        session_id=session_id,
        stage='registration',
        result='success',
        ip_address=ip,
        metadata={
            'case_type': 'social_freezing',
            'female_name': female.get('name'),
            'female_mpeid': female.get('mpeid'),
            'center': center,
        }
    )

    return {
        'statusCode': 200,
        'headers': CORS,
        'body': json.dumps({'sessionId': session_id, 'message': 'Social freezing case registered'})
    }


def handle_get(event):
    """Get a social freezing case by sessionId"""
    params = event.get('pathParameters') or {}
    session_id = params.get('sessionId')

    if not session_id:
        # List recent cases
        resp = table.scan(Limit=50)
        items = resp.get('Items', [])
        items.sort(key=lambda x: x.get('created_at', ''), reverse=True)
        return {'statusCode': 200, 'headers': CORS, 'body': json.dumps({'cases': items}, default=str)}

    resp = table.get_item(Key={'sessionId': session_id})
    if 'Item' not in resp:
        return {'statusCode': 404, 'headers': CORS, 'body': json.dumps({'error': 'Case not found'})}

    return {'statusCode': 200, 'headers': CORS, 'body': json.dumps(resp['Item'], default=str)}
