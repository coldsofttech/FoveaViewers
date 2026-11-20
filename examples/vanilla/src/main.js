// Web Components: importing a viewer's `/element` registers its tag.
import '@coldsofttech/fovea-text/element';
import '@coldsofttech/fovea-image/element';
// <fovea-viewer> opens any file the viewers can, and loads the matching viewer when it is needed.
import '@coldsofttech/fovea-viewers/element';

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

// One <fovea-viewer> for each sample: the viewer for each is chosen from the file name. PDF, Excel,
// Word and PowerPoint files load their (large) libraries only when one of them is opened.
const SAMPLES = [
  'txt',
  'md',
  'csv',
  'js',
  'rss',
  'html',
  'eml',
  'png',
  'pdf',
  'xlsx',
  'docx',
  'pptx',
];
const auto = document.getElementById('auto');
for (const extension of SAMPLES) {
  const frame = document.createElement('div');
  frame.className = 'frame';
  const element = document.createElement('fovea-viewer');
  element.id = `auto-${extension}`;
  element.setAttribute('src', `/samples/sample.${extension}`);
  element.setAttribute('label', `Sample ${extension}`);
  frame.append(element);
  auto.append(frame);
}
