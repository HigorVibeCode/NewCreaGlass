// The CommonJS build Metro resolves exports the class itself, so it must be the default import
// eslint-disable-next-line import/no-named-as-default
import DxfParser from 'dxf-parser';

// Lightweight DXF preview: flattens the drawing (incl. blocks) into polylines
// and returns an SVG string. Meant for "what does this look like", not CAD accuracy.

type Pt = { x: number; y: number };
// 2D affine transform [a, b, c, d, e, f]: x' = a*x + c*y + e, y' = b*x + d*y + f
type Mat = [number, number, number, number, number, number];

const IDENTITY: Mat = [1, 0, 0, 1, 0, 0];
const MAX_BLOCK_DEPTH = 8;
const ARC_SEGMENTS = 48;

const multiply = (m: Mat, n: Mat): Mat => [
  m[0] * n[0] + m[2] * n[1],
  m[1] * n[0] + m[3] * n[1],
  m[0] * n[2] + m[2] * n[3],
  m[1] * n[2] + m[3] * n[3],
  m[0] * n[4] + m[2] * n[5] + m[4],
  m[1] * n[4] + m[3] * n[5] + m[5],
];

const apply = (m: Mat, p: Pt): Pt => ({ x: m[0] * p.x + m[2] * p.y + m[4], y: m[1] * p.x + m[3] * p.y + m[5] });

const arcPoints = (cx: number, cy: number, r: number, start: number, end: number): Pt[] => {
  let sweep = end - start;
  if (sweep <= 0) sweep += Math.PI * 2;
  const steps = Math.max(8, Math.ceil((ARC_SEGMENTS * sweep) / (Math.PI * 2)));
  const pts: Pt[] = [];
  for (let i = 0; i <= steps; i++) {
    const a = start + (sweep * i) / steps;
    pts.push({ x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) });
  }
  return pts;
};

// Polyline segment with bulge (arc between two vertices)
const bulgePoints = (p1: Pt, p2: Pt, bulge: number): Pt[] => {
  const angle = 4 * Math.atan(bulge);
  const chord = Math.hypot(p2.x - p1.x, p2.y - p1.y);
  if (chord === 0) return [p2];
  const radius = chord / (2 * Math.sin(angle / 2));
  const mid = { x: (p1.x + p2.x) / 2, y: (p1.y + p2.y) / 2 };
  const sagitta = radius * Math.cos(angle / 2);
  const dir = { x: (p2.x - p1.x) / chord, y: (p2.y - p1.y) / chord };
  const center = { x: mid.x - dir.y * sagitta, y: mid.y + dir.x * sagitta };
  const a1 = Math.atan2(p1.y - center.y, p1.x - center.x);
  const steps = Math.max(4, Math.ceil((Math.abs(angle) / (Math.PI * 2)) * ARC_SEGMENTS));
  const pts: Pt[] = [];
  for (let i = 1; i <= steps; i++) {
    const a = a1 + (angle * i) / steps;
    pts.push({ x: center.x + Math.abs(radius) * Math.cos(a), y: center.y + Math.abs(radius) * Math.sin(a) });
  }
  return pts;
};

const vertexPolyline = (vertices: any[], closed: boolean): Pt[] => {
  if (!vertices?.length) return [];
  const pts: Pt[] = [{ x: vertices[0].x, y: vertices[0].y }];
  const count = closed ? vertices.length : vertices.length - 1;
  for (let i = 0; i < count; i++) {
    const v1 = vertices[i];
    const v2 = vertices[(i + 1) % vertices.length];
    if (v1.bulge) pts.push(...bulgePoints(v1, v2, v1.bulge));
    else pts.push({ x: v2.x, y: v2.y });
  }
  return pts;
};

export interface DxfPreview {
  svg: string;
  entityCount: number;
}

