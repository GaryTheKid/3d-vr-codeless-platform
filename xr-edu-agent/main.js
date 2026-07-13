// ═══════════════════════════════════════════════════════════════
//  XR EduAgent — 入口(Bootstrap)
//  模块结构见 AGENTS.md;此文件只做装配与开场
// ═══════════════════════════════════════════════════════════════
import { applyDomI18n, setLang, lang, L } from './js/core/i18n.js';
applyDomI18n();                    // 静态 DOM 文案先就位,再装配各模块

import './js/ui/library.js';       // 左栏:资源库(AssetSkill)+ Tab 切换
import './js/ui/projects.js';      // 左栏:项目管理(新建/打开/导入 + 顶栏保存)
import './js/ui/hierarchy.js';     // 左栏:场景层级 + 自然语言 Inspector
import './js/ui/viewport.js';      // 中栏:视口交互 / 工具栏 / 检查器
import './js/ui/layout.js';        // 左右面板可拖拽调宽
import './js/core/history.js';     // 撤销/重做(工具栏按钮 + 键盘快捷键)
import './js/core/play-reset.js';  // 运行模式重置(停止运行 → 场景回到运行前状态)
import './js/scene/student-rig.js';// 学生视角代表物(出生点 + 视野可视化)
import { startLoop, setupXR } from './js/core/loop.js';
import { loadApiKeys, hasLLM } from './js/agent/llm.js';
import { addMsg, renderModelOptions } from './js/ui/chat.js';
import { SCENARIOS } from './js/labs/scenarios.js';
import { toast } from './js/core/utils.js';
import { exportScene } from './js/export/exporter.js';
import { serializeScene, loadSceneData } from './js/core/projects.js';
import { sceneRoot } from './js/core/three-setup.js';
import { emit } from './js/core/events.js';

// 顶栏:语言切换 / 下载 / 分享(保存在 projects.js 里接管)
// 切语言不丢场景:先把当前场景寄存到 localStorage,刷新后自动还原。
// 场景里的用户内容(对象名/面板文字)保持原语言;系统 UI / 之后新生成的内容用新语言
const LANG_STASH_KEY = 'xr-lang-stash';
function bindTopbar() {
  document.getElementById('btn-lang').addEventListener('click', () => {
    try {
      const name = document.getElementById('scene-tab-name').textContent.trim();
      localStorage.setItem(LANG_STASH_KEY, JSON.stringify(serializeScene(name)));
    } catch (e) {
      console.warn('[lang] 场景寄存失败(可能超出 localStorage 限额),切换后将回到默认场景', e);
      localStorage.removeItem(LANG_STASH_KEY);
      if (!confirm(L('场景太大,切换语言后无法自动恢复当前场景(建议先保存到项目)。仍要切换吗?',
        'The scene is too large to restore automatically after switching (save it as a project first). Switch anyway?'))) return;
    }
    setLang(lang === 'en' ? 'zh' : 'en');
  });
  document.getElementById('btn-download').addEventListener('click', exportScene);
  document.getElementById('btn-share').addEventListener('click', () => toast(L(
    '🔗 分享链接已复制,学生可在浏览器/头显中打开(演示)',
    '🔗 Share link copied — students can open it in a browser or headset (demo)')));
  document.getElementById('scene-tab-name').textContent = L('我的第一节VR课', 'My First VR Lesson');
}
bindTopbar();

// 渲染循环 + WebXR
startLoop();
setupXR();

// 加载 API Key → 决定在线/离线模式
await loadApiKeys();
renderModelOptions();

