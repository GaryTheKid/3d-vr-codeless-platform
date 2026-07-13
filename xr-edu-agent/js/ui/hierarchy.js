// ═══════════════════════════════════════════════════════════════
//  场景层级面板 + 自然语言组件 Inspector(类 Unity Inspector,但老师能看懂)
//  · 每个对象展开后显示它绑定的"组件":自然语言描述,可开关、可编辑
//  · 虚拟对象(相机/灯光/控制器):默认收起,降低认知负担
//  · 选中即上下文:行点击=选中(Shift 多选),选中集合自动进入 Agent 对话上下文
//  编辑解析:离线做轻量正则解析;LLM 模式下交给 Agent 理解
// ═══════════════════════════════════════════════════════════════
import { sceneRoot, orbit, dirLight } from '../core/three-setup.js';
import { state } from '../core/state.js';
import { on, emit } from '../core/events.js';
import { toast } from '../core/utils.js';
import { L, t } from '../core/i18n.js';
import { select, removeObject, getMainColor, setMainColor, COLOR_WORDS } from '../scene/manager.js';
import { chemLab } from '../labs/chem-oxygen.js';
import { engLab } from '../labs/english-cafe.js';
import { dispatchInteraction } from '../core/interaction.js';
import { locomotion, configureLocomotion, locomotionDesc } from '../core/locomotion.js';
import { record } from '../core/history.js';

const hierarchyList = document.getElementById('hierarchy-list');
const hierarchyEmpty = document.getElementById('hierarchy-empty');
const virtualHead = document.getElementById('virtual-head');
const virtualListEl = document.getElementById('virtual-list');

const expandedObjs = new Set();      // 已展开的场景对象 uuid
const expandedVirtual = new Set();   // 已展开的虚拟对象 id
let virtualOpen = false;             // 虚拟对象区默认收起
const virtOv = {};                   // 虚拟组件的自定义描述

export const ACTION_DESC = {
  tube: L('学生点击时:按实验步骤响应 — 检查气密性 / 装入药品;实验失败后点击可重置装置',
    'On student click: responds per experiment step — seal check / load reagent; after a failure, click to reset the apparatus'),
  lamp: L('学生点击时:点燃或熄灭酒精灯;点燃后试管升温,驱动分解反应产生氧气',
    'On student click: lights or extinguishes the burner; heating the tube drives the decomposition that produces oxygen'),
  duct: L('学生点击时:在收尾阶段把导管撤出水面(正确收尾顺序的关键一步)',
    'On student click: withdraws the tube from the water during wrap-up (the key step of the correct ending order)'),
  bottle: L('学生点击时:用玻璃片盖住瓶口,将集气瓶取出水槽并翻转正放(瓶口朝上)',
    'On student click: covers the mouth with a glass plate, lifts the bottle out and flips it upright (mouth up)'),
  splint: L('学生点击时:把带火星的木条伸到瓶口;若瓶内是氧气,木条复燃',
    'On student click: brings the glowing splint to the bottle mouth; if the gas is oxygen, it relights'),
  npc: L('学生点击时:代替麦克风输入,视为"学生开口说了英语",推进对话流程',
    'On student click: substitutes for microphone input — counts as "the student spoke" and advances the dialogue'),
};

export function animDesc(a) {
  switch (a.type) {
    case 'spin': return L(`持续自转:绕自身竖直轴旋转,速度 ${a.speed} rad/s`,
      `Continuous spin around its vertical axis at ${a.speed} rad/s`);
    case 'orbit': return L(`公转:绕中心点 (${a.cx}, ${a.cz}) 做半径 ${a.radius} 米的圆周运动,速度 ${a.speed} rad/s`,
      `Orbit: circles center (${a.cx}, ${a.cz}) at radius ${a.radius} m, speed ${a.speed} rad/s`);
    case 'swing': return L(`来回摆动:角频率 ${(+a.speed).toFixed(2)} rad/s(由 T=2π√(L/g) 算出),最大摆角 ${a.amplitude} rad`,
      `Pendulum swing: angular frequency ${(+a.speed).toFixed(2)} rad/s (from T=2π√(L/g)), max angle ${a.amplitude} rad`);
    case 'float': return L(`上下悬浮飘动,频率 ${a.speed}`, `Hovers up and down, frequency ${a.speed}`);
    case 'bounce': return L(`弹簧压缩-回弹循环运动,频率 ${a.speed}`, `Spring compress-rebound cycle, frequency ${a.speed}`);
    case 'ramp': return L(`小球沿斜面循环滚落演示,速度 ${a.speed}`, `Ball repeatedly rolls down the ramp, speed ${a.speed}`);
    default: return L('自定义动画行为', 'Custom animation behavior');
  }
}

