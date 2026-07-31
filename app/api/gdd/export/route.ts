type GddDocument = {
  title: string;
  subtitle: string;
  oneLinePitch: string;
  executiveSummary: string;
  genreAndFormat: string;
  targetAudience: string;
  platformsAndSession: string;
  playerFantasy: string;
  designPillars: string[];
  uniqueSellingPoints: string[];
  coreLoop: string[];
  momentToMomentGameplay: string;
  coreMechanics: string[];
  controlsAndFeedback: string;
  progressionAndRewards: string;
  narrativeAndWorld: string;
  charactersAndFactions: string;
  levelsAndContent: string;
  visualDirection: string;
  audioDirection: string;
  uiUxAndAccessibility: string;
  technicalPlan: string;
  mvpScope: string[];
  productionMilestones: string[];
  risksAndMitigations: string[];
  successMetrics: string[];
  openQuestions: string[];
};

type ExportRequest = {
  document?: unknown;
  metadata?: {
    documentStyle?: unknown;
    platform?: unknown;
    projectStage?: unknown;
    teamSize?: unknown;
  };
};

type PageCommands = string[];

const PAGE_W = 960;
const PAGE_H = 540;
const COLOR = {
  background: [0.022, 0.031, 0.075] as const,
  panel: [0.055, 0.067, 0.12] as const,
  panelLight: [0.075, 0.09, 0.15] as const,
  text: [0.94, 0.95, 0.98] as const,
  muted: [0.63, 0.67, 0.75] as const,
  cyan: [0.13, 0.82, 0.92] as const,
  violet: [0.59, 0.29, 0.95] as const,
  pink: [0.89, 0.23, 0.78] as const,
  green: [0.31, 0.86, 0.55] as const,
};

function isGddDocument(value: unknown): value is GddDocument {
  if (!value || typeof value !== "object") return false;
  const record = value as Record<string, unknown>;
  return (
    typeof record.title === "string" &&
    typeof record.subtitle === "string" &&
    typeof record.oneLinePitch === "string" &&
    typeof record.executiveSummary === "string" &&
    Array.isArray(record.designPillars) &&
    Array.isArray(record.coreLoop) &&
    Array.isArray(record.mvpScope)
  );
}

function cleanText(value: unknown, max = 3000) {
  return String(value ?? "")
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/[\u2013\u2014]/g, "-")
    .replace(/\u2026/g, "...")
    .replace(/\u2022/g, "-")
    .replace(/[^\x20-\x7E\n]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max);
}

function pdfEscape(value: string) {
  return value.replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
}

function colorCommand(color: readonly [number, number, number], stroke = false) {
  return `${color[0]} ${color[1]} ${color[2]} ${stroke ? "RG" : "rg"}`;
}

function rect(page: PageCommands, x: number, top: number, width: number, height: number, color: readonly [number, number, number]) {
  const y = PAGE_H - top - height;
  page.push(`${colorCommand(color)} ${x} ${y} ${width} ${height} re f`);
}

function line(page: PageCommands, x1: number, top1: number, x2: number, top2: number, width: number, color: readonly [number, number, number]) {
  page.push(
    `${colorCommand(color, true)} ${width} w ${x1} ${PAGE_H - top1} m ${x2} ${PAGE_H - top2} l S`,
  );
}

function estimateWidth(text: string, fontSize: number, bold = false) {
  let units = 0;
  for (const char of text) {
    if ("ilI.,'`!|".includes(char)) units += 0.25;
    else if ("MW@#%&".includes(char)) units += 0.9;
    else if (char === " ") units += 0.28;
    else units += bold ? 0.58 : 0.53;
  }
  return units * fontSize;
}

