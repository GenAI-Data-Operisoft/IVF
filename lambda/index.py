import json
import boto3
import os
from boto3.dynamodb.conditions import Key, Attr
from decimal import Decimal

dynamodb = boto3.resource('dynamodb')
cases_table = dynamodb.Table(os.environ.get('CASES_TABLE', 'IVF-Cases'))

class DecimalEncoder(json.JSONEncoder):
    def default(self, obj):
        if isinstance(obj, Decimal):
            return float(obj)
        return super(DecimalEncoder, self).default(obj)

def lambda_handler(event, context):
    """
    List recent sessions or search by MPEID/Session ID
    """
    try:
        # Get query parameters
        query_params = event.get('queryStringParameters') or {}
        search_query = query_params.get('search', '').strip()
        limit = int(query_params.get('limit', '10'))
        
        if search_query:
            # Search by MPEID or Session ID
            sessions = search_sessions(search_query, limit)
        else:
            # List recent sessions
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
    List most recent sessions
    """
    response = cases_table.scan(
        Limit=limit * 2  # Get more to sort and filter
    )
    
    items = response.get('Items', [])
    
    # Sort by procedure_start_date descending (most recent first)
    items.sort(key=lambda x: x.get('procedure_start_date', ''), reverse=True)
    
    # Return only the requested limit
    return [format_session(item) for item in items[:limit]]

def search_sessions(query, limit):
    """
    Search sessions by MPEID or Session ID
    """
    query_upper = query.upper().strip()
    
    # If it looks like a session ID (UUID format), try exact match first
    if len(query) > 30 and '-' in query:
        try:
            response = cases_table.get_item(Key={'sessionId': query})
            if 'Item' in response:
                return [format_session(response['Item'])]
        except:
            pass
    
    # Otherwise, scan and filter by MPEID
    response = cases_table.scan(
        FilterExpression=Attr('male_patient.mpeid').contains(query_upper) | 
                        Attr('female_patient.mpeid').contains(query_upper) |
                        Attr('male_patient.name').contains(query_upper) |
                        Attr('female_patient.name').contains(query_upper),
        Limit=limit * 2
    )
    
    items = response.get('Items', [])
    
    # Sort by procedure_start_date descending
    items.sort(key=lambda x: x.get('procedure_start_date', ''), reverse=True)
    
    return [format_session(item) for item in items[:limit]]

def format_session(item):
    """
    Format session data for response
    """
    # Count completed stages
    stages = item.get('stages', {})
    completed_stages = sum(1 for stage_data in stages.values() if stage_data.get('status') == 'completed')
    total_stages = len(stages)
    
    # Determine overall status
    all_completed = all(stage_data.get('status') == 'completed' for stage_data in stages.values())
    any_failed = any(stage_data.get('status') == 'failed' for stage_data in stages.values())
    
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
