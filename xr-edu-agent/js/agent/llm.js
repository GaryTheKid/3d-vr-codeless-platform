// ═══════════════════════════════════════════════════════════════
//  LLM 客户端:两套路由并存,用 api-keys.txt 的 LLM_PROVIDER 一键切换
//
//  · anthropic(试学默认): "Test API:" 的 sk-ant-… → /__llm → api.anthropic.com
//  · astone(原路径,随时可切回):
//      CLAUDE_PROXY_API_KEY=cpx-… → /__llm/{sonnet|opus|fable5}
//      → https://astonelearning.com/api/v1/claude/{endpoint}
//      (无本地代理时也可直连 AStone)
//
//  切回 AStone: api-keys.txt 设 LLM_PROVIDER=astone 后硬刷新即可。
//  未配置密钥时回退离线演示模式。
// ═══════════════════════════════════════════════════════════════
import { L } from '../core/i18n.js';

// deepThinker: 恒开自适应思考的模型(如 Fable 5)。对这类模型我们减少
// 提示词里的分步 CoT 引导,Auto 档下给它更大的 effort/token 空间(见 orchestrator)
// price: 每百万 token 的美元单价 { in: 输入, out: 输出 }。仅用于界面上的花费粗估
// (按各模型公开定价填写;思考 token 计入输出,故已包含在 out 里)。改价只改这里。
export const MODELS = [
  { id: 'claude-sonnet-5', label: 'Claude Sonnet 5', provider: 'astone-proxy', endpoint: 'sonnet', note: '速度与智能的平衡(推荐日常使用)', price: { in: 3, out: 15 } },
  { id: 'claude-opus-4-8', label: 'Claude Opus 4.8', provider: 'astone-proxy', endpoint: 'opus', note: '复杂场景编排', price: { in: 15, out: 75 } },
  { id: 'claude-fable-5', label: 'Claude Fable 5', provider: 'astone-proxy', endpoint: 'fable5', note: '最强推理,长任务(自带深度思考,较贵)', deepThinker: true, price: { in: 5, out: 25 } },
];

/** Anthropic Messages API does not have Fable; server also aliases this. */
const ANTHROPIC_MODEL_ALIAS = { 'claude-fable-5': 'claude-opus-5' };

/** Preserved AStone China proxy base (do not remove — used when LLM_PROVIDER=astone). */
export const ASTONE_PROXY_BASE = 'https://astonelearning.com/api/v1/claude';

// 按 usage 粗估单次调用花费(美元)。缓存写按 1.25×、缓存读按 0.1× 输入价近似
export function estimateCost(modelId, usage = {}) {
  const price = MODELS.find(m => m.id === modelId)?.price;
  if (!price || !usage) return 0;
  const inTok = usage.input_tokens || 0;
  const cacheWrite = usage.cache_creation_input_tokens || 0;
  const cacheRead = usage.cache_read_input_tokens || 0;
  const outTok = usage.output_tokens || 0;
  return (inTok * price.in + cacheWrite * price.in * 1.25 + cacheRead * price.in * 0.1 + outTok * price.out) / 1e6;
}

// 思考深度档位(auto = 我们的预设组合,类 Cursor 的 Auto)
export const EFFORTS = [
  { id: 'auto',   label: L('思考 Auto', 'Effort Auto'),   note: L('预设组合:规划省着想,执行认真想;深思考模型自动放开空间', 'Preset mix: light thinking for planning, deep for execution; deep-thinker models get extra room') },
  { id: 'low',    label: L('思考 低', 'Effort Low'),      note: L('最快最省:所有调用都用低思考深度', 'Fastest & cheapest: low thinking effort for all calls') },
  { id: 'medium', label: L('思考 中', 'Effort Medium'),   note: L('均衡:所有调用都用中等思考深度', 'Balanced: medium thinking effort for all calls') },
  { id: 'high',   label: L('思考 高', 'Effort High'),     note: L('质量优先:所有调用都深度思考(token 消耗大)', 'Quality first: deep thinking for all calls (token-hungry)') },
];

// 输出 token 预算档位:放大各阶段 max_tokens。思考 token 计入 max_tokens,
// 复杂场景(尤其非深思考模型如 Sonnet)容易被思考吃光而截断 → 调大预算即可。
// 注意:只按"实际生成"的 token 计费,调大上限本身不额外花钱,只是给足空间不被截断。
export const BUDGETS = [
  { id: 'auto', label: L('预算 Auto', 'Budget Auto'), mult: 1, note: L('按思考深度自动分配(推荐日常)', 'Auto-scaled by thinking effort (recommended)') },
  { id: 'high', label: L('预算 大', 'Budget High'),   mult: 2, note: L('更大的输出上限,复杂场景不易被截断', 'Larger output cap; complex scenes are less likely to truncate') },
  { id: 'max',  label: L('预算 超大', 'Budget Max'),  mult: 4, note: L('最大输出上限,超长/超复杂任务用', 'Maximum output cap for very long / complex tasks') },
];

