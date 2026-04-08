#!/bin/bash
# test-lambda.sh
#
# Invokes a Lambda function directly with a test payload and prints the response.
# Useful for quickly testing a Lambda without going through API Gateway.
# Usage: bash test-lambda.sh <FunctionName> '<json-payload>'
# Example: bash test-lambda.sh IVF-UserManagement '{"httpMethod":"GET","path":"/users"}'

set -e

FUNCTION_NAME=$1
PAYLOAD=$2
REGION="ap-south-1"
OUTPUT_FILE="/tmp/lambda-test-output.json"

if [ -z "$FUNCTION_NAME" ] || [ -z "$PAYLOAD" ]; then
  echo "Usage: bash test-lambda.sh <FunctionName> '<json-payload>'"
  exit 1
fi

echo "$PAYLOAD" > /tmp/lambda-test-payload.json

aws lambda invoke \
  --function-name "$FUNCTION_NAME" \
  --region "$REGION" \
  --cli-binary-format raw-in-base64-out \
  --payload file:///tmp/lambda-test-payload.json \
  "$OUTPUT_FILE" 2>&1

echo "Response:"
python3 -c "
import json
with open('$OUTPUT_FILE') as f:
    d = json.load(f)
print('Status:', d.get('statusCode'))
body = d.get('body', '{}')
try:
    body = json.loads(body)
    print(json.dumps(body, indent=2))
except:
    print(body)
"
