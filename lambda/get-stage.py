import json
import boto3
import os

dynamodb = boto3.resource('dynamodb')

STAGE_TABLE_MAP = {
    'label_validation':       os.environ.get('LABEL_VALIDATION_TABLE', 'IVF-LabelValidationExtractions'),
    'male_sample_collection': os.environ.get('MALE_SAMPLE_TABLE', 'IVF-MaleSampleCollectionExtractions'),
    'iui':                    os.environ.get('MALE_SAMPLE_TABLE', 'IVF-MaleSampleCollectionExtractions'),
    'oocyte_collection':      os.environ.get('OOCYTE_TABLE', 'IVF-OocyteCollectionExtractions'),
    'denudation':             os.environ.get('DENUDATION_TABLE', 'IVF-DenudationExtractions'),
    'icsi':                   os.environ.get('ICSI_TABLE', 'IVF-ICSIExtractions'),
    'culture':                os.environ.get('CULTURE_TABLE', 'IVF-CultureExtractions'),
    # New stages — reuse label validation table for female-patient validation stages
    'fertilization_check':    os.environ.get('LABEL_VALIDATION_TABLE', 'IVF-LabelValidationExtractions'),
    'icsi_documentation':     os.environ.get('LABEL_VALIDATION_TABLE', 'IVF-LabelValidationExtractions'),
    'blastocyst':             os.environ.get('LABEL_VALIDATION_TABLE', 'IVF-LabelValidationExtractions'),
    'day6':                   os.environ.get('LABEL_VALIDATION_TABLE', 'IVF-LabelValidationExtractions'),
    'day7':                   os.environ.get('LABEL_VALIDATION_TABLE', 'IVF-LabelValidationExtractions'),
}


# Map stage IDs to their S3 folder prefixes for filtering shared tables
STAGE_S3_PREFIX_MAP = {
    'label_validation':    'label-validation/',
    'fertilization_check': 'fertilization-check/',
    'icsi_documentation':  'icsi-documentation/',
    'blastocyst':          'blastocyst-stage/',
    'day6':                'day6/',
    'day7':                'day7/',
}

def lambda_handler(event, context):
    try:
        session_id = event['pathParameters']['sessionId']
        stage = event['pathParameters']['stage']

        if stage not in STAGE_TABLE_MAP:
            return {
                'statusCode': 400,
                'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                'body': json.dumps({'error': f'Invalid stage: {stage}'})
            }

        table = dynamodb.Table(STAGE_TABLE_MAP[stage])

        response = table.query(
            IndexName='SessionIdIndex',
            KeyConditionExpression='sessionId = :sid',
            ExpressionAttributeValues={':sid': session_id}
        )

        # Filter extractions by S3 path prefix when multiple stages share the same table
        items = response['Items']
        s3_prefix = STAGE_S3_PREFIX_MAP.get(stage)
        if s3_prefix:
            items = [
                item for item in items
                if item.get('s3_path', '').find(s3_prefix) != -1
            ]

        return {
            'statusCode': 200,
            'headers': {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            },
            'body': json.dumps({
                'stage': stage,
                'sessionId': session_id,
                'extractions': items
            }, default=str)
        }
    except Exception as e:
        print(f"Error: {str(e)}")
        return {
            'statusCode': 500,
            'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
            'body': json.dumps({'error': 'Internal server error'})
        }
