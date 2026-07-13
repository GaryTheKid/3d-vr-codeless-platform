// 技能:室内场景设计(教室/密室/餐厅等"在房间里上课"的体验)
// ⚠ 注册表写法 + 零依赖(原因见 scene-organization.js 头注释),不要加 import/export
(globalThis.XR_AGENT_SKILLS ??= []).push({
  id: 'room-design',
  name: '室内场景',
  description: '老师要"教室/密室逃脱/餐厅/展厅/实验室/住宅户型"等室内体验(在房间里上课)时加载(build_room / build_stairs)',
  prompt: `【室内场景技能】"在房间里"的课(教室/密室/餐厅/展厅/住宅)按固定次序搭,别跳步:
1. 先 build_room 出壳:尺寸宁大勿小——VR 里房间比数字显小(教室 10×8、密室 6×6、展厅 12×10、最小的卫生间也 ≥2.5×2.5);每间必有门(door_wall,朝学生来的方向或走廊),"封闭密室"=门洞上放 solid 门对象由交互解锁,不是不开门;密室/夜景才开 ceiling(会变暗,自带顶灯补光),普通课保持无顶采光。墙体自动带碰撞(userData.solid),学生只能从门洞进出
2. 陈设沿墙摆、中央留空:VR 里学生要在中央活动,桌椅/展柜/黑板贴墙放,两件陈设间留 ≥1 米过道。【不出墙铁律】每件家具的整个包围盒必须落在房间内:家具中心到墙面距离 ≥ 家具半宽(或半深)+0.2 米——摆之前按房间半宽 w/2、半深 d/2 逐件心算校验,宁靠内勿贴边;摆完批量自查一遍坐标,发现越界立即 update_object 收回来
3. 陈设优先用资源库(desk/bookshelf/whiteboard…),缺的用 create_custom_object 造;每件独立成对象,老师才能微调
4. 多房间户型必须先在纸上画平面图再动手 —— 房间共享墙面、拼成连续矩形轮廓,绝不许一字排开:
   ① 户型骨架 = "公共区 + 走廊 + 私密区":客厅/餐厅是开放核心,卧室卫生间挂在走廊两侧
   ② 相邻房间中心距 = 两间半宽之和(如 5 宽挨着 4 宽 → 中心相距 4.5),墙面才能贴合(留 0.05 米防 z-fighting);整套户型的外轮廓应是一个矩形/L形,俯视没有缺口和飞地
   ③ 尺寸有差别且整体放大:客厅最大(6×5+)>主卧(5×4.5)>次卧(4×3.5)>卫生间(2.5×2.5);门一律开向走廊/公共区
   ④ 陈设"同类不同样":主卧双人床+衣柜+梳妆台、次卧单人床+书桌、儿童房小床+玩具;颜色/朝向/数量都要变,像真的有人住
   ⑤ 参考户型【3室2卫+厨房+客厅,轮廓 15×11,走廊横贯 z=1】(直接套用坐标再按需缩放):
      客厅 6×5.5 @(-4.5,3.5) 门n | 厨房 4×3.5 @(5.5,3.7) 门n(与客厅相邻)| 走廊即客厅北侧公共带
      主卧 5×4.5 @(-5,-2.5) 门s | 次卧 4×3.5 @(-0.5,-2.8) 门s | 儿童房 4×3.5 @(3.5,-2.8) 门s | 主卫 2.5×2.5 @(6.5,-2) 门w | 客卫 2.5×2.5 @(6.5,-4.8) 门w
5. 二层/多层楼:上层房间 build_room 时 y=下层墙高(如 3),必须 build_stairs 接通(rise=3,顶部自带缓步平台+护栏)。【楼梯对接铁律】平台尽头必须紧贴二层房间门洞外沿:门朝 s 的二层房间(中心 x0,z0,深 d)→ 楼梯 face=n、x=x0、起步 z = z0+d/2+run+landing;摆完自查平台末端与门洞坐标差 ≤0.3 米。【防坠落铁律】二层学生能走到的每一处都必须有墙或护栏围住(二层房间的门只开向楼梯平台/有围挡的连廊,绝不开向空中);连廊/露台用 create_custom_object 造带 solid 护栏的板。平台层运行时还有悬崖保护(平滑移动/WASD 不会走出 >0.6 米跌落沿),但瞬移仍可能越过,围挡不能省。"电梯"= 电梯间外观 + 按钮对象,按钮 clickCode 里 T.teleportStudent(x, z, 目标层高) 直达,不用做会动的轿厢
6. 移动与出生:configure_locomotion teleport + allowed_radius 圈住整个户型;set_student_view 放入口门外向内看(密室例外:放房间中央,醒来环顾四周找线索)
7. 密室逃脱模式:一个隐藏"控制器"对象管全局状态(userData 存 found 数组/门锁 flag),线索对象 customClick 里更新控制器并 T.notify 就地提示,集齐后开门(T.setSolid(门,false) + 播开门动画/改 visible);谜题 3~4 个为宜,难度递进;答题解锁用 add_quiz_panel(答对后它的 userData.quiz.done=true,控制器轮询这个标志)
8. 房间内 UI 面板:照常摆在房间里即可——平台有可见性规则(观看者在房间外时该房间面板自动隐藏,进房间后面板顶层渲染不被墙挡),不需要你处理遮挡;但面板仍应放在房间尺寸内、朝向学生活动区
9. 餐厅/对话类:参考内置英语点餐模板的结构(build_template english_cafe 可直接用再改装)
- 在总结里告诉老师房间布局逻辑:什么在哪面墙、学生从哪进、活动路线`,
  nameEn: 'Room Design',
  descriptionEn: 'Load when the teacher wants an in-room experience — classroom / escape room / restaurant / gallery / lab / home floor plan (build_room / build_stairs)',
  promptEn: `[Room Design] Build "in-a-room" lessons (classroom/escape room/restaurant/gallery/home) in this fixed order — do not skip steps:
1. build_room first: go bigger than feels necessary — rooms read smaller in VR (classroom 10×8, escape room 6×6, gallery 12×10, even the smallest bathroom ≥2.5×2.5); EVERY room must have a door (door_wall, facing where students arrive or the hallway) — a "locked escape room" means a solid door object in the doorway unlocked by interaction, never a sealed box; only enable ceiling for escape rooms / night scenes (it darkens the room; a lamp is added) — keep open-top otherwise. Walls are solid colliders (userData.solid) — students only pass through door openings
2. Furnish along walls, keep the center clear: students move in the middle in VR; leave ≥1 m aisles. [No-wall-crossing rule] every furniture piece's entire bounding box must sit inside the room: distance from furniture center to a wall ≥ half its width (or depth) + 0.2 m — mentally check each piece against the room's half-width w/2 / half-depth d/2 before placing, err toward the interior; after furnishing, re-check all coordinates and pull back anything sticking out with update_object
3. Prefer library assets (desk/bookshelf/whiteboard…); build missing pieces with create_custom_object; one object per furniture piece so the teacher can fine-tune
4. Multi-room homes: sketch the floor plan FIRST — rooms share walls and tile into one continuous rectangular footprint; never line rooms up in a row with gaps:
   ① Skeleton = "common area + hallway + private rooms": living/dining is the open core; bedrooms & bathrooms hang off the hallway
   ② Distance between adjacent room centers = sum of their half-widths (5-wide next to 4-wide → centers 4.5 apart) so walls touch (leave 0.05 m against z-fighting); the overall outline should read as one rectangle/L-shape from above — no notches or islands
   ③ Vary sizes and scale everything up: living room largest (6×5+) > master bedroom (5×4.5) > second bedroom (4×3.5) > bathroom (2.5×2.5); every door opens toward the hallway/common area
   ④ Furnish "same category, different look": master = double bed + wardrobe + dresser; second = single bed + desk; kids' = small bed + toys; vary colors/orientation/counts
   ⑤ Reference plan [3B2B + kitchen + living, footprint 15×11, hallway along z=1] (reuse coordinates, scale as needed):
      Living 6×5.5 @(-4.5,3.5) door n | Kitchen 4×3.5 @(5.5,3.7) door n (adjacent to living) | hallway = the strip north of them
      Master 5×4.5 @(-5,-2.5) door s | Bedroom2 4×3.5 @(-0.5,-2.8) door s | Kids 4×3.5 @(3.5,-2.8) door s | Bath1 2.5×2.5 @(6.5,-2) door w | Bath2 2.5×2.5 @(6.5,-4.8) door w
5. Second floor / multi-storey: build_room with y = lower wall height (e.g. 3), and it MUST be connected with build_stairs (rise=3; the stairs end in a landing platform with guard rails). [Stair-docking rule] the landing's far edge must touch the upper room's doorway (door s on an upper room at center (x0,z0), depth d → stairs face=n, x=x0, start z = z0+d/2+run+landing; after placing, verify landing end vs doorway differ by ≤0.3 m). [No-fall rule] every spot a student can reach on an upper floor must be enclosed by walls or railings (upper doors only open onto the stair landing / a railed walkway, never into thin air); build walkways/balconies with solid railings via create_custom_object. The runtime has ledge protection (smooth/WASD won't step off drops >0.6 m) but teleport can still cross it — never skip the railings. An "elevator" = an elevator-cab look + a button whose clickCode calls T.teleportStudent(x, z, targetFloorY) — do not build a moving cab
6. Locomotion & spawn: configure_locomotion teleport + allowed_radius fencing the whole plan; set_student_view outside the entrance looking in (escape-room exception: spawn at the center, waking up to look for clues)
7. Escape-room pattern: one hidden "controller" object holds global state (found array / door-lock flag in userData); each clue's customClick updates the controller and gives in-world feedback via T.notify; when complete, unlock the door (T.setSolid(door,false) + open animation / visible toggle); 3–4 puzzles with rising difficulty; for quiz-gated locks use add_quiz_panel (its userData.quiz.done=true after a correct answer — the controller polls that flag)
8. UI panels inside rooms: place them normally — the platform handles visibility (panels in a room auto-hide while the viewer is outside, and render on top once inside, never occluded by walls); still keep panels within the room bounds, facing the activity area
9. Restaurant / dialogue lessons: reuse the built-in English café template (build_template english_cafe, then modify)
- In your summary explain the layout logic: what sits on which wall, where students enter, and the activity flow`,
});
