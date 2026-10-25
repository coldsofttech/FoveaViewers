import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { resolve } from '@coldsofttech/fovea-viewers';

const root = document.getElementById('root');
if (root) {
  createRoot(root).render(
    <StrictMode>
      <p>Fovea Viewers demo. Resolves report.pdf to: {resolve('report.pdf')}</p>
    </StrictMode>,
  );
}