const keys = {};          // { LLM_PROVIDER, CLAUDE_PROXY_API_KEY, ANTHROPIC_API_KEY, … }
let keysLoaded = false;
// Same-origin proxy via python server.py — avoids browser CORS "Failed to fetch"
const LOCAL_LLM_BASE = '/__llm';
// 无 api-keys.txt 时的 AStone 试玩备用
const PLAYTEST_PROXY_KEY = 'cpx-786dc8c7fe4ec02f7d9c2d9ea219f9880ecdb5fa226b1d9b';
// 相对模块路径,不依赖 index.html 在仓库哪一层
const API_KEYS_URL = new URL('../../api-keys.txt', import.meta.url);

function looksLikeApiKey(s) {
  return /^(sk-ant-|sk-proj-|sk-|cpx-)/i.test(String(s || '').trim());
}

/** Parse KEY=VALUE lines plus "Test API:/=" / "GPT API:/=" blocks (key inline or on next line). */
function parseApiKeysFile(text) {
  const lines = String(text || '').split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const kv = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(\S+)\s*$/);
    if (kv && !kv[2].startsWith('在这里') && !kv[2].startsWith('<') && !kv[2].includes('your-')) {
      keys[kv[1]] = kv[2];
    }
    // Labels accept ":" or "=" (users write both), key may be inline or on the next non-comment line
    const inlineTest = line.match(/^\s*Test\s*API\s*[:=]\s*(\S+)\s*$/i);
    if (inlineTest && looksLikeApiKey(inlineTest[1])) {
      keys.ANTHROPIC_API_KEY = inlineTest[1].trim();
      continue;
    }
    if (/^\s*Test\s*API\s*[:=]?\s*$/i.test(line)) {
      for (let j = i + 1; j < lines.length; j++) {
        const n = lines[j].trim();
        if (!n || n.startsWith('#')) continue;
        if (looksLikeApiKey(n)) keys.ANTHROPIC_API_KEY = n;
        break;
      }
    }
    const inlineGpt = line.match(/^\s*GPT\s*API\s*[:=]\s*(\S+)\s*$/i);
    if (inlineGpt && looksLikeApiKey(inlineGpt[1])) {
      keys.OPENAI_API_KEY = inlineGpt[1].trim();
      continue;
    }
    if (/^\s*GPT\s*API\s*[:=]?\s*$/i.test(line)) {
      for (let j = i + 1; j < lines.length; j++) {
        const n = lines[j].trim();
        if (!n || n.startsWith('#')) continue;
        if (looksLikeApiKey(n)) keys.OPENAI_API_KEY = n;
        break;
      }
    }
  }
  // Safety net: classify orphan bare-key lines by their unambiguous prefixes,
  // so a key pasted without a label still lands in the right slot.
  for (const raw of lines) {
    const s = raw.trim();
    if (!looksLikeApiKey(s) || /\s/.test(s)) continue;
    if (/^sk-ant-/i.test(s)) { if (!keys.ANTHROPIC_API_KEY) keys.ANTHROPIC_API_KEY = s; }
    else if (/^cpx-/i.test(s)) { if (!keys.CLAUDE_PROXY_API_KEY) keys.CLAUDE_PROXY_API_KEY = s; }
    else if (/^sk-/i.test(s)) { if (!keys.OPENAI_API_KEY) keys.OPENAI_API_KEY = s; }
  }
}

/**
 * Provider switch (api-keys.txt LLM_PROVIDER):
 *  · anthropic — Test API sk-ant (study default when Test API present)
 *  · astone    — original AStone cpx path (set this to revert)
 */
export function llmProvider() {
  const p = String(keys.LLM_PROVIDER || '').trim().toLowerCase();
  if (p === 'astone' || p === 'proxy' || p === 'cpx') return 'astone';
  if (p === 'anthropic' || p === 'test' || p === 'direct') return 'anthropic';
  // Auto: prefer Test API when present, else AStone
  if (keys.ANTHROPIC_API_KEY) return 'anthropic';
  return 'astone';
}

/** Active key for the selected provider. */
export function activeApiKey() {
  if (llmProvider() === 'astone') {
    return keys.CLAUDE_PROXY_API_KEY || PLAYTEST_PROXY_KEY || '';
  }
  return keys.ANTHROPIC_API_KEY || keys.CLAUDE_PROXY_API_KEY || '';
}

export function usesAnthropicDirect() {
  return llmProvider() === 'anthropic' && /^sk-ant-/i.test(activeApiKey());
}

