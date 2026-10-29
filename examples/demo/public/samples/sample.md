# Fovea Viewers sample

This file shows what the Markdown viewer can draw. Open it in the demo, switch between the light and dark themes, and scroll to the end to follow the footnote.

## Text formatting

Plain text can be **bold**, _italic_, **_both_**, ~~struck through~~ or written as `inline code`. A line can also hold a [link to the project](https://github.com/coldsofttech/FoveaViewers), which opens in a new window.

> A block quote sits apart from the text around it.
> It can run over several lines.

## Lists

- Apples
- Oranges
  - Blood oranges
  - Navel oranges
- Pears

1. Install the viewer
2. Give it a file
3. Read the result

### Task list

- [x] Read the file
- [x] Draw the headings
- [ ] Highlight code (planned for the code viewer)

## Links

- A web address opens in a new window: [Fovea Viewers on GitHub](https://github.com/coldsofttech/FoveaViewers)
- An email address opens your mail app: [write to the maintainer](mailto:someone@example.com)
- A link inside the page scrolls to its place: [jump to the footnote](#fn1)
- Addresses that could run code are never links, so `javascript:` below is plain text: [not a link](javascript:alert(1))

## Pictures

Pictures are only shown when the viewer is told to allow them, which the demo does with the "Show pictures" box. This one is embedded in the file, so it needs no network:

![The Fovea logo: an eye on a blue background][logo]

With the box unticked, the picture is replaced by its alt text, in brackets.

## Table

| Viewer   | Opens                 | Status    |
| -------- | --------------------- | --------- |
| Text     | `.txt`, `.log`        | Available |
| Markdown | `.md`, `.markdown`    | Available |
| Image    | `.png`, `.jpg`, `.svg` | Planned   |

## Code

```js
import { Viewer } from '@coldsofttech/fovea-viewers';

<Viewer source={file} theme="dark" />;
```

---

## Safe by default

The next line is raw HTML. The viewer shows it as text and never runs it:

<script>alert('this never runs')</script>

<img src="x" onerror="alert('nor does this')">

A picture from an address other than http, https or an embedded image is never loaded, even when pictures are allowed. It shows as its alt text instead: ![A picture over FTP](ftp://example.com/pic.png)

## A long section to scroll through

Each paragraph below is a separate block, so there is enough here to scroll. The viewer draws only the blocks near the screen, which keeps very large files fast.

Paragraph 1. The quick brown fox jumps over the lazy dog. Pack my box with five dozen liquor jugs.

Paragraph 2. The quick brown fox jumps over the lazy dog. Pack my box with five dozen liquor jugs.

Paragraph 3. The quick brown fox jumps over the lazy dog. Pack my box with five dozen liquor jugs.

Paragraph 4. The quick brown fox jumps over the lazy dog. Pack my box with five dozen liquor jugs.

Paragraph 5. The quick brown fox jumps over the lazy dog. Pack my box with five dozen liquor jugs.

Paragraph 6. The quick brown fox jumps over the lazy dog. Pack my box with five dozen liquor jugs.

Paragraph 7. The quick brown fox jumps over the lazy dog. Pack my box with five dozen liquor jugs.

Paragraph 8. The quick brown fox jumps over the lazy dog. Pack my box with five dozen liquor jugs.

Paragraph 9. The quick brown fox jumps over the lazy dog. Pack my box with five dozen liquor jugs.

Paragraph 10. The quick brown fox jumps over the lazy dog. Pack my box with five dozen liquor jugs.

Paragraph 11. The quick brown fox jumps over the lazy dog. Pack my box with five dozen liquor jugs.

Paragraph 12. The quick brown fox jumps over the lazy dog. Pack my box with five dozen liquor jugs.

## Footnotes

Footnotes appear at the end of the file.[^1] Click the number to jump to the note, and the arrow beside the note to come back.

[^1]: This is the footnote. It is drawn at the end of the page, even though it was written anywhere in the file.

[logo]: data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAPAAAABQCAYAAAAnSfh8AAAD10lEQVR42u3d1VZbURCAYd6gRhV3rdtNH6nuhgZ3C1B3w2Ik+Itxs7tmKLDZXQsaVkpyTv6L/w32d7dnJufQzTWj3Vozh+1uS6vaEemO091Vc9TunrSiHZPuOz1YMbl2D6Vl7bj0yOnxsjlh90Ra0k5KT52eLZlTds+lRe209MLp5aI5Y9cgLWh5UqNT04LJt2uWElqB1OLUmjCFdgEprhVJbU7tcVNs1yHNayVSp1PXvCm165ZiWpnU49QbM+V2fVJUq5D6nQaiptJuUIpoVdKQ03DEVNuNSGGtRhp1GgubWrugFNLqpHGniZCpt5uU5rSz0iun13PmnN0baVY7L711ejdrLti9l2a0i9IHp48z5pLdJ2lauyx9dvoyba7YfZWmtKvSN6fvU+aa3Q/pl3Zd+rlRDoABDGAAAxjAAAYwgAEMYAADGMAABjCAAQxgAAMYwAAGMIABDGAAAxjAAAYwgAEMYAADGMAABjCAAQxgAAMYwAAGMIABDGAAA9irgNfX1zM2AAMYwIHMRrrfAAxg3wH2I9RkAzCAPQEYrEmgBjCA0w0YiKkLwAA+EMBg+/8BGMApBQyqNGIGMID3Axg8mReAAbwnYKB4BDKAAbyJFxQexgzg7AUMAP8E4CwDzKP3OWIA+xMwDz1LIAPYX4B52NkXgH0COJsebW7hjT3LSsQA9iZg4AIZwB4FDF4QbyEGsLcAgxfEfyMGsCcAgxfEuyEGcAYDBi+I9wrAAAYwgAGcasDgBfE/IwYwgAEMYAADGMAABjCAAQxgAAMYwAAGMIABDGAAAxjAAAYwgAEMYAADGMD8xOInFj+xAAxgAAOYaSQQM40EYOaBmQdmHhjAbORgIwcbOQDMTizwshOLrZRspWQrJYDZC03shQYwlxmIywwA5jYSt5EAzHVC4johgLkPTNwHBnCqAGsN0gIovIB2ImTqJ0OKF8AA3gFYygNy5sLdDMAA3g1wXuN24ElfdeOhjWy8AAZwMoC1pgWT3wTmA0EbDG3DBTCAUwl4q2Ywp7LaYNjUBkMagAF8IIDzmxNagdSSAGIS1YyFTa0dgAGcbsA7ak2YwlZQK9aRsKkZdQIwgL0AeKuAFNeKAnFfQq0ejmw3IoU1AAPYd4CL2pza46b4T5mMtHIwYqqkIScbL4ABnM2AtQ5pXiuROp265k2pXbcU08qkHqfemCm365OiWoXU7zQQNZV2g1HFC2AAAxjAAAYwgAEMYAADGMAABjCAAQxgAAMYwAAGMIABDGAAAxjAAAYwgAEMYAADGMAABjCAAQxgAAMYwAAGMIABDOAsBvwbzxw2cLLYKwMAAAAASUVORK5CYII=
