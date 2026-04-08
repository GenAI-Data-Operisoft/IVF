# Scripts

All scripts are run from the project root (ivf-app-dev/).

| Script | Purpose | Usage |
|---|---|---|
| deploy-frontend.sh | Build React app and deploy to S3 + CloudFront | `bash scripts/deploy-frontend.sh` |
| deploy-lambda.sh | Package and deploy a single Lambda function | `bash scripts/deploy-lambda.sh lambda/comparison-validator.py IVF-ComparisonValidator` |
| deploy-all-infrastructure.sh | Deploy all AWS CloudFormation stacks | `bash scripts/deploy-all-infrastructure.sh` |
| deploy-frontend-production.sh | Full production frontend deploy via CloudFormation | `bash scripts/deploy-frontend-production.sh` |
| create-admin-user.sh | Create the initial admin user in Cognito | `bash scripts/create-admin-user.sh` |
| create-user.sh | Create a new staff user in Cognito | `bash scripts/create-user.sh` |
| test-lambda.sh | Invoke a Lambda directly with a test payload | `bash scripts/test-lambda.sh IVF-UserManagement '{"httpMethod":"GET"}'` |
| view-lambda-logs.sh | Tail CloudWatch logs for a Lambda function | `bash scripts/view-lambda-logs.sh IVF-ComparisonValidator 30` |

## Common Tasks

**Deploy a Lambda update after editing source code:**
```bash
bash scripts/deploy-lambda.sh lambda/comparison-validator.py IVF-ComparisonValidator
```

**Deploy frontend after UI changes:**
```bash
bash scripts/deploy-frontend.sh
```

**Check Lambda logs after a validation failure:**
```bash
bash scripts/view-lambda-logs.sh IVF-ComparisonValidator 30
```

**Test a Lambda directly:**
```bash
bash scripts/test-lambda.sh IVF-ListSessions '{"queryStringParameters":{"limit":"5"}}'
```