export async function loadApiKeys() {
  if (keysLoaded) return keys;
  keysLoaded = true;
  try {
    const res = await fetch(API_KEYS_URL, { cache: 'no-store' });
    if (res.ok) parseApiKeysFile(await res.text());
  } catch (e) { /* 文件不存在(GitHub Pages 等) */ }
  if (!keys.CLAUDE_PROXY_API_KEY && PLAYTEST_PROXY_KEY) {
    keys.CLAUDE_PROXY_API_KEY = PLAYTEST_PROXY_KEY;
  }
  return keys;
}

export function hasLLM() {
  return !!activeApiKey();
}

/** OpenAI key for image generation (GPT API: / OPENAI_API_KEY=). */
export function openAIApiKey() {
  return keys.OPENAI_API_KEY || keys.GPT_API_KEY || '';
}

export function hasOpenAIImages() {
  return !!openAIApiKey();
}

/** Default gpt-image-2; override with OPENAI_IMAGE_MODEL= in api-keys.txt */
export function openAIImageModel() {
  return keys.OPENAI_IMAGE_MODEL || 'gpt-image-2';
}

/** Prefer local /__llm proxy (server.py); AStone cpx may fall back to ASTONE_PROXY_BASE direct. */
async function fetchClaude(endpoint, init) {
  const localUrl = `${LOCAL_LLM_BASE}/${endpoint}`;
  try {
    const res = await fetch(localUrl, init);
    // Static hosts without server.py return 404 HTML — fall through
    if (res.status !== 404 && res.status !== 405) return res;
  } catch (e) {
    // Local proxy missing / network — try AStone direct only for cpx keys
  }
  const key = init?.headers?.['x-api-key'] || activeApiKey();
  if (/^sk-ant-/i.test(key) || usesAnthropicDirect()) {
    throw new Error(L(
      'Test API (sk-ant) 需要经本地 server.py 的 /__llm 转发。请在仓库根目录运行 python server.py 后打开 http://localhost:8000/',
      'Test API (sk-ant) requires the local /__llm proxy. Run python server.py from the repo root and open http://localhost:8000/'
    ));
  }
  // ── original AStone path (kept for easy revert via LLM_PROVIDER=astone) ──
  return fetch(`${ASTONE_PROXY_BASE}/${endpoint}`, init);
}

const sleep = ms => new Promise(r => setTimeout(r, ms));

/** Upstream capacity / transient gateway failures worth retrying. */
export function isRetryableLLMError(errOrText, status = 0) {
  const s = String(errOrText || '');
  if (status === 429 || status === 502 || status === 503 || status === 529) return true;
  return /overloaded|rate[_ ]?limit|temporar|timeout|try again|529|503|502/i.test(s);
}

function formatAPIError(status, body) {
  const snippet = String(body || '').slice(0, 300);
  if (isRetryableLLMError(snippet, status) || /overloaded/i.test(snippet)) {
    return L(
      `模型服务暂时过载 (HTTP ${status}): ${snippet || 'Overloaded'}。请稍后再点一次「确认」或重发同一条消息。`,
      `Model service temporarily overloaded (HTTP ${status}): ${snippet || 'Overloaded'}. Wait a moment, then confirm the plan again or resend the same message.`
    );
  }
  if (status === 401 || status === 403) {
    return L(
      `API 密钥无效或无权限 (HTTP ${status})。请检查 api-keys.txt 中的 CLAUDE_PROXY_API_KEY。`,
      `API key invalid or forbidden (HTTP ${status}). Check CLAUDE_PROXY_API_KEY in api-keys.txt.`
    );
  }
  return `API ${status}: ${snippet}`;
}

