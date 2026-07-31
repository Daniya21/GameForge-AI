"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import * as pc from "playcanvas";
import type { WorldLayout } from "@/app/types/game";
import { resolveGameforgeModelUrl } from "@/lib/game-assets/local-model-store";
import { ensurePlayCanvasContainerHandler, loadPlayCanvasGlb } from "@/lib/playcanvas/runtime";

type Props = {
  mode: "character" | "world";
  modelUrl?: string | null;
  label: string;
  layout?: WorldLayout | null;
  status?: string;
};

function color(hex: string) {
  const safe = /^#[0-9a-f]{6}$/i.test(hex) ? hex : "#8b5cf6";
  return new pc.Color(
    Number.parseInt(safe.slice(1, 3), 16) / 255,
    Number.parseInt(safe.slice(3, 5), 16) / 255,
    Number.parseInt(safe.slice(5, 7), 16) / 255,
  );
}

function material(hex: string, emissive?: string) {
  const result = new pc.StandardMaterial();
  result.diffuse = color(hex);
  result.metalness = 0.08;
  result.gloss = 0.38;
  if (emissive) {
    result.emissive = color(emissive);
    result.emissiveIntensity = 1.4;
  }
  result.update();
  return result;
}

function primitive(
  app: pc.Application,
  type: "box" | "sphere" | "capsule" | "cylinder" | "cone" | "plane",
  name: string,
  position: [number, number, number],
  scale: [number, number, number],
  mat: pc.Material,
  parent?: pc.Entity,
) {
  const entity = new pc.Entity(name);
  entity.addComponent("render", { type, material: mat });
  entity.setPosition(...position);
  entity.setLocalScale(...scale);
  (parent || app.root).addChild(entity);
  return entity;
}

function createCharacterFallback(app: pc.Application, root: pc.Entity) {
  const body = material("#6d5ce7");
  const accent = material("#34d3cf", "#1b8b88");
  const dark = material("#171827");
  primitive(app, "sphere", "Head", [0, 2.45, 0], [0.62, 0.68, 0.62], accent, root);
  primitive(app, "box", "Torso", [0, 1.45, 0], [1.05, 1.3, 0.62], body, root);
  primitive(app, "box", "Chest accent", [0, 1.58, -0.35], [0.66, 0.25, 0.12], accent, root);
  primitive(app, "box", "Left arm", [-0.74, 1.45, 0], [0.3, 1.25, 0.34], body, root);
  primitive(app, "box", "Right arm", [0.74, 1.45, 0], [0.3, 1.25, 0.34], body, root);
  primitive(app, "box", "Left leg", [-0.3, 0.4, 0], [0.36, 1.12, 0.44], dark, root);
  primitive(app, "box", "Right leg", [0.3, 0.4, 0], [0.36, 1.12, 0.44], dark, root);
}

function regionColor(kind: string, index: number) {
  const colors: Record<string, string> = {
    urban: "#6b7280",
    interior: "#7c5a45",
    nature: "#3f8f62",
    mountain: "#675d70",
    water: "#2d8fb4",
    industrial: "#8b5a3c",
    fantasy: "#7659a8",
    lunar: "#8f96a6",
  };
  return colors[kind] || ["#6d5ce7", "#34d3cf", "#e7a951"][index % 3];
}

