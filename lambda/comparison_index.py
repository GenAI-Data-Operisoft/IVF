import json
import boto3
from datetime import datetime
import os
import uuid
from audit_helper import log_audit, ACTIONS

dynamodb = boto3.resource('dynamodb')

cases_table = dynamodb.Table(os.environ.get('CASES_TABLE', 'IVF-Cases'))
failures_table = dynamodb.Table(os.environ.get('FAILURES_TABLE', 'IVF-ValidationFailures'))

STAGE_VALIDATION_RULES = {
    'label_validation': ['female_name', 'female_mpeid'],
    'oocyte_collection': ['female_name', 'female_mpeid'],
    'denudation': ['female_name', 'female_mpeid'],
    'male_sample_collection': ['male_name', 'male_mpeid', 'female_name', 'female_mpeid'],  # Both patients - tube has labels on both sides
    'icsi': ['female_name', 'female_mpeid'],
    'culture': ['female_name', 'female_mpeid']
}

def lambda_handler(event, context):
    """
    Validate extracted data against registered case data
    Triggered by DynamoDB Streams when extraction_status changes to 'extracted'
    """
    try:
        for record in event['Records']:
            if record['eventName'] in ['INSERT', 'MODIFY']:
                new_image = record['dynamodb']['NewImage']
                
                # Check if status is 'extracted'
                if new_image.get('extraction_status', {}).get('S') != 'extracted':
                    continue
                
                # Skip if already validated (prevent infinite loop)
                if 'validation_result' in new_image:
                    continue
                
                session_id = new_image['sessionId']['S']
                extraction_id = new_image['extractionId']['S']
                
                # Determine stage from source table
                source_arn = record['eventSourceARN']
                stage = extract_stage_from_arn(source_arn)
                
                # Get extracted data
                extracted_data = parse_dynamodb_map(new_image['extracted_data']['M'])
                
                # For male_sample_collection, we need to wait for both images
                # and merge their data before validation
                if stage == 'male_sample_collection':
                    # Get all extractions for this session and stage
                    table_name = source_arn.split('/')[-3]
                    table = dynamodb.Table(table_name)
                    
                    print(f"Querying for session: {session_id}")
                    response = table.query(
                        IndexName='SessionIdIndex',
                        KeyConditionExpression='sessionId = :sid',
                        ExpressionAttributeValues={':sid': session_id}
                    )
                    
                    extractions = response.get('Items', [])
                    print(f"Found {len(extractions)} total extractions")
                    
                    # Get only the MOST RECENT extraction for each image number
                    # This handles revalidation scenarios where old failed extractions exist
                    latest_by_image = {}
                    for extraction in extractions:
                        img_num = extraction.get('image_number')
                        extracted_at = extraction.get('extracted_at', '')
                        
                        if img_num not in latest_by_image or extracted_at > latest_by_image[img_num].get('extracted_at', ''):
                            latest_by_image[img_num] = extraction
                    
                    print(f"Latest extractions by image: {list(latest_by_image.keys())}")
                    
                    # Check if we have both images (image 1 and image 2)
                    if 1 not in latest_by_image or 2 not in latest_by_image:
                        print(f"Waiting for both images for male_sample_collection. Current images: {list(latest_by_image.keys())}")
                        continue  # Wait for the other image
                    
                    print(f"Both images found! Proceeding with validation")
                    
                    try:
                        # Merge data from the LATEST extraction of each image
                        print(f"Merging data from latest extractions")
                        merged_data = {}
                        
                        # Image 1 has male data
                        img1_data = latest_by_image[1].get('extracted_data', {})
                        merged_data['male_name'] = img1_data.get('male_name')
                        merged_data['male_mpeid'] = img1_data.get('male_mpeid')
                        print(f"Image 1 (male) data: male_name={merged_data['male_name']}, male_mpeid={merged_data['male_mpeid']}")
                        
                        # Image 2 has female data
                        img2_data = latest_by_image[2].get('extracted_data', {})
                        merged_data['female_name'] = img2_data.get('female_name')
                        merged_data['female_mpeid'] = img2_data.get('female_mpeid')
                        print(f"Image 2 (female) data: female_name={merged_data['female_name']}, female_mpeid={merged_data['female_mpeid']}")
                        
                        # Use only the latest extractions for updating
                        extractions = list(latest_by_image.values())
                        
                        print(f"Merged data: {merged_data}")
                        extracted_data = merged_data
                    except Exception as merge_error:
                        print(f"ERROR merging data: {str(merge_error)}")
                        raise
                
                # Get registered case data
                print(f"Fetching case data for session: {session_id}")
                try:
                    case_response = cases_table.get_item(Key={'sessionId': session_id})
                    if 'Item' not in case_response:
                        print(f"Case not found: {session_id}")
                        continue
                    
                    case = case_response['Item']
                    print(f"Case data retrieved successfully")
                except Exception as case_error:
                    print(f"ERROR fetching case data: {str(case_error)}")
                    raise
                
                # Perform validation
                print(f"Starting validation for stage: {stage}")
                try:
                    validation_result = validate_extraction(extracted_data, case, stage)
                    print(f"Validation result: {validation_result}")
                except Exception as val_error:
                    print(f"ERROR during validation: {str(val_error)}")
                    raise
                
                # Update extraction record(s) with validation result
                print(f"Updating extraction records with validation result")
                try:
                    if stage == 'male_sample_collection':
                        # Update both extraction records
                        table_name = source_arn.split('/')[-3]
                        table = dynamodb.Table(table_name)
                        for extraction in extractions:
                            print(f"Updating extraction: {extraction['extractionId']}")
                            table.update_item(
                                Key={'extractionId': extraction['extractionId']},
                                UpdateExpression='SET validation_result = :result, validated_at = :timestamp',
                                ExpressionAttributeValues={
                                    ':result': validation_result,
                                    ':timestamp': datetime.utcnow().isoformat()
                                }
                            )
                        print(f"Updated {len(extractions)} extraction records")
                    else:
                        update_extraction_validation(source_arn, extraction_id, validation_result)
                        print(f"Updated extraction record: {extraction_id}")
                except Exception as update_error:
                    print(f"ERROR updating extraction records: {str(update_error)}")
                    raise
                
                # Update case record
                print(f"Updating case record for session: {session_id}")
                try:
                    # Aggregate token usage for this stage
                    if stage == 'male_sample_collection':
                        # For male sample collection, aggregate from both images
                        table_name = source_arn.split('/')[-3]
                        table = dynamodb.Table(table_name)
                        token_totals = aggregate_tokens_for_stage(table, session_id)
                    else:
                        # For single image stages, get tokens from current extraction
                        token_totals = {
                            'input_tokens': new_image.get('input_tokens', {}).get('N', '0'),
                            'output_tokens': new_image.get('output_tokens', {}).get('N', '0')
                        }
                    
                    update_case_validation(session_id, stage, validation_result, token_totals)
                    print(f"Case record updated successfully with tokens: {token_totals}")
                    
                    # Log audit entry for validation
                    action = ACTIONS['VALIDATION_PASS'] if validation_result['overall_match'] else ACTIONS['VALIDATION_FAIL']
                    
                    # Get user who triggered this validation (from stage's last_user)
                    stage_info = case.get('stages', {}).get(stage, {})
                    last_user = stage_info.get('last_user', {})
                    
                    user_info = {
                        'userId': last_user.get('userId', 'system'),
                        'userEmail': last_user.get('userEmail', 'system@ivf.local'),
                        'userName': last_user.get('userName', 'System'),
                        'userRole': last_user.get('userRole', 'system')
                    }
                    
                    log_audit(
                        user_info=user_info,
                        action=action,
                        resource_type='validation',
                        resource_id=extraction_id,
                        session_id=session_id,
                        stage=stage,
                        patient_mpeid=case.get('female_patient', {}).get('mpeid'),
                        result='success' if validation_result['overall_match'] else 'failure',
                        metadata={
                            'message': 'Validation passed - All details match' if validation_result['overall_match'] 
                                      else f"Validation failed - {len(validation_result.get('mismatches', []))} mismatch(es) found",
                            'mismatches': validation_result.get('mismatches', []) if not validation_result['overall_match'] else None
                        }
                    )
                    
                    # Create failure record if validation failed
                    if not validation_result['overall_match']:
                        # Get model info and S3 path
                        model_used = extracted_data.get('model_used', 'Unknown')
                        s3_path = new_image.get('s3_path', {}).get('S', '')
                        
                        failure_id = create_failure_record(
                            session_id=session_id,
                            stage=stage,
                            validation_result=validation_result,
                            extraction_id=extraction_id,
                            s3_path=s3_path,
                            model_used=model_used,
                            token_totals=token_totals
                        )
                        print(f"Created failure record: {failure_id}")
                    
                except Exception as case_update_error:
                    print(f"ERROR updating case record: {str(case_update_error)}")
                    raise
        
        return {'statusCode': 200, 'body': json.dumps('Validation completed')}
        
    except Exception as e:
        print(f"Error in validation: {str(e)}")
        raise

