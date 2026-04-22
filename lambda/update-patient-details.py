import json
import boto3
import os
from datetime import datetime
from audit_helper import log_audit, extract_user_info, create_change_details, ACTIONS

dynamodb = boto3.resource('dynamodb')
cases_table = dynamodb.Table(os.environ.get('CASES_TABLE', 'IVF-Cases'))

def lambda_handler(event, context):
    """
    Update patient details for a case
    PUT /case/{sessionId}/patients
    """
    try:
        # Parse request
        session_id = event['pathParameters']['sessionId']
        body = json.loads(event['body'])
        
        male_patient = body.get('male_patient', {})
        female_patient = body.get('female_patient', {})
        
        # Validate required fields (name and mpeid required; last_name optional for backward compat)
        required_male_fields = ['name', 'mpeid']
        required_female_fields = ['name', 'mpeid']
        
        for field in required_male_fields:
            if not male_patient.get(field):
                return {
                    'statusCode': 400,
                    'headers': {
                        'Access-Control-Allow-Origin': '*',
                        'Access-Control-Allow-Headers': 'Content-Type',
                        'Access-Control-Allow-Methods': 'PUT,OPTIONS'
                    },
                    'body': json.dumps({'error': f'Male patient {field} is required'})
                }
        
        for field in required_female_fields:
            if not female_patient.get(field):
                return {
                    'statusCode': 400,
                    'headers': {
                        'Access-Control-Allow-Origin': '*',
                        'Access-Control-Allow-Headers': 'Content-Type',
                        'Access-Control-Allow-Methods': 'PUT,OPTIONS'
                    },
                    'body': json.dumps({'error': f'Female patient {field} is required'})
                }
        
        # Check if case exists
        response = cases_table.get_item(Key={'sessionId': session_id})
        if 'Item' not in response:
            return {
                'statusCode': 404,
                'headers': {
                    'Access-Control-Allow-Origin': '*',
                    'Access-Control-Allow-Headers': 'Content-Type',
                    'Access-Control-Allow-Methods': 'PUT,OPTIONS'
                },
                'body': json.dumps({'error': 'Case not found'})
            }
        
        # Store old values for audit
        old_case = response['Item']
        old_male = old_case.get('male_patient', {})
        old_female = old_case.get('female_patient', {})
        
        # Prepare new patient details
        new_male = {
            'name': male_patient['name'],
            'mpeid': male_patient['mpeid'],
            'dob': male_patient.get('dob', '')
        }
        new_female = {
            'name': female_patient['name'],
            'mpeid': female_patient['mpeid'],
            'dob': female_patient.get('dob', '')
        }
        
        # Create change details for audit
        male_changes = create_change_details(old_male, new_male)
        female_changes = create_change_details(old_female, new_female)
        
        # Update patient details
        update_expression = 'SET male_patient = :male, female_patient = :female, updated_at = :timestamp'
        expression_values = {
            ':male': new_male,
            ':female': new_female,
            ':timestamp': datetime.utcnow().isoformat()
        }
        
        cases_table.update_item(
            Key={'sessionId': session_id},
            UpdateExpression=update_expression,
            ExpressionAttributeValues=expression_values
        )
        
        # Log audit entry
        user_info, ip_address = extract_user_info(event)
        change_details = {}
        if male_changes:
            change_details['male_patient'] = male_changes
        if female_changes:
            change_details['female_patient'] = female_changes
        
        log_audit(
            user_info=user_info,
            action=ACTIONS['EDIT_PATIENT'],
            resource_type='patient',
            resource_id=session_id,
            session_id=session_id,
            patient_mpeid=new_female['mpeid'],
            change_details=change_details if change_details else None,
            result='success',
            ip_address=ip_address,
            metadata={
                'fields_changed': (male_changes.get('fields', []) if male_changes else []) + 
                                 (female_changes.get('fields', []) if female_changes else [])
            }
        )
        
        return {
            'statusCode': 200,
            'headers': {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Headers': 'Content-Type',
                'Access-Control-Allow-Methods': 'PUT,OPTIONS'
            },
            'body': json.dumps({
                'message': 'Patient details updated successfully',
                'sessionId': session_id
            })
        }
        
    except Exception as e:
        print(f"Error updating patient details: {str(e)}")
        return {
            'statusCode': 500,
            'headers': {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Headers': 'Content-Type',
                'Access-Control-Allow-Methods': 'PUT,OPTIONS'
            },
            'body': json.dumps({'error': str(e)})
        }