function wrapText(text: string, width: number, fontSize: number, bold = false) {
  const words = cleanText(text).split(" ").filter(Boolean);
  const lines: string[] = [];
  let current = "";

  for (const word of words) {
    const next = current ? `${current} ${word}` : word;
    if (estimateWidth(next, fontSize, bold) <= width) {
      current = next;
    } else {
      if (current) lines.push(current);
      if (estimateWidth(word, fontSize, bold) > width) {
        let chunk = "";
        for (const char of word) {
          if (estimateWidth(chunk + char, fontSize, bold) > width && chunk) {
            lines.push(chunk);
            chunk = char;
          } else {
            chunk += char;
          }
        }
        current = chunk;
      } else {
        current = word;
      }
    }
  }
  if (current) lines.push(current);
  return lines;
}

function text(
  page: PageCommands,
  value: string,
  x: number,
  top: number,
  size: number,
  color: readonly [number, number, number] = COLOR.text,
  bold = false,
) {
  const baseline = PAGE_H - top - size;
  page.push(
    `${colorCommand(color)} BT /${bold ? "F2" : "F1"} ${size} Tf 1 0 0 1 ${x} ${baseline} Tm (${pdfEscape(cleanText(value))}) Tj ET`,
  );
}

function paragraph(
  page: PageCommands,
  value: string,
  x: number,
  top: number,
  width: number,
  size = 15,
  color: readonly [number, number, number] = COLOR.muted,
  maxLines = 12,
  lineHeight = 1.38,
) {
  const lines = wrapText(value, width, size).slice(0, maxLines);
  lines.forEach((item, index) => text(page, item, x, top + index * size * lineHeight, size, color));
  return top + lines.length * size * lineHeight;
}

function bulletList(
  page: PageCommands,
  items: string[],
  x: number,
  top: number,
  width: number,
  options?: { size?: number; maxItems?: number; color?: readonly [number, number, number]; numbered?: boolean },
) {
  const size = options?.size || 14;
  const maxItems = options?.maxItems || 6;
  const color = options?.color || COLOR.muted;
  let cursor = top;

  items.slice(0, maxItems).forEach((raw, index) => {
    const item = cleanText(raw, 800);
    const marker = options?.numbered ? `${index + 1}` : "-";
    rect(page, x, cursor + 3, 22, 22, index % 2 === 0 ? COLOR.violet : COLOR.cyan);
    text(page, marker, x + (marker.length > 1 ? 5 : 8), cursor + 5, 10, COLOR.text, true);
    const lines = wrapText(item, width - 34, size).slice(0, 3);
    lines.forEach((itemLine, lineIndex) => {
      text(page, itemLine, x + 34, cursor + lineIndex * size * 1.3, size, color, lineIndex === 0);
    });
    cursor += Math.max(38, lines.length * size * 1.3 + 10);
  });

  return cursor;
}

function basePage(titleValue: string, kicker: string, pageNumber: number, total: number) {
  const page: PageCommands = [];
  rect(page, 0, 0, PAGE_W, PAGE_H, COLOR.background);
  rect(page, 0, 0, 8, PAGE_H, pageNumber % 2 === 0 ? COLOR.cyan : COLOR.violet);
  rect(page, 48, 36, 130, 4, COLOR.cyan);
  text(page, kicker.toUpperCase(), 48, 52, 11, COLOR.cyan, true);
  text(page, titleValue, 48, 74, 30, COLOR.text, true);
  text(page, `GAMEFORGE AI  /  GDD PRESENTATION`, 690, 38, 9, COLOR.muted, true);
  text(page, `${pageNumber.toString().padStart(2, "0")} / ${total.toString().padStart(2, "0")}`, 844, 504, 10, COLOR.muted, true);
  return page;
}

