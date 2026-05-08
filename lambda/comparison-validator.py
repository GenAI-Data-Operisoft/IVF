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
    'male_sample_collection': ['male_name', 'male_mpeid'],
    'iui': ['male_name', 'male_mpeid'],  # image_1=male, image_2=female (handled dynamically)
    'icsi': ['female_name', 'female_mpeid'],
    'culture': ['female_name', 'female_mpeid'],
    'fertilization_check': ['female_name', 'female_mpeid'],
    'icsi_documentation': ['female_name', 'female_mpeid'],
    'blastocyst': ['female_name', 'female_mpeid'],
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
                
                # For fertilization_check, the ARN maps to label_validation table
                # Distinguish by checking the s3_path field
                if 's3_path' in new_image:
                    s3_path = new_image['s3_path']['S']
                    if stage == 'label_validation':
                        if 'fertilization-check/' in s3_path:
                            stage = 'fertilization_check'
                        elif 'icsi-documentation/' in s3_path:
                            stage = 'icsi_documentation'
                        elif 'blastocyst-stage/' in s3_path:
                            stage = 'blastocyst'
                    elif stage == 'male_sample_collection':
                        # IUI also uses the same table — distinguish by s3_path prefix
                        if 'iui/' in s3_path:
                            stage = 'iui'
                
                # Get extracted data
                extracted_data = parse_dynamodb_map(new_image['extracted_data']['M'])
                
                # For male_sample_collection, validate each image independently (male patient only)
                # No need to wait for both images
                if stage == 'male_sample_collection':
                    # Each image validates male patient details independently
                    # image_number 1 = Collection Container, image_number 2 = Process Sperm Sample
                    pass  # extracted_data already has male_name/male_mpeid from OCR
                
                # For IUI: image_1 = male patient, image_2 = female patient
                iui_fields_override = None
                if stage == 'iui':
                    image_number = int(new_image.get('image_number', {}).get('N', '1'))
                    if image_number == 2:
                        iui_fields_override = ['female_name', 'female_mpeid']
                    else:
                        iui_fields_override = ['male_name', 'male_mpeid']
                
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
                    validation_result = validate_extraction(extracted_data, case, stage, fields_override=iui_fields_override)
                    print(f"Validation result: {validation_result}")
                except Exception as val_error:
                    print(f"ERROR during validation: {str(val_error)}")
                    raise
                
                # Update extraction record with validation result
                print(f"Updating extraction records with validation result")
                try:
                    update_extraction_validation(source_arn, extraction_id, validation_result)
                    print(f"Updated extraction record: {extraction_id}")
                except Exception as update_error:
                    print(f"ERROR updating extraction records: {str(update_error)}")
                    raise
                
                # Update case record
                print(f"Updating case record for session: {session_id}")
                try:
                    # Get tokens from current extraction
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

def validate_extraction(extracted, case, stage, fields_override=None):
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
    
    fields_to_check = fields_override if fields_override else STAGE_VALIDATION_RULES.get(stage, [])
    
    # Check if donor is involved — adjust validation targets
    male_type = case.get('male_patient', {}).get('type', 'self')
    female_type = case.get('female_patient', {}).get('type', 'self')
    
    for field in fields_to_check:
        patient_type, field_name = field.split('_', 1)
        
        extracted_value = extracted.get(field)
        
        # Determine registered value based on donor status
        if patient_type == 'male' and male_type == 'donor':
            # Male donor: petri dish has donor_id, validate against that
            if field_name == 'mpeid':
                registered_value = case['male_patient'].get('donor_id', '')
            else:
                # Skip name validation for male donor (no name on petri dish)
                continue
        elif patient_type == 'female' and female_type == 'donor':
            # Female donor: petri dish has donor_name + donor_mpeid
            if field_name == 'name':
                registered_value = case['female_patient'].get('donor_name', '')
            elif field_name == 'mpeid':
                registered_value = case['female_patient'].get('donor_mpeid', '')
            else:
                registered_value = case[f'{patient_type}_patient'].get(field_name)
        else:
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
        else:
            # Also include matched fields so frontend can show them
            if 'matches' not in validation_result:
                validation_result['matches'] = []
            validation_result['matches'].append({
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
    Normalize MPEID by stripping any prefix and returning only the numeric part.
    This avoids OCR confusion between "ID-" and "10-".
    - "ID-35697344" -> "35697344"
    - "10-35697344" -> "35697344"
    - "35697344" -> "35697344"
    - "id-35697344" -> "35697344"
    - "I0-35697344" -> "35697344"
    - "1D-35697344" -> "35697344"
    """
    if not mpeid:
        return None
    
    mpeid = str(mpeid).upper().strip()
    
    # Common OCR prefixes to strip (ID-, 10-, I0-, 1D-, etc.)
    prefixes_to_strip = ['ID-', '10-', 'I0-', '1D-', '1O-', 'IO-', 'LD-', 'L0-']
    
    for prefix in prefixes_to_strip:
        if mpeid.startswith(prefix):
            mpeid = mpeid[len(prefix):]
            break
    
    # Strip any remaining non-digit characters
    digits_only = ''.join(c for c in mpeid if c.isdigit())
    
    return digits_only if digits_only else mpeid
    
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
    # First ensure the stage key exists (for optional stages like iui added after case creation)
    try:
        cases_table.update_item(
            Key={'sessionId': session_id},
            UpdateExpression='SET stages.#stage = if_not_exists(stages.#stage, :empty)',
            ExpressionAttributeNames={'#stage': stage},
            ExpressionAttributeValues={':empty': {'status': 'pending', 'images_required': 2, 'images_uploaded': 0}}
        )
    except Exception:
        pass  # Stage already exists, continue

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
    stage = stage_map.get(table_name, 'unknown')
    # fertilization_check shares the label_validation table — distinguish by s3 key prefix in event
    # The stage is already resolved correctly via the extraction record's s3_path
    return stage

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