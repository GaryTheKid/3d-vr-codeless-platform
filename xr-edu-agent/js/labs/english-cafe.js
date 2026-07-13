// ═══════════════════════════════════════════════════════════════
//  英语口语项目:餐厅点餐 · 数字人对话
//  演示版:检测麦克风音量即视为"学生开口说英语",触发数字人回应
//  未来 TODO:接入 STT/TTS + LLM 实现自由对话
// ═══════════════════════════════════════════════════════════════
import * as THREE from 'three';
import { mat, mesh, toast } from '../core/utils.js';
import { sceneRoot } from '../core/three-setup.js';
import { assignOid } from '../core/state.js';
import { emit } from '../core/events.js';
import { clearScene, onSceneClear, addAsset } from '../scene/manager.js';
import { attachLabel, addFreePanel } from '../panels/panel3d.js';
import { addLabObj } from './chem-oxygen.js';
import { L, isEN } from '../core/i18n.js';

export const engLab = {
  active: false, idx: 0, state: 'talk', timer: 0,
  voiceAcc: 0, micLevel: 0, threshold: 0.055, refs: {},
};

onSceneClear(() => { engLab.active = false; });

// 麦克风(仅测音量,不做真实语音识别)
export const mic = { ready: false, denied: false, analyser: null, buf: null };

async function initMic() {
  if (mic.ready || mic.denied) return;
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const actx = new (window.AudioContext || window.webkitAudioContext)();
    if (actx.state === 'suspended') actx.resume();
    const src = actx.createMediaStreamSource(stream);
    mic.analyser = actx.createAnalyser();
    mic.analyser.fftSize = 512;
    mic.buf = new Uint8Array(mic.analyser.fftSize);
    src.connect(mic.analyser);
    mic.ready = true;
    toast(L('🎤 麦克风已就绪,轮到你时开口说英语即可', '🎤 Microphone ready — speak English when it is your turn'));
  } catch (e) {
    mic.denied = true;
    toast(L('⚠ 麦克风不可用,可以点击服务员代替说话', '⚠ Microphone unavailable — click the waiter instead of speaking'));
  }
}

// 对话剧本
const ENG_SCRIPT = [
  { lines: ['Hi there! Welcome to', 'VR Cafe! 👋'], zh: '嗨!欢迎来到 VR 咖啡馆!', dur: 3 },
  { lines: ['What would you like', 'to order?'], zh: '你想点些什么呢?', hint: L("试着说: I'd like a burger, please.", "Try saying: I'd like a burger, please."), dur: 2.5, listen: true },
  { lines: ['Great choice!', 'One burger coming up! 🍔'], zh: '好眼光!一个汉堡马上来!', dur: 3.5, spawn: 'burger' },
  { lines: ['Anything to drink', 'with that?'], zh: '要配点喝的吗?', hint: L('试着说: A cola, please.', 'Try saying: A cola, please.'), dur: 2.5, listen: true },
  { lines: ['Sure! One cola.', "That'll be $8.50. 🥤"], zh: '好的!一杯可乐,一共 8.5 美元。', dur: 3.5, spawn: 'cola' },
  { lines: ['Here you go!', 'Enjoy your meal! 😊'], zh: '请慢用!', dur: 3, end: true },
];

