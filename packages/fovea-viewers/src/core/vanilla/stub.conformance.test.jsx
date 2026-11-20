import { describe, expect, it } from 'vitest';
import { describeConformance } from '../../../../../test-support/conformance.js';
import {
  elementAdapter,
  reactAdapter,
  vanillaAdapter,
} from '../../../../../test-support/adapters.jsx';
import { createStubViewer, defineStubElement } from '../../../../../test-support/stub-viewer.js';

// The suite every viewer will run, run against a stub viewer built from the shared runtime. It
// proves the runtime and the harness, and every adapter (vanilla, element and a React wrapper)
// behaves the same.
describeConformance('stub', {
  text: 'Hello, conformance.',
  shows: (root, text) => expect(root.querySelector('pre').textContent).toBe(text),
  adapters: [
    vanillaAdapter(createStubViewer),
    elementAdapter('fovea-stub', defineStubElement),
    reactAdapter(createStubViewer),
  ],
});

describe('stub viewer', () => {
  it('throws a TypeError without a source', () => {
    expect(() => createStubViewer(document.createElement('div'), {})).toThrow(TypeError);
  });
});
