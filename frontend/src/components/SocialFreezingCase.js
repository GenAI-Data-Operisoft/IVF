/**
 * SocialFreezingCase — Case view for Social Embryo Freezing.
 * Section 1: Patient Verification (label_validation — same StageCapture)
 * Section 2: Annotated Image (upload microscopic image, annotated with patient info, stored in S3/DB)
 * Section 3: Cryopreservation Record (same CryopreservationSection from CleavageStage)
 */
import React, { useState, useEffect } from 'react';
import { api } from '../api';
import StageCapture from './StageCapture';
import ImageCropModal from './ImageCropModal';
import usePermissionStore from '../store/permissionStore';

const VISO_COLORS = ['Red', 'Blue', 'Green', 'Yellow', 'Pink', 'White', 'Orange', 'Purple'];
const CAN_OPTIONS = ['1', 'D', '2'];
const CRYOLOCK_COLORS = ['Clear', 'Blue', 'Green', 'Yellow', 'Pink', 'Red', 'Orange', 'Purple', 'White'];

const SF_LABEL_STAGE = { id: 'label_validation', name: 'Patient Verification', images: 1 };

// ── Image compression helper ────────────────────────────────────────────────
function compressImg(file) {
  return new Promise((resolve) => {
    const img = new Image(); const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      const canvas = document.createElement('canvas'); const MAX = 1280;
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

// ── Annotated Image Section ─────────────────────────────────────────────────
function AnnotatedImageSection({ sessionId }) {
  const { canUploadImage } = usePermissionStore();
  const showUpload = canUploadImage();
  const [annotUploading, setAnnotUploading] = useState(false);
  const [annotProcessing, setAnnotProcessing] = useState(false);
  const [annotatedImages, setAnnotatedImages] = useState([]);
  const [pendingCropFile, setPendingCropFile] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    api.getAnnotatedImages(sessionId, 'social_freezing').then(d => setAnnotatedImages(d.images || [])).catch(() => {});
  }, [sessionId]);

  const handleCapture = (e) => {
    const rawFile = e.target.files[0]; if (!rawFile) return;
    setPendingCropFile(rawFile);
  };

  const handleCroppedImage = async (croppedFile) => {
    setPendingCropFile(null);
    setAnnotUploading(true); setError(null);
    try {
      const file = await compressImg(croppedFile);
      const num = annotatedImages.length + 1;
      const { uploadUrl } = await api.getPresignedUrlForAnnotatedImage(sessionId, num, 'social_freezing');
      await api.uploadImage(uploadUrl, file);
      setAnnotProcessing(true);
      // Poll for annotation completion
      let attempts = 0;
      const maxAttempts = 90;
      const poll = async () => {
        try {
          const data = await api.getAnnotatedImages(sessionId, 'social_freezing');
          const newImage = data.images.find(img => img.oocyte_number === num);
          if (newImage && newImage.annotation_status === 'completed') {
            setAnnotatedImages(data.images || []);
            setAnnotProcessing(false);
            return;
          }
          attempts++;
          if (attempts < maxAttempts) setTimeout(poll, 2000);
          else { setError('Annotation timeout. Please refresh.'); setAnnotProcessing(false); }
        } catch (err) { setError(err.message); setAnnotProcessing(false); }
      };
      poll();
    } catch (err) { setError(err.message); setAnnotProcessing(false); } finally { setAnnotUploading(false); }
  };

  return (
    <div style={{ background: '#fff', border: '1.5px solid #e2e8f0', borderRadius: '14px', padding: '1.5rem', boxShadow: '0 2px 8px rgba(0,0,0,0.05)' }}>
      <h3 style={{ margin: '0 0 0.5rem', fontSize: '1.1rem', fontWeight: 700, color: '#1a202c' }}>
        📷 Annotated Image
      </h3>
      <p style={{ fontSize: '0.82rem', color: '#64748b', marginBottom: '1rem' }}>
        Upload microscopic image — patient details will be annotated automatically and stored.
      </p>

      {error && <div style={{ background: '#ffebee', color: '#c62828', padding: '0.6rem 0.85rem', borderRadius: '8px', marginBottom: '0.75rem', fontSize: '0.82rem' }}>{error}</div>}

      {/* Upload buttons */}
      {!annotProcessing && (
        <div style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap', marginBottom: '0.75rem' }}>
          <label style={{ cursor: 'pointer' }}>
            <input type="file" accept="image/*" capture="environment" style={{ display: 'none' }} onChange={handleCapture} disabled={annotUploading} />
            <span className="btn-secondary" style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', padding: '0.5rem 1rem', fontSize: '0.85rem' }}>
              <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>
              {annotUploading ? 'Uploading...' : 'Take Photo'}
            </span>
          </label>
          {showUpload && (
            <label style={{ cursor: 'pointer' }}>
              <input type="file" accept="image/*" style={{ display: 'none' }} onChange={handleCapture} disabled={annotUploading} />
              <span className="btn-secondary" style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', padding: '0.5rem 1rem', fontSize: '0.85rem' }}>
                <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
                Upload Image
              </span>
            </label>
          )}
        </div>
      )}

      {/* Processing indicator */}
      {annotProcessing && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '0.75rem', background: '#f0f4ff', borderRadius: '8px', marginBottom: '0.75rem' }}>
          <img src="https://d1nmtja0c4ok3x.cloudfront.net/IVFgif.gif" alt="" style={{ width: '22px', height: '22px' }} />
          <span style={{ fontSize: '0.82rem', color: '#667eea', fontWeight: 600 }}>Annotating image with patient details...</span>
        </div>
      )}

      {/* Annotated images grid */}
      {annotatedImages.length > 0 && (
        <div>
          <p style={{ fontWeight: 600, fontSize: '0.85rem', color: '#374151', marginBottom: '0.5rem' }}>
            Annotated Images ({annotatedImages.length})
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: '0.5rem' }}>
            {annotatedImages.map((img, i) => (
              <div key={img.imageId || i} style={{ border: '1.5px solid #e2e8f0', borderRadius: '8px', overflow: 'hidden', background: '#f8fafc' }}>
                <img src={img.download_url} alt={`Annotated ${i + 1}`} style={{ width: '100%', height: '100px', objectFit: 'cover', display: 'block' }} />
                <div style={{ padding: '4px 6px', fontSize: '0.72rem', color: '#64748b', textAlign: 'center' }}>
                  Image {img.oocyte_number || i + 1}
                  {img.annotation_status === 'completed' && <span style={{ color: '#16a34a', marginLeft: '4px' }}>✓</span>}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Crop modal */}
      {pendingCropFile && (
        <ImageCropModal
          imageFile={pendingCropFile}
          onCrop={handleCroppedImage}
          onCancel={() => setPendingCropFile(null)}
        />
      )}
    </div>
  );
}

