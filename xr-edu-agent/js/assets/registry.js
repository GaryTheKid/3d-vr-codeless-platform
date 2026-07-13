// ═══════════════════════════════════════════════════════════════
//  AssetSkill 注册表:把每个 WebXR 教学资源封装成"Agent 友好"的技能格式
//
//  数据结构(AssetSkill):
//    id          唯一标识(Agent 工具调用时引用)
//    name        显示名(随界面语言,老师可读)
//    icon        emoji 图标
//    category    资源库分类
//    description 自然语言描述:这是什么(人类 & LLM 共用)
//    prompt      提示词组件:什么时候该用它、教学上怎么用(注入 LLM 上下文)
//    tags        检索关键词(搜索 & 语义匹配)
//    code        代码位置 { module, symbol }(未来支持社区资源的代码分发)
//    size        体积信息 { footprint: 近似包围盒[宽,高,深](米), tris: 三角面数量级 }
//    build       构建函数 → THREE.Object3D
//
//  未来:此结构直接映射数据库表 / 社区分享的资源包 manifest
// ═══════════════════════════════════════════════════════════════
import * as B from './builders.js';
import { L } from '../core/i18n.js';

const skill = (o) => ({ tags: [], size: { footprint: [1, 1, 1], tris: 'low' }, ...o });

const CAT = {
  basic: L('基础形状', 'Basic Shapes'),
  math: L('数学 · 几何体', 'Math · Solids'),
  label: L('教学 · 标注', 'Teaching · Labels'),
  astro: L('天文 · 宇宙', 'Astronomy · Space'),
  chem: L('化学 · 分子', 'Chemistry · Molecules'),
  phys: L('物理 · 力学', 'Physics · Mechanics'),
  bio: L('生物 · 生命', 'Biology · Life'),
  room: L('教室 · 环境', 'Classroom · Environment'),
};

