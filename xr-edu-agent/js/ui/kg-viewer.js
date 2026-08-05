// ═══════════════════════════════════════════════════════════════
//  Knowledge Graph viewer — larger canvas, pan by drag, node detail
// ═══════════════════════════════════════════════════════════════
import { on } from '../core/events.js';
import { toast, escapeHtml } from '../core/utils.js';
import { L, t, applyDomI18n } from '../core/i18n.js';
import { getKnowledgeGraph, orderedNodeIds } from '../core/knowledge-graph.js';

const overlay = () => document.getElementById('kg-overlay');
const stage = () => document.getElementById('kg-overlay-stage');

const KIND_COLOR = {
  concept: '#4a9eff',
  subconcept: '#6eb0ff',
  principle: '#a878f0',
  skill: '#3fb96f',
  equation: '#e8a838',
  perk: '#3ecfcf',
  example: '#e07a5f',
};

/** Viewport pan state for the open overlay */
let pan = { x: 0, y: 0 };
let selectedNodeId = null;
let lastKg = null;

function kindLabel(kind) {
  const map = {
    concept: L('概念', 'Concept'),
    subconcept: L('子概念', 'Subconcept'),
    principle: L('原理', 'Principle'),
    skill: L('技能', 'Skill'),
    equation: L('公式', 'Equation'),
    perk: L('要点', 'Perk'),
    example: L('实例', 'Example'),
  };
  return map[kind] || kind;
}

/** Layered layout from topological roots → leaves. */
function layoutNodes(kg, width, height) {
  const ids = kg.nodes.map(n => n.id);
  const idSet = new Set(ids);
  const children = Object.fromEntries(ids.map(id => [id, []]));
  const parents = Object.fromEntries(ids.map(id => [id, []]));
  for (const e of kg.edges || []) {
    if (!idSet.has(e.from) || !idSet.has(e.to)) continue;
    children[e.from].push(e.to);
    parents[e.to].push(e.from);
  }
  const order = orderedNodeIds(kg);
  const layerOf = {};
  for (const id of order) {
    const ps = parents[id];
    layerOf[id] = ps.length ? Math.max(...ps.map(p => (layerOf[p] ?? 0))) + 1 : 0;
  }
  const layers = {};
  for (const id of ids) {
    const Lyr = layerOf[id] ?? 0;
    (layers[Lyr] ??= []).push(id);
  }
  const layerKeys = Object.keys(layers).map(Number).sort((a, b) => a - b);
  const padX = 72;
  const padY = 72;
  const usableW = Math.max(280, width - padX * 2);
  const usableH = Math.max(220, height - padY * 2);
  const maxLayer = Math.max(1, layerKeys.length - 1);
  const pos = {};
  for (const lyr of layerKeys) {
    const row = layers[lyr];
    const y = padY + (maxLayer === 0 ? usableH / 2 : (lyr / maxLayer) * usableH);
    row.forEach((id, i) => {
      const x = padX + (row.length === 1 ? usableW / 2 : (i / (row.length - 1)) * usableW);
      pos[id] = { x, y };
    });
  }
  return kg.nodes.map(n => ({
    ...n,
    x: pos[n.id]?.x ?? width / 2,
    y: pos[n.id]?.y ?? height / 2,
  }));
}

function truncate(s, n = 28) {
  const t = String(s || '');
  return t.length > n ? `${t.slice(0, n - 1)}…` : t;
}

function applyPanTransform() {
  const layer = stage()?.querySelector('.kg-pan-layer');
  if (layer) layer.style.transform = `translate(${pan.x}px, ${pan.y}px)`;
}

