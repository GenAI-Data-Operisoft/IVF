/**
 * Case Status — shows all 7 IVF stage statuses, patient details, and validation results for a session.
 */
import React, { useState, useEffect } from 'react';
import { api } from '../api';
import { STAGES } from '../config';
import usePermissionStore from '../store/permissionStore';

function CaseStatus({ sessionId, caseData: initialData, onStartNew, onStartStage, userRole, onBack }) {
  const { canEdit } = usePermissionStore();
  const isViewer = !canEdit('ivfCapture');
  const [caseData, setCaseData] = useState(initialData);
  const [loading, setLoading] = useState(false);
  const [selectedStage, setSelectedStage] = useState(null);
  const [stageDetails, setStageDetails] = useState(null);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editedData, setEditedData] = useState(null);
  const [saving, setSaving] = useState(false);

  const refreshStatus = async () => {
    setLoading(true);
    try {
      const data = await api.getCase(sessionId);
      setCaseData(data);
    } catch (error) {
    } finally {
      setLoading(false);
    }
  };

  const viewStageDetails = async (stageId) => {
    setSelectedStage(stageId);
    setLoadingDetails(true);
    try {
      // Special handling for ICSI Documentation - show annotated images
      if (stageId === 'icsi_documentation') {
        const data = await api.getAnnotatedImages(sessionId);
        setStageDetails(data.images || []);
        setLoadingDetails(false);
        return;
      }
      
      // For other stages - show extraction and validation data
      const data = await api.getStageExtractions(sessionId, stageId);
      if (data.extractions && data.extractions.length > 0) {
        // Sort extractions by timestamp (oldest first) to show chronological order
        const sortedExtractions = data.extractions.sort((a, b) => {
          const timeA = new Date(a.extracted_at || a.created_at || 0);
          const timeB = new Date(b.extracted_at || b.created_at || 0);
          return timeA - timeB;
        });
        
        // Get download URLs for images
        const extractionsWithImages = await Promise.all(
          sortedExtractions.map(async (extraction) => {
            try {
              const s3Path = extraction.s3_path || extraction.s3_key;
              if (!s3Path) {
                return { ...extraction, imageUrl: null };
              }
              const { downloadUrl } = await api.getImageDownloadUrl(s3Path);
              return { ...extraction, imageUrl: downloadUrl };
            } catch (err) {
              return { ...extraction, imageUrl: null };
            }
          })
        );
        setStageDetails(extractionsWithImages);
      }
    } catch (error) {
    } finally {
      setLoadingDetails(false);
    }
  };

  const closeDetails = () => {
    setSelectedStage(null);
    setStageDetails(null);
  };

  const handleStartValidation = (stageId) => {
    // Call parent callback to navigate to stage capture
    if (onStartStage) {
      onStartStage(stageId);
    }
  };

  const handleEditPatient = () => {
    // Initialize edit form with current data
    setEditedData({
      male_patient: {
        name: caseData.male_patient.name,
        last_name: caseData.male_patient.last_name || '',
        mpeid: caseData.male_patient.mpeid,
        dob: caseData.male_patient.dob || ''
      },
      female_patient: {
        name: caseData.female_patient.name,
        last_name: caseData.female_patient.last_name || '',
        mpeid: caseData.female_patient.mpeid,
        dob: caseData.female_patient.dob || ''
      }
    });
    setShowEditModal(true);
  };

  const handleSavePatientDetails = async () => {
    // Validate required fields (only name and MPEID are required)
    if (!editedData.male_patient.name || !editedData.male_patient.mpeid) {
      alert('Male patient name and MPEID are required');
      return;
    }
    if (!editedData.female_patient.name || !editedData.female_patient.mpeid) {
      alert('Female patient name and MPEID are required');
      return;
    }

    setSaving(true);
    try {
      await api.updatePatientDetails(sessionId, editedData);
      
      // Refresh case data
      await refreshStatus();
      
      setShowEditModal(false);
    } catch (error) {
      alert('Failed to update patient details. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const handleEditChange = (patientType, field, value) => {
    setEditedData(prev => ({
      ...prev,
      [patientType]: {
        ...prev[patientType],
        [field]: value
      }
    }));
  };

  useEffect(() => {
    if (!caseData) {
      refreshStatus();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!caseData) {
    return <div>Loading...</div>;
  }

  const getStageIcon = (status) => {
    switch (status) {
      case 'completed':
        return (
          <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#4caf50" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/>
          </svg>
        );
      case 'failed':
        return (
          <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#f44336" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/>
          </svg>
        );
      case 'in_progress':
        return (
          <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#ff9800" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
          </svg>
        );
      default:
        return (
          <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#9e9e9e" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10"/>
          </svg>
        );
    }
  };

  return (
    <div className="case-status">
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '1rem' }}>
        <button onClick={onBack || onStartNew} className="btn-secondary" style={{ padding: '7px 12px', display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6"/>
          </svg>
          Back
        </button>
        <h2 style={{ margin: 0 }}>Case Status</h2>
      </div>
      
      <div className="status-header" style={{ position: 'relative' }}>
        {!isViewer && (
        <button 
          onClick={handleEditPatient}
          className="btn-secondary"
          style={{ 
            position: 'absolute',
            top: '0',
            right: '0',
            padding: '0.4rem 0.8rem',
            fontSize: '0.85rem',
            minWidth: 'auto',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '4px'
          }}
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{marginRight:'4px'}}><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
          Edit Patient Details
        </button>
        )}
        <p><strong>Session ID:</strong> <code>{sessionId}</code></p>
        <p><strong>Model:</strong> {caseData.model_config.model_name.replace(/\s*⭐.*$/, '').replace(/\s*\(.*?\)\s*$/, '')}</p>
        <p><strong>Procedure Date:</strong> {caseData.procedure_start_date}</p>
      </div>

      <div className="patient-summary">
        <div className="patient-card">
          <h3>Male Patient</h3>
          <p><strong>Name:</strong> {caseData.male_patient.name} {caseData.male_patient.last_name}</p>
          <p><strong>MPEID:</strong> {caseData.male_patient.mpeid}</p>
          {caseData.male_patient.dob && <p><strong>DOB:</strong> {caseData.male_patient.dob}</p>}
        </div>
        <div className="patient-card">
          <h3>Female Patient</h3>
          <p><strong>Name:</strong> {caseData.female_patient.name} {caseData.female_patient.last_name}</p>
          <p><strong>MPEID:</strong> {caseData.female_patient.mpeid}</p>
          {caseData.female_patient.dob && <p><strong>DOB:</strong> {caseData.female_patient.dob}</p>}
        </div>
      </div>

      <div className="stages-status">
        <h3>Stages Progress</h3>
        <div className="stages-list">
          {STAGES.map((stage, stageIndex) => {
            const stageData = caseData.stages[stage.id] || { status: 'pending', images_uploaded: 0, images_required: stage.images };
            
            // All stages unlocked — user can process any stage in any order
            const isUnlocked = true;

            return (
              <div key={stage.id} className={`stage-item ${stageData.status}`} style={{ opacity: !isUnlocked && stageData.status === 'pending' ? 0.55 : 1 }}>
                <span className="stage-icon">{getStageIcon(stageData.status)}</span>
                <div className="stage-details">
                  <h4>{stage.name}</h4>
                  <p>Status: <strong>{stageData.status}</strong></p>
                  <p>Images: {(stageData.status === 'completed' || stageData.status === 'failed') 
                    ? `${stageData.images_required || stage.images} / ${stageData.images_required || stage.images}`
                    : `${stageData.images_uploaded || 0} / ${stageData.images_required || stage.images}`}
                  </p>
                  {stageData.validation_result && (
                    <p>Validation: <strong>{stageData.validation_result}</strong></p>
                  )}
                  
                  {/* Token usage for completed stages (only for AI stages) */}
                  {stageData.status === 'completed' && stage.id !== 'icsi_documentation' && (
                    <div className="token-usage" style={{ marginTop: '0.5rem', fontSize: '0.85rem', color: '#666' }}>
                      {caseData[`${stage.id}_input_tokens`] !== undefined && (
                        <p>
                          Tokens: {Number(caseData[`${stage.id}_input_tokens`] || 0).toLocaleString()} in | {Number(caseData[`${stage.id}_output_tokens`] || 0).toLocaleString()} out | 
                          <strong> ${Number(caseData[`${stage.id}_cost_usd`] || 0).toFixed(5)} USD</strong>
                        </p>
                      )}
                    </div>
                  )}
                  
                  {/* View Details button for completed or failed stages */}
                  {(stageData.status === 'completed' || stageData.status === 'failed') && (
                    <button 
                      onClick={() => viewStageDetails(stage.id)}
                      className="btn-view-details"
                      style={{ marginTop: '0.5rem', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                      View Details
                    </button>
                  )}
                </div>
                {stageData.status === 'pending' && !isViewer && (
                  <button
                    onClick={() => handleStartValidation(stage.id)}
                    className="btn-start-validation"
                  >
                    {stage.id === 'icsi_documentation' ? (
                      <>
                        <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>
                        Start Documentation
                      </>
                    ) : (
                      <>
                        <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="5 3 19 12 5 21 5 3"/></svg>
                        Start Validation
                      </>
                    )}
                  </button>
                )}
                {(stageData.status === 'completed' || stageData.status === 'failed' || stageData.status === 'in_progress') && !isViewer && (
                  <button
                    onClick={() => handleStartValidation(stage.id)}
                    className="btn-retry-validation"
                    style={{
                      backgroundColor: stageData.status === 'in_progress' ? '#667eea' : '#ff9800',
                      color: 'white',
                      border: 'none',
                      padding: '0.6rem 1.2rem',
                      borderRadius: '6px',
                      fontSize: '0.9rem',
                      fontWeight: '600',
                      cursor: 'pointer',
                      marginTop: '0.5rem',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '6px',
                      boxShadow: stageData.status === 'in_progress' ? '0 2px 4px rgba(102,126,234,0.3)' : '0 2px 4px rgba(255,152,0,0.3)',
                      transition: 'all 0.2s ease'
                    }}
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{flexShrink:0}}><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 .49-4.5"/></svg>
                    Retry Validation
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Token Usage Summary */}
      {caseData.total_input_tokens > 0 && (
        <div className="token-summary" style={{ 
          marginTop: '2rem', 
          padding: '1.5rem', 
          backgroundColor: '#f8f9fa', 
          borderRadius: '8px',
          border: '2px solid #dee2e6'
        }}>
        <h3 style={{ marginBottom: '1rem', color: '#495057', display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#495057" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>
          Token Usage Summary
        </h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
            <div style={{ textAlign: 'center' }}>
              <p style={{ fontSize: '0.9rem', color: '#6c757d', marginBottom: '0.25rem' }}>Total Input Tokens</p>
              <p style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#007bff' }}>
                {Number(caseData.total_input_tokens || 0).toLocaleString()}
              </p>
            </div>
            <div style={{ textAlign: 'center' }}>
              <p style={{ fontSize: '0.9rem', color: '#6c757d', marginBottom: '0.25rem' }}>Total Output Tokens</p>
              <p style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#28a745' }}>
                {Number(caseData.total_output_tokens || 0).toLocaleString()}
              </p>
            </div>
            <div style={{ textAlign: 'center' }}>
              <p style={{ fontSize: '0.9rem', color: '#6c757d', marginBottom: '0.25rem' }}>Total Cost</p>
              <p style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#dc3545' }}>
                ${Number(caseData.total_cost_usd || 0).toFixed(5)} USD
              </p>
            </div>
          </div>
        </div>
      )}

      <div className="status-actions">
        <button onClick={refreshStatus} disabled={loading} className="btn-secondary" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
          {loading ? 'Refreshing...' : (
            <>
              <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 .49-4.5"/></svg>
              Refresh Status
            </>
          )}
        </button>
        {!isViewer && (
          <button onClick={onStartNew} className="btn-primary" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
            <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            Start New Case
          </button>
        )}
      </div>

      {/* Details Modal */}
      {selectedStage && (
        <div className="modal-overlay" onClick={closeDetails}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Stage Details: {STAGES.find(s => s.id === selectedStage)?.name}</h3>
              <button className="modal-close" onClick={closeDetails}>✕</button>
            </div>
            
            <div className="modal-body">
              {loadingDetails ? (
                <div className="loading-spinner">
                  <img src="https://d1nmtja0c4ok3x.cloudfront.net/IVFgif.gif" alt="Loading..." style={{ width: '80px', height: '80px', objectFit: 'contain' }} />
                  <p>Loading details...</p>
                </div>
              ) : stageDetails && stageDetails.length > 0 ? (
                selectedStage === 'icsi_documentation' ? (
                  // Display annotated images for ICSI Documentation
                  <div className="annotated-images-display">
                    <p className="info-text">
                      Annotated images of injected oocytes captured during ICSI procedure
                    </p>
                    <div className="details-grid">
                      {stageDetails.map((image, index) => (
                        <div key={image.imageId || index} className="detail-card">
                          <h4>Oocyte {image.oocyte_number}</h4>
                          
                          {/* Image Preview */}
                          <div className="detail-image-preview">
                            <img src={image.download_url} alt={`Oocyte ${image.oocyte_number}`} />
                          </div>
                          
                          {/* Image Info */}
                          <div className="detail-section">
                            <h5 style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                              Image Information
                            </h5>
                            <div className="detail-info">
                              <p><strong>Captured:</strong> {new Date(image.captured_at).toLocaleString()}</p>
                              <p><strong>Status:</strong> {image.annotation_status}</p>
                              <p><strong>Downloads:</strong> {image.download_count || 0}</p>
                            </div>
                          </div>
                          
                          {/* Download Button */}
                          <button 
                            onClick={() => window.open(image.download_url, '_blank')}
                            className="btn-secondary"
                            style={{ width: '100%', marginTop: '1rem', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                            Download Image
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  // Display extraction and validation data for other stages
                  <div className="details-grid">
                    {stageDetails.map((extraction, index) => (
                      <div key={index} className="detail-card">
                        <h4>Image {index + 1}</h4>
                        
                        {/* Image Preview */}
                        {extraction.imageUrl ? (
                          <div className="detail-image-preview">
                            <img src={extraction.imageUrl} alt={`Uploaded ${index + 1}`} />
                          </div>
                        ) : (
                          <div className="detail-image-placeholder">
                            <p>Image not available</p>
                          </div>
                        )}
                        
                        {/* Extracted Data */}
                        <div className="detail-section">
                          <h5 style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>
                            Extracted Data
                          </h5>
                          <div className="detail-info">
                            {extraction.extracted_data ? (
                              <>
                                {(extraction.extracted_data.male_name || extraction.extracted_data.female_name) && (
                                  <p><strong>Name:</strong> {extraction.extracted_data.male_name || extraction.extracted_data.female_name || 'N/A'}</p>
                                )}
                                {(extraction.extracted_data.male_mpeid || extraction.extracted_data.female_mpeid) && (
                                  <p><strong>MPEID:</strong> {extraction.extracted_data.male_mpeid || extraction.extracted_data.female_mpeid || 'N/A'}</p>
                                )}
                                {extraction.extracted_data.male_dob && (
                                  <p><strong>Male DOB:</strong> {extraction.extracted_data.male_dob}</p>
                                )}
                                {extraction.extracted_data.female_dob && (
                                  <p><strong>Female DOB:</strong> {extraction.extracted_data.female_dob}</p>
                                )}
                                {!extraction.extracted_data.male_name && !extraction.extracted_data.female_name && 
                                 !extraction.extracted_data.male_mpeid && !extraction.extracted_data.female_mpeid && (
                                  <p className="no-data-text">No data extracted from image</p>
                                )}
                              </>
                            ) : (
                              <>
                                <p><strong>Name:</strong> {extraction.extracted_name || 'N/A'}</p>
                                <p><strong>MPEID:</strong> {extraction.extracted_mpeid || 'N/A'}</p>
                                {extraction.extracted_dob && (
                                  <p><strong>DOB:</strong> {extraction.extracted_dob}</p>
                                )}
                              </>
                            )}
                          </div>
                        </div>
                        
                        {/* Validation Result */}
                        {extraction.validation_result && (
                          <div className={`detail-section validation-badge ${extraction.validation_result.overall_match ? 'match' : 'mismatch'}`}>
                            <h5>✓ Validation Result</h5>
                            <p className="validation-status">
                              {extraction.validation_result.overall_match ? '✅ Match' : '❌ Mismatch'}
                            </p>
                            
                            {/* Show detailed validation info */}
                            <div className="matched-info">
                              {extraction.validation_result.male_name_match !== undefined && extraction.validation_result.male_name_match !== null && (
                                <p><strong>Male Name:</strong> {extraction.validation_result.male_name_match ? '✅ Match' : '❌ Mismatch'}</p>
                              )}
                              {extraction.validation_result.male_mpeid_match !== undefined && extraction.validation_result.male_mpeid_match !== null && (
                                <p><strong>Male MPEID:</strong> {extraction.validation_result.male_mpeid_match ? '✅ Match' : '❌ Mismatch'}</p>
                              )}
                              {extraction.validation_result.female_name_match !== undefined && extraction.validation_result.female_name_match !== null && (
                                <p><strong>Female Name:</strong> {extraction.validation_result.female_name_match ? '✅ Match' : '❌ Mismatch'}</p>
                              )}
                              {extraction.validation_result.female_mpeid_match !== undefined && extraction.validation_result.female_mpeid_match !== null && (
                                <p><strong>Female MPEID:</strong> {extraction.validation_result.female_mpeid_match ? '✅ Match' : '❌ Mismatch'}</p>
                              )}
                              
                              {/* Show mismatches if any */}
                              {extraction.validation_result.mismatches && extraction.validation_result.mismatches.length > 0 && (
                                <div className="mismatch-details">
                                  <p><strong>Mismatches:</strong></p>
                                  <ul>
                                    {extraction.validation_result.mismatches.map((mismatch, idx) => (
                                      <li key={idx}>
                                        <strong>{mismatch.field}:</strong> Expected "{mismatch.expected}", Found "{mismatch.found || 'N/A'}"
                                      </li>
                                    ))}
                                  </ul>
                                </div>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )
              ) : (
                <div className="no-data">
                  <p>No data available for this stage.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Edit Patient Details Modal */}
      {showEditModal && editedData && (
        <div className="modal-overlay" onClick={() => setShowEditModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '600px' }}>
            <div className="modal-header">
            <h3 style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
              Edit Patient Details
            </h3>
              <button className="modal-close" onClick={() => setShowEditModal(false)}>✕</button>
            </div>
            
            <div className="modal-body">
              <div style={{ marginBottom: '2rem' }}>
                <h4 style={{ marginBottom: '1rem', color: '#007bff' }}>Male Patient</h4>
                <div style={{ display: 'grid', gap: '1rem' }}>
                  <div>
                    <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold' }}>
                      First Name <span style={{ color: 'red' }}>*</span>
                    </label>
                    <input
                      type="text"
                      value={editedData.male_patient.name}
                      onChange={(e) => handleEditChange('male_patient', 'name', e.target.value)}
                      style={{ width: '100%', padding: '0.5rem', border: '1px solid #ccc', borderRadius: '4px' }}
                      required
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold' }}>
                      Last Name
                    </label>
                    <input
                      type="text"
                      value={editedData.male_patient.last_name}
                      onChange={(e) => handleEditChange('male_patient', 'last_name', e.target.value)}
                      style={{ width: '100%', padding: '0.5rem', border: '1px solid #ccc', borderRadius: '4px' }}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold' }}>
                      MPEID <span style={{ color: 'red' }}>*</span>
                    </label>
                    <input
                      type="text"
                      value={editedData.male_patient.mpeid}
                      onChange={(e) => handleEditChange('male_patient', 'mpeid', e.target.value)}
                      style={{ width: '100%', padding: '0.5rem', border: '1px solid #ccc', borderRadius: '4px' }}
                      required
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold' }}>
                      Date of Birth
                    </label>
                    <input
                      type="date"
                      value={editedData.male_patient.dob}
                      onChange={(e) => handleEditChange('male_patient', 'dob', e.target.value)}
                      style={{ width: '100%', padding: '0.5rem', border: '1px solid #ccc', borderRadius: '4px' }}
                    />
                  </div>
                </div>
              </div>

              <div style={{ marginBottom: '2rem' }}>
                <h4 style={{ marginBottom: '1rem', color: '#e91e63' }}>Female Patient</h4>
                <div style={{ display: 'grid', gap: '1rem' }}>
                  <div>
                    <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold' }}>
                      First Name <span style={{ color: 'red' }}>*</span>
                    </label>
                    <input
                      type="text"
                      value={editedData.female_patient.name}
                      onChange={(e) => handleEditChange('female_patient', 'name', e.target.value)}
                      style={{ width: '100%', padding: '0.5rem', border: '1px solid #ccc', borderRadius: '4px' }}
                      required
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold' }}>
                      Last Name
                    </label>
                    <input
                      type="text"
                      value={editedData.female_patient.last_name}
                      onChange={(e) => handleEditChange('female_patient', 'last_name', e.target.value)}
                      style={{ width: '100%', padding: '0.5rem', border: '1px solid #ccc', borderRadius: '4px' }}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold' }}>
                      MPEID <span style={{ color: 'red' }}>*</span>
                    </label>
                    <input
                      type="text"
                      value={editedData.female_patient.mpeid}
                      onChange={(e) => handleEditChange('female_patient', 'mpeid', e.target.value)}
                      style={{ width: '100%', padding: '0.5rem', border: '1px solid #ccc', borderRadius: '4px' }}
                      required
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold' }}>
                      Date of Birth
                    </label>
                    <input
                      type="date"
                      value={editedData.female_patient.dob}
                      onChange={(e) => handleEditChange('female_patient', 'dob', e.target.value)}
                      style={{ width: '100%', padding: '0.5rem', border: '1px solid #ccc', borderRadius: '4px' }}
                    />
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end' }}>
                <button
                  onClick={() => setShowEditModal(false)}
                  className="btn-secondary"
                  disabled={saving}
                >
                  Cancel
                </button>
                <button
                  onClick={handleSavePatientDetails}
                  className="btn-primary"
                  disabled={saving}
                >
                  {saving ? 'Saving...' : (
                    <>
                      <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>
                      Save Changes
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default CaseStatus;
