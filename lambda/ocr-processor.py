import json
import boto3
import base64
import uuid
from datetime import datetime
try:
    from audit_helper import log_audit
except:
    log_audit = None
import os

s3_client = boto3.client('s3')
bedrock_client = boto3.client('bedrock-runtime')
dynamodb = boto3.resource('dynamodb')

STAGE_TABLE_MAP = {
    'label-validation': os.environ.get('LABEL_VALIDATION_TABLE', 'IVF-LabelValidationExtractions'),
    'oocyte-collection': os.environ.get('OOCYTE_TABLE', 'IVF-OocyteCollectionExtractions'),
    'denudation': os.environ.get('DENUDATION_TABLE', 'IVF-DenudationExtractions'),
    'male-sample-collection': os.environ.get('MALE_SAMPLE_TABLE', 'IVF-MaleSampleCollectionExtractions'),
    'icsi': os.environ.get('ICSI_TABLE', 'IVF-ICSIExtractions'),
    'culture': os.environ.get('CULTURE_TABLE', 'IVF-CultureExtractions'),
    'fertilization-check': os.environ.get('LABEL_VALIDATION_TABLE', 'IVF-LabelValidationExtractions'),
}

def extract_with_converse_api(image_bytes, stage, model_id, model_name, image_number=1):
    """
    Use Bedrock Converse API for models like Qwen that require it
    """
    # Stage-specific instructions for which patient data to extract
    if stage == 'label-validation':
        data_instruction = """
    This is a LABEL VALIDATION stage - you are validating pre-labeled dishes for the FEMALE patient.
    Extract the female patient's information and put it in the female_name and female_mpeid fields.
    Leave male_name and male_mpeid as null.
    """
    elif stage == 'male-sample-collection':
        # For male sample collection, we have TWO separate uploads:
        # - First upload (image_1): Male patient label
        # - Second upload (image_2): Female patient label
        # Each upload is processed independently
        data_instruction = """
    This is a SPERM PREPARATION stage - extract the MALE patient's information from this label.
    Put the data in male_name and male_mpeid fields.
    Leave female_name and female_mpeid as null.
    """
    elif stage == 'fertilization-check':
        data_instruction = """
    This is a FERTILIZATION CHECK stage - extract the FEMALE patient's information from this label.
    Put the data in female_name and female_mpeid fields.
    Leave male_name and male_mpeid as null.
    """
    elif stage == 'icsi':
        # ICSI stage requires extra careful digit recognition
        data_instruction = """
    This is an ICSI (Intracytoplasmic Sperm Injection) stage - extract the female patient's information.
    Put the data in female_name and female_mpeid fields.
    Leave male_name and male_mpeid as null.
    
    CRITICAL INSTRUCTIONS FOR THIS IMAGE:
    - This dish may have MULTIPLE LAYERS of labeling (inner dish and outer lid/rim)
    - Look for the label that includes the "ID-" prefix format
    - The label with "ID-" prefix is the AUTHORITATIVE source - prioritize reading from this label
    - Pay EXTRA attention to distinguishing similar handwritten digits:
      * "2" vs "4" - Look at the shape carefully: "2" has a curved bottom, "4" has straight lines
      * "2" typically has a loop at bottom, "4" has an open angle
      * When in doubt between "2" and "4", look at the overall context and writing style
    """
    else:
        # For oocyte-collection, denudation, culture - all female patient stages
        data_instruction = """
    This is a female patient procedure stage - extract the female patient's information.
    Put the data in female_name and female_mpeid fields.
    Leave male_name and male_mpeid as null.
    """
    
    # Additional digit recognition guidance for ICSI stage
    digit_guidance = ""
    if stage == 'icsi':
        digit_guidance = """
    
    DIGIT RECOGNITION GUIDANCE (CRITICAL FOR ACCURACY):
    When reading handwritten numbers, pay special attention to these commonly confused digits:
    - "2" has a curved bottom with a horizontal line at the base
    - "4" has straight lines forming an open triangle with a vertical line
    - "1" is a single vertical line, sometimes with a small hook at top
    - "7" has a horizontal top with a diagonal line down
    - Look at the ENTIRE number sequence for consistency in writing style
    - If multiple labels are visible, use the one with "ID-" prefix as the authoritative source
    """
    
    prompt = f"""
    Analyze this IVF laboratory {stage.replace('-', ' ')} dish/tube image.
    Extract patient identification information written on the label:
    
    Look for:
    - Patient Name(s) (may be handwritten or printed)
    - MPEID(s) (Medical Patient ID - typically in format "ID-" followed by numbers, like "ID-2569824")
    - Any dates if visible
    
    IMPORTANT: The ID prefix is "ID" (capital I and capital D), NOT "10" (one-zero).
    ONLY correct the 2-character prefix: if the label shows "10-" as the very first two characters before the dash, read it as "ID-".
    Do NOT modify any digits that come AFTER the "ID-" prefix — preserve them exactly as written on the label.
    Example: "10-102308917" on label = "ID-102308917" (only the prefix changes, the number 102308917 stays intact).
    {digit_guidance}
    
    {data_instruction}
    
    Return ONLY a JSON object with this exact structure:
    {{
      "male_name": "extracted name or null",
      "male_mpeid": "extracted ID or null",
      "female_name": "extracted name or null",
      "female_mpeid": "extracted ID or null"
    }}
    
    Rules:
    - Convert all names to UPPERCASE
    - For MPEIDs, use format "ID-" followed by numbers (e.g., "ID-2569824")
    - If the MPEID starts with "10-" (only the first two chars before the dash), replace with "ID-". Never remove digits after the prefix.
    - Remove any extra spaces
    - If information is not visible or unclear, use null
    - For ICSI stage: Prioritize the label with "ID-" prefix format
    """
    
    # Use Converse API
    response = bedrock_client.converse(
        modelId=model_id,
        messages=[{
            "role": "user",
            "content": [
                {
                    "image": {
                        "format": "jpeg",
                        "source": {
                            "bytes": image_bytes
                        }
                    }
                },
                {
                    "text": prompt
                }
            ]
        }],
        inferenceConfig={
            "maxTokens": 1000,
            "temperature": 0
        }
    )
    
    # Extract text from Converse API response
    extracted_text = response['output']['message']['content'][0]['text']
    
    # Capture token usage from response
    usage = response.get('usage', {})
    input_tokens = usage.get('inputTokens', 0)
    output_tokens = usage.get('outputTokens', 0)
    
    # Extract JSON from response
    if '```json' in extracted_text:
        extracted_text = extracted_text.split('```json')[1].split('```')[0].strip()
    elif '```' in extracted_text:
        extracted_text = extracted_text.split('```')[1].split('```')[0].strip()
    
    extracted_data = json.loads(extracted_text)
    
    # Add token usage to extracted data
    extracted_data['input_tokens'] = input_tokens
    extracted_data['output_tokens'] = output_tokens
    
    # Normalize names to uppercase
    if extracted_data.get('male_name'):
        extracted_data['male_name'] = normalize_name(extracted_data['male_name'])
    if extracted_data.get('female_name'):
        extracted_data['female_name'] = normalize_name(extracted_data['female_name'])
    
    # Fix common OCR mistakes in MPEIDs
    if extracted_data.get('male_mpeid'):
        extracted_data['male_mpeid'] = fix_ocr_mpeid(extracted_data['male_mpeid'])
    if extracted_data.get('female_mpeid'):
        extracted_data['female_mpeid'] = fix_ocr_mpeid(extracted_data['female_mpeid'])
    
    # Add metadata
    from decimal import Decimal
    extracted_data['confidence_score'] = Decimal('0.95')
    extracted_data['model_used'] = model_name
    extracted_data['model_id'] = model_id
    
    return extracted_data


