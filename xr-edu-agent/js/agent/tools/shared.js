// 工具模块共用的返回值助手
export function ok(msg, data) {
  if (data === undefined) return { ok: true, msg };
  let payload;
  try { payload = JSON.stringify(data); } catch { payload = String(data); }
  if (payload.length > 14000) payload = `${payload.slice(0, 14000)}…`;
  return { ok: true, msg: `${msg}\n${payload}`, data };
}
export const fail = msg => ({ ok: false, msg });
