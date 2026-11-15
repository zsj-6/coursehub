/**
 * AI 原型演示数据（纯前端，不调后端）。
 * 来源：
 *   - 领导版原型 index.html：能力分类与能力卡片、4 个能力的知识图谱、学习资源、逻辑闯关题、辅学导师
 *   - 新增：机甲大师「机器人视觉与控制」能力单元（图谱、资源、题目、关卡），用于 MVP 演示
 * 拿到真实资料后替换本文件即可；计算逻辑在 stores/ai.ts。
 */

export type NodeType = 'core' | 'skill' | 'apply' | 'prereq'
export type EdgeRel = 'prereq' | 'part' | 'apply' | 'advance'
export type UnitCategory = 'COGNITION' | 'PROFESSION' | 'GENERAL'
export type ResKind = 'textbook' | 'course' | 'video' | 'book' | 'paper' | 'project'
export type QLevel = 'basic' | 'standard' | 'challenge'

export interface KeyPoint {
  kw: string[]
  point: string
}
export interface KNode {
  id: string
  name: string
  type: NodeType
  desc: string
  /** 辅学讲解用的较完整说明 */
  explain?: string
  courses?: string[]
  /** ai = AI 生成、待教师审核 */
  status?: 'confirmed' | 'ai'
  aiSource?: string
  /** 费曼模式检查用的要点 */
  keyPoints?: KeyPoint[]
  /** 领导版自带的演示掌握度 */
  seed?: number
}
export interface KEdge {
  from: string
  to: string
  rel: EdgeRel
}
export interface Unit {
  id: string
  name: string
  category: UnitCategory
  icon: string
  desc: string
  tags: string[]
  courses: string[]
  college: string
  featured?: boolean
  nodes: KNode[]
  edges: KEdge[]
}
/** 资源的一个可定位片段：教材的一节（页码）或视频的一段（秒） */
export interface ResPart {
  id: string
  title: string
  nodeIds: string[]
  page?: number
  t?: number
  body?: string
}
export interface Resource {
  id: string
  unitId: string
  kind: ResKind
  title: string
  author: string
  source: string
  reason: string
  minutes: number
  nodeIds: string[]
  parts: ResPart[]
  views: number
  /** 视频总时长（秒） */
  duration?: number
}
export interface Question {
  id: string
  nodeId: string
  level: QLevel
  stem: string
  options: string[]
  answer: number
  explain: string
  /** 提示阶梯前三级：方向 → 思路 → 关键步骤；第四级是 explain */
  hints: [string, string, string]
  ref?: { resId: string; partId: string }
  /** AI 生成的变式题（教师采纳后才入库） */
  ai?: boolean
}
export interface Level {
  id: string
  unitId: string
  order: number
  title: string
  nodeIds: string[]
  diagnose: string[]
  pass: string[]
  challenge?: string
}
export interface Expert {
  id: string
  name: string
  scene: string
  greet: string
}
export interface ErrorCluster {
  option: number
  label: string
  count: number
  suggestion: string
  ref?: { resId: string; partId: string }
}
export interface ErrorReport {
  questionId: string
  answered: number
  wrong: number
  clusters: ErrorCluster[]
}
export interface ProjectLink {
  projectId: string
  unitId: string
  /** 课题关卡（里程碑） → 本关需要掌握的节点 */
  milestoneNodes: Record<string, string[]>
}

// ---------------------------------------------------------------- 分类与元信息

export const CATEGORIES: { code: UnitCategory; name: string }[] = [
  { code: 'PROFESSION', name: '专业实践能力' },
  { code: 'COGNITION', name: '学习认知能力' },
  { code: 'GENERAL', name: '通用综合素养' },
]

export const NODE_TYPE_META: Record<NodeType, { label: string }> = {
  core: { label: '核心概念' },
  skill: { label: '方法技能' },
  apply: { label: '应用场景' },
  prereq: { label: '前置知识' },
}

export const EDGE_REL_LABEL: Record<EdgeRel, string> = {
  prereq: '前置',
  part: '组成',
  apply: '应用',
  advance: '进阶',
}

export const RES_KIND_META: Record<ResKind, { label: string; icon: string }> = {
  textbook: { label: '教材', icon: 'Notebook' },
  course: { label: '课程', icon: 'School' },
  video: { label: '视频', icon: 'VideoPlay' },
  book: { label: '图书', icon: 'Reading' },
  paper: { label: '论文', icon: 'Document' },
  project: { label: '项目资料', icon: 'FolderOpened' },
}

export const LEVEL_PATH_META: Record<QLevel, { label: string; desc: string }> = {
  basic: { label: '补基础路径', desc: '先补前置知识，再做基础练习' },
  standard: { label: '标准路径', desc: '学习本关资料，完成标准练习' },
  challenge: { label: '挑战路径', desc: '基础已扎实，直接挑战过关并完成拓展任务' },
}

/** 辅学导师（领导版 AI 导师中与学习相关的 4 位；心理、职业、升学本期不做） */
export const EXPERTS: Expert[] = [
  { id: 'academic', name: '学业导师', scene: '课程答疑 · 学习方法', greet: '我是你的学业导师。遇到不懂的知识点可以直接问我，我会先听听你的想法，再一步步讲清楚。' },
  { id: 'contest', name: '竞赛导师', scene: '机甲大师备赛 · 技术方案', greet: '我是竞赛导师，熟悉机甲大师的技术路线。可以问我视觉、控制、整车联调方面的问题。' },
  { id: 'research', name: '科研导师', scene: '文献阅读 · 研究方法', greet: '我是科研导师。读论文、写技术报告遇到问题，可以来找我。' },
  { id: 'innovation', name: '大创导师', scene: '选题 · 项目过程', greet: '我是大创导师。项目选题、阶段规划、答辩准备都可以聊。' },
]

// ---------------------------------------------------------------- 机甲大师单元

const C_C = 'C 语言程序设计'
const C_LA = '线性代数'
const C_CTRL = '自动控制原理'
const C_CV = '计算机视觉基础'

