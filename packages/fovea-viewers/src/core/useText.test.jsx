import { describe, expect, it } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useText } from './useText.js';

describe('useText', () => {
  it('reads a blob as text', async () => {
    const blob = new Blob(['héllo']);
    const { result } = renderHook(() => useText(blob));
    expect(result.current.status).toBe('loading');
    await waitFor(() => expect(result.current.status).toBe('ready'));
    expect(result.current.text).toBe('héllo');
  });

  it('reports a failed load', async () => {
    const fetcher = () => Promise.reject(new Error('offline'));
    const { result } = renderHook(() => useText('/a.txt', fetcher));
    await waitFor(() => expect(result.current.status).toBe('error'));
    expect(result.current.error?.message).toBe('offline');
  });

  it('reads an empty file as an empty string', async () => {
    const blob = new Blob([]);
    const { result } = renderHook(() => useText(blob));
    await waitFor(() => expect(result.current.status).toBe('ready'));
    expect(result.current.text).toBe('');
  });

  it('starts again when the source changes', async () => {
    const first = new Blob(['a']);
    const second = new Blob(['b']);
    const { result, rerender } = renderHook(({ source }) => useText(source), {
      initialProps: { source: first },
    });
    await waitFor(() => expect(result.current.text).toBe('a'));
    rerender({ source: second });
    expect(result.current.status).toBe('loading');
    await waitFor(() => expect(result.current.text).toBe('b'));
  });
});
