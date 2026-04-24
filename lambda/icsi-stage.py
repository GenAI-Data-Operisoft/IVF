import json
import boto3
import os
from datetime import datetime
try:
    from audit_helper import log_audit
except:
    log_audit = None

dynamodb = boto3.resource('dynamodb')
cases_table = dynamodb.Table(os.environ.get('CASES_TABLE', 'IVF-Cases'))

CORS = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
}

def lambda_handler(event, context):
    method = event.get('httpMethod', 'GET')
    session_id = event.get('pathParameters', {}).get('sessionId')
    if not session_id:
        return {'statusCode': 400, 'headers': CORS, 'body': json.dumps({'error': 'Missing sessionId'})}
    if method == 'OPTIONS':
        return {'statusCode': 200, 'headers': CORS, 'body': ''}
    try:
        if method == 'GET':
            resp = cases_table.get_item(Key={'sessionId': session_id})
            item = resp.get('Item', {})
            data = item.get('icsi_stage', {})
            return {'statusCode': 200, 'headers': CORS, 'body': json.dumps({
                'procedure_type': data.get('procedure_type', ''),
                'remark': data.get('remark', ''),
                'video_s3_key': data.get('video_s3_key', ''),
            })}
        elif method == 'POST':
            body = json.loads(event.get('body') or '{}')
            cases_table.update_item(
                Key={'sessionId': session_id},
                UpdateExpression='SET icsi_stage = :d',
                ExpressionAttributeValues={
                    ':d': {
                        'procedure_type': body.get('procedure_type', ''),
                        'remark': body.get('remark', ''),
                        'video_s3_key': body.get('video_s3_key', ''),
                        'updated_at': datetime.utcnow().isoformat()
                    }
                }
            )
            return {'statusCode': 200, 'headers': CORS, 'body': json.dumps({'message': 'Saved'})}
        return {'statusCode': 405, 'headers': CORS, 'body': json.dumps({'error': 'Method not allowed'})}
    except Exception as e:
        print(f'Error: {e}')
        return {'statusCode': 500, 'headers': CORS, 'body': json.dumps({'error': str(e)})}
