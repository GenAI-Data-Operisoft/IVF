# IVF Witness Capture System - Complete AWS Infrastructure & Pricing

## 📋 Infrastructure Overview

### Lambda Functions (11 Total)

#### From Lambda Stack (4 functions)
| Function | Memory | Timeout | Trigger | Purpose |
|----------|--------|---------|---------|---------|
| IVF-RegistrationHandler | 256 MB | 30s | API Gateway | Patient registration |
| IVF-PresignedUrlGenerator | 256 MB | 30s | API Gateway | S3 upload URLs |
| IVF-OCRProcessor | 512 MB | 60s | EventBridge | Bedrock OCR processing |
| IVF-ComparisonValidator | 256 MB | 30s | DynamoDB Streams | Data validation |

#### From API Gateway Stack (7 functions)
| Function | Memory | Timeout | Purpose |
|----------|--------|---------|---------|
| IVF-GetCase | 128 MB | 10s | Retrieve case details |
| IVF-GetStage | 128 MB | 10s | Get stage extractions |
| IVF-UpdatePatientDetails | 128 MB | 10s | Update patient info |
| IVF-ResolveFailure | 256 MB | 30s | Record resolutions |
| IVF-GetMetrics | 512 MB | 30s | Aggregate metrics |
| IVF-ExportMetrics | 512 MB | 30s | Export to CSV |
| IVF-GetModels | 128 MB | 10s | List Bedrock models |

### DynamoDB Tables (9 Total)
1. IVF-Cases (Main records)
2. IVF-LabelValidationExtractions (+ Stream)
3. IVF-MaleSampleCollectionExtractions (+ Stream)
4. IVF-OocyteCollectionExtractions (+ Stream)
5. IVF-DenudationExtractions (+ Stream)
6. IVF-ICSIExtractions (+ Stream)
7. IVF-CultureExtractions (+ Stream)
8. IVF-ValidationFailures (3 GSIs)
9. IVF-InjectedOocyteImages

**All tables:** PAY_PER_REQUEST, Point-in-time recovery enabled

### Other Services
- S3 Bucket (Standard + Encryption)
- API Gateway (REST API)
- EventBridge (S3 triggers)
- Amazon Bedrock (OCR)
- CloudWatch Logs
- X-Ray Tracing
- IAM Roles

---

## 💰 Pricing Calculation (700 Cycles/Month)

### Usage Parameters
- **700 cycles per month**
- **20 images per cycle** = 14,000 images/month
- **2,000 input tokens per image**
- **100 output tokens per image**
- **15% failure rate** = 2,100 failures
- **1.5 retries per failure** = 3,150 retry images
- **Total images:** 17,150/month

---

### 1. Amazon Bedrock (Largest Cost) 💰

**Qwen3 VL 235B A22B (Current Model):** ⭐
- Input: 17,150 × 2,000 = 34.3M tokens × $0.00062/1K = **$21.27**
- Output: 17,150 × 100 = 1.715M tokens × $0.00313/1K = **$5.37**
- **Total: $26.64/month**
- **Features:** Vision-enabled for advanced OCR

**Qwen3 Next 80B A3B (Text-Only Alternative):**
- Input: 34.3M tokens × $0.00018/1K = **$6.17**
- Output: 1.715M tokens × $0.00141/1K = **$2.42**
- **Total: $8.59/month** (68% cheaper)

**Claude 3.5 Haiku (Comparison):**
- Input: 34.3M tokens × $0.0008/1K = **$27.44**
- Output: 1.715M tokens × $0.004/1K = **$6.86**
- **Total: $34.30/month**

**Amazon Nova Lite (Most Economical):**
- Input: 34.3M tokens × $0.00006/1K = **$2.06**
- Output: 1.715M tokens × $0.00024/1K = **$0.41**
- **Total: $2.47/month** (71% cheaper than Qwen3 Next)

---

