import React, { useState, useEffect } from 'react';
import { type AlgorithmType, Algorithms } from '../utils/interpolation';

interface Props {
  isOpen: boolean;
  originalData: ImageData | null;
  onClose: () => void;
  onApply: (newData: ImageData) => void;
}

export const ResizeDialog: React.FC<Props> = ({ isOpen, originalData, onClose, onApply }) => {
  const [unit, setUnit] = useState<'px' | '%'>('%');
  const [width, setWidth] = useState<number>(100);
  const [height, setHeight] = useState<number>(100);
  const [keepAspect, setKeepAspect] = useState(true);
  const [algo, setAlgo] = useState<AlgorithmType>('bilinear');

  useEffect(() => {
    if (isOpen && originalData) {
      setUnit('%'); setWidth(100); setHeight(100); setKeepAspect(true); setAlgo('bilinear');
    }
  }, [isOpen, originalData]);

  if (!isOpen || !originalData) return null;

  const origW = originalData.width;
  const origH = originalData.height;
  const aspect = origW / origH;

  const calcPxWidth = unit === 'px' ? width : Math.round(origW * (width / 100));
  const calcPxHeight = unit === 'px' ? height : Math.round(origH * (height / 100));
  
  const mpBefore = ((origW * origH) / 1000000).toFixed(2);
  const mpAfter = ((calcPxWidth * calcPxHeight) / 1000000).toFixed(2);

  // Валидация
  const isValid = calcPxWidth > 0 && calcPxHeight > 0 && calcPxWidth <= 10000 && calcPxHeight <= 10000;

  const handleWidthChange = (val: number) => {
    setWidth(val);
    if (keepAspect) setHeight(unit === 'px' ? Math.round(val / aspect) : val);
  };

  const handleHeightChange = (val: number) => {
    setHeight(val);
    if (keepAspect) setWidth(unit === 'px' ? Math.round(val * aspect) : val);
  };

  const handleApply = () => {
    if (!isValid) return alert("Недопустимые размеры (max 10000px)");
    
    const resizer = Algorithms[algo];
    const newData = resizer(originalData, calcPxWidth, calcPxHeight);
    onApply(newData);
  };

  return (
    <div className="modal-overlay">
      <div className="modal-content">
        <h3>Изменить размер (Resample)</h3>
        
        <p className="mp-info">Мегапиксели: <strong>{mpBefore} MP</strong> ➔ <strong>{mpAfter} MP</strong></p>

        <div className="resize-controls">
          <label>Единицы:
            <select value={unit} onChange={(e) => {
              const newUnit = e.target.value as 'px'|'%';
              setUnit(newUnit);
              if (newUnit === 'px') {
                setWidth(Math.round(origW * (width / 100)));
                setHeight(Math.round(origH * (height / 100)));
              } else {
                setWidth(Number(((width / origW) * 100).toFixed(1)));
                setHeight(Number(((height / origH) * 100).toFixed(1)));
              }
            }}>
              <option value="%">Проценты (%)</option>
              <option value="px">Пиксели (px)</option>
            </select>
          </label>

          <div className="inputs-flex">
            <label>Ширина:
              <input type="number" value={width} onChange={e => handleWidthChange(Number(e.target.value))} />
            </label>
            <label>Высота:
              <input type="number" value={height} onChange={e => handleHeightChange(Number(e.target.value))} />
            </label>
          </div>

          <label className="checkbox-label">
            <input type="checkbox" checked={keepAspect} onChange={e => setKeepAspect(e.target.checked)} />
            Сохранять пропорции
          </label>

          <hr/>

          <label className="algo-label">Алгоритм интерполяции:
            <select value={algo} onChange={e => setAlgo(e.target.value as AlgorithmType)}>
              <option value="bilinear" title="Гладкие края. Идеально для фото.">Билинейная (Bilinear)</option>
              <option value="nearest" title="Сохраняет жесткие края. Идеально для Pixel Art.">Ближайший сосед (Nearest)</option>
            </select>
          </label>
          {/* Тултип */}
          <p className="tooltip">
            {algo === 'bilinear' 
              ? "🔍 Билинейная: Вычисляет среднее значение между соседними пикселями. Делает фото более гладкими при увеличении." 
              : "⬛ Ближайший сосед: Просто дублирует пиксели. Отлично подходит для сохранения резкости чертежей или Pixel Art."}
          </p>
        </div>

        <div className="modal-footer">
          <button onClick={onClose}>Отмена</button>
          <button className="btn-primary" disabled={!isValid} onClick={handleApply}>Применить</button>
        </div>
      </div>
    </div>
  );
};