import json
import boto3
import os
import re
from datetime import datetime, timedelta
from decimal import Decimal
from boto3.dynamodb.conditions import Attr

dynamodb = boto3.resource('dynamodb', region_name=os.environ.get('AWS_REGION', 'ap-south-1'))
bedrock  = boto3.client('bedrock-runtime', region_name=os.environ.get('AWS_REGION', 'ap-south-1'))

cases_table    = dynamodb.Table(os.environ.get('CASES_TABLE',    'IVF-Cases'))
failures_table = dynamodb.Table(os.environ.get('FAILURES_TABLE', 'IVF-ValidationFailures'))

CORS = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type,Authorization',
    'Access-Control-Allow-Methods': 'POST,OPTIONS'
}

def decimal_default(obj):
    if isinstance(obj, Decimal): return float(obj)
    if isinstance(obj, datetime): return obj.isoformat()
    raise TypeError

def resp(status, body):
    return {'statusCode': status, 'headers': CORS, 'body': json.dumps(body, default=decimal_default)}

def lambda_handler(event, context):
    if event.get('httpMethod') == 'OPTIONS':
        return {'statusCode': 200, 'headers': CORS, 'body': ''}
    try:
        body = json.loads(event.get('body', '{}'))
        question = body.get('question', '').strip()
        if not question:
            return resp(400, {'error': 'Question is required'})
        answer = answer_question(question)
        return resp(200, {'answer': answer})
    except Exception as e:
        print(f"Error: {str(e)}")
        return resp(500, {'error': str(e)})


def answer_question(question):
    """Gather relevant data then ask Bedrock to answer naturally."""
    q_lower = question.lower()
    context_data = gather_context(q_lower, question)

    system_prompt = """You are an AI assistant for the Cloudnine Hospital IVF Witness Capture System.
You help hospital staff get accurate information about IVF cases, patients, validation stages, and statistics.

IMPORTANT RULES:
- Only answer based on the ACTUAL system data provided below. Do NOT invent data.
- When counts/stats are provided, use those EXACT numbers. Do not recount or estimate.
- Use MARKDOWN TABLES for structured data (cases, stats, stage breakdowns).
- Be concise and accurate.
- If data is not available, say so clearly.
- For date-based queries, the data has already been filtered — just report the numbers given.
- Always format numbers clearly. Use tables like:
  | Metric | Count |
  |--------|-------|
  | Total Cases | 15 |"""

    user_message = f"""Question: {question}

System data:
{context_data}

Answer accurately based on this data only."""

    try:
        response = bedrock.converse(
            modelId='anthropic.claude-sonnet-4-20250514-v1:0',
            messages=[{'role': 'user', 'content': [{'text': user_message}]}],
            system=[{'text': system_prompt}],
            inferenceConfig={'maxTokens': 800, 'temperature': 0.1}
        )
        return response['output']['message']['content'][0]['text']
    except Exception as e:
        print(f"Bedrock error: {e}")
        return context_data


