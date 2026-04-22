"""
list-sessions.py

Returns a list of IVF sessions for the View Witness Captures screen. Supports
two modes: listing the most recent sessions, or searching by patient MPEID,
patient name, or session ID. Results are sorted newest first.

Trigger: GET /sessions (API Gateway, Cognito authenticated)
Table:   IVF-Cases (DynamoDB)
"""

import json
import boto3
import os
from boto3.dynamodb.conditions import Key, Attr
from decimal import Decimal

dynamodb = boto3.resource('dynamodb')
cases_table = dynamodb.Table(os.environ.get('CASES_TABLE', 'IVF-Cases'))


class DecimalEncoder(json.JSONEncoder):
    """DynamoDB returns Decimal types for numbers. This encoder converts them to float for JSON."""
    def default(self, obj):
        if isinstance(obj, Decimal):
            return float(obj)
        return super(DecimalEncoder, self).default(obj)


def lambda_handler(event, context):
    """
    Reads optional query parameters (search, limit) and returns matching sessions.
    If no search query is provided, returns the most recent sessions up to the limit.
    """
    try:
        query_params = event.get('queryStringParameters') or {}
        search_query = query_params.get('search', '').strip()
        limit = int(query_params.get('limit', '10'))
        center_filter = query_params.get('center', '').strip()  # single center filter for admin
        # user_center: single center the user belongs to (non-admin)
        user_center = query_params.get('user_center', '').strip()
        is_admin = query_params.get('is_admin', 'false').lower() == 'true'

        if search_query:
            sessions = search_sessions(search_query, limit, user_center, is_admin, center_filter)
        else:
            sessions = list_recent_sessions(limit, user_center, is_admin, center_filter)

        return {
            'statusCode': 200,
            'headers': {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            },
            'body': json.dumps({
                'sessions': sessions,
                'count': len(sessions)
            }, cls=DecimalEncoder)
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


def list_recent_sessions(limit, user_center='', is_admin=False, center_filter=''):
    response = cases_table.scan(Limit=limit * 5)
    items = response.get('Items', [])

    if not is_admin and user_center:
        items = [i for i in items if not i.get('center') or i.get('center', '') == user_center]
    elif is_admin and center_filter:
        items = [i for i in items if i.get('center', '') == center_filter]

    items.sort(key=lambda x: x.get('procedure_start_date', ''), reverse=True)
    return [format_session(item) for item in items[:limit]]


def search_sessions(query, limit, user_center='', is_admin=False, center_filter=''):
    """
    Searches sessions by MPEID, patient name, or session ID.
    If the query looks like a UUID (long string with dashes), tries an exact
    session ID lookup first before falling back to a full scan.
    """
    query_upper = query.upper().strip()

    if len(query) > 30 and '-' in query:
        try:
            response = cases_table.get_item(Key={'sessionId': query})
            if 'Item' in response:
                item = response['Item']
                if not is_admin and user_center and item.get('center') and item.get('center', '') != user_center:
                    return []
                return [format_session(item)]
        except:
            pass

    response = cases_table.scan(
        FilterExpression=(
            Attr('male_patient.mpeid').contains(query_upper) |
            Attr('female_patient.mpeid').contains(query_upper) |
            Attr('male_patient.name').contains(query_upper) |
            Attr('female_patient.name').contains(query_upper)
        ),
        Limit=limit * 5
    )
    items = response.get('Items', [])

    if not is_admin and user_center:
        items = [i for i in items if not i.get('center') or i.get('center', '') == user_center]
    elif is_admin and center_filter:
        items = [i for i in items if i.get('center', '') == center_filter]

    items.sort(key=lambda x: x.get('procedure_start_date', ''), reverse=True)
    return [format_session(item) for item in items[:limit]]


def format_session(item):
    """
    Strips down the full case record to only the fields the frontend needs
    for the session list view. Also calculates the overall session status.
    """
    stages = item.get('stages', {})
    completed_stages = sum(1 for s in stages.values() if s.get('status') == 'completed')
    total_stages = len(stages)

    # Determine overall status based on individual stage statuses
    all_completed = all(s.get('status') == 'completed' for s in stages.values())
    any_failed = any(s.get('status') == 'failed' for s in stages.values())

    if all_completed:
        overall_status = 'completed'
    elif any_failed:
        overall_status = 'failed'
    else:
        overall_status = 'in_progress'

    return {
        'sessionId': item.get('sessionId'),
        'procedure_start_date': item.get('procedure_start_date'),
        'center': item.get('center', ''),
        'doctor_name': item.get('doctor_name', ''),
        'male_patient': {
            'name': item.get('male_patient', {}).get('name'),
            'last_name': item.get('male_patient', {}).get('last_name'),
            'mpeid': item.get('male_patient', {}).get('mpeid')
        },
        'female_patient': {
            'name': item.get('female_patient', {}).get('name'),
            'last_name': item.get('female_patient', {}).get('last_name'),
            'mpeid': item.get('female_patient', {}).get('mpeid')
        },
        'model_config': item.get('model_config', {}),
        'completed_stages': completed_stages,
        'total_stages': total_stages,
        'overall_status': overall_status
    }