function renderNodeDetail(kg, nodeId) {
  const panel = stage()?.querySelector('.kg-detail');
  if (!panel) return;
  const n = (kg.nodes || []).find(x => x.id === nodeId);
  if (!n) {
    panel.classList.add('is-empty');
    panel.innerHTML = `<div class="kg-detail-empty">${escapeHtml(L('点击节点查看详情', 'Click a node for details'))}</div>`;
    return;
  }
  panel.classList.remove('is-empty');
  const fill = KIND_COLOR[n.kind] || '#4a9eff';
  const outs = (kg.edges || []).filter(e => e.from === n.id);
  const inns = (kg.edges || []).filter(e => e.to === n.id);
  const byId = Object.fromEntries((kg.nodes || []).map(x => [x.id, x]));
  const ahas = (kg.ahaKeys || []).filter(a => (a.nodeIds || []).includes(n.id));
  const edgeLine = (e, otherId) => {
    const other = byId[otherId];
    const lab = other ? other.label : otherId;
    return `<li><span class="kg-detail-rel">${escapeHtml(e.relation || 'prerequisite')}</span> ${escapeHtml(lab)}</li>`;
  };
  panel.innerHTML = `
    <button type="button" class="kg-detail-close" title="${escapeHtml(L('关闭', 'Close'))}">✕</button>
    <div class="kg-detail-kind" style="--kg-c:${fill}">${escapeHtml(kindLabel(n.kind))}</div>
    <h3 class="kg-detail-title">${escapeHtml(n.label)}</h3>
    <div class="kg-detail-id"><code>${escapeHtml(n.id)}</code></div>
    <div class="kg-detail-sec">
      <div class="kg-detail-sec-title">${escapeHtml(L('掌握目标', 'Mastery'))}</div>
      <p>${escapeHtml(n.mastery || '—')}</p>
    </div>
    ${n.notes ? `<div class="kg-detail-sec"><div class="kg-detail-sec-title">${escapeHtml(L('备注', 'Notes'))}</div><p>${escapeHtml(n.notes)}</p></div>` : ''}
    ${n.coverage ? `<div class="kg-detail-sec"><div class="kg-detail-sec-title">${escapeHtml(L('覆盖', 'Coverage'))}</div><p>${escapeHtml(n.coverage)}</p></div>` : ''}
    ${inns.length ? `<div class="kg-detail-sec"><div class="kg-detail-sec-title">${escapeHtml(L('前置', 'Prerequisites'))}</div><ul class="kg-detail-edges">${inns.map(e => edgeLine(e, e.from)).join('')}</ul></div>` : ''}
    ${outs.length ? `<div class="kg-detail-sec"><div class="kg-detail-sec-title">${escapeHtml(L('通向', 'Leads to'))}</div><ul class="kg-detail-edges">${outs.map(e => edgeLine(e, e.to)).join('')}</ul></div>` : ''}
    ${ahas.length ? `<div class="kg-detail-sec"><div class="kg-detail-sec-title">${escapeHtml(L('相关顿悟点', 'Related aha keys'))}</div><ul class="kg-detail-ahas">${ahas.map(a => `<li>${escapeHtml(a.insight)}</li>`).join('')}</ul></div>` : ''}
  `;
  panel.querySelector('.kg-detail-close')?.addEventListener('click', () => {
    selectedNodeId = null;
    highlightSelectedNode();
    renderNodeDetail(kg, null);
  });
}

function highlightSelectedNode() {
  const host = stage();
  if (!host) return;
  host.querySelectorAll('.kg-node').forEach(g => {
    g.classList.toggle('is-selected', g.dataset.id === selectedNodeId);
  });
}

function bindGraphInteractions(kg) {
  const host = stage();
  const viewport = host?.querySelector('.kg-viewport');
  const svg = host?.querySelector('.kg-svg');
  if (!viewport || !svg) return;

  let dragging = false;
  let moved = false;
  let startX = 0;
  let startY = 0;
  let originX = 0;
  let originY = 0;

  const onMove = (e) => {
    if (!dragging) return;
    const dx = e.clientX - startX;
    const dy = e.clientY - startY;
    if (Math.abs(dx) + Math.abs(dy) > 3) moved = true;
    pan.x = originX + dx;
    pan.y = originY + dy;
    applyPanTransform();
  };
  const onUp = () => {
    if (!dragging) return;
    dragging = false;
    viewport.classList.remove('is-panning');
    window.removeEventListener('pointermove', onMove);
    window.removeEventListener('pointerup', onUp);
  };

  viewport.addEventListener('pointerdown', (e) => {
    if (e.button !== 0) return;
    // Node clicks handled separately; still allow pan from empty canvas
    if (e.target.closest('.kg-node')) return;
    if (e.target.closest('.kg-detail') || e.target.closest('.kg-aha') || e.target.closest('.kg-legend')) return;
    dragging = true;
    moved = false;
    startX = e.clientX;
    startY = e.clientY;
    originX = pan.x;
    originY = pan.y;
    viewport.classList.add('is-panning');
    viewport.setPointerCapture?.(e.pointerId);
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  });

  svg.querySelectorAll('.kg-node').forEach(g => {
    g.addEventListener('pointerdown', (e) => {
      e.stopPropagation();
      moved = false;
      startX = e.clientX;
      startY = e.clientY;
      const onNodeMove = (ev) => {
        if (Math.abs(ev.clientX - startX) + Math.abs(ev.clientY - startY) > 4) moved = true;
      };
      const onNodeUp = (ev) => {
        window.removeEventListener('pointermove', onNodeMove);
        window.removeEventListener('pointerup', onNodeUp);
        if (moved) return;
        ev.stopPropagation();
        selectedNodeId = g.dataset.id || null;
        highlightSelectedNode();
        renderNodeDetail(kg, selectedNodeId);
      };
      window.addEventListener('pointermove', onNodeMove);
      window.addEventListener('pointerup', onNodeUp);
    });
  });
}

