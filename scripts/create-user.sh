#!/bin/bash

# Create User for IVF Witness Capture System

USER_POOL_ID="ap-south-1_Y9qYxFX8D"
REGION="ap-south-1"

# Check if parameters are provided
if [ $# -lt 4 ]; then
  echo "Usage: ./create-user.sh <email> <name> <role> <department> [password]"
  echo ""
  echo "Roles: admin, supervisor, nurse, viewer"
  echo "Example: ./create-user.sh john@example.com 'John Doe' nurse Embryology"
  echo ""
  exit 1
fi

EMAIL=$1
NAME=$2
ROLE=$3
DEPARTMENT=$4
PASSWORD=${5:-"TempPass123!"}

echo "=========================================="
echo "Creating User"
echo "=========================================="
echo ""
echo "Email: $EMAIL"
echo "Name: $NAME"
echo "Role: $ROLE"
echo "Department: $DEPARTMENT"
echo ""

# Create user
echo "📝 Creating user..."
aws cognito-idp admin-create-user \
  --user-pool-id $USER_POOL_ID \
  --username $EMAIL \
  --user-attributes \
    Name=email,Value=$EMAIL \
    Name=name,Value="$NAME" \
    Name=custom:role,Value=$ROLE \
    Name=custom:department,Value="$DEPARTMENT" \
  --temporary-password "$PASSWORD" \
  --message-action SUPPRESS \
  --region $REGION

if [ $? -ne 0 ]; then
  echo "❌ Failed to create user"
  exit 1
fi

echo ""
echo "✅ User created successfully!"
echo ""

# Add to appropriate group based on role
GROUP_NAME=""
case $ROLE in
  admin)
    GROUP_NAME="Admins"
    ;;
  supervisor)
    GROUP_NAME="Supervisors"
    ;;
  nurse)
    GROUP_NAME="Nurses"
    ;;
  viewer)
    GROUP_NAME="Viewers"
    ;;
  *)
    echo "⚠️  Unknown role: $ROLE. User created but not added to any group."
    ;;
esac

if [ ! -z "$GROUP_NAME" ]; then
  echo "👥 Adding user to $GROUP_NAME group..."
  aws cognito-idp admin-add-user-to-group \
    --user-pool-id $USER_POOL_ID \
    --username $EMAIL \
    --group-name $GROUP_NAME \
    --region $REGION
  
  if [ $? -eq 0 ]; then
    echo "✅ User added to $GROUP_NAME group!"
  else
    echo "⚠️  Failed to add user to group (user still created)"
  fi
fi

echo ""
echo "=========================================="
echo "User Details"
echo "=========================================="
echo "Email: $EMAIL"
echo "Temporary Password: $PASSWORD"
echo "Name: $NAME"
echo "Role: $ROLE"
echo "Department: $DEPARTMENT"
echo ""
echo "⚠️  User must change password on first login"
echo "=========================================="
