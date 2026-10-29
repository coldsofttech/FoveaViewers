import { describe, expect, it } from 'vitest';
import { MAX_ZOOM, MIN_ZOOM, clampPan, clampZoom, fitScale, formatSize, turn } from './view.js';

describe('view helpers', () => {
  it('keeps zoom within its limits', () => {
    expect(clampZoom(100)).toBe(MAX_ZOOM);
    expect(clampZoom(0)).toBe(MIN_ZOOM);
    expect(clampZoom(2)).toBe(2);
  });

  it('fits an image to the view without enlarging it', () => {
    expect(fitScale('contain', 1000, 500, 500, 500)).toBe(0.5);
    expect(fitScale('contain', 100, 100, 500, 500)).toBe(1);
    expect(fitScale('width', 100, 100, 500, 500)).toBe(5);
    expect(fitScale('actual', 1000, 500, 500, 500)).toBe(1);
    expect(fitScale('contain', 1000, 500, 0, 0)).toBe(1);
  });

  it('pans only as far as there is image to reach', () => {
    expect(clampPan(500, 1000, 1, 400)).toBe(300);
    expect(clampPan(-500, 1000, 1, 400)).toBe(-300);
    expect(clampPan(50, 100, 1, 400)).toBe(0);
  });

  it('turns in quarter turns', () => {
    expect(turn(0, 1)).toBe(90);
    expect(turn(0, -1)).toBe(270);
    expect(turn(270, 1)).toBe(0);
  });

  it('formats sizes', () => {
    expect(formatSize(512)).toBe('512 B');
    expect(formatSize(2048)).toBe('2.0 KB');
    expect(formatSize(3 * 1024 * 1024)).toBe('3.0 MB');
  });
});
