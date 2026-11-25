# ADR 0003 — Use WebGL2 for live rectification

Accepted for T04.

Render camera frames on the laptop with WebGL2. Upload the video as a texture and map each output pixel through the inverse homography in a fragment shader. Run page-boundary detection independently in the vision worker and keep the latest valid transform for rendering. This keeps pixel warping on the GPU and avoids waiting for a new detector result on every rendered frame.

Feature-detect context creation and handle context loss when implementing T16. If WebGL2 cannot run, offer the unflattened browser preview and explain why flattening is unavailable. WebGPU remains a capability diagnostic until a future task justifies adopting it. [WebGL best practices](https://developer.mozilla.org/en-US/docs/Web/API/WebGL_API/WebGL_best_practices)
