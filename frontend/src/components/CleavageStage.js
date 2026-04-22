/**
 * Cleavage (Day 3) / Blastocyst (Day 5/6)
 * Sub 1: Microscopic Embryo Validation (annotated + AI grading + manual grading)
 * Sub 2: Embryo Transfer (optional)
 * Sub 3: Cryopreservation
 */
import React, { useState, useEffect } from 'react';
import { api } from '../api';
import usePermissionStore from '../store/permissionStore';
import StageCapture from './StageCapture';

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


const VISO_COLORS = ['Red', 'Blue', 'Green', 'Yellow', 'Pink', 'White', 'Orange', 'Purple'];
const CAN_OPTIONS = ['1', 'D', '2'];

function compressImg(file) {
  return new Promise((resolve) => {
    const img = new Image(); const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      const canvas = document.createElement('canvas'); const MAX = 1920;
      let { width, height } = img;
      if (width > MAX || height > MAX) { if (width > height) { height = Math.round(height * MAX / width); width = MAX; } else { width = Math.round(width * MAX / height); height = MAX; } }
      canvas.width = width; canvas.height = height;
      canvas.getContext('2d').drawImage(img, 0, 0, width, height);
      canvas.toBlob((blob) => resolve(new File([blob], file.name.replace(/[.][^.]+$/, '.jpg'), { type: 'image/jpeg' })), 'image/jpeg', 0.88);
    };
    img.onerror = () => { URL.revokeObjectURL(url); resolve(file); };
    img.src = url;
  });
}

function SectionHeader({ num, title, subtitle, badge }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '1rem' }}>
      <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: 'linear-gradient(135deg,#667eea,#764ba2)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 700, fontSize: '0.88rem', flexShrink: 0 }}>{num}</div>
      <div style={{ flex: 1 }}>
        <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 700, color: '#1a202c', display: 'flex', alignItems: 'center', gap: '8px' }}>
          {title}
          {badge && <span style={{ background: '#f1f5f9', color: '#64748b', padding: '2px 8px', borderRadius: '10px', fontSize: '0.72rem', fontWeight: 600 }}>{badge}</span>}
        </h3>
        {subtitle && <p style={{ margin: 0, fontSize: '0.8rem', color: '#64748b' }}>{subtitle}</p>}
      </div>
    </div>
  );
}