const roboNodes: KNode[] = [
  { id: 'r0', name: 'C 语言基础', type: 'prereq', courses: [C_C], desc: '语法、函数、数组与调试。', explain: '嵌入式和视觉代码都建立在 C/C++ 基础上，重点是函数、数组和调试习惯。' },
  { id: 'r1', name: '指针与内存', type: 'skill', courses: [C_C], desc: '地址、指针运算、动态内存。', explain: '指针保存的是地址。解析串口数据、操作图像缓冲区时都要直接按地址读写内存，越界和野指针是最常见的错误来源。' },
  { id: 'r2', name: '结构体与数据打包', type: 'skill', courses: [C_C], desc: '用结构体组织一帧通信数据。', explain: '把一帧数据的各字段写成结构体，配合字节对齐控制，就能按固定格式打包和解析。' },
  { id: 'r3', name: '串口通信协议', type: 'apply', courses: [C_C], desc: '帧头、长度、校验与解析。', explain: '视觉主机和下位机通过串口传角度指令。一帧通常由帧头、数据段、校验位组成，接收端按帧头同步、按校验丢弃错帧。' },
  { id: 'r4', name: '矩阵运算', type: 'prereq', courses: [C_LA], desc: '乘法、转置、逆。', explain: '矩阵乘法要求内侧维度相等，满足结合律但不满足交换律。坐标变换、标定、滤波全都是矩阵运算。' },
  {
    id: 'r5', name: '旋转矩阵', type: 'core', courses: [C_LA, C_CV], desc: '用正交矩阵表示朝向。',
    explain: '旋转矩阵是行列式为 1 的正交矩阵，逆矩阵等于转置。二维逆时针旋转 θ 的矩阵是 [[cosθ, −sinθ], [sinθ, cosθ]]；三维旋转可以由绕三个轴的旋转相乘得到，乘的顺序会影响结果。',
    keyPoints: [
      { kw: ['正交', '转置'], point: '旋转矩阵是正交矩阵，逆等于转置' },
      { kw: ['行列式', '长度'], point: '行列式为 1，旋转不改变向量长度' },
      { kw: ['cos', 'sin', '角度', '角'], point: '二维旋转矩阵由 cosθ、sinθ 组成' },
      { kw: ['欧拉', '万向锁', '顺序'], point: '三维旋转的顺序会影响结果，欧拉角可能出现万向锁' },
    ],
  },
  {
    id: 'r6', name: '坐标系变换', type: 'core', courses: [C_LA, C_CV], desc: '旋转 + 平移，在相机、云台、世界系之间换算。',
    explain: '一个点从坐标系 A 变到 B：P_B = R·P_A + t，R 描述朝向差，t 描述原点位置差。反过来变回去要先减平移再乘转置：P_A = Rᵀ(P_B − t)。多个坐标系串联时用 4×4 齐次矩阵相乘，顺序不能颠倒。',
    keyPoints: [
      { kw: ['旋转', 'R'], point: '用旋转矩阵 R 描述两个坐标系的朝向差' },
      { kw: ['平移', 't', '原点'], point: '用平移向量 t 描述原点的位置差' },
      { kw: ['逆', '转置', '反过来', '变回'], point: '反向变换要先减平移再乘转置：P = Rᵀ(P′ − t)' },
      { kw: ['齐次', '4×4', '串联', '顺序'], point: '多个变换串联用齐次矩阵相乘，顺序不能颠倒' },
    ],
  },
  { id: 'r7', name: '最小二乘', type: 'skill', courses: [C_LA], desc: '超定方程的最优近似解。', explain: '方程比未知数多、没有精确解时，求使残差平方和最小的解，对应正规方程 AᵀAx = Aᵀb。相机标定的参数估计就是这一类问题。' },
  { id: 'r8', name: '系统响应与稳定性', type: 'core', courses: [C_CTRL], desc: '阶跃响应、超调、阻尼比。', explain: '给系统一个阶跃输入，看它多快到达目标、超出多少、振荡几次。阻尼比小则超调大、振荡多；持续等幅振荡就是临界稳定。' },
  {
    id: 'r9', name: 'PID 控制', type: 'core', courses: [C_CTRL], desc: '比例、积分、微分三项控制。',
    explain: 'PID 输出 = Kp·误差 + Ki·误差积分 + Kd·误差变化率。P 决定响应快慢，I 消除稳态误差，D 根据误差变化趋势提前"刹车"、抑制超调。云台一般用角度环套速度环的串级 PID。',
    keyPoints: [
      { kw: ['比例', 'P', 'Kp'], point: '比例项 P：误差越大输出越大，决定响应快慢' },
      { kw: ['积分', 'I', '稳态'], point: '积分项 I：累积误差，用来消除稳态误差' },
      { kw: ['微分', 'D', '变化率', '刹车', '阻尼'], point: '微分项 D：根据误差变化率提前"刹车"，抑制超调' },
      { kw: ['超调', '振荡', '抖'], point: '参数过大的副作用：超调、振荡、抖动' },
    ],
  },
  { id: 'r10', name: '卡尔曼滤波', type: 'skill', courses: [C_CTRL, C_CV], desc: '预测 + 观测融合，估计目标运动。', explain: '卡尔曼滤波每一步先用运动模型预测，再用观测值修正，按两者的不确定度加权。自瞄里用来平滑装甲板位置并预测它下一刻在哪。' },
  { id: 'r11', name: '图像预处理', type: 'skill', courses: [C_CV], desc: '曝光、通道相减、二值化、形态学。', explain: '识别灯条前先降低曝光，用颜色通道相减突出红蓝灯条，再二值化和形态学处理去掉噪点。' },
  {
    id: 'r12', name: '相机模型与标定', type: 'core', courses: [C_CV], desc: '针孔模型、内参、畸变与标定。',
    explain: '针孔模型把 3D 点投影到像素平面，内参矩阵 K 包含焦距 fx、fy 和主点 cx、cy。镜头还有畸变。标定就是多角度拍棋盘格，用张正友法求出内参和畸变系数。',
    keyPoints: [
      { kw: ['内参', '焦距', '主点'], point: '内参：焦距 fx、fy 和主点 cx、cy' },
      { kw: ['外参', '位姿'], point: '外参：相机相对世界的旋转和平移' },
      { kw: ['畸变'], point: '镜头畸变需要标定并校正' },
      { kw: ['棋盘', '多角度', '张正友'], point: '标定要多角度拍棋盘格，用张正友法求解' },
    ],
  },
  { id: 'r13', name: '装甲板识别', type: 'apply', courses: [C_CV], desc: '灯条提取、配对与数字确认。', explain: '先找出灯条轮廓，再按长度相近、近似平行、间距比例合理等条件两两配对；最后用数字分类器确认，避免把其他发光物误识别成装甲板。' },
  {
    id: 'r14', name: 'PnP 位姿解算', type: 'skill', courses: [C_CV], desc: '由 2D-3D 对应点求目标位姿。',
    explain: 'PnP 需要三样输入：目标上若干点的 3D 坐标（装甲板四个角点）、它们在图像上的 2D 像素坐标、相机内参。输出是目标相对相机的旋转和平移，从平移就能得到距离。目标越远，角点的像素误差对结果影响越大。',
    keyPoints: [
      { kw: ['3D', '三维', '世界坐标', '尺寸'], point: '输入：目标上已知的 3D 点坐标' },
      { kw: ['2D', '像素', '角点'], point: '输入：对应的 2D 像素坐标' },
      { kw: ['内参'], point: '需要相机内参（和畸变系数）' },
      { kw: ['距离', '位姿', '平移', '旋转'], point: '输出：目标相对相机的旋转和平移，可以算出距离' },
    ],
  },
  { id: 'r15', name: '弹道解算', type: 'apply', courses: [], desc: '考虑重力与空气阻力的抬枪补偿。', explain: '弹丸飞行时会下坠，需要按目标距离和弹速计算抬枪角度；距离远时还要考虑空气阻力，常用迭代法求解。' },
  { id: 'r16', name: '云台控制', type: 'apply', courses: [C_CTRL], desc: '串级 PID 驱动云台跟踪目标。', explain: '视觉算出目标角度后，通过串口发给下位机，云台用角度环 + 速度环的串级 PID 跟上。' },
  { id: 'r17', name: '自动瞄准', type: 'apply', courses: [], desc: '识别 → 解算 → 预测 → 弹道 → 云台的完整链路。', explain: '自动瞄准把识别、位姿解算、运动预测、弹道补偿和云台控制串成一条链路，任何一环的误差都会传到最后的命中率上。' },
  { id: 'r18', name: '概率与高斯分布', type: 'prereq', courses: ['概率论（前置）'], desc: '均值、方差、正态分布。', explain: '卡尔曼滤波假设噪声服从高斯分布，用均值表示估计值、用方差表示不确定度。' },
  // AI 从资料里抽取的候选节点，等教师审核
  { id: 'ra1', name: '相机畸变校正', type: 'skill', courses: [C_CV], status: 'ai', aiSource: '讲义第 2 节 p.21；视频《相机标定与 PnP》21:15', desc: '径向、切向畸变模型与去畸变。' },
  { id: 'ra2', name: '四元数姿态表示', type: 'skill', courses: [C_LA], status: 'ai', aiSource: '视频《旋转矩阵的几何直观》06:20', desc: '避免万向锁的姿态表示方法。' },
  { id: 'ra3', name: '前馈控制', type: 'skill', courses: [C_CTRL], status: 'ai', aiSource: '视频《PID 调参实战》23:00', desc: '按目标运动提前给出控制量，减少跟踪滞后。' },
]

const roboEdges: KEdge[] = [
  { from: 'r0', to: 'r1', rel: 'prereq' },
  { from: 'r0', to: 'r2', rel: 'prereq' },
  { from: 'r1', to: 'r2', rel: 'prereq' },
  { from: 'r2', to: 'r3', rel: 'apply' },
  { from: 'r4', to: 'r5', rel: 'prereq' },
  { from: 'r5', to: 'r6', rel: 'prereq' },
  { from: 'r4', to: 'r7', rel: 'prereq' },
  { from: 'r6', to: 'r12', rel: 'prereq' },
  { from: 'r7', to: 'r12', rel: 'apply' },
  { from: 'r11', to: 'r13', rel: 'prereq' },
  { from: 'r12', to: 'r14', rel: 'prereq' },
  { from: 'r13', to: 'r14', rel: 'prereq' },
  { from: 'r4', to: 'r10', rel: 'prereq' },
  { from: 'r18', to: 'r10', rel: 'prereq' },
  { from: 'r8', to: 'r9', rel: 'prereq' },
  { from: 'r9', to: 'r16', rel: 'apply' },
  { from: 'r3', to: 'r16', rel: 'apply' },
  { from: 'r14', to: 'r15', rel: 'prereq' },
  { from: 'r10', to: 'r15', rel: 'prereq' },
  { from: 'r15', to: 'r17', rel: 'part' },
  { from: 'r16', to: 'r17', rel: 'part' },
  { from: 'r12', to: 'ra1', rel: 'advance' },
  { from: 'r5', to: 'ra2', rel: 'advance' },
  { from: 'r9', to: 'ra3', rel: 'advance' },
]

// ---------------------------------------------------------------- 领导版 4 个能力的图谱（原样迁移，掌握度作为演示数据）

const logicNodes: KNode[] = [
  { id: 'L0', name: '逻辑思维', type: 'core', seed: 72, desc: '把问题拆成可检验的命题与推理链条。' },
  { id: 'L1', name: '命题逻辑', type: 'core', seed: 80, desc: '真值、联结词与有效推理的基础。', explain: '命题逻辑研究"如果……那么……""并且""或者"这类联结词。条件句只能由前件推出后件，不能由后件倒推前件。' },
  { id: 'L2', name: '谓词逻辑', type: 'core', seed: 58, desc: '量词与关系，处理更精细的陈述。', explain: '谓词逻辑引入"所有""有的"这类量词。"所有 A 都是 B"的否定是"有的 A 不是 B"。' },
  { id: 'L3', name: '论证结构', type: 'skill', seed: 74, desc: '识别前提、结论与隐含假设。', explain: '一个论证由前提和结论组成。判断论证是否成立，要看推理方向是否和前提给出的条件方向一致。' },
  { id: 'L4', name: '常见谬误', type: 'skill', seed: 66, desc: '滑坡、稻草人、循环论证等识别。', explain: '以偏概全（样本太少就下结论）、把相关当因果，是日常推理中最常见的两种谬误。' },
  { id: 'L5', name: '决策推理', type: 'apply', seed: 61, desc: '用逻辑框架评估日常与专业决策。' },
  { id: 'L6', name: '集合与关系', type: 'prereq', seed: 70, desc: '形式化表达所需的离散数学基础。' },
]
const logicEdges: KEdge[] = [
  { from: 'L6', to: 'L1', rel: 'prereq' },
  { from: 'L1', to: 'L0', rel: 'part' },
  { from: 'L2', to: 'L0', rel: 'part' },
  { from: 'L1', to: 'L3', rel: 'apply' },
  { from: 'L3', to: 'L4', rel: 'advance' },
  { from: 'L3', to: 'L5', rel: 'apply' },
  { from: 'L4', to: 'L5', rel: 'apply' },
]
const csNodes: KNode[] = [
  { id: 'C0', name: '计算机科学', type: 'core', seed: 82, desc: '用计算抽象解决工程问题。' },
  { id: 'C1', name: '数据结构', type: 'core', seed: 86, desc: '组织与检索数据的基础模型。' },
  { id: 'C2', name: '算法设计', type: 'core', seed: 78, desc: '复杂度、正确性与常用范式。' },
  { id: 'C3', name: '操作系统', type: 'skill', seed: 64, desc: '进程、内存与并发控制。' },
  { id: 'C4', name: '计算机网络', type: 'skill', seed: 71, desc: '协议栈、可靠传输与安全。' },
  { id: 'C5', name: '软件工程', type: 'apply', seed: 75, desc: '需求、架构、测试与交付。' },
  { id: 'C6', name: '编程基础', type: 'prereq', seed: 90, desc: '语法、调试与工程化编码习惯。' },
]
const csEdges: KEdge[] = [
  { from: 'C6', to: 'C1', rel: 'prereq' },
  { from: 'C1', to: 'C2', rel: 'prereq' },
  { from: 'C2', to: 'C0', rel: 'part' },
  { from: 'C3', to: 'C0', rel: 'part' },
  { from: 'C4', to: 'C0', rel: 'part' },
  { from: 'C2', to: 'C5', rel: 'apply' },
  { from: 'C3', to: 'C5', rel: 'apply' },
]
const aiDataNodes: KNode[] = [
  { id: 'A0', name: 'AI + 数据流通', type: 'core', seed: 71, desc: '数据要素与智能模型的交叉能力。' },
  { id: 'A1', name: '机器学习', type: 'core', seed: 76, desc: '监督学习、评估与泛化。' },
  { id: 'A2', name: '数据治理', type: 'core', seed: 68, desc: '质量、权属、安全与合规。' },
  { id: 'A3', name: '特征工程', type: 'skill', seed: 62, desc: '从原始数据抽取可用信号。' },
  { id: 'A4', name: '模型评测', type: 'skill', seed: 59, desc: '指标对比、偏差与可解释性。' },
  { id: 'A5', name: '数据中台', type: 'apply', seed: 54, desc: '流通场景下的中台与服务化。' },
  { id: 'A6', name: '统计学基础', type: 'prereq', seed: 70, desc: '分布、估计与假设检验。' },
]
const aiDataEdges: KEdge[] = [
  { from: 'A6', to: 'A1', rel: 'prereq' },
  { from: 'A1', to: 'A0', rel: 'part' },
  { from: 'A2', to: 'A0', rel: 'part' },
  { from: 'A1', to: 'A3', rel: 'prereq' },
  { from: 'A3', to: 'A4', rel: 'advance' },
  { from: 'A2', to: 'A5', rel: 'apply' },
  { from: 'A4', to: 'A5', rel: 'apply' },
]
const literacyNodes: KNode[] = [
  { id: 'G0', name: '人工智能素养', type: 'core', seed: 70, desc: '原理、边界、伦理与日常应用。' },
  { id: 'G1', name: 'AI 原理通识', type: 'core', seed: 64, desc: '数据、模型、训练与推理的直觉。' },
  { id: 'G2', name: '提示与协作', type: 'skill', seed: 78, desc: '与生成式 AI 有效协作的方法。' },
  { id: 'G3', name: '风险识别', type: 'skill', seed: 61, desc: '幻觉、偏见、隐私与误用。' },
  { id: 'G4', name: 'AI 伦理', type: 'apply', seed: 58, desc: '公平、问责与人类监督。' },
  { id: 'G5', name: '学习与办公场景', type: 'apply', seed: 73, desc: '写作、检索、规划中的负责任使用。' },
  { id: 'G6', name: '数字素养', type: 'prereq', seed: 82, desc: '信息检索、验证与工具使用。' },
]
const literacyEdges: KEdge[] = [
  { from: 'G6', to: 'G1', rel: 'prereq' },
  { from: 'G1', to: 'G0', rel: 'part' },
  { from: 'G2', to: 'G0', rel: 'part' },
  { from: 'G1', to: 'G3', rel: 'prereq' },
  { from: 'G3', to: 'G4', rel: 'advance' },
  { from: 'G2', to: 'G5', rel: 'apply' },
  { from: 'G4', to: 'G5', rel: 'apply' },
]

