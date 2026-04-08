/**
 * imageUtils.js
 * Shared image utility functions used across StageCapture and ICSIDocumentation.
 * Logic is unchanged — only centralized here to avoid duplication.
 */

/**
 * Compresses an image file if it exceeds 1MB.
 * Resizes to max 1920px on the longest side and converts to JPEG at 85% quality.
 * @param {File} file - The original image file
 * @returns {Promise<File>} - Compressed file or original if under 1MB
 */
export const compressImage = (file) => {
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
      canvas.toBlob(
        (blob) => resolve(new File([blob], file.name, { type: 'image/jpeg' })),
        'image/jpeg',
        0.85
      );
    };
    img.src = url;
  });
};