def lambda_handler(event, context):
    """
    Process uploaded image with Bedrock OCR
    Triggered by EventBridge (S3 ObjectCreated event)
    """
    try:
        print(f"Received event: {json.dumps(event)}")
        
        # EventBridge wraps S3 events differently
        if 'detail' in event:
            # EventBridge format
            bucket = event['detail']['bucket']['name']
            key = event['detail']['object']['key']
        elif 'Records' in event:
            # Direct S3 event format
            s3_event = event['Records'][0]['s3']
            bucket = s3_event['bucket']['name']
            key = s3_event['object']['key']
        else:
            print(f"Unknown event format: {event}")
            return {'statusCode': 400, 'body': 'Invalid event format'}
        
        print(f"Processing image: s3://{bucket}/{key}")
        
        # Extract stage and session ID from key
        # Format: {stage}/{sessionId}/image_X_timestamp.jpg
        parts = key.split('/')
        stage_folder = parts[0]
        session_id = parts[1]
        
        if stage_folder not in STAGE_TABLE_MAP:
            print(f"Unknown stage folder: {stage_folder}")
            return
        
        # Get case details to retrieve model configuration
        cases_table = dynamodb.Table(os.environ.get('CASES_TABLE', 'IVF-Cases'))
        case_response = cases_table.get_item(Key={'sessionId': session_id})
        
        if 'Item' not in case_response:
            print(f"Case not found for session: {session_id}")
            return
        
        case = case_response['Item']
        model_config = case.get('model_config', {
            'model_id': 'anthropic.claude-sonnet-4-5-20250929-v1:0',
            'model_name': 'Claude Sonnet 4.5'
        })
        
        print(f"Using model: {model_config.get('model_name')} ({model_config.get('model_id')})")
        
        # Download image from S3
        response = s3_client.get_object(Bucket=bucket, Key=key)
        image_bytes = response['Body'].read()
        
        # Extract image number from key (format: image_X_timestamp.jpg)
        image_number = 1
        if 'image_' in key:
            try:
                image_number = int(key.split('image_')[1].split('_')[0])
            except:
                image_number = 1
        
        # Perform OCR using Bedrock with configured model
        extracted_data = extract_text_with_bedrock(image_bytes, stage_folder, model_config, image_number)
        
        # Store extraction result
        store_extraction_result(stage_folder, session_id, key, extracted_data)
        
        return {
            'statusCode': 200,
            'body': json.dumps({'message': 'OCR processing completed'})
        }
        
    except Exception as e:
        print(f"Error processing image: {str(e)}")
        raise

