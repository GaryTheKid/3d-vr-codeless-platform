// ═══════════════════════════════════════════════════════════════
//  场景上下文序列化(参考 MIT LLMR:用紧凑 JSON 概括场景给 LLM 读)
//
//  分层上下文(大场景不炸 token 的关键):
//  · 小场景(对象数 ≤ FULL_JSON_MAX)→ 照旧发完整 JSON,零回归
//  · 大场景 → 三层:
//    ① 常驻摘要:按分类分组的对象索引(每对象一行),保住全局感知
//    ② 廉价预取:纯 JS 打分(选中/工作集/关键词双字匹配),
//       命中的对象自动附完整参数,省掉模型的工具往返
//    ③ 按需拉取:模型用 find_objects / get_object_detail 工具自己查
//  · sceneToJSON()      整个场景(所有对象 + 虚拟控制器状态)
//  · objectToJSON(obj)  单个对象的详细描述(用户 📌 加入上下文时用)
// ═══════════════════════════════════════════════════════════════
import { sceneRoot } from '../core/three-setup.js';
import { state } from '../core/state.js';
import { getMainColor } from '../scene/manager.js';
import { findAssetSkill } from '../assets/registry.js';
import { chemLab } from '../labs/chem-oxygen.js';
import { engLab } from '../labs/english-cafe.js';
import { locomotion } from '../core/locomotion.js';
import { getStudentSpawn } from '../scene/student-rig.js';

export const FULL_JSON_MAX = 20;   // 对象数 ≤ 此值 → 发完整场景 JSON(小场景零回归)
const PREFETCH_MAX = 8;            // 大场景模式下自动预取的高相关对象上限
const WORKING_SET_TURNS = 3;       // 最近 N 轮被创建/修改过的对象视为"工作集"

const round = n => Math.round(n * 100) / 100;

export function objectToJSON(obj, detailed = false) {
  const ud = obj.userData;
  const o = {
    oid: ud.oid,
    name: ud.displayName,
    asset: ud.assetId || (ud.icon === '📋' ? 'panel' : 'custom'),
    pos: [round(obj.position.x), round(obj.position.y), round(obj.position.z)],
    scale: round(obj.scale.x),
  };
  if (Math.abs(obj.rotation.y) > 0.01) o.rotY = round(obj.rotation.y);
  if (ud.anim) o.anim = { ...ud.anim };
  if (ud.expAction) o.studentInteraction = ud.expAction;
  if (ud.behaviorDesc) o.behavior = ud.behaviorDesc;
  if (ud.customUpdate) o.hasCustomUpdate = true;
  if (ud.customClick || ud.onActivate) o.studentInteraction = o.studentInteraction || 'activate';
  if (ud.onGrab || ud.onDrag) o.grabbable = true;
  if (detailed) {
    if (ud.builderCode) o.builderCode = ud.builderCode;
    if (ud.updateCode) o.updateCode = ud.updateCode;
    if (ud.clickCode) o.clickCode = ud.clickCode;
    if (ud.grabCode) o.grabCode = ud.grabCode;
    if (ud.dragCode) o.dragCode = ud.dragCode;
    if (ud.releaseCode) o.releaseCode = ud.releaseCode;
    o.color = '#' + getMainColor(obj).getHexString();
    const panels = [];
    obj.traverse(c => {
      const pd = c.userData.panelData;
      if (!pd) return;
      panels.push(pd.live
        ? { title: pd.title || '(标签)', live: true }
        : { title: pd.title || '(标签)', lines: pd.lines.map(l => typeof l === 'string' ? l : `${l.k}|${l.v}`) });
    });
    if (panels.length) o.attachedPanels = panels;
    if (ud.compDesc && Object.keys(ud.compDesc).length) o.teacherNotes = ud.compDesc;
  }
  return o;
}

// 全局状态(选中/动画/移动方式/活跃实验),摘要与完整 JSON 共用
function globalState() {
  const g = {
    selected: state.selected?.userData.oid || null,
    playMode: state.playMode,   // false=编辑模式(全静态,点击=选中) true=运行模式(动画+学生交互生效)
    animPlaying: state.animPlaying,
    studentLocomotion: { mode: locomotion.mode, allowedRadius: locomotion.allowedRadius, turnMode: locomotion.turnMode },
  };
  const sp = getStudentSpawn();
  if (sp) g.studentSpawn = { x: round(sp.x), z: round(sp.z), yawDeg: Math.round(sp.yaw * 180 / Math.PI) };   // 学生出生点(set_student_view 可改)
  if (chemLab.active) {
    g.activeExperiment = {
      type: 'oxygen_lab', version: chemLab.v2 ? 'v2_corrected' : 'v1_with_intentional_error',
      step: chemLab.step, progress: round(chemLab.progress), temp: round(chemLab.temp), rate: chemLab.rate,
    };
  }
  if (engLab.active) {
    g.activeDialogue = { type: 'english_cafe', scriptIndex: engLab.idx, state: engLab.state, micThreshold: engLab.threshold };
  }
  return g;
}

export function sceneToJSON() {
  return { objects: sceneRoot.children.map(o => objectToJSON(o)), ...globalState() };
}

// ── 大场景摘要:按分类分组的一行式索引 ──
function indexLine(obj) {
  const ud = obj.userData;
  const marks = [];
  if (ud.anim) marks.push(ud.anim.type);
  if (ud.expAction || ud.customClick || ud.onActivate) marks.push('可点击');
  if (ud.onGrab || ud.onDrag) marks.push('可抓取');
  if (ud.customUpdate) marks.push('每帧行为');
  const p = `(${round(obj.position.x)},${round(obj.position.y)},${round(obj.position.z)})`;
  const desc = ud.behaviorDesc ? ` — ${ud.behaviorDesc.slice(0, 30)}` : '';
  return `${ud.oid} ${ud.displayName} @${p}${marks.length ? ' [' + marks.join('/') + ']' : ''}${desc}`;
}

