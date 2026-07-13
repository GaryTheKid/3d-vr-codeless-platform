// ═══════════════════════════════════════════════════════════════
//  结构化日志:排查"完成。/空输出/卡死"类问题的数据链
//  · logEvent(type, data):每条事件带时间戳 + 页面会话 id
//  · 优先 POST 到本地日志端点(python server.py 提供 /__log,按服务启动
//    时间落一份 logs/*.jsonl);端点不存在(普通静态服务器)则自动降级
//    为仅内存缓冲 + console,可随时 exportLog() 导出
//  · 代码类字段只记摘要(summarizeToolInput),避免刷爆日志
// ═══════════════════════════════════════════════════════════════

const SESSION = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
const buffer = [];
let remoteOk = true;   // 首次 POST 失败后不再尝试

export function logEvent(type, data = {}) {
  const ev = { ts: new Date().toISOString(), session: SESSION, type, ...data };
  buffer.push(ev);
  if (buffer.length > 2000) buffer.shift();
  console.debug('[xrlog]', type, data);
  if (!remoteOk) return;
  fetch('./__log', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(ev),
  }).then(r => { if (!r.ok) throw new Error(); }).catch(() => {
    if (remoteOk) {
      remoteOk = false;
      console.info('[xrlog] 日志端点不可用(用 python server.py 伺服页面可自动落盘 logs/*.jsonl);本次日志仅保留在内存,控制台调用 __xrExportLog() 可导出');
    }
  });
}

// 长字符串截断摘要
export function summarize(v, max = 200) {
  if (typeof v !== 'string') return v;
  return v.length <= max ? v : `${v.slice(0, max)}…(共${v.length}字符)`;
}

// 工具入参摘要:代码字段只记长度,其余截断
export function summarizeToolInput(input = {}) {
  const out = {};
  for (const [k, v] of Object.entries(input)) {
    out[k] = /code/i.test(k) && typeof v === 'string' ? `[代码 ${v.length} 字符]` : summarize(v);
  }
  return out;
}

// 手动导出本次会话日志(降级模式的兜底)
export function exportLog() {
  const blob = new Blob([buffer.map(e => JSON.stringify(e)).join('\n')], { type: 'application/jsonl' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `xrlog-${SESSION}.jsonl`;
  a.click();
  URL.revokeObjectURL(a.href);
}
window.__xrExportLog = exportLog;
