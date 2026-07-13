// ═══════════════════════════════════════════════════════════════
//  空间引导类工具:确定性几何图元,不需要模型写代码
//  add_arrow(箭头)/ add_path(路线·轨迹·线条)/ build_room(房间壳)
//  这些图元既可以是场景内容(轨迹演示),也可以是教学引导(提示/导览路线)
// ═══════════════════════════════════════════════════════════════
import { sceneRoot } from '../../core/three-setup.js';
import { assignOid, markTouched } from '../../core/state.js';
import { emit } from '../../core/events.js';
import { buildArrow, buildPath } from '../../scene/guides.js';
import { buildRoom, buildStairs } from '../../scene/rooms.js';
import { L } from '../../core/i18n.js';
import { ok, fail } from './shared.js';

// 图元落场景的公共收尾:oid / 名称 / 图标 / 描述 / 工作集
function place(obj, { name, icon, description, role, kind }) {
  assignOid(obj);
  obj.userData.icon = icon;
  obj.userData.displayName = name;
  obj.userData.behaviorDesc = description || '';
  if (role) obj.userData.guideRole = role;   // content=场景内容 | guide=教学引导
  if (kind) obj.userData.guideKind = kind;   // arrow | path(path 且非 content 在运行/导出中隐藏)
  sceneRoot.add(obj);
  markTouched(obj);
  emit('hierarchy-changed');
  return obj;
}

const point3 = {
  type: 'object',
  properties: { x: { type: 'number' }, y: { type: 'number' }, z: { type: 'number' } },
  required: ['x', 'z'],
};

