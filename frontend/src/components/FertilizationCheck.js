/**
 * Fertilization Check (Day 1)
 * Sub 1: Patient Sample Validation — upload female label image, validate female details
 * Sub 2: Annotated microscopic image upload (patient details annotated)
 * Remark section
 */
import React, { useState, useEffect } from 'react';
import { api } from '../api';
import { STAGES } from '../config';
import StageCapture from './StageCapture';
import usePermissionStore from '../store/permissionStore';

// Use label_validation stage config for female sample validation
const FERT_STAGE = { id: 'fertilization_check', name: 'Fertilization Check (Day 1)', images: 1 };

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

function FertilizationCheck({ sessionId, caseData, onComplete, onViewStatus }) {
  const { canUploadImage } = usePermissionStore();
  const showUpload = canUploadImage();

  const fertStatus = caseData?.stages?.fertilization_check?.status;
  const [validationDone, setValidationDone] = useState(fertStatus === 'completed' || fertStatus === 'failed');

  const [uploading, setUploading] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [annotatedImages, setAnnotatedImages] = useState([]);
  const [remark, setRemark] = useState('');
  const [existingRemark, setExistingRemark] = useState('');
  const [savingRemark, setSavingRemark] = useState(false);
  const [remarkSaved, setRemarkSaved] = useState(false);
  const [completing, setCompleting] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => { loadData(); }, [sessionId]); // eslint-disable-line

  const loadData = async () => {
    try {
      const d = await api.getFertilizationData(sessionId);
      setRemark(d.remark || ''); setExistingRemark(d.remark || '');
    } catch {}
    try {
      const imgData = await api.getAnnotatedImages(sessionId, 'fertilization_check');
      setAnnotatedImages(imgData.images || []);
    } catch {}
  };

  const compressImage = (file) => new Promise((resolve) => {
    const img = new Image(); const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      const canvas = document.createElement('canvas'); const MAX = 1920;
      let { width, height } = img;
      if (width > MAX || height > MAX) { if (width > height) { height = Math.round(height * MAX / width); width = MAX; } else { width = Math.round(width * MAX / height); height = MAX; } }
      canvas.width = width; canvas.height = height;
      canvas.getContext('2d').drawImage(img, 0, 0, width, height);
      canvas.toBlob((blob) => resolve(new File([blob], file.name.replace(/\.[^.]+$/, '.jpg'), { type: 'image/jpeg' })), 'image/jpeg', 0.88);
    };
    img.onerror = () => { URL.revokeObjectURL(url); resolve(file); };
    img.src = url;
  });

  const handleImageUpload = async (e) => {
    const rawFile = e.target.files[0]; if (!rawFile) return;
    setUploading(true); setError(null);
    try {
      const file = await compressImage(rawFile);
      const imageNumber = annotatedImages.length + 1;
      const { uploadUrl } = await api.getPresignedUrlForAnnotatedImage(sessionId, imageNumber, 'fertilization-check');
      await api.uploadImage(uploadUrl, file);
      setProcessing(true);
      let attempts = 0;
      const poll = async () => {
        try {
          const data = await api.getAnnotatedImages(sessionId, 'fertilization_check');
          const newImg = data.images.find(img => img.oocyte_number === imageNumber);
          if (newImg && newImg.annotation_status === 'completed') { setAnnotatedImages(data.images); setProcessing(false); return; }
          attempts++; if (attempts < 45) setTimeout(poll, 2000); else { setError('Annotation timeout.'); setProcessing(false); }
        } catch (err) { setError(err.message); setProcessing(false); }
      };
      poll();
    } catch (err) { setError(err.message); } finally { setUploading(false); }
  };

  const handleSaveRemark = async () => {
    setSavingRemark(true);
    try { await api.saveFertilizationData(sessionId, { remark }); setExistingRemark(remark); setRemarkSaved(true); setTimeout(() => setRemarkSaved(false), 3000); }
    catch { setError('Failed to save remark.'); } finally { setSavingRemark(false); }
  };

  const handleComplete = async () => {
    setCompleting(true);
    try {
      await api.saveFertilizationData(sessionId, { remark });
      await api.completeStage(sessionId, 'fertilization_check');
      onComplete();
    } catch { setError('Failed to complete.'); } finally { setCompleting(false); }
  };

  const card = { background: '#fff', border: '1.5px solid #e2e8f0', borderRadius: '14px', padding: '1.5rem', marginBottom: '1.5rem', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' };
  const hdr = (n, t, s) => (
    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '1rem' }}>
      <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: 'linear-gradient(135deg,#667eea,#764ba2)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 700, fontSize: '0.9rem', flexShrink: 0 }}>{n}</div>
      <div><h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 700, color: '#1a202c' }}>{t}</h3>{s && <p style={{ margin: 0, fontSize: '0.8rem', color: '#64748b' }}>{s}</p>}</div>
    </div>
  );

  return (
    <div style={{ padding: '2rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <button onClick={onViewStatus} className="btn-secondary" style={{ padding: '7px 12px', display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>Back
          </button>
          <div>
            <h2 style={{ margin: 0, fontSize: '1.5rem', fontWeight: 700, color: '#1a202c' }}>Fertilization Check (Day 1)</h2>
            <p style={{ margin: 0, fontSize: '0.82rem', color: '#64748b' }}>Validate female sample and capture microscopic image</p>
          </div>
        </div>
        <button onClick={onViewStatus} className="btn-secondary" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
          <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><rect x="8" y="2" width="8" height="4" rx="1" ry="1"/></svg>View All Stages
        </button>
      </div>

      {error && <div style={{ background: '#ffebee', color: '#c62828', padding: '0.75rem 1rem', borderRadius: '8px', marginBottom: '1rem', fontSize: '0.85rem', borderLeft: '4px solid #f44336' }}>{error}</div>}

      {/* Sub 1: Patient Sample Validation */}
      <div style={card}>
        {hdr('1', 'Patient Sample Validation', 'Upload female patient label image for validation')}
        <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '0.75rem 1rem', marginBottom: '1rem', fontSize: '0.82rem' }}>
          <strong>Female Patient:</strong> {caseData.female_patient.name} · {caseData.female_patient.mpeid}
        </div>
        <StageCapture sessionId={sessionId} caseData={caseData} stage={FERT_STAGE} onComplete={() => setValidationDone(true)} onViewStatus={onViewStatus} embedded={true} />
      </div>

      {/* Sub 2: Annotated Microscopic Image */}
      <div style={card}>
        {hdr('2', 'Microscopic Image — Annotated', 'Upload microscopic image — patient details will be annotated on it')}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '1rem' }}>
          <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '0.65rem 0.85rem', fontSize: '0.82rem' }}>
            <p style={{ margin: '0 0 2px', fontWeight: 700 }}>Male Patient</p><p style={{ margin: 0, color: '#64748b' }}>{caseData.male_patient.name} · {caseData.male_patient.mpeid}</p>
          </div>
          <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '0.65rem 0.85rem', fontSize: '0.82rem' }}>
            <p style={{ margin: '0 0 2px', fontWeight: 700 }}>Female Patient</p><p style={{ margin: 0, color: '#64748b' }}>{caseData.female_patient.name} · {caseData.female_patient.mpeid}</p>
          </div>
        </div>
        {!processing && (
          <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', marginBottom: '0.5rem' }}>
            {showUpload && (<label style={{ cursor: 'pointer' }}><input type="file" accept="image/*" style={{ display: 'none' }} onChange={handleImageUpload} disabled={uploading} /><span className="btn-primary" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '0.5rem 1rem', fontSize: '0.85rem' }}><IconUpload />{uploading ? 'Uploading...' : 'Upload Image'}</span></label>)}
            <label style={{ cursor: 'pointer' }}><input type="file" accept="image/*" capture="environment" style={{ display: 'none' }} onChange={handleImageUpload} disabled={uploading} /><span className="btn-secondary" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '0.5rem 1rem', fontSize: '0.85rem' }}><IconCamera />{uploading ? '...' : 'Take Photo'}</span></label>
          </div>
        )}
        {processing && (<div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '0.85rem', background: '#f0f4ff', borderRadius: '8px', marginBottom: '0.75rem' }}><img src="https://d1nmtja0c4ok3x.cloudfront.net/IVFgif.gif" alt="" style={{ width: '30px', height: '30px' }} /><span style={{ fontSize: '0.85rem', color: '#667eea', fontWeight: 600 }}>Annotating image...</span></div>)}
        {annotatedImages.length > 0 && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(160px,1fr))', gap: '0.75rem', marginTop: '0.75rem' }}>
            {annotatedImages.map((img, i) => (
              <div key={img.imageId || i} style={{ border: '1.5px solid #e2e8f0', borderRadius: '10px', overflow: 'hidden' }}>
                <img src={img.download_url} alt="" style={{ width: '100%', height: '110px', objectFit: 'cover', display: 'block' }} />
                <div style={{ padding: '4px 8px', display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: '#64748b' }}>
                  <span>Image {img.oocyte_number}</span>
                  <button onClick={() => window.open(img.download_url, '_blank')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#667eea', padding: 0, fontSize: '0.75rem' }}>↓</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Remark */}
      <div style={card}>
        {hdr('3', 'Remark', 'Add observations or notes')}
        <textarea style={{ width: '100%', padding: '0.65rem 0.85rem', border: '1.5px solid #e2e8f0', borderRadius: '8px', fontSize: '0.88rem', outline: 'none', boxSizing: 'border-box', resize: 'vertical', minHeight: '75px', fontFamily: 'inherit' }}
          placeholder="Enter your observations..." value={remark} onChange={(e) => { setRemark(e.target.value); setRemarkSaved(false); }} />
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginTop: '0.5rem' }}>
          <button type="button" onClick={handleSaveRemark} disabled={savingRemark || remark === existingRemark} className="btn-secondary" style={{ fontSize: '0.85rem', opacity: remark === existingRemark ? 0.5 : 1 }}>{savingRemark ? 'Saving...' : 'Save Remark'}</button>
          {remarkSaved && <span style={{ fontSize: '0.8rem', color: '#16a34a' }}>✓ Saved</span>}
        </div>
      </div>

      <div style={{ display: 'flex', gap: '0.75rem' }}>
        <button onClick={handleComplete} disabled={completing} className="btn-primary" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
          {completing ? 'Completing...' : <><svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>Complete Fertilization Check</>}
        </button>
        <button onClick={onViewStatus} className="btn-secondary">View All Stages</button>
      </div>
    </div>
  );
}

export default FertilizationCheck;
