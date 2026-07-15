// 技能:排障与修复(分层排查 + 修复免疫;沉淀自 2026-07 台风场景排障实战)
// ⚠ 注册表写法 + 零依赖(原因见 scene-organization.js 头注释),不要加 import/export
(globalThis.XR_AGENT_SKILLS ??= []).push({
  id: 'debugging',
  name: '排障与修复',
  description: '老师报告"点了没反应/画面不动/交互坏了"等故障时必载:分层排查、定位、修复并防复发',
  prompt: `【排障技能】"点击有反应但画面不动"= 链路半通(这本身就是最重要的线索)。按从便宜到贵四问逐层二分:
① 环境层:运行模式(playMode)和动画时钟(animPlaying)开了吗?get_scene 先看全局状态——最常见、最便宜的病因,但修完仍坏说明有更深病灶,继续往下查
② 数据层:交互写入的状态真的变了吗?get_object_detail 看 userData 里的阶段/状态值。"点击能切阶段"说明 写入 半条链路是通的,问题只可能在 读取→驱动画面 那半条
③ 驱动层:每帧代码(update)跑完了吗?每帧代码里任何一句报错都会作废该帧整段逻辑(连续报错 ~1s 会被平台保险丝自动停用)。多个下游全都不动时,嫌疑最大的不是下游,而是它们共同依赖的上游控制器每帧没跑完。高频病根:沙盒代码是严格模式,给未声明的全局变量赋值(如 someGlobal = obj 想做全局登记)会直接抛错——共享状态一律放 obj.userData,跨对象读时 traverse 查找
④ 依赖层:代码查找的对象真的找到了吗?共享"控制器"状态的查找要三重兜底:按名字找 → 按 userData 标记 traverse → 都找不到用自身备用值照常动(永不罢工);找到后缓存引用,别每帧 traverse
定位手段:把看不见的数值变可见——给控制器 attach_label 挂 live 面板实时显示关键数值(如「当前强度 → 目标强度」),数字不涨 = 每帧引擎没转,一眼确诊;修完建议保留该面板当常驻"排障后门"
修复纪律:不只修一处,还要免疫——危险语句(跨对象访问/可能未定义的属性)一律 try{}catch(e){} 包住;单点依赖加兜底+缓存;状态机在进入运行模式时强制归零(上次停在峰值会污染这次开场);同类下游对象逐个排查同样病灶
验收闭环:修完不说"好了",给老师一个可验证动作——"点一下 X,2 秒内应看到 Y",老师能自己验证才算修完`,
  nameEn: 'Debugging & Repair',
  descriptionEn: 'Load whenever the teacher reports "clicked but nothing happens / scene frozen / interaction broken": layered diagnosis, localization, fix + immunization',
  promptEn: `[Debugging] "It reacts to clicks but nothing moves" = half the chain works (that observation itself is the biggest clue). Ask four questions, cheapest first, and bisect:
① Environment: are play mode (playMode) and the animation clock (animPlaying) on? get_scene first — the most common and cheapest cause; if fixing it doesn't help, a deeper defect exists, keep digging
② Data: did the interaction actually write state? get_object_detail and inspect the stage/state values in userData. "Clicks do switch stages" proves the write half works — the fault must be in the read→drive half
③ Driver: does the per-frame code (update) run to completion? Any single throw voids that frame's whole handler (and ~1s of repeated errors trips the platform fuse which disables it). When ALL downstream objects freeze, suspect the one upstream controller they share, not the five downstreams. Frequent root cause: sandbox code runs in strict mode, so assigning to an undeclared global (e.g. someGlobal = obj as a "global registry") throws immediately — keep shared state in obj.userData and traverse to find it from other objects
④ Dependency: did the code actually find the objects it looks up? Shared-"controller" lookups need triple fallback: by name → traverse by userData marker → fall back to a local default so the object keeps working (never strikes); cache the reference, never traverse every frame
Localization trick: make invisible values visible — attach_label a live panel on the controller showing the key numbers (e.g. "current → target intensity"); if the number never rises, the per-frame engine is dead — instant diagnosis. Keep the panel afterwards as a permanent debugging backdoor
Repair discipline: fix AND immunize — wrap risky statements (cross-object access / possibly-undefined props) in try{}catch(e){}; add fallback+cache to single-point dependencies; force state machines to reset on entering play mode (a stale peak from the last run pollutes the next); check sibling objects for the same defect
Acceptance loop: never just say "fixed" — give the teacher a verifiable action: "click X, within 2 seconds you should see Y"; it only counts as fixed once the teacher can verify it themselves`,
});
