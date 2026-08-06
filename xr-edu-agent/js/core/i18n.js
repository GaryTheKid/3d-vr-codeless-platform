// ═══════════════════════════════════════════════════════════════
//  多语言(简体中文 / English-US)
//  · t(key, vars)   键值字典查询(UI 骨架文案)
//  · L(zh, en)      内联双语选择(labs / 模板 / 组件描述等内容型文案)
//  · setLang(l)     切换语言:持久化到 localStorage 后整页刷新——
//    模板/资源库/实验等大量文案在模块加载期求值,刷新一次最干净可靠
//  · DOM 声明式:data-i18n(innerHTML)/ data-i18n-title / data-i18n-ph(placeholder)
//  已存在的 3D 对象名与面板文字属于"用户内容",切换语言不追改;
//  刷新后新生成的场景 / 聊天 / 提示全部使用新语言。
// ═══════════════════════════════════════════════════════════════

// Study default: English. Only switch to zh when user explicitly chose it.
export let lang = localStorage.getItem('xr-lang') === 'zh' ? 'zh' : 'en';
export const isEN = () => lang === 'en';
export const L = (zh, en) => (lang === 'en' ? en : zh);

const DICT = {
  // ── 页面 / 布局 ──
  'app.title': { zh: 'XR EduAgent — VR 教学场景智能创作平台', en: 'XR EduAgent — AI-powered VR Lesson Builder' },
  'layout.resizeLeft': { zh: '拖拽调整资源栏宽度', en: 'Drag to resize the left panel' },
  'layout.resizeRight': { zh: '拖拽调整 AI 助教栏宽度', en: 'Drag to resize the AI assistant panel' },

  // ── 顶栏 ──
  'top.sceneTabDefault': { zh: '我的第一节VR课', en: 'My First VR Lesson' },
  'top.save': { zh: '💾 保存', en: '💾 Save' },
  'top.saveTitle': { zh: '保存到当前项目(自动存储在浏览器本地)', en: 'Save to current project (stored locally in the browser)' },
  'top.download': { zh: '⬇ 下载', en: '⬇ Download' },
  'top.downloadTitle': { zh: '导出为单文件 HTML:双击即可打开,支持鼠标交互与 VR 头显,也可重新导入本编辑器', en: 'Export a single HTML file: double-click to open, supports mouse & VR, and can be re-imported into this editor' },
  'top.share': { zh: '🔗 分享给学生', en: '🔗 Share' },
  'top.shareTitle': { zh: '分享给学生(演示)', en: 'Share with students (demo)' },
  'top.shareToast': { zh: '🔗 分享链接已复制,学生可在浏览器/头显中打开(演示)', en: '🔗 Share link copied. Students can open it in a browser or headset (demo)' },
  'top.vr': { zh: '🥽 进入 VR 预览', en: '🥽 Enter VR' },
  'top.vrExit': { zh: '👁 退出 VR 预览', en: '👁 Exit VR Preview' },
  'top.vrTitle': { zh: '以学生第一人称预览 VR 画面(含手柄射线);再点一次或停止运行可退出', en: 'Preview the student first-person VR view (with controller rays); click again or stop play to exit' },
  'top.vrOn': { zh: '🥽 已进入学生第一人称 VR 预览 — WASD 移动,点击交互;再点顶栏或停止运行退出', en: '🥽 Student first-person VR preview — WASD to move, click to interact; click the top bar again or stop play to exit' },
  'top.vrOff': { zh: '👁 已退出 VR 预览,回到编辑视角', en: '👁 Exited VR preview — back to editor view' },
  'top.langTitle': { zh: '切换界面语言 / Switch language', en: 'Switch language / 切换界面语言' },
  'settings.btnTitle': { zh: '设置(语言 / 字号)', en: 'Settings (language / font size)' },
  'settings.title': { zh: '设置', en: 'Settings' },
  'settings.close': { zh: '关闭', en: 'Close' },
  'settings.language': { zh: '界面语言', en: 'Language' },
  'settings.langHint': { zh: '切换语言会刷新页面;当前场景会尽量自动恢复。', en: 'Switching language reloads the page; your scene is restored when possible.' },
  'settings.fontSize': { zh: '界面字号', en: 'UI font size' },
  'settings.fontSm': { zh: '小', en: 'S' },
  'settings.fontMd': { zh: '中', en: 'M' },
  'settings.fontLg': { zh: '大', en: 'L' },
  'settings.fontApplied': { zh: '字号已更新', en: 'Font size updated' },

  // ── 左栏 Tab ──
  'tab.projects': { zh: '📁 项目', en: '📁 Projects' },
  'tab.outline': { zh: '📋 学习大纲', en: '📋 Outline' },
  'tab.assets': { zh: '📦 资源库', en: '📦 Assets' },
  'tab.hierarchy': { zh: '🗂 场景层级', en: '🗂 Hierarchy' },

  // ── 项目面板 ──
  'proj.new': { zh: '➕ 新建项目', en: '➕ New Project' },
  'proj.import': { zh: '📥 导入课程', en: '📥 Import course' },
  'proj.importTitle': { zh: '导入 .xrcourse / .xrscene 或本编辑器导出的 HTML(含完整大纲与各节内容)', en: 'Import a .xrcourse / .xrscene package or exported HTML (full outline + section contents)' },
  'proj.downloadCourse': { zh: '⬇ 下载课程包', en: '⬇ Download course' },
  'proj.downloadCourseTitle': { zh: '下载单个 .xrcourse 文件(含大纲、知识图谱、阅读/H5/测验/3D)', en: 'Download one .xrcourse file (outline, knowledge graph, reading/H5/quiz/3D)' },
  'proj.downloadCourseOk': { zh: '⬇ 已下载课程包「{name}」', en: '⬇ Downloaded course package "{name}"' },
  'proj.empty': { zh: '还没有项目<br>点「新建项目」保存当前课程,或导入 .xrcourse 课程包', en: 'No projects yet<br>Click "New Project" to save the current course, or import a .xrcourse package' },
  'proj.current': { zh: '当前', en: 'Current' },
  'proj.workingDraftName': { zh: '📝 工作暂存(未保存课程)', en: '📝 Working draft (unsaved course)' },
  'proj.workingDraftBadge': { zh: '暂存', en: 'Draft' },
  'proj.open': { zh: '打开', en: 'Open' },
  'proj.rename': { zh: '重命名', en: 'Rename' },
  'proj.copy': { zh: '创建副本', en: 'Duplicate' },
  'proj.copied': { zh: '📄 已创建副本「{name}」', en: '📄 Duplicated as "{name}"' },
  'proj.delete': { zh: '删除', en: 'Delete' },
  'proj.newEmptyNote': { zh: '新建项目会从空场景开始。当前课程会自动存入「工作暂存」,可随时从项目列表恢复。继续?', en: 'A new project starts from an empty scene. Your current course will be auto-saved to Working draft (recover anytime from the project list). Continue?' },
  'proj.objects': { zh: '{n} 个对象', en: '{n} objects' },
  'proj.defaultName': { zh: '未命名项目', en: 'Untitled Project' },
  'proj.newNamePrompt': { zh: '项目名称:', en: 'Project name:' },
  'proj.renamePrompt': { zh: '新的项目名称:', en: 'New project name:' },
  'proj.deleteConfirm': { zh: '删除项目「{name}」?此操作不可撤销。', en: 'Delete project "{name}"? This cannot be undone.' },
  'proj.saved': { zh: '💾 已保存到项目「{name}」', en: '💾 Saved to project "{name}"' },
  'proj.saveFailed': { zh: '⚠ 保存失败:{err}', en: '⚠ Save failed: {err}' },
  'proj.quotaEvicted': { zh: '⚠ 浏览器存储已满,已自动清理旧项目({names})以保存本次课程', en: '⚠ Browser storage was full — removed older project(s) ({names}) to save this course' },
  'proj.samplesTitle': { zh: '示例课程(点开即用)', en: 'Sample courses (ready to open)' },
  'proj.myProjectsTitle': { zh: '我的项目', en: 'My projects' },
  'proj.sampleBadge': { zh: '示例', en: 'Sample' },
  'proj.sections': { zh: '{n} 个小节', en: '{n} sections' },
  'proj.sampleOpenTitle': { zh: '打开这个示例课程', en: 'Open this sample course' },
  'proj.sampleOpenConfirm': { zh: '打开示例课程「{name}」?当前课程会先自动暂存。', en: 'Open the sample course "{name}"? Your current course is auto-stashed first.' },
  'proj.sampleOpened': { zh: '📚 已打开示例课程「{name}」({sections} 个小节)', en: '📚 Opened sample course "{name}" ({sections} sections)' },
  'proj.sampleFailed': { zh: '⚠ 示例课程加载失败:{err}', en: '⚠ Could not load the sample course: {err}' },
  'proj.quotaFull': { zh: '浏览器存储放不下这个课程。请在「项目」里连接本地文件夹保存,或先下载 .xrcourse 课程包再删掉旧项目。', en: 'This course does not fit in browser storage. Connect a local folder in Projects, or download the .xrcourse package and delete older projects first.' },
  'proj.loaded': { zh: '📂 已打开项目「{name}」', en: '📂 Opened project "{name}"' },
  'proj.loadFailed': { zh: '⚠ 项目载入失败:{err}', en: '⚠ Failed to load project: {err}' },
  'proj.deleted': { zh: '🗑 已删除项目「{name}」', en: '🗑 Deleted project "{name}"' },
  'proj.created': { zh: '✨ 已创建项目「{name}」', en: '✨ Created project "{name}"' },
  'proj.openConfirm': { zh: '打开「{name}」会替换当前场景。当前课程会自动存入「工作暂存」(可随时恢复);不需要时可手动删除暂存。继续?', en: 'Opening "{name}" replaces the current scene. Your current course will be auto-saved to Working draft (recover anytime; delete the draft if you do not need it). Continue?' },
  'proj.importOk': { zh: '📥 已导入「{name}」({n} 个对象)', en: '📥 Imported "{name}" ({n} objects)' },
  'proj.importCourseOk': { zh: '📥 已导入课程「{name}」({sections} 节 · {n} 个 3D 对象)', en: '📥 Imported course "{name}" ({sections} sections · {n} 3D objects)' },
  'proj.importBad': { zh: '⚠ 导入失败:{err}', en: '⚠ Import failed: {err}' },
  'proj.importNotOurs': { zh: '不是 XR EduAgent 课程包(需要 .xrcourse / .xrscene,或含场景数据块的导出 HTML)', en: 'Not an XR EduAgent course package (need .xrcourse / .xrscene, or exported HTML with a scene data block)' },
  'proj.importTooBig': { zh: '文件过大(>25MB),拒绝导入', en: 'File too large (>25MB), import refused' },
  'proj.importBadSchema': { zh: '课程数据校验未通过:{detail}', en: 'Course data failed validation: {detail}' },
  'proj.importConfirm': { zh: '导入「{name}」({n} 个对象)?将替换当前场景(当前课程会先自动暂存)。\n\n注意:场景内可能包含 AI 生成的行为代码,只导入你信任的文件。', en: 'Import "{name}" ({n} objects)? This replaces the current scene (current course is auto-stashed first).\n\nNote: scenes may contain AI-generated behavior code. Only import files you trust.' },
  'proj.importCourseConfirm': { zh: '导入课程「{name}」({sections} 节 · {n} 个 3D 对象)?将替换当前课程(会先自动暂存)。\n\n注意:可能含 AI 生成的行为代码,只导入你信任的文件。', en: 'Import course "{name}" ({sections} sections · {n} 3D objects)? This replaces the current course (auto-stashed first).\n\nNote: may contain AI-generated behavior code. Only import files you trust.' },
  'proj.liveDegrade': { zh: 'ℹ 实时数据面板已降级为静态快照(实验模板可重新生成)', en: 'ℹ Live data panels were restored as static snapshots (re-run the template to restore them)' },
  'proj.storageBrowser': { zh: '存储: 浏览器 localStorage(容量有限,清缓存会丢)', en: 'Storage: browser localStorage (limited; cleared if you wipe site data)' },
  'proj.storageFolder': { zh: '存储: 本地文件夹「{name}」', en: 'Storage: local folder "{name}"' },
  'proj.connectFolder': { zh: '📂 选择项目文件夹', en: '📂 Choose projects folder' },
  'proj.folderBtnTitle': { zh: '浏览项目', en: 'Browse projects' },
  'proj.overlayTitle': { zh: '项目', en: 'Projects' },
  'proj.closeOverlay': { zh: '关闭', en: 'Close' },

  // ── 学习大纲 ──
  'outline.addChapter': { zh: '＋ 章', en: '+ Chapter' },
  'outline.addSection': { zh: '＋ 节', en: '+ Section' },
  'outline.empty': { zh: '还没有大纲<br>点「＋ 章」开始设计课程', en: 'No outline yet<br>Click "+ Chapter" to start' },
  'outline.editCourseTitle': { zh: '编辑课程标题', en: 'Edit course title' },
  'outline.editCourseGoal': { zh: '编辑课程目标', en: 'Edit course goal' },
  'outline.editChapter': { zh: '编辑章节名称', en: 'Edit chapter name' },
  'outline.editSection': { zh: '编辑小节标题', en: 'Edit section title' },
  'outline.editPurpose': { zh: '编辑本节目的', en: 'Edit section purpose' },
  'outline.courseGoalPh': { zh: '课程目标(可选)…', en: 'Course goal (optional)…' },
  'kg.btnLabel': { zh: '知识图谱', en: 'Knowledge Graph' },
  'kg.btnTitle': { zh: '查看本课知识图谱 / 思维导图', en: 'View this course knowledge graph / mind map' },
  'kg.btnEmptyTitle': { zh: '尚未生成知识图谱(先「据此备课」)', en: 'No knowledge graph yet (run “Build from this” first)' },
  'kg.overlayTitle': { zh: '知识图谱', en: 'Knowledge Graph' },
  'kg.close': { zh: '关闭', en: 'Close' },
  'kg.empty': { zh: '图谱为空', en: 'Graph is empty' },
  'kg.detailHint': { zh: '点击节点查看详情', en: 'Click a node for details' },
  'kg.panHint': { zh: '左键拖拽平移 · 点击节点查看详情', en: 'Drag to pan · Click a node for details' },
  'outline.purposePh': { zh: '本节目的…', en: 'Section purpose…' },
  'outline.changeType': { zh: '切换节类型', en: 'Change section type' },
  'outline.delChapter': { zh: '删除章', en: 'Delete chapter' },
  'outline.delSection': { zh: '删除节', en: 'Delete section' },
  'outline.delChapterConfirm': { zh: '删除章节「{name}」及其所有小节?', en: 'Delete chapter "{name}" and all its sections?' },
  'outline.delSectionConfirm': { zh: '删除小节「{name}」?', en: 'Delete section "{name}"?' },
  'outline.keepOne': { zh: '至少保留一章一节', en: 'Keep at least one chapter and one section' },
  'outline.chapterAdded': { zh: '已添加章节', en: 'Chapter added' },
  'outline.sectionAdded': { zh: '已添加小节', en: 'Section added' },
  'outline.type.vr': { zh: '3D / VR', en: '3D / VR' },
  'outline.type.vrStudy': { zh: '3D 场景', en: '3D Scene' },
  'outline.type.reading': { zh: '阅读', en: 'Reading' },
  'outline.type.h5': { zh: '2D H5', en: '2D H5' },
  'outline.type.quiz': { zh: '测验', en: 'Quiz' },

  // ── 节工作区 Reading / H5 / Quiz ──
  'ws.fontSize': { zh: '字号', en: 'Font size' },
  'ws.sizeNormal': { zh: '常规', en: 'Normal' },
  'ws.sizeLarge': { zh: '大', en: 'Large' },
  'ws.sizeSmall': { zh: '小', en: 'Small' },
  'ws.color': { zh: '文字颜色', en: 'Text color' },
  'ws.formula': { zh: '插入公式', en: 'Insert formula' },
  'ws.formulaPrompt': { zh: '输入 LaTeX 公式', en: 'Enter LaTeX formula' },
  'ws.image': { zh: '插入图片', en: 'Insert image' },
  'ws.followUp': { zh: '课后追问 / 小测', en: 'Follow-up quiz' },
  'ws.qMcq': { zh: '选择题', en: 'Multiple choice' },
  'ws.qShort': { zh: '简答题', en: 'Short answer' },
  'ws.questionPh': { zh: '题目…', en: 'Question…' },
  'ws.optionPh': { zh: '选项 {n}', en: 'Option {n}' },
  'ws.answerPh': { zh: '参考答案…', en: 'Answer key…' },
  'ws.explainPh': { zh: '解析(可选)…', en: 'Explanation (optional)…' },
  'ws.addChunk': { zh: '＋ 知识块', en: '+ Knowledge chunk' },
  'ws.chunkTitlePh': { zh: '知识块标题…', en: 'Chunk title…' },
  'ws.h5Prompt': { zh: '生成提示词', en: 'Generation prompt' },
  'ws.h5PromptPh': { zh: '描述你想要的 H5 可视化 / 交互(结合本节目的)…', en: 'Describe the H5 visualization / interaction (tie to this section’s purpose)…' },
  'ws.h5Generate': { zh: '生成 H5', en: 'Generate H5' },
  'ws.h5Empty': { zh: '输入提示词后点「生成 H5」', en: 'Enter a prompt, then click Generate H5' },
  'ws.h5NeedPrompt': { zh: '请先填写提示词', en: 'Please enter a prompt first' },
  'ws.h5NeedLlm': { zh: '需要配置 LLM 才能生成', en: 'LLM must be configured to generate' },
  'ws.h5Generating': { zh: '生成中…', en: 'Generating…' },
  'ws.h5Ready': { zh: '已生成', en: 'Ready' },
  'ws.h5Done': { zh: 'H5 已生成', en: 'H5 generated' },
  'ws.h5Fail': { zh: 'H5 生成失败', en: 'H5 generation failed' },
  'ws.quizHint': { zh: '章末测验:添加选择题或简答题', en: 'End-of-chapter quiz: add MCQ or short-answer items' },
  'ws.addMcq': { zh: '＋ 选择题', en: '+ Multiple choice' },
  'ws.addShort': { zh: '＋ 简答题', en: '+ Short answer' },
  'ws.quizEmpty': { zh: '还没有题目 — 建议放在章末做综合测验', en: 'No questions yet — usually placed at chapter end' },

  // ── 学习模式 ──
  'learn.start': { zh: '▶ 开始学习', en: '▶ Start Learning' },
  'learn.exit': { zh: '↩ 退出学习', en: '↩ Exit Learning' },
  'learn.agentTitle': { zh: '📘 学习助教', en: '📘 Learning companion' },
  'learn.entered': { zh: '已进入学习模式', en: 'Entered learning mode' },
  'learn.exited': { zh: '已退出学习,备课界面已恢复', en: 'Exited learning — authoring UI restored' },
  'learn.inputPh': { zh: '有哪里不懂?问学习助教——它会引导你自己想明白…', en: 'Stuck on something? Ask the companion — it will guide you to figure it out…' },
  'learn.needCourse': { zh: '请先等课程流水线全部完成（各节状态为 ✓）后再开始学习', en: 'Wait until the full course is built (every section ✓) before starting' },
  'learn.correct': { zh: '回答正确！', en: 'Correct!' },
  'learn.incorrect': { zh: '不太对，再试试。', en: 'Not quite — try again.' },
  'learn.shortPh': { zh: '在此输入你的答案…', en: 'Type your answer here…' },
  'learn.submit': { zh: '提交', en: 'Submit' },
  'learn.resubmit': { zh: '重新提交', en: 'Resubmit' },
  'learn.checking': { zh: '评阅中…', en: 'Checking…' },
  'learn.followUp': { zh: '想一想', en: 'Check your understanding' },

  'proj.connectFolderTitle': { zh: '把课程保存为文件夹里的 .xrcourse 文件(需 Chrome/Edge)', en: 'Save courses as .xrcourse files in a folder (Chrome/Edge)' },
  'proj.folderDisconnectConfirm': { zh: '断开本地文件夹?项目列表将切回浏览器存储(已保存的 .xrcourse 文件仍在磁盘上)。', en: 'Disconnect the local folder? The list will switch back to browser storage (your .xrcourse files remain on disk).' },
  'proj.disconnectFolder': { zh: '断开文件夹', en: 'Disconnect folder' },
  'proj.folderConnected': { zh: '✅ 已连接项目文件夹「{name}」', en: '✅ Connected to projects folder "{name}"' },
  'proj.folderDenied': { zh: '⚠ 未获得文件夹访问权限', en: '⚠ Folder access was denied' },
  'proj.folderUnsupported': { zh: '⚠ 当前浏览器不支持本地文件夹存储,请用 Chrome 或 Edge', en: '⚠ This browser cannot use local folder storage — use Chrome or Edge' },

  'assets.search': { zh: '搜索教学资源…', en: 'Search assets…' },
  'assets.hint': { zh: '💡 将资源<b>拖入</b>中间视口,或<b>双击</b>直接添加', en: '💡 <b>Drag</b> an asset into the viewport, or <b>double-click</b> to add' },
  'assets.dropHint': { zh: '松开以放置到场景中', en: 'Release to place in the scene' },
  'assets.added': { zh: '已添加「{name}」', en: 'Added "{name}"' },
  'scene.systemObj': { zh: '🧍 这是系统对象(学生视角),不能删除;可以拖动它调整学生出生位置', en: '🧍 This is a system object (Student View) and cannot be deleted; drag it to move the student spawn point' },

  // ── 场景层级 ──
  'hier.title': { zh: '场景中的对象', en: 'Objects in Scene' },
  'hier.clear': { zh: '清空', en: 'Clear' },
  'hier.clearTitle': { zh: '清空场景', en: 'Clear scene' },
  'hier.empty': { zh: '场景是空的<br>从资源库拖入对象,或让右侧 AI 助教帮你生成 →', en: 'The scene is empty<br>Drag in assets, or ask the AI assistant on the right →' },
  'hier.virtual': { zh: '⚙️ 系统与控制器', en: '⚙️ System & Controllers' },
  'hier.virtualNote': { zh: '虚拟对象:不显示在场景里,但控制运行逻辑', en: 'Virtual objects: invisible in the scene, but control runtime logic' },
  'hier.cleared': { zh: '场景已清空', en: 'Scene cleared' },

  // ── 视口工具栏 / 状态栏 ──
  'vt.move': { zh: '移动', en: 'Move' }, 'vt.moveTitle': { zh: '移动 (W)', en: 'Move (W)' },
  'vt.rotate': { zh: '旋转', en: 'Rotate' }, 'vt.rotateTitle': { zh: '旋转 (E)', en: 'Rotate (E)' },
  'vt.scale': { zh: '缩放', en: 'Scale' }, 'vt.scaleTitle': { zh: '缩放 (R)', en: 'Scale (R)' },
  'vt.focus': { zh: '聚焦', en: 'Focus' }, 'vt.focusTitle': { zh: '聚焦选中对象 (F)', en: 'Focus selection (F)' },
  'vt.grid': { zh: '网格', en: 'Grid' }, 'vt.gridTitle': { zh: '显示/隐藏网格', en: 'Show/hide grid' },
  'vt.play': { zh: '运行', en: 'Play' }, 'vt.playing': { zh: '运行中', en: 'Playing' },
  'vt.playTitle': { zh: '运行/编辑模式切换:运行=动画播放+学生交互生效;编辑=全静态,点击对象即选中', en: 'Toggle Play/Edit: Play = animations + student interactions; Edit = static, click to select' },
  'vt.undo': { zh: '撤销', en: 'Undo' }, 'vt.undoTitle': { zh: '撤销 (Ctrl+Z)', en: 'Undo (Ctrl+Z)' },
  'vt.redo': { zh: '重做', en: 'Redo' }, 'vt.redoTitle': { zh: '重做 (Ctrl+Shift+Z)', en: 'Redo (Ctrl+Shift+Z)' },
  'st.objects': { zh: '对象: {n}', en: 'Objects: {n}' },
  'st.noSelection': { zh: '未选中', en: 'Nothing selected' },
  'st.selected': { zh: '选中: {name}', en: 'Selected: {name}' },
  'st.multiSelected': { zh: '已选中 {n} 个对象(全部进入 AI 上下文;Del 可批量删除)', en: '{n} objects selected (all in AI context; Del removes them)' },
  'vp.driveHint': { zh: '🎮 WASD 移动学生 · ← → 转向 · 右下角为学生视角 · 停止运行后位置自动复位', en: '🎮 WASD moves the student · ← → turns · bottom-right shows the student view · position resets when you stop Play' },
  'vp.pipLabel': { zh: '🎥 学生视角', en: '🎥 Student view' },
  'st.help': { zh: '左键选中,Shift+点击多选(▶ 运行时=触发交互,Alt+点击选中)· 拖动旋转视角 · 滚轮缩放 · 右键平移 | W/E/R 切换工具 · F 聚焦 · Del 删除 · 方向键行走', en: 'Click = select, Shift+click = multi-select (in Play: interact, Alt+click selects) · Drag = orbit · Wheel = zoom · Right-drag = pan | W/E/R tools · F focus · Del delete · Arrows walk' },
  'vp.playOn': { zh: '▶ 运行模式:动画播放,学生交互已生效(Alt+点击仍可选中)', en: '▶ Play mode: animations on, student interactions live (Alt+click still selects)' },
  'vp.playOff': { zh: '🛠 编辑模式:全部静态,点击对象=选中编辑', en: '🛠 Edit mode: static, click = select' },
  'vp.editHint': { zh: '🛠 编辑模式:点击=选中。点工具栏 ▶ 运行,即可体验学生视角的交互', en: '🛠 Edit mode: click = select. Press ▶ Play in the toolbar to try student interactions' },
  'vp.deleted': { zh: '已删除对象', en: 'Object deleted' },

  // ── 检查器 ──
  'insp.pos': { zh: '位置', en: 'Pos' },
  'insp.scale': { zh: '缩放', en: 'Scale' },
  'insp.color': { zh: '颜色', en: 'Color' },
  'insp.spin': { zh: '自转', en: 'Spin' },
  'insp.textSec': { zh: '📝 面板文字', en: '📝 Panel Text' },
  'insp.purposeSec': { zh: '📖 这是什么', en: '📖 What is this' },
  'insp.animSec': { zh: '🔁 动画', en: '🔁 Animation' },
  'insp.interSec': { zh: '🖱 交互与联动', en: '🖱 Interactions & Links' },
  'insp.aiPh': { zh: '告诉 AI 怎么改这个对象…(Enter 发送)', en: 'Tell the AI how to change this object… (Enter to send)' },
  'insp.aiSendTitle': { zh: '发送给 AI 助教(自动带上此对象的完整上下文)', en: 'Send to AI assistant (object context attached automatically)' },
  'insp.deleteTitle': { zh: '删除 (Del)', en: 'Delete (Del)' },
  'panel.untitled': { zh: '面板', en: 'Panel' },
  'panel.liveBadge': { zh: '实时数据面板', en: 'Live data panel' },
  'panel.liveNote': { zh: '内容由代码实时驱动,不能直接改文字;想改显示逻辑请用下方 AI 指令', en: 'Content is driven by code and cannot be edited directly; use the AI box below to change its logic' },
  'panel.titlePlaceholder': { zh: '标题(可留空)', en: 'Title (optional)' },
  'panel.linesTip': { zh: '一行一条;写成 键|值 会显示为左右对齐的参数行', en: 'One entry per line; "key|value" renders as an aligned parameter row' },
  'insp.purposePanel': { zh: '悬浮 3D 教学面板,始终面向学生', en: 'Floating 3D teaching panel, always faces the student' },
  'insp.purposeExp': { zh: '实验装置,学生可点击操作', en: 'Lab apparatus; students can click to operate it' },
  'insp.purposeCustom': { zh: 'AI 代码生成的自定义对象', en: 'Custom object generated by AI code' },
  'insp.purposeBuiltin': { zh: '程序化生成的教学对象', en: 'Procedurally generated teaching object' },
  'insp.disabled': { zh: '(已停用)', en: ' (disabled)' },
  'insp.customFrame': { zh: 'AI 代码驱动的每帧行为(粒子/模拟/联动)', en: 'AI-coded per-frame behavior (particles / simulation / links)' },
  'insp.clickTrigger': { zh: '🖱 学生点击/扳机可触发', en: '🖱 Students can click / pull trigger' },
  'insp.grabbable': { zh: '✋ 学生可抓取拖动', en: '✋ Students can grab & drag' },
  'insp.refOut': { zh: '→ 读取/控制:', en: '→ Reads/controls: ' },
  'insp.refIn': { zh: '← 被这些对象引用:', en: '← Referenced by: ' },
  'insp.refChipTitle': { zh: '点击定位到左侧场景层级', en: 'Click to locate in the hierarchy' },
  'insp.actDefault': { zh: '学生点击时按实验步骤响应', en: 'Responds to student clicks following the experiment steps' },

  // ── 聊天 ──
  'chat.title': { zh: '✨ AI 助教 Agent', en: '✨ AI Teaching Agent' },
  'chat.modeTitle': { zh: 'Ask 只解释 / Plan 先出计划确认 / Agent 直接执行', en: 'Ask = explain only / Plan = confirm a plan first / Agent = act directly' },
  'chat.inputPh': { zh: '用自然语言描述你想要的教学场景,例如:\n帮我创建一个太阳系模型,让行星转起来', en: 'Describe the scene you want, e.g.:\nCreate a solar system and make the planets orbit' },
  'chat.sendTitle': { zh: '发送 (Enter)', en: 'Send (Enter)' },
  'chat.modelTitle': { zh: '选择模型', en: 'Choose model' },
  'chat.effortTitle': { zh: '思考深度:Auto 为预设组合(推荐),低/中/高 全程统一', en: 'Thinking effort: Auto uses tuned presets (recommended); low/med/high apply throughout' },
  'chat.budgetTitle': { zh: '输出预算:复杂场景若被截断(如生态圈),调大预算即可。调大上限不额外计费,只按实际生成付费', en: 'Output budget: raise it if complex scenes get truncated. A higher cap costs nothing extra — you only pay for what is generated' },
  'chat.attachTitle': { zh: '上传教学文档 (PDF / Word / PPT…) → 转 Markdown+图,供 Agent 备课', en: 'Upload teaching doc (PDF / Word / PPT…) → Markdown+images for the agent' },
  'chat.docBarLabel': { zh: '教学材料:', en: 'Material:' },
  'chat.docBuild': { zh: '据此备课', en: 'Build from this' },
  'chat.docBuildWipeConfirm': {
    zh: '据此备课会清空当前全部章节/小节、知识图谱、3D 场景，并开启新会话（上一份材料的对话上下文也会清除）。是否继续？',
    en: 'Building from this will wipe all current chapters/sections, the knowledge graph, and 3D scenes, then start a new session (chat context from the previous material is cleared too). Continue?',
  },
  'chat.docBuildWiped': { zh: '已清空上一课，开始新备课会话', en: 'Previous course cleared — starting a fresh session' },
  'chat.docBuildLearnBlock': { zh: '请先退出学习模式再备课', en: 'Exit learn mode before building a course' },
  'chat.docReplaceConfirm': {
    zh: '上传新材料会清空当前课程（章节/知识图谱/3D）以及上一份 PDF 的对话上下文，然后只保留这份新材料。是否继续？',
    en: 'Uploading a new file will wipe the current course (chapters / knowledge graph / 3D) and the previous PDF’s chat context, then keep only this new material. Continue?',
  },
  'chat.docSessionReset': { zh: '已切换到新材料，上一会话上下文已清除', en: 'Switched to new material — previous session context cleared' },
  'chat.docClear': { zh: '移除', en: 'Remove' },
  'chat.docUploading': { zh: '正在解析文档…', en: 'Parsing document…' },
  'chat.docReady': { zh: '已挂载教学材料(Agent 每轮可读)', en: 'Teaching material attached (agent reads it each turn)' },
  'chat.docFail': { zh: '文档转换失败', en: 'Document conversion failed' },
  'chat.docNeedServer': {
    zh: 'PDF/Word 上传需要本机 Docling 后端:在仓库根目录运行 python server.py,打开 http://localhost:8000/。GitHub Pages 静态站无法转换文档。',
    en: 'PDF/Word upload needs the local Docling backend: run python server.py from the repo root and open http://localhost:8000/. GitHub Pages (static) cannot convert documents.',
  },
  'chat.docSumFullTitle': { zh: '📄 完整摘要', en: '📄 Full summary' },
  'chat.docSumClose': { zh: '关闭', en: 'Close' },

  // ── 导出 / 下载 ──
  'export.empty': { zh: '场景是空的,先搭点内容再导出', en: 'The scene is empty — build something first' },
  'export.done': { zh: '⬇ 已导出到 {path}(双击即可打开,支持 VR)', en: '⬇ Exported to {path} (double-click to open, VR-ready)' },
  'export.browser': { zh: '⬇ 已通过浏览器下载(用 python server.py 运行时会直接存到项目 download/ 目录)', en: '⬇ Downloaded via browser (with python server.py it saves straight into the project download/ folder)' },
};

export function t(key, vars) {
  const entry = DICT[key];
  let s = entry ? (entry[lang] ?? entry.zh) : key;
  if (vars) for (const [k, v] of Object.entries(vars)) s = s.replaceAll(`{${k}}`, v);
  return s;
}

// 静态 DOM 一次性刷新:data-i18n(innerHTML)/ data-i18n-title / data-i18n-ph
export function applyDomI18n(root = document) {
  root.querySelectorAll('[data-i18n]').forEach(el => { el.innerHTML = t(el.dataset.i18n); });
  root.querySelectorAll('[data-i18n-title]').forEach(el => { el.title = t(el.dataset.i18nTitle); });
  root.querySelectorAll('[data-i18n-ph]').forEach(el => { el.placeholder = t(el.dataset.i18nPh); });
  document.documentElement.lang = lang === 'en' ? 'en' : 'zh-CN';
}

export function setLang(l) {
  if (l === lang) return;
  localStorage.setItem('xr-lang', l);
  location.reload();
}