// ── Cryopreservation Record Section ─────────────────────────────────────────
function CryopreservationRecord({ sessionId }) {
  const stageKey = 'sf_cryo'; // unique key for social freezing cryo data
  const [form, setForm] = useState({ can: '', canister: '', goblet: '', visoColor: '', cryolockId: '', cryolockColor: '' });
  const [customCan, setCustomCan] = useState('');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [records, setRecords] = useState([]);
  const [error, setError] = useState(null);

  useEffect(() => {
    api.getEmbryoStageData(sessionId, stageKey).then(d => setRecords(d.cryo_records || [])).catch(() => {});
  }, [sessionId]);

  const canValue = form.can === 'custom' ? customCan : form.can;
  const inp = { padding: '0.55rem 0.75rem', border: '1.5px solid #e2e8f0', borderRadius: '8px', fontSize: '0.85rem', outline: 'none', background: '#fff', width: '100%', boxSizing: 'border-box' };

  const handleSave = async () => {
    if (!canValue || !form.canister || !form.goblet || !form.visoColor) {
      setError('Please fill in all required fields (Can, Canister, Goblet, Viso Color).');
      return;
    }
    setSaving(true); setError(null);
    try {
      const newRecord = {
        can: canValue,
        canister: form.canister.toUpperCase(),
        goblet: form.goblet,
        visoColor: form.visoColor,
        cryolockId: form.cryolockId.trim(),
        cryolockColor: form.cryolockColor,
        savedAt: new Date().toISOString()
      };
      const updated = [...records, newRecord];
      await api.saveEmbryoStageData(sessionId, stageKey, { cryo_records: updated });
      setRecords(updated);
      setForm({ can: '', canister: '', goblet: '', visoColor: '', cryolockId: '', cryolockColor: '' });
      setCustomCan('');
      setSaved(true); setTimeout(() => setSaved(false), 2000);
    } catch { setError('Failed to save. Please try again.'); }
    finally { setSaving(false); }
  };

  return (
    <div style={{ background: '#fff', border: '1.5px solid #e2e8f0', borderRadius: '14px', padding: '1.5rem', boxShadow: '0 2px 8px rgba(0,0,0,0.05)' }}>
      <h3 style={{ margin: '0 0 0.5rem', fontSize: '1.1rem', fontWeight: 700, color: '#1a202c' }}>
        🧊 Cryopreservation Record
      </h3>
      <p style={{ fontSize: '0.82rem', color: '#64748b', marginBottom: '1.25rem' }}>
        Record where the embryo is stored in the nitrogen can system.
      </p>

      {error && <div style={{ background: '#ffebee', color: '#c62828', padding: '0.6rem 0.85rem', borderRadius: '8px', marginBottom: '0.75rem', fontSize: '0.82rem' }}>{error}</div>}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: '0.75rem', marginBottom: '0.75rem' }}>
        <div>
          <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, color: '#374151', marginBottom: '0.3rem' }}>Cryolock ID</label>
          <input style={inp} type="text" placeholder="e.g. CL-001" value={form.cryolockId} onChange={e => setForm(f => ({ ...f, cryolockId: e.target.value }))} />
        </div>
        <div>
          <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, color: '#374151', marginBottom: '0.3rem' }}>Cryolock Color</label>
          <select style={inp} value={form.cryolockColor} onChange={e => setForm(f => ({ ...f, cryolockColor: e.target.value }))}>
            <option value="">Select...</option>
            {CRYOLOCK_COLORS.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        <div>
          <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, color: '#374151', marginBottom: '0.3rem' }}>Can *</label>
          <select style={inp} value={form.can} onChange={e => setForm(f => ({ ...f, can: e.target.value }))}>
            <option value="">Select...</option>
            {CAN_OPTIONS.map(c => <option key={c} value={c}>Can {c}</option>)}
            <option value="custom">Other</option>
          </select>
          {form.can === 'custom' && (
            <input style={{ ...inp, marginTop: '0.4rem' }} type="text" placeholder="Type can name" value={customCan} onChange={e => setCustomCan(e.target.value)} />
          )}
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
        <button type="button" onClick={handleSave} disabled={saving} className="btn-primary" style={{ fontSize: '0.85rem' }}>
          {saving ? 'Saving...' : '+ Save Location'}
        </button>
        {saved && <span style={{ fontSize: '0.8rem', color: '#16a34a' }}>✓ Saved</span>}
      </div>

      {records.length > 0 && (
        <div>
          <p style={{ fontWeight: 600, fontSize: '0.85rem', color: '#374151', marginBottom: '0.5rem' }}>
            Stored Locations ({records.length})
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {records.map((r, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '8px', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '0.6rem 0.85rem', fontSize: '0.82rem', flexWrap: 'wrap' }}>
                <span style={{ background: '#667eea', color: 'white', padding: '2px 8px', borderRadius: '6px', fontWeight: 700, fontSize: '0.75rem' }}>Can {r.can}</span>
                <span style={{ color: '#64748b' }}>→</span>
                <span style={{ fontWeight: 600 }}>Canister {r.canister}</span>
                <span style={{ color: '#64748b' }}>→</span>
                <span>Goblet {r.goblet}</span>
                <span style={{ color: '#64748b' }}>→</span>
                <span style={{
                  background: ['white', 'yellow', 'clear'].includes(r.visoColor?.toLowerCase()) ? '#f1f5f9' : r.visoColor?.toLowerCase(),
                  color: ['white', 'yellow', 'clear'].includes(r.visoColor?.toLowerCase()) ? '#374151' : 'white',
                  padding: '2px 8px', borderRadius: '6px', fontSize: '0.75rem', fontWeight: 600, border: '1px solid #e2e8f0'
                }}>{r.visoColor}</span>
                {r.cryolockId && (
                  <>
                    <span style={{ color: '#64748b' }}>→</span>
                    <span style={{ background: '#e0e7ff', color: '#3730a3', padding: '2px 8px', borderRadius: '6px', fontSize: '0.75rem', fontWeight: 600 }}>🔒 {r.cryolockId}</span>
                  </>
                )}
                {r.cryolockColor && (
                  <>
                    <span style={{ color: '#64748b' }}>→</span>
                    <span style={{
                      background: ['clear', 'white', 'yellow'].includes(r.cryolockColor?.toLowerCase()) ? '#f1f5f9' : r.cryolockColor?.toLowerCase(),
                      color: ['clear', 'white', 'yellow'].includes(r.cryolockColor?.toLowerCase()) ? '#374151' : 'white',
                      padding: '2px 8px', borderRadius: '6px', fontSize: '0.75rem', fontWeight: 600, border: '1px solid #e2e8f0'
                    }}>CL: {r.cryolockColor}</span>
                  </>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Main SocialFreezingCase ──────────────────────────────────────────────────
function SocialFreezingCase({ sessionId, onBack }) {
  const [caseData, setCaseData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => { loadCase(); }, [sessionId]); // eslint-disable-line

  const loadCase = async () => {
    setLoading(true);
    try {
      const data = await api.getCase(sessionId);
      setCaseData(data);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  if (loading) return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '300px', color: '#64748b' }}>
      <div style={{ textAlign: 'center' }}><div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>🧊</div><p>Loading case...</p></div>
    </div>
  );

  if (!caseData) return (
    <div style={{ textAlign: 'center', padding: '2rem', color: '#dc2626' }}>
      Case not found. <button onClick={onBack} className="btn-secondary" style={{ marginLeft: '1rem' }}>Back</button>
    </div>
  );

  const verificationStatus = caseData.stages?.label_validation?.status;

  return (
    <div style={{ maxWidth: '900px', margin: '0 auto', padding: '1.5rem 1rem' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '1.5rem' }}>
        <button onClick={onBack} className="btn-secondary" style={{ padding: '7px 14px', display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
          Back
        </button>
        <div>
          <h2 style={{ margin: 0, fontSize: '1.3rem', fontWeight: 700, color: '#1a202c' }}>🧊 Social Embryo Freezing</h2>
          <p style={{ margin: 0, fontSize: '0.82rem', color: '#64748b' }}>Session: {sessionId.slice(0, 8)}...</p>
        </div>
      </div>

      {/* Patient Info */}
      <div style={{ background: '#fff', border: '1.5px solid #e2e8f0', borderRadius: '12px', padding: '1rem 1.25rem', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '12px' }}>
        <div style={{ width: '36px', height: '36px', borderRadius: '50%', background: 'linear-gradient(135deg, #f093fb, #f5576c)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 700, flexShrink: 0 }}>F</div>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 700, fontSize: '1rem' }}>{caseData.female_patient?.name}</div>
          <div style={{ fontSize: '0.82rem', color: '#64748b' }}>MPID: {caseData.female_patient?.mpeid}</div>
        </div>
        <div style={{ fontSize: '0.82rem', color: '#64748b', textAlign: 'right' }}>
          {caseData.doctor_name && <div>Dr. {caseData.doctor_name}</div>}
          {caseData.procedure_start_date && <div>{caseData.procedure_start_date}</div>}
        </div>
      </div>

      {/* Section 1: Patient Verification */}
      <div style={{ marginBottom: '1.5rem' }}>
        <h3 style={{ margin: '0 0 1rem', fontSize: '1rem', fontWeight: 700, color: '#374151', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ background: '#667eea', color: 'white', width: '24px', height: '24px', borderRadius: '50%', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.8rem', fontWeight: 700 }}>1</span>
          Patient Verification
        </h3>
        <StageCapture
          sessionId={sessionId}
          caseData={caseData}
          stage={SF_LABEL_STAGE}
          onComplete={loadCase}
          onViewStatus={loadCase}
          embedded={true}
        />
      </div>

      {/* Section 2: Annotated Image */}
      <div style={{ marginBottom: '1.5rem' }}>
        <h3 style={{ margin: '0 0 1rem', fontSize: '1rem', fontWeight: 700, color: '#374151', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ background: '#667eea', color: 'white', width: '24px', height: '24px', borderRadius: '50%', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.8rem', fontWeight: 700 }}>2</span>
          Annotated Image
        </h3>
        <AnnotatedImageSection sessionId={sessionId} />
      </div>

      {/* Section 3: Cryopreservation Record */}
      <div>
        <h3 style={{ margin: '0 0 1rem', fontSize: '1rem', fontWeight: 700, color: '#374151', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ background: '#667eea', color: 'white', width: '24px', height: '24px', borderRadius: '50%', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.8rem', fontWeight: 700 }}>3</span>
          Cryopreservation Record
        </h3>
        <CryopreservationRecord sessionId={sessionId} />
      </div>
    </div>
  );
}

export default SocialFreezingCase;
