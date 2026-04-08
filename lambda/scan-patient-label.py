"""
scan-patient-label.py

Scans a patient wristband or label image using Bedrock OCR and returns
the extracted patient details (name, MPEID, DOB) to auto-fill the
registration form. This reduces manual data entry during case registration.

The image is sent as base64 directly in the request body — no S3 upload
needed since this is a one-time read, not stored for validation.

Trigger: POST /scan-patient-label (API Gateway, Cognito authenticated)
"""

import json
import boto3
import base64
import os

bedrock_client = boto3.client('bedrock-runtime', region_name=os.environ.get('REGION', 'ap-south-1'))

# Default model used for registration scanning
DEFAULT_MODEL_ID = os.environ.get('DEFAULT_MODEL_ID', 'qwen.qwen3-vl-235b-a22b')


def lambda_handler(event, context):
    """
    Accepts a base64-encoded image and patient type (male/female),
    sends it to Bedrock for OCR, and returns the extracted fields.
    """
    try:
        body = json.loads(event['body'])
        image_base64 = body.get('image')
        patient_type = body.get('patient_type', 'male')  # 'male' or 'female'
        model_id = body.get('model_id', DEFAULT_MODEL_ID)

        if not image_base64:
            return {
                'statusCode': 400,
                'headers': {'Access-Control-Allow-Origin': '*'},
                'body': json.dumps({'error': 'Missing image data'})
            }

        # Decode the base64 image
        image_bytes = base64.b64decode(image_base64)

        # Build the prompt based on which patient we are scanning
        if patient_type == 'male':
            extraction_instruction = "Extract the MALE patient's information from this label or wristband."
        else:
            extraction_instruction = "Extract the FEMALE patient's information from this label or wristband."

        prompt = f"""You are reading a hospital patient label or wristband.
{extraction_instruction}

Return ONLY a JSON object with these fields:
{{
  "name": "first name only, uppercase",
  "last_name": "last name only, uppercase, or null if not found",
  "mpeid": "patient ID number, include ID- prefix if present",
  "dob": "date of birth in YYYY-MM-DD format, or null if not found"
}}

Rules:
- Return ONLY the JSON object, no explanation
- If a field cannot be read clearly, set it to null
- Names should be uppercase
- MPEID should include the ID- prefix if visible on the label
"""

        # Call Bedrock using the Converse API (works with Qwen and Claude models)
        response = bedrock_client.converse(
            modelId=model_id,
            messages=[
                {
                    'role': 'user',
                    'content': [
                        {
                            'image': {
                                'format': 'jpeg',
                                'source': {
                                    'bytes': image_bytes
                                }
                            }
                        },
                        {
                            'text': prompt
                        }
                    ]
                }
            ],
            inferenceConfig={
                'maxTokens': 200,
                'temperature': 0.1  # Low temperature for consistent extraction
            }
        )

        # Extract the text response from Bedrock
        response_text = response['output']['message']['content'][0]['text'].strip()

        # Parse the JSON from the response
        # Sometimes the model wraps it in markdown code blocks, so we clean that
        if '```' in response_text:
            response_text = response_text.split('```')[1]
            if response_text.startswith('json'):
                response_text = response_text[4:]

        extracted = json.loads(response_text.strip())

        return {
            'statusCode': 200,
            'headers': {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            },
            'body': json.dumps({
                'success': True,
                'extracted': extracted
            })
        }

    except json.JSONDecodeError as e:
        # Bedrock returned something that could not be parsed as JSON
        print(f"JSON parse error: {str(e)}, response was: {response_text if 'response_text' in locals() else 'N/A'}")
        return {
            'statusCode': 200,
            'headers': {'Access-Control-Allow-Origin': '*'},
            'body': json.dumps({
                'success': False,
                'error': 'Could not read label clearly. Please fill in manually.'
            })
        }

    except Exception as e:
        print(f"Error scanning label: {str(e)}")
        import traceback
        traceback.print_exc()
        return {
            'statusCode': 500,
            'headers': {'Access-Control-Allow-Origin': '*'},
            'body': json.dumps({'error': str(e)})
        }
