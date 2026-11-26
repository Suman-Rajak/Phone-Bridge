const vertex = `#version 300 es
out vec2 uv;
void main() {
  vec2 p = vec2((gl_VertexID << 1) & 2, gl_VertexID & 2);
  uv = vec2(p.x, 1.0-p.y);
  gl_Position = vec4(p*2.0-1.0,0,1);
}`;
const fragment = `#version 300 es
precision highp float;
in vec2 uv;
uniform sampler2D frame;
uniform mat3 source;
uniform vec2 tone;
out vec4 color;
void main() {
  vec3 projected = source * vec3(uv,1);
  vec3 rgb = texture(frame,projected.xy/projected.z).rgb;
  color = vec4((rgb-0.5)*tone.x+0.5+tone.y,1);
}`;

export function createWarpRenderer(canvas: HTMLCanvasElement) {
  const gl = canvas.getContext("webgl2", {
    alpha: false,
    depth: false,
    antialias: false,
  });
  if (!gl) throw new Error("WebGL2 unavailable");
  const program = gl.createProgram();
  const texture = gl.createTexture();
  const dispose = () => {
    gl.useProgram(null);
    gl.deleteTexture(texture);
    gl.deleteProgram(program);
  };
  try {
    if (!program || !texture) throw new Error("Graphics resources unavailable");
    for (const [kind, source] of [
      [gl.VERTEX_SHADER, vertex],
      [gl.FRAGMENT_SHADER, fragment],
    ] as const) {
      const shader = gl.createShader(kind);
      if (!shader) throw new Error("Shader unavailable");
      gl.shaderSource(shader, source);
      gl.compileShader(shader);
      gl.attachShader(program, shader);
      gl.deleteShader(shader);
    }
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS))
      throw new Error("Page shader unavailable");
    gl.useProgram(program);
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    const source = gl.getUniformLocation(program, "source"),
      tone = gl.getUniformLocation(program, "tone");
    return {
      dispose,
      draw(
        video: HTMLVideoElement,
        matrix: Float32Array,
        contrast: number,
        brightness: number,
      ) {
        gl.viewport(0, 0, canvas.width, canvas.height);
        gl.texImage2D(
          gl.TEXTURE_2D,
          0,
          gl.RGB,
          gl.RGB,
          gl.UNSIGNED_BYTE,
          video,
        );
        gl.uniformMatrix3fv(source, false, matrix);
        gl.uniform2f(tone, contrast, brightness);
        gl.drawArrays(gl.TRIANGLES, 0, 3);
      },
    };
  } catch (error) {
    dispose();
    throw error;
  }
}
