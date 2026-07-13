// 技能:实验逻辑设计(状态机 + 考点分支 + latch 纪律 + 控制器模式)
// ⚠ 注册表写法 + 零依赖(原因见 scene-organization.js 头注释),不要加 import/export
(globalThis.XR_AGENT_SKILLS ??= []).push({
  id: 'experiment-logic',
  name: '实验逻辑设计',
  description: '状态机 + 考点分支 + 复盘引导(对标内置制氧实验)',
  prompt: `【实验逻辑设计技能】高质量交互实验的骨架(customClick + customUpdate):
- 状态机:obj.userData.step 存当前阶段,customClick 里 switch(step) 推进;每步 T.toast 告知学生做了什么、下一步做什么
- 考点分支:在关键步骤故意留"顺序陷阱"(如制氧实验:先熄灯还是先撤导管),选错 → 播放后果动画 → T.say() 在聊天区复盘为什么错、引导重做;这是最有教学价值的部分,优先设计
- 【T.say/T.toast 必须加闩锁(latch),严禁每帧触发】customUpdate 每秒跑 ~60 次,条件式触发的提示必须只在状态"边沿"播一次:
  if(能量<阈值 && !obj.userData.warned){ obj.userData.warned=true; T.say('…复盘…'); }
  状态复位时清 flag(obj.userData.warned=false)才允许再播。没有 latch 的 T.say 会把聊天区刷爆
- 【跨对象联动用控制器模式】拆分后的多个实体要联动(能量流动/电流/温度扩散)时:先建一个"XX控制器"对象(小型不显眼几何或一块状态面板),共享数据存它的 userData(如 energy:{producer:100,c1:10});各实体对象的 customUpdate 里用 obj.parent.getObjectByName('控制器名') 读共享数据驱动自己,写数据也只写控制器。禁止各对象各自为政存一份状态
- 过程可视化:反应进度/能量值等存 userData,customUpdate 里驱动几何变化(液面上升/颜色渐变/粒子速率),再配 attach_label 或 add_panel 实时显示数值
- 可重置:实验结束或失败后,点击可回到初始 step,状态和几何都要复位(包括所有 latch flag)
- 参数可调:把速率/阈值等挂 userData 并在 behaviorDesc 里写明,老师能在 NL Inspector 里改`,
  nameEn: 'Experiment Logic',
  descriptionEn: 'State machine + exam-point branches + debrief guidance (benchmark: the built-in O2 experiment)',
  promptEn: `[Experiment Logic] Skeleton of a high-quality interactive experiment (customClick + customUpdate):
- State machine: obj.userData.step holds the stage; switch(step) in customClick advances it; every step T.toasts what just happened and what to do next
- Exam-point branches: deliberately leave "order traps" at key steps (e.g. O2 experiment: extinguish first or withdraw the tube first?); a wrong choice → play the consequence animation → T.say() debriefs in chat why it was wrong and prompts a redo; this is the most pedagogically valuable part — design it first
- [T.say/T.toast MUST be latched; never fire per frame] customUpdate runs ~60x/s; condition-triggered prompts must fire once on the state edge:
  if(energy<threshold && !obj.userData.warned){ obj.userData.warned=true; T.say('…debrief…'); }
  clear the flag on reset (obj.userData.warned=false) before it may fire again. An unlatched T.say floods the chat
- [Cross-object linkage via the controller pattern] when split entities must interact (energy flow/current/heat diffusion): first build an "XX controller" object (small unobtrusive geometry or a status panel); shared data lives in its userData (e.g. energy:{producer:100,c1:10}); each entity's customUpdate reads it via obj.parent.getObjectByName('controller name') to drive itself, and writes only to the controller. No per-object private copies of shared state
- Process visualization: keep progress/energy in userData and drive geometry from customUpdate (liquid level/color ramp/particle rate), plus attach_label or add_panel for live numbers
- Resettable: after finish or failure, a click returns to the initial step; reset both state and geometry (including every latch flag)
- Tunable params: hang rates/thresholds on userData and note them in behaviorDesc so the teacher can tweak them in the NL Inspector`,
});
