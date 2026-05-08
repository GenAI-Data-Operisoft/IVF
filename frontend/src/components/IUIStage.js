/**
 * IUIStage — Optional IUI (Intrauterine Insemination) stage.
 * Two side-by-side sections matching the Sperm Preparation UI pattern:
 *   Left:  Male sperm sample — validated against male patient details
 *   Right: Female sample — validated against female patient details
 */
import React, { useState } from 'react';
import { api } from '../api';
import ImageCropModal from './ImageCropModal';

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

const compressImage = (file) => new Promise((resolve) => {
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
    const quality = file.size < 1024 * 1024 ? 0.92 : 0.85;
    canvas.toBlob(
      (blob) => resolve(new File([blob], file.name.replace(/\.[^.]+$/, '.jpg'), { type: 'image/jpeg' })),
      'image/jpeg', quality
    );
  };
  img.onerror = () => { URL.revokeObjectURL(url); resolve(file); };
  img.src = url;
});

function IUIStage({ sessionId, caseData, onComplete, onViewStatus }) {
  // Male section state
  const [maleUploading, setMaleUploading] = useState(false);
  const [maleProcessing, setMaleProcessing] = useState(false);
  const [malePreview, setMalePreview] = useState(null);
  const [maleValidation, setMaleValidation] = useState(null);
  const [maleError, setMaleError] = useState(null);
  const [maleCropFile, setMaleCropFile] = useState(null);

  // Female section state
  const [femaleUploading, setFemaleUploading] = useState(false);
  const [femaleProcessing, setFemaleProcessing] = useState(false);
  const [femalePreview, setFemalePreview] = useState(null);
  const [femaleValidation, setFemaleValidation] = useState(null);
  const [femaleError, setFemaleError] = useState(null);
  const [femaleCropFile, setFemaleCropFile] = useState(null);

  const [completing, setCompleting] = useState(false);

  const handleCapture = (e, patientType) => {
    const file = e.target.files[0];
    if (!file) return;
    if (patientType === 'male') setMaleCropFile(file);
    else setFemaleCropFile(file);
  };

  const uploadAndValidate = async (croppedFile, patientType) => {
    const imageNumber = patientType === 'male' ? 1 : 2;
    const setUploading = patientType === 'male' ? setMaleUploading : setFemaleUploading;
    const setProcessing = patientType === 'male' ? setMaleProcessing : setFemaleProcessing;
    const setPreview = patientType === 'male' ? setMalePreview : setFemalePreview;
    const setValidation = patientType === 'male' ? setMaleValidation : setFemaleValidation;
    const setError = patientType === 'male' ? setMaleError : setFemaleError;

    setUploading(true);
    setError(null);
    setValidation(null);
    try {
      const file = await compressImage(croppedFile);
      setPreview(URL.createObjectURL(file));
      const { uploadUrl } = await api.getPresignedUrl(sessionId, 'iui', imageNumber);
      await api.uploadImage(uploadUrl, file);
      setUploading(false);
      setProcessing(true);

      // Poll for validation result
      let attempts = 0;
      const poll = async () => {
        try {
          const data = await api.getStageExtractions(sessionId, 'iui');
          const extraction = data.extractions?.find(e => e.image_number === imageNumber);
          if (extraction?.extraction_status === 'validated') {
            setProcessing(false);
            setValidation(extraction.validation_result || {});
            return;
          }
          attempts++;
          if (attempts < 30) setTimeout(poll, 3000);
          else { setProcessing(false); setError('Validation timed out. Please retry.'); }
        } catch {
          attempts++;
          if (attempts < 30) setTimeout(poll, 3000);
          else { setProcessing(false); setError('Validation failed. Please retry.'); }
        }
      };
      poll();
    } catch (err) {
      setUploading(false);
      setError(err.message);
    }
  };

  const handleSkip = async () => {
    try {
      await api.completeStage(sessionId, 'iui', 'skipped');
    } catch { /* silent */ }
    if (onViewStatus) onViewStatus();
  };

  const handleComplete = async () => {
    setCompleting(true);
    try {
      await api.completeStage(sessionId, 'iui');
      if (onComplete) onComplete();
    } catch {
      if (onComplete) onComplete();
    } finally {
      setCompleting(false);
    }
  };

  const subCardStyle = {
    flex: 1, background: '#fff', border: '1.5px solid #e2e8f0',
    borderRadius: '12px', padding: '1.25rem',
    boxShadow: '0 2px 6px rgba(0,0,0,0.05)',
  };

  const renderSection = (patientType) => {
    const isMale = patientType === 'male';
    const label = isMale ? 'Male — Sperm Sample' : 'Female — Sample';
    const initials = isMale ? 'MS' : 'FS';
    const patient = isMale ? caseData?.male_patient : caseData?.female_patient;
    const uploading = isMale ? maleUploading : femaleUploading;
    const processing = isMale ? maleProcessing : femaleProcessing;
    const preview = isMale ? malePreview : femalePreview;
    const validation = isMale ? maleValidation : femaleValidation;
    const error = isMale ? maleError : femaleError;
    const cropFile = isMale ? maleCropFile : femaleCropFile;
    const setCropFile = isMale ? setMaleCropFile : setFemaleCropFile;

    const borderColor = validation
      ? (validation.overall_result === 'pass' ? '#22c55e' : '#f59e0b')
      : '#e2e8f0';

    return (
      <div style={{ ...subCardStyle, border: `1.5px solid ${borderColor}` }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '0.85rem' }}>
          <div style={{
            width: '32px', height: '32px', borderRadius: '50%',
            background: validation?.overall_result === 'pass' ? '#22c55e' : 'linear-gradient(135deg,#667eea,#764ba2)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: 'white', fontSize: '0.75rem', fontWeight: 700, flexShrink: 0
          }}>
            {validation?.overall_result === 'pass' ? '✓' : initials}
          </div>
          <h4 style={{ margin: 0, fontSize: '1rem', fontWeight: 700, color: '#1a202c' }}>{label}</h4>
          {validation && (
            <span style={{
              marginLeft: 'auto',
              background: validation.overall_result === 'pass' ? '#dcfce7' : '#fef3c7',
              color: validation.overall_result === 'pass' ? '#16a34a' : '#92400e',
              padding: '2px 10px', borderRadius: '10px', fontSize: '0.75rem', fontWeight: 700
            }}>
              {validation.overall_result === 'pass' ? '✓ Validated' : '⚠ Mismatch'}
            </span>
          )}
        </div>

        {/* Patient info */}
        <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '0.65rem 0.85rem', marginBottom: '0.85rem', fontSize: '0.82rem', color: '#374151' }}>
          <p style={{ margin: '0 0 2px', fontWeight: 600 }}>{isMale ? 'Male' : 'Female'} Patient</p>
          <p style={{ margin: 0, color: '#64748b' }}>
            {patient ? `${patient.name} · ${patient.mpeid}` : 'Loading...'}
          </p>
        </div>

        {/* Content */}
        {preview ? (
          <div>
            <img src={preview} alt={label} style={{ width: '100%', height: '120px', objectFit: 'cover', borderRadius: '8px', border: '1px solid #e2e8f0', marginBottom: '0.5rem' }} />
            {processing && (
              <p style={{ fontSize: '0.82rem', color: '#667eea', margin: '0.5rem 0' }}>🔄 Validating...</p>
            )}
            {validation && (
              <div>
                {validation.matches?.map((m, i) => (
                  <div key={i} style={{ fontSize: '0.8rem', color: '#16a34a', marginBottom: '2px' }}>✓ {m.field}: {m.found}</div>
                ))}
                {validation.mismatches?.map((m, i) => (
                  <div key={i} style={{ fontSize: '0.8rem', color: '#dc2626', marginBottom: '2px' }}>✗ {m.field} — Expected: {m.expected}, Found: {m.found}</div>
                ))}
              </div>
            )}
            {error && <p style={{ fontSize: '0.82rem', color: '#dc2626', margin: '0.5rem 0' }}>{error}</p>}
            {/* Retry */}
            {!processing && (
              <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
                <label style={{ cursor: 'pointer' }}>
                  <input type="file" accept="image/jpeg,image/jpg,image/png" capture="environment" style={{ display: 'none' }}
                    onChange={(e) => handleCapture(e, patientType)} disabled={uploading} />
                  <span className="btn-secondary" style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', padding: '0.4rem 0.75rem', fontSize: '0.8rem' }}>
                    <IconCamera /> Retake
                  </span>
                </label>
              </div>
            )}
          </div>
        ) : (
          <div>
            <p style={{ fontSize: '0.8rem', color: '#64748b', marginBottom: '0.6rem' }}>
              Upload label image for {isMale ? 'male' : 'female'} patient validation
            </p>
            {error && <p style={{ fontSize: '0.82rem', color: '#dc2626', marginBottom: '0.5rem' }}>{error}</p>}
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
              <label style={{ cursor: 'pointer' }}>
                <input type="file" accept="image/jpeg,image/jpg,image/png" capture="environment" style={{ display: 'none' }}
                  onChange={(e) => handleCapture(e, patientType)} disabled={uploading} />
                <span className="btn-secondary" style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', padding: '0.45rem 0.85rem', fontSize: '0.82rem' }}>
                  <IconCamera /> {uploading ? '...' : 'Take Photo'}
                </span>
              </label>
            </div>
          </div>
        )}

        {/* Crop modal */}
        {cropFile && (
          <ImageCropModal
            imageFile={cropFile}
            onCrop={(croppedFile) => { setCropFile(null); uploadAndValidate(croppedFile, patientType); }}
            onCancel={() => setCropFile(null)}
          />
        )}
      </div>
    );
  };

  return (
    <div style={{ maxWidth: '900px', margin: '0 auto', padding: '1.5rem 1rem' }}>
      {/* Header */}
      <div style={{ marginBottom: '1.5rem', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.75rem' }}>
        <div>
          <h2 style={{ margin: 0, fontSize: '1.3rem', fontWeight: 700, color: '#1a202c' }}>
            IUI — Intrauterine Insemination
          </h2>
          <p style={{ margin: '0.25rem 0 0', fontSize: '0.85rem', color: '#64748b' }}>
            Optional stage — validate male sperm sample and female sample separately
          </p>
        </div>
        <button onClick={handleSkip} className="btn-secondary" style={{ fontSize: '0.85rem', padding: '0.45rem 1rem' }}>
          Skip IUI Stage
        </button>
      </div>

      {/* Two sections side by side */}
      <div style={{ display: 'flex', gap: '1.25rem', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
        {renderSection('male')}
        {renderSection('female')}
      </div>

      {/* Bottom actions */}
      <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
        <button onClick={handleSkip} className="btn-secondary">View Status</button>
        <button onClick={handleComplete} className="btn-primary" disabled={completing} style={{ padding: '0.55rem 1.5rem' }}>
          {completing ? 'Completing...' : '✅ Complete IUI Stage'}
        </button>
      </div>
    </div>
  );
}

export default IUIStage;
