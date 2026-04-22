"""
Oocyte Impression handler — GET/POST remark and image metadata for the denudation stage.
Images are uploaded directly to S3 via presigned URLs (existing flow).
This endpoint stores/retrieves the remark and image S3 keys in the Cases table.
"""
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
            impression = item.get('oocyte_impression', {})
            return {
                'statusCode': 200,
                'headers': CORS,
                'body': json.dumps({
                    'remark': impression.get('remark', ''),
                    'images': impression.get('images', []),
                    'updated_at': impression.get('updated_at', ''),
                })
            }

        elif method == 'POST':
            body = json.loads(event.get('body') or '{}')
            remark = body.get('remark', '')

            # Fetch existing impression to preserve image list
            resp = cases_table.get_item(Key={'sessionId': session_id})
            item = resp.get('Item', {})
            existing = item.get('oocyte_impression', {})

            updated = {
                **existing,
                'remark': remark,
                'updated_at': datetime.utcnow().isoformat(),
            }

            cases_table.update_item(
                Key={'sessionId': session_id},
                UpdateExpression='SET oocyte_impression = :imp',
                ExpressionAttributeValues={':imp': updated}
            )

            return {
                'statusCode': 200,
                'headers': CORS,
                'body': json.dumps({'message': 'Remark saved', 'sessionId': session_id})
            }

        else:
            return {'statusCode': 405, 'headers': CORS, 'body': json.dumps({'error': 'Method not allowed'})}

    except Exception as e:
        print(f'Error: {e}')
        import traceback; traceback.print_exc()
        return {'statusCode': 500, 'headers': CORS, 'body': json.dumps({'error': str(e)})}
