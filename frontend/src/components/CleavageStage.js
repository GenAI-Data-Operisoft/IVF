/**
 * Cleavage (Day 3) / Blastocyst (Day 5/6)
 * Sub 1: Microscopic Embryo Validation (annotated + AI grading + manual grading)
 * Sub 2: Embryo Transfer (optional)
 * Sub 3: Cryopreservation
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

// Sub 2: Embryo Transfer
function EmbryoTransferSection({ sessionId, caseData, showUpload }) {
  const [uploads, setUploads] = React.useState([]);
  const [uploading, setUploading] = React.useState(false);
  const [error, setError] = React.useState(null);

  const handleUpload = async (e) => {
    const rawFile = e.target.files[0]; if (!rawFile) return;
    setUploading(true); setError(null);
    try {
      const file = await compressImg(rawFile);
      const previewUrl = URL.createObjectURL(file);
      const imageNumber = uploads.length + 1;
      const { uploadUrl } = await api.getPresignedUrl(sessionId, 'icsi', imageNumber);
      await api.uploadImage(uploadUrl, file);
      setUploads(prev => [...prev, { imageNumber, previewUrl }]);
    } catch (err) { setError(err.message); } finally { setUploading(false); }
  };

  return (
    <div>
      <p style={{ fontSize: '0.82rem', color: '#64748b', marginBottom: '0.75rem' }}>
        Upload tube images with patient name/MPID. Multiple images supported — each stick may have separate details.
      </p>
      {error && <div style={{ background: '#ffebee', color: '#c62828', padding: '0.6rem 0.85rem', borderRadius: '8px', marginBottom: '0.75rem', fontSize: '0.82rem' }}>{error}</div>}
      <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', marginBottom: '0.75rem' }}>
        {showUpload && (<label style={{ cursor: 'pointer' }}><input type="file" accept="image/*" style={{ display: 'none' }} onChange={handleUpload} disabled={uploading} /><span className="btn-primary" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '0.5rem 1rem', fontSize: '0.85rem' }}><IconUpload />{uploading ? 'Uploading...' : 'Upload Tube Image'}</span></label>)}
        <label style={{ cursor: 'pointer' }}><input type="file" accept="image/*" capture="environment" style={{ display: 'none' }} onChange={handleUpload} disabled={uploading} /><span className="btn-secondary" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '0.5rem 1rem', fontSize: '0.85rem' }}><IconCamera />{uploading ? '...' : 'Take Photo'}</span></label>
      </div>
      {uploads.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(130px,1fr))', gap: '0.75rem' }}>
          {uploads.map((img, i) => (
            <div key={i} style={{ border: '1.5px solid #e2e8f0', borderRadius: '10px', overflow: 'hidden' }}>
              <img src={img.previewUrl} alt="" style={{ width: '100%', height: '90px', objectFit: 'cover', display: 'block' }} />
              <div style={{ padding: '4px 8px', fontSize: '0.75rem', color: '#16a34a', textAlign: 'center' }}>✓ Tube {img.imageNumber}</div>
            </div>
          ))}
        </div>
      )}
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

      {/* Sub 1: Microscopic Embryo Validation */}
      <div style={card}>
        <SectionHeader num="1" title="Microscopic Embryo Validation" subtitle="Capture annotated embryo images with AI analysis and embryologist grading" />
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
        <SectionHeader num="2" title="Embryo Transfer" subtitle="Upload tube images for patient validation" badge="Optional" />
        <EmbryoTransferSection sessionId={sessionId} caseData={caseData} showUpload={showUpload} />
      </div>

      {/* Sub 3: Cryopreservation */}
      <div style={card}>
        <SectionHeader num="3" title="Cryopreservation" subtitle="Record embryo storage location in nitrogen can system" />
        <CryopreservationSection sessionId={sessionId} stageKey={stageKey} />
      </div>

      {/* Remark */}
      <div style={card}>
        <SectionHeader num="4" title="Remark" subtitle="Add observations or notes" />
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
