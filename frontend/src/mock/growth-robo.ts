/**
 * 机甲大师单元的补充演示数据（领导版的板块结构 + 本单元内容），与 growth.ts 合并使用。
 */

export const ROBO_TODAY = [
  {
    id: 'RB01', type: 'LEARNING', title: '视觉组培训 · 第 3 讲 相机标定与 PnP', desc: '梯队培训录播，AI 已按字幕切成 6 段，每段对应一个知识点。',
    tags: ['机甲大师', '视觉', 'PnP'], source: '课程平台', publishAt: '2026-11-10 10:00:00', expireAt: null,
    reason: '你在「PnP 位姿解算」的掌握度只有 50%，这一讲 33:50 开始讲的就是它', score: 0.98, link: '/units/robo/read/rs4?part=p5',
  },
  {
    id: 'RB02', type: 'CONTEST', title: '机甲大师 · 视觉组自瞄方案研讨（第 2 期）', desc: '梯队内部技术研讨，讨论远距离 PnP 抖动和预测方案。',
    tags: ['机甲大师', '研讨'], source: '机器人梯队', publishAt: '2026-11-12 09:00:00', expireAt: '2026-11-20 23:59:59',
    reason: '你所在的灵眸队正处于「原型实现」关，这次研讨正好讨论本关难点', score: 0.95, link: '/units/robo?tab=practice',
  },
  {
    id: 'RB03', type: 'BOOK', title: '《自动控制原理》第 6.4 节 PID 控制器', desc: '教材原文，配合《PID 调参实战》视频一起看。',
    tags: ['PID', '教材'], source: '课程平台', publishAt: '2026-11-01 08:00:00', expireAt: null,
    reason: '你在「PID 控制」的掌握度只有 40%，是你目前最薄弱的知识点', score: 0.93, link: '/units/robo/read/rs2?part=p2',
  },
]

export const ROBO_TASKS = [
  { unitId: 'robo', id: 'T-RB-1', type: 'GENERATE', name: '代码评审 · 装甲板识别', difficulty: 'MEDIUM', mins: 20, expert: '竞赛导师', intro: '给你一段灯条配对代码，指出至少 3 个问题并说明改进思路。', lastScore: null },
  { unitId: 'robo', id: 'T-RB-2', type: 'ROLE_PLAY', name: '模拟答辩 · 方案设计关', difficulty: 'HARD', mins: 25, expert: '竞赛导师', intro: 'AI 扮演评审老师，针对你的自瞄方案连续追问 3 个问题。', lastScore: 76 },
  { unitId: 'robo', id: 'T-RB-3', type: 'EVALUATE', name: '坐标变换 · 快速评测', difficulty: 'EASY', mins: 8, expert: '学业导师', intro: '5 道坐标变换小题，AI 即时判分并指出错因。', lastScore: null },
]

export const ROBO_DISCUSSIONS = [
  {
    id: 'D-RB-1', topic: '自瞄方案研讨 · 远距离 PnP 抖动怎么办（第 2 期）', mode: 'OFFLINE', place: '线下 · 工程实训中心 B 座 210 梯队活动室',
    joinWay: '现场签到，带上自己的方案草稿。', startTime: '2026-11-19 19:00', endTime: '2026-11-19 21:00', signupStart: '2026-11-12 09:00', signupEnd: '2026-11-18 18:00',
    capacity: 12, signed: 6, creator: { name: '李振华', title: '视觉组指导教师 · 副教授', org: '机电工程学院' }, tags: ['机甲大师', '视觉', 'PnP'],
    intro: '围绕远距离装甲板 PnP 解算抖动的问题，对比几种改进思路（角点亚像素、滤波平滑、多帧融合），每队 5 分钟展示自己的方案。',
    outline: ['往届方案回顾：误差来源分析', '各队方案展示（每队 5 分钟）', '讨论：哪种改进最适合本赛季', '分工：下周原型验证'],
    requirements: '已完成第 3 关「识别与位姿解算」，或正在做「视觉识别与自动瞄准」课题。', rules: ['报名后需指导教师或助教审核', '无法参加请提前 4 小时取消'], credit: 0, units: ['robo'],
  },
]

export const ROBO_LECTURES = [
  {
    id: 'L-RB-1', name: '从比赛视角看机器人视觉：识别、解算与预测', mode: 'ONLINE', place: '线上 · 直播（可回看）', publisher: '机器人梯队',
    startTime: '2026-11-21 19:00', endTime: '2026-11-21 20:30', status: 'UPCOMING', signupMode: 'FREE', signupDeadline: '', audience: ['梯队成员', '全校本科生'],
    intro: '往届视觉组组长分享：一套自瞄系统从识别到命中的完整链路，以及比赛现场最常见的几类故障。',
    speaker: { name: '往届视觉组组长', title: '机器人梯队', bio: '负责过两个赛季的步兵自瞄系统。' },
    outline: ['自瞄系统整体框架', '识别模块的误识别与改进', '预测与弹道：命中率从哪里来', '比赛现场排障清单'],
    notice: ['免报名，直接进入直播间', '回放 3 个工作日内上线'], attachments: [{ name: '自瞄系统框架图.pdf', size: '1.1 MB', type: 'PDF' }], replay: '', units: ['robo'],
  },
]

export const ROBO_VR = [
  { unitId: 'robo', id: 'VR-RB-1', mode: 'ONLINE', name: '相机标定与 PnP · 虚拟仿真实验', subject: '计算机视觉基础', difficulty: 'MEDIUM', mins: 40, steps: 7, desc: '在虚拟场景中摆放棋盘格完成标定，再用标定结果对装甲板做 PnP 解算，观察距离误差随目标距离的变化。', abilities: ['相机标定', 'PnP 解算', '误差分析'], doneCount: 58, rating: 4.7 },
]

export const ROBO_VR_TEMPLATE = [
  { n: '进入虚拟标定场景', tip: '确认虚拟相机分辨率 1280×1024，点击"加载场景"。', act: '加载场景' },
  { n: '摆放棋盘格', tip: '在不同角度、覆盖画面不同区域摆放棋盘格，至少 12 个位姿。', act: '采集图像' },
  { n: '运行标定', tip: '用张正友法求解内参和畸变系数，查看重投影误差。', act: '开始标定' },
  { n: '加载装甲板目标', tip: '在 1 m、3 m、6 m 三个距离放置装甲板。', act: '放置目标' },
  { n: 'PnP 解算', tip: '对三个距离分别解算位姿，记录距离误差。', act: '解算' },
  { n: '注入角点噪声', tip: '给角点加 1 像素噪声，观察远距离误差的变化。', act: '注入噪声' },
  { n: '生成实验报告', tip: '系统汇总标定误差和解算误差，生成实验报告。', act: '完成实验' },
]