def validate_extraction(extracted, case, stage):
    """
    Compare extracted data with registered case data
    Handles flexible MPEID formats (with or without "ID-" prefix)
    """
    validation_result = {
        'male_name_match': None,
        'male_mpeid_match': None,
        'female_name_match': None,
        'female_mpeid_match': None,
        'overall_match': True,
        'mismatches': []
    }
    
    fields_to_check = STAGE_VALIDATION_RULES.get(stage, [])
    
    for field in fields_to_check:
        patient_type, field_name = field.split('_', 1)
        
        extracted_value = extracted.get(field)
        registered_value = case[f'{patient_type}_patient'].get(field_name)
        
        # Normalize for comparison
        if extracted_value:
            extracted_value = str(extracted_value).upper().strip()
        if registered_value:
            registered_value = str(registered_value).upper().strip()
        
        # Special handling for names - normalize spaces
        if field_name == 'name':
            extracted_value = normalize_name(extracted_value)
            registered_value = normalize_name(registered_value)
        
        # Special handling for MPEID - normalize both formats
        if field_name == 'mpeid':
            extracted_value = normalize_mpeid(extracted_value)
            registered_value = normalize_mpeid(registered_value)
        
        # Compare
        match = (extracted_value == registered_value)
        validation_result[f'{field}_match'] = match
        
        if not match:
            validation_result['overall_match'] = False
            validation_result['mismatches'].append({
                'field': field,
                'expected': registered_value,
                'found': extracted_value
            })
    
    return validation_result

