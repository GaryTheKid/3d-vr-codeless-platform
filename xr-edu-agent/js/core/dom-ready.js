// 等待 React 外壳 commit 后 legacy runtime 所需的 DOM id 全部出现。
export function waitForDom(ids, { timeout = 10000, root = document } = {}) {
  const missing = () => ids.filter(id => !root.getElementById(id));
  return new Promise((resolve, reject) => {
    if (!missing().length) return resolve();
    const t0 = performance.now();
    const tick = () => {
      if (!missing().length) return resolve();
      if (performance.now() - t0 > timeout) {
        return reject(new Error(`DOM not ready: ${missing().join(', ')}`));
      }
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });
}

/** legacy controller 启动前必须存在的最小 id 集合 */
export const BOOTSTRAP_IDS = [
  'btn-settings', 'scene-tab-name', 'btn-save', 'btn-download', 'btn-share', 'btn-vr',
  'btn-projects-folder', 'projects-overlay', 'settings-overlay', 'kg-overlay', 'outline-tree',
  'viewport', 'asset-categories', 'asset-search', 'chat-messages', 'chat-send', 'chat-attach',
  'model-select', 'vt-play', 'vt-focus',
];
