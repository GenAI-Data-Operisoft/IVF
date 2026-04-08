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
import io

bedrock_client = boto3.client('bedrock-runtime', region_name=os.environ.get('REGION', 'ap-south-1'))

DEFAULT_MODEL_ID = os.environ.get('DEFAULT_MODEL_ID', 'qwen.qwen3-vl-235b-a22b')


def normalize_image_to_jpeg(image_bytes):
    """
    Converts any image format to JPEG bytes using Pillow.
    Qwen via Bedrock Converse API requires a valid JPEG or PNG.
    """
    try:
        from PIL import Image
        img = Image.open(io.BytesIO(image_bytes))
        # Convert to RGB (removes alpha channel if PNG with transparency)
        if img.mode in ('RGBA', 'P', 'LA'):
            img = img.convert('RGB')
        output = io.BytesIO()
        img.save(output, format='JPEG', quality=85)
        return output.getvalue()
    except Exception as e:
        print(f"Image conversion warning: {str(e)} — using original bytes")
        return image_bytes


def lambda_handler(event, context):
    """
    Accepts a base64-encoded image and patient type (male/female),
    sends it to Bedrock for OCR, and returns the extracted fields.
    """
    # Handle CORS preflight request sent by the browser before the actual POST
    if event.get('httpMethod') == 'OPTIONS':
        return {
            'statusCode': 200,
            'headers': {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Headers': 'Content-Type,Authorization',
                'Access-Control-Allow-Methods': 'POST,OPTIONS'
            },
            'body': ''
        }

    try:
        print(f"Event keys: {list(event.keys())}")

        # Handle both API Gateway (body as string) and direct invocation (body as dict)
        raw_body = event.get('body', event)
        if isinstance(raw_body, str):
            body = json.loads(raw_body)
        elif isinstance(raw_body, dict):
            body = raw_body
        else:
            body = event

        print(f"Patient type: {body.get('patient_type')}, model: {body.get('model_id')}")

        image_base64 = body.get('image')
        patient_type = body.get('patient_type', 'male')
        model_id = body.get('model_id', DEFAULT_MODEL_ID)

        if not image_base64:
            return {
                'statusCode': 400,
                'headers': {'Access-Control-Allow-Origin': '*'},
                'body': json.dumps({'error': 'Missing image data'})
            }

        print(f"Image base64 length: {len(image_base64)}")

        # Decode base64 and normalize to JPEG
        raw_bytes = base64.b64decode(image_base64)
        print(f"Decoded image size: {len(raw_bytes)} bytes")
        image_bytes = normalize_image_to_jpeg(raw_bytes)
        print(f"Normalized image size: {len(image_bytes)} bytes")

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
- If you see "10-" followed by numbers, it is actually "ID-" (common OCR mistake)
"""

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
                'temperature': 0.1
            }
        )

        response_text = response['output']['message']['content'][0]['text'].strip()

        # Strip markdown code blocks if the model wrapped the JSON
        if '```' in response_text:
            parts = response_text.split('```')
            for part in parts:
                part = part.strip()
                if part.startswith('json'):
                    part = part[4:].strip()
                if part.startswith('{'):
                    response_text = part
                    break

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
        print(f"JSON parse error: {str(e)}")
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


