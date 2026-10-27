import { describe, expect, it } from 'vitest';
import {
  GAP,
  MAX_ZOOM,
  MIN_ZOOM,
  boxOf,
  clampZoom,
  fitZoom,
  pageAt,
  pagesIn,
  stack,
  turn,
} from './layout.js';

describe('layout', () => {
  it('keeps zoom within its limits', () => {
    expect(clampZoom(100)).toBe(MAX_ZOOM);
    expect(clampZoom(0)).toBe(MIN_ZOOM);
    expect(clampZoom(1.5)).toBe(1.5);
  });

  it('turns in quarter turns', () => {
    expect(turn(0, 1)).toBe(90);
    expect(turn(0, -1)).toBe(270);
    expect(turn(270, 1)).toBe(0);
  });

  it('sizes a page on screen, swapping its sides when turned', () => {
    expect(boxOf({ width: 100, height: 200 }, 2, 0)).toEqual({ width: 200, height: 400 });
    expect(boxOf({ width: 100, height: 200 }, 2, 90)).toEqual({ width: 400, height: 200 });
  });

  it('fits a page to the width or to the whole view', () => {
    const page = { width: 600, height: 800 };
    const view = { width: 624 + GAP * 2 - 24, height: 400 + GAP * 2 };
    expect(fitZoom('width', page, { width: 600 + GAP * 2, height: 400 + GAP * 2 })).toBe(1);
    expect(fitZoom('page', page, { width: 600 + GAP * 2, height: 400 + GAP * 2 })).toBe(0.5);
    expect(fitZoom('width', page, { width: 0, height: 0 })).toBe(1);
    expect(view.width).toBeGreaterThan(0);
  });

  it('stacks pages with a gap and finds the page at a height', () => {
    const { tops, total } = stack([100, 200, 100]);
    expect(tops).toEqual([GAP, GAP * 2 + 100, GAP * 3 + 300]);
    expect(total).toBe(GAP * 4 + 400);
    expect(pageAt(tops, 0)).toBe(0);
    expect(pageAt(tops, tops[1])).toBe(1);
    expect(pageAt(tops, tops[2] + 5)).toBe(2);
    expect(pageAt(tops, 99999)).toBe(2);
  });

  it('lists the pages that touch a stretch of the stack', () => {
    const heights = [100, 200, 100];
    const { tops } = stack(heights);
    expect(pagesIn(tops, heights, 0, 50)).toEqual([0]);
    expect(pagesIn(tops, heights, 0, tops[1])).toEqual([0, 1]);
    expect(pagesIn(tops, heights, tops[2], 99999)).toEqual([2]);
    expect(pagesIn([], [], 0, 10)).toEqual([]);
  });
});
