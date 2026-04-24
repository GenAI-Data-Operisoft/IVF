/**
 * Registration Form — collects male and female patient details to start a new IVF case.
 * Flow: user types Name + MPID manually first, then scans to verify.
 */
import React, { useState } from 'react';
import { api } from '../api';
import usePermissionStore from '../store/permissionStore';

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

const IconBack = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="15 18 9 12 15 6"/>
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

function RegistrationForm({ onComplete, onViewSessions, onBack, user }) {
  const { canUploadImage } = usePermissionStore();
  const showUpload = canUploadImage();

  const userCenter = user?.centers?.[0] || '';
  const isAdmin = user?.role === 'admin';

  const ALL_CENTERS = [
    'Cloudnine Hospital Malleswaram',
    'Cloudnine Hospital Malad',
    'Cloudnine Hospital Ludhiana',
  ];

  const centerOptions = isAdmin ? ALL_CENTERS : [];
  const defaultCenter = isAdmin ? '' : userCenter;

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [scanningMale, setScanningMale] = useState(false);
  const [scanningFemale, setScanningFemale] = useState(false);
  const [maleScanPreview, setMaleScanPreview] = useState(null);
  const [femaleScanPreview, setFemaleScanPreview] = useState(null);

  // Verification state per patient: null | { status: 'match'|'mismatch', scannedName, scannedMpeid }
  const [maleVerification, setMaleVerification] = useState(null);
  const [femaleVerification, setFemaleVerification] = useState(null);

  // Donor state
  const [maleType, setMaleType] = useState('self'); // 'self' | 'donor'
  const [femaleType, setFemaleType] = useState('self'); // 'self' | 'donor'

  const [formData, setFormData] = useState({
    maleName: '',
    maleMpeid: '',
    maleDonorId: '',
    femaleName: '',
    femaleMpeid: '',
    femaleDonorName: '',
    femaleDonorMpeid: '',
    femaleDonorId: '',
    femaleDonorRemark: '',
    procedureDate: new Date().toISOString().split('T')[0],
    doctorName: '',
    center: defaultCenter,
    modelId: 'qwen.qwen3-vl-235b-a22b',
    modelName: 'Qwen3 VL 235B ⭐ (Best OCR)',
  });

  const normalizeMpeid = (mpeid) => {
    if (!mpeid) return mpeid;
    const trimmed = mpeid.trim().toUpperCase();
    if (trimmed.startsWith('ID-')) return trimmed;
    if (trimmed.toLowerCase().startsWith('id-')) return 'ID-' + trimmed.substring(3);
    if (/^\d+$/.test(trimmed)) return 'ID-' + trimmed;
    return trimmed;
  };

  const normalizeName = (name) => {
    if (!name) return name;
    return name.trim().toUpperCase().replace(/\s+/g, ' ');
  };

  // Compare typed vs scanned — normalize both before comparing
  const compareFields = (typed, scanned) => {
    if (!scanned) return true; // if OCR didn't extract, don't flag mismatch
    return normalizeName(typed) === normalizeName(scanned);
  };

  // Compress image for scan — mobile cameras produce huge files that exceed API Gateway limits
  const compressForScan = (file) => new Promise((resolve) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      const canvas = document.createElement('canvas');
      const MAX = 1280; // enough for OCR, keeps base64 under 1MB
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

  const handleScanLabel = async (e, patientType) => {
    const rawFile = e.target.files[0];
    if (!rawFile) return;
    const file = await compressForScan(rawFile);

    const isMale = patientType === 'male';
    const setScanning = isMale ? setScanningMale : setScanningFemale;
    const setPreview = isMale ? setMaleScanPreview : setFemaleScanPreview;
    const setVerification = isMale ? setMaleVerification : setFemaleVerification;
    const typedName = isMale ? formData.maleName : formData.femaleName;
    const typedMpeid = isMale ? formData.maleMpeid : formData.femaleMpeid;

    setPreview(URL.createObjectURL(file));
    setScanning(true);
    setVerification(null);
    setError(null);

    try {
      const result = await api.scanPatientLabel(file, patientType, formData.modelId);
      if (result.success && result.extracted) {
        const d = result.extracted;
        const scannedName = [d.name, d.last_name].filter(Boolean).join(' ').trim();
        const scannedMpeid = d.mpeid || '';

        const nameMatch = compareFields(typedName, scannedName);
        const mpeidMatch = compareFields(normalizeMpeid(typedMpeid), normalizeMpeid(scannedMpeid));
        const allMatch = nameMatch && mpeidMatch;

        setVerification({
          status: allMatch ? 'match' : 'mismatch',
          scannedName,
          scannedMpeid: normalizeMpeid(scannedMpeid),
          nameMatch,
          mpeidMatch,
        });
      } else {
        setError(result.error || 'Could not read label. Please try again.');
      }
    } catch {
      setError('Scan failed. Please try again.');
    } finally {
      setScanning(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      let caseCenter = '';
      if (!isAdmin) {
        try {
          const { fetchUserAttributes } = await import('aws-amplify/auth');
          const attrs = await fetchUserAttributes();
          const centersRaw = attrs['custom:centers'];
          if (centersRaw) {
            const parsed = JSON.parse(centersRaw);
            caseCenter = Array.isArray(parsed) ? (parsed[0] || '') : String(parsed);
          }
        } catch (err) {
          console.error('Failed to fetch user center:', err);
        }
      }
      const result = await api.registerCase({
        male_patient:   {
          name: normalizeName(formData.maleName),
          mpeid: maleType === 'self' ? normalizeMpeid(formData.maleMpeid) : '',
          type: maleType,
          donor_id: maleType === 'donor' ? formData.maleDonorId.trim() : '',
        },
        female_patient: {
          name: normalizeName(formData.femaleName),
          mpeid: normalizeMpeid(formData.femaleMpeid),
          type: femaleType,
          donor_name: femaleType === 'donor' ? normalizeName(formData.femaleDonorName) : '',
          donor_mpeid: femaleType === 'donor' ? normalizeMpeid(formData.femaleDonorMpeid) : '',
          donor_id: femaleType === 'donor' ? formData.femaleDonorId.trim() : '',
          donor_remark: femaleType === 'donor' ? formData.femaleDonorRemark.trim() : '',
        },
        procedure_start_date: formData.procedureDate,
        doctor_name: formData.doctorName,
        center: caseCenter,
        model_config: { model_id: formData.modelId, model_name: formData.modelName },
      });
      onComplete(result.sessionId);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const inputStyle = {
    width: '100%',
    padding: '0.65rem 0.85rem',
    border: '1.5px solid #e2e8f0',
    borderRadius: '8px',
    fontSize: '0.9rem',
    outline: 'none',
    boxSizing: 'border-box',
    transition: 'border-color 0.2s',
    background: '#fff',
  };

  const labelStyle = {
    display: 'block',
    marginBottom: '0.35rem',
    fontWeight: 600,
    fontSize: '0.82rem',
    color: '#374151',
    letterSpacing: '0.2px',
  };

  const fieldStyle = { marginBottom: '0.85rem' };

  const VerificationResult = ({ verification, patientType, onOverride }) => {
    if (!verification) return null;
    const isMatch = verification.status === 'match';
    return (
      <div style={{
        marginTop: '0.75rem',
        padding: '0.85rem 1rem',
        borderRadius: '10px',
        border: `1.5px solid ${isMatch ? '#22c55e' : '#f59e0b'}`,
        background: isMatch ? '#f0fdf4' : '#fffbeb',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: isMatch ? 0 : '0.6rem', fontWeight: 600, fontSize: '0.85rem', color: isMatch ? '#16a34a' : '#b45309' }}>
          {isMatch ? <IconCheck /> : <IconWarning />}
          {isMatch ? 'Verified — details match' : 'Mismatch detected — please review'}
        </div>
        {!isMatch && (
          <div style={{ fontSize: '0.82rem', color: '#78350f' }}>
            {!verification.nameMatch && (
              <div style={{ marginBottom: '3px' }}>
                Name on label: <strong>{verification.scannedName || '—'}</strong>
              </div>
            )}
            {!verification.mpeidMatch && (
              <div style={{ marginBottom: '6px' }}>
                MPID on label: <strong>{verification.scannedMpeid || '—'}</strong>
              </div>
            )}
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginTop: '0.5rem' }}>
              <button type="button" onClick={() => onOverride(verification)} style={{
                padding: '0.35rem 0.8rem', fontSize: '0.8rem', borderRadius: '6px',
                border: '1.5px solid #f59e0b', background: '#fef3c7', color: '#92400e',
                cursor: 'pointer', fontWeight: 600,
              }}>
                Use scanned values
              </button>
              <button type="button" onClick={() => {
                if (patientType === 'male') setMaleVerification({ ...verification, status: 'match' });
                else setFemaleVerification({ ...verification, status: 'match' });
              }} style={{
                padding: '0.35rem 0.8rem', fontSize: '0.8rem', borderRadius: '6px',
                border: '1.5px solid #94a3b8', background: '#f8fafc', color: '#475569',
                cursor: 'pointer', fontWeight: 600,
              }}>
                Keep my values
              </button>
            </div>
          </div>
        )}
      </div>
    );
  };

  const ScanBox = ({ patientType, scanning, preview, verification, typedName, typedMpeid }) => {
    const canScan = typedName.trim().length > 0 && typedMpeid.trim().length > 0;
    const setVerification = patientType === 'male' ? setMaleVerification : setFemaleVerification;

    const handleOverride = (v) => {
      if (patientType === 'male') {
        setFormData(prev => ({
          ...prev,
          maleName: v.scannedName || prev.maleName,
          maleMpeid: v.scannedMpeid || prev.maleMpeid,
        }));
        setMaleVerification({ ...v, status: 'match' });
      } else {
        setFormData(prev => ({
          ...prev,
          femaleName: v.scannedName || prev.femaleName,
          femaleMpeid: v.scannedMpeid || prev.femaleMpeid,
        }));
        setFemaleVerification({ ...v, status: 'match' });
      }
    };

    return (
      <div style={{
        marginBottom: '1rem',
        padding: '0.85rem 1rem',
        background: canScan ? 'linear-gradient(135deg, #f0f4ff 0%, #f5f0ff 100%)' : '#f8fafc',
        borderRadius: '10px',
        border: `1.5px dashed ${canScan ? '#667eea' : '#cbd5e1'}`,
        opacity: canScan ? 1 : 0.7,
        transition: 'all 0.2s',
      }}>
        <p style={{ margin: '0 0 0.5rem', fontSize: '0.82rem', color: canScan ? '#555' : '#94a3b8', fontWeight: 500 }}>
          📷 Scan to verify
          {!canScan && <span style={{ marginLeft: '6px', fontSize: '0.78rem', color: '#94a3b8' }}>(enter Name & MPID first)</span>}
        </p>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap' }}>
          <label style={{ cursor: canScan ? 'pointer' : 'not-allowed' }}>
            <input type="file" accept="image/*" capture="environment" style={{ display: 'none' }}
              onChange={(e) => handleScanLabel(e, patientType)} disabled={scanning || !canScan} />
            <span className="btn-secondary" style={{
              display: 'inline-flex', alignItems: 'center', gap: '5px',
              padding: '0.45rem 0.9rem', fontSize: '0.85rem',
              opacity: canScan ? 1 : 0.5, pointerEvents: canScan ? 'auto' : 'none',
            }}>
              <IconCamera /> {scanning ? 'Scanning...' : 'Take Photo'}
            </span>
          </label>
          {showUpload && (
            <label style={{ cursor: canScan ? 'pointer' : 'not-allowed' }}>
              <input type="file" accept="image/*" style={{ display: 'none' }}
                onChange={(e) => handleScanLabel(e, patientType)} disabled={scanning || !canScan} />
              <span className="btn-secondary" style={{
                display: 'inline-flex', alignItems: 'center', gap: '5px',
                padding: '0.45rem 0.9rem', fontSize: '0.85rem',
                opacity: canScan ? 1 : 0.5, pointerEvents: canScan ? 'auto' : 'none',
              }}>
                <IconUpload /> Upload Image
              </span>
            </label>
          )}
          {scanning && <span style={{ fontSize: '0.8rem', color: '#667eea', fontStyle: 'italic' }}>Reading label...</span>}
          {preview && !scanning && (
            <img src={preview} alt="Scanned label" style={{ height: '44px', borderRadius: '6px', border: '1px solid #ddd', objectFit: 'cover' }} />
          )}
        </div>
        <VerificationResult
          verification={verification}
          patientType={patientType}
          onOverride={handleOverride}
        />
      </div>
    );
  };

  // Block submit if a scan was done but still shows mismatch
  const hasMismatch =
    (maleVerification && maleVerification.status === 'mismatch') ||
    (femaleVerification && femaleVerification.status === 'mismatch');

  return (
    <div className="registration-form" style={{ maxWidth: 'none', padding: '2rem' }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '1.5rem' }}>
        <button onClick={onBack || onViewSessions} className="btn-secondary"
          style={{ padding: '7px 14px', display: 'inline-flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
          <IconBack /> Back
        </button>
        <div>
          <h2 style={{ margin: 0, fontSize: '1.6rem', fontWeight: 700, color: '#1a202c', textAlign: 'left' }}>Register New IVF Case</h2>
          <p style={{ margin: 0, fontSize: '0.85rem', color: '#64748b' }}>Enter patient details, then scan to verify</p>
        </div>
      </div>

      {error && (
        <div style={{ background: '#ffebee', color: '#c62828', padding: '0.75rem 1rem', borderRadius: '8px', marginBottom: '1.25rem', fontSize: '0.85rem', borderLeft: '4px solid #f44336' }}>
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit}>

        {/* Two-column patient grid — responsive for iPad/mobile */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1.5rem', marginBottom: '1.5rem' }}>

          {/* Male Patient */}
          <div style={{ background: '#fff', border: '1.5px solid #e2e8f0', borderRadius: '14px', padding: '1.5rem', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '0.75rem' }}>
              <div style={{ width: '38px', height: '38px', borderRadius: '50%', background: 'linear-gradient(135deg, #667eea, #764ba2)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontSize: '0.9rem', fontWeight: 700, flexShrink: 0 }}>M</div>
              <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700, color: '#1a202c' }}>{maleType === 'donor' ? 'Male Donor Details' : 'Male Patient'}</h3>
            </div>

            {/* Self / Donor radio */}
            <div style={{ display: 'flex', gap: '1rem', marginBottom: '1rem' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', fontSize: '0.85rem', fontWeight: 600, color: maleType === 'self' ? '#667eea' : '#64748b' }}>
                <input type="radio" name="maleType" value="self" checked={maleType === 'self'} onChange={() => setMaleType('self')} style={{ accentColor: '#667eea' }} /> Self
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', fontSize: '0.85rem', fontWeight: 600, color: maleType === 'donor' ? '#f59e0b' : '#64748b' }}>
                <input type="radio" name="maleType" value="donor" checked={maleType === 'donor'} onChange={() => setMaleType('donor')} style={{ accentColor: '#f59e0b' }} /> Donor
              </label>
            </div>

            {maleType === 'self' ? (
              <>
                <div style={fieldStyle}>
                  <label style={labelStyle}>Full Name <span style={{ color: '#e11d48' }}>*</span></label>
                  <input style={inputStyle} type="text" placeholder="e.g. HIMANSHU SHARMA"
                    value={formData.maleName}
                    onChange={(e) => { setFormData({ ...formData, maleName: e.target.value }); setMaleVerification(null); }}
                    onBlur={() => setFormData(p => ({ ...p, maleName: normalizeName(p.maleName) }))}
                    required />
                </div>
                <div style={fieldStyle}>
                  <label style={labelStyle}>MPID <span style={{ color: '#e11d48' }}>*</span></label>
                  <input style={inputStyle} type="text" placeholder="e.g. ID-102192605"
                    value={formData.maleMpeid}
                    onChange={(e) => { setFormData({ ...formData, maleMpeid: e.target.value }); setMaleVerification(null); }}
                    onBlur={() => setFormData(p => ({ ...p, maleMpeid: normalizeMpeid(p.maleMpeid) }))}
                    required />
                  <small style={{ fontSize: '0.78rem', color: '#94a3b8', marginTop: '4px', display: 'block' }}>Enter number only or with ID- prefix</small>
                </div>
                <ScanBox patientType="male" scanning={scanningMale} preview={maleScanPreview} verification={maleVerification} typedName={formData.maleName} typedMpeid={formData.maleMpeid} />
              </>
            ) : (
              <>
                <div style={fieldStyle}>
                  <label style={labelStyle}>Donor ID <span style={{ color: '#e11d48' }}>*</span></label>
                  <input style={inputStyle} type="text" placeholder="e.g. D-12345"
                    value={formData.maleDonorId}
                    onChange={(e) => { setFormData({ ...formData, maleDonorId: e.target.value }); setMaleVerification(null); }}
                    required />
                  <small style={{ fontSize: '0.78rem', color: '#94a3b8', marginTop: '4px', display: 'block' }}>This Donor ID will be used for petri dish validation</small>
                </div>
                <ScanBox patientType="male" scanning={scanningMale} preview={maleScanPreview} verification={maleVerification} typedName={formData.maleDonorId || 'DONOR'} typedMpeid={formData.maleDonorId} />
              </>
            )}
          </div>

          {/* Female Patient */}
          <div style={{ background: '#fff', border: '1.5px solid #e2e8f0', borderRadius: '14px', padding: '1.5rem', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '0.75rem' }}>
              <div style={{ width: '38px', height: '38px', borderRadius: '50%', background: 'linear-gradient(135deg, #f093fb, #f5576c)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontSize: '0.9rem', fontWeight: 700, flexShrink: 0 }}>F</div>
              <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700, color: '#1a202c' }}>Female Patient</h3>
            </div>

            {/* Self / Donor radio */}
            <div style={{ display: 'flex', gap: '1rem', marginBottom: '1rem' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', fontSize: '0.85rem', fontWeight: 600, color: femaleType === 'self' ? '#f093fb' : '#64748b' }}>
                <input type="radio" name="femaleType" value="self" checked={femaleType === 'self'} onChange={() => setFemaleType('self')} style={{ accentColor: '#f093fb' }} /> Self
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', fontSize: '0.85rem', fontWeight: 600, color: femaleType === 'donor' ? '#f59e0b' : '#64748b' }}>
                <input type="radio" name="femaleType" value="donor" checked={femaleType === 'donor'} onChange={() => setFemaleType('donor')} style={{ accentColor: '#f59e0b' }} /> Donor
              </label>
            </div>

            {/* Existing female patient details — always shown */}
            <div style={fieldStyle}>
              <label style={labelStyle}>Full Name <span style={{ color: '#e11d48' }}>*</span></label>
              <input style={inputStyle} type="text" placeholder="e.g. PRACHI JAIN"
                value={formData.femaleName}
                onChange={(e) => { setFormData({ ...formData, femaleName: e.target.value }); setFemaleVerification(null); }}
                onBlur={() => setFormData(p => ({ ...p, femaleName: normalizeName(p.femaleName) }))}
                required />
            </div>
            <div style={fieldStyle}>
              <label style={labelStyle}>MPID <span style={{ color: '#e11d48' }}>*</span></label>
              <input style={inputStyle} type="text" placeholder="e.g. ID-102192605"
                value={formData.femaleMpeid}
                onChange={(e) => { setFormData({ ...formData, femaleMpeid: e.target.value }); setFemaleVerification(null); }}
                onBlur={() => setFormData(p => ({ ...p, femaleMpeid: normalizeMpeid(p.femaleMpeid) }))}
                required />
              <small style={{ fontSize: '0.78rem', color: '#94a3b8', marginTop: '4px', display: 'block' }}>Enter number only or with ID- prefix</small>
            </div>

            {femaleType === 'self' && (
              <ScanBox patientType="female" scanning={scanningFemale} preview={femaleScanPreview} verification={femaleVerification} typedName={formData.femaleName} typedMpeid={formData.femaleMpeid} />
            )}

            {/* Donor fields — shown when donor is selected */}
            {femaleType === 'donor' && (
              <div style={{ marginTop: '1rem', padding: '1rem', background: '#fffbeb', border: '1.5px solid #fde68a', borderRadius: '10px' }}>
                <p style={{ margin: '0 0 0.75rem', fontWeight: 700, fontSize: '0.88rem', color: '#92400e' }}>Female Donor Details</p>
                <div style={fieldStyle}>
                  <label style={labelStyle}>Donor Name <span style={{ color: '#e11d48' }}>*</span></label>
                  <input style={inputStyle} type="text" placeholder="e.g. DONOR NAME"
                    value={formData.femaleDonorName}
                    onChange={(e) => setFormData({ ...formData, femaleDonorName: e.target.value })}
                    onBlur={() => setFormData(p => ({ ...p, femaleDonorName: normalizeName(p.femaleDonorName) }))}
                    required />
                </div>
                <div style={fieldStyle}>
                  <label style={labelStyle}>Donor MPID <span style={{ color: '#e11d48' }}>*</span></label>
                  <input style={inputStyle} type="text" placeholder="e.g. ID-999888777"
                    value={formData.femaleDonorMpeid}
                    onChange={(e) => setFormData({ ...formData, femaleDonorMpeid: e.target.value })}
                    onBlur={() => setFormData(p => ({ ...p, femaleDonorMpeid: normalizeMpeid(p.femaleDonorMpeid) }))}
                    required />
                </div>
                <div style={fieldStyle}>
                  <label style={labelStyle}>Donor ID <span style={{ color: '#e11d48' }}>*</span></label>
                  <input style={inputStyle} type="text" placeholder="e.g. D-54321"
                    value={formData.femaleDonorId}
                    onChange={(e) => setFormData({ ...formData, femaleDonorId: e.target.value })}
                    required />
                </div>
                <ScanBox patientType="female" scanning={scanningFemale} preview={femaleScanPreview} verification={femaleVerification} typedName={formData.femaleDonorName} typedMpeid={formData.femaleDonorMpeid} />
                <div style={fieldStyle}>
                  <label style={labelStyle}>Remark</label>
                  <textarea style={{ ...inputStyle, minHeight: '60px', resize: 'vertical', fontFamily: 'inherit' }}
                    placeholder="Any notes about the donor..."
                    value={formData.femaleDonorRemark}
                    onChange={(e) => setFormData({ ...formData, femaleDonorRemark: e.target.value })} />
                </div>
                <small style={{ fontSize: '0.78rem', color: '#92400e' }}>Petri dish validation will use Donor Name + Donor MPID. Female patient details are kept for the record.</small>
              </div>
            )}
          </div>
        </div>

        {/* Mismatch warning above submit */}
        {hasMismatch && (
          <div style={{ background: '#fffbeb', border: '1.5px solid #f59e0b', borderRadius: '10px', padding: '0.85rem 1rem', marginBottom: '1.25rem', fontSize: '0.85rem', color: '#92400e', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <IconWarning /> Resolve the mismatch above before registering.
          </div>
        )}

        {/* Procedure Details */}
        <div style={{ background: '#fff', border: '1.5px solid #e2e8f0', borderRadius: '14px', padding: '1.5rem', marginBottom: '2rem', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
          <h3 style={{ margin: '0 0 1.25rem', fontSize: '1.1rem', fontWeight: 700, color: '#1a202c', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#667eea" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
            Procedure Details
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
            <div>
              <label style={labelStyle}>Procedure Date <span style={{ color: '#e11d48' }}>*</span></label>
              <input style={inputStyle} type="date"
                value={formData.procedureDate}
                onChange={(e) => setFormData({ ...formData, procedureDate: e.target.value })}
                required />
            </div>
            <div>
              <label style={labelStyle}>Doctor Name <span style={{ color: '#e11d48' }}>*</span></label>
              <input style={inputStyle} type="text" placeholder="e.g. Dr. Sharma"
                value={formData.doctorName}
                onChange={(e) => setFormData({ ...formData, doctorName: e.target.value })}
                required />
            </div>
          </div>
        </div>

        {/* Actions */}
        <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center' }}>
          <button type="submit" disabled={loading || hasMismatch} className="btn-primary"
            style={{ padding: '0.85rem 2.5rem', fontSize: '1rem', display: 'inline-flex', alignItems: 'center', gap: '8px', opacity: hasMismatch ? 0.5 : 1 }}>
            {loading ? (
              <>
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ animation: 'spin 1s linear infinite' }}><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 .49-4.5"/></svg>
                Registering...
              </>
            ) : (
              <>
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
                Register Case
              </>
            )}
          </button>
          <button type="button" onClick={onViewSessions} className="btn-secondary"
            style={{ padding: '0.85rem 2rem', fontSize: '1rem', display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
            View Previous Sessions
          </button>
        </div>

      </form>
    </div>
  );
}

export default RegistrationForm;
