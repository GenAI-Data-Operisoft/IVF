import React, { useState } from 'react';
import { api } from '../api';

function RegistrationForm({ onComplete, onViewSessions, onBack }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [formData, setFormData] = useState({
    maleName: '',
    maleMpeid: '',
    maleDob: '',
    maleLastName: '',
    femaleName: '',
    femaleMpeid: '',
    femaleDob: '',
    femaleLastName: '',
    procedureDate: new Date().toISOString().split('T')[0],
    modelId: 'qwen.qwen3-vl-235b-a22b',
    modelName: 'Qwen3 VL 235B ⭐ (Best OCR)'
  });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const caseData = {
        male_patient: {
          name: formData.maleName,
          mpeid: normalizeMpeid(formData.maleMpeid),
          dob: formData.maleDob,
          last_name: formData.maleLastName
        },
        female_patient: {
          name: formData.femaleName,
          mpeid: normalizeMpeid(formData.femaleMpeid),
          dob: formData.femaleDob,
          last_name: formData.femaleLastName
        },
        procedure_start_date: formData.procedureDate,
        model_config: {
          model_id: formData.modelId,
          model_name: formData.modelName
        }
      };

      const result = await api.registerCase(caseData);
      onComplete(result.sessionId);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const normalizeMpeid = (mpeid) => {
    if (!mpeid) return mpeid;
    
    const trimmed = mpeid.trim().toUpperCase();
    
    // If it already starts with ID-, return as is
    if (trimmed.startsWith('ID-')) {
      return trimmed;
    }
    
    // If it starts with id- (lowercase), convert to uppercase
    if (trimmed.toLowerCase().startsWith('id-')) {
      return 'ID-' + trimmed.substring(3);
    }
    
    // If it's just numbers, add ID- prefix
    if (/^\d+$/.test(trimmed)) {
      return 'ID-' + trimmed;
    }
    
    // For other formats (M12345, F67890, etc.), return as is
    return trimmed;
  };

  const normalizeName = (name) => {
    if (!name) return name;
    
    // Convert to uppercase and trim
    const normalized = name.trim().toUpperCase();
    
    // Remove multiple spaces between words
    return normalized.replace(/\s+/g, ' ');
  };

  const handleNameChange = (field, value) => {
    setFormData({...formData, [field]: value});
  };

  const handleNameBlur = (field) => {
    // Auto-format name to uppercase on blur
    const currentValue = formData[field];
    const normalized = normalizeName(currentValue);
    if (normalized !== currentValue) {
      setFormData({...formData, [field]: normalized});
    }
  };

  const handleMpeidChange = (field, value) => {
    // Update the form data
    setFormData({...formData, [field]: value});
  };

  const handleMpeidBlur = (field) => {
    // Auto-format on blur (when user leaves the field)
    const currentValue = formData[field];
    const normalized = normalizeMpeid(currentValue);
    if (normalized !== currentValue) {
      setFormData({...formData, [field]: normalized});
    }
  };

  return (
    <div className="registration-form">
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '1rem' }}>
        <button onClick={onBack || onViewSessions} className="btn-secondary" style={{ padding: '7px 12px', display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6"/>
          </svg>
          Back
        </button>
        <h2 style={{ margin: 0 }}>Register New IVF Case</h2>
      </div>
      
      {error && <div className="error-message">{error}</div>}

      <form onSubmit={handleSubmit}>
        <div className="form-section">
          <h3>Male Patient Information</h3>
          <div className="form-row">
            <div className="input-group">
              <input
                type="text"
                placeholder="First Name *"
                value={formData.maleName}
                onChange={(e) => handleNameChange('maleName', e.target.value)}
                onBlur={() => handleNameBlur('maleName')}
                required
              />
              <small className="input-hint">
                {formData.maleName && normalizeName(formData.maleName) !== formData.maleName && (
                  <span className="auto-format-hint">→ Will be saved as: {normalizeName(formData.maleName)}</span>
                )}
              </small>
            </div>
            <div className="input-group">
              <input
                type="text"
                placeholder="Last Name"
                value={formData.maleLastName}
                onChange={(e) => handleNameChange('maleLastName', e.target.value)}
                onBlur={() => handleNameBlur('maleLastName')}
              />
              <small className="input-hint">
                {formData.maleLastName && normalizeName(formData.maleLastName) !== formData.maleLastName && (
                  <span className="auto-format-hint">→ Will be saved as: {normalizeName(formData.maleLastName)}</span>
                )}
              </small>
            </div>
          </div>
          <div className="form-row">
            <div className="input-group">
              <input
                type="text"
                placeholder="MPEID *"
                value={formData.maleMpeid}
                onChange={(e) => handleMpeidChange('maleMpeid', e.target.value)}
                onBlur={() => handleMpeidBlur('maleMpeid')}
                required
              />
              <small className="input-hint">
                Enter ID number (e.g., 35697344 or ID-35697344)
                {formData.maleMpeid && normalizeMpeid(formData.maleMpeid) !== formData.maleMpeid && (
                  <span className="auto-format-hint"> → Will be saved as: {normalizeMpeid(formData.maleMpeid)}</span>
                )}
              </small>
            </div>
            <input
              type="date"
              placeholder="Date of Birth"
              value={formData.maleDob}
              onChange={(e) => setFormData({...formData, maleDob: e.target.value})}
            />
          </div>
        </div>

        <div className="form-section">
          <h3>Female Patient Information</h3>
          <div className="form-row">
            <div className="input-group">
              <input
                type="text"
                placeholder="First Name *"
                value={formData.femaleName}
                onChange={(e) => handleNameChange('femaleName', e.target.value)}
                onBlur={() => handleNameBlur('femaleName')}
                required
              />
              <small className="input-hint">
                {formData.femaleName && normalizeName(formData.femaleName) !== formData.femaleName && (
                  <span className="auto-format-hint">→ Will be saved as: {normalizeName(formData.femaleName)}</span>
                )}
              </small>
            </div>
            <div className="input-group">
              <input
                type="text"
                placeholder="Last Name"
                value={formData.femaleLastName}
                onChange={(e) => handleNameChange('femaleLastName', e.target.value)}
                onBlur={() => handleNameBlur('femaleLastName')}
              />
              <small className="input-hint">
                {formData.femaleLastName && normalizeName(formData.femaleLastName) !== formData.femaleLastName && (
                  <span className="auto-format-hint">→ Will be saved as: {normalizeName(formData.femaleLastName)}</span>
                )}
              </small>
            </div>
          </div>
          <div className="form-row">
            <div className="input-group">
              <input
                type="text"
                placeholder="MPEID *"
                value={formData.femaleMpeid}
                onChange={(e) => handleMpeidChange('femaleMpeid', e.target.value)}
                onBlur={() => handleMpeidBlur('femaleMpeid')}
                required
              />
              <small className="input-hint">
                Enter ID number (e.g., 35697344 or ID-35697344)
                {formData.femaleMpeid && normalizeMpeid(formData.femaleMpeid) !== formData.femaleMpeid && (
                  <span className="auto-format-hint"> → Will be saved as: {normalizeMpeid(formData.femaleMpeid)}</span>
                )}
              </small>
            </div>
            <input
              type="date"
              placeholder="Date of Birth"
              value={formData.femaleDob}
              onChange={(e) => setFormData({...formData, femaleDob: e.target.value})}
            />
          </div>
        </div>

        <div className="form-section">
          <h3>Procedure Details</h3>
          <div className="form-row">
            <input
              type="date"
              value={formData.procedureDate}
              onChange={(e) => setFormData({...formData, procedureDate: e.target.value})}
              required
            />
          </div>
        </div>

        <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center', marginTop: '1rem' }}>
          <button type="submit" disabled={loading} className="btn-primary">
            {loading ? 'Registering...' : 'Register Case'}
          </button>
          <button type="button" onClick={onViewSessions} className="btn-secondary" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
            <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>
            View Previous Sessions
          </button>
        </div>
      </form>
    </div>
  );
}

export default RegistrationForm;
