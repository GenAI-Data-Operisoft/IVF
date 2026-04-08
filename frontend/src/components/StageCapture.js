/**
 * Stage Capture — handles image upload, AI processing, and validation result display for each IVF stage.
 */
import React, { useState, useEffect } from 'react';
import { api } from '../api';
import { STAGES } from '../config';

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

const RESOLUTION_CATEGORIES = [
  "Retook Photo - Better Lighting",
  "Retook Photo - Better Focus",
  "Retook Photo - Better Angle",
  "Retook Photo - Different Camera",
  "Corrected Label Position",
  "Cleaned Label Surface",
  "Label Was Actually Incorrect",
  "Other (specify in notes)"
];

function StageCapture({ sessionId, caseData, stage, onComplete, onViewStatus }) {
  const [uploadedImages, setUploadedImages] = useState([]);
  const [currentImage, setCurrentImage] = useState(1);
  const [uploading, setUploading] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [validationResult, setValidationResult] = useState(null);
  const [error, setError] = useState(null);
  const [showPreviousResult, setShowPreviousResult] = useState(false);
  const [showResolutionModal, setShowResolutionModal] = useState(false);
  const [resolutionCategory, setResolutionCategory] = useState('');
  const [resolutionNotes, setResolutionNotes] = useState('');
  const [wasRetry, setWasRetry] = useState(false);
  const [stuckInProgress, setStuckInProgress] = useState(false);

  // Check if this is the last stage
  const isLastStage = stage.id === STAGES[STAGES.length - 1].id;

  // Check if stage was already completed
  const stageStatus = caseData?.stages?.[stage.id]?.status;
  const isAlreadyCompleted = stageStatus === 'completed' || stageStatus === 'failed';
  const isStuckInProgress = stageStatus === 'in_progress';

  // Reset state when stage changes
  useEffect(() => {
    setUploadedImages([]);
    setUploading(false);
    setProcessing(false);
    setValidationResult(null);
    setError(null);
    setShowPreviousResult(false);
    setStuckInProgress(false);
    
    if (isAlreadyCompleted) {
      // Stage done — load previous result
      loadPreviousValidation();
    } else if (isStuckInProgress) {
      // Stage is in_progress — resume polling for the result
      setCurrentImage(1);
      setProcessing(true);
      resumePolling();
    } else {
      setCurrentImage(1);
    }
  }, [stage.id]);

  const loadPreviousValidation = async () => {
    try {
      const data = await api.getStageExtractions(sessionId, stage.id);
      
      if (data.extractions.length > 0) {
        // Find the highest image number used so far
        const maxImageNumber = Math.max(...data.extractions.map(e => e.image_number || 1));
        
        // Set current image to next number for retry
        const nextImageNumber = maxImageNumber + 1;
        setCurrentImage(nextImageNumber);
        
        // Sort extractions by validated_at timestamp (most recent validation first)
        const sortedExtractions = data.extractions.sort((a, b) => {
          // Use validated_at if available (this is when validation completed)
          // Otherwise fall back to extracted_at (when OCR completed)
          const timeA = new Date(a.validated_at || a.extracted_at || 0);
          const timeB = new Date(b.validated_at || b.extracted_at || 0);
          return timeB - timeA; // Descending order (newest first)
        });
        
        // Get the LATEST extraction (first in descending sorted array)
        const latestExtraction = sortedExtractions[0];
        
        if (latestExtraction.validation_result) {
          setValidationResult(latestExtraction.validation_result);
          setShowPreviousResult(true);
        }
      } else {
        setCurrentImage(1);
      }
    } catch (err) {
      setCurrentImage(1);
    }
  };

  // Resume polling when stage is stuck in in_progress (e.g. user navigated away mid-process)
  const resumePolling = async () => {
    let attempts = 0;
    const maxAttempts = 15; // ~30 seconds then give up

    const poll = async () => {
      try {
        const data = await api.getStageExtractions(sessionId, stage.id);
        const extractions = data.extractions || [];

        if (extractions.length > 0) {
          const sorted = extractions.sort((a, b) => {
            const tA = new Date(a.validated_at || a.extracted_at || 0);
            const tB = new Date(b.validated_at || b.extracted_at || 0);
            return tB - tA;
          });
          const latest = sorted[0];

          if (latest.validation_result) {
            setValidationResult(latest.validation_result);
            setProcessing(false);
            return;
          }
        }

        attempts++;
        if (attempts < maxAttempts) {
          setTimeout(poll, 2000);
        } else {
          // Timed out — stop spinner, let user upload fresh
          setProcessing(false);
          setStuckInProgress(true);
        }
      } catch (err) {
        setProcessing(false);
        setStuckInProgress(true);
      }
    };

    poll();
  };

  const handleValidateAgain = async () => {
    // Clear validation result and prepare for retry
    setShowPreviousResult(false);
    setValidationResult(null);
    setUploadedImages([]);
    setError(null);
    setWasRetry(true); // Mark this as a retry attempt
    
    // Always fetch current extractions to determine next image number
    try {
      const data = await api.getStageExtractions(sessionId, stage.id);
      
      if (data.extractions.length > 0) {
        const maxImageNumber = Math.max(...data.extractions.map(e => e.image_number || 1));
        const nextImageNumber = maxImageNumber + 1;
        setCurrentImage(nextImageNumber);
      } else {
        setCurrentImage(1);
      }
    } catch (err) {
      setCurrentImage(1);
    }
  };

  const handleRefreshValidation = async () => {
    setProcessing(true);
    try {
      const data = await api.getStageExtractions(sessionId, stage.id);
      
      if (data.extractions.length > 0) {
        // Sort by validated_at (newest first)
        const sortedExtractions = data.extractions.sort((a, b) => {
          const timeA = new Date(a.validated_at || a.extracted_at || 0);
          const timeB = new Date(b.validated_at || b.extracted_at || 0);
          return timeB - timeA;
        });
        
        const latestExtraction = sortedExtractions[0];
        
        if (latestExtraction.validation_result) {
          setValidationResult(latestExtraction.validation_result);
          setShowPreviousResult(false); // This is current, not previous
        }
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setProcessing(false);
    }
  };

  const handleSubmitResolution = async () => {
    if (!resolutionCategory) {
      alert('Please select how the issue was resolved');
      return;
    }

    // Always log to audit log — this captures the resolution reason even if failure was auto-resolved
    api.logEvent('RESOLVE_FAILURE', sessionId, stage.id, {
      resolution_category: resolutionCategory,
      resolution_notes: resolutionNotes,
      message: `Validation retry succeeded. Resolution: ${resolutionCategory}`
    });

    try {
      // Also try to update the failure record if still active
      await api.resolveFailure(sessionId, stage.id, {
        resolution_category: resolutionCategory,
        resolution_notes: resolutionNotes,
        resolved_by_user: 'system'
      });
    } catch (err) {
      // Failure may have been auto-resolved already — non-critical, audit log already captured it
    }

    // Always close modal and reset
    setShowResolutionModal(false);
    setResolutionCategory('');
    setResolutionNotes('');
    setWasRetry(false);
  };

  const handleSkipResolution = () => {
    setShowResolutionModal(false);
    setResolutionCategory('');
    setResolutionNotes('');
    setWasRetry(false);
  };

  const compressImage = (file) => {
    return new Promise((resolve) => {
      // If file is under 1MB, no compression needed
      if (file.size < 1024 * 1024) return resolve(file);
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
        canvas.width = width;
        canvas.height = height;
        canvas.getContext('2d').drawImage(img, 0, 0, width, height);
        canvas.toBlob((blob) => resolve(new File([blob], file.name, { type: 'image/jpeg' })), 'image/jpeg', 0.85);
      };
      img.src = url;
    });
  };

  const handleImageCapture = async (e, patientType = null) => {
    const rawFile = e.target.files[0];
    if (!rawFile) return;

    setUploading(true);
    setError(null);

    try {
      const file = await compressImage(rawFile);
      // Create preview URL
      const previewUrl = URL.createObjectURL(file);
      
      // For male sample collection, use specific image numbers for each patient
      let imageNumber = currentImage;
      if (stage.id === 'male_sample_collection' && patientType) {
        imageNumber = patientType === 'male' ? 1 : 2;
      }
      
      
      // Get presigned URL
      const { uploadUrl, s3Key } = await api.getPresignedUrl(sessionId, stage.id, imageNumber);
      
      // Upload image
      await api.uploadImage(uploadUrl, file);
      
      const newUpload = { imageNumber, s3Key, patientType, previewUrl };
      setUploadedImages([...uploadedImages, newUpload]);
      
      // For male sample collection, check if both images uploaded
      if (stage.id === 'male_sample_collection') {
        const maleUploaded = uploadedImages.some(img => img.patientType === 'male') || patientType === 'male';
        const femaleUploaded = uploadedImages.some(img => img.patientType === 'female') || patientType === 'female';
        
        if (maleUploaded && femaleUploaded) {
          setProcessing(true);
          pollForValidation();
        }
      } else {
        // For other stages, check if all images uploaded
        if (currentImage >= stage.images) {
          setProcessing(true);
          pollForValidation();
        } else {
          setCurrentImage(currentImage + 1);
        }
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setUploading(false);
    }
  };

  const pollForValidation = async () => {
    let attempts = 0;
    const maxAttempts = 30;
    
    // Track existing extraction IDs before upload
    let initialExtractionIds = new Set();
    const uploadStartTime = new Date();
    try {
      const initialData = await api.getStageExtractions(sessionId, stage.id);
      initialExtractionIds = new Set((initialData.extractions || []).map(e => e.extractionId));
    } catch (err) {
    }

    const poll = async () => {
      try {
        const data = await api.getStageExtractions(sessionId, stage.id);
        
        if (data.extractions.length > 0) {
          // Sort extractions by timestamp (most recent first)
          const sortedExtractions = data.extractions.sort((a, b) => {
            const timeA = new Date(a.validated_at || a.extracted_at || 0);
            const timeB = new Date(b.validated_at || b.extracted_at || 0);
            return timeB - timeA;
          });
          
          // Find a NEW extraction: not in initial set OR extracted after upload started
          const newExtraction = sortedExtractions.find(e => 
            !initialExtractionIds.has(e.extractionId) ||
            new Date(e.extracted_at) >= uploadStartTime
          );

          const latestExtraction = newExtraction || sortedExtractions[0];
          const isNew = !!newExtraction;
          
          // Accept if new extraction with validation, OR only extraction and has validation
          if (latestExtraction.validation_result && (isNew || initialExtractionIds.size === 0)) {
            setValidationResult(latestExtraction.validation_result);
            setProcessing(false);
            
            if (wasRetry && latestExtraction.validation_result.overall_match) {
              setShowResolutionModal(true);
            }
            
            return;
          }
        }

        attempts++;
        if (attempts < maxAttempts) {
          setTimeout(poll, 2000);
        } else {
          setError('Validation timeout. Please check status manually.');
          setProcessing(false);
        }
      } catch (err) {
        setError(err.message);
        setProcessing(false);
      }
    };

    poll();
  };

  const renderValidationResult = () => {
    if (!validationResult) return null;

    const isMatch = validationResult.overall_match;

    return (
      <div className={`validation-result ${isMatch ? 'success' : 'error'}`}>
        {showPreviousResult && (
          <div className="previous-result-badge" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><rect x="8" y="2" width="8" height="4" rx="1" ry="1"/></svg>
            Previous Validation Result
          </div>
        )}
        
        <h3 style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
          {isMatch ? (
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#2e7d32" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
          ) : (
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#c62828" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>
          )}
          {isMatch ? 'Validation Successful' : 'Validation Failed'}
        </h3>
        
        {isMatch ? (
          <p>All patient data matches the registered information.</p>
        ) : (
          <div>
            <p>The following mismatches were detected:</p>
            <ul>
              {validationResult.mismatches.map((mismatch, idx) => (
                <li key={idx}>
                  <strong>{mismatch.field}:</strong> Expected "{mismatch.expected}", Found "{mismatch.found || 'null'}"
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="completion-actions">
          <h4>What would you like to do next?</h4>
          {!isMatch && (
            <p className="retry-hint">💡 Tip: Upload clearer images with better lighting and angle for accurate validation</p>
          )}
          <div className="action-buttons">
            <button onClick={handleValidateAgain} className="btn-warning" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
              <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 .49-4.5"/></svg>
              Upload New Images
            </button>
            <button onClick={handleRefreshValidation} className="btn-secondary" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
              <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 .49-4.5"/></svg>
              Refresh Status
            </button>
            <button onClick={onViewStatus} className="btn-secondary" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
              <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><rect x="8" y="2" width="8" height="4" rx="1" ry="1"/></svg>
              View All Validations
            </button>
            {isMatch && !isLastStage && (
              <button onClick={onComplete} className="btn-primary" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>
                Proceed to Next Validation
              </button>
            )}
            {isMatch && isLastStage && (
              <button onClick={onViewStatus} className="btn-primary" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
                Complete Witness Capture
              </button>
            )}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="stage-capture">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <button onClick={onViewStatus} className="btn-secondary" style={{ padding: '7px 12px', display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="15 18 9 12 15 6"/>
            </svg>
            Back
          </button>
          <h2 style={{ margin: 0 }}>{stage.name}</h2>
        </div>
        <button onClick={onViewStatus} className="btn-secondary" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
          <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><rect x="8" y="2" width="8" height="4" rx="1" ry="1"/></svg>
          View All Stages
        </button>
      </div>
      <p className="stage-info">
        Session ID: <code>{sessionId}</code>
      </p>
      <p className="stage-info">
        Images Required: {stage.images} | Uploaded: {uploadedImages.length}
      </p>

      {error && <div className="error-message">{error}</div>}

      {!processing && !validationResult && !showPreviousResult && !stuckInProgress && (
        <div className="upload-section">
          {stage.id === 'male_sample_collection' ? (
            // Special layout for male sample collection - separate uploads for each patient
            <div className="dual-upload-section">
              <h3>Upload Images for Both Patients</h3>
              <p className="info-text">The male sample tube has labels on both sides - one for each patient</p>
              
              <div className="patient-upload-cards">
                <div className="patient-upload-card">
                  <div className="patient-card">
                    <h4>Male Patient</h4>
                    <p><strong>Name:</strong> {caseData.male_patient.name} {caseData.male_patient.last_name || ""}</p>
                    <p><strong>MPEID:</strong> {caseData.male_patient.mpeid}</p>
                  </div>
                  
                  {uploadedImages.some(img => img.patientType === 'male') ? (
                    <div className="upload-success">
                      <div className="image-preview">
                        <img 
                          src={uploadedImages.find(img => img.patientType === 'male').previewUrl} 
                          alt="Male patient side"
                        />
                      </div>
                      <div className="success-badge">✓ Image Uploaded</div>
                    </div>
                  ) : (
                    <div className="capture-options">
                      <label className="file-input-label">
                        <input
                          type="file"
                          accept="image/jpeg,image/jpg,image/png"
                          onChange={(e) => handleImageCapture(e, 'male')}
                          disabled={uploading}
                        />
                        <span className="btn-primary">
                          {uploading ? 'Uploading...' : <><IconUpload /> Upload Image</>}
                        </span>
                      </label>
                      <label className="file-input-label">
                        <input
                          type="file"
                          accept="image/jpeg,image/jpg,image/png"
                          capture="environment"
                          onChange={(e) => handleImageCapture(e, 'male')}
                          disabled={uploading}
                        />
                        <span className="btn-secondary">
                          {uploading ? 'Uploading...' : <><IconCamera /> Take Photo</>}
                        </span>
                      </label>
                    </div>
                  )}
                </div>

                <div className="patient-upload-card">
                  <div className="patient-card">
                    <h4>Female Patient</h4>
                    <p><strong>Name:</strong> {caseData.female_patient.name} {caseData.female_patient.last_name || ""}</p>
                    <p><strong>MPEID:</strong> {caseData.female_patient.mpeid}</p>
                  </div>
                  
                  {uploadedImages.some(img => img.patientType === 'female') ? (
                    <div className="upload-success">
                      <div className="image-preview">
                        <img 
                          src={uploadedImages.find(img => img.patientType === 'female').previewUrl} 
                          alt="Female patient side"
                        />
                      </div>
                      <div className="success-badge">✓ Image Uploaded</div>
                    </div>
                  ) : (
                    <div className="capture-options">
                      <label className="file-input-label">
                        <input
                          type="file"
                          accept="image/jpeg,image/jpg,image/png"
                          onChange={(e) => handleImageCapture(e, 'female')}
                          disabled={uploading}
                        />
                        <span className="btn-primary">
                          {uploading ? 'Uploading...' : <><IconUpload /> Upload Image</>}
                        </span>
                      </label>
                      <label className="file-input-label">
                        <input
                          type="file"
                          accept="image/jpeg,image/jpg,image/png"
                          capture="environment"
                          onChange={(e) => handleImageCapture(e, 'female')}
                          disabled={uploading}
                        />
                        <span className="btn-secondary">
                          {uploading ? 'Uploading...' : <><IconCamera /> Take Photo</>}
                        </span>
                      </label>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ) : (
            // Standard layout for other stages
            <>
              <h3>Upload Image {currentImage} of {stage.images}</h3>
              
              <div className="patient-info">
                <div className="patient-card">
                  <h4>Male Patient</h4>
                  <p><strong>Name:</strong> {caseData.male_patient.name} {caseData.male_patient.last_name || ""}</p>
                  <p><strong>MPEID:</strong> {caseData.male_patient.mpeid}</p>
                </div>
                <div className="patient-card">
                  <h4>Female Patient</h4>
                  <p><strong>Name:</strong> {caseData.female_patient.name} {caseData.female_patient.last_name || ""}</p>
                  <p><strong>MPEID:</strong> {caseData.female_patient.mpeid}</p>
                </div>
              </div>

              <div className="upload-controls">
                <div className="capture-options">
                  <label className="file-input-label">
                    <input
                      type="file"
                      accept="image/jpeg,image/jpg,image/png"
                      onChange={handleImageCapture}
                      disabled={uploading}
                    />
                    <span className="btn-primary">
                      {uploading ? 'Uploading...' : <><IconUpload /> Upload Image</>}
                    </span>
                  </label>
                  <label className="file-input-label">
                    <input
                      type="file"
                      accept="image/jpeg,image/jpg,image/png"
                      capture="environment"
                      onChange={handleImageCapture}
                      disabled={uploading}
                    />
                    <span className="btn-secondary">
                      {uploading ? 'Uploading...' : <><IconCamera /> Take Photo</>}
                    </span>
                  </label>
                </div>
              </div>

              {uploadedImages.length > 0 && (
                <div className="uploaded-list">
                  <h4>Uploaded Images:</h4>
                  <div className="image-previews">
                    {uploadedImages.map((img, idx) => (
                      <div key={idx} className="preview-item">
                        <img src={img.previewUrl} alt={`Image ${img.imageNumber}`} />
                        <span>Image {img.imageNumber}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {processing && (
        <div className="processing-message">
          <img src="https://d1nmtja0c4ok3x.cloudfront.net/IVFgif.gif" alt="Processing..." style={{ width: '80px', height: '80px', objectFit: 'contain' }} />
          <p>Processing images with {caseData.model_config.model_name.replace(/\s*⭐.*$/, '').replace(/\s*\(.*?\)\s*$/, '')}...</p>
          <p className="small">This may take 20-30 seconds</p>
          <button
            onClick={() => {
              setProcessing(false);
              setStuckInProgress(true);
              api.logEvent('STOP_WAITING', sessionId, stage.id, {
                reason: 'User manually stopped waiting for validation result',
                stage_status: 'in_progress'
              });
            }}
            className="btn-secondary"
            style={{ marginTop: '1.5rem', padding: '0.6rem 1.4rem', fontSize: '0.9rem' }}
          >
            ✋ Stop Waiting
          </button>
        </div>
      )}

      {stuckInProgress && !processing && !validationResult && (
        <div className="validation-result error" style={{ textAlign: 'center' }}>
          <h3>⚠️ Processing Timed Out</h3>
          <p style={{ marginBottom: '1.5rem' }}>The previous upload didn't complete. Please upload the image again to retry validation.</p>
          <button
            onClick={() => { setStuckInProgress(false); setUploadedImages([]); setCurrentImage(1); setError(null); }}
            className="btn-primary"
            style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 .49-4.5"/></svg>
            Upload Image Again
          </button>
        </div>
      )}

      {renderValidationResult()}

      {/* Resolution Modal */}
      {showResolutionModal && (
        <div className="modal-overlay" onClick={handleSkipResolution}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h2 style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#2e7d32" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
              Validation Successful!
            </h2>
            <p className="modal-subtitle">This stage previously failed. Please help us improve by sharing how you resolved the issue.</p>
            
            <div className="form-group">
              <label htmlFor="resolution-category">How was the issue resolved? *</label>
              <select
                id="resolution-category"
                value={resolutionCategory}
                onChange={(e) => setResolutionCategory(e.target.value)}
                className="form-select"
              >
                <option value="">Select resolution method...</option>
                {RESOLUTION_CATEGORIES.map((category, idx) => (
                  <option key={idx} value={category}>{category}</option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label htmlFor="resolution-notes">Additional notes (optional)</label>
              <textarea
                id="resolution-notes"
                value={resolutionNotes}
                onChange={(e) => setResolutionNotes(e.target.value)}
                placeholder="e.g., Used better lighting, cleaned the label surface..."
                className="form-textarea"
                rows="3"
              />
            </div>

            <div className="modal-actions">
              <button onClick={handleSkipResolution} className="btn-secondary">
                Skip
              </button>
              <button onClick={handleSubmitResolution} className="btn-primary">
                Submit & Continue
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default StageCapture;
