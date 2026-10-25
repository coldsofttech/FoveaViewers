import { StrictMode, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { Viewer } from '@coldsofttech/fovea-viewers';
import '@coldsofttech/fovea-text/style.css';

const SAMPLE = new File(
  Array.from(
    { length: 2000 },
    (_, i) => `Line ${i + 1}: the quick brown fox jumps over the lazy dog\n`,
  ),
  'sample.txt',
  { type: 'text/plain' },
);

function Demo() {
  const [source, setSource] = useState(SAMPLE);
  const [theme, setTheme] = useState('light');

  return (
    <main style={{ display: 'grid', gridTemplateRows: 'auto 1fr', height: '100vh', gap: 12 }}>
      <form onSubmit={(event) => event.preventDefault()}>
        <label>
          Open a file{' '}
          <input type="file" onChange={(event) => setSource(event.target.files?.[0] ?? SAMPLE)} />
        </label>{' '}
        <label>
          Theme{' '}
          <select value={theme} onChange={(event) => setTheme(event.target.value)}>
            <option value="light">Light</option>
            <option value="dark">Dark</option>
          </select>
        </label>
      </form>
      <Viewer source={source} theme={theme} label="File preview" />
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
