import { describe, expect, it } from 'vitest';
import { parseFeed } from './parseFeed.js';
import { htmlToText, looksLikeHtml, tidy } from './text.js';

const RSS = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom" xmlns:dc="http://purl.org/dc/elements/1.1/"
     xmlns:content="http://purl.org/rss/1.0/modules/content/" xmlns:media="http://search.yahoo.com/mrss/">
  <channel>
    <title>Dev Blog</title>
    <link>https://blog.example.com/</link>
    <atom:link href="https://blog.example.com/feed.xml" rel="self" type="application/rss+xml"/>
    <description>News &amp; notes</description>
    <language>en-gb</language>
    <lastBuildDate>Sat, 25 Oct 2026 08:00:00 GMT</lastBuildDate>
    <generator>Hand written</generator>
    <copyright>2026 Example</copyright>
    <image><url>https://blog.example.com/logo.png</url><title>Logo</title></image>
    <item>
      <title>First post</title>
      <link>https://blog.example.com/first</link>
      <guid isPermaLink="false">abc-1</guid>
      <pubDate>Fri, 24 Oct 2026 10:30:00 GMT</pubDate>
      <author>ada@example.com (Ada Lovelace)</author>
      <category>Code</category><category>News</category>
      <description><![CDATA[<p>Hello <b>world</b>.</p><p>Second&nbsp;paragraph<br>with a break.</p><script>x()</script>]]></description>
      <content:encoded><![CDATA[<p>Full <a href="https://e.com">story</a>.</p>]]></content:encoded>
      <enclosure url="https://blog.example.com/a.mp3" type="audio/mpeg" length="1234"/>
      <media:thumbnail url="https://blog.example.com/t.png"/>
    </item>
    <item>
      <title>Second post</title>
      <guid>https://blog.example.com/second</guid>
      <dc:creator>Grace</dc:creator>
      <dc:date>2026-10-23T09:00:00Z</dc:date>
      <description>Just plain text.</description>
    </item>
  </channel>
</rss>`;

const RDF = `<?xml version="1.0"?>
<rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#" xmlns="http://purl.org/rss/1.0/" xmlns:dc="http://purl.org/dc/elements/1.1/">
  <channel rdf:about="https://old.example.com/"><title>Old Feed</title><link>https://old.example.com/</link><description>RSS one</description><dc:date>2026-01-02T00:00:00Z</dc:date></channel>
  <item rdf:about="https://old.example.com/1"><title>Entry one</title><link>https://old.example.com/1</link><description>Body one</description><dc:creator>Linus</dc:creator><dc:subject>Kernel</dc:subject></item>
</rdf:RDF>`;

const ATOM = `<?xml version="1.0" encoding="utf-8"?>
<feed xmlns="http://www.w3.org/2005/Atom" xml:lang="fr" xmlns:media="http://search.yahoo.com/mrss/">
  <title>Journal</title>
  <subtitle>Notes de terrain</subtitle>
  <link rel="self" href="https://j.example.com/atom.xml"/>
  <link href="https://j.example.com/"/>
  <updated>2026-10-25T08:00:00Z</updated>
  <generator>Hugo</generator>
  <rights>Example</rights>
  <logo>https://j.example.com/logo.png</logo>
  <entry>
    <title type="html">Bonjour &lt;em&gt;monde&lt;/em&gt;</title>
    <link rel="alternate" href="https://j.example.com/1"/>
    <link rel="enclosure" href="https://j.example.com/1.pdf" type="application/pdf" length="99"/>
    <published>2026-10-24T10:00:00Z</published>
    <updated>2026-10-25T07:00:00Z</updated>
    <author><name>Ada</name></author><author><name>Grace</name></author>
    <category term="news" label="News"/><category term="code"/>
    <summary>Short</summary>
    <content type="html">&lt;p&gt;Long &lt;b&gt;body&lt;/b&gt;&lt;/p&gt;</content>
    <media:thumbnail url="https://j.example.com/t.png"/>
  </entry>
  <entry>
    <title>Plain</title>
    <link href="https://j.example.com/2"/>
    <updated>not a date</updated>
    <content type="xhtml"><div xmlns="http://www.w3.org/1999/xhtml"><p>One</p><p>Two</p></div></content>
  </entry>