function parseAnimText(a, text) {
  let hit = false;
  const rad = text.match(/(?:半径|radius)[::]?\s*(-?\d+\.?\d*)/i);
  if (rad && a.radius !== undefined) { a.radius = +rad[1]; hit = true; }
  const amp = text.match(/(?:摆角|振幅|amplitude|angle)[::]?\s*(-?\d+\.?\d*)/i);
  if (amp && a.amplitude !== undefined) { a.amplitude = +amp[1]; hit = true; }
  const sp = text.match(/(?:速度|角?频率|speed|frequency)[::]?\s*(-?\d+\.?\d*)/i);
  if (sp) { a.speed = +sp[1]; hit = true; }
  else if (!hit) {
    const nums = text.match(/-?\d+\.?\d*/g);
    if (nums) { a.speed = +nums[0]; hit = true; }
  }
  toast(hit ? L('✔ 已解析你的描述,动画参数已更新', '✔ Parsed — animation parameters updated')
    : L('📝 已记录(没找到可解析的数字)', '📝 Noted (no parsable number found)'));
}

// 从对象状态派生出自然语言组件列表
export function getObjectComponents(obj) {
  const ud = obj.userData;
  ud.compDesc = ud.compDesc || {};
  const ov = id => ud.compDesc[id];
  const mkEdit = (id, parser) => text => {
    ud.compDesc[id] = text;
    if (parser) parser(text);
    else toast(L('📝 已记录你的修改', '📝 Your edit has been noted'));
  };
  const comps = [];

  comps.push({
    id: 'transform', icon: '📐', title: L('变换 · Transform', 'Transform'),
    desc: ov('transform') ?? L(
      `位于坐标 (${obj.position.x.toFixed(1)}, ${obj.position.y.toFixed(1)}, ${obj.position.z.toFixed(1)}),整体缩放 ${obj.scale.x.toFixed(1)} 倍`,
      `At (${obj.position.x.toFixed(1)}, ${obj.position.y.toFixed(1)}, ${obj.position.z.toFixed(1)}), uniform scale ${obj.scale.x.toFixed(1)}×`),
    onEdit: mkEdit('transform', text => {
      const nums = text.match(/-?\d+\.?\d*/g);
      if (nums && nums.length >= 3) {
        obj.position.set(+nums[0], +nums[1], +nums[2]);
        if (nums[3]) obj.scale.setScalar(Math.max(0.1, +nums[3]));
        delete ud.compDesc.transform;
        toast(L('✔ 已按你的描述移动/缩放对象', '✔ Moved/scaled the object as described'));
        if (obj === state.selected) emit('transform-changed');
      } else toast(L('📝 已记录(需要至少 3 个坐标数字才能移动)', '📝 Noted (need at least 3 coordinate numbers to move)'));
    }),
  });

  comps.push({
    id: 'look', icon: '🎨', title: L('外观 · Appearance', 'Appearance'),
    desc: ov('look') ?? L(
      `主体颜色 #${getMainColor(obj).getHexString()};由资源「${ud.icon || '🧊'} ${ud.displayName}」程序化生成`,
      `Main color #${getMainColor(obj).getHexString()}; procedurally generated from asset "${ud.icon || '🧊'} ${ud.displayName}"`),
    onEdit: mkEdit('look', text => {
      for (const [w, hex] of Object.entries(COLOR_WORDS)) {
        if (text.toLowerCase().includes(w)) {
          setMainColor(obj, hex);
          delete ud.compDesc.look;
          toast(L(`✔ 颜色已改为${w}色`, `✔ Color changed to ${w}`));
          if (obj === state.selected) emit('selection-changed');
          return;
        }
      }
      toast(L('📝 已记录(未识别到颜色词)', '📝 Noted (no color word recognized)'));
    }),
  });

  const anim = ud.anim || ud.savedAnim;
  if (anim) {
    comps.push({
      id: 'anim', icon: '🔁', title: L('行为 · 动画', 'Behavior · Animation'),
      toggled: !!ud.anim,
      onToggle: v => {
        if (v) { ud.anim = ud.savedAnim || anim; delete ud.savedAnim; toast(L('▶ 动画已启用', '▶ Animation enabled')); }
        else { ud.savedAnim = ud.anim; delete ud.anim; toast(L('⏸ 动画已停用', '⏸ Animation disabled')); }
      },
      desc: ov('anim') ?? animDesc(anim),
      onEdit: mkEdit('anim', text => { parseAnimText(anim, text); delete ud.compDesc.anim; }),
    });
  }

  const action = ud.expAction || ud.savedExpAction;
  if (action) {
    comps.push({
      id: 'act', icon: '🖱', title: L('触发器 · 学生可操作', 'Trigger · Student-operable'),
      toggled: !!ud.expAction,
      onToggle: v => {
        if (v) { ud.expAction = ud.savedExpAction; delete ud.savedExpAction; toast(L('✔ 学生交互已启用', '✔ Student interaction enabled')); }
        else { ud.savedExpAction = ud.expAction; delete ud.expAction; toast(L('⏸ 交互已禁用,学生点击此对象将无响应', '⏸ Interaction disabled — student clicks will do nothing')); }
      },
      desc: ov('act') ?? (ACTION_DESC[action] || L('学生点击时触发自定义逻辑', 'Triggers custom logic on student click')),
      onEdit: mkEdit('act'),
      // ▶ 手动触发一次,预览学生点击这个对象会发生什么(交互被停用时也可预览)
      onPlay: () => {
        const saved = !ud.expAction && ud.savedExpAction;
        if (saved) ud.expAction = ud.savedExpAction;
        dispatchInteraction(obj, 'activate', { preview: true });
        if (saved) delete ud.expAction;
      },
    });
  }

  // AI 编写的自定义逻辑(create_custom_object / set_behavior 生成)
  const hasScript = ud.customUpdate || ud.customClick || ud.savedCustomUpdate || ud.savedCustomClick
    || ud.onActivate || ud.onGrab || ud.onDrag;
  if (hasScript || (ud.custom && ud.behaviorDesc)) {
    const active = !!(ud.customUpdate || ud.customClick || ud.onActivate || ud.onGrab);
    const clickable = ud.customClick || ud.savedCustomClick || ud.onActivate;
    comps.push({
      id: 'script', icon: '🧠', title: L('自定义逻辑 · AI 生成', 'Custom Logic · AI-generated'),
      toggled: active,
      onToggle: v => {
        if (v) {
          if (ud.savedCustomUpdate) { ud.customUpdate = ud.savedCustomUpdate; delete ud.savedCustomUpdate; }
          if (ud.savedCustomClick) { ud.customClick = ud.savedCustomClick; delete ud.savedCustomClick; }
          toast(L('✔ 自定义逻辑已启用', '✔ Custom logic enabled'));
        } else {
          if (ud.customUpdate) { ud.savedCustomUpdate = ud.customUpdate; delete ud.customUpdate; }
          if (ud.customClick) { ud.savedCustomClick = ud.customClick; delete ud.customClick; }
          toast(L('⏸ 自定义逻辑已停用', '⏸ Custom logic disabled'));
        }
      },
      desc: ov('script') ?? (ud.behaviorDesc || L('由 AI 编写的自定义行为(动画 / 学生交互)', 'Custom behavior written by AI (animation / student interaction)')),
      onEdit: mkEdit('script'),
      // ▶ 预览触发器:停用状态下也可手动跑一次点击逻辑
      onPlay: clickable ? () => {
        const fn = ud.onActivate || ud.customClick || ud.savedCustomClick;
        try { fn(obj, { preview: true }); }
        catch (err) { toast(L(`⚠ 交互脚本出错:${err.message}`, `⚠ Interaction script error: ${err.message}`)); }
      } : undefined,
    });
  }

  const panels = [];
  obj.traverse(o => { if (o.userData.panelData) panels.push(o); });
  if (panels.length) {
    const hasLive = panels.some(p => p.userData.panelData.live);
    comps.push({
      id: 'panel', icon: '🏷', title: L('教学面板 · UI', 'Teaching Panels · UI'),
      toggled: panels.some(p => p.visible),
      onToggle: v => { panels.forEach(p => p.visible = v); toast(v ? L('✔ 面板已显示', '✔ Panels shown') : L('🙈 面板已隐藏', '🙈 Panels hidden')); },
      desc: ov('panel') ?? L(
        `${panels.length} 块悬浮教学面板,始终面向学生视角${hasLive ? ';含实时数据,每 0.15 秒自动刷新' : ''}`,
        `${panels.length} floating teaching panel(s), always facing the student${hasLive ? '; includes live data refreshed every 0.15 s' : ''}`),
      onEdit: mkEdit('panel'),
    });
  }
  return comps;
}