def normalize_name(name):
    """
    Normalize patient name to consistent uppercase format
    Handles:
    - "john doe" -> "JOHN DOE"
    - "John Doe" -> "JOHN DOE"
    - "JOHN DOE" -> "JOHN DOE"
    - Removes extra spaces
    """
    if not name:
        return None
    
    # Convert to uppercase and strip extra spaces
    normalized = str(name).upper().strip()
    
    # Remove multiple spaces between words
    normalized = ' '.join(normalized.split())
    
    return normalized

def normalize_mpeid(mpeid):
    """
    Normalize MPEID to handle different formats and OCR errors:
    - "ID-35697344" -> "ID-35697344"
    - "10-35697344" -> "ID-35697344" (OCR mistake: 10 instead of ID)
    - "35697344" -> "ID-35697344"
    - "id-35697344" -> "ID-35697344"
    - "I0-35697344" -> "ID-35697344" (OCR mistake: I0 instead of ID)
    - "1D-35697344" -> "ID-35697344" (OCR mistake: 1D instead of ID)
    """
    if not mpeid:
        return None
    
    mpeid = str(mpeid).upper().strip()
    
    # Common OCR mistakes for "ID-"
    ocr_mistakes = [
        ('10-', 'ID-'),  # 10 instead of ID
        ('I0-', 'ID-'),  # I0 instead of ID
        ('1D-', 'ID-'),  # 1D instead of ID
        ('1O-', 'ID-'),  # 1O instead of ID
        ('IO-', 'ID-'),  # IO instead of ID
        ('lD-', 'ID-'),  # lD instead of ID (lowercase L)
        ('l0-', 'ID-'),  # l0 instead of ID
    ]
    
    # Fix common OCR mistakes
    for mistake, correction in ocr_mistakes:
        if mpeid.startswith(mistake):
            mpeid = mpeid.replace(mistake, correction, 1)
            break
    
    # If it already has ID- prefix, return as is
    if mpeid.startswith('ID-'):
        return mpeid
    
    # If it's just numbers, add ID- prefix
    if mpeid.isdigit():
        return f'ID-{mpeid}'
    
    # If it has other prefix patterns, try to extract the number
    # Handle cases like "M12345" or "F67890"
    if len(mpeid) > 0 and mpeid[0].isalpha():
        # Keep the original format for non-ID prefixes
        return mpeid
    
    return mpeid

