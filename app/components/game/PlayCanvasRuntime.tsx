"use client";

import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";
import * as pc from "playcanvas";
import type { GameBuildSpec, RuntimeStats, WorldLayoutProp } from "@/app/types/game";
import type { GameRuntime3DHandle } from "./GameRuntime3D";
import { resolveGameforgeModelUrl } from "@/lib/game-assets/local-model-store";
import { ensurePlayCanvasContainerHandler, loadPlayCanvasGlb } from "@/lib/playcanvas/runtime";
import { buildWorldAdaptedCircuit } from "@/lib/game-runtime/world-adaptation";

type Props = {
  spec: GameBuildSpec;
  onStats?: (stats: RuntimeStats) => void;
  onReady?: () => void;
  onRuntimeError?: (message: string) => void;
};

type MissionStage = NonNullable<GameBuildSpec["thirdPerson"]>["missionStages"][number];

type RuntimeState = {
  status: RuntimeStats["status"];
  health: number;
  score: number;
  progress: number;
  defeated: number;
  collected: number;
  elapsed: number;
  objectiveText: string;
  fps: number;
  paused: boolean;
  lastFrame: number;
  frameCount: number;
  fpsClock: number;
  cameraYaw: number;
  cameraPitch: number;
  cameraDistance: number;
  speed: number;
  steeringInput: number;
  currentSteerAngle: number;
  driftCharge: number;
  boostRemaining: number;
  isDrifting: boolean;
  lastSafePosition: pc.Vec3 | null;
  lastSafeRotation: number;
  altitude: number;
  stamina: number;
  wind: number;
  speaker: string;
  dialogueText: string;
  storyBeat: string;
  jumpVelocity: number;
  raceState: RuntimeStats["raceState"];
  raceStateBeforePause: RuntimeStats["raceState"] | null;
  countdownValue: number | string;
  countdownText: string;
  currentLap: number;
  lapCount: number;
  currentCheckpoint: number;
  checkpointCount: number;
  currentLapTime: number;
  totalRaceTime: number;
  bestLapTime: number;
  completedLapTimes: number[];
  speedKph: number;
  boostPercent: number;
  finishPosition: number;
  wrongWay: boolean;
};

type GuardState = {
  entity: pc.Entity;
  start: pc.Vec3;
  target: pc.Vec3;
  direction: number;
  stunnedUntil: number;
};

type CollisionBox = { x: number; z: number; halfX: number; halfZ: number };

const DEFAULT_STATS: RuntimeStats = {
  health: 100,
  maxHealth: 100,
  score: 0,
  progress: 0,
  target: 1,
  elapsed: 0,
  status: "ready",
  defeated: 0,
  collected: 0,
  objectiveText: "Preparing PlayCanvas runtime",
  renderer: "PlayCanvas",
  fps: 0,
  raceState: "LOADING",
  currentLap: 1,
  lapCount: 1,
  currentCheckpoint: 0,
  checkpointCount: 0,
  currentLapTime: 0,
  totalRaceTime: 0,
  bestLapTime: 0,
  completedLapTimes: [],
  speedKph: 0,
  boostPercent: 0,
  finishPosition: 0,
  wrongWay: false,
  countdownValue: 3,
  countdownText: "Ready",
};

function hexColor(value: string, fallback = "#ffffff") {
  const hex = /^#[0-9a-f]{6}$/i.test(value) ? value : fallback;
  return new pc.Color(
    Number.parseInt(hex.slice(1, 3), 16) / 255,
    Number.parseInt(hex.slice(3, 5), 16) / 255,
    Number.parseInt(hex.slice(5, 7), 16) / 255,
  );
}

function makeMaterial(color: string, options?: { emissive?: string; metalness?: number; gloss?: number; opacity?: number }) {
  const material = new pc.StandardMaterial();
  material.diffuse = hexColor(color);
  material.metalness = options?.metalness ?? 0.15;
  material.gloss = options?.gloss ?? 0.45;
  if (options?.emissive) {
    material.emissive = hexColor(options.emissive);
    material.emissiveIntensity = 2.1;
  }
  if (typeof options?.opacity === "number" && options.opacity < 1) {
    material.opacity = options.opacity;
    material.blendType = pc.BLEND_NORMAL;
    material.depthWrite = false;
  }
  material.update();
  return material;
}

function createPrimitive(
  app: pc.Application,
  type: "box" | "sphere" | "capsule" | "cylinder" | "cone" | "plane",
  name: string,
  position: [number, number, number],
  scale: [number, number, number],
  material: pc.Material,
  parent?: pc.Entity,
) {
  const entity = new pc.Entity(name);
  entity.addComponent("render", { type, material });
  entity.setPosition(...position);
  entity.setLocalScale(...scale);
  (parent || app.root).addChild(entity);
  return entity;
}


function createHumanoidFallback(
  app: pc.Application,
  name: string,
  material: pc.Material,
  parent: pc.Entity,
  accentMaterial?: pc.Material,
) {
  const root = new pc.Entity(name);
  parent.addChild(root);
  const accent = accentMaterial || material;
  createPrimitive(app, "sphere", `${name} head`, [0, 2.35, 0], [0.58, 0.58, 0.58], accent, root);
  createPrimitive(app, "box", `${name} torso`, [0, 1.35, 0], [0.92, 1.25, 0.52], material, root);
  createPrimitive(app, "box", `${name} left arm`, [-0.68, 1.35, 0], [0.28, 1.22, 0.3], material, root);
  createPrimitive(app, "box", `${name} right arm`, [0.68, 1.35, 0], [0.28, 1.22, 0.3], material, root);
  createPrimitive(app, "box", `${name} left leg`, [-0.27, 0.38, 0], [0.32, 1.05, 0.38], material, root);
  createPrimitive(app, "box", `${name} right leg`, [0.27, 0.38, 0], [0.32, 1.05, 0.38], material, root);
  return root;
}

function createVehicleFallback(
  app: pc.Application,
  parent: pc.Entity,
  bodyMaterial: pc.Material,
  darkMaterial: pc.Material,
) {
  const root = new pc.Entity("Fallback vehicle model");
  parent.addChild(root);
  createPrimitive(app, "box", "Vehicle body", [0, 0.72, 0], [2.15, 0.72, 4.1], bodyMaterial, root);
  createPrimitive(app, "box", "Vehicle cabin", [0, 1.28, -0.25], [1.65, 0.72, 1.95], bodyMaterial, root);
  for (const x of [-1.02, 1.02]) {
    for (const z of [-1.35, 1.35]) {
      const wheel = createPrimitive(app, "cylinder", "Vehicle wheel", [x, 0.42, z], [0.55, 0.32, 0.55], darkMaterial, root);
      wheel.setLocalEulerAngles(0, 0, 90);
    }
  }
  return root;
}

function createKartPlayerHierarchy(
  app: pc.Application,
  parent: pc.Entity,
  bodyMaterial: pc.Material,
  darkMaterial: pc.Material,
  accentMaterial: pc.Material,
) {
  const playerKart = new pc.Entity("PlayerKart");
  parent.addChild(playerKart);

  const kartBody = new pc.Entity("KartBody");
  playerKart.addChild(kartBody);

  const vehicleFallback = new pc.Entity("Fallback vehicle model");
  kartBody.addChild(vehicleFallback);

  createPrimitive(app, "box", "Kart lower chassis", [0, 0.52, 0], [1.86, 0.45, 2.85], darkMaterial, vehicleFallback);
  createPrimitive(app, "box", "Kart sculpted body", [0, 0.76, 0.12], [1.72, 0.52, 2.55], bodyMaterial, vehicleFallback);
  createPrimitive(app, "box", "Kart nose", [0, 0.68, 1.52], [1.25, 0.34, 0.52], accentMaterial, vehicleFallback);
  createPrimitive(app, "box", "Kart cockpit", [0, 1.0, -0.1], [1.08, 0.48, 1.2], accentMaterial, vehicleFallback);
  createPrimitive(app, "box", "Kart front bumper", [0, 0.55, 1.83], [1.35, 0.22, 0.18], accentMaterial, vehicleFallback);
  createPrimitive(app, "box", "Kart rear bumper", [0, 0.58, -1.78], [1.3, 0.22, 0.2], accentMaterial, vehicleFallback);
  createPrimitive(app, "box", "Kart rear engine", [0, 0.78, -1.46], [1.05, 0.48, 0.5], darkMaterial, vehicleFallback);
  createPrimitive(app, "box", "Kart spoiler", [0, 1.2, -1.68], [1.2, 0.14, 0.35], accentMaterial, vehicleFallback);
  createPrimitive(app, "box", "Kart left spoiler support", [-0.72, 0.94, -1.62], [0.12, 0.58, 0.12], darkMaterial, vehicleFallback);
  createPrimitive(app, "box", "Kart right spoiler support", [0.72, 0.94, -1.62], [0.12, 0.58, 0.12], darkMaterial, vehicleFallback);
  createPrimitive(app, "sphere", "Kart left headlight", [-0.55, 0.82, 1.48], [0.2, 0.16, 0.12], accentMaterial, vehicleFallback);
  createPrimitive(app, "sphere", "Kart right headlight", [0.55, 0.82, 1.48], [0.2, 0.16, 0.12], accentMaterial, vehicleFallback);
  createPrimitive(app, "box", "Kart steering column", [0.42, 1.06, 0.14], [0.14, 0.16, 0.6], darkMaterial, vehicleFallback);
  const steeringWheel = createPrimitive(app, "cylinder", "Kart steering wheel", [0.42, 1.12, 0.2], [0.3, 0.12, 0.3], accentMaterial, vehicleFallback);
  steeringWheel.setLocalEulerAngles(0, 90, 90);

  const wheelPositions: Array<[string, number, number]> = [
    ["FrontLeftWheel", -0.98, -1.18],
    ["FrontRightWheel", 0.98, -1.18],
    ["RearLeftWheel", -0.98, 1.18],
    ["RearRightWheel", 0.98, 1.18],
  ];
  wheelPositions.forEach(([name, x, z]) => {
    const wheel = createPrimitive(app, "cylinder", name, [x, 0.38, z], [0.46, 0.3, 0.46], darkMaterial, vehicleFallback);
    wheel.setLocalEulerAngles(0, 0, 90);
  });

  const driverSeat = new pc.Entity("DriverSeat");
  driverSeat.setLocalPosition(0, 0.96, 0.24);
  kartBody.addChild(driverSeat);

  const characterModel = new pc.Entity("CharacterModel");
  characterModel.setLocalPosition(0, 0.12, 0);
  characterModel.setLocalEulerAngles(0, 180, 0);
  driverSeat.addChild(characterModel);

  const cameraTarget = new pc.Entity("CameraTarget");
  cameraTarget.setLocalPosition(0, 1.95, -3.1);
  playerKart.addChild(cameraTarget);

  return { playerKart, kartBody, vehicleFallback, driverSeat, characterModel, cameraTarget };
}

type TrackSample = {
  position: pc.Vec3;
  tangent: pc.Vec3;
  up: pc.Vec3;
};

type TrackSpec = {
  trackName: string;
  controlPoints: Array<[number, number, number]>;
  roadWidth: number;
  barrierWidth: number;
  checkpointCount: number;
  spawnPosition: [number, number, number];
  spawnRotation: number;
  finishLinePosition: [number, number, number];
  finishLineRotation: number;
  shortcutData: { entry: [number, number, number]; exit: [number, number, number]; width: number };
  environmentTheme: string;
};

function buildGeargardenTrackSpec(spec: GameBuildSpec): TrackSpec {
  const adapted = buildWorldAdaptedCircuit(
    spec.world.layout,
    spec.buildId,
    spec.driving?.checkpointCount || 10,
  );
  return {
    ...adapted,
    barrierWidth: 1.2,
  };
}

function sampleTrackAt(controlPoints: Array<[number, number, number]>, t: number) {
  const closed = controlPoints.length;
  const scaledT = ((t % 1) + 1) % 1;
  const scaledIndex = scaledT * closed;
  const index = Math.floor(scaledIndex);
  const nextIndex = (index + 1) % closed;
  const prevIndex = (index + closed - 1) % closed;
  const nextNextIndex = (index + 2) % closed;
  const localT = scaledIndex - index;
  const p0 = controlPoints[prevIndex];
  const p1 = controlPoints[index];
  const p2 = controlPoints[nextIndex];
  const p3 = controlPoints[nextNextIndex];
  const t2 = localT * localT;
  const t3 = t2 * localT;
  const x = 0.5 * ((2 * p1[0]) + (-p0[0] + p2[0]) * localT + (2 * p0[0] - 5 * p1[0] + 4 * p2[0] - p3[0]) * t2 + (-p0[0] + 3 * p1[0] - 3 * p2[0] + p3[0]) * t3);
  const y = 0.5 * ((2 * p1[1]) + (-p0[1] + p2[1]) * localT + (2 * p0[1] - 5 * p1[1] + 4 * p2[1] - p3[1]) * t2 + (-p0[1] + 3 * p1[1] - 3 * p2[1] + p3[1]) * t3);
  const z = 0.5 * ((2 * p1[2]) + (-p0[2] + p2[2]) * localT + (2 * p0[2] - 5 * p1[2] + 4 * p2[2] - p3[2]) * t2 + (-p0[2] + 3 * p1[2] - 3 * p2[2] + p3[2]) * t3);
  return new pc.Vec3(x, y, z);
}

function generateTrackSamples(trackSpec: TrackSpec, sampleCount = 180): TrackSample[] {
  const samples: TrackSample[] = [];
  for (let index = 0; index < sampleCount; index += 1) {
    const base = index / sampleCount;
    const point = sampleTrackAt(trackSpec.controlPoints, base);
    const next = sampleTrackAt(trackSpec.controlPoints, base + 0.001);
    const tangent = next.clone().sub(point).normalize();
    const up = new pc.Vec3(0, 1, 0);
    samples.push({ position: point, tangent, up });
  }
  return samples;
}

function buildTrackRoad(app: pc.Application, parent: pc.Entity, samples: TrackSample[], roadWidth: number, roadMaterial: pc.Material, shoulderMaterial: pc.Material) {
  const roadRoot = new pc.Entity("Geargarden road");
  parent.addChild(roadRoot);
  for (let index = 0; index < samples.length; index += 1) {
    const sample = samples[index];
    const next = samples[(index + 1) % samples.length];
    const segmentLength = sample.position.distance(next.position);
    if (segmentLength < 0.4) continue;
    const midPoint = sample.position.clone().add(next.position).scale(0.5);
    const tangent = next.position.clone().sub(sample.position).normalize();
    const yaw = Math.atan2(tangent.x, tangent.z) * 180 / Math.PI;
    const segment = new pc.Entity(`Road segment ${index + 1}`);
    segment.addComponent("render", { type: "box", material: roadMaterial });
    segment.setPosition(midPoint.x, sample.position.y + 0.08, midPoint.z);
    segment.setLocalScale(roadWidth * 0.5, 0.18, segmentLength * 0.5);
    segment.setEulerAngles(0, yaw, 0);
    roadRoot.addChild(segment);
  }

  const shoulderRoot = new pc.Entity("Road shoulders");
  parent.addChild(shoulderRoot);
  for (let index = 0; index < samples.length; index += 1) {
    const sample = samples[index];
    const next = samples[(index + 1) % samples.length];
    const segmentLength = sample.position.distance(next.position);
    if (segmentLength < 0.4) continue;
    const midPoint = sample.position.clone().add(next.position).scale(0.5);
    const tangent = next.position.clone().sub(sample.position).normalize();
    const yaw = Math.atan2(tangent.x, tangent.z) * 180 / Math.PI;
    const shoulder = new pc.Entity(`Shoulder ${index + 1}`);
    shoulder.addComponent("render", { type: "box", material: shoulderMaterial });
    shoulder.setPosition(midPoint.x, sample.position.y + 0.04, midPoint.z);
    shoulder.setLocalScale((roadWidth + 4.8) * 0.5, 0.1, segmentLength * 0.5);
    shoulder.setEulerAngles(0, yaw, 0);
    shoulderRoot.addChild(shoulder);
  }

  return { roadRoot, shoulderRoot };
}

