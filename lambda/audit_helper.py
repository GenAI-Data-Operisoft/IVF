"""
Audit Helper Module for IVF Witness Capture System

This module provides reusable functions for logging audit entries
to the IVF-AuditLog DynamoDB table.

Usage:
    from audit_helper import log_audit, extract_user_info
    
    user_info = extract_user_info(event)
    log_audit(
        user_info=user_info,
        action='REGISTER_CASE',
        resource_type='case',
        resource_id=session_id,
        result='success'
    )
"""

import json
import boto3
import uuid
from datetime import datetime
import os

dynamodb = boto3.resource('dynamodb')
audit_table = dynamodb.Table(os.environ.get('AUDIT_TABLE', 'IVF-AuditLog'))

# Action types
ACTIONS = {
    'REGISTER_CASE': 'REGISTER_CASE',
    'UPLOAD_IMAGE': 'UPLOAD_IMAGE',
    'EDIT_PATIENT': 'EDIT_PATIENT',
    'RETRY_VALIDATION': 'RETRY_VALIDATION',
    'VALIDATION_PASS': 'VALIDATION_PASS',
    'VALIDATION_FAIL': 'VALIDATION_FAIL',
    'RESOLVE_FAILURE': 'RESOLVE_FAILURE',
    'OCR_EXTRACT': 'OCR_EXTRACT',
    'COMPLETE_STAGE': 'COMPLETE_STAGE'
}


def log_audit(
    user_info,
    action,
    resource_type,
    resource_id,
    session_id=None,
    stage=None,
    patient_mpeid=None,
    change_details=None,
    result='success',
    error_message=None,
    metadata=None,
    ip_address=None
):
    """
    Log an audit entry to DynamoDB
    
    Args:
        user_info (dict): User information with userId, userEmail, userName, userRole
        action (str): Action type (use ACTIONS constants)
        resource_type (str): Type of resource (case/image/patient/validation/failure)
        resource_id (str): ID of the resource
        session_id (str, optional): Session ID for correlation
        stage (str, optional): IVF stage (label_validation, oocyte_collection, etc.)
        patient_mpeid (str, optional): Patient MPEID
        change_details (dict, optional): Dict with before/after/fields
        result (str): 'success' or 'failure'
        error_message (str, optional): Error message if failed
        metadata (dict, optional): Additional context
        ip_address (str, optional): IP address of the request
    
    Returns:
        bool: True if logged successfully, False otherwise
    """
    try:
        # Create audit entry with DynamoDB-compatible field names
        # Note: auditId and timestamp must be camelCase (DynamoDB keys)
        # Other fields use snake_case for frontend compatibility
        audit_entry = {
            'auditId': str(uuid.uuid4()),  # Primary key - must be camelCase
            'timestamp': datetime.utcnow().isoformat() + 'Z',  # Sort key - must be camelCase
            'user_id': user_info.get('userId', 'unknown'),
            'user_email': user_info.get('userEmail', 'unknown'),
            'user_name': user_info.get('userName', 'unknown'),
            'user_role': user_info.get('userRole', 'unknown'),
            'action': action,
            'resource_type': resource_type,
            'resource_id': resource_id,
            'result': result
        }
        
        # Add optional fields only if provided
        if session_id:
            audit_entry['session_id'] = session_id
        if stage:
            audit_entry['stage'] = stage
        if patient_mpeid:
            audit_entry['patient_mpeid'] = patient_mpeid
        if change_details:
            audit_entry['details'] = change_details
        if error_message:
            audit_entry['error_message'] = error_message
        if metadata:
            audit_entry['details'] = metadata  # Use 'details' for metadata
            # Also extract center from metadata if present
            if isinstance(metadata, dict) and metadata.get('center'):
                audit_entry['center'] = metadata['center']
        if ip_address:
            audit_entry['ip_address'] = ip_address
        
        # Write to DynamoDB
        audit_table.put_item(Item=audit_entry)
        
        print(f"✅ Audit logged: {action} by {user_info.get('userEmail')} - {result}")
        return True
        
    except Exception as e:
        print(f"❌ Failed to log audit: {str(e)}")
        # Don't fail the main operation if audit logging fails
        return False


def extract_user_info(event):
    """
    Extract user information from API Gateway event
    
    Args:
        event (dict): Lambda event from API Gateway
    
    Returns:
        tuple: (user_info dict, ip_address string)
    """
    try:
        # Get IP address from request context
        ip_address = event.get('requestContext', {}).get('identity', {}).get('sourceIp', 'unknown')
        
        # Try to get from Cognito authorizer context first
        authorizer = event.get('requestContext', {}).get('authorizer', {})
        claims = authorizer.get('claims', {})
        
        if claims:
            # User is authenticated via Cognito
            user_info = {
                'userId': claims.get('sub', 'unknown'),
                'userEmail': claims.get('email', 'unknown'),
                'userName': claims.get('name', 'unknown'),
                'userRole': claims.get('custom:role', 'unknown')
            }
            return user_info, ip_address
        
        # Try to get from request body (sent by frontend)
        body = {}
        if event.get('body'):
            try:
                body = json.loads(event['body'])
            except:
                pass
        
        # Check if user info is in the body
        if 'userId' in body or 'userEmail' in body:
            user_info = {
                'userId': body.get('userId', 'unknown'),
                'userEmail': body.get('userEmail', 'unknown'),
                'userName': body.get('userName', 'unknown'),
                'userRole': body.get('userRole', 'unknown')
            }
            return user_info, ip_address
        
        # Fallback to system user
        user_info = {
            'userId': 'system',
            'userEmail': 'system@ivf.local',
            'userName': 'System User',
            'userRole': 'system'
        }
        return user_info, ip_address
            
    except Exception as e:
        print(f"⚠️  Failed to extract user info: {str(e)}")
        # Return default system user
        return {
            'userId': 'system',
            'userEmail': 'system@ivf.local',
            'userName': 'System User',
            'userRole': 'system'
        }, 'unknown'


def get_changed_fields(before, after):
    """
    Compare two dictionaries and return list of changed fields
    
    Args:
        before (dict): Original values
        after (dict): New values
    
    Returns:
        list: List of field names that changed
    """
    changed = []
    all_keys = set(before.keys()) | set(after.keys())
    
    for key in all_keys:
        before_val = before.get(key)
        after_val = after.get(key)
        
        # Handle None values
        if before_val != after_val:
            changed.append(key)
    
    return changed


def create_change_details(before, after):
    """
    Create change details object for audit log
    
    Args:
        before (dict): Original values
        after (dict): New values
    
    Returns:
        dict: Change details with before, after, and fields
    """
    changed_fields = get_changed_fields(before, after)
    
    if not changed_fields:
        return None
    
    return {
        'before': before,
        'after': after,
        'fields': changed_fields
    }


# Helper function to safely serialize objects for DynamoDB
def serialize_for_dynamodb(obj):
    """
    Convert object to DynamoDB-compatible format
    
    Args:
        obj: Object to serialize
    
    Returns:
        Serialized object
    """
    if isinstance(obj, dict):
        return {k: serialize_for_dynamodb(v) for k, v in obj.items()}
    elif isinstance(obj, list):
        return [serialize_for_dynamodb(item) for item in obj]
    elif isinstance(obj, (int, float, str, bool)):
        return obj
    elif obj is None:
        return None
    else:
        return str(obj)
