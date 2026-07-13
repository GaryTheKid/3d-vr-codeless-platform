// React 页面外壳。
// 现有 Three.js / Agent / UI controller 模块仍通过稳定 DOM id 接管交互；
// React 负责声明页面结构，react-main.js 在首次 commit 后再加载 legacy runtime。
import React from 'react';
import htm from 'htm';

const html = htm.bind(React.createElement);

function TopBar() {
  return html`
    <header id="topbar">
      <div className="topbar-left">
        <div className="logo"><span className="logo-mark">◈</span> XR <b>EduAgent</b></div>
        <div className="scene-tab active">
          <span className="tab-icon">🌌</span>
          <span id="scene-tab-name">我的第一节VR课</span>.xrscene
          <span className="tab-dot"></span>
        </div>
      </div>
      <div className="topbar-right">
        <button className="lang-btn" id="btn-lang" data-i18n-title="top.langTitle">EN/中</button>
        <button className="tb-btn" id="btn-save" data-i18n="top.save" data-i18n-title="top.saveTitle">💾 保存</button>
        <button className="tb-btn" id="btn-download" data-i18n="top.download" data-i18n-title="top.downloadTitle">⬇ 下载</button>
        <button className="tb-btn" id="btn-share" data-i18n="top.share" data-i18n-title="top.shareTitle">🔗 分享给学生</button>
        <button className="tb-btn primary" id="btn-vr" data-i18n="top.vr" data-i18n-title="top.vrTitle">🥽 进入 VR 预览</button>
      </div>
    </header>
  `;
}

function ProjectsPanel() {
  return html`
    <div className="panel-body hidden" id="panel-projects">
      <div className="proj-actions">
        <button className="mini-btn primary" id="btn-proj-new" data-i18n="proj.new">➕ 新建项目</button>
        <button className="mini-btn" id="btn-proj-import" data-i18n="proj.import" data-i18n-title="proj.importTitle">📥 导入 HTML</button>
        <button className="mini-btn" id="btn-proj-folder" data-i18n="proj.connectFolder" data-i18n-title="proj.connectFolderTitle">📂 选择项目文件夹</button>
        <input type="file" id="proj-import-file" accept=".html,.htm" className="hidden" />
      </div>
      <div className="proj-storage-note" id="proj-storage-note"></div>
      <ul id="project-list"></ul>
      <div className="hierarchy-empty" id="project-empty" data-i18n="proj.empty">
        还没有项目<br />点「新建项目」保存当前场景,或导入之前下载的 HTML
      </div>
    </div>
  `;
}

function AssetsPanel() {
  return html`
    <div className="panel-body" id="panel-assets">
      <div className="search-box">
        <input type="text" id="asset-search" data-i18n-ph="assets.search" placeholder="搜索教学资源…" />
      </div>
      <div id="asset-categories"></div>
      <div className="asset-hint" data-i18n="assets.hint">
        💡 将资源<b>拖入</b>中间视口,或<b>双击</b>直接添加
      </div>
    </div>
  `;
}

function HierarchyPanel() {
  return html`
    <div className="panel-body hidden" id="panel-hierarchy">
      <div className="hierarchy-head">
        <span data-i18n="hier.title">场景中的对象</span>
        <button className="mini-btn danger" id="btn-clear-all" data-i18n="hier.clear" data-i18n-title="hier.clearTitle">清空</button>
      </div>
      <ul id="hierarchy-list"></ul>
      <div className="hierarchy-empty" id="hierarchy-empty" data-i18n="hier.empty">
        场景是空的<br />从资源库拖入对象,或让右侧 AI 助教帮你生成 →
      </div>
      <div id="virtual-sec">
        <div id="virtual-head">
          <span className="arrow">▸</span>
          <span data-i18n="hier.virtual">⚙️ 系统与控制器</span>
          <span id="virtual-count"></span>
        </div>
        <div className="virtual-note" data-i18n="hier.virtualNote">虚拟对象:不显示在场景里,但控制运行逻辑</div>
        <ul id="virtual-list" className="hidden"></ul>
      </div>
    </div>
  `;
}

