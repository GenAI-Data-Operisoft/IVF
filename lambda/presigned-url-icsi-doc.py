import json
import boto3
import os
from datetime import datetime

s3_client = boto3.client('s3')

BUCKET_NAME = os.environ.get('BUCKET_NAME', 'c9-ivf-witness-capture-artifacts-288761729756')

def lambda_handler(event, context):
    """
    Generate presigned URL for ICSI documentation image upload
    API Gateway endpoint: POST /presigned-url-icsi-doc
    """
    try:
        body = json.loads(event['body'])
        session_id = body['sessionId']
        image_number = body.get('imageNumber', 1)
        
        # Generate S3 key for original image
        timestamp = datetime.utcnow().strftime('%Y%m%d_%H%M%S')
        s3_key = f'icsi-injected-original/{session_id}/image_{image_number}_{timestamp}.jpg'
        
        # Generate presigned URL for upload (valid for 10 minutes)
        upload_url = s3_client.generate_presigned_url(
            'put_object',
            Params={
                'Bucket': BUCKET_NAME,
                'Key': s3_key,
                'ContentType': 'image/jpeg',
                'ServerSideEncryption': 'AES256'
            },
            ExpiresIn=600
        )
        
        return {
            'statusCode': 200,
            'headers': {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            },
            'body': json.dumps({
                'uploadUrl': upload_url,
                's3Key': s3_key,
                'bucket': BUCKET_NAME
            })
        }
        
    except Exception as e:
        print(f"Error generating presigned URL: {str(e)}")
        return {
            'statusCode': 500,
            'headers': {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            },
            'body': json.dumps({'error': str(e)})
        }
