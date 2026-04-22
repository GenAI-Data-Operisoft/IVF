/**
 * ICSI Documentation — captures and displays AI-annotated microscope images of injected oocytes.
 * Includes AI embryo grading and manual embryologist grading per image.
 */
import React, { useState, useEffect } from 'react';
import { api } from '../api';
import usePermissionStore from '../store/permissionStore';

const IconUpload = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/>
    <polyline points="21 15 16 10 5 21"/>
  </svg>
);

const IconCamera = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
    <circle cx="12" cy="13" r="4"/>
  </svg>
);

// ── Quality badge color ──────────────────────────────────────────────────────
const qualityColor = (q) => ({
  'Excellent': '#4caf50', 'Good': '#2196f3', 'Fair': '#ff9800', 'Poor': '#f44336'
}[q] || '#9e9e9e');

// ── AI Grading Section ───────────────────────────────────────────────────────
function AIGradingSection({ image, sessionId }) {
  const [aiGrade, setAiGrade] = useState(image.ai_grade || null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    // Auto-trigger AI grading if not already done
    if (!aiGrade && image.imageId) {
      triggerGrading();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [image.imageId]);

  const triggerGrading = async () => {
    setLoading(true);
    setError('');
    try {
      const result = await api.gradeEmbryo(image.imageId, sessionId);
      setAiGrade(result.ai_grade);
    } catch (err) {
      setError('AI analysis failed. Please retry.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ marginTop: '1rem', borderTop: '1px solid #e2e8f0', paddingTop: '1rem' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '0.75rem' }}>
        <span style={{ background: 'linear-gradient(135deg, #667eea, #764ba2)', color: 'white', padding: '2px 10px', borderRadius: '12px', fontSize: '0.72rem', fontWeight: 700, letterSpacing: '0.5px' }}>
          🤖 AI Analysis
        </span>
        <span style={{ fontSize: '0.78rem', color: '#64748b' }}>Powered by Qwen3 VL 235B</span>
      </div>

      {loading && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#667eea', fontSize: '0.85rem', padding: '0.75rem', background: '#f0f4ff', borderRadius: '8px' }}>
          <img src="https://d1nmtja0c4ok3x.cloudfront.net/IVFgif.gif" alt="Analysing..." style={{ width: '24px', height: '24px', objectFit: 'contain' }} />
          Analysing embryo image...
        </div>
      )}

      {error && !loading && (
        <div style={{ background: '#ffebee', color: '#c62828', padding: '0.75rem', borderRadius: '8px', fontSize: '0.85rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span>{error}</span>
          <button onClick={triggerGrading} style={{ background: '#c62828', color: 'white', border: 'none', borderRadius: '6px', padding: '4px 10px', cursor: 'pointer', fontSize: '0.78rem' }}>Retry</button>
        </div>
      )}

      {aiGrade && !loading && (
        <div style={{ background: '#f8faff', border: '1px solid #e0e7ff', borderRadius: '10px', padding: '1rem' }}>
          {!aiGrade.is_embryo ? (
            <div style={{ color: '#92400e', background: '#fffbeb', border: '1px solid #fde68a', borderRadius: '8px', padding: '0.75rem', fontSize: '0.85rem' }}>
              ⚠️ <strong>Not an embryo image.</strong> {aiGrade.not_embryo_reason || 'This does not appear to be an embryo or oocyte image. Please upload a microscope image of an injected oocyte.'}
            </div>
          ) : (
            <div style={{ display: 'grid', gap: '0.6rem' }}>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', alignItems: 'center' }}>
                <span style={{ background: '#e0e7ff', color: '#3730a3', padding: '3px 10px', borderRadius: '10px', fontSize: '0.78rem', fontWeight: 600 }}>{aiGrade.stage}</span>
                <span style={{ background: '#1a202c', color: 'white', padding: '3px 10px', borderRadius: '10px', fontSize: '0.82rem', fontWeight: 700 }}>{aiGrade.grade}</span>
                <span style={{ background: qualityColor(aiGrade.quality), color: 'white', padding: '3px 10px', borderRadius: '10px', fontSize: '0.78rem', fontWeight: 600 }}>{aiGrade.quality}</span>
                {aiGrade.recommendation && (
                  <span style={{
                    background: aiGrade.recommendation === 'Transfer' ? '#4caf50' : aiGrade.recommendation === 'Freeze' ? '#2196f3' : '#f44336',
                    color: 'white', padding: '3px 10px', borderRadius: '10px', fontSize: '0.78rem', fontWeight: 700
                  }}>
                    {aiGrade.recommendation === 'Transfer' ? '✓ Transfer' : aiGrade.recommendation === 'Freeze' ? '❄ Freeze' : '✕ Discard'}
                  </span>
                )}
              </div>
              {aiGrade.description && (
                <p style={{ fontSize: '0.83rem', color: '#374151', margin: 0, lineHeight: 1.5 }}>{aiGrade.description}</p>
              )}
              {aiGrade.clinical_notes && (
                <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '6px', padding: '0.5rem 0.75rem', fontSize: '0.78rem', color: '#166534' }}>
                  <strong>Clinical Notes:</strong> {aiGrade.clinical_notes}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Manual Grading Section ───────────────────────────────────────────────────
function ManualGradingSection({ image, sessionId }) {
  const [manualGrade, setManualGrade] = useState(image.manual_grade || null);
  const [editing, setEditing] = useState(!image.manual_grade);
  const [form, setForm] = useState({
    stage: image.manual_grade?.stage || '',
    grade: image.manual_grade?.grade || '',
    quality: image.manual_grade?.quality || '',
    notes: image.manual_grade?.notes || ''
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handleSave = async () => {
    if (!form.stage) { setError('Please select Embryo Stage'); return; }
    if (!form.grade.trim()) { setError('Please enter a Grade'); return; }
    setSaving(true);
    setError('');
    try {
      const result = await api.saveManualGrade(image.imageId, sessionId, form);
      setManualGrade(result.manual_grade);
      setEditing(false);
    } catch (err) {
      setError('Failed to save grade. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const inputStyle = { width: '100%', padding: '0.5rem 0.65rem', border: '1.5px solid #e2e8f0', borderRadius: '7px', fontSize: '0.85rem', outline: 'none', boxSizing: 'border-box' };

  return (
    <div style={{ marginTop: '1rem', borderTop: '1px solid #e2e8f0', paddingTop: '1rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
        <span style={{ background: '#e8f5e9', color: '#2e7d32', padding: '2px 10px', borderRadius: '12px', fontSize: '0.72rem', fontWeight: 700, letterSpacing: '0.5px' }}>
          👨‍⚕️ Embryologist Grade
        </span>
        {manualGrade && !editing && (
          <button onClick={() => setEditing(true)} style={{ background: 'none', border: '1px solid #e2e8f0', borderRadius: '6px', padding: '3px 10px', cursor: 'pointer', fontSize: '0.75rem', color: '#667eea' }}>
            Edit
          </button>
        )}
      </div>

      {!editing && manualGrade ? (
        <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '10px', padding: '0.85rem' }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', alignItems: 'center', marginBottom: '0.5rem' }}>
            <span style={{ background: '#dcfce7', color: '#166534', padding: '3px 10px', borderRadius: '10px', fontSize: '0.78rem', fontWeight: 600 }}>{manualGrade.stage}</span>
            <span style={{ background: '#166534', color: 'white', padding: '3px 10px', borderRadius: '10px', fontSize: '0.82rem', fontWeight: 700 }}>{manualGrade.grade}</span>
            {manualGrade.quality && <span style={{ background: qualityColor(manualGrade.quality), color: 'white', padding: '3px 10px', borderRadius: '10px', fontSize: '0.78rem', fontWeight: 600 }}>{manualGrade.quality}</span>}
          </div>
          {manualGrade.notes && <p style={{ fontSize: '0.8rem', color: '#374151', margin: '0 0 0.4rem' }}>{manualGrade.notes}</p>}
          <p style={{ fontSize: '0.72rem', color: '#94a3b8', margin: 0 }}>Graded by {manualGrade.graded_by} · {new Date(manualGrade.graded_at).toLocaleString()}</p>
        </div>
      ) : (
        <div style={{ background: '#f8faff', border: '1px solid #e0e7ff', borderRadius: '10px', padding: '1rem' }}>
          {error && <div style={{ background: '#ffebee', color: '#c62828', padding: '0.5rem 0.75rem', borderRadius: '6px', marginBottom: '0.75rem', fontSize: '0.82rem' }}>{error}</div>}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '0.75rem' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, color: '#374151', marginBottom: '0.3rem' }}>Embryo Stage *</label>
              <select style={inputStyle} value={form.stage} onChange={e => setForm(f => ({ ...f, stage: e.target.value }))}>
                <option value="">Select stage...</option>
                <option value="Day 3 (Cleavage)">Day 3 (Cleavage)</option>
                <option value="Day 5 (Blastocyst)">Day 5 (Blastocyst)</option>
              </select>
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, color: '#374151', marginBottom: '0.3rem' }}>Grade *</label>
              <input style={inputStyle} type="text" placeholder="e.g. Grade 2, 4AA, 3AB" value={form.grade} onChange={e => setForm(f => ({ ...f, grade: e.target.value }))} />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, color: '#374151', marginBottom: '0.3rem' }}>Quality</label>
              <select style={inputStyle} value={form.quality} onChange={e => setForm(f => ({ ...f, quality: e.target.value }))}>
                <option value="">Select quality...</option>
                <option value="Excellent">Excellent</option>
                <option value="Good">Good</option>
                <option value="Fair">Fair</option>
                <option value="Poor">Poor</option>
              </select>
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, color: '#374151', marginBottom: '0.3rem' }}>Notes</label>
              <input style={inputStyle} type="text" placeholder="Observations..." value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
            </div>
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button onClick={handleSave} disabled={saving} style={{ background: 'linear-gradient(135deg, #4caf50, #2e7d32)', color: 'white', border: 'none', borderRadius: '7px', padding: '0.5rem 1.25rem', cursor: 'pointer', fontSize: '0.85rem', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
              {saving ? 'Saving...' : '✓ Save Grade'}
            </button>
            {manualGrade && editing && (
              <button onClick={() => { setEditing(false); setError(''); }} style={{ background: 'white', color: '#64748b', border: '1px solid #e2e8f0', borderRadius: '7px', padding: '0.5rem 1rem', cursor: 'pointer', fontSize: '0.85rem' }}>
                Cancel
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function ICSIDocumentation({ sessionId, caseData, onComplete, onViewStatus }) {
  const { canUploadImage } = usePermissionStore();
  const showUpload = canUploadImage();
  const [uploadedImages, setUploadedImages] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState(null);
  const [annotatedImages, setAnnotatedImages] = useState([]);

  useEffect(() => {
    // Load existing annotated images
    loadAnnotatedImages();
  }, [sessionId]);

  const loadAnnotatedImages = async () => {
    try {
      const data = await api.getAnnotatedImages(sessionId);
      setAnnotatedImages(data.images || []);
    } catch (err) {
    }
  };

  const compressImage = (file) => {
    return new Promise((resolve) => {
      const img = new Image();
      const url = URL.createObjectURL(file);
      img.onload = () => {
        URL.revokeObjectURL(url);
        const canvas = document.createElement('canvas');
        const MAX = 1920;
        let { width, height } = img;
        if (width > MAX || height > MAX) {
          if (width > height) { height = Math.round(height * MAX / width); width = MAX; }
          else { width = Math.round(width * MAX / height); height = MAX; }
        }
        canvas.width = width;
        canvas.height = height;
        canvas.getContext('2d').drawImage(img, 0, 0, width, height);
        const quality = file.size < 1024 * 1024 ? 0.92 : 0.85;
        canvas.toBlob((blob) => resolve(new File([blob], file.name.replace(/\.[^.]+$/, '.jpg'), { type: 'image/jpeg' })), 'image/jpeg', quality);
      };
      img.onerror = () => {
        URL.revokeObjectURL(url);
        resolve(file);
      };
      img.src = url;
    });
  };

  const handleImageUpload = async (e) => {
    const rawFile = e.target.files[0];
    if (!rawFile) return;

    setUploading(true);
    setError(null);

    try {
      const file = await compressImage(rawFile);
      const imageNumber = uploadedImages.length + annotatedImages.length + 1;
      
      // Get presigned URL for original image upload
      const { uploadUrl, s3Key } = await api.getPresignedUrlForICSIDoc(
        sessionId,
        imageNumber
      );
      
      // Upload image to S3
      await api.uploadImage(uploadUrl, file);
      
      setUploadedImages([...uploadedImages, { imageNumber, s3Key, status: 'uploaded' }]);
      
      // Start polling for annotated image
      setProcessing(true);
      pollForAnnotatedImage(imageNumber);
      
    } catch (err) {
      setError(err.message);
    } finally {
      setUploading(false);
    }
  };

  const pollForAnnotatedImage = async (imageNumber) => {
    let attempts = 0;
    const maxAttempts = 45;

    const poll = async () => {
      try {
        const data = await api.getAnnotatedImages(sessionId);
        
        // Check if new image is annotated
        const newImage = data.images.find(img => img.oocyte_number === imageNumber);
        
        if (newImage && newImage.annotation_status === 'completed') {
          setAnnotatedImages(data.images);
          setProcessing(false);
          setUploadedImages([]);
          
          // Auto-complete the stage when first image is successfully annotated
          if (data.images.length === 1) {
            try {
              await api.completeStage(sessionId, 'icsi_documentation');
            } catch (err) {
              // Don't show error to user - they can still manually complete
            }
          }
          
          return;
        }

        attempts++;
        if (attempts < maxAttempts) {
          setTimeout(poll, 2000);
        } else {
          setError('Annotation timeout. Please refresh to check status.');
          setProcessing(false);
        }
      } catch (err) {
        setError(err.message);
        setProcessing(false);
      }
    };

    poll();
  };

  const handleDownload = async (image) => {
    try {
      // Get a fresh presigned URL to avoid 403 from expired URLs
      let downloadUrl = image.download_url;
      if (image.annotated_s3_path) {
        // Extract the S3 key from the s3:// path
        const s3Key = image.annotated_s3_path.replace('s3://', '').split('/').slice(1).join('/');
        const result = await api.getImageDownloadUrl(s3Key);
        downloadUrl = result.downloadUrl;
      }
      window.open(downloadUrl, '_blank');
      
      // Update download count
      await api.incrementDownloadCount(image.imageId);
    } catch (err) {
    }
  };

  const handleComplete = async () => {
    if (annotatedImages.length === 0) {
      setError('Please capture at least one injected oocyte image before proceeding.');
      return;
    }
    
    try {
      // Update stage status to completed in DynamoDB
      await api.completeStage(sessionId, 'icsi_documentation');
      onComplete();
    } catch (err) {
      setError('Failed to complete documentation. Please try again.');
    }
  };

  return (
    <div className="icsi-documentation">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
        <h2>ICSI Documentation</h2>
        <button onClick={onViewStatus} className="btn-secondary" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
          <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><rect x="8" y="2" width="8" height="4" rx="1" ry="1"/></svg>
          View All Stages
        </button>
      </div>
      <p className="stage-info">
        Session ID: <code>{sessionId}</code>
      </p>
      <p className="info-text">
        Capture images of injected oocytes from the micromanipulator screen. 
        Images will be automatically annotated with patient information.
      </p>

      {error && <div className="error-message">{error}</div>}

      <div className="patient-info">
        <div className="patient-card">
          <h4>Male Patient</h4>
          <p><strong>Name:</strong> {caseData.male_patient.name}</p>
          <p><strong>MPID:</strong> {caseData.male_patient.mpeid}</p>
        </div>
        <div className="patient-card">
          <h4>Female Patient</h4>
          <p><strong>Name:</strong> {caseData.female_patient.name}</p>
          <p><strong>MPID:</strong> {caseData.female_patient.mpeid}</p>
        </div>
      </div>

      {!processing && (
        <div className="upload-section">
          <h3 style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>
            Capture Injected Oocyte Image
          </h3>
          <div className="capture-options">
            {showUpload && (
              <label className="file-input-label">
                <input
                  type="file"
                  accept="image/jpeg,image/jpg,image/png"
                  onChange={handleImageUpload}
                  disabled={uploading}
                />
                <span className="btn-primary">
                  {uploading ? 'Uploading...' : <><IconUpload /> Upload Image</>}
                </span>
              </label>
            )}
            <label className="file-input-label">
              <input
                type="file"
                accept="image/jpeg,image/jpg,image/png"
                capture="environment"
                onChange={handleImageUpload}
                disabled={uploading}
              />
              <span className="btn-secondary">
                {uploading ? 'Uploading...' : <><IconCamera /> Take Photo</>}
              </span>
            </label>
          </div>
          <p className="small-text">
            Supported formats: JPEG, PNG | Max size: 10MB
          </p>
        </div>
      )}

      {processing && (
        <div className="processing-message">
          <img src="https://d1nmtja0c4ok3x.cloudfront.net/IVFgif.gif" alt="Processing..." style={{ width: '80px', height: '80px', objectFit: 'contain' }} />
          <p>Annotating image with patient information...</p>
          <p className="small">This may take 10-15 seconds</p>
        </div>
      )}

      {annotatedImages.length > 0 && (
        <div className="annotated-images-section">
          <h3 style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#4caf50" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
            Annotated Images ({annotatedImages.length})
          </h3>
          <div className="images-grid">
            {annotatedImages.map((image, idx) => (
              <div key={image.imageId} className="image-card">
                <div className="image-header">
                  <h4>Oocyte {image.oocyte_number}</h4>
                  <span className="image-date">
                    {new Date(image.captured_at).toLocaleString()}
                  </span>
                </div>
                <div className="image-preview">
                  <img 
                    src={image.download_url} 
                    alt={`Oocyte ${image.oocyte_number}`}
                    style={{ maxWidth: '100%', borderRadius: '4px' }}
                  />
                </div>
                <div className="image-actions">
                  <button 
                    onClick={() => handleDownload(image)}
                    className="btn-secondary"
                    style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                    Download
                  </button>
                  <span className="download-count">
                    Downloads: {image.download_count || 0}
                  </span>
                </div>

                {/* AI Grading Section */}
                <AIGradingSection image={image} sessionId={sessionId} />

                {/* Manual Embryologist Grading Section */}
                <ManualGradingSection image={image} sessionId={sessionId} />
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="completion-actions">
        <button 
          onClick={handleComplete} 
          className="btn-primary"
          disabled={annotatedImages.length === 0}
          style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
          Complete Documentation
        </button>
        <button onClick={onViewStatus} className="btn-secondary" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
          <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><rect x="8" y="2" width="8" height="4" rx="1" ry="1"/></svg>
          View All Stages
        </button>
      </div>
    </div>
  );
}

export default ICSIDocumentation;