function createPreviewWorldProp(app: pc.Application, root: pc.Entity, prop: NonNullable<WorldLayout["props"]>[number]) {
  const x = prop.position[0] * 0.8;
  const z = prop.position[1] * 0.8;
  const y = Math.max(0, prop.elevation * 0.25);
  const sx = Math.max(0.25, prop.scale[0] * 0.42);
  const sy = Math.max(0.18, prop.scale[1] * 0.42);
  const sz = Math.max(0.25, prop.scale[2] * 0.42);
  const utility = material(prop.interactive ? "#32d6c5" : "#70798c", prop.interactive ? "#137b71" : undefined);
  const dark = material("#252936");
  let entity: pc.Entity;

  if (prop.kind === "crater") {
    entity = primitive(app, "cylinder", prop.name, [x, 0.02, z], [sx, 0.08, sz], dark, root);
  } else if (prop.kind === "rock" || prop.kind === "crystal") {
    entity = primitive(app, prop.kind === "crystal" ? "cone" : "sphere", prop.name, [x, y + sy * 0.45, z], [sx, sy, sz], utility, root);
  } else if (prop.kind === "tree" || prop.kind === "antenna" || prop.kind === "beacon" || prop.kind === "streetlight") {
    entity = primitive(app, "cylinder", prop.name, [x, y + sy * 0.5, z], [Math.min(sx, 0.42), sy, Math.min(sz, 0.42)], utility, root);
    primitive(app, prop.kind === "tree" ? "cone" : "sphere", `${prop.name} top`, [x, y + sy, z], [sx, Math.max(0.35, sy * 0.35), sz], utility, root);
  } else if (prop.kind === "solar-panel" || prop.kind === "bridge" || prop.kind === "dock" || prop.kind === "barrier") {
    entity = primitive(app, "box", prop.name, [x, y + sy * 0.3, z], [sx, Math.min(sy, 0.5), sz], utility, root);
  } else {
    entity = primitive(app, prop.kind === "habitat" ? "cylinder" : "box", prop.name, [x, y + sy * 0.5, z], [sx, sy, sz], utility, root);
  }
  entity.setEulerAngles(0, prop.rotation, prop.kind === "solar-panel" ? -18 : 0);
}

function createWorldFallback(app: pc.Application, root: pc.Entity, layout?: WorldLayout | null) {
  const ground = material("#26382f");
  primitive(app, "cylinder", "World foundation", [0, -1.1, 0], [18, 1.4, 18], ground, root);
  const regions = layout?.regions?.length ? layout.regions : [
    { id: "center", name: "Central district", description: "Core region", kind: "urban" as const, position: [0, 0] as [number, number], radius: 7, elevation: 2 },
    { id: "ridge", name: "High ridge", description: "Elevated region", kind: "mountain" as const, position: [-8, 6] as [number, number], radius: 5, elevation: 6 },
    { id: "water", name: "Waterfront", description: "Water region", kind: "water" as const, position: [9, 5] as [number, number], radius: 5, elevation: 0 },
    { id: "wild", name: "Green belt", description: "Natural region", kind: "nature" as const, position: [6, -8] as [number, number], radius: 5, elevation: 2 },
  ];
  regions.slice(0, 7).forEach((region, index) => {
    const mat = material(regionColor(region.kind, index), index === 0 ? "#302b6b" : undefined);
    const x = region.position[0] * 0.8;
    const z = region.position[1] * 0.8;
    const radius = Math.max(2.2, Math.min(7, region.radius * 0.55));
    const height = Math.max(0.8, Math.min(7, region.elevation * 0.55 + 1.2));
    if (region.kind === "mountain" || region.kind === "fantasy") {
      primitive(app, "cone", region.name, [x, height * 0.48, z], [radius, height, radius], mat, root);
    } else if (region.kind === "lunar") {
      primitive(app, "cylinder", `${region.name} regolith`, [x, -0.2, z], [radius, 0.35, radius], mat, root);
      for (let crater = 0; crater < 4; crater += 1) {
        const angle = crater / 4 * Math.PI * 2 + index;
        primitive(app, "cylinder", `${region.name} crater ${crater + 1}`, [x + Math.cos(angle) * radius * 0.48, -0.02, z + Math.sin(angle) * radius * 0.48], [1.2 + crater * 0.35, 0.08, 1.2 + crater * 0.35], material("#3d414a"), root);
      }
    } else if (region.kind === "water") {
      primitive(app, "cylinder", region.name, [x, -0.45, z], [radius, 0.18, radius], mat, root);
    } else {
      primitive(app, "cylinder", region.name, [x, height * 0.22, z], [radius, Math.max(0.5, height * 0.45), radius], mat, root);
      const towerCount = region.kind === "urban" || region.kind === "industrial" ? 4 : 2;
      for (let tower = 0; tower < towerCount; tower += 1) {
        const angle = (tower / towerCount) * Math.PI * 2 + index;
        primitive(
          app,
          region.kind === "nature" ? "cone" : "box",
          `${region.name} feature ${tower + 1}`,
          [x + Math.cos(angle) * radius * 0.5, height * 0.6, z + Math.sin(angle) * radius * 0.5],
          [0.8 + (tower % 2) * 0.45, 1.5 + tower * 0.6, 0.8 + (tower % 2) * 0.45],
          mat,
          root,
        );
      }
    }
  });

  for (const prop of layout?.props?.slice(0, 90) || []) {
    createPreviewWorldProp(app, root, prop);
  }

}

