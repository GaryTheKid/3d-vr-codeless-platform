// ═══════════════════════════════════════════════════════════════
//  左栏资源库:AssetSkill 渲染(分类/搜索/拖拽/双击添加)+ Tab 切换
// ═══════════════════════════════════════════════════════════════
import { assetsByCategory } from '../assets/registry.js';
import { addAsset, select, clearScene } from '../scene/manager.js';
import { record } from '../core/history.js';
import { toast } from '../core/utils.js';
import { L, t } from '../core/i18n.js';

const catContainer = document.getElementById('asset-categories');

export function renderAssetLibrary(filter = '') {
  catContainer.innerHTML = '';
  for (const [catName, items] of Object.entries(assetsByCategory())) {
    const visible = items.filter(a => !filter
      || a.name.includes(filter) || catName.includes(filter)
      || a.tags.some(t => t.includes(filter)));
    if (!visible.length) continue;
    const catEl = document.createElement('div');
    catEl.className = 'asset-cat';
    catEl.innerHTML = `<div class="asset-cat-title"><span class="arrow">▼</span>${catName}</div><div class="asset-grid"></div>`;
    catEl.querySelector('.asset-cat-title').addEventListener('click', () => catEl.classList.toggle('collapsed'));
    const gridEl = catEl.querySelector('.asset-grid');
    visible.forEach(a => {
      const el = document.createElement('div');
      el.className = 'asset-item';
      el.draggable = true;
      el.title = `${a.description}\n\n💡 ${a.prompt}\n${L('(拖入场景或双击添加)', '(drag into the scene or double-click to add)')}`;
      el.innerHTML = `<span class="icon">${a.icon}</span><span class="name">${a.name}</span>`;
      el.addEventListener('dragstart', e => e.dataTransfer.setData('asset-id', a.id));
      el.addEventListener('dblclick', () => { record(); const o = addAsset(a.id); if (o) select(o); });
      gridEl.appendChild(el);
    });
    catContainer.appendChild(catEl);
  }
}

renderAssetLibrary();
document.getElementById('asset-search').addEventListener('input', e => renderAssetLibrary(e.target.value.trim()));

// 面板 Tab 切换(项目 / 资源库 / 场景层级)
document.querySelectorAll('.ptab').forEach(tab => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.ptab').forEach(t => t.classList.remove('active'));
    tab.classList.add('active');
    for (const id of ['projects', 'assets', 'hierarchy']) {
      document.getElementById('panel-' + id).classList.toggle('hidden', tab.dataset.panel !== id);
    }
  });
});

document.getElementById('btn-clear-all').addEventListener('click', () => { record(); clearScene(); toast(t('hier.cleared')); });