// ---------------------------------------------------------------- 能力单元（领导版 12 项能力 + 机甲大师单元）

export const UNITS: Unit[] = [
  {
    id: 'robo', name: '机器人视觉与控制（机甲大师）', category: 'PROFESSION', icon: 'Aim', featured: true, college: '机电工程学院',
    desc: '由 C 语言、线性代数、自动控制原理、计算机视觉基础 4 门课组成的课程群，对应机甲大师梯队的视觉与控制方向。',
    tags: ['课程群', '机甲大师', '项目制'], courses: [C_C, C_LA, C_CTRL, C_CV], nodes: roboNodes, edges: roboEdges,
  },
  { id: 'cs', name: '专业能力：计算机科学与技术', category: 'PROFESSION', icon: 'Monitor', college: '计算机学院', desc: '覆盖编程、系统、AI、网络与软件工程，培养工程化解决复杂计算问题的能力。', tags: ['CS', '软件工程', 'AI'], courses: ['数据结构', '操作系统', '计算机网络'], nodes: csNodes, edges: csEdges },
  { id: 'ai-data', name: '"AI + 数据流通"微专业', category: 'PROFESSION', icon: 'DataAnalysis', college: '计算机学院', desc: '以人工智能与数据要素流通为核心的跨学科微专业，面向产业数字化转型。', tags: ['微专业', 'AI', '数据'], courses: ['机器学习', '数据治理'], nodes: aiDataNodes, edges: aiDataEdges },
  { id: 'engineering', name: '工程实践与项目管理', category: 'PROFESSION', icon: 'SetUp', college: '机电工程学院', desc: '围绕真实工程项目全生命周期，培养规划、执行、协作与交付能力。', tags: ['工程', '项目'], courses: [], nodes: [], edges: [] },
  { id: 'research', name: '科研方法与论文写作', category: 'PROFESSION', icon: 'EditPen', college: '研究生院', desc: '从选题、文献综述到实验设计与论文撰写的完整学术研究能力。', tags: ['科研', '学术'], courses: [], nodes: [], edges: [] },
  { id: 'logic', name: '逻辑思维能力', category: 'COGNITION', icon: 'Connection', college: '通识教育中心', desc: '通过结构化分析与推理解决复杂问题的能力，是理工与人文研究的基础。', tags: ['基础素养', '理工'], courses: ['逻辑学导论'], nodes: logicNodes, edges: logicEdges },
  { id: 'critical', name: '批判性思维能力', category: 'COGNITION', icon: 'Search', college: '通识教育中心', desc: '对信息进行独立评估、质疑与重构的能力，是创新与研究的核心素养。', tags: ['思维', '创新'], courses: [], nodes: [], edges: [] },
  { id: 'math', name: '数学建模与定量分析', category: 'COGNITION', icon: 'Histogram', college: '理学院', desc: '用数学语言抽象现实问题，建立模型并进行求解与验证的能力。', tags: ['数学', '建模'], courses: [], nodes: [], edges: [] },
  { id: 'metacog', name: '元认知与学习策略', category: 'COGNITION', icon: 'Compass', college: '通识教育中心', desc: '对自己学习过程的觉察、监控与调整能力，决定长期学习效率。', tags: ['学习方法', '反思'], courses: [], nodes: [], edges: [] },
  { id: 'ailiteracy', name: '人工智能素养', category: 'GENERAL', icon: 'MagicStick', college: '通识教育中心', desc: '面向所有人的 AI 基础认知，包括原理、伦理、风险与日常应用。', tags: ['通识', 'AI', '伦理'], courses: ['人工智能通识'], nodes: literacyNodes, edges: literacyEdges },
  { id: 'communicate', name: '沟通表达与演讲', category: 'GENERAL', icon: 'Microphone', college: '通识教育中心', desc: '清晰表达、结构化呈现与公众演讲能力，影响学习与职业发展上限。', tags: ['沟通', '演讲'], courses: [], nodes: [], edges: [] },
  { id: 'leadership', name: '领导力与团队协作', category: 'GENERAL', icon: 'UserFilled', college: '通识教育中心', desc: '在小组与项目中承担角色、影响他人、推动目标达成的能力。', tags: ['领导', '协作'], courses: [], nodes: [], edges: [] },
  { id: 'selfmgmt', name: '自我管理与时间规划', category: 'GENERAL', icon: 'Timer', college: '通识教育中心', desc: '时间管理、精力分配与学习计划能力，是可持续发展的底层保障。', tags: ['时间管理', '计划'], courses: [], nodes: [], edges: [] },
]

// ---------------------------------------------------------------- 资源

