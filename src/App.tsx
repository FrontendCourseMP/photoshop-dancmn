import React, { useRef, useState } from 'react'; 
import { decodeGB7, encodeGB7 } from './utils/gb7-codec';
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

  // Обработка загрузки файла
  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const ext = file.name.split('.').pop()?.toLowerCase();
    setFormat(ext || ''); // Сохраняем формат файла

    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;

    if (ext === 'gb7') {
      // Кастомный декодер для нашего формата
      const buffer = await file.arrayBuffer();
      try {
        const { width, height, hasMask, imageData } = decodeGB7(buffer);
        canvas.width = width;
        canvas.height = height;
        ctx.putImageData(imageData, 0, 0);
        setMeta({ width, height, depth: hasMask ? '7-bit + 1-bit mask (GB7)' : '7-bit (GB7)' });
      } catch (err) {
        alert("Ошибка чтения GB7: " + err);
      }
    } else {
      // Стандартный подход браузера для PNG и JPG
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          canvas.width = img.width;
          canvas.height = img.height;
          ctx.drawImage(img, 0, 0);
          setMeta({ width: img.width, height: img.height, depth: '24/32-bit (Standard)' });
        };
        img.src = e.target?.result as string;
      };
      reader.readAsDataURL(file);
    }
  };

  // Обработка скачивания
  const handleDownload = (outExt: string) => {
    const canvas = canvasRef.current;
    if (!canvas || !meta) return;

    if (outExt === 'gb7') {
      const ctx = canvas.getContext('2d')!;
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const buffer = encodeGB7(imageData, true); // Сохраняем с маской по умолчанию
      
      const blob = new Blob([buffer], { type: 'application/octet-stream' });
      triggerDownload(blob, 'image.gb7');
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

      {/* Рабочая область (Холст) */}
      <main className="canvas-wrapper">
        <canvas ref={canvasRef} className="main-canvas" />
      </main>

      {/* Статус-бар */}
      <footer className="status-bar">
        {meta ? (
          <>
            {/* Вот здесь мы теперь используем переменную format! */}
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