export function dxfToSvg(source: string, strokeColor = '#111827'): DxfPreview | null {
  const dxf = new DxfParser().parse(source);
  if (!dxf) return null;

  const paths: Pt[][] = [];

  const addEntities = (entities: any[], m: Mat, depth: number) => {
    for (const e of entities || []) {
      try {
        switch (e.type) {
          case 'LINE':
            if (e.vertices?.length >= 2) paths.push(e.vertices.map((v: Pt) => apply(m, v)));
            break;
          case 'LWPOLYLINE':
          case 'POLYLINE': {
            const pts = vertexPolyline(e.vertices, !!e.shape);
            if (pts.length >= 2) paths.push(pts.map((p) => apply(m, p)));
            break;
          }
          case 'CIRCLE':
            paths.push(arcPoints(e.center.x, e.center.y, e.radius, 0, Math.PI * 2).map((p) => apply(m, p)));
            break;
          case 'ARC':
            paths.push(arcPoints(e.center.x, e.center.y, e.radius, e.startAngle, e.endAngle).map((p) => apply(m, p)));
            break;
          case 'ELLIPSE': {
            const major = e.majorAxisEndPoint;
            const rx = Math.hypot(major.x, major.y);
            const ry = rx * (e.axisRatio || 1);
            const rot = Math.atan2(major.y, major.x);
            const start = e.startAngle ?? 0;
            let end = e.endAngle ?? Math.PI * 2;
            if (end <= start) end += Math.PI * 2;
            const pts: Pt[] = [];
            for (let i = 0; i <= ARC_SEGMENTS; i++) {
              const t = start + ((end - start) * i) / ARC_SEGMENTS;
              const x = rx * Math.cos(t);
              const y = ry * Math.sin(t);
              pts.push({
                x: e.center.x + x * Math.cos(rot) - y * Math.sin(rot),
                y: e.center.y + x * Math.sin(rot) + y * Math.cos(rot),
              });
            }
            paths.push(pts.map((p) => apply(m, p)));
            break;
          }
          case 'SPLINE': {
            // Approximation: fit points if present, else the control polygon
            const pts: Pt[] = e.fitPoints?.length ? e.fitPoints : e.controlPoints || [];
            if (pts.length >= 2) paths.push(pts.map((p) => apply(m, p)));
            break;
          }
          case 'SOLID':
          case '3DFACE': {
            const pts: Pt[] = e.points || e.vertices || [];
            if (pts.length >= 3) paths.push([...pts, pts[0]].map((p) => apply(m, p)));
            break;
          }
          case 'INSERT':
          case 'DIMENSION': {
            const blockName = e.type === 'INSERT' ? e.name : e.block;
            const block = blockName ? dxf.blocks?.[blockName] : undefined;
            if (!block || depth >= MAX_BLOCK_DEPTH) break;
            if (e.type === 'DIMENSION') {
              // Dimension blocks are already in drawing coordinates
              addEntities(block.entities, m, depth + 1);
              break;
            }
            const sx = e.xScale ?? 1;
            const sy = e.yScale ?? 1;
            const rot = ((e.rotation ?? 0) * Math.PI) / 180;
            const base = block.position || { x: 0, y: 0 };
            const pos = e.position || { x: 0, y: 0 };
            const cols = Math.max(1, e.columnCount || 1);
            const rows = Math.max(1, e.rowCount || 1);
            for (let r = 0; r < rows; r++) {
              for (let c = 0; c < cols; c++) {
                const ox = c * (e.columnSpacing || 0);
                const oy = r * (e.rowSpacing || 0);
                // translate(pos) * rotate * scale * translate(-base) (+ array offset)
                const local: Mat = multiply(
                  [Math.cos(rot), Math.sin(rot), -Math.sin(rot), Math.cos(rot), pos.x, pos.y],
                  multiply([sx, 0, 0, sy, 0, 0], [1, 0, 0, 1, -base.x + ox, -base.y + oy])
                );
                addEntities(block.entities, multiply(m, local), depth + 1);
              }
            }
            break;
          }
          default:
            break;
        }
      } catch {
        // Skip malformed entities instead of failing the whole preview
      }
    }
  };

  addEntities(dxf.entities, IDENTITY, 0);
  const valid = paths.filter((path) => path.every((p) => Number.isFinite(p.x) && Number.isFinite(p.y)));
  if (valid.length === 0) return null;

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const path of valid) {
    for (const p of path) {
      if (p.x < minX) minX = p.x;
      if (p.y < minY) minY = p.y;
      if (p.x > maxX) maxX = p.x;
      if (p.y > maxY) maxY = p.y;
    }
  }
  const width = Math.max(maxX - minX, 1e-6);
  const height = Math.max(maxY - minY, 1e-6);
  const pad = Math.max(width, height) * 0.03;
  const stroke = Math.max(width, height) / 500;
  const fmt = (n: number) => +n.toFixed(3);

  // DXF Y grows upwards; SVG Y grows downwards
  const d = valid
    .map((path) => path.map((p, i) => `${i ? 'L' : 'M'}${fmt(p.x - minX)} ${fmt(maxY - p.y)}`).join(''))
    .join('');

  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${fmt(-pad)} ${fmt(-pad)} ${fmt(width + pad * 2)} ${fmt(height + pad * 2)}">` +
    `<path d="${d}" fill="none" stroke="${strokeColor}" stroke-width="${fmt(stroke)}" stroke-linecap="round" stroke-linejoin="round"/>` +
    `</svg>`;

  return { svg, entityCount: valid.length };
}
