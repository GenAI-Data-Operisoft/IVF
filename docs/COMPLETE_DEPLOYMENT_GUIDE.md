# Complete Deployment Guide - IVF Witness Capture System

This guide will walk you through deploying the entire IVF Witness Capture System from scratch.

## Prerequisites

### Required Tools
- AWS Account with Administrator access
- AWS CLI installed and configured
- Python 3.11 or 3.12 installed
- Node.js 16+ and npm installed
- Git installed
- Bash shell (Linux/Mac) or Git Bash (Windows)

### AWS CLI Configuration
```bash
# Configure AWS CLI with your credentials
aws configure
# Enter: Access Key ID, Secret Access Key, Region (ap-south-1), Output format (json)

# Verify configuration
aws sts get-caller-identity
```

### Get Your AWS Account ID
```bash
export AWS_ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
echo "Your AWS Account ID: $AWS_ACCOUNT_ID"
```

---

## Step 1: Deploy DynamoDB Tables

### 1.1 Deploy Main Tables
```bash
# Deploy main DynamoDB tables
aws cloudformation create-stack \
  --stack-name fms-ivf-witness-capture-dynamodb \
  --template-body file://cloudformation/dynamodb-tables.yaml \
  --region ap-south-1

# Wait for completion (takes ~2 minutes)
aws cloudformation wait stack-create-complete \
  --stack-name fms-ivf-witness-capture-dynamodb \
  --region ap-south-1

echo "✅ Main DynamoDB tables created"
```

### 1.2 Deploy Audit Table
```bash
aws cloudformation create-stack \
  --stack-name fms-ivf-witness-capture-audit \
  --template-body file://cloudformation/audit-table.yaml \
  --region ap-south-1

aws cloudformation wait stack-create-complete \
  --stack-name fms-ivf-witness-capture-audit \
  --region ap-south-1

echo "✅ Audit table created"
```

### 1.3 Deploy Validation Failures Table
```bash
aws cloudformation create-stack \
  --stack-name fms-ivf-witness-capture-validation-failures \
  --template-body file://cloudformation/validation-failures-table.yaml \
  --region ap-south-1

aws cloudformation wait stack-create-complete \
  --stack-name fms-ivf-witness-capture-validation-failures \
  --region ap-south-1

echo "✅ Validation failures table created"
```

### 1.4 Deploy Injected Oocyte Images Table
```bash
aws cloudformation create-stack \
  --stack-name fms-ivf-witness-capture-injected-oocyte-images \
  --template-body file://cloudformation/injected-oocyte-images-table.yaml \
  --region ap-south-1

aws cloudformation wait stack-create-complete \
  --stack-name fms-ivf-witness-capture-injected-oocyte-images \
  --region ap-south-1

echo "✅ Injected oocyte images table created"
```

---

## Step 2: Deploy S3 Bucket

```bash
aws cloudformation create-stack \
  --stack-name fms-ivf-witness-capture-s3 \
  --template-body file://cloudformation/s3-bucket.yaml \
  --region ap-south-1

aws cloudformation wait stack-create-complete \
  --stack-name fms-ivf-witness-capture-s3 \
  --region ap-south-1

# Get bucket name
export BUCKET_NAME=$(aws cloudformation describe-stacks \
  --stack-name fms-ivf-witness-capture-s3 \
  --query 'Stacks[0].Outputs[?OutputKey==`BucketName`].OutputValue' \
  --output text \
  --region ap-south-1)

echo "✅ S3 bucket created: $BUCKET_NAME"
```

---

## Step 3: Deploy Lambda Functions

### 3.1 Package Lambda Functions
```bash
cd lambda-functions

# Create deployment package
zip -r ../lambda-deployment.zip *.py

cd ..
echo "✅ Lambda package created"
```

### 3.2 Deploy Lambda Stack
```bash
aws cloudformation create-stack \
  --stack-name fms-ivf-witness-capture-lambda \
  --template-body file://cloudformation/lambda-functions.yaml \
  --capabilities CAPABILITY_NAMED_IAM \
  --region ap-south-1

aws cloudformation wait stack-create-complete \
  --stack-name fms-ivf-witness-capture-lambda \
  --region ap-south-1

echo "✅ Lambda stack created"
```

### 3.3 Update Lambda Function Code

```bash
# Update each Lambda function with actual code
FUNCTIONS=(
  "IVF-RegistrationHandler"
  "IVF-PresignedUrlGenerator"
  "IVF-OCRProcessor"
  "IVF-ComparisonValidator"
)

for FUNCTION in "${FUNCTIONS[@]}"; do
  echo "Updating $FUNCTION..."
  aws lambda update-function-code \
    --function-name $FUNCTION \
    --zip-file fileb://lambda-deployment.zip \
    --region ap-south-1
  
  # Wait for update to complete
  aws lambda wait function-updated \
    --function-name $FUNCTION \
    --region ap-south-1
done

echo "✅ Lambda functions updated"
```

