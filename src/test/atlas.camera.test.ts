import { describe, expect, it } from 'vitest';
import { zoomCamera, wheelZoom } from '@/lib/atlas.camera';
describe('sphere camera', () => {
  it('keeps the touched surface point anchored when zooming', () => {
    const next = zoomCamera({ zoom: 1, x: 0, y: 0 }, 2, { x: 100, y: 50 });
    expect(next).toEqual({ zoom: 2, x: -100, y: -50 });
    expect(100 * next.zoom + next.x).toBe(100);
  });
  it('normalizes line deltas and scales small trackpad movements smoothly', () => {
    expect(wheelZoom(1, 1, 1)).toBe(wheelZoom(1, 16, 0));
    expect(wheelZoom(1, -1, 0)).toBeLessThan(1.002);
  });
  it('bounds the camera between the distant globe and close surface', () => {
    expect(zoomCamera({ zoom: 1, x: 0, y: 0 }, 10, { x: 0, y: 0 }).zoom).toBe(3);
    expect(zoomCamera({ zoom: 1, x: 0, y: 0 }, 0.1, { x: 0, y: 0 }).zoom).toBe(0.6);
  });
});
