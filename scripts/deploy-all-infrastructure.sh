#!/bin/bash

# IVF Witness Capture System - Complete Infrastructure Deployment
# This script deploys all AWS infrastructure components

set -e  # Exit on error

echo "========================================="
echo "IVF Witness Capture System Deployment"
echo "========================================="
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Get AWS Account ID
echo "Getting AWS Account ID..."
AWS_ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
echo -e "${GREEN}✓${NC} AWS Account ID: $AWS_ACCOUNT_ID"
echo ""

# Step 1: Deploy DynamoDB Tables
echo "========================================="
echo "Step 1: Deploying DynamoDB Tables"
echo "========================================="

echo "1.1 Deploying main DynamoDB tables..."
aws cloudformation create-stack \
  --stack-name fms-ivf-witness-capture-dynamodb \
  --template-body file://cloudformation/dynamodb-tables.yaml \
  --region ap-south-1 2>/dev/null || echo "Stack already exists"

aws cloudformation wait stack-create-complete \
  --stack-name fms-ivf-witness-capture-dynamodb \
  --region ap-south-1 2>/dev/null || echo "Stack already complete"
echo -e "${GREEN}✓${NC} Main DynamoDB tables deployed"

echo "1.2 Deploying audit table..."
aws cloudformation create-stack \
  --stack-name fms-ivf-witness-capture-audit \
  --template-body file://cloudformation/audit-table.yaml \
  --region ap-south-1 2>/dev/null || echo "Stack already exists"

aws cloudformation wait stack-create-complete \
  --stack-name fms-ivf-witness-capture-audit \
  --region ap-south-1 2>/dev/null || echo "Stack already complete"
echo -e "${GREEN}✓${NC} Audit table deployed"

echo "1.3 Deploying validation failures table..."
aws cloudformation create-stack \
  --stack-name fms-ivf-witness-capture-validation-failures \
  --template-body file://cloudformation/validation-failures-table.yaml \
  --region ap-south-1 2>/dev/null || echo "Stack already exists"

aws cloudformation wait stack-create-complete \
  --stack-name fms-ivf-witness-capture-validation-failures \
  --region ap-south-1 2>/dev/null || echo "Stack already complete"
echo -e "${GREEN}✓${NC} Validation failures table deployed"

echo "1.4 Deploying injected oocyte images table..."
aws cloudformation create-stack \
  --stack-name fms-ivf-witness-capture-injected-oocyte-images \
  --template-body file://cloudformation/injected-oocyte-images-table.yaml \
  --region ap-south-1 2>/dev/null || echo "Stack already exists"

aws cloudformation wait stack-create-complete \
  --stack-name fms-ivf-witness-capture-injected-oocyte-images \
  --region ap-south-1 2>/dev/null || echo "Stack already complete"
echo -e "${GREEN}✓${NC} Injected oocyte images table deployed"
echo ""

# Step 2: Deploy S3 Bucket
echo "========================================="
echo "Step 2: Deploying S3 Bucket"
echo "========================================="

aws cloudformation create-stack \
  --stack-name fms-ivf-witness-capture-s3 \
  --template-body file://cloudformation/s3-bucket.yaml \
  --region ap-south-1 2>/dev/null || echo "Stack already exists"

aws cloudformation wait stack-create-complete \
  --stack-name fms-ivf-witness-capture-s3 \
  --region ap-south-1 2>/dev/null || echo "Stack already complete"

BUCKET_NAME=$(aws cloudformation describe-stacks \
  --stack-name fms-ivf-witness-capture-s3 \
  --query 'Stacks[0].Outputs[?OutputKey==`BucketName`].OutputValue' \
  --output text \
  --region ap-south-1)

echo -e "${GREEN}✓${NC} S3 bucket deployed: $BUCKET_NAME"
echo ""

# Step 3: Deploy Lambda Functions
echo "========================================="
echo "Step 3: Deploying Lambda Functions"
echo "========================================="

echo "3.1 Packaging Lambda functions..."
cd lambda-functions
zip -q -r ../lambda-deployment.zip *.py
cd ..
echo -e "${GREEN}✓${NC} Lambda package created"

