import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { ExampleComponent } from '@scope/example-react-package';
import '@scope/example-react-package/style.css';

const root = document.getElementById('root');
if (root) {
  createRoot(root).render(
    <StrictMode>
      <ExampleComponent name="World" />
    </StrictMode>,
  );
}
