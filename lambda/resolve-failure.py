import json
import boto3
from datetime import datetime
import os
from audit_helper import log_audit, extract_user_info, ACTIONS

dynamodb = boto3.resource('dynamodb')
failures_table = dynamodb.Table(os.environ.get('FAILURES_TABLE', 'IVF-ValidationFailures'))
cases_table = dynamodb.Table(os.environ.get('CASES_TABLE', 'IVF-Cases'))

def lambda_handler(event, context):
    """
    Resolve a failure record when retry succeeds
    Updates the failure record with resolution information
    """
    try:
        body = json.loads(event['body'])
        
        session_id = body['sessionId']
        stage = body['stage']
        resolution_category = body.get('resolution_category', '')
        resolution_notes = body.get('resolution_notes', '')
        resolved_by_user = body.get('resolved_by_user', 'system')
        
        print(f"Resolving failure for session {session_id}, stage {stage}")
        
        # Find the active failure record for this session and stage
        response = failures_table.query(
            IndexName='SessionIdIndex',
            KeyConditionExpression='sessionId = :sid',
            FilterExpression='stage = :stage AND #status = :status',
            ExpressionAttributeNames={
                '#status': 'status'
            },
            ExpressionAttributeValues={
                ':sid': session_id,
                ':stage': stage,
                ':status': 'active'
            }
        )
        
        failures = response.get('Items', [])
        
        if not failures:
            print(f"No active failure found for session {session_id}, stage {stage}")
            return {
                'statusCode': 404,
                'headers': {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*'
                },
                'body': json.dumps({'message': 'No active failure found'})
            }
        
        # Get the most recent failure (in case there are multiple)
        failure = sorted(failures, key=lambda x: x['failed_at'], reverse=True)[0]
        failure_id = failure['failureId']
        failed_at = failure['failed_at']
        
        # Calculate resolution time
        resolved_at = datetime.utcnow().isoformat()
        failed_time = datetime.fromisoformat(failed_at.replace('Z', '+00:00'))
        resolved_time = datetime.fromisoformat(resolved_at)
        resolution_time_minutes = int((resolved_time - failed_time).total_seconds() / 60)
        
        # Get the successful extraction ID from the case
        case_response = cases_table.get_item(Key={'sessionId': session_id})
        case = case_response.get('Item', {})
        
        # Get all extractions for this stage to find the successful one
        from boto3.dynamodb.conditions import Key
        
        # Determine the extraction table based on stage
        stage_table_map = {
            'label_validation': 'IVF-LabelValidationExtractions',
            'oocyte_collection': 'IVF-OocyteCollectionExtractions',
            'denudation': 'IVF-DenudationExtractions',
            'male_sample_collection': 'IVF-MaleSampleCollectionExtractions',
            'icsi': 'IVF-ICSIExtractions',
            'culture': 'IVF-CultureExtractions'
        }
        
        extraction_table_name = stage_table_map.get(stage)
        if extraction_table_name:
            extraction_table = dynamodb.Table(extraction_table_name)
            
            # Query for all extractions for this session
            extraction_response = extraction_table.query(
                IndexName='SessionIdIndex',
                KeyConditionExpression=Key('sessionId').eq(session_id)
            )
            
            extractions = extraction_response.get('Items', [])
            
            # Find the successful extraction (most recent with overall_match = True)
            successful_extraction = None
            for extraction in sorted(extractions, key=lambda x: x.get('validated_at', ''), reverse=True):
                if extraction.get('validation_result', {}).get('overall_match') == True:
                    successful_extraction = extraction
                    break
            
            successful_extraction_id = successful_extraction['extractionId'] if successful_extraction else None
        else:
            successful_extraction_id = None
        
        # Update the failure record
        update_expression = """
            SET #status = :status,
                resolved_at = :resolved_at,
                resolution_time_minutes = :resolution_time,
                resolution_category = :category,
                resolution_notes = :notes,
                resolved_by_user = :user,
                updated_at = :updated_at
        """
        
        expression_values = {
            ':status': 'resolved',
            ':resolved_at': resolved_at,
            ':resolution_time': resolution_time_minutes,
            ':category': resolution_category,
            ':notes': resolution_notes,
            ':user': resolved_by_user,
            ':updated_at': resolved_at
        }
        
        if successful_extraction_id:
            update_expression += ', successful_extraction_id = :success_id'
            expression_values[':success_id'] = successful_extraction_id
        
        failures_table.update_item(
            Key={'failureId': failure_id},
            UpdateExpression=update_expression,
            ExpressionAttributeNames={
                '#status': 'status'
            },
            ExpressionAttributeValues=expression_values
        )
        
        print(f"Updated failure record {failure_id} with resolution info")
        
        # Log audit entry for resolution
        user_info, ip_address = extract_user_info(event)
        log_audit(
            user_info=user_info,
            action=ACTIONS['RESOLVE_FAILURE'],
            resource_type='failure',
            resource_id=failure_id,
            session_id=session_id,
            stage=stage,
            result='success',
            ip_address=ip_address,
            metadata={
                'resolution_category': resolution_category,
                'resolution_notes': resolution_notes,
                'resolution_time_minutes': resolution_time_minutes,
                'successful_extraction_id': successful_extraction_id
            }
        )
        
        return {
            'statusCode': 200,
            'headers': {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            },
            'body': json.dumps({
                'message': 'Failure resolved successfully',
                'failureId': failure_id,
                'resolution_time_minutes': resolution_time_minutes
            })
        }
        
    except Exception as e:
        print(f"Error resolving failure: {str(e)}")
        import traceback
        traceback.print_exc()
        
        return {
            'statusCode': 500,
            'headers': {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            },
            'body': json.dumps({
                'error': 'Internal server error',
                'message': str(e)
            })
        }
