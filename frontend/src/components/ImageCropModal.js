/**
 * ImageCropModal — lightweight image cropper using Canvas.
 * User drags a rectangle to select the crop area, then confirms.
 */
import React, { useState, useRef, useEffect, useCallback } from 'react';

function ImageCropModal({ imageFile, onCrop, onCancel }) {
  const canvasRef = useRef(null);
  const [imgObj, setImgObj] = useState(null);
  const [scale, setScale] = useState(1);
  const [dragging, setDragging] = useState(false);
  const [crop, setCrop] = useState(null);
  const [startPos, setStartPos] = useState(null);

  // Load image
  useEffect(() => {
    if (!imageFile) return;
    const img = new Image();
    const url = URL.createObjectURL(imageFile);
    img.onload = () => {
      URL.revokeObjectURL(url);
      setImgObj(img);
    };
    img.src = url;
    return () => URL.revokeObjectURL(url);
  }, [imageFile]);

  // Draw image + crop overlay
  useEffect(() => {
    if (!imgObj || !canvasRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');

    // Fit image to modal (max 600px wide, 500px tall)
    const maxW = Math.min(600, window.innerWidth - 60);
    const maxH = Math.min(500, window.innerHeight - 200);
    const s = Math.min(maxW / imgObj.width, maxH / imgObj.height, 1);
    setScale(s);

    canvas.width = imgObj.width * s;
    canvas.height = imgObj.height * s;

    // Draw image
    ctx.drawImage(imgObj, 0, 0, canvas.width, canvas.height);

    // Draw crop overlay
    if (crop) {
      // Dim outside crop area
      ctx.fillStyle = 'rgba(0,0,0,0.5)';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Clear crop area (show original image)
      ctx.clearRect(crop.x, crop.y, crop.w, crop.h);
      ctx.drawImage(imgObj, 0, 0, canvas.width, canvas.height);
      ctx.fillStyle = 'rgba(0,0,0,0.5)';
      // Top
      ctx.fillRect(0, 0, canvas.width, crop.y);
      // Bottom
      ctx.fillRect(0, crop.y + crop.h, canvas.width, canvas.height - crop.y - crop.h);
      // Left
      ctx.fillRect(0, crop.y, crop.x, crop.h);
      // Right
      ctx.fillRect(crop.x + crop.w, crop.y, canvas.width - crop.x - crop.w, crop.h);

      // Crop border
      ctx.strokeStyle = '#667eea';
      ctx.lineWidth = 2;
      ctx.setLineDash([6, 3]);
      ctx.strokeRect(crop.x, crop.y, crop.w, crop.h);
      ctx.setLineDash([]);
    }
  }, [imgObj, crop]);

  const getPos = useCallback((e) => {
    const rect = canvasRef.current.getBoundingClientRect();
    const touch = e.touches ? e.touches[0] : e;
    return {
      x: touch.clientX - rect.left,
      y: touch.clientY - rect.top,
    };
  }, []);

  const handleStart = useCallback((e) => {
    e.preventDefault();
    const pos = getPos(e);
    setStartPos(pos);
    setCrop({ x: pos.x, y: pos.y, w: 0, h: 0 });
    setDragging(true);
  }, [getPos]);

  const handleMove = useCallback((e) => {
    if (!dragging || !startPos) return;
    e.preventDefault();
    const pos = getPos(e);
    const x = Math.min(startPos.x, pos.x);
    const y = Math.min(startPos.y, pos.y);
    const w = Math.abs(pos.x - startPos.x);
    const h = Math.abs(pos.y - startPos.y);
    setCrop({ x, y, w, h });
  }, [dragging, startPos, getPos]);

  const handleEnd = useCallback(() => {
    setDragging(false);
  }, []);

  const handleCrop = () => {
    if (!crop || crop.w < 20 || crop.h < 20 || !imgObj) {
      // No crop selected or too small — use full image
      onCrop(imageFile);
      return;
    }

    // Convert canvas coords back to original image coords
    const sx = crop.x / scale;
    const sy = crop.y / scale;
    const sw = crop.w / scale;
    const sh = crop.h / scale;

    const outCanvas = document.createElement('canvas');
    outCanvas.width = sw;
    outCanvas.height = sh;
    const ctx = outCanvas.getContext('2d');
    ctx.drawImage(imgObj, sx, sy, sw, sh, 0, 0, sw, sh);

    outCanvas.toBlob(
      (blob) => {
        const croppedFile = new File(
          [blob],
          imageFile.name.replace(/\.[^.]+$/, '_cropped.jpg'),
          { type: 'image/jpeg' }
        );
        onCrop(croppedFile);
      },
      'image/jpeg',
      0.92
    );
  };

  const handleSkip = () => {
    onCrop(imageFile);
  };

  if (!imgObj) {
    return (
      <div style={overlayStyle}>
        <div style={modalStyle}>
          <p style={{ textAlign: 'center', color: '#64748b' }}>Loading image...</p>
        </div>
      </div>
    );
  }

  return (
    <div style={overlayStyle} onClick={onCancel}>
      <div style={modalStyle} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
          <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700, color: '#1a202c' }}>
            ✂️ Crop Image
          </h3>
          <button onClick={onCancel} style={{ background: 'none', border: 'none', fontSize: '1.2rem', cursor: 'pointer', color: '#94a3b8' }}>✕</button>
        </div>
        <p style={{ fontSize: '0.82rem', color: '#64748b', margin: '0 0 0.75rem' }}>
          Drag to select the area you want to keep, or skip to use the full image.
        </p>

        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '1rem', background: '#f8fafc', borderRadius: '8px', padding: '8px' }}>
          <canvas
            ref={canvasRef}
            style={{ cursor: 'crosshair', borderRadius: '6px', touchAction: 'none', maxWidth: '100%' }}
            onMouseDown={handleStart}
            onMouseMove={handleMove}
            onMouseUp={handleEnd}
            onMouseLeave={handleEnd}
            onTouchStart={handleStart}
            onTouchMove={handleMove}
            onTouchEnd={handleEnd}
          />
        </div>

        <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
          <button onClick={onCancel} className="btn-secondary" style={{ padding: '0.5rem 1rem', fontSize: '0.88rem' }}>
            Cancel
          </button>
          <button onClick={handleSkip} className="btn-secondary" style={{ padding: '0.5rem 1rem', fontSize: '0.88rem' }}>
            Skip Crop
          </button>
          <button onClick={handleCrop} className="btn-primary" style={{ padding: '0.5rem 1.25rem', fontSize: '0.88rem', display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
            {crop && crop.w > 20 ? '✂️ Crop & Upload' : '📤 Upload Full Image'}
          </button>
        </div>
      </div>
    </div>
  );
}

const overlayStyle = {
  position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
  background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center',
  zIndex: 9999, padding: '1rem',
};

const modalStyle = {
  background: '#fff', borderRadius: '14px', padding: '1.5rem',
  maxWidth: '680px', width: '100%', maxHeight: '90vh', overflow: 'auto',
  boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
};

export default ImageCropModal;
