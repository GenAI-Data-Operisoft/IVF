"""
Override Validation — allows user to manually override a failed OCR validation.
Marks the stage as completed with override metadata for audit trail.
"""
import json
import boto3
import os
from datetime import datetime
from audit_helper import log_audit, ACTIONS

dynamodb = boto3.resource('dynamodb')
cases_table = dynamodb.Table(os.environ.get('CASES_TABLE', 'IVF-Cases'))

CORS = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST,OPTIONS',
}


def lambda_handler(event, context):
    if event.get('httpMethod') == 'OPTIONS':
        return {'statusCode': 200, 'headers': CORS, 'body': ''}

    try:
        session_id = event['pathParameters']['sessionId']
        body = json.loads(event['body'])

        stage = body['stage']
        corrected_fields = body.get('corrected_fields', {})
        justification = body.get('justification', '')
        original_mismatches = body.get('original_mismatches', [])
        user_email = body.get('userEmail', 'unknown')
        user_name = body.get('userName', 'unknown')

        now = datetime.utcnow().isoformat()

        override_record = {
            'overridden_at': now,
            'overridden_by': user_email,
            'overridden_by_name': user_name,
            'justification': justification,
            'corrected_fields': corrected_fields,
            'original_mismatches': original_mismatches,
        }

        # Update stage: mark completed + store override metadata
        cases_table.update_item(
            Key={'sessionId': session_id},
            UpdateExpression='''SET 
                stages.#stage.#status = :status,
                stages.#stage.completed_at = :now,
                stages.#stage.validation_result = :result,
                stages.#stage.manual_override = :override
            ''',
            ExpressionAttributeNames={
                '#stage': stage,
                '#status': 'status',
            },
            ExpressionAttributeValues={
                ':status': 'completed',
                ':now': now,
                ':result': 'override',
                ':override': override_record,
            }
        )

        # Audit log
        log_audit(
            user_info={
                'userId': body.get('userId', 'unknown'),
                'userEmail': user_email,
                'userName': user_name,
                'userRole': body.get('userRole', 'unknown'),
            },
            action='MANUAL_OVERRIDE',
            resource_type='validation',
            resource_id=session_id,
            session_id=session_id,
            stage=stage,
            result='override',
            metadata={
                'message': f'Manual validation override by {user_name}',
                'justification': justification,
                'corrected_fields': corrected_fields,
                'original_mismatches': original_mismatches,
            }
        )

        return {
            'statusCode': 200,
            'headers': CORS,
            'body': json.dumps({
                'message': 'Validation overridden successfully',
                'sessionId': session_id,
                'stage': stage,
            })
        }

    except Exception as e:
        print(f'Error: {e}')
        import traceback; traceback.print_exc()
        return {
            'statusCode': 500,
            'headers': CORS,
            'body': json.dumps({'error': str(e)})
        }
