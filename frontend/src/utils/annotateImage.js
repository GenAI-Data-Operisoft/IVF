/**
 * Client-side image annotation — overlays patient details on embryo images using Canvas.
 * Replaces the server-side Lambda annotation for instant results.
 */

/**
 * Annotate an image file with patient details.
 * @param {File} imageFile - The captured/uploaded image file
 * @param {Object} malePatient - { name, mpeid }
 * @param {Object} femalePatient - { name, mpeid }
 * @returns {Promise<{annotatedFile: File, previewUrl: string}>}
 */
export async function annotateImageWithPatientDetails(imageFile, malePatient, femalePatient) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(imageFile);

    img.onload = () => {
      URL.revokeObjectURL(url);

      // Resize if needed (max 1280px)
      const MAX = 1280;
      let { width, height } = img;
      if (width > MAX || height > MAX) {
        if (width > height) {
          height = Math.round(height * MAX / width);
          width = MAX;
        } else {
          width = Math.round(width * MAX / height);
          height = MAX;
        }
      }

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');

      // Draw the original image
      ctx.drawImage(img, 0, 0, width, height);

      // Prepare annotation text
      const date = new Date().toISOString().split('T')[0];
      const lines = [
        `Male: ${malePatient.name || 'N/A'} (${malePatient.mpeid || 'N/A'})`,
        `Female: ${femalePatient.name || 'N/A'} (${femalePatient.mpeid || 'N/A'})`,
        `Date: ${date}`,
      ];

      // Font size based on image height (readable but not too large)
      const fontSize = Math.max(12, Math.min(18, Math.round(height * 0.022)));
      ctx.font = `bold ${fontSize}px Arial, sans-serif`;

      // Measure text
      const lineHeight = fontSize + 6;
      const padding = 10;
      let maxTextWidth = 0;
      for (const line of lines) {
        const w = ctx.measureText(line).width;
        if (w > maxTextWidth) maxTextWidth = w;
      }

      const boxWidth = maxTextWidth + padding * 2;
      const boxHeight = lineHeight * lines.length + padding * 2;

      // Position at bottom-right
      const boxX = width - boxWidth - 8;
      const boxY = height - boxHeight - 8;

      // Semi-transparent black background
      ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
      ctx.fillRect(boxX, boxY, boxWidth, boxHeight);

      // White text
      ctx.fillStyle = '#ffffff';
      ctx.textBaseline = 'top';
      let textY = boxY + padding;
      for (const line of lines) {
        ctx.fillText(line, boxX + padding, textY);
        textY += lineHeight;
      }

      // Convert to JPEG blob
      canvas.toBlob(
        (blob) => {
          if (!blob) {
            reject(new Error('Failed to create annotated image'));
            return;
          }
          const annotatedFile = new File(
            [blob],
            imageFile.name.replace(/\.[^.]+$/, '_annotated.jpg'),
            { type: 'image/jpeg' }
          );
          const previewUrl = URL.createObjectURL(blob);
          resolve({ annotatedFile, previewUrl });
        },
        'image/jpeg',
        0.92
      );
    };

    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Failed to load image for annotation'));
    };

    img.src = url;
  });
}
