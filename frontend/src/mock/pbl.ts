/**
 * PBL 项目训练原型的演示数据（纯前端，不调后端）。
 * 内容是"机甲大师"主题的示例，人名均为虚构；拿到真实课程资料后替换本文件即可。
 * 所有时间都相对"生成数据的那一刻"计算，所以任何一天打开都像是项目正在进行中。
 */
import dayjs from 'dayjs'

export type PersonRole = 'admin' | 'mentor' | 'student'
export type ProjectStatus = 'draft' | 'recruiting' | 'running' | 'finished'
export type TeamingMode = 'free' | 'random'
export type ShareScope = 'team' | 'project' | 'school'
export type ResourceKind = 'pdf' | 'video' | 'doc' | 'ppt' | 'code' | 'image'

export interface Person {
  id: string
  name: string
  role: PersonRole
  college: string
  major?: string
  grade?: string
  title?: string
  bio?: string
}

export interface Program {
  id: string
  title: string
  source: '竞赛项目' | '企业项目' | '科研课题'
  partner: string
  college: string
  level: '本科' | '研究生' | '本研'
  description: string
  color: number
}

export interface Milestone {
  id: string
  title: string
  description: string
  start: string
  end: string
}

export interface TeamingRule {
  mode: TeamingMode
  teamCount: number
  maxPerTeam: number
  hasLeader: boolean
  deadline: string
  signupLimit: number
}

export interface Project {
  id: string
  programId: string
  title: string
  summary: string
  goals: string[]
  mentorIds: string[]
  tags: string[]
  status: ProjectStatus
  published: boolean
  views: number
  interestedIds: string[]
  milestones: Milestone[]
  teaming: TeamingRule
  signupIds: string[]
  createdAt: string
}

export interface Evaluation {
  score: number
  comment: string
  by: string
  at: string
}

export interface Showcase {
  title: string
  summary: string
  highlights: string[]
  at: string
}

export interface Team {
  id: string
  projectId: string
  name: string
  memberIds: string[]
  leaderId: string | null
  evaluation: Evaluation | null
  showcase: Showcase | null
}

export interface Task {
  id: string
  projectId: string
  milestoneId: string
  title: string
  description: string
  openAt: string
  dueAt: string
  maxAttempts: number
  fullScore: number
  urges: { teamId: string; at: string }[]
}

export interface Submission {
  id: string
  taskId: string
  teamId: string
  byId: string
  attempt: number
  content: string
  files: string[]
  at: string
  score: number | null
  comment: string
  recommended: boolean
}

export interface Resource {
  id: string
  projectId: string
  teamId: string | null
  folder: string
  title: string
  kind: ResourceKind
  size: number
  uploaderId: string
  scope: ShareScope
  allowDownload: boolean
  at: string
}

export interface Topic {
  id: string
  projectId: string
  title: string
  description: string
  type: 'public' | 'group'
  openAt: string
  dueAt: string
}

export interface Post {
  id: string
  topicId: string
  teamId: string | null
  parentId: string | null
  authorId: string
  content: string
  at: string
  likeIds: string[]
  pinned: boolean
}

export interface PblData {
  version: number
  people: Person[]
  programs: Program[]
  projects: Project[]
  teams: Team[]
  tasks: Task[]
  submissions: Submission[]
  resources: Resource[]
  topics: Topic[]
  posts: Post[]
}

export const DATA_VERSION = 1

const at = (days: number, hour = 10, minute = 0) =>
  dayjs().add(days, 'day').hour(hour).minute(minute).second(0).millisecond(0).toISOString()

const SURNAMES = '陈刘杨赵黄周吴徐孙马朱胡郭何高林罗郑梁谢宋唐许韩冯邓曹彭'.split('')
const GIVEN = [
  '子轩', '雨桐', '浩然', '思远', '嘉怡', '一鸣', '欣妍', '俊杰', '若曦', '宇航',
  '梓涵', '明哲', '诗琪', '天佑', '晨阳', '语嫣', '泽宇', '佳琪', '博文', '可馨',
  '志远', '雅琳', '睿哲', '书瑶', '逸凡', '安琪', '景行', '沐阳',
]
const MAJORS = ['自动化', '机械工程', '计算机科学与技术', '电子信息工程', '软件工程']

