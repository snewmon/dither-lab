export const VERT = /* glsl */`#version 300 es
in vec2 a_pos;
void main() {
  gl_Position = vec4(a_pos, 0.0, 1.0);
}
`;

export const FRAG = /* glsl */`#version 300 es
precision highp float;

uniform vec2  u_res;
uniform float u_time;
// palette uniforms: 4 colours from loaded image (or defaults when no image)
uniform vec3  u_pal[4];
uniform float u_palBlend; // 0 = default cyanotype, 1 = image palette
out vec4 fragColor;

// --- noise helpers ---
vec3 mod289(vec3 x) { return x - floor(x * (1.0/289.0)) * 289.0; }
vec2 mod289(vec2 x) { return x - floor(x * (1.0/289.0)) * 289.0; }
vec3 permute(vec3 x) { return mod289(((x*34.0)+1.0)*x); }

float snoise(vec2 v) {
  const vec4 C = vec4(0.211324865405187, 0.366025403784439,
                     -0.577350269189626, 0.024390243902439);
  vec2 i  = floor(v + dot(v, C.yy));
  vec2 x0 = v -   i + dot(i, C.xx);
  vec2 i1 = (x0.x > x0.y) ? vec2(1.0,0.0) : vec2(0.0,1.0);
  vec4 x12 = x0.xyxy + C.xxzz;
  x12.xy -= i1;
  i = mod289(i);
  vec3 p = permute(permute(i.y + vec3(0.0, i1.y, 1.0))
                         + i.x + vec3(0.0, i1.x, 1.0));
  vec3 m = max(0.5 - vec3(dot(x0,x0), dot(x12.xy,x12.xy), dot(x12.zw,x12.zw)), 0.0);
  m = m*m; m = m*m;
  vec3 x = 2.0*fract(p * C.www) - 1.0;
  vec3 h = abs(x) - 0.5;
  vec3 ox = floor(x + 0.5);
  vec3 a0 = x - ox;
  m *= 1.79284291400159 - 0.85373472095314 * (a0*a0 + h*h);
  vec3 g;
  g.x  = a0.x  * x0.x  + h.x  * x0.y;
  g.yz = a0.yz * x12.xz + h.yz * x12.yw;
  return 130.0 * dot(m, g);
}

// fractal brownian motion
float fbm(vec2 p, int octaves) {
  float v = 0.0, a = 0.5;
  vec2  shift = vec2(100.0);
  mat2  rot = mat2(cos(0.5), sin(0.5), -sin(0.5), cos(0.5));
  for (int i = 0; i < octaves; i++) {
    v += a * snoise(p);
    p  = rot * p * 2.0 + shift;
    a *= 0.5;
  }
  return v;
}

// 4x4 Bayer threshold matrix
float bayer4(vec2 coord) {
  int x = int(mod(coord.x, 4.0));
  int y = int(mod(coord.y, 4.0));
  int idx = y * 4 + x;
  // row-major Bayer 4x4 thresholds / 16.0
  float[16] m = float[16](
     0.0/16.0,  8.0/16.0,  2.0/16.0, 10.0/16.0,
    12.0/16.0,  4.0/16.0, 14.0/16.0,  6.0/16.0,
     3.0/16.0, 11.0/16.0,  1.0/16.0,  9.0/16.0,
    15.0/16.0,  7.0/16.0, 13.0/16.0,  5.0/16.0
  );
  return m[idx];
}

void main() {
  vec2 uv = gl_FragCoord.xy / u_res;
  float t  = u_time * 0.12;

  // ---- plasma field (slow-drifting fbm) ----
  vec2 p = (uv - 0.5) * 2.8;
  // two overlapping fbm layers for organic drift
  float n1 = fbm(p * 1.1 + vec2(t * 0.4, t * 0.27), 5);
  float n2 = fbm(p * 0.7 + vec2(-t * 0.18, t * 0.31) + vec2(n1 * 0.6), 4);
  float field = n1 * 0.55 + n2 * 0.45;
  // remap -1..1 → 0..1, boost contrast
  float lum = clamp(field * 0.5 + 0.5, 0.0, 1.0);
  lum = smoothstep(0.2, 0.8, lum);

  // ---- 1-bit Bayer ordered dither ----
  float threshold = bayer4(gl_FragCoord.xy);
  float ink = step(threshold, lum);   // 1.0 = ink pixel, 0.0 = background

  // ---- slow hue drift for ink color ----
  float colorT = u_time * 0.04;
  float hueNoise = fbm(p * 0.4 + vec2(colorT * 0.5, -colorT * 0.3), 3);
  float hueBlend = clamp(hueNoise * 0.5 + 0.5, 0.0, 1.0);

  // default cyanotype duotone
  vec3 defInk0 = vec3(0.49, 0.79, 0.88);
  vec3 defInk1 = vec3(0.65, 0.55, 0.98);
  vec3 defBg   = vec3(0.038, 0.055, 0.079);

  // image palette: ink0=pal[0], ink1=pal[1], bg=mix(pal[2],pal[3],0.5) darkened
  vec3 palInk0 = u_pal[0];
  vec3 palInk1 = u_pal[1];
  vec3 palBg   = mix(u_pal[2], u_pal[3], 0.5) * 0.25;

  vec3 inkColor = mix(
    mix(defInk0, defInk1, hueBlend),
    mix(palInk0, palInk1, hueBlend),
    u_palBlend
  );
  vec3 bgColor = mix(defBg, palBg, u_palBlend);

  vec3 color = mix(bgColor, inkColor, ink);

  // subtle vignette
  float vig = 1.0 - smoothstep(0.5, 1.4, length((uv - 0.5) * vec2(1.2, 1.0)));
  color = mix(bgColor * 0.6, color, vig);

  fragColor = vec4(color, 1.0);
}
`;
