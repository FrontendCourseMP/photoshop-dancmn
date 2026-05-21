// RGB -> CIELAB
export function rgbToLab(r: number, g: number, b: number) {
  let r_ = r / 255, g_ = g / 255, b_ = b / 255;

  r_ = r_ > 0.04045 ? Math.pow((r_ + 0.055) / 1.055, 2.4) : r_ / 12.92;
  g_ = g_ > 0.04045 ? Math.pow((g_ + 0.055) / 1.055, 2.4) : g_ / 12.92;
  b_ = b_ > 0.04045 ? Math.pow((b_ + 0.055) / 1.055, 2.4) : b_ / 12.92;

  // sRGB -> XYZ
  let x = (r_ * 0.4124 + g_ * 0.3576 + b_ * 0.1805) * 100;
  let y = (r_ * 0.2126 + g_ * 0.7152 + b_ * 0.0722) * 100;
  let z = (r_ * 0.0193 + g_ * 0.1192 + b_ * 0.9505) * 100;

  // D65
  x /= 95.047;
  y /= 100.000;
  z /= 108.883;

  // XYZ -> CIELAB
  x = x > 0.008856 ? Math.cbrt(x) : (7.787 * x) + (16 / 116);
  y = y > 0.008856 ? Math.cbrt(y) : (7.787 * y) + (16 / 116);
  z = z > 0.008856 ? Math.cbrt(z) : (7.787 * z) + (16 / 116);

  const l = (116 * y) - 16;
  const a = 500 * (x - y);
  const b_lab = 200 * (y - z);

  return { 
    l: l.toFixed(2), 
    a: a.toFixed(2), 
    b: b_lab.toFixed(2) 
  };
}