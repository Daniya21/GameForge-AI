import type {
  GameBuildSpec,
  WorldLayout,
  WorldLayoutPath,
  WorldLayoutProp,
  WorldLayoutRegion,
} from "../../app/types/game";

const REGION_KINDS = new Set<WorldLayoutRegion["kind"]>([
  "urban",
  "interior",
  "nature",
  "mountain",
  "water",
  "industrial",
  "fantasy",
  "lunar",
]);

const PATH_STYLES = new Set<WorldLayoutPath["style"]>([
  "road",
  "trail",
  "corridor",
  "air-route",
]);

function finite(value: unknown, fallback = 0) {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function clamp(value: number, minimum: number, maximum: number) {
  return Math.max(minimum, Math.min(maximum, value));
}

function safeText(value: unknown, fallback: string, maximum = 160) {
  return (typeof value === "string" ? value.trim() : "").slice(0, maximum) || fallback;
}

function safeId(value: unknown, fallback: string) {
  const normalized = safeText(value, fallback, 80)
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return normalized || fallback;
}

function conceptKind(focus: string): WorldLayoutRegion["kind"] {
  const text = focus.toLowerCase();
  if (/moon|lunar|crater|space/.test(text)) return "lunar";
  if (/bank|vault|interior|facility|station/.test(text)) return "interior";
  if (/forest|jungle|garden|wild/.test(text)) return "nature";
  if (/mountain|ridge|cliff|canyon/.test(text)) return "mountain";
  if (/water|ocean|lake|river|harbor|island/.test(text)) return "water";
  if (/factory|industrial|mine|rig|warehouse/.test(text)) return "industrial";
  if (/fantasy|magic|kingdom|castle|temple/.test(text)) return "fantasy";
  return "urban";
}

function fallbackRegions(focus: string): WorldLayoutRegion[] {
  const kind = conceptKind(focus);
  const names = kind === "lunar"
    ? ["Landing Basin", "Habitat Ridge", "Mining Crater", "Solar Array Field", "Extraction Beacon"]
    : kind === "interior"
      ? ["Arrival Wing", "Security Sector", "Operations Core", "Restricted Vault", "Extraction Route"]
      : ["Starting District", "Mission Quarter", "Central Landmark", "Outer Route", "Finale Zone"];
  const positions: Array<[number, number]> = [[-4, 4], [21, -9], [7, -30], [-22, -20], [-24, 13]];
  return names.map((name, index) => ({
    id: `fallback-region-${index + 1}`,
    name,
    description: `${name} is a readable Stylized 3D gameplay region generated as a safe runtime fallback.`,
    kind,
    position: positions[index],
    radius: index === 2 ? 13 : 10,
    elevation: kind === "mountain" ? 8 + index : kind === "lunar" ? 2 + (index % 3) : 2,
    equipment: kind === "lunar"
      ? ["navigation beacon", "solar panels", "cargo crates"]
      : ["route lights", "mission equipment", "cover props"],
    interactables: [index === names.length - 1 ? "extraction control" : "mission terminal"],
    detailDensity: 12,
  }));
}

function normalizeRegion(
  value: Partial<WorldLayoutRegion> | undefined,
  fallback: WorldLayoutRegion,
  id: string,
): WorldLayoutRegion {
  const kind = value?.kind && REGION_KINDS.has(value.kind) ? value.kind : fallback.kind;
  return {
    ...fallback,
    ...value,
    id,
    name: safeText(value?.name, fallback.name, 120),
    description: safeText(value?.description, fallback.description, 420),
    kind,
    position: [
      clamp(finite(value?.position?.[0], fallback.position[0]), -70, 70),
      clamp(finite(value?.position?.[1], fallback.position[1]), -70, 70),
    ],
    radius: clamp(finite(value?.radius, fallback.radius), 5, 20),
    elevation: clamp(finite(value?.elevation, fallback.elevation), 0, 16),
    equipment: Array.isArray(value?.equipment)
      ? value.equipment.filter((item): item is string => typeof item === "string" && item.trim().length > 0).slice(0, 8)
      : fallback.equipment,
    interactables: Array.isArray(value?.interactables)
      ? value.interactables.filter((item): item is string => typeof item === "string" && item.trim().length > 0).slice(0, 6)
      : fallback.interactables,
    detailDensity: clamp(finite(value?.detailDensity, fallback.detailDensity || 12), 6, 18),
  };
}

function collisionSafeSpawn(regions: WorldLayoutRegion[], props: WorldLayoutProp[]) : [number, number] {
  const first = regions[0];
  const candidates: Array<[number, number]> = [0.58, 0.82, 1.08].flatMap((distance) => [
    [first.position[0] - first.radius * distance, first.position[1]] as [number, number],
    [first.position[0] + first.radius * distance, first.position[1]] as [number, number],
    [first.position[0], first.position[1] - first.radius * distance] as [number, number],
    [first.position[0], first.position[1] + first.radius * distance] as [number, number],
  ]);
  candidates.push(first.position);
  const blockers = props.filter((prop) => prop.collision !== false);
  return candidates.find((candidate) => blockers.every((prop) => {
    const dx = candidate[0] - prop.position[0];
    const dz = candidate[1] - prop.position[1];
    const clearance = Math.max(2.2, Math.max(prop.scale[0], prop.scale[2]) * 0.7);
    return Math.hypot(dx, dz) > clearance;
  })) || first.position;
}

export function repairWorldLayout(
  source: WorldLayout | undefined,
  focus = "Stylized 3D playable world",
  questLabels: string[] = [],
): WorldLayout {
  const defaults = fallbackRegions(focus);
  const sourceRegions = Array.isArray(source?.regions) ? source.regions.slice(0, 8) : [];
  const desiredCount = Math.max(5, sourceRegions.length);
  const usedIds = new Set<string>();
  const regions: WorldLayoutRegion[] = [];

  for (let index = 0; index < desiredCount; index += 1) {
    const value = sourceRegions[index];
    const fallback = defaults[index % defaults.length];
    let id = safeId(value?.id, `region-${index + 1}`);
    while (usedIds.has(id)) id = `${id}-${index + 1}`;
    usedIds.add(id);
    regions.push(normalizeRegion(value, fallback, id));
  }

  const regionById = new Map(regions.map((region) => [region.id, region]));
  const sourceProps = Array.isArray(source?.props) ? source.props.slice(0, 120) : [];
  const props: WorldLayoutProp[] = sourceProps.map((prop, index) => {
    const region = regionById.get(prop.regionId) || regions[index % regions.length];
    return {
      ...prop,
      id: safeId(prop.id, `prop-${index + 1}`),
      regionId: region.id,
      name: safeText(prop.name, `World detail ${index + 1}`, 140),
      position: [
        clamp(finite(prop.position?.[0], region.position[0]), -75, 75),
        clamp(finite(prop.position?.[1], region.position[1]), -75, 75),
      ],
      elevation: clamp(finite(prop.elevation, region.elevation), 0, 18),
      scale: [
        clamp(finite(prop.scale?.[0], 1.2), 0.25, 14),
        clamp(finite(prop.scale?.[1], 1.6), 0.25, 18),
        clamp(finite(prop.scale?.[2], 1.2), 0.25, 14),
      ],
      rotation: clamp(finite(prop.rotation, 0), -360, 360),
      interactive: prop.interactive === true,
      collision: prop.collision !== false,
      purpose: safeText(prop.purpose, prop.interactive ? "Quest interaction" : "Environmental storytelling", 220),
    };
  });

  const validSourcePaths = (Array.isArray(source?.paths) ? source.paths : []).filter((path) => (
    regionById.has(path.from)
      && regionById.has(path.to)
      && path.from !== path.to
  ));
  const pathStyle: WorldLayoutPath["style"] = /flight|sky|air/i.test(focus)
    ? "air-route"
    : /bank|vault|interior|facility/i.test(focus)
      ? "corridor"
      : "road";
  const paths: WorldLayoutPath[] = validSourcePaths.length >= regions.length - 1
    ? validSourcePaths.slice(0, 14).map((path, index) => ({
        ...path,
        id: safeId(path.id, `path-${index + 1}`),
        style: PATH_STYLES.has(path.style) ? path.style : pathStyle,
        width: clamp(finite(path.width, pathStyle === "corridor" ? 4.2 : 6), 3, 16),
      }))
    : regions.map((region, index) => ({
        id: `path-${index + 1}`,
        from: region.id,
        to: regions[(index + 1) % regions.length].id,
        style: pathStyle,
        width: pathStyle === "corridor" ? 4.2 : 6.5,
      }));

  const rawAnchors = Array.isArray(source?.objectiveAnchors) ? source.objectiveAnchors : [];
  const objectiveCount = Math.max(3, Math.min(8, questLabels.length || rawAnchors.length || regions.length));
  const objectiveAnchors = Array.from({ length: objectiveCount }, (_, index) => {
    const raw = rawAnchors[index];
    const region = raw && regionById.has(raw.regionId) ? regionById.get(raw.regionId)! : regions[index % regions.length];
    return {
      id: safeId(raw?.id, `objective-${index + 1}`),
      label: safeText(raw?.label, questLabels[index] || region.name, 140),
      position: [
        clamp(finite(raw?.position?.[0], region.position[0]), -75, 75),
        clamp(finite(raw?.position?.[1], region.position[1]), -75, 75),
      ] as [number, number],
      regionId: region.id,
    };
  });

  const requestedSpawn: [number, number] | undefined = source?.playerSpawn && source.playerSpawn.length >= 2
    ? [finite(source.playerSpawn[0]), finite(source.playerSpawn[1])]
    : undefined;
  const playerSpawn = requestedSpawn && props.every((prop) => {
    if (prop.collision === false) return true;
    return Math.hypot(requestedSpawn[0] - prop.position[0], requestedSpawn[1] - prop.position[1]) > 2.2;
  }) ? requestedSpawn : collisionSafeSpawn(regions, props);

  return {
    seed: Math.abs(Math.round(finite(source?.seed, 872341))) || 872341,
    scale: safeText(source?.scale, "medium playable vertical slice", 100),
    focus: safeText(source?.focus, focus, 220),
    regions,
    paths,
    props,
    playerSpawn,
    objectiveAnchors,
    detailLevel: "production",
    sourceImage: source?.sourceImage,
    landmarkPrompt: safeText(source?.landmarkPrompt, `Stylized 3D signature environment landmark for ${focus}`, 1000),
  };
}

export function ensureRuntimeWorld(spec: GameBuildSpec): GameBuildSpec {
  const questLabels = spec.runtimeContent?.quests?.map((quest) => quest.title) || [];
  const layout = repairWorldLayout(spec.world.layout, `${spec.title} ${spec.world.biome} ${spec.premise}`, questLabels);
  return {
    ...spec,
    world: { ...spec.world, layout },
  };
}

export type AdaptedCircuit = {
  trackName: string;
  controlPoints: Array<[number, number, number]>;
  roadWidth: number;
  checkpointCount: number;
  spawnPosition: [number, number, number];
  spawnRotation: number;
  finishLinePosition: [number, number, number];
  finishLineRotation: number;
  shortcutData: { entry: [number, number, number]; exit: [number, number, number]; width: number };
  environmentTheme: string;
};

function buildSeed(value: string) {
  let seed = 2166136261;
  for (const character of value) {
    seed ^= character.charCodeAt(0);
    seed = Math.imul(seed, 16777619);
  }
  return Math.abs(seed >>> 0);
}

export function buildWorldAdaptedCircuit(
  layout: WorldLayout | undefined,
  buildId: string,
  checkpointHint = 10,
): AdaptedCircuit {
  const safeLayout = repairWorldLayout(layout, layout?.focus || "Stylized 3D racing world");
  const seed = buildSeed(`${buildId}|${safeLayout.seed}|${safeLayout.focus}`);
  const centerX = safeLayout.regions.reduce((sum, region) => sum + region.position[0], 0) / safeLayout.regions.length;
  const centerZ = safeLayout.regions.reduce((sum, region) => sum + region.position[1], 0) / safeLayout.regions.length;
  const source = safeLayout.regions.map((region, index) => ({
    region,
    index,
    dx: region.position[0] - centerX,
    dz: region.position[1] - centerZ,
  }));
  const maximumRadius = Math.max(1, ...source.map((item) => Math.hypot(item.dx, item.dz)));
  const points = source.map((item) => {
    const fallbackAngle = (item.index / source.length) * Math.PI * 2 + (seed % 360) * Math.PI / 180;
    const length = Math.hypot(item.dx, item.dz);
    const angle = length > 2 ? Math.atan2(item.dz, item.dx) : fallbackAngle;
    const normalizedRadius = length > 2 ? length / maximumRadius : 0.6;
    const radius = 25 + normalizedRadius * 19 + (item.index % 2) * 2.5;
    return {
      angle,
      point: [
        Math.cos(angle) * radius,
        clamp(item.region.elevation * 0.14, 0.12, 3.2),
        Math.sin(angle) * radius - 24,
      ] as [number, number, number],
    };
  });

  while (points.length < 8) {
    const index = points.length;
    const angle = (index / 8) * Math.PI * 2 + (seed % 19) * 0.025;
    const radius = 31 + (index % 3) * 5;
    points.push({ angle, point: [Math.cos(angle) * radius, 0.18 + (index % 2) * 0.35, Math.sin(angle) * radius - 24] });
  }
  points.sort((a, b) => a.angle - b.angle);
  const controlPoints = points.slice(0, 10).map((item) => item.point);
  const first = controlPoints[0];
  const second = controlPoints[1];
  const dx = second[0] - first[0];
  const dz = second[2] - first[2];
  const spawnRotation = Math.atan2(dx, dz) * 180 / Math.PI;
  const averagePathWidth = safeLayout.paths.length
    ? safeLayout.paths.reduce((sum, path) => sum + finite(path.width, 7), 0) / safeLayout.paths.length
    : 7;
  const roadWidth = clamp(averagePathWidth * 1.55, 11.5, 15.5);
  const shortcutEntry = controlPoints[Math.min(2, controlPoints.length - 1)];
  const shortcutExit = controlPoints[Math.min(5, controlPoints.length - 1)];

  return {
    trackName: `${safeText(safeLayout.focus, "GameForge", 46).replace(/\b(world|map|level)\b/gi, "").trim() || "GameForge"} Circuit`,
    controlPoints,
    roadWidth,
    checkpointCount: Math.round(clamp(checkpointHint, 8, 16)),
    spawnPosition: [first[0], Math.max(1.35, first[1] + 1.15), first[2]],
    spawnRotation,
    finishLinePosition: first,
    finishLineRotation: spawnRotation,
    shortcutData: { entry: shortcutEntry, exit: shortcutExit, width: Math.max(8.5, roadWidth * 0.68) },
    environmentTheme: safeLayout.focus,
  };
}
