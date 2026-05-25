# IVF Witness Capture System — User Manual

---

## Table of Contents

1. [Login & Authentication](#1-login--authentication)
2. [Home Screen](#2-home-screen)
3. [Register New IVF Case](#3-register-new-ivf-case)
4. [Case Status & Navigation](#4-case-status--navigation)
5. [Stage 1 — Patient Verification](#5-stage-1--patient-verification)
6. [Stage 2 — Oocyte Collection](#6-stage-2--oocyte-collection)
7. [Stage 3 — IUI (Optional)](#7-stage-3--iui-optional)
8. [Stage 4 — Oocyte Morphology](#8-stage-4--oocyte-morphology)
9. [Stage 5 — Sperm Preparation](#9-stage-5--sperm-preparation)
10. [Stage 6 — ICSI/IVF](#10-stage-6--icsiivf)
11. [Stage 7 — Fertilization Check (Day 1)](#11-stage-7--fertilization-check-day-1)
12. [Stage 8 — Cleavage (Day 3)](#12-stage-8--cleavage-day-3)
13. [Stage 9 — Blastocyst (Day 5)](#13-stage-9--blastocyst-day-5)
14. [Stage 10 — Blastocyst (Day 6)](#14-stage-10--blastocyst-day-6)
15. [Stage 11 — Blastocyst (Day 7)](#15-stage-11--blastocyst-day-7)
16. [Stage 12 — Frozen Embryo Transfer (FET)](#16-stage-12--frozen-embryo-transfer-fet)
17. [View Details & Audit](#17-view-details--audit)
18. [Donor Cases](#18-donor-cases)
19. [Admin Features](#19-admin-features)

---

## 1. Login & Authentication

**Screen:** Login Page

`[Screenshot: Login page with Email, Password fields and Sign In button]`

**How to access:**
- Open the system URL in your browser (works on desktop, tablet, and mobile)
- You will see the "IVF Witness Capture" login screen

**Fields:**
| Field | Description |
|-------|-------------|
| Email | Your registered email address (provided by admin) |
| Password | Your account password |

**Actions:**
- Click **Sign In** to log in
- Click **"Don't have an account? Sign up"** — only if admin has enabled self-registration
- Click **"Forgot password?"** — to reset your password via email OTP

**After login:** You will be taken to the Home Screen.

---

## 2. Home Screen

**Screen:** Home / Dashboard

`[Screenshot: Home screen with "Register New Case" and "View Sessions" buttons]`

**Options available:**
| Button | Purpose |
|--------|---------|
| Register New IVF Case | Start a new patient case |
| View Sessions | See all previously registered cases |
| Social Embryo Freezing | Register a social freezing case (female only) |

---

## 3. Register New IVF Case

**Screen:** Registration Form

`[Screenshot: Registration form with Male Patient and Female Patient sections]`

**Purpose:** Register a new IVF case by entering both male and female patient details.

### Male Patient Section

| Field | Required | Description |
|-------|----------|-------------|
| Type (Self/Donor) | Yes | Select "Self" for own sperm, "Donor" for donor sperm |
| Full Name | Yes (if Self) | Patient's full name as written on lab dishes |
| MPID | Yes (if Self) | Medical Patient ID number (digits only, no "ID-" prefix) |
| Donor ID | Yes (if Donor) | Donor identification number as written on sample tube |

### Female Patient Section

| Field | Required | Description |
|-------|----------|-------------|
| Type (Self/Donor) | Yes | Select "Self" for own eggs, "Donor" for donor eggs |
| Full Name | Yes | Patient's full name (always required for records) |
| MPID | Yes | Medical Patient ID number |
| Donor Name | Yes (if Donor) | Donor's name as written on petri dish |
| Donor MPID | Yes (if Donor) | Donor's MPID as written on petri dish |
| Donor ID | Yes (if Donor) | Internal donor reference ID |
| Remark | No | Any notes about the donor |

### Other Fields

| Field | Required | Description |
|-------|----------|-------------|
| Procedure Date | Yes | Date of the IVF procedure |
| Doctor Name | Yes | Name of the treating doctor |
| AI Model | Yes | Select which AI model to use for OCR (default: Qwen3 VL 235B) |
| Center | Auto | Automatically set based on your user account |

### Scan to Verify (Optional)

Before submitting, you can scan the petri dish label to verify that what you typed matches what's written on the dish:
1. Enter Name and MPID first
2. Click **"Take Photo"** or **"Upload Image"** in the Scan to Verify section
3. The system will read the label and show ✓ match or ✗ mismatch

Click **Register Case** to create the case and proceed to Stage 1.

---

## 4. Case Status & Navigation

**Screen:** Case Status / View All Stages

`[Screenshot: Case Status page showing patient cards and stages progress]`

**What you see:**
- **Session ID** — unique identifier for this case
- **Male Patient card** — name, MPID (+ donor info if applicable)
- **Female Patient card** — name, MPID (+ donor info if applicable)
- **Stages Progress** — list of all 12 stages with status indicators

**Stage status colors:**
| Color | Meaning |
|-------|---------|
| Green ✓ | Completed — validation passed |
| Red ✗ | Failed — mismatch detected |
| Blue spinner | In progress — processing |
| Grey | Pending — not started yet |

**Actions:**
- Click any stage name to navigate to that stage
- Click **"View Details"** on completed/failed stages to see processed images and validation results
- Click **"Edit Patient Details"** to correct patient information

---

## 5. Stage 1 — Patient Verification

**Purpose:** Dish validation — verify the patient label on the first prepared dish.

**What to capture:** Photo of the petri dish label showing patient name and MPID.

**Steps:**
1. You see Male Patient and Female Patient details displayed for reference
2. Click **"Take Photo"** (camera) or **"Upload"** (gallery) to capture the dish label
3. The image is cropped (adjust crop area if needed) and uploaded
4. AI reads the label and compares against registered details
5. Result appears:
   - ✓ **Validation Successful** — name and MPID match
   - ✗ **Validation Failed** — shows which field mismatched (expected vs found)

**If validation fails:**
- Click **"Validate Again"** to retake the photo
- If the label is genuinely correct but AI misread, use **"Manual Override"** (requires justification)

---

## 6. Stage 2 — Oocyte Collection

**Purpose:** Dish validation + COC/OCC image annotated with patient name and MPID.

**Sub-sections:**
1. **Dish Label Validation** — same as Patient Verification (capture dish label photo)
2. **Annotated Patient Details** — upload microscopic COC/OCC image; system annotates it with patient name and MPID automatically

**Steps:**
1. Complete dish label validation first (left side)
2. After validation passes, the right side unlocks
3. Upload microscopic image — system annotates it with patient details
4. Annotated image appears with download option

---

## 7. Stage 3 — IUI (Optional)

**Purpose:** Male sperm sample image + Female sample image.

**Note:** This stage only appears if IUI procedure is being performed.

**Sub-sections (side by side):**
1. **Male — Sperm Sample** (left) — capture male patient label, validates against male patient details
2. **Female — Sample** (right) — capture female patient label, validates against female patient details

**Steps:**
1. Upload male sample label image → validates male name/MPID
2. Upload female sample label image → validates female name/MPID
3. Both must pass for stage to complete

---

## 8. Stage 4 — Oocyte Morphology

**Purpose:** Dish validation + Denuded oocyte image annotated with patient name and MPID.

**Sub-sections:**
1. **Step 1 — Oocyte Morphology** — upload microscopic images of denuded oocytes; system annotates with patient details
2. **Step 2 — Annotated Patient Details** — additional annotated images

**Steps:**
1. Upload microscopic oocyte images (multiple allowed)
2. Each image is automatically annotated with patient name and MPID
3. Add remark/observations if needed
4. Click **"Complete Oocyte Morphology"** when done

---

## 9. Stage 5 — Sperm Preparation

**Purpose:** Semen container image + Sperm processing tube image.

**Sub-sections (side by side):**
1. **Collection Container** (left) — capture semen container label
2. **Processed Sperm Sample** (right) — capture processing tube label

**Steps:**
1. Upload collection container label → validates male patient name/MPID
2. Upload processed sperm sample label → validates male patient name/MPID
3. Add remark if needed
4. Both validations must pass

---

## 10. Stage 6 — ICSI/IVF

**Purpose:** Dish validation + ICSI images annotated with patient name and MPID.

**Sub-sections:**
1. **Procedure Type** — select ICSI or IVF
2. **Dish Label Validation** — capture ICSI dish label
3. **Annotated Microscopic Images** — upload ICSI procedure images; system annotates with patient details

**Steps:**
1. Select procedure type (ICSI or IVF)
2. Complete dish label validation
3. Upload microscopic images of injected oocytes
4. System annotates each image with patient details
5. AI grading automatically analyzes embryo quality
6. Embryologist can add manual grade

---

## 11. Stage 7 — Fertilization Check (Day 1)

**Purpose:** Dish validation + Fertilized oocyte annotated with patient name and MPID.

**Note:** From this stage onwards, validation is always against the **real patient** details (not donor).

**Sub-sections:**
1. **Patient Sample Validation** — capture dish label showing female patient name/MPID
2. **Microscopic Image — Annotated** — upload fertilized oocyte image; system annotates with patient details

**Steps:**
1. Upload dish label photo → validates female patient name/MPID
2. Upload microscopic image of fertilized oocyte
3. System annotates image with both male and female patient details
4. Add fertilization data (2PN count, etc.) if needed

---

## 12. Stage 8 — Cleavage (Day 3)

**Purpose:** Dish validation + Day 3 embryo images annotated with patient name and MPID.

**Sub-sections:**
1. **Sample Validation** — dish label validation (female patient)
2. **Annotated Microscopic Images** — upload Day 3 embryo images
3. **Embryo Transfer** (optional) — if transfer is done on Day 3
4. **Cryopreservation** (optional) — if embryos are frozen

**Steps:**
1. Complete dish label validation
2. Upload embryo microscopic images → system annotates with patient details
3. AI grades each embryo automatically
4. Embryologist adds manual grade
5. If transferring: upload transfer tube images
6. If freezing: record cryopreservation details (viso color, can, position)

---

## 13. Stage 9 — Blastocyst (Day 5)

**Purpose:** Dish validation + Blastocyst images annotated with patient name and MPID.

**Same structure as Day 3** — dish validation, annotated images, optional transfer, optional cryopreservation.

---

## 14. Stage 10 — Blastocyst (Day 6)

**Purpose:** Dish validation + Blastocyst images annotated with patient name and MPID.

**Same structure as Day 5.**

---

## 15. Stage 11 — Blastocyst (Day 7)

**Purpose:** Dish validation + Blastocyst images annotated with patient name and MPID.

**Same structure as Day 5.**

---

## 16. Stage 12 — Frozen Embryo Transfer (FET)

**Purpose:** Cryostraw validation + Thawed embryo images annotated with patient name and MPID.

**Sub-sections:**
1. **Cryostraw Validation** — capture cryostraw label; validates female patient name/MPID
2. **Annotated Microscopic Images** — upload thawed embryo images; system annotates with patient details

**Steps:**
1. Upload cryostraw label photo → validates female patient
2. Upload thawed embryo microscopic images
3. System annotates with patient details
4. Add remark if needed
5. Click **"Complete FET"**

---

## 17. View Details & Audit

**How to view processed data for any stage:**
1. Go to Case Status (click "View All Stages")
2. Find the completed stage
3. Click **"View Details"**
4. You will see:
   - Original captured image
   - AI-extracted text (name, MPID found)
   - Validation result (match/mismatch)
   - Timestamp of when it was processed

**Audit Log (Admin only):**
- Tracks every action: uploads, validations, overrides, retries
- Filterable by date, stage, user, action type
- Exportable for compliance reporting

---

## 18. Donor Cases

When a case is registered with a donor:

**Female Donor:**
- Stages 1–6 (Patient Verification → ICSI/IVF): System validates against **Donor Name + Donor MPID** (what's written on the dish)
- Stages 7–12 (Fertilization Check → FET): System validates against **Real Patient Name + MPID** (dish now has real patient details)

**Male Donor:**
- Only **Sperm Preparation** stage validates against **Donor ID** (what's on the tube)
- All other stages validate against real patient details as normal

**Visual indicator:** On every stage, donor details are shown in a yellow badge below the patient card so you always know what to expect on the dish.

---

## 19. Admin Features

**User Management:**
- Create new users with email, role, and center assignment
- Edit user roles and permissions
- Disable/delete users

**Metrics Dashboard:**
- View validation pass/fail rates by stage
- Filter by date range, stage, status
- Export to CSV

**Roles:**
| Role | Permissions |
|------|-------------|
| Admin | Full access — manage users, view all centers, override validations |
| Embryologist | Upload images, validate, add grades and remarks |
| Viewer | View-only access to case data |

---

## Quick Reference — What to Capture at Each Stage

| Stage | What to Photograph |
|-------|-------------------|
| Patient Verification | Petri dish label |
| Oocyte Collection | Dish label + COC/OCC microscopic image |
| IUI | Male sample label + Female sample label |
| Oocyte Morphology | Dish label + Denuded oocyte microscopic image |
| Sperm Preparation | Semen container label + Processing tube label |
| ICSI/IVF | Dish label + ICSI microscopic images |
| Fertilization Check | Dish label + Fertilized oocyte microscopic image |
| Cleavage (Day 3) | Dish label + Day 3 embryo microscopic images |
| Blastocyst (Day 5) | Dish label + Blastocyst microscopic images |
| Blastocyst (Day 6) | Dish label + Blastocyst microscopic images |
| Blastocyst (Day 7) | Dish label + Blastocyst microscopic images |
| Frozen Embryo Transfer | Cryostraw label + Thawed embryo microscopic images |

---

*For technical support, contact your system administrator.*
