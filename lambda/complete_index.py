import json
import boto3
import os
from datetime import datetime

dynamodb = boto3.resource('dynamodb')
cases_table = dynamodb.Table(os.environ.get('CASES_TABLE', 'IVF-Cases'))

def lambda_handler(event, context):
    """
    Mark a stage as completed
    """
    try:
        body = json.loads(event['body'])
        session_id = body['sessionId']
        stage = body['stage']
        
        # Update stage status to completed
        cases_table.update_item(
            Key={'sessionId': session_id},
            UpdateExpression='SET stages.#stage.#status = :status, stages.#stage.#completed_at = :completed_at',
            ExpressionAttributeNames={
                '#stage': stage,
                '#status': 'status',
                '#completed_at': 'completed_at'
            },
            ExpressionAttributeValues={
                ':status': 'completed',
                ':completed_at': datetime.utcnow().isoformat()
            }
        )
        
        return {
            'statusCode': 200,
            'headers': {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            },
            'body': json.dumps({
                'message': 'Stage completed successfully',
                'sessionId': session_id,
                'stage': stage
            })
        }
        
    except Exception as e:
        print(f"Error: {str(e)}")
        import traceback
        traceback.print_exc()
        return {
            'statusCode': 500,
            'headers': {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            },
            'body': json.dumps({'error': 'Internal server error', 'message': str(e)})
        }
