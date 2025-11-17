/**
 * Utility functions for capturing demarcated areas as images
 */

export interface CaptureArea {
  x: number;
  y: number;
  width: number;
  height: number;
  page: number;
}

/**
 * Captures a demarcated area from a PDF canvas as a base64 image
 */
export const captureDemarcatedArea = async (
  canvas: HTMLCanvasElement,
  area: CaptureArea,
  scale: number = 1
): Promise<string> => {
  return new Promise((resolve, reject) => {
    try {
      // Create a new canvas for the captured area
      const captureCanvas = document.createElement('canvas');
      const ctx = captureCanvas.getContext('2d');
      
      if (!ctx) {
        reject(new Error('Could not get canvas context'));
        return;
      }

      // Set dimensions for the captured area
      const captureWidth = area.width * scale;
      const captureHeight = area.height * scale;
      
      captureCanvas.width = captureWidth;
      captureCanvas.height = captureHeight;

      // Draw the demarcated area from the source canvas
      ctx.drawImage(
        canvas,
        area.x * scale, // source x
        area.y * scale, // source y
        area.width * scale, // source width
        area.height * scale, // source height
        0, // destination x
        0, // destination y
        captureWidth, // destination width
        captureHeight // destination height
      );

      // Convert to base64 image
      const imageData = captureCanvas.toDataURL('image/png', 0.8);
      resolve(imageData);
    } catch (error) {
      reject(error);
    }
  });
};

/**
 * Captures a circular area from a PDF canvas
 */
export const captureCircularArea = async (
  canvas: HTMLCanvasElement,
  centerX: number,
  centerY: number,
  radius: number,
  scale: number = 1
): Promise<string> => {
  return new Promise((resolve, reject) => {
    try {
      const captureCanvas = document.createElement('canvas');
      const ctx = captureCanvas.getContext('2d');
      
      if (!ctx) {
        reject(new Error('Could not get canvas context'));
        return;
      }

      const diameter = radius * 2 * scale;
      captureCanvas.width = diameter;
      captureCanvas.height = diameter;

      // Create circular clipping path
      ctx.beginPath();
      ctx.arc(diameter / 2, diameter / 2, radius * scale, 0, 2 * Math.PI);
      ctx.clip();

      // Draw the circular area
      ctx.drawImage(
        canvas,
        (centerX - radius) * scale,
        (centerY - radius) * scale,
        diameter,
        diameter,
        0,
        0,
        diameter,
        diameter
      );

      const imageData = captureCanvas.toDataURL('image/png', 0.8);
      resolve(imageData);
    } catch (error) {
      reject(error);
    }
  });
};

/**
 * Captures an arc area from a PDF canvas
 */
export const captureArcArea = async (
  canvas: HTMLCanvasElement,
  startX: number,
  startY: number,
  endX: number,
  endY: number,
  centerX: number,
  centerY: number,
  radius: number,
  scale: number = 1
): Promise<string> => {
  return new Promise((resolve, reject) => {
    try {
      const captureCanvas = document.createElement('canvas');
      const ctx = captureCanvas.getContext('2d');
      
      if (!ctx) {
        reject(new Error('Could not get canvas context'));
        return;
      }

      // Calculate bounding box for the arc
      const minX = Math.min(startX, endX, centerX - radius);
      const minY = Math.min(startY, endY, centerY - radius);
      const maxX = Math.max(startX, endX, centerX + radius);
      const maxY = Math.max(startY, endY, centerY + radius);
      
      const width = (maxX - minX) * scale;
      const height = (maxY - minY) * scale;
      
      captureCanvas.width = width;
      captureCanvas.height = height;

      // Draw the arc area
      ctx.drawImage(
        canvas,
        minX * scale,
        minY * scale,
        width,
        height,
        0,
        0,
        width,
        height
      );

      const imageData = captureCanvas.toDataURL('image/png', 0.8);
      resolve(imageData);
    } catch (error) {
      reject(error);
    }
  });
};

/**
 * Gets the appropriate capture function based on annotation type
 */
export const getCaptureFunction = (annotationType: string) => {
  switch (annotationType) {
    case 'rectangle':
      return captureDemarcatedArea;
    case 'circle':
    case 'ellipse':
      return captureCircularArea;
    case 'arc':
      return captureArcArea;
    default:
      return captureDemarcatedArea;
  }
};