function entityBounds(instance: pc.Entity) {
  const renders = instance.findComponents("render") as unknown as Array<{ meshInstances?: Array<{ aabb?: { center?: pc.Vec3; halfExtents?: pc.Vec3 } }> }>;
  const min = new pc.Vec3(Infinity, Infinity, Infinity);
  const max = new pc.Vec3(-Infinity, -Infinity, -Infinity);
  let found = false;
  for (const render of renders) {
    for (const mesh of render.meshInstances || []) {
      const aabb = mesh.aabb;
      if (!aabb?.center || !aabb.halfExtents) continue;
      min.x = Math.min(min.x, aabb.center.x - aabb.halfExtents.x);
      min.y = Math.min(min.y, aabb.center.y - aabb.halfExtents.y);
      min.z = Math.min(min.z, aabb.center.z - aabb.halfExtents.z);
      max.x = Math.max(max.x, aabb.center.x + aabb.halfExtents.x);
      max.y = Math.max(max.y, aabb.center.y + aabb.halfExtents.y);
      max.z = Math.max(max.z, aabb.center.z + aabb.halfExtents.z);
      found = true;
    }
  }
  return found ? { min, max } : null;
}

async function loadModel(app: pc.Application, root: pc.Entity, modelUrl: string, mode: "character" | "world") {
  const resolved = await resolveGameforgeModelUrl(modelUrl);
  try {
    const asset = await loadPlayCanvasGlb(app, resolved.url, `${mode}.glb`);
    const containerResource = asset.resource as pc.ContainerResource;
    const instance = containerResource.instantiateRenderEntity({ castShadows: true, receiveShadows: true });
    root.addChild(instance);
    const bounds = entityBounds(instance);
    if (bounds) {
      const sizeY = Math.max(0.001, bounds.max.y - bounds.min.y);
      const sizeAll = Math.max(bounds.max.x - bounds.min.x, sizeY, bounds.max.z - bounds.min.z);
      const target = mode === "character" ? 4.8 : 34;
      const scale = Math.max(0.02, Math.min(12, target / (mode === "character" ? sizeY : sizeAll)));
      const centerX = (bounds.min.x + bounds.max.x) / 2;
      const centerZ = (bounds.min.z + bounds.max.z) / 2;
      instance.setLocalScale(scale, scale, scale);
      instance.setLocalPosition(-centerX * scale, -bounds.min.y * scale, -centerZ * scale);
    }
    for (const child of root.children) {
      if (child !== instance && child.name.startsWith("Fallback")) child.enabled = false;
    }
    return true;
  } catch (error) {
    console.warn("GameForge could not load the preview GLB.", error);
    return false;
  } finally {
    resolved.revoke();
  }
}

