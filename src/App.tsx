import React, { useRef, useState, useEffect } from 'react';
import { encodeGB7 } from './utils/gb7-codec';
import { loadImageFromFile } from './utils/image-loader';
import type { AppImage } from './types';
import { rgbToLab } from './utils/color-math';
import { buildThumbnails, applyActiveChannels, type ChannelThumb } from './utils/channel-builder';
import { LevelsDialog } from './components/LevelsDialog';
import { ResizeDialog } from './components/ResizeDialog';
import { Algorithms, type AlgorithmType } from './utils/interpolation';
import './App.css';

function App() {
  // Ссылки
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapperRef = useRef<HTMLElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Состояния изображения и интерфейса
  const [imageInfo, setImageInfo] = useState<AppImage | null>(null);
  const [thumbnails, setThumbnails] = useState<ChannelThumb[]>([]);
  const [activeChannels, setActiveChannels] = useState<Set<string>>(new Set());
  
  // Состояния пипетки
  const [eyedropperActive, setEyedropperActive] = useState(false);
  const [pickedColor, setPickedColor] = useState<any>(null);

  // Состояния Уровней
  const [levelsOpen, setLevelsOpen] = useState(false);
  const [previewData, setPreviewData] = useState<ImageData | null>(null);

  // Состояния Масштабирования (Zoom) и Размера
  const [resizeOpen, setResizeOpen] = useState(false);
  const [zoomLevel, setZoomLevel] = useState<number>(100);
  const [zoomAlgo, setZoomAlgo] = useState<AlgorithmType>('bilinear');

  // ЗАГРУЗКА И АВТОМАСШТАБ
  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      const loadedImage = await loadImageFromFile(file);
      setImageInfo(loadedImage);
      
      // Авто-вычисление масштаба: вписываем в экран с отступом 50px
      if (wrapperRef.current) {
        const wrapW = wrapperRef.current.clientWidth - 100; 
        const wrapH = wrapperRef.current.clientHeight - 100; 
        
        const scaleX = wrapW / loadedImage.width;
        const scaleY = wrapH / loadedImage.height;
        let scale = Math.min(scaleX, scaleY, 1); // Не увеличиваем больше оригинала при загрузке
        
        let zoomPct = Math.round(scale * 100);
        zoomPct = Math.max(12, Math.min(300, zoomPct)); // Ограничение от 12 до 300%
        setZoomLevel(zoomPct);
      }

      const thumbs = await buildThumbnails(loadedImage);
      setThumbnails(thumbs);
      setActiveChannels(new Set(thumbs.map(t => t.id))); 
      setPickedColor(null);
    } catch (error) {
      alert(error);
    }
  };

  // ЭФФЕКТ ОТРИСОВКИ: Каналы + Уровни + Масштаб (Zoom)
  useEffect(() => {
    if (!imageInfo || !canvasRef.current) return;
    const isGray = imageInfo.format === 'gb7';
    
    // 1. Применяем фильтры
    const baseData = previewData || imageInfo.imageData;
    const filteredData = applyActiveChannels(baseData, activeChannels, isGray);
    
    // 2. Вычисляем физический размер для зума
    const zoomRatio = zoomLevel / 100;
    const targetW = Math.max(1, Math.round(imageInfo.width * zoomRatio));
    const targetH = Math.max(1, Math.round(imageInfo.height * zoomRatio));

    // 3. Выполняем интерполяцию (меняем размер пикселей для визуала)
    const scaledData = Algorithms[zoomAlgo](filteredData, targetW, targetH);

    // 4. Отрисовываем
    const ctx = canvasRef.current.getContext('2d')!;
    canvasRef.current.width = targetW;
    canvasRef.current.height = targetH;
    ctx.putImageData(scaledData, 0, 0);

  }, [activeChannels, imageInfo, previewData, zoomLevel, zoomAlgo]);

  const toggleChannel = (id: string) => {
    setActiveChannels(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // ПИПЕТКА
  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!eyedropperActive || !imageInfo || !canvasRef.current) return;

    const rect = canvasRef.current.getBoundingClientRect();

    // Вычисляем координату клика по холсту
    const clickX = e.clientX - rect.left;
    const clickY = e.clientY - rect.top;

    // Переводим координату обратно в размер оригинального изображения с учетом зума
    const zoomRatio = zoomLevel / 100;
    const originalX = Math.floor(clickX / zoomRatio);
    const originalY = Math.floor(clickY / zoomRatio);

    if (originalX < 0 || originalX >= imageInfo.width || originalY < 0 || originalY >= imageInfo.height) return;

    // Берем оригинальные цвета (без искажений от каналов и уровней)
    const i = (originalY * imageInfo.width + originalX) * 4;
    const data = imageInfo.imageData.data;
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    const a = imageInfo.hasMask ? data[i + 3] : 255;

    setPickedColor({ 
      x: originalX, y: originalY, 
      r, g, b, a, 
      lab: rgbToLab(r, g, b) 
    });
  };

  // СКАЧИВАНИЕ
  const handleDownload = (outExt: string) => {
    const canvas = canvasRef.current;
    if (!canvas || !imageInfo) return;

    // Важно: скачиваем оригинальное изображение с примененными уровнями, а не зумом
    const downloadCanvas = document.createElement('canvas');
    downloadCanvas.width = imageInfo.width;
    downloadCanvas.height = imageInfo.height;
    const dCtx = downloadCanvas.getContext('2d')!;
    const finalData = applyActiveChannels(imageInfo.imageData, activeChannels, imageInfo.format === 'gb7');
    dCtx.putImageData(finalData, 0, 0);

    if (outExt === 'gb7') {
      const buffer = encodeGB7(finalData, imageInfo.hasMask);
      const blob = new Blob([buffer], { type: 'application/octet-stream' });
      triggerDownload(blob, 'image.gb7');

    } else if (outExt === 'jpg') {
      const tempCanvas = document.createElement('canvas');
      tempCanvas.width = imageInfo.width;
      tempCanvas.height = imageInfo.height;
      const tCtx = tempCanvas.getContext('2d');
      
      if (tCtx) {
        tCtx.fillStyle = '#ffffff';
        tCtx.fillRect(0, 0, tempCanvas.width, tempCanvas.height);
        tCtx.drawImage(downloadCanvas, 0, 0);
        
        tempCanvas.toBlob((blob) => {
          if (blob) triggerDownload(blob, 'image.jpg');
        }, 'image/jpeg', 0.9);
      }

    } else {
      downloadCanvas.toBlob((blob) => {
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
          
          <button onClick={() => setLevelsOpen(true)} disabled={!imageInfo}>Уровни</button>
          <button onClick={() => setResizeOpen(true)} disabled={!imageInfo}>Размер</button>

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

      {/* Рабочая область */}
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

        {/* ЦЕНТР: Главный холст (Обернут в контейнер для безопасности прокрутки) */}
        <main className="canvas-wrapper" ref={wrapperRef}>
          <div className="canvas-container">
            <canvas 
              ref={canvasRef} 
              className={`main-canvas ${eyedropperActive ? 'crosshair' : ''}`} 
              onClick={handleCanvasClick}
            />
          </div>
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
            <span>Размер: {imageInfo.width} x {imageInfo.height} px</span>
            <span>Глубина: {imageInfo.depth}</span>
            <span>Формат: {imageInfo.format.toUpperCase()}</span> 
            
            {/* ПАНЕЛЬ МАСШТАБА (ZOOM) */}
            <div className="zoom-controls">
              <label>Отображение: </label>
              <select value={zoomAlgo} onChange={e => setZoomAlgo(e.target.value as AlgorithmType)}>
                <option value="bilinear">Bilinear</option>
                <option value="nearest">Nearest</option>
              </select>
              <input 
                type="range" 
                min="12" 
                max="300" 
                value={zoomLevel} 
                onChange={e => setZoomLevel(Number(e.target.value))} 
              />
              <span>{zoomLevel}%</span>
            </div>
          </>
        ) : (
          <span>Изображение не загружено</span>
        )}
      </footer>

      {/* Модальное окно Уровней */}
      <LevelsDialog 
        isOpen={levelsOpen}
        originalImage={imageInfo?.imageData || null}
        onClose={() => setLevelsOpen(false)}
        onPreview={(newData) => setPreviewData(newData)}
        onApply={(newImage) => {
          if (imageInfo) {
            setImageInfo({ ...imageInfo, imageData: newImage });
          }
          setPreviewData(null);
          setLevelsOpen(false);
        }}
      />

      {/* Модальное окно изменения физического размера */}
      <ResizeDialog 
        isOpen={resizeOpen} 
        originalData={imageInfo?.imageData || null} 
        onClose={() => setResizeOpen(false)} 
        onApply={(newData) => {
          if (imageInfo) {
            setImageInfo({ 
              ...imageInfo, 
              imageData: newData, 
              width: newData.width, 
              height: newData.height 
            });
          }
          setResizeOpen(false);
        }} 
      />
    </div>
  );
}

export default App;