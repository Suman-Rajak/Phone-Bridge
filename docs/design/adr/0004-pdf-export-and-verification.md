# ADR 0004 — PDF export and verification

Accepted for T11.

Use the roadmap’s `pdf-lib` dependency to assemble PDF pages and pin the package in the PDF workspace. The export worker handles JPEG encoding and PDF assembly. It sends the complete file back to the browser tab for download.

Use the pinned `pdfjs-dist` development dependency as an independent reader for generated test PDFs. Keep PDF.js and its optional Node canvas dependency in the test tooling.

The browser already encodes JPEG through worker canvas. Use that encoder so the project can vary image quality and dimensions without adding a separate compressor. [pdf-lib document API](https://pdf-lib.js.org/docs/api/classes/pdfdocument) · [OffscreenCanvas encoding](https://developer.mozilla.org/en-US/docs/Web/API/OffscreenCanvas/convertToBlob)
