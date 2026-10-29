import { describe, expect, it } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useSource } from './useSource.js';

describe('useSource', () => {
  it('becomes ready with the blob', async () => {
    const blob = new Blob(['hi']);
    const { result } = renderHook(() => useSource(blob));
    await waitFor(() => expect(result.current.status).toBe('ready'));
    expect(result.current.blob).toBe(blob);
  });

  it('reports fetch failures as an error state', async () => {
    const fetcher = () => Promise.reject(new Error('offline'));
    const { result } = renderHook(() => useSource('/a.txt', fetcher));
    await waitFor(() => expect(result.current.status).toBe('error'));
    expect(result.current.error?.message).toBe('offline');
  });
});
