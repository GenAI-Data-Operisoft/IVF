#!/bin/bash
# deploy-lambda.sh
#
# Packages a single Lambda function and deploys it to AWS.
# Usage: bash deploy-lambda.sh <function-file.py> <LambdaFunctionName>
# Example: bash deploy-lambda.sh ../lambda/comparison-validator.py IVF-ComparisonValidator

set -e

LAMBDA_FILE=$1
FUNCTION_NAME=$2
REGION="ap-south-1"

if [ -z "$LAMBDA_FILE" ] || [ -z "$FUNCTION_NAME" ]; then
  echo "Usage: bash deploy-lambda.sh <lambda-file.py> <FunctionName>"
  exit 1
fi

# Get the base filename without path or extension to use as the handler module name
BASE_NAME=$(basename "$LAMBDA_FILE" .py)
HANDLER="${BASE_NAME}.lambda_handler"
ZIP_FILE="/tmp/${BASE_NAME}.zip"

echo "Packaging $LAMBDA_FILE..."
zip -j "$ZIP_FILE" "$LAMBDA_FILE"

echo "Deploying to $FUNCTION_NAME..."
aws lambda update-function-code \
  --function-name "$FUNCTION_NAME" \
  --zip-file "fileb://${ZIP_FILE}" \
  --region "$REGION" \
  --query 'LastModified' \
  --output text

echo "Updating handler to $HANDLER..."
aws lambda update-function-configuration \
  --function-name "$FUNCTION_NAME" \
  --handler "$HANDLER" \
  --region "$REGION" \
  --query 'Handler' \
  --output text

echo "Done. $FUNCTION_NAME updated."
