// 技能:视角与导览(出生点/最佳观察角/导览路线设计)
// ⚠ 注册表写法 + 零依赖(原因见 scene-organization.js 头注释),不要加 import/export
(globalThis.XR_AGENT_SKILLS ??= []).push({
  id: 'view-navigation',
  name: '视角与导览',
  description: '涉及学生"从哪看/怎么逛":出生点与最佳观察角(set_student_view)、导览路线与指引(add_path/add_arrow)时加载',
  prompt: `【视角与导览技能】老师看到的是编辑器上帝视角,学生进 VR 却站在地上 1.6 米高度看——两者差别巨大,必须替学生设计视角:
- 场景里的「学生视角」代表物(🧍 系统对象)= 学生出生点与初始朝向;搭完场景必须用 set_student_view 把它摆到位,别让学生出生在模型内部或背对内容
- 定点课(locomotion=static):出生点就是唯一视角,放在距主体 2~4 米、正对主体处(look_at 传主体坐标);主体高于 2 米时站远些(距离≈高度×2),否则学生要仰头
- 可走动课:出生在场景边缘/门口面向内容,给学生"走进场景"的体验;多个观察点时设计参观顺序:
  ① add_path 画贴地导览路线(style=dashed 或 dots,show_direction=true,mark_waypoints=true)
  ② 路线经过每个展项前方 1.5~2 米处,而不是穿过展项
  ③ 【硬规则】路线绝不能穿墙:墙体有碰撞,学生物理上过不去。有房间时,路线必须逐点经过每个门洞中心(build_room 的门在 door_wall 那面墙的正中),即"房间A中心 → A门口 → 走廊 → B门口 → 房间B中心";画完在脑中沿路线走一遍,每一段都要么在同一房间内、要么正穿过某个门洞
  ④ configure_locomotion 设 teleport,allowed_radius 圈住路线范围
- add_arrow 做视线引导:role=guide,指向"下一个该看的东西";弧形箭头(curve_height>0)可示意抛物线/跳跃轨迹
- 【可见性规则】role≠content 的导览路线只在编辑模式可见——运行模式和导出播放器里自动对学生隐藏(它是老师的设计辅助线);箭头默认保留(常是教学内容);要学生看到的轨迹(轨道/河流)必须 role=content
- 引导图元用醒目色(黄 #f0c840 / 青 #4fd6ff),别和场景内容混色;数量克制,3~5 个就够,太多反而乱
- 在总结里告诉老师:学生会出生在哪、第一眼看到什么、按什么路线逛(并提醒:虚线路线学生看不到,它约束的是你的设计)`,
  nameEn: 'View & Navigation',
  descriptionEn: 'Load when the request involves where students look / how they tour: spawn & best viewing angle (set_student_view), guided routes & hints (add_path/add_arrow)',
  promptEn: `[View & Navigation] The teacher sees a god-view editor; the student stands on the ground at 1.6 m eye height in VR — a huge difference. Design the student's view deliberately:
- The "Student View" object (🧍 system object) = spawn point & initial facing; after building, always place it with set_student_view — never let students spawn inside a model or facing away
- Stationary lesson (locomotion=static): the spawn IS the only viewpoint — put it 2–4 m from the subject, facing it (pass look_at with the subject's coordinates); if the subject is taller than 2 m, stand further back (distance ≈ height × 2) so students don't crane their necks
- Walkable lesson: spawn at the scene edge / room door facing the content so students "walk in"; with multiple exhibits, design a visiting order:
  ① add_path to draw a floor-level tour route (style=dashed or dots, show_direction=true, mark_waypoints=true)
  ② Route passes 1.5–2 m in front of each exhibit, never through it
  ③ [HARD RULE] The route must NEVER cross a wall: walls have collision and students physically cannot pass. With rooms, the route must go waypoint-by-waypoint through each door opening (build_room puts the door at the center of the door_wall side): "room A center → A's doorway → hallway → B's doorway → room B center"; after drawing, mentally walk the route — every segment must stay inside one room or pass exactly through a doorway
  ④ configure_locomotion teleport with allowed_radius fencing the route
- add_arrow for gaze guidance: role=guide, pointing at "the next thing to look at"; curved arrows (curve_height>0) can depict parabolas / jump trajectories
- [VISIBILITY RULE] Routes with role≠content are visible in edit mode only — in play mode and exported players they are hidden from students automatically (they are the teacher's design aids); arrows stay visible by default (often actual teaching content); trajectories students must see (orbits/rivers) need role=content
- Use bright guide colors (yellow #f0c840 / cyan #4fd6ff) distinct from content; be restrained — 3–5 guides max, more becomes clutter
- In your summary tell the teacher: where students spawn, what they see first, and the touring route (and note the dashed route is invisible to students — it constrains your design)`,
});