// ── 数字人服务员(程序化小人)──
function buildWaiter() {
  const g = new THREE.Group();
  const skin = mat(0xf0c8a0, { roughness: 0.7 });
  const uniform = mat(0x2f4858);
  const body = mesh(new THREE.CapsuleGeometry(0.34, 0.75, 8, 16), uniform);
  body.position.y = 1.05;
  const apron = mesh(new THREE.CylinderGeometry(0.37, 0.41, 0.55, 16), mat(0xe8eaf0, { roughness: 0.8 }));
  apron.position.y = 0.92;
  apron.scale.z = 0.85;
  const head = new THREE.Group();
  head.position.y = 1.82;
  const skull = mesh(new THREE.SphereGeometry(0.27, 24, 18), skin);
  const eyeL = mesh(new THREE.SphereGeometry(0.045, 10, 8), mat(0x22262c));
  eyeL.position.set(-0.09, 0.05, 0.24);
  const eyeR = eyeL.clone();
  eyeR.position.x = 0.09;
  const mouth = mesh(new THREE.BoxGeometry(0.1, 0.028, 0.02), mat(0xa04030));
  mouth.position.set(0, -0.1, 0.255);
  const hat = mesh(new THREE.CylinderGeometry(0.17, 0.21, 0.26, 16), mat(0xf5f5f0, { roughness: 0.9 }));
  hat.position.y = 0.32;
  head.add(skull, eyeL, eyeR, mouth, hat);
  const armL = mesh(new THREE.CapsuleGeometry(0.07, 0.5, 6, 10), uniform);
  armL.position.set(-0.44, 1.2, 0);
  armL.rotation.z = 0.25;
  // 右臂挂在肩部枢轴上,便于做挥手动画
  const armR = new THREE.Group();
  armR.position.set(0.44, 1.42, 0);
  const armRm = mesh(new THREE.CapsuleGeometry(0.07, 0.5, 6, 10), uniform);
  armRm.position.y = -0.28;
  const hand = mesh(new THREE.SphereGeometry(0.08, 12, 10), skin);
  hand.position.y = -0.58;
  armR.add(armRm, hand);
  g.add(body, apron, head, armL, armR);
  engLab.refs.waiterRoot = g;
  engLab.refs.head = head;
  engLab.refs.mouth = mouth;
  engLab.refs.armR = armR;
  return g;
}

function buildCounter() {
  const g = new THREE.Group();
  const base = mesh(new THREE.BoxGeometry(3.4, 1.05, 0.85), mat(0x6a4a32, { roughness: 0.8 }));
  base.position.y = 0.525;
  const top = mesh(new THREE.BoxGeometry(3.6, 0.07, 1.0), mat(0xc8a878, { roughness: 0.4 }));
  top.position.y = 1.09;
  g.add(base, top);
  return g;
}

function buildBurger() {
  const g = new THREE.Group();
  const bunBottom = mesh(new THREE.CylinderGeometry(0.27, 0.24, 0.1, 20), mat(0xe0a050, { roughness: 0.8 }));
  bunBottom.position.y = 0.05;
  const patty = mesh(new THREE.CylinderGeometry(0.28, 0.28, 0.09, 20), mat(0x5e3520, { roughness: 0.95 }));
  patty.position.y = 0.15;
  const cheese = mesh(new THREE.BoxGeometry(0.5, 0.025, 0.5), mat(0xf5c542, { roughness: 0.6 }));
  cheese.position.y = 0.21;
  cheese.rotation.y = 0.4;
  const lettuce = mesh(new THREE.CylinderGeometry(0.29, 0.29, 0.045, 20), mat(0x5cae4a, { roughness: 0.9 }));
  lettuce.position.y = 0.25;
  const bunTop = mesh(new THREE.SphereGeometry(0.27, 20, 14, 0, Math.PI * 2, 0, Math.PI / 2), mat(0xe8b060, { roughness: 0.8 }));
  bunTop.position.y = 0.28;
  bunTop.scale.y = 0.75;
  g.add(bunBottom, patty, cheese, lettuce, bunTop);
  return g;
}

function buildCola() {
  const g = new THREE.Group();
  const cup = mesh(new THREE.CylinderGeometry(0.11, 0.14, 0.42, 18), mat(0xc23a3a, { roughness: 0.4 }));
  cup.position.y = 0.21;
  const lid = mesh(new THREE.CylinderGeometry(0.125, 0.125, 0.03, 18), mat(0xf2f4f8));
  lid.position.y = 0.435;
  const straw = mesh(new THREE.CylinderGeometry(0.014, 0.014, 0.3, 8), mat(0xf2f4f8));
  straw.position.set(0.04, 0.56, 0);
  straw.rotation.z = -0.18;
  g.add(cup, lid, straw);
  return g;
}

