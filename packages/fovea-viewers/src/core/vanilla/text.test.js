import { describe, expect, it, vi } from 'vitest';
import { loadText } from './text.js';

describe('loadText', () => {
  it('reads a Blob, an ArrayBuffer and a URL as UTF-8 text', async () => {
    expect(await loadText(new Blob(['héllo']))).toBe('héllo');
    expect(await loadText(new Uint8Array(new TextEncoder().encode('bytes')).buffer)).toBe('bytes');
    const fetcher = vi.fn().mockResolvedValue(new Response('from url'));
    expect(await loadText('/a.txt', { fetcher })).toBe('from url');
  });

  it('rejects when the file cannot be loaded', async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response('', { status: 500 }));
    await expect(loadText('/a.txt', { fetcher })).rejects.toThrow('500');
  });
});
