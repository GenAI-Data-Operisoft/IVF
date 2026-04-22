"""
complete-stage.py

Marks a specific IVF stage as completed for a given session. Called by the
frontend after the user confirms they are done with a stage (for example,
after ICSI documentation images have been captured). Updates the stage status
and records the completion timestamp in DynamoDB.

Trigger: POST /complete-stage (API Gateway, Cognito authenticated)
Table:   IVF-Cases (DynamoDB)
"""

import json
import boto3
import os
from datetime import datetime
from audit_helper import log_audit, extract_user_info

dynamodb = boto3.resource('dynamodb')
cases_table = dynamodb.Table(os.environ.get('CASES_TABLE', 'IVF-Cases'))


def lambda_handler(event, context):
    try:
        body = json.loads(event['body'])
        session_id = body['sessionId']
        stage = body['stage']

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

        # Audit log
        user_info, ip_address = extract_user_info(event)
        log_audit(
            user_info=user_info,
            action='COMPLETE_STAGE',
            resource_type='stage',
            resource_id=session_id,
            session_id=session_id,
            stage=stage,
            result='success',
            ip_address=ip_address,
            metadata={'message': f'Stage {stage} marked as completed'}
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
