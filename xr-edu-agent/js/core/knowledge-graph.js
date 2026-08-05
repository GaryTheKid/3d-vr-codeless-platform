// ═══════════════════════════════════════════════════════════════
//  Knowledge Graph / MindMap — hard anchor between uploaded md & Outline
//  Persist on state.knowledgeGraph (+ ProjectData.cfg.knowledgeGraph)
// ═══════════════════════════════════════════════════════════════
import { state } from './state.js';
import { emit } from './events.js';
import { L } from './i18n.js';

export const NODE_KINDS = ['concept', 'subconcept', 'principle', 'skill', 'equation', 'perk', 'example'];

/**
 * @typedef {{ id: string, kind: string, label: string, mastery?: string, notes?: string, coverage?: string }} KGNode
 * @typedef {{ from: string, to: string, relation?: string }} KGEdge
 * @typedef {{ id: string, insight: string, whyKey?: string, misconception?: string, buildIdea?: string, nodeIds?: string[] }} AhaKey
 * @typedef {{
 *   version: number,
 *   level?: string,
 *   anchorExample?: string,
 *   courseTitle?: string,
 *   courseGoal?: string,
 *   nodes: KGNode[],
 *   edges: KGEdge[],
 *   ahaKeys: AhaKey[],
 *   sourceFilename?: string,
 *   updatedAt?: number,
 * }} KnowledgeGraph
 */

export function emptyKnowledgeGraph(partial = {}) {
  return {
    version: 1,
    level: partial.level || 'middle',
    anchorExample: partial.anchorExample || '',
    courseTitle: partial.courseTitle || '',
    courseGoal: partial.courseGoal || '',
    nodes: Array.isArray(partial.nodes) ? partial.nodes.map(normalizeNode).filter(Boolean) : [],
    edges: Array.isArray(partial.edges) ? partial.edges.map(normalizeEdge).filter(Boolean) : [],
    ahaKeys: Array.isArray(partial.ahaKeys) ? partial.ahaKeys.map(normalizeAha).filter(Boolean) : [],
    sourceFilename: partial.sourceFilename || '',
    updatedAt: partial.updatedAt || Date.now(),
  };
}

let ahaSeq = 0;
/** "Aha key" = the transferable insight a great teacher installs; survives any re-skinned problem. */
function normalizeAha(a) {
  if (!a || typeof a !== 'object') return null;
  const insight = String(a.insight || '').trim();
  if (!insight) return null;
  return {
    id: String(a.id || '').trim() || `aha_${++ahaSeq}_${Date.now().toString(36)}`,
    insight,
    whyKey: a.whyKey != null ? String(a.whyKey) : '',
    misconception: a.misconception != null ? String(a.misconception) : '',
    buildIdea: a.buildIdea != null ? String(a.buildIdea) : '',
    nodeIds: Array.isArray(a.nodeIds) ? a.nodeIds.map(String) : [],
  };
}

function normalizeNode(n) {
  if (!n || typeof n !== 'object') return null;
  const id = String(n.id || '').trim();
  const label = String(n.label || '').trim();
  if (!id || !label) return null;
  const kind = NODE_KINDS.includes(n.kind) ? n.kind : 'concept';
  return {
    id,
    kind,
    label,
    mastery: n.mastery != null ? String(n.mastery) : L('学生应能解释并应用', 'Student can explain and apply'),
    notes: n.notes != null ? String(n.notes) : '',
    coverage: n.coverage || 'planned',
  };
}

function normalizeEdge(e) {
  if (!e || typeof e !== 'object') return null;
  const from = String(e.from || '').trim();
  const to = String(e.to || '').trim();
  if (!from || !to) return null;
  return { from, to, relation: String(e.relation || 'prerequisite') };
}

export function getKnowledgeGraph() {
  return state.knowledgeGraph || null;
}

export function setKnowledgeGraph(kg, { silent = false } = {}) {
  state.knowledgeGraph = emptyKnowledgeGraph(kg || {});
  if (!silent) emit('knowledge-graph-changed', state.knowledgeGraph);
  return state.knowledgeGraph;
}

export function clearKnowledgeGraph() {
  state.knowledgeGraph = null;
  emit('knowledge-graph-changed', null);
}

/** Compact digest for LLM context / section sub-agents. */
export function knowledgeGraphDigest(kg = getKnowledgeGraph(), { maxNodes = 40 } = {}) {
  if (!kg?.nodes?.length) return '';
  const nodes = kg.nodes.slice(0, maxNodes).map(n =>
    `- ${n.id} [${n.kind}] ${n.label}${n.mastery ? ` — mastery: ${n.mastery}` : ''}`
  ).join('\n');
  const edges = (kg.edges || []).slice(0, 60).map(e =>
    `- ${e.from} -[${e.relation || 'prerequisite'}]-> ${e.to}`
  ).join('\n');
  const ahas = (kg.ahaKeys || []).slice(0, 8).map(a =>
    `- ${a.id}: ${a.insight}${a.misconception ? ` (defeats: ${a.misconception})` : ''}`
  ).join('\n');
  return `[Knowledge Graph / MindMap]
level: ${kg.level || 'middle'}
course: ${kg.courseTitle || ''}
goal: ${kg.courseGoal || ''}
anchorExample: ${kg.anchorExample || '(none)'}
nodes (${kg.nodes.length}):
${nodes}
edges (${kg.edges?.length || 0}):
${edges || '(none)'}${ahas ? `
ahaKeys — the transferable insights this course must install (teach toward these, not just facts):
${ahas}` : ''}
Rule: later teaching / quizzes MUST cover these nodes; never use a concept that was never taught (follow edges).`;
}

export function nodesByIds(ids = [], kg = getKnowledgeGraph()) {
  if (!kg) return [];
  const set = new Set(ids);
  return kg.nodes.filter(n => set.has(n.id));
}

/** Topological-ish order: prerequisites first (Kahn). Isolated nodes keep original order. */
export function orderedNodeIds(kg = getKnowledgeGraph()) {
  if (!kg?.nodes?.length) return [];
  const ids = kg.nodes.map(n => n.id);
  const idSet = new Set(ids);
  const indeg = Object.fromEntries(ids.map(id => [id, 0]));
  const adj = Object.fromEntries(ids.map(id => [id, []]));
  for (const e of kg.edges || []) {
    if (!idSet.has(e.from) || !idSet.has(e.to)) continue;
    adj[e.from].push(e.to);
    indeg[e.to]++;
  }
  const q = ids.filter(id => indeg[id] === 0);
  const out = [];
  while (q.length) {
    const id = q.shift();
    out.push(id);
    for (const nxt of adj[id]) {
      indeg[nxt]--;
      if (indeg[nxt] === 0) q.push(nxt);
    }
  }
  for (const id of ids) if (!out.includes(id)) out.push(id);
  return out;
}
