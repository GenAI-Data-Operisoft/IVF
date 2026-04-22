import json
import boto3
import os

dynamodb = boto3.resource('dynamodb')

STAGE_TABLE_MAP = {
    'label_validation':       os.environ.get('LABEL_VALIDATION_TABLE', 'IVF-LabelValidationExtractions'),
    'male_sample_collection': os.environ.get('MALE_SAMPLE_TABLE', 'IVF-MaleSampleCollectionExtractions'),
    'oocyte_collection':      os.environ.get('OOCYTE_TABLE', 'IVF-OocyteCollectionExtractions'),
    'denudation':             os.environ.get('DENUDATION_TABLE', 'IVF-DenudationExtractions'),
    'icsi':                   os.environ.get('ICSI_TABLE', 'IVF-ICSIExtractions'),
    'culture':                os.environ.get('CULTURE_TABLE', 'IVF-CultureExtractions'),
    # New stages — reuse label validation table for female-patient validation stages
    'fertilization_check':    os.environ.get('LABEL_VALIDATION_TABLE', 'IVF-LabelValidationExtractions'),
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

        return {
            'statusCode': 200,
            'headers': {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            },
            'body': json.dumps({
                'stage': stage,
                'sessionId': session_id,
                'extractions': response['Items']
            }, default=str)
        }
    except Exception as e:
        print(f"Error: {str(e)}")
        return {
            'statusCode': 500,
            'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
            'body': json.dumps({'error': 'Internal server error'})
        }
