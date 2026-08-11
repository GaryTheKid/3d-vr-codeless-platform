// Shared helpers for agent-skills.html / agent-tools.html (file:// friendly)
const LANG_KEY = 'xr_pipeline_lang';
let lang = localStorage.getItem(LANG_KEY) || 'en';
const isEN = () => lang === 'en';
const T = (v) => {
  if (v == null) return '';
  if (typeof v === 'string') return v;
  return v[lang] || v.en || v.zh || '';
};
const VL = (zh, en) => (lang === 'zh' ? zh : en);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, c => (
  { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
));

function wireLangButton(extra) {
  const b = document.getElementById('btn-lang');
  if (!b) return;
  const sync = () => { b.textContent = lang === 'en' ? '中文' : 'EN'; };
  sync();
  b.onclick = () => {
    lang = lang === 'en' ? 'zh' : 'en';
    localStorage.setItem(LANG_KEY, lang);
    sync();
    extra && extra();
  };
}

function setStaticCopy() {
  document.querySelectorAll('[data-zh][data-en]').forEach(el => {
    el.textContent = VL(el.dataset.zh, el.dataset.en);
  });
  document.querySelectorAll('[data-zh-ph][data-en-ph]').forEach(el => {
    el.placeholder = VL(el.dataset.zhPh, el.dataset.enPh);
  });
}

const GROUP_COLORS = {
  skill: '#a78bfa',
  '创建 build': '#5b9dff', Build: '#5b9dff',
  '修改 edit': '#fb923c', Edit: '#fb923c',
  '面板 panel': '#f472b6', Panel: '#f472b6',
  '查询 query': '#22d3ee', Query: '#22d3ee',
  '环境 env': '#fbbf24', Environment: '#fbbf24',
  '空间引导 space': '#34d399', 'Space & Guidance': '#34d399',
  '大纲 outline': '#38bdf8', Outline: '#38bdf8',
  '备课 course': '#a78bfa', Course: '#a78bfa',
};

function groupColor(group) {
  return GROUP_COLORS[group] || GROUP_COLORS[String(group).split(' ').pop()] || '#5b9dff';
}

function initCatalog({ items, listEl = 'item-list', detailEl = 'detail', searchEl = 'search', metaEl = 'list-meta', kind = 'skill' }) {
  const list = document.getElementById(listEl);
  const detail = document.getElementById(detailEl);
  let search = document.getElementById(searchEl);
  const fresh = search.cloneNode(true);
  search.parentNode.replaceChild(fresh, search);
  search = fresh;
  const meta = document.getElementById(metaEl);
  let selected = null;
  // category open state — default all collapsed; preserved across filter re-renders
  const openCats = new Set();

  function placeholder() {
    return `<div class="ph">${VL(
      kind === 'skill' ? '点击左侧技能查看完整提示词' : '点击左侧工具查看说明',
      kind === 'skill' ? 'Click a skill on the left to see its full prompt' : 'Click a tool on the left to see its description'
    )}</div>`;
  }

  function showDetail(it) {
    selected = it.key;
    detail.innerHTML = `<div class="d-card"><div class="d-scroll">${it.render()}</div></div>`;
    list.querySelectorAll('.repo-item').forEach(x => x.classList.toggle('selected', x.dataset.key === selected));
  }

  function groupItems(vis) {
    const order = [];
    const map = new Map();
    vis.forEach(it => {
      const g = it.group;
      if (!map.has(g)) {
        map.set(g, []);
        order.push(g);
      }
      map.get(g).push(it);
    });
    return order.map(g => ({ group: g, items: map.get(g) }));
  }

  function syncMetaActions(groups) {
    if (!meta) return;
    const countLabel = meta.querySelector('.meta-count');
    if (countLabel) {
      const n = groups.reduce((s, g) => s + g.items.length, 0);
      countLabel.textContent = VL(`${n} / ${items.length} 项`, `${n} / ${items.length} items`);
    }
  }

  function render(filter = '') {
    const f = filter.trim().toLowerCase();
    const vis = items.filter(it => !f || it.search.toLowerCase().includes(f));
    const groups = groupItems(vis);
    list.innerHTML = '';

    // While searching, auto-open matching categories
    if (f) groups.forEach(g => openCats.add(g.group));

    groups.forEach(({ group, items: kids }) => {
      const color = groupColor(kids[0]?.groupKey || group);
      const open = openCats.has(group);
      const block = document.createElement('div');
      block.className = 'cat-block' + (open ? ' open' : '');
      block.dataset.group = group;

      const head = document.createElement('button');
      head.type = 'button';
      head.className = 'cat-head';
      head.innerHTML = `
        <span class="cat-bar" style="background:${color}"></span>
        <span class="cat-title" style="color:${color}">${esc(group)}</span>
        <span class="cat-count">${kids.length}</span>
        <span class="cat-chev">▸</span>`;
      head.addEventListener('click', () => {
        if (openCats.has(group)) openCats.delete(group);
        else openCats.add(group);
        block.classList.toggle('open', openCats.has(group));
      });

      const body = document.createElement('div');
      body.className = 'cat-body';
      kids.forEach(it => {
        const d = document.createElement('div');
        d.className = `repo-item ${kind}` + (it.key === selected ? ' selected' : '');
        d.dataset.key = it.key;
        d.innerHTML = `
          <div class="r-top">
            <div class="r-ic">${it.icon || (kind === 'skill' ? '🧠' : '🔧')}</div>
            <div style="min-width:0;flex:1">
              <div class="r-name">${esc(it.title)}</div>
              <div class="r-id">${esc(it.key)}</div>
            </div>
          </div>
          <div class="r-desc">${esc(it.brief)}</div>`;
        d.addEventListener('click', () => {
          openCats.add(group);
          block.classList.add('open');
          showDetail(it);
        });
        body.appendChild(d);
      });

      block.appendChild(head);
      block.appendChild(body);
      list.appendChild(block);
    });

    if (!groups.length) {
      list.innerHTML = `<div class="none" style="padding:14px">${VL('没有匹配项', 'No matches')}</div>`;
    }
    syncMetaActions(groups);
  }

  // Meta row: count + expand/collapse all
  if (meta) {
    meta.innerHTML = `
      <span class="meta-count">—</span>
      <span class="meta-actions">
        <button type="button" class="btn" id="cat-expand-all">${VL('全部展开', 'Expand all')}</button>
        <button type="button" class="btn" id="cat-collapse-all">${VL('全部折叠', 'Collapse all')}</button>
      </span>`;
    meta.querySelector('#cat-expand-all').onclick = () => {
      list.querySelectorAll('.cat-block').forEach(b => {
        openCats.add(b.dataset.group);
        b.classList.add('open');
      });
    };
    meta.querySelector('#cat-collapse-all').onclick = () => {
      openCats.clear();
      list.querySelectorAll('.cat-block').forEach(b => b.classList.remove('open'));
    };
  }

  search.addEventListener('input', () => render(search.value));
  render();

  return {
    rerender: () => render(search.value),
    clearDetail: () => {
      selected = null;
      detail.innerHTML = placeholder();
    },
  };
}
