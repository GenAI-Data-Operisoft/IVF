#!/bin/bash

# =========================================
# IVF DEV Environment - Nested Stack Deployment
# Deploys the ivf-dev parent stack with all child stacks
# =========================================

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

REGION="ap-south-1"
STACK_NAME="ivf-dev"
ENV="Dev"

echo -e "${BLUE}=========================================${NC}"
echo -e "${BLUE} IVF DEV Environment Deployment${NC}"
echo -e "${BLUE}=========================================${NC}"
echo ""

# Get AWS Account ID
echo "Verifying AWS credentials..."
AWS_ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text --region $REGION)
if [ $? -ne 0 ]; then
    echo -e "${RED}✗ Failed to get AWS credentials. Please configure AWS CLI.${NC}"
    exit 1
fi
echo -e "${GREEN}✓${NC} AWS Account: $AWS_ACCOUNT_ID"
echo -e "${GREEN}✓${NC} Region: $REGION"
echo ""

# Template bucket for nested stacks
TEMPLATES_BUCKET="c9-ivf-dev-cfn-templates-${AWS_ACCOUNT_ID}"
TEMPLATES_PREFIX="cloudformation/env"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
CFN_DIR="${PROJECT_DIR}/cloudformation/env"

# =========================================
# Step 1: Create/verify templates bucket
# =========================================
echo -e "${BLUE}Step 1: Preparing templates bucket${NC}"
echo "========================================="

if aws s3api head-bucket --bucket "$TEMPLATES_BUCKET" --region $REGION 2>/dev/null; then
    echo -e "${GREEN}✓${NC} Templates bucket exists: $TEMPLATES_BUCKET"
else
    echo "Creating templates bucket: $TEMPLATES_BUCKET"
    aws s3api create-bucket \
        --bucket "$TEMPLATES_BUCKET" \
        --region $REGION \
        --create-bucket-configuration LocationConstraint=$REGION
    echo -e "${GREEN}✓${NC} Templates bucket created"
fi
echo ""

# =========================================
# Step 2: Upload child templates to S3
# =========================================
echo -e "${BLUE}Step 2: Uploading child templates to S3${NC}"
echo "========================================="

CHILD_TEMPLATES=(
    "dynamodb.yaml"
    "s3-artifacts.yaml"
    "cognito.yaml"
    "lambda.yaml"
    "api-gateway.yaml"
    "frontend.yaml"
)

for TEMPLATE in "${CHILD_TEMPLATES[@]}"; do
    echo "  Uploading ${TEMPLATE}..."
    aws s3 cp "${CFN_DIR}/${TEMPLATE}" \
        "s3://${TEMPLATES_BUCKET}/${TEMPLATES_PREFIX}/${TEMPLATE}" \
        --region $REGION
done
echo -e "${GREEN}✓${NC} All child templates uploaded"
echo ""

# =========================================
# Step 3: Deploy the parent nested stack
# =========================================
echo -e "${BLUE}Step 3: Deploying parent stack '${STACK_NAME}'${NC}"
echo "========================================="

# Check if stack exists
STACK_STATUS=$(aws cloudformation describe-stacks \
    --stack-name $STACK_NAME \
    --region $REGION \
    --query 'Stacks[0].StackStatus' \
    --output text 2>/dev/null || echo "DOES_NOT_EXIST")

if [ "$STACK_STATUS" == "DOES_NOT_EXIST" ]; then
    echo "Creating new stack: $STACK_NAME"
    aws cloudformation create-stack \
        --stack-name $STACK_NAME \
        --template-body "file://${CFN_DIR}/parent-stack.yaml" \
        --parameters \
            ParameterKey=Env,ParameterValue=$ENV \
            ParameterKey=TemplatesBucketName,ParameterValue=$TEMPLATES_BUCKET \
            ParameterKey=TemplatesPrefix,ParameterValue=$TEMPLATES_PREFIX \
        --capabilities CAPABILITY_NAMED_IAM CAPABILITY_AUTO_EXPAND \
        --tags \
            Key=Application,Value=IVF-Witness-Capture \
            Key=Environment,Value=Development \
            Key=ManagedBy,Value=CloudFormation \
        --region $REGION

    echo -e "${YELLOW}⏳${NC} Waiting for stack creation (this may take 10-15 minutes)..."
    aws cloudformation wait stack-create-complete \
        --stack-name $STACK_NAME \
        --region $REGION

    echo -e "${GREEN}✓${NC} Stack created successfully"