def extract_text_with_bedrock(image_bytes, stage, model_config, image_number=1):
    """
    Use Amazon Bedrock for OCR with configurable model
    Supports: Claude, Nova, Gemini, Mistral, Qwen, and other vision models
    """
    model_id = model_config.get('model_id', 'anthropic.claude-sonnet-4-5-20250929-v1:0')
    model_name = model_config.get('model_name', 'Claude Sonnet 4.5')
    
    # Qwen models use Converse API instead of InvokeModel
    if 'qwen' in model_id.lower():
        return extract_with_converse_api(image_bytes, stage, model_id, model_name, image_number)
    
    # Stage-specific instructions for which patient data to extract
    if stage == 'label-validation':
        data_instruction = """
    This is a LABEL VALIDATION stage - you are validating pre-labeled dishes for the FEMALE patient.
    Extract the female patient's information and put it in the female_name and female_mpeid fields.
    Leave male_name and male_mpeid as null.
    """
    elif stage == 'male-sample-collection':
        # For male sample collection, we have TWO separate uploads:
        # - First upload (image_1): Male patient label
        # - Second upload (image_2): Female patient label
        # Each upload is processed independently
        data_instruction = """
    This is a SPERM PREPARATION stage - extract the MALE patient's information from this label.
    Put the data in male_name and male_mpeid fields.
    Leave female_name and female_mpeid as null.
    """
    elif stage == 'fertilization-check':
        data_instruction = """
    This is a FERTILIZATION CHECK stage - extract the FEMALE patient's information from this label.
    Put the data in female_name and female_mpeid fields.
    Leave male_name and male_mpeid as null.
    """
    elif stage == 'icsi':
        # ICSI stage requires extra careful digit recognition
        data_instruction = """
    This is an ICSI (Intracytoplasmic Sperm Injection) stage - extract the female patient's information.
    Put the data in female_name and female_mpeid fields.
    Leave male_name and male_mpeid as null.
    
    CRITICAL INSTRUCTIONS FOR THIS IMAGE:
    - This dish may have MULTIPLE LAYERS of labeling (inner dish and outer lid/rim)
    - Look for the label that includes the "ID-" prefix format
    - The label with "ID-" prefix is the AUTHORITATIVE source - prioritize reading from this label
    - Pay EXTRA attention to distinguishing similar handwritten digits:
      * "2" vs "4" - Look at the shape carefully: "2" has a curved bottom, "4" has straight lines
      * "2" typically has a loop at bottom, "4" has an open angle
      * When in doubt between "2" and "4", look at the overall context and writing style
    """
    else:
        # For oocyte-collection, denudation, culture - all female patient stages
        data_instruction = """
    This is a female patient procedure stage - extract the female patient's information.
    Put the data in female_name and female_mpeid fields.
    Leave male_name and male_mpeid as null.
    """
    
    # Additional digit recognition guidance for ICSI stage
    digit_guidance = ""
    if stage == 'icsi':
        digit_guidance = """
    
    DIGIT RECOGNITION GUIDANCE (CRITICAL FOR ACCURACY):
    When reading handwritten numbers, pay special attention to these commonly confused digits:
    - "2" has a curved bottom with a horizontal line at the base
    - "4" has straight lines forming an open triangle with a vertical line
    - "1" is a single vertical line, sometimes with a small hook at top
    - "7" has a horizontal top with a diagonal line down
    - Look at the ENTIRE number sequence for consistency in writing style
    - If multiple labels are visible, use the one with "ID-" prefix as the authoritative source
    """
    
    prompt = f"""
    Analyze this IVF laboratory {stage.replace('-', ' ')} dish/tube image.
    Extract patient identification information written on the label:
    
    Look for:
    - Patient Name(s) (may be handwritten or printed)
    - MPEID(s) (Medical Patient ID - typically in format "ID-" followed by numbers, like "ID-2569824")
    - Any dates if visible
    
    IMPORTANT: The ID prefix is "ID" (capital I and capital D), NOT "10" (one-zero).
    ONLY correct the 2-character prefix: if the label shows "10-" as the very first two characters before the dash, read it as "ID-".
    Do NOT modify any digits that come AFTER the "ID-" prefix — preserve them exactly as written on the label.
    Example: "10-102308917" on label = "ID-102308917" (only the prefix changes, the number 102308917 stays intact).
    {digit_guidance}
    
    {data_instruction}
    
    Return ONLY a JSON object with this exact structure:
    {{
      "male_name": "extracted name or null",
      "male_mpeid": "extracted ID or null",
      "female_name": "extracted name or null",
      "female_mpeid": "extracted ID or null"
    }}
    
    Rules:
    - Convert all names to UPPERCASE
    - For MPEIDs, use format "ID-" followed by numbers (e.g., "ID-2569824")
    - If the MPEID starts with "10-" (only the first two chars before the dash), replace with "ID-". Never remove digits after the prefix.
    - Remove any extra spaces
    - If information is not visible or unclear, use null
    - For ICSI stage: Prioritize the label with "ID-" prefix format
    """
    
    # Encode image to base64
    image_base64 = base64.b64encode(image_bytes).decode('utf-8')
    
    # Prepare request body based on model type
    if 'anthropic.claude' in model_id or 'claude' in model_id.lower():
        # Claude models (Anthropic format)
        request_body = {
            "anthropic_version": "bedrock-2023-05-31",
            "max_tokens": 1000,
            "temperature": 0,
            "messages": [{
                "role": "user",
                "content": [
                    {
                        "type": "image",
                        "source": {
                            "type": "base64",
                            "media_type": "image/jpeg",
                            "data": image_base64
                        }
                    },
                    {
                        "type": "text",
                        "text": prompt
                    }
                ]
            }]
        }
    elif 'mistral' in model_id.lower():
        # Mistral models format
        request_body = {
            "messages": [{
                "role": "user",
                "content": [
                    {
                        "type": "image_url",
                        "image_url": f"data:image/jpeg;base64,{image_base64}"
                    },
                    {
                        "type": "text",
                        "text": prompt
                    }
                ]
            }],
            "max_tokens": 1000,
            "temperature": 0
        }
    elif 'nova' in model_id.lower():
        # Amazon Nova models
        request_body = {
            "messages": [{
                "role": "user",
                "content": [
                    {
                        "image": {
                            "format": "jpeg",
                            "source": {
                                "bytes": image_base64
                            }
                        }
                    },
                    {
                        "text": prompt
                    }
                ]
            }],
            "inferenceConfig": {
                "max_new_tokens": 1000,
                "temperature": 0
            }
        }
    elif 'gemini' in model_id.lower() or 'gemma' in model_id.lower():
        # Google Gemini/Gemma models
        request_body = {
            "contents": [{
                "role": "user",
                "parts": [
                    {
                        "inline_data": {
                            "mime_type": "image/jpeg",
                            "data": image_base64
                        }
                    },
                    {
                        "text": prompt
                    }
                ]
            }],
            "generation_config": {
                "max_output_tokens": 1000,
                "temperature": 0
            }
        }
    else:
        # Default to Claude format for unknown models
        request_body = {
            "anthropic_version": "bedrock-2023-05-31",
            "max_tokens": 1000,
            "temperature": 0,
            "messages": [{
                "role": "user",
                "content": [
                    {
                        "type": "image",
                        "source": {
                            "type": "base64",
                            "media_type": "image/jpeg",
                            "data": image_base64
                        }
                    },
                    {
                        "type": "text",
                        "text": prompt
                    }
                ]
            }]
        }
    
    # Call Bedrock with configured model
    # Some models require inference profiles in Mumbai region
    # Map model IDs to their inference profile IDs
    inference_profile_map = {
        # Claude 4.5 models
        'anthropic.claude-sonnet-4-5-20250929-v1:0': 'global.anthropic.claude-sonnet-4-5-20250929-v1:0',
        'anthropic.claude-opus-4-5-20251101-v1:0': 'global.anthropic.claude-opus-4-5-20251101-v1:0',
        'anthropic.claude-haiku-4-5-20251001-v1:0': 'global.anthropic.claude-haiku-4-5-20251001-v1:0',
        # Nova models
        'amazon.nova-pro-v1:0': 'apac.amazon.nova-pro-v1:0',
        'amazon.nova-lite-v1:0': 'apac.amazon.nova-lite-v1:0',
        'amazon.nova-2-lite-v1:0': 'global.amazon.nova-2-lite-v1:0',
        'amazon.nova-micro-v1:0': 'apac.amazon.nova-micro-v1:0',
        # Claude 3.x and 4 models (APAC profiles)
        'anthropic.claude-3-5-sonnet-20240620-v1:0': 'apac.anthropic.claude-3-5-sonnet-20240620-v1:0',
        'anthropic.claude-3-5-sonnet-20241022-v2:0': 'apac.anthropic.claude-3-5-sonnet-20241022-v2:0',
        'anthropic.claude-3-7-sonnet-20250219-v1:0': 'apac.anthropic.claude-3-7-sonnet-20250219-v1:0',
        'anthropic.claude-sonnet-4-20250514-v1:0': 'apac.anthropic.claude-sonnet-4-20250514-v1:0',
        'anthropic.claude-3-sonnet-20240229-v1:0': 'apac.anthropic.claude-3-sonnet-20240229-v1:0',
        'anthropic.claude-3-haiku-20240307-v1:0': 'apac.anthropic.claude-3-haiku-20240307-v1:0',
    }
    
    # Use inference profile if available, otherwise use direct model ID
    model_id_to_use = inference_profile_map.get(model_id, model_id)
    
    response = bedrock_client.invoke_model(
        modelId=model_id_to_use,
        contentType='application/json',
        accept='application/json',
        body=json.dumps(request_body)
    )
    
    # Parse response based on model type
    response_body = json.loads(response['body'].read())
    
    # Extract token usage (different formats for different models)
    input_tokens = 0
    output_tokens = 0
    
    if 'usage' in response_body:
        # Claude, Nova, and most models use 'usage' field
        usage = response_body['usage']
        input_tokens = usage.get('input_tokens', usage.get('inputTokens', 0))
        output_tokens = usage.get('output_tokens', usage.get('outputTokens', 0))
    elif 'metadata' in response_body and 'usage' in response_body['metadata']:
        # Some models nest usage in metadata
        usage = response_body['metadata']['usage']
        input_tokens = usage.get('input_tokens', usage.get('inputTokens', 0))
        output_tokens = usage.get('output_tokens', usage.get('outputTokens', 0))
    
    if 'anthropic.claude' in model_id or 'claude' in model_id.lower():
        extracted_text = response_body['content'][0]['text']
    elif 'mistral' in model_id.lower():
        # Mistral response format
        extracted_text = response_body['choices'][0]['message']['content']
    elif 'qwen' in model_id.lower():
        # Qwen response format (similar to Mistral)
        extracted_text = response_body['choices'][0]['message']['content']
    elif 'nova' in model_id.lower():
        extracted_text = response_body['output']['message']['content'][0]['text']
    elif 'gemini' in model_id.lower() or 'gemma' in model_id.lower():
        extracted_text = response_body['candidates'][0]['content']['parts'][0]['text']
    else:
        # Try to extract text from common response formats
        if 'content' in response_body:
            extracted_text = response_body['content'][0]['text']
        elif 'choices' in response_body:
            extracted_text = response_body['choices'][0]['message']['content']
        elif 'output' in response_body:
            extracted_text = response_body['output']['message']['content'][0]['text']
        else:
            extracted_text = str(response_body)
    
    # Extract JSON from response
    # Claude may wrap JSON in markdown code blocks
    if '```json' in extracted_text:
        extracted_text = extracted_text.split('```json')[1].split('```')[0].strip()
    elif '```' in extracted_text:
        extracted_text = extracted_text.split('```')[1].split('```')[0].strip()
    
    extracted_data = json.loads(extracted_text)
    
    # Add token usage to extracted data
    extracted_data['input_tokens'] = input_tokens
    extracted_data['output_tokens'] = output_tokens
    
    # Normalize names to uppercase
    if extracted_data.get('male_name'):
        extracted_data['male_name'] = normalize_name(extracted_data['male_name'])
    if extracted_data.get('female_name'):
        extracted_data['female_name'] = normalize_name(extracted_data['female_name'])
    
    # Fix common OCR mistakes in MPEIDs before storing
    if extracted_data.get('male_mpeid'):
        extracted_data['male_mpeid'] = fix_ocr_mpeid(extracted_data['male_mpeid'])
    if extracted_data.get('female_mpeid'):
        extracted_data['female_mpeid'] = fix_ocr_mpeid(extracted_data['female_mpeid'])
    
    # Add metadata (convert floats to Decimal for DynamoDB)
    from decimal import Decimal
    extracted_data['confidence_score'] = Decimal('0.95')  # Placeholder
    extracted_data['model_used'] = model_name
    extracted_data['model_id'] = model_id
    
    return extracted_data

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
        return name
    
    # Convert to uppercase and strip extra spaces
    normalized = str(name).upper().strip()
    
    # Remove multiple spaces between words
    normalized = ' '.join(normalized.split())
    
    return normalized

