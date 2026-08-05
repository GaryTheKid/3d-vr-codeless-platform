// ═══════════════════════════════════════════════════════════════
//  Free-panel placement: avoid stacking in the default camera cone
//  Default orbit looks from ~(+X,+Z) toward origin — keep boards
//  on the flanks / behind so the diorama stays readable.
// ═══════════════════════════════════════════════════════════════
import { sceneRoot } from '../core/three-setup.js';

const MIN_SEP = 3.0;

/** Prefer side / back slots — away from default front view of the model. */
const FLANK_SLOTS = [
  { x: -6.5, y: 2.6, z: 0.5 },
  { x: -6.5, y: 2.6, z: -3.0 },
  { x: 6.5, y: 2.6, z: 0.5 },
  { x: 6.5, y: 2.6, z: -3.0 },
  { x: -4.5, y: 2.8, z: -5.5 },
  { x: 4.5, y: 2.8, z: -5.5 },
  { x: 0, y: 2.5, z: -7.0 },
  { x: -7.5, y: 2.4, z: 3.5 },
  { x: 7.5, y: 2.4, z: 3.5 },
];

/** Quiz cards are tall (options stack downward) — hang HIGH so bottoms stay above ground. */
const QUIZ_MIN_Y = 4.8;
const QUIZ_SLOTS = [
  { x: -7.2, y: 5.0, z: 1.0 },
  { x: 7.2, y: 5.0, z: 1.0 },
  { x: -7.2, y: 5.0, z: -2.5 },
  { x: 7.2, y: 5.0, z: -2.5 },
  { x: -5.5, y: 4.8, z: -6.0 },
  { x: 5.5, y: 4.8, z: -6.0 },
  { x: -8.0, y: 5.2, z: 3.5 },
  { x: 8.0, y: 5.2, z: 3.5 },
];

function isFreePanelRoot(o) {
  if (!o || o === sceneRoot) return false;
  if (o.userData?.icon === '📋' || o.userData?.icon === '❓') return true;
  if (o.userData?.quiz) return true;
  let hit = false;
  o.traverse(c => {
    if (c !== o && c.userData?.panelData && c.parent === o) hit = true;
  });
  return hit;
}

export function collectFreePanelPositions(exclude = null) {
  const pts = [];
  for (const o of sceneRoot.children) {
    if (o === exclude) continue;
    if (!isFreePanelRoot(o)) continue;
    pts.push({ x: o.position.x, y: o.position.y, z: o.position.z });
  }
  return pts;
}

function tooClose(x, z, existing, minSep = MIN_SEP) {
  return existing.some(p => Math.hypot(p.x - x, p.z - z) < minSep);
}

/** Near origin on the camera-facing side → panels stack in the default screenshot. */
function inDefaultFrontCone(x, z) {
  return Math.hypot(x, z) < 3.5 && z > -1.5 && Math.abs(x) < 4.5;
}

/**
 * Resolve a free-panel world position so panels don't stack.
 * @param {{x?:number,y?:number,z?:number}} req
 * @param {{ role?: 'task'|'quiz'|'info', exclude?: object }} [opts]
 */
export function resolvePanelPosition(req = {}, opts = {}) {
  const existing = collectFreePanelPositions(opts.exclude || null);
  const isQuiz = opts.role === 'quiz';
  const minSep = isQuiz ? 4.0 : MIN_SEP;
  let x = Number.isFinite(req.x) ? req.x : (isQuiz ? -7.2 : 0);
  let y = Number.isFinite(req.y) ? req.y : (isQuiz ? QUIZ_MIN_Y : 2.6);
  let z = Number.isFinite(req.z) ? req.z : (isQuiz ? 1.0 : 0);
  // LLM often passes y≈1–2; quiz card extends several meters downward → force hang high
  if (isQuiz) y = Math.max(y, QUIZ_MIN_Y);

  const okHere = (ax, az) => !tooClose(ax, az, existing, minSep) && !inDefaultFrontCone(ax, az);
  if (okHere(x, z)) return { x, y, z, adjusted: false };

  const slots = isQuiz ? QUIZ_SLOTS : FLANK_SLOTS;
  for (const s of slots) {
    if (!tooClose(s.x, s.z, existing, minSep)) {
      const sy = isQuiz ? Math.max(Number.isFinite(req.y) ? req.y : s.y, QUIZ_MIN_Y) : (Number.isFinite(req.y) ? req.y : s.y);
      return { x: s.x, y: sy, z: s.z, adjusted: true };
    }
  }
  // Spiral fallback around the origin (prefer back hemisphere)
  for (let i = 0; i < 20; i++) {
    const a = -Math.PI / 2 + i * 0.55;
    const r = (isQuiz ? 7.0 : 5.5) + i * 0.4;
    const sx = Math.cos(a) * r;
    const sz = Math.sin(a) * r;
    if (!tooClose(sx, sz, existing, minSep) && !inDefaultFrontCone(sx, sz)) {
      return { x: sx, y: isQuiz ? Math.max(y, QUIZ_MIN_Y) : y, z: sz, adjusted: true };
    }
  }
  return { x: x + minSep * (existing.length + 1), y: isQuiz ? Math.max(y, QUIZ_MIN_Y) : y, z: z - minSep, adjusted: true };
}

/** Sideways local offset when multiple labels hang on one object. */
export function nextLabelLocalOffset(obj) {
  let n = 0;
  obj?.traverse?.(c => {
    if (c.userData?.panelData && c.parent === obj) n += 1;
  });
  // stagger left/right/up for 2nd+ labels
  if (n <= 0) return { x: 0, y: 0 };
  const side = (n % 2 === 1) ? 1 : -1;
  const tier = Math.floor((n - 1) / 2);
  return { x: side * (1.2 + tier * 0.4), y: tier * 0.35 };
}
