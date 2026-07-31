"use client";

import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from "react";
import type { GameBuildSpec, RuntimeStats } from "../../types/game";

export type GameRuntime3DHandle = {
  restart: () => void;
  togglePause: () => void;
  focus: () => void;

  /**
   * Returns a racing vehicle to the last valid checkpoint.
   * Optional because non-racing and compatibility runtimes may not implement it.
   */
  recoverCheckpoint?: () => void;
};

type Props = {
  spec: GameBuildSpec;
  onStats?: (stats: RuntimeStats) => void;
  onReady?: () => void;
};

type Vec3 = [number, number, number];
type Mat4 = Float32Array;

type Entity = {
  id: number;
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  radius: number;
  health: number;
  maxHealth: number;
  cooldown: number;
  phase: number;
  active?: boolean;
  order?: number;
  lane?: number;
  value?: number;
  dead?: boolean;
};

type Box = { x: number; y: number; z: number; sx: number; sy: number; sz: number; kind?: string };
type Platform = { x: number; y: number; z: number; w: number; h: number; d: number };
type Particle = { x: number; y: number; z: number; vx: number; vy: number; vz: number; life: number; maxLife: number; size: number; color: string };

type RuntimeState = {
  status: RuntimeStats["status"];
  player: Entity;
  enemies: Entity[];
  collectibles: Entity[];
  projectiles: Entity[];
  particles: Particle[];
  obstacles: Box[];
  platforms: Platform[];
  nodes: Entity[];
  progress: number;
  score: number;
  defeated: number;
  collected: number;
  elapsed: number;
  distance: number;
  puzzleIndex: number;
  message: string;
  messageUntil: number;
  yaw: number;
  pitch: number;
  zoom: number;
  targetLane: number;
  grounded: boolean;
  lastAttack: number;
  lastDamage: number;
  fps: number;
  fpsFrames: number;
  fpsClock: number;
  flightSpeed: number;
  stamina: number;
  roll: number;
  wingPhase: number;
  windX: number;
  windZ: number;
  narrativeProgress: number;
  speaker: string;
  dialogueText: string;
  storyBeat: string;
};

type GLMesh = { vao: WebGLVertexArrayObject; count: number };
type Renderer = {
  gl: WebGL2RenderingContext;
  program: WebGLProgram;
  cube: GLMesh;
  sphere: GLMesh;
  cylinder: GLMesh;
  terrain: GLMesh;
  uniforms: {
    projection: WebGLUniformLocation;
    view: WebGLUniformLocation;
    model: WebGLUniformLocation;
    color: WebGLUniformLocation;
    emissive: WebGLUniformLocation;
    lightDir: WebGLUniformLocation;
    camera: WebGLUniformLocation;
    fogColor: WebGLUniformLocation;
    fogNear: WebGLUniformLocation;
    fogFar: WebGLUniformLocation;
    time: WebGLUniformLocation;
  };
};

const DEG = Math.PI / 180;

function hexToRgb(hex: string): Vec3 {
  const value = hex.replace("#", "");
  return [Number.parseInt(value.slice(0, 2), 16) / 255, Number.parseInt(value.slice(2, 4), 16) / 255, Number.parseInt(value.slice(4, 6), 16) / 255];
}
function clamp(value: number, min: number, max: number) { return Math.max(min, Math.min(max, value)); }
function length2(x: number, z: number) { return Math.hypot(x, z); }
function seeded(seedText: string) {
  let seed = 2166136261;
  for (const character of seedText) seed = Math.imul(seed ^ character.charCodeAt(0), 16777619);
  return () => {
    seed += 0x6d2b79f5;
    let value = seed;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

function mat4Identity(): Mat4 {
  return new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
}
function mat4Multiply(a: Mat4, b: Mat4): Mat4 {
  const out = new Float32Array(16);
  for (let row = 0; row < 4; row += 1) {
    for (let col = 0; col < 4; col += 1) {
      out[col * 4 + row] = a[row] * b[col * 4] + a[4 + row] * b[col * 4 + 1] + a[8 + row] * b[col * 4 + 2] + a[12 + row] * b[col * 4 + 3];
    }
  }
  return out;
}
function mat4Translation(x: number, y: number, z: number): Mat4 {
  const out = mat4Identity(); out[12] = x; out[13] = y; out[14] = z; return out;
}
function mat4Scale(x: number, y: number, z: number): Mat4 {
  const out = mat4Identity(); out[0] = x; out[5] = y; out[10] = z; return out;
}
function mat4RotateY(angle: number): Mat4 {
  const c = Math.cos(angle); const s = Math.sin(angle);
  return new Float32Array([c, 0, -s, 0, 0, 1, 0, 0, s, 0, c, 0, 0, 0, 0, 1]);
}
function mat4RotateX(angle: number): Mat4 {
  const c = Math.cos(angle); const s = Math.sin(angle);
  return new Float32Array([1, 0, 0, 0, 0, c, s, 0, 0, -s, c, 0, 0, 0, 0, 1]);
}
function mat4RotateZ(angle: number): Mat4 {
  const c = Math.cos(angle); const s = Math.sin(angle);
  return new Float32Array([c, s, 0, 0, -s, c, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
}
function modelMatrix(position: Vec3, scale: Vec3, yaw = 0, pitch = 0, roll = 0): Mat4 {
  return mat4Multiply(mat4Translation(...position), mat4Multiply(mat4RotateY(yaw), mat4Multiply(mat4RotateX(pitch), mat4Multiply(mat4RotateZ(roll), mat4Scale(...scale)))));
}
function perspective(fov: number, aspect: number, near: number, far: number): Mat4 {
  const f = 1 / Math.tan(fov / 2); const nf = 1 / (near - far);
  return new Float32Array([f / aspect, 0, 0, 0, 0, f, 0, 0, 0, 0, (far + near) * nf, -1, 0, 0, 2 * far * near * nf, 0]);
}
function normalize(v: Vec3): Vec3 { const l = Math.hypot(v[0], v[1], v[2]) || 1; return [v[0] / l, v[1] / l, v[2] / l]; }
function cross(a: Vec3, b: Vec3): Vec3 { return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]; }
function lookAt(eye: Vec3, target: Vec3, up: Vec3 = [0, 1, 0]): Mat4 {
  const z = normalize([eye[0] - target[0], eye[1] - target[1], eye[2] - target[2]]);
  const x = normalize(cross(up, z));
  const y = cross(z, x);
  return new Float32Array([x[0], y[0], z[0], 0, x[1], y[1], z[1], 0, x[2], y[2], z[2], 0, -(x[0] * eye[0] + x[1] * eye[1] + x[2] * eye[2]), -(y[0] * eye[0] + y[1] * eye[1] + y[2] * eye[2]), -(z[0] * eye[0] + z[1] * eye[1] + z[2] * eye[2]), 1]);
}

function compileShader(gl: WebGL2RenderingContext, type: number, source: string) {
  const shader = gl.createShader(type); if (!shader) throw new Error("Unable to allocate WebGL shader.");
  gl.shaderSource(shader, source); gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(shader) || "WebGL shader compilation failed.");
  return shader;
}
function createProgram(gl: WebGL2RenderingContext) {
  const vertex = compileShader(gl, gl.VERTEX_SHADER, `#version 300 es
  precision highp float;
  layout(location=0) in vec3 aPosition;
  layout(location=1) in vec3 aNormal;
  uniform mat4 uProjection; uniform mat4 uView; uniform mat4 uModel;
  out vec3 vWorld; out vec3 vNormal;
  void main(){ vec4 world=uModel*vec4(aPosition,1.0); vWorld=world.xyz; vNormal=normalize(mat3(uModel)*aNormal); gl_Position=uProjection*uView*world; }`);
  const fragment = compileShader(gl, gl.FRAGMENT_SHADER, `#version 300 es
  precision highp float;
  in vec3 vWorld; in vec3 vNormal;
  uniform vec3 uColor; uniform float uEmissive; uniform vec3 uLightDir; uniform vec3 uCamera; uniform vec3 uFogColor; uniform float uFogNear; uniform float uFogFar; uniform float uTime;
  out vec4 outColor;
  void main(){
    vec3 n=normalize(vNormal); float diff=max(dot(n,normalize(-uLightDir)),0.0); float hemi=n.y*0.5+0.5;
    vec3 viewDir=normalize(uCamera-vWorld); float rim=pow(1.0-max(dot(n,viewDir),0.0),2.5);
    float pulse=1.0+sin(uTime*2.2+vWorld.x*0.08+vWorld.z*0.05)*0.035*uEmissive;
    vec3 lit=uColor*(0.24+diff*0.68+hemi*0.18)*pulse + uColor*uEmissive*(0.8+rim*0.8) + vec3(rim*0.12);
    float distanceToCamera=distance(vWorld,uCamera); float fog=smoothstep(uFogNear,uFogFar,distanceToCamera);
    outColor=vec4(mix(lit,uFogColor,fog),1.0);
  }`);
  const program = gl.createProgram(); if (!program) throw new Error("Unable to allocate WebGL program.");
  gl.attachShader(program, vertex); gl.attachShader(program, fragment); gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(program) || "WebGL program linking failed.");
  gl.deleteShader(vertex); gl.deleteShader(fragment); return program;
}
function meshFromData(gl: WebGL2RenderingContext, positions: number[], normals: number[], indices: number[]): GLMesh {
  const vao = gl.createVertexArray(); if (!vao) throw new Error("Unable to allocate vertex array.");
  gl.bindVertexArray(vao);
  const p = gl.createBuffer(); const n = gl.createBuffer(); const i = gl.createBuffer();
  if (!p || !n || !i) throw new Error("Unable to allocate WebGL buffers.");
  gl.bindBuffer(gl.ARRAY_BUFFER, p); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(positions), gl.STATIC_DRAW); gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 0, 0);
  gl.bindBuffer(gl.ARRAY_BUFFER, n); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(normals), gl.STATIC_DRAW); gl.enableVertexAttribArray(1); gl.vertexAttribPointer(1, 3, gl.FLOAT, false, 0, 0);
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, i); gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(indices), gl.STATIC_DRAW);
  gl.bindVertexArray(null); return { vao, count: indices.length };
}
function cubeData() {
  const positions = [
    -1,-1,1, 1,-1,1, 1,1,1, -1,1,1, 1,-1,-1, -1,-1,-1, -1,1,-1, 1,1,-1,
    -1,1,1, 1,1,1, 1,1,-1, -1,1,-1, -1,-1,-1, 1,-1,-1, 1,-1,1, -1,-1,1,
    1,-1,1, 1,-1,-1, 1,1,-1, 1,1,1, -1,-1,-1, -1,-1,1, -1,1,1, -1,1,-1,
  ];
  const normals = [
    0,0,1,0,0,1,0,0,1,0,0,1, 0,0,-1,0,0,-1,0,0,-1,0,0,-1,
    0,1,0,0,1,0,0,1,0,0,1,0, 0,-1,0,0,-1,0,0,-1,0,0,-1,0,
    1,0,0,1,0,0,1,0,0,1,0,0, -1,0,0,-1,0,0,-1,0,0,-1,0,0,
  ];
  const indices: number[] = []; for (let f = 0; f < 6; f += 1) { const o = f * 4; indices.push(o,o+1,o+2,o,o+2,o+3); }
  return { positions, normals, indices };
}
function sphereData(segments = 12, rings = 8) {
  const positions: number[] = []; const normals: number[] = []; const indices: number[] = [];
  for (let y = 0; y <= rings; y += 1) { const v = y / rings; const phi = v * Math.PI;
    for (let x = 0; x <= segments; x += 1) { const u = x / segments; const theta = u * Math.PI * 2; const sx = Math.sin(phi) * Math.cos(theta); const sy = Math.cos(phi); const sz = Math.sin(phi) * Math.sin(theta); positions.push(sx,sy,sz); normals.push(sx,sy,sz); }
  }
  for (let y = 0; y < rings; y += 1) for (let x = 0; x < segments; x += 1) { const a = y * (segments + 1) + x; const b = a + segments + 1; indices.push(a,b,a+1,b,b+1,a+1); }
  return { positions, normals, indices };
}
function cylinderData(segments = 14) {
  const positions: number[] = []; const normals: number[] = []; const indices: number[] = [];
  for (let y = 0; y <= 1; y += 1) for (let i = 0; i <= segments; i += 1) { const a = i / segments * Math.PI * 2; const x = Math.cos(a); const z = Math.sin(a); positions.push(x, y * 2 - 1, z); normals.push(x,0,z); }
  for (let i = 0; i < segments; i += 1) { const a=i,b=i+1,c=i+segments+1,d=c+1; indices.push(a,c,b,b,c,d); }
  const topCenter = positions.length / 3; positions.push(0,1,0); normals.push(0,1,0);
  const bottomCenter = positions.length / 3; positions.push(0,-1,0); normals.push(0,-1,0);
  for (let i=0;i<segments;i+=1){const n=i+1;indices.push(topCenter,segments+1+i,segments+1+n);indices.push(bottomCenter,n,i);}
  return { positions, normals, indices };
}
function terrainSeed(spec: GameBuildSpec) {
  let value = 0;
  for (const c of spec.title) value = (value * 31 + c.charCodeAt(0)) >>> 0;
  return (value % 997) / 997 * Math.PI * 2;
}
function terrainHeight(spec: GameBuildSpec, x: number, z: number) {
  if (spec.template !== "flight") return 0;
  const half = spec.world.size / 2;
  const seed = terrainSeed(spec);
  const distance = Math.hypot(x, z) / Math.max(1, half);
  const island = clamp(1.18 - distance * 0.76, 0.12, 1.18);
  const broad = Math.sin(x * 0.025 + seed) * 4.2 + Math.cos(z * 0.029 - seed * 0.7) * 3.6;
  const ridgeA = Math.max(0, Math.sin((x + z) * 0.019 + seed * 1.7));
  const ridgeB = Math.max(0, Math.cos((x - z) * 0.023 - seed));
  const mountains = Math.pow(ridgeA * ridgeB, 2.4) * 25 * island;
  const detail = Math.sin(x * 0.09 + z * 0.047) * 1.25 + Math.cos(z * 0.075 - x * 0.031) * 0.85;
  const river = Math.exp(-Math.pow((x - Math.sin(z * 0.025 + seed) * 18) / 7, 2)) * 5.5;
  return broad * island + mountains + detail - river - 1.2;
}
function terrainData(spec: GameBuildSpec) {
  const segments = spec.template === "flight" ? (spec.quality === "ultra" ? 64 : spec.quality === "high" ? 52 : 40) : 2;
  const size = spec.template === "flight" ? spec.world.size : 2;
  const positions: number[] = []; const normals: number[] = []; const indices: number[] = [];
  const step = size / segments; const half = size / 2;
  for (let z = 0; z <= segments; z += 1) {
    for (let x = 0; x <= segments; x += 1) {
      const px = -half + x * step; const pz = -half + z * step;
      const h = terrainHeight(spec, px, pz);
      const hx = terrainHeight(spec, px + .6, pz) - terrainHeight(spec, px - .6, pz);
      const hz = terrainHeight(spec, px, pz + .6) - terrainHeight(spec, px, pz - .6);
      const n = normalize([-hx, 1.2, -hz]);
      positions.push(px, h, pz); normals.push(...n);
    }
  }
  for (let z = 0; z < segments; z += 1) for (let x = 0; x < segments; x += 1) {
    const a = z * (segments + 1) + x; const b = a + 1; const c = a + segments + 1; const d = c + 1;
    indices.push(a, c, b, b, c, d);
  }
  return { positions, normals, indices };
}

