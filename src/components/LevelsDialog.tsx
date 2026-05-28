import React, { useState, useEffect, useRef, useCallback } from 'react';
import { type ChannelType, type LevelsConfig, calculateHistogram, applyLevels } from '../utils/levels-math';

interface Props {
  isOpen: boolean;
  originalImage: ImageData | null;
  onClose: () => void;
  onApply: (newImage: ImageData) => void;
  onPreview: (newImage: ImageData | null) => void;
}

const DEFAULT_LEVELS: LevelsConfig = { black: 0, white: 255, gamma: 1.0 };

const gammaToRatio = (gamma: number) => {
  const g = Math.max(0.01, Math.min(9.99, gamma));
  const r = 0.5 * (1 - Math.log10(g));
  return Math.max(0, Math.min(1, r));
};

const ratioToGamma = (ratio: number) => {
  const r = Math.max(0.01, Math.min(0.99, ratio));
  const g = Math.pow(10, (0.5 - r) * 2);
  return Number(g.toFixed(2));
};

export const LevelsDialog: React.FC<Props> = ({ isOpen, originalImage, onClose, onApply, onPreview }) => {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sliderRef = useRef<HTMLDivElement>(null);

  const [channel, setChannel] = useState<ChannelType>('RGB');
  const [isLogarithmic, setIsLogarithmic] = useState(false);
  const [previewEnabled, setPreviewEnabled] = useState(true);

  const [configs, setConfigs] = useState<Record<ChannelType, LevelsConfig>>({
    RGB: { ...DEFAULT_LEVELS }, R: { ...DEFAULT_LEVELS }, G: { ...DEFAULT_LEVELS },
    B: { ...DEFAULT_LEVELS }, A: { ...DEFAULT_LEVELS }
  });

  // --- ЛОГИКА ПЛАВАЮЩЕГО ОКНА ---
  const [dialogPos, setDialogPos] = useState({ x: 0, y: 0 });
  const isDraggingDialog = useRef(false);
  const dragStart = useRef({ x: 0, y: 0 });

  const startDialogDrag = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).tagName === 'BUTTON') return;
    isDraggingDialog.current = true;
    dragStart.current = { x: e.clientX - dialogPos.x, y: e.clientY - dialogPos.y };
  };

  useEffect(() => {
    const handleMove = (e: MouseEvent) => {
      if (isDraggingDialog.current) {
        setDialogPos({ x: e.clientX - dragStart.current.x, y: e.clientY - dragStart.current.y });
      }
    };
    const handleUp = () => { isDraggingDialog.current = false; };
    window.addEventListener('mousemove', handleMove);
    window.addEventListener('mouseup', handleUp);
    return () => { window.removeEventListener('mousemove', handleMove); window.removeEventListener('mouseup', handleUp); };
  }, []);

  useEffect(() => {
    if (isOpen) {
      setDialogPos({ x: 0, y: 0 });
      setConfigs({
        RGB: { ...DEFAULT_LEVELS }, 
        R: { ...DEFAULT_LEVELS }, 
        G: { ...DEFAULT_LEVELS },
        B: { ...DEFAULT_LEVELS }, 
        A: { ...DEFAULT_LEVELS }
      });
      setChannel('RGB');

      dialogRef.current?.showModal();
    } else {
      dialogRef.current?.close();
    }
  }, [isOpen]);

  // --- ЛОГИКА СЛАЙДЕРА ---
  const [activeThumb, setActiveThumb] = useState<'none'|'black'|'gamma'|'white'>('none');
  const activeConf = configs[channel];

  useEffect(() => {
    if (activeThumb === 'none') return;

    const handleMouseMove = (e: MouseEvent) => {
      if (!sliderRef.current) return;
      const rect = sliderRef.current.getBoundingClientRect();
      let val = Math.round(((e.clientX - rect.left) / rect.width) * 255);
      val = Math.max(0, Math.min(255, val));

      setConfigs(prev => {
        const cur = { ...prev[channel] };
        
        if (activeThumb === 'black') {
          cur.black = Math.min(val, cur.white - 2);
        } else if (activeThumb === 'white') {
          cur.white = Math.max(val, cur.black + 2);
        } else if (activeThumb === 'gamma') {
          const clampedVal = Math.max(cur.black + 1, Math.min(cur.white - 1, val));
          const ratio = (clampedVal - cur.black) / (cur.white - cur.black);
          cur.gamma = ratioToGamma(ratio);
        }
        return { ...prev, [channel]: cur };
      });
    };

    const handleMouseUp = () => setActiveThumb('none');

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => { window.removeEventListener('mousemove', handleMouseMove); window.removeEventListener('mouseup', handleMouseUp); };
  }, [activeThumb, channel]);

  useEffect(() => {
    if (!originalImage || !canvasRef.current || !isOpen) return;
    const hist = calculateHistogram(originalImage, channel);
    
    const ctx = canvasRef.current.getContext('2d')!;
    const width = canvasRef.current.width;
    const height = canvasRef.current.height;
    ctx.clearRect(0, 0, width, height);

    let maxCount = Math.max(...hist);
    if (isLogarithmic) maxCount = Math.log(maxCount + 1);

    ctx.fillStyle = '#888';
    ctx.beginPath();
    ctx.moveTo(0, height);

    for (let i = 0; i < 256; i++) {
      let val = hist[i];
      if (isLogarithmic) val = Math.log(val + 1);
      const x = (i / 255) * width;
      const y = height - (val / maxCount) * height;
      ctx.lineTo(x, y);
    }
    ctx.lineTo(width, height);
    ctx.fill();
  }, [originalImage, channel, isLogarithmic, isOpen]);

  const generatePreview = useCallback(() => {
    if (!originalImage) return null;
    return applyLevels(originalImage, configs.RGB, configs.R, configs.G, configs.B, configs.A);
  }, [originalImage, configs]);

  useEffect(() => {
    if (!isOpen) return;
    if (previewEnabled) onPreview(generatePreview());
    else onPreview(originalImage);
  }, [configs, previewEnabled, isOpen, generatePreview, onPreview, originalImage]);

  const grayRatio = gammaToRatio(activeConf.gamma);
  const grayX = activeConf.black + grayRatio * (activeConf.white - activeConf.black);

  return (
    <dialog 
      ref={dialogRef} 
      className="levels-dialog" 
      style={{ transform: `translate(${dialogPos.x}px, ${dialogPos.y}px)` }}
    >
      {/* Шапка окна */}
      <div className="dialog-header" onMouseDown={startDialogDrag}>
        <h3>Уровни (Levels)</h3>
      </div>
      
      <div className="levels-controls">
        <label>Канал:</label>
        <select value={channel} onChange={(e) => setChannel(e.target.value as ChannelType)}>
          <option value="RGB">RGB (Master)</option>
          <option value="R">Красный</option>
          <option value="G">Зеленый</option>
          <option value="B">Синий</option>
          <option value="A">Альфа</option>
        </select>
        <label>
          <input type="checkbox" checked={isLogarithmic} onChange={e => setIsLogarithmic(e.target.checked)} />
          Логарифм.
        </label>
      </div>

      <div className="histogram-container">
        <canvas ref={canvasRef} width={256} height={100} className="histogram-canvas" />
        
        {/* CUSTOM СЛАЙДЕР */}
        <div className="levels-track" ref={sliderRef}>
          <div 
            className="thumb thumb-black" 
            style={{ left: `${(activeConf.black / 255) * 100}%` }} 
            onMouseDown={() => setActiveThumb('black')} 
          />
          <div 
            className="thumb thumb-gray" 
            style={{ left: `${(grayX / 255) * 100}%`, zIndex: activeThumb === 'gamma' ? 10 : 5 }} 
            onMouseDown={() => setActiveThumb('gamma')} 
          />
          <div 
            className="thumb thumb-white" 
            style={{ left: `${(activeConf.white / 255) * 100}%` }} 
            onMouseDown={() => setActiveThumb('white')} 
          />
        </div>
      </div>

      <div className="inputs-row">
        <div className="val-box">{activeConf.black}</div>
        <div className="val-box">{activeConf.gamma.toFixed(2)}</div>
        <div className="val-box">{activeConf.white}</div>
      </div>

      <div className="dialog-footer">
        <label className="preview-label">
          <input type="checkbox" checked={previewEnabled} onChange={e => setPreviewEnabled(e.target.checked)} />
          Предпросмотр
        </label>
        
        <div className="dialog-buttons">
          <button onClick={() => setConfigs(prev => ({ ...prev, [channel]: { ...DEFAULT_LEVELS } }))}>Сброс</button>
          <button onClick={() => { onPreview(originalImage); onClose(); }}>Отмена</button>
          <button onClick={() => { const res = generatePreview(); if(res) onApply(res); }} className="btn-primary">Применить</button>
        </div>
      </div>
    </dialog>
  );
};