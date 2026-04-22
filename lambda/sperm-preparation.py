import json
import boto3
import os
from datetime import datetime

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
            data = item.get('sperm_preparation', {})
            return {'statusCode': 200, 'headers': CORS, 'body': json.dumps({'remark': data.get('remark', '')})}
        elif method == 'POST':
            body = json.loads(event.get('body') or '{}')
            remark = body.get('remark', '')
            cases_table.update_item(
                Key={'sessionId': session_id},
                UpdateExpression='SET sperm_preparation = :d',
                ExpressionAttributeValues={
                    ':d': {'remark': remark, 'updated_at': datetime.utcnow().isoformat()}
                }
            )
            return {'statusCode': 200, 'headers': CORS, 'body': json.dumps({'message': 'Saved'})}
        return {'statusCode': 405, 'headers': CORS, 'body': json.dumps({'error': 'Method not allowed'})}
    except Exception as e:
        print(f'Error: {e}')
        return {'statusCode': 500, 'headers': CORS, 'body': json.dumps({'error': str(e)})}
