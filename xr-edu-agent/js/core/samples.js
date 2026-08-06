// ═══════════════════════════════════════════════════════════════
//  Built-in sample courses (pre-built-samples/ at the repo root)
//
//  Ready-made .xrcourse packages so a participant can open a finished
//  course instead of converting a PDF first (PDF conversion needs the
//  local server.py; GitHub Pages is static-only).
//
//  Packages are megabytes each, so they are NEVER copied into the project
//  library — the manifest is fetched once and a package only when opened.
// ═══════════════════════════════════════════════════════════════
import { isEN } from './i18n.js';
import { parseCourseFileText, loadCourseData } from './projects.js';

const SAMPLES_BASE = new URL('../../../pre-built-samples/', import.meta.url);

// Promise, not result: the projects panel re-renders on every change and must
// not fire a second catalog request while the first is still in flight
let catalogPromise = null;

function sampleUrl(file) {
  return new URL(encodeURIComponent(file), SAMPLES_BASE);
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
  loadCourseData(data);
  const name = sample.title || data.cfg?.outline?.course?.title || data.name || sample.id;
  const chapters = data.cfg?.outline?.chapters || [];
  return { name, sections: chapters.reduce((n, c) => n + (c.sections?.length || 0), 0) };
}
