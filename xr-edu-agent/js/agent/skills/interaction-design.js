// 技能:交互设计(设备无关的语义交互事件)
// ⚠ 注册表写法 + 零依赖(原因见 scene-organization.js 头注释),不要加 import/export
(globalThis.XR_AGENT_SKILLS ??= []).push({
  id: 'interaction-design',
  name: '交互设计',
  description: '设备无关的语义交互事件(点击/抓取)与游戏化玩法(近接收集/投放记分/计时挑战),PC 与 VR 一套代码',
  prompt: `【交互设计技能】所有学生交互只写"语义事件",绝不写鼠标/手柄相关代码——平台的 Interactor 层会自动映射(PC:点击=activate、按住拖动=grab/drag;VR:扳机=activate、手柄抓握=grab/drag):
- activate(点/按):customClick(create_custom_object)或 click_code(set_behavior)。适合:推进实验步骤、开关设备、答题选择
- grab/drag/release(抓起/拖动/放下):userData.onGrab/onDrag/onRelease 或 set_behavior 的 grab_code/drag_code/release_code;(obj, detail) 签名,detail.point 是世界坐标。适合:可搬动教具(把砝码放上天平)、拖动滑块调参数、拼装零件
- 选型:一个对象一般只挑一种主交互;能用 activate 解决就别用 grab(VR 里点击比抓取省力)
- 交互目标要"够大"(≥0.15m),VR 射线才容易命中
- 反馈分两层:悬停描边发光和点击闪烁由平台自动提供(PC 鼠标 + VR 射线都有),不要自己写 hover/描边代码;你只需写"结果反馈"——交互成功后的几何/颜色/面板变化或 T.toast,让学生知道发生了什么
- 玩家感知助手(写复杂玩法的钥匙):T.playerPos() 学生地面位置(Vector3,y=脚底高度)、T.distToPlayer(obj) 学生到对象的水平距离、T.overlaps(a,b,margin) 两对象包围盒是否相交、T.teleportStudent(x,z,y) 强制传送、T.setSolid(obj,bool) 改碰撞实心
- 世界内 UI:T.notify(文字, {at:对象或坐标, title, accent}) 在场景里弹临时提示面板(自动消失,时长随文字长度)——VR 学生也能看到,优先于 T.toast(屏幕角标);"需要学生作答"的用 add_quiz_panel 工具,不要手写选择题
- 游戏化模式库(按课程需求自由组合,不要生搬硬套):
  ① 近接触发(吃豆人/踩点收集):customUpdate 里 if (T.distToPlayer(obj) < 0.8 && obj.visible) { obj.visible = false; 更新记分板; T.toast('+1') } —— visible 本身就是闩锁,不会重复触发
  ② 投放判定(垃圾分类/归位游戏):可抓对象的 releaseCode 里遍历各容器,T.overlaps(obj, bin, 0.2) 命中 → 对错判定(userData 里存类别标签)→ 更新记分板 + T.notify 反馈;放错就把对象弹回原位(userData 存出生点)
  ③ 记分板:一个带 live 面板的"控制器"对象存全局状态(scores/collected/timeLeft 在 userData),其它对象通过 getObjectByName 找它改数;胜利条件在控制器的 customUpdate 里判定,达成时 T.say 总结
  ④ 计时/节奏:customUpdate 的 t 参数是全局秒数,userData 里存 startT 可做倒计时、限时挑战
  ⑤ 条件解锁/任务链(密室门锁/闯关/"集齐才通过"):门/宝箱等"闸门"对象保持 solid + 锁定外观;条件源可以是 add_quiz_panel(答对后 userData.quiz.done=true)、收集计数(控制器 userData)、特定交互完成的 flag;控制器 customUpdate 轮询所有条件,全满足时执行一次解锁(latch 防重复):T.setSolid(门,false) + 门滑开/变色 + T.notify('门开了!', {at:门});多个关卡串成链 = 每关的解锁把下一关的线索 visible=true
- 不要另造"按钮/摇杆对象"去遥控别的对象——直接把交互挂在被操作的对象本体上,学生的直觉是"摸那个东西"(例外:电梯按钮/传送门这类本来就是按钮的东西)
- description/behaviorDesc 里用一句话写清"点击/抓取会怎样",老师在层级面板能看到并可 ▶ 预览`,
  nameEn: 'Interaction Design',
  descriptionEn: 'Device-agnostic semantic interactions (click/grab) and gameplay patterns (proximity collection / drop-zone scoring / timed challenges); one codebase for PC and VR',
  promptEn: `[Interaction Design] Write ONLY "semantic events" for student interaction — never mouse/controller code; the platform's Interactor layer maps devices automatically (PC: click=activate, press-drag=grab/drag; VR: trigger=activate, grip=grab/drag):
- activate (tap/press): customClick (create_custom_object) or click_code (set_behavior). Good for: advancing experiment steps, toggling devices, quiz choices
- grab/drag/release: userData.onGrab/onDrag/onRelease, or set_behavior's grab_code/drag_code/release_code; (obj, detail) signature, detail.point is a world coordinate. Good for: movable teaching props (place the weight on the balance), parameter sliders, assembling parts
- Selection: pick one primary interaction per object; prefer activate over grab when either works (clicking beats grabbing in VR)
- Interaction targets must be big enough (≥0.15m) for VR rays to hit
- Feedback has two layers: hover glow and click flash are provided by the platform automatically (PC mouse + VR ray) — never write your own hover/outline code; you only write "result feedback" — geometry/color/panel changes or T.toast after a successful interaction so students know what happened
- Player-awareness helpers (the key to complex gameplay): T.playerPos() student ground position (Vector3, y = feet height), T.distToPlayer(obj) horizontal distance from student to object, T.overlaps(a,b,margin) bounding-box intersection test, T.teleportStudent(x,z,y) forced teleport, T.setSolid(obj,bool) toggle collision
- In-world UI: T.notify(text, {at: object-or-point, title, accent}) pops a transient panel in the scene (auto-fades, duration scales with length) — visible to VR students too, prefer it over T.toast (a screen corner toast); when students must ANSWER something, use the add_quiz_panel tool instead of hand-rolling quizzes
- Gameplay pattern library (compose freely per lesson, don't copy blindly):
  ① Proximity trigger (Pac-Man dots / checkpoint collection): in customUpdate, if (T.distToPlayer(obj) < 0.8 && obj.visible) { obj.visible = false; update scoreboard; T.toast('+1') } — visible doubles as the latch, no repeat fires
  ② Drop-zone judging (garbage sorting / put-things-back games): in a grabbable's releaseCode, loop over containers, T.overlaps(obj, bin, 0.2) hit → right/wrong check (category tag in userData) → update scoreboard + T.notify; on wrong drops bounce the object back (spawn point kept in userData)
  ③ Scoreboard: one "controller" object with a live panel holds global state (scores/collected/timeLeft in userData); other objects find it via getObjectByName and mutate; win condition checked in the controller's customUpdate, T.say a summary when reached
  ④ Timing/pacing: customUpdate's t argument is global seconds; keep startT in userData for countdowns and timed challenges
  ⑤ Conditional unlock / quest chain (escape-room locks / staged levels / "collect all to pass"): the gate object (door/chest) stays solid with a locked look; condition sources: add_quiz_panel (userData.quiz.done=true after a correct answer), collection counters (controller userData), or interaction-completed flags; the controller's customUpdate polls all conditions and unlocks exactly once (latch it): T.setSolid(door,false) + slide/recolor the door + T.notify('The door is open!', {at: door}); chain stages by having each unlock set the next stage's clue visible=true
- Don't invent "button/joystick objects" to remote-control other objects — hang the interaction on the object itself; students' instinct is to touch the thing (exception: things that ARE buttons, like elevator buttons / portals)
- State in description/behaviorDesc what click/grab does in one sentence; the teacher sees it in the hierarchy and can ▶ preview it`,
});
