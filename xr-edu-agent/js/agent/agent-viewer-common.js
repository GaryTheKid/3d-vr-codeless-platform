// agent-viewer*.html 三页共用脚本(普通脚本,file:// 可加载)
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

// ── 语言:zh / en,localStorage 持久化,切换即刷新 ──
const VIEWER_LANG = localStorage.getItem('xr_viewer_lang') === 'en' ? 'en' : 'zh';
const isEN = VIEWER_LANG === 'en';
// 双语取值:T() 取 {zh,en} 数据对象;VL() 页面脚本里的内联双语
const T = v => (v && typeof v === 'object') ? (v[VIEWER_LANG] ?? v.zh ?? '') : (v ?? '');
const VL = (zh, en) => (isEN ? en : zh);

function toggleViewerLang() {
  localStorage.setItem('xr_viewer_lang', isEN ? 'zh' : 'en');
  location.reload();
}

// 静态文案:HTML 里中文为默认内容,英文写在 data-en / data-en-ph(placeholder)属性上
(function applyStaticLang() {
  if (!isEN) return;
  document.querySelectorAll('[data-en]').forEach(e => { e.textContent = e.dataset.en; });
  document.querySelectorAll('[data-en-ph]').forEach(e => { e.placeholder = e.dataset.enPh; });
})();

// 语言切换按钮(三页 header 里的 #btn-viewer-lang)
(function initLangBtn() {
  const b = document.getElementById('btn-viewer-lang');
  if (!b) return;
  b.textContent = isEN ? '中' : 'EN';
  b.title = isEN ? '切换到中文' : 'Switch to English';
  b.addEventListener('click', toggleViewerLang);
})();

// ── 通用仓库视图:左列表 + 搜索 + 右详情(技能库/工具库两页复用)──
function initRepo({ items, listEl, detailEl, searchEl }) {
  const list = document.getElementById(listEl);
  const detail = document.getElementById(detailEl);
  const search = document.getElementById(searchEl);
  let selected = null;

  function render(filter = '') {
    const f = filter.trim().toLowerCase();
    const vis = items.filter(it => !f || (it.key + ' ' + it.title + ' ' + it.brief + ' ' + it.group).toLowerCase().includes(f));
    list.innerHTML = '';
    let lastGroup = null;
    vis.forEach(it => {
      if (it.group !== lastGroup) {
        lastGroup = it.group;
        const g = document.createElement('div');
        g.className = 'repo-group';
        g.textContent = it.group;
        list.appendChild(g);
      }
      const d = document.createElement('div');
      d.className = 'repo-item' + (it.key === selected ? ' selected' : '');
      d.innerHTML = `<div class="r-name">${it.title}</div><div class="r-desc">${esc(it.brief)}</div>`;
      d.addEventListener('click', () => {
        selected = it.key;
        detail.innerHTML = it.render();
        list.querySelectorAll('.repo-item').forEach(x => x.classList.remove('selected'));
        d.classList.add('selected');
      });
      list.appendChild(d);
    });
    if (!vis.length) list.innerHTML += `<div class="none" style="padding:14px">${VL('没有匹配项', 'No matches')}</div>`;
  }
  search.addEventListener('input', () => render(search.value));
  render();
}