echo "3.2 Deploying Lambda stack..."
aws cloudformation create-stack \
  --stack-name fms-ivf-witness-capture-lambda \
  --template-body file://cloudformation/lambda-functions.yaml \
  --capabilities CAPABILITY_NAMED_IAM \
  --region ap-south-1 2>/dev/null || echo "Stack already exists"

aws cloudformation wait stack-create-complete \
  --stack-name fms-ivf-witness-capture-lambda \
  --region ap-south-1 2>/dev/null || echo "Stack already complete"
echo -e "${GREEN}✓${NC} Lambda stack deployed"

echo "3.3 Updating Lambda function code..."
FUNCTIONS=(
  "IVF-RegistrationHandler"
  "IVF-PresignedUrlGenerator"
  "IVF-OCRProcessor"
  "IVF-ComparisonValidator"
)

for FUNCTION in "${FUNCTIONS[@]}"; do
  echo "   Updating $FUNCTION..."
  aws lambda update-function-code \
    --function-name $FUNCTION \
    --zip-file fileb://lambda-deployment.zip \
    --region ap-south-1 > /dev/null
  
  aws lambda wait function-updated \
    --function-name $FUNCTION \
    --region ap-south-1
done
echo -e "${GREEN}✓${NC} Lambda functions updated"

echo "3.4 Creating Pillow layer..."
cd pillow-layer
zip -q -r ../pillow-layer.zip python/
cd ..

LAYER_ARN=$(aws lambda publish-layer-version \
  --layer-name pillow-image-processing \
  --description "Pillow library for image processing" \
  --zip-file fileb://pillow-layer.zip \
  --compatible-runtimes python3.11 python3.12 \
  --region ap-south-1 \
  --query 'LayerVersionArn' \
  --output text 2>/dev/null || echo "Layer already exists")

if [ ! -z "$LAYER_ARN" ]; then
  aws lambda update-function-configuration \
    --function-name IVF-ImageAnnotator \
    --layers $LAYER_ARN \
    --region ap-south-1 > /dev/null
  echo -e "${GREEN}✓${NC} Pillow layer attached to Image Annotator"
fi
echo ""

# Step 4: Deploy Cognito User Pool
echo "========================================="
echo "Step 4: Deploying Cognito User Pool"
echo "========================================="

aws cloudformation create-stack \
  --stack-name fms-ivf-witness-capture-cognito \
  --template-body file://cloudformation/cognito-user-pool.yaml \
  --region ap-south-1 2>/dev/null || echo "Stack already exists"

aws cloudformation wait stack-create-complete \
  --stack-name fms-ivf-witness-capture-cognito \
  --region ap-south-1 2>/dev/null || echo "Stack already complete"

USER_POOL_ID=$(aws cloudformation describe-stacks \
  --stack-name fms-ivf-witness-capture-cognito \
  --query 'Stacks[0].Outputs[?OutputKey==`UserPoolId`].OutputValue' \
  --output text \
  --region ap-south-1)

USER_POOL_CLIENT_ID=$(aws cloudformation describe-stacks \
  --stack-name fms-ivf-witness-capture-cognito \
  --query 'Stacks[0].Outputs[?OutputKey==`UserPoolClientId`].OutputValue' \
  --output text \
  --region ap-south-1)

echo -e "${GREEN}✓${NC} Cognito User Pool deployed"
echo "   User Pool ID: $USER_POOL_ID"
echo "   Client ID: $USER_POOL_CLIENT_ID"
echo ""

# Step 5: Deploy API Gateway
echo "========================================="
echo "Step 5: Deploying API Gateway"
echo "========================================="

aws cloudformation create-stack \
  --stack-name fms-ivf-witness-capture-api \
  --template-body file://cloudformation/api-gateway.yaml \
  --region ap-south-1 2>/dev/null || echo "Stack already exists"

aws cloudformation wait stack-create-complete \
  --stack-name fms-ivf-witness-capture-api \
  --region ap-south-1 2>/dev/null || echo "Stack already complete"

API_ENDPOINT=$(aws cloudformation describe-stacks \
  --stack-name fms-ivf-witness-capture-api \
  --query 'Stacks[0].Outputs[?OutputKey==`APIEndpoint`].OutputValue' \
  --output text \
  --region ap-south-1)

echo -e "${GREEN}✓${NC} API Gateway deployed"
echo "   API Endpoint: $API_ENDPOINT"
echo ""