export function createSeed(): PblData {
  const people: Person[] = [
    { id: 'a1', name: '刘晓峰', role: 'admin', college: '机电工程学院', title: '学院教学管理员' },
    {
      id: 'm1', name: '李振华', role: 'mentor', college: '机电工程学院', title: '副教授',
      bio: '研究方向：机器视觉、嵌入式系统。指导机器人梯队视觉组多年。',
    },
    {
      id: 'm2', name: '王静', role: 'mentor', college: '计算机学院', title: '讲师',
      bio: '研究方向：移动机器人导航与定位、多传感器融合。',
    },
    {
      id: 'm3', name: '周明远', role: 'mentor', college: '机电工程学院', title: '高级工程师',
      bio: '研究方向：机械结构设计、运动控制。',
    },
  ]
  for (let i = 0; i < GIVEN.length; i++) {
    people.push({
      id: `s${i + 1}`,
      name: SURNAMES[i] + GIVEN[i],
      role: 'student',
      college: i % 3 === 0 ? '计算机学院' : '机电工程学院',
      major: MAJORS[i % MAJORS.length],
      grade: `${2023 + (i % 3)} 级`,
    })
  }

  const programs: Program[] = [
    {
      id: 'g1', title: '机甲大师 · 步兵机器人研发', source: '竞赛项目', partner: '机器人梯队', college: '机电工程学院',
      level: '本科', color: 0,
      description:
        '以机甲大师赛事中的步兵机器人为对象，把整车研发拆成机械、电控、视觉等课题。学生组队，从需求分析、方案设计一直做到实物联调和答辩。',
    },
    {
      id: 'g2', title: '机甲大师 · 哨兵与雷达系统', source: '竞赛项目', partner: '机器人梯队', college: '计算机学院',
      level: '本研', color: 2,
      description: '面向自主决策类机器人：哨兵的自主导航与决策、雷达站的目标检测与定位。偏算法与软件，适合有编程基础的同学。',
    },
    {
      id: 'g3', title: '智能巡检小车（校企合作示例）', source: '企业项目', partner: '合作企业（示例）', college: '机电工程学院',
      level: '本科', color: 4,
      description: '来自企业的真实需求：在厂区内自主巡检、识别仪表读数并上报异常。用于演示"企业项目 → 学生课题"的拆解。',
    },
  ]

  const runningMilestones = (pid: string): Milestone[] => [
    { id: `${pid}-ms1`, title: '需求分析与技术调研', description: '理解规则与需求，调研往届方案和相关技术。', start: at(-42), end: at(-29, 23, 59) },
    { id: `${pid}-ms2`, title: '方案设计', description: '完成总体方案和关键模块设计，通过方案评审。', start: at(-28), end: at(-15, 23, 59) },
    { id: `${pid}-ms3`, title: '原型实现', description: '实现核心功能，阶段性演示。', start: at(-14), end: at(7, 23, 59) },
    { id: `${pid}-ms4`, title: '联调与测试', description: '与整车联调，完成测试与迭代。', start: at(8), end: at(28, 23, 59) },
    { id: `${pid}-ms5`, title: '结项答辩', description: '提交成果材料，进行结项答辩与展示。', start: at(29), end: at(35, 23, 59) },
  ]
  const futureMilestones = (pid: string, offset: number): Milestone[] => [
    { id: `${pid}-ms1`, title: '需求分析与技术调研', description: '理解规则与需求，调研往届方案。', start: at(offset), end: at(offset + 13, 23, 59) },
    { id: `${pid}-ms2`, title: '方案设计', description: '完成总体方案设计并评审。', start: at(offset + 14), end: at(offset + 27, 23, 59) },
    { id: `${pid}-ms3`, title: '原型实现', description: '实现核心功能。', start: at(offset + 28), end: at(offset + 48, 23, 59) },
    { id: `${pid}-ms4`, title: '结项答辩', description: '成果展示与答辩。', start: at(offset + 49), end: at(offset + 56, 23, 59) },
  ]
  const finishedMilestones = (pid: string): Milestone[] => [
    { id: `${pid}-ms1`, title: '需求分析', description: '明确雷达站任务与评价指标。', start: at(-120), end: at(-100, 23, 59) },
    { id: `${pid}-ms2`, title: '方案设计', description: '检测、定位与通信方案。', start: at(-99), end: at(-80, 23, 59) },
    { id: `${pid}-ms3`, title: '实现与测试', description: '完成算法实现与场地测试。', start: at(-79), end: at(-40, 23, 59) },
    { id: `${pid}-ms4`, title: '结项答辩', description: '答辩与成果展示。', start: at(-39), end: at(-30, 23, 59) },
  ]

  const free = (teamCount: number, maxPerTeam: number, deadline: string): TeamingRule => ({
    mode: 'free', teamCount, maxPerTeam, hasLeader: true, deadline, signupLimit: teamCount * maxPerTeam,
  })

  const projects: Project[] = [
    {
      id: 'p1', programId: 'g1', title: '视觉识别与自动瞄准', mentorIds: ['m1'],
      summary: '让步兵机器人用相机识别对方装甲板，预测运动并自动瞄准。课题覆盖数据采集、目标检测、位姿解算和弹道补偿。',
      goals: ['在比赛光照条件下稳定识别装甲板，识别率达到 90% 以上', '完成位姿解算与运动预测，给出云台目标角度', '与电控组联调，实现自动瞄准演示'],
      tags: ['计算机视觉', 'C++', 'OpenCV'], status: 'running', published: true, views: 486,
      interestedIds: ['s1', 's3', 's7', 's12', 's15', 's20', 's22', 's25'],
      milestones: runningMilestones('p1'), teaming: free(4, 5, at(-40)), signupIds: [], createdAt: at(-50),
    },
    {
      id: 'p2', programId: 'g1', title: '底盘运动控制与功率管理', mentorIds: ['m3'],
      summary: '麦克纳姆轮底盘的运动学解算、速度闭环控制，以及在裁判系统功率上限下的功率分配策略。',
      goals: ['完成底盘运动学解算与速度闭环', '实现功率限制下的动态功率分配', '提交控制参数整定报告'],
      tags: ['自动控制', '嵌入式', 'C'], status: 'recruiting', published: true, views: 233,
      interestedIds: ['s2', 's5', 's9', 's20', 's21'],
      milestones: futureMilestones('p2', 10), teaming: free(3, 4, at(5, 23, 59)), signupIds: [], createdAt: at(-6),
    },
    {
      id: 'p3', programId: 'g1', title: '云台与发射机构设计', mentorIds: ['m3'],
      summary: '设计两轴云台与弹丸发射机构，完成结构设计、仿真校核和样机装配。',
      goals: ['完成云台与发射机构三维设计', '完成关键零件强度校核', '样机装配与射击精度测试'],
      tags: ['机械设计', 'SolidWorks'], status: 'recruiting', published: true, views: 198,
      interestedIds: ['s4', 's6', 's11', 's16'],
      milestones: futureMilestones('p3', 12),
      teaming: { mode: 'random', teamCount: 3, maxPerTeam: 4, hasLeader: true, deadline: at(3, 23, 59), signupLimit: 12 },
      signupIds: ['s2', 's4', 's6', 's8', 's11', 's14', 's16', 's17', 's19', 's23', 's26'], createdAt: at(-5),
    },
    {
      id: 'p4', programId: 'g2', title: '哨兵自主导航与决策', mentorIds: ['m2'],
      summary: '哨兵机器人在赛场上的建图、定位、路径规划与行为决策。',
      goals: ['完成场地建图与重定位', '实现全局与局部路径规划', '设计基于行为树的决策逻辑'],
      tags: ['ROS', 'SLAM', '路径规划'], status: 'running', published: true, views: 352,
      interestedIds: ['s3', 's10', 's13', 's18', 's24'],
      milestones: runningMilestones('p4'), teaming: free(2, 4, at(-40)), signupIds: [], createdAt: at(-48),
    },
    {
      id: 'p5', programId: 'g2', title: '雷达站目标检测与定位', mentorIds: ['m2', 'm1'],
      summary: '用固定在场边的相机检测场上机器人，并解算其在场地坐标系中的位置，实时提供给己方。',
      goals: ['多目标检测与跟踪', '相机外参标定与场地坐标定位', '与己方机器人通信并可视化'],
      tags: ['目标检测', '深度学习', '标定'], status: 'finished', published: true, views: 611,
      interestedIds: ['s1', 's5', 's9', 's13', 's17', 's21', 's25', 's27', 's28'],
      milestones: finishedMilestones('p5'), teaming: free(2, 4, at(-118)), signupIds: [], createdAt: at(-130),
    },
    {
      id: 'p6', programId: 'g3', title: '巡检路径规划', mentorIds: ['m2'],
      summary: '厂区巡检路线的自动规划与避障。（草稿：尚未发布，学生看不到）',
      goals: ['厂区地图建立', '多巡检点路径优化', '动态避障'],
      tags: ['路径规划', 'ROS'], status: 'draft', published: false, views: 0, interestedIds: [],
      milestones: futureMilestones('p6', 20), teaming: free(2, 4, at(15, 23, 59)), signupIds: [], createdAt: at(-1),
    },
    {
      id: 'p7', programId: 'g3', title: '仪表读数识别', mentorIds: ['m1'],
      summary: '识别厂区指针式与数字式仪表读数，读数异常时自动上报。',
      goals: ['仪表定位与类型识别', '指针读数与数字读数识别', '异常判定与上报'],
      tags: ['计算机视觉', 'Python'], status: 'recruiting', published: true, views: 145,
      interestedIds: ['s7', 's12', 's19'],
      milestones: futureMilestones('p7', 14), teaming: free(2, 4, at(9, 23, 59)), signupIds: [], createdAt: at(-4),
    },
  ]

  const team = (id: string, projectId: string, name: string, memberIds: string[], extra: Partial<Team> = {}): Team => ({
    id, projectId, name, memberIds, leaderId: memberIds[0] ?? null, evaluation: null, showcase: null, ...extra,
  })

  const teams: Team[] = [
    team('t1', 'p1', '灵眸队', ['s1', 's5', 's9', 's13', 's17']),
    team('t2', 'p1', '破晓队', ['s3', 's7', 's11', 's15']),
    team('t3', 'p1', '星火队', ['s21', 's25', 's6', 's10', 's14']),
    team('t4', 'p1', '追光队', ['s22', 's26', 's18', 's2']),
    team('t5', 'p2', '疾风队', ['s4', 's8']),
    team('t6', 'p2', '磐石队', ['s12', 's16', 's24']),
    team('t7', 'p2', '启航队', ['s27']),
    team('t8', 'p4', '巡夜队', ['s19', 's23', 's28', 's10']),
    team('t9', 'p4', '北极星队', ['s13', 's24', 's6']),
    team('t10', 'p5', '鹰眼队', ['s9', 's17', 's21', 's25'], {
      evaluation: { score: 93, comment: '检测与定位精度都达到了指标，工程文档完整，答辩表达清楚。', by: 'm2', at: at(-31) },
      showcase: {
        title: '鹰眼：基于多相机的场上目标实时定位系统',
        summary: '用两台场边相机完成全场机器人检测与跟踪，结合标定结果把目标投影到场地坐标，平均定位误差约 0.3 米，并通过通信模块实时推送给己方机器人。',
        highlights: ['检测模型在比赛视频上 mAP 达到 0.91', '设计了半自动外参标定流程，标定时间从 30 分钟缩短到 5 分钟', '形成可复用的数据集与标注规范'],
        at: at(-30),
      },
    }),
    team('t11', 'p5', '天眼队', ['s1', 's5', 's13', 's28'], {
      evaluation: { score: 85, comment: '定位方案有创新，但在遮挡场景下稳定性不足，建议补充跟踪策略。', by: 'm2', at: at(-31) },
    }),
    team('t12', 'p7', '慧眼队', ['s12', 's19']),
  ]

  // ---- 任务 ----
  const tasks: Task[] = [
    { id: 'k1', projectId: 'p1', milestoneId: 'p1-ms1', title: '技术调研报告', description: '调研装甲板识别的常见方案（传统视觉 / 深度学习），对比优缺点，给出本队的初步选型。PDF 提交，不超过 10 页。', openAt: at(-42), dueAt: at(-29, 23, 59), maxAttempts: 2, fullScore: 100, urges: [] },
    { id: 'k2', projectId: 'p1', milestoneId: 'p1-ms2', title: '方案设计说明书', description: '给出识别、解算、预测三个模块的设计，包括数据流、接口与时延预算，附评审 PPT。', openAt: at(-28), dueAt: at(-15, 23, 59), maxAttempts: 2, fullScore: 100, urges: [] },
    { id: 'k3', projectId: 'p1', milestoneId: 'p1-ms3', title: '识别模块阶段演示', description: '录制 1–3 分钟演示视频，展示在比赛视频和实拍场景下的识别效果，并附测试数据表。', openAt: at(-14), dueAt: at(3, 23, 59), maxAttempts: 3, fullScore: 100, urges: [] },
    { id: 'k4', projectId: 'p1', milestoneId: 'p1-ms3', title: '每周进展记录', description: '每周提交一次：本周完成、遇到的问题、下周计划。可多次提交。', openAt: at(-14), dueAt: at(7, 23, 59), maxAttempts: 0, fullScore: 20, urges: [] },
    { id: 'k5', projectId: 'p1', milestoneId: 'p1-ms4', title: '联调测试报告', description: '与电控组联调后提交测试报告，包括命中率、时延等指标。', openAt: at(8), dueAt: at(28, 23, 59), maxAttempts: 2, fullScore: 100, urges: [] },
    { id: 'k6', projectId: 'p1', milestoneId: 'p1-ms5', title: '结项答辩材料', description: '提交结项报告、答辩 PPT 与代码仓库链接。', openAt: at(29), dueAt: at(35, 23, 59), maxAttempts: 1, fullScore: 100, urges: [] },
    { id: 'k7', projectId: 'p4', milestoneId: 'p4-ms1', title: '导航方案调研', description: '调研开源导航框架与建图方案。', openAt: at(-42), dueAt: at(-29, 23, 59), maxAttempts: 1, fullScore: 100, urges: [] },
    { id: 'k8', projectId: 'p4', milestoneId: 'p4-ms3', title: '建图与定位演示', description: '提交场地建图结果和重定位演示视频。', openAt: at(-14), dueAt: at(5, 23, 59), maxAttempts: 2, fullScore: 100, urges: [] },
    { id: 'k9', projectId: 'p5', milestoneId: 'p5-ms4', title: '结项报告', description: '提交结项报告与答辩 PPT。', openAt: at(-39), dueAt: at(-32, 23, 59), maxAttempts: 1, fullScore: 100, urges: [] },
  ]

  let sid = 0
  const sub = (taskId: string, teamId: string, byId: string, days: number, content: string, files: string[], score: number | null, comment = '', recommended = false, attempt = 1): Submission => ({
    id: `sub${++sid}`, taskId, teamId, byId, attempt, content, files, at: at(days, 21, 30), score, comment, recommended,
  })

  const submissions: Submission[] = [
    sub('k1', 't1', 's1', -30, '我们对比了传统阈值 + 轮廓方案与 YOLO 系列方案，初步选择"传统方案打底、深度学习做复核"的组合。', ['灵眸队-技术调研报告.pdf'], 86, '对比清楚，选型理由充分。建议补充时延测试数据。'),
    sub('k1', 't2', 's3', -31, '调研了 6 支往届队伍的开源方案，整理成对比表，最终选择基于轻量化检测网络的方案。', ['破晓队-调研报告.pdf', '往届方案对比表.xlsx'], 92, '调研面广，对比表很有参考价值，推荐给其他队伍。', true),
    sub('k1', 't3', 's21', -29, '重点调研了相机选型与曝光策略对识别的影响。', ['星火队-调研报告.pdf'], 80, '角度不错，但算法部分偏少。'),
    sub('k1', 't4', 's22', -29, '调研报告见附件。', ['追光队-调研.pdf'], 72, '内容偏简单，缺少本队选型结论。'),
    sub('k2', 't1', 's1', -16, '方案说明书和评审 PPT 见附件。识别链路总时延预算 8ms。', ['灵眸队-方案设计说明书.pdf', '方案评审.pptx'], 90, '模块划分合理，接口定义清晰。', true),
    sub('k2', 't2', 's7', -15, '附方案设计说明书。', ['破晓队-方案设计.pdf'], 84, '预测模块需要再细化。'),
    sub('k2', 't3', 's25', -15, '方案说明书初稿。', ['星火队-方案说明书.pdf'], 78, '时延预算缺失，请在下一关补上。'),
    sub('k2', 't4', 's26', -14, '补交方案设计。', ['追光队-方案.pdf'], 70, '逾期提交；方案基本可行。'),
    sub('k3', 't2', 's15', -1, '演示视频和测试数据表见附件。比赛视频上识别率 93%，实拍 88%。', ['破晓队-识别演示.mp4', '识别测试数据.xlsx'], null),
    sub('k3', 't3', 's10', -2, '第一版演示，强光下误识别偏多，后续会改。', ['星火队-演示v1.mp4'], null),
    sub('k4', 't1', 's5', -7, '本周：完成数据集标注 3000 张；问题：反光导致误检；下周：加入颜色校验。', [], 18, '记录清楚。'),
    sub('k4', 't1', 's9', -1, '本周：误检率降到 4%；问题：远距离小目标漏检；下周：试多尺度检测。', [], null, '', false, 2),
    sub('k4', 't2', 's3', -6, '本周完成模型轻量化，推理时间 5ms。', [], 19, ''),
    sub('k7', 't8', 's19', -30, '调研了三种开源导航框架，建议采用分层规划。', ['巡夜队-导航调研.pdf'], 88, '很好。'),
    sub('k7', 't9', 's13', -29, '调研报告。', ['北极星队-调研.pdf'], 82, ''),
    sub('k8', 't8', 's23', -1, '建图完成，重定位成功率 95%。', ['建图结果.png', '重定位演示.mp4'], null),
    sub('k9', 't10', 's9', -33, '结项报告与答辩 PPT。', ['鹰眼队-结项报告.pdf', '答辩.pptx'], 93, '优秀。', true),
    sub('k9', 't11', 's1', -32, '结项报告。', ['天眼队-结项报告.pdf'], 85, ''),
  ]

  let rid = 0
  const res = (projectId: string, folder: string, title: string, kind: ResourceKind, size: number, uploaderId: string, days: number, teamId: string | null = null, scope: ShareScope = 'project', allowDownload = true): Resource => ({
    id: `r${++rid}`, projectId, teamId, folder, title, kind, size, uploaderId, scope, allowDownload, at: at(days),
  })
  const MB = 1024 * 1024
  const resources: Resource[] = [
    res('p1', '入门讲义', '装甲板识别入门讲义.pdf', 'pdf', 4.2 * MB, 'm1', -41),
    res('p1', '入门讲义', '相机标定操作指南.pdf', 'pdf', 2.1 * MB, 'm1', -41),
    res('p1', '入门讲义', 'OpenCV 开发环境配置.mp4', 'video', 86 * MB, 'm1', -40),
    res('p1', '往届案例', '往届队伍视觉方案汇总.pdf', 'pdf', 9.8 * MB, 'm1', -38),
    res('p1', '往届案例', '往届答辩 PPT 精选.pptx', 'ppt', 24 * MB, 'm1', -38, null, 'project', false),
    res('p1', '工具与数据', '装甲板数据集说明.docx', 'doc', 0.3 * MB, 'm1', -35),
    res('p1', '工具与数据', '弹道补偿计算脚本.py', 'code', 0.02 * MB, 'm1', -20),
    res('p1', '团队资料', '装甲板标注规范.docx', 'doc', 0.4 * MB, 's1', -25, 't1', 'team'),
    res('p1', '团队资料', '识别 Demo 演示.mp4', 'video', 45 * MB, 's5', -3, 't1', 'project'),
    res('p1', '团队资料', '轻量化模型实验记录.xlsx', 'doc', 0.2 * MB, 's3', -5, 't2', 'school'),
    res('p4', '入门讲义', '移动机器人导航基础.pdf', 'pdf', 6.4 * MB, 'm2', -40),
    res('p4', '工具与数据', '仿真场地地图.zip', 'code', 32 * MB, 'm2', -36),
    res('p5', '成果材料', '鹰眼队数据集与标注规范.zip', 'code', 120 * MB, 's9', -30, 't10', 'school'),
    res('p2', '入门讲义', '麦克纳姆轮运动学推导.pdf', 'pdf', 1.6 * MB, 'm3', -5),
    res('p3', '入门讲义', '云台结构设计参考.pdf', 'pdf', 5.5 * MB, 'm3', -4),
    res('p7', '入门讲义', '仪表识别需求说明（企业提供）.pdf', 'pdf', 1.1 * MB, 'm1', -4),
  ]

  const topics: Topic[] = [
    { id: 'c1', projectId: 'p1', title: '项目目标理解', description: '说说你对"自动瞄准"目标的理解：难点在哪里？怎样算做成了？', type: 'public', openAt: at(-42), dueAt: at(-29, 23, 59) },
    { id: 'c2', projectId: 'p1', title: '原型阶段任务分工', description: '各组在组内讨论原型阶段的分工与排期，指导老师会查看。', type: 'group', openAt: at(-14), dueAt: at(7, 23, 59) },
    { id: 'c3', projectId: 'p1', title: '识别效果交流', description: '分享识别效果、踩过的坑和解决办法，欢迎跨组交流。', type: 'public', openAt: at(-14), dueAt: at(28, 23, 59) },
    { id: 'c4', projectId: 'p1', title: '成果展示与反思', description: '结项后讨论：做得好的地方、不足和改进方向。', type: 'public', openAt: at(29), dueAt: at(42, 23, 59) },
    { id: 'c5', projectId: 'p4', title: '导航方案讨论', description: '交流建图与规划方案。', type: 'public', openAt: at(-40), dueAt: at(28, 23, 59) },
  ]

  let pid = 0
  const post = (topicId: string, authorId: string, days: number, content: string, likeIds: string[] = [], parentId: string | null = null, teamId: string | null = null, pinned = false): Post => ({
    id: `post${++pid}`, topicId, teamId, parentId, authorId, content, at: at(days, 20, 15), likeIds, pinned,
  })
  const posts: Post[] = [
    post('c1', 'm1', -41, '欢迎大家。先别急着写代码，想清楚"识别率""时延""命中率"这三个指标之间的关系。', ['s1', 's3', 's7', 's21'], null, null, true),
    post('c1', 's3', -40, '我觉得最难的是比赛现场的光照变化，训练集里一定要包含强光和反光的场景。', ['s1', 's7', 's11', 's15', 'm1']),
    post('c1', 's1', -40, '同意，另外运动预测也很关键，识别准了但云台跟不上也打不中。', ['s3', 's5'], 'post2'),
    post('c1', 's22', -39, '"做成了"的标准是不是应该用实际命中率来衡量？', ['s2']),
    post('c1', 'm1', -39, '对，最终看命中率，但各阶段可以先用识别率和时延来衡量进度。', ['s22', 's26'], 'post4'),
    post('c2', 's1', -13, '分工：子轩负责检测，嘉怡负责数据集，若曦负责解算，梓涵负责预测，晨阳负责测试。', ['s5', 's9', 's13'], null, 't1'),
    post('c2', 's5', -12, '数据集这周能标完 3000 张，下周开始训练。', ['s1'], 'post6', 't1'),
    post('c2', 's3', -13, '我们按模块分两人一组，周三周日各同步一次。', ['s7', 's11'], null, 't2'),
    post('c3', 's15', -2, '分享一个经验：识别前先做颜色通道相减，反光误检少了一半。', ['s1', 's5', 's21', 's25', 's22', 'm1']),
    post('c3', 's21', -1, '感谢分享！我们强光下误检也很多，回去试试。', ['s15'], 'post9'),
    post('c5', 's19', -20, '我们准备先用仿真地图调规划参数，再上实车。', ['s23', 'm2']),
  ]

  return { version: DATA_VERSION, people, programs, projects, teams, tasks, submissions, resources, topics, posts }
}

/** 演示视角：一个人就能切换不同角色演示整条流程。 */
export const PERSONAS: { id: string; label: string; desc: string }[] = [
  { id: 'a1', label: '学院管理员 · 刘晓峰', desc: '建项目、拆课题、设关卡、发布、组队调剂、看统计' },
  { id: 'm1', label: '指导教师 · 李振华', desc: '指导"视觉识别与自动瞄准"等课题：布置任务、评阅、评价' },
  { id: 's1', label: '学生 · 陈子轩（已组队）', desc: '灵眸队组长：提交任务、上传资料、参与讨论' },
  { id: 's20', label: '学生 · 谢可馨（找项目中）', desc: '浏览项目、标记感兴趣、报名、加入团队' },
]