def fix_ocr_mpeid(mpeid):
    """
    Fix common OCR mistakes in MPEID extraction
    Handles case variations and OCR errors:
    - "10-35697344" -> "ID-35697344"
    - "id-35697344" -> "ID-35697344"
    - "Id-35697344" -> "ID-35697344"
    - "iD-35697344" -> "ID-35697344"
    - "I0-35697344" -> "ID-35697344"
    - "1D-35697344" -> "ID-35697344"
    """
    if not mpeid:
        return mpeid
    
    mpeid_str = str(mpeid).strip()
    
    # First, handle case variations (id, Id, iD, etc.)
    # Check if it starts with any case variation of "ID-"
    if len(mpeid_str) >= 3 and mpeid_str[2] == '-':
        prefix = mpeid_str[:2].upper()
        # If the prefix is now "ID", normalize it
        if prefix == 'ID':
            return 'ID-' + mpeid_str[3:]
    
    # Now handle OCR mistakes (after case normalization)
    mpeid_upper = mpeid_str.upper()
    
    # Common OCR mistakes for "ID-"
    ocr_corrections = [
        ('10-', 'ID-'),  # Most common: 10 instead of ID
        ('I0-', 'ID-'),  # I0 instead of ID (zero instead of D)
        ('1D-', 'ID-'),  # 1D instead of ID (one instead of I)
        ('1O-', 'ID-'),  # 1O instead of ID (one and capital O)
        ('IO-', 'ID-'),  # IO instead of ID (capital I and O)
        ('lD-', 'ID-'),  # lD instead of ID (lowercase L)
        ('l0-', 'ID-'),  # l0 instead of ID (lowercase L and zero)
        ('1l-', 'ID-'),  # 1l instead of ID
        ('Il-', 'ID-'),  # Il instead of ID
        ('|D-', 'ID-'),  # |D instead of ID (pipe character)
        ('|0-', 'ID-'),  # |0 instead of ID
    ]
    
    # Apply corrections
    for mistake, correction in ocr_corrections:
        if mpeid_upper.startswith(mistake):
            return correction + mpeid_str[len(mistake):]
    
    # If already starts with ID-, ensure it's uppercase
    if mpeid_upper.startswith('ID-'):
        return 'ID-' + mpeid_str[3:]
    
    return mpeid_str

