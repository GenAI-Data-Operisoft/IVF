# Cloudnine IVF Witness System — Case Study

---

## Introduction

Cloudnine Group of Hospitals is one of India's leading chains of maternity and fertility hospitals. Their IVF (In Vitro Fertilization) centers handle hundreds of cases monthly, each involving multiple laboratory stages — from oocyte collection through embryo transfer. Patient safety and sample traceability are paramount in IVF, where a single mismatch between patient identity and biological sample can have irreversible consequences.

To address this critical need, Cloudnine partnered to build an AI-powered IVF Witness System — a digital platform that automates patient identity verification at every stage of the IVF laboratory workflow.

---

## Customer Challenges

Cloudnine's embryology teams faced several operational pain points:

**Manual Paper-Based Tracking**
Embryologists relied on handwritten logs and paper checklists to track patient samples across 12+ laboratory stages. This created a heavy administrative burden, taking time away from clinical work.

**Human Error Risk in Identity Verification**
At each stage, embryologists manually cross-checked patient names and MPIDs written on petri dishes against paper records. With multiple cases running simultaneously, the risk of misidentification was ever-present.

**No Real-Time Audit Trail**
There was no digital record of who verified what, when, and at which stage. In case of a dispute or regulatory audit, reconstructing the chain of custody was time-consuming and unreliable.

**Donor Case Complexity**
Cases involving egg or sperm donors required tracking multiple identities (patient + donor) across different stages, adding another layer of manual verification complexity.

**No Standardized Workflow**
Different embryologists followed slightly different verification processes, making it difficult to enforce consistent quality standards across centers.

---

## Solution Overview

The AI-powered IVF Witness System digitizes and automates the entire identity verification workflow:

**AI-Powered OCR Validation**
At each laboratory stage, the embryologist captures a photo of the petri dish label. The system uses Amazon Bedrock vision models (Claude, Qwen3 VL) to extract the patient name and MPID from the handwritten label, then automatically compares it against the registered case data — delivering a pass/fail result in seconds.

**12-Stage Digital Workflow**
The system covers the complete IVF journey:
- Patient Verification → Oocyte Collection → Oocyte Morphology → Sperm Preparation → ICSI/IVF → Fertilization Check (Day 1) → Cleavage (Day 3) → Blastocyst (Day 5) → Day 6 → Day 7 → Frozen Embryo Transfer

Each stage has clear instructions for what images to capture, reducing ambiguity.

**Automated Image Annotation**
Microscopic embryo images are automatically annotated with patient details (name, MPID, date), creating a permanent visual record linked to the correct patient.

**Donor-Aware Validation**
The system intelligently switches validation targets based on the IVF stage — verifying donor details on early-stage dishes and real patient details on post-fertilization dishes.

**Complete Audit Trail**
Every action — uploads, validations, overrides, retries — is logged with user identity, timestamp, and outcome. This provides a complete chain of custody for regulatory compliance.

**Role-Based Access & Multi-Center Support**
Administrators can manage users, assign roles, and view metrics across multiple Cloudnine centers from a single dashboard.

**Technology Stack**
- Frontend: React (hosted on AWS CloudFront + S3)
- Backend: AWS Lambda (Python), API Gateway
- AI/ML: Amazon Bedrock (Claude Sonnet, Qwen3 VL 235B)
- Database: Amazon DynamoDB
- Storage: Amazon S3
- Auth: Amazon Cognito
- Events: Amazon EventBridge

---

## Results & Impact

**Elimination of Manual Paper Tracking**
The entire verification workflow is now digital. Embryologists no longer maintain paper logs — the system captures, validates, and records everything automatically.

**Near-Instant Identity Verification**
What previously took 30–60 seconds of manual cross-checking per stage now completes in under 5 seconds with AI-powered OCR, across all 12 stages.

**Zero-Tolerance Mismatch Detection**
The system catches even subtle discrepancies (transposed digits, misspelled names) that human eyes might miss under time pressure. Failed validations are flagged immediately with clear mismatch details.

**Complete Digital Audit Trail**
Every case now has a full digital record — who uploaded what, when it was validated, which model was used, and the exact OCR output. This satisfies regulatory requirements without additional paperwork.

**Standardized Workflow Across Centers**
All embryologists follow the same digital workflow with clear stage-by-stage instructions, ensuring consistent quality regardless of which center or shift they work in.

**Reduced Administrative Burden**
Embryologists spend less time on paperwork and more time on clinical work. The system handles identity verification, image annotation, and record-keeping automatically.

**Scalable Architecture**
Built on serverless AWS infrastructure, the system scales effortlessly as Cloudnine adds more centers and handles more cases — with no infrastructure management overhead.

---

*Built with AWS serverless architecture and Amazon Bedrock AI — delivering patient safety at the speed of clinical workflow.*