function createTrackBarrier(app: pc.Application, parent: pc.Entity, samples: TrackSample[], roadWidth: number, barrierWidth: number, barrierMaterial: pc.Material, postMaterial: pc.Material) {
  const barrierRoot = new pc.Entity("Track barriers");
  parent.addChild(barrierRoot);
  const barrierSamples = samples.filter((_, index) => index % 13 === 0 || index % 29 === 0);
  barrierSamples.forEach((sample, index) => {
    const tangent = sample.tangent.clone();
    const perpendicular = new pc.Vec3(-tangent.z, 0, tangent.x).normalize();
    const offset = perpendicular.mulScalar(roadWidth * 0.56 + 0.6 + (index % 2) * 0.2);
    const barrierPosition = sample.position.clone().add(offset);
    const barrier = new pc.Entity(`Barrier ${index + 1}`);
    barrier.addComponent("render", { type: "box", material: barrierMaterial });
    barrier.setPosition(barrierPosition.x, sample.position.y + 0.75, barrierPosition.z);
    barrier.setLocalScale(barrierWidth * 0.5, 0.75, 1.4);
    barrier.setEulerAngles(0, Math.atan2(tangent.x, tangent.z) * 180 / Math.PI, 0);
    barrierRoot.addChild(barrier);

    const post = new pc.Entity(`Barrier post ${index + 1}`);
    post.addComponent("render", { type: "box", material: postMaterial });
    post.setPosition(barrierPosition.x, sample.position.y + 0.95, barrierPosition.z);
    post.setLocalScale(0.16, 1.05, 0.16);
    barrierRoot.addChild(post);
  });
  return barrierRoot;
}

function createStartFinishLine(app: pc.Application, parent: pc.Entity, startSample: TrackSample, finishSample: TrackSample, material: pc.Material, accentMaterial: pc.Material) {
  const lineRoot = new pc.Entity("Start finish line");
  parent.addChild(lineRoot);
  const tangent = finishSample.tangent.clone();
  const yaw = Math.atan2(tangent.x, tangent.z) * 180 / Math.PI;
  const line = new pc.Entity("Finish line");
  line.addComponent("render", { type: "box", material });
  line.setPosition(startSample.position.x, startSample.position.y + 0.07, startSample.position.z);
  line.setLocalScale(6.8, 0.06, 0.24);
  line.setEulerAngles(0, yaw, 0);
  lineRoot.addChild(line);

  for (let index = -2; index <= 2; index += 1) {
    const stripe = new pc.Entity(`Finish stripe ${index + 3}`);
    stripe.addComponent("render", { type: "box", material: accentMaterial });
    stripe.setPosition(startSample.position.x + index * 1.1, startSample.position.y + 0.08, startSample.position.z + 0.16);
    stripe.setLocalScale(0.8, 0.04, 0.08);
    stripe.setEulerAngles(0, yaw, 0);
    lineRoot.addChild(stripe);
  }

  const arch = new pc.Entity("Race arch");
  arch.addComponent("render", { type: "box", material: accentMaterial });
  arch.setPosition(startSample.position.x, startSample.position.y + 1.8, startSample.position.z - 1.8);
  arch.setLocalScale(4.4, 0.16, 0.24);
  arch.setEulerAngles(0, yaw + 90, 0);
  lineRoot.addChild(arch);
  return lineRoot;
}

function createCheckpoints(app: pc.Application, parent: pc.Entity, samples: TrackSample[], count: number, material: pc.Material) {
  const checkpoints: Array<{ name: string; position: pc.Vec3; forward: pc.Vec3 }> = [];
  const checkpointRoot = new pc.Entity("Checkpoints");
  parent.addChild(checkpointRoot);
  for (let index = 0; index < count; index += 1) {
    const sample = samples[Math.floor((index / count) * samples.length) % samples.length];
    const checkpoint = new pc.Entity(`Checkpoint_${index.toString().padStart(2, "0")}`);
    checkpoint.addComponent("render", { type: "box", material });
    checkpoint.setPosition(sample.position.x, sample.position.y + 0.7, sample.position.z);
    checkpoint.setLocalScale(0.55, 1.4, 0.55);
    checkpointRoot.addChild(checkpoint);
    checkpoints.push({ name: checkpoint.name, position: sample.position.clone(), forward: sample.tangent.clone() });
  }
  return { checkpointRoot, checkpoints };
}

function createGeargardenScenery(app: pc.Application, parent: pc.Entity, trackSpec: TrackSpec, groundMaterial: pc.Material, accentMaterial: pc.Material, secondaryMaterial: pc.Material, darkMaterial: pc.Material) {
  const sceneryRoot = new pc.Entity("Geargarden scenery");
  parent.addChild(sceneryRoot);
  const ground = new pc.Entity("Geargarden ground");
  ground.addComponent("render", { type: "box", material: groundMaterial });
  ground.setPosition(0, -0.7, -24);
  ground.setLocalScale(140, 1.4, 180);
  sceneryRoot.addChild(ground);

  for (let index = 0; index < 18; index += 1) {
    const x = (index % 6 - 2.5) * 16 + (index % 3) * 2;
    const z = -24 + Math.floor(index / 6) * 18;
    const flower = new pc.Entity(`Flower ${index + 1}`);
    flower.addComponent("render", { type: "cylinder", material: accentMaterial });
    flower.setPosition(x, 0.6, z);
    flower.setLocalScale(0.9, 0.36, 0.9);
    flower.setEulerAngles(0, 0, 0);
    sceneryRoot.addChild(flower);
  }

  const windmill = new pc.Entity("Windmill workshop");
  windmill.addComponent("render", { type: "box", material: secondaryMaterial });
  windmill.setPosition(26, 2.8, -80);
  windmill.setLocalScale(16, 6.8, 10);
  sceneryRoot.addChild(windmill);

  const millBlade = new pc.Entity("Windmill blade");
  millBlade.addComponent("render", { type: "cylinder", material: accentMaterial });
  millBlade.setPosition(26, 7.2, -80);
  millBlade.setLocalScale(0.7, 6.4, 0.7);
  millBlade.setEulerAngles(0, 0, 90);
  sceneryRoot.addChild(millBlade);

  const cottage = new pc.Entity("Geargarden cottage");
  cottage.addComponent("render", { type: "box", material: darkMaterial });
  cottage.setPosition(-26, 1.8, -48);
  cottage.setLocalScale(10, 3.8, 7.2);
  sceneryRoot.addChild(cottage);

  const stream = new pc.Entity("Garden stream");
  stream.addComponent("render", { type: "box", material: secondaryMaterial });
  stream.setPosition(14, 0.06, -44);
  stream.setLocalScale(24, 0.1, 8);
  sceneryRoot.addChild(stream);

  for (let index = 0; index < 8; index += 1) {
    const tree = new pc.Entity(`Tree ${index + 1}`);
    tree.addComponent("render", { type: "cylinder", material: darkMaterial });
    tree.setPosition(-36 + index * 10, 1.6, -18 + (index % 2) * 12);
    tree.setLocalScale(1.1, 3.3, 1.1);
    sceneryRoot.addChild(tree);
  }

  return sceneryRoot;
}

function createMapDrivenTrackScenery(
  app: pc.Application,
  parent: pc.Entity,
  spec: GameBuildSpec,
  samples: TrackSample[],
  materials: { ground: pc.Material; wall: pc.Material; accent: pc.Material; secondary: pc.Material; dark: pc.Material },
) {
  const layout = spec.world.layout;
  if (!layout?.regions?.length || !samples.length) return null;

  const root = new pc.Entity("Design Studio track scenery");
  parent.addChild(root);

  layout.regions.slice(0, 8).forEach((region, index) => {
    const sample = samples[Math.floor(((index + 0.35) / layout.regions.length) * samples.length) % samples.length];
    const normal = new pc.Vec3(-sample.tangent.z, 0, sample.tangent.x).normalize();
    const side = index % 2 === 0 ? 1 : -1;
    const offset = 17 + Math.min(12, region.radius) * 0.8;
    const center = sample.position.clone().add(normal.mulScalar(offset * side));
    const radius = Math.max(4.5, Math.min(10, region.radius * 0.62));
    const elevation = Math.max(0, region.elevation * 0.22);
    const platformMaterial = index % 2 === 0 ? materials.secondary : materials.ground;

    createPrimitive(app, "cylinder", `${region.name} track district`, [center.x, -0.18 + elevation * 0.12, center.z], [radius, 0.42 + elevation * 0.12, radius], platformMaterial, root);

    const featureCount = Math.max(3, Math.min(8, Math.round((region.detailDensity || 10) / 2)));
    for (let featureIndex = 0; featureIndex < featureCount; featureIndex += 1) {
      const angle = (featureIndex / featureCount) * Math.PI * 2 + index * 0.62;
      const spread = radius * (0.3 + (featureIndex % 3) * 0.18);
      const x = center.x + Math.cos(angle) * spread;
      const z = center.z + Math.sin(angle) * spread;
      const height = 1.8 + (featureIndex % 4) * 1.1 + elevation;
      if (region.kind === "mountain") {
        createPrimitive(app, "cone", `${region.name} peak ${featureIndex + 1}`, [x, height * 0.5, z], [1.8 + featureIndex % 2, height, 1.8 + featureIndex % 2], materials.wall, root);
      } else if (region.kind === "nature") {
        createPrimitive(app, "cylinder", `${region.name} tree trunk ${featureIndex + 1}`, [x, height * 0.34, z], [0.28, height * 0.68, 0.28], materials.dark, root);
        createPrimitive(app, "cone", `${region.name} tree canopy ${featureIndex + 1}`, [x, height * 0.85, z], [1.25, height * 0.75, 1.25], materials.secondary, root);
      } else if (region.kind === "lunar") {
        if (featureIndex % 3 === 0) {
          createPrimitive(app, "cylinder", `${region.name} crater ${featureIndex + 1}`, [x, 0.02, z], [1.4, 0.08, 1.4], materials.dark, root);
        } else {
          createPrimitive(app, featureIndex % 2 ? "cylinder" : "box", `${region.name} lunar module ${featureIndex + 1}`, [x, height * 0.42, z], [1.2, height * 0.84, 1.2], featureIndex % 2 ? materials.wall : materials.accent, root);
        }
      } else if (region.kind === "water") {
        createPrimitive(app, "cylinder", `${region.name} water feature ${featureIndex + 1}`, [x, 0.02, z], [1.4, 0.06, 1.4], materials.secondary, root);
      } else {
        createPrimitive(app, "box", `${region.name} structure ${featureIndex + 1}`, [x, height * 0.5, z], [1.5, height, 1.5], featureIndex % 3 === 0 ? materials.accent : materials.wall, root);
      }
    }

    const labels = [...(region.equipment || []), ...(region.interactables || [])].slice(0, 4);
    labels.forEach((label, labelIndex) => {
      const angle = (labelIndex / Math.max(1, labels.length)) * Math.PI * 2 + 0.45;
      const x = center.x + Math.cos(angle) * radius * 0.68;
      const z = center.z + Math.sin(angle) * radius * 0.68;
      const interactive = (region.interactables || []).includes(label);
      const equipment = createPrimitive(app, /antenna|beacon/i.test(label) ? "cylinder" : "box", `${region.name} ${label}`, [x, 1, z], [0.75, 2, 0.75], interactive ? materials.accent : materials.wall, root);
      equipment.setEulerAngles(0, (angle * 180 / Math.PI + 90) % 360, 0);
      if (interactive) createPrimitive(app, "sphere", `${label} signal`, [x, 2.35, z], [0.24, 0.24, 0.24], materials.accent, root);
    });
  });

  return root;
}

function createGeargardenBridge(app: pc.Application, parent: pc.Entity, sampleA: TrackSample, sampleB: TrackSample, material: pc.Material, railMaterial: pc.Material) {
  const bridgeRoot = new pc.Entity("Bridge section");
  parent.addChild(bridgeRoot);
  const midpoint = sampleA.position.clone().add(sampleB.position).scale(0.5);
  const tangent = sampleB.position.clone().sub(sampleA.position).normalize();
  const yaw = Math.atan2(tangent.x, tangent.z) * 180 / Math.PI;
  const bridge = new pc.Entity("Bridge deck");
  bridge.addComponent("render", { type: "box", material });
  bridge.setPosition(midpoint.x, midpoint.y + 1.6, midpoint.z);
  bridge.setLocalScale(10, 0.24, 14);
  bridge.setEulerAngles(0, yaw, 0);
  bridgeRoot.addChild(bridge);

  const railLeft = new pc.Entity("Bridge rail left");
  railLeft.addComponent("render", { type: "box", material: railMaterial });
  railLeft.setPosition(midpoint.x - 4.2, midpoint.y + 1.8, midpoint.z);
  railLeft.setLocalScale(0.18, 0.6, 13.8);
  railLeft.setEulerAngles(0, yaw, 0);
  bridgeRoot.addChild(railLeft);

  const railRight = new pc.Entity("Bridge rail right");
  railRight.addComponent("render", { type: "box", material: railMaterial });
  railRight.setPosition(midpoint.x + 4.2, midpoint.y + 1.8, midpoint.z);
  railRight.setLocalScale(0.18, 0.6, 13.8);
  railRight.setEulerAngles(0, yaw, 0);
  bridgeRoot.addChild(railRight);
  return bridgeRoot;
}

function createTunnel(app: pc.Application, parent: pc.Entity, sampleA: TrackSample, sampleB: TrackSample, material: pc.Material, accentMaterial: pc.Material) {
  const tunnelRoot = new pc.Entity("Tunnel section");
  parent.addChild(tunnelRoot);
  const midpoint = sampleA.position.clone().add(sampleB.position).scale(0.5);
  const tangent = sampleB.position.clone().sub(sampleA.position).normalize();
  const yaw = Math.atan2(tangent.x, tangent.z) * 180 / Math.PI;
  const tunnel = new pc.Entity("Tunnel shell");
  tunnel.addComponent("render", { type: "box", material });
  tunnel.setPosition(midpoint.x, midpoint.y + 2.4, midpoint.z);
  tunnel.setLocalScale(10.6, 4.4, 13.6);
  tunnel.setEulerAngles(0, yaw, 0);
  tunnelRoot.addChild(tunnel);

  const tunnelCap = new pc.Entity("Tunnel cap");
  tunnelCap.addComponent("render", { type: "box", material: accentMaterial });
  tunnelCap.setPosition(midpoint.x, midpoint.y + 2.9, midpoint.z + 0.2);
  tunnelCap.setLocalScale(10.8, 0.24, 14.4);
  tunnelCap.setEulerAngles(0, yaw, 0);
  tunnelRoot.addChild(tunnelCap);
  return tunnelRoot;
}

function createJumpRamp(app: pc.Application, parent: pc.Entity, sampleA: TrackSample, sampleB: TrackSample, material: pc.Material, accentMaterial: pc.Material) {
  const rampRoot = new pc.Entity("Jump ramp");
  parent.addChild(rampRoot);
  const midpoint = sampleA.position.clone().add(sampleB.position).scale(0.5);
  const tangent = sampleB.position.clone().sub(sampleA.position).normalize();
  const yaw = Math.atan2(tangent.x, tangent.z) * 180 / Math.PI;
  const ramp = new pc.Entity("Ramp deck");
  ramp.addComponent("render", { type: "box", material });
  ramp.setPosition(midpoint.x, midpoint.y + 0.8, midpoint.z);
  ramp.setLocalScale(8, 0.24, 3.6);
  ramp.setEulerAngles(0, yaw, 18);
  rampRoot.addChild(ramp);

  const landing = new pc.Entity("Ramp landing");
  landing.addComponent("render", { type: "box", material: accentMaterial });
  landing.setPosition(midpoint.x + tangent.x * 7.8, midpoint.y + 0.2, midpoint.z + tangent.z * 7.8);
  landing.setLocalScale(6.5, 0.2, 6.5);
  landing.setEulerAngles(0, yaw, 0);
  rampRoot.addChild(landing);
  return rampRoot;
}

