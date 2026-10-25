import { StrictMode, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { Viewer } from '@coldsofttech/fovea-viewers';
import '@coldsofttech/fovea-markdown/style.css';
import '@coldsofttech/fovea-text/style.css';

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
];
const urlOf = (name) => `${import.meta.env.BASE_URL}samples/${name}`;

function Demo() {
  const [sample, setSample] = useState(SAMPLES[0]);
  const [upload, setUpload] = useState(null);
  const [theme, setTheme] = useState('light');
  const [pictures, setPictures] = useState(true);
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
        </label>
      </form>
      <Viewer source={source} theme={theme} allowImages={pictures} label="File preview" />
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
