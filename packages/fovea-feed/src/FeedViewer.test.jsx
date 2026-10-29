import { describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe } from 'vitest-axe';
import { FeedViewer } from './FeedViewer.jsx';

const file = (xml) => new File([xml], 'feed.rss', { type: 'application/rss+xml' });

const item = (n, extra = '') =>
  `<item><title>Post ${n}</title><link>https://blog.example.com/${n}</link>` +
  `<pubDate>Fri, 24 Oct 2026 10:30:00 GMT</pubDate><description>Body number ${n}${extra}</description></item>`;

const feedOf = (count, head = '') =>
  `<?xml version="1.0"?><rss version="2.0"><channel><title>Dev Blog</title>` +
  `<link>https://blog.example.com/</link><description>News</description>${head}` +
  Array.from({ length: count }, (_, i) => item(i + 1)).join('') +
  `</channel></rss>`;

const RICH = `<?xml version="1.0"?><rss version="2.0" xmlns:content="http://purl.org/rss/1.0/modules/content/" xmlns:media="http://search.yahoo.com/mrss/"><channel>
<title>Rich</title><image><url>https://blog.example.com/logo.png</url></image>
<item><title>Story</title><link>https://blog.example.com/s</link><author>me@x.com (Ada)</author>
<category>Code</category>
<content:encoded><![CDATA[<p>Read <a href="https://e.com/x">this</a> <b>now</b>.</p><img src="https://e.com/p.png" alt="pic"><script>x()</script>]]></content:encoded>
<enclosure url="https://blog.example.com/a.mp3" type="audio/mpeg" length="2048"/>
<media:thumbnail url="https://blog.example.com/t.png"/></item></channel></rss>`;

