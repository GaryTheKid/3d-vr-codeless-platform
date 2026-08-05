// ═══════════════════════════════════════════════════════════════
//  修改类工具:改/删/选中已有对象
//  update_object / remove_object / select_object
// ═══════════════════════════════════════════════════════════════
import { removeObject, findObject, select, setMainColor } from '../../scene/manager.js';
import { markTouched } from '../../core/state.js';
import { emit } from '../../core/events.js';
import { L } from '../../core/i18n.js';
import { ok, fail } from './shared.js';

export default [
  {
    name: 'update_object',
    label: inp => L(`修改对象 ${inp.ref}`, `Update object ${inp.ref}`),
    description: '修改场景中已有对象:移动/缩放/换色/改名/设置或移除动画。ref 用对象的 oid 或名称。若这次修改改变了对象"是什么/会做什么"(不只是挪位置换颜色),同时传 description 更新它的描述,保持检索索引不过期。',
    input_schema: {
      type: 'object',
      properties: {
        ref: { type: 'string', description: '对象 oid(如 o3)或显示名' },
        x: { type: 'number' }, y: { type: 'number' }, z: { type: 'number' },
        scale: { type: 'number' },
        color: { type: 'string' },
        name: { type: 'string' },
        description: { type: 'string', description: '对象描述(给老师看 + 检索索引);对象含义/行为变化时更新' },
        anim: { type: 'object', description: '动画配置;传 {"type":"none"} 移除动画',
          properties: { type: { type: 'string' }, speed: { type: 'number' }, radius: { type: 'number' }, cx: { type: 'number' }, cz: { type: 'number' }, amplitude: { type: 'number' } } },
      },
      required: ['ref'],
    },
    exec(inp) {
      const obj = findObject(inp.ref);
      if (!obj) return fail(L(`找不到对象 ${inp.ref}`, `Object not found: ${inp.ref}`));
      if (inp.x !== undefined) obj.position.x = inp.x;
      if (inp.y !== undefined) obj.position.y = inp.y;
      if (inp.z !== undefined) obj.position.z = inp.z;
      if (inp.scale !== undefined) obj.scale.setScalar(inp.scale);
      if (inp.color) setMainColor(obj, inp.color);
      if (inp.name) obj.userData.displayName = inp.name;
      if (inp.description) obj.userData.behaviorDesc = inp.description;
      if (inp.anim) {
        if (inp.anim.type === 'none') delete obj.userData.anim;
        else obj.userData.anim = { angle: Math.random() * 6.28, ...obj.userData.anim, ...inp.anim };
      }
      markTouched(obj);
      emit('hierarchy-changed');
      emit('selection-changed');
      return ok(L(`已更新 ${obj.userData.displayName}`, `Updated ${obj.userData.displayName}`));
    },
  },
  {
    name: 'remove_object',
    label: inp => L(`删除对象 ${inp.ref}`, `Delete object ${inp.ref}`),
    description: '从场景删除一个对象。',
    input_schema: { type: 'object', properties: { ref: { type: 'string' } }, required: ['ref'] },
    exec(inp) {
      const obj = findObject(inp.ref);
      if (!obj) return fail(L(`找不到对象 ${inp.ref}`, `Object not found: ${inp.ref}`));
      if (obj.userData.system) return fail(L(
        `${obj.userData.displayName} 是系统对象(学生视角),不能删除;可用 set_student_view 移动它`,
        `${obj.userData.displayName} is a system object (student view) and cannot be deleted; use set_student_view to move it`
      ));
      const n = obj.userData.displayName;
      removeObject(obj);
      return ok(L(`已删除 ${n}`, `Deleted ${n}`));
    },
  },
  {
    name: 'select_object',
    label: inp => L(`选中 ${inp.ref}`, `Select ${inp.ref}`),
    description: '在视口中选中并高亮一个对象(向老师展示"我说的是这个")。',
    input_schema: { type: 'object', properties: { ref: { type: 'string' } }, required: ['ref'] },
    exec(inp) {
      const obj = findObject(inp.ref);
      if (!obj) return fail(L(`找不到对象 ${inp.ref}`, `Object not found: ${inp.ref}`));
      select(obj);
      return ok(L(`已选中 ${obj.userData.displayName}`, `Selected ${obj.userData.displayName}`));
    },
  },
];
