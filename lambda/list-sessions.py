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

        if search_query:
            sessions = search_sessions(search_query, limit)
        else:
            sessions = list_recent_sessions(limit)

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


def list_recent_sessions(limit):
    """
    Scans the cases table and returns the most recent sessions sorted by date.
    We fetch more than the limit to ensure we have enough after sorting.
    """
    response = cases_table.scan(
        Limit=limit * 2
    )
    items = response.get('Items', [])

    # Sort by procedure date, newest first
    items.sort(key=lambda x: x.get('procedure_start_date', ''), reverse=True)

    return [format_session(item) for item in items[:limit]]


def search_sessions(query, limit):
    """
    Searches sessions by MPEID, patient name, or session ID.
    If the query looks like a UUID (long string with dashes), tries an exact
    session ID lookup first before falling back to a full scan.
    """
    query_upper = query.upper().strip()

    # Try exact session ID match first if the query looks like a UUID
    if len(query) > 30 and '-' in query:
        try:
            response = cases_table.get_item(Key={'sessionId': query})
            if 'Item' in response:
                return [format_session(response['Item'])]
        except:
            pass

    # Fall back to scanning and filtering by MPEID or name
    response = cases_table.scan(
        FilterExpression=(
            Attr('male_patient.mpeid').contains(query_upper) |
            Attr('female_patient.mpeid').contains(query_upper) |
            Attr('male_patient.name').contains(query_upper) |
            Attr('female_patient.name').contains(query_upper)
        ),
        Limit=limit * 2
    )
    items = response.get('Items', [])

    # Sort by procedure date, newest first
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
