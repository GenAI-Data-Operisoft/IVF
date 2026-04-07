import json
import boto3
import os
from datetime import datetime

dynamodb = boto3.resource('dynamodb')
images_table = dynamodb.Table(os.environ.get('IMAGES_TABLE', 'IVF-InjectedOocyteImages'))

def lambda_handler(event, context):
    """
    Increment download count for an annotated image
    API Gateway endpoint: POST /annotated-images/{imageId}/download
    """
    try:
        image_id = event['pathParameters']['imageId']
        
        # Increment download count
        response = images_table.update_item(
            Key={'imageId': image_id},
            UpdateExpression='SET download_count = if_not_exists(download_count, :zero) + :inc, last_downloaded_at = :timestamp',
            ExpressionAttributeValues={
                ':inc': 1,
                ':zero': 0,
                ':timestamp': datetime.utcnow().isoformat()
            },
            ReturnValues='ALL_NEW'
        )
        
        return {
            'statusCode': 200,
            'headers': {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            },
            'body': json.dumps({
                'message': 'Download count updated',
                'download_count': int(response['Attributes'].get('download_count', 0))
            })
        }
        
    except Exception as e:
        print(f"Error updating download count: {str(e)}")
        return {
            'statusCode': 500,
            'headers': {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            },
            'body': json.dumps({'error': str(e)})
        }
