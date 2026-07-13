// ═══════════════════════════════════════════════════════════════
//  分步交互实验:加热高锰酸钾制取氧气(2KMnO₄ →Δ→ K₂MnO₄ + MnO₂ + O₂↑)
//  学生按步骤板点击装置推进实验;收尾顺序选错 → 水倒吸炸裂试管
//  v2 = 修正版:验满前先取瓶翻转(由 Agent "帮我改"触发)
// ═══════════════════════════════════════════════════════════════
import * as THREE from 'three';
import { scene, sceneRoot } from '../core/three-setup.js';
import { mat, mesh, toast } from '../core/utils.js';
import { assignOid } from '../core/state.js';
import { emit } from '../core/events.js';
import { clearScene, onSceneClear } from '../scene/manager.js';
import { attachLabel, addFreePanel, drawPanel } from '../panels/panel3d.js';
import { L } from '../core/i18n.js';

export const chemLab = {
  active: false, v2: false, step: '', progress: 0, temp: 20,
  lampOn: false, ductRemoved: false, checkTimer: 0,
  splintT: -1, suckT: -1, bottleT: -1, spawnAcc: 0,
  rate: 9, refs: {}, fx: null, bubbles: [],
};

function chemLabDispose() {
  if (chemLab.fx) { scene.remove(chemLab.fx); chemLab.fx = null; }
  chemLab.active = false;
}
onSceneClear(chemLabDispose);

const POWDER_BEFORE = new THREE.Color(0x4a1f5e);  // KMnO₄ 紫黑
const POWDER_AFTER = new THREE.Color(0x1d3326);   // K₂MnO₄ + MnO₂ 墨绿偏黑

// ── 实验装置构建 ──
function buildIronStand() {
  const g = new THREE.Group();
  const base = mesh(new THREE.BoxGeometry(1.3, 0.08, 0.9), mat(0x3a4048, { metalness: 0.6, roughness: 0.4 }));
  base.position.y = 0.04;
  const rod = mesh(new THREE.CylinderGeometry(0.045, 0.045, 3.1, 12), mat(0x4a525c, { metalness: 0.7, roughness: 0.35 }));
  rod.position.y = 1.55;
  const arm = mesh(new THREE.BoxGeometry(1.3, 0.07, 0.07), mat(0x4a525c, { metalness: 0.7 }));
  arm.position.set(0.65, 2.0, 0);
  const clamp = mesh(new THREE.TorusGeometry(0.3, 0.045, 10, 24), mat(0x5a6470, { metalness: 0.7 }));
  clamp.position.set(1.3, 2.0, 0);
  clamp.rotation.y = Math.PI / 2;
  g.add(base, rod, arm, clamp);
  return g;
}

function buildChemTube() {
  // inner 承担倾斜旋转,外层 wrapper 保持无旋转(便于挂标签)
  const inner = new THREE.Group();
  const glassM = new THREE.MeshPhysicalMaterial({
    color: 0xd8ecf4, transparent: true, opacity: 0.28, roughness: 0.05,
    side: THREE.DoubleSide, depthWrite: false,
  });
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.26, 1.9, 24, 1, true), glassM);
  const cap = new THREE.Mesh(new THREE.SphereGeometry(0.26, 20, 12, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), glassM);
  cap.position.y = -0.95;
  const powder = mesh(new THREE.CapsuleGeometry(0.16, 0.62, 6, 12), mat(0x4a1f5e, { roughness: 0.95 }));
  powder.position.y = -0.5;
  powder.visible = false;
  const cotton = mesh(new THREE.SphereGeometry(0.19, 12, 10), mat(0xf5f5ee, { roughness: 1 }));
  cotton.position.y = 0.78;
  cotton.scale.y = 0.65;
  cotton.visible = false;
  inner.add(body, cap, powder, cotton);
  inner.rotation.z = -(Math.PI / 2 + 0.10);  // 口略向下倾斜(防冷凝水回流)
  chemLab.refs.tubeGlassMat = glassM;
  chemLab.refs.powder = powder;
  chemLab.refs.cotton = cotton;
  const g = new THREE.Group();
  g.add(inner);
  return g;
}