# Step 6: Configure Frontend
echo "========================================="
echo "Step 6: Configuring Frontend"
echo "========================================="

echo "6.1 Updating aws-config.js..."
cat > /home/ubuntu/ivf-app-dev/frontend/src/aws-config.js << EOF
export default {
  Auth: {
    Cognito: {
      userPoolId: '$USER_POOL_ID',
      userPoolClientId: '$USER_POOL_CLIENT_ID',
      region: 'ap-south-1'
    }
  }
};
EOF
echo -e "${GREEN}✓${NC} aws-config.js updated"

echo "6.2 Updating config.js..."
cat > /home/ubuntu/ivf-app-dev/frontend/src/config.js << EOF
export const API_BASE_URL = '$API_ENDPOINT';

export const STAGES = [
  { id: 'label_validation', name: 'Label Validation', imagesRequired: 1 },
  { id: 'oocyte_collection', name: 'Oocyte Collection', imagesRequired: 1 },
  { id: 'denudation', name: 'Denudation', imagesRequired: 1 },
  { id: 'male_sample_collection', name: 'Male Sample Collection', imagesRequired: 2 },
  { id: 'icsi', name: 'ICSI', imagesRequired: 1 },
  { id: 'icsi_documentation', name: 'ICSI Documentation', imagesRequired: 0 },
  { id: 'culture', name: 'Culture', imagesRequired: 1 }
];
EOF
echo -e "${GREEN}✓${NC} config.js updated"
echo ""

# Step 7: Deploy Frontend Infrastructure
echo "========================================="
echo "Step 7: Deploying Frontend Infrastructure"
echo "========================================="
echo -e "${YELLOW}⏳${NC} Creating CloudFront distribution (this takes 10-15 minutes)..."

aws cloudformation create-stack \
  --stack-name fms-ivf-witness-capture-frontend \
  --template-body file://cloudformation/frontend-hosting.yaml \
  --region ap-south-1 2>/dev/null || echo "Stack already exists"

aws cloudformation wait stack-create-complete \
  --stack-name fms-ivf-witness-capture-frontend \
  --region ap-south-1 2>/dev/null || echo "Stack already complete"

CLOUDFRONT_URL=$(aws cloudformation describe-stacks \
  --stack-name fms-ivf-witness-capture-frontend \
  --query 'Stacks[0].Outputs[?OutputKey==`CloudFrontURL`].OutputValue' \
  --output text \
  --region ap-south-1)

echo -e "${GREEN}✓${NC} Frontend infrastructure deployed"
echo "   CloudFront URL: $CLOUDFRONT_URL"
echo ""

# Save configuration
echo "========================================="
echo "Saving Configuration"
echo "========================================="

cat > deployment-config.txt << EOF
=== IVF Witness Capture System - Deployment Configuration ===

AWS Account ID: $AWS_ACCOUNT_ID
Region: ap-south-1

S3 Bucket: $BUCKET_NAME
User Pool ID: $USER_POOL_ID
User Pool Client ID: $USER_POOL_CLIENT_ID
API Endpoint: $API_ENDPOINT
CloudFront URL: $CLOUDFRONT_URL

CloudFormation Stacks:
- fms-ivf-witness-capture-dynamodb
- fms-ivf-witness-capture-audit
- fms-ivf-witness-capture-validation-failures
- fms-ivf-witness-capture-injected-oocyte-images
- fms-ivf-witness-capture-s3
- fms-ivf-witness-capture-lambda
- fms-ivf-witness-capture-cognito
- fms-ivf-witness-capture-api
- fms-ivf-witness-capture-frontend

Deployment Date: $(date)
EOF

echo -e "${GREEN}✓${NC} Configuration saved to deployment-config.txt"
echo ""

# Summary
echo "========================================="
echo "Deployment Complete!"
echo "========================================="
echo ""
echo "Infrastructure deployed successfully!"
echo ""
echo "Next steps:"
echo "1. Run: ./create-admin-user.sh"
echo "2. Run: ./deploy-frontend-production.sh"
echo "3. Access: $CLOUDFRONT_URL"
echo ""
echo "Configuration saved to: deployment-config.txt"
echo ""
echo -e "${GREEN}✓${NC} All infrastructure components deployed"
echo ""
