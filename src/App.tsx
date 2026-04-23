import React, { useRef, useState } from 'react';
import { encodeGB7 } from './utils/gb7-codec';
import { loadImageFromFile } from './utils/image-loader';
import type { AppImage } from './types';
import './App.css';

function App() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [imageInfo, setImageInfo] = useState<AppImage | null>(null);

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      const loadedImage = await loadImageFromFile(file);

      const canvas = canvasRef.current;
      const ctx = canvas?.getContext('2d');
      if (!canvas || !ctx) return;

      canvas.width = loadedImage.width;
      canvas.height = loadedImage.height;
      ctx.putImageData(loadedImage.imageData, 0, 0);

      setImageInfo(loadedImage);

    } catch (error) {
      alert(error);
    }
  };

  const handleDownload = (outExt: string) => {
    const canvas = canvasRef.current;
    if (!canvas || !imageInfo) return;

    if (outExt === 'gb7') {
      const ctx = canvas.getContext('2d')!;
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      
      const buffer = encodeGB7(imageData, imageInfo.hasMask);
      
      const blob = new Blob([buffer], { type: 'application/octet-stream' });
      triggerDownload(blob, 'image.gb7');

    } else if (outExt === 'jpg') {
      const tempCanvas = document.createElement('canvas');
      tempCanvas.width = canvas.width;
      tempCanvas.height = canvas.height;
      const tCtx = tempCanvas.getContext('2d');
      
      if (tCtx) {
        tCtx.fillStyle = '#ffffff';
        tCtx.fillRect(0, 0, tempCanvas.width, tempCanvas.height);
        tCtx.drawImage(canvas, 0, 0);
        
        tempCanvas.toBlob((blob) => {
          if (blob) triggerDownload(blob, 'image.jpg');
        }, 'image/jpeg', 0.9);
      }

    } else {
      canvas.toBlob((blob) => {
        if (blob) triggerDownload(blob, `image.${outExt}`);
      }, `image/${outExt}`);  
    }
  };

  const triggerDownload = (blob: Blob, filename: string) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="app-container">
      <header className="toolbar">
        <h1>Редактор изображений</h1>
        <div className="actions">
          <input 
            type="file" 
            accept=".png, .jpg, .jpeg, .gb7" 
            ref={fileInputRef} 
            onChange={handleFileUpload} 
            hidden
          />
          <button onClick={() => fileInputRef.current?.click()}>Открыть</button>
          <button onClick={() => handleDownload('png')} disabled={!imageInfo}>Скачать PNG</button>
          <button onClick={() => handleDownload('jpg')} disabled={!imageInfo}>Скачать JPG</button>
          <button onClick={() => handleDownload('gb7')} disabled={!imageInfo}>Скачать GB7</button>
        </div>
      </header>

      <main className="canvas-wrapper">
        <canvas ref={canvasRef} className="main-canvas" />
      </main>

      <footer className="status-bar">
        {imageInfo ? (
          <>
            <span>Формат: {imageInfo.format.toUpperCase()}</span> 
            <span>Ширина: {imageInfo.width}px</span>
            <span>Высота: {imageInfo.height}px</span>
            <span>Глубина цвета: {imageInfo.depth}</span>
          </>
        ) : (
          <span>Изображение не загружено</span>
        )}
      </footer>
    </div>
  );
}

export default App;