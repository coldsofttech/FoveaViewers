import { describe, expect, it } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useGreeting } from './index.js';

describe('useGreeting', () => {
  it('builds the greeting and updates with the name', () => {
    const { result, rerender } = renderHook(({ name }) => useGreeting(name), {
      initialProps: { name: 'World' },
    });
    expect(result.current).toBe('Hello, World!');
    rerender({ name: 'React' });
    expect(result.current).toBe('Hello, React!');
  });
});
