// ═══════════════════════════════════════════════════════════════
//  OpenAI image generation (gpt-image-2) via same-origin proxy
//  POST /__openai/images/generations  (server.py → api.openai.com)
// ═══════════════════════════════════════════════════════════════
import { L, isEN } from '../core/i18n.js';
import {
  loadApiKeys, hasOpenAIImages, openAIApiKey, openAIImageModel,
} from './llm.js';

const LOCAL_OPENAI_IMAGES = '/__openai/images/generations';

// Session cache: model id that actually worked (accounts may lack gpt-image-2 → fall back to gpt-image-1)
let workingImageModel = null;
const IMAGE_MODEL_FALLBACKS = ['gpt-image-1', 'dall-e-3'];

function isUnknownModelError(status, msg) {
  if (status !== 400 && status !== 403 && status !== 404) return false;
  return /model|does not exist|not found|access|unsupported|invalid_request/i.test(String(msg || ''));
}

async function postImageRequest(key, body) {
  let res;
  try {
    res = await fetch(LOCAL_OPENAI_IMAGES, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${key}`,
      },
      body: JSON.stringify(body),
    });
  } catch (e) {
    throw new Error(L(
      `图片生成网络失败:${e.message}。请确认已用 python server.py 打开本站。`,
      `Image generation network error: ${e.message}. Open the app via python server.py.`
    ));
  }
  const text = await res.text();
  let data;
  try { data = JSON.parse(text); } catch {
    throw new Error(L(`图片生成返回非 JSON (HTTP ${res.status})`, `Image API non-JSON (HTTP ${res.status})`));
  }
  return { res, data, text };
}

/**
 * Generate one pedagogical illustration.
 * @returns {{ dataUrl: string, revisedPrompt?: string } | null}
 */
export async function generatePedagogyImage(prompt, {
  size = '1024x1024',
  model = null,
} = {}) {
  await loadApiKeys();
  if (!hasOpenAIImages()) return null;
  const key = openAIApiKey();
  const basePrompt = String(prompt || '').slice(0, 3200);

  // Preferred model first, then session-cached working model, then known fallbacks
  const tried = new Set();
  const candidates = [
    model || workingImageModel || openAIImageModel(),
    ...IMAGE_MODEL_FALLBACKS,
  ].filter(m => { if (tried.has(m)) return false; tried.add(m); return true; });

  let res, data, text;
  let lastErr = '';
  for (let i = 0; i < candidates.length; i++) {
    const m = candidates[i];
    ({ res, data, text } = await postImageRequest(key, { model: m, prompt: basePrompt, n: 1, size }));
    if (res.ok) {
      workingImageModel = m;
      break;
    }
    const msg = data?.error?.message || data?.error || text.slice(0, 200);
    lastErr = `HTTP ${res.status}: ${msg}`;
    // Only cascade when the account rejects the model itself; other errors are real failures
    if (!(isUnknownModelError(res.status, msg) && i < candidates.length - 1)) {
      throw new Error(L(`图片生成失败 (${lastErr})`, `Image generation failed (${lastErr})`));
    }
    console.warn(`[openai-images] model "${m}" rejected (${lastErr}) — trying next fallback`);
  }
  if (!res?.ok) {
    throw new Error(L(`图片生成失败 (${lastErr})`, `Image generation failed (${lastErr})`));
  }
  const item = data?.data?.[0];
  if (!item) return null;
  if (item.b64_json) {
    return {
      dataUrl: `data:image/png;base64,${item.b64_json}`,
      revisedPrompt: item.revised_prompt || '',
    };
  }
  if (item.url) {
    // Prefer embedding as data URL so outline saves offline
    try {
      const imgRes = await fetch(item.url);
      const buf = await imgRes.arrayBuffer();
      const bytes = new Uint8Array(buf);
      let bin = '';
      const chunk = 0x8000;
      for (let i = 0; i < bytes.length; i += chunk) {
        bin += String.fromCharCode(...bytes.subarray(i, i + chunk));
      }
      const mime = imgRes.headers.get('content-type') || 'image/png';
      return {
        dataUrl: `data:${mime};base64,${btoa(bin)}`,
        revisedPrompt: item.revised_prompt || '',
      };
    } catch {
      return { dataUrl: item.url, revisedPrompt: item.revised_prompt || '' };
    }
  }
  return null;
}

/** Build a safe educational image prompt from chunk + concept context. */
export function buildPedagogyImagePrompt({ title, concept, htmlHint, lang }) {
  const en = lang === 'en' || isEN();
  const topic = concept || title || 'science concept';
  const hint = String(htmlHint || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 280);
  if (en) {
    return `Clean educational textbook illustration for "${topic}".
Pedagogical diagram (not a photo, not a meme): clear labels, simple shapes, high contrast, white or soft neutral background.
Show the key idea accurately for students. ${hint ? `Context: ${hint}` : ''}
No logos, no watermarks, no UI chrome, no decorative clutter.`;
  }
  return `教学插图「${topic}」：干净教材风示意图（非照片、非表情包），标签清晰、高对比、浅色背景。
准确表达该知识点。${hint ? `上下文：${hint}` : ''}
不要 logo、水印、界面边框或装饰杂讯。`;
}

/**
 * Insert <figure> with generated image into chunk HTML (after first paragraph if possible).
 */
export function injectImageIntoChunkHtml(html, { dataUrl, alt, caption }) {
  if (!dataUrl) return html;
  const fig = `<figure class="ws-pedagogy-fig"><img class="ws-inline-img" src="${dataUrl}" alt="${escapeAttr(alt || '')}" />`
    + (caption ? `<figcaption>${escapeAttr(caption)}</figcaption>` : '')
    + `</figure>`;
  const h = String(html || '');
  const m = h.match(/<\/p>/i);
  if (m && m.index != null) {
    const i = m.index + m[0].length;
    return h.slice(0, i) + fig + h.slice(i);
  }
  return fig + h;
}

function escapeAttr(s) {
  return String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