</feed>`;

describe('RSS 2.0', () => {
  const feed = parseFeed(RSS);

  it('reads the feed’s own details', () => {
    expect(feed).toMatchObject({
      format: 'rss',
      title: 'Dev Blog',
      description: 'News & notes',
      link: 'https://blog.example.com/',
      language: 'en-gb',
      generator: 'Hand written',
      copyright: '2026 Example',
      image: 'https://blog.example.com/logo.png',
      updatedIso: '2026-10-25T08:00:00.000Z',
    });
    expect(feed.entries).toHaveLength(2);
  });

  it('reads an entry with its author, date, categories, link and attachments', () => {
    const [entry] = feed.entries;
    expect(entry).toMatchObject({
      title: 'First post',
      author: 'Ada Lovelace',
      published: 'Fri, 24 Oct 2026 10:30:00 GMT',
      publishedIso: '2026-10-24T10:30:00.000Z',
      categories: ['Code', 'News'],
      link: 'https://blog.example.com/first',
      image: 'https://blog.example.com/t.png',
    });
    expect(entry.enclosures).toEqual([
      { href: 'https://blog.example.com/a.mp3', type: 'audio/mpeg', length: 1234 },
    ]);
  });

  it('prefers the full content to the description, and keeps its HTML', () => {
    const [entry] = feed.entries;
    expect(entry.text).toBe('Full story.');
    expect(entry.html).toBe('<p>Full <a href="https://e.com">story</a>.</p>');
  });

  it('reads another entry that has plain text, dc:creator, dc:date and a guid for its link', () => {
    expect(feed.entries[1]).toMatchObject({
      title: 'Second post',
      author: 'Grace',
      text: 'Just plain text.',
      html: null,
      link: 'https://blog.example.com/second',
      publishedIso: '2026-10-23T09:00:00.000Z',
    });
  });

  it('does not take the atom:link of the feed for its address', () => {
    expect(feed.link).toBe('https://blog.example.com/');
  });
});

describe('RSS 1.0', () => {
  it('reads the channel and the items beside it', () => {
    const feed = parseFeed(RDF);
    expect(feed).toMatchObject({ format: 'rdf', title: 'Old Feed', description: 'RSS one' });
    expect(feed.entries).toHaveLength(1);
    expect(feed.entries[0]).toMatchObject({
      title: 'Entry one',
      author: 'Linus',
      categories: ['Kernel'],
      text: 'Body one',
      link: 'https://old.example.com/1',
    });
  });
});

describe('Atom', () => {
  const feed = parseFeed(ATOM);

  it('reads the feed’s own details', () => {
    expect(feed).toMatchObject({
      format: 'atom',
      title: 'Journal',
      description: 'Notes de terrain',
      link: 'https://j.example.com/',
      language: 'fr',
      generator: 'Hugo',
      copyright: 'Example',
      image: 'https://j.example.com/logo.png',
      updatedIso: '2026-10-25T08:00:00.000Z',
    });
  });

  it('reads an entry, with an HTML title and body, two authors and an attachment', () => {
    expect(feed.entries[0]).toMatchObject({
      title: 'Bonjour monde',
      author: 'Ada, Grace',
      categories: ['News', 'code'],
      link: 'https://j.example.com/1',
      text: 'Long body',
      html: '<p>Long <b>body</b></p>',
      image: 'https://j.example.com/t.png',
      publishedIso: '2026-10-24T10:00:00.000Z',
    });
    expect(feed.entries[0].enclosures).toEqual([
      { href: 'https://j.example.com/1.pdf', type: 'application/pdf', length: 99 },
    ]);
  });

  it('reads an xhtml body, a link without a rel and a date it cannot read', () => {
    expect(feed.entries[1]).toMatchObject({
      title: 'Plain',
      link: 'https://j.example.com/2',
      text: 'One\nTwo',
      published: 'not a date',
      publishedIso: null,
    });
    expect(feed.entries[1].html).toContain('<p');
  });
});

describe('parseFeed errors', () => {
  it('rejects text that is not well-formed XML', () => {
    expect(() => parseFeed('<rss><channel><title>x</channel></rss>')).toThrow('well-formed');
    expect(() => parseFeed('just words')).toThrow('well-formed');
  });

  it('rejects XML that is not a feed', () => {
    expect(() => parseFeed('<html><body/></html>')).toThrow('not an RSS or Atom feed');
    expect(() => parseFeed('<rss version="2.0"></rss>')).toThrow('no channel');
  });

  it('accepts a byte order mark and spaces before the declaration', () => {
    expect(parseFeed(`FEFF  \n${RDF}`).title).toBe('Old Feed');
  });

  it('reads a feed with no entries', () => {
    expect(parseFeed('<rss><channel><title>Empty</title></channel></rss>').entries).toEqual([]);
  });
});

describe('text helpers', () => {
  it('turns HTML into text with its paragraphs and breaks kept, and nothing that runs', () => {
    expect(
      htmlToText('<p>One <b>two</b></p><p>Three<br>four</p><script>x()</script><style>p{}</style>'),
    ).toBe('One two\nThree\nfour');
  });

  it('tidies spaces and blank lines', () => {
    expect(tidy('  a   b \n\n\n\n c  ')).toBe('a b\n\nc');
  });

  it('tells HTML from plain text', () => {
    expect(looksLikeHtml('<p>x</p>')).toBe(true);
    expect(looksLikeHtml('a &amp; b')).toBe(true);
    expect(looksLikeHtml('1 < 2 and 3 > 2')).toBe(false);
    expect(looksLikeHtml('plain')).toBe(false);
  });
});
