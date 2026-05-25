from datetime import datetime, timezone, timedelta
_IST = timezone(timedelta(hours=5, minutes=30))
def now_ist_iso(): return datetime.now(_IST).strftime('%Y-%m-%dT%H:%M:%S')
def now_ist_date(): return datetime.now(_IST).strftime('%Y-%m-%d')
def now_ist_timestamp(): return datetime.now(_IST).strftime('%Y%m%d_%H%M%S')
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
from audit_helper import log_audit, extract_user_info, ACTIONS, now_ist_iso, now_ist_date, now_ist_timestamp

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
    Routes social-freezing requests to dedicated handler.
    """
    # Route social freezing requests
    path = event.get('path', '') or event.get('resource', '')
    if 'social-freezing' in path:
        return handle_social_freezing(event, context)

    try:
        body = json.loads(event['body'])

        # Route social freezing registration via case_type field
        if body.get('case_type') == 'social_freezing':
            return sf_register_from_body(body, event)

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
                'phone_number': body['female_patient'].get('phone_number', ''),
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
            'created_at': now_ist_iso(),
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
                'day6':                  {'status': 'pending', 'images_required': 0, 'images_uploaded': 0},
                'day7':                  {'status': 'pending', 'images_required': 0, 'images_uploaded': 0},
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


def sf_register_from_body(body, event):
    """Register a social freezing case via the existing /register endpoint."""
    female = body.get('female_patient', {})
    if not female.get('name') or not female.get('mpeid'):
        return {'statusCode': 400, 'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'}, 'body': json.dumps({'error': 'female_patient name and mpeid required'})}

    session_id = str(uuid.uuid4())
    user_info, ip = extract_user_info(event)
    center = body.get('center', '') or get_user_center(event)

    # Store in the main IVF-Cases table with case_type flag — existing /case/{id} endpoint works automatically
    item = {
        'sessionId': session_id,
        'case_type': 'social_freezing',
        'female_patient': {
            'name': female.get('name', '').upper().strip(),
            'mpeid': female.get('mpeid', '').strip(),
            'type': 'self',
        },
        'male_patient': {'name': 'N/A', 'mpeid': '0', 'type': 'na'},
        'procedure_start_date': body.get('procedure_date', now_ist_date()),
        'doctor_name': body.get('doctor_name', ''),
        'center': center,
        'model_config': body.get('model_config', {'model_id': 'qwen.qwen3-vl-235b-a22b', 'model_name': 'Qwen3 VL 235B'}),
        'created_at': now_ist_iso(),
        'created_by': user_info.get('userId', 'unknown'),
        'stages': {
            'label_validation': {'status': 'pending', 'images_required': 1, 'images_uploaded': 0},
            'culture':          {'status': 'pending', 'images_required': 1, 'images_uploaded': 0},
        },
        'status': 'active',
    }

    cases_table.put_item(Item=item)

    log_audit(user_info=user_info, action='REGISTER_CASE', resource_type='social_freezing_case',
              resource_id=session_id, session_id=session_id, stage='registration', result='success',
              ip_address=ip, metadata={'case_type': 'social_freezing', 'female_name': female.get('name'), 'center': center})

    return {'statusCode': 200, 'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
            'body': json.dumps({'sessionId': session_id, 'message': 'Social freezing case registered'})}


# ─── Social Embryo Freezing ───────────────────────────────────────────────────

social_freezing_table = dynamodb.Table(os.environ.get('SOCIAL_FREEZING_TABLE', 'IVF-SocialFreezing'))

CORS = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type,Authorization',
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS'
}


def handle_social_freezing(event, context):
    """Handle all /social-freezing/* routes."""
    if event.get('httpMethod') == 'OPTIONS':
        return {'statusCode': 200, 'headers': CORS, 'body': ''}

    method = event.get('httpMethod', 'GET')
    path = event.get('path', '')
    path_params = event.get('pathParameters') or {}

    try:
        # POST /social-freezing/register
        if method == 'POST' and 'register' in path:
            return sf_register(event)

        # GET /social-freezing/{sessionId}
        if method == 'GET' and path_params.get('sessionId'):
            return sf_get_case(path_params['sessionId'])

        # GET /social-freezing — list cases
        if method == 'GET':
            return sf_list_cases()

        return {'statusCode': 405, 'headers': CORS, 'body': json.dumps({'error': 'Method not allowed'})}

    except Exception as e:
        print(f"Social freezing error: {e}")
        import traceback; traceback.print_exc()
        return {'statusCode': 500, 'headers': CORS, 'body': json.dumps({'error': str(e)})}


def sf_register(event):
    body = json.loads(event.get('body') or '{}')
    female = body.get('female_patient', {})

    if not female.get('name') or not female.get('mpeid'):
        return {'statusCode': 400, 'headers': CORS, 'body': json.dumps({'error': 'female_patient name and mpeid required'})}

    session_id = str(uuid.uuid4())
    user_info, ip = extract_user_info(event)
    center = body.get('center', '') or get_user_center(event)

    item = {
        'sessionId': session_id,
        'case_type': 'social_freezing',
        'female_patient': {
            'name': female.get('name', '').upper().strip(),
            'mpeid': female.get('mpeid', '').strip(),
            'type': female.get('type', 'self'),
        },
        'procedure_date': body.get('procedure_date', now_ist_date()),
        'doctor_name': body.get('doctor_name', ''),
        'center': center,
        'model_config': body.get('model_config', {'model_id': 'qwen.qwen3-vl-235b-a22b', 'model_name': 'Qwen3 VL 235B'}),
        'created_at': now_ist_iso(),
        'created_by': user_info.get('userId', 'unknown'),
        'stages': {
            'label_validation': {'status': 'pending', 'images_required': 1, 'images_uploaded': 0},
            'culture':          {'status': 'pending', 'images_required': 1, 'images_uploaded': 0},
        },
        'status': 'active',
    }

    social_freezing_table.put_item(Item=item)

    log_audit(
        user_info=user_info,
        action='REGISTER_CASE',
        resource_type='social_freezing_case',
        resource_id=session_id,
        session_id=session_id,
        stage='registration',
        result='success',
        ip_address=ip,
        metadata={'case_type': 'social_freezing', 'female_name': female.get('name'), 'female_mpeid': female.get('mpeid'), 'center': center}
    )

    return {'statusCode': 200, 'headers': CORS, 'body': json.dumps({'sessionId': session_id, 'message': 'Social freezing case registered'})}


def sf_get_case(session_id):
    resp = social_freezing_table.get_item(Key={'sessionId': session_id})
    if 'Item' not in resp:
        return {'statusCode': 404, 'headers': CORS, 'body': json.dumps({'error': 'Case not found'})}
    return {'statusCode': 200, 'headers': CORS, 'body': json.dumps(resp['Item'], default=str)}


def sf_list_cases():
    resp = social_freezing_table.scan(Limit=50)
    items = sorted(resp.get('Items', []), key=lambda x: x.get('created_at', ''), reverse=True)
    return {'statusCode': 200, 'headers': CORS, 'body': json.dumps({'cases': items}, default=str)}
