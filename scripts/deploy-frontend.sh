#!/bin/bash
# deploy-frontend.sh
#
# Builds the React frontend and deploys it to S3 + CloudFront.
# Run this from the project root (ivf-app-dev/) after making frontend changes.
# Assets (logo, gif, images) are uploaded separately because they are not
# part of the React build output and would be deleted by the S3 sync otherwise.

set -e

REGION="ap-south-1"
S3_BUCKET="ivf-witness-capture-frontend-142464893807"
CLOUDFRONT_ID="E4PIBWT9VNYR4"
FRONTEND_DIR="$(dirname "$0")/../frontend"
ASSETS_DIR="$(dirname "$0")/../assets"

echo "Building frontend..."
npm run build --prefix "$FRONTEND_DIR"

echo "Syncing build to S3..."
# Note: --delete removes old files but we re-upload assets after to restore them
aws s3 sync "$FRONTEND_DIR/build" "s3://$S3_BUCKET" \
  --delete \
  --region "$REGION"

echo "Uploading static assets..."
aws s3 cp "$ASSETS_DIR/cloudnine-logo.png" "s3://$S3_BUCKET/cloudnine-logo.png" --region "$REGION"
aws s3 cp "$ASSETS_DIR/hoempagebaby.png"   "s3://$S3_BUCKET/hoempagebaby.png"   --region "$REGION"
aws s3 cp "$ASSETS_DIR/IVFgif.gif"         "s3://$S3_BUCKET/IVFgif.gif"         --region "$REGION"
aws s3 cp "$ASSETS_DIR/IVF.png"            "s3://$S3_BUCKET/IVF.png"            --region "$REGION"
aws s3 cp "$ASSETS_DIR/images.jpg"         "s3://$S3_BUCKET/images.jpg"         --region "$REGION"

echo "Invalidating CloudFront cache..."
aws cloudfront create-invalidation \
  --distribution-id "$CLOUDFRONT_ID" \
  --paths "/*" \
  --region "$REGION" \
  --query 'Invalidation.Id' \
  --output text

echo "Done. Site is live at https://d1nmtja0c4ok3x.cloudfront.net"
