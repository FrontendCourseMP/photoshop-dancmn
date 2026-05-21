// src/App.tsx
import React, { useRef, useState, useEffect } from 'react';
import { encodeGB7 } from './utils/gb7-codec';
import { loadImageFromFile } from './utils/image-loader';
import type { AppImage } from './types';
import { rgbToLab } from './utils/color-math';
import { buildThumbnails, applyActiveChannels, type ChannelThumb } from './utils/channel-builder';
import './App.css';

function App() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [imageInfo, setImageInfo] = useState<AppImage | null>(null);
  const [thumbnails, setThumbnails] = useState<ChannelThumb[]>([]);
  const [activeChannels, setActiveChannels] = useState<Set<string>>(new Set());
  
  const [eyedropperActive, setEyedropperActive] = useState(false);
  const [pickedColor, setPickedColor] = useState<any>(null);

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      const loadedImage = await loadImageFromFile(file);
      const canvas = canvasRef.current;
      if (canvas) {
        canvas.width = loadedImage.width;
        canvas.height = loadedImage.height;
      }
      setImageInfo(loadedImage);
      
      const thumbs = await buildThumbnails(loadedImage);
      setThumbnails(thumbs);
      setActiveChannels(new Set(thumbs.map(t => t.id))); 
      setPickedColor(null);
    } catch (error) {
      alert(error);
    }
  };

  useEffect(() => {
    if (!imageInfo || !canvasRef.current) return;
    const isGray = imageInfo.format === 'gb7';
    
    const newImageData = applyActiveChannels(imageInfo.imageData, activeChannels, isGray);
    
    const ctx = canvasRef.current.getContext('2d')!;
    ctx.putImageData(newImageData, 0, 0);
  }, [activeChannels, imageInfo]);

  const toggleChannel = (id: string) => {
    setActiveChannels(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!eyedropperActive || !imageInfo || !canvasRef.current) return;

    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();

    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const scale = Math.max(scaleX, scaleY);

    const renderWidth = canvas.width / scale;
    const renderHeight = canvas.height / scale;
    const offsetX = (rect.width - renderWidth) / 2;
    const offsetY = (rect.height - renderHeight) / 2;

    const x = Math.floor((e.clientX - rect.left - offsetX) * scale);
    const y = Math.floor((e.clientY - rect.top - offsetY) * scale);

    if (x < 0 || x >= canvas.width || y < 0 || y >= canvas.height) return;

    const i = (y * canvas.width + x) * 4;
    const data = imageInfo.imageData.data;
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    const a = imageInfo.hasMask ? data[i + 3] : 255;

    setPickedColor({ 
      x, y, 
      r, g, b, a, 
      lab: rgbToLab(r, g, b) 
    });
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
          <button onClick={() => handleDownload('png')} disabled={!imageInfo}>Скачать PNG</button>
          <button onClick={() => handleDownload('jpg')} disabled={!imageInfo}>Скачать JPG</button>
          <button onClick={() => handleDownload('gb7')} disabled={!imageInfo}>Скачать GB7</button>
          
          <span className="divider">|</span>
          
          <button 
            className={`tool-btn ${eyedropperActive ? 'active' : ''}`} 
            onClick={() => setEyedropperActive(!eyedropperActive)}
            disabled={!imageInfo}
          >
            {eyedropperActive ? '🧪 Пипетка (ВКЛ)' : '🧪 Пипетка'}
          </button>
        </div>
      </header>

      {/* Рабочая область (ТРИ КОЛОНКИ) */}
      <div className="workspace">
        
        {/* ЛЕВАЯ ПАНЕЛЬ: Каналы */}
        <aside className="side-panel channels-panel">
          <h3>Каналы</h3>
          {!imageInfo && <p className="hint">Загрузите изображение</p>}
          <div className="channels-list">
            {thumbnails.map(thumb => (
              <div 
                key={thumb.id} 
                className={`channel-item ${activeChannels.has(thumb.id) ? 'active' : ''}`}
                onClick={() => toggleChannel(thumb.id)}
              >
                <img src={thumb.url} alt={thumb.name} />
                <span>{thumb.name}</span>
              </div>
            ))}
          </div>
        </aside>

        {/* ЦЕНТР: Главный холст */}
        <main className="canvas-wrapper">
          <canvas 
            ref={canvasRef} 
            className={`main-canvas ${eyedropperActive ? 'crosshair' : ''}`} 
            onClick={handleCanvasClick}
          />
        </main>

        {/* ПРАВАЯ ПАНЕЛЬ: Инфо пипетки */}
        <aside className="side-panel info-panel">
          <h3>Информация</h3>
          {!eyedropperActive && <p className="hint">Включите пипетку и кликните по картинке</p>}
          {eyedropperActive && !pickedColor && <p className="hint">Ожидание клика...</p>}
          
          {pickedColor && (
            <div className="color-info">
              <div 
                className="color-preview" 
                style={{ backgroundColor: `rgba(${pickedColor.r}, ${pickedColor.g}, ${pickedColor.b}, ${pickedColor.a / 255})` }} 
              />
              <p><strong>Координаты:</strong> X: {pickedColor.x}, Y: {pickedColor.y}</p>
              <hr/>
              <p><strong>RGB:</strong></p>
              <ul>
                <li>R: {pickedColor.r}</li>
                <li>G: {pickedColor.g}</li>
                <li>B: {pickedColor.b}</li>
              </ul>
              <hr/>
              <p><strong>CIELAB:</strong></p>
              <ul>
                <li>L*: {pickedColor.lab.l}</li>
                <li>a*: {pickedColor.lab.a}</li>
                <li>b*: {pickedColor.lab.b}</li>
              </ul>
            </div>
          )}
        </aside>

      </div>

      {/* Статус-бар */}
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