function addTwoColumnPage(
  pages: PageCommands[],
  titleValue: string,
  kicker: string,
  leftTitle: string,
  leftContent: string | string[],
  rightTitle: string,
  rightContent: string | string[],
  pageNumber: number,
  total: number,
) {
  const page = basePage(titleValue, kicker, pageNumber, total);
  rect(page, 48, 132, 412, 330, COLOR.panel);
  rect(page, 482, 132, 430, 330, COLOR.panel);
  text(page, leftTitle.toUpperCase(), 72, 156, 12, COLOR.pink, true);
  text(page, rightTitle.toUpperCase(), 506, 156, 12, COLOR.cyan, true);

  if (Array.isArray(leftContent)) bulletList(page, leftContent, 72, 190, 360, { maxItems: 6 });
  else paragraph(page, leftContent, 72, 190, 360, 15, COLOR.muted, 13);

  if (Array.isArray(rightContent)) bulletList(page, rightContent, 506, 190, 378, { maxItems: 6 });
  else paragraph(page, rightContent, 506, 190, 378, 15, COLOR.muted, 13);

  pages.push(page);
}

function buildPages(document: GddDocument, metadata: Record<string, string>) {
  const total = 16;
  const pages: PageCommands[] = [];

  // 1: Cover
  {
    const page: PageCommands = [];
    rect(page, 0, 0, PAGE_W, PAGE_H, COLOR.background);
    rect(page, 0, 0, 16, PAGE_H, COLOR.violet);
    rect(page, 52, 48, 150, 5, COLOR.cyan);
    rect(page, 710, 0, 250, PAGE_H, COLOR.panel);
    rect(page, 744, 82, 150, 150, COLOR.panelLight);
    rect(page, 778, 116, 150, 150, COLOR.violet);
    rect(page, 812, 150, 100, 100, COLOR.cyan);
    text(page, "GAME DESIGN DOCUMENT", 52, 78, 12, COLOR.cyan, true);
    const titleLines = wrapText(document.title, 610, 48, true).slice(0, 3);
    titleLines.forEach((item, index) => text(page, item, 52, 118 + index * 58, 48, COLOR.text, true));
    const subtitleTop = 118 + titleLines.length * 58 + 8;
    paragraph(page, document.subtitle, 52, subtitleTop, 580, 19, COLOR.pink, 3, 1.25);
    paragraph(page, document.oneLinePitch, 52, subtitleTop + 78, 580, 16, COLOR.muted, 5, 1.4);
    const meta = [metadata.documentStyle, metadata.platform, metadata.projectStage, metadata.teamSize].filter(Boolean);
    meta.slice(0, 4).forEach((item, index) => {
      rect(page, 52 + index * 146, 444, 132, 34, COLOR.panelLight);
      text(page, item, 64 + index * 146, 454, 10, COLOR.text, true);
    });
    text(page, "Generated with GameForge AI", 52, 505, 10, COLOR.muted, true);
    text(page, "01 / 16", 844, 505, 10, COLOR.muted, true);
    pages.push(page);
  }

  // 2
  addTwoColumnPage(
    pages,
    "Executive Overview",
    "Vision",
    "Game Summary",
    document.executiveSummary,
    "Product Definition",
    [document.genreAndFormat, document.targetAudience, document.platformsAndSession],
    2,
    total,
  );

  // 3
  addTwoColumnPage(
    pages,
    "Player Experience",
    "Experience Design",
    "Player Fantasy",
    document.playerFantasy,
    "Design Pillars",
    document.designPillars,
    3,
    total,
  );

  // 4 Core loop
  {
    const page = basePage("Core Gameplay Loop", "Playable Structure", 4, total);
    paragraph(page, document.momentToMomentGameplay, 48, 130, 860, 15, COLOR.muted, 5);
    const steps = document.coreLoop.slice(0, 6);
    const columns = 3;
    const cardW = 268;
    const cardH = 112;
    steps.forEach((step, index) => {
      const row = Math.floor(index / columns);
      const col = index % columns;
      const x = 48 + col * 286;
      const top = 238 + row * 132;
      rect(page, x, top, cardW, cardH, COLOR.panel);
      rect(page, x, top, 36, 36, index % 2 === 0 ? COLOR.violet : COLOR.cyan);
      text(page, `${index + 1}`, x + 13, top + 10, 12, COLOR.text, true);
      paragraph(page, step, x + 50, top + 14, cardW - 64, 13, COLOR.text, 5, 1.27);
    });
    pages.push(page);
  }

  // 5
  addTwoColumnPage(
    pages,
    "Mechanics & Feedback",
    "Systems",
    "Core Mechanics",
    document.coreMechanics,
    "Controls & Feedback",
    document.controlsAndFeedback,
    5,
    total,
  );

  // 6
  addTwoColumnPage(
    pages,
    "Progression & Retention",
    "Player Growth",
    "Progression Model",
    document.progressionAndRewards,
    "Unique Selling Points",
    document.uniqueSellingPoints,
    6,
    total,
  );

  // 7
  addTwoColumnPage(
    pages,
    "Narrative & World",
    "Context",
    "World & Story",
    document.narrativeAndWorld,
    "Characters & Factions",
    document.charactersAndFactions,
    7,
    total,
  );

  // 8
  addTwoColumnPage(
    pages,
    "Levels & Content",
    "Content Architecture",
    "Level Structure",
    document.levelsAndContent,
    "Session Design",
    document.platformsAndSession,
    8,
    total,
  );

  // 9
  addTwoColumnPage(
    pages,
    "Visual Direction",
    "Art Bible",
    "Look & Feel",
    document.visualDirection,
    "Presentation Goal",
    `${document.subtitle}. The visual language should reinforce the player fantasy and remain readable during gameplay, marketing, and stakeholder presentations.`,
    9,
    total,
  );

  // 10
  addTwoColumnPage(
    pages,
    "Audio, UI & Accessibility",
    "Experience Layer",
    "Audio Direction",
    document.audioDirection,
    "UI / UX / Accessibility",
    document.uiUxAndAccessibility,
    10,
    total,
  );

  // 11
  addTwoColumnPage(
    pages,
    "Technical Plan",
    "Implementation",
    "Architecture & Dependencies",
    document.technicalPlan,
    "Team Reality Check",
    `Team size: ${metadata.teamSize || "Not specified"}. Project stage: ${metadata.projectStage || "Not specified"}. Production decisions should protect the core loop before expanding content volume.`,
    11,
    total,
  );

  // 12
  addTwoColumnPage(
    pages,
    "Minimum Viable Product",
    "Scope Control",
    "MVP Must Include",
    document.mvpScope,
    "MVP Success Condition",
    `The MVP is successful when a new player can understand the fantasy, complete the full core loop, experience one meaningful progression decision, and clearly explain what makes ${document.title} distinctive.`,
    12,
    total,
  );

  // 13
  {
    const page = basePage("Production Roadmap", "Milestones", 13, total);
    const items = document.productionMilestones.slice(0, 6);
    let top = 142;
    items.forEach((item, index) => {
      const x = 70 + (index % 2) * 430;
      if (index % 2 === 0 && index > 0) top += 110;
      rect(page, x, top, 390, 88, COLOR.panel);
      rect(page, x, top, 10, 88, index % 2 === 0 ? COLOR.violet : COLOR.cyan);
      text(page, `MILESTONE ${index + 1}`, x + 28, top + 16, 10, COLOR.cyan, true);
      paragraph(page, item, x + 28, top + 36, 336, 13, COLOR.text, 4, 1.25);
    });
    pages.push(page);
  }

  // 14
  addTwoColumnPage(
    pages,
    "Risks & Mitigation",
    "Production Health",
    "Primary Risks",
    document.risksAndMitigations,
    "Decision Principle",
    "When a feature threatens schedule, readability, or the core loop, reduce content breadth before reducing the quality of the central player experience.",
    14,
    total,
  );

  // 15
  addTwoColumnPage(
    pages,
    "Validation Plan",
    "Evidence",
    "Success Metrics",
    document.successMetrics,
    "Open Design Questions",
    document.openQuestions,
    15,
    total,
  );

  // 16 Closing
  {
    const page: PageCommands = [];
    rect(page, 0, 0, PAGE_W, PAGE_H, COLOR.background);
    rect(page, 0, 0, PAGE_W, 12, COLOR.cyan);
    rect(page, 668, 0, 292, PAGE_H, COLOR.panel);
    text(page, "NEXT STEP", 56, 88, 12, COLOR.cyan, true);
    text(page, "Build the smallest", 56, 130, 42, COLOR.text, true);
    text(page, "version that proves", 56, 182, 42, COLOR.text, true);
    text(page, "the player fantasy.", 56, 234, 42, COLOR.text, true);
    paragraph(
      page,
      `Use this GDD as a living decision document. Prototype ${document.coreLoop[0] || "the first step of the core loop"}, test it with real players, and update the design based on evidence rather than assumptions.`,
      56,
      322,
      548,
      17,
      COLOR.muted,
      7,
      1.4,
    );
    text(page, document.title, 712, 130, 24, COLOR.text, true);
    paragraph(page, document.oneLinePitch, 712, 178, 196, 14, COLOR.muted, 10, 1.35);
    rect(page, 712, 392, 180, 44, COLOR.violet);
    text(page, "GDD COMPLETE", 742, 406, 12, COLOR.text, true);
    text(page, "16 / 16", 844, 505, 10, COLOR.muted, true);
    pages.push(page);
  }

  return pages;
}