function buildAlcoholLamp() {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.SphereGeometry(0.4, 24, 16),
    new THREE.MeshPhysicalMaterial({ color: 0xcfe0ec, transparent: true, opacity: 0.5, roughness: 0.1 }));
  body.position.y = 0.34;
  body.scale.y = 0.72;
  const fuel = mesh(new THREE.SphereGeometry(0.32, 18, 12), mat(0xd88cc0, { transparent: true, opacity: 0.7 }));
  fuel.position.y = 0.3;
  fuel.scale.y = 0.55;
  const neck = mesh(new THREE.CylinderGeometry(0.09, 0.11, 0.18, 14), mat(0xaab6c2, { metalness: 0.6 }));
  neck.position.y = 0.68;
  const wick = mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.16, 8), mat(0xece8dc, { roughness: 1 }));
  wick.position.y = 0.82;
  const flame = new THREE.Mesh(new THREE.ConeGeometry(0.13, 0.5, 12),
    new THREE.MeshStandardMaterial({ color: 0xffc94d, emissive: 0xff8a00, emissiveIntensity: 1.6, transparent: true, opacity: 0.9 }));
  flame.position.y = 1.12;
  flame.visible = false;
  const flameLight = new THREE.PointLight(0xffa040, 0, 5);
  flameLight.position.y = 1.15;
  g.add(body, fuel, neck, wick, flame, flameLight);
  chemLab.refs.flame = flame;
  chemLab.refs.flameLight = flameLight;
  return g;
}

function buildDuct() {
  const curve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(-2.05, 1.80, 0),
    new THREE.Vector3(-1.0, 2.3, 0),
    new THREE.Vector3(0.8, 2.3, 0),
    new THREE.Vector3(1.75, 1.3, 0),
    new THREE.Vector3(2.05, 0.42, 0),
  ]);
  const g = new THREE.Group();
  const tube = new THREE.Mesh(new THREE.TubeGeometry(curve, 60, 0.045, 10),
    new THREE.MeshPhysicalMaterial({ color: 0xbfe3f2, transparent: true, opacity: 0.55, roughness: 0.1 }));
  g.add(tube);
  chemLab.refs.ductCurve = curve;
  return g;
}

function buildTrough() {
  const g = new THREE.Group();
  const wall = new THREE.Mesh(new THREE.BoxGeometry(2.8, 0.72, 1.6),
    new THREE.MeshPhysicalMaterial({ color: 0xcfe4ee, transparent: true, opacity: 0.25, roughness: 0.1, side: THREE.DoubleSide }));
  wall.position.set(2.4, 0.36, 0);
  const water = mesh(new THREE.BoxGeometry(2.65, 0.58, 1.45), mat(0x2e7cb8, { transparent: true, opacity: 0.5, roughness: 0.15 }));
  water.position.set(2.4, 0.33, 0);
  g.add(wall, water);
  return g;
}

function buildGasBottle() {
  const g = new THREE.Group();
  const glassM = new THREE.MeshPhysicalMaterial({
    color: 0xd8ecf4, transparent: true, opacity: 0.3, roughness: 0.05, side: THREE.DoubleSide, depthWrite: false,
  });
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 1.3, 24, 1, true), glassM);
  body.position.y = 0.77;
  const top = new THREE.Mesh(new THREE.CircleGeometry(0.42, 24).rotateX(-Math.PI / 2), glassM);
  top.position.y = 1.42;
  // 瓶内水柱:锚点在瓶口(底部),收集 O₂ 时高度缩短
  const waterGeo = new THREE.CylinderGeometry(0.37, 0.37, 1.24, 20);
  waterGeo.translate(0, 0.62, 0);
  const water = mesh(waterGeo, mat(0x2e7cb8, { transparent: true, opacity: 0.6, roughness: 0.15 }));
  water.position.y = 0.15;
  g.add(body, top, water);
  chemLab.refs.bottleWater = water;
  return g;
}

function buildSplint() {
  const g = new THREE.Group();
  const pedestal = mesh(new THREE.BoxGeometry(0.5, 0.7, 0.5), mat(0x8a6d4a));
  pedestal.position.y = 0.35;
  const stickG = new THREE.Group();
  stickG.position.y = 0.78;
  const stick = mesh(new THREE.CylinderGeometry(0.028, 0.028, 1.0, 8), mat(0xc8a878, { roughness: 0.9 }));
  stick.rotation.z = Math.PI / 2;
  const ember = mesh(new THREE.SphereGeometry(0.05, 10, 8), mat(0xff5a2a, { emissive: 0xff3a00, emissiveIntensity: 1.4 }));
  ember.position.x = -0.5;
  const sFlame = new THREE.Mesh(new THREE.ConeGeometry(0.09, 0.32, 10),
    new THREE.MeshStandardMaterial({ color: 0xffc94d, emissive: 0xff8a00, emissiveIntensity: 1.6, transparent: true, opacity: 0.9 }));
  sFlame.position.set(-0.5, 0.2, 0);
  sFlame.visible = false;
  stickG.add(stick, ember, sFlame);
  g.add(pedestal, stickG);
  chemLab.refs.stickG = stickG;
  chemLab.refs.splintFlame = sFlame;
  return g;
}