function createRenderer(canvas: HTMLCanvasElement, spec: GameBuildSpec): Renderer {
  const gl = canvas.getContext("webgl2", { alpha: false, antialias: spec.quality !== "balanced", powerPreference: "high-performance" });
  if (!gl) throw new Error("WebGL 2 is required for the 3D Playtest Studio. Update the browser or enable hardware acceleration.");
  const program = createProgram(gl); gl.useProgram(program);
  const get = (name: string) => { const value = gl.getUniformLocation(program, name); if (!value) throw new Error(`Missing WebGL uniform ${name}.`); return value; };
  const cube = cubeData(); const sphere = sphereData(); const cylinder = cylinderData(); const terrain = terrainData(spec);
  gl.enable(gl.DEPTH_TEST); gl.enable(gl.CULL_FACE); gl.cullFace(gl.BACK);
  return { gl, program, cube: meshFromData(gl,cube.positions,cube.normals,cube.indices), sphere: meshFromData(gl,sphere.positions,sphere.normals,sphere.indices), cylinder: meshFromData(gl,cylinder.positions,cylinder.normals,cylinder.indices), terrain: meshFromData(gl,terrain.positions,terrain.normals,terrain.indices), uniforms: { projection:get("uProjection"), view:get("uView"), model:get("uModel"), color:get("uColor"), emissive:get("uEmissive"), lightDir:get("uLightDir"), camera:get("uCamera"), fogColor:get("uFogColor"), fogNear:get("uFogNear"), fogFar:get("uFogFar"), time:get("uTime") } };
}
function drawMesh(renderer: Renderer, mesh: GLMesh, matrix: Mat4, colorHex: string, emissive = 0) {
  const { gl, uniforms } = renderer; const color = hexToRgb(colorHex);
  gl.uniformMatrix4fv(uniforms.model, false, matrix); gl.uniform3f(uniforms.color, color[0], color[1], color[2]); gl.uniform1f(uniforms.emissive, emissive);
  gl.bindVertexArray(mesh.vao); gl.drawElements(gl.TRIANGLES, mesh.count, gl.UNSIGNED_SHORT, 0);
}