function createShortcut(app: pc.Application, parent: pc.Entity, shortcutData: TrackSpec["shortcutData"], material: pc.Material, accentMaterial: pc.Material) {
  const shortcutRoot = new pc.Entity("Shortcut path");
  parent.addChild(shortcutRoot);
  const entry = shortcutData.entry;
  const exit = shortcutData.exit;
  const midpoint = new pc.Vec3((entry[0] + exit[0]) * 0.5, (entry[1] + exit[1]) * 0.5, (entry[2] + exit[2]) * 0.5);
  const tangent = new pc.Vec3(exit[0] - entry[0], 0, exit[2] - entry[2]).normalize();
  const yaw = Math.atan2(tangent.x, tangent.z) * 180 / Math.PI;
  const segment = new pc.Entity("Shortcut road");
  segment.addComponent("render", { type: "box", material });
  segment.setPosition(midpoint.x, midpoint.y + 0.08, midpoint.z);
  segment.setLocalScale(shortcutData.width * 0.5, 0.16, 8.6);
  segment.setEulerAngles(0, yaw, 0);
  shortcutRoot.addChild(segment);

  const gate = new pc.Entity("Shortcut gate");
  gate.addComponent("render", { type: "box", material: accentMaterial });
  gate.setPosition(entry[0] + tangent.x * 3.8, entry[1] + 0.9, entry[2] + tangent.z * 3.8);
  gate.setLocalScale(1.2, 1.4, 0.2);
  gate.setEulerAngles(0, yaw, 0);
  shortcutRoot.addChild(gate);
  return shortcutRoot;
}

function createBoostPads(app: pc.Application, parent: pc.Entity, samples: TrackSample[], material: pc.Material, accentMaterial: pc.Material) {
  const padRoot = new pc.Entity("Boost pads");
  parent.addChild(padRoot);
  const boostPositions = [samples[22], samples[58], samples[114], samples[144]];
  boostPositions.forEach((sample, index) => {
    const pad = new pc.Entity(`Boost pad ${index + 1}`);
    pad.addComponent("render", { type: "box", material: index % 2 ? accentMaterial : material });
    pad.setPosition(sample.position.x, sample.position.y + 0.08, sample.position.z);
    pad.setLocalScale(2.1, 0.1, 2.1);
    padRoot.addChild(pad);
  });
  return padRoot;
}

function createFlightFallback(
  app: pc.Application,
  parent: pc.Entity,
  bodyMaterial: pc.Material,
  accentMaterial: pc.Material,
) {
  const root = new pc.Entity("Fallback flying model");
  parent.addChild(root);
  const body = createPrimitive(app, "capsule", "Flight body", [0, 0, 0], [0.7, 0.6, 2.25], bodyMaterial, root);
  body.setLocalEulerAngles(90, 0, 0);
  createPrimitive(app, "sphere", "Flight head", [0, 0.08, 1.35], [0.55, 0.48, 0.6], accentMaterial, root);
  createPrimitive(app, "cone", "Flight tail", [0, 0, -1.6], [0.7, 0.45, 1.1], bodyMaterial, root).setLocalEulerAngles(90, 0, 0);
  return root;
}

function entityBounds(instance: pc.Entity) {
  const renders = instance.findComponents("render") as unknown as Array<{
    meshInstances?: Array<{
      aabb?: {
        getMin?: () => pc.Vec3;
        getMax?: () => pc.Vec3;
        center?: pc.Vec3;
        halfExtents?: pc.Vec3;
      };
    }>;
  }>;
  const min = new pc.Vec3(Number.POSITIVE_INFINITY, Number.POSITIVE_INFINITY, Number.POSITIVE_INFINITY);
  const max = new pc.Vec3(Number.NEGATIVE_INFINITY, Number.NEGATIVE_INFINITY, Number.NEGATIVE_INFINITY);
  let found = false;
  for (const render of renders) {
    for (const meshInstance of render.meshInstances || []) {
      const aabb = meshInstance.aabb;
      if (!aabb) continue;
      const aabbMin = aabb.getMin?.() || (aabb.center && aabb.halfExtents
        ? new pc.Vec3(aabb.center.x - aabb.halfExtents.x, aabb.center.y - aabb.halfExtents.y, aabb.center.z - aabb.halfExtents.z)
        : null);
      const aabbMax = aabb.getMax?.() || (aabb.center && aabb.halfExtents
        ? new pc.Vec3(aabb.center.x + aabb.halfExtents.x, aabb.center.y + aabb.halfExtents.y, aabb.center.z + aabb.halfExtents.z)
        : null);
      if (!aabbMin || !aabbMax) continue;
      min.x = Math.min(min.x, aabbMin.x);
      min.y = Math.min(min.y, aabbMin.y);
      min.z = Math.min(min.z, aabbMin.z);
      max.x = Math.max(max.x, aabbMax.x);
      max.y = Math.max(max.y, aabbMax.y);
      max.z = Math.max(max.z, aabbMax.z);
      found = true;
    }
  }
  return found ? { min, max } : null;
}

function normalizeGeneratedModel(instance: pc.Entity, role: "player" | "driver" | "enemy" | "vehicle" | "flight" | "environment") {
  const bounds = entityBounds(instance);
  const targetSize = role === "environment" ? 34 : role === "vehicle" ? 4.6 : role === "flight" ? 3.8 : role === "driver" ? 1.35 : 2.55;
  if (!bounds) {
    const fallbackScale = role === "environment" ? 1 : role === "vehicle" ? 0.85 : role === "flight" ? 0.7 : role === "driver" ? 0.52 : 0.9;
    instance.setLocalScale(fallbackScale, fallbackScale, fallbackScale);
    instance.setLocalPosition(0, role === "environment" ? -2 : role === "vehicle" ? -0.35 : role === "driver" ? -0.15 : 0, 0);
    return;
  }
  const sizeX = Math.max(0.001, bounds.max.x - bounds.min.x);
  const sizeY = Math.max(0.001, bounds.max.y - bounds.min.y);
  const sizeZ = Math.max(0.001, bounds.max.z - bounds.min.z);
  const sourceSize = role === "player" || role === "driver" || role === "enemy" ? sizeY : Math.max(sizeX, sizeY, sizeZ);
  const scale = clamp(targetSize / sourceSize, role === "environment" ? 0.05 : 0.02, role === "environment" ? 8 : 12);
  const centerX = (bounds.min.x + bounds.max.x) * 0.5;
  const centerZ = (bounds.min.z + bounds.max.z) * 0.5;
  instance.setLocalScale(scale, scale, scale);
  instance.setLocalPosition(
    -centerX * scale,
    role === "flight" ? -((bounds.min.y + bounds.max.y) * 0.5) * scale : -bounds.min.y * scale,
    -centerZ * scale,
  );
}

async function attachReferenceBackdrop(app: pc.Application, camera: pc.Entity, dataUrl?: string) {
  if (!dataUrl || !/^data:image\/(png|jpeg|webp);base64,/i.test(dataUrl)) return;
  await new Promise<void>((resolve) => {
    app.assets.loadFromUrl(dataUrl, "texture", (error, asset) => {
      if (error || !asset?.resource) {
        console.warn("GameForge could not load the Design Studio world reference into the PlayCanvas backdrop.", error);
        resolve();
        return;
      }
      try {
        const material = new pc.StandardMaterial();
        material.diffuse = new pc.Color(1, 1, 1);
        material.diffuseMap = asset.resource as pc.Texture;
        material.emissive = new pc.Color(1, 1, 1);
        material.emissiveMap = asset.resource as pc.Texture;
        material.emissiveIntensity = 0.72;
        (material as pc.StandardMaterial & { useLighting?: boolean }).useLighting = false;
        material.opacity = 0.32;
        material.blendType = pc.BLEND_NORMAL;
        material.depthWrite = false;
        material.update();
        const backdrop = createPrimitive(app, "plane", "Design Studio world reference backdrop", [0, 0, 0], [170, 1, 95], material, camera);
        backdrop.setLocalPosition(0, 0, -115);
        backdrop.setLocalEulerAngles(90, 0, 0);
      } catch (backdropError) {
        console.warn("GameForge could not create the world reference backdrop.", backdropError);
      }
      resolve();
    });
  });
}

