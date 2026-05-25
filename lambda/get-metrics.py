import json
import boto3
from datetime import datetime, timedelta
from collections import defaultdict
import os

dynamodb = boto3.resource('dynamodb')
failures_table = dynamodb.Table(os.environ.get('FAILURES_TABLE', 'IVF-ValidationFailures'))
cases_table = dynamodb.Table(os.environ.get('CASES_TABLE', 'IVF-Cases'))

STAGE_NAMES = {
    'label_validation': 'Patient Verification',
    'oocyte_collection': 'Oocyte Collection',
    'denudation': 'Oocyte Morphology',
    'male_sample_collection': 'Sperm Preparation',
    'iui': 'IUI',
    'icsi': 'ICSI/IVF',
    'fertilization_check': 'Fertilization Check (Day 1)',
    'icsi_documentation': 'Cleavage (Day 3)',
    'blastocyst': 'Blastocyst (Day 5)',
    'day6': 'Day 6',
    'day7': 'Day 7',
    'culture': 'Frozen Embryo Transfer (FET)',
}

def lambda_handler(event, context):
    """
    Get metrics data for the dashboard
    Supports filtering by stage, status, and date range
    """
    try:
        # Get query parameters
        params = event.get('queryStringParameters') or {}
        stage_filter = params.get('stage', 'all')
        status_filter = params.get('status', 'all')
        date_range = params.get('dateRange', '30')  # days
        
        print(f"Fetching metrics with filters: stage={stage_filter}, status={status_filter}, dateRange={date_range}")
        
        # Scan all failures
        response = failures_table.scan()
        all_failures = response.get('Items', [])
        
        # Continue scanning if there are more items
        while 'LastEvaluatedKey' in response:
            response = failures_table.scan(ExclusiveStartKey=response['LastEvaluatedKey'])
            all_failures.extend(response.get('Items', []))
        
        print(f"Found {len(all_failures)} total failures")
        
        # Apply filters
        filtered_failures = apply_filters(all_failures, stage_filter, status_filter, date_range)
        
        print(f"After filtering: {len(filtered_failures)} failures")
        
        # Calculate metrics
        metrics = calculate_metrics(filtered_failures, all_failures)
        
        return {
            'statusCode': 200,
            'headers': {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            },
            'body': json.dumps(metrics, default=str)
        }
        
    except Exception as e:
        print(f"Error getting metrics: {str(e)}")
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

def apply_filters(failures, stage_filter, status_filter, date_range):
    """Apply filters to failures list"""
    filtered = failures
    
    # Stage filter
    if stage_filter != 'all':
        filtered = [f for f in filtered if f.get('stage') == stage_filter]
    
    # Status filter
    if status_filter != 'all':
        filtered = [f for f in filtered if f.get('status') == status_filter]
    
    # Date range filter
    if date_range != 'all':
        days = float(date_range)
        cutoff_date = datetime.utcnow() - timedelta(days=days)
        filtered = [f for f in filtered if datetime.fromisoformat(f.get('failed_at', '1970-01-01').replace('Z', '+00:00').replace('+00:00', '')) > cutoff_date]
    
    return filtered

def calculate_metrics(filtered_failures, all_failures):
    """Calculate all metrics from failures data"""
    
    # Overview metrics
    total = len(filtered_failures)
    active = len([f for f in filtered_failures if f.get('status') == 'active'])
    resolved = len([f for f in filtered_failures if f.get('status') == 'resolved'])
    
    # Calculate real failure rate: unique sessions with failures / total sessions
    try:
        cases_resp = cases_table.scan(Select='COUNT')
        total_cases = cases_resp.get('Count', 1)
        failed_sessions = len(set(f.get('session_id', '') for f in filtered_failures))
        failure_rate = round((failed_sessions / max(total_cases, 1)) * 100, 1)
    except Exception:
        failure_rate = round((total / max(total + 100, 1)) * 100, 1)
    
    overview = {
        'total': total,
        'active': active,
        'resolved': resolved,
        'failureRate': failure_rate
    }
    
    # Failures by stage
    by_stage = defaultdict(int)
    for failure in filtered_failures:
        stage = failure.get('stage', 'unknown')
        by_stage[stage] += 1
    
    by_stage_list = [
        {'stage': STAGE_NAMES.get(stage, stage), 'count': count}
        for stage, count in sorted(by_stage.items(), key=lambda x: x[1], reverse=True)
    ]
    
    # Top mismatch reasons
    by_reason = defaultdict(int)
    for failure in filtered_failures:
        reason = failure.get('primary_mismatch_reason', 'Unknown')
        by_reason[reason] += 1
    
    total_reasons = sum(by_reason.values())
    by_reason_list = [
        {
            'reason': reason,
            'count': count,
            'percentage': round((count / total_reasons) * 100, 1) if total_reasons > 0 else 0
        }
        for reason, count in sorted(by_reason.items(), key=lambda x: x[1], reverse=True)
    ]
    
    # Resolution categories
    by_resolution = defaultdict(int)
    for failure in filtered_failures:
        if failure.get('status') == 'resolved' and failure.get('resolution_category'):
            category = failure['resolution_category']
            by_resolution[category] += 1
    
    by_resolution_list = [
        {'category': category, 'count': count}
        for category, count in sorted(by_resolution.items(), key=lambda x: x[1], reverse=True)
    ]
    
    # Sort failures by date (newest first) and limit to 50
    failures_list = sorted(
        filtered_failures,
        key=lambda x: x.get('failed_at', ''),
        reverse=True
    )[:50]
    
    # AI Grading stats from audit log
    ai_grading_success = 0
    ai_grading_failed = 0
    try:
        audit_table = dynamodb.Table(os.environ.get('AUDIT_TABLE', 'IVF-AuditLog'))
        ai_resp = audit_table.scan(
            FilterExpression='#action IN (:pass, :fail)',
            ExpressionAttributeNames={'#action': 'action'},
            ExpressionAttributeValues={':pass': 'AI_GRADING_COMPLETED', ':fail': 'AI_GRADING_FAILED'}
        )
        ai_logs = ai_resp.get('Items', [])
        ai_grading_success = sum(1 for l in ai_logs if l.get('action') == 'AI_GRADING_COMPLETED')
        ai_grading_failed = sum(1 for l in ai_logs if l.get('action') == 'AI_GRADING_FAILED')
    except Exception as e:
        print(f"Could not fetch AI grading stats: {e}")

    return {
        'overview': overview,
        'byStage': by_stage_list,
        'byReason': by_reason_list,
        'byResolution': by_resolution_list,
        'failures': failures_list,
        'aiGrading': {
            'success': ai_grading_success,
            'failed': ai_grading_failed,
            'total': ai_grading_success + ai_grading_failed,
        }
    }