### 3.4 Create Pillow Layer for Image Annotator

```bash
# The Pillow layer is already included in pillow-layer/ directory
# Package it
cd pillow-layer
zip -r ../pillow-layer.zip python/
cd ..

# Create Lambda layer
LAYER_ARN=$(aws lambda publish-layer-version \
  --layer-name pillow-image-processing \
  --description "Pillow library for image processing" \
  --zip-file fileb://pillow-layer.zip \
  --compatible-runtimes python3.11 python3.12 \
  --region ap-south-1 \
  --query 'LayerVersionArn' \
  --output text)

echo "✅ Pillow layer created: $LAYER_ARN"

# Attach layer to Image Annotator function
aws lambda update-function-configuration \
  --function-name IVF-ImageAnnotator \
  --layers $LAYER_ARN \
  --region ap-south-1

echo "✅ Layer attached to Image Annotator"
```

---

## Step 4: Deploy Cognito User Pool

```bash
aws cloudformation create-stack \
  --stack-name fms-ivf-witness-capture-cognito \
  --template-body file://cloudformation/cognito-user-pool.yaml \
  --region ap-south-1

aws cloudformation wait stack-create-complete \
  --stack-name fms-ivf-witness-capture-cognito \
  --region ap-south-1

# Get User Pool details
export USER_POOL_ID=$(aws cloudformation describe-stacks \
  --stack-name fms-ivf-witness-capture-cognito \
  --query 'Stacks[0].Outputs[?OutputKey==`UserPoolId`].OutputValue' \
  --output text \
  --region ap-south-1)

export USER_POOL_CLIENT_ID=$(aws cloudformation describe-stacks \
  --stack-name fms-ivf-witness-capture-cognito \
  --query 'Stacks[0].Outputs[?OutputKey==`UserPoolClientId`].OutputValue' \
  --output text \
  --region ap-south-1)

echo "✅ Cognito User Pool created"
echo "User Pool ID: $USER_POOL_ID"
echo "Client ID: $USER_POOL_CLIENT_ID"
```

---

## Step 5: Deploy API Gateway

```bash
aws cloudformation create-stack \
  --stack-name fms-ivf-witness-capture-api \
  --template-body file://cloudformation/api-gateway.yaml \
  --region ap-south-1

aws cloudformation wait stack-create-complete \
  --stack-name fms-ivf-witness-capture-api \
  --region ap-south-1

# Get API endpoint
export API_ENDPOINT=$(aws cloudformation describe-stacks \
  --stack-name fms-ivf-witness-capture-api \
  --query 'Stacks[0].Outputs[?OutputKey==`APIEndpoint`].OutputValue' \
  --output text \
  --region ap-south-1)

echo "✅ API Gateway created"
echo "API Endpoint: $API_ENDPOINT"
```

---

## Step 6: Configure Frontend

### 6.1 Update aws-config.js
```bash
cd ivf-witness-capture-frontend/src

# Create aws-config.js with your Cognito details
cat > aws-config.js << EOF
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

echo "✅ aws-config.js updated"
```

### 6.2 Update config.js
```bash
cat > config.js << EOF
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

cd ../..
echo "✅ config.js updated"
```

---

## Step 7: Deploy Frontend to S3 + CloudFront

### 7.1 Deploy Frontend Infrastructure
```bash
aws cloudformation create-stack \
  --stack-name fms-ivf-witness-capture-frontend \
  --template-body file://cloudformation/frontend-hosting.yaml \
  --region ap-south-1

# This takes 10-15 minutes due to CloudFront distribution creation
echo "⏳ Creating CloudFront distribution (this takes 10-15 minutes)..."

aws cloudformation wait stack-create-complete \
  --stack-name fms-ivf-witness-capture-frontend \
  --region ap-south-1

echo "✅ Frontend infrastructure created"
```

### 7.2 Build and Deploy Frontend
```bash
# Run the deployment script
chmod +x deploy-frontend-production.sh
./deploy-frontend-production.sh

# Get CloudFront URL
export CLOUDFRONT_URL=$(aws cloudformation describe-stacks \
  --stack-name fms-ivf-witness-capture-frontend \
  --query 'Stacks[0].Outputs[?OutputKey==`CloudFrontURL`].OutputValue' \
  --output text \
  --region ap-south-1)

echo "✅ Frontend deployed"
echo "Production URL: $CLOUDFRONT_URL"
```

---

## Step 8: Create Admin User

```bash
# Run the admin user creation script
chmod +x create-admin-user.sh
./create-admin-user.sh

# Follow the prompts to enter:
# - Email
# - Name
# - Department
# - Employee ID
# - Password

echo "✅ Admin user created"
```

