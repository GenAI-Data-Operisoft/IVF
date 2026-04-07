# IVF Witness Capture System
## Meeting Presentation & Minutes of Meeting (MOM)
**Cloudnine Hospital — Fertility Management System**
**Date:** April 3, 2026
**Prepared by:** Development Team

---

## PART 1 — MINUTES OF MEETING (MOM)

### Meeting Details

| Field | Details |
|---|---|
| Project | IVF Witness Capture System |
| Client | Cloudnine Hospital |
| Meeting Type | Product Demonstration & Feedback Session |
| Date | April 3, 2026 |
| Attendees | Client Team (Cloudnine), Development Team |

---

### Agenda

1. Full system walkthrough and live demonstration
2. Feature overview across all modules
3. Client feedback and Q&A
4. Action items and next steps

---

### Presentation Summary

The development team presented the complete IVF Witness Capture System — a production-grade, AI-powered label validation platform built for Cloudnine Hospital's fertility management workflows. The system automates patient identity verification across all critical IVF procedure stages using OCR and AI image analysis.

---

### Modules Demonstrated

#### 1. Start IVF Witness Capture
Register a new case and begin the validation process.
- Patient Registration (male and female)
- Stage-by-stage validation workflow
- ICSI Documentation with AI annotation

#### 2. View Witness Captures
Search and review previous validation sessions.
- Full session history
- Search by MPEID
- View detailed validation results per stage

#### 3. Validation Metrics
Analytics and failure reporting dashboard.
- Failure analytics by stage
- Resolution tracking
- Export reports

#### 4. Audit Log
System activity and compliance log viewer.
- Full activity tracking
- User action history
- Export logs as CSV

---

### Client Feedback Received

The following feedback was provided by the client during the demonstration:

| # | Feedback Item | Details |
|---|---|---|
| 1 | Unique MPID per patient | Every patient must have a different, unique MPID — no two patients should share the same ID |
| 2 | Automatic ID and detail capture | The patient ID and details should be captured automatically from the label image — no manual entry |
| 3 | No fixed sequence for stages | The IVF procedure steps do not need to follow a specific order — the system should allow flexible stage navigation |
| 4 | Camera capture only (no file upload) | Samples should be captured as live pictures using the device camera — file uploads from gallery/storage should not be allowed |
| 5 | Microscopic image upload from laptop | Instructions are needed for how to upload microscopic images from a laptop (e.g., from a microscope-connected PC) |
| 6 | LLM output as Pass/Fail on dashboard | The output from the AI/LLM model should be displayed clearly as either SUCCESS or FAILURE on the dashboard — no ambiguous states |

---

### Action Items

| # | Action | Owner | Priority |
|---|---|---|---|
| 1 | Enforce unique MPID validation at registration | Dev Team | High |
| 2 | Implement auto-capture of patient ID and details from label OCR | Dev Team | High |
| 3 | Remove mandatory stage sequence — allow flexible navigation | Dev Team | High |
| 4 | Restrict image input to camera capture only (disable file upload) | Dev Team | High |
| 5 | Create instructions/guide for uploading microscopic images from laptop | Dev Team | Medium |
| 6 | Update dashboard to show clear SUCCESS / FAILURE result from LLM | Dev Team | High |

---

### Decisions Made

- The system will be updated to reflect all six feedback points before the next review
- Microscopic image upload from laptop will be supported via a documented workflow (USB/screen capture method)
- The AI result display will be simplified to a binary Pass/Fail indicator on the main dashboard

---

---

## PART 2 — SYSTEM PRESENTATION DOCUMENT

---

## Project Overview

The **IVF Witness Capture System** is a cloud-native, AI-powered platform built for Cloudnine Hospital to automate patient identity validation across all stages of IVF procedures. It replaces manual witness checks with automated OCR and AI label comparison, reducing human error and ensuring patient safety.

---

## Technology Stack

| Layer | Technology |
|---|---|
| Frontend | React (AWS CloudFront + S3) |
| Backend | AWS Lambda (Python 3.12) + API Gateway |
| Database | AWS DynamoDB (10 tables) |
| Authentication | AWS Cognito |
| AI / OCR Engine | Amazon Bedrock — Qwen3 VL 235B |
| Image Storage | AWS S3 |

---

## IVF Procedure Stages Covered

The system validates patient identity at each of the following stages:

| # | Stage | Description |
|---|---|---|
| 1 | Label Validation | Initial label check at case registration |
| 2 | Oocyte Collection | Egg retrieval stage validation |
| 3 | Denudation | Cumulus cell removal stage |
| 4 | Male Sample Collection | Sperm sample label validation (dual-patient) |
| 5 | ICSI | Intracytoplasmic sperm injection stage |
| 6 | ICSI Documentation | Microscopic image capture and annotation |
| 7 | Culture | Embryo culture stage validation |

---

## Module 1 — Start IVF Witness Capture

**Purpose:** Register a new IVF case and begin the stage-by-stage validation process.

### How It Works

1. Staff registers the case by entering male and female patient details (name, MPEID)
2. The system creates a unique session ID for the case
3. Staff proceeds through each IVF stage
4. At each stage, images of sample labels are captured
5. The AI engine reads the label and compares it against registered patient data
6. Result is displayed as SUCCESS or FAILURE

### Key Features

- Patient Registration — male and female patient details captured at case start
- Stage Validation — AI-powered label matching at every procedure step
- ICSI Documentation — microscopic oocyte images captured and auto-annotated with patient info
- Flexible Navigation — stages can be completed in any order based on clinical workflow

