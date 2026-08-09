// ═══════════════════════════════════════════════════════════════
//  Study-test TEMPORARY flags (NOT permanent product decisions)
//  · Documented in /general/technical-stack/06-learn-mode-and-companion.md — this file is the source of truth; flip flags here to restore
//  · When the user asks for "just for this study / test round" features,
//    add a flag here instead of deleting the old path
// ═══════════════════════════════════════════════════════════════

/**
 * @typedef {Object} StudyTestFlags
 * @property {boolean} disableVrPlayerController
 *   When true: Play stays in editor/orbit 3D view (no desktop VR preview,
 *   no student capsule / WASD player, hide Enter VR). Restore by setting false.
 */

/** @type {StudyTestFlags} */
export const STUDY_TEST_FLAGS = {
  // TEMP — study round: normal 3D H5 interaction scene, not VR player
  disableVrPlayerController: true,
};

export function studyFlag(name) {
  return !!STUDY_TEST_FLAGS[name];
}
