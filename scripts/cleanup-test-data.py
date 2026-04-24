#!/usr/bin/env python3
"""
Wipe all items from IVF DynamoDB tables.
Preserves table structure, indexes, streams — only deletes data rows.
"""
import boto3

REGION = 'ap-south-1'

TABLES = {
    'IVF-Cases': ['sessionId'],
    'IVF-AuditLog': ['auditId', 'timestamp'],
    'IVF-LabelValidationExtractions': ['extractionId'],
    'IVF-MaleSampleCollectionExtractions': ['extractionId'],
    'IVF-OocyteCollectionExtractions': ['extractionId'],
    'IVF-DenudationExtractions': ['extractionId'],
    'IVF-ICSIExtractions': ['extractionId'],
    'IVF-CultureExtractions': ['extractionId'],
    'IVF-InjectedOocyteImages': ['imageId'],
    'IVF-ValidationFailures': ['failureId'],
}

dynamodb = boto3.resource('dynamodb', region_name=REGION)

for table_name, key_attrs in TABLES.items():
    table = dynamodb.Table(table_name)
    print(f"\n--- {table_name} ---")
    # Use ExpressionAttributeNames for reserved words like 'timestamp'
    name_map = {f'#k{i}': k for i, k in enumerate(key_attrs)}
    proj = ', '.join(name_map.keys())
    scan_kwargs = {
        'ProjectionExpression': proj,
        'ExpressionAttributeNames': name_map,
    }
    deleted = 0
    while True:
        resp = table.scan(**scan_kwargs)
        items = resp.get('Items', [])
        if not items:
            break
        with table.batch_writer() as batch:
            for item in items:
                key = {k: item[k] for k in key_attrs}
                batch.delete_item(Key=key)
                deleted += 1
        if 'LastEvaluatedKey' not in resp:
            break
        scan_kwargs['ExclusiveStartKey'] = resp['LastEvaluatedKey']
    print(f"  Deleted {deleted} items")

print("\nAll DynamoDB tables cleaned.")