function spawnFood(kind) {
  const isBurger = kind === 'burger';
  const food = isBurger ? buildBurger() : buildCola();
  food.position.set(isBurger ? -0.6 : 0.6, 1.13, -1.55);
  assignOid(food);
  food.userData.displayName = isBurger ? L('汉堡 Burger', 'Burger') : L('可乐 Cola', 'Cola');
  food.userData.icon = isBurger ? '🍔' : '🥤';
  sceneRoot.add(food);
  emit('hierarchy-changed');
  toast(isBurger ? L('🍔 汉堡端上柜台了!', '🍔 Burger is on the counter!') : L('🥤 可乐来了!', '🥤 Here comes the cola!'));
}

// ── 对话面板(live)──
function engDialogLines() {
  const e = ENG_SCRIPT[engLab.idx] || ENG_SCRIPT[ENG_SCRIPT.length - 1];
  const bars = Math.max(0, Math.min(12, Math.round(engLab.micLevel * 170)));
  const micLine = mic.ready ? '🎙 ' + '▮'.repeat(bars) + '▯'.repeat(12 - bars)
    : L('⚠ 无麦克风: 点击服务员代替说话', '⚠ No mic: click the waiter to "speak"');
  const status = engLab.state === 'listen' ? L('🎤 到你了! 对麦克风开口说英语', '🎤 Your turn! Speak into the mic')
    : engLab.state === 'think' ? L('🤔 AI 正在理解你说的话…', '🤔 The AI is processing what you said…')
    : engLab.state === 'done' ? L('🎉 对话完成! 说"重新对话"再来', '🎉 Done! Say "restart the dialogue" to retry')
    : L('💬 服务员 Alex 正在说话…', '💬 Waiter Alex is speaking…');
  return [
    '👨‍🍳 ' + e.lines[0],
    '     ' + (e.lines[1] || ''),
    isEN() ? '' : '🀄 ' + e.zh,   // 英文界面下不再显示中文翻译行
    '',
    engLab.state === 'listen' && e.hint ? '💡 ' + e.hint : '',
    status,
    micLine,
  ];
}

// ── 搭建餐厅场景 ──
export function buildEnglishCafe() {
  clearScene();
  Object.assign(engLab, { active: true, idx: 0, state: 'talk', timer: 0, voiceAcc: 0, micLevel: 0, refs: {} });
  initMic();

  addLabObj(buildCounter(), 0, 0, -2, L('餐厅柜台', 'Cafe Counter'), '🏪', undefined,
    L('点餐柜台:场景布景,台面上会随对话进度出现汉堡和可乐',
      'Ordering counter: scene prop; the burger and cola appear on it as the dialogue progresses'));
  const waiter = addLabObj(buildWaiter(), 0, 0, -3.05, L('数字人服务员 Alex', 'Digital Waiter Alex'), '👨‍🍳', 'npc',
    L('英语对话数字人:按点餐剧本与学生轮流对话,学生对麦克风开口(或点击他)推进对话',
      'English dialogue digital human: takes turns with the student following the ordering script; speaking into the mic (or clicking him) advances the dialogue'));
  attachLabel(waiter, { width: 2.0, gap: 0.35, accent: '#f0a848', lines: [L('👨‍🍳 服务员 Alex · 点我说话', '👨‍🍳 Waiter Alex · click to talk')] });

  const t1 = addAsset('desk', { x: -3.8, z: 1.8 }, true);
  t1.userData.displayName = L('餐桌 A', 'Table A');
  const t2 = addAsset('desk', { x: 3.8, z: 1.8 }, true);
  t2.userData.displayName = L('餐桌 B', 'Table B');

  addFreePanel({
    name: L('菜单板 · VR Cafe', 'Menu · VR Cafe'), title: '📜 VR Cafe · MENU', accent: '#f0a848', width: 2.4,
    lines: [
      { k: L('Burger 汉堡', 'Burger'), v: '$6.00' },
      { k: L('Cola 可乐', 'Cola'), v: '$2.50' },
      { k: L('Fries 薯条', 'Fries'), v: '$3.00' },
      { k: L('Salad 沙拉', 'Salad'), v: '$4.00' },
    ],
  }, { x: -4.3, y: 3.1, z: -2.8 });
  addFreePanel({
    name: L('对话面板 · Conversation', 'Dialogue Panel'), title: L('💬 对话 Conversation', '💬 Conversation'), accent: '#4a9eff', width: 3.4,
    live: engDialogLines,
  }, { x: 0, y: 4.0, z: -3.4 });
  addFreePanel({
    name: L('句型提示板', 'Sentence Patterns'), title: L('🗣 常用句型', '🗣 Useful Patterns'), accent: '#3fb96f', width: 2.6,
    lines: ["I'd like a …, please.", 'Can I have a …?', 'How much is it?', 'Thank you very much!'],
  }, { x: 4.5, y: 3.1, z: -2.8 });

  emit('hierarchy-changed');
}