def update_extraction_validation(source_arn, extraction_id, validation_result):
    """
    Update extraction record with validation result
    """
    table_name = source_arn.split('/')[-3]
    table = dynamodb.Table(table_name)
    
    table.update_item(
        Key={'extractionId': extraction_id},
        UpdateExpression='SET validation_result = :result, validated_at = :timestamp',
        ExpressionAttributeValues={
            ':result': validation_result,
            ':timestamp': datetime.utcnow().isoformat()
        }
    )

def update_case_validation(session_id, stage, validation_result, token_totals):
    """
    Update case record with stage validation status and token usage
    """
    from decimal import Decimal
    
    status = 'completed' if validation_result['overall_match'] else 'failed'
    
    # Convert token counts to integers
    input_tokens = int(token_totals.get('input_tokens', 0))
    output_tokens = int(token_totals.get('output_tokens', 0))
    
    # Mumbai region pricing (per token)
    INPUT_TOKEN_PRICE = Decimal('0.00062') / Decimal('1000')
    OUTPUT_TOKEN_PRICE = Decimal('0.00313') / Decimal('1000')
    
    # Calculate cost for this stage
    stage_cost = (Decimal(str(input_tokens)) * INPUT_TOKEN_PRICE) + (Decimal(str(output_tokens)) * OUTPUT_TOKEN_PRICE)
    
    # Get current case to calculate new totals
    case_response = cases_table.get_item(Key={'sessionId': session_id})
    case = case_response.get('Item', {})
    
    # Calculate new totals
    current_total_input = int(case.get('total_input_tokens', 0))
    current_total_output = int(case.get('total_output_tokens', 0))
    current_total_cost = Decimal(str(case.get('total_cost_usd', 0)))
    
    new_total_input = current_total_input + input_tokens
    new_total_output = current_total_output + output_tokens
    new_total_cost = current_total_cost + stage_cost
    
    # Update case with stage-specific and total token data
    cases_table.update_item(
        Key={'sessionId': session_id},
        UpdateExpression='''SET 
            stages.#stage.#status = :status, 
            stages.#stage.validation_result = :result, 
            stages.#stage.validated_at = :timestamp,
            #stage_input = :stage_input,
            #stage_output = :stage_output,
            #stage_cost = :stage_cost,
            total_input_tokens = :total_input,
            total_output_tokens = :total_output,
            total_cost_usd = :total_cost
        ''',
        ExpressionAttributeNames={
            '#stage': stage,
            '#status': 'status',
            '#stage_input': f'{stage}_input_tokens',
            '#stage_output': f'{stage}_output_tokens',
            '#stage_cost': f'{stage}_cost_usd'
        },
        ExpressionAttributeValues={
            ':status': status,
            ':result': 'match' if validation_result['overall_match'] else 'mismatch',
            ':timestamp': datetime.utcnow().isoformat(),
            ':stage_input': input_tokens,
            ':stage_output': output_tokens,
            ':stage_cost': stage_cost,
            ':total_input': new_total_input,
            ':total_output': new_total_output,
            ':total_cost': new_total_cost
        }
    )