export function sceneSummary() {
  const groups = {};
  for (const o of sceneRoot.children) {
    const ud = o.userData;
    const skill = ud.assetId ? findAssetSkill(ud.assetId) : null;
    const cat = skill?.category || (ud.icon === '📋' ? '教学 · 标注' : '自定义(代码生成)');
    (groups[cat] = groups[cat] || []).push(indexLine(o));
  }
  const lines = Object.entries(groups)
    .map(([cat, ls]) => `▸ ${cat}(${ls.length})\n${ls.map(l => '  ' + l).join('\n')}`);
  return `${lines.join('\n')}\n[全局] ${JSON.stringify(globalState())}`;
}

// ── 廉价相关性打分(纯 JS,不花 LLM):选中 > 工作集 > 关键词命中 ──
// 关键词部分用"查询的中文双字 n-gram ∈ 对象可检索文本"做 BM25-lite 匹配,
// 可检索文本 = 显示名 + behaviorDesc + AssetSkill 的 name/description/tags
function relevanceScore(obj, q) {
  const ud = obj.userData;
  let s = 0;
  if (state.selected === obj) s += 5;
  const touchedAt = state.touched.get(ud.oid);
  if (touchedAt !== undefined) {
    const age = state.ctxTurn - touchedAt;
    if (age <= WORKING_SET_TURNS) s += 4 - age;
  }
  if (!q) return s;
  if (ud.oid && q.includes(ud.oid)) s += 6;
  const coreName = (ud.displayName || '').replace(/\s*\d+$/, '').toLowerCase();
  if (coreName && q.includes(coreName)) s += 4;
  const skill = ud.assetId ? findAssetSkill(ud.assetId) : null;
  if (skill?.tags?.some(t => q.includes(String(t).toLowerCase()))) s += 2;
  const hay = `${ud.displayName || ''} ${ud.behaviorDesc || ''} ${skill?.name || ''} ${skill?.description || ''}`.toLowerCase();
  let hits = 0;
  for (let i = 0; i < q.length - 1; i++) {
    const bg = q.slice(i, i + 2);
    if (/[\s,。??!!、::;;""''()()]/.test(bg)) continue;
    if (hay.includes(bg)) hits++;
  }
  s += Math.min(3, hits * 0.5);
  return s;
}

// 语义检索场景对象(find_objects 工具与预取共用)
// opts: { near: {x,z}, radius, limit }
export function searchObjects(query = '', opts = {}) {
  const q = (query || '').toLowerCase();
  let cands = sceneRoot.children.slice();
  if (opts.near && opts.radius) {
    cands = cands.filter(o => {
      const dx = o.position.x - opts.near.x, dz = o.position.z - opts.near.z;
      return Math.sqrt(dx * dx + dz * dz) <= opts.radius;
    });
  }
  const scored = cands.map(o => ({ o, s: relevanceScore(o, q) }));
  // 有关键词时要求最低分(滤掉 n-gram 噪音);纯空间查询不设门槛
  const filtered = q ? scored.filter(x => x.s >= 2) : scored;
  filtered.sort((a, b) => b.s - a.s);
  return filtered.slice(0, opts.limit || PREFETCH_MAX).map(x => x.o);
}

// 老师当前选中的对象(选中即上下文,支持 Shift 多选)→ 高细节上下文块
export function pinnedContextBlock() {
  if (!state.contextPins.length) return '';
  const items = state.contextPins.map(o => objectToJSON(o, true));
  return `\n\n[老师当前选中的对象(重点关注)]\n${JSON.stringify(items, null, 1)}`;
}

// ── 每轮注入的上下文消息(userText 用于预取打分)──
export function buildContextMessage(userText = '') {
  const objs = sceneRoot.children;
  if (objs.length <= FULL_JSON_MAX) {
    return `[当前场景状态 JSON]\n${JSON.stringify(sceneToJSON(), null, 1)}${pinnedContextBlock()}`;
  }
  // 大场景模式:摘要索引 + 高相关对象预取。
  // 预取给"全参数但不含行为代码"(代码可能每个几 KB,需要改代码时用 get_object_detail 拉)
  const pinnedOids = new Set(state.contextPins.map(o => o.userData.oid));
  const prefetched = searchObjects(userText, { limit: PREFETCH_MAX })
    .filter(o => !pinnedOids.has(o.userData.oid))
    .map(o => {
      const j = objectToJSON(o, true);
      for (const k of ['builderCode', 'updateCode', 'clickCode', 'grabCode', 'dragCode', 'releaseCode']) delete j[k];
      return j;
    });
  const prefetchBlock = prefetched.length
    ? `\n\n[与本次请求最相关的对象(自动预取,含完整参数;行为代码需要时用 get_object_detail 取)]\n${JSON.stringify(prefetched, null, 1)}`
    : '';
  return `[当前场景摘要(共 ${objs.length} 个对象,大场景模式)]
${sceneSummary()}

说明:以上是对象索引,不含完整参数。修改某对象前如需其完整参数/行为代码,用 find_objects(关键词/空间检索)或 get_object_detail(oid) 工具获取,不要凭索引猜。${prefetchBlock}${pinnedContextBlock()}`;
}
