import { describe, expect, it, vi } from 'vitest';
import { readSource } from './source.js';

describe('readSource', () => {
  it('returns a Blob unchanged', async () => {
    const blob = new Blob(['a']);
    expect(await readSource(blob)).toBe(blob);
  });

  it('wraps an ArrayBuffer in a Blob', async () => {
    const blob = await readSource(new Uint8Array([1, 2, 3]).buffer);
    expect(blob.size).toBe(3);
  });

  it('loads URLs through the host fetcher', async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response('hello'));
    const blob = await readSource('https://example.com/a.txt', { fetcher });
    expect(fetcher).toHaveBeenCalledWith('https://example.com/a.txt');
    expect(await blob.text()).toBe('hello');
  });

  it('rejects when the response is not ok', async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response('', { status: 404 }));
    await expect(readSource('/missing', { fetcher })).rejects.toThrow('404');
  });
});
