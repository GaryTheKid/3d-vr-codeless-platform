// ═══════════════════════════════════════════════════════════════
//  查询类工具:读场景不改场景(大场景模式的"按需拉取"通道)
//  get_scene / find_objects / get_object_detail
// ═══════════════════════════════════════════════════════════════
import { findObject } from '../../scene/manager.js';
import { sceneRoot } from '../../core/three-setup.js';
import { sceneToJSON, sceneSummary, searchObjects, objectToJSON, FULL_JSON_MAX } from '../context.js';
import { L } from '../../core/i18n.js';
import { ok, fail } from './shared.js';

export default [
  {
    name: 'get_scene',
    label: () => L('读取场景状态', 'Read scene state'),
    description: '重新读取当前场景状态(做了多步修改后想确认结果时用)。小场景返回完整 JSON;大场景返回摘要索引(需要某对象完整参数时再用 get_object_detail)。',
    input_schema: { type: 'object', properties: {} },
    exec() {
      if (sceneRoot.children.length <= FULL_JSON_MAX) return ok(JSON.stringify(sceneToJSON()));
      return ok(L(
        `共 ${sceneRoot.children.length} 个对象(大场景模式,以下为摘要索引):\n${sceneSummary()}`,
        `${sceneRoot.children.length} objects (large-scene mode; summary index below):\n${sceneSummary()}`
      ));
    },
  },
  {
    name: 'find_objects',
    label: inp => L(`检索场景对象${inp.query ? `「${inp.query}」` : ''}`, `Search scene objects${inp.query ? ` "${inp.query}"` : ''}`),
    description: '在场景中检索对象(大场景模式的主要查找手段)。按关键词做语义匹配(对象名/描述/资源标签),可叠加空间过滤(某点附近半径内)。返回匹配对象的完整参数。找不到或不确定时先用它,不要凭摘要索引猜对象状态。',
    input_schema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: '检索关键词,如 "能量管道" / "可点击的实验装置"' },
        near_x: { type: 'number', description: '可选:空间过滤中心 x' },
        near_z: { type: 'number', description: '可选:空间过滤中心 z' },
        radius: { type: 'number', description: '可选:空间过滤半径(米),与 near_x/near_z 一起用' },
        limit: { type: 'number', description: '最多返回几个,默认 8' },
      },
    },
    exec(inp) {
      const opts = { limit: inp.limit || 8 };
      if (inp.near_x !== undefined && inp.near_z !== undefined && inp.radius) {
        opts.near = { x: inp.near_x, z: inp.near_z };
        opts.radius = inp.radius;
      }
      const found = searchObjects(inp.query || '', opts);
      if (!found.length) return ok(L(
        '没有匹配的对象。可以换关键词重试,或用 get_scene 看全景摘要',
        'No matching objects. Try different keywords, or use get_scene for the full summary'
      ));
      return ok(JSON.stringify(found.map(o => objectToJSON(o, true))));
    },
  },
  {
    name: 'get_object_detail',
    label: inp => L(`查看 ${inp.ref} 的详情`, `Inspect ${inp.ref}`),
    description: '按 oid(或名称)读取单个对象的完整参数与行为代码(修改它之前先看清现状)。',
    input_schema: { type: 'object', properties: { ref: { type: 'string', description: '对象 oid 或显示名' } }, required: ['ref'] },
    exec(inp) {
      const obj = findObject(inp.ref);
      if (!obj) return fail(L(`找不到对象 ${inp.ref}`, `Object not found: ${inp.ref}`));
      return ok(JSON.stringify(objectToJSON(obj, true)));
    },
  },
];
