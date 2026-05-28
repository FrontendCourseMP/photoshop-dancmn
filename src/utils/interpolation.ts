export type InterpolationAlgorithm = (src: ImageData, dstWidth: number, dstHeight: number) => ImageData;

// 1. МЕТОД БЛИЖАЙШЕГО СОСЕДА
const nearestNeighbor: InterpolationAlgorithm = (src, dstWidth, dstHeight) => {
  const dst = new ImageData(dstWidth, dstHeight);
  const scaleX = src.width / dstWidth;
  const scaleY = src.height / dstHeight;

  for (let y = 0; y < dstHeight; y++) {
    for (let x = 0; x < dstWidth; x++) {
      const srcX = Math.min(Math.floor(x * scaleX), src.width - 1);
      const srcY = Math.min(Math.floor(y * scaleY), src.height - 1);

      const srcPos = (srcY * src.width + srcX) * 4;
      const dstPos = (y * dstWidth + x) * 4;

      dst.data[dstPos] = src.data[srcPos];         // R
      dst.data[dstPos + 1] = src.data[srcPos + 1]; // G
      dst.data[dstPos + 2] = src.data[srcPos + 2]; // B
      dst.data[dstPos + 3] = src.data[srcPos + 3]; // A
    }
  }
  return dst;
};

// 2. БИЛИНЕЙНАЯ ИНТЕРПОЛЯЦИЯ
const bilinear: InterpolationAlgorithm = (src, dstWidth, dstHeight) => {
  const dst = new ImageData(dstWidth, dstHeight);
  const scaleX = src.width / dstWidth;
  const scaleY = src.height / dstHeight;

  for (let y = 0; y < dstHeight; y++) {
    for (let x = 0; x < dstWidth; x++) {
      const gx = x * scaleX;
      const gy = y * scaleY;
      
      const x1 = Math.floor(gx);
      const y1 = Math.floor(gy);
      
      const x2 = Math.min(x1 + 1, src.width - 1);
      const y2 = Math.min(y1 + 1, src.height - 1);

      const tx = gx - x1;
      const ty = gy - y1;

      const dstPos = (y * dstWidth + x) * 4;
      for (let c = 0; c < 4; c++) {
        const p11 = src.data[(y1 * src.width + x1) * 4 + c];
        const p21 = src.data[(y1 * src.width + x2) * 4 + c];
        const p12 = src.data[(y2 * src.width + x1) * 4 + c];
        const p22 = src.data[(y2 * src.width + x2) * 4 + c];

        const topMix = p11 * (1 - tx) + p21 * tx;
        const bottomMix = p12 * (1 - tx) + p22 * tx;

        dst.data[dstPos + c] = Math.round(topMix * (1 - ty) + bottomMix * ty);
      }
    }
  }
  return dst;
};

export const Algorithms = {
  nearest: nearestNeighbor,
  bilinear: bilinear,
};

export type AlgorithmType = keyof typeof Algorithms;