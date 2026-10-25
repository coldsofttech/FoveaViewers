import { describe, expect, it } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { splitLines, useLines } from './useLines.js';

describe('splitLines', () => {
  it('splits on every kind of line break', () => {
    expect(splitLines('a\nb\r\nc\rd')).toEqual(['a', 'b', 'c', 'd']);
  });

  it('does not add an empty line for a final line break', () => {
    expect(splitLines('a\nb\n')).toEqual(['a', 'b']);
  });

  it('keeps blank lines and an empty file as one empty line', () => {
    expect(splitLines('a\n\nb')).toEqual(['a', '', 'b']);
    expect(splitLines('')).toEqual(['']);
  });
});

describe('useLines', () => {
  it('reads a blob into lines', async () => {
    const blob = new Blob(['one\ntwo']);
    const { result } = renderHook(() => useLines(blob));
    expect(result.current.status).toBe('loading');
    await waitFor(() => expect(result.current.status).toBe('ready'));
    expect(result.current.lines).toEqual(['one', 'two']);
  });

  it('reports a failed load', async () => {
    const fetcher = () => Promise.reject(new Error('offline'));
    const { result } = renderHook(() => useLines('/a.txt', fetcher));
    await waitFor(() => expect(result.current.status).toBe('error'));
    expect(result.current.error?.message).toBe('offline');
  });

  it('starts again when the source changes', async () => {
    const first = new Blob(['a']);
    const second = new Blob(['b']);
    const { result, rerender } = renderHook(({ source }) => useLines(source), {
      initialProps: { source: first },
    });
    await waitFor(() => expect(result.current.lines).toEqual(['a']));
    rerender({ source: second });
    expect(result.current.status).toBe('loading');
    await waitFor(() => expect(result.current.lines).toEqual(['b']));
  });
});