describe('FeedViewer', () => {
  it('shows the feed, its details and each entry, and has no accessibility violations', async () => {
    const { container } = render(<FeedViewer source={file(feedOf(2))} />);
    expect(await screen.findByRole('heading', { level: 2, name: 'Dev Blog' })).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Feed' })).toBeInTheDocument();
    expect(screen.getByText('News')).toBeInTheDocument();
    expect(screen.getByText('2 entries')).toBeInTheDocument();
    expect(screen.getByText('RSS')).toBeInTheDocument();
    expect(screen.getAllByRole('article')).toHaveLength(2);
    expect(screen.getByRole('heading', { level: 3, name: 'Post 1' })).toBeInTheDocument();
    expect(screen.getByText('Body number 2')).toBeInTheDocument();
    expect(await axe(container)).toHaveNoViolations();
  });

  it('opens links in a new window, only for web addresses', async () => {
    const xml = feedOf(1).replace('https://blog.example.com/1', 'javascript:alert(1)');
    const { rerender } = render(<FeedViewer source={file(feedOf(1))} />);
    const link = await screen.findByRole('link', { name: 'Post 1' });
    expect(link).toHaveAttribute('href', 'https://blog.example.com/1');
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('rel', 'noopener noreferrer');
    rerender(<FeedViewer source={file(xml)} />);
    expect(await screen.findByRole('heading', { level: 3, name: 'Post 1' })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Post 1' })).toBeNull();
  });

  it('hands a clicked link to onNavigate instead of opening it', async () => {
    const onNavigate = vi.fn();
    render(<FeedViewer source={file(feedOf(1))} onNavigate={onNavigate} />);
    await userEvent.click(await screen.findByRole('link', { name: 'Post 1' }));
    expect(onNavigate).toHaveBeenCalledWith('https://blog.example.com/1', expect.any(MouseEvent));
  });

  it('shows a feed with no entries', async () => {
    render(<FeedViewer source={file(feedOf(0))} />);
    expect(await screen.findByText('This feed has no entries.')).toBeInTheDocument();
    expect(screen.getByText('0 entries')).toBeInTheDocument();
  });

  it('says a single entry is not plural', async () => {
    render(<FeedViewer source={file(feedOf(1))} />);
    expect(await screen.findByText('1 entry')).toBeInTheDocument();
  });

  it('calls onReady with the entry count and format', async () => {
    const onReady = vi.fn();
    render(<FeedViewer source={file(feedOf(3))} onReady={onReady} />);
    await waitFor(() => expect(onReady).toHaveBeenCalledWith({ entryCount: 3, format: 'rss' }));
  });

  it('applies a theme as custom properties', async () => {
    render(<FeedViewer source={file(feedOf(1))} theme="dark" />);
    const region = await screen.findByRole('region');
    expect(region.style.getPropertyValue('--fovea-background')).toBe('#1e1e1e');
  });
});

describe('errors', () => {
  it('shows an alert and calls onError when the file is not a feed', async () => {
    const onError = vi.fn();
    render(<FeedViewer source={file('<html><body/></html>')} onError={onError} />);
    expect(await screen.findByRole('alert')).toHaveTextContent('not an RSS or Atom feed');
    await waitFor(() => expect(onError).toHaveBeenCalled());
  });

  it('shows an alert for text that is not well-formed', async () => {
    render(<FeedViewer source={file('<rss><channel>')} />);
    expect(await screen.findByRole('alert')).toHaveTextContent('well-formed');
  });

  it('shows an alert when the file cannot be loaded', async () => {
    const onError = vi.fn();
    const fetcher = () => Promise.resolve(new Response('', { status: 404 }));
    render(<FeedViewer source="/missing.rss" fetcher={fetcher} onError={onError} />);
    expect(await screen.findByRole('alert')).toHaveTextContent('404');
    await waitFor(() => expect(onError).toHaveBeenCalled());
  });
});

describe('entries a page at a time', () => {
  it('shows a page, then more when asked', async () => {
    render(<FeedViewer source={file(feedOf(7))} pageSize={3} />);
    await screen.findByText('Showing 3 of 7 entries');
    expect(screen.getAllByRole('article')).toHaveLength(3);
    await userEvent.click(screen.getByRole('button', { name: 'Show 3 more' }));
    expect(screen.getAllByRole('article')).toHaveLength(6);
    await userEvent.click(screen.getByRole('button', { name: 'Show 1 more' }));
    expect(screen.getAllByRole('article')).toHaveLength(7);
    expect(screen.queryByRole('button')).toBeNull();
    expect(screen.getByText('Showing 7 of 7 entries')).toBeInTheDocument();
  });

  it('has no button when everything fits on a page', async () => {
    render(<FeedViewer source={file(feedOf(3))} pageSize={3} />);
    await screen.findAllByRole('article');
    expect(screen.queryByRole('button')).toBeNull();
    expect(screen.queryByText(/Showing/)).toBeNull();
  });

  it('starts again at the first page for a new feed', async () => {
    const { rerender } = render(<FeedViewer source={file(feedOf(7))} pageSize={3} />);
    await userEvent.click(await screen.findByRole('button', { name: 'Show 3 more' }));
    expect(screen.getAllByRole('article')).toHaveLength(6);
    rerender(<FeedViewer source={file(feedOf(8))} pageSize={3} />);
    await screen.findByText('Showing 3 of 8 entries');
  });
});

describe('plain text and rich text', () => {
  it('shows entries as text, without their markup, by default', async () => {
    const { container } = render(<FeedViewer source={file(RICH)} />);
    expect(await screen.findByText('Read this now.')).toBeInTheDocument();
    expect(container.querySelector('article a[href="https://e.com/x"]')).toBeNull();
    expect(container.querySelector('article b')).toBeNull();
    expect(container.querySelector('script')).toBeNull();
    expect(screen.getByText('Ada')).toBeInTheDocument();
    expect(screen.getByRole('list', { name: 'Categories' })).toHaveTextContent('Code');
  });

  it('shows the cleaned HTML of entries with richText, links opening in a new window', async () => {
    const { container } = render(<FeedViewer source={file(RICH)} richText />);
    const link = await screen.findByRole('link', { name: 'this' });
    expect(link).toHaveAttribute('href', 'https://e.com/x');
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('rel', 'noopener noreferrer');
    expect(container.querySelector('article b')).toHaveTextContent('now');
    expect(container.querySelector('script')).toBeNull();
    expect(container.querySelector('article img')).toBeNull();
  });

  it('removes a script and event handlers from rich text', async () => {
    const xml = `<rss><channel><title>t</title><item><title>x</title><description><![CDATA[<p onclick="x()">hi<img src=x onerror="x()"></p><iframe src="https://e.com"></iframe>]]></description></item></channel></rss>`;
    const { container } = render(<FeedViewer source={file(xml)} richText allowImages />);
    await screen.findByText('hi');
    expect(container.querySelector('[onclick], [onerror], iframe')).toBeNull();
    expect(container.querySelector('article img')).toBeNull();
  });
});

describe('pictures', () => {
  it('shows no picture by default', async () => {
    const { container } = render(<FeedViewer source={file(RICH)} richText />);
    await screen.findByText('Story');
    expect(container.querySelector('img')).toBeNull();
  });

  it('shows the logo, the entry picture and the pictures in the text with allowImages', async () => {
    const { container } = render(<FeedViewer source={file(RICH)} richText allowImages />);
    await screen.findByText('Story');
    const sources = [...container.querySelectorAll('img')].map((img) => img.getAttribute('src'));
    expect(sources).toEqual(
      expect.arrayContaining([
        'https://blog.example.com/logo.png',
        'https://blog.example.com/t.png',
        'https://e.com/p.png',
      ]),
    );
    for (const img of container.querySelectorAll('img')) {
      expect(img.getAttribute('referrerpolicy') ?? img.referrerPolicy).toBe('no-referrer');
    }
  });

  it('only loads a picture from a web address', async () => {
    const xml = RICH.replace('https://blog.example.com/t.png', 'file:///c/secret.png');
    const { container } = render(<FeedViewer source={file(xml)} allowImages />);
    await screen.findByText('Story');
    expect(container.querySelector('img[src^="file:"]')).toBeNull();
  });
});

describe('attachments', () => {
  it('lists an attachment as a link with its type and size, and loads nothing', async () => {
    const { container } = render(<FeedViewer source={file(RICH)} />);
    const list = await screen.findByRole('list', { name: 'Attachments' });
    expect(within(list).getByRole('link', { name: 'a.mp3' })).toHaveAttribute(
      'href',
      'https://blog.example.com/a.mp3',
    );
    expect(list).toHaveTextContent('(audio/mpeg, 2.0 KB)');
    expect(container.querySelector('audio, video, embed, object')).toBeNull();
  });
});

describe('search target', () => {
  it('outlines the entry the words are in, marks them and says which entry', async () => {
    const onLocated = vi.fn();
    render(
      <FeedViewer
        source={file(feedOf(5))}
        target={{ matched: 'number 3' }}
        onLocated={onLocated}
      />,
    );
    const mark = await screen.findByText('number 3', { selector: 'mark' });
    expect(mark.closest('article')).toHaveAttribute('aria-current', 'true');
    expect(
      screen.getAllByRole('article').filter((a) => a.hasAttribute('aria-current')),
    ).toHaveLength(1);
    await waitFor(() => expect(onLocated).toHaveBeenCalledWith(3));
  });

  it('chooses the entry whose surroundings agree', async () => {
    const xml = feedOf(0).replace(
      '</channel>',
      `${item(1, ' apples and fish')}${item(2, ' oranges and fish')}</channel>`,
    );
    const onLocated = vi.fn();
    render(
      <FeedViewer
        source={file(xml)}
        target={{ before: 'oranges and', matched: 'fish' }}
        onLocated={onLocated}
      />,
    );
    await waitFor(() => expect(onLocated).toHaveBeenCalledWith(2));
  });

  it('shows as many entries as it takes to reach the one with the words', async () => {
    const onLocated = vi.fn();
    render(
      <FeedViewer
        source={file(feedOf(9))}
        pageSize={3}
        target={{ matched: 'number 8' }}
        onLocated={onLocated}
      />,
    );
    expect(await screen.findByText('number 8', { selector: 'mark' })).toBeInTheDocument();
    expect(screen.getAllByRole('article')).toHaveLength(8);
    await waitFor(() => expect(onLocated).toHaveBeenCalledWith(8));
  });

  it('says null when the words are in no entry, and marks nothing', async () => {
    const onLocated = vi.fn();
    const { container } = render(
      <FeedViewer
        source={file(feedOf(3))}
        target={{ matched: 'absent words' }}
        onLocated={onLocated}
      />,
    );
    await screen.findAllByRole('article');
    await waitFor(() => expect(onLocated).toHaveBeenCalledWith(null));
    expect(container.querySelector('mark')).toBeNull();
  });

  it('moves when the target moves, and clears with no target', async () => {
    const source = file(feedOf(4));
    const { container, rerender } = render(
      <FeedViewer source={source} target={{ matched: 'number 1' }} />,
    );
    await screen.findByText('number 1', { selector: 'mark' });
    rerender(<FeedViewer source={source} target={{ matched: 'number 4' }} />);
    await screen.findByText('number 4', { selector: 'mark' });
    expect(container.querySelectorAll('mark')).toHaveLength(1);
    rerender(<FeedViewer source={source} />);
    await waitFor(() => expect(container.querySelector('mark')).toBeNull());
  });

  it('marks the words in rich text too', async () => {
    const { container } = render(
      <FeedViewer source={file(RICH)} richText target={{ matched: 'this now' }} />,
    );
    await waitFor(() => expect(container.querySelectorAll('mark').length).toBeGreaterThan(0));
    expect([...container.querySelectorAll('mark')].map((m) => m.textContent).join('')).toBe(
      'this now',
    );
  });
});
