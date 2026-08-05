// ═══════════════════════════════════════════════════════════════
//  创建类工具:往场景里"添东西"
//  add_asset(资源库)/ create_custom_object(AI 写代码现场造)/
//  set_behavior(给已有对象补行为代码)/ build_template(预置模板)
// ═══════════════════════════════════════════════════════════════
import { addAsset, clearScene, findObject, setMainColor } from '../../scene/manager.js';
import { assetCatalogForLLM } from '../../assets/registry.js';
import { findScenario, scenarioCatalogForLLM } from '../../labs/scenarios.js';
import { assignOid, markTouched } from '../../core/state.js';
import { emit } from '../../core/events.js';
import { sceneRoot } from '../../core/three-setup.js';
import { sceneToJSON } from '../context.js';
import { runBuilderCode, compileUpdate, compileClick, compileHandler } from '../sandbox.js';
import { L } from '../../core/i18n.js';
import { ok, fail } from './shared.js';

export default [
  {
    name: 'add_asset',
    label: inp => L(`添加资源 ${inp.asset_id}${inp.name ? `(${inp.name})` : ''}`, `Add asset ${inp.asset_id}${inp.name ? ` (${inp.name})` : ''}`),
    description: `从资源库添加一个对象到场景。可用资源(asset_id):\n${assetCatalogForLLM()}`,
    input_schema: {
      type: 'object',
      properties: {
        asset_id: { type: 'string', description: '资源 id,如 sun / pendulum / desk' },
        x: { type: 'number' }, z: { type: 'number' },
        y: { type: 'number', description: '可选,不填用资源默认高度' },
        name: { type: 'string', description: '可选,自定义显示名' },
        scale: { type: 'number' },
        color: { type: 'string', description: '可选,十六进制色 #rrggbb' },
        anim: {
          type: 'object', description: '可选动画 {type: spin|orbit|swing|float|bounce, speed, radius?, cx?, cz?, amplitude?}',
          properties: { type: { type: 'string' }, speed: { type: 'number' }, radius: { type: 'number' }, cx: { type: 'number' }, cz: { type: 'number' }, amplitude: { type: 'number' } },
        },
      },
      required: ['asset_id'],
    },
    exec(inp) {
      const obj = addAsset(inp.asset_id, { x: inp.x ?? 0, z: inp.z ?? 0 }, true);
      if (!obj) return fail(L(`资源 ${inp.asset_id} 不存在`, `Asset ${inp.asset_id} not found`));
      if (inp.y !== undefined) obj.position.y = inp.y;
      if (inp.name) obj.userData.displayName = inp.name;
      if (inp.scale) obj.scale.setScalar(inp.scale);
      if (inp.color) setMainColor(obj, inp.color);
      if (inp.anim) obj.userData.anim = { angle: Math.random() * 6.28, ...inp.anim };
      markTouched(obj);
      emit('hierarchy-changed');
      return ok(L(
        `已添加 ${obj.userData.displayName}(oid=${obj.userData.oid})`,
        `Added ${obj.userData.displayName} (oid=${obj.userData.oid})`
      ));
    },
  },
  {
    name: 'create_custom_object',
    label: inp => L(`编写代码生成「${inp.name}」`, `Code & generate "${inp.name}"`),
    description: `【最强工具】直接编写 Three.js 代码,现场生成资源库里没有的精细对象(自定义几何/材质/粒子/动画/交互)。
何时用:资源库没有合适资源,或需要比预制件更精致的模型/更复杂的行为时。不要因为资源库没有就用简陋的基础形状将就——写代码造出来。
【颗粒度】一次调用只造一个逻辑实体(一个装置/一个营养级/一根管道/一块面板)。整个系统(生态圈/电路/太阳系)= 多次调用分别造各实体,跨实体共享状态放一个"控制器"对象的 userData 里,各实体从控制器读数据。禁止把整套系统塞进一个对象——那会变成老师无法微调、你改一处就得整体重写的黑盒。
代码规范(code 字段是一个 JS 函数体):
- 可用 T 工具箱:T.THREE、T.mat(color,{transparent,opacity,roughness,metalness,emissive,side})、T.mesh(geo,mat)、T.bond(p1,p2,r,color)、T.group()、T.attachLabel(obj,{title,lines,live,accent,width})(live:()=>行数组,每0.15s刷新,做实时数据面板)、T.toast(msg)、T.say(html);玩家感知:T.playerPos()(学生地面位置 Vector3)、T.distToPlayer(obj)(水平距离,近接触发用)、T.overlaps(a,b,margin)(包围盒相交,投放判定用);THREE 也可直接用
- 需要挡住学生走动的实体(墙/栅栏/大型家具)设 obj.userData.solid = true,学生瞬移/走动会被它拦住
- 必须 return 一个 THREE.Object3D(通常是 group 组合多个部件);对象内部自定位,整体落在原点、贴地(y=0 为地面)
- 每帧动画:构建时设 obj.userData.customUpdate = (dt, t, obj) => {...}(t 是全局秒数)
- 学生交互写"语义事件"(设备无关,PC 鼠标与 VR 手柄由平台自动映射,不要写鼠标/手柄相关代码):
  · 点击/扳机:obj.userData.customClick = (obj) => {...};状态存 obj.userData 里(如 step 状态机),配合 T.toast/T.say 给反馈
  · 抓取(可搬动教具):obj.userData.onGrab / onDrag / onRelease = (obj, detail) => {...};detail.point 是世界坐标,drag 时常用 obj.position.copy(detail.point)
- customUpdate 里条件触发的 T.say/T.toast 必须加闩锁 latch(userData 存 flag,状态边沿只播一次,复位才清),否则每帧触发会刷爆聊天区
- 尺寸符合真实感(整体 0.5~4 米);玻璃器皿用 transparent:true, opacity:0.25~0.4, roughness:0.05
- 三角面控制在中低多边形(段数 ≤32),VR 端要流畅`,
    input_schema: {
      type: 'object',
      properties: {
        name: { type: 'string', description: '中文显示名' },
        icon: { type: 'string', description: '一个 emoji 图标' },
        description: { type: 'string', description: '给老师看的一句话:这是什么、有什么行为(会显示在自然语言 Inspector 里)' },
        code: { type: 'string', description: 'JS 函数体,见工具说明' },
        x: { type: 'number' }, y: { type: 'number' }, z: { type: 'number' },
        scale: { type: 'number' },
      },
      required: ['name', 'code'],
    },
    exec(inp) {
      let obj;
      try { obj = runBuilderCode(inp.code); }
      catch (e) {
        return fail(L(`构建代码执行失败:${e.message}。请修正代码后重新调用`,
          `Builder code failed: ${e.message}. Fix and retry`));
      }
      assignOid(obj);
      obj.userData.custom = true;
      obj.userData.icon = inp.icon || '🧩';
      obj.userData.displayName = inp.name;
      obj.userData.behaviorDesc = inp.description || '';
      obj.userData.builderCode = inp.code;
      if (inp.x !== undefined) obj.position.x = inp.x;
      if (inp.y !== undefined) obj.position.y = inp.y;
      if (inp.z !== undefined) obj.position.z = inp.z;
      if (inp.scale) obj.scale.setScalar(inp.scale);
      sceneRoot.add(obj);
      markTouched(obj);
      emit('hierarchy-changed');
      const feats = [];
      if (obj.userData.customUpdate) feats.push(L('每帧动画', 'per-frame animation'));
      if (obj.userData.customClick) feats.push(L('点击交互', 'click interaction'));
      return ok(L(
        `已生成自定义对象 ${inp.name}(oid=${obj.userData.oid}${feats.length ? ',含' + feats.join('+') : ''})`,
        `Created custom object ${inp.name} (oid=${obj.userData.oid}${feats.length ? ', with ' + feats.join(' + ') : ''})`
      ));
    },
  },
  {
    name: 'set_behavior',
    label: inp => inp.remove
      ? L(`清除 ${inp.ref} 的自定义行为`, `Clear custom behavior of ${inp.ref}`)
      : L(`为 ${inp.ref} 编写行为脚本`, `Write behavior script for ${inp.ref}`),
    description: `给场景中任意已有对象(含资源库对象)编写/覆盖自定义行为代码。交互一律写"语义事件"(设备无关:PC 鼠标与 VR 手柄由平台自动映射,不要写任何鼠标/手柄相关代码):
- update_code:每帧执行的函数体,可用 (dt, t, obj, T, THREE);驱动自定义动画/模拟
- click_code:activate 语义事件(PC 点击 / VR 扳机)的函数体,可用 (obj, T, THREE);状态存 obj.userData
- grab_code / drag_code / release_code:抓取语义事件(PC 按住拖动 / VR 手柄抓握)的函数体,可用 (obj, detail, T, THREE);detail.point 是世界坐标(drag 时为拖动目标点,常用 obj.position.copy(detail.point) 实现可搬动教具)
- T 工具箱含玩家感知助手:T.playerPos() / T.distToPlayer(obj) / T.overlaps(a,b,margin) —— 近接触发(学生靠近就…)与投放判定(放进容器就…)用它们
- update_code 里条件触发的 T.say/T.toast 必须加闩锁 latch(userData 存 flag,状态边沿只播一次,复位才清),否则每帧触发会刷爆聊天区
- 均可选;传 remove:true 清除该对象全部自定义行为
- 【描述必须同步】改了行为就必须同时传 description 更新描述——它既给老师看,也是大场景下检索该对象的索引,过期描述会导致后续轮次找错对象`,
    input_schema: {
      type: 'object',
      properties: {
        ref: { type: 'string', description: '对象 oid 或名称' },
        description: { type: 'string', description: '行为描述(给老师看 + 检索索引);修改了行为代码时必填,保持与最新行为一致' },
        update_code: { type: 'string' },
        click_code: { type: 'string' },
        grab_code: { type: 'string' },
        drag_code: { type: 'string' },
        release_code: { type: 'string' },
        remove: { type: 'boolean' },
      },
      required: ['ref'],
    },
    exec(inp) {
      const obj = findObject(inp.ref);
      if (!obj) return fail(L(`找不到对象 ${inp.ref}`, `Object not found: ${inp.ref}`));
      const ud = obj.userData;
      if (inp.remove) {
        delete ud.customUpdate; delete ud.customClick; delete ud.savedCustomUpdate; delete ud.savedCustomClick;
        delete ud.onGrab; delete ud.onDrag; delete ud.onRelease;
        delete ud.behaviorDesc; delete ud.updateCode; delete ud.clickCode;
        delete ud.grabCode; delete ud.dragCode; delete ud.releaseCode;
        emit('hierarchy-changed');
        return ok(L(
          `已清除 ${ud.displayName} 的自定义行为`,
          `Cleared custom behavior on ${ud.displayName}`
        ));
      }
      try {
        if (inp.update_code) { ud.customUpdate = compileUpdate(inp.update_code); ud.updateCode = inp.update_code; delete ud.savedCustomUpdate; }
        if (inp.click_code) { ud.customClick = compileClick(inp.click_code); ud.clickCode = inp.click_code; delete ud.savedCustomClick; }
        if (inp.grab_code) { ud.onGrab = compileHandler(inp.grab_code); ud.grabCode = inp.grab_code; }
        if (inp.drag_code) { ud.onDrag = compileHandler(inp.drag_code); ud.dragCode = inp.drag_code; }
        if (inp.release_code) { ud.onRelease = compileHandler(inp.release_code); ud.releaseCode = inp.release_code; }
      } catch (e) { return fail(L(
        `行为代码编译失败:${e.message}。请修正后重试`,
        `Behavior code compile failed: ${e.message}. Fix and retry`
      )); }
      if (inp.description) ud.behaviorDesc = inp.description;
      markTouched(obj);
      emit('hierarchy-changed');
      const setZh = [inp.update_code && '每帧行为', inp.click_code && '点击交互', (inp.grab_code || inp.drag_code) && '抓取交互'].filter(Boolean);
      const setEn = [inp.update_code && 'per-frame behavior', inp.click_code && 'click interaction', (inp.grab_code || inp.drag_code) && 'grab interaction'].filter(Boolean);
      return ok(L(
        `已为 ${ud.displayName} 设置${setZh.join('和') || '行为'}`,
        `Set ${setEn.join(' and ') || 'behavior'} for ${ud.displayName}`
      ));
    },
  },
  {
    name: 'build_template',
    label: inp => L(`生成场景模板 ${inp.template_id}`, `Build scene template ${inp.template_id}`),
    description: `一键生成预置教学场景模板(会先清空当前场景)。可用模板:\n${scenarioCatalogForLLM()}\n当老师的需求与某个模板高度吻合时优先用模板(质量最高);需要微调时先 build_template 再用其他工具修改。`,
    input_schema: { type: 'object', properties: { template_id: { type: 'string' } }, required: ['template_id'] },
    exec(inp) {
      const s = findScenario(inp.template_id);
      if (!s) return fail(L(`模板 ${inp.template_id} 不存在`, `Template ${inp.template_id} not found`));
      s.run();
      const sceneList = JSON.stringify(sceneToJSON().objects.map(o => o.oid + ':' + o.name));
      return ok(L(
        `已生成模板「${s.name}」。当前场景:${sceneList}`,
        `Built template "${s.name}". Current scene: ${sceneList}`
      ));
    },
  },
  {
    name: 'clear_scene',
    label: () => L('清空场景', 'Clear the scene'),
    description: '清空场景中的所有对象。',
    input_schema: { type: 'object', properties: {} },
    exec() { clearScene(); return ok(L('场景已清空', 'Scene cleared')); },
  },
];
