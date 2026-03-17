export const createImage = (url: string): Promise<HTMLImageElement> =>
  new Promise((resolve, reject) => {
    const image = new Image();
    image.addEventListener('load', () => {
      resolve(image);
    });
    image.addEventListener('error', (error) => {
      reject(new Error('Failed to load image'));
    });
    
    // Try without CORS first for blob URLs
    if (url.startsWith('blob:')) {
      image.src = url;
    } else {
      image.setAttribute('crossOrigin', 'anonymous');
      image.src = url;
    }
  });

export async function getCroppedImg(
  imageSrc: string,
  pixelCrop: { x: number; y: number; width: number; height: number },
  rotation = 0
): Promise<Blob> {
  
  const image = await createImage(imageSrc);
  
  const rotatedCanvas = document.createElement('canvas');
  const rotatedCtx = rotatedCanvas.getContext('2d', { willReadFrequently: true });

  if (!rotatedCtx) {
    throw new Error('Failed to get canvas context');
  }
  const maxSize = Math.max(image.width, image.height);
  const safeArea = 2 * ((maxSize / 2) * Math.sqrt(2));

  rotatedCanvas.width = safeArea;
  rotatedCanvas.height = safeArea;

  rotatedCtx.translate(safeArea / 2, safeArea / 2);
  rotatedCtx.rotate((rotation * Math.PI) / 180);
  rotatedCtx.translate(-safeArea / 2, -safeArea / 2);

  rotatedCtx.drawImage(
    image,
    safeArea / 2 - image.width * 0.5,
    safeArea / 2 - image.height * 0.5
  );

  const croppedCanvas = document.createElement('canvas');
  const croppedCtx = croppedCanvas.getContext('2d', { willReadFrequently: true });
  
  if (!croppedCtx) {
    throw new Error('Failed to get cropped canvas context');
  }
  // Ensure valid dimensions with bounds checking
  const width = Math.max(1, Math.min(Math.floor(pixelCrop.width), safeArea));
  const height = Math.max(1, Math.min(Math.floor(pixelCrop.height), safeArea));
  
  
  croppedCanvas.width = width;
  croppedCanvas.height = height;

  const offsetX = safeArea / 2 - image.width * 0.5 + pixelCrop.x;
  const offsetY = safeArea / 2 - image.height * 0.5 + pixelCrop.y;


  croppedCtx.drawImage(
    rotatedCanvas,
    offsetX,
    offsetY,
    width,
    height,
    0,
    0,
    width,
    height
  );

  return new Promise((resolve, reject) => {
    try {
      croppedCanvas.toBlob(
        (blob) => {
          if (blob && blob.size > 0) {
            resolve(blob);
          } else {
            reject(new Error('Failed to create image blob - canvas may be empty'));
          }
        },
        'image/jpeg',
        0.95
      );
    } catch (error) {
      reject(error);
    }
  });
}
