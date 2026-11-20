import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { describeConformance } from '../../../test-support/conformance.js';
import {
  elementAdapter,
  reactComponentAdapter,
  vanillaAdapter,
} from '../../../test-support/adapters.jsx';
import { EmailViewer } from './EmailViewer.jsx';
import { defineEmailElement } from './element.js';
import { createEmailViewer } from './vanilla/index.js';

const PLAIN = [
  'From: Ada <ada@example.test>',
  'To: bob@example.test',
  'Subject: Hello there',
  'Date: Tue, 01 Oct 2024 10:00:00 +0000',
  'MIME-Version: 1.0',
  'Content-Type: text/plain; charset=utf-8',
  '',
  'Plain words',
].join('\r\n');

const BOTH = [
  'From: Ada <ada@example.test>',
  'Subject: Both',
  'MIME-Version: 1.0',
  'Content-Type: multipart/mixed; boundary="outer"',
  '',
  '--outer',
  'Content-Type: multipart/alternative; boundary="alt"',
  '',
  '--alt',
  'Content-Type: text/plain',
  '',
  'Plain words',
  '--alt',
  'Content-Type: text/html',
  '',
  '<p>Formatted words</p>',
  '--alt--',
  '--outer',
  'Content-Type: text/plain; name="notes.txt"',
  'Content-Disposition: attachment; filename="notes.txt"',
  '',
  'attached text',
  '--outer--',
].join('\r\n');

beforeEach(() => {
  URL.createObjectURL = vi.fn(() => 'blob:attachment');
  URL.revokeObjectURL = vi.fn();
});
afterEach(() => vi.restoreAllMocks());

describeConformance('email', {
  text: PLAIN,
  // The message is drawn on the page's own colours or white, whatever the theme around it.
  hasTheme: false,
  shows: (root) => {
    expect(root.querySelector('h2')).toHaveTextContent('Hello there');
    expect(root.querySelector('pre[tabindex]')).toHaveTextContent('Plain words');
  },
  adapters: [
    vanillaAdapter(createEmailViewer),
    elementAdapter('fovea-email', defineEmailElement),
    reactComponentAdapter(EmailViewer),
  ],
});

describe('createEmailViewer', () => {
  const open = (props) => {
    const host = document.createElement('div');
    document.body.append(host);
    return { host, viewer: createEmailViewer(host, { source: new Blob([BOTH]), ...props }) };
  };

  it('offers both versions, shows the one asked for first and switches on a click', async () => {
    const { host, viewer } = open({ view: 'text' });
    await vi.waitFor(() =>
      expect(viewer.element.querySelector('pre[tabindex]')).toHaveTextContent('Plain words'),
    );
    const [formatted, plain] = viewer.element.querySelectorAll('[role="group"] button');
    expect(plain).toHaveAttribute('aria-pressed', 'true');
    expect(formatted).toHaveAttribute('aria-pressed', 'false');
    formatted.click();
    expect(viewer.element.querySelector('iframe')).not.toBeNull();
    expect(viewer.element.querySelector('pre[tabindex]')).toBeNull();
    expect(formatted).toHaveAttribute('aria-pressed', 'true');
    plain.click();
    expect(viewer.element.querySelector('iframe')).toBeNull();
    expect(viewer.element.querySelector('pre[tabindex]')).toHaveTextContent('Plain words');
    viewer.destroy();
    host.remove();
  });

  it('keeps the frame, not a new one, when a prop that does not touch it changes', async () => {
    const { host, viewer } = open({});
    await vi.waitFor(() => expect(viewer.element.querySelector('iframe')).not.toBeNull());
    const frame = viewer.element.querySelector('iframe');
    viewer.update({ label: 'Message' });
    expect(viewer.element.querySelector('iframe')).toBe(frame);
    expect(frame).toHaveAttribute('title', 'Message');
    viewer.destroy();
    host.remove();
  });

  it('lists an attachment, saves it on a click, or hands it to onAttachment', async () => {
    const onAttachment = vi.fn();
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    const { host, viewer } = open({});
    await vi.waitFor(() =>
      expect(viewer.element.querySelector('[aria-label="Attachments"] button')).not.toBeNull(),
    );
    const button = viewer.element.querySelector('[aria-label="Attachments"] button');
    expect(button).toHaveTextContent(/notes\.txt \(\d+ B\)/);
    button.click();
    expect(click).toHaveBeenCalledTimes(1);
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:attachment');
    viewer.update({ onAttachment });
    button.click();
    expect(onAttachment).toHaveBeenCalledWith(expect.objectContaining({ filename: 'notes.txt' }));
    expect(click).toHaveBeenCalledTimes(1);
    viewer.destroy();
    host.remove();
  });

  it('says when a message has no content', async () => {
    const { host, viewer } = open({ source: new Blob(['Subject: Empty\r\n\r\n']) });
    await vi.waitFor(() => expect(viewer.element.querySelector('h2')).toHaveTextContent('Empty'));
    viewer.destroy();
    host.remove();
  });
});

describe('<fovea-email>', () => {
  it('downloads an attachment unless fovea-attachment is cancelled', async () => {
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    const el = document.createElement('fovea-email');
    el.source = new Blob([BOTH]);
    document.body.append(el);
    const button = await vi.waitFor(() => {
      const found = el.shadowRoot.querySelector('[aria-label="Attachments"] button');
      if (!found) throw new Error('not yet');
      return found;
    });
    button.click();
    expect(click).toHaveBeenCalledTimes(1);
    el.addEventListener('fovea-attachment', (e) => {
      expect(e.detail.filename).toBe('notes.txt');
      e.preventDefault();
    });
    button.click();
    expect(click).toHaveBeenCalledTimes(1);
    el.remove();
  });

  it('reports the message in fovea-ready', async () => {
    const ready = vi.fn();
    const el = document.createElement('fovea-email');
    el.addEventListener('fovea-ready', (e) => ready(e.detail.subject));
    el.source = new Blob([PLAIN]);
    document.body.append(el);
    await vi.waitFor(() => expect(ready).toHaveBeenCalledWith('Hello there'));
    el.remove();
  });
});