const roboResources: Resource[] = [
  {
    id: 'rs1', unitId: 'robo', kind: 'textbook', title: '《线性代数》（第 6 版）', author: '课程组', source: '课程平台 · 线性代数', minutes: 120, views: 312,
    reason: '旋转矩阵、坐标变换、最小二乘的教材原文', nodeIds: ['r4', 'r5', 'r6', 'r7'],
    parts: [
      { id: 'p1', title: '4.2 矩阵乘法与线性变换', page: 72, nodeIds: ['r4'], body: '两个矩阵相乘要求前一个矩阵的列数等于后一个矩阵的行数，m×n 矩阵乘 n×p 矩阵得到 m×p 矩阵。矩阵乘法满足结合律 (AB)C = A(BC)，但一般不满足交换律。乘积的转置等于转置的反序乘积：(AB)ᵀ = BᵀAᵀ。\n\n把矩阵看成线性变换，乘法就是"先做一个变换，再做另一个变换"，所以顺序不能随意交换。' },
      { id: 'p2', title: '4.5 正交矩阵与旋转', page: 87, nodeIds: ['r5'], body: '若方阵 Q 满足 QᵀQ = I，则称 Q 为正交矩阵。正交矩阵的逆就是它的转置，并且保持向量长度不变。行列式为 1 的正交矩阵表示旋转。\n\n平面上把向量逆时针旋转 θ 角的矩阵为\nR(θ) = [[cosθ, −sinθ], [sinθ, cosθ]]。\n三维空间中的旋转可以分解为绕 x、y、z 轴的旋转之积，乘法顺序不同，最终朝向也不同。' },
      { id: 'p3', title: '4.6 坐标变换与基变换', page: 93, nodeIds: ['r6'], body: '同一个点在不同坐标系下的坐标不同。若坐标系 B 相对坐标系 A 的朝向用旋转矩阵 R 表示、原点偏移用向量 t 表示，则 P_B = R·P_A + t。\n\n反向变换时，先减去平移，再左乘 R 的逆（即 Rᵀ）：P_A = Rᵀ(P_B − t)。为了把旋转和平移写成一次矩阵乘法，常用 4×4 齐次矩阵 T = [[R, t], [0, 1]]，多个变换串联时依次相乘。' },
      { id: 'p4', title: '6.3 最小二乘解', page: 141, nodeIds: ['r7'], body: '当线性方程组 Ax = b 的方程个数多于未知数且没有精确解时，求使残差 ‖Ax − b‖² 最小的 x，称为最小二乘解。它满足正规方程 AᵀAx = Aᵀb。工程中的参数拟合、相机标定都会用到。' },
    ],
  },
  {
    id: 'rs2', unitId: 'robo', kind: 'textbook', title: '《自动控制原理》', author: '课程组', source: '课程平台 · 自动控制原理', minutes: 150, views: 205,
    reason: '系统响应和 PID 的教材原文', nodeIds: ['r8', 'r9'],
    parts: [
      { id: 'p1', title: '3.3 二阶系统的阶跃响应', page: 58, nodeIds: ['r8'], body: '二阶系统的阶跃响应由阻尼比 ζ 决定：ζ < 1 时欠阻尼，会出现超调和振荡，ζ 越小超调越大；ζ = 0 时出现持续等幅振荡，系统处于临界稳定；ζ > 1 时过阻尼，没有超调但响应变慢。' },
      { id: 'p2', title: '6.4 PID 控制器', page: 142, nodeIds: ['r9'], body: 'PID 控制器的输出 u = Kp·e + Ki·∫e dt + Kd·de/dt。\n\n比例项使输出与当前误差成正比，Kp 越大响应越快，但过大会引起超调甚至振荡；积分项累积历史误差，用于消除稳态误差；微分项反映误差的变化趋势，相当于提前制动，能抑制超调、增加系统阻尼。' },
    ],
  },
  {
    id: 'rs3', unitId: 'robo', kind: 'textbook', title: '《机器人视觉与控制 · 梯队培训讲义》', author: '机器人梯队视觉组', source: '校内自编 · 梯队培训', minutes: 180, views: 468,
    reason: '梯队内部讲义，按自瞄链路组织，和比赛实际最贴近', nodeIds: ['r11', 'r12', 'r13', 'r14', 'r15', 'r10', 'r16'],
    parts: [
      { id: 'p1', title: '第 1 节 图像预处理', page: 5, nodeIds: ['r11'], body: '比赛场地灯光复杂，识别灯条的第一步是把相机曝光调低，让画面里只剩下发光的灯条。之后对 BGR 图像做通道相减（识别红色时用 R − B），再二值化。二值图上常有零散噪点，用形态学开运算可以去掉。' },
      { id: 'p2', title: '第 2 节 相机模型与标定', page: 18, nodeIds: ['r12'], body: '针孔模型中，空间点经过外参（旋转 R、平移 t）变到相机坐标系，再经过内参矩阵 K 投影到像素平面。K 包含焦距 fx、fy 和主点 cx、cy，相机在世界中的位置属于外参，不在 K 里。\n\n标定时用棋盘格，拍 15～20 张不同角度、覆盖画面不同区域的照片，用张正友标定法求出内参和畸变系数。' },
      { id: 'p3', title: '第 3 节 装甲板识别', page: 31, nodeIds: ['r13'], body: '从二值图中提取灯条轮廓，用最小外接矩形描述每根灯条。两根灯条配成一块装甲板需要满足：长度相近、近似平行、间距与长度之比在合理范围内。颜色亮度不必完全相同——实际图像中两根灯条的像素值总会有差异。\n\n为了排除场地灯光等干扰，最后用数字分类器确认装甲板中间的图案。' },
      { id: 'p4', title: '第 4 节 PnP 位姿解算', page: 44, nodeIds: ['r14'], body: '已知装甲板四个角点的实际尺寸（3D 坐标）、它们在图像上的像素坐标（2D），以及相机内参，就可以用 solvePnP 求出装甲板相对相机的旋转和平移，平移向量的模就是距离。\n\n目标越远，装甲板在图像上越小，同样 1 个像素的角点误差占比越大，解出的距离抖动也越大。' },
      { id: 'p5', title: '第 5 节 弹道解算', page: 57, nodeIds: ['r15'], body: '弹丸飞行受重力影响会下坠，需要根据目标距离和弹速计算抬枪角。近距离可以忽略空气阻力；远距离时阻力明显，一般用迭代法：先按无阻力算一个角度，再模拟飞行、修正，直到落点误差足够小。' },
      { id: 'p6', title: '第 6 节 运动预测与卡尔曼滤波', page: 66, nodeIds: ['r10'], body: '目标在移动，弹丸飞行也需要时间，所以要瞄准目标"将来的位置"。用卡尔曼滤波对装甲板位置做平滑和速度估计，再乘以弹丸飞行时间得到预测位置。' },
      { id: 'p7', title: '第 7 节 云台控制', page: 78, nodeIds: ['r16'], body: '视觉主机把目标的偏航角和俯仰角通过串口发给下位机。云台采用串级 PID：外环是角度环，输出期望角速度；内环是速度环，输出电机电流。先调内环再调外环。' },
    ],
  },
  {
    id: 'rs4', unitId: 'robo', kind: 'video', title: '视觉组培训 · 第 3 讲 相机标定与 PnP', author: '机器人梯队视觉组', source: '梯队培训录播', minutes: 48, views: 536, duration: 2900,
    reason: 'AI 已按字幕切成 6 段，每段对应一个知识点', nodeIds: ['r12', 'r6', 'r7', 'r14'],
    parts: [
      { id: 'p1', title: '课程导入：为什么要标定', t: 0, nodeIds: ['r12'] },
      { id: 'p2', title: '针孔相机模型与内参', t: 220, nodeIds: ['r12'], body: '讲解针孔模型、内参矩阵各元素的含义。' },
      { id: 'p3', title: '坐标系变换回顾', t: 750, nodeIds: ['r6'], body: '用云台和相机的例子回顾旋转加平移，强调反向变换要先减平移。' },
      { id: 'p4', title: '张正友标定法实操', t: 1275, nodeIds: ['r12', 'r7'], body: '现场演示用棋盘格标定，说明为什么要多角度拍摄，以及背后的最小二乘估计。' },
      { id: 'p5', title: 'PnP 求解与 solvePnP', t: 2030, nodeIds: ['r14'], body: '用装甲板四个角点演示 PnP 求解。' },
      { id: 'p6', title: '实测误差分析', t: 2530, nodeIds: ['r14'], body: '对比近距离和远距离的解算结果，解释远距离抖动的原因。' },
    ],
  },
  {
    id: 'rs5', unitId: 'robo', kind: 'video', title: 'PID 调参实战：云台从抖动到稳定', author: '机器人梯队电控组', source: '梯队培训录播', minutes: 27, views: 389, duration: 1605,
    reason: '用真实云台演示 P、I、D 各自的作用', nodeIds: ['r8', 'r9', 'r16'],
    parts: [
      { id: 'p1', title: '问题现场：云台抖动', t: 0, nodeIds: ['r9'] },
      { id: 'p2', title: '阶跃响应怎么看', t: 150, nodeIds: ['r8'], body: '用示波器看阶跃响应，认识超调、调节时间。' },
      { id: 'p3', title: 'P、I、D 各自的作用', t: 490, nodeIds: ['r9'], body: '逐个调大 P、I、D，观察响应变化。' },
      { id: 'p4', title: '串级 PID：先内环后外环', t: 1060, nodeIds: ['r16', 'r9'], body: '速度环和角度环的调参顺序。' },
      { id: 'p5', title: '调参口诀与常见误区', t: 1380, nodeIds: ['r9'], body: '稳态误差靠 I，超调抖动先减 P 或加 D。' },
    ],
  },
  {
    id: 'rs6', unitId: 'robo', kind: 'video', title: '旋转矩阵的几何直观', author: '线性代数课程组', source: '课程平台 · 微视频', minutes: 16, views: 274, duration: 930,
    reason: '15 分钟看懂旋转矩阵，适合补基础', nodeIds: ['r5', 'r6'],
    parts: [
      { id: 'p1', title: '旋转是什么', t: 60, nodeIds: ['r5'], body: '从平面旋转出发推导 cosθ、sinθ 矩阵。' },
      { id: 'p2', title: '欧拉角与万向锁', t: 380, nodeIds: ['r5'], body: '三维旋转的顺序问题。' },
      { id: 'p3', title: '多坐标系串联', t: 660, nodeIds: ['r6'], body: '世界系 → 云台系 → 相机系的变换顺序。' },
    ],
  },
  {
    id: 'rs7', unitId: 'robo', kind: 'paper', title: '卡尔曼滤波入门：从直觉到公式', author: '控制课程组', source: '课程资源', minutes: 40, views: 158,
    reason: '先建立直觉再看公式，适合第一次接触', nodeIds: ['r18', 'r10'],
    parts: [
      { id: 'p1', title: '1 用高斯分布表示"不确定"', page: 2, nodeIds: ['r18'], body: '我们对目标位置的估计不是一个确定的数，而是一个分布：均值是最可能的位置，方差表示有多不确定。' },
      { id: 'p2', title: '2 预测与更新两步走', page: 5, nodeIds: ['r10'], body: '每一步先用运动模型预测（不确定度变大），再用观测修正（不确定度变小）。卡尔曼增益决定更相信预测还是观测。' },
    ],
  },
  {
    id: 'rs8', unitId: 'robo', kind: 'project', title: '2025 赛季步兵自瞄技术报告', author: '往届灵眸队', source: 'PBL 成果库 · 全校可见', minutes: 35, views: 221,
    reason: '往届团队的完整技术报告，可以对照自己的方案', nodeIds: ['r17', 'r13', 'r10', 'r15'],
    parts: [
      { id: 'p1', title: '一、系统框架', page: 1, nodeIds: ['r17'], body: '整套自瞄由识别、解算、预测、弹道、通信五个模块组成，视觉主机运行在 NUC 上，单帧处理时间约 6 ms。' },
      { id: 'p2', title: '二、识别模块的改进', page: 4, nodeIds: ['r13'], body: '我们在灯条配对后加入了数字分类器，场地灯光造成的误识别从约 8% 降到 1% 以下。' },
      { id: 'p3', title: '三、预测与弹道', page: 9, nodeIds: ['r10', 'r15'], body: '用卡尔曼滤波估计目标速度，结合弹道迭代计算抬枪角，对平移目标的命中率提升明显。' },
    ],
  },
  {
    id: 'rs9', unitId: 'robo', kind: 'textbook', title: '《C 程序设计》', author: '课程组', source: '课程平台 · C 语言程序设计', minutes: 100, views: 190,
    reason: '指针、结构体和协议解析的基础', nodeIds: ['r0', 'r1', 'r2', 'r3'],
    parts: [
      { id: 'p1', title: '第 2 章 程序基本结构', page: 23, nodeIds: ['r0'], body: '变量、表达式、分支与循环，函数的定义与调用。' },
      { id: 'p2', title: '第 8 章 指针', page: 201, nodeIds: ['r1'], body: '指针变量存放的是地址，*p 访问该地址上的数据。数组名在表达式中会转换为指向首元素的指针。' },
      { id: 'p3', title: '第 9 章 结构体', page: 256, nodeIds: ['r2'], body: '结构体把不同类型的数据组织在一起。通信协议中常用结构体描述一帧数据，注意编译器的字节对齐。' },
      { id: 'p4', title: '第 11 章 位运算与协议解析', page: 298, nodeIds: ['r3'], body: '用位运算拆分和拼接字节，按帧头同步、按校验和判断一帧数据是否完整。' },
    ],
  },
  {
    id: 'rs10', unitId: 'robo', kind: 'book', title: '《OpenCV 计算机视觉编程攻略》', author: 'R. Laganière', source: '图书馆', minutes: 90, views: 97,
    reason: '图像处理函数的用法速查', nodeIds: ['r11', 'r13'],
    parts: [
      { id: 'p1', title: '第 4 章 用形态学运算变换图像', page: 98, nodeIds: ['r11'], body: '开运算（先腐蚀后膨胀）去除小的白色噪点，闭运算（先膨胀后腐蚀）填补小的黑洞。' },
      { id: 'p2', title: '第 7 章 提取轮廓与形状描述', page: 176, nodeIds: ['r13'], body: 'findContours 提取轮廓，minAreaRect 求最小外接矩形，用于描述灯条的长度、角度。' },
    ],
  },
  // 两条待治理的资源：没有关联知识点、几乎没人看
  {
    id: 'rs11', unitId: 'robo', kind: 'video', title: '2024 赛季区域赛比赛录像合集', author: '机器人梯队', source: '梯队网盘导入', minutes: 210, views: 6, duration: 12600,
    reason: '比赛实况录像', nodeIds: [], parts: [],
  },
  {
    id: 'rs12', unitId: 'robo', kind: 'textbook', title: '视觉组讲义（2022 旧版）', author: '机器人梯队视觉组', source: '梯队网盘导入', minutes: 120, views: 2,
    reason: '旧版讲义，与 2025 版内容大量重复', nodeIds: [], parts: [],
  },
]

