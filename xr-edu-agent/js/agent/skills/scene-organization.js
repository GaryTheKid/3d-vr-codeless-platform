// 技能:场景组织(空间布局 + 对象颗粒度铁律)
// ⚠ 注册表写法 + 零依赖:本文件既被 index.js 当 ES Module import(应用),
//   又被 agent-viewer-skills.html 当普通 <script> 加载(file:// 纯本地查看),不要加 import/export
(globalThis.XR_AGENT_SKILLS ??= []).push({
  id: 'scene-organization',
  name: '场景组织',
  description: '多对象场景的空间布局原则',
  prompt: `【场景组织技能】
- 教学主体放在原点附近(0,±3 范围),辅助面板放两侧(|x|>4)或后方(z<-2.5)
- 对象间距至少留出其包围盒宽度,避免穿插;成组对比的对象等距排列(如 x=-4.2/0/4.2)
- 地面 y=0;对象默认高度已由资源内置,不要随意改 y,除非要放到桌面上(y≈1.05)
- 场景对象控制在 15 个以内,保证 VR 端性能与认知负荷
- 【颗粒度铁律】一个场景对象 = 一个逻辑实体,不太大也不太小:
  ✅ 好:一个储氢罐、一个原子、一个营养级、一根能量管道、一块面板 → 各是独立对象
  ❌ 差:整条食物链/整个太阳系/整套系统塞进一个对象(老师改一处就得整体重造;层级面板里是不可拆的黑盒)
  ❌ 也差:把一片叶子、一颗铆钉各拆成对象(层级刷屏)
- 系统类场景(生态圈/电路/产线)按逻辑实体拆成多个对象 + 一个"控制器"对象持共享状态(见实验逻辑技能);好处:老师能单独删/改某个实体,你修一根管道时不必动生物`,
  nameEn: 'Scene Organization',
  descriptionEn: 'Spatial layout principles for multi-object scenes',
  promptEn: `[Scene Organization]
- Put the teaching subject near the origin (within 0,±3); auxiliary panels at the sides (|x|>4) or behind (z<-2.5)
- Keep at least a bounding-box width between objects to avoid interpenetration; comparison groups evenly spaced (e.g. x=-4.2/0/4.2)
- Ground is y=0; default heights are built into assets — don't change y unless placing on a desk (y≈1.05)
- Keep the scene within 15 objects for VR performance and cognitive load
- [Granularity rule] one scene object = one logical entity, neither too big nor too small:
  ✅ Good: a hydrogen tank, an atom, a trophic level, an energy pipe, a panel → each its own object
  ❌ Bad: a whole food chain / solar system / entire apparatus crammed into one object (the teacher must rebuild everything to tweak one part; it's an unsplittable black box in the hierarchy)
  ❌ Also bad: a single leaf or rivet as its own object (hierarchy spam)
- For system scenes (ecosystem/circuit/production line), split into entities + one "controller" object holding shared state (see Experiment Logic); the teacher can then delete/edit one entity alone, and fixing one pipe never touches the creatures`,
});
