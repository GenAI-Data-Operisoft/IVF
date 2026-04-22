import json
import boto3
import os
from datetime import datetime

REGION = os.environ.get('COGNITO_REGION', os.environ.get('AWS_REGION', 'ap-south-1'))
cognito = boto3.client('cognito-idp', region_name=REGION)
USER_POOL_ID = os.environ.get('USER_POOL_ID', '')

CORS = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type,Authorization',
    'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS'
}

def resp(status, body):
    return {'statusCode': status, 'headers': CORS, 'body': json.dumps(body)}

def lambda_handler(event, context):
    if event.get('httpMethod') == 'OPTIONS':
        return {'statusCode': 200, 'headers': CORS, 'body': ''}

    method = event.get('httpMethod', 'GET')
    path   = event.get('path', '')
    body   = json.loads(event.get('body') or '{}')

    try:
        # GET /users — list all users
        if method == 'GET' and path.endswith('/users'):
            users = []
            kwargs = {'UserPoolId': USER_POOL_ID, 'Limit': 60}
            while True:
                r = cognito.list_users(**kwargs)
                for u in r.get('Users', []):
                    attrs = {a['Name']: a['Value'] for a in u.get('Attributes', [])}
                    centers_raw = attrs.get('custom:centers', '')
                    try:
                        centers = json.loads(centers_raw) if centers_raw else []
                    except:
                        centers = []
                    users.append({
                        'username':    u['Username'],
                        'email':       attrs.get('email', ''),
                        'name':        attrs.get('name', ''),
                        'role':        attrs.get('custom:role', 'nurse'),
                        'department':  attrs.get('custom:department', ''),
                        'permissions': attrs.get('custom:permissions', ''),
                        'centers':     centers,
                        'status':      u.get('UserStatus', ''),
                        'enabled':     u.get('Enabled', True),
                        'created':     u.get('UserCreateDate', '').isoformat() if hasattr(u.get('UserCreateDate', ''), 'isoformat') else str(u.get('UserCreateDate', ''))
                    })
                token = r.get('PaginationToken')
                if not token:
                    break
                kwargs['PaginationToken'] = token
            return resp(200, {'users': users, 'total': len(users)})

        # POST /users — create user
        if method == 'POST' and path.endswith('/users'):
            email      = body.get('email', '').strip()
            name       = body.get('name', '').strip()
            role       = body.get('role', 'viewer')
            department = body.get('department', '')
            temp_pass  = body.get('temporaryPassword', 'IVFTemp123!')
            permissions  = body.get('permissions', {})
            module_perms = body.get('modulePermissions', {})
            centers      = body.get('centers', [])

            if not email or not name:
                return resp(400, {'error': 'email and name are required'})

            attrs = [
                {'Name': 'email',              'Value': email},
                {'Name': 'email_verified',     'Value': 'true'},
                {'Name': 'name',               'Value': name},
                {'Name': 'custom:role',        'Value': role},
                {'Name': 'custom:department',  'Value': department},
            ]
            if permissions:
                attrs.append({'Name': 'custom:permissions', 'Value': json.dumps(permissions)})
            if centers:
                # Store as JSON array for backward compat, but UI only sends one center now
                attrs.append({'Name': 'custom:centers', 'Value': json.dumps(centers) if isinstance(centers, list) else json.dumps([centers])})

            cognito.admin_create_user(
                UserPoolId=USER_POOL_ID,
                Username=email,
                TemporaryPassword=temp_pass,
                UserAttributes=attrs,
                MessageAction='SUPPRESS'
            )
            return resp(201, {'message': 'User created', 'email': email, 'temporaryPassword': temp_pass})

        # PUT /users/{username} — update role/department/status/centers
        if method == 'PUT' and '/users/' in path:
            username   = path.split('/users/')[-1]
            role       = body.get('role')
            department = body.get('department')
            enabled    = body.get('enabled')
            centers    = body.get('centers')

            if role or department or centers is not None:
                attrs = []
                if role:       attrs.append({'Name': 'custom:role',       'Value': role})
                if department: attrs.append({'Name': 'custom:department', 'Value': department})
                if centers is not None:
                    attrs.append({'Name': 'custom:centers', 'Value': json.dumps(centers)})
                if 'permissions' in body:
                    attrs.append({'Name': 'custom:permissions', 'Value': json.dumps(body['permissions'])})
                if attrs:
                    cognito.admin_update_user_attributes(
                        UserPoolId=USER_POOL_ID,
                        Username=username,
                        UserAttributes=attrs
                    )
            elif 'permissions' in body:
                cognito.admin_update_user_attributes(
                    UserPoolId=USER_POOL_ID,
                    Username=username,
                    UserAttributes=[{'Name': 'custom:permissions', 'Value': json.dumps(body['permissions'])}]
                )

            if enabled is not None:
                if enabled:
                    cognito.admin_enable_user(UserPoolId=USER_POOL_ID, Username=username)
                else:
                    cognito.admin_disable_user(UserPoolId=USER_POOL_ID, Username=username)

            return resp(200, {'message': 'User updated'})

        # DELETE /users/{username} — delete user
        if method == 'DELETE' and '/users/' in path:
            username = path.split('/users/')[-1]
            cognito.admin_delete_user(UserPoolId=USER_POOL_ID, Username=username)
            return resp(200, {'message': 'User deleted'})

        return resp(404, {'error': 'Not found'})

    except cognito.exceptions.UsernameExistsException:
        return resp(409, {'error': 'User with this email already exists'})
    except Exception as e:
        return resp(500, {'error': str(e)})
