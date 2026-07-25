import { describe, expect, it } from 'vitest';
import { safeChartPercent } from './ExecutivePortfolioVisuals';

describe('safeChartPercent', () => {
  it('keeps empty and invalid chart data finite', () => {
    expect(safeChartPercent(0, 0)).toBe(0);
    expect(safeChartPercent(Number.NaN, 100)).toBe(0);
    expect(safeChartPercent(10, Number.POSITIVE_INFINITY)).toBe(0);
  });

  it('clamps negative and overflowing values', () => {
    expect(safeChartPercent(-5, 100)).toBe(0);
    expect(safeChartPercent(150, 100)).toBe(100);
  });

  it('returns a precise part-to-whole percentage', () => {
    expect(safeChartPercent(25, 100)).toBe(25);
    expect(safeChartPercent(1, 3)).toBeCloseTo(33.333, 3);
  });
});
