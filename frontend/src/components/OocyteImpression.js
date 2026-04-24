/**
 * Oocyte Morphology — 2-step screen:
 *   Step 1: Oocyte Morphology validation (label scan + AI — reuses StageCapture)
 *   Step 2: Annotated Patient Details — microscopic image upload, patient details
 *           annotated on image (same pipeline as ICSI Documentation)
 */
import React, { useState, useEffect } from 'react';
import { api } from '../api';
import { STAGES } from '../config';
import StageCapture from './StageCapture';
import usePermissionStore from '../store/permissionStore';

const DENUDATION_STAGE = STAGES.find(s => s.id === 'denudation');

const IconCamera = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
    <circle cx="12" cy="13" r="4"/>
  </svg>
);

const IconUpload = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/>
    <polyline points="21 15 16 10 5 21"/>
  </svg>
);

function OocyteMorphology({ sessionId, caseData, onComplete, onViewStatus }) {
  const { canUploadImage } = usePermissionStore();
  const showUpload = canUploadImage();

  const denudationStatus = caseData?.stages?.denudation?.status;
  const [step1Done, setStep1Done] = useState(
    denudationStatus === 'completed' || denudationStatus === 'failed'
  );

  // Step 2 state
  const [uploading, setUploading] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [annotatedImages, setAnnotatedImages] = useState([]);
  const [remark, setRemark] = useState('');
  const [existingRemark, setExistingRemark] = useState('');
  const [savingRemark, setSavingRemark] = useState(false);
  const [remarkSaved, setRemarkSaved] = useState(false);
  const [completing, setCompleting] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (step1Done) loadStep2Data();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step1Done]);

  const loadStep2Data = async () => {
    try {
      // Load annotated images (same table as ICSI doc)
      const data = await api.getAnnotatedImages(sessionId, 'denudation');
      // Filter only oocyte-morphology images
      setAnnotatedImages(data.images || []);
      // Load remark
      const imp = await api.getOocyteMorphology(sessionId);
      setExistingRemark(imp.remark || '');
      setRemark(imp.remark || '');
    } catch { /* no data yet */ }
  };

  const handleStep1Complete = () => setStep1Done(true);

  const compressImage = (file) => new Promise((resolve) => {
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
      canvas.width = width; canvas.height = height;
      canvas.getContext('2d').drawImage(img, 0, 0, width, height);
      const quality = file.size < 1024 * 1024 ? 0.92 : 0.85;
      canvas.toBlob(
        (blob) => resolve(new File([blob], file.name.replace(/\.[^.]+$/, '.jpg'), { type: 'image/jpeg' })),
        'image/jpeg', quality
      );
    };
    img.onerror = () => { URL.revokeObjectURL(url); resolve(file); };
    img.src = url;
  });

  // Upload via ICSI doc presigned URL — same S3 path triggers same annotation Lambda
  const handleImageUpload = async (e) => {
    const rawFile = e.target.files[0];
    if (!rawFile) return;
    setUploading(true);
    setError(null);
    try {
      const file = await compressImage(rawFile);
      const imageNumber = annotatedImages.length + 1;
      const { uploadUrl } = await api.getPresignedUrlForAnnotatedImage(sessionId, imageNumber, 'oocyte-morphology');
      await api.uploadImage(uploadUrl, file);
      // Start polling for annotated result
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
        const data = await api.getAnnotatedImages(sessionId, 'denudation');
        const newImage = data.images.find(img => img.oocyte_number === imageNumber);
        if (newImage && newImage.annotation_status === 'completed') {
          setAnnotatedImages(data.images);
          setProcessing(false);
          return;
        }
        attempts++;
        if (attempts < maxAttempts) setTimeout(poll, 2000);
        else { setError('Annotation timeout. Please refresh.'); setProcessing(false); }
      } catch (err) {
        setError(err.message); setProcessing(false);
      }
    };
    poll();
  };

  const handleSaveRemark = async () => {
    setSavingRemark(true);
    try {
      await api.saveOocyteMorphologyRemark(sessionId, remark);
      setExistingRemark(remark);
      setRemarkSaved(true);
      setTimeout(() => setRemarkSaved(false), 3000);
    } catch { setError('Failed to save remark.'); }
    finally { setSavingRemark(false); }
  };

  const handleComplete = async () => {
    if (annotatedImages.length === 0) {
      setError('Please upload at least one microscopic image.');
      return;
    }
    setCompleting(true);
    try {
      if (remark !== existingRemark) await api.saveOocyteMorphologyRemark(sessionId, remark);
      await api.completeStage(sessionId, 'denudation');
      onComplete();
    } catch { setError('Failed to complete. Please try again.'); }
    finally { setCompleting(false); }
  };

  const stepBadgeStyle = (done, active) => ({
    width: '32px', height: '32px', borderRadius: '50%', flexShrink: 0,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontWeight: 700, fontSize: '0.9rem',
    background: done ? '#22c55e' : active ? 'linear-gradient(135deg,#667eea,#764ba2)' : '#e2e8f0',
    color: done || active ? 'white' : '#94a3b8',
  });

  const cardStyle = (active, done) => ({
    background: '#fff',
    border: `1.5px solid ${done ? '#22c55e' : active ? '#667eea' : '#e2e8f0'}`,
    borderRadius: '14px', padding: '1.5rem', marginBottom: '1.5rem',
    boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
    opacity: active || done ? 1 : 0.55, transition: 'all 0.2s',
  });

  return (
    <div style={{ padding: '2rem', maxWidth: 'none' }}>

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <button onClick={onViewStatus} className="btn-secondary" style={{ padding: '7px 12px', display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
            Back
          </button>
          <div>
            <h2 style={{ margin: 0, fontSize: '1.5rem', fontWeight: 700, color: '#1a202c' }}>Oocyte Morphology</h2>
            <p style={{ margin: 0, fontSize: '0.82rem', color: '#64748b' }}>Complete both steps to finish this stage</p>
          </div>
        </div>
        <button onClick={onViewStatus} className="btn-secondary" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
          <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><rect x="8" y="2" width="8" height="4" rx="1" ry="1"/></svg>
          View All Stages
        </button>
      </div>

      {/* Step indicator */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.5rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div style={stepBadgeStyle(step1Done, !step1Done)}>{step1Done ? '✓' : '1'}</div>
          <span style={{ fontWeight: 600, fontSize: '0.9rem', color: step1Done ? '#16a34a' : '#667eea' }}>
            Oocyte Morphology
          </span>
        </div>
        <div style={{ flex: 1, height: '2px', background: step1Done ? '#22c55e' : '#e2e8f0', borderRadius: '2px' }} />
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div style={stepBadgeStyle(false, step1Done)}>2</div>
          <span style={{ fontWeight: 600, fontSize: '0.9rem', color: step1Done ? '#667eea' : '#94a3b8' }}>
            Annotated Patient Details
          </span>
        </div>
      </div>

      {/* ── STEP 1: Oocyte Morphology Validation ── */}
      <div style={cardStyle(!step1Done, step1Done)}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '1rem' }}>
          <div style={stepBadgeStyle(step1Done, !step1Done)}>{step1Done ? '✓' : '1'}</div>
          <div>
            <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 700, color: '#1a202c' }}>
              Step 1 — Oocyte Morphology
            </h3>
            <p style={{ margin: 0, fontSize: '0.8rem', color: '#64748b' }}>
              {step1Done ? 'Validation complete' : 'Upload label image for AI validation'}
            </p>
          </div>
          {step1Done && (
            <span style={{ marginLeft: 'auto', background: '#dcfce7', color: '#16a34a', padding: '3px 12px', borderRadius: '12px', fontSize: '0.78rem', fontWeight: 700 }}>
              ✓ Done
            </span>
          )}
        </div>
        <StageCapture
          sessionId={sessionId}
          caseData={caseData}
          stage={DENUDATION_STAGE}
          onComplete={handleStep1Complete}
          onViewStatus={onViewStatus}
          embedded={true}
        />
      </div>

      {/* ── STEP 2: Annotated Patient Details ── */}
      <div style={cardStyle(step1Done, false)}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '1rem' }}>
          <div style={stepBadgeStyle(false, step1Done)}>2</div>
          <div>
            <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 700, color: '#1a202c' }}>
              Step 2 — Annotated Patient Details
            </h3>
            <p style={{ margin: 0, fontSize: '0.8rem', color: '#64748b' }}>
              {step1Done ? 'Upload microscopic image — patient details will be annotated on it' : 'Complete Step 1 first'}
            </p>
          </div>
          {!step1Done && (
            <span style={{ marginLeft: 'auto', background: '#f1f5f9', color: '#94a3b8', padding: '3px 12px', borderRadius: '12px', fontSize: '0.78rem', fontWeight: 600 }}>
              🔒 Locked
            </span>
          )}
        </div>

        {!step1Done ? (
          <p style={{ color: '#94a3b8', fontSize: '0.85rem', margin: 0 }}>
            Complete Step 1 above to unlock.
          </p>
        ) : (
          <>
            {error && (
              <div style={{ background: '#ffebee', color: '#c62828', padding: '0.75rem 1rem', borderRadius: '8px', marginBottom: '1rem', fontSize: '0.85rem', borderLeft: '4px solid #f44336' }}>
                {error}
              </div>
            )}

            {/* Patient info */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1.25rem' }}>
              <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '0.85rem 1rem' }}>
                <p style={{ margin: '0 0 4px', fontWeight: 700, fontSize: '0.82rem', color: '#374151' }}>Male Patient</p>
                <p style={{ margin: 0, fontSize: '0.82rem', color: '#64748b' }}>{caseData.male_patient.name} · {caseData.male_patient.mpeid}</p>
              </div>
              <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '0.85rem 1rem' }}>
                <p style={{ margin: '0 0 4px', fontWeight: 700, fontSize: '0.82rem', color: '#374151' }}>Female Patient</p>
                <p style={{ margin: 0, fontSize: '0.82rem', color: '#64748b' }}>{caseData.female_patient.name} · {caseData.female_patient.mpeid}</p>
              </div>
            </div>

            {/* Upload */}
            {!processing && (
              <div style={{ marginBottom: '1.25rem' }}>
                <p style={{ fontWeight: 600, fontSize: '0.88rem', color: '#374151', marginBottom: '0.6rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <IconCamera /> Capture Microscopic Image
                </p>
                <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
                  {showUpload && (
                    <label style={{ cursor: 'pointer' }}>
                      <input type="file" accept="image/jpeg,image/jpg,image/png" style={{ display: 'none' }} onChange={handleImageUpload} disabled={uploading} />
                      <span className="btn-primary" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '0.55rem 1.1rem', fontSize: '0.88rem' }}>
                        <IconUpload /> {uploading ? 'Uploading...' : 'Upload Image'}
                      </span>
                    </label>
                  )}
                  <label style={{ cursor: 'pointer' }}>
                    <input type="file" accept="image/jpeg,image/jpg,image/png" capture="environment" style={{ display: 'none' }} onChange={handleImageUpload} disabled={uploading} />
                    <span className="btn-secondary" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '0.55rem 1.1rem', fontSize: '0.88rem' }}>
                      <IconCamera /> {uploading ? 'Uploading...' : 'Take Photo'}
                    </span>
                  </label>
                </div>
                <p style={{ fontSize: '0.78rem', color: '#94a3b8', marginTop: '0.4rem' }}>
                  Patient details will be automatically annotated on the image
                </p>
              </div>
            )}

            {/* Processing spinner */}
            {processing && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '1rem', background: '#f0f4ff', borderRadius: '10px', marginBottom: '1.25rem' }}>
                <img src="https://d1nmtja0c4ok3x.cloudfront.net/IVFgif.gif" alt="Processing..." style={{ width: '36px', height: '36px', objectFit: 'contain' }} />
                <div>
                  <p style={{ margin: 0, fontWeight: 600, fontSize: '0.88rem', color: '#667eea' }}>Annotating image with patient details...</p>
                  <p style={{ margin: 0, fontSize: '0.78rem', color: '#94a3b8' }}>This takes 10–15 seconds</p>
                </div>
              </div>
            )}

            {/* Annotated images */}
            {annotatedImages.length > 0 && (
              <div style={{ marginBottom: '1.25rem' }}>
                <p style={{ fontWeight: 600, fontSize: '0.88rem', color: '#374151', marginBottom: '0.6rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
                  Annotated Images ({annotatedImages.length})
                </p>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '0.75rem' }}>
                  {annotatedImages.map((img, idx) => (
                    <div key={img.imageId || idx} style={{ border: '1.5px solid #e2e8f0', borderRadius: '10px', overflow: 'hidden', background: '#f8fafc' }}>
                      <img src={img.download_url} alt={`Annotated ${idx + 1}`} style={{ width: '100%', height: '130px', objectFit: 'cover', display: 'block' }} />
                      <div style={{ padding: '6px 10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: '0.75rem', color: '#64748b' }}>Image {img.oocyte_number}</span>
                        <button onClick={() => window.open(img.download_url, '_blank')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#667eea', fontSize: '0.75rem', padding: 0 }}>
                          ↓ Download
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Remark */}
            <div style={{ marginBottom: '1.25rem' }}>
              <label style={{ display: 'block', fontWeight: 600, fontSize: '0.88rem', color: '#374151', marginBottom: '0.4rem' }}>
                Impression / Remark
              </label>
              <textarea
                style={{ width: '100%', padding: '0.65rem 0.85rem', border: '1.5px solid #e2e8f0', borderRadius: '8px', fontSize: '0.88rem', outline: 'none', boxSizing: 'border-box', background: '#fff', resize: 'vertical', minHeight: '80px', fontFamily: 'inherit' }}
                placeholder="Enter your observations or remarks about the oocyte..."
                value={remark}
                onChange={(e) => { setRemark(e.target.value); setRemarkSaved(false); }}
              />
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginTop: '0.5rem' }}>
                <button type="button" onClick={handleSaveRemark} disabled={savingRemark || remark === existingRemark} className="btn-secondary"
                  style={{ fontSize: '0.85rem', opacity: remark === existingRemark ? 0.5 : 1 }}>
                  {savingRemark ? 'Saving...' : 'Save Remark'}
                </button>
                {remarkSaved && <span style={{ fontSize: '0.8rem', color: '#16a34a' }}>✓ Saved</span>}
              </div>
            </div>

            {/* Complete */}
            <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
              <button onClick={handleComplete} disabled={completing || annotatedImages.length === 0} className="btn-primary"
                style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                {completing ? 'Completing...' : (
                  <>
                    <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
                    Complete Oocyte Morphology
                  </>
                )}
              </button>
              <button onClick={onViewStatus} className="btn-secondary" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                View All Stages
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export default OocyteMorphology;
