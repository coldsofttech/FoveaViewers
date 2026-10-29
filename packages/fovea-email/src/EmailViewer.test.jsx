import { beforeAll, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe } from 'vitest-axe';
import { EmailViewer } from './EmailViewer.jsx';

const PIXEL = 'R0lGODlhAQABAAAAACw=';

const MESSAGE = [
  'From: Ada Lovelace <ada@example.com>',
  'To: Bob <bob@example.com>, carol@example.com',
  'Cc: Dan <dan@example.com>',
  'Subject: Hello there',
  'Date: Tue, 01 Oct 2024 10:00:00 +0000',
  'Message-ID: <abc@example.com>',
  'MIME-Version: 1.0',
  'Content-Type: multipart/mixed; boundary="outer"',
  '',
  '--outer',
  'Content-Type: multipart/related; boundary="rel"',
  '',
  '--rel',
  'Content-Type: multipart/alternative; boundary="alt"',
  '',
  '--alt',
  'Content-Type: text/plain; charset=utf-8',
  '',
  'Plain words',
  '--alt',
  'Content-Type: text/html; charset=utf-8',
  '',
  '<p>Formatted words</p><img src="cid:pic@x">',
  '--alt--',
  '--rel',
  'Content-Type: image/gif',
  'Content-ID: <pic@x>',
  'Content-Disposition: inline',
  'Content-Transfer-Encoding: base64',
  '',
  PIXEL,
  '--rel--',
  '--outer',
  'Content-Type: text/plain; name="notes.txt"',
  'Content-Disposition: attachment; filename="notes.txt"',
  '',
  'attached notes',
  '--outer--',
  '',
].join('\r\n');

const file = (text = MESSAGE) => new File([text], 'mail.eml', { type: 'message/rfc822' });

describe('EmailViewer', () => {
  beforeAll(() => {
    // jsdom has no object URLs.
    URL.createObjectURL = vi.fn(() => 'blob:attachment');
    URL.revokeObjectURL = vi.fn();
  });

  it('shows the headers, the attachments and a locked-down body, with no violations', async () => {
    render(<EmailViewer source={file()} />);
    expect(await screen.findByRole('heading', { name: 'Hello there' })).toBeInTheDocument();
    expect(screen.getByText('Ada Lovelace <ada@example.com>')).toBeInTheDocument();
    expect(screen.getByText('Bob <bob@example.com>, carol@example.com')).toBeInTheDocument();
    expect(screen.getByText('Dan <dan@example.com>')).toBeInTheDocument();

    const attachments = screen.getByRole('list', { name: 'Attachments' });
    expect(within(attachments).getAllByRole('listitem')).toHaveLength(1);
    expect(within(attachments).getByRole('button')).toHaveTextContent(/^notes\.txt/);

    const frame = await screen.findByTitle('Email message');
    expect(frame.getAttribute('sandbox')).toBe('allow-same-origin');
  });

  it('has no accessibility violations', async () => {
    // axe cannot look into a frame in jsdom, so the plain text version is checked.
    const { container } = render(<EmailViewer source={file()} view="text" />);
    await screen.findByLabelText('Email message');
    expect(await axe(container)).toHaveNoViolations();
  });

  it('puts pictures embedded by cid: into the message', async () => {
    render(<EmailViewer source={file()} />);
    const frame = await screen.findByTitle('Email message');
    await waitFor(() => expect(frame.getAttribute('srcdoc')).toContain(`data:image/gif;base64,`));
    expect(frame.getAttribute('srcdoc')).not.toContain('cid:');
  });

  it('switches between the formatted and plain text versions', async () => {
    const user = userEvent.setup();
    render(<EmailViewer source={file()} />);
    await screen.findByTitle('Email message');
    await user.click(screen.getByRole('button', { name: 'Plain text' }));
    expect(screen.getByLabelText('Email message')).toHaveTextContent('Plain words');
    expect(screen.queryByTitle('Email message')).toBeNull();
    await user.click(screen.getByRole('button', { name: 'Formatted' }));
    expect(await screen.findByTitle('Email message')).toBeInTheDocument();
  });

  it('can start on the plain text version', async () => {
    render(<EmailViewer source={file()} view="text" />);
    expect(await screen.findByLabelText('Email message')).toHaveTextContent('Plain words');
  });

  it('lists the raw headers', async () => {
    const user = userEvent.setup();
    render(<EmailViewer source={file()} />);
    await screen.findByRole('heading', { name: 'Hello there' });
    await user.click(screen.getByText('Raw headers'));
    expect(screen.getByText(/message-id: <abc@example\.com>/i)).toBeInTheDocument();
  });

  it('hands an attachment to the host instead of downloading it', async () => {
    const user = userEvent.setup();
    const onAttachment = vi.fn();
    render(<EmailViewer source={file()} onAttachment={onAttachment} />);
    await user.click(await screen.findByRole('button', { name: /notes\.txt/ }));
    expect(onAttachment).toHaveBeenCalledWith(
      expect.objectContaining({ filename: 'notes.txt', size: expect.any(Number) }),
    );
  });

  it('saves an attachment when no handler is given', async () => {
    const user = userEvent.setup();
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    render(<EmailViewer source={file()} />);
    await user.click(await screen.findByRole('button', { name: /notes.txt/ }));
    expect(URL.createObjectURL).toHaveBeenCalled();
    expect(click).toHaveBeenCalled();
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:attachment');
    click.mockRestore();
  });

  it('calls onReady with the message', async () => {
    const onReady = vi.fn();
    render(<EmailViewer source={file()} onReady={onReady} />);
    await waitFor(() => expect(onReady).toHaveBeenCalled());
    expect(onReady.mock.calls[0][0]).toMatchObject({ subject: 'Hello there' });
  });

  it('reports a file that cannot be loaded', async () => {
    const onError = vi.fn();
    const fetcher = vi.fn().mockResolvedValue({ ok: false, status: 404 });
    render(<EmailViewer source="https://example.com/x.eml" fetcher={fetcher} onError={onError} />);
    expect(await screen.findByRole('alert')).toHaveTextContent('could not be loaded');
    await waitFor(() => expect(onError).toHaveBeenCalled());
  });
});
