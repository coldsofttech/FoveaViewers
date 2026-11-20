// Web Components: importing a viewer's `/element` registers its tag.
import '@coldsofttech/fovea-text/element';
import '@coldsofttech/fovea-image/element';

// Plain JavaScript: call the viewer's function with an element, and import its stylesheet.
import { createTextViewer } from '@coldsofttech/fovea-text/vanilla';
import { createImageViewer } from '@coldsofttech/fovea-image/vanilla';
import '@coldsofttech/fovea-text/style.css';
import '@coldsofttech/fovea-image/style.css';

const text = createTextViewer(document.getElementById('text-host'), {
  source: '/samples/sample.txt',
  onReady: ({ lineCount }) => console.log(`text: ${lineCount} lines`),
  onError: (error) => console.error(error),
});
const image = createImageViewer(document.getElementById('image-host'), {
  source: '/samples/sample.png',
  onReady: ({ width, height }) => console.log(`image: ${width} × ${height}`),
});

// The elements tell the page about themselves with events.
for (const id of ['text', 'image']) {
  document
    .getElementById(id)
    .addEventListener('fovea-ready', (event) => console.log(`<fovea-${id}> ready`, event.detail));
}

let dark = false;
document.getElementById('theme').addEventListener('click', () => {
  dark = !dark;
  document.body.classList.toggle('dark', dark);
  // The controllers take a theme prop; the elements also take an attribute or the page's CSS.
  text.update({ theme: dark ? 'dark' : undefined });
  image.update({ theme: dark ? 'dark' : undefined });
  for (const id of ['text', 'image']) {
    const element = document.getElementById(id);
    if (dark) element.setAttribute('theme', 'dark');
    else element.removeAttribute('theme');
  }
});

// A File or Blob goes in the `source` property, which an attribute cannot hold.
document.getElementById('file').addEventListener('change', (event) => {
  const file = event.target.files[0];
  if (!file) return;
  const isImage = file.type.startsWith('image/');
  (isImage ? document.getElementById('image') : document.getElementById('text')).source = file;
  (isImage ? image : text).update({ source: file });
});