/** 待治理资源：AI 建议关联的知识点（教师采纳后生效） */
export const AI_TAG_SUGGESTIONS: Record<string, { nodeIds: string[]; note: string }> = {
  rs11: { nodeIds: ['r17', 'r13', 'r16'], note: 'AI 识别到录像中有 37 段自瞄命中 / 脱靶片段，可切片后挂到「自动瞄准」「装甲板识别」「云台控制」' },
  rs12: { nodeIds: ['r11', 'r13'], note: 'AI 判断与《梯队培训讲义》第 1、3 节内容重复度约 82%，建议归档，只保留差异部分' },
}

/** 领导版"学习资源"板块迁移过来的资源（片段在 stores/ai.ts 里按标题生成） */
const leaderResources: Resource[] = [
  { id: 'R-L-1', unitId: 'logic', kind: 'textbook', title: '《逻辑学导论》', author: '陈波', source: '课程平台', reason: '覆盖逻辑学基础框架，适合入门', minutes: 60, views: 120, nodeIds: ['L1', 'L0'], parts: [] },
  { id: 'R-L-9', unitId: 'logic', kind: 'textbook', title: '《逻辑与批判性思维》', author: '董华', source: '高等教育出版社', reason: '兼顾形式推理与日常论证分析，适合作为入门教材', minutes: 60, views: 86, nodeIds: ['L3', 'L4'], parts: [] },
  { id: 'R-L-10', unitId: 'logic', kind: 'textbook', title: '《数理逻辑导引》', author: '张锦文', source: '课程平台', reason: '补全命题与谓词逻辑体系，面向专业方向深入', minutes: 80, views: 41, nodeIds: ['L2', 'L6'], parts: [] },
  { id: 'R-L-2', unitId: 'logic', kind: 'course', title: '批判性思维与论证分析', author: '学业导师组', source: '课程平台', reason: '用案例训练识别前提、结论与漏洞', minutes: 45, views: 150, nodeIds: ['L3'], parts: [] },
  { id: 'R-L-12', unitId: 'logic', kind: 'course', title: '非形式逻辑与谬误识别', author: '通识中心', source: 'MOOC 平台', reason: '系统梳理常见逻辑谬误及其破解方式', minutes: 40, views: 98, nodeIds: ['L4'], parts: [] },
  { id: 'R-L-4', unitId: 'logic', kind: 'book', title: '《学会提问：批判性思维指南》', author: 'Neil Browne', source: '图书馆', reason: '批判性提问的入门读物', minutes: 120, views: 133, nodeIds: ['L3', 'L5'], parts: [] },
  { id: 'R-L-8', unitId: 'logic', kind: 'book', title: '《思考，快与慢》', author: 'Daniel Kahneman', source: '图书馆', reason: '结合认知偏差与理性决策训练', minutes: 180, views: 176, nodeIds: ['L5', 'L4'], parts: [] },
  { id: 'R-L-7', unitId: 'logic', kind: 'paper', title: 'What The Tortoise Said to Achilles', author: 'Lewis Carroll', source: '科研院', reason: '推理规则与无穷后退的思想实验', minutes: 20, views: 22, nodeIds: ['L1'], parts: [] },

  { id: 'R-CS-5', unitId: 'cs', kind: 'textbook', title: '《数据结构（C 语言版）》', author: '严蔚敏', source: '课程平台', reason: '国内经典数据结构教材', minutes: 120, views: 260, nodeIds: ['C1'], parts: [] },
  { id: 'R-CS-9', unitId: 'cs', kind: 'textbook', title: '《算法导论（第 3 版）》', author: 'Thomas H. Cormen', source: '课程平台', reason: '算法领域的标准教材，配套习题网站', minutes: 200, views: 140, nodeIds: ['C2'], parts: [] },
  { id: 'R-CS-10', unitId: 'cs', kind: 'textbook', title: '《操作系统概念》', author: 'Abraham Silberschatz', source: '高等教育出版社', reason: '覆盖进程、内存与文件系统等核心机制', minutes: 150, views: 96, nodeIds: ['C3'], parts: [] },
  { id: 'R-CS-2', unitId: 'cs', kind: 'course', title: '数据结构与算法 · MIT 6.006', author: 'Erik Demaine', source: 'MOOC 平台', reason: '提升编程基本功', minutes: 90, views: 188, nodeIds: ['C1', 'C2'], parts: [] },
  { id: 'R-CS-12', unitId: 'cs', kind: 'course', title: '网络安全基础 · 密码与协议', author: '安全实验室', source: '课程平台', reason: '建立信息安全与密码学基础认知', minutes: 60, views: 77, nodeIds: ['C4'], parts: [] },
  { id: 'R-CS-8', unitId: 'cs', kind: 'book', title: '《深入理解计算机系统》', author: 'Randal Bryant', source: '图书馆', reason: '打通硬件、系统与程序的底层联系', minutes: 240, views: 154, nodeIds: ['C3', 'C6'], parts: [] },
  { id: 'R-CS-13', unitId: 'cs', kind: 'book', title: '《人月神话》', author: 'Frederick Brooks', source: '校图书馆', reason: '软件工程经典，讲清大型项目协作规律', minutes: 120, views: 63, nodeIds: ['C5'], parts: [] },

  { id: 'R-AI-4', unitId: 'ai-data', kind: 'textbook', title: '《机器学习》', author: '周志华', source: '课程平台', reason: '国内主流机器学习教材', minutes: 150, views: 210, nodeIds: ['A1'], parts: [] },
  { id: 'R-AI-10', unitId: 'ai-data', kind: 'textbook', title: '《统计学：从数据到结论》', author: '李康', source: '课程平台', reason: '补齐统计推断基础，为建模提供方法支撑', minutes: 100, views: 88, nodeIds: ['A6'], parts: [] },
  { id: 'R-AI-2', unitId: 'ai-data', kind: 'course', title: '机器学习 · 吴恩达 Coursera', author: 'Andrew Ng', source: 'MOOC 平台', reason: '系统入门机器学习', minutes: 120, views: 245, nodeIds: ['A1', 'A4'], parts: [] },
  { id: 'R-AI-11', unitId: 'ai-data', kind: 'course', title: '数据流通合规与隐私计算实务', author: '数据合规中心', source: '课程平台', reason: '梳理数据确权、授权与合规审计要点', minutes: 60, views: 54, nodeIds: ['A2'], parts: [] },
  { id: 'R-AI-8', unitId: 'ai-data', kind: 'book', title: '《统计学习方法》', author: '李航', source: '图书馆', reason: '统计学习理论与常用模型精讲', minutes: 160, views: 132, nodeIds: ['A1', 'A3'], parts: [] },
  { id: 'R-AI-6', unitId: 'ai-data', kind: 'paper', title: 'A Few Useful Things to Know About Machine Learning', author: 'Pedro Domingos', source: '科研院', reason: '机器学习实践中的关键原则', minutes: 30, views: 70, nodeIds: ['A4'], parts: [] },

  { id: 'R-LIT-4', unitId: 'ailiteracy', kind: 'textbook', title: '《人工智能通识教程》', author: '高教社', source: '课程平台', reason: '面向全体学生的 AI 通识教材', minutes: 90, views: 230, nodeIds: ['G1'], parts: [] },
  { id: 'R-LIT-5', unitId: 'ailiteracy', kind: 'textbook', title: '《生成式人工智能使用指南》', author: '教务处', source: '课程平台', reason: '课堂与作业中负责任使用 AI 的规范', minutes: 30, views: 302, nodeIds: ['G5', 'G2'], parts: [] },
  { id: 'R-LIT-6', unitId: 'ailiteracy', kind: 'course', title: '人工智能伦理与社会', author: '通识中心', source: '课程平台', reason: '风险、公平与人类监督案例课', minutes: 60, views: 118, nodeIds: ['G4'], parts: [] },
  { id: 'R-LIT-11', unitId: 'ailiteracy', kind: 'course', title: '提示工程与高效人机协作', author: 'AI 应用教研组', source: 'MOOC 平台', reason: '掌握与 AI 协作提问、提升产出质量的方法', minutes: 45, views: 199, nodeIds: ['G2'], parts: [] },
  { id: 'R-LIT-7', unitId: 'ailiteracy', kind: 'paper', title: 'On the Dangers of Stochastic Parrots', author: 'Bender et al.', source: '科研院', reason: '理解大模型的风险与局限', minutes: 40, views: 64, nodeIds: ['G3'], parts: [] },
  { id: 'R-LIT-2', unitId: 'ailiteracy', kind: 'book', title: '《人工智能：现代方法》', author: 'Stuart Russell', source: '图书馆', reason: 'AI 经典教材，可作进阶阅读', minutes: 300, views: 90, nodeIds: ['G1'], parts: [] },
]

export const RESOURCES: Resource[] = [...roboResources, ...leaderResources]

// ---------------------------------------------------------------- 题目

const ref = (resId: string, partId: string) => ({ resId, partId })

