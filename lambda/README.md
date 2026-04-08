# IVF Witness Capture — Lambda Functions

All Lambda functions are Python 3.12, deployed on AWS Lambda, triggered via API Gateway (Cognito-authenticated).
No AWS credentials are stored in code — IAM roles are used.

## Function Reference

| File | AWS Lambda Name | Trigger | Purpose |
|---|---|---|---|
| `registration-handler.py` | IVF-RegistrationHandler | POST /register | Creates a new IVF case with male/female patient details |
| `ocr-processor.py` | IVF-OCRProcessor | S3 event (image upload) | Sends label image to Bedrock AI for OCR text extraction |
| `comparison-validator.py` | IVF-ComparisonValidator | S3 event (after OCR) | Compares extracted data against registered patient record |
| `presigned-url-generator.py` | IVF-PresignedUrlGenerator | POST /get-upload-url | Generates secure S3 presigned URLs for stage image uploads |
| `presigned-url-icsi-doc.py` | IVF-PresignedUrlICSIDoc | POST /get-icsi-upload-url | Generates presigned URLs specifically for ICSI documentation images |
| `complete-stage.py` | IVF-CompleteStage | POST /complete-stage | Marks a stage as completed in DynamoDB |
| `list-sessions.py` | IVF-ListSessions | GET /sessions | Returns all IVF sessions for the View Witness Captures screen |
| `get-audit-logs.py` | IVF-GetAuditLogs | GET /audit-logs | Fetches audit log entries with date/action/stage filters |
| `get-metrics.py` | IVF-GetMetrics | GET /metrics | Returns validation failure analytics for the Metrics dashboard |
| `get-models.py` | IVF-GetModels | GET /models | Returns available Bedrock AI models for selection |
| `image-annotator.py` | IVF-ImageAnnotator | S3 event (ICSI image upload) | Annotates ICSI microscope images with patient info overlay |
| `get-annotated-images.py` | IVF-GetAnnotatedImages | GET /annotated-images | Fetches annotated ICSI images for display |
| `get-image-download-url.py` | IVF-GetImageDownloadUrl | GET /image-download-url | Generates fresh presigned download URLs for images |
| `increment-download-count.py` | IVF-IncrementDownloadCount | POST /increment-download | Tracks download count for annotated ICSI images |
| `resolve-failure.py` | IVF-ResolveFailure | POST /resolve-failure | Records how a validation failure was resolved |
| `update-patient-details.py` | IVF-UpdatePatientDetails | PUT /update-patient | Updates patient info on an existing case |
| `audit_helper.py` | (shared utility) | Internal | Shared helper used by other Lambdas to write audit log entries |

## Environment Variables (set in AWS Lambda Console)

Each function requires these env vars — never hardcoded:
- `DYNAMODB_TABLE` — main cases table name
- `S3_BUCKET` — image storage bucket name
- `AUDIT_TABLE` — audit log table name
- `REGION` — AWS region (ap-south-1)
