import React, { useRef, useState } from 'react';
import { encodeGB7 } from './utils/gb7-codec';
import { loadImageFromFile } from './utils/image-loader'; 
import './App.css';

interface ImageMeta {
  width: number;
  height: number;
  depth: string;
}

function App() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [meta, setMeta] = useState<ImageMeta | null>(null);
  const [format, setFormat] = useState<string>('');

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      const { imageData, width, height, depth, format } = await loadImageFromFile(file);

      const canvas = canvasRef.current;
      const ctx = canvas?.getContext('2d');
      if (!canvas || !ctx) return;

      canvas.width = width;
      canvas.height = height;
      ctx.putImageData(imageData, 0, 0);

      setMeta({ width, height, depth });
      setFormat(format);

    } catch (error) {
      alert(error); 
    }
  };

  const handleDownload = (outExt: string) => {
    const canvas = canvasRef.current;
    if (!canvas || !meta) return;

    if (outExt === 'gb7') {
      const ctx = canvas.getContext('2d')!;
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const buffer = encodeGB7(imageData, true);
      
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
      {/* Тулбар */}
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
          <button onClick={() => handleDownload('png')} disabled={!meta}>Скачать PNG</button>
          <button onClick={() => handleDownload('jpg')} disabled={!meta}>Скачать JPG</button>
          <button onClick={() => handleDownload('gb7')} disabled={!meta}>Скачать GB7</button>
        </div>
      </header>

      {/* Рабочая область */}
      <main className="canvas-wrapper">
        <canvas ref={canvasRef} className="main-canvas" />
      </main>

      {/* Статус-бар */}
      <footer className="status-bar">
        {meta ? (
          <>
            <span>Формат: {format.toUpperCase()}</span> 
            <span>Ширина: {meta.width}px</span>
            <span>Высота: {meta.height}px</span>
            <span>Глубина цвета: {meta.depth}</span>
          </>
        ) : (
          <span>Изображение не загружено</span>
        )}
      </footer>
    </div>
  );
}

export default App;