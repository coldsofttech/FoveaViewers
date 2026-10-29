import { StrictMode, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { Viewer } from '@coldsofttech/fovea-viewers';
import '@coldsofttech/fovea-email/style.css';
import '@coldsofttech/fovea-excel/style.css';
import '@coldsofttech/fovea-feed/style.css';
import '@coldsofttech/fovea-html/style.css';
import '@coldsofttech/fovea-image/style.css';
import '@coldsofttech/fovea-markdown/style.css';
import '@coldsofttech/fovea-pdf/style.css';
import '@coldsofttech/fovea-powerpoint/style.css';
import '@coldsofttech/fovea-table/style.css';
import '@coldsofttech/fovea-text/style.css';
import '@coldsofttech/fovea-word/style.css';

// The sample files live in public/samples and are loaded by URL.
const SAMPLES = [
  'sample.md',
  'sample.txt',
  'sample.log',
  'sample.js',
  'sample.py',
  'sample.cpp',
  'sample.json',
  'sample.yaml',
  'sample.html',
  'sample.rss',
  'sample.atom',
  'sample.csv',
  'sample.tsv',
  'sample.png',
  'sample.svg',
  'sample.pdf',
  'sample.eml',
  'sample.xlsx',
  'sample.docx',
  'sample.pptx',
];
const urlOf = (name) => `${import.meta.env.BASE_URL}samples/${name}`;

function Demo() {
  const [sample, setSample] = useState(SAMPLES[0]);
  const [upload, setUpload] = useState(null);
  const [theme, setTheme] = useState('light');
  const [pictures, setPictures] = useState(true);
  const [scripts, setScripts] = useState(false);
  const [links, setLinks] = useState('none');
  const [rich, setRich] = useState(false);
  const [formulas, setFormulas] = useState(false);
  const source = upload ?? urlOf(sample);

  return (
    <main style={{ display: 'grid', gridTemplateRows: 'auto 1fr', height: '100vh', gap: 12 }}>
      <form onSubmit={(event) => event.preventDefault()}>
        <label>
          Sample{' '}
          <select
            value={sample}
            onChange={(event) => {
              setSample(event.target.value);
              setUpload(null);
            }}
          >
            {SAMPLES.map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </select>
        </label>{' '}
        <label>
          or open a file{' '}
          <input type="file" onChange={(event) => setUpload(event.target.files?.[0] ?? null)} />
        </label>{' '}
        <label>
          Theme{' '}
          <select value={theme} onChange={(event) => setTheme(event.target.value)}>
            <option value="light">Light</option>
            <option value="dark">Dark</option>
          </select>
        </label>{' '}
        <label>
          <input
            type="checkbox"
            checked={pictures}
            onChange={(event) => setPictures(event.target.checked)}
          />{' '}
          Show pictures
        </label>{' '}
        <label>
          <input
            type="checkbox"
            checked={scripts}
            onChange={(event) => setScripts(event.target.checked)}
          />{' '}
          Run scripts (HTML)
        </label>{' '}
        <label>
          <input
            type="checkbox"
            checked={rich}
            onChange={(event) => setRich(event.target.checked)}
          />{' '}
          Rich text (feeds)
        </label>{' '}
        <label>
          <input
            type="checkbox"
            checked={formulas}
            onChange={(event) => setFormulas(event.target.checked)}
          />{' '}
          Formulas (Excel)
        </label>{' '}
        <label>
          Links (HTML){' '}
          <select value={links} onChange={(event) => setLinks(event.target.value)}>
            <option value="none">Do nothing</option>
            <option value="viewer">Open in the viewer</option>
            <option value="window">Open in a new window</option>
          </select>
        </label>
      </form>
      <Viewer
        source={source}
        theme={theme}
        allowImages={pictures}
        allowStyles={pictures}
        allowScripts={scripts}
        links={links}
        richText={rich}
        showFormulas={formulas}
        pageSize={5}
        label="File preview"
      />
    </main>
  );
}

const root = document.getElementById('root');
if (root) {
  createRoot(root).render(
    <StrictMode>
      <Demo />
    </StrictMode>,
  );
}
