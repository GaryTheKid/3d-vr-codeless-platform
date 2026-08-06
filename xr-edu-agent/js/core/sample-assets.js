// ═══════════════════════════════════════════════════════════════
//  Sample figure URLs (pre-built-samples/assets/ at the repo root)
//
//  Course HTML stores figures as portable `sample-asset:<course>/<file>`
//  tokens. They are resolved against THIS deployment's base URL at load
//  time, so the same package works on localhost and on GitHub project
//  pages (whose base path is /<repo>/, not /).
//
//  Courses saved after an earlier resolve may instead carry absolute URLs
//  from another origin (a teacher saved on localhost, a student opens the
//  GitHub build). Those are re-based onto the current origin too.
//
//  Dependency-free on purpose: imported by both projects.js and samples.js.
// ═══════════════════════════════════════════════════════════════

const ASSETS_BASE = new URL('../../../pre-built-samples/assets/', import.meta.url);

const TOKEN_RE = /sample-asset:[A-Za-z0-9._\-/%]+/gi;
const FOREIGN_ASSET_RE = /https?:\/\/[^"'\s()<>]+\/pre-built-samples\/assets\/([A-Za-z0-9._\-/%]+)/gi;

/** bio-virus/fig-01.jpg → https://<this deployment>/pre-built-samples/assets/bio-virus/fig-01.jpg */
export function sampleAssetUrl(rel) {
  const clean = String(rel || '').replace(/^\/+/, '');
  const encoded = clean.split('/').map(s => encodeURIComponent(decodeURIComponent(s))).join('/');
  return new URL(encoded, ASSETS_BASE).href;
}

export function resolveSampleAssetUrl(token) {
  const m = /^sample-asset:(.+)$/i.exec(String(token || '').trim());
  return m ? sampleAssetUrl(m[1]) : String(token || '');
}

/** Resolve tokens AND re-base foreign-origin asset URLs in one HTML string. */
export function rewriteSampleAssetHtml(html) {
  return String(html || '')
    .replace(TOKEN_RE, m => resolveSampleAssetUrl(m))
    .replace(FOREIGN_ASSET_RE, (_, rel) => sampleAssetUrl(rel));
}

/** Walk an outline's reading/H5 HTML and fix figure URLs in place. */
export function rewriteSampleAssetsInOutline(outline) {
  if (!outline?.chapters) return outline;
  for (const ch of outline.chapters) {
    for (const sec of ch.sections || []) {
      if (sec.type === 'reading') {
        for (const chunk of sec.reading?.chunks || []) {
          if (chunk.html) chunk.html = rewriteSampleAssetHtml(chunk.html);
        }
      }
      if (sec.type === 'h5' && sec.h5?.html) {
        sec.h5.html = rewriteSampleAssetHtml(sec.h5.html);
      }
    }
  }
  return outline;
}

/** Same, for a whole course package ({cfg:{outline}} or {outline}). */
export function rewriteSampleAssetsInCourse(data) {
  rewriteSampleAssetsInOutline(data?.cfg?.outline ?? data?.outline);
  return data;
}
