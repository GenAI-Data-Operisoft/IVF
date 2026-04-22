"""
save-manual-grade.py

Saves or updates an embryologist's manual grade for an oocyte image.
Stores in DynamoDB and logs to audit trail.

Trigger: POST /embryo-grading/manual (API Gateway)
Table:   IVF-InjectedOocyteImages (DynamoDB)
"""

import json
import boto3
import os
from datetime import datetime
from audit_helper import log_audit, extract_user_info

dynamodb = boto3.resource('dynamodb')
images_table = dynamodb.Table(os.environ.get('IMAGES_TABLE', 'IVF-InjectedOocyteImages'))

CORS = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type,Authorization',
    'Access-Control-Allow-Methods': 'POST,OPTIONS'
}


def lambda_handler(event, context):
    if event.get('httpMethod') == 'OPTIONS':
        return {'statusCode': 200, 'headers': CORS, 'body': ''}

    try:
        body = json.loads(event.get('body') or '{}')
        image_id  = body.get('imageId')
        session_id = body.get('sessionId')
        stage_val  = body.get('stage', '')
        grade      = body.get('grade', '')
        quality    = body.get('quality', '')
        notes      = body.get('notes', '')
        graded_by  = body.get('userName') or body.get('userEmail') or 'unknown'

        if not image_id or not session_id:
            return {'statusCode': 400, 'headers': CORS, 'body': json.dumps({'error': 'imageId and sessionId required'})}
        if not stage_val or not grade:
            return {'statusCode': 400, 'headers': CORS, 'body': json.dumps({'error': 'stage and grade are required'})}

        # Check if existing grade (for audit action type)
        resp = images_table.get_item(Key={'imageId': image_id})
        existing = resp.get('Item', {}).get('manual_grade')
        action = 'MANUAL_GRADE_UPDATED' if existing else 'MANUAL_GRADE_SAVED'

        manual_grade = {
            'stage': stage_val,
            'grade': grade,
            'quality': quality,
            'notes': notes,
            'graded_by': graded_by,
            'graded_at': datetime.utcnow().isoformat() + 'Z'
        }

        images_table.update_item(
            Key={'imageId': image_id},
            UpdateExpression='SET manual_grade = :g',
            ExpressionAttributeValues={':g': manual_grade}
        )

        # Audit log
        user_info, ip = extract_user_info(event)
        oocyte_number = resp.get('Item', {}).get('oocyte_number', 0)
        log_audit(
            user_info=user_info,
            action=action,
            resource_type='image',
            resource_id=image_id,
            session_id=session_id,
            stage='icsi_documentation',
            result='success',
            ip_address=ip,
            metadata={
                'imageId': image_id,
                'oocyte_number': int(oocyte_number),
                'grade': grade,
                'quality': quality,
                'graded_by': graded_by,
                'graded_at': manual_grade['graded_at']
            }
        )

        return {
            'statusCode': 200,
            'headers': CORS,
            'body': json.dumps({'message': 'Grade saved', 'manual_grade': manual_grade})
        }

    except Exception as e:
        print(f"Error: {e}")
        return {'statusCode': 500, 'headers': CORS, 'body': json.dumps({'error': str(e)})}