export const QUESTIONS: Question[] = [
  // 矩阵运算
  { id: 'q-r4-1', nodeId: 'r4', level: 'basic', stem: '矩阵 A 是 2×3，矩阵 B 是 3×4，乘积 AB 的尺寸是？', options: ['2×4', '3×3', '2×3', '不能相乘'], answer: 0, explain: '乘法要求 A 的列数（3）等于 B 的行数（3），结果取外侧维度：2×4。', hints: ['先想矩阵乘法对两个矩阵的尺寸有什么要求。', '内侧的两个维度必须相等，结果的尺寸由外侧两个维度决定。', '(2×3)·(3×4)：中间的 3 消掉，剩下 2 和 4。'], ref: ref('rs1', 'p1') },
  { id: 'q-r4-2', nodeId: 'r4', level: 'standard', stem: '关于矩阵乘法，下列说法正确的是？', options: ['AB = BA 总成立', '(AB)C = A(BC)', '(AB)ᵀ = AᵀBᵀ', '若 AB = 0，则 A = 0 或 B = 0'], answer: 1, explain: '矩阵乘法满足结合律，不满足交换律；(AB)ᵀ = BᵀAᵀ（顺序反过来）；AB = 0 时 A、B 都可以不是零矩阵。', hints: ['逐个检查：哪些运算律对矩阵也成立？', '把矩阵看成"连续做两个变换"，想想顺序能不能换。', '转置要把顺序反过来；零因子在矩阵里是存在的。'], ref: ref('rs1', 'p1') },
  // 旋转矩阵
  { id: 'q-r5-1', nodeId: 'r5', level: 'basic', stem: '在平面上把向量逆时针旋转 90°，对应的旋转矩阵是？', options: ['[[0, −1], [1, 0]]', '[[0, 1], [−1, 0]]', '[[1, 0], [0, −1]]', '[[−1, 0], [0, −1]]'], answer: 0, explain: '代入 R(θ) = [[cosθ, −sinθ], [sinθ, cosθ]]，θ = 90° 时 cos = 0、sin = 1，得到 [[0, −1], [1, 0]]。', hints: ['先写出二维旋转矩阵的一般形式。', 'R(θ) = [[cosθ, −sinθ], [sinθ, cosθ]]。', 'cos90° = 0，sin90° = 1，代进去。'], ref: ref('rs1', 'p2') },
  { id: 'q-r5-2', nodeId: 'r5', level: 'standard', stem: '旋转矩阵 R 的逆矩阵等于？', options: ['R 本身', 'R 的转置', '−R', '不一定存在'], answer: 1, explain: '旋转矩阵是正交矩阵，满足 RᵀR = I，所以 R⁻¹ = Rᵀ。', hints: ['旋转矩阵属于哪一类特殊矩阵？', '正交矩阵满足 QᵀQ = I。', '由 RᵀR = I 直接看出逆是什么。'], ref: ref('rs1', 'p2') },
  // 坐标系变换
  { id: 'q-r6-1', nodeId: 'r6', level: 'standard', stem: '已知 P_g = R·P_c + t（相机系点变到云台系）。要把云台系的点变回相机系，应该是？', options: ['P_c = R·P_g − t', 'P_c = Rᵀ(P_g − t)', 'P_c = Rᵀ·P_g − t', 'P_c = R(P_g + t)'], answer: 1, explain: '从 P_g = R·P_c + t 出发：先两边减 t 得 P_g − t = R·P_c，再左乘 R⁻¹ = Rᵀ，得 P_c = Rᵀ(P_g − t)。', hints: ['把正向公式当成方程，解出 P_c。', '先处理平移，再处理旋转。', '两边减 t，再左乘 R 的逆（旋转矩阵的逆是转置）。'], ref: ref('rs1', 'p3') },
  { id: 'q-r6-2', nodeId: 'r6', level: 'challenge', stem: '世界系 → 云台系的齐次变换为 T1，云台系 → 相机系为 T2。世界系中的点 P 变到相机系应为？', options: ['T1·T2·P', 'T2·T1·P', 'T1ᵀ·T2·P', '(T1 + T2)·P'], answer: 1, explain: '先用 T1 把 P 变到云台系（T1·P），再用 T2 变到相机系：T2·(T1·P) = T2·T1·P。离点最近的变换最先作用。', hints: ['想清楚先做哪个变换。', '先做的变换离 P 最近。', '先 T1 后 T2，写成 T2·(T1·P)。'], ref: ref('rs6', 'p3') },
  // 图像预处理
  { id: 'q-r11-1', nodeId: 'r11', level: 'basic', stem: '识别红色装甲板灯条时，为了减少环境光干扰，第一步通常是？', options: ['降低曝光，再做颜色通道相减和二值化', '提高曝光让画面更亮', '直接转成灰度图', '放大图像分辨率'], answer: 0, explain: '降低曝光后画面里基本只剩发光的灯条，再用 R − B 通道相减突出红色，最后二值化。', hints: ['灯条是发光体，环境大多不发光。', '怎样让画面里只剩下发光的东西？', '先调曝光，再用颜色通道把红色挑出来。'], ref: ref('rs3', 'p1') },
  { id: 'q-r11-2', nodeId: 'r11', level: 'standard', stem: '二值化后灯条周围有很多小白点噪声，常用的处理是？', options: ['形态学开运算', '直方图均衡化', '提高对比度', '傅里叶变换'], answer: 0, explain: '开运算先腐蚀后膨胀，能去掉小的白色噪点而基本保留灯条形状。', hints: ['这是二值图上的去噪问题。', '形态学运算里有专门去小白点的组合。', '先腐蚀再膨胀叫什么？'], ref: ref('rs10', 'p1') },
  // 相机标定
  { id: 'q-r12-1', nodeId: 'r12', level: 'basic', stem: '针孔相机模型中，内参矩阵 K 不包含哪一项？', options: ['焦距 fx、fy', '主点 cx、cy', '相机在世界坐标系中的位置', '像素坐标的缩放关系'], answer: 2, explain: '相机在世界中的位置和朝向属于外参（R、t），不在内参矩阵 K 里。', hints: ['区分"内参"和"外参"。', '内参只和相机本身有关，换个地方摆相机它不会变。', '相机摆在哪儿，属于哪类参数？'], ref: ref('rs3', 'p2') },
  { id: 'q-r12-2', nodeId: 'r12', level: 'standard', stem: '用棋盘格标定相机时，下面哪种做法最合理？', options: ['只拍一张正对相机的照片', '拍 15～20 张，覆盖不同角度和画面不同区域', '照片越模糊越好，方便找角点', '棋盘格只放在画面中心'], answer: 1, explain: '多角度、覆盖全画面的照片能让参数估计更稳定，畸变系数也才估得准。', hints: ['标定本质上是一个参数估计问题。', '数据越多样，估计越稳定。', '画面边缘的畸变最明显，也要拍到。'], ref: ref('rs4', 'p4') },
  // 最小二乘
  { id: 'q-r7-1', nodeId: 'r7', level: 'basic', stem: '方程个数多于未知数、没有精确解时，最小二乘求的是？', options: ['使残差平方和最小的解', '任意一个方程的解', '使残差最大的解', '无解，直接放弃'], answer: 0, explain: '最小二乘求使 ‖Ax − b‖² 最小的 x。', hints: ['没有精确解时，退而求"最好的近似"。', '"最好"用什么衡量？', '名字里的"二乘"就是平方。'], ref: ref('rs1', 'p4') },
  { id: 'q-r7-2', nodeId: 'r7', level: 'standard', stem: '最小二乘解满足的正规方程是？', options: ['AᵀA·x = Aᵀb', 'A·x = 0', 'AAᵀ·x = b', 'x = A·b'], answer: 0, explain: '对 ‖Ax − b‖² 求导并令其为零，得到 AᵀAx = Aᵀb。', hints: ['对残差平方和求导。', '导数为零的条件就是正规方程。', '两边同乘 Aᵀ。'], ref: ref('rs1', 'p4') },
  // 装甲板识别
  { id: 'q-r13-1', nodeId: 'r13', level: 'standard', stem: '把两根灯条配对成装甲板时，下面哪个条件最不适合作为筛选依据？', options: ['两根灯条长度相近', '两根灯条近似平行', '两根灯条的像素亮度完全相同', '灯条间距与长度之比在合理范围内'], answer: 2, explain: '实际图像中两根灯条的亮度总会有差异，要求"完全相同"会把真目标也筛掉；长度、平行度、间距比才是可靠的几何约束。', hints: ['想想哪个条件在真实图像里几乎不可能满足。', '几何约束比像素级完全相等更可靠。', '"完全相同"这个要求太苛刻了。'], ref: ref('rs3', 'p3') },
  { id: 'q-r13-2', nodeId: 'r13', level: 'challenge', stem: '场地灯光常被误识别成装甲板，较好的改进是？', options: ['加入数字 / 图案分类器做二次确认', '把曝光调高', '删掉所有小轮廓', '降低相机帧率'], answer: 0, explain: '装甲板中间有数字贴纸，用分类器确认可以排除其他发光物。往届技术报告里误识别率由此从 8% 降到 1% 以下。', hints: ['装甲板和普通灯光有什么本质区别？', '装甲板中间有可以辨认的图案。', '用分类器确认图案。'], ref: ref('rs8', 'p2') },
  // PnP
  { id: 'q-r14-1', nodeId: 'r14', level: 'standard', stem: 'PnP 求解需要的输入是？', options: ['目标上若干点的 3D 坐标、对应的 2D 像素坐标、相机内参', '只要 2D 像素坐标', '只要相机内参', '两张不同角度的图像'], answer: 0, explain: 'PnP 由 n 个 3D-2D 对应点和相机内参求出目标相对相机的位姿。', hints: ['名字里的 n 个点指什么？', '需要知道点在真实世界里的位置，也要知道它在图里的位置。', '还要知道相机怎么把 3D 投到 2D。'], ref: ref('rs3', 'p4') },
  { id: 'q-r14-2', nodeId: 'r14', level: 'challenge', stem: '装甲板很远时，PnP 解出的距离抖动明显变大，主要原因是？', options: ['角点的像素误差相对目标尺寸变大', '相机内参变了', '装甲板颜色变了', '帧率太高'], answer: 0, explain: '目标越远在图上越小，同样 1 个像素的角点误差占比越大，解出的距离就越不稳定。', hints: ['远处的目标在图像上有什么变化？', '误差的绝对值没变，什么变了？', '比较误差和目标像素尺寸的比例。'], ref: ref('rs4', 'p6') },
  // 系统响应
  { id: 'q-r8-1', nodeId: 'r8', level: 'basic', stem: '阶跃响应出现持续等幅振荡，说明系统处于？', options: ['临界稳定', '过阻尼', '稳定且无超调', '开环'], answer: 0, explain: '阻尼比为 0 时出现持续等幅振荡，即临界稳定。', hints: ['振荡既不衰减也不发散，对应什么状态？', '和阻尼比有关。', '阻尼比为 0 时会怎样？'], ref: ref('rs2', 'p1') },
  { id: 'q-r8-2', nodeId: 'r8', level: 'standard', stem: '超调量大、振荡次数多，通常说明？', options: ['阻尼比偏小', '阻尼比偏大', '系统没有惯性', '采样太快'], answer: 0, explain: '欠阻尼时阻尼比越小，超调越大、振荡越多。', hints: ['超调和哪个参数关系最大？', '阻尼像"刹车"。', '刹车不够会怎样？'], ref: ref('rs2', 'p1') },
  // PID
  { id: 'q-r9-1', nodeId: 'r9', level: 'standard', stem: '云台跟踪时始终差一点对不准（稳态误差），优先调哪一项？', options: ['增大积分 I', '增大微分 D', '减小比例 P', '关掉 PID 改手动'], answer: 0, explain: '积分项会累积误差，只要还有误差就持续加大输出，直到误差消除。', hints: ['哪一项能"记住"过去一直存在的误差？', '比例项在误差很小时输出也很小。', '累积误差的是哪一项？'], ref: ref('rs2', 'p2') },
  { id: 'q-r9-2', nodeId: 'r9', level: 'standard', stem: '云台抖动、超调大，下列调整最合理的是？', options: ['适当减小 P 或增大 D', '增大 P', '增大 I', '降低电机电压'], answer: 0, explain: 'P 过大会超调和振荡；D 相当于提前刹车，能增加阻尼。', hints: ['超调是"冲过头"。', '哪个参数决定冲得多猛？哪个负责刹车？', '减小冲劲或加强刹车。'], ref: ref('rs5', 'p5') },

  // 逻辑单元（领导版"逻辑闯关乐园"的题，修正了第 4、5 题；另补 3 题）
  { id: 'q-L1-1', nodeId: 'L1', level: 'standard', stem: '学校规定：如果下雨，运动会就取消。今天运动会取消了。根据这句话，下面哪一项能确定？', options: ['今天一定下雨了', '今天一定没有下雨', '今天可能下雨了，也可能因为别的原因取消', '运动会从来不会取消'], answer: 2, explain: '条件句只能由前件推后件，不能由后件倒推前件。取消的原因还可能是大风、场地维修等。', hints: ['"如果 A 就 B"能从哪边推到哪边？', '知道 B 发生了，能确定 A 吗？', '反过来推不回去。'] },
  { id: 'q-L1-2', nodeId: 'L1', level: 'basic', stem: '"如果 p，那么 q"的逆否命题是？', options: ['如果 q，那么 p', '如果非 p，那么非 q', '如果非 q，那么非 p', 'p 并且 q'], answer: 2, explain: '逆否命题把前后件交换并同时否定，与原命题等价。', hints: ['逆否 = 逆 + 否。', '交换前后件，再都加上"非"。', '非 q → 非 p。'] },
  { id: 'q-L2-1', nodeId: 'L2', level: 'basic', stem: '老王说："我从来不看科幻电影。"下面哪句话和他的意思完全一样？', options: ['我一部科幻电影也没看过', '我很少看科幻电影', '我只看科幻电影', '我有时看科幻电影'], answer: 0, explain: '"从来不"是"一次都没有"，属于全称否定；"很少"表示次数少，范围更宽，两者不等价。', hints: ['留意"从来不"和"很少"在数量上的差别。', '"从来不"是多少次？', '找表示"零次"的选项。'] },
  { id: 'q-L2-2', nodeId: 'L2', level: 'standard', stem: '"所有 A 都是 B"的否定是？', options: ['所有 A 都不是 B', '有的 A 不是 B', '有的 A 是 B', '所有 B 都是 A'], answer: 1, explain: '否定全称肯定命题，只需要找到一个反例：有的 A 不是 B。', hints: ['要推翻"所有"，需要多少个反例？', '一个反例就够。', '有的 A 不是 B。'] },
  { id: 'q-L3-1', nodeId: 'L3', level: 'standard', stem: '老师发现：热爱阅读的同学都参加了读书会。小美参加了读书会。根据这些信息，可以推出什么？', options: ['小美一定热爱阅读', '小美不一定热爱阅读，也可能有别的原因参加', '小美一定不热爱阅读', '小美没有参加读书会'], answer: 1, explain: '前提是"爱阅读 → 参加读书会"；从"参加读书会"反推"爱阅读"是逆推，不成立。', hints: ['前提的方向是从哪到哪？', '你手里握着的是前提的哪一端？', '从后件不能倒推前件。'] },
  { id: 'q-L3-2', nodeId: 'L3', level: 'basic', stem: '"因为最近作业多，所以小李这周没有参加社团活动。"这句话的结论是？', options: ['最近作业多', '小李这周没有参加社团活动', '社团活动不重要', '小李不喜欢社团'], answer: 1, explain: '"所以"后面是结论，"因为"后面是前提。', hints: ['找表示结论的标志词。', '"所以"引出的是什么？', '"所以"后面的部分。'] },
  { id: 'q-L4-1', nodeId: 'L4', level: 'basic', stem: '小兔发现：过去三天，公园里的猫都在上午出现。于是它说"公园里的猫上午都会出现"。这个结论可靠吗？', options: ['很可靠，已经观察了三天', '不太可靠，三天样本太少，也可能只是这段时间的现象', '完全可靠，连续三天就能当规律', '要再等三天才能下结论'], answer: 1, explain: '样本太少就下结论，属于以偏概全。归纳推理需要更多、更全面的样本。', hints: ['看到的"猫"够不够多、够不够全面？', '观察次数少时容易犯什么错？', '以偏概全。'] },
  { id: 'q-L4-2', nodeId: 'L4', level: 'standard', stem: '小强每天早上喝牛奶后去跑步，三个月后身体变好了。他说："只要喝牛奶跑步，就一定会变健康。"他的问题在哪？', options: ['他的说法完全正确', '他把相关当成了因果，也忽略了其他影响健康的因素', '牛奶的营养不够丰富', '只是需要坚持更久'], answer: 1, explain: '两件事同时发生只说明相关，不能直接说明因果；健康还受作息、饮食等许多因素影响。', hints: ['两件事一起发生，就一定是因果吗？', '还有哪些因素会影响健康？', '相关不等于因果。'] },
]

