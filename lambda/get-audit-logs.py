"""
get-audit-logs.py

Returns audit log entries from the IVF-AuditLog DynamoDB table. Supports
filtering by date range, action type, stage, user email, session ID, and center.
Used by the Audit Log screen in the frontend (admin and supervisor roles only).

Trigger: GET /audit-logs (API Gateway, Cognito authenticated)
Table:   IVF-AuditLog (DynamoDB)
"""

import json
import boto3
import os
from datetime import datetime, timedelta
from decimal import Decimal
from boto3.dynamodb.conditions import Key, Attr

dynamodb = boto3.resource('dynamodb')
audit_table = dynamodb.Table(os.environ['AUDIT_TABLE'])
cases_table = dynamodb.Table(os.environ.get('CASES_TABLE', 'IVF-Cases'))


def decimal_default(obj):
    """JSON serializer for Decimal objects returned by DynamoDB."""
    if isinstance(obj, Decimal):
        return float(obj)
    raise TypeError


def get_session_ids_for_center(center):
    """Get all session IDs for a given center from IVF-Cases."""
    try:
        resp = cases_table.scan(
            FilterExpression='#center = :center',
            ExpressionAttributeNames={'#center': 'center'},
            ExpressionAttributeValues={':center': center},
            ProjectionExpression='sessionId'
        )
        ids = set(item['sessionId'] for item in resp.get('Items', []))
        while 'LastEvaluatedKey' in resp:
            resp = cases_table.scan(
                FilterExpression='#center = :center',
                ExpressionAttributeNames={'#center': 'center'},
                ExpressionAttributeValues={':center': center},
                ProjectionExpression='sessionId',
                ExclusiveStartKey=resp['LastEvaluatedKey']
            )
            ids.update(item['sessionId'] for item in resp.get('Items', []))
        return ids
    except Exception as e:
        print(f"Error fetching sessions for center: {e}")
        return set()


def lambda_handler(event, context):
    """
    Reads filter parameters from the query string, scans the audit table,
    and returns matching log entries sorted newest first.
    """
    try:
        params = event.get('queryStringParameters') or {}

        # Default date range is the last 7 days
        end_date = params.get('end_date', datetime.utcnow().isoformat())
        start_date = params.get('start_date', (datetime.utcnow() - timedelta(days=7)).isoformat())

        action_filter = params.get('action')
        stage_filter = params.get('stage')
        user_email = params.get('user_email')
        session_id = params.get('session_id')
        center_filter = params.get('center')
        limit = min(int(params.get('limit', 100)), 500)

        # Build the DynamoDB filter expression
        filter_expressions = []
        expression_values = {}
        expression_names = {'#ts': 'timestamp'}

        # Date range is always applied
        filter_expressions.append('(#ts BETWEEN :start_date AND :end_date)')
        expression_values[':start_date'] = start_date
        expression_values[':end_date'] = end_date

        if action_filter:
            filter_expressions.append('#action = :action')
            expression_values[':action'] = action_filter
            expression_names['#action'] = 'action'

        if stage_filter:
            filter_expressions.append('#stage = :stage')
            expression_values[':stage'] = stage_filter
            expression_names['#stage'] = 'stage'

        if user_email:
            filter_expressions.append('contains(#user_email, :user_email)')
            expression_values[':user_email'] = user_email
            expression_names['#user_email'] = 'user_email'

        if session_id:
            filter_expressions.append('#session_id = :session_id')
            expression_values[':session_id'] = session_id
            expression_names['#session_id'] = 'session_id'

        # Scan with a higher limit to account for post-filtering
        scan_limit = limit
        scan_kwargs = {'Limit': min(scan_limit, 5000)}
        if filter_expressions:
            scan_kwargs['FilterExpression'] = ' AND '.join(filter_expressions)
            scan_kwargs['ExpressionAttributeValues'] = expression_values
            scan_kwargs['ExpressionAttributeNames'] = expression_names

        response = audit_table.scan(**scan_kwargs)
        items = response.get('Items', [])

        # Sort newest first
        items.sort(key=lambda x: x.get('timestamp', ''), reverse=True)
        items = items[:limit]

        total_count = len(items)
        action_counts = {}
        for item in items:
            action = item.get('action', 'UNKNOWN')
            action_counts[action] = action_counts.get(action, 0) + 1

        return {
            'statusCode': 200,
            'headers': {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Headers': 'Content-Type,Authorization',
                'Access-Control-Allow-Methods': 'GET,OPTIONS'
            },
            'body': json.dumps({
                'logs': items,
                'total_count': total_count,
                'action_counts': action_counts,
                'filters_applied': {
                    'start_date': start_date,
                    'end_date': end_date,
                    'action': action_filter,
                    'stage': stage_filter,
                    'user_email': user_email,
                    'session_id': session_id,
                    'center': center_filter
                }
            }, default=decimal_default)
        }

    except Exception as e:
        print(f"Error getting audit logs: {str(e)}")
        return {
            'statusCode': 500,
            'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
            'body': json.dumps({'error': 'Failed to retrieve audit logs', 'message': str(e)})
        }