### Validation Flow

```
Register Case → Capture Label Image → AI OCR Processing → Compare with Patient Record → SUCCESS / FAILURE
```

---

## Module 2 — View Witness Captures

**Purpose:** Search and review all previous validation sessions.

### Features

- Session History — full list of all past IVF cases with status
- Search by MPEID — quickly find a patient's session using their unique ID
- View Details — drill into any session to see stage-by-stage validation results, images, and timestamps

---

## Module 3 — Validation Metrics

**Purpose:** Analytics dashboard for monitoring system performance and failure trends.

### Features

- Failure Analytics — breakdown of validation failures by stage, date, and patient
- Resolution Tracking — tracks how failures were resolved (retake, label correction, etc.)
- Export Reports — download analytics data as CSV for compliance and review

---

## Module 4 — Audit Log

**Purpose:** Full compliance and activity log for all system events.

### Features

- Activity Tracking — every action in the system is logged with timestamp and user
- User Actions — tracks who did what and when (register, upload, validate, resolve)
- Export Logs — download audit data as CSV for regulatory compliance

### Logged Events

| Event | Description |
|---|---|
| REGISTER_CASE | New IVF case created |
| UPLOAD_IMAGE | Label image captured and uploaded |
| VALIDATION_PASS | AI confirmed patient identity match |
| VALIDATION_FAIL | AI detected mismatch in patient data |
| RESOLVE_FAILURE | Staff resolved a validation failure |
| EDIT_PATIENT | Patient details updated |
| LOGIN / LOGOUT | User authentication events |

---

## User Roles & Permissions

| Role | Permissions |
|---|---|
| Admin | Full access + Audit Log + User Management |
| Supervisor | Full access + Audit Log |
| Nurse | Full access (no Audit Log) |
| Viewer | View only |

---

## AI Validation — How It Works

1. Staff captures a photo of the sample label using the device camera
2. Image is uploaded to AWS S3 via a secure presigned URL
3. AWS Lambda triggers the AI processing pipeline
4. Amazon Bedrock (Qwen3 VL 235B) performs OCR on the label image
5. Extracted data (patient name, MPEID, date) is compared against the registered case record
6. Result is returned as **SUCCESS** (all fields match) or **FAILURE** (mismatch detected)
7. Mismatched fields are highlighted with expected vs. found values

---

## Client Feedback — Addressed Requirements

Based on the meeting feedback, the following updates are planned:

### 1. Unique MPID Per Patient
Every patient will have a unique MPID enforced at registration. The system will validate that no two patients share the same MPID before a case can be created.

### 2. Automatic ID and Detail Capture
Patient ID and details will be automatically extracted from the label image using OCR. Staff will not need to manually type patient information — the AI reads it directly from the label.

### 3. No Fixed Stage Sequence
Stages do not need to be completed in a specific order. Staff can navigate to any stage at any time based on the clinical workflow at that moment.

### 4. Camera Capture Only (No File Upload)
Sample images must be taken as live photos using the device camera. Uploading pre-existing images from the device gallery or file system will be disabled to ensure image authenticity.

### 5. Microscopic Image Upload from Laptop

For ICSI Documentation, microscopic images are captured from the micromanipulator screen. The recommended workflow for uploading from a laptop:

**Option A — Screen Capture Method**
1. Connect the microscope camera output to the laptop (HDMI or USB)
2. Use the laptop's screen capture tool (Snipping Tool / Screenshot) to capture the microscope view
3. Save the image as JPEG or PNG
4. Open the IVF system on the laptop browser
5. Use the "Upload Image" button in the ICSI Documentation module
6. Select the saved screenshot file

**Option B — Direct Camera Connection**
1. Connect the microscope camera directly to the laptop via USB
2. Use the microscope software to export/save the image
3. Upload via the system's file upload option in ICSI Documentation

**Option C — Mobile Capture**
1. Take a photo of the microscope screen using a mobile device
2. Use the "Take Photo" option in the ICSI Documentation module on the mobile browser

### 6. LLM Output as Pass/Fail on Dashboard
The AI result will be displayed as a clear, prominent **SUCCESS** or **FAILURE** indicator on the dashboard. No intermediate or ambiguous states will be shown. Failures will include a breakdown of which fields did not match.

---

## Security & Compliance

- All API endpoints protected by AWS Cognito authentication
- No AWS credentials stored in application code — IAM roles used
- Images stored in S3 with time-limited presigned URLs
- DynamoDB tables encrypted at rest
- CloudFront enforces HTTPS-only access
- Full audit trail for all system actions

---

## Infrastructure Summary

| Component | Details |
|---|---|
| Frontend Hosting | AWS CloudFront + S3 |
| API | AWS API Gateway (15+ endpoints) |
| Backend Functions | 19 AWS Lambda functions |
| Database | AWS DynamoDB (10 tables) |
| Image Storage | AWS S3 |
| Authentication | AWS Cognito User Pool |
| AI Model | Amazon Bedrock — Qwen3 VL 235B |
| Estimated Cost | ~$34/month |
| Expected Capacity | 700+ cases |

---

## Next Steps

1. Implement all six client feedback items
2. Share updated system for client review
3. Proceed to production deployment on Cloudnine's AWS account
4. Conduct user training for nursing and admin staff
5. Go-live

---

*Document prepared by the Development Team — Cloudnine IVF Witness Capture Project*
*April 3, 2026*
