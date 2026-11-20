import { describe, expect, it, vi } from 'vitest';
import { describeConformance } from '../../../test-support/conformance.js';
import { makePptx } from '../../../test-support/pptx.js';
import {
  elementAdapter,
  reactComponentAdapter,
  vanillaAdapter,
} from '../../../test-support/adapters.jsx';
import { PowerpointViewer } from './PowerpointViewer.jsx';
import { definePowerpointElement } from './element.js';
import { createPowerpointViewer } from './vanilla/index.js';

const sample = new Uint8Array(await makePptx());

describeConformance('powerpoint', {
  text: sample,
  shows: (root) => {
    expect(root.querySelector('[role="group"]')).toHaveTextContent('Launch plan');
    expect(root.querySelector('[role="status"]')).toHaveTextContent('Slide 1 of 2');
  },
  adapters: [
    vanillaAdapter(createPowerpointViewer),
    elementAdapter('fovea-powerpoint', definePowerpointElement),
    reactComponentAdapter(PowerpointViewer),
  ],
});

describe('createPowerpointViewer', () => {
  const open = (props) => {
    const host = document.createElement('div');
    document.body.append(host);
    return { host, viewer: createPowerpointViewer(host, { source: new Blob([sample]), ...props }) };
  };
  const stage = (viewer) => viewer.element.querySelector('[role="group"]');
  const press = (viewer, key) => {
    const event = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true });
    stage(viewer).dispatchEvent(event);
    return event;
  };
  const ready = (viewer) => vi.waitFor(() => expect(stage(viewer)).not.toBeNull());

  it('moves between slides with the buttons and the keys, keeping the stage and its focus', async () => {
    const onSlideChange = vi.fn();
    const { host, viewer } = open({ onSlideChange });
    await ready(viewer);
    const slideStage = stage(viewer);
    const buttons = [...viewer.element.querySelectorAll('button')];
    const nextButton = buttons.find((b) => b.textContent === 'Next slide');
    const previousButton = buttons.find((b) => b.textContent === 'Previous slide');
    expect(previousButton.disabled).toBe(true);
    nextButton.click();
    expect(onSlideChange).toHaveBeenCalledWith(1);
    expect(stage(viewer)).toBe(slideStage);
    expect(slideStage).toHaveTextContent('Results');
    expect(nextButton.disabled).toBe(true);
    expect(viewer.element).toHaveTextContent('Slide 2 of 2');
    expect(press(viewer, 'Home').defaultPrevented).toBe(true);
    expect(slideStage).toHaveTextContent('Launch plan');
    press(viewer, 'End');
    expect(slideStage).toHaveTextContent('Results');
    press(viewer, 'ArrowLeft');
    press(viewer, 'PageDown');
    expect(slideStage).toHaveTextContent('Results');
    press(viewer, 'PageUp');
    expect(slideStage).toHaveTextContent('Launch plan');
    expect(press(viewer, 'x').defaultPrevented).toBe(false);
    viewer.destroy();
    host.remove();
  });

  it('chooses a slide from the thumbnails, and leaves them out on request', async () => {
    const { host, viewer } = open({});
    await ready(viewer);
    const thumbnails = () => [...viewer.element.querySelectorAll('ol button')];
    expect(thumbnails().map((b) => b.getAttribute('aria-label'))).toEqual([
      'Slide 1: Launch plan',
      'Slide 2: Results',
    ]);
    expect(thumbnails()[0]).toHaveAttribute('aria-current', 'true');
    thumbnails()[1].click();
    expect(thumbnails()[1]).toHaveAttribute('aria-current', 'true');
    expect(thumbnails()[0]).not.toHaveAttribute('aria-current');
    viewer.update({ thumbnails: false });
    expect(viewer.element.querySelector('ol')).toBeNull();
    viewer.destroy();
    host.remove();
  });

  it('shows the speaker notes of a slide, unless turned off', async () => {
    const { host, viewer } = open({});
    await ready(viewer);
    expect(viewer.element.querySelector('aside')).toHaveTextContent('Remember to thank the team');
    viewer.update({ showNotes: false });
    expect(viewer.element.querySelector('aside')).toBeNull();
    viewer.destroy();
    host.remove();
  });

  it('draws the shapes of a slide: bullets, a table with a merged cell and a picture', async () => {
    const { host, viewer } = open({ slide: 1 });
    await ready(viewer);
    expect(stage(viewer).querySelectorAll('tr')).toHaveLength(3);
    expect(stage(viewer).querySelector('td[colspan="2"]')).toHaveTextContent('South, merged');
    expect(stage(viewer).querySelector('img')).toHaveAttribute('alt', 'A single dot');
    viewer.update({ slide: 0 });
    expect(stage(viewer).querySelectorAll('ul li')).toHaveLength(2);
    expect(stage(viewer).querySelector('strong, span[style*="700"]')).not.toBeNull();
    viewer.destroy();
    host.remove();
  });

  it('shows the slide that holds the target, marks it and reports it once', async () => {
    const onMarked = vi.fn();
    const { host, viewer } = open({ target: { matched: 'South, merged' }, onMarked });
    await vi.waitFor(() => expect(onMarked).toHaveBeenLastCalledWith(true));
    expect(stage(viewer)).toHaveTextContent('Results');
    expect(viewer.element.querySelector('mark')).toHaveTextContent('South, merged');
    const calls = onMarked.mock.calls.length;
    viewer.update({ label: 'Deck' });
    expect(onMarked.mock.calls.length).toBe(calls);
    viewer.update({ target: undefined });
    expect(onMarked).toHaveBeenLastCalledWith(null);
    expect(viewer.element.querySelector('mark')).toBeNull();
    viewer.destroy();
    host.remove();
  });

  it('reports the slide count once, and a file that is not a presentation', async () => {
    const onReady = vi.fn();
    const onError = vi.fn();
    const { host, viewer } = open({ onReady, onError });
    await vi.waitFor(() => expect(onReady).toHaveBeenCalledWith({ slideCount: 2 }));
    viewer.update({ label: 'Deck' });
    expect(onReady).toHaveBeenCalledTimes(1);
    viewer.update({ source: new Blob(['not a deck']) });
    await vi.waitFor(() => expect(onError).toHaveBeenCalledTimes(1));
    expect(viewer.element.querySelector('[role="alert"]')).toHaveTextContent('could not be read');
    viewer.destroy();
    host.remove();
  });
});

describe('<fovea-powerpoint>', () => {
  it('takes slide from an attribute and turns notes off with show-notes="false"', async () => {
    const el = document.createElement('fovea-powerpoint');
    el.setAttribute('slide', '0');
    el.setAttribute('show-notes', 'false');
    el.source = new Blob([sample]);
    document.body.append(el);
    const root = () => el.shadowRoot.querySelector('[data-fovea-root]');
    await vi.waitFor(() =>
      expect(root().querySelector('[role="group"]')).toHaveTextContent('Launch plan'),
    );
    expect(root().querySelector('aside')).toBeNull();
    el.remove();
  });
});