function renderGraphSvg(kg) {
  const host = stage();
  if (!host) return;
  lastKg = kg;
  // Use stage size; leave room for the detail drawer
  const w = Math.max(640, Math.floor((host.clientWidth || 960) * 0.72));
  const h = Math.max(420, host.clientHeight || 560);
  const nodes = layoutNodes(kg, w, h);
  const byId = Object.fromEntries(nodes.map(n => [n.id, n]));
  const edges = (kg.edges || []).filter(e => byId[e.from] && byId[e.to]);

  const edgeEls = edges.map(e => {
    const a = byId[e.from];
    const b = byId[e.to];
    const mx = (a.x + b.x) / 2;
    const my = (a.y + b.y) / 2 - 22;
    const rel = escapeHtml(e.relation || 'prerequisite');
    return `
      <path class="kg-edge" d="M${a.x},${a.y} Q${mx},${my} ${b.x},${b.y}" fill="none" marker-end="url(#kg-arrow)" />
      <title>${escapeHtml(a.label)} → ${escapeHtml(b.label)} (${rel})</title>`;
  }).join('');

  const nodeEls = nodes.map(n => {
    const fill = KIND_COLOR[n.kind] || '#4a9eff';
    const label = escapeHtml(truncate(n.label, 24));
    const tip = escapeHtml(`${n.label} [${n.kind}]${n.mastery ? `\n${n.mastery}` : ''}`);
    const sel = n.id === selectedNodeId ? ' is-selected' : '';
    return `
      <g class="kg-node${sel}" transform="translate(${n.x},${n.y})" data-id="${escapeHtml(n.id)}" style="cursor:pointer">
        <title>${tip}</title>
        <circle class="kg-node-halo" r="22" fill="${fill}" fill-opacity="0.22" stroke="${fill}" stroke-width="2.5" />
        <circle class="kg-node-dot" r="7" fill="${fill}" />
        <text class="kg-node-label" y="38" text-anchor="middle">${label}</text>
      </g>`;
  }).join('');

  const legend = Object.keys(KIND_COLOR)
    .filter(k => nodes.some(n => n.kind === k))
    .map(k => `
      <span class="kg-legend-item">
        <i style="background:${KIND_COLOR[k]}"></i>${escapeHtml(kindLabel(k))}
      </span>`).join('');

  const ahaList = (kg.ahaKeys || []).map((a, i) => {
    const tipLines = [
      a.whyKey ? `${L('为什么关键', 'Why it matters')}: ${a.whyKey}` : '',
      a.misconception ? `${L('打破误解', 'Defeats')}: ${a.misconception}` : '',
      a.buildIdea ? `${L('建构方式', 'Build idea')}: ${a.buildIdea}` : '',
    ].filter(Boolean).join('\n');
    return `
      <li class="kg-aha-item" title="${escapeHtml(tipLines)}">
        <span class="kg-aha-idx">💡${i + 1}</span>${escapeHtml(a.insight)}
      </li>`;
  }).join('');
  const ahaBlock = ahaList
    ? `<div class="kg-aha">
        <div class="kg-aha-title">${escapeHtml(L('顿悟点(本课必须装进学生脑中的钥匙)', 'Aha keys — insights this course must install'))}</div>
        <ul class="kg-aha-list">${ahaList}</ul>
      </div>`
    : '';

  host.innerHTML = `
    <div class="kg-viewport" title="${escapeHtml(L('左键拖拽平移图谱', 'Left-drag to pan the graph'))}">
      <div class="kg-pan-layer">
        <svg class="kg-svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" role="img" aria-label="Knowledge graph">
          <defs>
            <marker id="kg-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
              <path d="M 0 0 L 10 5 L 0 10 z" fill="#5f6875" />
            </marker>
          </defs>
          <rect class="kg-svg-bg" x="0" y="0" width="${w}" height="${h}" fill="transparent" />
          <g class="kg-edges">${edgeEls}</g>
          <g class="kg-nodes">${nodeEls}</g>
        </svg>
      </div>
      <div class="kg-legend">${legend || `<span class="kg-legend-item">${escapeHtml(L('无节点类型', 'No kinds'))}</span>`}</div>
      ${ahaBlock}
      <div class="kg-pan-hint">${escapeHtml(L('左键拖拽平移 · 点击节点查看详情', 'Drag to pan · Click a node for details'))}</div>
    </div>
    <aside class="kg-detail is-empty" aria-live="polite">
      <div class="kg-detail-empty">${escapeHtml(L('点击节点查看详情', 'Click a node for details'))}</div>
    </aside>`;

  applyPanTransform();
  bindGraphInteractions(kg);
  if (selectedNodeId) renderNodeDetail(kg, selectedNodeId);
}