def extract_stage_from_arn(arn):
    """
    Extract stage name from DynamoDB Stream ARN
    """
    table_name = arn.split('/')[-3]
    stage_map = {
        'IVF-LabelValidationExtractions': 'label_validation',
        'IVF-OocyteCollectionExtractions': 'oocyte_collection',
        'IVF-DenudationExtractions': 'denudation',
        'IVF-MaleSampleCollectionExtractions': 'male_sample_collection',
        'IVF-ICSIExtractions': 'icsi',
        'IVF-CultureExtractions': 'culture'
    }
    return stage_map.get(table_name, 'unknown')

def parse_dynamodb_map(dynamodb_map):
    """
    Parse DynamoDB map format to Python dict
    """
    result = {}
    for key, value in dynamodb_map.items():
        if 'S' in value:
            result[key] = value['S']
        elif 'N' in value:
            result[key] = value['N']
        elif 'NULL' in value:
            result[key] = None
    return result

def aggregate_tokens_for_stage(table, session_id):
    """
    Aggregate token usage from all extractions for a given session/stage
    """
    response = table.query(
        IndexName='SessionIdIndex',
        KeyConditionExpression='sessionId = :sid',
        ExpressionAttributeValues={':sid': session_id}
    )
    
    extractions = response.get('Items', [])
    
    total_input = 0
    total_output = 0
    
    for extraction in extractions:
        total_input += int(extraction.get('input_tokens', 0))
        total_output += int(extraction.get('output_tokens', 0))
    
    return {
        'input_tokens': total_input,
        'output_tokens': total_output
    }

def create_failure_record(session_id, stage, validation_result, extraction_id, s3_path, model_used, token_totals):
    """
    Create a failure record in IVF-ValidationFailures table
    """
    from decimal import Decimal
    
    # Extract mismatched fields with display names
    mismatched_fields = []
    field_display_names = {
        'male_name': 'Male Patient Name',
        'male_mpeid': 'Male Patient MPEID',
        'female_name': 'Female Patient Name',
        'female_mpeid': 'Female Patient MPEID'
    }
    
    for mismatch in validation_result.get('mismatches', []):
        field = mismatch['field']
        mismatched_fields.append({
            'field': field,
            'expected': mismatch['expected'],
            'found': mismatch['found'],
            'field_display_name': field_display_names.get(field, field)
        })
    
    # Determine primary mismatch reason (first mismatch)
    primary_mismatch_reason = mismatched_fields[0]['field_display_name'] if mismatched_fields else 'Unknown'
    
    failure_record = {
        'failureId': str(uuid.uuid4()),
        'sessionId': session_id,
        'stage': stage,
        'failed_at': datetime.utcnow().isoformat(),
        'mismatched_fields': mismatched_fields,
        'primary_mismatch_reason': primary_mismatch_reason,
        'failed_extraction_id': extraction_id,
        'failed_image_s3_path': s3_path,
        'status': 'active',
        'retry_count': 0,
        'model_used': model_used,
        'tokens_used': {
            'input': int(token_totals.get('input_tokens', 0)),
            'output': int(token_totals.get('output_tokens', 0))
        },
        'resolved_by_user': 'system',
        'created_at': datetime.utcnow().isoformat(),
        'updated_at': datetime.utcnow().isoformat()
    }
    
    failures_table.put_item(Item=failure_record)
    print(f"Created failure record: {failure_record['failureId']} for session {session_id}, stage {stage}")
    
    return failure_record['failureId']

import uuid