function LeftPanel() {
  return html`
    <aside id="left-panel">
      <div className="panel-tabs">
        <button className="ptab" data-panel="projects" data-i18n="tab.projects">📁 项目</button>
        <button className="ptab active" data-panel="assets" data-i18n="tab.assets">📦 资源库</button>
        <button className="ptab" data-panel="hierarchy" data-i18n="tab.hierarchy">🗂 场景层级</button>
      </div>
      <${ProjectsPanel} />
      <${AssetsPanel} />
      <${HierarchyPanel} />
    </aside>
  `;
}

function ViewportToolbar() {
  return html`
    <div id="vp-toolbar">
      <button className="vt-btn active" data-mode="translate" data-i18n-title="vt.moveTitle">✥<span data-i18n="vt.move">移动</span></button>
      <button className="vt-btn" data-mode="rotate" data-i18n-title="vt.rotateTitle">⟳<span data-i18n="vt.rotate">旋转</span></button>
      <button className="vt-btn" data-mode="scale" data-i18n-title="vt.scaleTitle">⤢<span data-i18n="vt.scale">缩放</span></button>
      <div className="vt-sep"></div>
      <button className="vt-btn" id="vt-focus" data-i18n-title="vt.focusTitle">◎<span data-i18n="vt.focus">聚焦</span></button>
      <button className="vt-btn" id="vt-grid" data-i18n-title="vt.gridTitle">▦<span data-i18n="vt.grid">网格</span></button>
      <button className="vt-btn" id="vt-play" data-i18n-title="vt.playTitle">▶<span data-i18n="vt.play">运行</span></button>
      <div className="vt-sep"></div>
      <button className="vt-btn" id="vt-undo" data-i18n-title="vt.undoTitle">↩<span data-i18n="vt.undo">撤销</span></button>
      <button className="vt-btn" id="vt-redo" data-i18n-title="vt.redoTitle">↪<span data-i18n="vt.redo">重做</span></button>
    </div>
  `;
}

function Inspector() {
  return html`
    <div id="inspector" className="hidden">
      <div className="insp-head">
        <span id="insp-icon">🧊</span>
        <input type="text" id="insp-name" />
        <button className="mini-btn danger" id="insp-delete" data-i18n-title="insp.deleteTitle" title="删除 (Del)">✕</button>
      </div>
      <div className="insp-row">
        <label data-i18n="insp.pos">位置</label>
        <input type="number" step="0.5" id="insp-px" />
        <input type="number" step="0.5" id="insp-py" />
        <input type="number" step="0.5" id="insp-pz" />
      </div>
      <div className="insp-row">
        <label data-i18n="insp.scale">缩放</label>
        <input type="range" id="insp-scale" min="0.2" max="4" step="0.1" defaultValue="1" />
        <span id="insp-scale-val">1.0×</span>
      </div>
      <div className="insp-row">
        <label data-i18n="insp.color">颜色</label>
        <input type="color" id="insp-color" defaultValue="#4a9eff" />
        <label className="insp-check">
          <input type="checkbox" id="insp-spin" />
          <span data-i18n="insp.spin">自转</span>
        </label>
      </div>
      <div className="insp-sec hidden" id="insp-text-sec">
        <div className="insp-sec-title" data-i18n="insp.textSec">📝 面板文字</div>
        <div id="insp-text-edit"></div>
      </div>
      <div className="insp-sec" id="insp-purpose-sec">
        <div className="insp-sec-title" data-i18n="insp.purposeSec">📖 这是什么</div>
        <div className="insp-static" id="insp-purpose"></div>
      </div>
      <div className="insp-sec" id="insp-anim-sec">
        <div className="insp-sec-title" data-i18n="insp.animSec">🔁 动画</div>
        <div className="insp-static" id="insp-anim-desc"></div>
      </div>
      <div className="insp-sec" id="insp-inter-sec">
        <div className="insp-sec-title" data-i18n="insp.interSec">🖱 交互与联动</div>
        <div className="insp-static" id="insp-inter"></div>
      </div>
      <div className="insp-ai">
        <textarea id="insp-ai-input" rows="1" data-i18n-ph="insp.aiPh" placeholder="告诉 AI 怎么改这个对象…(Enter 发送)"></textarea>
        <button id="insp-ai-send" data-i18n-title="insp.aiSendTitle">➤</button>
      </div>
    </div>
  `;
}

