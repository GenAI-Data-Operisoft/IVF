#!/bin/bash

# Create Admin User for IVF Witness Capture System

USER_POOL_ID="ap-south-1_Y9qYxFX8D"
REGION="ap-south-1"

echo "=========================================="
echo "Creating Admin User"
echo "=========================================="
echo ""

# Create admin user
echo "📝 Creating admin user: admin@example.com"
aws cognito-idp admin-create-user \
  --user-pool-id $USER_POOL_ID \
  --username admin@example.com \
  --user-attributes \
    Name=email,Value=admin@example.com \
    Name=name,Value="System Administrator" \
    Name=custom:role,Value=admin \
    Name=custom:department,Value="IT" \
  --temporary-password "TempPass123!" \
  --message-action SUPPRESS \
  --region $REGION

echo ""
echo "✅ Admin user created successfully!"
echo ""

# Add to Admins group
echo "👥 Adding user to Admins group..."
aws cognito-idp admin-add-user-to-group \
  --user-pool-id $USER_POOL_ID \
  --username admin@example.com \
  --group-name Admins \
  --region $REGION

echo ""
echo "✅ User added to Admins group!"
echo ""
echo "=========================================="
echo "Admin User Details"
echo "=========================================="
echo "Email: admin@example.com"
echo "Temporary Password: TempPass123!"
echo "Role: admin"
echo "Department: IT"
echo ""
echo "⚠️  User must change password on first login"
echo "=========================================="