// Sample Validation + Annotated Details (two-column, reusable for Day 3, Day 5/6, FET)
function SampleValidationWithAnnotation({ sessionId, caseData, showUpload, stageKey, onViewStatus }) {
  // Use 'culture' stage ID for presigned URL — it's in STAGE_FOLDERS on the backend
  const STAGE_OBJ = { id: 'culture', name: 'Sample Validation', images: 1 };
  const cultureStatus = caseData?.stages?.culture?.status;
  const [validated, setValidated] = React.useState(cultureStatus === 'completed' || cultureStatus === 'failed');
  const [annotUploading, setAnnotUploading] = React.useState(false);
  const [annotProcessing, setAnnotProcessing] = React.useState(false);
  const [annotatedImages, setAnnotatedImages] = React.useState([]);
  const [error, setError] = React.useState(null);

  const stageType = stageKey + '_sample';

  React.useEffect(() => {
    if (validated) {
      api.getAnnotatedImages(sessionId, stageType).then(d => setAnnotatedImages(d.images || [])).catch(() => {});
    }
  }, [validated, sessionId, stageType]);

  const handleAnnotUpload = async (e) => {
    const rawFile = e.target.files[0]; if (!rawFile) return;
    setAnnotUploading(true); setError(null);
    try {
      const file = await compressImg(rawFile);
      const num = annotatedImages.length + 1;
      const { uploadUrl } = await api.getPresignedUrlForAnnotatedImage(sessionId, num, stageKey + '-sample');
      await api.uploadImage(uploadUrl, file);
      setAnnotProcessing(true);
      let attempts = 0;
      const poll = async () => {
        try {
          const data = await api.getAnnotatedImages(sessionId, stageType);
          const img = data.images.find(i => i.oocyte_number === num);
          if (img && img.annotation_status === 'completed') { setAnnotatedImages(data.images); setAnnotProcessing(false); return; }
          attempts++; if (attempts < 45) setTimeout(poll, 2000); else { setError('Annotation timeout.'); setAnnotProcessing(false); }
        } catch (err) { setError(err.message); setAnnotProcessing(false); }
      };
      poll();
    } catch (err) { setError(err.message); } finally { setAnnotUploading(false); }
  };

  return (
    <div>
      {error && <div style={{ background: '#ffebee', color: '#c62828', padding: '0.6rem 0.85rem', borderRadius: '8px', marginBottom: '0.75rem', fontSize: '0.82rem' }}>{error}</div>}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
        {/* LEFT: Sample validation */}
        <div>
          <p style={{ fontSize: '0.85rem', fontWeight: 600, color: '#374151', marginBottom: '0.4rem' }}>Dish Label Validation</p>
          <div style={{ fontSize: '0.75rem', color: '#374151', marginBottom: '0.6rem', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '6px', padding: '0.4rem 0.6rem' }}>
            <strong>Female:</strong> {caseData.female_patient.name} · {caseData.female_patient.mpeid}
          </div>
          <StageCapture sessionId={sessionId} caseData={caseData} stage={STAGE_OBJ} onComplete={() => setValidated(true)} onViewStatus={onViewStatus} embedded={true} />
        </div>
        {/* RIGHT: Annotated microscopic image */}
        <div style={{ opacity: validated ? 1 : 0.4, pointerEvents: validated ? 'auto' : 'none' }}>
          <p style={{ fontSize: '0.85rem', fontWeight: 600, color: '#374151', marginBottom: '0.4rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
            Annotated Patient Details
            {!validated && <span style={{ background: '#f1f5f9', color: '#94a3b8', padding: '1px 6px', borderRadius: '6px', fontSize: '0.68rem' }}>🔒 Validate first</span>}
          </p>
          <p style={{ fontSize: '0.75rem', color: '#64748b', marginBottom: '0.6rem' }}>Upload microscopic image — patient details annotated on it</p>
          {!annotProcessing && (
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '0.6rem' }}>
              {showUpload && (<label style={{ cursor: 'pointer' }}><input type="file" accept="image/*" style={{ display: 'none' }} onChange={handleAnnotUpload} disabled={annotUploading || !validated} /><span className="btn-primary" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '0.35rem 0.75rem', fontSize: '0.8rem' }}><IconUpload />{annotUploading ? '...' : 'Upload'}</span></label>)}
              <label style={{ cursor: 'pointer' }}><input type="file" accept="image/*" capture="environment" style={{ display: 'none' }} onChange={handleAnnotUpload} disabled={annotUploading || !validated} /><span className="btn-secondary" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '0.35rem 0.75rem', fontSize: '0.8rem' }}><IconCamera />{annotUploading ? '...' : 'Photo'}</span></label>
            </div>
          )}
          {annotProcessing && (<div style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '0.6rem', background: '#f0f4ff', borderRadius: '6px', marginBottom: '0.6rem' }}><img src="https://d1nmtja0c4ok3x.cloudfront.net/IVFgif.gif" alt="" style={{ width: '20px', height: '20px' }} /><span style={{ fontSize: '0.8rem', color: '#667eea', fontWeight: 600 }}>Annotating...</span></div>)}
          {annotatedImages.length > 0 && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(100px,1fr))', gap: '0.4rem' }}>
              {annotatedImages.map((img, i) => (
                <div key={img.imageId || i} style={{ border: '1.5px solid #e2e8f0', borderRadius: '6px', overflow: 'hidden' }}>
                  <img src={img.download_url} alt="" style={{ width: '100%', height: '70px', objectFit: 'cover', display: 'block' }} />
                  <div style={{ padding: '2px 4px', display: 'flex', justifyContent: 'space-between', fontSize: '0.65rem', color: '#64748b' }}>
                    <span>{img.oocyte_number}</span>
                    <button onClick={() => window.open(img.download_url, '_blank')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#667eea', padding: 0, fontSize: '0.65rem' }}>↓</button>
                  </div>
                </div>
              ))}
            </div>
          )}
          {annotatedImages.length === 0 && !annotProcessing && validated && <p style={{ fontSize: '0.75rem', color: '#94a3b8', margin: 0 }}>Upload microscopic image above</p>}
        </div>
      </div>
    </div>
  );
}