def gather_context(q_lower, original):
    """Fetch relevant data from DynamoDB based on question."""
    context_parts = []

    # Session ID lookup
    session_match = re.search(r'[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}', q_lower)
    if session_match:
        case = cases_table.get_item(Key={'sessionId': session_match.group()}).get('Item')
        if case:
            context_parts.append(f"Case found:\n{json.dumps(summarize_case(case), default=decimal_default, indent=2)}")
        else:
            context_parts.append(f"No case found with session ID {session_match.group()}")
        return '\n'.join(context_parts)

    # Get ALL cases from DynamoDB (full scan)
    all_cases = scan_all_cases()

    # Name/MPEID search
    stop_words = {'what', 'is', 'the', 'of', 'for', 'find', 'show', 'get', 'tell', 'me',
                  'about', 'patient', 'case', 'status', 'partner', 'female', 'male', 'wife',
                  'husband', 'details', 'info', 'information', 'search', 'look', 'up', 'a',
                  'an', 'and', 'or', 'in', 'on', 'at', 'to', 'from', 'with', 'by', 'their',
                  'his', 'her', 'how', 'many', 'total', 'count', 'recent', 'latest', 'today',
                  'this', 'that', 'which', 'who', 'when', 'where', 'why', 'all', 'any',
                  'stage', 'stages', 'validation', 'ivf', 'system', 'cases', 'sessions',
                  'stats', 'statistics', 'data', 'give', 'accurate', 'between', 'during',
                  'passed', 'failed', 'created', 'date', 'period', 'range'}

    words = re.findall(r'[a-zA-Z]+', original)
    name_candidates = [w.upper() for w in words if w.lower() not in stop_words and len(w) > 2]

    # Check if question is about date range / stats
    date_patterns = re.findall(r'(\d{1,2})[-/](\d{1,2})[-/]?(\d{2,4})?', original)
    is_stats_query = any(w in q_lower for w in ['how many', 'total', 'count', 'stats', 'statistics', 'between', 'during', 'from', 'period'])

    if is_stats_query or date_patterns:
        # Compute accurate stats
        stats = compute_accurate_stats(all_cases, q_lower, original, date_patterns)
        context_parts.append(stats)
        return '\n'.join(context_parts)

    # MPEID pattern search
    mpeid_match = re.search(r'(\d{6,})', original)
    if mpeid_match:
        term = mpeid_match.group(1)
        matches = [c for c in all_cases if
                   term in str(c.get('male_patient', {}).get('mpeid', '')) or
                   term in str(c.get('female_patient', {}).get('mpeid', ''))]
        if matches:
            context_parts.append(f"Cases matching MPEID '{term}' ({len(matches)} found):")
            for c in matches[:5]:
                context_parts.append(json.dumps(summarize_case(c), default=decimal_default))
            return '\n'.join(context_parts)

    # Name search
    if name_candidates:
        for term in name_candidates:
            matches = [c for c in all_cases if
                       term in (c.get('male_patient', {}).get('name', '') or '').upper() or
                       term in (c.get('female_patient', {}).get('name', '') or '').upper()]
            if matches:
                matches.sort(key=lambda x: x.get('created_at', ''), reverse=True)
                context_parts.append(f"Cases matching '{term}' ({len(matches)} found):")
                for c in matches[:5]:
                    context_parts.append(json.dumps(summarize_case(c), default=decimal_default))
                return '\n'.join(context_parts)

    # Default: general stats
    stats = compute_general_stats(all_cases)
    context_parts.append(stats)
    return '\n'.join(context_parts)


def scan_all_cases():
    """Full DynamoDB scan with pagination."""
    items = []
    response = cases_table.scan()
    items.extend(response.get('Items', []))
    while 'LastEvaluatedKey' in response:
        response = cases_table.scan(ExclusiveStartKey=response['LastEvaluatedKey'])
        items.extend(response.get('Items', []))
    return items