function createState(spec: GameBuildSpec): RuntimeState {
  const random = seeded(`${spec.buildId}-${spec.title}`);
  const half = spec.world.size / 2;
  if (spec.templateFamily === "kart-racing") {
    const player: Entity = {
      id: 0,
      x: 0,
      y: 1.4,
      z: 0,
      vx: 0,
      vy: 0,
      vz: 0,
      radius: 1.05,
      health: spec.player.health,
      maxHealth: spec.player.health,
      cooldown: 0,
      phase: 0,
    };
    return {
      status: "ready",
      player,
      enemies: [],
      collectibles: [],
      projectiles: [],
      particles: [],
      obstacles: [],
      platforms: [],
      nodes: [],
      progress: 0,
      score: 0,
      defeated: 0,
      collected: 0,
      elapsed: 0,
      distance: 0,
      puzzleIndex: 0,
      message: "Kart ready",
      messageUntil: 0,
      yaw: 0,
      pitch: 0,
      zoom: 6,
      targetLane: 0,
      grounded: true,
      lastAttack: 0,
      lastDamage: 0,
      fps: 0,
      fpsFrames: 0,
      fpsClock: 0,
      flightSpeed: 0,
      stamina: 100,
      roll: 0,
      wingPhase: 0,
      windX: 0,
      windZ: 0,
      narrativeProgress: 0,
      speaker: spec.runtimeContent.dialogue.find((line) => line.trigger === "opening")?.speaker || "Mission Control",
      dialogueText: spec.runtimeContent.dialogue.find((line) => line.trigger === "opening")?.line || spec.runtimeContent.opening,
      storyBeat: spec.runtimeContent.storyBeats[0] || spec.runtimeContent.opening,
    };
  }
  const player: Entity = {
    id: 0,
    x: spec.template === "platformer" ? -half + 6 : 0,
    y: spec.template === "flight" ? 22 : 1.4,
    z: spec.template === "flight" ? -half * 0.18 : 0,
    vx: 0, vy: 0, vz: 0,
    radius: spec.template === "flight" ? 1.25 : 0.85,
    health: spec.player.health,
    maxHealth: spec.player.health,
    cooldown: 0,
    phase: 0,
  };
  const enemies: Entity[] = [];
  const collectibles: Entity[] = [];
  const obstacles: Box[] = [];
  const platforms: Platform[] = [];
  const nodes: Entity[] = [];
  const enemyCount = spec.template === "arena" || spec.template === "survival" ? spec.enemy.count : Math.min(spec.enemy.count, 7);
  const safePosition = () => {
    let x = 0; let z = 0;
    do { x = (random() * 2 - 1) * half * 0.84; z = (random() * 2 - 1) * half * 0.84; }
    while (Math.hypot(x - player.x, z - player.z) < 7);
    return { x, z };
  };

  if (!["runner", "platformer", "flight"].includes(spec.template)) {
    for (let i = 0; i < enemyCount; i += 1) {
      const position = safePosition();
      enemies.push({ id: i + 1, x: position.x, y: 1.1, z: position.z, vx: 0, vy: 0, vz: 0, radius: 0.8 + random() * 0.22, health: spec.enemy.health, maxHealth: spec.enemy.health, cooldown: random(), phase: random() * Math.PI * 2 });
    }
    const count = spec.template === "collector" ? spec.objective.target : Math.min(Math.max(spec.collectible.count, 6), 16);
    for (let i = 0; i < count; i += 1) {
      const position = safePosition();
      collectibles.push({ id: i + 1, x: position.x, y: 1.1 + random(), z: position.z, vx: 0, vy: 0, vz: 0, radius: 0.45, health: 1, maxHealth: 1, cooldown: 0, phase: random() * Math.PI * 2, value: spec.collectible.scoreValue });
    }
    for (let i = 0; i < spec.world.obstacleCount; i += 1) {
      const position = safePosition(); const tall = random() < 0.34;
      obstacles.push({ x: position.x, y: tall ? 1.8 : 0.65, z: position.z, sx: 0.7 + random() * 1.8, sy: tall ? 1.8 + random() * 2.8 : 0.55 + random() * 0.65, sz: 0.7 + random() * 1.8, kind: tall ? "tower" : "cover" });
    }
  }

  if (spec.template === "flight") {
    const flight = spec.flight || { creature: "bird" as const, cruiseSpeed: 20, maxSpeed: 44, flapLift: 8.5, glideEfficiency: 0.86, turnRate: 1.65, windStrength: 5.5, thermalCount: 7, freeRoam: true };
    for (let i = 0; i < spec.objective.target; i += 1) {
      const angle = i / spec.objective.target * Math.PI * 2 + random() * 0.5;
      const radius = half * (0.32 + random() * 0.45);
      const x = Math.cos(angle) * radius; const z = Math.sin(angle) * radius;
      const y = Math.max(8, terrainHeight(spec, x, z) + 11 + random() * 19);
      collectibles.push({ id: i + 1, x, y, z, vx: 0, vy: 0, vz: 0, radius: 1.8, health: 1, maxHealth: 1, cooldown: 0, phase: random() * Math.PI * 2, value: spec.collectible.scoreValue });
    }
    for (let i = 0; i < flight.thermalCount; i += 1) {
      const angle = i / flight.thermalCount * Math.PI * 2 + random();
      const radius = half * (0.18 + random() * 0.54);
      const x = Math.cos(angle) * radius; const z = Math.sin(angle) * radius;
      nodes.push({ id: i + 1, x, y: terrainHeight(spec, x, z) + 1, z, vx: 0, vy: 0, vz: 0, radius: 6, health: 1, maxHealth: 1, cooldown: 0, phase: angle, active: true });
    }
    const scenicCount = Math.round(spec.world.obstacleCount * (spec.quality === "ultra" ? 1.35 : 1));
    for (let i = 0; i < scenicCount; i += 1) {
      const x = (random() * 2 - 1) * half * 0.92; const z = (random() * 2 - 1) * half * 0.92;
      const h = terrainHeight(spec, x, z); if (h < 0.2) continue;
      const roll = random(); const kind = roll < 0.72 ? "tree" : roll < 0.86 ? "rock" : roll < 0.95 ? "village" : "waterfall";
      obstacles.push({ x, y: h, z, sx: 0.5 + random() * 1.1, sy: kind === "tree" ? 2.8 + random() * 4 : kind === "village" ? 1 + random() * 1.7 : 1 + random() * 3, sz: 0.5 + random() * 1.1, kind });
    }
    player.y = Math.max(player.y, terrainHeight(spec, player.x, player.z) + 12);
  }

  if (spec.template === "runner") {
    player.x = 0; player.z = 0; player.y = 1.05;
    for (let i = 0; i < spec.world.obstacleCount; i += 1) {
      const lane = (i % 3) - 1;
      obstacles.push({ x: lane * 4, y: 1, z: 12 + i * (spec.world.size * 1.1 / spec.world.obstacleCount) + random() * 5, sx: 1.25, sy: 1 + random() * 1.7, sz: 1.1 });
    }
    for (let i = 0; i < Math.max(18, spec.collectible.count); i += 1) {
      const lane = (i % 3) - 1;
      collectibles.push({ id: i, x: lane * 4, y: 1.2, z: 8 + i * 5.5, vx: 0, vy: 0, vz: 0, radius: 0.45, health: 1, maxHealth: 1, cooldown: 0, phase: i, value: spec.collectible.scoreValue, lane });
    }
  }

  if (spec.template === "platformer") {
    const start = -half + 4; platforms.push({ x: start, y: 0, z: 0, w: 12, h: 1, d: 6 }); let x = start + 8;
    for (let i = 0; i < spec.world.platformCount; i += 1) {
      const w = 3 + random() * 4; const gap = 1.4 + random() * 2.2; const y = random() * Math.min(6, spec.world.verticality);
      platforms.push({ x, y, z: 0, w, h: 0.7, d: 5 });
      if (i % 2 === 0) collectibles.push({ id: i, x, y: y + 1.2, z: 0, vx: 0, vy: 0, vz: 0, radius: 0.4, health: 1, maxHealth: 1, cooldown: 0, phase: i, value: spec.collectible.scoreValue });
      x += w + gap;
    }
    platforms.push({ x, y: 1, z: 0, w: 10, h: 1, d: 6 }); player.x = start; player.y = 1.6; player.z = 0;
  }

  if (spec.template === "puzzle") {
    const target = clamp(spec.objective.target, 3, 8);
    for (let i = 0; i < target; i += 1) {
      const angle = i / target * Math.PI * 2;
      nodes.push({ id: i + 1, x: Math.cos(angle) * half * 0.55, y: 1.25, z: Math.sin(angle) * half * 0.55, vx: 0, vy: 0, vz: 0, radius: 1, health: 1, maxHealth: 1, cooldown: 0, phase: angle, order: i + 1, active: false });
    }
  }

  return {
    status: "ready", player, enemies, collectibles, projectiles: [], particles: [], obstacles, platforms, nodes,
    progress: 0, score: 0, defeated: 0, collected: 0, elapsed: 0, distance: 0, puzzleIndex: 0,
    message: spec.narrative.openingLine, messageUntil: 4, yaw: 0, pitch: spec.template === "flight" ? 0 : -18 * DEG,
    zoom: spec.template === "platformer" ? 22 : spec.template === "flight" ? 16 : 15, targetLane: 0, grounded: true,
    lastAttack: -10, lastDamage: -10, fps: 60, fpsFrames: 0, fpsClock: 0,
    flightSpeed: spec.flight?.cruiseSpeed || 20, stamina: 100, roll: 0, wingPhase: 0, windX: 0, windZ: 0,
    narrativeProgress: -1,
    speaker: spec.runtimeContent.dialogue.find((line) => line.trigger === "opening")?.speaker || "Mission Control",
    dialogueText: spec.runtimeContent.dialogue.find((line) => line.trigger === "opening")?.line || spec.runtimeContent.opening,
    storyBeat: spec.runtimeContent.storyBeats[0] || spec.runtimeContent.opening,
  };
}