// 开场:欢迎语 + 默认示例场景
addMsg('ai', L(
  `你好,李老师 👋 我是你的 <b>AI 助教</b>。${hasLLM()
    ? '\n\n已连接真实模型 🎉 上方可切换 <b>Ask / Plan / Agent</b> 模式:\n· <b>Ask</b> 答疑解释,不动场景\n· <b>Plan</b> 先出计划、你确认后才执行\n· <b>Agent</b> 直接干活(复杂任务仍会先请你确认)\n\n我能读懂当前场景;<b>选中对象</b>(Shift 可多选)就会自动进入我的上下文,我会重点关注它们。'
    : '\n\n当前是<b>离线演示模式</b>——内置的关键词规则依然可以生成所有示例场景。'}
\n我已经先放了一个<b>迷你太阳系</b>作为示例。你可以:\n· 在中间视口<b>点击行星</b>选中,拖动、旋转、缩放它们;右上角检查器还能看它的<b>用途/动画/联动</b>,并直接对它下 AI 指令\n· 点视口工具栏的 <b>▶ 运行</b>,播放动画并体验学生视角的交互(再点一次回到编辑)\n· 在左侧「🗂 场景层级」点开对象前面的 <b>▸</b>,查看它的<b>自然语言组件</b>(动画 / 交互 / 面板),可以开关和编辑\n· 从左侧<b>资源库</b>拖新素材进场景,或点下方快捷指令换一个学科场景`,
  `Hi! 👋 I'm your <b>AI teaching assistant</b>. ${hasLLM()
    ? '\n\nA real model is connected 🎉 Switch between <b>Ask / Plan / Agent</b> above:\n· <b>Ask</b> explains without touching the scene\n· <b>Plan</b> shows a plan and waits for your approval\n· <b>Agent</b> acts directly (complex tasks still ask for confirmation)\n\nI can read the current scene; <b>selecting objects</b> (Shift+click for multi-select) automatically adds them to my context.'
    : '\n\nRunning in <b>offline demo mode</b> — the built-in keyword rules can still generate every sample scene.'}
\nI've placed a <b>mini solar system</b> as a starter. You can:\n· <b>Click a planet</b> in the viewport to select it, then drag / rotate / scale; the inspector shows its <b>purpose / animation / links</b> and takes AI commands for that object\n· Press <b>▶ Play</b> in the viewport toolbar to run animations and try student interactions (press again to go back to editing)\n· In the <b>🗂 Hierarchy</b>, expand <b>▸</b> on an object to see its <b>natural-language components</b> (animation / interaction / panels) — toggle and edit them\n· Drag new assets in from the <b>Assets</b> tab, or use the quick prompts below to switch subjects`));

// 开场场景:语言切换前寄存的场景优先(无缝切语言),否则加载示例太阳系
const langStash = localStorage.getItem(LANG_STASH_KEY);
let stashRestored = false;
if (langStash) {
  localStorage.removeItem(LANG_STASH_KEY);
  try {
    const data = JSON.parse(langStash);
    loadSceneData(data);
    if (data.name) document.getElementById('scene-tab-name').textContent = data.name;
    stashRestored = true;
    toast(L('🌐 语言已切换,场景已恢复',
      '🌐 Language switched and your scene was restored'));
    // 场景内文字(对象名/面板)还是原语言 → 询问是否让 AI 顺手全部翻译
    if (hasLLM()) {
      setTimeout(() => {
        if (confirm(L('场景已恢复,但场景里的文字(对象名称/面板/标注)还是原来的语言。\n要让 AI 现在把它们全部翻译成中文吗?(翻译期间请稍候,完成后会在聊天区报告)',
          'Your scene was restored, but in-scene text (object names / panels / labels) is still in the original language.\nLet the AI translate everything into English now? (This takes a moment; it will report in the chat when done)'))) {
          emit('agent-task', L(
            '把当前场景里所有对象的显示名称、面板文字、标注文字全部翻译成中文(用 update_object 改名、update_panel 改面板文字);数字、公式和专有名词保持原样,别改任何几何/动画/交互逻辑。完成后简单汇报翻译了哪些。',
            'Translate every object display name, panel text, and label text in the current scene into English (use update_object to rename and update_panel for panel text); keep numbers, formulas, and proper nouns as-is, and do not touch any geometry/animation/interaction logic. Briefly report what you translated when done.'));
        }
      }, 800);
    }
  } catch (e) {
    console.warn('[lang] 寄存场景恢复失败,回退到示例场景', e);
    for (const o of [...sceneRoot.children]) if (!o.userData.system) sceneRoot.remove(o);
  }
}
if (!stashRestored) {
  SCENARIOS[0].run();
  toast(L('✨ 已加载示例场景:迷你太阳系', '✨ Sample scene loaded: Mini Solar System'));
}
