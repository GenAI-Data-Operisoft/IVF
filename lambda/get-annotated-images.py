import json
import boto3
import os
from decimal import Decimal

dynamodb = boto3.resource('dynamodb')
s3_client = boto3.client('s3')

images_table = dynamodb.Table(os.environ.get('IMAGES_TABLE', 'IVF-InjectedOocyteImages'))

def lambda_handler(event, context):
    """
    Get all annotated images for a session
    API Gateway endpoint: GET /sessions/{sessionId}/annotated-images
    """
    try:
        print(f"Received event: {json.dumps(event)}")
        
        # Extract session ID from path parameters
        session_id = event['pathParameters']['sessionId']
        
        # Query images by session ID
        response = images_table.query(
            IndexName='SessionIdIndex',
            KeyConditionExpression='sessionId = :sid',
            ExpressionAttributeValues={':sid': session_id}
        )
        
        images = response.get('Items', [])
        
        # Generate presigned URLs for download
        for image in images:
            if image.get('annotated_s3_path'):
                # Extract bucket and key from s3 path
                s3_path = image['annotated_s3_path']
                # Format: s3://bucket/key
                parts = s3_path.replace('s3://', '').split('/', 1)
                if len(parts) == 2:
                    bucket, key = parts
                    
                    # Generate presigned URL (valid for 1 hour)
                    download_url = s3_client.generate_presigned_url(
                        'get_object',
                        Params={'Bucket': bucket, 'Key': key},
                        ExpiresIn=3600
                    )
                    image['download_url'] = download_url
        
        # Convert Decimal to int/float for JSON serialization
        images = json.loads(json.dumps(images, default=decimal_default))
        
        return {
            'statusCode': 200,
            'headers': {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            },
            'body': json.dumps({
                'sessionId': session_id,
                'images': images,
                'count': len(images)
            })
        }
        
    except Exception as e:
        print(f"Error getting annotated images: {str(e)}")
        return {
            'statusCode': 500,
            'headers': {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            },
            'body': json.dumps({'error': str(e)})
        }

def decimal_default(obj):
    """Helper to convert Decimal to int/float"""
    if isinstance(obj, Decimal):
        return int(obj) if obj % 1 == 0 else float(obj)
    raise TypeError