// Sub 2: Embryo Transfer — two-column: left=tube validation, right=annotated details (unlocks after validation)
function EmbryoTransferSection({ sessionId, caseData, showUpload, stageKey }) {
  const [uploads, setUploads] = React.useState([]);
  const [uploading, setUploading] = React.useState(false);
  const [validating, setValidating] = React.useState(false);
  const [validationResults, setValidationResults] = React.useState([]);
  const [error, setError] = React.useState(null);
  const [annotUploading, setAnnotUploading] = React.useState(false);
  const [annotProcessing, setAnnotProcessing] = React.useState(false);
  const [annotatedImages, setAnnotatedImages] = React.useState([]);

  const allPassed = validationResults.length > 0 && validationResults.every(r => r.status === 'pass');

  React.useEffect(() => {
    if (allPassed) {
      const st = stageKey === 'blastocyst' ? 'blastocyst_transfer' : 'cleavage_transfer';
      api.getAnnotatedImages(sessionId, st).then(d => setAnnotatedImages(d.images || [])).catch(() => {});
    }
  }, [allPassed, sessionId, stageKey]);

  const handleUpload = async (e) => {
    const rawFile = e.target.files[0]; if (!rawFile) return;
    setUploading(true); setError(null);
    try {
      const file = await compressImg(rawFile);
      setUploads(prev => [...prev, { file, previewUrl: URL.createObjectURL(file), imageNumber: prev.length + 1 }]);
    } catch (err) { setError(err.message); } finally { setUploading(false); }
  };

  const handleRemove = (idx) => {
    setUploads(prev => prev.filter((_, i) => i !== idx).map((u, i) => ({ ...u, imageNumber: i + 1 })));
  };

  const handleStartValidation = async () => {
    if (uploads.length === 0) { setError('Capture at least one tube image first.'); return; }
    setValidating(true); setError(null);
    const results = [];
    try {
      for (const u of uploads) {
        const { uploadUrl, s3Key } = await api.getPresignedUrl(sessionId, 'culture', u.imageNumber);
        await api.uploadImage(uploadUrl, u.file);
        results.push({ ...u, s3Key, status: 'uploaded' });
      }
      let attempts = 0;
      const poll = async () => {
        try {
          const data = await api.getStageExtractions(sessionId, 'culture');
          const validated = (data.extractions || []).filter(e => e.validation_result);
          if (validated.length >= uploads.length) {
            setValidationResults(results.map((r, i) => {
              const ext = validated.find(e => e.image_number === r.imageNumber) || validated[i];
              return { ...r, status: ext?.validation_result?.overall_match ? 'pass' : 'fail', validation: ext?.validation_result };
            }));
            setValidating(false); return;
          }
          attempts++; if (attempts < 45) setTimeout(poll, 2000); else { setError('Validation timeout.'); setValidating(false); }
        } catch (err) { setError(err.message); setValidating(false); }
      };
      poll();
    } catch (err) { setError(err.message); setValidating(false); }
  };

  const handleAnnotUpload = async (e) => {
    const rawFile = e.target.files[0]; if (!rawFile) return;
    setAnnotUploading(true); setError(null);
    try {
      const file = await compressImg(rawFile);
      const num = annotatedImages.length + 1;
      const folder = stageKey === 'blastocyst' ? 'blastocyst-transfer' : 'cleavage-transfer';
      const { uploadUrl } = await api.getPresignedUrlForAnnotatedImage(sessionId, num, folder);
      await api.uploadImage(uploadUrl, file);
      setAnnotProcessing(true);
      let attempts = 0;
      const st = stageKey === 'blastocyst' ? 'blastocyst_transfer' : 'cleavage_transfer';
      const poll = async () => {
        try {
          const data = await api.getAnnotatedImages(sessionId, st);
          const img = data.images.find(i => i.oocyte_number === num);
          if (img && img.annotation_status === 'completed') { setAnnotatedImages(data.images); setAnnotProcessing(false); return; }
          attempts++; if (attempts < 45) setTimeout(poll, 2000); else { setError('Annotation timeout.'); setAnnotProcessing(false); }
        } catch (err) { setError(err.message); setAnnotProcessing(false); }
      };
      poll();
    } catch (err) { setError(err.message); } finally { setAnnotUploading(false); }
  };

  return (
    <div>
      {error && <div style={{ background: '#ffebee', color: '#c62828', padding: '0.6rem 0.85rem', borderRadius: '8px', marginBottom: '0.75rem', fontSize: '0.82rem' }}>{error}</div>}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
        {/* LEFT: Tube validation */}
        <div>
          <p style={{ fontSize: '0.85rem', fontWeight: 600, color: '#374151', marginBottom: '0.4rem' }}>Tube Image Validation</p>
          <div style={{ fontSize: '0.75rem', color: '#374151', marginBottom: '0.6rem', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '6px', padding: '0.4rem 0.6rem' }}>
            <div><strong>M:</strong> {caseData.male_patient.name} · {caseData.male_patient.mpeid}</div>
            <div><strong>F:</strong> {caseData.female_patient.name} · {caseData.female_patient.mpeid}</div>
          </div>
          {validationResults.length === 0 && !validating && (
            <>
              <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '0.5rem' }}>
                {showUpload && (<label style={{ cursor: 'pointer' }}><input type="file" accept="image/*" style={{ display: 'none' }} onChange={handleUpload} disabled={uploading} /><span className="btn-primary" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '0.35rem 0.75rem', fontSize: '0.8rem' }}><IconUpload />{uploading ? '...' : 'Upload'}</span></label>)}
                <label style={{ cursor: 'pointer' }}><input type="file" accept="image/*" capture="environment" style={{ display: 'none' }} onChange={handleUpload} disabled={uploading} /><span className="btn-secondary" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '0.35rem 0.75rem', fontSize: '0.8rem' }}><IconCamera />{uploading ? '...' : 'Photo'}</span></label>
              </div>
              {uploads.length > 0 && (
                <>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(75px,1fr))', gap: '0.35rem', marginBottom: '0.6rem' }}>
                    {uploads.map((img, i) => (
                      <div key={i} style={{ border: '1px solid #e2e8f0', borderRadius: '6px', overflow: 'hidden', position: 'relative' }}>
                        <img src={img.previewUrl} alt="" style={{ width: '100%', height: '55px', objectFit: 'cover', display: 'block' }} />
                        <button onClick={() => handleRemove(i)} style={{ position: 'absolute', top: '2px', right: '2px', background: '#ef4444', color: 'white', border: 'none', borderRadius: '50%', width: '14px', height: '14px', fontSize: '0.55rem', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✕</button>
                      </div>
                    ))}
                  </div>
                  <button onClick={handleStartValidation} className="btn-primary" style={{ fontSize: '0.8rem', padding: '0.4rem 0.85rem' }}>Start Validation ({uploads.length})</button>
                </>
              )}
              {uploads.length === 0 && <p style={{ fontSize: '0.75rem', color: '#94a3b8', margin: 0 }}>No images yet</p>}
            </>
          )}
          {validating && (<div style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '0.6rem', background: '#f0f4ff', borderRadius: '6px' }}><img src="https://d1nmtja0c4ok3x.cloudfront.net/IVFgif.gif" alt="" style={{ width: '20px', height: '20px' }} /><span style={{ fontSize: '0.8rem', color: '#667eea', fontWeight: 600 }}>Validating...</span></div>)}
          {validationResults.length > 0 && (
            <div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(70px,1fr))', gap: '0.35rem', marginBottom: '0.5rem' }}>
                {validationResults.map((r, i) => (
                  <div key={i} style={{ border: '1.5px solid ' + (r.status === 'pass' ? '#22c55e' : '#f59e0b'), borderRadius: '6px', overflow: 'hidden', background: r.status === 'pass' ? '#f0fdf4' : '#fffbeb' }}>
                    <img src={r.previewUrl} alt="" style={{ width: '100%', height: '50px', objectFit: 'cover', display: 'block' }} />
                    <div style={{ padding: '2px', fontSize: '0.65rem', textAlign: 'center', fontWeight: 600, color: r.status === 'pass' ? '#16a34a' : '#92400e' }}>{r.status === 'pass' ? '✓' : '⚠'}</div>
                  </div>
                ))}
              </div>
              {allPassed && <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '6px', padding: '0.4rem', fontSize: '0.75rem', color: '#16a34a', fontWeight: 600 }}>✓ All verified</div>}
            </div>
          )}
        </div>
        {/* RIGHT: Annotated Patient Details */}
        <div style={{ opacity: allPassed ? 1 : 0.4, pointerEvents: allPassed ? 'auto' : 'none' }}>
          <p style={{ fontSize: '0.85rem', fontWeight: 600, color: '#374151', marginBottom: '0.4rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
            Annotated Patient Details
            {!allPassed && <span style={{ background: '#f1f5f9', color: '#94a3b8', padding: '1px 6px', borderRadius: '6px', fontSize: '0.68rem' }}>🔒 Validate first</span>}
          </p>
          <p style={{ fontSize: '0.75rem', color: '#64748b', marginBottom: '0.6rem' }}>Upload microscopic image — patient details annotated on it</p>
          {!annotProcessing && (
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '0.6rem' }}>
              {showUpload && (<label style={{ cursor: 'pointer' }}><input type="file" accept="image/*" style={{ display: 'none' }} onChange={handleAnnotUpload} disabled={annotUploading || !allPassed} /><span className="btn-primary" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '0.35rem 0.75rem', fontSize: '0.8rem' }}><IconUpload />{annotUploading ? '...' : 'Upload'}</span></label>)}
              <label style={{ cursor: 'pointer' }}><input type="file" accept="image/*" capture="environment" style={{ display: 'none' }} onChange={handleAnnotUpload} disabled={annotUploading || !allPassed} /><span className="btn-secondary" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '0.35rem 0.75rem', fontSize: '0.8rem' }}><IconCamera />{annotUploading ? '...' : 'Photo'}</span></label>
            </div>
          )}
          {annotProcessing && (<div style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '0.6rem', background: '#f0f4ff', borderRadius: '6px', marginBottom: '0.6rem' }}><img src="https://d1nmtja0c4ok3x.cloudfront.net/IVFgif.gif" alt="" style={{ width: '20px', height: '20px' }} /><span style={{ fontSize: '0.8rem', color: '#667eea', fontWeight: 600 }}>Annotating...</span></div>)}
          {annotatedImages.length > 0 && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(100px,1fr))', gap: '0.4rem' }}>
              {annotatedImages.map((img, i) => (
                <div key={img.imageId || i} style={{ border: '1.5px solid #e2e8f0', borderRadius: '6px', overflow: 'hidden' }}>
                  <img src={img.download_url} alt="" style={{ width: '100%', height: '70px', objectFit: 'cover', display: 'block' }} />
                  <div style={{ padding: '2px 4px', display: 'flex', justifyContent: 'space-between', fontSize: '0.65rem', color: '#64748b' }}>
                    <span>{img.oocyte_number}</span>
                    <button onClick={() => window.open(img.download_url, '_blank')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#667eea', padding: 0, fontSize: '0.65rem' }}>↓</button>
                  </div>
                </div>
              ))}
            </div>
          )}
          {annotatedImages.length === 0 && !annotProcessing && allPassed && <p style={{ fontSize: '0.75rem', color: '#94a3b8', margin: 0 }}>Upload microscopic image above</p>}
        </div>
      </div>
    </div>
  );
}