export default function ModelPreview3D({ mode, modelUrl, label, layout, status }: Props) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [message, setMessage] = useState("Preparing stylized 3D preview…");
  const layoutKey = useMemo(() => JSON.stringify(layout || null), [layout]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    let disposed = false;
    let app: pc.Application | null = null;
    let observer: ResizeObserver | null = null;

    const probe = document.createElement("canvas");
    if (!probe.getContext("webgl2", { alpha: true, antialias: false, powerPreference: "default" })) {
      queueMicrotask(() => setMessage("WebGL 2 is unavailable. Enable browser hardware acceleration to view the live 3D preview."));
      return;
    }

    try {
      app = new pc.Application(canvas, {
        graphicsDeviceOptions: { alpha: true, antialias: false, powerPreference: "default", stencil: false },
      });
      ensurePlayCanvasContainerHandler(app);
      const compatibilityDevice = app.graphicsDevice as unknown as { supportsMultiDraw?: boolean; maxPixelRatio?: number };
      if (compatibilityDevice.supportsMultiDraw) {
        try { compatibilityDevice.supportsMultiDraw = false; } catch { /* read-only on some engine builds */ }
      }
      if (typeof compatibilityDevice.maxPixelRatio === "number") {
        compatibilityDevice.maxPixelRatio = Math.min(window.devicePixelRatio || 1, 1.5);
      }
    } catch (error) {
      console.warn("GameForge could not start the PlayCanvas preview.", error);
      queueMicrotask(() => setMessage("The live 3D preview could not start on this graphics driver. The generated GLB is still saved to the project."));
      return;
    }

    if (!app) return;

    const onContextLost = (event: Event) => {
      event.preventDefault();
      if (!disposed) setMessage("The browser lost the 3D graphics context. Refresh this page to restore the preview.");
    };
    canvas.addEventListener("webglcontextlost", onContextLost, false);

    app.setCanvasFillMode(pc.FILLMODE_NONE);
    app.setCanvasResolution(pc.RESOLUTION_AUTO);
    app.scene.ambientLight = new pc.Color(0.42, 0.45, 0.58);
    app.scene.exposure = 1.08;

    const resize = () => app?.resizeCanvas(Math.max(300, canvas.clientWidth), Math.max(260, canvas.clientHeight));
    resize();
    observer = new ResizeObserver(resize);
    observer.observe(canvas);

    const camera = new pc.Entity("Preview camera");
    camera.addComponent("camera", { clearColor: new pc.Color(0.025, 0.02, 0.055, 0), fov: mode === "character" ? 38 : 42, farClip: 260 });
    if (camera.camera) {
      camera.camera.gammaCorrection = pc.GAMMA_SRGB;
      camera.camera.toneMapping = pc.TONEMAP_ACES;
    }
    app.root.addChild(camera);
    const sun = new pc.Entity("Preview sun");
    sun.addComponent("light", { type: "directional", intensity: 1.8, color: new pc.Color(1, 0.91, 0.8), castShadows: false });
    sun.setEulerAngles(45, -35, 0);
    app.root.addChild(sun);
    const rim = new pc.Entity("Preview rim");
    rim.addComponent("light", { type: "omni", intensity: 2.3, range: 18, color: new pc.Color(0.25, 0.78, 0.95) });
    rim.setPosition(-5, 5, 4);
    app.root.addChild(rim);

    const root = new pc.Entity("Preview root");
    app.root.addChild(root);
    let orbitYaw = mode === "character" ? 0.72 : 0.78;
    let orbitPitch = mode === "character" ? 0.22 : 0.52;
    let orbitDistance = mode === "character" ? 9.4 : 27;
    const orbitTargetY = mode === "character" ? 1.35 : 2.4;
    let dragging = false;
    let previousX = 0;
    let previousY = 0;

    const updateCamera = () => {
      const horizontal = Math.cos(orbitPitch) * orbitDistance;
      camera.setPosition(
        Math.sin(orbitYaw) * horizontal,
        orbitTargetY + Math.sin(orbitPitch) * orbitDistance,
        Math.cos(orbitYaw) * horizontal,
      );
      camera.lookAt(0, orbitTargetY, 0);
    };

    const onPointerDown = (event: PointerEvent) => {
      dragging = true;
      previousX = event.clientX;
      previousY = event.clientY;
      canvas.setPointerCapture?.(event.pointerId);
    };
    const onPointerMove = (event: PointerEvent) => {
      if (!dragging) return;
      const dx = event.clientX - previousX;
      const dy = event.clientY - previousY;
      previousX = event.clientX;
      previousY = event.clientY;
      orbitYaw -= dx * 0.008;
      orbitPitch = Math.max(0.08, Math.min(1.12, orbitPitch + dy * 0.006));
      updateCamera();
    };
    const onPointerUp = (event: PointerEvent) => {
      dragging = false;
      canvas.releasePointerCapture?.(event.pointerId);
    };
    const onWheel = (event: WheelEvent) => {
      event.preventDefault();
      const minimum = mode === "character" ? 6.2 : 16;
      const maximum = mode === "character" ? 15 : 48;
      orbitDistance = Math.max(minimum, Math.min(maximum, orbitDistance + event.deltaY * 0.018));
      updateCamera();
    };
    canvas.addEventListener("pointerdown", onPointerDown);
    canvas.addEventListener("pointermove", onPointerMove);
    canvas.addEventListener("pointerup", onPointerUp);
    canvas.addEventListener("pointercancel", onPointerUp);
    canvas.addEventListener("wheel", onWheel, { passive: false });
    if (mode === "character") {
      const fallback = new pc.Entity("Fallback character");
      root.addChild(fallback);
      createCharacterFallback(app, fallback);
      primitive(app, "cylinder", "Character plinth", [0, -0.15, 0], [2.3, 0.18, 2.3], material("#202033", "#3a2a6f"), root);
      updateCamera();
    } else {
      const fallback = new pc.Entity("Fallback world");
      root.addChild(fallback);
      createWorldFallback(app, fallback, layout);
      updateCamera();
    }

    if (modelUrl) {
      queueMicrotask(() => setMessage("Loading generated Tripo GLB…"));
      void loadModel(app, root, modelUrl, mode).then((loaded) => {
        if (!disposed) setMessage(loaded ? "Generated 3D asset connected" : "The generated GLB could not load, so the stylized fallback remains active");
      });
    } else {
      queueMicrotask(() => setMessage(mode === "character" ? "Stylized procedural character preview" : "Structured world map rendered in 3D"));
    }

    app.on("update", (dt: number) => {
      if (!dragging) {
        orbitYaw += dt * (mode === "character" ? 0.16 : 0.07);
        updateCamera();
      }
    });
    app.start();

    return () => {
      disposed = true;
      canvas.removeEventListener("webglcontextlost", onContextLost, false);
      canvas.removeEventListener("pointerdown", onPointerDown);
      canvas.removeEventListener("pointermove", onPointerMove);
      canvas.removeEventListener("pointerup", onPointerUp);
      canvas.removeEventListener("pointercancel", onPointerUp);
      canvas.removeEventListener("wheel", onWheel);
      observer?.disconnect();
      app?.destroy();
    };
  }, [mode, modelUrl, layout, layoutKey]);

  return (
    <div className={`relative w-full overflow-hidden rounded-[26px] border border-white/10 bg-[radial-gradient(circle_at_50%_30%,rgba(124,92,231,.22),rgba(2,6,23,.92)_70%)] ${mode === "world" ? "aspect-video min-h-[500px]" : "aspect-[4/3] min-h-[360px]"}`}>
      <canvas ref={canvasRef} className="h-full w-full" aria-label={`${label} stylized 3D preview`} />
      <div className="pointer-events-none absolute left-4 top-4 rounded-full border border-white/10 bg-black/45 px-3 py-2 text-[10px] font-black uppercase tracking-[0.14em] text-zinc-300 backdrop-blur-xl">
        Drag to orbit · wheel to zoom
      </div>
      <div className="pointer-events-none absolute inset-x-4 bottom-4 flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-black/55 px-4 py-3 backdrop-blur-xl">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.16em] text-cyan-200">Stylized 3D</p>
          <p className="mt-1 text-sm font-bold text-white">{label}</p>
        </div>
        <span className="max-w-[52%] text-right text-xs leading-5 text-zinc-300">{status || message}</span>
      </div>
    </div>
  );
}
