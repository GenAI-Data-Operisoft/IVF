import json
import boto3
import os
from datetime import datetime

s3_client = boto3.client('s3')

BUCKET_NAME = os.environ.get('BUCKET_NAME', 'ivf-witness-capture-images')

def lambda_handler(event, context):
    """
    Generate presigned download URL for an image in S3
    """
    try:
        print(f"Received event: {json.dumps(event)}")
        
        # Handle both API Gateway and Function URL formats
        if 'body' in event and isinstance(event['body'], str):
            body = json.loads(event['body'])
        elif 'body' in event:
            body = event['body']
        else:
            body = event
        
        s3_key = body.get('s3_key')
        
        if not s3_key:
            return {
                'statusCode': 400,
                'headers': {
                    'Access-Control-Allow-Origin': '*',
                    'Access-Control-Allow-Headers': 'Content-Type',
                    'Access-Control-Allow-Methods': 'POST, OPTIONS'
                },
                'body': json.dumps({'error': 'Missing s3_key'})
            }
        
        print(f"Generating presigned URL for: {s3_key}")
        
        # Generate presigned URL for download (valid for 1 hour)
        download_url = s3_client.generate_presigned_url(
            'get_object',
            Params={
                'Bucket': BUCKET_NAME,
                'Key': s3_key
            },
            ExpiresIn=3600  # 1 hour
        )
        
        print(f"Generated URL successfully")
        
        return {
            'statusCode': 200,
            'headers': {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Headers': 'Content-Type',
                'Access-Control-Allow-Methods': 'POST, OPTIONS'
            },
            'body': json.dumps({
                'downloadUrl': download_url,
                's3_key': s3_key
            })
        }
        
    except Exception as e:
        print(f"Error generating download URL: {str(e)}")
        import traceback
        traceback.print_exc()
        return {
            'statusCode': 500,
            'headers': {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Headers': 'Content-Type',
                'Access-Control-Allow-Methods': 'POST, OPTIONS'
            },
            'body': json.dumps({'error': str(e)})
        }