/** AI 生成的变式题（AI 助教工作台"分层练习"里展示，教师采纳后才入库） */
export const AI_VARIANTS: Question[] = [
  { id: 'v-r6-1', nodeId: 'r6', level: 'basic', ai: true, stem: '平移向量 t 在坐标变换 P′ = R·P + t 中表示什么？', options: ['两个坐标系原点之间的位置差', '两个坐标系的朝向差', '点到原点的距离', '旋转的角度'], answer: 0, explain: 't 描述原点的偏移，R 描述朝向差。', hints: ['R 和 t 分工不同。', 'R 管朝向，t 管什么？', '原点的位置差。'] },
  { id: 'v-r6-2', nodeId: 'r6', level: 'standard', ai: true, stem: '相机装在云台正前方 5 cm 处、朝向与云台相同。相机系中正前方 1 m 的目标，在云台系中距离云台多远？', options: ['1.05 m', '0.95 m', '1 m', '无法确定'], answer: 0, explain: '朝向相同则 R = I，P_g = P_c + t，沿前方再加 5 cm，即 1.05 m。', hints: ['朝向相同意味着 R 是什么？', 'R = I 时只剩平移。', '1 m + 0.05 m。'] },
  { id: 'v-r6-3', nodeId: 'r6', level: 'challenge', ai: true, stem: '云台系 → 相机系的齐次变换 T 已知，要把相机系的点变回云台系，应使用？', options: ['T⁻¹，其中旋转部分为 Rᵀ、平移部分为 −Rᵀt', 'Tᵀ', '−T', 'T 本身'], answer: 0, explain: '齐次变换的逆：[[Rᵀ, −Rᵀt], [0, 1]]，不能直接对整个 4×4 矩阵取转置。', hints: ['反向变换就是求逆。', '齐次矩阵的逆不是简单的转置。', '旋转取转置，平移要变成 −Rᵀt。'] },
  { id: 'v-r9-1', nodeId: 'r9', level: 'basic', ai: true, stem: 'PID 中负责消除稳态误差的是？', options: ['积分项', '比例项', '微分项', '前馈项'], answer: 0, explain: '积分项累积误差，直到误差为零才停止增长。', hints: ['哪一项和"累积"有关？', '稳态误差是长期存在的小误差。', '积分。'] },
  { id: 'v-r9-2', nodeId: 'r9', level: 'standard', ai: true, stem: '调串级 PID 时，正确的顺序是？', options: ['先调内环（速度环），再调外环（角度环）', '先调外环再调内环', '两个环同时调', '只调外环就够'], answer: 0, explain: '内环响应快，是外环的执行基础，必须先调好。', hints: ['外环的输出交给谁执行？', '执行者先要靠谱。', '先内后外。'] },
  { id: 'v-r9-3', nodeId: 'r9', level: 'challenge', ai: true, stem: '目标匀速平移时，云台总是落后目标一点，单靠加大 I 效果不好。更好的做法是？', options: ['加入目标速度前馈', '继续加大 I', '去掉 D', '降低 P'], answer: 0, explain: '跟踪运动目标的滞后来自"总在追误差"，用目标速度做前馈可以提前给出控制量。', hints: ['PID 是"看到误差才动作"。', '能不能提前知道目标要往哪走？', '前馈。'] },
]

// ---------------------------------------------------------------- 关卡

export const LEVELS: Level[] = [
  { id: 'lv-robo-1', unitId: 'robo', order: 1, title: '坐标与旋转', nodeIds: ['r4', 'r5', 'r6'], diagnose: ['q-r4-1', 'q-r5-1', 'q-r6-1'], pass: ['q-r4-2', 'q-r5-2', 'q-r6-2'] },
  { id: 'lv-robo-2', unitId: 'robo', order: 2, title: '相机与标定', nodeIds: ['r11', 'r12', 'r7'], diagnose: ['q-r11-1', 'q-r12-1', 'q-r7-1'], pass: ['q-r11-2', 'q-r12-2', 'q-r7-2'] },
  { id: 'lv-robo-3', unitId: 'robo', order: 3, title: '识别与位姿解算', nodeIds: ['r13', 'r14'], diagnose: ['q-r13-1', 'q-r14-1', 'q-r12-1'], pass: ['q-r13-2', 'q-r14-2'], challenge: '拓展任务：阅读往届技术报告第二节，写出你会如何降低远距离 PnP 抖动（不少于 3 条）。' },
  { id: 'lv-robo-4', unitId: 'robo', order: 4, title: '控制基础', nodeIds: ['r8', 'r9'], diagnose: ['q-r8-1', 'q-r9-1', 'q-r8-2'], pass: ['q-r9-2', 'q-r8-2'], challenge: '拓展任务：观看《PID 调参实战》第 4 段，写出串级 PID 的调参步骤。' },
  { id: 'lv-robo-5', unitId: 'robo', order: 5, title: '预测与弹道', nodeIds: ['r10', 'r15'], diagnose: [], pass: [] },
  { id: 'lv-robo-6', unitId: 'robo', order: 6, title: '综合：自动瞄准', nodeIds: ['r16', 'r17'], diagnose: [], pass: [] },
  { id: 'lv-logic-1', unitId: 'logic', order: 1, title: '命题与量词', nodeIds: ['L1', 'L2'], diagnose: ['q-L1-2', 'q-L2-1'], pass: ['q-L1-1', 'q-L2-2'] },
  { id: 'lv-logic-2', unitId: 'logic', order: 2, title: '论证与谬误', nodeIds: ['L3', 'L4'], diagnose: ['q-L3-2', 'q-L4-1'], pass: ['q-L3-1', 'q-L4-2'] },
]

