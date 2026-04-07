import json
import boto3
import os
from PIL import Image, ImageDraw, ImageFont
from io import BytesIO
from datetime import datetime
import uuid

s3_client = boto3.client('s3')
dynamodb = boto3.resource('dynamodb')

cases_table = dynamodb.Table(os.environ.get('CASES_TABLE', 'IVF-Cases'))
images_table = dynamodb.Table(os.environ.get('IMAGES_TABLE', 'IVF-InjectedOocyteImages'))

def lambda_handler(event, context):
    """
    Annotate injected oocyte images with patient information
    Triggered by S3 ObjectCreated event for icsi-injected-original folder
    """
    try:
        print(f"Received event: {json.dumps(event)}")
        
        # Extract S3 details from event
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
        
        # Extract session ID from key
        # Format: icsi-injected-original/{sessionId}/image_{n}_{timestamp}.jpg
        parts = key.split('/')
        if len(parts) < 3 or parts[0] != 'icsi-injected-original':
            print(f"Invalid key format: {key}")
            return {'statusCode': 400, 'body': 'Invalid key format'}
        
        session_id = parts[1]
        filename = parts[2]
        
        # Extract image number from filename
        try:
            image_number = int(filename.split('_')[1])
        except:
            image_number = 1
        
        # Get case details
        case_response = cases_table.get_item(Key={'sessionId': session_id})
        if 'Item' not in case_response:
            print(f"Case not found for session: {session_id}")
            return {'statusCode': 404, 'body': 'Case not found'}
        
        case = case_response['Item']
        
        # Download original image from S3
        print(f"Downloading original image from S3")
        response = s3_client.get_object(Bucket=bucket, Key=key)
        image_bytes = response['Body'].read()
        
        # Annotate image
        print(f"Annotating image with patient information")
        annotated_image_bytes = annotate_image(
            image_bytes,
            case['male_patient'],
            case['female_patient']
        )
        
        # Upload annotated image to S3
        annotated_key = key.replace('icsi-injected-original', 'icsi-injected-annotated')
        print(f"Uploading annotated image to: s3://{bucket}/{annotated_key}")
        
        s3_client.put_object(
            Bucket=bucket,
            Key=annotated_key,
            Body=annotated_image_bytes,
            ContentType='image/jpeg',
            ServerSideEncryption='AES256'
        )
        
        # Store metadata in DynamoDB
        image_record = {
            'imageId': str(uuid.uuid4()),
            'sessionId': session_id,
            'oocyte_number': image_number,
            'original_s3_path': f's3://{bucket}/{key}',
            'annotated_s3_path': f's3://{bucket}/{annotated_key}',
            'male_patient': {
                'name': case['male_patient']['name'],
                'mpeid': case['male_patient']['mpeid']
            },
            'female_patient': {
                'name': case['female_patient']['name'],
                'mpeid': case['female_patient']['mpeid']
            },
            'captured_at': datetime.utcnow().isoformat(),
            'annotation_status': 'completed',
            'download_count': 0
        }
        
        images_table.put_item(Item=image_record)
        print(f"Stored metadata: {image_record['imageId']}")
        
        return {
            'statusCode': 200,
            'body': json.dumps({
                'message': 'Image annotated successfully',
                'imageId': image_record['imageId'],
                'annotated_s3_path': image_record['annotated_s3_path']
            })
        }
        
    except Exception as e:
        print(f"Error annotating image: {str(e)}")
        import traceback
        traceback.print_exc()
        raise

def annotate_image(image_bytes, male_patient, female_patient):
    """
    Overlay patient information on the image
    """
    # Open image
    image = Image.open(BytesIO(image_bytes))
    
    # Convert to RGB if necessary
    if image.mode != 'RGB':
        image = image.convert('RGB')
    
    # Get image dimensions
    width, height = image.size
    
    # Create drawing context
    draw = ImageDraw.Draw(image, 'RGBA')
    
    # Prepare text
    current_date = datetime.utcnow().strftime('%Y-%m-%d')
    text_lines = [
        f"Male: {male_patient['name']} ({male_patient['mpeid']})",
        f"Female: {female_patient['name']} ({female_patient['mpeid']})",
        f"Date: {current_date}"
    ]
    
    # Calculate font size based on image dimensions (10-12pt equivalent)
    # For typical microscope images (1024x768 or higher), use 14-16px
    font_size = max(12, min(16, int(height * 0.02)))
    
    try:
        # Try to load a professional font
        # DejaVu Sans is available in Lambda by default
        font = ImageFont.truetype("/usr/share/fonts/dejavu/DejaVuSans.ttf", font_size)
    except:
        # Fallback to default font
        font = ImageFont.load_default()
    
    # Calculate text dimensions
    line_height = font_size + 4
    padding = 8
    max_text_width = 0
    
    for line in text_lines:
        bbox = draw.textbbox((0, 0), line, font=font)
        text_width = bbox[2] - bbox[0]
        max_text_width = max(max_text_width, text_width)
    
    box_width = max_text_width + (padding * 2)
    box_height = (line_height * len(text_lines)) + (padding * 2)
    
    # Position at bottom-right corner
    box_x = width - box_width - 10
    box_y = height - box_height - 10
    
    # Draw semi-transparent black rectangle
    draw.rectangle(
        [(box_x, box_y), (box_x + box_width, box_y + box_height)],
        fill=(0, 0, 0, 180)
    )
    
    # Draw white text
    text_y = box_y + padding
    for line in text_lines:
        draw.text(
            (box_x + padding, text_y),
            line,
            fill=(255, 255, 255, 255),
            font=font
        )
        text_y += line_height
    
    # Save to bytes
    output = BytesIO()
    image.save(output, format='JPEG', quality=95)
    output.seek(0)
    
    return output.read()
