// A stand-in for pdf.js for tests: pages of 600 × 800, one line of text each, no drawing.
import { vi } from 'vitest';

export const PAGES = ['Alpha opens the file', 'Beta is in the middle', 'Gamma closes it'];
export const OUTLINE = [
  { title: 'Start', dest: [0], items: [] },
  { title: 'Ending', dest: [2], items: [{ title: 'Last words', dest: [2], items: [] }] },
];

/** A stand-in for pdf.js: pages of 600 × 800, one line of text each, no drawing. */
export function fakePdfjs({ locked = false, outline = OUTLINE, pages = PAGES } = {}) {
  class TextLayer {
    constructor({ container, textContentSource }) {
      this.container = container;
      this.text = textContentSource.text;
    }
    async render() {
      const span = document.createElement('span');
      span.textContent = this.text;
      this.container.append(span);
    }
    cancel() {}
  }
  const doc = {
    numPages: pages.length,
    getPage: async (number) => ({
      rotate: 0,
      getViewport: ({ scale, rotation = 0 }) =>
        rotation % 180
          ? { width: 800 * scale, height: 600 * scale }
          : { width: 600 * scale, height: 800 * scale },
      render: () => ({ promise: Promise.resolve(), cancel() {} }),
      streamTextContent: () => ({ text: pages[number - 1] }),
      getTextContent: async () => ({ items: [{ str: pages[number - 1] }] }),
    }),
    getOutline: async () => outline,
    getDestination: async () => null,
    getPageIndex: async (ref) => ref,
  };
  const tasks = [];
  const pdfjs = {
    TextLayer,
    PasswordResponses: { NEED_PASSWORD: 1, INCORRECT_PASSWORD: 2 },
    getDocument: ({ password }) => {
      const task = { destroy: vi.fn(), onPassword: () => {} };
      task.promise = new Promise((resolve) => {
        const ask = (why) =>
          queueMicrotask(() =>
            task.onPassword((typed) => (typed === 'secret' ? resolve(doc) : ask(2)), why),
          );
        if (locked && password !== 'secret') ask(password === undefined ? 1 : 2);
        else resolve(doc);
      });
      tasks.push(task);
      return task;
    },
  };
  return { pdfjs, tasks };
}
