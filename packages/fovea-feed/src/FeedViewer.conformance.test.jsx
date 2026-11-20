import { describe, expect, it, vi } from 'vitest';
import { describeConformance } from '../../../test-support/conformance.js';
import {
  elementAdapter,
  reactComponentAdapter,
  vanillaAdapter,
} from '../../../test-support/adapters.jsx';
import { FeedViewer } from './FeedViewer.jsx';
import { defineFeedElement } from './element.js';
import { createFeedViewer } from './vanilla/index.js';

const item = (n, extra = '') =>
  `<item><title>Entry ${n}</title><link>https://example.test/${n}</link><description>Words of entry ${n}${extra}</description></item>`;
const feedOf = (count, extra) =>
  `<?xml version="1.0"?><rss version="2.0"><channel><title>Field notes</title><link>https://example.test/</link>${Array.from({ length: count }, (_, i) => item(i + 1, extra)).join('')}</channel></rss>`;

describeConformance('feed', {
  text: feedOf(2),
  shows: (root) => {
    expect(root.querySelector('h2')).toHaveTextContent('Field notes');
    expect(root.querySelectorAll('article')).toHaveLength(2);
  },
  adapters: [
    vanillaAdapter(createFeedViewer),
    elementAdapter('fovea-feed', defineFeedElement),
    reactComponentAdapter(FeedViewer),
  ],
});

describe('createFeedViewer', () => {
  const open = (props) => {
    const host = document.createElement('div');
    document.body.append(host);
    return { host, viewer: createFeedViewer(host, { source: new Blob([feedOf(5)]), ...props }) };
  };
  const cards = (viewer) => viewer.element.querySelectorAll('article');

  it('shows a page of entries, adds the next page on a click and keeps the cards already there', async () => {
    const { host, viewer } = open({ pageSize: 2 });
    await vi.waitFor(() => expect(cards(viewer)).toHaveLength(2));
    const first = cards(viewer)[0];
    expect(viewer.element).toHaveTextContent('Showing 2 of 5 entries');
    const more = [...viewer.element.querySelectorAll('button')].find((b) =>
      /Show 2 more/.test(b.textContent),
    );
    more.click();
    expect(cards(viewer)).toHaveLength(4);
    expect(cards(viewer)[0]).toBe(first);
    [...viewer.element.querySelectorAll('button')]
      .find((b) => /Show 1 more/.test(b.textContent))
      .click();
    expect(cards(viewer)).toHaveLength(5);
    expect(viewer.element.querySelectorAll('button')).toHaveLength(0);
    // Two presses have been made, so a page of one now means three entries.
    viewer.update({ pageSize: 1 });
    expect(cards(viewer)).toHaveLength(3);
    viewer.destroy();
    host.remove();
  });

  it('finds the entry that holds the target, shows enough entries to reach it, outlines and marks it', async () => {
    const onLocated = vi.fn();
    const { host, viewer } = open({
      pageSize: 2,
      target: { matched: 'Words of entry 4' },
      onLocated,
    });
    await vi.waitFor(() => expect(onLocated).toHaveBeenCalledWith(4));
    expect(cards(viewer)).toHaveLength(4);
    expect(cards(viewer)[3]).toHaveAttribute('aria-current', 'true');
    expect(viewer.element.querySelector('mark')).toHaveTextContent('Words of entry 4');
    viewer.update({ target: undefined });
    expect(onLocated).toHaveBeenLastCalledWith(null);
    expect(viewer.element.querySelector('mark')).toBeNull();
    expect(viewer.element.querySelector('[aria-current]')).toBeNull();
    viewer.destroy();
    host.remove();
  });

  it('keeps the marks in place when a prop that does not touch the cards changes', async () => {
    const { host, viewer } = open({ target: { matched: 'entry 2' } });
    await vi.waitFor(() => expect(viewer.element.querySelector('mark')).not.toBeNull());
    viewer.update({ label: 'Notes' });
    expect(viewer.element.querySelectorAll('mark')).toHaveLength(1);
    expect(viewer.element).toHaveAttribute('aria-label', 'Notes');
    viewer.destroy();
    host.remove();
  });

  it('shows the text of entries, or their cleaned HTML with richText, and no web pictures unless allowed', async () => {
    const html = feedOf(1).replace(
      '<description>Words of entry 1</description>',
      '<description><![CDATA[<p>Rich <b>bold</b><img src="https://example.test/p.png" alt="p"><script>x()</script></p>]]></description>',
    );
    const { host, viewer } = open({ source: new Blob([html]) });
    await vi.waitFor(() => expect(cards(viewer)).toHaveLength(1));
    expect(viewer.element.querySelector('b')).toBeNull();
    viewer.update({ richText: true });
    expect(viewer.element.querySelector('b')).toHaveTextContent('bold');
    expect(viewer.element.querySelector('script')).toBeNull();
    expect(viewer.element.querySelector('img')).toBeNull();
    viewer.update({ allowImages: true });
    expect(viewer.element.querySelector('article img')).toHaveAttribute(
      'src',
      'https://example.test/p.png',
    );
    viewer.destroy();
    host.remove();
  });

  it('hands a clicked link to onNavigate, and otherwise leaves it to open in a new window', async () => {
    const onNavigate = vi.fn();
    const { host, viewer } = open({});
    await vi.waitFor(() => expect(cards(viewer).length).toBeGreaterThan(0));
    const anchor = viewer.element.querySelector('article a');
    expect(anchor).toHaveAttribute('target', '_blank');
    const plain = new MouseEvent('click', { bubbles: true, cancelable: true });
    anchor.dispatchEvent(plain);
    expect(plain.defaultPrevented).toBe(false);
    viewer.update({ onNavigate });
    const handled = new MouseEvent('click', { bubbles: true, cancelable: true });
    anchor.dispatchEvent(handled);
    expect(handled.defaultPrevented).toBe(true);
    expect(onNavigate).toHaveBeenCalledWith('https://example.test/1', handled);
    viewer.destroy();
    host.remove();
  });

  it('says when the feed has no entries, and reports a file that is not a feed', async () => {
    const onError = vi.fn();
    const { host, viewer } = open({ source: new Blob([feedOf(0)]) });
    await vi.waitFor(() => expect(viewer.element).toHaveTextContent('This feed has no entries.'));
    viewer.update({ source: new Blob(['not a feed at all']), onError });
    await vi.waitFor(() => expect(onError).toHaveBeenCalledTimes(1));
    expect(viewer.element.querySelector('[role="alert"]')).toHaveTextContent('could not be read');
    viewer.destroy();
    host.remove();
  });
});

describe('<fovea-feed>', () => {
  it('opens a clicked link in a new window unless fovea-navigate is cancelled', async () => {
    const open_ = vi.spyOn(window, 'open').mockReturnValue(null);
    const el = document.createElement('fovea-feed');
    el.source = new Blob([feedOf(1)]);
    document.body.append(el);
    const anchor = await vi.waitFor(() => {
      const found = el.shadowRoot.querySelector('article a');
      if (!found) throw new Error('not yet');
      return found;
    });
    anchor.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
    expect(open_).toHaveBeenCalledWith('https://example.test/1', '_blank', 'noopener,noreferrer');
    el.addEventListener('fovea-navigate', (e) => e.preventDefault());
    anchor.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
    expect(open_).toHaveBeenCalledTimes(1);
    el.remove();
    open_.mockRestore();
  });
});