// ---------------------------------------------------------------- 掌握度演示数据（按演示人物）

/** 陈子轩（s1，已组队的学生）在机甲大师单元的掌握度；null = 未学 */
export const SEED_MASTERY: Record<string, Record<string, number | null>> = {
  s1: { r0: 92, r1: 85, r2: 80, r3: 72, r4: 90, r5: 74, r6: 45, r7: 75, r8: 65, r9: 40, r10: null, r11: 86, r12: 62, r13: 80, r14: 50, r15: null, r16: 55, r17: null, r18: 70 },
  s20: { r0: 76, r1: 58, r2: 52, r3: null, r4: 72, r5: 40, r6: null, r7: null, r8: null, r9: null, r10: null, r11: 64, r12: null, r13: null, r14: null, r15: null, r16: null, r17: null, r18: 60 },
}
/** 演示人物已通过的关卡 */
export const SEED_PASSED: Record<string, string[]> = {
  s1: ['lv-robo-1', 'lv-robo-2', 'lv-logic-1'],
  s20: [],
}
/** 班级（PBL 里的 28 名学生）各节点平均掌握度，用于教师视图 */
export const CLASS_BASE: Record<string, number> = {
  r0: 82, r1: 70, r2: 66, r3: 58, r4: 80, r5: 62, r6: 48, r7: 64, r8: 60, r9: 41, r10: 35, r11: 72, r12: 55, r13: 63, r14: 47, r15: 30, r16: 45, r17: 25, r18: 66,
}

// ---------------------------------------------------------------- 教师视图：共性错因（AI 归类，教师确认）

export const ERROR_REPORTS: ErrorReport[] = [
  {
    questionId: 'q-r6-1', answered: 28, wrong: 15,
    clusters: [
      { option: 0, label: '忘了先减平移，直接乘了 R', count: 8, suggestion: '推送教材 4.6 节（p.93）"反向变换"一段', ref: ref('rs1', 'p3') },
      { option: 2, label: '旋转和平移的先后顺序搞反', count: 5, suggestion: '推送视频《相机标定与 PnP》12:30 坐标系变换回顾', ref: ref('rs4', 'p3') },
      { option: 3, label: '把逆变换当成"取反"', count: 2, suggestion: '课上用一个具体数值例子演示' },
    ],
  },
  {
    questionId: 'q-r9-1', answered: 27, wrong: 13,
    clusters: [
      { option: 1, label: '以为微分 D 能消除稳态误差', count: 7, suggestion: '推送教材 6.4 节（p.142）P、I、D 的作用', ref: ref('rs2', 'p2') },
      { option: 2, label: '以为减小 P 就能对准', count: 4, suggestion: '推送视频《PID 调参实战》08:10 逐项演示', ref: ref('rs5', 'p3') },
      { option: 3, label: '其他', count: 2, suggestion: '个别辅导' },
    ],
  },
  {
    questionId: 'q-r14-2', answered: 24, wrong: 11,
    clusters: [
      { option: 1, label: '以为是相机内参发生了变化', count: 6, suggestion: '推送讲义第 4 节（p.44）误差来源说明', ref: ref('rs3', 'p4') },
      { option: 3, label: '归因于帧率', count: 3, suggestion: '推送视频《相机标定与 PnP》42:10 实测误差分析', ref: ref('rs4', 'p6') },
      { option: 2, label: '其他', count: 2, suggestion: '个别辅导' },
    ],
  },
]

// ---------------------------------------------------------------- 与 PBL 课题的关联

export const PROJECT_LINKS: ProjectLink[] = [
  { projectId: 'p1', unitId: 'robo', milestoneNodes: { 'p1-ms2': ['r12', 'r13', 'r14'], 'p1-ms3': ['r13', 'r14', 'r15'], 'p1-ms4': ['r10', 'r16', 'r17'] } },
  { projectId: 'p2', unitId: 'robo', milestoneNodes: { 'p2-ms2': ['r8', 'r9'], 'p2-ms3': ['r9', 'r3'] } },
  { projectId: 'p3', unitId: 'robo', milestoneNodes: { 'p3-ms2': ['r9', 'r16'], 'p3-ms3': ['r15', 'r16'] } },
]

// ---------------------------------------------------------------- AI 办学：学校 → 学院 → 能力单元 → 课程（演示数据）

export interface InsightRow {
  id: string
  name: string
  level: 'school' | 'college' | 'unit' | 'course'
  parent?: string
  /** 对应的能力单元（unit 层）或课程名（course 层） */
  unitId?: string
  course?: string
  students: number
  /** 以下均为百分比；null = 还没有数据（例如图谱未生成） */
  active: number
  mastery: number | null
  videoDone: number
  onTime: number
  levelPass: number | null
  zeroRes: number
  aiAsks: number
  aiHelpful: number
}

export const INSIGHT: InsightRow[] = [
  { id: 'school', name: '全校', level: 'school', students: 1860, active: 71, mastery: 64, videoDone: 68, onTime: 86, levelPass: 52, zeroRes: 14, aiAsks: 4210, aiHelpful: 86 },

  { id: 'col-me', name: '机电工程学院', level: 'college', parent: 'school', students: 620, active: 76, mastery: 59, videoDone: 72, onTime: 83, levelPass: 46, zeroRes: 18, aiAsks: 1680, aiHelpful: 86 },
  { id: 'col-cs', name: '计算机学院', level: 'college', parent: 'school', students: 760, active: 74, mastery: 69, videoDone: 70, onTime: 89, levelPass: 58, zeroRes: 11, aiAsks: 1770, aiHelpful: 88 },
  { id: 'col-ge', name: '通识教育中心', level: 'college', parent: 'school', students: 480, active: 63, mastery: 66, videoDone: 61, onTime: 88, levelPass: 55, zeroRes: 9, aiAsks: 760, aiHelpful: 83 },

  { id: 'u-robo', name: '机器人视觉与控制（机甲大师）', level: 'unit', parent: 'col-me', unitId: 'robo', students: 112, active: 88, mastery: 56, videoDone: 79, onTime: 81, levelPass: 46, zeroRes: 17, aiAsks: 1240, aiHelpful: 87 },
  { id: 'u-eng', name: '工程实践与项目管理', level: 'unit', parent: 'col-me', unitId: 'engineering', students: 508, active: 73, mastery: null, videoDone: 70, onTime: 84, levelPass: null, zeroRes: 19, aiAsks: 440, aiHelpful: 84 },
  { id: 'u-cs', name: '专业能力：计算机科学与技术', level: 'unit', parent: 'col-cs', unitId: 'cs', students: 540, active: 75, mastery: 70, videoDone: 71, onTime: 90, levelPass: 60, zeroRes: 10, aiAsks: 1230, aiHelpful: 88 },
  { id: 'u-ai', name: '"AI + 数据流通"微专业', level: 'unit', parent: 'col-cs', unitId: 'ai-data', students: 220, active: 72, mastery: 66, videoDone: 68, onTime: 87, levelPass: 55, zeroRes: 13, aiAsks: 540, aiHelpful: 87 },
  { id: 'u-logic', name: '逻辑思维能力', level: 'unit', parent: 'col-ge', unitId: 'logic', students: 300, active: 61, mastery: 67, videoDone: 58, onTime: 87, levelPass: 57, zeroRes: 8, aiAsks: 420, aiHelpful: 82 },
  { id: 'u-lit', name: '人工智能素养', level: 'unit', parent: 'col-ge', unitId: 'ailiteracy', students: 180, active: 66, mastery: 65, videoDone: 66, onTime: 90, levelPass: 52, zeroRes: 10, aiAsks: 340, aiHelpful: 85 },

  { id: 'c-c', name: 'C 语言程序设计', level: 'course', parent: 'u-robo', unitId: 'robo', course: 'C 语言程序设计', students: 112, active: 90, mastery: 72, videoDone: 82, onTime: 88, levelPass: null, zeroRes: 0, aiAsks: 210, aiHelpful: 89 },
  { id: 'c-la', name: '线性代数', level: 'course', parent: 'u-robo', unitId: 'robo', course: '线性代数', students: 112, active: 87, mastery: 61, videoDone: 80, onTime: 84, levelPass: 68, zeroRes: 0, aiAsks: 380, aiHelpful: 88 },
  { id: 'c-ctrl', name: '自动控制原理', level: 'course', parent: 'u-robo', unitId: 'robo', course: '自动控制原理', students: 98, active: 84, mastery: 49, videoDone: 73, onTime: 74, levelPass: 31, zeroRes: 0, aiAsks: 290, aiHelpful: 84 },
  { id: 'c-cv', name: '计算机视觉基础', level: 'course', parent: 'u-robo', unitId: 'robo', course: '计算机视觉基础', students: 86, active: 91, mastery: 56, videoDone: 81, onTime: 80, levelPass: 44, zeroRes: 33, aiAsks: 360, aiHelpful: 87 },
]

/** 学业预警（只做学业预警，不做心理预警）；学生 id 对应 PBL 演示人物 */
export const ACADEMIC_ALERTS: { sid: string; unitId: string; kind: string; detail: string }[] = [
  { sid: 's20', unitId: 'robo', kind: '前置知识薄弱', detail: '「旋转矩阵」「指针与内存」「结构体与数据打包」均低于 60%，后续「坐标系变换」「串口通信」会受影响' },
  { sid: 's27', unitId: 'robo', kind: '连续两周未学习', detail: '最近一次学习是 15 天前，所在团队「启航队」只有 1 人' },
  { sid: 's16', unitId: 'robo', kind: '作业连续缺交', detail: '《自动控制原理》近 2 次作业未提交' },
  { sid: 's8', unitId: 'robo', kind: '闯关反复未通过', detail: '第 1 关「坐标与旋转」过关检测 3 次未通过，卡在「坐标系变换」' },
]