// 虚拟对象(控制器/系统):不在场景里,但决定运行逻辑
export function getVirtualObjects() {
  const wrap = (vid, comps) => comps.map(c => ({
    ...c,
    desc: virtOv[vid + '.' + c.id] ?? c.desc,
    onEdit: text => {
      const handled = c.onEdit ? c.onEdit(text) : false;
      if (handled) delete virtOv[vid + '.' + c.id];
      else {
        virtOv[vid + '.' + c.id] = text;
        if (!c.onEdit) toast(L('📝 已记录你的修改', '📝 Your edit has been noted'));
      }
    },
  }));
  const list = [];
  list.push({
    id: 'camera', icon: '🎥', name: L('主摄像机', 'Main Camera'), comps: wrap('camera', [{
      id: 'orbitctl', icon: '🕹', title: L('视角控制器', 'View Controller'),
      toggled: orbit.enabled,
      onToggle: v => { orbit.enabled = v; toast(v ? L('✔ 视角控制已启用', '✔ View control enabled') : L('🔒 视角已锁定', '🔒 View locked')); },
      desc: L('编辑视角控制(旋转 / 平移 / 缩放);关闭后镜头锁定', 'Editor view control (orbit / pan / zoom); camera locks when off'),
    }]),
  });
  list.push({
    id: 'light', icon: '💡', name: L('灯光系统', 'Lighting'), comps: wrap('light', [{
      id: 'sun', icon: '🌞', title: L('主光源', 'Main Light'),
      toggled: dirLight.visible,
      onToggle: v => { dirLight.visible = v; toast(v ? L('✔ 主光源已开启', '✔ Main light on') : L('🌙 主光源已关闭', '🌙 Main light off')); },
      desc: L('从右上方照射的暖白平行光,带柔和阴影;模拟教室顶灯', 'Warm white directional light from the upper right with soft shadows; mimics classroom ceiling lights'),
    }]),
  });
  list.push({
    id: 'clock', icon: '⏱', name: L('动画播放器', 'Animation Player'), comps: wrap('clock', [{
      id: 'time', icon: '▶', title: L('全局时钟', 'Global Clock'),
      toggled: state.animPlaying,
      onToggle: v => { state.animPlaying = v; emit('anim-toggled', v); toast(v ? L('▶ 动画播放中', '▶ Animations playing') : L('⏸ 全场景动画已暂停', '⏸ All animations paused')); },
      desc: L('全局动画时钟:驱动所有动画 / 实验 / 对话;与视口 ▶ 运行按钮联动,也可单独暂停',
        'Global clock driving all animations / experiments / dialogue; linked to the viewport ▶ Play button, can also pause independently'),
    }]),
  });
  list.push({
    id: 'xr', icon: '🥽', name: L('XR 会话管理器', 'XR Session Manager'), comps: wrap('xr', [
      {
        id: 'spawn', icon: '🚏', title: L('学生出生点规则', 'Student Spawn Rule'),
        desc: L('学生戴头显进入时,出生在场景边缘约 5 米处、面向教学内容,地面高度自动对齐',
          'Students entering in a headset spawn ~5 m from the scene edge, facing the content, floor-aligned'),
      },
      {
        id: 'loco', icon: '🚶', title: L('学生移动方式 · Locomotion', 'Student Locomotion'),
        toggled: locomotion.mode !== 'static',
        onToggle: v => configureLocomotion({ mode: v ? 'teleport' : 'static' }),
        desc: locomotionDesc(),
        onEdit: text => {
          const cfg = {};
          if (/瞬移|传送|teleport/i.test(text)) cfg.mode = 'teleport';
          else if (/平滑移动|自由移动|smooth/i.test(text)) cfg.mode = 'smooth';
          else if (/固定|静态|不动|static/i.test(text)) cfg.mode = 'static';
          const r = text.match(/半径|范围|radius|range/i) && text.match(/(\d+\.?\d*)\s*(?:米|m)?/i);
          if (r) cfg.allowedRadius = +r[1];
          if (/跳转|snap/i.test(text)) cfg.turnMode = 'snap';
          else if (/平滑(旋)?转|连续转|smooth\s*turn/i.test(text)) cfg.turnMode = 'smooth';
          const done = configureLocomotion(cfg);
          if (!done.length) toast(L('📝 已记录(未识别到移动方式配置)', '📝 Noted (no locomotion setting recognized)'));
          return done.length > 0;
        },
      },
      {
        id: 'interact', icon: '🎮', title: L('交互方式 · 设备无关', 'Interaction · Device-agnostic'),
        desc: L('同一套触发器,PC 与 VR 自动适配:点击/扳机=触发,按住拖动/手柄抓握=抓取移动',
          'One set of triggers auto-adapts to PC and VR: click/trigger = activate, hold-drag/grip = grab & move'),
      },
    ]),
  });
  if (chemLab.active) {
    const stepName = {
      check: L('查气密性', 'Seal check'), load: L('装药品', 'Load reagent'), heat: L('待点燃', 'Ready to light'),
      collect: L('加热收集', 'Heating & collecting'), choose: L('收尾抉择', 'Wrap-up choice'), takeout: L('取瓶翻转', 'Take out & flip'),
      verify: L('验满', 'Verify'), done: L('完成', 'Done'), fail: L('失败', 'Failed'),
    }[chemLab.step] || chemLab.step;
    list.push({
      id: 'chemctl', icon: '⚗️', name: L('实验控制器 · 制取氧气', 'Experiment Controller · Oxygen Prep'), comps: wrap('chemctl', [
        {
          id: 'flow', icon: '🪜', title: L('步骤状态机', 'Step State Machine'),
          desc: L(`实验流程:查 → 装 → 点 → 收 → ${chemLab.v2 ? '离 → 翻转 → ' : ''}熄 → 验;当前进行到「${stepName}」`,
            `Flow: check → load → light → collect → ${chemLab.v2 ? 'withdraw → flip → ' : ''}extinguish → verify; currently at "${stepName}"`),
        },
        {
          id: 'branch', icon: '⚠️', title: L('错误分支规则', 'Failure Branch Rule'),
          desc: L('如果学生先熄灯、后撤导管 → 触发水倒吸动画 → 试管炸裂 → AI 引导复盘并重做',
            'If the student extinguishes first and withdraws later → water sucks back → tube cracks → AI guides a review and retry'),
        },
        {
          id: 'model', icon: '🧮', title: L('反应模型', 'Reaction Model'),
          desc: L(`温度超过 100°C 后药品开始分解,每秒产氧 ${chemLab.rate ?? 9}%`,
            `Above 100°C the reagent decomposes, producing ${chemLab.rate ?? 9}% O₂ per second`),
          onEdit: text => {
            const n = text.match(/\d+\.?\d*/);
            if (n) { chemLab.rate = Math.max(1, +n[0]); toast(L(`✔ 反应速率已改为每秒 ${chemLab.rate}%`, `✔ Reaction rate set to ${chemLab.rate}%/s`)); return true; }
            toast(L('📝 已记录(没找到数字,速率未变)', '📝 Noted (no number found, rate unchanged)'));
            return false;
          },
        },
      ]),
    });
  }
  if (engLab.active) {
    list.push({
      id: 'engctl', icon: '💬', name: L('对话控制器 · 英语点餐', 'Dialogue Controller · Cafe English'), comps: wrap('engctl', [
        {
          id: 'script', icon: '📜', title: L('对话剧本', 'Dialogue Script'),
          desc: L('6 句流程:问候 → 请学生点餐 → 上汉堡 → 问饮品 → 上可乐 → 祝用餐愉快',
            '6-line flow: greet → take the order → serve burger → ask for a drink → serve cola → wish a good meal'),
        },
        {
          id: 'mic', icon: '🎤', title: L('语音触发规则', 'Voice Trigger Rule'),
          desc: L(`麦克风音量超过 ${engLab.threshold ?? 0.055} 并持续 0.35 秒 → 视为学生开口`,
            `Mic volume above ${engLab.threshold ?? 0.055} for 0.35 s → counts as the student speaking`),
          onEdit: text => {
            const n = text.match(/0?\.\d+/);
            if (n) { engLab.threshold = +n[0]; toast(L(`✔ 语音触发阈值已改为 ${engLab.threshold}`, `✔ Voice threshold set to ${engLab.threshold}`)); return true; }
            toast(L('📝 已记录(没找到小数,阈值未变)', '📝 Noted (no decimal found, threshold unchanged)'));
            return false;
          },
        },
      ]),
    });
  }
  return list;
}

