#!/bin/bash

set -e  # Exit on error

echo "=========================================="
echo "🚀 IVF Witness Capture - Frontend Deployment"
echo "=========================================="
echo ""

STACK_NAME="IVF-WitnessCapture-Frontend"
REGION="ap-south-1"

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Step 1: Deploy CloudFormation Stack
echo -e "${BLUE}📦 Step 1: Deploying CloudFormation Stack...${NC}"
echo ""

aws cloudformation deploy \
  --template-file /home/ubuntu/ivf-app-dev/cloudformation/frontend-hosting.yaml \
  --stack-name $STACK_NAME \
  --region $REGION \
  --no-fail-on-empty-changeset

if [ $? -ne 0 ]; then
  echo -e "${RED}❌ CloudFormation deployment failed${NC}"
  exit 1
fi

echo -e "${GREEN}✅ CloudFormation stack deployed${NC}"
echo ""

# Step 2: Get Stack Outputs
echo -e "${BLUE}📋 Step 2: Getting Stack Outputs...${NC}"
echo ""

BUCKET_NAME=$(aws cloudformation describe-stacks \
  --stack-name $STACK_NAME \
  --region $REGION \
  --query 'Stacks[0].Outputs[?OutputKey==`FrontendBucketName`].OutputValue' \
  --output text)

DISTRIBUTION_ID=$(aws cloudformation describe-stacks \
  --stack-name $STACK_NAME \
  --region $REGION \
  --query 'Stacks[0].Outputs[?OutputKey==`CloudFrontDistributionId`].OutputValue' \
  --output text)

CLOUDFRONT_URL=$(aws cloudformation describe-stacks \
  --stack-name $STACK_NAME \
  --region $REGION \
  --query 'Stacks[0].Outputs[?OutputKey==`CloudFrontURL`].OutputValue' \
  --output text)

echo "S3 Bucket: $BUCKET_NAME"
echo "CloudFront Distribution ID: $DISTRIBUTION_ID"
echo "CloudFront URL: $CLOUDFRONT_URL"
echo ""

# Step 3: Build React App
echo -e "${BLUE}🔨 Step 3: Building React Application...${NC}"
echo ""

cd /home/ubuntu/ivf-app-dev/frontend

# Check if node_modules exists
if [ ! -d "node_modules" ]; then
  echo -e "${YELLOW}⚠️  node_modules not found. Running npm install...${NC}"
  npm install
fi

# Build the app
npm run build

if [ $? -ne 0 ]; then
  echo -e "${RED}❌ Build failed${NC}"
  exit 1
fi

echo -e "${GREEN}✅ Build complete${NC}"
echo ""

# Step 4: Deploy to S3
echo -e "${BLUE}📤 Step 4: Uploading to S3...${NC}"
echo ""

aws s3 sync build/ s3://$BUCKET_NAME/ \
  --region $REGION \
  --delete \
  --cache-control "public, max-age=31536000, immutable" \
  --exclude "index.html" \
  --exclude "asset-manifest.json" \
  --exclude "service-worker.js"

# Upload index.html with no-cache
aws s3 cp build/index.html s3://$BUCKET_NAME/index.html \
  --region $REGION \
  --cache-control "no-cache, no-store, must-revalidate" \
  --content-type "text/html"

# Upload other root files with no-cache
if [ -f "build/asset-manifest.json" ]; then
  aws s3 cp build/asset-manifest.json s3://$BUCKET_NAME/asset-manifest.json \
    --region $REGION \
    --cache-control "no-cache"
fi

if [ -f "build/service-worker.js" ]; then
  aws s3 cp build/service-worker.js s3://$BUCKET_NAME/service-worker.js \
    --region $REGION \
    --cache-control "no-cache"
fi

echo -e "${GREEN}✅ Files uploaded to S3${NC}"
echo ""

# Step 5: Invalidate CloudFront Cache
echo -e "${BLUE}🔄 Step 5: Invalidating CloudFront Cache...${NC}"
echo ""

INVALIDATION_ID=$(aws cloudfront create-invalidation \
  --distribution-id $DISTRIBUTION_ID \
  --paths "/*" \
  --query 'Invalidation.Id' \
  --output text)

echo "Invalidation ID: $INVALIDATION_ID"
echo -e "${YELLOW}⏳ Waiting for invalidation to complete (this may take 1-2 minutes)...${NC}"

aws cloudfront wait invalidation-completed \
  --distribution-id $DISTRIBUTION_ID \
  --id $INVALIDATION_ID

echo -e "${GREEN}✅ CloudFront cache invalidated${NC}"
echo ""

cd ..

# Step 6: Summary
echo "=========================================="
echo -e "${GREEN}🎉 Deployment Complete!${NC}"
echo "=========================================="
echo ""
echo -e "${BLUE}📊 Deployment Summary:${NC}"
echo "  • S3 Bucket: $BUCKET_NAME"
echo "  • CloudFront Distribution: $DISTRIBUTION_ID"
echo "  • Application URL: $CLOUDFRONT_URL"
echo ""
echo -e "${BLUE}🌐 Access Your Application:${NC}"
echo "  $CLOUDFRONT_URL"
echo ""
echo -e "${YELLOW}⚠️  Important Notes:${NC}"
echo "  • CloudFront may take 5-10 minutes to fully propagate"
echo "  • Use the CloudFront URL (not S3 website URL) for production"
echo "  • HTTPS is enforced automatically"
echo "  • React Router is configured (404s redirect to index.html)"
echo ""
echo -e "${BLUE}🔄 To Update the Application:${NC}"
echo "  Run this script again: ./deploy-frontend-production.sh"
echo ""
echo -e "${BLUE}📝 Next Steps:${NC}"
echo "  1. Test the application at: $CLOUDFRONT_URL"
echo "  2. Update CORS settings in API Gateway to allow CloudFront domain"
echo "  3. Update Cognito callback URLs if needed"
echo "  4. Configure custom domain (optional)"
echo ""