// ── 步骤引导 / 状态面板(live 数据)──
function chemStepLines() {
  const pad = a => { while (a.length < 6) a.push(''); return a; };
  switch (chemLab.step) {
    case 'check': return pad(L(
      ['第①步 查 — 检查气密性', '', '👆 点击【试管】开始检查', '看导管口是否冒气泡', '口诀: 查·装·定·点·收·离·熄'],
      ['Step ① Check the seal', '', '👆 Click the TUBE to start', 'Watch for bubbles at the duct', 'Order: check·load·fix·light·collect·withdraw·out']));
    case 'load': return pad(L(
      ['第②步 装 — 装入药品', '', '👆 点击【试管】装入高锰酸钾', '紫黑色粉末, 管口塞棉花', '想一想: 棉花是干什么的?'],
      ['Step ② Load the reagent', '', '👆 Click the TUBE to add KMnO₄', 'Dark purple powder + cotton plug', 'Think: what is the cotton for?']));
    case 'heat': return pad(L(
      ['第③步 点 — 点燃酒精灯', '', '👆 点击【酒精灯】开始加热', '先均匀预热, 再对准药品', '注意: 试管口略向下倾斜'],
      ['Step ③ Light the burner', '', '👆 Click the BURNER to heat', 'Preheat evenly, then aim at reagent', 'Note: tube mouth tilts slightly down']));
    case 'collect': return pad(L(
      ['第④步 收 — 排水法收集', '', '气泡连续均匀后开始收集', '👀 观察: 集气瓶水位下降', '瓶中的水正被 O₂ 排出'],
      ['Step ④ Collect over water', '', 'Collect once bubbles are steady', '👀 Watch: bottle water level drops', 'O₂ is pushing the water out']));
    case 'choose': return pad(L(
      ['第⑤步 ⚠ 关键抉择!', '',
        chemLab.ductRemoved ? '✔ 导管已撤出水面' : 'A. 点击【导管】先撤导管',
        chemLab.ductRemoved ? '👆 现在点击【酒精灯】熄灯' : 'B. 点击【酒精灯】先熄灯',
        '顺序做错会有后果…'],
      ['Step ⑤ ⚠ Key decision!', '',
        chemLab.ductRemoved ? '✔ Duct is out of the water' : 'A. Click the DUCT to withdraw first',
        chemLab.ductRemoved ? '👆 Now click the BURNER to put it out' : 'B. Click the BURNER to extinguish first',
        'The wrong order has consequences…']));
    case 'takeout': return pad(L(
      ['第⑥步 离 — 取出集气瓶', '', '👆 点击【集气瓶】', '水下用玻璃片盖住瓶口', '取出后翻转, 瓶口朝上'],
      ['Step ⑥ Take out the bottle', '', '👆 Click the BOTTLE', 'Cover the mouth underwater', 'Take out & flip mouth-up']));
    case 'verify': return pad(L(
      [`第${chemLab.v2 ? '⑦' : '⑥'}步 验 — 检验气体`, '', '👆 点击【木条】', '带火星的木条伸到瓶口', '复燃 → 证明是氧气!'],
      [`Step ${chemLab.v2 ? '⑦' : '⑥'} Verify the gas`, '', '👆 Click the SPLINT', 'Glowing splint at the mouth', 'Relights → it is oxygen!']));
    case 'done': return pad(L(
      ['🎉 实验成功!', '', '木条复燃, 确认收集到 O₂', '对比试管中药品颜色变化', '说"重做实验"可再来一次'],
      ['🎉 Experiment succeeded!', '', 'Splint relit — O₂ confirmed', 'Compare the reagent color change', 'Say "redo the experiment" to retry']));
    case 'fail': return pad(L(
      ['💥 实验失败: 水倒吸!', '', '先熄灯 → 管内温度骤降', '→ 气压变小 → 水被吸回', '👆 点击【试管】重做实验'],
      ['💥 Failed: water sucked back!', '', 'Extinguished first → tube cooled', '→ pressure dropped → water returned', '👆 Click the TUBE to restart']));
  }
  return pad([]);
}

