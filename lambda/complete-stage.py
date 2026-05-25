from datetime import datetime, timezone, timedelta
_IST = timezone(timedelta(hours=5, minutes=30))
def now_ist_iso(): return datetime.now(_IST).strftime('%Y-%m-%dT%H:%M:%S')
def now_ist_date(): return datetime.now(_IST).strftime('%Y-%m-%d')
def now_ist_timestamp(): return datetime.now(_IST).strftime('%Y%m%d_%H%M%S')
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
from audit_helper import log_audit, extract_user_info, now_ist_iso, now_ist_date, now_ist_timestamp

dynamodb = boto3.resource('dynamodb')
cases_table = dynamodb.Table(os.environ.get('CASES_TABLE', 'IVF-Cases'))


def lambda_handler(event, context):
    try:
        body = json.loads(event['body'])
        session_id = body['sessionId']
        stage = body['stage']
        # Allow optional status override (e.g. 'skipped' for optional stages)
        status = body.get('status', 'completed')

        # Initialize stage key if it doesn't exist (for stages added after case creation e.g. day6, day7, iui)
        try:
            cases_table.update_item(
                Key={'sessionId': session_id},
                UpdateExpression='SET stages.#stage = if_not_exists(stages.#stage, :empty)',
                ExpressionAttributeNames={'#stage': stage},
                ExpressionAttributeValues={':empty': {'status': 'pending', 'images_required': 0, 'images_uploaded': 0}}
            )
        except Exception:
            pass  # Stage already exists, continue

        cases_table.update_item(
            Key={'sessionId': session_id},
            UpdateExpression='SET stages.#stage.#status = :status, stages.#stage.#completed_at = :completed_at',
            ExpressionAttributeNames={
                '#stage': stage,
                '#status': 'status',
                '#completed_at': 'completed_at'
            },
            ExpressionAttributeValues={
                ':status': status,
                ':completed_at': now_ist_iso()
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
