import { API_BASE_URL } from './config';
import { fetchUserAttributes } from 'aws-amplify/auth';

// Helper to get current user info for audit logging
const getUserInfo = async () => {
  try {
    const attributes = await fetchUserAttributes();
    return {
      userId: attributes.sub,
      userEmail: attributes.email || 'unknown',
      userName: attributes.name || attributes.email || 'unknown',
      userRole: attributes['custom:role'] || 'user'
    };
  } catch (err) {
    // If user is not authenticated, return default values and continue
    return {
      userId: 'system',
      userEmail: 'system@ivf.local',
      userName: 'System User',
      userRole: 'system'
    };
  }
};

export const api = {
  // Register new case
  registerCase: async (caseData) => {
    const userInfo = await getUserInfo();
    const response = await fetch(`${API_BASE_URL}/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...caseData,
        ...userInfo  // Include user info for audit logging
      })
    });
    if (!response.ok) throw new Error('Failed to register case');
    return response.json();
  },

  // Get presigned URL for image upload
  getPresignedUrl: async (sessionId, stage, imageNumber) => {
    const userInfo = await getUserInfo();
    const response = await fetch(`${API_BASE_URL}/presigned-url`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        sessionId, 
        stage, 
        imageNumber,
        ...userInfo  // Include user info for audit logging
      })
    });
    if (!response.ok) throw new Error('Failed to get upload URL');
    return response.json();
  },

  // Upload image to S3
  uploadImage: async (uploadUrl, imageFile) => {
    const contentType = imageFile.type || 'image/jpeg';
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30000);
    try {
      const response = await fetch(uploadUrl, {
        method: 'PUT',
        headers: {
          'Content-Type': contentType,
          'x-amz-server-side-encryption': 'AES256'
        },
        body: imageFile,
        signal: controller.signal
      });
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to upload image: ${response.status} - ${errorText}`);
      }
      return true;
    } finally {
      clearTimeout(timeout);
    }
  },

  // Get case details
  getCase: async (sessionId) => {
    const response = await fetch(`${API_BASE_URL}/case/${sessionId}`);
    if (!response.ok) throw new Error('Failed to fetch case');
    return response.json();
  },

  // Get stage extractions
  getStageExtractions: async (sessionId, stage) => {
    const response = await fetch(`${API_BASE_URL}/case/${sessionId}/stage/${stage}`);
    if (!response.ok) throw new Error('Failed to fetch stage data');
    return response.json();
  },

  // Get presigned URL for ICSI documentation image upload
  getPresignedUrlForICSIDoc: async (sessionId, imageNumber) => {
    const response = await fetch(`${API_BASE_URL}/presigned-url-icsi-doc`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId, imageNumber })
    });
    if (!response.ok) throw new Error('Failed to get upload URL');
    return response.json();
  },

  // Get annotated images for a session, optionally filtered by stage
  getAnnotatedImages: async (sessionId, stageType = null) => {
    const url = stageType
      ? `${API_BASE_URL}/sessions/${sessionId}/annotated-images?stage_type=${stageType}`
      : `${API_BASE_URL}/sessions/${sessionId}/annotated-images`;
    const response = await fetch(url);
    if (!response.ok) throw new Error('Failed to fetch annotated images');
    return response.json();
  },

  // Get presigned URL for stage-specific annotated image upload
  getPresignedUrlForAnnotatedImage: async (sessionId, imageNumber, stageFolder = 'icsi') => {
    const response = await fetch(`${API_BASE_URL}/presigned-url-icsi-doc`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId, imageNumber, stageFolder })
    });
    if (!response.ok) throw new Error('Failed to get upload URL');
    return response.json();
  },

  // Increment download count
  incrementDownloadCount: async (imageId) => {
    const response = await fetch(`${API_BASE_URL}/annotated-images/${imageId}/download`, {
      method: 'POST'
    });
    if (!response.ok) throw new Error('Failed to update download count');
    return response.json();
  },

  // Get download URL for an image
  getImageDownloadUrl: async (s3Key) => {
    const response = await fetch(`${API_BASE_URL}/presigned-url`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ download: true, s3_key: s3Key })
    });
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
      throw new Error(`Failed to get download URL: ${errorData.error || response.statusText}`);
    }
    return response.json();
  },

  // Complete a stage (mark as completed)
  completeStage: async (sessionId, stage) => {
    const response = await fetch(`${API_BASE_URL}/complete-stage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId, stage })
    });
    if (!response.ok) throw new Error('Failed to complete stage');
    return response.json();
  },

  // List recent sessions
  listSessions: async (limit = 50, userCenter = '', isAdmin = false, centerFilter = '') => {
    const params = new URLSearchParams({ limit });
    if (!isAdmin && userCenter) params.append('user_center', userCenter);
    if (isAdmin) {
      params.append('is_admin', 'true');
      if (centerFilter) params.append('center', centerFilter);
    }
    const response = await fetch(`${API_BASE_URL}/sessions?${params}`);
    if (!response.ok) throw new Error('Failed to fetch sessions');
    return response.json();
  },

  // Search sessions by MPEID or Session ID
  searchSessions: async (query, userCenter = '', isAdmin = false, centerFilter = '') => {
    const params = new URLSearchParams({ search: query });
    if (!isAdmin && userCenter) params.append('user_center', userCenter);
    if (isAdmin) {
      params.append('is_admin', 'true');
      if (centerFilter) params.append('center', centerFilter);
    }
    const response = await fetch(`${API_BASE_URL}/sessions?${params}`);
    if (!response.ok) throw new Error('Failed to search sessions');
    return response.json();
  },

  // Update patient details
  updatePatientDetails: async (sessionId, patientData) => {
    const userInfo = await getUserInfo();
    const response = await fetch(`${API_BASE_URL}/case/${sessionId}/patients`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...patientData,
        ...userInfo  // Include user info for audit logging
      })
    });
    if (!response.ok) throw new Error('Failed to update patient details');
    return response.json();
  },

  // Resolve failure record
  resolveFailure: async (sessionId, stage, resolutionData) => {
    const userInfo = await getUserInfo();
    const response = await fetch(`${API_BASE_URL}/failures/resolve`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sessionId,
        stage,
        ...resolutionData,
        ...userInfo  // Include user info for audit logging
      })
    });
    if (!response.ok) throw new Error('Failed to resolve failure');
    return response.json();
  },

  // Get metrics data
  getMetrics: async (filters) => {
    const params = new URLSearchParams();
    params.append('stage', filters.stage);
    params.append('status', filters.status);
    params.append('dateRange', filters.dateRange);
    if (filters.dateRange === 'custom' && filters.customStartDate && filters.customEndDate) {
      params.append('customStartDate', filters.customStartDate);
      params.append('customEndDate', filters.customEndDate);
    }
    const response = await fetch(`${API_BASE_URL}/metrics?${params}`);
    if (!response.ok) throw new Error('Failed to fetch metrics');
    return response.json();
  },

  // Export metrics to CSV
  exportMetrics: async (filters) => {
    const params = new URLSearchParams();
    params.append('stage', filters.stage);
    params.append('status', filters.status);
    params.append('dateRange', filters.dateRange);
    if (filters.dateRange === 'custom' && filters.customStartDate && filters.customEndDate) {
      params.append('customStartDate', filters.customStartDate);
      params.append('customEndDate', filters.customEndDate);
    }
    const response = await fetch(`${API_BASE_URL}/metrics/export?${params}`);
    if (!response.ok) throw new Error('Failed to export metrics');
    return response.text();
  },

  // Scans a patient label image using Bedrock OCR and returns
  // extracted fields (name, last_name, mpeid, dob) to auto-fill the registration form.
  scanPatientLabel: async (imageFile, patientType, modelId) => {
    const base64 = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result.split(',')[1]);
      reader.onerror = reject;
      reader.readAsDataURL(imageFile);
    });
    const response = await fetch(`${API_BASE_URL}/scan-patient-label`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ image: base64, patient_type: patientType, model_id: modelId })
    });
    if (!response.ok) throw new Error('Failed to scan label');
    return response.json();
  },

  // Chatbot
  chat: async (question) => {
    const response = await fetch(`${API_BASE_URL}/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ question })
    });
    if (!response.ok) throw new Error('Failed to get response');
    return response.json();
  },

  // ===== USER MANAGEMENT =====
  listUsers: async () => {
    const response = await fetch(`${API_BASE_URL}/users`);
    if (!response.ok) throw new Error('Failed to fetch users');
    return response.json();
  },
  createUser: async (userData) => {
    const response = await fetch(`${API_BASE_URL}/users`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(userData)
    });
    if (!response.ok) { const e = await response.json(); throw new Error(e.error || 'Failed to create user'); }
    return response.json();
  },
  updateUser: async (username, updates) => {
    const response = await fetch(`${API_BASE_URL}/users/${encodeURIComponent(username)}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates)
    });
    if (!response.ok) throw new Error('Failed to update user');
    return response.json();
  },
  deleteUser: async (username) => {
    const response = await fetch(`${API_BASE_URL}/users/${encodeURIComponent(username)}`, {
      method: 'DELETE'
    });
    if (!response.ok) throw new Error('Failed to delete user');
    return response.json();
  },

  // Log a frontend event to audit log (e.g. STOP_WAITING)
  logEvent: async (action, sessionId, stage, metadata = {}) => {
    try {
      const userInfo = await getUserInfo();
      await fetch(`${API_BASE_URL}/audit-logs`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action,
          sessionId,
          stage,
          metadata,
          result: 'info',
          ...userInfo
        })
      });
    } catch (err) {
      // Never fail the main flow if audit logging fails
    }
  },

  // ===== EMBRYO GRADING =====
  // Trigger AI grading for an oocyte image
  gradeEmbryo: async (imageId, sessionId) => {
    const response = await fetch(`${API_BASE_URL}/embryo-grading`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ imageId, sessionId })
    });
    if (!response.ok) throw new Error('AI grading failed');
    return response.json();
  },

  // Save embryologist manual grade
  saveManualGrade: async (imageId, sessionId, gradeData) => {
    const userInfo = await getUserInfo();
    const response = await fetch(`${API_BASE_URL}/embryo-grading/manual`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ imageId, sessionId, ...gradeData, ...userInfo })
    });
    if (!response.ok) throw new Error('Failed to save grade');
    return response.json();
  },

  // ===== VALIDATION OVERRIDE =====
  overrideValidation: async (sessionId, stage, overrideData) => {
    const userInfo = await getUserInfo();
    const response = await fetch(`${API_BASE_URL}/case/${sessionId}/override-validation`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ stage, ...overrideData, ...userInfo })
    });
    if (!response.ok) throw new Error('Failed to override validation');
    return response.json();
  },

  // ===== FERTILIZATION CHECK (DAY 1) =====
  saveFertilizationData: async (sessionId, data) => {
    const response = await fetch(`${API_BASE_URL}/case/${sessionId}/fertilization-check`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    if (!response.ok) throw new Error('Failed to save fertilization data');
    return response.json();
  },
  getFertilizationData: async (sessionId) => {
    const response = await fetch(`${API_BASE_URL}/case/${sessionId}/fertilization-check`);
    if (!response.ok) throw new Error('Failed to fetch fertilization data');
    return response.json();
  },

  // ===== CLEAVAGE / BLASTOCYST STAGE DATA =====
  saveEmbryoStageData: async (sessionId, stageKey, data) => {
    const response = await fetch(`${API_BASE_URL}/case/${sessionId}/embryo-stage/${stageKey}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    if (!response.ok) throw new Error('Failed to save embryo stage data');
    return response.json();
  },
  getEmbryoStageData: async (sessionId, stageKey) => {
    const response = await fetch(`${API_BASE_URL}/case/${sessionId}/embryo-stage/${stageKey}`);
    if (!response.ok) throw new Error('Failed to fetch embryo stage data');
    return response.json();
  },

  // ===== ICSI/IVF STAGE =====
  saveICSIStageData: async (sessionId, data) => {
    const response = await fetch(`${API_BASE_URL}/case/${sessionId}/icsi-stage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    if (!response.ok) throw new Error('Failed to save ICSI stage data');
    return response.json();
  },

  getICSIStageData: async (sessionId) => {
    const response = await fetch(`${API_BASE_URL}/case/${sessionId}/icsi-stage`);
    if (!response.ok) throw new Error('Failed to fetch ICSI stage data');
    return response.json();
  },

  // ===== SPERM PREPARATION REMARK =====
  saveSpermPreparationRemark: async (sessionId, remark) => {
    const response = await fetch(`${API_BASE_URL}/case/${sessionId}/sperm-preparation`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ remark })
    });
    if (!response.ok) throw new Error('Failed to save remark');
    return response.json();
  },

  getSpermPreparationRemark: async (sessionId) => {
    const response = await fetch(`${API_BASE_URL}/case/${sessionId}/sperm-preparation`);
    if (!response.ok) throw new Error('Failed to fetch remark');
    return response.json();
  },

  // ===== OOCYTE MORPHOLOGY =====
  // Get presigned URL for oocyte morphology microscopic image upload
  getPresignedUrlForOocyteMorphology: async (sessionId, imageNumber) => {
    const response = await fetch(`${API_BASE_URL}/presigned-url`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId, stage: 'denudation', imageNumber })
    });
    if (!response.ok) throw new Error('Failed to get upload URL');
    return response.json();
  },

  // Save oocyte morphology remark
  saveOocyteMorphologyRemark: async (sessionId, remark) => {
    const response = await fetch(`${API_BASE_URL}/case/${sessionId}/oocyte-impression`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ remark })
    });
    if (!response.ok) throw new Error('Failed to save remark');
    return response.json();
  },

  // Get oocyte morphology data (images + remark)
  getOocyteMorphology: async (sessionId) => {
    const response = await fetch(`${API_BASE_URL}/case/${sessionId}/oocyte-impression`);
    if (!response.ok) throw new Error('Failed to fetch oocyte morphology data');
    return response.json();
  },

  // Get audit logs
  getAuditLogs: async (filters) => {
    const params = new URLSearchParams();
    if (filters.startDate) params.append('start_date', filters.startDate + 'T00:00:00Z');
    if (filters.endDate) params.append('end_date', filters.endDate + 'T23:59:59Z');
    if (filters.action) params.append('action', filters.action);
    if (filters.stage) params.append('stage', filters.stage);
    if (filters.userEmail) params.append('user_email', filters.userEmail);
    if (filters.sessionId) params.append('session_id', filters.sessionId);
    if (filters.center) params.append('center', filters.center);
    params.append('limit', '500');
    
    const response = await fetch(`${API_BASE_URL}/audit-logs?${params}`);
    if (!response.ok) throw new Error('Failed to fetch audit logs');
    return response.json();
  }
};