function chemStatusLines() {
  const names = L(
    { check: '① 查气密性', load: '② 装药品', heat: '③ 待点燃', collect: '④ 加热收集', choose: '⑤ 收尾抉择', takeout: '⑥ 取瓶翻转', verify: chemLab.v2 ? '⑦ 验满' : '⑥ 验满', done: '✅ 成功', fail: '❌ 失败' },
    { check: '① Check seal', load: '② Load reagent', heat: '③ To light', collect: '④ Heating & collecting', choose: '⑤ Wrap-up choice', takeout: '⑥ Take out & flip', verify: chemLab.v2 ? '⑦ Verify' : '⑥ Verify', done: '✅ Success', fail: '❌ Failed' });
  const powderState = !chemLab.refs.powder?.visible ? L('未装入', 'Not loaded')
    : chemLab.progress <= 0 ? L('KMnO₄ 紫黑色', 'KMnO₄ dark purple')
    : chemLab.progress < 100 ? L('受热分解中…', 'Decomposing…') : L('残余物 墨绿+黑', 'Residue green+black');
  return [
    { k: L('当前步骤', 'Current step'), v: names[chemLab.step] || '—', c: '#7fc4ff' },
    { k: L('试管温度', 'Tube temp'), v: chemLab.temp.toFixed(0) + ' °C', c: chemLab.temp > 100 ? '#ff9a6a' : '#c8cfd8' },
    { k: L('O₂ 收集', 'O₂ collected'), v: chemLab.progress.toFixed(0) + ' %', c: '#7fe0a0' },
    { k: L('药品状态', 'Reagent'), v: powderState, c: '#e0b0ff' },
    { k: L('集气瓶', 'Gas bottle'), v: chemLab.progress <= 0 ? L('满水', 'Full of water') : chemLab.progress < 100 ? L('排水收集中', 'Collecting') : L('O₂ 已集满', 'Full of O₂'), c: '#ffe28a' },
  ];
}

// ── 搭建整个实验场景 ──
export function addLabObj(obj, x, y, z, name, icon, action, desc) {
  obj.position.set(x, y, z);
  assignOid(obj);
  obj.userData.displayName = name;
  obj.userData.icon = icon;
  if (action) obj.userData.expAction = action;
  if (desc) obj.userData.behaviorDesc = desc;   // 用途描述:检查器「📖 这是什么」+ AI 上下文/检索索引
  sceneRoot.add(obj);
  return obj;
}