function burst(state: RuntimeState, x: number, y: number, z: number, color: string, count: number, force = 5) {
  for (let i = 0; i < count; i += 1) {
    const angle = Math.random() * Math.PI * 2; const velocity = (0.35 + Math.random()) * force;
    state.particles.push({ x, y, z, vx: Math.cos(angle) * velocity, vy: 1 + Math.random() * velocity, vz: Math.sin(angle) * velocity, life: 0.45 + Math.random() * 0.65, maxLife: 1, size: 0.08 + Math.random() * 0.14, color });
  }
}
function resolveBoxCollision(player: Entity, box: Box) {
  const minX = box.x - box.sx - player.radius; const maxX = box.x + box.sx + player.radius;
  const minZ = box.z - box.sz - player.radius; const maxZ = box.z + box.sz + player.radius;
  if (player.x > minX && player.x < maxX && player.z > minZ && player.z < maxZ && player.y < box.y + box.sy + 1) {
    const dx = Math.min(Math.abs(player.x - minX), Math.abs(maxX - player.x)); const dz = Math.min(Math.abs(player.z - minZ), Math.abs(maxZ - player.z));
    if (dx < dz) player.x = player.x < box.x ? minX : maxX; else player.z = player.z < box.z ? minZ : maxZ;
  }
}