else
    echo "Updating existing stack: $STACK_NAME (current status: $STACK_STATUS)"
    
    UPDATE_OUTPUT=$(aws cloudformation update-stack \
        --stack-name $STACK_NAME \
        --template-body "file://${CFN_DIR}/parent-stack.yaml" \
        --parameters \
            ParameterKey=Env,ParameterValue=$ENV \
            ParameterKey=TemplatesBucketName,ParameterValue=$TEMPLATES_BUCKET \
            ParameterKey=TemplatesPrefix,ParameterValue=$TEMPLATES_PREFIX \
        --capabilities CAPABILITY_NAMED_IAM CAPABILITY_AUTO_EXPAND \
        --tags \
            Key=Application,Value=IVF-Witness-Capture \
            Key=Environment,Value=Development \
            Key=ManagedBy,Value=CloudFormation \
        --region $REGION 2>&1) || true

    if echo "$UPDATE_OUTPUT" | grep -q "No updates are to be performed"; then
        echo -e "${GREEN}✓${NC} Stack is already up to date"
    else
        echo -e "${YELLOW}⏳${NC} Waiting for stack update..."
        aws cloudformation wait stack-update-complete \
            --stack-name $STACK_NAME \
            --region $REGION
        echo -e "${GREEN}✓${NC} Stack updated successfully"
    fi
fi
echo ""

# =========================================
# Step 4: Package and deploy Lambda code
# =========================================
echo -e "${BLUE}Step 4: Deploying Lambda function code${NC}"
echo "========================================="

LAMBDA_DIR="${PROJECT_DIR}/lambda"

if [ -d "$LAMBDA_DIR" ]; then
    echo "Packaging Lambda functions..."
    LAMBDA_ZIP="/tmp/ivf-dev-lambda-deployment.zip"
    
    # Create zip from lambda directory
    pushd "$LAMBDA_DIR" > /dev/null
    zip -q -r "$LAMBDA_ZIP" *.py 2>/dev/null || echo "  (no .py files found in lambda/)"
    popd > /dev/null

    if [ -f "$LAMBDA_ZIP" ]; then
        DEV_FUNCTIONS=(
            "IVF-Dev-RegistrationHandler"
            "IVF-Dev-PresignedUrlGenerator"
            "IVF-Dev-OCRProcessor"
            "IVF-Dev-ComparisonValidator"
            "IVF-Dev-ListSessions"
        )

        for FUNCTION in "${DEV_FUNCTIONS[@]}"; do
            echo "  Updating ${FUNCTION}..."
            aws lambda update-function-code \
                --function-name "$FUNCTION" \
                --zip-file "fileb://${LAMBDA_ZIP}" \
                --region $REGION > /dev/null 2>&1 || echo "    (skipped - function may not exist yet)"
            
            # Wait for update to complete
            aws lambda wait function-updated \
                --function-name "$FUNCTION" \
                --region $REGION 2>/dev/null || true
        done

        rm -f "$LAMBDA_ZIP"
        echo -e "${GREEN}✓${NC} Lambda functions updated"
    else
        echo -e "${YELLOW}⚠${NC} No Lambda package created (no .py files found)"
    fi
else
    echo -e "${YELLOW}⚠${NC} Lambda directory not found at: $LAMBDA_DIR"
    echo "  Skipping Lambda code deployment"
fi
echo ""

# =========================================
# Step 5: Get and display outputs
# =========================================
echo -e "${BLUE}Step 5: Retrieving stack outputs${NC}"
echo "========================================="

