// ═══════════════════════════════════════════════════════════════
//  环境类工具:全局运行环境与学生体验配置
//  set_environment / configure_locomotion / set_student_view
// ═══════════════════════════════════════════════════════════════
import { state, setPlayMode } from '../../core/state.js';
import { emit } from '../../core/events.js';
import { dirLight, grid, orbit } from '../../core/three-setup.js';
import { configureLocomotion, locomotionDesc } from '../../core/locomotion.js';
import { setStudentView, getStudentSpawn } from '../../scene/student-rig.js';
import { L } from '../../core/i18n.js';
import { ok, fail } from './shared.js';

export default [
  {
    name: 'set_environment',
    label: () => L('调整全局环境', 'Adjust global environment'),
    description: '控制全局环境:运行/编辑模式、动画播放/暂停、主光源开关、网格显隐、视角锁定。play_mode=true 进入运行模式(动画+学生交互生效,搭完让老师体验时用);false 回编辑模式(全静态,点击=选中)。',
    input_schema: {
      type: 'object',
      properties: {
        play_mode: { type: 'boolean', description: '运行模式开关(动画+学生交互整体生效)' },
        anim_playing: { type: 'boolean', description: '仅动画时钟(运行模式内的子开关)' },
        main_light: { type: 'boolean' },
        grid_visible: { type: 'boolean' },
        camera_locked: { type: 'boolean' },
      },
    },
    exec(inp) {
      const done = [];
      if (inp.play_mode !== undefined) { setPlayMode(inp.play_mode); done.push(inp.play_mode ? '已进入运行模式(动画+交互生效)' : '已回到编辑模式'); }
      if (inp.anim_playing !== undefined) { state.animPlaying = inp.anim_playing; emit('anim-toggled', inp.anim_playing); done.push(`动画${inp.anim_playing ? '播放' : '暂停'}`); }
      if (inp.main_light !== undefined) { dirLight.visible = inp.main_light; done.push(`主光源${inp.main_light ? '开' : '关'}`); }
      if (inp.grid_visible !== undefined) { grid.visible = inp.grid_visible; done.push(`网格${inp.grid_visible ? '显示' : '隐藏'}`); }
      if (inp.camera_locked !== undefined) { orbit.enabled = !inp.camera_locked; done.push(`视角${inp.camera_locked ? '锁定' : '解锁'}`); }
      emit('hierarchy-changed');
      return ok(done.join(';') || '无变更');
    },
  },
  {
    name: 'configure_locomotion',
    label: inp => L(`配置学生移动方式${inp.movement_mode ? `(${{ static: '固定', teleport: '瞬移', smooth: '平滑移动' }[inp.movement_mode] || inp.movement_mode})` : ''}`,
      `Configure student locomotion${inp.movement_mode ? ` (${inp.movement_mode})` : ''}`),
    description: `配置学生在 VR 里的移动方式(锁定观察 / 走动探索)。按课的类型决策:
- static:定点观察类(单摆/分子结构/演示实验)——学生不需要走动
- teleport:探索类(生态圈/博物馆/太阳系漫游)——扳机指地瞬移,舒适防眩晕,是"要走动"时的默认选择
- smooth:自由漫游类(地形考察)——摇杆平滑移动,对晕动敏感的学生慎用
allowed_radius 限定活动半径(米,防学生走丢,0=不限);turn_mode 转向方式(snap=45°跳转防眩晕,默认;smooth=平滑旋转)。PC 上老师可用方向键预览走动路线`,
    input_schema: {
      type: 'object',
      properties: {
        movement_mode: { type: 'string', enum: ['static', 'teleport', 'smooth'] },
        allowed_radius: { type: 'number', description: '活动半径(米),0 = 不限制' },
        turn_mode: { type: 'string', enum: ['snap', 'smooth'] },
      },
    },
    exec(inp) {
      const done = configureLocomotion({ mode: inp.movement_mode, allowedRadius: inp.allowed_radius, turnMode: inp.turn_mode }, true);
      emit('hierarchy-changed');
      return done.length ? ok(`学生移动已配置:${done.join(';')}。当前:${locomotionDesc()}`) : fail('未提供有效配置');
    },
  },
  {
    name: 'set_student_view',
    label: () => L('设置学生出生点与视角', 'Set student spawn & view'),
    description: `设置学生进 VR 后的出生位置与初始朝向(移动场景里「学生视角」代表物,老师也能在视口直接拖它)。
搭完场景必做的一步:把学生放在能看清教学主体的位置。经验法则:
- 定点观察课:距主体 2~4 米、正对主体(look_at 传主体坐标最稳,自动算朝向)
- 可走动课:出生在场景边缘/房间门口,面向内容,让学生"走进去"
- 主体高于 2 米(太阳系/大装置)→ 站远一点(距离 ≈ 主体高度 × 2)
当前出生点在场景上下文的 studentSpawn 字段里`,
    input_schema: {
      type: 'object',
      properties: {
        x: { type: 'number', description: '出生点 X(米)' },
        z: { type: 'number', description: '出生点 Z(米)' },
        look_at: {
          type: 'object', description: '面向的目标点(推荐;与 yaw_deg 二选一)',
          properties: { x: { type: 'number' }, z: { type: 'number' } },
        },
        yaw_deg: { type: 'number', description: '朝向角(度,0=朝-Z 即场景中心方向,逆时针为正)' },
      },
    },
    exec(inp) {
      if (inp.x === undefined && inp.z === undefined && !inp.look_at && inp.yaw_deg === undefined) return fail('未提供任何参数');
      setStudentView({
        x: inp.x, z: inp.z, lookAt: inp.look_at,
        yaw: inp.yaw_deg !== undefined ? inp.yaw_deg * Math.PI / 180 : undefined,
      });
      const sp = getStudentSpawn();
      return ok(`学生出生点已设为 (${sp.x.toFixed(1)}, ${sp.z.toFixed(1)}),朝向 ${Math.round(sp.yaw * 180 / Math.PI)}°`);
    },
  },
];