export function buildOxygenLab(v2 = false) {
  clearScene();
  Object.assign(chemLab, {
    active: true, v2, step: 'check', progress: 0, temp: 20,
    lampOn: false, ductRemoved: false, checkTimer: 0,
    splintT: -1, suckT: -1, bottleT: -1, spawnAcc: 0, refs: {},
  });

  addLabObj(buildIronStand(), -4.4, 0, 0, L('铁架台', 'Iron Stand'), '🔩', undefined,
    L('实验支架:底座、立杆、横臂与圆环夹,夹持试管并使管口略向下倾斜(防冷凝水回流炸裂试管)',
      'Lab stand: base, rod, arm and clamp; holds the tube with its mouth tilted slightly down (keeps condensed water from flowing back and cracking the tube)'));
  const tube = addLabObj(buildChemTube(), -3.1, 1.85, 0, L('试管(反应容器)', 'Test Tube (reaction vessel)'), '🧪', 'tube',
    L('反应容器:装入高锰酸钾加热分解产生氧气;管口塞棉花防止粉末进入导管',
      'Reaction vessel: KMnO₄ decomposes here when heated, producing oxygen; the cotton plug keeps powder out of the duct'));
  attachLabel(tube, { width: 1.5, gap: 0.35, accent: '#48c8f0', lines: [L('🧪 试管 · 点我操作', '🧪 Tube · click to operate')] });
  const lamp = addLabObj(buildAlcoholLamp(), -3.5, 0, 0, L('酒精灯', 'Alcohol Burner'), '🔥', 'lamp',
    L('加热源:点燃后为试管加热,超过 100°C 药品开始分解产氧;收尾顺序中"熄灯"的时机是本实验的考点',
      'Heat source: heats the tube once lit; above 100°C the reagent decomposes and produces oxygen. When to extinguish it is the key point of this lab'));
  const lampLabel = attachLabel(lamp, { width: 1.3, gap: 0.35, accent: '#f0a848', lines: [L('🔥 酒精灯 · 点我', '🔥 Burner · click me')] });
  lampLabel.position.x -= 0.2;
  lampLabel.position.z += 1.0;  // 标签前移,避免挡住正上方的试管
  const duct = addLabObj(buildDuct(), 0, 0, 0, L('导管', 'Gas Duct'), '➰', 'duct',
    L('导气管:把试管中产生的氧气导入水槽中的集气瓶;实验收尾必须先把它撤出水面再熄灯',
      'Gas duct: carries oxygen from the tube into the collecting bottle in the trough; at wrap-up it must leave the water before the burner goes out'));
  chemLab.refs.duct = duct;
  attachLabel(duct, { width: 1.2, gap: 0.25, accent: '#a878f0', lines: [L('➰ 导管 · 点我', '➰ Duct · click me')] });
  addLabObj(buildTrough(), 0, 0, 0, L('水槽(排水法)', 'Water Trough (collection)'), '🌊', undefined,
    L('排水法收集装置:集气瓶倒扣在水槽中,氧气不易溶于水,会把瓶内的水逐渐排出',
      'Water-displacement setup: the bottle sits inverted in the trough; oxygen barely dissolves in water, so it gradually pushes the water out'));
  const bottle = addLabObj(buildGasBottle(), 2.9, 0, 0, L('集气瓶', 'Gas Bottle'), '🫙', v2 ? 'bottle' : undefined,
    L('收集氧气的瓶子:瓶内水位下降代表收集进度;集满后在水下盖玻璃片取出、翻转正放',
      'Collecting bottle: the dropping water level shows progress; once full, cover it underwater with a glass plate, take it out and flip it upright'));
  chemLab.refs.bottle = bottle;
  if (v2) {
    chemLab.refs.bottleLabel = attachLabel(bottle, { width: 1.7, gap: 0.3, accent: '#7fe0a0', lines: [L('🫙 集气瓶 · 收满后取出', '🫙 Bottle · take out when full')] });
  }
  const splint = addLabObj(buildSplint(), 4.8, 0, 0, L('带火星的木条', 'Glowing Splint'), '🕯', 'splint',
    L('验满工具:把带火星的木条伸到瓶口,若复燃则证明瓶内收集到的是氧气',
      'Verification tool: hold the glowing splint at the bottle mouth; if it relights, the gas is oxygen'));
  attachLabel(splint, { width: 1.4, gap: 0.3, accent: '#e5748b', lines: [L('🕯 木条 · 验满用', '🕯 Splint · for verifying')] });

  // 特效层(气泡 / 倒吸水珠),不进入场景层级
  chemLab.fx = new THREE.Group();
  scene.add(chemLab.fx);
  const bubbleMat = new THREE.MeshBasicMaterial({ color: 0xbfe8ff, transparent: true, opacity: 0.75 });
  chemLab.bubbles = [];
  for (let i = 0; i < 16; i++) {
    const b = new THREE.Mesh(new THREE.SphereGeometry(0.05, 10, 8), bubbleMat);
    b.visible = false;
    chemLab.fx.add(b);
    chemLab.bubbles.push({ m: b, active: false, maxY: 0, drift: false });
  }
  const suckBall = new THREE.Mesh(new THREE.SphereGeometry(0.075, 12, 10), mat(0x2e7cb8, { emissive: 0x1a5a8a, emissiveIntensity: 0.5 }));
  suckBall.visible = false;
  chemLab.fx.add(suckBall);
  chemLab.refs.suckBall = suckBall;

  // 教学面板
  addFreePanel({
    name: L('步骤板 · 制取氧气', 'Steps · Oxygen Prep'), title: L('📖 实验步骤引导', '📖 Experiment Steps'), accent: '#3fb96f', width: 3,
    live: chemStepLines,
  }, { x: 0, y: 4.6, z: -3 });
  addFreePanel({
    name: L('状态面板 · 实时数据', 'Status · Live Data'), title: L('📊 实时状态', '📊 Live Status'), accent: '#4a9eff', width: 2.4,
    live: chemStatusLines,
  }, { x: 7.2, y: 2.6, z: -1 });
  addFreePanel({
    name: L('原理板 · 反应方程式', 'Theory · Reaction Equation'), title: L('⚗️ 反应原理', '⚗️ Reaction Theory'), accent: '#f0a848', width: 2.9,
    lines: ['2KMnO₄ —Δ→ K₂MnO₄ + MnO₂ + O₂↑', '',
      { k: L('反应前', 'Before'), v: L('紫黑色固体', 'Dark purple solid') },
      { k: L('反应后', 'After'), v: L('墨绿+黑+O₂', 'Green+black+O₂'), c: '#7fe0a0' },
      { k: L('收集法', 'Collection'), v: L('排水法(O₂难溶)', 'Over water (O₂ insoluble)') }],
  }, { x: -7.4, y: 2.8, z: -1 });

  emit('hierarchy-changed');
}

