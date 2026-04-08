# IVF Witness Capture System
### Cloudnine Hospital — Fertility Management System

AI-powered label validation system for IVF procedures. Ensures patient safety through automated OCR and data matching across all critical IVF stages.

---

## Project Structure

```
ivf-app-dev/
├── frontend/          React web application (deployed to AWS CloudFront + S3)
├── lambda/            AWS Lambda functions — backend API (Python 3.12)
├── cloudformation/    AWS infrastructure templates (IaC)
├── scripts/           Deployment shell scripts
├── assets/            Images, logos, GIF used by the frontend
└── docs/              Documentation, MOM, deployment guides
```

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 18 (CloudFront + S3) |
| Backend | AWS Lambda (Python 3.12) + API Gateway |
| Database | AWS DynamoDB |
| Auth | AWS Cognito |
| AI / OCR | Amazon Bedrock — Qwen3 VL 235B |
| Storage | AWS S3 |

---

## IVF Stages Validated

1. Label Validation
2. Oocyte Collection
3. Denudation
4. Male Sample Collection
5. ICSI
6. ICSI Documentation
7. Culture

---

## User Roles

| Role | Access |
|---|---|
| admin | Full access + Audit Log + User Management |
| supervisor | Full access + Audit Log |
| nurse | Full access (no Audit Log) |
| viewer | View only |

---

## Setup

### Frontend
```bash
cd frontend
cp src/aws-config.example.js src/aws-config.js
cp src/config.example.js src/config.js
# Fill in your Cognito and API values
npm install
npm start
```

### Lambda Functions
See `lambda/README.md` for full function reference.
All environment variables are set in AWS Lambda Console — no credentials in code.

### Deploy
```bash
# Deploy all AWS infrastructure
bash scripts/deploy-all-infrastructure.sh

# Deploy frontend to S3 + CloudFront
bash scripts/deploy-frontend-production.sh
```

---

## Security
- No AWS credentials in code — IAM roles only
- Cognito authentication on all API endpoints
- S3 presigned URLs (time-limited)
- DynamoDB encrypted at rest
- CloudFront enforces HTTPS only

---

*Private — Cloudnine Hospital © 2026*