### 2. AWS Lambda 💰

| Function | Invocations | Duration | GB-seconds |
|----------|-------------|----------|------------|
| RegistrationHandler | 700 | 1s | 175 |
| PresignedUrlGenerator | 17,150 | 0.5s | 2,144 |
| OCRProcessor | 17,150 | 15s | 128,625 |
| ComparisonValidator | 17,150 | 2s | 8,575 |
| GetCase | 2,000 | 0.2s | 50 |
| GetStage | 14,000 | 0.3s | 525 |
| UpdatePatientDetails | 350 | 0.5s | 22 |
| ResolveFailure | 2,100 | 1s | 525 |
| GetMetrics | 200 | 3s | 300 |
| ExportMetrics | 50 | 5s | 125 |
| GetModels | 700 | 0.1s | 9 |

**Total:** 54,550 invocations, 141,075 GB-seconds
- Within 400,000 GB-s free tier
- Within 1M requests free tier
- **Cost: $0.00/month** ✅

---

### 3. DynamoDB 💰

**Operations:**
- Writes: 23,100 WRUs/month
- Reads: 30,000 RRUs/month
- Storage: 0.7 GB

**Cost:**
- Writes: 23,100 × $1.4225/million = $0.033
- Reads: 30,000 × $0.285/million = $0.009
- Storage: 0.7 GB × $0.285/GB = $0.20
- **Total: $0.24/month**

---

### 4. Amazon S3 💰

**Storage:**
- Monthly uploads: 17,150 × 2 MB = 34.3 GB
- Cumulative (12 months): ~412 GB
- Average storage: ~206 GB

**Requests:**
- PUT: 17,150
- GET: 25,000
- LIST: 500

**Cost:**
- Storage: 206 GB × $0.025/GB = $5.15
- PUT: 17,150 × $0.0055/1000 = $0.094
- GET: 25,000 × $0.00044/1000 = $0.011
- LIST: 500 × $0.0055/1000 = $0.003
- **Total: $5.26/month**

**With Glacier (90-day lifecycle):**
- **Optimized: $2.54/month** (52% savings)

---

### 5. API Gateway 💰

**Requests:** 39,250/month
- Cost: 39,250 × $4.25/million = **$0.17/month**

---

### 6. CloudWatch Logs 💰

**Logs:** 818 MB/month
- Ingestion: 0.818 GB × $0.67/GB = $0.55
- Storage (7 days): 0.818 GB × $0.033/GB = $0.027
- **Total: $0.58/month**

---

### 7. Data Transfer 💰

**Outbound:** 5 GB/month
- First 1 GB free
- 4 GB × $0.109/GB = **$0.44/month**

---

### 8. EventBridge & X-Ray 💰

- EventBridge: 17,150 events (within 1M free tier)
- X-Ray: 54,550 traces (within 100K free tier)
- **Total: $0.00/month** ✅

---

## 📊 TOTAL MONTHLY COST

### Current Configuration (Qwen3 VL 235B) ⭐
| Service | Cost | % |
|---------|------|---|
| Bedrock (Qwen3 VL) | $26.64 | 77.5% |
| S3 | $5.26 | 15.3% |
| CloudWatch | $0.58 | 1.7% |
| Data Transfer | $0.44 | 1.3% |
| DynamoDB | $0.24 | 0.7% |
| API Gateway | $0.17 | 0.5% |
| Lambda | $0.00 | 0.0% |
| **TOTAL** | **$34.37** | **100%** |

### Alternative: Qwen3 Next 80B (Lighter Model)
| Service | Cost | % |
|---------|------|---|
| Bedrock (Qwen3) | $8.59 | 56.0% |
| S3 | $5.26 | 34.3% |
| CloudWatch | $0.58 | 3.8% |
| Data Transfer | $0.44 | 2.9% |
| DynamoDB | $0.24 | 1.6% |
| API Gateway | $0.17 | 1.1% |
| Lambda | $0.00 | 0.0% |
| **TOTAL** | **$15.28** | **100%** |

