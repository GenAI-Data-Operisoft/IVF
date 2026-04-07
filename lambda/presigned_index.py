import json
import boto3
from datetime import datetime
import os
from audit_helper import log_audit, extract_user_info, ACTIONS

s3_client = boto3.client('s3', config=boto3.session.Config(signature_version='s3v4', s3={'addressing_style': 'path'}))
dynamodb = boto3.resource('dynamodb')
cases_table = dynamodb.Table(os.environ.get('CASES_TABLE', 'IVF-Cases'))

BUCKET_NAME = os.environ.get('BUCKET_NAME', 'c9-ivf-witness-capture-artifacts')
URL_EXPIRATION = 300  # 5 minutes

STAGE_FOLDERS = {
    'label_validation': 'label-validation',
    'oocyte_collection': 'oocyte-collection',
    'denudation': 'denudation',
    'male_sample_collection': 'male-sample-collection',
    'icsi': 'icsi',
    'culture': 'culture'
}

def lambda_handler(event, context):
    """
    Generate pre-signed URL for image upload or download
    """
    try:
        body = json.loads(event['body'])
        
        # Check if this is a download request
        if 'download' in body and body['download']:
            s3_key = body.get('s3_key') or body.get('s3_path')
            if not s3_key:
                return {
                    'statusCode': 400,
                    'headers': {
                        'Content-Type': 'application/json',
                        'Access-Control-Allow-Origin': '*'
                    },
                    'body': json.dumps({'error': 'Missing s3_key or s3_path for download'})
                }
            
            # If s3_path is in s3://bucket/key format, extract just the key
            if s3_key.startswith('s3://'):
                # Extract key from s3://bucket/key format
                s3_key = '/'.join(s3_key.split('/')[3:])
            
            # Generate presigned URL for download
            download_url = s3_client.generate_presigned_url(
                'get_object',
                Params={
                    'Bucket': BUCKET_NAME,
                    'Key': s3_key
                },
                ExpiresIn=3600  # 1 hour for downloads
            )
            
            return {
                'statusCode': 200,
                'headers': {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*'
                },
                'body': json.dumps({
                    'downloadUrl': download_url,
                    's3_key': s3_key
                })
            }
        
        # Original upload URL generation code
        session_id = body['sessionId']
        stage = body['stage']
        image_number = body.get('imageNumber', 1)
        
        # Validate stage
        if stage not in STAGE_FOLDERS:
            return {
                'statusCode': 400,
                'headers': {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*'
                },
                'body': json.dumps({'error': 'Invalid stage'})
            }
        
        # Verify session exists
        response = cases_table.get_item(Key={'sessionId': session_id})
        if 'Item' not in response:
            return {
                'statusCode': 404,
                'headers': {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*'
                },
                'body': json.dumps({'error': 'Session not found'})
            }
        
        case = response['Item']
        
        # Check if stage allows uploads (allow retry for failed and completed stages)
        stage_status = case['stages'][stage]['status']
        # Allow uploads for: pending, in_progress, failed, and completed (for retry)
        # Only block if explicitly marked as something else
        allowed_statuses = ['pending', 'in_progress', 'failed', 'completed']
        if stage_status not in allowed_statuses:
            return {
                'statusCode': 400,
                'headers': {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*'
                },
                'body': json.dumps({'error': f'Stage {stage} has status {stage_status}. Cannot upload new images.'})
            }
        
        # Generate S3 key
        timestamp = datetime.utcnow().strftime('%Y%m%d_%H%M%S')
        s3_key = f"{STAGE_FOLDERS[stage]}/{session_id}/image_{image_number}_{timestamp}.jpg"
        
        # Generate pre-signed URL for PUT operation with required encryption
        presigned_url = s3_client.generate_presigned_url(
            'put_object',
            Params={
                'Bucket': BUCKET_NAME,
                'Key': s3_key,
                'ContentType': 'image/jpeg',
                'ServerSideEncryption': 'AES256'
            },
            ExpiresIn=URL_EXPIRATION
        )
        
        # Ensure URL has https:// protocol
        if not presigned_url.startswith('http'):
            presigned_url = 'https://' + presigned_url
        
        # Update stage status to in_progress and store user who is uploading
        user_info, ip_address = extract_user_info(event)
        cases_table.update_item(
            Key={'sessionId': session_id},
            UpdateExpression='SET stages.#stage.#status = :status, stages.#stage.last_user = :user_info',
            ExpressionAttributeNames={
                '#stage': stage,
                '#status': 'status'
            },
            ExpressionAttributeValues={
                ':status': 'in_progress',
                ':user_info': user_info
            }
        )
        
        # Log audit entry for upload URL generation
        log_audit(
            user_info=user_info,
            action=ACTIONS['UPLOAD_IMAGE'],
            resource_type='image',
            resource_id=s3_key,
            session_id=session_id,
            stage=stage,
            patient_mpeid=case.get('female_patient', {}).get('mpeid'),
            result='success',
            ip_address=ip_address,
            metadata={
                'message': f'Image {image_number} uploaded successfully'
            }
        )
        
        return {
            'statusCode': 200,
            'headers': {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            },
            'body': json.dumps({
                'uploadUrl': presigned_url,
                's3Key': s3_key,
                'expiresIn': URL_EXPIRATION,
                'message': 'Upload URL generated successfully'
            })
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