// Sub 3: Cryopreservation
function CryopreservationSection({ sessionId, stageKey }) {
  const [form, setForm] = React.useState({ can: '', canister: '', goblet: '', visoColor: '' });
  const [customCan, setCustomCan] = React.useState('');
  const [saving, setSaving] = React.useState(false);
  const [saved, setSaved] = React.useState(false);
  const [records, setRecords] = React.useState([]);
  const [error, setError] = React.useState(null);

  React.useEffect(() => {
    api.getEmbryoStageData(sessionId, stageKey).then(d => setRecords(d.cryo_records || [])).catch(() => {});
  }, [sessionId, stageKey]);

  const canValue = form.can === 'custom' ? customCan : form.can;
  const inp = { padding: '0.55rem 0.75rem', border: '1.5px solid #e2e8f0', borderRadius: '8px', fontSize: '0.85rem', outline: 'none', background: '#fff', width: '100%', boxSizing: 'border-box' };

  const handleSave = async () => {
    setSaving(true); setError(null);
    try {
      const newRecord = { can: canValue, canister: form.canister.toUpperCase(), goblet: form.goblet, visoColor: form.visoColor, savedAt: new Date().toISOString() };
      const updated = [...records, newRecord];
      await api.saveEmbryoStageData(sessionId, stageKey, { cryo_records: updated });
      setRecords(updated);
      setForm({ can: '', canister: '', goblet: '', visoColor: '' }); setCustomCan('');
      setSaved(true); setTimeout(() => setSaved(false), 2000);
    } catch { setError('Failed to save.'); } finally { setSaving(false); }
  };

  return (
    <div>
      <p style={{ fontSize: '0.82rem', color: '#64748b', marginBottom: '1rem' }}>Record where the embryo is stored in the nitrogen can system.</p>
      {error && <div style={{ background: '#ffebee', color: '#c62828', padding: '0.6rem 0.85rem', borderRadius: '8px', marginBottom: '0.75rem', fontSize: '0.82rem' }}>{error}</div>}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: '0.75rem', marginBottom: '0.75rem' }}>
        <div>
          <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, color: '#374151', marginBottom: '0.3rem' }}>Can *</label>
          <select style={inp} value={form.can} onChange={e => setForm(f => ({ ...f, can: e.target.value }))}>
            <option value="">Select...</option>
            {CAN_OPTIONS.map(c => <option key={c} value={c}>Can {c}</option>)}
            <option value="custom">Other</option>
          </select>
          {form.can === 'custom' && <input style={{ ...inp, marginTop: '0.4rem' }} type="text" placeholder="Type can name" value={customCan} onChange={e => setCustomCan(e.target.value)} />}
        </div>
        <div>
          <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, color: '#374151', marginBottom: '0.3rem' }}>Canister *</label>
          <input style={inp} type="text" placeholder="e.g. A, G..." value={form.canister} onChange={e => setForm(f => ({ ...f, canister: e.target.value }))} maxLength={3} />
        </div>
        <div>
          <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, color: '#374151', marginBottom: '0.3rem' }}>Goblet *</label>
          <select style={inp} value={form.goblet} onChange={e => setForm(f => ({ ...f, goblet: e.target.value }))}>
            <option value="">Select...</option>
            <option value="Up">Up</option>
            <option value="Down">Down</option>
          </select>
        </div>
        <div>
          <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, color: '#374151', marginBottom: '0.3rem' }}>Viso Color *</label>
          <select style={inp} value={form.visoColor} onChange={e => setForm(f => ({ ...f, visoColor: e.target.value }))}>
            <option value="">Select...</option>
            {VISO_COLORS.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.25rem' }}>
        <button type="button" onClick={handleSave} disabled={saving} className="btn-primary" style={{ fontSize: '0.85rem' }}>{saving ? 'Saving...' : '+ Save Location'}</button>
        {saved && <span style={{ fontSize: '0.8rem', color: '#16a34a' }}>✓ Saved</span>}
      </div>
      {records.length > 0 && (
        <div>
          <p style={{ fontWeight: 600, fontSize: '0.85rem', color: '#374151', marginBottom: '0.5rem' }}>Stored Locations ({records.length})</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {records.map((r, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '8px', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '0.6rem 0.85rem', fontSize: '0.82rem', flexWrap: 'wrap' }}>
                <span style={{ background: '#667eea', color: 'white', padding: '2px 8px', borderRadius: '6px', fontWeight: 700, fontSize: '0.75rem' }}>Can {r.can}</span>
                <span style={{ color: '#64748b' }}>→</span>
                <span style={{ fontWeight: 600 }}>Canister {r.canister}</span>
                <span style={{ color: '#64748b' }}>→</span>
                <span>Goblet {r.goblet}</span>
                <span style={{ color: '#64748b' }}>→</span>
                <span style={{ background: r.visoColor.toLowerCase() === 'white' ? '#f1f5f9' : r.visoColor.toLowerCase() === 'yellow' ? '#fef9c3' : r.visoColor.toLowerCase(), color: ['white','yellow'].includes(r.visoColor.toLowerCase()) ? '#374151' : 'white', padding: '2px 8px', borderRadius: '6px', fontSize: '0.75rem', fontWeight: 600, border: '1px solid #e2e8f0' }}>{r.visoColor}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Main CleavageStage ───────────────────────────────────────────────────────
function CleavageStage({ sessionId, caseData, onComplete, onViewStatus, stageTitle = 'Cleavage (Day 3)', stageId = 'icsi_documentation', stageKey = 'cleavage' }) {
  const { canUploadImage } = usePermissionStore();
  const showUpload = canUploadImage();
  const [uploadedImages, setUploadedImages] = React.useState([]);
  const [uploading, setUploading] = React.useState(false);
  const [processing, setProcessing] = React.useState(false);
  const [error, setError] = React.useState(null);
  const [annotatedImages, setAnnotatedImages] = React.useState([]);
  const [remark, setRemark] = React.useState('');
  const [existingRemark, setExistingRemark] = React.useState('');
  const [savingRemark, setSavingRemark] = React.useState(false);
  const [remarkSaved, setRemarkSaved] = React.useState(false);
  const [completing, setCompleting] = React.useState(false);

  React.useEffect(() => {
    loadData();
  }, [sessionId]); // eslint-disable-line

  const loadData = async () => {
    try {
      const data = await api.getAnnotatedImages(sessionId, stageKey);
      setAnnotatedImages(data.images || []);
    } catch {}
    try {
      const d = await api.getEmbryoStageData(sessionId, stageKey);
      setRemark(d.remark || ''); setExistingRemark(d.remark || '');
    } catch {}
  };

  const handleImageUpload = async (e) => {
    const rawFile = e.target.files[0]; if (!rawFile) return;
    setUploading(true); setError(null);
    try {
      const file = await compressImg(rawFile);
      const imageNumber = uploadedImages.length + annotatedImages.length + 1;
      const { uploadUrl, s3Key } = await api.getPresignedUrlForAnnotatedImage(sessionId, imageNumber, stageKey);
      await api.uploadImage(uploadUrl, file);
      setUploadedImages(prev => [...prev, { imageNumber, s3Key, status: 'uploaded' }]);
      setProcessing(true);
      let attempts = 0;
      const poll = async () => {
        try {
          const data = await api.getAnnotatedImages(sessionId, stageKey);
          const newImg = data.images.find(img => img.oocyte_number === imageNumber);
          if (newImg && newImg.annotation_status === 'completed') {
            setAnnotatedImages(data.images); setProcessing(false); setUploadedImages([]);
            return;
          }
          attempts++; if (attempts < 45) setTimeout(poll, 2000); else { setError('Annotation timeout.'); setProcessing(false); }
        } catch (err) { setError(err.message); setProcessing(false); }
      };
      poll();
    } catch (err) { setError(err.message); } finally { setUploading(false); }
  };

  const handleDownload = async (image) => {
    try {
      let downloadUrl = image.download_url;
      if (image.annotated_s3_path) {
        const s3Key = image.annotated_s3_path.replace('s3://', '').split('/').slice(1).join('/');
        const result = await api.getImageDownloadUrl(s3Key);
        downloadUrl = result.downloadUrl;
      }
      window.open(downloadUrl, '_blank');
      await api.incrementDownloadCount(image.imageId);
    } catch {}
  };

  const handleSaveRemark = async () => {
    setSavingRemark(true);
    try { await api.saveEmbryoStageData(sessionId, stageKey, { remark }); setExistingRemark(remark); setRemarkSaved(true); setTimeout(() => setRemarkSaved(false), 3000); }
    catch { setError('Failed to save remark.'); } finally { setSavingRemark(false); }
  };

  const handleComplete = async () => {
    setCompleting(true);
    try {
      await api.saveEmbryoStageData(sessionId, stageKey, { remark });
      await api.completeStage(sessionId, stageId);
      onComplete();
    } catch { setError('Failed to complete.'); } finally { setCompleting(false); }
  };

  const card = { background: '#fff', border: '1.5px solid #e2e8f0', borderRadius: '14px', padding: '1.5rem', marginBottom: '1.5rem', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' };

  return (
    <div style={{ padding: '2rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <button onClick={onViewStatus} className="btn-secondary" style={{ padding: '7px 12px', display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>Back
          </button>
          <div>
            <h2 style={{ margin: 0, fontSize: '1.5rem', fontWeight: 700, color: '#1a202c' }}>{stageTitle}</h2>
            <p style={{ margin: 0, fontSize: '0.82rem', color: '#64748b' }}>Embryo imaging, transfer documentation, and cryopreservation</p>
          </div>
        </div>
        <button onClick={onViewStatus} className="btn-secondary" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
          <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><rect x="8" y="2" width="8" height="4" rx="1" ry="1"/></svg>View All Stages
        </button>
      </div>

      {error && <div style={{ background: '#ffebee', color: '#c62828', padding: '0.75rem 1rem', borderRadius: '8px', marginBottom: '1rem', fontSize: '0.85rem', borderLeft: '4px solid #f44336' }}>{error}</div>}

      {/* Sub 0: Sample Validation + Annotated Details (two-column) */}
      <div style={card}>
        <SectionHeader num="1" title="Sample Validation & Annotated Details" subtitle="Validate dish label (female details) and capture annotated microscopic image" />
        <SampleValidationWithAnnotation sessionId={sessionId} caseData={caseData} showUpload={showUpload} stageKey={stageKey} onViewStatus={onViewStatus} />
      </div>

      {/* Sub 1: Microscopic Embryo Validation */}
      <div style={card}>
        <SectionHeader num="2" title="Microscopic Embryo Validation" subtitle="Capture annotated embryo images with AI analysis and embryologist grading" />
        <p className="info-text">Capture images of embryos from the micromanipulator screen. Images will be automatically annotated with patient information.</p>
        {!processing && (
          <div className="upload-section">
            <div className="capture-options">
              {showUpload && (
                <label className="file-input-label">
                  <input type="file" accept="image/jpeg,image/jpg,image/png" onChange={handleImageUpload} disabled={uploading} />
                  <span className="btn-primary">{uploading ? 'Uploading...' : <><IconUpload /> Upload Image</>}</span>
                </label>
              )}
              <label className="file-input-label">
                <input type="file" accept="image/jpeg,image/jpg,image/png" capture="environment" onChange={handleImageUpload} disabled={uploading} />
                <span className="btn-secondary">{uploading ? 'Uploading...' : <><IconCamera /> Take Photo</>}</span>
              </label>
            </div>
          </div>
        )}
        {processing && (
          <div className="processing-message">
            <img src="https://d1nmtja0c4ok3x.cloudfront.net/IVFgif.gif" alt="Processing..." style={{ width: '60px', height: '60px', objectFit: 'contain' }} />
            <p>Annotating image with patient information...</p>
            <p className="small">This may take 10-15 seconds</p>
          </div>
        )}
        {annotatedImages.length > 0 && (
          <div className="annotated-images-section" style={{ marginTop: '1rem' }}>
            <h3 style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', fontSize: '1rem' }}>
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#4caf50" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
              Annotated Images ({annotatedImages.length})
            </h3>
            <div className="images-grid">
              {annotatedImages.map((image) => (
                <div key={image.imageId} className="image-card">
                  <div className="image-header">
                    <h4>Embryo {image.oocyte_number}</h4>
                    <span className="image-date">{new Date(image.captured_at).toLocaleString()}</span>
                  </div>
                  <div className="image-preview">
                    <img src={image.download_url} alt="Embryo" style={{ maxWidth: '100%', borderRadius: '4px' }} />
                  </div>
                  <div className="image-actions">
                    <button onClick={() => handleDownload(image)} className="btn-secondary" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                      <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                      Download
                    </button>
                    <span className="download-count">Downloads: {image.download_count || 0}</span>
                  </div>
                  <AIGradingSection image={image} sessionId={sessionId} />
                  <ManualGradingSection image={image} sessionId={sessionId} />
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Sub 2: Embryo Transfer */}
      <div style={card}>
        <SectionHeader num="3" title="Embryo Transfer" subtitle="Upload tube images for patient validation" badge="Optional" />
        <EmbryoTransferSection sessionId={sessionId} caseData={caseData} showUpload={showUpload} stageKey={stageKey} />
      </div>

      {/* Sub 3: Cryopreservation */}
      <div style={card}>
        <SectionHeader num="4" title="Cryopreservation" subtitle="Record embryo storage location in nitrogen can system" />
        <CryopreservationSection sessionId={sessionId} stageKey={stageKey} />
      </div>

      {/* Remark */}
      <div style={card}>
        <SectionHeader num="5" title="Remark" subtitle="Add observations or notes" />
        <textarea style={{ width: '100%', padding: '0.65rem 0.85rem', border: '1.5px solid #e2e8f0', borderRadius: '8px', fontSize: '0.88rem', outline: 'none', boxSizing: 'border-box', resize: 'vertical', minHeight: '75px', fontFamily: 'inherit' }}
          placeholder="Enter your observations..." value={remark} onChange={(e) => { setRemark(e.target.value); setRemarkSaved(false); }} />
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginTop: '0.5rem' }}>
          <button type="button" onClick={handleSaveRemark} disabled={savingRemark || remark === existingRemark} className="btn-secondary" style={{ fontSize: '0.85rem', opacity: remark === existingRemark ? 0.5 : 1 }}>{savingRemark ? 'Saving...' : 'Save Remark'}</button>
          {remarkSaved && <span style={{ fontSize: '0.8rem', color: '#16a34a' }}>✓ Saved</span>}
        </div>
      </div>

      <div style={{ display: 'flex', gap: '0.75rem' }}>
        <button onClick={handleComplete} disabled={completing} className="btn-primary" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
          {completing ? 'Completing...' : <><svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>Complete {stageTitle}</>}
        </button>
        <button onClick={onViewStatus} className="btn-secondary">View All Stages</button>
      </div>
    </div>
  );
}

export default CleavageStage;
