// ═══════════════════════════════════════════════════════════════
//  Built-in sample courses (pre-built-samples/ at the repo root)
//
//  Ready-made .xrcourse packages so a participant can open a finished
//  course instead of converting a PDF first (PDF conversion needs the
//  local server.py; GitHub Pages is static-only).
//
//  Packages are megabytes each, so they are NEVER copied into the project
//  library — the manifest is fetched once and a package only when opened.
//
//  PDF figures live under pre-built-samples/assets/ and are referenced from
//  course HTML as sample-asset:<course-id>/<file>. We rewrite those tokens
//  to real absolute URLs on open so both localhost and GitHub project pages
//  resolve images correctly (a leading "/…" would miss the repo base path).
// ═══════════════════════════════════════════════════════════════
import { isEN } from './i18n.js';
import { parseCourseFileText, loadCourseData } from './projects.js';

const SAMPLES_BASE = new URL('../../../pre-built-samples/', import.meta.url);
const ASSETS_BASE = new URL('assets/', SAMPLES_BASE);

// Promise, not result: the projects panel re-renders on every change and must
// not fire a second catalog request while the first is still in flight
let catalogPromise = null;

function sampleUrl(file) {
  return new URL(encodeURIComponent(file), SAMPLES_BASE);
}

/** sample-asset:bio-virus/fig-01.jpg → https://…/pre-built-samples/assets/bio-virus/fig-01.jpg */
export function resolveSampleAssetUrl(token) {
  const s = String(token || '');
  const m = /^sample-asset:(.+)$/i.exec(s);
  if (!m) return s;
  // Encode each path segment but keep slashes
  const rel = m[1].split('/').map(encodeURIComponent).join('/');
  return new URL(rel, ASSETS_BASE).href;
}

function rewriteSampleAssetsInString(str) {
  return String(str || '').replace(
    /sample-asset:[A-Za-z0-9._\- /%]+/gi,
    m => resolveSampleAssetUrl(m.trim()),
  );
}

/** Walk outline HTML fields and rewrite sample-asset: tokens in place. */
export function rewriteSampleAssetsInCourse(data) {
  const outline = data?.cfg?.outline ?? data?.outline;
  if (!outline?.chapters) return data;
  for (const ch of outline.chapters) {
    for (const sec of ch.sections || []) {
      if (sec.type === 'reading') {
        for (const chunk of sec.reading?.chunks || []) {
          if (chunk.html) chunk.html = rewriteSampleAssetsInString(chunk.html);
        }
      }
      if (sec.type === 'h5' && sec.h5?.html) {
        sec.h5.html = rewriteSampleAssetsInString(sec.h5.html);
      }
    }
  }
  return data;
}

/**
 * Sample catalog, or [] when the folder is absent (e.g. app copied without it).
 * Never throws — a missing catalog just hides the section in the UI.
 */
export function listSampleCourses() {
  catalogPromise ??= (async () => {
    try {
      const res = await fetch(new URL('manifest.json', SAMPLES_BASE), { cache: 'no-cache' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      return (data.courses || []).filter(c => c?.id && c?.file);
    } catch (e) {
      console.warn('[samples] catalog unavailable:', e.message);
      return [];
    }
  })();
  return catalogPromise;
}

export function sampleSubjectLabel(sample) {
  const s = sample?.subject;
  if (!s) return '';
  return typeof s === 'string' ? s : (isEN() ? s.en : s.zh) || s.en || '';
}

/**
 * Fetch and load one sample into the workspace.
 * Does not write to the project library — the teacher decides whether to Save.
 * @returns {{ name: string, sections: number }}
 */
export async function openSampleCourse(id) {
  const sample = (await listSampleCourses()).find(c => c.id === id);
  if (!sample) throw new Error(`Unknown sample: ${id}`);
  const res = await fetch(sampleUrl(sample.file), { cache: 'force-cache' });
  if (!res.ok) throw new Error(`HTTP ${res.status} — ${sample.file}`);
  const data = parseCourseFileText(await res.text(), sample.file);
  rewriteSampleAssetsInCourse(data);
  loadCourseData(data);
  const name = sample.title || data.cfg?.outline?.course?.title || data.name || sample.id;
  const chapters = data.cfg?.outline?.chapters || [];
  return { name, sections: chapters.reduce((n, c) => n + (c.sections?.length || 0), 0) };
}
