"""
registration-handler.py

Handles new IVF case registration. Called when a nurse starts a new witness
capture session. Creates the case record in DynamoDB with patient details,
initializes all 7 stage statuses to pending, and logs the registration event
to the audit table.

Trigger: POST /register (API Gateway, Cognito authenticated)
Table:   IVF-Cases (DynamoDB)
"""

import json
import boto3
import uuid
from datetime import datetime
import os
from audit_helper import log_audit, extract_user_info, ACTIONS

dynamodb = boto3.resource('dynamodb')
cases_table = dynamodb.Table(os.environ.get('CASES_TABLE', 'IVF-Cases'))
cognito = boto3.client('cognito-idp', region_name=os.environ.get('AWS_REGION', 'ap-south-1'))
USER_POOL_ID = os.environ.get('USER_POOL_ID', '')


def get_user_center(event):
    """Get the user's assigned center from Cognito using their username from the JWT token."""
    try:
        claims = event.get('requestContext', {}).get('authorizer', {}).get('claims', {})
        # Try sub (UUID) first, then email
        username = claims.get('sub') or claims.get('cognito:username') or claims.get('email')
        if not username or not USER_POOL_ID:
            print(f"No username found in claims: {list(claims.keys())}")
            return ''
        print(f"Looking up center for user: {username}")
        response = cognito.admin_get_user(UserPoolId=USER_POOL_ID, Username=username)
        attrs = {a['Name']: a['Value'] for a in response.get('UserAttributes', [])}
        centers_raw = attrs.get('custom:centers', '')
        print(f"Centers raw value: {centers_raw}")
        if centers_raw:
            parsed = json.loads(centers_raw)
            center = parsed[0] if isinstance(parsed, list) and parsed else str(parsed)
            print(f"Resolved center: {center}")
            return center
        return ''
    except Exception as e:
        print(f"Could not get user center: {e}")
        return ''


def lambda_handler(event, context):
    """
    Main handler. Validates the request body, creates the case record,
    and returns the new session ID to the frontend.
    """
    try:
        body = json.loads(event['body'])

        # Make sure all required fields are present before proceeding
        required_fields = ['male_patient', 'female_patient', 'procedure_start_date']
        for field in required_fields:
            if field not in body:
                return {
                    'statusCode': 400,
                    'headers': {'Content-Type': 'application/json'},
                    'body': json.dumps({'error': f'Missing required field: {field}'})
                }

        # Each case gets a unique UUID as its session identifier
        session_id = str(uuid.uuid4())

        # Get center: use value sent by frontend (read from Cognito at submit time)
        # Fall back to Cognito lookup via JWT claims if available
        center = body.get('center', '') or get_user_center(event)

        # Build the full case record that will be stored in DynamoDB.
        # Names are stored in uppercase to make comparison consistent during validation.
        case_record = {
            'sessionId': session_id,
            'male_patient': {
                'name': body['male_patient']['name'].upper(),
                'mpeid': body['male_patient'].get('mpeid', ''),
                'dob': body['male_patient'].get('dob'),
                'type': body['male_patient'].get('type', 'self'),
                'donor_id': body['male_patient'].get('donor_id', ''),
            },
            'female_patient': {
                'name': body['female_patient']['name'].upper(),
                'mpeid': body['female_patient'].get('mpeid', ''),
                'dob': body['female_patient'].get('dob'),
                'type': body['female_patient'].get('type', 'self'),
                'donor_name': (body['female_patient'].get('donor_name') or '').upper(),
                'donor_mpeid': body['female_patient'].get('donor_mpeid', ''),
                'donor_id': body['female_patient'].get('donor_id', ''),
                'donor_remark': body['female_patient'].get('donor_remark', ''),
            },
            'procedure_start_date': body['procedure_start_date'],
            'doctor_name': body.get('doctor_name', ''),
            'center': center,
            # The AI model used for OCR validation is selected at registration time
            'model_config': body.get('model_config', {
                'model_id': 'anthropic.claude-sonnet-4-5-20250929-v1:0',
                'model_name': 'Claude Sonnet 4.5'
            }),
            'created_at': datetime.utcnow().isoformat(),
            'current_stage': 'label_validation',
            # All stages start as pending.
            'stages': {
                'label_validation':      {'status': 'pending', 'images_required': 1, 'images_uploaded': 0},
                'oocyte_collection':     {'status': 'pending', 'images_required': 1, 'images_uploaded': 0},
                'denudation':            {'status': 'pending', 'images_required': 1, 'images_uploaded': 0},
                'male_sample_collection':{'status': 'pending', 'images_required': 2, 'images_uploaded': 0},
                'icsi':                  {'status': 'pending', 'images_required': 1, 'images_uploaded': 0},
                'fertilization_check':   {'status': 'pending', 'images_required': 1, 'images_uploaded': 0},
                'icsi_documentation':    {'status': 'pending', 'images_required': 0, 'images_uploaded': 0},
                'blastocyst':            {'status': 'pending', 'images_required': 0, 'images_uploaded': 0},
                'culture':               {'status': 'pending', 'images_required': 1, 'images_uploaded': 0}
            },
            # Token usage fields are initialized to zero and updated after each AI call.
            # These are used to track cost per stage and total cost per case.
            'label_validation_input_tokens': 0,
            'label_validation_output_tokens': 0,
            'label_validation_cost_usd': 0,
            'oocyte_collection_input_tokens': 0,
            'oocyte_collection_output_tokens': 0,
            'oocyte_collection_cost_usd': 0,
            'denudation_input_tokens': 0,
            'denudation_output_tokens': 0,
            'denudation_cost_usd': 0,
            'male_sample_collection_input_tokens': 0,
            'male_sample_collection_output_tokens': 0,
            'male_sample_collection_cost_usd': 0,
            'icsi_input_tokens': 0,
            'icsi_output_tokens': 0,
            'icsi_cost_usd': 0,
            'culture_input_tokens': 0,
            'culture_output_tokens': 0,
            'culture_cost_usd': 0,
            'total_input_tokens': 0,
            'total_output_tokens': 0,
            'total_cost_usd': 0
        }

        # Save the case to DynamoDB
        cases_table.put_item(Item=case_record)

        # Write an audit log entry so we have a record of who registered this case
        user_info, ip_address = extract_user_info(event)
        log_audit(
            user_info=user_info,
            action=ACTIONS['REGISTER_CASE'],
            resource_type='case',
            resource_id=session_id,
            session_id=session_id,
            patient_mpeid=body['female_patient']['mpeid'],
            result='success',
            ip_address=ip_address,
            metadata={
                'message': f"Case registered for {body['male_patient']['name']} & {body['female_patient']['name']}",
                'procedure_date': body['procedure_start_date'],
                'doctor_name': body.get('doctor_name', ''),
                'center': center
            }
        )

        return {
            'statusCode': 201,
            'headers': {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            },
            'body': json.dumps({
                'sessionId': session_id,
                'message': 'Case registered successfully',
                'next_stage': 'label_validation'
            })
        }

    except Exception as e:
        print(f"Error: {str(e)}")
        return {
            'statusCode': 500,
            'headers': {'Content-Type': 'application/json'},
            'body': json.dumps({'error': 'Internal server error'})
        }