// ── 学生点击装置 → 推进实验状态机 ──
const chemHint = s => toast('💡 ' + s);
const say = html => emit('agent-say', html);

export function handleChemAction(a) {
  const R = chemLab.refs;
  switch (chemLab.step) {
    case 'check':
      if (a === 'tube' || a === 'duct') {
        if (chemLab.checkTimer <= 0) { chemLab.checkTimer = 2.2; toast(L('🔍 双手捂住试管…看导管口冒气泡', '🔍 Warm the tube with your hands… watch for bubbles at the duct mouth')); }
      } else chemHint(L('第一步先检查气密性:点击【试管】', 'First check the seal: click the TUBE'));
      break;
    case 'load':
      if (a === 'tube') {
        R.powder.visible = true;
        R.cotton.visible = true;
        chemLab.step = 'heat';
        toast(L('🧪 已装入 KMnO₄(紫黑色)+ 管口棉花(防粉末进导管)', '🧪 KMnO₄ loaded (dark purple) + cotton plug (keeps powder out of the duct)'));
      } else chemHint(L('点击【试管】装入药品', 'Click the TUBE to load the reagent'));
      break;
    case 'heat':
      if (a === 'lamp') {
        chemLab.lampOn = true;
        chemLab.step = 'collect';
        toast(L('🔥 点燃!先预热,气泡连续均匀后开始收集', '🔥 Lit! Preheat first; collect once the bubbles are steady'));
      } else chemHint(L('点击【酒精灯】点火加热', 'Click the BURNER to light it'));
      break;
    case 'collect':
      chemHint(L('正在收集氧气…观察气泡和集气瓶水位', 'Collecting oxygen… watch the bubbles and the bottle water level'));
      break;
    case 'choose':
      if (a === 'duct') {
        if (!chemLab.ductRemoved) { chemLab.ductRemoved = true; toast(L('✔ 正确!导管撤出水面,再点【酒精灯】熄灯', '✔ Correct! Duct is out of the water — now click the BURNER to extinguish')); }
      } else if (a === 'lamp') {
        chemLab.lampOn = false;
        if (chemLab.ductRemoved) {
          chemLab.step = chemLab.v2 ? 'takeout' : 'verify';
          toast(chemLab.v2
            ? L('✔ 熄灭酒精灯。接下来:点击【集气瓶】取出并翻转', '✔ Burner out. Next: click the BOTTLE to take it out and flip it')
            : L('✔ 熄灭酒精灯。最后一步:点击【木条】验满', '✔ Burner out. Last step: click the SPLINT to verify'));
        } else {
          chemLab.suckT = 0;
          R.suckBall.visible = true;
          toast(L('⚠ 先熄灯了…盯住导管里的水!', '⚠ Extinguished first… watch the water in the duct!'));
        }
      } else chemHint(L('关键抉择:点【导管】或【酒精灯】,想好顺序', 'Key decision: click the DUCT or the BURNER — think about the order'));
      break;
    case 'takeout':
      if (a === 'bottle') {
        if (chemLab.bottleT < 0) {
          chemLab.bottleT = 0;
          R.bottleWater.visible = false;  // 离开水槽,瓶内不再有水,瓶口是敞开的
          toast(L('🖐 在水下用玻璃片盖住瓶口,取出、翻转…', '🖐 Covering the mouth underwater with a glass plate, taking it out, flipping…'));
        }
      } else chemHint(L('点击【集气瓶】把它取出水槽并翻转正放', 'Click the BOTTLE to take it out and flip it upright'));
      break;
    case 'verify':
      if (a === 'splint') { if (chemLab.splintT < 0) chemLab.splintT = 0; }
      else chemHint(L('点击【木条】,把带火星的木条伸到瓶口', 'Click the SPLINT to hold it at the bottle mouth'));
      break;
    case 'fail':
      if (a === 'tube') { buildOxygenLab(chemLab.v2); toast(L('🔄 已重置实验装置,这次注意收尾顺序!', '🔄 Apparatus reset — mind the wrap-up order this time!')); }
      else chemHint(L('试管已炸裂…点击【试管】重做实验', 'The tube cracked… click the TUBE to restart'));
      break;
    case 'done':
      chemHint(L('实验完成 🎉 对我说"重做实验"可以再来一次', 'Experiment complete 🎉 Say "redo the experiment" to run it again'));
      break;
  }
}