function syncMeta(kg) {
  const meta = document.getElementById('kg-overlay-meta');
  if (!meta) return;
  if (!kg?.nodes?.length) {
    meta.textContent = L('尚未生成知识图谱 — 请先「据此备课」', 'No knowledge graph yet — run “Build from this” first');
    return;
  }
  const parts = [
    L(`${kg.nodes.length} 个节点`, `${kg.nodes.length} nodes`),
    L(`${kg.edges?.length || 0} 条边`, `${kg.edges?.length || 0} edges`),
  ];
  if (kg.level) parts.push(L(`学段 ${kg.level}`, `Level ${kg.level}`));
  if (kg.anchorExample) parts.push(L(`主例: ${kg.anchorExample}`, `Anchor: ${kg.anchorExample}`));
  meta.textContent = parts.join(' · ');
}

export function openKgOverlay() {
  const el = overlay();
  if (!el) return;
  const kg = getKnowledgeGraph();
  if (!kg?.nodes?.length) {
    toast(L('还没有知识图谱。上传材料并点击「据此备课」后会出现。', 'No knowledge graph yet. Upload material and click “Build from this” first.'));
    return;
  }
  pan = { x: 0, y: 0 };
  selectedNodeId = null;
  applyDomI18n(el);
  syncMeta(kg);
  el.classList.remove('hidden');
  el.setAttribute('aria-hidden', 'false');
  requestAnimationFrame(() => renderGraphSvg(kg));
}

export function closeKgOverlay() {
  const el = overlay();
  if (!el) return;
  el.classList.add('hidden');
  el.setAttribute('aria-hidden', 'true');
  selectedNodeId = null;
  lastKg = null;
}

/** Mini graph icon button for the course header. */
export function kgEntryButtonHtml() {
  const kg = getKnowledgeGraph();
  const n = kg?.nodes?.length || 0;
  const disabled = n === 0;
  const title = disabled
    ? t('kg.btnEmptyTitle')
    : t('kg.btnTitle');
  return `
    <button type="button" class="kg-entry-btn${disabled ? ' is-empty' : ''}" id="btn-open-kg"
      title="${escapeHtml(title)}" aria-label="${escapeHtml(title)}">
      <svg class="kg-entry-icon" viewBox="0 0 32 24" width="28" height="20" aria-hidden="true">
        <circle cx="6" cy="12" r="3.2" fill="#4a9eff"/>
        <circle cx="16" cy="5" r="3.2" fill="#a878f0"/>
        <circle cx="26" cy="12" r="3.2" fill="#3fb96f"/>
        <circle cx="16" cy="19" r="2.6" fill="#e8a838"/>
        <path d="M8.8 10.2 L13.2 6.6 M18.8 6.6 L23.2 10.2 M8.8 13.8 L13.8 17.4 M18.2 17.4 L23.2 13.8 M16 8.2 L16 16.2"
          stroke="#8a93a0" stroke-width="1.4" fill="none" stroke-linecap="round"/>
      </svg>
      <span class="kg-entry-label" data-i18n="kg.btnLabel">${escapeHtml(t('kg.btnLabel'))}</span>
      <span class="kg-entry-count">${n ? n : '—'}</span>
    </button>`;
}

export function bindKgEntryButton(root) {
  root?.querySelector('#btn-open-kg')?.addEventListener('click', e => {
    e.stopPropagation();
    openKgOverlay();
  });
}

document.addEventListener('click', e => {
  if (e.target.closest('#btn-kg-close') || e.target.id === 'kg-overlay-backdrop') {
    closeKgOverlay();
  }
});
window.addEventListener('keydown', e => {
  if (e.key === 'Escape') {
    const el = overlay();
    if (el && !el.classList.contains('hidden')) closeKgOverlay();
  }
});

on('knowledge-graph-changed', () => {
  const el = overlay();
  if (el && !el.classList.contains('hidden')) {
    const kg = getKnowledgeGraph();
    if (!kg?.nodes?.length) closeKgOverlay();
    else {
      syncMeta(kg);
      renderGraphSvg(kg);
    }
  }
});

window.addEventListener('resize', () => {
  const el = overlay();
  if (!el || el.classList.contains('hidden')) return;
  const kg = lastKg || getKnowledgeGraph();
  if (kg?.nodes?.length) renderGraphSvg(kg);
});
