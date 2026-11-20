import { StrictMode, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { TextViewer, LineViewer } from '@coldsofttech/fovea-text';
import { ImageViewer } from '@coldsofttech/fovea-image';
import '@coldsofttech/fovea-text/style.css';
import '@coldsofttech/fovea-image/style.css';

const lines = Array.from({ length: 50_000 }, (_, i) => `line ${i + 1} some words here`);
const big = new Blob([lines.join('\n')]);
window.events = [];

function App() {
  const [theme, setTheme] = useState(undefined);
  return (
    <>
      <button id="theme" onClick={() => setTheme(theme ? undefined : 'dark')}>
        theme
      </button>
      <div style={{ height: 300 }} id="text">
        <TextViewer
          source={big}
          theme={theme}
          target={{ line: 25000, column: 6, length: 5 }}
          onReady={(i) => window.events.push(['text', i.lineCount])}
        />
      </div>
      <div style={{ height: 300 }} id="lines">
        <LineViewer lines={lines} tokens={(t) => [[null, t]]} />
      </div>
      <div style={{ height: 300 }} id="image">
        <ImageViewer
          source="/sample.png"
          theme={theme}
          onReady={(i) => window.events.push(['image', i.width])}
        />
      </div>
    </>
  );
}

// Development builds run effects twice in StrictMode; production builds do not. Both must work.
createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