### Comparison: Claude 3.5 Haiku
| Service | Cost | % |
|---------|------|---|
| Bedrock (Claude) | $34.30 | 83.8% |
| S3 | $5.26 | 12.8% |
| CloudWatch | $0.58 | 1.4% |
| Data Transfer | $0.44 | 1.1% |
| API Gateway | $0.17 | 0.4% |
| DynamoDB | $0.24 | 0.6% |
| Lambda | $0.00 | 0.0% |
| **TOTAL** | **$40.99** | **100%** |

### Most Economical (Nova Lite + Glacier)
| Service | Cost | % |
|---------|------|---|
| S3 (Glacier) | $2.54 | 22.1% |
| Bedrock (Nova) | $2.47 | 21.5% |
| CloudWatch | $0.58 | 5.0% |
| Data Transfer | $0.44 | 3.8% |
| DynamoDB | $0.24 | 2.1% |
| API Gateway | $0.17 | 1.5% |
| Lambda | $0.00 | 0.0% |
| **TOTAL** | **$11.49** | **100%** |

---

## 🎯 COST PER CYCLE

### Current Configuration (Qwen3 VL 235B) ⭐
- **Monthly Cost:** $34.37
- **Cycles:** 700
- **Cost per Cycle:** **$0.0491** (~4.9 cents)

**Breakdown per cycle:**
- Bedrock: $0.0381 (77.5%)
- S3: $0.0075 (15.3%)
- Other: $0.0035 (7.2%)

### Qwen3 Next 80B Configuration (Lighter Alternative)
- **Monthly Cost:** $15.28
- **Cycles:** 700
- **Cost per Cycle:** **$0.0218** (~2.2 cents)

**Breakdown per cycle:**
- Bedrock: $0.0123 (56.0%)
- S3: $0.0075 (34.3%)
- Other: $0.0020 (9.7%)

### Claude 3.5 Haiku Configuration
- **Monthly Cost:** $40.99
- **Cycles:** 700
- **Cost per Cycle:** **$0.0586** (~5.9 cents)

**Breakdown per cycle:**
- Bedrock: $0.049 (83.8%)
- S3: $0.0075 (12.8%)
- Other: $0.002 (3.4%)

### Most Economical (Nova Lite)
- **Monthly Cost:** $11.49
- **Cycles:** 700
- **Cost per Cycle:** **$0.0164** (~1.6 cents)

**Breakdown per cycle:**
- S3: $0.0036 (22.1%)
- Bedrock: $0.0035 (21.5%)
- Other: $0.0093 (56.4%)

---

## 📈 Annual Projections

| Configuration | Monthly | Annual | vs Current |
|--------------|---------|--------|------------|
| Qwen3 VL 235B (Current) | $34.37 | $412.44 | - |
| Qwen3 Next 80B | $15.28 | $183.36 | -$229.08 (56% savings) |
| Nova Lite (Most Economical) | $11.49 | $137.88 | -$274.56 (67% savings) |
| Claude 3.5 Haiku | $40.99 | $491.88 | +$79.44 (19% more) |

---

## 📊 Scaling Analysis

| Cycles | Images | Qwen3 VL (Current) | Qwen3 Next | Nova Lite | $/Cycle (Current) |
|--------|--------|-------------------|------------|-----------|-------------------|
| 350 | 7,000 | $18.19 | $8.64 | $6.75 | $0.052 |
| 700 | 14,000 | $34.37 | $15.28 | $11.49 | $0.049 |
| 1,400 | 28,000 | $66.73 | $28.56 | $20.98 | $0.048 |
| 2,100 | 42,000 | $99.09 | $41.84 | $30.47 | $0.047 |
| 3,500 | 70,000 | $163.81 | $68.40 | $49.45 | $0.047 |

---