// 调用 Anthropic Messages API(支持工具调用 + SSE 流式 + 自适应思考)
// messages: [{role, content}];tools: Anthropic 工具定义数组
// onText(delta): 传入则走流式,文本增量实时回调;返回值结构与非流式一致 { content, stop_reason, usage }
// onThinking(delta): 传入则把模型流式吐出的推理摘要(thinking_delta)实时回调。
//         这代 adaptive thinking 模型会自行流式 thinking 块;display 为 omitted 时内容为空,
//         此时思考块不渲染(优雅降级)。注意:本 API 不接受 output_config.thinking_display 字段
//         (传了会 400 Extra inputs are not permitted),深度只能靠 output_config.effort 控制。
//         开启思考展示会额外产生摘要文本,故此时小幅上调 max_tokens 预留空间。
// effort: 'low' | 'medium' | 'high' 控制思考深度(Fable 5 等模型常开 adaptive thinking,
//         思考 token 计入 max_tokens,故 max_tokens 需给足,否则输出会被思考吃光而截断)
export async function callClaude({ model, system, messages, tools = undefined, maxTokens = 8192, onText = null, onThinking = null, effort = 'medium' }) {
  const modelDef = MODELS.find(m => m.id === model);
  if (!modelDef?.endpoint) throw new Error(`不支持的代理模型: ${model}`);
  const apiKey = activeApiKey();
  if (!apiKey) throw new Error('未配置 Claude / Test API 密钥');
  const modelId = usesAnthropicDirect() ? (ANTHROPIC_MODEL_ALIAS[model] || model) : model;
  const body = { model: modelId, max_tokens: onThinking ? maxTokens + 1024 : maxTokens, system, messages, output_config: { effort } };
  if (tools?.length) body.tools = tools;
  if (onText) body.stream = true;

  const maxAttempts = 5;
  let lastErr;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    let res;
    try {
      res = await fetchClaude(modelDef.endpoint, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-api-key': apiKey,
        },
        body: JSON.stringify(body),
      });
    } catch (e) {
      lastErr = e;
      if (attempt < maxAttempts && isRetryableLLMError(e.message)) {
        await sleep(1000 * attempt * attempt);
        continue;
      }
      const tip = L(
        '网络请求失败(Failed to fetch)。请用仓库根目录 `python server.py` 打开页面(同域 /__llm 代理可绕过浏览器 CORS);并检查能否访问代理服务。',
        'Network request failed (Failed to fetch). Open the app via `python server.py` from the repo root (same-origin /__llm proxy avoids browser CORS), and check proxy connectivity.'
      );
      throw new Error(`${e.message || 'Failed to fetch'}\n${tip}`);
    }

    if (!res.ok) {
      const errText = await res.text();
      lastErr = new Error(formatAPIError(res.status, errText));
      if (attempt < maxAttempts && isRetryableLLMError(errText, res.status)) {
        await sleep(1500 * attempt * attempt); // ~1.5s, 6s, 13.5s, 24s
        continue;
      }
      throw lastErr;
    }

    try {
      if (!onText) return await res.json();
      return await parseSSE(res, onText, onThinking);
    } catch (e) {
      lastErr = e;
      // Stream may fail mid-flight with Overloaded; retry whole request
      if (attempt < maxAttempts && isRetryableLLMError(e.message)) {
        await sleep(1000 * attempt * attempt);
        continue;
      }
      throw e;
    }
  }
  throw lastErr || new Error('LLM request failed');
}

// 解析 SSE 事件流,重组出与非流式一致的 { content, stop_reason, usage }
// 文本块的增量实时通过 onText 回调;推理摘要增量通过 onThinking 回调;
// tool_use 的入参 JSON 拼完后再解析
async function parseSSE(res, onText, onThinking = null) {
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  const content = [];
  let stopReason = null;
  let usage = null;
  let buffer = '';

  const handle = ev => {
    switch (ev.type) {
      case 'message_start':
        // usage.input_tokens 在这里给出;output_tokens 在 message_delta 里累计更新
        if (ev.message?.usage) usage = { ...ev.message.usage };
        break;
      case 'content_block_start':
        content[ev.index] = ev.content_block.type === 'tool_use'
          ? { ...ev.content_block, input: {}, _json: '' }
          : { ...ev.content_block };
        break;
      case 'content_block_delta': {
        const blk = content[ev.index];
        if (ev.delta.type === 'text_delta') { blk.text += ev.delta.text; onText(ev.delta.text); }
        else if (ev.delta.type === 'input_json_delta') blk._json += ev.delta.partial_json;
        // 思考块:开 summarized 时是推理摘要文本(可展示);signature 必须保留以便多轮原样回传
        else if (ev.delta.type === 'thinking_delta') {
          blk.thinking = (blk.thinking || '') + ev.delta.thinking;
          if (ev.delta.thinking) onThinking?.(ev.delta.thinking);
        }
        else if (ev.delta.type === 'signature_delta') blk.signature = (blk.signature || '') + ev.delta.signature;
        break;
      }
      case 'content_block_stop': {
        const blk = content[ev.index];
        if (blk?._json !== undefined) {
          try { blk.input = blk._json ? JSON.parse(blk._json) : {}; } catch { blk.input = {}; }
          delete blk._json;
        }
        break;
      }
      case 'message_delta':
        if (ev.delta?.stop_reason) stopReason = ev.delta.stop_reason;
        if (ev.usage) usage = { ...usage, ...ev.usage };
        break;
      case 'error':
        throw new Error(ev.error?.message || '流式响应出错');
    }
  };

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop();  // 末行可能不完整,留到下一轮
    for (const line of lines) {
      if (!line.startsWith('data: ')) continue;
      const data = line.slice(6).trim();
      if (!data || data === '[DONE]') continue;
      handle(JSON.parse(data));
    }
  }
  return { content: content.filter(Boolean), stop_reason: stopReason, usage };
}
