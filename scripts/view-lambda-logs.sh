#!/bin/bash
# view-lambda-logs.sh
#
# Tails the CloudWatch logs for a Lambda function.
# Usage: bash view-lambda-logs.sh <FunctionName> [minutes]
# Example: bash view-lambda-logs.sh IVF-ComparisonValidator 30

FUNCTION_NAME=$1
MINUTES=${2:-10}
REGION="ap-south-1"

if [ -z "$FUNCTION_NAME" ]; then
  echo "Usage: bash view-lambda-logs.sh <FunctionName> [minutes-ago]"
  exit 1
fi

echo "Showing logs for $FUNCTION_NAME from the last $MINUTES minutes..."
aws logs tail "/aws/lambda/$FUNCTION_NAME" \
  --region "$REGION" \
  --since "${MINUTES}m"