// 组件卡片渲染(场景对象与虚拟对象共用)
function renderComponents(container, comps, refresh) {
  comps.forEach(c => {
    const card = document.createElement('div');
    card.className = 'comp';
    const head = document.createElement('div');
    head.className = 'comp-head';
    head.innerHTML = `<span class="comp-icon">${c.icon}</span><span class="comp-title">${c.title}</span>`;
    if (c.onPlay) {
      const play = document.createElement('button');
      play.className = 'comp-play';
      play.textContent = '▶';
      play.title = L('手动触发一次,预览这个触发器的效果', 'Trigger once to preview this behavior');
      play.addEventListener('click', e => { e.stopPropagation(); c.onPlay(); });
      head.appendChild(play);
    }
    if (c.onToggle) {
      const sw = document.createElement('input');
      sw.type = 'checkbox';
      sw.className = 'comp-switch';
      sw.checked = !!c.toggled;
      sw.title = L('启用 / 停用该组件', 'Enable / disable this component');
      sw.addEventListener('click', e => e.stopPropagation());
      sw.addEventListener('change', () => { c.onToggle(sw.checked); refresh(); });
      head.appendChild(sw);
    }
    const editBtn = document.createElement('button');
    editBtn.className = 'comp-edit';
    editBtn.textContent = '✏️';
    editBtn.title = L('用自然语言修改这条逻辑', 'Edit this logic in natural language');
    head.appendChild(editBtn);
    const desc = document.createElement('div');
    desc.className = 'comp-desc' + (c.onToggle && !c.toggled ? ' off' : '');
    desc.textContent = c.desc;
    card.append(head, desc);
    editBtn.addEventListener('click', e => {
      e.stopPropagation();
      if (card.querySelector('textarea')) return;
      const ta = document.createElement('textarea');
      ta.className = 'comp-ta';
      ta.value = c.desc;
      ta.rows = 3;
      const bar = document.createElement('div');
      bar.className = 'comp-actions';
      const save = document.createElement('button');
      save.className = 'mini-btn';
      save.textContent = L('✔ 应用', '✔ Apply');
      const cancel = document.createElement('button');
      cancel.className = 'mini-btn';
      cancel.textContent = L('取消', 'Cancel');
      bar.append(save, cancel);
      desc.replaceWith(ta);
      card.appendChild(bar);
      ta.focus();
      save.addEventListener('click', () => { c.onEdit?.(ta.value.trim()); refresh(); });
      cancel.addEventListener('click', () => refresh());
    });
    container.appendChild(card);
  });
}

