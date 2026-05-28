export type ChannelType = 'RGB' | 'R' | 'G' | 'B' | 'A';

export interface LevelsConfig {
  black: number;
  white: number;
  gamma: number;
}

// Вспомогательная функция для ограничения значений
function clamp(val: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, val));
}

// 1. Расчет гистограммы
export function calculateHistogram(imageData: ImageData, channel: ChannelType): number[] {
  const hist = new Array(256).fill(0);
  const data = imageData.data;

  for (let i = 0; i < data.length; i += 4) {
    let val = 0;
    if (channel === 'RGB') {
      val = Math.round(0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]);
    } else if (channel === 'R') val = data[i];
    else if (channel === 'G') val = data[i + 1];
    else if (channel === 'B') val = data[i + 2];
    else if (channel === 'A') val = data[i + 3];
    
    hist[clamp(val, 0, 255)]++;
  }
  return hist;
}

// 2. Генерация LUT для одного канала
function generateLUT(config: LevelsConfig): Uint8Array {
  const lut = new Uint8Array(256);
  for (let i = 0; i < 256; i++) {
    let val = (i - config.black) / (config.white - config.black);
    val = clamp(val, 0, 1);
    
    lut[i] = Math.round(Math.pow(val, 1 / config.gamma) * 255);
  }
  return lut;
}

// 3. Главная функция применения уровней (смешивает Master + Индивидуальные каналы)
export function applyLevels(
  original: ImageData, 
  master: LevelsConfig, 
  rConf: LevelsConfig, 
  gConf: LevelsConfig, 
  bConf: LevelsConfig, 
  aConf: LevelsConfig
): ImageData {
  
  // Генерируем базовые таблицы для каждого цвета
  const rLut = generateLUT(rConf);
  const gLut = generateLUT(gConf);
  const bLut = generateLUT(bConf);
  const aLut = generateLUT(aConf);
  const masterLut = generateLUT(master);

  // Склеиваем таблицы: Сначала применяется индивидуальный канал, затем поверх него Master
  const finalR = new Uint8Array(256);
  const finalG = new Uint8Array(256);
  const finalB = new Uint8Array(256);
  for (let i = 0; i < 256; i++) {
    finalR[i] = masterLut[rLut[i]];
    finalG[i] = masterLut[gLut[i]];
    finalB[i] = masterLut[bLut[i]];
  }

  const newData = new ImageData(new Uint8ClampedArray(original.data), original.width, original.height);
  const d = newData.data;

  for (let i = 0; i < d.length; i += 4) {
    d[i] = finalR[d[i]];
    d[i+1] = finalG[d[i+1]];
    d[i+2] = finalB[d[i+2]];
    d[i+3] = aLut[d[i+3]];
  }

  return newData;
}