export const ASSET_SKILLS = [
  // ── 基础形状 ──
  ...[
    ['cube', '🟦', L('立方体', 'Cube'), L('边长 1.4m 的蓝色立方体', 'Blue cube, 1.4 m edge'), [1.4, 1.4, 1.4]],
    ['sphere', '🔮', L('球体', 'Sphere'), L('半径 0.8m 的紫色球体', 'Purple sphere, 0.8 m radius'), [1.6, 1.6, 1.6]],
    ['cylinder', '🛢', L('圆柱', 'Cylinder'), L('高 1.6m 的绿色圆柱', 'Green cylinder, 1.6 m tall'), [1.2, 1.6, 1.2]],
    ['cone', '🔺', L('圆锥', 'Cone'), L('高 1.6m 的橙色圆锥', 'Orange cone, 1.6 m tall'), [1.6, 1.6, 1.6]],
    ['torus', '🍩', L('圆环', 'Torus'), L('外径约 1.9m 的粉色圆环', 'Pink torus, ~1.9 m outer diameter'), [1.9, 0.5, 1.9]],
    ['pyramid', '⛰', L('四棱锥', 'Pyramid'), L('底边 2m 的青色四棱锥', 'Cyan square pyramid, 2 m base'), [2, 1.5, 2]],
  ].map(([id, icon, name, desc, fp]) => skill({
    id, icon, name, category: CAT.basic,
    description: desc,
    prompt: L('通用几何积木,可作为示意物、占位物或组合成简单教具。', 'Generic geometric building block; use as a stand-in or combine into simple props.'),
    tags: ['基础', '几何', 'basic', 'geometry', name],
    code: { module: 'js/assets/builders.js', symbol: `buildBasic('${id}')` },
    size: { footprint: fp, tris: 'low' },
    build: () => B.buildBasic(id),
  })),

  // ── 数学几何体 ──
  ...B.MATH_SOLIDS.map(def => skill({
    id: def.id, icon: def.icon, name: def.name, category: CAT.math,
    description: L(`透明${def.name}:半透明彩色面 + 白色棱线 + 金色顶点小球,userData.vef 记录顶点V/棱E/面F数量,默认缓速自转`,
      `Transparent ${def.name}: translucent colored faces + white edges + gold vertex dots; userData.vef stores V/E/F counts; slow spin by default`),
    prompt: L('适合多面体结构观察、欧拉公式(V−E+F=2)探究。挂标签面板显示 V/E/F 让学生数一数、验证。',
      "For polyhedron structure study and Euler's formula (V−E+F=2). Attach a label showing V/E/F for students to count and verify."),
    tags: ['数学', '几何', '多面体', '欧拉', 'math', 'polyhedron', def.name],
    code: { module: 'js/assets/builders.js', symbol: `buildMathSolid(${def.id})` },
    size: { footprint: [2.4, 2.4, 2.4], tris: 'low' },
    build: () => B.buildMathSolid(def),
  })),

  // ── 教学标注 ──
  skill({
    id: 'infoPanel', icon: '📋', name: L('参数面板', 'Info Panel'), category: CAT.label,
    description: L('悬浮 3D 参数面板(Canvas 贴图,始终面向学生),显示键值对数据',
      'Floating 3D info panel (canvas texture, always faces the student) showing key-value data'),
    prompt: L('挂在实验或模型旁展示参数/数据;支持 live 函数做实时刷新。任何需要"给学生看数字"的场合都用它。',
      'Place beside experiments or models to show parameters/data; supports a live function for real-time refresh. Use whenever students need to see numbers.'),
    tags: ['面板', 'UI', '数据', '标注', 'panel', 'data'],
    code: { module: 'js/assets/builders.js', symbol: 'buildInfoPanel' },
    size: { footprint: [2.2, 1.2, 0.01], tris: 'low' },
    build: B.buildInfoPanel,
  }),
  skill({
    id: 'taskBoard', icon: '🎯', name: L('任务看板', 'Task Board'), category: CAT.label,
    description: L('探究任务看板:列出学生要完成的观察/猜想/验证步骤',
      'Inquiry task board listing the observe / hypothesize / verify steps for students'),
    prompt: L('每个教学场景建议放一块,把探究式教学的任务写清楚,引导学生主动探索而非被动看。',
      'Recommended in every scene: spell out inquiry tasks so students explore actively instead of just watching.'),
    tags: ['任务', '探究', 'UI', '标注', 'task', 'inquiry'],
    code: { module: 'js/assets/builders.js', symbol: 'buildTaskBoard' },
    size: { footprint: [2.4, 1.4, 0.01], tris: 'low' },
    build: B.buildTaskBoard,
  }),

  // ── 天文 ──
  skill({
    id: 'sun', icon: '☀️', name: L('太阳', 'Sun'), category: CAT.astro,
    description: L('发光的太阳:自发光球体 + 点光源(会真实照亮周围),默认自转',
      'Glowing sun: emissive sphere + point light (really lights up surroundings); spins by default'),
    prompt: L('太阳系场景的中心;它自带光源,放置后周围行星会被照亮。',
      'Center of solar-system scenes; carries its own light so nearby planets get lit.'),
    tags: ['天文', '恒星', '太阳系', 'astronomy', 'star', 'sun'],
    code: { module: 'js/assets/builders.js', symbol: 'buildSun' },
    size: { footprint: [3, 3, 3], tris: 'low' },
    build: B.buildSun,
  }),
  skill({
    id: 'earth', icon: '🌍', name: L('地球', 'Earth'), category: CAT.astro,
    description: L('蓝色行星球体带绿色大陆贴块,默认自转;可通过缩放/换色代表任何行星',
      'Blue planet with green continents, spins by default; rescale/recolor to represent any planet'),
    prompt: L('行星通用模板:改颜色和大小可以当水星/金星等;配合 orbit 动画绕太阳公转。',
      'Generic planet template: change color/size for Mercury, Venus, etc.; add an orbit animation to circle the sun.'),
    tags: ['天文', '行星', '地球', 'planet', 'earth'],
    code: { module: 'js/assets/builders.js', symbol: 'buildPlanet' },
    size: { footprint: [1.7, 1.7, 1.7], tris: 'low' },
    build: () => B.buildPlanet(0.85, 0x3d7bd4, 0x2a9d5c),
  }),
  skill({
    id: 'moon', icon: '🌙', name: L('月球', 'Moon'), category: CAT.astro,
    description: L('灰色小型天体,默认自转', 'Small gray body, spins by default'),
    prompt: L('可配 orbit 动画绕地球转,演示"卫星"概念。', 'Add an orbit animation around Earth to demonstrate satellites.'),
    tags: ['天文', '卫星', '月球', 'moon', 'satellite'],
    code: { module: 'js/assets/builders.js', symbol: 'buildPlanet' },
    size: { footprint: [0.8, 0.8, 0.8], tris: 'low' },
    build: () => B.buildPlanet(0.4, 0xb8bcc4),
  }),
  skill({
    id: 'mars', icon: '🔴', name: L('火星', 'Mars'), category: CAT.astro,
    description: L('红棕色行星,默认自转', 'Reddish-brown planet, spins by default'),
    prompt: L('太阳系场景成员;红色便于学生辨认。', 'Solar-system member; red color makes it easy to identify.'),
    tags: ['天文', '行星', '火星', 'mars'],
    code: { module: 'js/assets/builders.js', symbol: 'buildPlanet' },
    size: { footprint: [1.2, 1.2, 1.2], tris: 'low' },
    build: () => B.buildPlanet(0.6, 0xc0533a),
  }),
  skill({
    id: 'saturn', icon: '🪐', name: L('土星', 'Saturn'), category: CAT.astro,
    description: L('带半透明光环的行星,默认自转', 'Planet with translucent rings, spins by default'),
    prompt: L('光环是学生兴趣点,适合放在太阳系外圈讲"气态巨行星"。',
      'The rings hook student interest; place in the outer orbit to teach gas giants.'),
    tags: ['天文', '行星', '土星', '光环', 'saturn', 'rings'],
    code: { module: 'js/assets/builders.js', symbol: 'buildSaturn' },
    size: { footprint: [3.4, 1.6, 3.4], tris: 'low' },
    build: B.buildSaturn,
  }),
  skill({
    id: 'rocket', icon: '🚀', name: L('火箭', 'Rocket'), category: CAT.astro,
    description: L('红白配色卡通火箭,带喷焰,默认上下悬浮动画', 'Red-and-white cartoon rocket with flame; hovers by default'),
    prompt: L('航天主题的氛围道具,也可作为"发射"叙事的主角。', 'Space-theme prop; can also star in a launch storyline.'),
    tags: ['天文', '航天', '火箭', 'rocket', 'space'],
    code: { module: 'js/assets/builders.js', symbol: 'buildRocket' },
    size: { footprint: [1, 2.8, 1], tris: 'low' },
    build: B.buildRocket,
  }),

  // ── 化学 ──
  skill({
    id: 'h2o', icon: '💧', name: L('水分子', 'Water Molecule'), category: CAT.chem,
    description: L('H₂O 球棍模型:红色氧原子 + 两个白色氢原子,角形结构(104.5°),默认自转',
      'H₂O ball-and-stick model: red oxygen + two white hydrogens, bent shape (104.5°), spins by default'),
    prompt: L('讲分子形状时与 CO₂(直线形)对比;可挂面板标注化学式/键角。',
      'Contrast with CO₂ (linear) when teaching molecular geometry; attach a panel for formula/bond angle.'),
    tags: ['化学', '分子', '水', 'H2O', 'chemistry', 'molecule', 'water'],
    code: { module: 'js/assets/builders.js', symbol: 'buildWater' },
    size: { footprint: [2, 1.5, 1], tris: 'low' },
    build: B.buildWater,
  }),
  skill({
    id: 'co2', icon: '💨', name: L('二氧化碳', 'Carbon Dioxide'), category: CAT.chem,
    description: L('CO₂ 球棍模型:黑色碳原子 + 两个红色氧原子,直线形结构(180°),双键表示,默认自转',
      'CO₂ ball-and-stick model: black carbon + two red oxygens, linear (180°), double bonds shown, spins by default'),
    prompt: L('与水分子对比讲分子几何;双键用两根平行棒表示。',
      'Compare with water for molecular geometry; double bonds shown as two parallel rods.'),
    tags: ['化学', '分子', '二氧化碳', 'CO2', 'molecule'],
    code: { module: 'js/assets/builders.js', symbol: 'buildCO2' },
    size: { footprint: [3, 1, 1], tris: 'low' },
    build: B.buildCO2,
  }),
  skill({
    id: 'ch4', icon: '🔥', name: L('甲烷', 'Methane'), category: CAT.chem,
    description: L('CH₄ 球棍模型:正四面体结构,黑碳白氢,默认自转',
      'CH₄ ball-and-stick model: tetrahedral, black carbon & white hydrogens, spins by default'),
    prompt: L('讲正四面体键角(109.5°)与有机物入门。', 'Teach the tetrahedral bond angle (109.5°) and intro organic chemistry.'),
    tags: ['化学', '分子', '甲烷', 'CH4', '有机', 'methane', 'organic'],
    code: { module: 'js/assets/builders.js', symbol: 'buildMethane' },
    size: { footprint: [2.2, 2.2, 2.2], tris: 'low' },
    build: B.buildMethane,
  }),
  skill({
    id: 'beaker', icon: '🧪', name: L('烧杯', 'Beaker'), category: CAT.chem,
    description: L('透明玻璃烧杯,内有蓝色发光液体', 'Transparent glass beaker with glowing blue liquid'),
    prompt: L('实验台氛围道具;正式实验容器请用制氧实验里的专用装置。',
      'Lab-bench prop; for real experiments use the dedicated apparatus in the oxygen lab.'),
    tags: ['化学', '器材', '烧杯', 'beaker', 'glassware'],
    code: { module: 'js/assets/builders.js', symbol: 'buildBeaker' },
    size: { footprint: [1.1, 1.3, 1.1], tris: 'low' },
    build: B.buildBeaker,
  }),
  skill({
    id: 'flask', icon: '⚗️', name: L('锥形瓶', 'Flask'), category: CAT.chem,
    description: L('透明锥形瓶,内有绿色液体', 'Transparent conical flask with green liquid'),
    prompt: L('实验台氛围道具。', 'Lab-bench prop.'),
    tags: ['化学', '器材', '锥形瓶', 'flask', 'glassware'],
    code: { module: 'js/assets/builders.js', symbol: 'buildFlask' },
    size: { footprint: [1.3, 1.6, 1.3], tris: 'low' },
    build: B.buildFlask,
  }),
  skill({
    id: 'atom', icon: '⚛️', name: L('原子模型', 'Atom Model'), category: CAT.chem,
    description: L('玻尔原子模型:橙色原子核 + 三条发光电子轨道,默认快速自转',
      'Bohr atom model: orange nucleus + three glowing electron orbits, fast spin by default'),
    prompt: L('讲原子结构/电子层;注意这是玻尔模型(教学简化),不是电子云模型。',
      'Teach atomic structure/electron shells; note this is the simplified Bohr model, not the electron cloud model.'),
    tags: ['化学', '物理', '原子', '电子', 'atom', 'electron'],
    code: { module: 'js/assets/builders.js', symbol: 'buildAtom' },
    size: { footprint: [2.4, 2.4, 2.4], tris: 'low' },
    build: B.buildAtom,
  }),

  // ── 物理 ──
  skill({
    id: 'pendulum', icon: '🕰', name: L('单摆', 'Pendulum'), category: CAT.phys,
    description: L('木架单摆:摆绳+金色摆锤挂在 pivot 上,swing 动画按角频率摆动',
      'Wooden-frame pendulum: rope + gold bob on a pivot; swing animation follows the angular frequency'),
    prompt: L('简谐运动教学核心资源。缩放整体即改变摆长;按 T=2π√(L/g) 换算 speed(ω=√(g/L))可获得物理正确的周期。多个不同摆长的摆并排对比效果最好。',
      'Core asset for simple harmonic motion. Scaling changes the length; set speed via ω=√(g/L) from T=2π√(L/g) for physically correct periods. Best shown as several lengths side by side.'),
    tags: ['物理', '力学', '单摆', '简谐', '周期', 'pendulum', 'physics'],
    code: { module: 'js/assets/builders.js', symbol: 'buildPendulum' },
    size: { footprint: [2.6, 3.2, 0.5], tris: 'low' },
    build: B.buildPendulum,
  }),
  skill({
    id: 'ramp', icon: '📐', name: L('斜面', 'Ramp'), category: CAT.phys,
    description: L('蓝色斜面 + 红色小球,ramp 动画让小球循环滚落', 'Blue ramp + red ball; ramp animation rolls the ball down repeatedly'),
    prompt: L('讲斜面加速度 a=g·sinθ;纵向缩放(scale.y)可改变倾角,两个不同倾角并排对比。',
      'Teach a=g·sinθ; scale.y changes the incline. Compare two ramps with different angles side by side.'),
    tags: ['物理', '力学', '斜面', '加速度', 'ramp', 'acceleration'],
    code: { module: 'js/assets/builders.js', symbol: 'buildRamp' },
    size: { footprint: [3, 1.6, 1.4], tris: 'low' },
    build: B.buildRamp,
  }),
  skill({
    id: 'spring', icon: '〰️', name: L('弹簧', 'Spring'), category: CAT.phys,
    description: L('金属弹簧 + 橙色砝码,bounce 动画做压缩-回弹循环', 'Metal spring + orange weight; bounce animation cycles compress-rebound'),
    prompt: L('讲弹力/胡克定律/振动;speed 控制振动频率。', "Teach elastic force / Hooke's law / oscillation; speed sets the frequency."),
    tags: ['物理', '力学', '弹簧', '弹力', '振动', 'spring', 'oscillation'],
    code: { module: 'js/assets/builders.js', symbol: 'buildSpring' },
    size: { footprint: [0.9, 2.2, 0.9], tris: 'mid' },
    build: B.buildSpring,
  }),
  skill({
    id: 'magnet', icon: '🧲', name: L('磁铁', 'Magnet'), category: CAT.phys,
    description: L('红色 U 形磁铁,白色为磁极端', 'Red U-shaped magnet with white pole tips'),
    prompt: L('磁场教学道具(静态);讲 N/S 极概念。', 'Static prop for magnetism; teach N/S poles.'),
    tags: ['物理', '磁', '磁铁', 'magnet'],
    code: { module: 'js/assets/builders.js', symbol: 'buildMagnet' },
    size: { footprint: [1.9, 1.4, 0.5], tris: 'low' },
    build: B.buildMagnet,
  }),
  skill({
    id: 'lever', icon: '⚖️', name: L('杠杆', 'Lever'), category: CAT.phys,
    description: L('支点 + 倾斜木板 + 两侧不同重物,静态演示杠杆平衡',
      'Fulcrum + tilted plank + different weights; static demo of lever balance'),
    prompt: L('讲杠杆原理/力矩;蓝色方块重、红色小球轻,板向重侧倾斜。',
      'Teach the lever principle / torque; blue block is heavy, red ball light, plank tilts to the heavy side.'),
    tags: ['物理', '力学', '杠杆', '力矩', 'lever', 'torque'],
    code: { module: 'js/assets/builders.js', symbol: 'buildLever' },
    size: { footprint: [4, 1.7, 0.7], tris: 'low' },
    build: B.buildLever,
  }),

  // ── 生物 ──
  skill({
    id: 'dna', icon: '🧬', name: L('DNA双螺旋', 'DNA Double Helix'), category: CAT.bio,
    description: L('DNA 双螺旋:灰白骨架小球 + 四色碱基对横杆(A-T/G-C 配色),默认自转',
      'DNA double helix: gray backbone beads + four-color base-pair rungs (A-T/G-C), spins by default'),
    prompt: L('讲碱基互补配对;放大后学生在 VR 里可以"走进"分子内部,配合图例面板讲 A-T/G-C 规则。',
      'Teach complementary base pairing; scale it up so students can walk inside in VR, with a legend panel for A-T/G-C rules.'),
    tags: ['生物', 'DNA', '遗传', '双螺旋', 'biology', 'genetics'],
    code: { module: 'js/assets/builders.js', symbol: 'buildDNA' },
    size: { footprint: [1.4, 3.6, 1.4], tris: 'mid' },
    build: B.buildDNA,
  }),
  skill({
    id: 'cell', icon: '🦠', name: L('细胞', 'Cell'), category: CAT.bio,
    description: L('半透明细胞膜 + 紫色细胞核 + 绿色细胞器,默认缓速自转',
      'Translucent membrane + purple nucleus + green organelles, slow spin by default'),
    prompt: L('讲细胞结构;半透明膜让学生看到内部;可与 DNA 并排讲"DNA 在细胞核里"。',
      'Teach cell structure; the translucent membrane reveals the inside; pair with DNA to show "DNA lives in the nucleus".'),
    tags: ['生物', '细胞', '细胞核', 'cell', 'nucleus'],
    code: { module: 'js/assets/builders.js', symbol: 'buildCell' },
    size: { footprint: [2.6, 2.6, 2.6], tris: 'low' },
    build: B.buildCell,
  }),
  skill({
    id: 'tree', icon: '🌳', name: L('树木', 'Tree'), category: CAT.bio,
    description: L('低多边形树:棕色树干 + 三球树冠', 'Low-poly tree: brown trunk + three-sphere canopy'),
    prompt: L('生态/环境主题的氛围道具。', 'Ambience prop for ecology/environment themes.'),
    tags: ['生物', '植物', '树', 'tree', 'plant'],
    code: { module: 'js/assets/builders.js', symbol: 'buildTree' },
    size: { footprint: [2, 2.8, 2], tris: 'low' },
    build: B.buildTree,
  }),

  // ── 教室环境 ──
  skill({
    id: 'desk', icon: '🪑', name: L('课桌', 'Desk'), category: CAT.room,
    description: L('木质桌面 + 金属桌腿的课桌,桌面高 1m', 'Desk with wooden top and metal legs, 1 m tall'),
    prompt: L('教室/实验室场景的基础家具;器材放桌上时 y 设为 1.05 左右。',
      'Basic furniture for classroom/lab scenes; put equipment on top at y ≈ 1.05.'),
    tags: ['教室', '家具', '桌子', 'desk', 'furniture'],
    code: { module: 'js/assets/builders.js', symbol: 'buildDesk' },
    size: { footprint: [1.6, 1.05, 0.9], tris: 'low' },
    build: B.buildDesk,
  }),
  skill({
    id: 'whiteboard', icon: '📋', name: L('白板', 'Whiteboard'), category: CAT.room,
    description: L('带支架的白色演示板', 'White presentation board on a stand'),
    prompt: L('教室场景道具,可作为讲解的视觉锚点。', 'Classroom prop; a visual anchor for explanations.'),
    tags: ['教室', '白板', '演示', 'whiteboard'],
    code: { module: 'js/assets/builders.js', symbol: 'buildWhiteboard' },
    size: { footprint: [3.2, 2.8, 0.6], tris: 'low' },
    build: B.buildWhiteboard,
  }),
  skill({
    id: 'globe', icon: '🗺', name: L('地球仪', 'Globe'), category: CAT.room,
    description: L('带底座和倾斜轴的地球仪,默认自转', 'Globe with base and tilted axis, spins by default'),
    prompt: L('地理/天文教学道具;自转轴倾斜还原真实地球仪。', 'Geography/astronomy prop; the tilted axis matches a real globe.'),
    tags: ['教室', '地理', '地球仪', 'globe', 'geography'],
    code: { module: 'js/assets/builders.js', symbol: 'buildGlobe' },
    size: { footprint: [1.2, 1.7, 1.2], tris: 'low' },
    build: B.buildGlobe,
  }),
];

// ── 查询接口 ──
export function findAssetSkill(id) {
  return ASSET_SKILLS.find(a => a.id === id) || null;
}

export function assetsByCategory() {
  const map = {};
  ASSET_SKILLS.forEach(a => (map[a.category] ??= []).push(a));
  return map;
}

// 给 LLM 的资源清单(紧凑格式,节省 token)
export function assetCatalogForLLM() {
  return ASSET_SKILLS.map(a =>
    `- ${a.id} (${a.name}, ${a.category}): ${a.description}${L('。用法:', '. Usage: ')}${a.prompt}`
  ).join('\n');
}