function updateGame(state: RuntimeState, spec: GameBuildSpec, keys: Set<string>, dt: number, time: number, tone: (f: number, d: number, t?: OscillatorType, v?: number) => void) {
  state.elapsed += dt; state.player.cooldown -= dt;
  const p = state.player; const half = spec.world.size / 2;

  if (spec.templateFamily === "kart-racing") {
    const accelerate = (keys.has("w") || keys.has("arrowup") ? 1 : 0) - (keys.has("s") || keys.has("arrowdown") ? 1 : 0);
    const steer = (keys.has("d") || keys.has("arrowright") ? 1 : 0) - (keys.has("a") || keys.has("arrowleft") ? 1 : 0);
    const resetPressed = keys.has("r");
    if (resetPressed) {
      keys.delete("r");
      p.x = 0; p.z = 0; p.vx = 0; p.vz = 0; state.yaw = 0; state.pitch = 0; state.zoom = 8; state.flightSpeed = 0; state.stamina = 100; state.roll = 0;
    }
    const maxForwardSpeed = 22; const maxReverseSpeed = 7; const acceleration = 15; const reverseAcceleration = 8; const brakingForce = 22; const coastingFriction = 7; const steeringRate = 1.35;
    const forward = state.flightSpeed >= 0 ? 1 : -1;
    if (accelerate > 0) {
      state.flightSpeed = Math.min(maxForwardSpeed, state.flightSpeed + acceleration * dt);
    } else if (accelerate < 0) {
      if (state.flightSpeed > 0.2) state.flightSpeed = Math.max(0, state.flightSpeed - brakingForce * dt);
      else if (state.flightSpeed < -0.2) state.flightSpeed += reverseAcceleration * dt;
      else state.flightSpeed = Math.max(-maxReverseSpeed, state.flightSpeed - reverseAcceleration * dt * 0.5);
    } else {
      state.flightSpeed = state.flightSpeed > 0 ? Math.max(0, state.flightSpeed - coastingFriction * dt) : Math.min(0, state.flightSpeed + coastingFriction * dt * 0.7);
    }
    const desiredSteer = steer * (state.flightSpeed > 0.5 ? 0.7 : 0.3);
    state.yaw += (desiredSteer - state.yaw * 0.18) * Math.min(1, dt * steeringRate * (Math.abs(state.flightSpeed) < 0.7 ? 0.4 : 1));
    const direction = Math.sin(state.yaw); const forwardZ = Math.cos(state.yaw);
    p.x += direction * state.flightSpeed * dt;
    p.z += forwardZ * state.flightSpeed * dt;
    p.x = clamp(p.x, -half + 2, half - 2);
    p.z = clamp(p.z, -half + 2, half - 2);
    p.phase = state.yaw;
    state.pitch = clamp(state.pitch + (state.flightSpeed > 0 ? -0.01 : 0.01) * dt, -0.15, 0.15);
    state.roll = clamp(state.roll + (desiredSteer * 0.18 - state.roll) * Math.min(1, dt * 3.4), -0.18, 0.18);
    state.zoom = clamp(state.zoom + (8.4 + Math.min(2.2, Math.abs(state.flightSpeed) * 0.08) - state.zoom) * Math.min(1, dt * 2.4), 7.2, 10.8);
    state.progress = Math.max(state.progress, Math.abs(p.x) + Math.abs(p.z));
    state.flightSpeed = clamp(state.flightSpeed, -maxReverseSpeed, maxForwardSpeed);
    state.player = p;
  } else if (spec.template === "flight") {
    const flight = spec.flight || { creature: "bird" as const, cruiseSpeed: 20, maxSpeed: 44, flapLift: 8.5, glideEfficiency: 0.86, turnRate: 1.65, windStrength: 5.5, thermalCount: 7, freeRoam: true };
    const turn = (keys.has("d") || keys.has("arrowright") ? 1 : 0) - (keys.has("a") || keys.has("arrowleft") ? 1 : 0);
    const pitchInput = (keys.has("w") || keys.has("arrowup") ? 1 : 0) - (keys.has("s") || keys.has("arrowdown") ? 1 : 0);
    state.yaw += turn * flight.turnRate * dt;
    state.pitch = clamp(state.pitch + pitchInput * 1.05 * dt, -0.62, 0.62);
    state.roll += (clamp(-turn * 0.72, -0.72, 0.72) - state.roll) * Math.min(1, dt * 4.5);
    const diving = keys.has("shift"); const braking = keys.has("control") || keys.has("ctrl"); const flapping = keys.has(" ");
    if (diving) state.pitch = clamp(state.pitch - 0.2 * dt, -0.62, 0.62);
    const targetSpeed = braking ? Math.max(8, flight.cruiseSpeed * 0.48) : diving ? flight.maxSpeed : flight.cruiseSpeed + Math.max(0, -state.pitch) * 8;
    state.flightSpeed += (targetSpeed - state.flightSpeed) * Math.min(1, dt * (diving ? 2.8 : 1.35));
    if (flapping && state.stamina > 3 && time - state.lastAttack > 0.18) {
      state.lastAttack = time; state.stamina = Math.max(0, state.stamina - 5.5); state.flightSpeed = Math.min(flight.maxSpeed, state.flightSpeed + 3.8); p.vy += flight.flapLift * 0.42; state.wingPhase = 0;
      burst(state, p.x, p.y, p.z, spec.visual.player, 5, 1.8); tone(120, 0.09, "triangle", 0.025);
    }
    state.wingPhase += dt * (flapping ? 18 : 4.5);
    const weatherMultiplier = spec.world.weather === "rain" ? 1.35 : spec.world.weather === "mist" ? 1.15 : 1;
    state.windX = Math.sin(time * 0.17 + terrainSeed(spec)) * flight.windStrength * weatherMultiplier;
    state.windZ = Math.cos(time * 0.13 - terrainSeed(spec) * 0.4) * flight.windStrength * 0.62 * weatherMultiplier;
    const cp = Math.cos(state.pitch); const forwardX = Math.sin(state.yaw) * cp; const forwardY = Math.sin(state.pitch); const forwardZ = Math.cos(state.yaw) * cp;
    const sink = (1 - flight.glideEfficiency) * 5.5 + Math.max(0, flight.cruiseSpeed - state.flightSpeed) * 0.045;
    p.vy += (forwardY * state.flightSpeed * 0.24 - sink) * dt; p.vy *= Math.pow(0.94, dt * 60);
    p.x += (forwardX * state.flightSpeed + state.windX * 0.32) * dt; p.z += (forwardZ * state.flightSpeed + state.windZ * 0.32) * dt; p.y += (forwardY * state.flightSpeed * 0.62 + p.vy) * dt; p.phase = state.yaw;
    const nearThermal = state.nodes.find((node) => Math.hypot(p.x - node.x, p.z - node.z) < node.radius);
    if (nearThermal) { p.y += 6.8 * dt; state.stamina = Math.min(100, state.stamina + 18 * dt); if (Math.random() < dt * 10) burst(state, p.x, p.y - 2, p.z, spec.visual.secondaryAccent, 2, 1.2); }
    state.stamina = clamp(state.stamina + (flapping ? -2.2 : diving ? -1.2 : 9.5) * dt, 0, 100);
    const ground = terrainHeight(spec, p.x, p.z) + 1.15;
    if (p.y < ground) {
      const impact = Math.max(0, state.flightSpeed - 12); p.y = ground; p.vy = 0; state.flightSpeed = Math.max(6, state.flightSpeed * 0.58);
      if (impact > 9 && time - state.lastDamage > 0.8) { p.health -= Math.min(28, impact * 0.72); state.lastDamage = time; tone(70, 0.18, "sawtooth", 0.05); }
      state.pitch = Math.max(state.pitch, 0.04);
    }
    const boundary = half * 0.97;
    if (p.x > boundary) p.x = -boundary; if (p.x < -boundary) p.x = boundary; if (p.z > boundary) p.z = -boundary; if (p.z < -boundary) p.z = boundary;
    for (const item of state.collectibles) {
      if (!item.dead && Math.hypot(item.x - p.x, item.y - p.y, item.z - p.z) < 3.2) {
        item.dead = true; state.collected += 1; state.progress = state.collected; state.score += item.value || 100; burst(state, item.x, item.y, item.z, spec.visual.collectible, 28, 6); tone(760, 0.13, "sine", 0.045);
      }
    }
    state.progress = state.collected;
  } else if (spec.template === "runner") {
    if (keys.has("a") || keys.has("arrowleft")) { state.targetLane = Math.max(-1, state.targetLane - 1); keys.delete("a"); keys.delete("arrowleft"); }
    if (keys.has("d") || keys.has("arrowright")) { state.targetLane = Math.min(1, state.targetLane + 1); keys.delete("d"); keys.delete("arrowright"); }
    const accelerating = keys.has("w") || keys.has("arrowup");
    const braking = keys.has("s") || keys.has("arrowdown");
    const boosting = keys.has("shift") && state.stamina > 1;
    const cruiseSpeed = spec.player.speed * 1.45;
    const targetSpeed = braking ? cruiseSpeed * 0.48 : accelerating ? cruiseSpeed * 1.22 : cruiseSpeed * 0.82;
    const boostedTarget = boosting ? targetSpeed * spec.player.dashMultiplier : targetSpeed;
    state.flightSpeed += (boostedTarget - state.flightSpeed) * Math.min(1, dt * (braking ? 5.5 : 2.8));
    state.stamina = clamp(state.stamina + (boosting ? -24 : 13) * dt, 0, 100);
    p.x += (state.targetLane * 4 - p.x) * Math.min(1, dt * (8 + state.flightSpeed * 0.12));
    p.z += state.flightSpeed * dt;
    p.phase = 0;
    state.distance = p.z * 8;
    for (const box of state.obstacles) if (Math.abs(box.z - p.z) < box.sz + 1 && Math.abs(box.x - p.x) < box.sx + 0.7 && box.kind !== "hit") { box.kind = "hit"; p.health -= spec.enemy.damage * 1.4; state.flightSpeed = Math.max(cruiseSpeed * 0.36, state.flightSpeed * 0.52); state.lastDamage = time; burst(state, p.x, p.y, p.z, spec.visual.enemy, 18, 7); tone(90, 0.16, "sawtooth", 0.07); }
    for (const item of state.collectibles) if (!item.dead && Math.abs(item.z - p.z) < 1.2 && Math.abs(item.x - p.x) < 1.2) { item.dead = true; state.collected += 1; state.score += item.value || 100; burst(state, item.x, item.y, item.z, spec.visual.collectible, 14, 4); tone(680, 0.08, "sine", 0.04); }
    state.progress = Math.min(spec.objective.target, Math.floor(state.distance));
  } else if (spec.template === "platformer") {
    const input = (keys.has("d") || keys.has("arrowright") ? 1 : 0) - (keys.has("a") || keys.has("arrowleft") ? 1 : 0); p.vx = input * spec.player.speed * 0.9; p.x += p.vx * dt;
    if ((keys.has(" ") || keys.has("w") || keys.has("arrowup")) && state.grounded) { p.vy = spec.player.jumpForce; state.grounded = false; tone(260, 0.1, "square", 0.035); keys.delete(" "); }
    p.vy -= 26 * dt; const previousY = p.y; p.y += p.vy * dt; state.grounded = false;
    for (const platform of state.platforms) { const top = platform.y + platform.h; const within = p.x > platform.x - platform.w / 2 - p.radius && p.x < platform.x + platform.w / 2 + p.radius; if (within && previousY - p.radius >= top - 0.18 && p.y - p.radius <= top && p.vy <= 0) { p.y = top + p.radius; p.vy = 0; state.grounded = true; } }
    if (p.y < -8) { p.health -= 25; p.x = Math.max(-half + 4, p.x - 8); p.y = 8; p.vy = 0; state.lastDamage = time; tone(80, 0.2, "sawtooth", 0.06); }
    for (const item of state.collectibles) if (!item.dead && Math.hypot(item.x - p.x, item.y - p.y) < 1.3) { item.dead = true; state.collected += 1; state.score += item.value || 100; burst(state, item.x, item.y, item.z, spec.visual.collectible, 12, 4); tone(720, 0.08, "sine", 0.04); }
    const final = state.platforms[state.platforms.length - 1]; state.progress = p.x > final.x ? 1 : 0;
  } else {
    let inputX = (keys.has("d") || keys.has("arrowright") ? 1 : 0) - (keys.has("a") || keys.has("arrowleft") ? 1 : 0);
    let inputZ = (keys.has("s") || keys.has("arrowdown") ? 1 : 0) - (keys.has("w") || keys.has("arrowup") ? 1 : 0);
    const length = length2(inputX, inputZ) || 1; inputX /= length; inputZ /= length; const sprint = keys.has("shift") ? spec.player.dashMultiplier : 1; const speed = spec.player.speed * sprint;
    const sin = Math.sin(state.yaw); const cos = Math.cos(state.yaw); const worldX = inputX * cos - inputZ * sin; const worldZ = inputX * sin + inputZ * cos;
    p.x += worldX * speed * dt; p.z += worldZ * speed * dt; if (Math.abs(worldX) + Math.abs(worldZ) > 0.1) p.phase = Math.atan2(worldX, worldZ);
    p.x = clamp(p.x, -half + 1, half - 1); p.z = clamp(p.z, -half + 1, half - 1); for (const box of state.obstacles) resolveBoxCollision(p, box);
    const attacking = keys.has(" ") || keys.has("attack") || keys.has("mouse0");
    if (attacking && time - state.lastAttack >= spec.player.attackCooldown) { state.lastAttack = time; keys.delete("attack"); keys.delete("mouse0"); const directionX = Math.sin(p.phase || state.yaw); const directionZ = Math.cos(p.phase || state.yaw); state.projectiles.push({ id: Date.now(), x: p.x + directionX, y: 1.35, z: p.z + directionZ, vx: directionX * 22, vy: 0, vz: directionZ * 22, radius: 0.22, health: 1, maxHealth: 1, cooldown: 1.4, phase: 0 }); burst(state, p.x, 1.2, p.z, spec.visual.projectile, 8, 4); tone(170, 0.06, "square", 0.045); }
    for (const shot of state.projectiles) { shot.x += shot.vx * dt; shot.y += shot.vy * dt; shot.z += shot.vz * dt; shot.cooldown -= dt; for (const enemy of state.enemies) { if (enemy.dead || shot.dead) continue; if (Math.hypot(shot.x - enemy.x, shot.z - enemy.z) < enemy.radius + shot.radius && Math.abs(shot.y - enemy.y) < 1.5) { shot.dead = true; enemy.health -= spec.player.attackPower; burst(state, shot.x, shot.y, shot.z, spec.visual.projectile, 10, 5); tone(110, 0.07, "triangle", 0.035); if (enemy.health <= 0) { enemy.dead = true; state.defeated += 1; state.score += 250; burst(state, enemy.x, enemy.y, enemy.z, spec.visual.enemy, 25, 8); tone(65, 0.15, "sawtooth", 0.055); } } } }
    state.projectiles = state.projectiles.filter((shot) => !shot.dead && shot.cooldown > 0 && Math.abs(shot.x) < half + 10 && Math.abs(shot.z) < half + 10);
    for (const enemy of state.enemies) { if (enemy.dead) continue; const dx = p.x - enemy.x; const dz = p.z - enemy.z; const distance = Math.hypot(dx, dz) || 1; enemy.phase = Math.atan2(dx, dz); const activeDistance = spec.enemy.behavior === "guard" ? 9 : 18; if (distance < activeDistance || spec.enemy.behavior === "swarm") { const movement = spec.enemy.speed * (spec.enemy.behavior === "swarm" ? 1.15 : 1); enemy.x += dx / distance * movement * dt; enemy.z += dz / distance * movement * dt; } else if (spec.enemy.behavior === "patrol") { enemy.x += Math.sin(time * 0.7 + enemy.id) * dt; enemy.z += Math.cos(time * 0.6 + enemy.id) * dt; } enemy.cooldown -= dt; if (distance < enemy.radius + p.radius + 0.25 && enemy.cooldown <= 0) { enemy.cooldown = 0.75; p.health -= spec.enemy.damage; state.lastDamage = time; burst(state, p.x, p.y, p.z, spec.visual.enemy, 14, 6); tone(85, 0.12, "sawtooth", 0.055); } }
    for (const item of state.collectibles) if (!item.dead && Math.hypot(item.x - p.x, item.z - p.z) < item.radius + p.radius + 0.25) { item.dead = true; state.collected += 1; state.score += item.value || 100; burst(state, item.x, item.y, item.z, spec.visual.collectible, 16, 5); tone(700, 0.08, "sine", 0.04); }
    if (spec.template === "puzzle" && (keys.has("e") || keys.has("interact"))) { keys.delete("e"); keys.delete("interact"); const nearby = state.nodes.filter((node) => !node.active).sort((a, b) => Math.hypot(a.x - p.x, a.z - p.z) - Math.hypot(b.x - p.x, b.z - p.z))[0]; if (nearby && Math.hypot(nearby.x - p.x, nearby.z - p.z) < 3.1) { const expected = spec.puzzleSequence[state.puzzleIndex]; if (nearby.order === expected) { nearby.active = true; state.puzzleIndex += 1; state.score += 300; burst(state, nearby.x, nearby.y, nearby.z, spec.visual.accent, 22, 6); tone(440 + state.puzzleIndex * 90, 0.15, "sine", 0.055); } else { for (const node of state.nodes) node.active = false; state.puzzleIndex = 0; p.health -= 8; state.lastDamage = time; tone(95, 0.18, "sawtooth", 0.05); } } }
    if (spec.template === "arena") state.progress = state.defeated; else if (spec.template === "survival") state.progress = Math.min(spec.objective.target, Math.floor(state.elapsed)); else if (spec.template === "collector") state.progress = state.collected; else if (spec.template === "puzzle") state.progress = state.puzzleIndex;
  }

  for (const particle of state.particles) { particle.x += particle.vx * dt; particle.y += particle.vy * dt; particle.z += particle.vz * dt; particle.vy -= 7 * dt; particle.vx *= 0.985; particle.vz *= 0.985; particle.life -= dt; }
  state.particles = state.particles.filter((particle) => particle.life > 0);

  const questCount = Math.max(1, spec.runtimeContent.quests.length);
  const narrativeStep = Math.min(questCount - 1, Math.max(0, Math.floor(state.progress)));
  if (narrativeStep !== state.narrativeProgress) {
    state.narrativeProgress = narrativeStep;
    const questLine = spec.runtimeContent.dialogue.find((line) => line.trigger === "quest" && line.questIndex === narrativeStep)
      || spec.runtimeContent.dialogue.find((line) => line.trigger === "quest");
    if (questLine) { state.speaker = questLine.speaker; state.dialogueText = questLine.line; }
    state.storyBeat = spec.runtimeContent.storyBeats[Math.min(narrativeStep, spec.runtimeContent.storyBeats.length - 1)] || state.storyBeat;
  }

  if (p.health <= 0) {
    p.health = 0; state.status = "defeat"; state.speaker = "Mission Failed"; state.dialogueText = spec.runtimeContent.defeat; tone(55, 0.5, "sawtooth", 0.07);
  } else if (state.progress >= spec.objective.target) {
    state.status = "victory"; state.speaker = "Mission Complete"; state.dialogueText = spec.runtimeContent.victory; state.storyBeat = spec.runtimeContent.storyBeats.at(-1) || state.storyBeat; tone(523, 0.16, "sine", 0.05); window.setTimeout(() => tone(659, 0.2, "sine", 0.045), 120);
  }
}

