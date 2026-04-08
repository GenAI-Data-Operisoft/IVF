"""
get-image-download-url.py

Generates a short-lived presigned URL so the frontend can download an image
directly from S3 without exposing the bucket publicly. The URL is valid for
1 hour, after which a new one must be requested.

Trigger: POST /image-download-url (API Gateway, Cognito authenticated)
Bucket:  IVF image storage S3 bucket (set via BUCKET_NAME env var)
"""

import json
import boto3
import os
from datetime import datetime

s3_client = boto3.client('s3')

BUCKET_NAME = os.environ.get('BUCKET_NAME', 'ivf-witness-capture-images')


def lambda_handler(event, context):
    """
    Accepts an S3 key in the request body and returns a presigned GET URL.
    Handles both API Gateway format (body as string) and direct invocation.
    """
    try:
        print(f"Received event: {json.dumps(event)}")

        # API Gateway sends the body as a JSON string, so we parse it.
        # Direct Lambda invocations may pass the body as a dict already.
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

        # Generate a presigned GET URL valid for 1 hour.
        # The frontend uses this URL to display or download the image.
        download_url = s3_client.generate_presigned_url(
            'get_object',
            Params={
                'Bucket': BUCKET_NAME,
                'Key': s3_key
            },
            ExpiresIn=3600  # 1 hour in seconds
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
