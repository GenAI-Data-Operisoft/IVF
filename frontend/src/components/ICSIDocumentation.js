import React, { useState, useEffect } from 'react';
import { api } from '../api';

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

function ICSIDocumentation({ sessionId, caseData, onComplete, onViewStatus }) {
  const [uploadedImages, setUploadedImages] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState(null);
  const [annotatedImages, setAnnotatedImages] = useState([]);

  useEffect(() => {
    // Load existing annotated images
    loadAnnotatedImages();
  }, [sessionId]);

  const loadAnnotatedImages = async () => {
    try {
      const data = await api.getAnnotatedImages(sessionId);
      setAnnotatedImages(data.images || []);
    } catch (err) {
    }
  };

  const compressImage = (file) => {
    return new Promise((resolve) => {
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

  const handleImageUpload = async (e) => {
    const rawFile = e.target.files[0];
    if (!rawFile) return;

    setUploading(true);
    setError(null);

    try {
      const file = await compressImage(rawFile);
      const imageNumber = uploadedImages.length + annotatedImages.length + 1;
      
      // Get presigned URL for original image upload
      const { uploadUrl, s3Key } = await api.getPresignedUrlForICSIDoc(
        sessionId,
        imageNumber
      );
      
      // Upload image to S3
      await api.uploadImage(uploadUrl, file);
      
      setUploadedImages([...uploadedImages, { imageNumber, s3Key, status: 'uploaded' }]);
      
      // Start polling for annotated image
      setProcessing(true);
      pollForAnnotatedImage(imageNumber);
      
    } catch (err) {
      setError(err.message);
    } finally {
      setUploading(false);
    }
  };

  const pollForAnnotatedImage = async (imageNumber) => {
    let attempts = 0;
    const maxAttempts = 30;

    const poll = async () => {
      try {
        const data = await api.getAnnotatedImages(sessionId);
        
        // Check if new image is annotated
        const newImage = data.images.find(img => img.oocyte_number === imageNumber);
        
        if (newImage && newImage.annotation_status === 'completed') {
          setAnnotatedImages(data.images);
          setProcessing(false);
          setUploadedImages([]);
          
          // Auto-complete the stage when first image is successfully annotated
          if (data.images.length === 1) {
            try {
              await api.completeStage(sessionId, 'icsi_documentation');
            } catch (err) {
              // Don't show error to user - they can still manually complete
            }
          }
          
          return;
        }

        attempts++;
        if (attempts < maxAttempts) {
          setTimeout(poll, 2000);
        } else {
          setError('Annotation timeout. Please refresh to check status.');
          setProcessing(false);
        }
      } catch (err) {
        setError(err.message);
        setProcessing(false);
      }
    };

    poll();
  };

  const handleDownload = async (image) => {
    try {
      // Get a fresh presigned URL to avoid 403 from expired URLs
      let downloadUrl = image.download_url;
      if (image.annotated_s3_path) {
        // Extract the S3 key from the s3:// path
        const s3Key = image.annotated_s3_path.replace('s3://', '').split('/').slice(1).join('/');
        const result = await api.getImageDownloadUrl(s3Key);
        downloadUrl = result.downloadUrl;
      }
      window.open(downloadUrl, '_blank');
      
      // Update download count
      await api.incrementDownloadCount(image.imageId);
    } catch (err) {
    }
  };

  const handleComplete = async () => {
    if (annotatedImages.length === 0) {
      setError('Please capture at least one injected oocyte image before proceeding.');
      return;
    }
    
    try {
      // Update stage status to completed in DynamoDB
      await api.completeStage(sessionId, 'icsi_documentation');
      onComplete();
    } catch (err) {
      setError('Failed to complete documentation. Please try again.');
    }
  };

  return (
    <div className="icsi-documentation">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
        <h2>ICSI Documentation</h2>
        <button onClick={onViewStatus} className="btn-secondary" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
          <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><rect x="8" y="2" width="8" height="4" rx="1" ry="1"/></svg>
          View All Stages
        </button>
      </div>
      <p className="stage-info">
        Session ID: <code>{sessionId}</code>
      </p>
      <p className="info-text">
        Capture images of injected oocytes from the micromanipulator screen. 
        Images will be automatically annotated with patient information.
      </p>

      {error && <div className="error-message">{error}</div>}

      <div className="patient-info">
        <div className="patient-card">
          <h4>Male Patient</h4>
          <p><strong>Name:</strong> {caseData.male_patient.name}</p>
          <p><strong>MPEID:</strong> {caseData.male_patient.mpeid}</p>
        </div>
        <div className="patient-card">
          <h4>Female Patient</h4>
          <p><strong>Name:</strong> {caseData.female_patient.name}</p>
          <p><strong>MPEID:</strong> {caseData.female_patient.mpeid}</p>
        </div>
      </div>

      {!processing && (
        <div className="upload-section">
          <h3 style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>
            Capture Injected Oocyte Image
          </h3>
          <div className="capture-options">
            <label className="file-input-label">
              <input
                type="file"
                accept="image/jpeg,image/jpg,image/png"
                onChange={handleImageUpload}
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
                onChange={handleImageUpload}
                disabled={uploading}
              />
              <span className="btn-secondary">
                {uploading ? 'Uploading...' : <><IconCamera /> Take Photo</>}
              </span>
            </label>
          </div>
          <p className="small-text">
            Supported formats: JPEG, PNG | Max size: 10MB
          </p>
        </div>
      )}

      {processing && (
        <div className="processing-message">
          <img src="https://d1nmtja0c4ok3x.cloudfront.net/IVFgif.gif" alt="Processing..." style={{ width: '80px', height: '80px', objectFit: 'contain' }} />
          <p>Annotating image with patient information...</p>
          <p className="small">This may take 10-15 seconds</p>
        </div>
      )}

      {annotatedImages.length > 0 && (
        <div className="annotated-images-section">
          <h3 style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#4caf50" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
            Annotated Images ({annotatedImages.length})
          </h3>
          <div className="images-grid">
            {annotatedImages.map((image, idx) => (
              <div key={image.imageId} className="image-card">
                <div className="image-header">
                  <h4>Oocyte {image.oocyte_number}</h4>
                  <span className="image-date">
                    {new Date(image.captured_at).toLocaleString()}
                  </span>
                </div>
                <div className="image-preview">
                  <img 
                    src={image.download_url} 
                    alt={`Oocyte ${image.oocyte_number}`}
                    style={{ maxWidth: '100%', borderRadius: '4px' }}
                  />
                </div>
                <div className="image-actions">
                  <button 
                    onClick={() => handleDownload(image)}
                    className="btn-secondary"
                    style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                    Download
                  </button>
                  <span className="download-count">
                    Downloads: {image.download_count || 0}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="completion-actions">
        <button 
          onClick={handleComplete} 
          className="btn-primary"
          disabled={annotatedImages.length === 0}
          style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
          Complete Documentation
        </button>
        <button onClick={onViewStatus} className="btn-secondary" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
          <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><rect x="8" y="2" width="8" height="4" rx="1" ry="1"/></svg>
          View All Stages
        </button>
      </div>
    </div>
  );
}

export default ICSIDocumentation;