function cameraFor(state: RuntimeState, spec: GameBuildSpec): { eye: Vec3; target: Vec3 } {
  const p = state.player;
  if (spec.templateFamily === "kart-racing") {
    const forwardX = Math.sin(state.yaw);
    const forwardZ = Math.cos(state.yaw);
    const chaseDistance = 8.4 + Math.min(2.2, Math.abs(state.flightSpeed) * 0.08);
    const eye: Vec3 = [p.x - forwardX * chaseDistance, p.y + 4.6, p.z - forwardZ * chaseDistance];
    const target: Vec3 = [p.x + forwardX * 6.2, p.y + 1.2, p.z + forwardZ * 6.2];
    return { eye, target };
  }
  if (spec.template === "flight") { const cp = Math.cos(state.pitch); const fx = Math.sin(state.yaw) * cp; const fy = Math.sin(state.pitch); const fz = Math.cos(state.yaw) * cp; const distance = state.zoom; return { eye: [p.x - fx * distance, p.y + 4.2 - fy * distance * 0.35, p.z - fz * distance], target: [p.x + fx * 10, p.y + fy * 7, p.z + fz * 10] }; }
  if (spec.template === "platformer") return { eye: [p.x, p.y + 5, state.zoom], target: [p.x + 2, p.y + 1, 0] };
  if (spec.template === "runner") return { eye: [p.x * 0.25, p.y + 6, p.z - 13], target: [p.x, p.y + 1, p.z + 10] };
  if (spec.perspective === "top-down") return { eye: [p.x + Math.sin(state.yaw) * 4, p.y + state.zoom * 1.3, p.z + Math.cos(state.yaw) * 4], target: [p.x, p.y, p.z] };
  const horizontal = Math.cos(state.pitch) * state.zoom;
  return { eye: [p.x - Math.sin(state.yaw) * horizontal, p.y + 4 - Math.sin(state.pitch) * state.zoom, p.z - Math.cos(state.yaw) * horizontal], target: [p.x, p.y + 1, p.z] };
}