// ── 实验每帧更新(火焰 / 气泡 / 进度 / 倒吸 / 木条动画)──
export function chemLabUpdate(dt, t) {
  if (!chemLab.active) return;
  const R = chemLab.refs;

  // 火焰闪动
  if (R.flame) {
    R.flame.visible = chemLab.lampOn;
    R.flameLight.intensity = chemLab.lampOn ? 6 + Math.sin(t * 20) * 1.5 : 0;
    if (chemLab.lampOn) R.flame.scale.set(1 + Math.sin(t * 18) * 0.12, 1 + Math.sin(t * 23) * 0.16, 1);
  }

  // 气密性检查:短暂冒泡
  if (chemLab.step === 'check' && chemLab.checkTimer > 0) {
    chemLab.checkTimer -= dt;
    if (chemLab.checkTimer <= 0) {
      chemLab.step = 'load';
      toast(L('✔ 气密性良好!接下来装药品', '✔ Seal is good! Now load the reagent'));
    }
  }

  // 加热 → 温度上升 → 反应产气
  if (chemLab.lampOn) chemLab.temp = Math.min(240, chemLab.temp + dt * 42);
  else chemLab.temp = Math.max(20, chemLab.temp - dt * 30);

  if (chemLab.step === 'collect' && chemLab.temp > 100 && chemLab.progress < 100) {
    chemLab.progress = Math.min(100, chemLab.progress + dt * (chemLab.rate ?? 9));
    R.powder.material.color.lerpColors(POWDER_BEFORE, POWDER_AFTER, chemLab.progress / 100);
    R.bottleWater.scale.y = Math.max(0.02, 1 - chemLab.progress / 100);
    if (chemLab.progress >= 100) {
      chemLab.step = 'choose';
      toast(L('🫙 集气瓶已收集满氧气!', '🫙 The bottle is full of oxygen!'));
      say(L('🫙 <b>集气瓶集满了!</b>现在到实验最关键的收尾抉择:\n\nA. 点击【导管】—— 先把导管撤出水面\nB. 点击【酒精灯】—— 先熄灭酒精灯\n\n先做哪个?顺序做错是有后果的哦 😏',
        '🫙 <b>The bottle is full!</b> Now for the most critical wrap-up decision:\n\nA. Click the DUCT — withdraw it from the water first\nB. Click the BURNER — extinguish it first\n\nWhich comes first? The wrong order has consequences 😏'));
    }
  }

  // 气泡生成与上升
  chemLab.spawnAcc += dt;
  const spawning = (chemLab.step === 'check' && chemLab.checkTimer > 0)
    || (chemLab.step === 'collect' && chemLab.temp > 100 && chemLab.progress < 100);
  if (spawning && chemLab.spawnAcc > 0.13) {
    chemLab.spawnAcc = 0;
    const b = chemLab.bubbles.find(x => !x.active);
    if (b) {
      b.active = true;
      b.m.visible = true;
      b.m.position.set(2.05 + (Math.random() - 0.5) * 0.08, 0.42, (Math.random() - 0.5) * 0.08);
      b.maxY = chemLab.step === 'check' ? 0.6 : 1.15;
      b.drift = chemLab.step !== 'check';
      b.m.scale.setScalar(0.6 + Math.random() * 0.7);
    }
  }
  chemLab.bubbles.forEach(b => {
    if (!b.active) return;
    b.m.position.y += dt * 0.85;
    if (b.drift) b.m.position.x += (2.9 - b.m.position.x) * dt * 2.4;
    if (b.m.position.y >= b.maxY) { b.active = false; b.m.visible = false; }
  });

  // 撤导管动画
  if (chemLab.ductRemoved && R.duct && R.duct.position.y < 0.9) {
    R.duct.position.y = Math.min(0.9, R.duct.position.y + dt * 1.1);
  }

  // 错误分支:水沿导管倒吸 → 试管炸裂
  if (chemLab.suckT >= 0) {
    chemLab.suckT += dt * 0.4;
    const k = 1 - Math.min(chemLab.suckT, 1);
    R.suckBall.position.copy(R.ductCurve.getPointAt(k));
    if (chemLab.suckT >= 1) {
      chemLab.suckT = -1;
      R.suckBall.visible = false;
      R.tubeGlassMat.color.set(0xff8a8a);
      R.tubeGlassMat.opacity = 0.5;
      chemLab.step = 'fail';
      toast(L('💥 冷水倒吸进灼热的试管——炸裂了!', '💥 Cold water sucked back into the hot tube — it cracked!'));
      say(L('💥 <b>实验失败:水倒吸,试管炸裂!</b>\n\n复盘一下原因:先熄灭了酒精灯 → 试管内温度骤降 → 气压变小 → 水槽里的水沿导管被"吸"回试管 → 冷水碰到灼热的玻璃,炸裂。\n\n✅ 正确顺序是:<b>先把导管撤出水面,再熄灭酒精灯</b>("离"在"熄"前)。\n\n点击【试管】重做实验,这次走对顺序试试。',
        '💥 <b>Experiment failed: water sucked back, tube cracked!</b>\n\nWhat happened: the burner went out first → the tube cooled rapidly → pressure dropped → water was "sucked" back up the duct → cold water hit hot glass and it cracked.\n\n✅ The correct order: <b>withdraw the duct from the water first, then extinguish the burner</b>.\n\nClick the TUBE to redo the experiment — try the right order this time.'));
    }
  }

  // v2 修正流程:集气瓶取出水槽 → 弧线上升 → 翻转正放(瓶口朝上)
  if (chemLab.bottleT >= 0) {
    chemLab.bottleT += dt;
    const k = Math.min(chemLab.bottleT / 1.7, 1);
    const s = k * k * (3 - 2 * k);  // smoothstep
    R.bottle.position.set(
      2.9 + (4.2 - 2.9) * s,
      1.42 * s + Math.sin(s * Math.PI) * 0.7,
      0.8 * s
    );
    R.bottle.rotation.z = Math.PI * s;
    if (k >= 1) {
      chemLab.bottleT = -1;
      chemLab.step = 'verify';
      if (R.bottleLabel) {
        R.bottleLabel.position.y = -0.65;
        R.bottleLabel.userData.panelData.lines = [L('🫙 瓶口朝上 · 点【木条】验满', '🫙 Mouth up · click the SPLINT')];
        drawPanel(R.bottleLabel.userData.panelData);
      }
      toast(L('✔ 集气瓶已翻转正放、瓶口朝上!点击【木条】验满', '✔ Bottle flipped upright, mouth up! Click the SPLINT to verify'));
    }
  }

  // 木条验满动画:移到瓶口 → 复燃
  if (chemLab.splintT >= 0) {
    chemLab.splintT += dt;
    const k = Math.min(chemLab.splintT / 1.3, 1);
    const splintTarget = chemLab.v2
      ? new THREE.Vector3(-0.1, 1.55, 0.8)   // 修正版:翻转后朝上的瓶口正上方
      : new THREE.Vector3(-1.4, 1.85, 0);     // 旧版(有意保留的错误):水槽里的瓶底
    R.stickG.position.lerpVectors(new THREE.Vector3(0, 0.78, 0), splintTarget, k);
    if (k >= 1) {
      chemLab.splintT = -1;
      R.splintFlame.visible = true;
      if (chemLab.step === 'verify') {
        chemLab.step = 'done';
        toast(L('🎉 木条复燃!收集到的是氧气!', '🎉 The splint relit! The gas is oxygen!'));
        say(L('🎉 <b>带火星的木条复燃了——证明收集到的是氧气!</b>\n\n实验前后的产物对比:\n· 反应前:KMnO₄ <b>紫黑色</b>固体\n· 反应后:K₂MnO₄(墨绿)+ MnO₂(黑色)+ O₂(无色气体,助燃)\n\n凑近看试管,粉末颜色已经变深了。\n\n💡 建议让学生说"重做实验",故意走一次错误分支(先熄灯)——"炸"一次试管,比讲十遍都印象深刻。',
          '🎉 <b>The glowing splint relit — proof that the gas is oxygen!</b>\n\nBefore vs after:\n· Before: KMnO₄, a <b>dark purple</b> solid\n· After: K₂MnO₄ (dark green) + MnO₂ (black) + O₂ (colorless gas, supports combustion)\n\nLook closely at the tube — the powder has darkened.\n\n💡 Tip: have students say "redo the experiment" and deliberately take the wrong branch (extinguish first) — cracking one tube teaches more than ten explanations.'));
      }
    }
  }
}
