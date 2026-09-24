import type { CSSProperties } from 'react';

export type SliderFillStyle = CSSProperties & { '--slider-fill': string };

export function sliderFillStyle(percent: number): SliderFillStyle {
  return { '--slider-fill': `${Math.round(percent)}%` };
}