---

## Step 9: Verify Deployment

### 9.1 Test Backend
```bash
# Test API Gateway
curl ${API_ENDPOINT}/models

# Should return list of available Bedrock models
```

### 9.2 Test Frontend
```bash
echo "Open this URL in your browser:"
echo $CLOUDFRONT_URL

echo ""
echo "Login with the admin credentials you just created"
```

### 9.3 Test Complete Workflow
1. Login with admin credentials
2. Click "Start New Capture"
3. Register a test case with patient details
4. Upload a test image for Label Validation stage
5. Wait for OCR processing (~30 seconds)
6. Verify validation result

---

## Step 10: Save Configuration

```bash
# Save all important values to a file
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

echo "✅ Configuration saved to deployment-config.txt"
cat deployment-config.txt
```

---

## Troubleshooting

### Issue: Stack creation fails
```bash
# Check stack events for errors
aws cloudformation describe-stack-events \
  --stack-name STACK_NAME \
  --region ap-south-1 \
  --max-items 10
```

### Issue: Lambda function not working
```bash
# Check Lambda logs
aws logs tail /aws/lambda/IVF-OCRProcessor --follow --region ap-south-1
```

### Issue: Frontend shows blank page
```bash
# Check browser console for errors
# Verify aws-config.js and config.js have correct values
# Clear browser cache and reload
```

### Issue: Bedrock access denied
```bash
# Verify Lambda execution role has bedrock:InvokeModel permission
aws iam get-role-policy \
  --role-name IVF-WitnessCapture-Lambda-Role \
  --policy-name IVF-Lambda-Permissions \
  --region ap-south-1
```

---

## Post-Deployment Tasks

### 1. Create Additional Users
```bash
# Create nurse user
./create-user.sh nurse

# Create supervisor user
./create-user.sh supervisor

# Create viewer user
./create-user.sh viewer
```

### 2. Enable Bedrock Model Access
```bash
# Go to AWS Console → Bedrock → Model access
# Request access to: Qwen 2.5 Coder 32B Instruct
# Wait for approval (usually instant)
```

### 3. Set Up Monitoring
```bash
# Create CloudWatch dashboard
aws cloudwatch put-dashboard \
  --dashboard-name IVF-WitnessCapture \
  --dashboard-body file://cloudwatch-dashboard.json \
  --region ap-south-1
```

### 4. Configure Alarms
```bash
# Create alarm for Lambda errors
aws cloudwatch put-metric-alarm \
  --alarm-name IVF-Lambda-Errors \
  --alarm-description "Alert on Lambda errors" \
  --metric-name Errors \
  --namespace AWS/Lambda \
  --statistic Sum \
  --period 300 \
  --evaluation-periods 1 \
  --threshold 5 \
  --comparison-operator GreaterThanThreshold \
  --region ap-south-1
```

---

## Cleanup (if needed)

To delete all resources:

```bash
# Delete in reverse order
aws cloudformation delete-stack --stack-name fms-ivf-witness-capture-frontend --region ap-south-1
aws cloudformation delete-stack --stack-name fms-ivf-witness-capture-api --region ap-south-1
aws cloudformation delete-stack --stack-name fms-ivf-witness-capture-cognito --region ap-south-1
aws cloudformation delete-stack --stack-name fms-ivf-witness-capture-lambda --region ap-south-1

# Empty S3 bucket before deleting
aws s3 rm s3://$BUCKET_NAME --recursive
aws cloudformation delete-stack --stack-name fms-ivf-witness-capture-s3 --region ap-south-1

# Delete DynamoDB stacks
aws cloudformation delete-stack --stack-name fms-ivf-witness-capture-injected-oocyte-images --region ap-south-1
aws cloudformation delete-stack --stack-name fms-ivf-witness-capture-validation-failures --region ap-south-1
aws cloudformation delete-stack --stack-name fms-ivf-witness-capture-audit --region ap-south-1
aws cloudformation delete-stack --stack-name fms-ivf-witness-capture-dynamodb --region ap-south-1
```

---

## Summary

You have successfully deployed:
- ✅ 10 DynamoDB tables
- ✅ 1 S3 bucket for images
- ✅ 19 Lambda functions
- ✅ 1 Cognito User Pool
- ✅ 1 API Gateway
- ✅ 1 CloudFront distribution
- ✅ 1 React frontend application
- ✅ 1 Admin user

**Total Deployment Time**: ~30-40 minutes

**Next Steps**:
1. Test the complete workflow
2. Create additional users
3. Configure monitoring and alarms
4. Review security settings
5. Set up backup procedures

For support, see [TROUBLESHOOTING.md](TROUBLESHOOTING.md)

---