export default [
  {
    name: 'add_arrow',
    label: inp => L(`添加箭头「${inp.name || '箭头'}」`, `Add arrow "${inp.name || 'arrow'}"`),
    description: `添加一支 3D 箭头(from → to 的确定性几何,不要用 create_custom_object 手写箭头)。
用途双轨:场景内容(受力方向/光线路径/流程指向)或教学引导(role=guide,如"看这里"提示、指向下一个观察点)。
- from/to 是世界坐标(y 不填默认 0);curve_height>0 时箭头拱起为弧(抛物线/跳跃轨迹示意)
- 引导用途建议醒目色(#f0c840 黄 / #4fd6ff 青),内容用途按学科语义选色(如受力红)
- 生成后箭头是普通对象:可拖动/缩放/删除,也可再用 update_object 改`,
    input_schema: {
      type: 'object',
      properties: {
        name: { type: 'string', description: '显示名,如「提示箭头」「重力方向」' },
        from: point3,
        to: point3,
        color: { type: 'string', description: '十六进制色 #rrggbb,默认 #f0c840' },
        width: { type: 'number', description: '箭杆半径(米),默认 0.06' },
        curve_height: { type: 'number', description: '>0 时拱起为弧线箭头(拱顶高出直线的米数)' },
        role: { type: 'string', enum: ['content', 'guide'], description: 'content=场景内容;guide=教学引导(提示/导航)' },
        description: { type: 'string', description: '一句话:这支箭头指什么、为什么(给老师看+检索索引)' },
      },
      required: ['name', 'from', 'to'],
    },
    exec(inp) {
      if (!inp.from || !inp.to) return fail('from/to 必填');
      const obj = buildArrow({
        from: inp.from, to: inp.to,
        color: inp.color ? parseInt(inp.color.replace('#', ''), 16) : undefined,
        width: inp.width, curveHeight: inp.curve_height || 0,
      });
      place(obj, { name: inp.name, icon: '➡️', description: inp.description, role: inp.role, kind: 'arrow' });
      return ok(`已添加箭头 ${inp.name}(oid=${obj.userData.oid})`);
    },
  },
  {
    name: 'add_path',
    label: inp => L(`添加路线「${inp.name || '路线'}」(${(inp.points || []).length} 个点)`,
      `Add path "${inp.name || 'path'}" (${(inp.points || []).length} points)`),
    description: `添加一条经过一串路径点的平滑曲线(路线/轨迹/线条,确定性几何,不要手写代码)。
典型用法:
- 导览路线(role=guide):贴地虚线/圆点 + show_direction 方向小箭头 + mark_waypoints 起终点标记,配合 teleport 移动引导学生按路线参观
- 运动轨迹(role=content):行星轨道(closed=true)/抛体轨迹(点带 y)/河流路线
- points 是世界坐标数组(y 不填默认贴地 0.05);2 个点=直线段,多点自动平滑
- style:solid 实线管 | dashed 虚线 | dots 圆点串(导览路线推荐 dashed 或 dots)
- 【可见性】role≠content 的路线是老师的设计辅助线:编辑模式可见,运行模式/导出播放器中自动隐藏(学生看不到);要让学生看到的轨迹(轨道/河流)必须 role=content
生成后是普通对象,可拖动/删除;要"沿路线移动的动画"可再对某对象 set_behavior 让它沿这些点插值`,
    input_schema: {
      type: 'object',
      properties: {
        name: { type: 'string', description: '显示名,如「参观路线」「地球轨道」' },
        points: { type: 'array', items: point3, description: '路径点(≥2 个,世界坐标)' },
        color: { type: 'string', description: '十六进制色,默认 #4fd6ff' },
        width: { type: 'number', description: '线半径(米),默认 0.05' },
        style: { type: 'string', enum: ['solid', 'dashed', 'dots'] },
        show_direction: { type: 'boolean', description: '沿途加方向小箭头(导览路线建议开)' },
        mark_waypoints: { type: 'boolean', description: '标记路径点(起点绿/终点红/途经黄)' },
        closed: { type: 'boolean', description: '闭合成环(轨道类)' },
        role: { type: 'string', enum: ['content', 'guide'] },
        description: { type: 'string', description: '一句话:这条线是什么、引导去哪(给老师看+检索索引)' },
      },
      required: ['name', 'points'],
    },
    exec(inp) {
      if (!Array.isArray(inp.points) || inp.points.length < 2) return fail('points 至少 2 个点');
      const obj = buildPath({
        points: inp.points,
        color: inp.color ? parseInt(inp.color.replace('#', ''), 16) : undefined,
        width: inp.width, style: inp.style || 'solid',
        showDirection: !!inp.show_direction, markWaypoints: !!inp.mark_waypoints, closed: !!inp.closed,
      });
      place(obj, { name: inp.name, icon: '〰️', description: inp.description, role: inp.role, kind: 'path' });
      const hint = inp.role === 'content' ? '' : ';这是引导线,运行/导出时学生看不到';
      return ok(`已添加路线 ${inp.name}(oid=${obj.userData.oid},${inp.points.length} 个点${hint})`);
    },
  },
  {
    name: 'build_room',
    label: inp => L(`搭建房间「${inp.name || '房间'}」(${inp.width || 10}×${inp.depth || 8}米)`,
      `Build room "${inp.name || 'room'}" (${inp.width || 10}×${inp.depth || 8} m)`),
    description: `搭建一个房间壳(地板+四面墙,可开门洞/窗带/加天花板)——"室内体验"(教室/密室/餐厅/展厅…)的第一步。
- 壳是确定性几何(工整、贴地、门窗规范),不要用 create_custom_object 手写房间
- 墙体自动带碰撞(solid):学生瞬移/走动无法穿墙,只能从门洞进出——导览路线必须经过门洞
- 【尺寸要给足】VR 里房间比想象的显小:教室 ≥10×8、主卧 ≥5×4.5、小房间(卫生间)也 ≥2.5×2.5;宁大勿小
- 【每间必有门】door_wall 指定开门的墙(s=+Z/n/e/w,默认 s),不存在"封闭房间"——密室的"锁门"= 门洞上放一个门对象(solid)由交互解锁,不是砌死
- 房间以自身中心为原点;单间建在 (0,0);多房间户型见 room-design 技能的户型样例——先画平面图,房间必须共享墙面拼成连续轮廓(相邻房间中心距 = 两间半宽之和),绝不许一字排开、之间留缝
- windows 在无门墙上开窗带;ceiling=true 加天花板+室内顶灯(密室/夜景氛围用,平时建议 false 保证采光;天花板兼作上层楼板)
- y>0 = 把整个房间抬到二层(y=下层墙高,如 3);二层房间必须配 build_stairs 接到门口,且二层活动区四周必须有墙/护栏封闭(防学生坠落)
- 房间内的 UI 面板有平台级可见性规则:观看者在房间外时该房间的面板自动隐藏、进房间后面板顶层渲染不被遮挡——面板照常摆,无需自己处理遮挡
- 搭完壳后:①用 add_asset/create_custom_object 沿墙摆陈设(留出中央活动区,家具整体必须落在房间内,距墙 ≥ 家具半宽+0.2 米,绝不许穿墙);②configure_locomotion 设 teleport + allowed_radius 圈住户型;③set_student_view 把学生出生点放在门口朝向室内`,
    input_schema: {
      type: 'object',
      properties: {
        name: { type: 'string', description: '显示名,如「教室」「密室」' },
        width: { type: 'number', description: 'X 向宽(米),默认 10' },
        depth: { type: 'number', description: 'Z 向深(米),默认 8' },
        height: { type: 'number', description: '墙高(米),默认 3' },
        wall_color: { type: 'string', description: '墙色 #rrggbb,默认暖白' },
        floor_color: { type: 'string', description: '地板色 #rrggbb,默认木色' },
        door_wall: { type: 'string', enum: ['s', 'n', 'e', 'w'], description: '开门的墙(默认 s=+Z);每间房必须有门' },
        windows: { type: 'boolean', description: '无门墙开窗带(默认 true)' },
        ceiling: { type: 'boolean', description: '天花板+室内顶灯(默认 false)' },
        x: { type: 'number' }, z: { type: 'number' },
        y: { type: 'number', description: '楼层抬升(米):0=一层(默认),3=建在二层(需配楼梯)' },
        description: { type: 'string', description: '一句话:这是什么房间、用来上什么课' },
      },
      required: ['name'],
    },
    exec(inp) {
      const door = ['s', 'n', 'e', 'w'].includes(inp.door_wall) ? inp.door_wall : 's';
      const obj = buildRoom({
        width: inp.width, depth: inp.depth, height: inp.height,
        wallColor: inp.wall_color ? parseInt(inp.wall_color.replace('#', ''), 16) : undefined,
        floorColor: inp.floor_color ? parseInt(inp.floor_color.replace('#', ''), 16) : undefined,
        doorWall: door, windows: inp.windows !== false, ceiling: !!inp.ceiling,
      });
      if (inp.x !== undefined) obj.position.x = inp.x;
      if (inp.z !== undefined) obj.position.z = inp.z;
      if (inp.y) obj.position.y = inp.y;
      place(obj, { name: inp.name, icon: '🏠', description: inp.description });
      const doorNote = inp.door_wall && inp.door_wall !== door ? `(door_wall=${inp.door_wall} 不合法,已回退 s——房间必须有门)` : '';
      return ok(`已搭建房间 ${inp.name}(oid=${obj.userData.oid},${inp.width || 10}×${inp.depth || 8}×${inp.height || 3} 米,门朝 ${door}${doorNote}${inp.y ? `,楼层高度 ${inp.y} 米` : ''})。接下来摆陈设(家具必须完整落在房间内)、配移动方式、放学生出生点`);
    },
  },
  {
    name: 'build_stairs',
    label: inp => L(`搭建楼梯「${inp.name || '楼梯'}」(升 ${inp.rise ?? 3} 米)`,
      `Build stairs "${inp.name || 'stairs'}" (rise ${inp.rise ?? 3} m)`),
    description: `搭一段直跑楼梯(实心台阶,每级 ≤0.25 米,顶部自带缓步平台+护栏)——多层楼之间唯一的"物理"通道。
- 学生瞬移/平滑移动/WASD 都能逐级上下(碰撞系统按脚底高度采样,台阶自动可踩)
- 局部坐标:起步台阶在对象原点、沿 −Z 方向爬升;顶部平台再向前伸 landing 米(默认 1.2);用 x/z 摆到楼梯口,face 对准上楼方向
- rise = 总升高:接二层房间(y=3)时 rise 填 3,平台顶面正好与二层地板齐平
- 【与二层对接的铁律】顶部平台的"尽头边缘"必须紧贴二层房间开门那面墙的门洞外沿(误差 ≤0.2 米):
  例:二层房间中心 (x0,z0)、深 d、门朝 s(+Z)→ 门洞在 z = z0+d/2 → 楼梯 face=n(向−Z 爬)时,起步点 z = z0+d/2 + run + landing,x 对齐门洞中线 x0
  摆完后自查:平台末端 z ≈ 门洞 z,左右偏差 ≤0.3;对不齐学生就会"上到头够不着门"
- 楼梯占的 XZ 范围是实心的:别把它压在门洞/家具上
- "电梯"不用建运动的轿厢:做一个电梯间外观 + 按钮对象,按钮的交互代码里用 T.teleportStudent(x,z,y) 直接把学生送到目标楼层(见 room-design 技能)`,
    input_schema: {
      type: 'object',
      properties: {
        name: { type: 'string', description: '显示名,如「上二层楼梯」' },
        rise: { type: 'number', description: '总升高(米),默认 3' },
        run: { type: 'number', description: '水平总进深(米),默认 3.6' },
        width: { type: 'number', description: '梯宽(米),默认 1.4' },
        landing: { type: 'number', description: '顶部缓步平台进深(米),默认 1.2;0=不要平台' },
        color: { type: 'string', description: '台阶色 #rrggbb,默认木色' },
        rails: { type: 'boolean', description: '两侧扶手(默认 true)' },
        x: { type: 'number' }, z: { type: 'number' },
        face: { type: 'string', enum: ['n', 's', 'e', 'w'], description: '上楼朝向:n=向−Z 爬升(默认)/s/e/w' },
        description: { type: 'string', description: '一句话:连接哪两层、在哪个位置' },
      },
      required: ['name'],
    },
    exec(inp) {
      const obj = buildStairs({
        rise: inp.rise, run: inp.run, width: inp.width, landing: inp.landing,
        color: inp.color ? parseInt(inp.color.replace('#', ''), 16) : undefined,
        rails: inp.rails !== false,
      });
      if (inp.x !== undefined) obj.position.x = inp.x;
      if (inp.z !== undefined) obj.position.z = inp.z;
      const YAW = { n: 0, s: Math.PI, e: -Math.PI / 2, w: Math.PI / 2 };
      obj.rotation.y = YAW[inp.face ?? 'n'] ?? 0;
      place(obj, { name: inp.name, icon: '🪜', description: inp.description });
      return ok(`已搭建楼梯 ${inp.name}(oid=${obj.userData.oid},升 ${inp.rise ?? 3} 米/进深 ${inp.run ?? 3.6} 米,起步在 (${inp.x ?? 0}, ${inp.z ?? 0}))`);
    },
  },
];