def compute_accurate_stats(all_cases, q_lower, original, date_patterns):
    """Compute accurate stats for date range queries."""
    # Parse date range from question
    start_date = None
    end_date = None

    if date_patterns:
        dates = []
        for d, m, y in date_patterns:
            if not y:
                y = '2026'
            elif len(y) == 2:
                y = '20' + y
            try:
                dates.append(datetime(int(y), int(m), int(d)))
            except:
                try:
                    dates.append(datetime(int(y), int(d), int(m)))
                except:
                    pass
        if len(dates) >= 2:
            start_date = min(dates)
            end_date = max(dates)
        elif len(dates) == 1:
            start_date = dates[0]
            end_date = datetime.utcnow()

    # If no dates parsed, check for "today", "this week", etc.
    if not start_date:
        today = datetime.utcnow()
        if 'today' in q_lower:
            start_date = today.replace(hour=0, minute=0, second=0)
            end_date = today
        elif 'week' in q_lower:
            start_date = today - timedelta(days=7)
            end_date = today
        elif 'month' in q_lower:
            start_date = today - timedelta(days=30)
            end_date = today
        else:
            start_date = today - timedelta(days=30)
            end_date = today

    # Filter cases by date
    start_str = start_date.strftime('%Y-%m-%d')
    end_str = end_date.strftime('%Y-%m-%d')

    filtered_cases = []
    for case in all_cases:
        case_date = case.get('procedure_start_date', '') or case.get('created_at', '')[:10]
        if start_str <= case_date <= end_str:
            filtered_cases.append(case)

    # Count validations
    total_passed = 0
    total_failed = 0
    total_overrides = 0
    stages_detail = {}

    for case in filtered_cases:
        stages = case.get('stages', {})
        for stage_id, stage_data in stages.items():
            status = stage_data.get('status', 'pending')
            val_result = stage_data.get('validation_result', '')

            if stage_id not in stages_detail:
                stages_detail[stage_id] = {'passed': 0, 'failed': 0, 'override': 0, 'pending': 0}

            if status == 'completed':
                if val_result == 'override':
                    total_overrides += 1
                    stages_detail[stage_id]['override'] += 1
                else:
                    total_passed += 1
                    stages_detail[stage_id]['passed'] += 1
            elif status == 'failed':
                total_failed += 1
                stages_detail[stage_id]['failed'] += 1
            else:
                stages_detail[stage_id]['pending'] += 1

    # Get center breakdown
    centers = {}
    for case in filtered_cases:
        center = case.get('center', 'Unknown')
        centers[center] = centers.get(center, 0) + 1

    result = f"""ACCURATE DATA for period {start_str} to {end_str}:

Total Cases Created: {len(filtered_cases)}
Total Validations Passed: {total_passed}
Total Validations Failed: {total_failed}
Total Manual Overrides: {total_overrides}

Cases by Center: {json.dumps(centers, default=decimal_default)}

Stage-wise breakdown:
{json.dumps(stages_detail, default=decimal_default, indent=2)}

Case list:"""

    for c in sorted(filtered_cases, key=lambda x: x.get('created_at', ''), reverse=True):
        result += f"\n- {c.get('procedure_start_date','')} | {c.get('female_patient',{}).get('name','')} & {c.get('male_patient',{}).get('name','')} | Center: {c.get('center','')}"

    return result


def compute_general_stats(all_cases):
    """General system stats."""
    today = datetime.utcnow().strftime('%Y-%m-%d')
    today_cases = [c for c in all_cases if (c.get('created_at', '') or '')[:10] == today]

    total_passed = 0
    total_failed = 0
    for case in all_cases:
        for stage_data in case.get('stages', {}).values():
            if stage_data.get('status') == 'completed':
                total_passed += 1
            elif stage_data.get('status') == 'failed':
                total_failed += 1

    return f"""System Statistics:
- Total cases in system: {len(all_cases)}
- Cases created today: {len(today_cases)}
- Total validations passed (all time): {total_passed}
- Total validations failed (all time): {total_failed}"""


def summarize_case(case):
    """Return a clean summary of a case."""
    stages = {}
    for stage_id, stage_data in case.get('stages', {}).items():
        stages[stage_id] = {
            'status': stage_data.get('status', 'pending'),
            'validation_result': stage_data.get('validation_result', '')
        }
    return {
        'sessionId': case.get('sessionId', ''),
        'procedure_date': case.get('procedure_start_date', ''),
        'created_at': case.get('created_at', ''),
        'center': case.get('center', ''),
        'male_patient': {
            'name': case.get('male_patient', {}).get('name', ''),
            'mpeid': case.get('male_patient', {}).get('mpeid', '')
        },
        'female_patient': {
            'name': case.get('female_patient', {}).get('name', ''),
            'mpeid': case.get('female_patient', {}).get('mpeid', '')
        },
        'stages': stages
    }