get_output() {
    aws cloudformation describe-stacks \
        --stack-name $STACK_NAME \
        --region $REGION \
        --query "Stacks[0].Outputs[?OutputKey=='$1'].OutputValue" \
        --output text 2>/dev/null || echo "N/A"
}

API_ENDPOINT=$(get_output "ApiEndpoint")
USER_POOL_ID=$(get_output "UserPoolId")
USER_POOL_CLIENT_ID=$(get_output "UserPoolClientId")
CLOUDFRONT_URL=$(get_output "CloudFrontURL")
ARTIFACTS_BUCKET=$(get_output "ArtifactsBucketName")
FRONTEND_BUCKET=$(get_output "FrontendBucketName")
DISTRIBUTION_ID=$(get_output "CloudFrontDistributionId")

echo ""
echo -e "${GREEN}=========================================${NC}"
echo -e "${GREEN} DEV Environment Deployed Successfully!${NC}"
echo -e "${GREEN}=========================================${NC}"
echo ""
echo -e "  ${BLUE}API Endpoint:${NC}       $API_ENDPOINT"
echo -e "  ${BLUE}User Pool ID:${NC}       $USER_POOL_ID"
echo -e "  ${BLUE}Client ID:${NC}          $USER_POOL_CLIENT_ID"
echo -e "  ${BLUE}CloudFront URL:${NC}     $CLOUDFRONT_URL"
echo -e "  ${BLUE}Artifacts Bucket:${NC}   $ARTIFACTS_BUCKET"
echo -e "  ${BLUE}Frontend Bucket:${NC}    $FRONTEND_BUCKET"
echo -e "  ${BLUE}Distribution ID:${NC}    $DISTRIBUTION_ID"
echo ""
echo -e "  ${BLUE}Stack Name:${NC}         $STACK_NAME"
echo -e "  ${BLUE}Region:${NC}             $REGION"
echo -e "  ${BLUE}Account:${NC}            $AWS_ACCOUNT_ID"
echo ""

# =========================================
# Step 6: Save config for frontend
# =========================================
echo -e "${BLUE}Step 6: Saving configuration${NC}"
echo "========================================="

CONFIG_FILE="${PROJECT_DIR}/dev-environment-config.txt"
cat > "$CONFIG_FILE" << EOF
=== IVF DEV Environment Configuration ===
Generated: $(date -u +"%Y-%m-%dT%H:%M:%SZ")

Stack Name: ${STACK_NAME}
Region: ${REGION}
Account: ${AWS_ACCOUNT_ID}

API Endpoint: ${API_ENDPOINT}
User Pool ID: ${USER_POOL_ID}
User Pool Client ID: ${USER_POOL_CLIENT_ID}
CloudFront URL: ${CLOUDFRONT_URL}
Artifacts Bucket: ${ARTIFACTS_BUCKET}
Frontend Bucket: ${FRONTEND_BUCKET}
CloudFront Distribution ID: ${DISTRIBUTION_ID}

--- Frontend Config (aws-config.js) ---
export default {
  Auth: {
    Cognito: {
      userPoolId: '${USER_POOL_ID}',
      userPoolClientId: '${USER_POOL_CLIENT_ID}',
      region: '${REGION}'
    }
  }
};

--- Frontend Config (config.js) ---
export const API_BASE_URL = '${API_ENDPOINT}';
EOF

echo -e "${GREEN}✓${NC} Configuration saved to: $CONFIG_FILE"
echo ""

echo -e "${BLUE}Next steps:${NC}"
echo "  1. Update frontend/src/aws-config.js with the User Pool ID and Client ID above"
echo "  2. Update frontend/src/config.js with the API Endpoint above"
echo "  3. Build frontend: cd frontend && npm run build"
echo "  4. Deploy frontend: aws s3 sync build/ s3://${FRONTEND_BUCKET}/ --delete"
echo "  5. Invalidate cache: aws cloudfront create-invalidation --distribution-id ${DISTRIBUTION_ID} --paths '/*'"
echo ""
echo -e "${GREEN}✓${NC} Deployment complete!"
