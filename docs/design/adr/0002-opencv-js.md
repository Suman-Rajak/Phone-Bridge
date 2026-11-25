# ADR 0002 — Package OpenCV.js through pnpm

Accepted for T03.

Use the Apache-2.0 [TechStark OpenCV.js package](https://github.com/TechStark/opencv-js) at the exact version in the vision workspace manifest. Its self-contained WebAssembly build gives Node and the browser the same OpenCV implementation. pnpm pins the package integrity in the lockfile. The browser loads OpenCV from the application origin inside a dedicated worker.

Vendoring OpenCV would give us direct control over the compiled artifact. It would also add a large generated file to Git and require a separate update and integrity workflow. Revisit this choice if a custom build is needed for size or performance.

The benchmark uses system FFmpeg to decode the official sample videos and system tar to unpack the verified archive. These are development tools and add no browser or npm dependency. [FFmpeg documentation](https://ffmpeg.org/ffmpeg.html)