function renderScene(renderer: Renderer, state: RuntimeState, spec: GameBuildSpec, width: number, height: number, time: number) {
  const { gl, uniforms } = renderer; const sky = hexToRgb(spec.visual.sky); const fog = hexToRgb(spec.visual.fog);
  gl.viewport(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight); gl.clearColor(sky[0], sky[1], sky[2], 1); gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT); gl.useProgram(renderer.program);
  const camera = cameraFor(state, spec); gl.uniformMatrix4fv(uniforms.projection, false, perspective(spec.renderer.fieldOfView * DEG, width / Math.max(1, height), 0.08, spec.template === "flight" ? 650 : 420)); gl.uniformMatrix4fv(uniforms.view, false, lookAt(camera.eye, camera.target)); gl.uniform3f(uniforms.camera, ...camera.eye); gl.uniform3f(uniforms.fogColor, ...fog); gl.uniform1f(uniforms.fogNear, spec.template === "flight" ? 70 : spec.template === "runner" ? 25 : 28); gl.uniform1f(uniforms.fogFar, spec.template === "flight" ? spec.world.size * 0.92 : spec.template === "runner" ? 105 : spec.world.size * 1.25); gl.uniform3f(uniforms.lightDir, -0.45, -1, 0.25); gl.uniform1f(uniforms.time, time);
  const drawCube = (position: Vec3, scale: Vec3, color: string, emissive = 0, yaw = 0, pitch = 0, roll = 0) => drawMesh(renderer, renderer.cube, modelMatrix(position, scale, yaw, pitch, roll), color, emissive);
  const drawSphere = (position: Vec3, scale: Vec3, color: string, emissive = 0, yaw = 0, pitch = 0, roll = 0) => drawMesh(renderer, renderer.sphere, modelMatrix(position, scale, yaw, pitch, roll), color, emissive);
  const drawCylinder = (position: Vec3, scale: Vec3, color: string, emissive = 0, yaw = 0, pitch = 0, roll = 0) => drawMesh(renderer, renderer.cylinder, modelMatrix(position, scale, yaw, pitch, roll), color, emissive);

  if (spec.templateFamily === "kart-racing") {
    drawCube([0, -0.55, 0], [spec.world.size * 0.62, 0.45, spec.world.size * 0.62], spec.visual.ground, 0.08);
    const p = state.player;
    const bodyY = p.y + 0.45;
    const bodyScale: Vec3 = [1.25, 0.42, 2.05];
    drawCube([p.x, bodyY, p.z] as Vec3, bodyScale, spec.visual.player, 0.14, state.yaw, 0, 0);
    drawCube([p.x, bodyY + 0.38, p.z - 0.18] as Vec3, [0.8, 0.28, 0.98] as Vec3, spec.visual.accent, 0.18, state.yaw, 0, 0);
    for (const [x, z] of [[-0.62, -1.12], [0.62, -1.12], [-0.62, 1.12], [0.62, 1.12]]) {
      drawCylinder([p.x + x, p.y + 0.26, p.z + z], [0.26, 0.16, 0.26], spec.visual.secondaryAccent, 0.1, state.yaw, Math.PI / 2, 0);
    }
  } else if (spec.template === "flight") {
    drawCube([0, -1.25, 0], [spec.world.size * 0.62, 0.45, spec.world.size * 0.62], "#1f78a8", 0.08);
    drawMesh(renderer, renderer.terrain, mat4Identity(), spec.visual.ground, 0);
    const sunX = Math.sin(time * 0.012) * 90; const sunY = 58 + Math.cos(time * 0.012) * 18; drawSphere([sunX, sunY, -90], [5, 5, 5], "#fff3b0", 1.1);
    for (let i = 0; i < 18; i += 1) { const seed = i * 19.17 + terrainSeed(spec); const x = ((Math.sin(seed) * 0.5 + 0.5) * spec.world.size - spec.world.size / 2 + time * (0.7 + i % 3 * 0.15) + spec.world.size * 2) % spec.world.size - spec.world.size / 2; const z = Math.cos(seed * 1.7) * 0.46 * spec.world.size; const y = 31 + (i % 5) * 5 + Math.sin(seed) * 3; for (let puff = 0; puff < 4; puff += 1) drawSphere([x + puff * 2.1, y + Math.sin(puff) * 0.8, z + Math.cos(puff) * 1.4], [3.5 + puff * 0.4, 1.7 + puff * 0.2, 2.2], "#eef8ff", 0.04); }
    for (const box of state.obstacles) {
      if (box.kind === "tree") { drawCylinder([box.x, box.y + box.sy * 0.42, box.z], [0.22, box.sy * 0.42, 0.22], "#5b3a29"); drawSphere([box.x, box.y + box.sy, box.z], [box.sx * 1.2, box.sy * 0.48, box.sz * 1.2], "#214f2b"); drawSphere([box.x + 0.5, box.y + box.sy * 0.82, box.z - 0.3], [box.sx * 0.8, box.sy * 0.32, box.sz * 0.8], "#2f6b38"); }
      else if (box.kind === "rock") drawSphere([box.x, box.y + box.sy * 0.35, box.z], [box.sx * 1.4, box.sy * 0.55, box.sz * 1.3], "#5d665f");
      else if (box.kind === "village") { drawCube([box.x, box.y + box.sy * 0.5, box.z], [box.sx, box.sy * 0.5, box.sz], "#d8c3a5"); drawCube([box.x, box.y + box.sy + box.sy * 0.18, box.z], [box.sx * 1.15, box.sy * 0.2, box.sz * 1.15], "#7d3f2a", 0, 0, 0, 0.18); }
      else if (box.kind === "waterfall") drawCube([box.x, box.y + box.sy * 0.7, box.z], [0.35, box.sy * 0.9, 1.2], "#b7ecff", 0.38);
    }
    for (const node of state.nodes) { const pulse = 1 + Math.sin(time * 2 + node.id) * 0.12; drawCylinder([node.x, node.y + 6, node.z], [node.radius * pulse, 0.035, node.radius * pulse], spec.visual.secondaryAccent, 0.42); drawCylinder([node.x, node.y + 13, node.z], [node.radius * 0.72, 0.025, node.radius * 0.72], spec.visual.secondaryAccent, 0.28); }
    for (const item of state.collectibles) { if (item.dead) continue; const spin = time * 1.4 + item.phase; drawCylinder([item.x, item.y, item.z], [2.4, 0.08, 2.4], spec.visual.collectible, 0.75, spin); drawSphere([item.x, item.y, item.z], [0.42, 0.42, 0.42], "#ffffff", 1); }
    const p = state.player; const cp = Math.cos(state.pitch); const fx = Math.sin(state.yaw) * cp; const fy = Math.sin(state.pitch); const fz = Math.cos(state.yaw) * cp; const rightX = Math.cos(state.yaw); const rightZ = -Math.sin(state.yaw); const flap = Math.sin(state.wingPhase) * 0.52;
    drawSphere([p.x, p.y, p.z], [0.58, 0.44, 1.28], spec.visual.player, 0.04, state.yaw, state.pitch, state.roll);
    drawSphere([p.x + fx * 1.05, p.y + fy * 0.7 + 0.18, p.z + fz * 1.05], [0.43, 0.4, 0.55], "#f4f1e8", 0.05, state.yaw, state.pitch, state.roll);
    drawCube([p.x + fx * 1.52, p.y + fy * 0.9 + 0.12, p.z + fz * 1.52], [0.13, 0.1, 0.45], "#e0a62b", 0.08, state.yaw, state.pitch, state.roll);
    drawCube([p.x + rightX * 1.45, p.y + 0.05 + flap * 0.45, p.z + rightZ * 1.45], [1.45, 0.08, 0.52], spec.visual.player, 0.02, state.yaw, state.pitch, state.roll - flap);
    drawCube([p.x - rightX * 1.45, p.y + 0.05 + flap * 0.45, p.z - rightZ * 1.45], [1.45, 0.08, 0.52], spec.visual.player, 0.02, state.yaw, state.pitch, state.roll + flap);
    drawCube([p.x - fx * 1.18, p.y - fy * 0.45 - 0.12, p.z - fz * 1.18], [0.65, 0.07, 0.72], spec.visual.player, 0.02, state.yaw, state.pitch, state.roll);
  } else {
    if (spec.template === "runner") {
      for (let segment = Math.floor(state.player.z / 18) - 2; segment < Math.floor(state.player.z / 18) + 9; segment += 1) { drawCube([0, -0.55, segment * 18], [7, 0.5, 9], spec.visual.ground); drawCube([-7.3, 0.1, segment * 18], [0.12, 0.05, 9], spec.visual.accent, 0.45); drawCube([7.3, 0.1, segment * 18], [0.12, 0.05, 9], spec.visual.secondaryAccent, 0.45); for (const lane of [-1, 1]) drawCube([lane * 2, 0.02, segment * 18], [0.035, 0.02, 9], "#64748b", 0.1); }
    } else if (spec.template !== "platformer") {
      drawCube([0, -0.75, 0], [spec.world.size / 2, 0.7, spec.world.size / 2], spec.visual.ground);
      for (let i = -Math.floor(spec.world.size / 8); i <= Math.floor(spec.world.size / 8); i += 1) { drawCube([i * 4, 0.01, 0], [0.025, 0.02, spec.world.size / 2], spec.visual.accent, 0.08); drawCube([0, 0.012, i * 4], [spec.world.size / 2, 0.02, 0.025], spec.visual.secondaryAccent, 0.06); }
    }
    for (const platform of state.platforms) drawCube([platform.x, platform.y, platform.z], [platform.w / 2, platform.h / 2, platform.d / 2], spec.visual.ground);
    for (const box of state.obstacles) { if (spec.template === "runner" && box.z < state.player.z - 10) continue; drawCube([box.x, box.y, box.z], [box.sx, box.sy, box.sz], box.kind === "tower" ? spec.visual.horizon : spec.visual.ground, box.kind === "hit" ? 0.15 : 0, box.x * 0.13); if (box.kind === "tower") drawCube([box.x, box.y + box.sy + 0.08, box.z], [box.sx * 0.8, 0.08, box.sz * 0.8], spec.visual.accent, 0.35); }
    const drawCharacter = (entity: Entity, bodyColor: string, accentColor: string, ghost = false) => { const bob = Math.sin(time * 5 + entity.id) * 0.04; const yaw = entity.phase; drawCube([entity.x, entity.y + bob, entity.z], [0.42, 0.65, 0.28], bodyColor, ghost ? 0.25 : 0, yaw); drawSphere([entity.x, entity.y + 0.92 + bob, entity.z], [0.33, 0.33, 0.33], accentColor, ghost ? 0.45 : 0.05); drawCube([entity.x + Math.cos(yaw) * 0.42, entity.y + 0.05 + bob, entity.z - Math.sin(yaw) * 0.42], [0.14, 0.48, 0.14], bodyColor, 0, yaw); drawCube([entity.x - Math.cos(yaw) * 0.42, entity.y + 0.05 + bob, entity.z + Math.sin(yaw) * 0.42], [0.14, 0.48, 0.14], bodyColor, 0, yaw); drawCube([entity.x + 0.2, entity.y - 0.8 + bob, entity.z], [0.15, 0.45, 0.16], bodyColor); drawCube([entity.x - 0.2, entity.y - 0.8 + bob, entity.z], [0.15, 0.45, 0.16], bodyColor); drawCube([entity.x, -0.04, entity.z], [0.55, 0.025, 0.55], "#020617"); };
    const drawVehicle = (entity: Entity, bodyColor: string, accentColor: string) => {
      const yaw = entity.phase;
      drawCube([entity.x, entity.y - 0.18, entity.z], [0.95, 0.3, 1.7], bodyColor, 0.05, yaw);
      drawCube([entity.x, entity.y + 0.25, entity.z - 0.1], [0.72, 0.28, 0.72], accentColor, 0.08, yaw);
      drawCube([entity.x, entity.y + 0.24, entity.z + 0.5], [0.65, 0.22, 0.05], "#bde8ff", 0.22, yaw);
      drawCube([entity.x, entity.y + 0.24, entity.z - 0.68], [0.65, 0.08, 0.05], spec.visual.enemy, 0.48, yaw);
      for (const side of [-1, 1]) for (const front of [-1, 1]) {
        drawCylinder([entity.x + side * 0.82, entity.y - 0.42, entity.z + front * 1.05], [0.3, 0.16, 0.3], "#09090b", 0, yaw, 0, Math.PI / 2);
      }
      drawCube([entity.x, 0.01, entity.z], [1.05, 0.025, 1.85], "#020617");
    };
    for (const item of state.collectibles) { if (item.dead) continue; const floating = Math.sin(time * 2.2 + item.phase) * 0.25; drawSphere([item.x, item.y + floating, item.z], [0.38, 0.55, 0.38], spec.visual.collectible, 0.8); drawCylinder([item.x, 0.07, item.z], [0.55, 0.025, 0.55], spec.visual.collectible, 0.12); }
    for (const node of state.nodes) { const pulse = 0.75 + Math.sin(time * 2 + node.id) * 0.15; drawCylinder([node.x, node.y * 0.5, node.z], [0.7, node.y * 0.5, 0.7], node.active ? spec.visual.secondaryAccent : spec.visual.horizon, node.active ? 0.75 : 0.1); drawSphere([node.x, node.y + 1, node.z], [pulse, pulse, pulse], node.active ? spec.visual.secondaryAccent : spec.visual.accent, node.active ? 1 : 0.5); }
    for (const enemy of state.enemies) { if (enemy.dead) continue; drawCharacter(enemy, spec.visual.enemy, spec.visual.horizon); const ratio = enemy.health / enemy.maxHealth; drawCube([enemy.x, enemy.y + 1.65, enemy.z], [0.55, 0.035, 0.04], "#111827"); drawCube([enemy.x - (1 - ratio) * 0.55, enemy.y + 1.66, enemy.z - 0.01], [0.55 * ratio, 0.045, 0.05], spec.visual.enemy, 0.3); }
    for (const shot of state.projectiles) drawSphere([shot.x, shot.y, shot.z], [shot.radius, shot.radius, shot.radius], spec.visual.projectile, 1);
    if (spec.templateFamily === "driving-racing") drawVehicle(state.player, spec.visual.player, spec.visual.accent);
    else drawCharacter(state.player, spec.visual.player, spec.visual.accent);
  }

  for (const particle of state.particles) { const ratio = particle.life / particle.maxLife; drawSphere([particle.x, particle.y, particle.z], [particle.size * ratio, particle.size * ratio, particle.size * ratio], particle.color, 0.8); }
  if (spec.world.weather !== "clear") { const count = spec.quality === "ultra" ? 70 : spec.quality === "high" ? 45 : 25; for (let i = 0; i < count; i += 1) { const a = i * 12.9898; const x = state.player.x + ((Math.sin(a + time * 0.1) * 43758.5453) % 1) * 22; const z = state.player.z + ((Math.sin(a * 1.7 + time * 0.12) * 24634.6345) % 1) * 22; const cycle = (time * (spec.world.weather === "rain" ? 12 : 2) + i * 1.7) % 14; const y = state.player.y + 7 - cycle; const color = spec.world.weather === "embers" ? "#fb923c" : spec.world.weather === "snow" ? "#f8fafc" : "#b7ecff"; drawSphere([x, y, z], [0.035, 0.12, 0.035], color, 0.35); } }
}

