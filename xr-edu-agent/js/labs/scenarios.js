// ═══════════════════════════════════════════════════════════════
//  预置场景模板(Scene Templates)
//  · 离线模式:关键词正则匹配 → 直接生成
//  · LLM 模式:作为 Agent 的 build_template 工具供其调用
//  每个模板:match(正则)/ steps(展示用计划)/ reply(回复文案)/ run(执行)
//  所有文案经 L(zh, en) 随界面语言切换(切换语言 = 整页刷新后生效)
// ═══════════════════════════════════════════════════════════════
import * as THREE from 'three';
import { addAsset, clearScene, setMainColor } from '../scene/manager.js';
import { attachLabel, addFreePanel } from '../panels/panel3d.js';
import { MATH_SOLIDS } from '../assets/builders.js';
import { buildOxygenLab } from './chem-oxygen.js';
import { buildEnglishCafe } from './english-cafe.js';
import { emit } from '../core/events.js';
import { L } from '../core/i18n.js';

export const SCENARIOS = [
  {
    id: 'solar_system',
    name: L('迷你太阳系', 'Mini Solar System'),
    match: /太阳系|行星|天文|宇宙|solar|planet/i,
    steps: L(
      ['解析教学意图:小学科学 · 太阳系认知', '生成太阳与 5 颗行星模型', '为行星添加公转 + 自转轨道动画', '给每颗行星挂上名称与公转周期标签', '放置知识面板(公转 vs 自转)'],
      ['Parse teaching intent: primary science · the solar system', 'Generate the sun and 5 planets', 'Add orbit + spin animations', 'Label each planet with its name and orbital period', 'Place a knowledge panel (revolution vs rotation)']),
    reply: L(
      '已为你生成一个<b>迷你太阳系</b> 🌌\n\n· 中心是发光的太阳,周围 5 颗行星正在公转\n· 每颗行星头顶都有<b>标签</b>:名字 + 真实公转周期,离太阳越远周期越长\n· 旁边的知识面板讲"公转 vs 自转",可以拖到讲解位置\n\n💡 教学建议:先暂停动画(视口上方 ▶ 按钮),让学生按标签上的周期预测"谁跑得最快",再播放验证。',
      'Your <b>mini solar system</b> is ready 🌌\n\n· A glowing sun sits at the center with 5 orbiting planets\n· Each planet has a <b>label</b>: name + real orbital period — the farther out, the longer the period\n· The side panel explains "revolution vs rotation" and can be dragged anywhere\n\n💡 Teaching tip: pause the animation (▶ button above the viewport), have students predict "which planet is fastest" from the labels, then play to verify.'),
    run: () => {
      clearScene();
      const sun = addAsset('sun', { x: 0, z: 0 }, true);
      sun.userData.displayName = L('太阳', 'Sun');
      attachLabel(sun, { width: 1.3, gap: 0.4, accent: '#f0a848', lines: [L('☀️ 太阳 · 恒星', '☀️ Sun · Star')] });
      const planets = [
        { id: 'earth', name: L('水星', 'Mercury'), r: 3, speed: 1.4, scale: 0.35, color: 0x9aa3af, fact: L('公转 88 天', 'Orbit: 88 days') },
        { id: 'earth', name: L('金星', 'Venus'), r: 4.4, speed: 1.0, scale: 0.55, color: 0xd8a850, fact: L('公转 225 天', 'Orbit: 225 days') },
        { id: 'earth', name: L('地球', 'Earth'), r: 6, speed: 0.7, scale: 0.8, fact: L('公转 365 天', 'Orbit: 365 days') },
        { id: 'mars', name: L('火星', 'Mars'), r: 7.6, speed: 0.55, scale: 0.6, fact: L('公转 687 天', 'Orbit: 687 days') },
        { id: 'saturn', name: L('土星', 'Saturn'), r: 9.6, speed: 0.4, scale: 0.9, fact: L('公转 29.5 年', 'Orbit: 29.5 years') },
      ];
      planets.forEach(p => {
        const obj = addAsset(p.id, { x: p.r, z: 0 }, true);
        obj.userData.displayName = p.name;
        obj.scale.setScalar(p.scale);
        if (p.color) setMainColor(obj, p.color);
        obj.userData.anim = { type: 'orbit', cx: 0, cz: 0, radius: p.r, speed: p.speed, angle: Math.random() * Math.PI * 2 };
        attachLabel(obj, { width: 1.25, gap: 0.3, accent: '#7fc4ff', lines: [`${p.name} · ${p.fact}`] });
      });
      addFreePanel({
        name: L('知识板 · 公转与自转', 'Knowledge · Revolution vs Rotation'),
        title: L('🌌 公转 vs 自转', '🌌 Revolution vs Rotation'), accent: '#a878f0', width: 2.5,
        lines: L(
          ['公转: 绕太阳转一圈', '自转: 自己原地转一圈', '', '离太阳越远 → 公转越慢', '看看标签, 谁跑得最快?'],
          ['Revolution: one lap around the sun', 'Rotation: spinning in place', '', 'Farther from the sun → slower orbit', 'Check the labels: who is fastest?']),
      }, { x: 0, y: 5.5, z: -7 });
      emit('hierarchy-changed');
    },
  },
  {
    // 老师用自然语言修改项目:展示"打字改项目"能力(离线版:切换到预置的修正版)
    id: 'oxygen_lab_fixed',
    name: L('制取氧气(修正版)', 'Oxygen Prep (Fixed)'),
    match: /帮我改|帮我修|改一下|修一下|修正|改正|有个错|有错误|不太对|fix/i,
    steps: L(
      ['理解修改意图:验满步骤不符合真实操作规范', '定位问题:木条对着水槽中倒立的瓶底,氧气无法接触火星', '重写实验流程:新增第⑥步「玻璃片盖口 → 取出 → 翻转正放」', '更新验满动画:木条改为伸向朝上的瓶口', '重新生成实验场景(其余步骤保持不变)'],
      ['Understand the fix: the verify step violates real lab practice', 'Locate the issue: the splint pointed at an upside-down bottle still in the trough', 'Rewrite the flow: new step ⑥ "cover with glass plate → take out → flip upright"', 'Update the verify animation: splint now reaches the upward mouth', 'Rebuild the scene (other steps unchanged)']),
    reply: L(
      '✅ 你说得对,已经改好了!\n\n<b>问题:</b>旧版验满时,木条直接伸向还倒立在水槽里的瓶底——现实中氧气被水封在瓶里,火星根本接触不到。\n\n<b>修改:</b>收尾抉择完成后,新增了<b>第⑥步「离」</b>:点击【集气瓶】,它会在水下被玻璃片盖住瓶口、取出水槽、<b>翻转正放</b>(O₂ 密度比空气大,瓶口朝上不易逸散);之后木条会伸向<b>朝上的瓶口</b>验满。\n\n这就是"老师一句话改项目"的体验——装置已重新摆好,从第①步再做一遍,注意看新增的第⑥步 🔬',
      '✅ You were right — fixed!\n\n<b>Problem:</b> in the old version the splint reached toward the bottle bottom while it was still inverted in the trough — in reality the oxygen is sealed by water and never touches the spark.\n\n<b>Fix:</b> after the wrap-up choice there is a new <b>step ⑥ "take out"</b>: click the bottle and it gets covered underwater with a glass plate, lifted out and <b>flipped upright</b> (O₂ is denser than air, so it stays in an upward-facing bottle); the splint then reaches the <b>upward mouth</b> to verify.\n\nThat is the "fix a project with one sentence" experience — the apparatus is reset, run it again from step ① and watch the new step ⑥ 🔬'),
    run: () => buildOxygenLab(true),
  },
  {
    id: 'english_cafe',
    name: L('餐厅英语点餐', 'Cafe English Ordering'),
    match: /英语|点餐|餐厅|口语|对话|数字人|english|restaurant|cafe|order/i,
    steps: L(
      ['解析教学意图:英语口语 · 情境会话(餐厅点餐)', '搭建餐厅场景:柜台 / 菜单板 / 餐桌', '生成数字人服务员 Alex(问候 / 倾听 / 上餐动作)', '接入麦克风音量检测(演示版语音触发)', '编排对话剧本:问候 → 点主食 → 点饮品 → 上餐'],
      ['Parse teaching intent: spoken English · situational dialogue (ordering)', 'Build the cafe: counter / menu board / tables', 'Generate digital waiter Alex (greets / listens / serves)', 'Hook up microphone volume detection (demo voice trigger)', 'Script the dialogue: greet → main dish → drink → serve']),
    reply: L(
      '🍔 <b>餐厅英语点餐</b>场景准备好了!\n\n柜台后是数字人服务员 <b>Alex</b>,对话流程:\n① Alex 用英语问候并请你点餐(注意他在挥手)\n② 轮到你时,对话面板会提示句型——<b>对着麦克风开口说英语</b>\n③ AI"听懂"后 Alex 会回应,并把汉堡、可乐端上柜台 🍔🥤\n\n💡 演示版只检测麦克风音量来触发流程,不做真实语音识别;如果浏览器没给麦克风权限,<b>点击 Alex</b> 也能代替说话。正式版接入语音识别 + LLM 后,学生可以自由发挥点任何东西、Alex 会真的听懂并追问。',
      '🍔 The <b>cafe English ordering</b> scene is ready!\n\nBehind the counter is digital waiter <b>Alex</b>. The flow:\n① Alex greets you in English and takes your order (see him waving)\n② When it is your turn, the dialogue panel shows the sentence pattern — <b>speak English into the microphone</b>\n③ Once the AI "hears" you, Alex responds and serves a burger and cola 🍔🥤\n\n💡 The demo only detects mic volume, not real speech; if the browser has no mic permission, <b>clicking Alex</b> also counts as speaking. With real speech recognition + LLM, students can order anything and Alex will genuinely understand and follow up.'),
    run: buildEnglishCafe,
  },
  {
    id: 'oxygen_lab',
    name: L('制取氧气实验', 'Oxygen Preparation Lab'),
    match: /制取|制备|氧气|高锰酸|排水法|kmno|重做实验|oxygen/i,
    steps: L(
      ['解析教学意图:初中化学 · 气体制备流程(教材经典实验)', '搭建装置:铁架台 / 试管 / 酒精灯 / 导管 / 水槽 / 集气瓶', '配置分步交互:查 → 装 → 点 → 收 → 离 → 熄 → 验', '设置错误分支:先熄灯 → 水倒吸 → 试管炸裂', '挂载步骤引导板 + 实时状态面板(温度 / 进度 / 药品)'],
      ['Parse teaching intent: middle-school chemistry · gas preparation (classic textbook lab)', 'Build apparatus: stand / tube / burner / duct / trough / bottle', 'Configure step interactions: check → load → light → collect → withdraw → extinguish → verify', 'Set the failure branch: extinguish first → water sucks back → tube cracks', 'Mount the step guide + live status panel (temperature / progress / reagent)']),
    reply: L(
      '⚗️ <b>加热高锰酸钾制取氧气</b>分步实验已搭好!\n\n反应原理:<b>2KMnO₄ —Δ→ K₂MnO₄ + MnO₂ + O₂↑</b>\n\n这是一个<b>学生可以亲手操作</b>的实验——跟着中间的步骤引导板,<b>依次点击视口里的装置</b>:\n① 点【试管】查气密性(看导管口冒泡)\n② 点【试管】装入紫黑色药品 + 棉花\n③ 点【酒精灯】点火,预热后开始产气\n④ 观察气泡把集气瓶里的水一点点排出去(右侧状态面板有实时温度和进度)\n⑤ 收集满后是<b>关键抉择</b>:先撤导管还是先熄灯?<b>做错会水倒吸、炸裂试管</b>\n⑥ 点【木条】带火星验满,复燃即成功\n\n💡 建议让学生两条路都走一遍,对比"正确 vs 失误"两种实验结果,比背口诀"查装定点收离熄"深刻得多。',
      '⚗️ The <b>KMnO₄ heating oxygen prep</b> lab is ready!\n\nReaction: <b>2KMnO₄ —Δ→ K₂MnO₄ + MnO₂ + O₂↑</b>\n\nStudents can <b>operate it hands-on</b> — follow the step guide and <b>click the apparatus in order</b>:\n① Click the <b>tube</b> to check the seal (watch bubbles at the duct mouth)\n② Click the <b>tube</b> to load the dark-purple reagent + cotton\n③ Click the <b>burner</b> to light it; gas production starts after preheating\n④ Watch bubbles push water out of the collecting bottle (live temperature & progress on the right panel)\n⑤ When full comes the <b>key choice</b>: withdraw the duct first, or extinguish first? <b>The wrong order sucks water back and cracks the tube</b>\n⑥ Click the <b>splint</b> to verify — it relights if the gas is oxygen\n\n💡 Have students try both paths and compare "correct vs mistake" — far more memorable than reciting the procedure.'),
    run: () => buildOxygenLab(false),
  },
  {
    id: 'chem_lab',
    name: L('化学实验室', 'Chemistry Lab'),
    match: /化学|实验室|烧杯|试剂|lab|chemistry/i,
    steps: L(
      ['解析教学意图:初中化学 · 虚拟实验台', '摆放实验桌与器材(烧杯 / 锥形瓶)', '生成 H₂O 与 CO₂ 球棍模型并挂上分子信息面板', '放置原子配色图例与探究任务板'],
      ['Parse teaching intent: middle-school chemistry · virtual bench', 'Place benches and glassware (beaker / flask)', 'Generate H₂O and CO₂ ball-and-stick models with info panels', 'Place the atom color legend and inquiry task board']),
    reply: L(
      '<b>虚拟化学实验室</b>已就绪 🧪\n\n· 实验桌上摆放了烧杯和锥形瓶\n· H₂O 和 CO₂ 的球棍模型悬浮在上方,每个分子旁边有<b>信息面板</b>:化学式、分子形状、键角\n· 左边是原子配色图例,右边是探究任务,面板都可以拖动\n\n💡 关键对比点:水是"角形"(104.5°),二氧化碳是"直线形"(180°)——让学生先观察再看面板验证。',
      'Your <b>virtual chemistry lab</b> is ready 🧪\n\n· Beakers and flasks sit on the benches\n· H₂O and CO₂ ball-and-stick models float above, each with an <b>info panel</b>: formula, shape, bond angle\n· Atom color legend on the left, inquiry tasks on the right — all panels are draggable\n\n💡 Key contrast: water is bent (104.5°), CO₂ is linear (180°) — let students observe first, then verify with the panels.'),
    run: () => {
      clearScene();
      const desk1 = addAsset('desk', { x: -1.2, z: 0 }, true);
      const desk2 = addAsset('desk', { x: 0.5, z: 0 }, true);
      desk1.userData.displayName = L('实验桌 A', 'Bench A');
      desk2.userData.displayName = L('实验桌 B', 'Bench B');
      const beaker = addAsset('beaker', { x: -1.5, z: 0 }, true);
      beaker.position.y = 1.05;
      const flask = addAsset('flask', { x: -0.6, z: 0.1 }, true);
      flask.position.y = 1.05;
      const h2o = addAsset('h2o', { x: 0.8, z: 0 }, true);
      h2o.position.y = 2.7; h2o.scale.setScalar(0.7);
      h2o.userData.displayName = L('水分子 H₂O', 'Water Molecule H₂O');
      attachLabel(h2o, {
        title: '💧 H₂O', width: 1.6, gap: 0.3, accent: '#48c8f0',
        lines: [{ k: L('形状', 'Shape'), v: L('角形', 'Bent') }, { k: L('键角', 'Bond angle'), v: '104.5°', c: '#ffe28a' }],
      });
      const co2 = addAsset('co2', { x: 3.2, z: 0.4 }, true);
      co2.position.y = 2.5; co2.scale.setScalar(0.6);
      co2.userData.displayName = L('二氧化碳 CO₂', 'Carbon Dioxide CO₂');
      attachLabel(co2, {
        title: '💨 CO₂', width: 1.6, gap: 0.3, accent: '#9aa3af',
        lines: [{ k: L('形状', 'Shape'), v: L('直线形', 'Linear') }, { k: L('键角', 'Bond angle'), v: '180°', c: '#ffe28a' }],
      });
      const board = addAsset('whiteboard', { x: 0, z: -2.5 }, true);
      board.userData.displayName = L('演示白板', 'Demo Whiteboard');
      addFreePanel({
        name: L('图例 · 原子配色', 'Legend · Atom Colors'), title: L('🎨 原子配色图例', '🎨 Atom Color Legend'), accent: '#e5748b', width: 2.3,
        lines: [
          { k: L('红色球', 'Red ball'), v: L('氧 O', 'Oxygen O') },
          { k: L('白色球', 'White ball'), v: L('氢 H', 'Hydrogen H') },
          { k: L('黑色球', 'Black ball'), v: L('碳 C', 'Carbon C') },
          { k: L('银色棒', 'Silver rod'), v: L('共价键', 'Covalent bond') },
        ],
      }, { x: -4.5, y: 2.8, z: -1 });
      addFreePanel({
        name: L('任务板 · 分子观察', 'Tasks · Molecule Study'), title: L('🎯 探究任务', '🎯 Inquiry Tasks'), accent: '#3fb96f', width: 2.4,
        lines: L(
          ['1. 数一数每个分子的原子', '2. 观察两个分子的形状差异', '3. 对照面板核对键角', '4. 想一想: 为什么水是弯的?'],
          ['1. Count the atoms in each molecule', '2. Compare the two shapes', '3. Check bond angles on the panels', '4. Think: why is water bent?']),
      }, { x: 6.5, y: 2.8, z: -1 });
      emit('hierarchy-changed');
    },
  },
  {
    id: 'dna',
    name: L('DNA 双螺旋', 'DNA Double Helix'),
    match: /dna|双螺旋|基因|遗传|helix|gene/i,
    steps: L(
      ['解析教学意图:高中生物 · DNA 结构', '生成 DNA 双螺旋模型(碱基对配色)', '生成细胞模型作对照', '添加缓速旋转动画'],
      ['Parse teaching intent: high-school biology · DNA structure', 'Generate the double helix (base-pair colors)', 'Generate a cell model for comparison', 'Add a slow spin animation']),
    reply: L(
      '<b>DNA 双螺旋</b>模型完成 🧬\n\n· 双链骨架以灰白色小球表示\n· 四种颜色的"横杆"代表 A-T / G-C 碱基对\n· 旁边放了一个半透明细胞模型,可以讲解 DNA 在细胞核中的位置\n\n💡 试试选中 DNA,按 <b>R</b> 键把它放大——在 VR 里学生可以"走进"分子内部!',
      'The <b>DNA double helix</b> is ready 🧬\n\n· The two backbones are gray-white beads\n· Four-colored rungs represent A-T / G-C base pairs\n· A translucent cell model sits nearby to show where DNA lives in the nucleus\n\n💡 Select the DNA and press <b>R</b> to scale it up — in VR students can walk right inside the molecule!'),
    run: () => {
      clearScene();
      const dna = addAsset('dna', { x: 0, z: 0 }, true);
      dna.userData.displayName = L('DNA 双螺旋', 'DNA Double Helix');
      const cell = addAsset('cell', { x: 4, z: 0.5 }, true);
      cell.userData.displayName = L('细胞(对照)', 'Cell (reference)');
      attachLabel(cell, { width: 1.7, gap: 0.35, accent: '#e5748b', lines: [L('🦠 细胞 · DNA 在细胞核里', '🦠 Cell · DNA lives in the nucleus')] });
      addFreePanel({
        name: L('图例 · 碱基配对', 'Legend · Base Pairing'), title: L('🧬 碱基配对规则', '🧬 Base Pairing Rules'), accent: '#a878f0', width: 2.5,
        lines: [
          { k: L('蓝色 A', 'Blue A'), v: L('橙色 T', 'Orange T'), c: '#f0a848' },
          { k: L('绿色 G', 'Green G'), v: L('红色 C', 'Red C'), c: '#e5534b' },
          '',
          L('A 只和 T 配对', 'A pairs only with T'),
          L('G 只和 C 配对 (互补!)', 'G pairs only with C (complementary!)'),
        ],
      }, { x: -4.5, y: 2.8, z: -0.5 });
      addFreePanel({
        name: L('任务板 · DNA 探究', 'Tasks · DNA Inquiry'), title: L('🎯 探究任务', '🎯 Inquiry Tasks'), accent: '#3fb96f', width: 2.4,
        lines: L(
          ['1. 找一条蓝色 A 横杆', '2. 看它另一半是什么颜色', '3. 验证 A-T / G-C 配对规则', '4. 把 DNA 放大"走进"看看'],
          ['1. Find a blue A rung', '2. Check the color of its other half', '3. Verify the A-T / G-C rules', '4. Scale the DNA up and walk inside']),
      }, { x: 4.5, y: 4.5, z: -0.5 });
      emit('hierarchy-changed');
    },
  },
  {
    id: 'pendulum_compare',
    name: L('单摆对比实验', 'Pendulum Comparison'),
    match: /单摆|钟摆|摆锤|摆动|振动|简谐|pendulum/i,
    steps: L(
      ['解析教学意图:高中物理 · 简谐运动', '生成三个不同摆长的单摆(周期按 T=2π√(L/g) 真实计算)', '为每个单摆挂载实时参数面板(摆长/周期/摆角)', '放置公式板与探究任务板(可拖动对比)'],
      ['Parse teaching intent: high-school physics · simple harmonic motion', 'Generate three pendulums of different lengths (periods from T=2π√(L/g))', 'Attach a live parameter panel to each (length/period/angle)', 'Place the formula board and task board (draggable)']),
    reply: L(
      '<b>单摆对比实验</b>已搭好 ⚖️\n\n· 三个单摆摆长不同,摆动周期按真实公式 <b>T = 2π√(L/g)</b> 计算\n· 每个摆头顶有<b>实时参数面板</b>:摆长 L、理论周期 T、当前摆角 θ(会跟着摆动实时变化)\n· 旁边有公式板和任务板,都可以<b>选中后用移动手柄拖到任何位置</b>——比如把两块面板拖到一起对比数据\n\n💡 探究式教学:先暂停动画,让学生根据面板上的 L 预测"哪个摆最快",再播放验证。',
      'The <b>pendulum comparison lab</b> is ready ⚖️\n\n· Three pendulums with different lengths; periods follow the real formula <b>T = 2π√(L/g)</b>\n· Each has a <b>live parameter panel</b>: length L, theoretical period T, and current angle θ (updates as it swings)\n· The formula board and task board can be <b>selected and dragged anywhere</b> — e.g. side by side to compare data\n\n💡 Inquiry teaching: pause the animation, let students predict "which swings fastest" from L, then play to verify.'),
    run: () => {
      clearScene();
      const configs = [
        { x: -4.2, s: 0.7, name: L('短摆', 'Short') },
        { x: 0, s: 1, name: L('中摆', 'Medium') },
        { x: 4.2, s: 1.3, name: L('长摆', 'Long') },
      ];
      configs.forEach((cfg, i) => {
        const p = addAsset('pendulum', { x: cfg.x, z: 0 }, true);
        p.scale.setScalar(cfg.s);
        const L_len = 2.1 * cfg.s;                // 摆长(米)
        const omega = Math.sqrt(9.8 / L_len);     // ω = √(g/L)
        const T_p = 2 * Math.PI / omega;          // 周期
        p.userData.anim = { type: 'swing', speed: omega, amplitude: 0.5 };
        p.userData.displayName = L(`单摆 ${cfg.name} (L=${L_len.toFixed(1)}m)`, `Pendulum ${cfg.name} (L=${L_len.toFixed(1)}m)`);
        const pivot = p.children.find(c => c.userData.isSwingPivot);
        attachLabel(p, {
          title: `⏱ ${cfg.name}`, width: 1.7, gap: 0.35,
          accent: ['#48c8f0', '#4a9eff', '#a878f0'][i],
          live: () => [
            { k: L('摆长 L', 'Length L'), v: L_len.toFixed(2) + ' m' },
            { k: L('周期 T', 'Period T'), v: T_p.toFixed(2) + ' s', c: '#ffe28a' },
            { k: L('摆角 θ', 'Angle θ'), v: (pivot.rotation.z * 180 / Math.PI).toFixed(0).padStart(3) + '°', c: '#7fe0a0' },
          ],
        });
      });
      addFreePanel({
        name: L('公式板 · 单摆周期', 'Formula · Pendulum Period'), title: L('📐 单摆周期公式', '📐 Pendulum Period Formula'), accent: '#f0a848', width: 2.6,
        lines: [
          'T = 2π √( L / g )', '',
          { k: L('g 重力加速度', 'g gravity'), v: '9.8 m/s²' },
          L('结论: 摆长越长 → 周期越长', 'Longer pendulum → longer period'),
          L('(与摆锤质量无关!)', '(independent of bob mass!)'),
        ],
      }, { x: -8.5, y: 2.6, z: -1 });
      addFreePanel({
        name: L('任务板 · 单摆探究', 'Tasks · Pendulum Inquiry'), title: L('🎯 探究任务', '🎯 Inquiry Tasks'), accent: '#3fb96f', width: 2.4,
        lines: L(
          ['1. 暂停动画, 读出三个 L', '2. 预测: 哪个摆得最快?', '3. 播放动画验证你的猜想', '4. 对照周期 T 检查计算'],
          ['1. Pause and read the three L values', '2. Predict: which swings fastest?', '3. Play to verify your guess', '4. Check against the period T']),
      }, { x: 8.5, y: 2.6, z: -1 });
      emit('hierarchy-changed');
    },
  },
  {
    id: 'geometry_class',
    name: L('多面体几何课堂', 'Polyhedron Geometry Class'),
    match: /几何|图形|形状|数学|多面体|欧拉|shape|geometry|polyhedron|euler/i,
    steps: L(
      ['解析教学意图:数学 · 多面体与欧拉公式', '生成 6 种透明几何体(显示顶点小球 + 棱线描边)', '统计每个几何体的 顶点V / 棱E / 面F 并挂标注面板', '放置欧拉公式板与探究任务板', '添加缓速自转动画(可用旋转手柄自由翻转)'],
      ["Parse teaching intent: math · polyhedra & Euler's formula", 'Generate 6 transparent solids (vertex dots + edge outlines)', 'Count V / E / F for each and attach labels', "Place the Euler's formula board and task board", 'Add slow spin (rotate freely with the gizmo)']),
    reply: L(
      '<b>多面体探究课堂</b>完成 📐\n\n· 6 种几何体都是<b>透明面 + 白色棱线 + 金色顶点小球</b>,内部结构一目了然\n· 每个几何体头顶的面板标出它的 <b>顶点V / 棱E / 面F</b> 数量\n· 几何体在缓慢自转;选中后按 <b>E</b> 键可以用旋转手柄任意翻转观察\n\n💡 核心探究:让学生把每个面板上的 V − E + F 算一遍——他们会发现<b>永远等于 2</b>(欧拉公式)!左侧的公式板可以拖过去逐个验证。',
      'The <b>polyhedron inquiry class</b> is ready 📐\n\n· All 6 solids have <b>transparent faces + white edges + gold vertex dots</b> so the structure is fully visible\n· The panel above each solid shows its <b>V / E / F</b> counts\n· They spin slowly; select one and press <b>E</b> to flip it with the rotate gizmo\n\n💡 Core inquiry: have students compute V − E + F for each panel — it is <b>always 2</b> (Euler\'s formula)! Drag the formula board over to verify one by one.'),
    run: () => {
      clearScene();
      MATH_SOLIDS.forEach((def, i) => {
        const o = addAsset(def.id, { x: (i - 2.5) * 3, z: 0 }, true);
        o.userData.displayName = def.name;
        const { V, E, F } = o.userData.vef;
        attachLabel(o, {
          title: def.name, width: 1.6, gap: 0.4,
          accent: '#' + new THREE.Color(def.color).getHexString(),
          lines: [
            { k: L('顶点 V', 'Vertices V'), v: String(V), c: '#ffe28a' },
            { k: L('棱   E', 'Edges   E'), v: String(E), c: '#ffffff' },
            { k: L('面   F', 'Faces   F'), v: String(F), c: '#7fc4ff' },
          ],
        });
      });
      addFreePanel({
        name: L('公式板 · 欧拉公式', "Formula · Euler's Formula"), title: L('📐 欧拉公式', "📐 Euler's Formula"), accent: '#f0a848', width: 2.6,
        lines: L(
          ['V − E + F = 2', '', '顶点数 − 棱数 + 面数', '对任何凸多面体都成立!', '试着用每个面板验证 →'],
          ['V − E + F = 2', '', 'vertices − edges + faces', 'Holds for every convex polyhedron!', 'Verify with each panel →']),
      }, { x: -10.5, y: 2.8, z: -1.5 });
      addFreePanel({
        name: L('任务板 · 多面体探究', 'Tasks · Polyhedron Inquiry'), title: L('🎯 探究任务', '🎯 Inquiry Tasks'), accent: '#3fb96f', width: 2.4,
        lines: L(
          ['1. 数一数: 顶点、棱、面', '2. 对照头顶面板核对', '3. 计算 V − E + F', '4. 换一个几何体再试一次'],
          ['1. Count vertices, edges, faces', '2. Check against the panel', '3. Compute V − E + F', '4. Try another solid']),
      }, { x: 10.5, y: 2.8, z: -1.5 });
      emit('hierarchy-changed');
    },
  },
  {
    id: 'ramp_compare',
    name: L('斜面对比实验', 'Ramp Comparison'),
    match: /斜面|滚|摩擦|牛顿|力学|ramp|incline|friction/i,
    steps: L(
      ['解析教学意图:初中物理 · 斜面与加速度', '搭建两个不同倾角的斜面装置', '按 a = g·sinθ 计算下滑加速度并挂参数面板', '放置公式板与探究任务板'],
      ['Parse teaching intent: middle-school physics · ramps & acceleration', 'Build two ramps with different angles', 'Compute a = g·sinθ and attach parameter panels', 'Place the formula board and task board']),
    reply: L(
      '<b>斜面对比实验</b>已生成 📐\n\n· 两个斜面倾角不同(28° vs 40°),小球循环滚落\n· 每个斜面头顶的<b>参数面板</b>标出倾角 θ 和理论加速度 <b>a = g·sinθ</b>\n· 公式板和任务板可以拖到两个斜面中间做对比讲解\n\n💡 探究点:倾角越大 → sinθ 越大 → 加速度越大,让学生观察哪个球先到底,再用面板数据解释原因。',
      'The <b>ramp comparison lab</b> is ready 📐\n\n· Two ramps at different angles (28° vs 40°) with balls rolling down on loop\n· Each ramp\'s <b>parameter panel</b> shows its angle θ and theoretical <b>a = g·sinθ</b>\n· Drag the formula and task boards between the ramps for side-by-side teaching\n\n💡 Inquiry point: bigger angle → bigger sinθ → bigger acceleration. Let students watch which ball reaches the bottom first, then explain with the panel data.'),
    run: () => {
      clearScene();
      const r1 = addAsset('ramp', { x: -3, z: 0 }, true);
      r1.userData.displayName = L('斜面 28°(缓)', 'Ramp 28° (gentle)');
      attachLabel(r1, {
        title: L('📐 缓坡', '📐 Gentle'), width: 1.7, gap: 0.35, accent: '#48c8f0',
        lines: [{ k: L('倾角 θ', 'Angle θ'), v: '28°' }, { k: L('加速度 a', 'Accel a'), v: '4.6 m/s²', c: '#ffe28a' }],
      });
      const r2 = addAsset('ramp', { x: 3, z: 0 }, true);
      r2.scale.set(1, 1.6, 1);
      r2.userData.displayName = L('斜面 40°(陡)', 'Ramp 40° (steep)');
      attachLabel(r2, {
        title: L('📐 陡坡', '📐 Steep'), width: 1.7, gap: 0.35, accent: '#e5748b',
        lines: [{ k: L('倾角 θ', 'Angle θ'), v: '40°' }, { k: L('加速度 a', 'Accel a'), v: '6.3 m/s²', c: '#ffe28a' }],
      });
      addFreePanel({
        name: L('公式板 · 斜面加速度', 'Formula · Ramp Acceleration'), title: L('📐 斜面下滑加速度', '📐 Sliding Acceleration'), accent: '#f0a848', width: 2.6,
        lines: [
          L('a = g · sinθ  (光滑斜面)', 'a = g · sinθ  (frictionless)'), '',
          { k: L('g 重力加速度', 'g gravity'), v: '9.8 m/s²' },
          L('倾角越大 → 加速度越大', 'Bigger angle → bigger acceleration'),
        ],
      }, { x: -7.5, y: 3, z: -1 });
      addFreePanel({
        name: L('任务板 · 斜面探究', 'Tasks · Ramp Inquiry'), title: L('🎯 探究任务', '🎯 Inquiry Tasks'), accent: '#3fb96f', width: 2.4,
        lines: L(
          ['1. 观察: 哪个球滚得更快?', '2. 读出两个斜面的 θ 和 a', '3. 用 a = g·sinθ 验证', '4. 想一想: 有摩擦会怎样?'],
          ['1. Watch: which ball is faster?', '2. Read θ and a for both ramps', '3. Verify with a = g·sinθ', '4. Think: what if there were friction?']),
      }, { x: 7.5, y: 3, z: -1 });
      emit('hierarchy-changed');
    },
  },
  {
    id: 'clear',
    name: L('清空场景', 'Clear Scene'),
    match: /清空|重来|删除所有|清除|clear|start over/i,
    steps: L(['清空场景中的所有对象'], ['Remove every object from the scene']),
    reply: L(
      '场景已清空 ✨ 我们可以重新开始了。\n\n试试对我说:"创建一个太阳系" 或 "搭一个化学实验室"。',
      'Scene cleared ✨ Ready for a fresh start.\n\nTry telling me: "Create a solar system" or "Build a chemistry lab".'),
    run: clearScene,
  },
];

export function findScenario(idOrText) {
  return SCENARIOS.find(s => s.id === idOrText) || SCENARIOS.find(s => s.match.test(idOrText)) || null;
}

// 给 LLM 的模板清单
export function scenarioCatalogForLLM() {
  return SCENARIOS.map(s => `- ${s.id}: ${s.name}`).join('\n');
}
