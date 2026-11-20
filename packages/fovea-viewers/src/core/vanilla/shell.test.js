import { afterEach, describe, expect, it, vi } from 'vitest';
import { createShell } from './shell.js';

const flush = () => new Promise((r) => setTimeout(r, 0));

describe('createShell', () => {
  afterEach(() => vi.restoreAllMocks());

  it('adds one root to the container and removes it on destroy', () => {
    const container = document.createElement('div');
    container.append(document.createElement('p'));
    const shell = createShell(container, { source: 'x' }, { className: 'viewer' });
    expect(container.children).toHaveLength(2);
    expect(shell.root.className).toBe('viewer');
    expect(shell.root.hasAttribute('data-fovea-root')).toBe(true);
    expect(shell.api.element).toBe(shell.root);
    shell.api.destroy();
    expect(container.children).toHaveLength(1);
  });

  it('works with a shadow root as the container', () => {
    const shadow = document.createElement('div').attachShadow({ mode: 'open' });
    const shell = createShell(shadow, { source: 'x' });
    expect(shell.root.getRootNode()).toBe(shadow);
  });

  it('throws a TypeError for a missing container, props or required prop', () => {
    expect(() => createShell(null, { source: 'x' })).toThrow(TypeError);
    expect(() => createShell(document.createElement('div'), null)).toThrow(TypeError);
    expect(() => createShell(document.createElement('div'), {})).toThrow('"source"');
    expect(() => createShell(document.createElement('div'), {}, { required: [] })).not.toThrow();
  });

  it('calls the update handler with only the props that changed', () => {
    const shell = createShell(document.createElement('div'), { source: 'a', label: 'L' });
    const handler = vi.fn();
    shell.onUpdate(handler);
    shell.api.update({ source: 'a', label: 'M' });
    expect(handler).toHaveBeenCalledWith(['label'], { source: 'a', label: 'M' });
    shell.api.update({ label: 'M' });
    shell.api.update({});
    shell.api.update(null);
    expect(handler).toHaveBeenCalledTimes(1);
    expect(shell.props.label).toBe('M');
  });

  it('emits the latest callback, and none after destroy', () => {
    const first = vi.fn();
    const second = vi.fn();
    const shell = createShell(document.createElement('div'), { source: 'a', onReady: first });
    shell.api.update({ onReady: second });
    shell.emit('onReady', 1, 2);
    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalledWith(1, 2);
    shell.emit('onMissing');
    shell.api.destroy();
    shell.emit('onReady');
    expect(second).toHaveBeenCalledTimes(1);
  });

  it('reports an error thrown by a callback without breaking the viewer', async () => {
    const reportError = vi.fn();
    vi.stubGlobal('reportError', reportError);
    const boom = new Error('boom');
    const shell = createShell(document.createElement('div'), {
      source: 'a',
      onReady: () => {
        throw boom;
      },
    });
    expect(() => shell.emit('onReady')).not.toThrow();
    expect(reportError).toHaveBeenCalledWith(boom);
    vi.unstubAllGlobals();
  });

  it('throws a callback error from a timer when reportError is not available', async () => {
    vi.stubGlobal('reportError', undefined);
    vi.useFakeTimers();
    const boom = new Error('late');
    const shell = createShell(document.createElement('div'), {
      source: 'a',
      onReady: () => {
        throw boom;
      },
    });
    shell.emit('onReady');
    expect(() => vi.runAllTimers()).toThrow(boom);
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  describe('load', () => {
    it('delivers a result, and an error as an Error', async () => {
      const shell = createShell(document.createElement('div'), { source: 'a' });
      const onResult = vi.fn();
      const onError = vi.fn();
      await shell.load(async () => 42, { onResult, onError });
      expect(onResult).toHaveBeenCalledWith(42);
      await shell.load(() => Promise.reject('plain string'), { onResult, onError });
      expect(onError.mock.calls[0][0]).toEqual(new Error('plain string'));
      await shell.load(
        () => {
          throw new TypeError('sync');
        },
        { onError },
      );
      expect(onError.mock.calls[1][0]).toBeInstanceOf(TypeError);
    });

    it('works without handlers', async () => {
      const shell = createShell(document.createElement('div'), { source: 'a' });
      await expect(shell.load(async () => 1)).resolves.toBeUndefined();
      await expect(shell.load(() => Promise.reject(new Error('x')))).resolves.toBeUndefined();
    });

    it('aborts the previous load and drops its result', async () => {
      const shell = createShell(document.createElement('div'), { source: 'a' });
      const onResult = vi.fn();
      /** @type {AbortSignal | undefined} */
      let firstSignal;
      let finishFirst = () => {};
      const first = shell.load(
        (signal) => {
          firstSignal = signal;
          return new Promise((resolve) => (finishFirst = () => resolve('first')));
        },
        { onResult },
      );
      await flush();
      const second = shell.load(async () => 'second', { onResult });
      expect(firstSignal?.aborted).toBe(true);
      finishFirst();
      await Promise.all([first, second]);
      expect(onResult).toHaveBeenCalledTimes(1);
      expect(onResult).toHaveBeenCalledWith('second');
    });

    it('does not run a task queued before destroy, and drops an in-flight result', async () => {
      const shell = createShell(document.createElement('div'), { source: 'a' });
      const task = vi.fn(async () => 1);
      const onResult = vi.fn();
      const pending = shell.load(task, { onResult });
      shell.api.destroy();
      await pending;
      expect(task).not.toHaveBeenCalled();

      const live = createShell(document.createElement('div'), { source: 'a' });
      let finish = () => {};
      const running = live.load(() => new Promise((r) => (finish = () => r(1))), { onResult });
      await flush();
      live.api.destroy();
      finish();
      await running;
      expect(onResult).not.toHaveBeenCalled();
    });

    it('cancel drops the result', async () => {
      const shell = createShell(document.createElement('div'), { source: 'a' });
      const onResult = vi.fn();
      const pending = shell.load(async () => 1, { onResult });
      shell.cancel();
      await pending;
      expect(onResult).not.toHaveBeenCalled();
    });
  });

  it('runs cleanups newest first, once, and survives one that throws', () => {
    vi.stubGlobal('reportError', vi.fn());
    const order = [];
    const shell = createShell(document.createElement('div'), { source: 'a' });
    shell.cleanup(() => order.push('first'));
    shell.cleanup(() => {
      throw new Error('bad cleanup');
    });
    shell.cleanup(() => order.push('last'));
    shell.api.destroy();
    shell.api.destroy();
    expect(order).toEqual(['last', 'first']);
    expect(shell.alive).toBe(false);
    vi.unstubAllGlobals();
  });
});
