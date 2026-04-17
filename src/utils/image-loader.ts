import { decodeGB7 } from './gb7-codec';

export interface LoadedImageInfo {
  imageData: ImageData;
  width: number;
  height: number;
  depth: string;
  format: string;
}

export const loadImageFromFile = (file: File): Promise<LoadedImageInfo> => {
  return new Promise((resolve, reject) => {
    const ext = file.name.split('.').pop()?.toLowerCase() || '';

    if (ext === 'gb7') {
      file.arrayBuffer()
        .then((buffer) => {
          try {
            const { width, height, hasMask, imageData } = decodeGB7(buffer);
            resolve({
              imageData,
              width,
              height,
              depth: hasMask ? '7-bit + 1-bit mask (GB7)' : '7-bit (GB7)',
              format: ext
            });
          } catch (err) {
            reject(new Error("Ошибка чтения GB7: " + err));
          }
        })
        .catch(() => reject(new Error("Ошибка чтения файла как буфера")));
        
    } else {
      const reader = new FileReader();
      
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          const tempCanvas = document.createElement('canvas');
          tempCanvas.width = img.width;
          tempCanvas.height = img.height;
          const ctx = tempCanvas.getContext('2d');
          
          if (!ctx) {
            return reject(new Error("Не удалось создать контекст холста"));
          }

          ctx.drawImage(img, 0, 0);
          const imageData = ctx.getImageData(0, 0, img.width, img.height);
          
          const data = imageData.data;
          let hasAlpha = false;
          for (let i = 3; i < data.length; i += 4) {
            if (data[i] < 255) {
              hasAlpha = true;
              break;
            }
          }

          resolve({
            imageData,
            width: img.width,
            height: img.height,
            depth: hasAlpha ? '32-bit (RGBA)' : '24-bit (RGB)',
            format: ext
          });
        };
        img.onerror = () => reject(new Error("Ошибка декодирования изображения браузером"));
        img.src = e.target?.result as string;
      };
      reader.onerror = () => reject(new Error("Ошибка чтения файла"));
      reader.readAsDataURL(file);
    }
  });
};