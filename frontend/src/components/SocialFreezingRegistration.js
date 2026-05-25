/**
 * SocialFreezingRegistration — Register a new Social Embryo Freezing case.
 * Female patient only (no male patient needed).
 */
import React, { useState } from 'react';
import { api } from '../api';
import usePermissionStore from '../store/permissionStore';

const IconBack = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="15 18 9 12 15 6"/>
  </svg>
);

const IconCamera = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
    <circle cx="12" cy="13" r="4"/>
  </svg>
);

const IconUpload = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/>
    <polyline points="21 15 16 10 5 21"/>
  </svg>
);

const IconCheck = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="20 6 9 17 4 12"/>
  </svg>
);

const IconWarning = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
    <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
  </svg>
);

function SocialFreezingRegistration({ onComplete, onBack, user }) {
  const { canUploadImage } = usePermissionStore();
  const showUpload = canUploadImage();

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [scanning, setScanning] = useState(false);
  const [scanPreview, setScanPreview] = useState(null);
  const [verification, setVerification] = useState(null);

  const [formData, setFormData] = useState({
    femaleName: '',
    femaleMpeid: '',
    procedureDate: new Date().toISOString().split('T')[0],
    doctorName: '',
  });

  const normalizeMpeid = (v) => v ? v.trim().replace(/^[Ii][Dd]-?/i, '').replace(/^10-/, '').replace(/[^0-9]/g, '') : v;
  const normalizeName = (v) => v ? v.trim().toUpperCase().replace(/\s+/g, ' ') : v;

  const compressForScan = (file) => new Promise((resolve) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      const canvas = document.createElement('canvas');
      const MAX = 1280;
      let { width, height } = img;
      if (width > MAX || height > MAX) {
        if (width > height) { height = Math.round(height * MAX / width); width = MAX; }
        else { width = Math.round(width * MAX / height); height = MAX; }
      }
      canvas.width = width; canvas.height = height;
      canvas.getContext('2d').drawImage(img, 0, 0, width, height);
      canvas.toBlob((blob) => resolve(new File([blob], 'scan.jpg', { type: 'image/jpeg' })), 'image/jpeg', 0.8);
    };
    img.onerror = () => { URL.revokeObjectURL(url); resolve(file); };
    img.src = url;
  });

  const handleScan = async (e) => {
    const rawFile = e.target.files[0];
    if (!rawFile) return;
    const file = await compressForScan(rawFile);
    setScanPreview(URL.createObjectURL(file));
    setScanning(true);
    setVerification(null);
    try {
      const result = await api.scanPatientLabel(file, 'female', 'qwen.qwen3-vl-235b-a22b');
      if (result.success && result.extracted) {
        const d = result.extracted;
        const scannedName = [d.name, d.last_name].filter(Boolean).join(' ').trim();
        const scannedMpeid = normalizeMpeid(d.mpeid || '');
        const nameMatch = !scannedName || normalizeName(formData.femaleName) === normalizeName(scannedName);
        const mpeidMatch = !scannedMpeid || normalizeMpeid(formData.femaleMpeid) === scannedMpeid;
        setVerification({ status: nameMatch && mpeidMatch ? 'match' : 'mismatch', scannedName, scannedMpeid, nameMatch, mpeidMatch });
      } else {
        setError(result.error || 'Could not read label. Please try again.');
      }
    } catch { setError('Scan failed. Please try again.'); }
    finally { setScanning(false); }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const result = await api.registerSocialFreezingCase({
        female_patient: {
          name: normalizeName(formData.femaleName),
          mpeid: normalizeMpeid(formData.femaleMpeid),
          type: 'self',
        },
        procedure_date: formData.procedureDate,
        doctor_name: formData.doctorName,
        model_config: { model_id: 'qwen.qwen3-vl-235b-a22b', model_name: 'Qwen3 VL 235B' },
      });
      onComplete(result.sessionId);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const inputStyle = { width: '100%', padding: '0.65rem 0.85rem', border: '1.5px solid #e2e8f0', borderRadius: '8px', fontSize: '0.9rem', outline: 'none', boxSizing: 'border-box', background: '#fff' };
  const labelStyle = { display: 'block', marginBottom: '0.35rem', fontWeight: 600, fontSize: '0.82rem', color: '#374151' };
  const fieldStyle = { marginBottom: '0.85rem' };
  const hasMismatch = verification?.status === 'mismatch';

  return (
    <div className="registration-form" style={{ maxWidth: '600px', margin: '0 auto', padding: '2rem 1rem' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '1.5rem' }}>
        <button onClick={onBack} className="btn-secondary" style={{ padding: '7px 14px', display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
          <IconBack /> Back
        </button>
        <div>
          <h2 style={{ margin: 0, fontSize: '1.5rem', fontWeight: 700, color: '#1a202c' }}>🧊 Register Social Freezing Case</h2>
          <p style={{ margin: 0, fontSize: '0.85rem', color: '#64748b' }}>Enter patient details for embryo cryopreservation</p>
        </div>
      </div>

      {error && (
        <div style={{ background: '#ffebee', color: '#c62828', padding: '0.75rem 1rem', borderRadius: '8px', marginBottom: '1.25rem', fontSize: '0.85rem', borderLeft: '4px solid #f44336' }}>
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit}>
        {/* Female Patient Card */}
        <div style={{ background: '#fff', border: '1.5px solid #e2e8f0', borderRadius: '14px', padding: '1.5rem', marginBottom: '1.5rem', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '1rem' }}>
            <div style={{ width: '38px', height: '38px', borderRadius: '50%', background: 'linear-gradient(135deg, #f093fb, #f5576c)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontSize: '0.9rem', fontWeight: 700 }}>F</div>
            <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700, color: '#1a202c' }}>Patient Details</h3>
          </div>

          <div style={fieldStyle}>
            <label style={labelStyle}>Full Name <span style={{ color: '#e11d48' }}>*</span></label>
            <input style={inputStyle} type="text" placeholder="e.g. PRACHI JAIN"
              value={formData.femaleName}
              onChange={(e) => { setFormData({ ...formData, femaleName: e.target.value }); setVerification(null); }}
              onBlur={() => setFormData(p => ({ ...p, femaleName: normalizeName(p.femaleName) }))}
              required />
          </div>
          <div style={fieldStyle}>
            <label style={labelStyle}>MPID <span style={{ color: '#e11d48' }}>*</span></label>
            <input style={inputStyle} type="text" placeholder="e.g. 102192605"
              value={formData.femaleMpeid}
              onChange={(e) => { setFormData({ ...formData, femaleMpeid: e.target.value }); setVerification(null); }}
              onBlur={() => setFormData(p => ({ ...p, femaleMpeid: normalizeMpeid(p.femaleMpeid) }))}
              required />
            <small style={{ fontSize: '0.78rem', color: '#94a3b8', marginTop: '4px', display: 'block' }}>Numbers only — ID- prefix removed automatically</small>
          </div>

          {/* Scan box */}
          <div style={{ padding: '0.85rem 1rem', background: 'linear-gradient(135deg, #f0f4ff, #f5f0ff)', borderRadius: '10px', border: '1.5px dashed #667eea' }}>
            <p style={{ margin: '0 0 0.5rem', fontSize: '0.82rem', color: '#555', fontWeight: 500 }}>📷 Scan to verify</p>
            <div style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap' }}>
              <label style={{ cursor: 'pointer' }}>
                <input type="file" accept="image/*" capture="environment" style={{ display: 'none' }} onChange={handleScan} disabled={scanning} />
                <span className="btn-secondary" style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', padding: '0.45rem 0.9rem', fontSize: '0.85rem' }}>
                  <IconCamera /> {scanning ? 'Scanning...' : 'Take Photo'}
                </span>
              </label>
              {showUpload && (
                <label style={{ cursor: 'pointer' }}>
                  <input type="file" accept="image/*" style={{ display: 'none' }} onChange={handleScan} disabled={scanning} />
                  <span className="btn-secondary" style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', padding: '0.45rem 0.9rem', fontSize: '0.85rem' }}>
                    <IconUpload /> Upload
                  </span>
                </label>
              )}
              {scanPreview && !scanning && (
                <img src={scanPreview} alt="scan" style={{ height: '44px', borderRadius: '6px', border: '1px solid #ddd', objectFit: 'cover' }} />
              )}
            </div>
            {verification && (
              <div style={{ marginTop: '0.75rem', padding: '0.75rem', borderRadius: '8px', border: `1.5px solid ${verification.status === 'match' ? '#22c55e' : '#f59e0b'}`, background: verification.status === 'match' ? '#f0fdf4' : '#fffbeb' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 600, fontSize: '0.85rem', color: verification.status === 'match' ? '#16a34a' : '#b45309' }}>
                  {verification.status === 'match' ? <IconCheck /> : <IconWarning />}
                  {verification.status === 'match' ? 'Verified — details match' : 'Mismatch — please review'}
                </div>
                {verification.status === 'mismatch' && (
                  <div style={{ fontSize: '0.82rem', color: '#78350f', marginTop: '0.5rem' }}>
                    {!verification.nameMatch && <div>Name on label: <strong>{verification.scannedName || '—'}</strong></div>}
                    {!verification.mpeidMatch && <div>MPID on label: <strong>{verification.scannedMpeid || '—'}</strong></div>}
                    <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
                      <button type="button" onClick={() => {
                        setFormData(p => ({ ...p, femaleName: verification.scannedName || p.femaleName, femaleMpeid: verification.scannedMpeid || p.femaleMpeid }));
                        setVerification({ ...verification, status: 'match' });
                      }} style={{ padding: '0.35rem 0.8rem', fontSize: '0.8rem', borderRadius: '6px', border: '1.5px solid #f59e0b', background: '#fef3c7', color: '#92400e', cursor: 'pointer', fontWeight: 600 }}>
                        Use scanned values
                      </button>
                      <button type="button" onClick={() => setVerification({ ...verification, status: 'match' })}
                        style={{ padding: '0.35rem 0.8rem', fontSize: '0.8rem', borderRadius: '6px', border: '1.5px solid #94a3b8', background: '#f8fafc', color: '#475569', cursor: 'pointer', fontWeight: 600 }}>
                        Keep my values
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Procedure Details */}
        <div style={{ background: '#fff', border: '1.5px solid #e2e8f0', borderRadius: '14px', padding: '1.5rem', marginBottom: '1.5rem', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
          <h3 style={{ margin: '0 0 1rem', fontSize: '1rem', fontWeight: 700, color: '#1a202c' }}>Procedure Details</h3>
          <div style={fieldStyle}>
            <label style={labelStyle}>Procedure Date <span style={{ color: '#e11d48' }}>*</span></label>
            <input style={inputStyle} type="date" value={formData.procedureDate}
              onChange={(e) => setFormData({ ...formData, procedureDate: e.target.value })} required />
          </div>
          <div style={fieldStyle}>
            <label style={labelStyle}>Doctor Name <span style={{ color: '#e11d48' }}>*</span></label>
            <input style={inputStyle} type="text" placeholder="e.g. Dr. Sharma"
              value={formData.doctorName}
              onChange={(e) => setFormData({ ...formData, doctorName: e.target.value })} required />
          </div>
        </div>

        {hasMismatch && (
          <div style={{ background: '#fffbeb', border: '1.5px solid #f59e0b', borderRadius: '10px', padding: '0.85rem 1rem', marginBottom: '1.25rem', fontSize: '0.85rem', color: '#92400e', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <IconWarning /> Resolve the mismatch above before registering.
          </div>
        )}

        <div style={{ display: 'flex', justifyContent: 'center' }}>
          <button type="submit" disabled={loading || hasMismatch} className="btn-primary"
            style={{ padding: '0.85rem 2.5rem', fontSize: '1rem', display: 'inline-flex', alignItems: 'center', gap: '8px', opacity: hasMismatch ? 0.5 : 1 }}>
            {loading ? 'Registering...' : '🧊 Register Case'}
          </button>
        </div>
      </form>
    </div>
  );
}

export default SocialFreezingRegistration;