virtualHead.addEventListener('click', () => { virtualOpen = !virtualOpen; renderVirtualSection(); });

function renderVirtualSection() {
  const vObjs = getVirtualObjects();
  document.getElementById('virtual-count').textContent = `(${vObjs.length})`;
  virtualHead.querySelector('.arrow').textContent = virtualOpen ? '▾' : '▸';
  virtualListEl.classList.toggle('hidden', !virtualOpen);
  virtualListEl.innerHTML = '';
  if (!virtualOpen) return;
  vObjs.forEach(v => {
    const li = document.createElement('li');
    li.className = 'h-item virtual';
    const open = expandedVirtual.has(v.id);
    li.innerHTML = `<button class="h-caret">${open ? '▾' : '▸'}</button><span class="h-icon">${v.icon}</span><span class="h-name">${v.name}</span>`;
    li.addEventListener('click', () => {
      open ? expandedVirtual.delete(v.id) : expandedVirtual.add(v.id);
      renderVirtualSection();
    });
    virtualListEl.appendChild(li);
    if (open) {
      const box = document.createElement('li');
      box.className = 'h-comps';
      renderComponents(box, v.comps, renderVirtualSection);
      virtualListEl.appendChild(box);
    }
  });
}

export function refreshHierarchy() {
  hierarchyList.innerHTML = '';
  const items = sceneRoot.children;
  hierarchyEmpty.classList.toggle('hidden', items.length > 0);
  items.forEach(obj => {
    const li = document.createElement('li');
    li.className = 'h-item' + (obj === state.selected ? ' selected' : '');
    li.dataset.oid = obj.userData.oid;
    const open = expandedObjs.has(obj.uuid);
    // 选中即上下文:多选中的对象整行高亮(取代旧的 📌 手动置顶)
    if (state.selection.includes(obj) && obj !== state.selected) li.classList.add('multi');
    li.innerHTML = `<button class="h-caret" title="${L('查看该对象的交互逻辑', "View this object's components")}">${open ? '▾' : '▸'}</button>
      <span class="h-icon">${obj.userData.icon || '🧊'}</span>
      <span class="h-name">${obj.userData.displayName}</span>
      ${obj.userData.anim ? `<span class="h-anim">${L('▶动画', '▶anim')}</span>` : ''}
      <button class="h-del" title="${L('删除', 'Delete')}">✕</button>`;
    li.addEventListener('click', e => select(obj, e.shiftKey));   // Shift+点击 = 多选(选中即 AI 上下文)
    li.querySelector('.h-caret').addEventListener('click', e => {
      e.stopPropagation();
      open ? expandedObjs.delete(obj.uuid) : expandedObjs.add(obj.uuid);
      refreshHierarchy();
    });
    li.querySelector('.h-del').addEventListener('click', e => { e.stopPropagation(); record(); removeObject(obj); toast(L('已删除对象', 'Object deleted')); });
    hierarchyList.appendChild(li);
    if (open) {
      const box = document.createElement('li');
      box.className = 'h-comps';
      renderComponents(box, getObjectComponents(obj), refreshHierarchy);
      hierarchyList.appendChild(box);
    }
  });
  document.getElementById('st-objects').textContent = t('st.objects', { n: items.length });
  renderVirtualSection();
}

on('hierarchy-changed', refreshHierarchy);

// 外部请求"在层级面板里定位这个对象"(如检查器里点了联动对象芯片):
// 切到层级页 → 选中 → 滚动到可见 → 闪烁高亮
on('focus-object', obj => {
  if (!obj) return;
  document.querySelector('.ptab[data-panel="hierarchy"]')?.click();
  select(obj);   // 触发 hierarchy-changed 重绘,li 带 selected 态
  const li = hierarchyList.querySelector(`[data-oid="${obj.userData.oid}"]`);
  if (li) {
    li.scrollIntoView({ block: 'center', behavior: 'smooth' });
    li.classList.add('flash');
    setTimeout(() => li.classList.remove('flash'), 1600);
  }
});