function buildPdf(pages: PageCommands[]) {
  const objects: string[] = [];
  const pageIds: number[] = [];

  objects[1] = "<< /Type /Catalog /Pages 2 0 R >>";
  objects[3] = "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>";
  objects[4] = "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>";

  pages.forEach((commands, index) => {
    const contentId = 5 + index * 2;
    const pageId = contentId + 1;
    pageIds.push(pageId);
    const stream = commands.join("\n");
    objects[contentId] = `<< /Length ${Buffer.byteLength(stream, "latin1")} >>\nstream\n${stream}\nendstream`;
    objects[pageId] = `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PAGE_W} ${PAGE_H}] /Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents ${contentId} 0 R >>`;
  });

  objects[2] = `<< /Type /Pages /Count ${pageIds.length} /Kids [${pageIds.map((id) => `${id} 0 R`).join(" ")}] >>`;

  const maxId = objects.length - 1;
  let pdf = "%PDF-1.4\n%GAMEFORGE\n";
  const offsets = new Array(maxId + 1).fill(0);

  for (let id = 1; id <= maxId; id += 1) {
    offsets[id] = Buffer.byteLength(pdf, "latin1");
    pdf += `${id} 0 obj\n${objects[id]}\nendobj\n`;
  }

  const xrefOffset = Buffer.byteLength(pdf, "latin1");
  pdf += `xref\n0 ${maxId + 1}\n`;
  pdf += "0000000000 65535 f \n";
  for (let id = 1; id <= maxId; id += 1) {
    pdf += `${String(offsets[id]).padStart(10, "0")} 00000 n \n`;
  }
  pdf += `trailer\n<< /Size ${maxId + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;

  return Buffer.from(pdf, "latin1");
}

export const runtime = "nodejs";

export async function POST(request: Request) {
  let body: ExportRequest;
  try {
    body = (await request.json()) as ExportRequest;
  } catch {
    return Response.json({ error: "The export request must be valid JSON." }, { status: 400 });
  }

  if (!isGddDocument(body.document)) {
    return Response.json({ error: "The GDD data is incomplete and cannot be exported." }, { status: 400 });
  }

  const metadata = {
    documentStyle: cleanText(body.metadata?.documentStyle, 80),
    platform: cleanText(body.metadata?.platform, 80),
    projectStage: cleanText(body.metadata?.projectStage, 80),
    teamSize: cleanText(body.metadata?.teamSize, 80),
  };

  const pages = buildPages(body.document, metadata);
  const pdf = buildPdf(pages);
  const fileName = `${cleanText(body.document.title, 80).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "game-design-document"}-gdd.pdf`;

  return new Response(pdf, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${fileName}"`,
      "Cache-Control": "no-store",
    },
  });
}
