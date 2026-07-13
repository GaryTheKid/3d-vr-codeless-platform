// 技能:精细建模(Three.js 代码造模型的高质量配方)
// ⚠ 注册表写法 + 零依赖(原因见 scene-organization.js 头注释),不要加 import/export
(globalThis.XR_AGENT_SKILLS ??= []).push({
  id: 'custom-modeling',
  name: '精细建模',
  description: '写 Three.js 代码造精致模型(几何/材质/粒子配方)',
  prompt: `【精细建模技能】create_custom_object 的高质量配方:
- 【颗粒度】每次调用只造"一个逻辑实体"(一个装置/一个生物群/一根管道/一块面板)。系统级需求(生态圈/电路)= 多次调用分别造各实体 + 一个控制器对象,绝不把整个系统塞进一次调用;后续用户要改哪个实体,只重造那一个
- 回转体(烧瓶/锥形瓶/试管/漏斗):LatheGeometry 车出轮廓,如 new THREE.LatheGeometry(points.map(p=>new THREE.Vector2(p[0],p[1])), 24);轮廓点从底到口
- 弯管/导管/磁感线/轨迹:CatmullRomCurve3 串关键点 + TubeGeometry,如 new THREE.TubeGeometry(new THREE.CatmullRomCurve3([v1,v2,...]), 32, 0.04, 8)
- 玻璃:T.mat(0xbfd9e8,{transparent:true,opacity:0.3,roughness:0.05});液体:opacity 0.5~0.7;发光体加 emissive 与 emissiveIntensity
- 粒子(气泡/火花/能量流):循环建 8~20 个小球存进数组挂 userData,在 customUpdate 里推进位置、越界回起点;体现"流动/产生"比静态贴图强得多
- 多部件用 T.group() 组合并各自命名(child.name),点击态变化时能 traverse 找到
- 环形排布 N 个对象:for(i){a=i/N*Math.PI*2; pos=(cos(a)*r, y, sin(a)*r)}
- 【防 z-fighting】任何水平薄面(地毯/垫子/平台/自制地板)绝不与地面或其他水平面共面:底面至少抬高 0.02 米(如地毯 y=0.03),叠放的面之间也留 ≥0.02 差
- 段数 ≤32、单对象网格数 ≤40,VR 端才流畅`,
  nameEn: 'Detailed Modeling',
  descriptionEn: 'Write Three.js code for refined models (geometry/material/particle recipes)',
  promptEn: `[Detailed Modeling] High-quality recipes for create_custom_object:
- [Granularity] one call builds "one logical entity" (one apparatus/one biome group/one pipe/one panel). System-level requests (ecosystem/circuit) = multiple calls for the entities + one controller object; never stuff a whole system into one call — later the user edits one entity and you rebuild only that one
- Solids of revolution (flask/conical flask/test tube/funnel): lathe the profile with LatheGeometry, e.g. new THREE.LatheGeometry(points.map(p=>new THREE.Vector2(p[0],p[1])), 24); profile from base to mouth
- Bent tubes/conduits/field lines/trajectories: CatmullRomCurve3 through key points + TubeGeometry, e.g. new THREE.TubeGeometry(new THREE.CatmullRomCurve3([v1,v2,...]), 32, 0.04, 8)
- Glass: T.mat(0xbfd9e8,{transparent:true,opacity:0.3,roughness:0.05}); liquids: opacity 0.5~0.7; glowing bodies add emissive and emissiveIntensity
- Particles (bubbles/sparks/energy flow): build 8~20 small spheres in a loop, keep them in an array on userData, advance them in customUpdate and wrap around at bounds; showing "flow/production" beats any static texture
- Compose parts with T.group() and name each part (child.name) so click-state changes can traverse to them
- Ring layout of N objects: for(i){a=i/N*Math.PI*2; pos=(cos(a)*r, y, sin(a)*r)}
- [Anti z-fighting] never make thin horizontal surfaces (rugs/mats/platforms/custom floors) coplanar with the ground or each other: lift the underside by ≥0.02 m (e.g. a rug at y=0.03), and keep ≥0.02 m between stacked surfaces
- Segments ≤32, meshes per object ≤40 to stay smooth in VR`,
});