def store_extraction_result(stage_folder, session_id, s3_key, extracted_data):
    """
    Store extraction result in stage-specific DynamoDB table
    """
    table_name = STAGE_TABLE_MAP[stage_folder]
    table = dynamodb.Table(table_name)
    
    extraction_record = {
        'extractionId': str(uuid.uuid4()),
        'sessionId': session_id,
        's3_path': f"s3://{os.environ.get('BUCKET_NAME', 'c9-ivf-witness-capture-artifacts')}/{s3_key}",
        'image_number': int(s3_key.split('image_')[1].split('_')[0]) if 'image_' in s3_key else 1,
        'extracted_data': extracted_data,
        'extraction_status': 'extracted',
        'bedrock_model': extracted_data.get('model_used', 'unknown'),
        'confidence_score': extracted_data.get('confidence_score', 0),
        'extracted_at': datetime.utcnow().isoformat(),
        # Add top-level fields for validator to access
        'male_name': extracted_data.get('male_name'),
        'male_mpeid': extracted_data.get('male_mpeid'),
        'female_name': extracted_data.get('female_name'),
        'female_mpeid': extracted_data.get('female_mpeid'),
        'raw_text': extracted_data.get('raw_text'),
        # Add token usage fields
        'input_tokens': extracted_data.get('input_tokens', 0),
        'output_tokens': extracted_data.get('output_tokens', 0)
    }
    
    table.put_item(Item=extraction_record)
    print(f"Stored extraction result: {extraction_record['extractionId']} (Tokens: {extraction_record['input_tokens']} in, {extraction_record['output_tokens']} out)")
    
    # Audit log
    if log_audit:
        log_audit(
            user_info={'userId': 'system', 'userEmail': 'system', 'userName': 'AI OCR', 'userRole': 'system'},
            action='OCR_EXTRACT',
            resource_type='extraction',
            resource_id=extraction_record['extractionId'],
            session_id=session_id,
            stage=stage_folder.replace('-', '_'),
            result='success',
            metadata={
                'message': f'OCR extraction completed for {stage_folder}',
                'model': extracted_data.get('model_used', 'unknown'),
                'input_tokens': int(extracted_data.get('input_tokens', 0)),
                'output_tokens': int(extracted_data.get('output_tokens', 0)),
            }
        )