function Viewport() {
  return html`
    <div id="viewport-wrap">
      <div id="viewport"></div>
      <${ViewportToolbar} />
      <${Inspector} />
      <div id="drop-hint" className="hidden" data-i18n="assets.dropHint">松开以放置到场景中</div>
      <div id="play-hint" className="hidden"></div>
      <div id="cam-preview-frame" className="hidden"><span data-i18n="vp.pipLabel">🎥 学生视角</span></div>
      <div id="statusbar">
        <span id="st-objects">对象: 0</span>
        <span id="st-selected" data-i18n="st.noSelection">未选中</span>
        <span className="st-right" data-i18n="st.help">
          左键选中(▶ 运行时=触发交互,Alt+点击选中)· 拖动旋转视角 · 滚轮缩放 · 右键平移 | W/E/R 切换工具 · F 聚焦 · Del 删除 · 方向键行走
        </span>
      </div>
    </div>
  `;
}

function RightPanel() {
  return html`
    <aside id="right-panel">
      <div className="chat-head">
        <div className="chat-title" data-i18n="chat.title">✨ AI 助教 Agent</div>
        <div className="chat-head-selects">
          <select id="model-select" data-i18n-title="chat.modelTitle" title="选择模型"></select>
          <select id="effort-select" data-i18n-title="chat.effortTitle" title="思考深度:Auto 为预设组合(推荐),低/中/高 全程统一"></select>
          <select id="budget-select" data-i18n-title="chat.budgetTitle" title="输出预算:复杂场景若被截断,调大预算即可"></select>
        </div>
      </div>
      <div id="mode-bar" data-i18n-title="chat.modeTitle">
        <button className="mode-btn" data-mode="ask">💬 Ask</button>
        <button className="mode-btn" data-mode="plan">📋 Plan</button>
        <button className="mode-btn active" data-mode="agent">⚡ Agent</button>
      </div>
      <div id="chat-messages"></div>
      <div id="chat-chips"></div>
      <div id="context-pins" className="hidden"></div>
      <div className="chat-input-wrap">
        <textarea
          id="chat-input"
          rows="2"
          data-i18n-ph="chat.inputPh"
          placeholder=${'用自然语言描述你想要的教学场景,例如:\n帮我创建一个太阳系模型,让行星转起来'}
        ></textarea>
        <button id="chat-send" data-i18n-title="chat.sendTitle">➤</button>
      </div>
      <div className="chat-foot">正在加载…</div>
    </aside>
  `;
}

export function App() {
  const [startupError, setStartupError] = React.useState(null);

  React.useEffect(() => {
    let mounted = true;
    // useEffect 只在 React commit 完成后运行；此时旧 controller 所需的 DOM id
    // 已全部存在。下一阶段逐步把 controller 状态迁入 React，而不是一次重写 3D 内核。
    import('../../main.js').catch(error => {
      console.error('[bootstrap] XR EduAgent runtime failed:', error);
      if (mounted) setStartupError(error);
    });
    return () => { mounted = false; };
  }, []);

  if (startupError) {
    return html`
      <main style=${{ padding: 24, color: '#ff9a9a', background: '#111', minHeight: '100vh' }}>
        <h1>XR EduAgent 启动失败 / Failed to start</h1>
        <pre style=${{ whiteSpace: 'pre-wrap' }}>${String(startupError.stack || startupError)}</pre>
      </main>
    `;
  }

  return html`
    <${React.Fragment}>
      <${TopBar} />
      <div id="main">
        <${LeftPanel} />
        <div className="panel-resizer" id="resizer-left" data-i18n-title="layout.resizeLeft" title="拖拽调整资源栏宽度"></div>
        <${Viewport} />
        <div className="panel-resizer" id="resizer-right" data-i18n-title="layout.resizeRight" title="拖拽调整 AI 助教栏宽度"></div>
        <${RightPanel} />
      </div>
      <div id="toast-container"></div>
    </${React.Fragment}>
  `;
}