// ── 对话状态机 ──
function engHeard() {
  engLab.state = 'think';
  engLab.timer = 0;
  toast(L('🎤 听到你说英语啦!AI 理解中…', '🎤 Heard you! The AI is processing…'));
}

function engAdvance() {
  engLab.idx = Math.min(engLab.idx + 1, ENG_SCRIPT.length - 1);
  engLab.state = 'talk';
  engLab.timer = 0;
  const e = ENG_SCRIPT[engLab.idx];
  if (e.spawn) spawnFood(e.spawn);
}

export function handleEngAction(a) {
  if (a !== 'npc') return;
  if (engLab.state === 'listen') engHeard();
  else if (engLab.state === 'done') toast(L('🎉 对话已完成,对我说"重新对话"可以再来一次', '🎉 Dialogue complete — say "restart the dialogue" to go again'));
  else toast(L('💬 先听 Alex 说完,轮到你时再开口(或再点我)', "💬 Let Alex finish first — speak (or click me) when it's your turn"));
}

export function engLabUpdate(dt, t) {
  if (!engLab.active) return;
  const R = engLab.refs;
  if (!R.waiterRoot) return;

  // 麦克风音量(RMS 近似)
  if (mic.ready && mic.analyser) {
    mic.analyser.getByteTimeDomainData(mic.buf);
    let sum = 0;
    for (let i = 0; i < mic.buf.length; i++) sum += Math.abs(mic.buf[i] - 128);
    engLab.micLevel = sum / mic.buf.length / 128;
  }

  // 数字人待机呼吸
  R.waiterRoot.position.y = Math.sin(t * 1.8) * 0.025;
  const talking = engLab.state === 'talk';
  R.mouth.scale.y = talking ? 1 + Math.abs(Math.sin(t * 13)) * 2.4 : 1;
  R.head.rotation.x = talking ? Math.sin(t * 5) * 0.06 : 0;
  R.head.rotation.z = engLab.state === 'listen' ? 0.15 : 0;
  if (talking && engLab.idx === 0) R.armR.rotation.z = 2.5 + Math.sin(t * 7) * 0.35;      // 打招呼挥手
  else if (engLab.state === 'listen') R.armR.rotation.z = 0.9 + Math.sin(t * 2) * 0.05;   // 摊手示意"请讲"
  else R.armR.rotation.z = 0.15;

  const entry = ENG_SCRIPT[engLab.idx];
  switch (engLab.state) {
    case 'talk':
      engLab.timer += dt;
      if (engLab.timer >= entry.dur) {
        if (entry.listen) { engLab.state = 'listen'; engLab.voiceAcc = 0; }
        else if (entry.end) engLab.state = 'done';
        else engAdvance();
      }
      break;
    case 'listen':
      if (mic.ready && engLab.micLevel > (engLab.threshold ?? 0.055)) engLab.voiceAcc += dt;
      else engLab.voiceAcc = Math.max(0, engLab.voiceAcc - dt * 0.6);
      if (engLab.voiceAcc > 0.35) engHeard();
      break;
    case 'think':
      engLab.timer += dt;
      if (engLab.timer >= 1.4) engAdvance();
      break;
  }
}