function collides(x: number, z: number, boxes: CollisionBox[], radius = 0.65) {
  return boxes.some((box) => Math.abs(x - box.x) < box.halfX + radius && Math.abs(z - box.z) < box.halfZ + radius);
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function distanceXZ(a: pc.Vec3, b: pc.Vec3) {
  return Math.hypot(a.x - b.x, a.z - b.z);
}

function stageDefaults(): MissionStage[] {
  return [
    { id: "entry", title: "Enter the bank", instruction: "Reach the service entrance.", position: [-16, 1, 8], interaction: "reach" },
    { id: "security", title: "Disable security", instruction: "Press E at the security terminal.", position: [-4, 1, -5], interaction: "interact" },
    { id: "vault", title: "Secure the vault", instruction: "Press E to collect the vault package.", position: [9, 1, -8], interaction: "collect" },
    { id: "extract", title: "Reach extraction", instruction: "Escape through the parking exit.", position: [20, 1, 11], interaction: "extract" },
  ];
}


function worldScaleForTemplate(spec: GameBuildSpec) {
  return spec.templateFamily === "open-world-flight"
    ? 1.15
    : spec.templateFamily === "kart-racing"
      ? 0.95
      : spec.templateFamily === "driving-racing"
        ? 0.8
        : 0.58;
}

function layoutPoint(spec: GameBuildSpec, point?: [number, number], elevation = 0) {
  const scale = worldScaleForTemplate(spec);
  return new pc.Vec3((point?.[0] || 0) * scale, Math.max(0, elevation * 0.28), (point?.[1] || 0) * scale);
}

function worldSearchText(spec: GameBuildSpec) {
  return [
    spec.title,
    spec.premise,
    spec.missionBrief,
    spec.gameplaySummary,
    spec.world.biome,
    spec.world.layout?.regions.map((region) => `${region.name} ${region.description}`).join(" "),
  ].filter(Boolean).join(" ").toLowerCase();
}

function isHeistWorld(spec: GameBuildSpec) {
  return /bank|heist|robber|robbery|vault|security wing|infiltrat/.test(worldSearchText(spec));
}

function mapBounds(spec: GameBuildSpec) {
  const scale = worldScaleForTemplate(spec);
  const points = [
    ...(spec.world.layout?.regions.map((region) => region.position) || []),
    ...(spec.world.layout?.props?.map((prop) => prop.position) || []),
  ];
  const maxX = points.length ? Math.max(...points.map((point) => Math.abs(point[0] * scale))) : 25;
  const maxZ = points.length ? Math.max(...points.map((point) => Math.abs(point[1] * scale))) : 18;
  return { x: Math.max(25, maxX + 8), z: Math.max(18, maxZ + 8) };
}


function inferredWorldPropKind(label: string): WorldLayoutProp["kind"] {
  const value = label.toLowerCase();
  if (/solar|panel/.test(value)) return "solar-panel";
  if (/antenna|radio|dish|communications/.test(value)) return "antenna";
  if (/rover|vehicle|buggy/.test(value)) return "rover";
  if (/mine|drill|extractor|rig/.test(value)) return "mining-rig";
  if (/oxygen|life support|air supply/.test(value)) return "oxygen-station";
  if (/camera|surveillance/.test(value)) return "camera";
  if (/vault|console/.test(value)) return "vault-console";
  if (/terminal|panel|switch|control/.test(value)) return "terminal";
  if (/crate|cargo|supply|cache/.test(value)) return "crate";
  if (/barrier|cover|barricade/.test(value)) return "barrier";
  if (/beacon|signal|waypoint/.test(value)) return "beacon";
  if (/habitat|module|station|base/.test(value)) return "habitat";
  if (/bridge|crossing/.test(value)) return "bridge";
  if (/tree|plant|flora/.test(value)) return "tree";
  if (/crystal|artifact|relic/.test(value)) return "crystal";
  return "equipment";
}

function createDetailedWorldProp(
  app: pc.Application,
  prop: WorldLayoutProp,
  scale: number,
  materials: { ground: pc.Material; wall: pc.Material; accent: pc.Material; secondary: pc.Material },
): CollisionBox | null {
  const x = prop.position[0] * scale;
  const z = prop.position[1] * scale;
  const baseY = Math.max(0, prop.elevation * 0.28);
  const sx = Math.max(0.25, prop.scale[0] * scale * 0.58);
  const sy = Math.max(0.2, prop.scale[1] * 0.58);
  const sz = Math.max(0.25, prop.scale[2] * scale * 0.58);
  const mat = prop.interactive ? materials.secondary : materials.wall;
  const accent = prop.interactive ? materials.accent : materials.secondary;
  let main: pc.Entity | null = null;

  const box = (name: string, px: number, py: number, pz: number, sizeX: number, sizeY: number, sizeZ: number, material: pc.Material) =>
    createPrimitive(app, "box", name, [px, py, pz], [sizeX, sizeY, sizeZ], material);

  switch (prop.kind) {
    case "crater":
      main = createPrimitive(app, "cylinder", prop.name, [x, 0.015, z], [sx, 0.08, sz], materials.ground);
      createPrimitive(app, "cylinder", `${prop.name} rim`, [x, 0.08, z], [sx * 1.16, 0.07, sz * 1.16], materials.wall);
      break;
    case "rock":
      main = createPrimitive(app, "sphere", prop.name, [x, baseY + sy * 0.45, z], [sx, sy, sz], mat);
      break;
    case "crystal":
      main = createPrimitive(app, "cone", prop.name, [x, baseY + sy * 0.5, z], [sx, sy, sz], accent);
      break;
    case "tree":
      main = createPrimitive(app, "cylinder", `${prop.name} trunk`, [x, baseY + sy * 0.42, z], [Math.min(sx, 0.42), sy * 0.82, Math.min(sz, 0.42)], materials.wall);
      createPrimitive(app, "cone", `${prop.name} canopy`, [x, baseY + sy * 0.95, z], [sx * 1.35, sy * 0.85, sz * 1.35], accent);
      break;
    case "solar-panel":
      main = box(prop.name, x, baseY + 0.72, z, sx, Math.min(0.18, sy), sz, accent);
      main.setEulerAngles(-18, prop.rotation, 0);
      box(`${prop.name} support`, x, baseY + 0.35, z, 0.18, 0.7, 0.18, materials.wall);
      break;
    case "antenna":
    case "beacon":
    case "streetlight":
      main = createPrimitive(app, "cylinder", prop.name, [x, baseY + sy * 0.5, z], [Math.min(sx, 0.34), sy, Math.min(sz, 0.34)], materials.wall);
      createPrimitive(app, prop.kind === "antenna" ? "sphere" : "box", `${prop.name} head`, [x, baseY + sy, z], [Math.max(0.4, sx), 0.35, Math.max(0.4, sz)], accent);
      break;
    case "rover":
      main = box(prop.name, x, baseY + sy * 0.55, z, sx, sy * 0.7, sz, mat);
      for (const wheelX of [-sx * 0.52, sx * 0.52]) {
        for (const wheelZ of [-sz * 0.34, sz * 0.34]) {
          const wheel = createPrimitive(app, "cylinder", `${prop.name} wheel`, [x + wheelX, baseY + 0.3, z + wheelZ], [0.36, 0.22, 0.36], materials.wall);
          wheel.setEulerAngles(0, 0, 90);
        }
      }
      break;
    case "habitat":
      main = createPrimitive(app, "cylinder", prop.name, [x, baseY + sy * 0.5, z], [sx, sy, sz], mat);
      box(`${prop.name} airlock`, x + sx * 0.72, baseY + sy * 0.36, z, sx * 0.45, sy * 0.62, sz * 0.5, accent);
      break;
    case "mining-rig":
      main = box(prop.name, x, baseY + sy * 0.45, z, sx, sy * 0.9, sz, mat);
      createPrimitive(app, "cylinder", `${prop.name} drill`, [x, baseY + sy * 0.9, z], [0.35, sy, 0.35], accent);
      break;
    case "oxygen-station":
      main = createPrimitive(app, "cylinder", prop.name, [x, baseY + sy * 0.5, z], [sx, sy, sz], accent);
      break;
    case "camera":
      main = box(prop.name, x, baseY + Math.max(2.4, sy), z, sx, sy, sz, accent);
      break;
    case "bridge":
    case "dock":
    case "barrier":
      main = box(prop.name, x, baseY + sy * 0.3, z, sx, Math.min(sy, 0.65), sz, mat);
      break;
    case "terminal":
    case "vault-console":
      main = box(prop.name, x, baseY + sy * 0.5, z, sx, sy, sz, accent);
      box(`${prop.name} display`, x, baseY + sy * 0.82, z - sz * 0.52, sx * 0.72, sy * 0.26, 0.08, materials.secondary);
      break;
    case "crate":
      main = box(prop.name, x, baseY + sy * 0.5, z, sx, sy, sz, mat);
      break;
    case "landmark":
      main = createPrimitive(app, "cone", prop.name, [x, baseY + sy * 0.5, z], [sx, sy, sz], accent);
      break;
    case "building":
    case "equipment":
    default:
      main = box(prop.name, x, baseY + sy * 0.5, z, sx, sy, sz, mat);
      break;
  }

  if (main) {
    const currentRotation = main.getEulerAngles();
    main.setEulerAngles(currentRotation.x, prop.rotation, currentRotation.z);
  }
  if (!prop.collision) return null;
  return { x, z, halfX: Math.max(0.35, sx * 0.5), halfZ: Math.max(0.35, sz * 0.5) };
}

function createDesignStudioWorld(
  app: pc.Application,
  spec: GameBuildSpec,
  materials: { ground: pc.Material; wall: pc.Material; accent: pc.Material; secondary: pc.Material },
) : CollisionBox[] {
  const layout = spec.world.layout;
  if (!layout?.regions?.length) return [];
  const detailCollisions: CollisionBox[] = [];
  const regionById = new Map(layout.regions.map((region) => [region.id, region]));
  const scale = worldScaleForTemplate(spec);

  for (const path of layout.paths || []) {
    const from = regionById.get(path.from);
    const to = regionById.get(path.to);
    if (!from || !to) continue;
    const x1 = from.position[0] * scale;
    const z1 = from.position[1] * scale;
    const x2 = to.position[0] * scale;
    const z2 = to.position[1] * scale;
    const dx = x2 - x1;
    const dz = z2 - z1;
    const length = Math.max(2, Math.hypot(dx, dz));
    const routeWidth = Math.max(2.5, (path.width || (path.style === "corridor" ? 3.2 : 4.8)) * scale);
    const routeMaterial = path.style === "road" || path.style === "corridor" ? materials.secondary : materials.ground;
    const route = createPrimitive(app, "box", `World route ${path.id}`, [(x1 + x2) / 2, 0.08, (z1 + z2) / 2], [routeWidth, 0.12, length], routeMaterial);
    route.setEulerAngles(0, Math.atan2(dx, dz) * 180 / Math.PI, 0);

    // Add readable route-edge detail so generated maps look authored rather than empty.
    const routeDetails = clamp(Math.round(length / 9), 2, 8);
    const normalX = length > 0 ? -dz / length : 0;
    const normalZ = length > 0 ? dx / length : 0;
    for (let detail = 1; detail <= routeDetails; detail += 1) {
      const t = detail / (routeDetails + 1);
      const centerX = x1 + dx * t;
      const centerZ = z1 + dz * t;
      const sideOffset = Math.max(1.4, routeWidth * 0.58);
      const sides = spec.templateFamily === "driving-racing" ? [-1, 1] : [detail % 2 ? -1 : 1];
      for (const side of sides) {
        const markerX = centerX + normalX * sideOffset * side;
        const markerZ = centerZ + normalZ * sideOffset * side;
        const pole = createPrimitive(app, "cylinder", `Route light ${path.id}-${detail}-${side}`, [markerX, 0.9, markerZ], [0.13, 1.8, 0.13], materials.wall);
        pole.setEulerAngles(0, Math.atan2(dx, dz) * 180 / Math.PI, 0);
        createPrimitive(app, "sphere", `Route light head ${path.id}-${detail}-${side}`, [markerX, 1.85, markerZ], [0.24, 0.24, 0.24], materials.accent);
      }
    }
  }

  layout.regions.forEach((region, index) => {
    const x = region.position[0] * scale;
    const z = region.position[1] * scale;
    const radius = Math.max(2.4, region.radius * scale * 0.45);
    const elevation = Math.max(0, region.elevation * 0.3);
    const mat = index % 2 ? materials.secondary : materials.accent;
    if (region.kind === "water") {
      createPrimitive(app, "cylinder", region.name, [x, 0.02, z], [radius, 0.08, radius], mat);
      return;
    }
    if (region.kind === "lunar") {
      createPrimitive(app, "cylinder", `${region.name} lunar ground`, [x, -0.18, z], [radius, 0.34, radius], mat);
      const craters = Math.max(3, Math.min(7, Math.round(radius * 0.55)));
      for (let item = 0; item < craters; item += 1) {
        const angle = item / craters * Math.PI * 2 + index * 0.7;
        const spread = radius * (0.25 + (item % 3) * 0.18);
        createPrimitive(app, "cylinder", `${region.name} crater ${item + 1}`, [x + Math.cos(angle) * spread, 0.01, z + Math.sin(angle) * spread], [1.1 + item * 0.2, 0.07, 1.1 + item * 0.2], materials.wall);
      }
      return;
    }
    if (region.kind === "mountain" || region.kind === "nature") {
      const count = Math.max(3, Math.min(9, Math.round(radius)));
      for (let item = 0; item < count; item += 1) {
        const angle = item / count * Math.PI * 2 + index;
        const spread = radius * (0.25 + (item % 3) * 0.22);
        const height = region.kind === "mountain" ? 6 + (item % 4) * 3 + elevation : 2.8 + (item % 3) * 1.5;
        createPrimitive(app, region.kind === "mountain" ? "cone" : "cylinder", `${region.name} ${item + 1}`, [x + Math.cos(angle) * spread, height / 2, z + Math.sin(angle) * spread], [region.kind === "mountain" ? 3.2 : 0.65, height, region.kind === "mountain" ? 3.2 : 0.65], item % 2 ? materials.wall : mat);
      }
      return;
    }
    const blocks = Math.max(3, Math.min(10, Math.round(radius * 0.8)));
    for (let item = 0; item < blocks; item += 1) {
      const columns = Math.ceil(Math.sqrt(blocks));
      const row = Math.floor(item / columns);
      const column = item % columns;
      const height = 2.5 + ((item + index) % 4) * 1.4 + elevation;
      createPrimitive(app, "box", `${region.name} structure ${item + 1}`, [x + (column - columns / 2) * 2.4, height / 2, z + (row - columns / 2) * 2.4], [1.8, height, 1.8], item % 3 === 0 ? mat : materials.wall);
    }
  });

  for (const prop of layout.props?.slice(0, 110) || []) {
    const collision = createDetailedWorldProp(app, prop, scale, materials);
    if (collision) detailCollisions.push(collision);
  }

  // When the blueprint describes equipment or interactables but does not provide
  // enough explicit props, synthesize deterministic game-ready detail around each region.
  layout.regions.forEach((region, regionIndex) => {
    const details = [...(region.equipment || []), ...(region.interactables || [])].slice(0, 6);
    details.forEach((label, detailIndex) => {
      const angle = (detailIndex / Math.max(1, details.length)) * Math.PI * 2 + regionIndex * 0.73;
      const spread = Math.max(2.2, region.radius * scale * (0.26 + (detailIndex % 3) * 0.08));
      const interactive = (region.interactables || []).includes(label);
      const prop: WorldLayoutProp = {
        id: `generated-${region.id}-${detailIndex}`,
        regionId: region.id,
        name: label,
        kind: inferredWorldPropKind(label),
        position: [
          region.position[0] + Math.cos(angle) * spread / Math.max(scale, 0.01),
          region.position[1] + Math.sin(angle) * spread / Math.max(scale, 0.01),
        ],
        elevation: region.elevation,
        scale: interactive ? [1.5, 2.1, 1.2] : [1.25, 1.45, 1.1],
        rotation: (angle * 180 / Math.PI + 90) % 360,
        interactive,
        collision: spec.templateFamily !== "open-world-flight",
        purpose: interactive ? "Quest interaction" : "Environmental storytelling",
      };
      const collision = createDetailedWorldProp(app, prop, scale, materials);
      if (collision) detailCollisions.push(collision);
    });
  });

  for (const anchor of layout.objectiveAnchors || []) {
    const point = layoutPoint(spec, anchor.position);
    createPrimitive(app, "cylinder", `Objective anchor ${anchor.id}`, [point.x, 0.1, point.z], [1.1, 0.12, 1.1], materials.accent);
    createPrimitive(app, "cylinder", `Objective beacon ${anchor.id}`, [point.x, 1.15, point.z], [0.08, 2.1, 0.08], materials.secondary);
    createPrimitive(app, "sphere", `Objective signal ${anchor.id}`, [point.x, 2.3, point.z], [0.28, 0.28, 0.28], materials.accent);
  }

  return detailCollisions;

}

async function attachGeneratedModel(
  app: pc.Application,
  parent: pc.Entity,
  fallback: pc.Entity | null,
  url: string | undefined,
  role: "player" | "driver" | "enemy" | "vehicle" | "flight" | "environment",
) {
  if (!url) return;
  if (!/^https?:\/\//i.test(url) && !url.startsWith("/") && !url.startsWith("gameforge-local://")) return;

  let resolved: { url: string; revoke: () => void };
  try {
    resolved = await resolveGameforgeModelUrl(url);
  } catch (resolveError) {
    console.warn(`GameForge could not resolve the imported ${role} GLB. Using fallback.`, resolveError);
    return;
  }

  try {
    const asset = await loadPlayCanvasGlb(app, resolved.url, `${role}.glb`);
    const containerResource = asset.resource as pc.ContainerResource;
    const instance = containerResource.instantiateRenderEntity({ castShadows: true, receiveShadows: true });
    instance.name = `Generated ${role}`;
    parent.addChild(instance);
    const renderComponents = instance.findComponents("render") as unknown as Array<{ meshInstances?: unknown[] }>;
    const hasRenderableGeometry = renderComponents.some((component) => (component.meshInstances?.length || 0) > 0);
    if (!hasRenderableGeometry) {
      instance.destroy();
      throw new Error(`The generated ${role} GLB did not contain renderable geometry.`);
    }
    normalizeGeneratedModel(instance, role);
    instance.enabled = true;
    if (fallback) fallback.enabled = false;
  } catch (error) {
    console.warn(`GameForge could not load generated ${role} GLB. Using fallback.`, error);
  } finally {
    resolved.revoke();
  }
}

export const PlayCanvasRuntime = forwardRef<GameRuntime3DHandle, Props>(function PlayCanvasRuntime(
  { spec, onStats, onReady, onRuntimeError },
  ref,
) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const appRef = useRef<pc.Application | null>(null);
  const stateRef = useRef<RuntimeState | null>(null);
  const restartRef = useRef<() => void>(() => undefined);
  const recoverCheckpointRef = useRef<() => void>(() => undefined);
  const callbacksRef = useRef({ onStats, onReady, onRuntimeError });
  const [runtimeMessage, setRuntimeMessage] = useState("Loading PlayCanvas engine…");

  useEffect(() => {
    callbacksRef.current = { onStats, onReady, onRuntimeError };
  }, [onStats, onReady, onRuntimeError]);

  useImperativeHandle(ref, () => ({
    restart: () => restartRef.current(),
    togglePause: () => {
      const state = stateRef.current;
      if (!state || state.status === "victory" || state.status === "defeat") return;
      state.paused = !state.paused;
      state.status = state.paused ? "paused" : "playing";
    },
    focus: () => canvasRef.current?.focus(),
    recoverCheckpoint: () => recoverCheckpointRef.current(),
  }), []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    let disposed = false;
    let runtimeFailed = false;
    const cleanup: Array<() => void> = [];

    const failRuntime = (message: string) => {
      if (runtimeFailed || disposed) return;
      runtimeFailed = true;
      setRuntimeMessage(message);
      callbacksRef.current.onRuntimeError?.(message);
    };

    const probe = document.createElement("canvas");
    const webgl2 = probe.getContext("webgl2", {
      alpha: false,
      antialias: false,
      powerPreference: "default",
    });
    if (!webgl2) {
      failRuntime("WebGL 2 is unavailable or hardware acceleration is disabled. GameForge switched to the compatibility runtime.");
      return () => cleanup.forEach((fn) => fn());
    }

    try {
      const app = new pc.Application(canvas, {
        graphicsDeviceOptions: {
          alpha: false,
          antialias: spec.quality === "ultra",
          powerPreference: "default",
          stencil: false,
        },
      });
      ensurePlayCanvasContainerHandler(app);
      appRef.current = app;

      // Some Windows/ANGLE drivers advertise WEBGL_multi_draw but fail to
      // compile the generated extension shader. GameForge does not need
      // multi-draw for these compact vertical slices, so disable it before
      // any materials are compiled.
      const compatibilityDevice = app.graphicsDevice as unknown as { supportsMultiDraw?: boolean; maxPixelRatio?: number };
      if (compatibilityDevice.supportsMultiDraw) {
        try {
          compatibilityDevice.supportsMultiDraw = false;
        } catch {
          // Read-only on some engine builds; the runtime still has the legacy fallback.
        }
      }
      if (typeof compatibilityDevice.maxPixelRatio === "number") {
        compatibilityDevice.maxPixelRatio = Math.min(window.devicePixelRatio || 1, 1.5);
      }

      const onContextLost = (event: Event) => {
        event.preventDefault();
        failRuntime("The browser lost the WebGL graphics context. GameForge switched to the compatibility runtime.");
      };
      canvas.addEventListener("webglcontextlost", onContextLost, false);
      cleanup.push(() => canvas.removeEventListener("webglcontextlost", onContextLost, false));
      app.setCanvasFillMode(pc.FILLMODE_NONE);
      app.setCanvasResolution(pc.RESOLUTION_AUTO);
      app.scene.ambientLight = hexColor(spec.visual.horizon, "#4b5563").mulScalar(0.34);
      app.scene.exposure = spec.quality === "ultra" ? 1.18 : 1.05;

      const resize = () => {
        const width = Math.max(320, canvas.clientWidth || 960);
        const height = Math.max(240, canvas.clientHeight || 600);
        app.resizeCanvas(width, height);
      };
      resize();
      const observer = new ResizeObserver(resize);
      observer.observe(canvas);
      cleanup.push(() => observer.disconnect());

      const camera = new pc.Entity("Game camera");
      camera.addComponent("camera", {
        clearColor: hexColor(spec.visual.sky, "#07111f"),
        farClip: Math.max(220, spec.world.size * 3),
        fov: spec.renderer.fieldOfView,
      });
      if (camera.camera) {
        camera.camera.gammaCorrection = pc.GAMMA_SRGB;
        camera.camera.toneMapping = pc.TONEMAP_ACES;
      }
      app.root.addChild(camera);

      const sun = new pc.Entity("Sun");
      sun.addComponent("light", {
        type: "directional",
        color: new pc.Color(1, 0.91, 0.78),
        intensity: spec.world.timeOfDay === "night" ? 1.15 : 1.65,
        castShadows: spec.renderer.softShadows,
        shadowDistance: 70,
        shadowResolution: spec.quality === "ultra" ? 2048 : 1024,
      });
      sun.setEulerAngles(48, -32, 0);
      app.root.addChild(sun);

      const accentMat = makeMaterial(spec.visual.accent, { emissive: spec.visual.accent, gloss: 0.75 });
      const secondaryMat = makeMaterial(spec.visual.secondaryAccent, { emissive: spec.visual.secondaryAccent, gloss: 0.68 });
      const groundMat = makeMaterial(spec.visual.ground, { metalness: 0.08, gloss: 0.28 });
      const wallMat = makeMaterial(spec.world.timeOfDay === "night" ? "#202633" : "#4b5563", { metalness: 0.28, gloss: 0.5 });
      const darkMat = makeMaterial("#0d1119", { metalness: 0.5, gloss: 0.7 });
      const playerMat = makeMaterial(spec.visual.player, { metalness: spec.visual.metallic, gloss: 1 - spec.visual.roughness });
      const enemyMat = makeMaterial(spec.visual.enemy, { metalness: 0.4, gloss: 0.6 });
      // Kart racing reprojects the Design Studio regions around the generated circuit.
      // Building the raw map as well would duplicate scenery and create an unrelated
      // block of geometry through the middle of the track.
      const generatedWorldCollisions = spec.templateFamily === "kart-racing"
        ? []
        : createDesignStudioWorld(app, spec, { ground: groundMat, wall: wallMat, accent: accentMat, secondary: secondaryMat });

      const keyState = new Set<string>();
      let interactPressed = false;
      let attackPressed = false;
      let jumpPressed = false;
      let dragging = false;
      let lastMouseX = 0;
      let lastMouseY = 0;

      const isTypingTarget = (target: EventTarget | null) => {
        const element = target instanceof HTMLElement ? target : null;
        return Boolean(element?.closest("input, textarea, select, [contenteditable='true']"));
      };
      const controlledKeys = new Set(["KeyW", "KeyA", "KeyS", "KeyD", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Space", "ShiftLeft", "ShiftRight", "ControlLeft", "ControlRight", "KeyE", "KeyF", "KeyP", "KeyR", "Escape"]);
      const onKeyDown = (event: KeyboardEvent) => {
        if (isTypingTarget(event.target)) return;
        if (controlledKeys.has(event.code)) event.preventDefault();
        keyState.add(event.code);
        if (event.code === "KeyE") interactPressed = true;
        if (event.code === "KeyF" && spec.templateFamily === "third-person-action") attackPressed = true;
        if (event.code === "Space" && spec.templateFamily === "third-person-action") jumpPressed = true;
        if (event.code === "Escape") {
          const current = stateRef.current;
          if (current && spec.templateFamily === "kart-racing") {
            current.paused = !current.paused;
            current.status = current.paused ? "paused" : "playing";
            if (current.paused) keyState.clear();
          }
        }
        if (event.code === "KeyP") {
          const current = stateRef.current;
          if (current) {
            current.paused = !current.paused;
            current.status = current.paused ? "paused" : "playing";
            if (current.paused) keyState.clear();
          }
        }
        if (event.code === "KeyR") restartRef.current();
      };
      const onKeyUp = (event: KeyboardEvent) => keyState.delete(event.code);
      const onPointerDown = (event: PointerEvent) => {
        canvas.focus();
        lastMouseX = event.clientX;
        lastMouseY = event.clientY;
        if (event.button === 0 && spec.templateFamily === "third-person-action") attackPressed = true;
        if (event.button === 2) dragging = true;
      };
      const onPointerMove = (event: PointerEvent) => {
        const current = stateRef.current;
        if (!dragging || !current) return;
        current.cameraYaw -= (event.clientX - lastMouseX) * 0.005;
        current.cameraPitch = clamp(current.cameraPitch - (event.clientY - lastMouseY) * 0.003, -0.3, 0.65);
        lastMouseX = event.clientX;
        lastMouseY = event.clientY;
      };
      const onPointerUp = (event: PointerEvent) => { if (event.button === 2) dragging = false; };
      const onContextMenu = (event: MouseEvent) => event.preventDefault();
      const onWheel = (event: WheelEvent) => {
        const current = stateRef.current;
        if (current) current.cameraDistance = clamp(current.cameraDistance + event.deltaY * 0.008, 4.8, 13);
      };
      window.addEventListener("keydown", onKeyDown, { passive: false });
      window.addEventListener("keyup", onKeyUp);
      canvas.addEventListener("pointerdown", onPointerDown);
      window.addEventListener("pointermove", onPointerMove);
      window.addEventListener("pointerup", onPointerUp);
      canvas.addEventListener("contextmenu", onContextMenu);
      canvas.addEventListener("wheel", onWheel, { passive: true });
      cleanup.push(() => {
        window.removeEventListener("keydown", onKeyDown);
        window.removeEventListener("keyup", onKeyUp);
        canvas.removeEventListener("pointerdown", onPointerDown);
        window.removeEventListener("pointermove", onPointerMove);
        window.removeEventListener("pointerup", onPointerUp);
        canvas.removeEventListener("contextmenu", onContextMenu);
        canvas.removeEventListener("wheel", onWheel);
      });

      const state: RuntimeState = {
        status: "playing",
        health: spec.player.health,
        score: 0,
        progress: 0,
        defeated: 0,
        collected: 0,
        elapsed: 0,
        objectiveText: spec.objective.description,
        fps: 0,
        paused: false,
        lastFrame: performance.now(),
        frameCount: 0,
        fpsClock: 0,
        cameraYaw: Math.PI,
        cameraPitch: 0.22,
        cameraDistance: spec.templateFamily === "driving-racing" ? 10.5 : spec.templateFamily === "third-person-action" ? 11.5 : 10,
        speed: 0,
        steeringInput: 0,
        currentSteerAngle: 0,
        driftCharge: 0,
        boostRemaining: 0,
        isDrifting: false,
        lastSafePosition: null,
        lastSafeRotation: 0,
        altitude: 0,
        stamina: 100,
        wind: spec.flight?.windStrength || 0,
        speaker: spec.runtimeContent.dialogue.find((line) => line.trigger === "opening")?.speaker || "Mission Control",
        dialogueText: spec.runtimeContent.dialogue.find((line) => line.trigger === "opening")?.line || spec.runtimeContent.opening,
        storyBeat: spec.runtimeContent.storyBeats[0] || spec.runtimeContent.opening,
        jumpVelocity: 0,
        raceState: spec.templateFamily === "kart-racing" ? "READY" : "LOADING",
        raceStateBeforePause: null,
        countdownValue: 3,
        countdownText: "Ready",
        currentLap: 1,
        lapCount: 3,
        currentCheckpoint: 0,
        checkpointCount: 0,
        currentLapTime: 0,
        totalRaceTime: 0,
        bestLapTime: 0,
        completedLapTimes: [],
        speedKph: 0,
        boostPercent: 0,
        finishPosition: 0,
        wrongWay: false,
      };
      stateRef.current = state;

      const setDialogue = (trigger: "opening" | "quest" | "alert" | "victory" | "defeat", questIndex?: number) => {
        const line = spec.runtimeContent.dialogue.find((item) => item.trigger === trigger && (trigger !== "quest" || item.questIndex === questIndex))
          || (trigger === "quest" ? spec.runtimeContent.dialogue.find((item) => item.trigger === "quest") : undefined);
        if (line) {
          state.speaker = line.speaker;
          state.dialogueText = line.line;
        } else if (trigger === "victory") {
          state.speaker = "Mission Complete";
          state.dialogueText = spec.runtimeContent.victory;
        } else if (trigger === "defeat") {
          state.speaker = "Mission Failed";
          state.dialogueText = spec.runtimeContent.defeat;
        }
      };

      const attachEnvironmentLandmark = (
        position: pc.Vec3,
        parentScale = 1,
        yOffset = -1.5,
        name = "Imported environment landmark",
      ) => {
        if (!spec.assets.environmentModelUrl) return null;
        const environmentRoot = new pc.Entity(name);
        environmentRoot.setPosition(position.x, position.y + yOffset, position.z);
        environmentRoot.setLocalScale(parentScale, parentScale, parentScale);
        app.root.addChild(environmentRoot);
        void attachGeneratedModel(app, environmentRoot, null, spec.assets.environmentModelUrl, "environment");
        return environmentRoot;
      };

      let restart: () => void;
      let update: (dt: number) => void;

      if (spec.templateFamily === "third-person-action") {
        const bounds = mapBounds(spec);
        const ground = createPrimitive(app, "box", "Generated playable world ground", [0, -0.55, 0], [bounds.x * 2.1, 1, bounds.z * 2.1], groundMat);
        ground.render!.castShadows = false;
        const thirdPersonLandmarkRegion = spec.world.layout?.regions.at(-1);
        attachEnvironmentLandmark(
          layoutPoint(spec, thirdPersonLandmarkRegion?.position, thirdPersonLandmarkRegion?.elevation || 0),
          0.42,
          -1.35,
          "Design Studio world landmark",
        );
        const collisions: CollisionBox[] = [...generatedWorldCollisions];
        const wall = (name: string, position: [number, number, number], scale: [number, number, number]) => {
          createPrimitive(app, "box", name, position, scale, wallMat);
          collisions.push({ x: position[0], z: position[2], halfX: scale[0] / 2, halfZ: scale[2] / 2 });
        };

        if (isHeistWorld(spec)) {
          // The authored bank kit is only blended into bank/heist concepts. Other worlds use their generated map directly.
          wall("North wall", [0, 2.5, -15], [36, 5, 0.7]);
          wall("South wall left", [-11, 2.5, 13], [14, 5, 0.7]);
          wall("South wall right", [12, 2.5, 13], [12, 5, 0.7]);
          wall("West wall north", [-18, 2.5, -5], [0.7, 5, 20]);
          wall("West wall south", [-18, 2.5, 12], [0.7, 5, 2]);
          wall("East wall upper", [18, 2.5, -8], [0.7, 5, 14]);
          wall("East wall lower", [18, 2.5, 5], [0.7, 5, 4]);
          wall("Security room wall", [-6, 2.5, -2], [0.6, 5, 14]);
          wall("Vault corridor north", [6, 2.5, -12.5], [0.6, 5, 5]);
          wall("Vault corridor south", [6, 2.5, 1.5], [0.6, 5, 9]);
          wall("Vault rear", [12, 2.5, -11], [12, 5, 0.7]);
          wall("Parking divider", [8, 1.5, 7], [17, 3, 0.5]);
          for (let index = 0; index < 4; index += 1) {
            createPrimitive(app, "box", `Lobby desk ${index + 1}`, [-12 + index * 3.5, 0.65, 3.5], [2.5, 1.3, 1.1], darkMat);
          }
          const vaultDoor = createPrimitive(app, "cylinder", "Vault door", [6.45, 2.3, -8], [3.2, 0.7, 3.2], makeMaterial("#8590a2", { metalness: 0.95, gloss: 0.85 }));
          vaultDoor.setEulerAngles(0, 0, 90);
          createPrimitive(app, "box", "Security terminal", [-4, 1.1, -5], [1.2, 2.2, 0.8], secondaryMat);
        }

        const playerRoot = new pc.Entity("Player root");
        app.root.addChild(playerRoot);
        const fallbackPlayer = createHumanoidFallback(app, "Fallback player", playerMat, playerRoot, accentMat);
        const generatedSpawn = layoutPoint(spec, spec.world.layout?.playerSpawn);
        const spawn = isHeistWorld(spec) ? new pc.Vec3(-22, 0, 10) : generatedSpawn;
        playerRoot.setPosition(spawn);
        void attachGeneratedModel(app, playerRoot, fallbackPlayer, spec.assets.playerModelUrl, "player");

        const missionStages = spec.thirdPerson?.missionStages?.length ? spec.thirdPerson.missionStages : stageDefaults();
        const markers = missionStages.map((stage, index) => {
          const material = index === 0 ? accentMat : makeMaterial("#334155", { emissive: "#111827", opacity: 0.5 });
          const marker = createPrimitive(app, "cylinder", `Mission marker ${stage.id}`, stage.position, [1.25, 0.14, 1.25], material);
          createPrimitive(app, "cylinder", `Mission beacon ${stage.id}`, [stage.position[0], stage.position[1] + 1.25, stage.position[2]], [0.07, 2.3, 0.07], material);
          createPrimitive(app, "sphere", `Mission signal ${stage.id}`, [stage.position[0], stage.position[1] + 2.5, stage.position[2]], [0.24, 0.24, 0.24], material);
          return marker;
        });
        markers.forEach((marker) => marker.setEulerAngles(0, 0, 0));

        const guards: GuardState[] = [];
        const mapPatrolPoints = (spec.world.layout?.objectiveAnchors?.map((anchor) => layoutPoint(spec, anchor.position))
          || spec.world.layout?.regions.map((region) => layoutPoint(spec, region.position, region.elevation))
          || []).slice(0, 8);
        const authoredPatrols: Array<[[number, number, number], [number, number, number]]> = [
          [[-12, 0, -8], [-2, 0, -8]],
          [[1, 0, 5], [12, 0, 5]],
          [[8, 0, -10], [15, 0, -10]],
          [[-13, 0, 9], [-5, 0, 9]],
          [[13, 0, -1], [13, 0, 8]],
          [[-1, 0, -1], [4, 0, -1]],
        ];
        const patrols: Array<[[number, number, number], [number, number, number]]> = mapPatrolPoints.length >= 2 && !isHeistWorld(spec)
          ? mapPatrolPoints.map((point, index) => {
              const next = mapPatrolPoints[(index + 1) % mapPatrolPoints.length];
              return [[point.x, 0, point.z], [next.x, 0, next.z]];
            })
          : authoredPatrols;
        const guardCount = clamp(spec.thirdPerson?.guardPatrolCount || spec.enemy.count, 4, 10);
        for (let index = 0; index < guardCount; index += 1) {
          const patrol = patrols[index % patrols.length];
          const root = new pc.Entity(`Guard ${index + 1}`);
          app.root.addChild(root);
          const fallback = createHumanoidFallback(app, "Guard fallback", enemyMat, root, darkMat);
          root.setPosition(...patrol[0]);
          if (index === 0) void attachGeneratedModel(app, root, fallback, spec.assets.enemyModelUrl, "enemy");
          guards.push({ entity: root, start: new pc.Vec3(...patrol[0]), target: new pc.Vec3(...patrol[1]), direction: 1, stunnedUntil: 0 });
        }

        let missionIndex = 0;
        let alarm = 0;
        let attackCooldown = 0;
        let alertShown = false;

        const reset = () => {
          playerRoot.setPosition(spawn);
          playerRoot.setEulerAngles(0, 0, 0);
          missionIndex = 0;
          alarm = 0;
          attackCooldown = 0;
          alertShown = false;
          state.status = "playing";
          state.paused = false;
          state.health = spec.player.health;
          state.score = 0;
          state.progress = 0;
          state.defeated = 0;
          state.collected = 0;
          state.elapsed = 0;
          state.jumpVelocity = 0;
          state.storyBeat = spec.runtimeContent.storyBeats[0] || spec.runtimeContent.opening;
          setDialogue("opening");
          state.objectiveText = `${missionStages[0].title}: ${missionStages[0].instruction}`;
          markers.forEach((marker, index) => {
            marker.enabled = true;
            if (marker.render) marker.render.material = index === 0 ? accentMat : darkMat;
          });
          guards.forEach((guard, index) => {
            guard.entity.enabled = true;
            guard.entity.setPosition(guard.start);
            guard.stunnedUntil = 0;
            guard.direction = index % 2 ? -1 : 1;
          });
          camera.setPosition(spawn.x, spawn.y + 6, spawn.z + 9);
        };
        restart = reset;
        reset();

        update = (dt) => {
          if (state.paused || state.status === "victory" || state.status === "defeat") return;
          state.elapsed += dt;
          attackCooldown = Math.max(0, attackCooldown - dt);
          const pos = playerRoot.getPosition().clone();
          if (jumpPressed) {
            jumpPressed = false;
            if (pos.y <= 0.02) state.jumpVelocity = spec.player.jumpForce;
          }
          state.jumpVelocity -= 22 * dt;
          pos.y = Math.max(0, pos.y + state.jumpVelocity * dt);
          if (pos.y <= 0) state.jumpVelocity = 0;
          let inputX = 0;
          let inputZ = 0;
          if (keyState.has("KeyA") || keyState.has("ArrowLeft")) inputX -= 1;
          if (keyState.has("KeyD") || keyState.has("ArrowRight")) inputX += 1;
          if (keyState.has("KeyW") || keyState.has("ArrowUp")) inputZ += 1;
          if (keyState.has("KeyS") || keyState.has("ArrowDown")) inputZ -= 1;
          const length = Math.hypot(inputX, inputZ) || 1;
          const speed = spec.player.speed * (keyState.has("ShiftLeft") || keyState.has("ShiftRight") ? spec.player.dashMultiplier : 1);
          if (inputX || inputZ) {
            const forwardX = Math.sin(state.cameraYaw);
            const forwardZ = Math.cos(state.cameraYaw);
            const rightX = -Math.cos(state.cameraYaw);
            const rightZ = Math.sin(state.cameraYaw);
            const moveX = (rightX * inputX + forwardX * inputZ) / length;
            const moveZ = (rightZ * inputX + forwardZ * inputZ) / length;
            const nextX = clamp(pos.x + moveX * speed * dt, -bounds.x, bounds.x);
            const nextZ = clamp(pos.z + moveZ * speed * dt, -bounds.z, bounds.z);
            if (!collides(nextX, pos.z, collisions)) pos.x = nextX;
            if (!collides(pos.x, nextZ, collisions)) pos.z = nextZ;
            playerRoot.setPosition(pos.x, pos.y, pos.z);
            playerRoot.setEulerAngles(0, Math.atan2(moveX, moveZ) * 180 / Math.PI, 0);
          }

          if (!inputX && !inputZ) playerRoot.setPosition(pos.x, pos.y, pos.z);

          const now = performance.now() / 1000;
          const detectionRadius = spec.thirdPerson?.detectionRadius || 7.5;
          let detected = false;
          guards.forEach((guard) => {
            if (!guard.entity.enabled) return;
            if (guard.stunnedUntil > now) return;
            const target = guard.direction > 0 ? guard.target : guard.start;
            const guardPos = guard.entity.getPosition().clone();
            const dx = target.x - guardPos.x;
            const dz = target.z - guardPos.z;
            const distance = Math.hypot(dx, dz);
            if (distance < 0.25) guard.direction *= -1;
            else {
              guardPos.x += dx / distance * spec.enemy.speed * 0.45 * dt;
              guardPos.z += dz / distance * spec.enemy.speed * 0.45 * dt;
              guard.entity.setPosition(guardPos);
              guard.entity.setEulerAngles(0, Math.atan2(dx, dz) * 180 / Math.PI, 0);
            }
            if (distanceXZ(guardPos, pos) < detectionRadius) detected = true;
          });
          alarm = clamp(alarm + (detected ? 34 * dt : -22 * dt), 0, 100);
          if (alarm > 72) {
            if (!alertShown) { setDialogue("alert"); alertShown = true; }
            state.health = Math.max(0, state.health - spec.enemy.damage * 0.34 * dt);
            state.objectiveText = `ALARM ${Math.round(alarm)}% · ${missionStages[Math.min(missionIndex, missionStages.length - 1)].instruction}`;
          }

          if (attackPressed && attackCooldown <= 0) {
            attackPressed = false;
            attackCooldown = spec.player.attackCooldown;
            const nearest = guards
              .filter((guard) => guard.entity.enabled && guard.stunnedUntil <= now)
              .map((guard) => ({ guard, distance: distanceXZ(guard.entity.getPosition(), pos) }))
              .sort((a, b) => a.distance - b.distance)[0];
            if (nearest && nearest.distance < 4.5) {
              nearest.guard.stunnedUntil = now + 6;
              nearest.guard.entity.enabled = false;
              state.defeated += 1;
              state.score += 175;
            }
          }

          const stage = missionStages[missionIndex];
          if (stage) {
            const stagePosition = new pc.Vec3(...stage.position);
            const near = distanceXZ(pos, stagePosition) < 2.6;
            const complete = near && (stage.interaction === "reach" || stage.interaction === "extract" || interactPressed);
            if (complete) {
              markers[missionIndex].enabled = false;
              if (stage.interaction === "collect") state.collected += 1;
              state.score += 500;
              missionIndex += 1;
              state.progress = missionIndex;
              state.storyBeat = spec.runtimeContent.storyBeats[Math.min(missionIndex, spec.runtimeContent.storyBeats.length - 1)] || state.storyBeat;
              setDialogue("quest", Math.min(missionIndex, missionStages.length - 1));
              if (missionIndex >= missionStages.length) {
                state.status = "victory";
                state.objectiveText = spec.narrative.victoryText;
                setDialogue("victory");
              } else {
                markers[missionIndex].render!.material = accentMat;
                state.objectiveText = `${missionStages[missionIndex].title}: ${missionStages[missionIndex].instruction}`;
              }
            } else if (!detected) {
              state.objectiveText = `${stage.title}: ${stage.instruction}${near && stage.interaction !== "reach" ? " · Press E" : ""}`;
            }
          }
          interactPressed = false;
          if (state.health <= 0 || state.elapsed > spec.objective.timeLimitSeconds) {
            state.status = "defeat";
            state.objectiveText = spec.narrative.defeatText;
            setDialogue("defeat");
          }

          const look = playerRoot.getPosition();
          const horizontal = Math.cos(state.cameraPitch) * state.cameraDistance;
          const desired = new pc.Vec3(
            look.x - Math.sin(state.cameraYaw) * horizontal,
            3.1 + look.y + Math.sin(state.cameraPitch) * state.cameraDistance,
            look.z - Math.cos(state.cameraYaw) * horizontal,
          );
          camera.setPosition(desired);
          camera.lookAt(look.x, look.y + 1.5, look.z);
        };
      } else if (spec.templateFamily === "kart-racing") {
        const trackSpec = buildGeargardenTrackSpec(spec);
        const trackSamples = generateTrackSamples(trackSpec, 220);
        const circuitCenter = trackSamples.reduce((center, sample) => center.add(sample.position), new pc.Vec3()).scale(1 / Math.max(1, trackSamples.length));
        attachEnvironmentLandmark(circuitCenter, 0.28, -1.45, "World Builder circuit centerpiece");
        const lunarTrack = /moon|lunar|crater|regolith/.test(worldSearchText(spec));
        const roadMaterial = makeMaterial(lunarTrack ? "#343a46" : "#3c424c", { metalness: 0.18, gloss: 0.32 });
        const shoulderMaterial = makeMaterial(lunarTrack ? "#747b89" : spec.visual.ground, { metalness: 0.08, gloss: 0.2 });
        const barrierMaterial = makeMaterial("#e56b3f", { metalness: 0.12, gloss: 0.48 });
        const postMaterial = makeMaterial("#6b4b2d", { metalness: 0.2, gloss: 0.4 });
        const accentMaterial = makeMaterial(spec.visual.accent, { emissive: spec.visual.accent, gloss: 0.75 });
        const darkMaterial = makeMaterial("#2b251f", { metalness: 0.3, gloss: 0.5 });
        const checkeredMaterial = makeMaterial("#111827", { metalness: 0.05, gloss: 0.1 });
        const trackRoot = new pc.Entity("Geargarden track root");
        app.root.addChild(trackRoot);
        buildTrackRoad(app, trackRoot, trackSamples, trackSpec.roadWidth, roadMaterial, shoulderMaterial);
        createTrackBarrier(app, trackRoot, trackSamples, trackSpec.roadWidth, trackSpec.barrierWidth, barrierMaterial, postMaterial);
        const finishLine = createStartFinishLine(app, trackRoot, trackSamples[0], trackSamples[1], checkeredMaterial, accentMaterial);
        const checkpointData = createCheckpoints(app, trackRoot, trackSamples, trackSpec.checkpointCount, accentMaterial);
        createPrimitive(app, "box", "Generated racing world base", [0, -0.8, -24], [150, 1.6, 190], makeMaterial(lunarTrack ? "#585e6a" : spec.visual.ground, { metalness: 0.08, gloss: 0.2 }), trackRoot);
        const scenery = spec.world.layout?.regions?.length
          ? createMapDrivenTrackScenery(app, trackRoot, spec, trackSamples, { ground: groundMat, wall: wallMat, accent: accentMaterial, secondary: secondaryMat, dark: darkMaterial })
          : createGeargardenScenery(app, trackRoot, trackSpec, makeMaterial(spec.visual.ground, { metalness: 0.08, gloss: 0.2 }), accentMaterial, secondaryMat, darkMaterial);
        const bridge = createGeargardenBridge(app, trackRoot, trackSamples[45], trackSamples[65], roadMaterial, barrierMaterial);
        const tunnel = createTunnel(app, trackRoot, trackSamples[95], trackSamples[110], darkMaterial, accentMaterial);
        const ramp = createJumpRamp(app, trackRoot, trackSamples[135], trackSamples[145], roadMaterial, accentMaterial);
        const shortcut = createShortcut(app, trackRoot, trackSpec.shortcutData, roadMaterial, accentMaterial);
        const boosts = createBoostPads(app, trackRoot, trackSamples, accentMaterial, barrierMaterial);
        const showTrackDebug = typeof window !== "undefined" && new URLSearchParams(window.location.search).get("trackdebug") === "1";
        if (showTrackDebug) {
          checkpointData.checkpoints.forEach((checkpoint) => {
            const marker = new pc.Entity(`Debug ${checkpoint.name}`);
            marker.addComponent("render", { type: "sphere", material: makeMaterial("#ffdd57") });
            marker.setPosition(checkpoint.position.x, checkpoint.position.y + 0.6, checkpoint.position.z);
            marker.setLocalScale(0.4, 0.4, 0.4);
            trackRoot.addChild(marker);
          });
        }

        const { playerKart, kartBody, vehicleFallback, characterModel, cameraTarget } = createKartPlayerHierarchy(app, app.root, playerMat, darkMaterial, accentMaterial);
        const driverAnchor = new pc.Entity("DriverAnchor");
        driverAnchor.setLocalPosition(0, -0.08, 0.04);
        driverAnchor.setLocalEulerAngles(0, 180, 0);
        characterModel.addChild(driverAnchor);
        const fallbackDriver = createHumanoidFallback(app, "Kart driver fallback", playerMat, driverAnchor, accentMaterial);
        fallbackDriver.setLocalScale(0.52, 0.52, 0.52);
        fallbackDriver.setLocalPosition(0, -0.15, 0);
        void attachGeneratedModel(app, driverAnchor, fallbackDriver, spec.assets.playerModelUrl, "driver");
        void attachGeneratedModel(app, kartBody, vehicleFallback, spec.assets.vehicleModelUrl, "vehicle");

        const maxForwardSpeed = 22;
        const maxReverseSpeed = 7;
        const acceleration = 15;
        const reverseAcceleration = 8;
        const brakingForce = 22;
        const coastingFriction = 7;
        const offRoadFriction = 12;
        const steeringRate = 90 * Math.PI / 180;
        const maximumSteeringAngle = 30 * Math.PI / 180;
        const checkpointCount = checkpointData.checkpoints.length;
        const lapCount = Math.round(clamp(spec.lapCount || 3, 1, 10));
        let heading = 0;
        let cameraFov = spec.renderer.fieldOfView;
        let driftTimer = 0;
        let raceState: RuntimeStats["raceState"] = "READY";
        let countdownTimer = 3;
        let nextCheckpointIndex = 0;
        let pendingFinish = false;
        let currentLap = 1;
        let currentLapTime = 0;
        let totalRaceTime = 0;
        let bestLapTime = Number.POSITIVE_INFINITY;
        let completedLapTimes: number[] = [];
        let finishPosition = 0;
        let wrongWay = false;
        const kartSpawn = new pc.Vec3(trackSpec.spawnPosition[0], trackSpec.spawnPosition[1], trackSpec.spawnPosition[2]);
        const syncRaceStats = () => {
          state.raceState = raceState;
          state.currentLap = currentLap;
          state.lapCount = lapCount;
          state.currentCheckpoint = nextCheckpointIndex;
          state.checkpointCount = checkpointCount;
          state.currentLapTime = currentLapTime;
          state.totalRaceTime = totalRaceTime;
          state.bestLapTime = Number.isFinite(bestLapTime) ? bestLapTime : 0;
          state.completedLapTimes = completedLapTimes;
          state.speedKph = Math.round(Math.abs(state.speed) * 3.6);
          state.boostPercent = Math.round(Math.max(0, Math.min(100, (state.boostRemaining / 2.6) * 100)));
          state.finishPosition = finishPosition;
          state.wrongWay = wrongWay;
          state.countdownValue = raceState === "COUNTDOWN" ? Math.max(0, Math.ceil(countdownTimer)) : raceState === "READY" ? 3 : raceState === "RACING" ? "GO" : "GO";
          state.countdownText = raceState === "COUNTDOWN" ? (countdownTimer > 2 ? "Ready" : countdownTimer > 1 ? "Set" : "Go") : raceState === "RACING" ? "Go" : raceState === "FINISHED" ? "Finished" : "Ready";
        };
        const completeLap = () => {
          const lapTime = currentLapTime;
          if (lapTime > 0) {
            completedLapTimes = [...completedLapTimes, lapTime];
            if (bestLapTime === Number.POSITIVE_INFINITY || lapTime < bestLapTime) bestLapTime = lapTime;
          }
          if (currentLap >= lapCount) {
            raceState = "FINISHED";
            finishPosition = 1;
            state.status = "victory";
            state.objectiveText = "Race complete";
            state.speaker = "Race Complete";
            state.dialogueText = `You mastered ${trackSpec.trackName}.`;
            state.score += 1200;
          } else {
            currentLap += 1;
            nextCheckpointIndex = 0;
            pendingFinish = false;
            currentLapTime = 0;
            state.objectiveText = `Lap ${currentLap}/${lapCount}`;
            state.speaker = "Lap clear";
            state.dialogueText = `You are on lap ${currentLap}.`;
            raceState = "RACING";
          }
          syncRaceStats();
        };
        const recoverKart = () => {
          const safePosition = state.lastSafePosition?.clone() || kartSpawn.clone();
          safePosition.y = Math.max(1.35, safePosition.y);
          playerKart.setPosition(safePosition);
          const safeHeadingRadians = Number.isFinite(state.lastSafeRotation)
            ? state.lastSafeRotation
            : trackSpec.spawnRotation * Math.PI / 180;
          playerKart.setEulerAngles(0, safeHeadingRadians * 180 / Math.PI, 0);
          heading = safeHeadingRadians;
          state.speed = 0;
          state.steeringInput = 0;
          state.currentSteerAngle = 0;
          state.driftCharge = 0;
          state.boostRemaining = 0;
          state.isDrifting = false;
          state.wrongWay = false;
          state.objectiveText = pendingFinish
            ? "Cross the start/finish line to complete the lap."
            : `Recover complete · checkpoint ${Math.min(nextCheckpointIndex + 1, checkpointCount)}/${checkpointCount}`;
          state.speaker = "Track Marshal";
          state.dialogueText = "Kart recovered to the last safe section of the circuit.";
          syncRaceStats();
        };
        recoverCheckpointRef.current = recoverKart;

        const reset = () => {
          const safePosition = kartSpawn.clone();
          safePosition.y = Math.max(1.35, safePosition.y);
          playerKart.setPosition(safePosition);
          const spawnHeading = trackSpec.spawnRotation * Math.PI / 180;
          playerKart.setEulerAngles(0, trackSpec.spawnRotation, 0);
          heading = spawnHeading;
          state.lastSafeRotation = spawnHeading;
          state.lastSafePosition = safePosition.clone();
          state.speed = 0;
          state.steeringInput = 0;
          state.currentSteerAngle = 0;
          state.driftCharge = 0;
          state.boostRemaining = 0;
          state.isDrifting = false;
          state.status = "playing";
          state.paused = false;
          state.health = spec.player.health;
          state.score = 0;
          state.progress = 0;
          state.elapsed = 0;
          state.objectiveText = spec.runtimeContent.quests[0]?.instruction || `Drive through the ${trackSpec.trackName}.`;
          state.storyBeat = spec.runtimeContent.storyBeats[0] || spec.runtimeContent.opening;
          state.raceState = "READY";
          state.currentLap = 1;
          state.lapCount = lapCount;
          state.currentCheckpoint = 0;
          state.checkpointCount = checkpointCount;
          state.currentLapTime = 0;
          state.totalRaceTime = 0;
          state.bestLapTime = 0;
          state.completedLapTimes = [];
          state.speedKph = 0;
          state.boostPercent = 0;
          state.finishPosition = 0;
          state.wrongWay = false;
          state.countdownValue = 3;
          state.countdownText = "Ready";
          raceState = "READY";
          countdownTimer = 3;
          nextCheckpointIndex = 0;
          pendingFinish = false;
          currentLap = 1;
          currentLapTime = 0;
          totalRaceTime = 0;
          bestLapTime = Number.POSITIVE_INFINITY;
          completedLapTimes = [];
          finishPosition = 0;
          wrongWay = false;
          cameraFov = spec.renderer.fieldOfView;
          kartBody.setLocalEulerAngles(0, 0, 0);
          setDialogue("opening");
          syncRaceStats();
        };
        restart = reset;
        reset();
        update = (dt) => {
          if (state.paused || state.status === "victory" || state.status === "defeat") {
            if (state.paused) keyState.clear();
            return;
          }
          state.elapsed += dt;
          totalRaceTime += dt;
          if (raceState === "COUNTDOWN") {
            countdownTimer = Math.max(0, countdownTimer - dt);
            if (countdownTimer <= 0) {
              raceState = "RACING";
              state.objectiveText = `Lap ${currentLap}/${lapCount}`;
              state.speaker = "Go";
              state.dialogueText = "The race has begun.";
            }
            syncRaceStats();
            return;
          }
          if (raceState === "READY") {
            raceState = "COUNTDOWN";
            state.objectiveText = "Get ready";
            state.speaker = "Countdown";
            state.dialogueText = "Hold the line and prepare to launch.";
            syncRaceStats();
            return;
          }
          if (raceState === "FINISHED") return;
          currentLapTime += dt;
          const throttleInput = (keyState.has("KeyW") || keyState.has("ArrowUp") ? 1 : 0) - (keyState.has("KeyS") || keyState.has("ArrowDown") ? 1 : 0);
          const steeringInput = (keyState.has("KeyD") || keyState.has("ArrowRight") ? 1 : 0) - (keyState.has("KeyA") || keyState.has("ArrowLeft") ? 1 : 0);
          const boostRequested = keyState.has("ShiftLeft") || keyState.has("ShiftRight");
          const driftRequested = keyState.has("Space");
          const movingForward = state.speed > 0.1;
          const movingBackward = state.speed < -0.1;
          const speedMagnitude = Math.abs(state.speed);
          const targetSteerAngle = steeringInput * maximumSteeringAngle * (speedMagnitude < 0.85 ? 0.28 : 1) * (movingBackward ? 0.88 : 1);
          const steeringSpeed = Math.max(0.3, 1 - speedMagnitude / (maxForwardSpeed * 1.2));
          state.steeringInput = steeringInput;
          state.currentSteerAngle += (targetSteerAngle - state.currentSteerAngle) * Math.min(1, dt * steeringRate * steeringSpeed);

          const nearestTrackSample = trackSamples.reduce<{ sample: TrackSample; distance: number } | null>((closest, sample) => {
            const distance = playerKart.getPosition().distance(sample.position);
            if (!closest || distance < closest.distance) return { sample, distance };
            return closest;
          }, null);
          const offRoad = nearestTrackSample ? nearestTrackSample.distance > trackSpec.roadWidth * 0.58 : true;
          const friction = offRoad ? offRoadFriction : (state.isDrifting ? offRoadFriction : coastingFriction);

          if (throttleInput > 0) {
            const boostMultiplier = boostRequested && state.boostRemaining > 0 ? 1.55 : 1;
            if (state.speed < 0) state.speed += reverseAcceleration * dt * 0.7;
            else state.speed = Math.min(maxForwardSpeed + (boostRequested && state.boostRemaining > 0 ? 7 : 0), state.speed + acceleration * dt * boostMultiplier);
          } else if (throttleInput < 0) {
            if (state.speed > 0.12) state.speed -= brakingForce * dt;
            else if (state.speed < -0.12) state.speed += reverseAcceleration * dt * 0.8;
            else state.speed = Math.max(-maxReverseSpeed, state.speed - reverseAcceleration * dt * 0.5);
          } else {
            if (state.speed > 0) state.speed = Math.max(0, state.speed - friction * dt);
            else if (state.speed < 0) state.speed = Math.min(0, state.speed + friction * dt * 0.7);
          }

          const canDrift = driftRequested && speedMagnitude > 3.2 && steeringInput !== 0;
          if (canDrift) {
            state.isDrifting = true;
            state.driftCharge = Math.min(1.35, state.driftCharge + dt * 0.7);
            driftTimer += dt;
          } else if (state.isDrifting) {
            const driftLevel = state.driftCharge > 1.05 ? 3 : state.driftCharge > 0.55 ? 2 : state.driftCharge > 0.22 ? 1 : 0;
            if (driftLevel > 0) {
              const boostGain = driftLevel === 1 ? 0.8 : driftLevel === 2 ? 1.35 : 1.9;
              state.boostRemaining = Math.min(2.6, state.boostRemaining + boostGain);
            }
            state.isDrifting = false;
            state.driftCharge = 0;
            driftTimer = 0;
          }

          if (state.isDrifting) {
            const driftLean = clamp(Math.sign(state.currentSteerAngle) * 0.16, -0.18, 0.18);
            kartBody.setLocalEulerAngles(0, 0, driftLean);
          } else {
            kartBody.setLocalEulerAngles(0, 0, 0);
          }

          const steeringMultiplier = state.isDrifting ? 1.16 : 1;
          const moveDirection = state.speed < 0 ? -1 : 1;
          const steerEffect = state.currentSteerAngle * (movingForward || movingBackward ? 1 : 0.18) * steeringMultiplier;
          const yawDelta = steerEffect * dt * (0.4 + speedMagnitude / (maxForwardSpeed + 6)) * moveDirection;
          heading += yawDelta;

          const position = playerKart.getPosition().clone();
          const forward = new pc.Vec3(Math.sin(heading), 0, Math.cos(heading));
          const moveDelta = forward.mulScalar(state.speed * dt);
          position.x += moveDelta.x;
          position.z += moveDelta.z;
          if (nearestTrackSample) {
            const surfaceHeight = nearestTrackSample.sample.position.y + 0.74;
            position.y = Math.max(1.25, surfaceHeight);
          } else {
            position.y = Math.max(1.25, position.y);
          }
          playerKart.setPosition(position);
          playerKart.setEulerAngles(0, heading * 180 / Math.PI, 0);

          if (state.boostRemaining > 0) {
            const boostActive = boostRequested && state.boostRemaining > 0;
            if (boostActive) {
              state.boostRemaining = Math.max(0, state.boostRemaining - dt * 1.25);
              state.speed = Math.min(maxForwardSpeed + 10, state.speed + acceleration * dt * 0.65);
            } else {
              state.boostRemaining = Math.max(0, state.boostRemaining - dt * 0.18);
            }
          }

          const targetCheckpoint = checkpointData.checkpoints[Math.min(nextCheckpointIndex, checkpointCount - 1)] || checkpointData.checkpoints[0];
          if (targetCheckpoint) {
            const checkpointDistance = position.distance(targetCheckpoint.position);
            const targetReached = checkpointDistance < 4.5 && state.speed > 0.8;
            if (targetReached && nextCheckpointIndex < checkpointCount) {
              nextCheckpointIndex += 1;
              pendingFinish = nextCheckpointIndex >= checkpointCount;
              state.progress = Math.min(lapCount * checkpointCount, (currentLap - 1) * checkpointCount + Math.min(nextCheckpointIndex, checkpointCount));
              state.score += 220;
              state.objectiveText = pendingFinish ? "Cross the start/finish line to complete the lap." : `Checkpoint ${Math.min(nextCheckpointIndex, checkpointCount)}/${checkpointCount}`;
              state.speaker = pendingFinish ? "Checkpoint clear" : "Checkpoint";
              state.dialogueText = pendingFinish ? "You have cleared the circuit. Finish the lap at the line." : `Checkpoint ${Math.min(nextCheckpointIndex, checkpointCount)} reached.`;
            }
          }

          const finishLineSample = trackSamples[0];
          const finishDistance = finishLineSample ? position.distance(finishLineSample.position) : Number.POSITIVE_INFINITY;
          if (pendingFinish && finishDistance < 6.8 && state.speed > 2.2) {
            completeLap();
          }

          const look = playerKart.getPosition();
          const desiredCameraTarget = new pc.Vec3(0, 1.95 + Math.min(0.75, Math.abs(state.speed) * 0.02), -3.8 - Math.min(1.2, Math.abs(state.speed) * 0.06));
          cameraTarget.setLocalPosition(desiredCameraTarget.x, desiredCameraTarget.y, desiredCameraTarget.z);
          const cameraWorldPoint = cameraTarget.getPosition();
          const nextCameraPosition = new pc.Vec3(
            camera.getPosition().x + (cameraWorldPoint.x - camera.getPosition().x) * Math.min(1, dt * 4.5),
            camera.getPosition().y + (cameraWorldPoint.y - camera.getPosition().y) * Math.min(1, dt * 4.5),
            camera.getPosition().z + (cameraWorldPoint.z - camera.getPosition().z) * Math.min(1, dt * 4.5),
          );
          camera.setPosition(nextCameraPosition);
          const lookAhead = forward.mulScalar(8 + Math.min(2.8, Math.abs(state.speed) * 0.18));
          const lookTarget = new pc.Vec3(look.x + lookAhead.x, look.y + 1.3, look.z + lookAhead.z);
          camera.lookAt(lookTarget.x, lookTarget.y, lookTarget.z);
          const targetFov = spec.renderer.fieldOfView + Math.min(5.4, Math.abs(state.speed) * 0.28) + (state.boostRemaining > 0 ? 1.8 : 0);
          cameraFov += (targetFov - cameraFov) * Math.min(1, dt * 4);
          if (camera.camera) camera.camera.fov = cameraFov;

          if (nearestTrackSample) {
            const forwardVector = new pc.Vec3(Math.sin(heading), 0, Math.cos(heading));
            const trackAlignment = forwardVector.x * nearestTrackSample.sample.tangent.x + forwardVector.z * nearestTrackSample.sample.tangent.z;
            wrongWay = state.speed > 3.5 && trackAlignment < -0.2;
          } else {
            wrongWay = false;
          }

          const safeTrackDistance = trackSpec.roadWidth * 0.46;
          const onSafeTrack = Boolean(nearestTrackSample && nearestTrackSample.distance <= safeTrackDistance && position.y > -1.5);
          if (onSafeTrack) {
            state.lastSafePosition = position.clone();
            state.lastSafePosition.y = Math.max(1.35, state.lastSafePosition.y);
            state.lastSafeRotation = heading;
          }
          syncRaceStats();
        };
      } else if (spec.templateFamily === "driving-racing") {
        const drivingBounds = mapBounds(spec);
        const hasGeneratedRoads = Boolean(spec.world.layout?.paths?.length);
        createPrimitive(app, "box", "Driving world foundation", [0, -0.55, 0], [drivingBounds.x * 2.2, 1, drivingBounds.z * 2.2], groundMat);
        const drivingLandmarkRegion = spec.world.layout?.regions.at(-1);
        attachEnvironmentLandmark(
          layoutPoint(spec, drivingLandmarkRegion?.position, drivingLandmarkRegion?.elevation || 0),
          0.36,
          -1.4,
          "Driving world landmark",
        );
        if (!hasGeneratedRoads) {
          createPrimitive(app, "box", "Fallback road", [0, -0.35, 0], [28, 0.7, 150], darkMat);
          for (const side of [-1, 1]) {
            createPrimitive(app, "box", "Fallback road barrier", [side * 15, 0.55, 0], [0.7, 1.1, 150], wallMat);
          }
        }
        const { playerKart: carRoot, kartBody, vehicleFallback, characterModel } = createKartPlayerHierarchy(app, app.root, playerMat, darkMat, accentMat);
        const driverAnchor = new pc.Entity("Driving character anchor");
        driverAnchor.setLocalPosition(0, -0.08, 0.04);
        driverAnchor.setLocalEulerAngles(0, 180, 0);
        characterModel.addChild(driverAnchor);
        const fallbackDriver = createHumanoidFallback(app, "Driving hero fallback", playerMat, driverAnchor, accentMat);
        fallbackDriver.setLocalScale(0.52, 0.52, 0.52);
        fallbackDriver.setLocalPosition(0, -0.15, 0);
        void attachGeneratedModel(app, driverAnchor, fallbackDriver, spec.assets.playerModelUrl, "driver");
        void attachGeneratedModel(app, kartBody, vehicleFallback, spec.assets.vehicleModelUrl, "vehicle");
        const checkpointCount = spec.driving?.checkpointCount || 10;
        const generatedCheckpoints = [
          ...(spec.world.layout?.objectiveAnchors?.map((anchor) => layoutPoint(spec, anchor.position)) || []),
          ...(spec.world.layout?.regions.map((region) => layoutPoint(spec, region.position, region.elevation)) || []),
        ];
        const checkpointPositions = generatedCheckpoints.length
          ? Array.from({ length: checkpointCount }, (_, index) => generatedCheckpoints[index % generatedCheckpoints.length])
          : Array.from({ length: checkpointCount }, (_, index) => new pc.Vec3(0, 0, -58 + index * (120 / Math.max(1, checkpointCount - 1))));
        const checkpoints = checkpointPositions.map((position, index) => {
          const root = new pc.Entity(`Checkpoint ${index + 1}`);
          root.setPosition(position.x, 0, position.z);
          app.root.addChild(root);
          const material = index === 0 ? accentMat : secondaryMat;
          createPrimitive(app, "box", `Checkpoint ${index + 1} left pillar`, [-3.5, 2.5, 0], [0.45, 5, 0.55], material, root);
          createPrimitive(app, "box", `Checkpoint ${index + 1} right pillar`, [3.5, 2.5, 0], [0.45, 5, 0.55], material, root);
          createPrimitive(app, "box", `Checkpoint ${index + 1} header`, [0, 5, 0], [7.4, 0.45, 0.55], material, root);
          return root;
        });
        let checkpoint = 0;
        let heading = 0;
        const drivingSpawn = layoutPoint(spec, spec.world.layout?.playerSpawn);
        if (!spec.world.layout?.playerSpawn) drivingSpawn.set(0, 0, -68);
        const reset = () => {
          carRoot.setPosition(drivingSpawn);
          carRoot.setEulerAngles(0, 0, 0);
          checkpoint = 0;
          heading = 0;
          state.speed = 0;
          state.status = "playing";
          state.paused = false;
          state.health = spec.player.health;
          state.score = 0;
          state.progress = 0;
          state.elapsed = 0;
          state.objectiveText = spec.runtimeContent.quests[0]?.instruction || "Accelerate and clear every checkpoint.";
          state.storyBeat = spec.runtimeContent.storyBeats[0] || spec.runtimeContent.opening;
          setDialogue("opening");
          checkpoints.forEach((item) => { item.enabled = true; });
        };
        restart = reset;
        reset();
        update = (dt) => {
          if (state.paused || state.status === "victory" || state.status === "defeat") return;
          state.elapsed += dt;
          const throttle = keyState.has("KeyW") || keyState.has("ArrowUp") ? 1 : keyState.has("KeyS") || keyState.has("ArrowDown") ? -0.55 : 0;
          const steer = keyState.has("KeyA") || keyState.has("ArrowLeft") ? -1 : keyState.has("KeyD") || keyState.has("ArrowRight") ? 1 : 0;
          const boost = keyState.has("ShiftLeft") || keyState.has("ShiftRight");
          const maxSpeed = boost ? 34 : 23;
          state.speed = clamp(state.speed + throttle * 17 * dt - Math.sign(state.speed) * 4.5 * dt, -7, maxSpeed);
          heading += steer * (0.8 + Math.abs(state.speed) / 24) * dt * Math.sign(state.speed || 1);
          const position = carRoot.getPosition().clone();
          const previousX = position.x;
          const previousZ = position.z;
          position.x += Math.sin(heading) * state.speed * dt;
          position.z += Math.cos(heading) * state.speed * dt;
          position.x = clamp(position.x, -drivingBounds.x, drivingBounds.x);
          position.z = clamp(position.z, -drivingBounds.z, drivingBounds.z);
          if (collides(position.x, position.z, generatedWorldCollisions, 1.15)) {
            position.x = previousX;
            position.z = previousZ;
            state.health = Math.max(0, state.health - 12 * dt);
            state.speed *= -0.18;
          }
          carRoot.setPosition(position);
          carRoot.setEulerAngles(0, heading * 180 / Math.PI, 0);
          const target = checkpoints[checkpoint];
          if (target && distanceXZ(position, target.getPosition()) < 5.2) {
            target.enabled = false;
            checkpoint += 1;
            state.progress = checkpoint;
            state.score += 300;
            state.objectiveText = checkpoint >= checkpoints.length ? spec.narrative.victoryText : (spec.runtimeContent.quests[Math.min(checkpoint, spec.runtimeContent.quests.length - 1)]?.instruction || `Checkpoint ${checkpoint + 1} of ${checkpoints.length}`);
            state.storyBeat = spec.runtimeContent.storyBeats[Math.min(checkpoint, spec.runtimeContent.storyBeats.length - 1)] || state.storyBeat;
            if (checkpoint >= checkpoints.length) { state.status = "victory"; setDialogue("victory"); } else setDialogue("quest", Math.min(checkpoint, spec.runtimeContent.quests.length - 1));
          }
          if (state.health <= 0 || state.elapsed > spec.objective.timeLimitSeconds) { state.status = "defeat"; setDialogue("defeat"); }
          const look = carRoot.getPosition();
          const desired = new pc.Vec3(look.x - Math.sin(heading) * 9, look.y + 5.2, look.z - Math.cos(heading) * 9);
          camera.setPosition(desired);
          camera.lookAt(look.x, look.y + 1, look.z + Math.cos(heading) * 4);
        };
      } else {
        createPrimitive(app, "box", "Open generated flight world base", [0, -2.5, 0], [spec.world.size, 5, spec.world.size], groundMat);
        const flightRegionsForLandmark = spec.world.layout?.regions || [];
        const flightLandmarkCenter = flightRegionsForLandmark.length
          ? flightRegionsForLandmark.reduce((center, region) => center.add(layoutPoint(spec, region.position, region.elevation)), new pc.Vec3()).scale(1 / flightRegionsForLandmark.length)
          : new pc.Vec3(0, 0, 0);
        attachEnvironmentLandmark(flightLandmarkCenter, 0.72, -2.2, "Open-world environment landmark");
        if (!spec.world.layout?.regions?.length) {
          for (let index = 0; index < 45; index += 1) {
            const angle = index * 2.399;
            const radius = 18 + (index % 9) * 10;
            const height = 4 + (index * 7 % 19);
            createPrimitive(app, index % 3 ? "cone" : "box", `Fallback mountain ${index}`, [Math.cos(angle) * radius, height / 2 - 1, Math.sin(angle) * radius], [6 + index % 5, height, 6 + (index * 3) % 6], index % 4 === 0 ? secondaryMat : wallMat);
          }
        }
        const flightRoot = new pc.Entity("Flight player");
        app.root.addChild(flightRoot);
        const fallbackFlight = createPrimitive(app, "capsule", "Flight fallback", [0, 0, 0], [1.2, 0.7, 2.8], playerMat, flightRoot);
        fallbackFlight.setLocalEulerAngles(90, 0, 0);
        const leftWing = createPrimitive(app, "box", "Left wing", [-1.8, 0, 0], [3.2, 0.12, 1.1], playerMat, flightRoot);
        const rightWing = createPrimitive(app, "box", "Right wing", [1.8, 0, 0], [3.2, 0.12, 1.1], playerMat, flightRoot);
        void attachGeneratedModel(app, flightRoot, fallbackFlight, spec.assets.playerModelUrl, "flight");
        const targetCount = clamp(spec.objective.target, 4, 10);
        const flightRegions = spec.world.layout?.regions || [];
        const landmarks = Array.from({ length: targetCount }, (_, index) => {
          const region = flightRegions[index % Math.max(1, flightRegions.length)];
          const angle = index / targetCount * Math.PI * 2;
          const radius = 28 + (index % 3) * 18;
          const position: [number, number, number] = region
            ? [region.position[0] * 1.15, 11 + region.elevation * 0.55 + (index % 3) * 4, region.position[1] * 1.15]
            : [Math.cos(angle) * radius, 11 + (index % 4) * 6, Math.sin(angle) * radius];
          const landmark = createPrimitive(app, "sphere", `Aerial landmark ${index + 1}`, position, [2.1, 2.1, 2.1], accentMat);
          const ring = createPrimitive(app, "cylinder", `Aerial landmark ring ${index + 1}`, position, [3.2, 0.12, 3.2], secondaryMat);
          ring.setEulerAngles(90, 0, 0);
          return landmark;
        });
        let yaw = 0;
        let pitch = 0;
        let roll = 0;
        const flightSpawn = layoutPoint(spec, spec.world.layout?.playerSpawn);
        flightSpawn.y = Math.max(14, flightSpawn.y + 12);
        if (!spec.world.layout?.playerSpawn) flightSpawn.set(0, 14, -18);
        const reset = () => {
          flightRoot.setPosition(flightSpawn);
          yaw = 0;
          pitch = 0;
          roll = 0;
          state.speed = spec.flight?.cruiseSpeed || 20;
          state.stamina = 100;
          state.status = "playing";
          state.paused = false;
          state.health = spec.player.health;
          state.progress = 0;
          state.score = 0;
          state.elapsed = 0;
          state.objectiveText = spec.runtimeContent.quests[0]?.instruction || "Discover every aerial landmark.";
          state.storyBeat = spec.runtimeContent.storyBeats[0] || spec.runtimeContent.opening;
          setDialogue("opening");
          landmarks.forEach((item) => { item.enabled = true; });
        };
        restart = reset;
        reset();
        update = (dt) => {
          if (state.paused || state.status === "victory" || state.status === "defeat") return;
          state.elapsed += dt;
          const turn = (keyState.has("KeyD") || keyState.has("ArrowRight") ? 1 : 0) - (keyState.has("KeyA") || keyState.has("ArrowLeft") ? 1 : 0);
          const pitchInput = (keyState.has("KeyW") || keyState.has("ArrowUp") ? 1 : 0) - (keyState.has("KeyS") || keyState.has("ArrowDown") ? 1 : 0);
          yaw += turn * (spec.flight?.turnRate || 1.5) * dt;
          pitch = clamp(pitch + pitchInput * 0.9 * dt, -0.65, 0.65);
          roll += (turn * -0.65 - roll) * Math.min(1, dt * 4);
          const flapping = keyState.has("Space") && state.stamina > 2;
          const diving = keyState.has("ShiftLeft") || keyState.has("ShiftRight");
          state.speed = clamp(state.speed + (flapping ? 13 : diving ? 10 : -2.2) * dt, 10, spec.flight?.maxSpeed || 44);
          state.stamina = clamp(state.stamina + (flapping ? -22 : 12) * dt, 0, 100);
          const position = flightRoot.getPosition().clone();
          const horizontal = Math.cos(pitch);
          position.x += Math.sin(yaw) * horizontal * state.speed * dt;
          position.z += Math.cos(yaw) * horizontal * state.speed * dt;
          position.y += (Math.sin(pitch) * state.speed + (flapping ? spec.flight?.flapLift || 8 : -1.8)) * dt;
          position.y = clamp(position.y, 2.5, 68);
          const limit = spec.world.size * 0.48;
          position.x = clamp(position.x, -limit, limit);
          position.z = clamp(position.z, -limit, limit);
          flightRoot.setPosition(position);
          flightRoot.setEulerAngles(-pitch * 180 / Math.PI, yaw * 180 / Math.PI, roll * 180 / Math.PI);
          const wingAngle = flapping ? Math.sin(state.elapsed * 15) * 28 : 8;
          leftWing.setLocalEulerAngles(0, 0, wingAngle);
          rightWing.setLocalEulerAngles(0, 0, -wingAngle);
          landmarks.forEach((landmark) => {
            if (!landmark.enabled) return;
            if (position.distance(landmark.getPosition()) < 4) {
              landmark.enabled = false;
              state.progress += 1;
              state.score += 400;
              state.objectiveText = spec.runtimeContent.quests[Math.min(state.progress, spec.runtimeContent.quests.length - 1)]?.instruction || `Landmarks discovered: ${state.progress}/${landmarks.length}`;
              state.storyBeat = spec.runtimeContent.storyBeats[Math.min(state.progress, spec.runtimeContent.storyBeats.length - 1)] || state.storyBeat;
              if (state.progress >= landmarks.length) { state.status = "victory"; setDialogue("victory"); } else setDialogue("quest", Math.min(state.progress, spec.runtimeContent.quests.length - 1));
            }
          });
          state.altitude = position.y;
          if (state.elapsed > spec.objective.timeLimitSeconds) { state.status = "defeat"; setDialogue("defeat"); }
          const look = flightRoot.getPosition();
          camera.setPosition(look.x - Math.sin(yaw) * 13, look.y + 5.5, look.z - Math.cos(yaw) * 13);
          camera.lookAt(look.x, look.y + 1, look.z);
        };
      }

      restartRef.current = restart;
      if (spec.templateFamily !== "kart-racing") recoverCheckpointRef.current = restart;
      const statsTarget = spec.templateFamily === "third-person-action"
        ? spec.thirdPerson?.missionStages?.length || 4
        : spec.templateFamily === "driving-racing"
          ? spec.driving?.checkpointCount || 10
          : clamp(spec.objective.target, 4, 10);

      let statsAccumulator = 0;
      app.on("update", (dt: number) => {
        if (disposed) return;
        state.frameCount += 1;
        state.fpsClock += dt;
        if (state.fpsClock >= 0.5) {
          state.fps = Math.round(state.frameCount / state.fpsClock);
          state.frameCount = 0;
          state.fpsClock = 0;
        }
        update(Math.min(dt, 0.05));
        statsAccumulator += dt;
        if (statsAccumulator >= 0.16) {
          statsAccumulator = 0;
          callbacksRef.current.onStats?.({
            ...DEFAULT_STATS,
            health: Math.max(0, Math.round(state.health)),
            maxHealth: spec.player.health,
            score: Math.round(state.score),
            progress: state.progress,
            target: statsTarget,
            elapsed: state.elapsed,
            status: state.status,
            defeated: state.defeated,
            collected: state.collected,
            objectiveText: state.objectiveText,
            fps: state.fps,
            renderer: "PlayCanvas 2 compatibility",
            altitude: spec.templateFamily === "open-world-flight" ? Math.round(state.altitude) : undefined,
            speed: spec.templateFamily !== "third-person-action" ? Math.round(state.speed) : undefined,
            stamina: spec.templateFamily === "open-world-flight" ? Math.round(state.stamina) : undefined,
            wind: spec.templateFamily === "open-world-flight" ? state.wind : undefined,
            weather: spec.world.weather,
            speaker: state.speaker,
            dialogueText: state.dialogueText,
            storyBeat: state.storyBeat,
            raceState: spec.templateFamily === "kart-racing" ? state.raceState : undefined,
            currentLap: spec.templateFamily === "kart-racing" ? state.currentLap : undefined,
            lapCount: spec.templateFamily === "kart-racing" ? state.lapCount : undefined,
            currentCheckpoint: spec.templateFamily === "kart-racing" ? state.currentCheckpoint : undefined,
            checkpointCount: spec.templateFamily === "kart-racing" ? state.checkpointCount : undefined,
            currentLapTime: spec.templateFamily === "kart-racing" ? state.currentLapTime : undefined,
            totalRaceTime: spec.templateFamily === "kart-racing" ? state.totalRaceTime : undefined,
            bestLapTime: spec.templateFamily === "kart-racing" ? state.bestLapTime : undefined,
            completedLapTimes: spec.templateFamily === "kart-racing" ? state.completedLapTimes : undefined,
            speedKph: spec.templateFamily === "kart-racing" ? state.speedKph : undefined,
            boostPercent: spec.templateFamily === "kart-racing" ? state.boostPercent : undefined,
            finishPosition: spec.templateFamily === "kart-racing" ? state.finishPosition : undefined,
            wrongWay: spec.templateFamily === "kart-racing" ? state.wrongWay : undefined,
            countdownValue: spec.templateFamily === "kart-racing" ? state.countdownValue : undefined,
            countdownText: spec.templateFamily === "kart-racing" ? state.countdownText : undefined,
          });
        }
      });

      app.start();
      setRuntimeMessage("PlayCanvas runtime ready");
      callbacksRef.current.onReady?.();

      return () => {
        disposed = true;
        cleanup.forEach((fn) => fn());
        app.destroy();
        appRef.current = null;
        stateRef.current = null;
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : "PlayCanvas could not start.";
      console.warn("PlayCanvas runtime failed; using compatibility runtime:", error);
      failRuntime(message);
      return () => cleanup.forEach((fn) => fn());
    }
  }, [spec]);

  return (
    <div className="relative h-full w-full overflow-hidden bg-black">
      <canvas ref={canvasRef} tabIndex={0} className="h-full w-full outline-none" aria-label={`Playable PlayCanvas build for ${spec.title}`} />
      <div className="pointer-events-none absolute bottom-3 left-1/2 max-w-[90%] -translate-x-1/2 rounded-full border border-white/10 bg-black/65 px-4 py-2 text-center text-[10px] font-bold text-zinc-200 backdrop-blur">
        {spec.templateFamily === "third-person-action" ? "WASD move · Shift sprint · Space jump · E interact · F/Click attack · Right-drag camera" : spec.controls.movement}
      </div>
      <div className="pointer-events-none absolute bottom-3 left-3 hidden rounded-full border border-white/10 bg-black/55 px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.14em] text-cyan-200 backdrop-blur sm:block">
        {runtimeMessage}
      </div>
    </div>
  );
});
