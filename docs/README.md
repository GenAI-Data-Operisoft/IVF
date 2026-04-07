# Cloudnine IVF Witness Capture System

A production-grade IVF witness capture and validation system built for Cloudnine Hospital.

## Overview

This system provides AI-powered label validation for IVF procedures, ensuring patient safety through automated OCR and data matching across all critical stages.

## Architecture

- **Frontend**: React (hosted on AWS CloudFront + S3)
- **Backend**: AWS Lambda (Python 3.12) + API Gateway
- **Database**: AWS DynamoDB (10 tables)
- **Auth**: AWS Cognito
- **AI/OCR**: Amazon Bedrock (Qwen3 VL 235B)
- **Storage**: AWS S3

## IVF Stages

1. Label Validation
2. Oocyte Collection
3. Denudation
4. Male Sample Collection
5. ICSI
6. ICSI Documentation
7. Culture

## Setup

### Frontend

```bash
cd ivf-witness-capture-frontend
cp .env.example .env.local
# Fill in your values in .env.local
npm install
npm start
```

### Environment Variables

See `ivf-witness-capture-frontend/.env.example` for required configuration.

### Lambda Functions

All Lambda functions are in `backup/lambda-functions/`. Each requires environment variables set in AWS Lambda console (no credentials in code).

## User Roles

| Role | Permissions |
|------|-------------|
| admin | Full access + Audit Log |
| supervisor | Full access + Audit Log |
| nurse | Full access, no Audit Log |
| viewer | View only |

## Security

- No AWS credentials in code — IAM roles used
- Cognito authentication on all endpoints
- Presigned S3 URLs (time-limited)
- All console.log statements removed from production

## License

Private — Cloudnine Hospital