export const GameRuntime3D = forwardRef<GameRuntime3DHandle, Props>(function GameRuntime3D({ spec, onStats, onReady }, ref) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null); const stateRef = useRef<RuntimeState | null>(null); const rendererRef = useRef<Renderer | null>(null); const keysRef = useRef(new Set<string>()); const frameRef = useRef<number | null>(null); const lastRef = useRef(0); const dragRef = useRef({ active: false, x: 0, y: 0 }); const audioRef = useRef<AudioContext | null>(null); const [bootError, setBootError] = useState(""); const [started, setStarted] = useState(false);
  const tone = useCallback((frequency: number, duration: number, type: OscillatorType = "sine", volume = 0.04) => { try { const context = audioRef.current || new AudioContext(); audioRef.current = context; if (context.state === "suspended") void context.resume(); const oscillator = context.createOscillator(); const gain = context.createGain(); oscillator.type = type; oscillator.frequency.setValueAtTime(frequency, context.currentTime); gain.gain.setValueAtTime(volume, context.currentTime); gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + duration); oscillator.connect(gain).connect(context.destination); oscillator.start(); oscillator.stop(context.currentTime + duration); } catch { /* browser audio is optional */ } }, []);
  const launch = useCallback(() => { const canvas = canvasRef.current; if (!canvas) return; stateRef.current = createState(spec); stateRef.current.status = "playing"; lastRef.current = performance.now(); setStarted(true); canvas.focus(); tone(220, 0.08, "sine", 0.03); }, [spec, tone]);
  useImperativeHandle(ref, () => ({ restart: launch, recoverCheckpoint: launch, togglePause() { const state = stateRef.current; if (!state || state.status === "victory" || state.status === "defeat") return; state.status = state.status === "paused" ? "playing" : "paused"; if (state.status === "playing") lastRef.current = performance.now(); }, focus() { canvasRef.current?.focus(); } }), [launch]);
  useEffect(() => {
    const canvas = canvasRef.current; if (!canvas) return; let renderer: Renderer;
    try { renderer = createRenderer(canvas, spec); rendererRef.current = renderer; } catch (error) { setBootError(error instanceof Error ? error.message : "The 3D renderer could not start."); return; }
    stateRef.current = createState(spec); const keys = keysRef.current;
    const resize = () => { const rect = canvas.getBoundingClientRect(); const dpr = Math.min(window.devicePixelRatio || 1, spec.quality === "ultra" ? 1.85 : spec.quality === "high" ? 1.5 : 1.2) * spec.renderer.renderScale; canvas.width = Math.max(640, Math.floor(rect.width * dpr)); canvas.height = Math.max(360, Math.floor(rect.height * dpr)); };
    const keyDown = (event: KeyboardEvent) => { const key = event.key.toLowerCase(); if (["arrowup", "arrowdown", "arrowleft", "arrowright", " "].includes(key)) event.preventDefault(); keys.add(key); const state = stateRef.current; if (!state) return; if (key === "p") state.status = state.status === "paused" ? "playing" : state.status === "playing" ? "paused" : state.status; if (key === "r") launch(); if (key === "f" && document.fullscreenElement === null) void canvas.parentElement?.requestFullscreen(); if (state.status === "ready" && ["enter", " "].includes(key)) launch(); };
    const keyUp = (event: KeyboardEvent) => keys.delete(event.key.toLowerCase());
    const pointerDown = (event: PointerEvent) => { if (stateRef.current?.status === "ready") { launch(); return; } dragRef.current = { active: true, x: event.clientX, y: event.clientY }; if (spec.template !== "flight") keys.add("mouse0"); canvas.setPointerCapture?.(event.pointerId); canvas.focus(); };
    const pointerMove = (event: PointerEvent) => { const drag = dragRef.current; const state = stateRef.current; if (!drag.active || !state) return; const dx = event.clientX - drag.x; const dy = event.clientY - drag.y; state.yaw -= dx * (spec.template === "flight" ? 0.0045 : 0.006); state.pitch = clamp(state.pitch - dy * (spec.template === "flight" ? 0.0035 : 0.004), spec.template === "flight" ? -0.62 : -0.82, spec.template === "flight" ? 0.62 : 0.22); drag.x = event.clientX; drag.y = event.clientY; };
    const pointerUp = (event: PointerEvent) => { dragRef.current.active = false; keys.delete("mouse0"); canvas.releasePointerCapture?.(event.pointerId); };
    const wheel = (event: WheelEvent) => { event.preventDefault(); const state = stateRef.current; if (state) state.zoom = clamp(state.zoom + event.deltaY * 0.012, 8, 30); };
    window.addEventListener("resize", resize); window.addEventListener("keydown", keyDown, { passive: false }); window.addEventListener("keyup", keyUp); canvas.addEventListener("pointerdown", pointerDown); canvas.addEventListener("pointermove", pointerMove); canvas.addEventListener("pointerup", pointerUp); canvas.addEventListener("pointercancel", pointerUp); canvas.addEventListener("wheel", wheel, { passive: false }); resize(); onReady?.();
    const loop = (now: number) => { const rect = canvas.getBoundingClientRect(); const state = stateRef.current; const activeRenderer = rendererRef.current; if (!state || !activeRenderer || rect.width <= 0 || rect.height <= 0) { frameRef.current = requestAnimationFrame(loop); return; } const dt = Math.min(0.033, Math.max(0, (now - (lastRef.current || now)) / 1000)); lastRef.current = now; if (state.status === "playing") updateGame(state, spec, keys, dt, now / 1000, tone); state.fpsFrames += 1; if (now - state.fpsClock > 500) { state.fps = Math.round(state.fpsFrames / Math.max(0.001, (now - state.fpsClock) / 1000)); state.fpsFrames = 0; state.fpsClock = now; } renderScene(activeRenderer, state, spec, rect.width, rect.height, now / 1000); onStats?.({ health: Math.max(0, Math.round(state.player.health)), maxHealth: state.player.maxHealth, score: state.score, progress: state.progress, target: spec.objective.target, elapsed: state.elapsed, status: state.status, defeated: state.defeated, collected: state.collected, objectiveText: spec.runtimeContent.quests[Math.min(Math.max(0, Math.floor(state.progress)), Math.max(0, spec.runtimeContent.quests.length - 1))]?.instruction || spec.objective.description, speaker: state.speaker, dialogueText: state.dialogueText, storyBeat: state.storyBeat, fps: state.fps, renderer: "Native WebGL 2", altitude: spec.template === "flight" ? Math.max(0, Math.round(state.player.y - terrainHeight(spec, state.player.x, state.player.z))) : undefined, speed: spec.template === "flight" || spec.templateFamily === "driving-racing" ? Math.round(state.flightSpeed) : undefined, stamina: spec.template === "flight" || spec.templateFamily === "driving-racing" ? Math.round(state.stamina) : undefined, wind: spec.template === "flight" ? Math.round(Math.hypot(state.windX, state.windZ)) : undefined, weather: spec.world.weather }); frameRef.current = requestAnimationFrame(loop); };
    frameRef.current = requestAnimationFrame(loop);
    return () => { if (frameRef.current) cancelAnimationFrame(frameRef.current); window.removeEventListener("resize", resize); window.removeEventListener("keydown", keyDown); window.removeEventListener("keyup", keyUp); canvas.removeEventListener("pointerdown", pointerDown); canvas.removeEventListener("pointermove", pointerMove); canvas.removeEventListener("pointerup", pointerUp); canvas.removeEventListener("pointercancel", pointerUp); canvas.removeEventListener("wheel", wheel); };
  }, [spec, onReady, onStats, launch, tone]);
  return <div className="relative h-full w-full overflow-hidden bg-black"><canvas ref={canvasRef} tabIndex={0} aria-label={`${spec.title} native WebGL 3D playtest`} className="h-full w-full cursor-crosshair outline-none" />{bootError && <div className="absolute inset-0 grid place-items-center bg-zinc-950 p-8 text-center"><div className="max-w-lg rounded-3xl border border-red-400/20 bg-red-400/10 p-7"><p className="text-lg font-black text-red-200">3D renderer unavailable</p><p className="mt-3 leading-7 text-red-100/70">{bootError}</p></div></div>}{!started && !bootError && <button type="button" onClick={launch} className="absolute inset-0 grid cursor-pointer place-items-center bg-[radial-gradient(circle_at_center,rgba(139,92,246,.12),rgba(0,0,0,.72))] text-center"><span className="rounded-[28px] border border-white/15 bg-black/65 px-8 py-7 shadow-2xl backdrop-blur-xl"><strong className="block text-2xl font-black sm:text-3xl">Launch 3D Playtest</strong><span className="mt-2 block text-sm text-zinc-300">{spec.templateFamily === "open-world-flight" ? "Open-world flight · W/S pitch · A/D bank · Space flap · Shift dive · Ctrl brake" : spec.templateFamily === "driving-racing" ? "Driving · A/D steer · W accelerate · S brake · Shift boost" : "Third-person action · WASD move · Space jump · F/Click attack · E interact · Right-drag camera"}</span></span></button>}</div>;
});
