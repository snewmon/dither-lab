import { VERT, FRAG } from './shaders';

function compileShader(gl: WebGL2RenderingContext, type: number, src: string): WebGLShader {
  const s = gl.createShader(type)!;
  gl.shaderSource(s, src);
  gl.compileShader(s);
  if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
    throw new Error(gl.getShaderInfoLog(s) ?? 'shader compile error');
  }
  return s;
}

function makeProgram(gl: WebGL2RenderingContext): WebGLProgram {
  const prog = gl.createProgram()!;
  gl.attachShader(prog, compileShader(gl, gl.VERTEX_SHADER, VERT));
  gl.attachShader(prog, compileShader(gl, gl.FRAGMENT_SHADER, FRAG));
  gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
    throw new Error(gl.getProgramInfoLog(prog) ?? 'program link error');
  }
  return prog;
}

export interface PaletteUniforms {
  colours: [number, number, number][];  // 4 entries, each [0..1]
  blend: number;                         // 0 = default, 1 = image palette
}

export interface GLBackground {
  resize(w: number, h: number): void;
  draw(time: number, palette?: PaletteUniforms): void;
  destroy(): void;
}

export function createGLBackground(canvas: HTMLCanvasElement): GLBackground | null {
  const gl = canvas.getContext('webgl2', { alpha: false, antialias: false });
  if (!gl) return null;

  let prog: WebGLProgram;
  try {
    prog = makeProgram(gl);
  } catch (e) {
    console.warn('DitherLab background shader failed:', e);
    return null;
  }

  const vao = gl.createVertexArray()!;
  gl.bindVertexArray(vao);
  const buf = gl.createBuffer()!;
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1, 1,-1, -1,1, 1,1]), gl.STATIC_DRAW);
  const loc = gl.getAttribLocation(prog, 'a_pos');
  gl.enableVertexAttribArray(loc);
  gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
  gl.bindVertexArray(null);

  const uRes      = gl.getUniformLocation(prog, 'u_res');
  const uTime     = gl.getUniformLocation(prog, 'u_time');
  const uPal      = gl.getUniformLocation(prog, 'u_pal');
  const uPalBlend = gl.getUniformLocation(prog, 'u_palBlend');

  const DEFAULT_PAL = new Float32Array([
    0.49, 0.79, 0.88,
    0.65, 0.55, 0.98,
    0.038, 0.055, 0.079,
    0.038, 0.055, 0.079,
  ]);

  return {
    resize(w, h) {
      canvas.width  = w;
      canvas.height = h;
      gl.viewport(0, 0, w, h);
    },
    draw(time, palette) {
      gl.useProgram(prog);
      gl.uniform2f(uRes, canvas.width, canvas.height);
      gl.uniform1f(uTime, time);

      if (palette && palette.colours.length >= 4) {
        const flat = new Float32Array(palette.colours.slice(0, 4).flat());
        gl.uniform3fv(uPal, flat);
        gl.uniform1f(uPalBlend, palette.blend);
      } else {
        gl.uniform3fv(uPal, DEFAULT_PAL);
        gl.uniform1f(uPalBlend, 0.0);
      }

      gl.bindVertexArray(vao);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      gl.bindVertexArray(null);
    },
    destroy() {
      gl.deleteProgram(prog);
      gl.deleteBuffer(buf);
      gl.deleteVertexArray(vao);
    },
  };
}
