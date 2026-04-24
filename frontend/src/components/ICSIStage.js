/**
 * ICSI/IVF Stage — 3 sections:
 *   1. Procedure type dropdown (ICSI / IVF / ICSI & IVF Both)
 *   2. Label validation (reuses StageCapture embedded)
 *   3. Annotated microscopic image upload + remark
 */
import React, { useState, useEffect } from 'react';
import { api } from '../api';
import { STAGES } from '../config';
import StageCapture from './StageCapture';
import usePermissionStore from '../store/permissionStore';

const ICSI_STAGE = STAGES.find(s => s.id === 'icsi');

const PROCEDURE_OPTIONS = [
  { value: 'ICSI', label: 'ICSI', desc: 'Intracytoplasmic Sperm Injection' },
  { value: 'IVF', label: 'IVF', desc: 'In Vitro Fertilization' },
  { value: 'ICSI_IVF', label: 'ICSI & IVF Both', desc: 'Both procedures performed' },
];

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

function ICSIStage({ sessionId, caseData, onComplete, onViewStatus }) {
  const { canUploadImage } = usePermissionStore();
  const showUpload = canUploadImage();

  // Section 1 — procedure type
  const [procedureType, setProcedureType] = useState('');
  const [savingProcedure, setSavingProcedure] = useState(false);
  const [procedureSaved, setProcedureSaved] = useState(false);

  // Section 2 — validation (StageCapture embedded)
  const icsiStatus = caseData?.stages?.icsi?.status;
  const [validationDone, setValidationDone] = useState(
    icsiStatus === 'completed' || icsiStatus === 'failed'
  );

  // Section 3 — annotated microscopic image + remark
  const [uploading, setUploading] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [annotatedImages, setAnnotatedImages] = useState([]);
  const [remark, setRemark] = useState('');
  const [existingRemark, setExistingRemark] = useState('');
  const [savingRemark, setSavingRemark] = useState(false);
  const [remarkSaved, setRemarkSaved] = useState(false);
  const [completing, setCompleting] = useState(false);
  const [error, setError] = useState(null);

  // Video upload state
  const [videoFile, setVideoFile] = useState(null);
  const [videoPreviewUrl, setVideoPreviewUrl] = useState(null);
  const [videoUploading, setVideoUploading] = useState(false);
  const [videoUploaded, setVideoUploaded] = useState(false);
  const [videoS3Key, setVideoS3Key] = useState(null);
  const [existingVideoUrl, setExistingVideoUrl] = useState(null);

  useEffect(() => {
    loadExistingData();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId]);

  const loadExistingData = async () => {
    try {
      const data = await api.getICSIStageData(sessionId);
      if (data.procedure_type) setProcedureType(data.procedure_type);
      setRemark(data.remark || '');
      setExistingRemark(data.remark || '');
      // Load existing video
      if (data.video_s3_key) {
        setVideoS3Key(data.video_s3_key);
        setVideoUploaded(true);
        try {
          const { downloadUrl } = await api.getImageDownloadUrl(data.video_s3_key);
          setExistingVideoUrl(downloadUrl);
        } catch {}
      }
      const imgData = await api.getAnnotatedImages(sessionId, 'icsi_documentation');
      setAnnotatedImages(imgData.images || []);
    } catch { /* no data yet */ }
  };

  const handleProcedureChange = async (val) => {
    setProcedureType(val);
    setSavingProcedure(true);
    try {
      await api.saveICSIStageData(sessionId, { procedure_type: val, remark });
      setProcedureSaved(true);
      setTimeout(() => setProcedureSaved(false), 2000);
    } catch { /* silent */ }
    finally { setSavingProcedure(false); }
  };

  const handleValidationDone = () => setValidationDone(true);

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

  const handleImageUpload = async (e) => {
    const rawFile = e.target.files[0];
    if (!rawFile) return;
    setUploading(true);
    setError(null);
    try {
      const file = await compressImage(rawFile);
      const imageNumber = annotatedImages.length + 1;
      const { uploadUrl } = await api.getPresignedUrlForAnnotatedImage(sessionId, imageNumber, 'icsi');
      await api.uploadImage(uploadUrl, file);
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
    const poll = async () => {
      try {
        const data = await api.getAnnotatedImages(sessionId, 'icsi_documentation');
        const newImage = data.images.find(img => img.oocyte_number === imageNumber);
        if (newImage && newImage.annotation_status === 'completed') {
          setAnnotatedImages(data.images);
          setProcessing(false);
          return;
        }
        attempts++;
        if (attempts < 45) setTimeout(poll, 2000);
        else { setError('Annotation timeout. Please refresh.'); setProcessing(false); }
      } catch (err) { setError(err.message); setProcessing(false); }
    };
    poll();
  };

  const handleVideoSelect = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setVideoFile(file);
    setVideoPreviewUrl(URL.createObjectURL(file));
    setVideoUploaded(false);
  };

  const handleVideoUpload = async () => {
    if (!videoFile) return;
    setVideoUploading(true);
    setError(null);
    try {
      // Get presigned URL for video upload
      const { uploadUrl, s3Key } = await api.getPresignedUrlForAnnotatedImage(sessionId, 999, 'icsi-video');
      // Upload video directly — no compression on frontend (S3 handles large files)
      const response = await fetch(uploadUrl, {
        method: 'PUT',
        headers: {
          'Content-Type': videoFile.type || 'video/mp4',
          'x-amz-server-side-encryption': 'AES256'
        },
        body: videoFile,
      });
      if (!response.ok) throw new Error('Video upload failed');
      setVideoS3Key(s3Key);
      setVideoUploaded(true);
      // Save video reference in stage data
      await api.saveICSIStageData(sessionId, { procedure_type: procedureType, remark, video_s3_key: s3Key });
    } catch (err) {
      setError('Video upload failed: ' + err.message);
    } finally {
      setVideoUploading(false);
    }
  };

  const handleSaveRemark = async () => {
    setSavingRemark(true);
    try {
      await api.saveICSIStageData(sessionId, { procedure_type: procedureType, remark });
      setExistingRemark(remark);
      setRemarkSaved(true);
      setTimeout(() => setRemarkSaved(false), 3000);
    } catch { setError('Failed to save remark.'); }
    finally { setSavingRemark(false); }
  };

  const handleComplete = async () => {
    if (!procedureType) { setError('Please select a procedure type first.'); return; }
    setCompleting(true);
    try {
      await api.saveICSIStageData(sessionId, { procedure_type: procedureType, remark });
      await api.completeStage(sessionId, 'icsi');
      onComplete();
    } catch { setError('Failed to complete. Please try again.'); }
    finally { setCompleting(false); }
  };

  const sectionStyle = (active) => ({
    background: '#fff',
    border: `1.5px solid ${active ? '#667eea' : '#e2e8f0'}`,
    borderRadius: '14px', padding: '1.5rem', marginBottom: '1.5rem',
    boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
  });

  const sectionHeader = (num, title, subtitle) => (
    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '1rem' }}>
      <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: 'linear-gradient(135deg,#667eea,#764ba2)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 700, fontSize: '0.9rem', flexShrink: 0 }}>
        {num}
      </div>
      <div>
        <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 700, color: '#1a202c' }}>{title}</h3>
        {subtitle && <p style={{ margin: 0, fontSize: '0.8rem', color: '#64748b' }}>{subtitle}</p>}
      </div>
    </div>
  );

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
            <h2 style={{ margin: 0, fontSize: '1.5rem', fontWeight: 700, color: '#1a202c' }}>ICSI/IVF</h2>
            <p style={{ margin: 0, fontSize: '0.82rem', color: '#64748b' }}>Select procedure type, validate label, and capture microscopic image</p>
          </div>
        </div>
        <button onClick={onViewStatus} className="btn-secondary" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
          <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><rect x="8" y="2" width="8" height="4" rx="1" ry="1"/></svg>
          View All Stages
        </button>
      </div>

      {error && (
        <div style={{ background: '#ffebee', color: '#c62828', padding: '0.75rem 1rem', borderRadius: '8px', marginBottom: '1rem', fontSize: '0.85rem', borderLeft: '4px solid #f44336' }}>
          {error}
        </div>
      )}

      {/* ── SECTION 1: Procedure Type ── */}
      <div style={sectionStyle(true)}>
        {sectionHeader('1', 'Select Procedure Type', 'Choose the procedure being performed')}
        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
          {PROCEDURE_OPTIONS.map(opt => (
            <button
              key={opt.value}
              type="button"
              onClick={() => handleProcedureChange(opt.value)}
              style={{
                padding: '0.65rem 1.25rem',
                borderRadius: '10px',
                border: `2px solid ${procedureType === opt.value ? '#667eea' : '#e2e8f0'}`,
                background: procedureType === opt.value ? 'linear-gradient(135deg,#667eea,#764ba2)' : '#fff',
                color: procedureType === opt.value ? 'white' : '#374151',
                fontWeight: 600, fontSize: '0.9rem', cursor: 'pointer',
                transition: 'all 0.15s',
                display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: '2px',
              }}
            >
              <span>{opt.label}</span>
              <span style={{ fontSize: '0.72rem', fontWeight: 400, opacity: 0.85 }}>{opt.desc}</span>
            </button>
          ))}
        </div>
        {procedureType && (
          <div style={{ marginTop: '0.75rem', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.82rem', color: '#16a34a' }}>
            {savingProcedure ? 'Saving...' : procedureSaved ? '✓ Saved' : `Selected: ${PROCEDURE_OPTIONS.find(o => o.value === procedureType)?.label}`}
          </div>
        )}
      </div>

      {/* ── SECTION 2: Label Validation — name changes based on procedure type ── */}
      <div style={sectionStyle(!!procedureType)}>
        {sectionHeader('2',
          procedureType === 'ICSI' ? 'ICSI Validation' :
          procedureType === 'IVF' ? 'IVF Validation' :
          procedureType === 'ICSI_IVF' ? 'ICSI & IVF Validation' :
          'Label Validation',
          'Upload label image for AI validation'
        )}
        {!procedureType ? (
          <p style={{ color: '#94a3b8', fontSize: '0.85rem', margin: 0 }}>Select a procedure type above first.</p>
        ) : (
          <StageCapture
            sessionId={sessionId}
            caseData={caseData}
            stage={ICSI_STAGE}
            onComplete={handleValidationDone}
            onViewStatus={onViewStatus}
            embedded={true}
          />
        )}
      </div>

      {/* ── SECTION 3: Annotated Microscopic Image + Remark ── */}
      <div style={sectionStyle(!!procedureType)}>
        {sectionHeader('3', 'Annotated Patient Details', 'Upload microscopic image — patient details will be annotated on it')}
        {!procedureType ? (
          <p style={{ color: '#94a3b8', fontSize: '0.85rem', margin: 0 }}>Select a procedure type above first.</p>
        ) : (
          <>
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

            {/* Upload buttons */}
            {!processing && (
              <div style={{ marginBottom: '1.25rem' }}>
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

            {/* Processing */}
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

            {/* Video Upload */}
            <div style={{ marginBottom: '1.25rem', padding: '1rem', background: '#f8fafc', border: '1.5px solid #e2e8f0', borderRadius: '10px' }}>
              <p style={{ fontWeight: 600, fontSize: '0.88rem', color: '#374151', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
                🎥 Procedure Video
              </p>
              <p style={{ fontSize: '0.78rem', color: '#64748b', marginBottom: '0.75rem' }}>
                Upload procedure video (10-15 min). Patient details will be stored with the video for reference.
              </p>

              {!videoFile && !existingVideoUrl && (
                <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
                  <label style={{ cursor: 'pointer' }}>
                    <input type="file" accept="video/*" style={{ display: 'none' }} onChange={handleVideoSelect} />
                    <span className="btn-secondary" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '0.55rem 1.1rem', fontSize: '0.88rem' }}>
                      <IconUpload /> Select Video
                    </span>
                  </label>
                  <label style={{ cursor: 'pointer' }}>
                    <input type="file" accept="video/*" capture="environment" style={{ display: 'none' }} onChange={handleVideoSelect} />
                    <span className="btn-secondary" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '0.55rem 1.1rem', fontSize: '0.88rem' }}>
                      <IconCamera /> Record Video
                    </span>
                  </label>
                </div>
              )}

              {videoFile && !videoUploaded && (
                <div>
                  <video src={videoPreviewUrl} controls style={{ width: '100%', maxHeight: '250px', borderRadius: '8px', marginBottom: '0.75rem', background: '#000' }} />
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <p style={{ fontSize: '0.78rem', color: '#64748b', margin: 0 }}>
                      {videoFile.name} ({(videoFile.size / (1024 * 1024)).toFixed(1)} MB)
                    </p>
                    <button type="button" onClick={handleVideoUpload} disabled={videoUploading} className="btn-primary"
                      style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '0.85rem' }}>
                      {videoUploading ? 'Uploading...' : '⬆ Upload Video'}
                    </button>
                    <button type="button" onClick={() => { setVideoFile(null); setVideoPreviewUrl(null); }} className="btn-secondary"
                      style={{ fontSize: '0.85rem' }}>
                      Cancel
                    </button>
                  </div>
                  {videoUploading && (
                    <div style={{ marginTop: '0.5rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <img src="https://d1nmtja0c4ok3x.cloudfront.net/IVFgif.gif" alt="" style={{ width: '24px', height: '24px' }} />
                      <span style={{ fontSize: '0.82rem', color: '#667eea', fontWeight: 600 }}>Uploading video... This may take a few minutes for large files.</span>
                    </div>
                  )}
                </div>
              )}

              {videoUploaded && (
                <div>
                  <div style={{ position: 'relative', marginBottom: '0.5rem' }}>
                    <video src={videoPreviewUrl || existingVideoUrl} controls style={{ width: '100%', maxHeight: '280px', borderRadius: '8px', background: '#000' }} />
                    {/* Patient details overlay */}
                    <div style={{ position: 'absolute', bottom: '40px', right: '8px', background: 'rgba(0,0,0,0.75)', color: 'white', padding: '6px 10px', borderRadius: '6px', fontSize: '0.72rem', lineHeight: 1.4, pointerEvents: 'none' }}>
                      <div>Male: {caseData.male_patient.name} ({caseData.male_patient.mpeid})</div>
                      <div>Female: {caseData.female_patient.name} ({caseData.female_patient.mpeid})</div>
                      <div>Procedure: {PROCEDURE_OPTIONS.find(o => o.value === procedureType)?.label || procedureType}</div>
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
                    <span style={{ fontSize: '0.82rem', color: '#16a34a', fontWeight: 600 }}>✓ Video uploaded</span>
                    <button type="button" onClick={async () => {
                      try {
                        const key = videoS3Key.startsWith('s3://') ? videoS3Key.split('/').slice(3).join('/') : videoS3Key;
                        const { downloadUrl } = await api.getImageDownloadUrl(key);
                        window.open(downloadUrl, '_blank');
                      } catch { setError('Failed to get download URL'); }
                    }} className="btn-secondary" style={{ fontSize: '0.82rem', padding: '0.35rem 0.75rem' }}>
                      ↓ Download Video
                    </button>
                    <button type="button" onClick={() => { setVideoFile(null); setVideoPreviewUrl(null); setVideoUploaded(false); setExistingVideoUrl(null); }} className="btn-secondary" style={{ fontSize: '0.82rem', padding: '0.35rem 0.75rem' }}>
                      Replace Video
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Remark */}
            <div style={{ marginBottom: '1.25rem' }}>
              <label style={{ display: 'block', fontWeight: 600, fontSize: '0.88rem', color: '#374151', marginBottom: '0.4rem' }}>
                Remark
              </label>
              <textarea
                style={{ width: '100%', padding: '0.65rem 0.85rem', border: '1.5px solid #e2e8f0', borderRadius: '8px', fontSize: '0.88rem', outline: 'none', boxSizing: 'border-box', background: '#fff', resize: 'vertical', minHeight: '80px', fontFamily: 'inherit' }}
                placeholder="Enter your observations or remarks..."
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
              <button onClick={handleComplete} disabled={completing || !procedureType} className="btn-primary"
                style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                {completing ? 'Completing...' : (
                  <>
                    <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
                    Complete ICSI/IVF Stage
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

export default ICSIStage;
