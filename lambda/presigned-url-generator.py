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
    'iui': 'iui',
    'denudation': 'denudation',
    'male_sample_collection': 'male-sample-collection',
    'icsi': 'icsi',
    'fertilization_check': 'fertilization-check',
    'culture': 'culture',
    'icsi_documentation': 'icsi-documentation',
    'blastocyst': 'blastocyst-stage',
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
        
        # ICSI documentation / annotated image upload — no stage field
        # stageFolder determines the S3 prefix for stage-specific image separation
        if 'stage' not in body:
            session_id = body['sessionId']
            image_number = body.get('imageNumber', 1)
            stage_folder = body.get('stageFolder', 'icsi')
            client_annotated = body.get('clientAnnotated', False)
            fixed_key = body.get('fixedKey')  # For Excel sheets — use exact S3 key
            timestamp = datetime.utcnow().strftime('%Y%m%d_%H%M%S')
            
            # Fixed key mode (for Excel sheets)
            if fixed_key:
                s3_key = fixed_key
            elif client_annotated:
                s3_key = f'{stage_folder}-injected-annotated/{session_id}/image_{image_number}_{timestamp}.jpg'
            else:
                s3_key = f'{stage_folder}-injected-original/{session_id}/image_{image_number}_{timestamp}.jpg'
            
            upload_url = s3_client.generate_presigned_url(
                'put_object',
                Params={
                    'Bucket': BUCKET_NAME,
                    'Key': s3_key,
                    'ServerSideEncryption': 'AES256',
                },
                ExpiresIn=600
            )
            
            # For client-annotated images, save metadata to DynamoDB immediately
            response_body = {
                'uploadUrl': upload_url,
                's3Key': s3_key,
                'bucket': BUCKET_NAME
            }
            
            if client_annotated:
                import uuid
                stage_type_map = {
                    'icsi': 'icsi_documentation',
                    'oocyte-morphology': 'denudation',
                    'oocyte-impression': 'denudation',
                    'fertilization-check': 'fertilization_check',
                    'cleavage': 'cleavage',
                    'blastocyst': 'blastocyst',
                    'day6': 'day6',
                    'day7': 'day7',
                    'cleavage-transfer': 'cleavage_transfer',
                    'blastocyst-transfer': 'blastocyst_transfer',
                    'day6-transfer': 'day6_transfer',
                    'day7-transfer': 'day7_transfer',
                    'cleavage-sample': 'cleavage_sample',
                    'blastocyst-sample': 'blastocyst_sample',
                    'day6-sample': 'day6_sample',
                    'day7-sample': 'day7_sample',
                    'fet': 'fet',
                }
                stage_type = stage_type_map.get(stage_folder, stage_folder)
                
                # Get case data for patient info
                case_response = cases_table.get_item(Key={'sessionId': session_id})
                case = case_response.get('Item', {})
                
                image_id = str(uuid.uuid4())
                images_table = dynamodb.Table(os.environ.get('IMAGES_TABLE', 'IVF-InjectedOocyteImages'))
                images_table.put_item(Item={
                    'imageId': image_id,
                    'sessionId': session_id,
                    'stage_type': stage_type,
                    'oocyte_number': image_number,
                    'original_s3_path': f's3://{BUCKET_NAME}/{s3_key}',
                    'annotated_s3_path': f's3://{BUCKET_NAME}/{s3_key}',
                    'male_patient': {
                        'name': case.get('male_patient', {}).get('name', ''),
                        'mpeid': case.get('male_patient', {}).get('mpeid', '')
                    },
                    'female_patient': {
                        'name': case.get('female_patient', {}).get('name', ''),
                        'mpeid': case.get('female_patient', {}).get('mpeid', '')
                    },
                    'captured_at': datetime.utcnow().isoformat(),
                    'annotation_status': 'completed',
                    'download_count': 0
                })
                response_body['imageId'] = image_id
                
                if log_audit:
                    log_audit(
                        user_info=extract_user_info(body),
                        action='IMAGE_ANNOTATED',
                        resource_type='image',
                        resource_id=image_id,
                        session_id=session_id,
                        stage=stage_type,
                        result='success',
                        metadata={'message': 'Client-side annotated image uploaded', 'image_number': image_number}
                    )
            
            return {
                'statusCode': 200,
                'headers': {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*'
                },
                'body': json.dumps(response_body)
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
        stage_info = case.get('stages', {}).get(stage, {})
        stage_status = stage_info.get('status', 'pending')  # default pending for new stages on old cases
        # Allow uploads for: pending, in_progress, failed, and completed (for retry)
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
        
        # Generate pre-signed URL for PUT operation.
        # ServerSideEncryption must be included so the signature satisfies the bucket policy
        # which denies any PutObject without x-amz-server-side-encryption: AES256.
        presigned_url = s3_client.generate_presigned_url(
            'put_object',
            Params={
                'Bucket': BUCKET_NAME,
                'Key': s3_key,
                'ServerSideEncryption': 'AES256',
            },
            ExpiresIn=URL_EXPIRATION
        )
        
        # Ensure URL has https:// protocol
        if not presigned_url.startswith('http'):
            presigned_url = 'https://' + presigned_url
        
        # Update stage status to in_progress and store user who is uploading
        # Use if_not_exists to handle optional stages (like iui) that may not be in the stages map
        user_info, ip_address = extract_user_info(event)
        try:
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
        except Exception as update_err:
            # If stage key doesn't exist in the map (e.g. optional stages added after case creation),
            # initialize it first then update
            if 'ValidationException' in str(type(update_err)) or 'document path' in str(update_err).lower():
                cases_table.update_item(
                    Key={'sessionId': session_id},
                    UpdateExpression='SET stages.#stage = if_not_exists(stages.#stage, :empty)',
                    ExpressionAttributeNames={'#stage': stage},
                    ExpressionAttributeValues={':empty': {'status': 'pending', 'images_required': 2, 'images_uploaded': 0}}
                )
                cases_table.update_item(
                    Key={'sessionId': session_id},
                    UpdateExpression='SET stages.#stage.#status = :status, stages.#stage.last_user = :user_info',
                    ExpressionAttributeNames={'#stage': stage, '#status': 'status'},
                    ExpressionAttributeValues={':status': 'in_progress', ':user_info': user_info}
                )
            else:
                raise
        
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
