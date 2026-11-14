# CLAUDE.md — CourseHub（课程平台 · 精简复刻版）

> 目标：用 **2 天**做出一个可以演示的精简版课程平台。功能参考根目录里三份手册（《TronClass 快速指引手册-教师》《TC 快速指引手册-含AI-教师版》《TronClass AIR 管理员操作手册》）。
> **范围只做 P0**：课程建设、课件、作业、测试、成绩这条教学主流程。**AI、课堂互动（点名/抢答/弹幕等）、闯关、差异化教学都不做。**
> 只参考功能和流程，产品叫 **CourseHub**，不使用原产品的名称、Logo、图片和文案。

---

## 1. 技术栈（已固定，不要中途更换）

| 层 | 选型 |
|---|---|
| 后端 | **Python 3.10+ + FastAPI + SQLAlchemy 2.0 + Pydantic v2** |
| 数据库 | **SQLite**（`backend/data/app.db`），启动时 `Base.metadata.create_all`，不做数据库迁移 |
| 认证 | JWT（`PyJWT`）+ `bcrypt`（不用 passlib，它和新版 bcrypt 不兼容） |
| 文件 | 保存在本地 `backend/uploads/`，通过 `/api/files/{key}` 访问。key 是 128 位随机串，**下载不需要登录**，这样 `<img>`、`<video>` 可以直接引用；上传需要登录 |
| 导出 | `openpyxl` 导出成绩表，`zipfile` 打包下载作业 |
| 前端 | **Vue 3 + Vite + TypeScript + Element Plus + Pinia + Vue Router + Axios + dayjs** |
| 包管理 | 后端 `uv`（装在 `~/.local/bin`），前端 `npm`（Node 20，装在 nvm 下） |

界面风格：青绿色主色（`#3BB4B8` 一类），布局是"顶栏 + 左侧导航 + 主内容 + 右侧栏"。

---

## 2. 功能范围

### 必做（P0）

| 模块 | 要做的功能 |
|---|---|
| 账号 | 用户名和密码登录；角色分 `admin / teacher / student`；修改姓名、头像、密码；管理员可以管理用户（增删改，批量导入 CSV） |
| 首页 | 三栏布局。左边是导航（首页、我的课程、公告）。中间是"动态"和"待办"：最近开放或快截止的作业和测试，待办按今天、7 天内、以后分组。右边是"最近访问"，显示最近 6 门课程 |
| 我的课程 | 课程卡片列表；教师点「+ 新建课程」，填名称后开课；学生输入 6 位访问码加入课程；可以按名称或访问码搜索 |
| 课程主页 | 课程主菜单包括：课程内容、作业、测试、成绩、成员、课程设置 |
| 课程建设 | 两级目录（章节 → 单元），下面挂学习活动；可以新增、编辑、删除和排序（上移/下移就够）；可以把整门课的内容复制到另一门课；教师可以切换成"学生视角"预览 |
| 发布机制 | 新建的活动默认是草稿，学生看不到。支持立即发布、定时发布（设置开放和截止时间）、取消发布；可以在章节页勾选多个活动批量发布 |
| 参考资料 | 上传文件（ppt、pdf、doc、xls、图片等）；PDF 和图片能在线预览，其他格式只能下载；可以设置是否允许学生下载 |
| 音视频 | 上传视频或填外部链接，用 `<video>` 播放；每 10 秒上报一次观看进度，看到 90% 算完成 |
| 作业 | 设置截止时间、满分、成绩占比、计分规则（取最后一次、最高分或平均分）、最多提交次数。学生用文本加附件提交，可以多次提交，每次留一个版本。批改页分三栏：左边按批改状态和提交状态筛选学生，可以切换上一个/下一个；中间看提交内容和历史版本；右边打分、写评语。作业列表上也可以直接填最终成绩。支持打包下载：一个 zip，里面有一张汇总 Excel，加上每个学生一个文件夹（以"学号_姓名"命名） |
| 测试 | 设置开始和结束时间、作答时长、作答次数、满分、成绩占比、是否打乱选项顺序。题目编辑器支持单选、多选、判断、填空、简答 5 种题型，可以批量删除题目。学生到开始时间才能作答，有倒计时，时间到自动交卷。客观题自动判分，简答题由教师人工打分。教师能看到每个学生的答卷，最终成绩可以改。**公布成绩**：不公布 / 交卷后立即公布 / 定时公布，未公布前学生看不到得分和答案 |
| 成绩 | 成绩总表：行是学生，列是各个作业和测试，最后一列是总评。总评按"Σ 活动得分 ÷ 满分 × 成绩占比"自动计算；教师可以手动修改任意单元格，改过的值优先；可以导出 Excel。**成绩占比合计不能超过 100%**：新建/编辑活动时提示剩余可分配比例，成绩页有「成绩比例设定」弹窗一次调整所有占比 |
| 成员 | 查看课程成员；教师可以按用户名添加或移除学生，也可以设置助教 |
| 课程设置 | 修改课程名称、封面、简介、学期；重新生成访问码；归档课程；**完成指标**（音视频需累积观看的百分比，作业/测试是提交即完成还是成绩达标才算完成） |

### 可选（P0 全部做完、还有时间再做）
- 课程公告：教师发公告，可以设置开放和截止时间，首页显示最新公告
- 学习分析：完成度表格（学生 × 活动），视频观看进度
- 活动讨论区：发帖、回复、点赞、教师置顶

### 不做
AI 全部功能和 AI 点数、课堂模式与实时互动（点名、选人、抢答、随堂测、弹幕、投票、教学反馈）、课堂报告、闯关式学习、差异化教学、移动 App、统一身份认证、题库、防作弊、小组作业、互评、教研室、直播和录播。
**这些功能相关的表、字段、接口和页面都不要建，也不要为它们预留接口或抽象。**
（例外：第二阶段的 PBL 原型需要"小组"和"关卡式阶段"，只在 PBL 原型里出现，见下节。）

### 第二阶段（2026-11-14 起）：PBL 项目训练原型 + 课程平台补充功能
背景：CourseHub 是学校"未来学习中心"项目的课程平台原型（见根目录《未来学习中心_产品与AI方案_20261114.md》）。方案的三个模块是：课程资源、AI 知识图谱、项目训练。MVP 用"机甲大师"课程群做试验。**周一要交的是原型，不是完整平台。**

- **PBL 原型（纯前端）**：功能参考《PBL项目制教学管理平台 V2.0.pdf》，**不做 AI**。数据放在 `src/mock/pbl.ts` 和 `src/stores/pbl.ts`（存在 localStorage，可以一键重置），**不调后端**。页面放在 `src/views/pbl/`，路由是 `/pbl/*`。页面上有"演示视角"切换（学院管理员 / 指导教师 / 学生），一个人就能演示所有角色。
  - 主流程：大项目 → 拆成子项目（课题）→ 关卡式里程碑 → 发布 → 学生浏览、标记感兴趣、报名 → 组队（自由组队，或报名后随机分组；管理员可以手动调整）→ 团队空间（成员、资源、任务提交、讨论）→ 教师按团队评阅、推荐优秀提交 → 项目评价 → 成果展示 → 统计看板（概览、饼图、甘特图）
  - 演示数据先用机甲大师主题的示例内容；拿到真实资料后替换 `src/mock/pbl.ts`
- **课程平台补充（真实前后端）**：按"可选"清单做——课程公告、讨论区、学习分析。
- 仍然不做：AI、虚拟仿真、自动评分和学分认定。

---

## 3. 目录结构

```
cource/
├── CLAUDE.md
├── docs/                         # 原始手册，只用来理解功能
├── backend/
│   ├── pyproject.toml / requirements.txt
│   ├── .env.example              # JWT_SECRET, DATABASE_URL, UPLOAD_DIR
│   ├── app/
│   │   ├── main.py               # 创建 FastAPI 实例，配置 CORS，挂载路由，启动时建表
│   │   ├── config.py             # 用 pydantic-settings 读配置
│   │   ├── db.py                 # engine、SessionLocal、Base、get_db、utcnow、UTCDateTime 类型
│   │   ├── security.py           # 密码哈希、JWT
│   │   ├── deps.py               # get_current_user、require_role、check_course、check_activity、require_course_member
│   │   ├── models.py             # 全部 ORM 模型
│   │   ├── schemas.py            # 全部请求模型（入参校验）
│   │   ├── serializers.py        # ORM → 返回 dict
│   │   ├── routers/              # auth, files, dashboard, courses（含成员）, content（大纲/章节/活动/进度）,
│   │   │                         # submissions（作业/题目/测试/批改/打包）, grades, admin
│   │   └── services/             # visibility.py（可见性、可提交、成绩是否公布）、scoring.py（成绩）、completion.py（完成指标）、exam_grader.py（判分）、
│   │                             # exam.py（作答流程）、course_ops.py（访问码/排序/复制）、export.py（Excel/zip）
│   ├── seed.py                   # 生成演示数据
│   └── tests/                    # test_unit.py（纯函数）、test_flow.py（接口主流程与权限）
└── frontend/
    ├── package.json
    ├── vite.config.ts            # 把 /api 代理到 :8000
    └── src/
        ├── api/                  # 每个模块一个文件；共用一个 axios 实例，拦截器负责带 token、处理 401
        ├── stores/               # pinia：user、course
        ├── router/               # 路由守卫按角色拦截
        ├── layouts/              # MainLayout（顶栏 + 左导航）、CourseLayout（课程主菜单）
        ├── utils/format.ts       # 时间格式化、各种中文标签、发布状态、封面配色
        ├── views/
        │   ├── auth/Login.vue
        │   ├── home/Dashboard.vue        # 待办 + 动态 + 最近访问
        │   ├── course/   MyCourses / CourseContent（章节树、批量发布、学生视角、复制）/
        │   │             ActivityList（作业/测试列表，type 由路由传入）/ Grades / Members / Settings
        │   ├── activity/ ActivityPage（按类型分发）/ VideoPlayer / HomeworkPanel / ExamPanel /
        │   │             HomeworkGrade（三栏批改，全屏）/ QuestionEditor / ExamTake（全屏作答）/
        │   │             SubmissionView（测试答卷查看与主观题评分）
        │   ├── profile/Profile.vue
        │   └── admin/Users.vue
        └── components/   AppHeader、ActivityRow、ActivityIcon、ActivityFormDialog（新建和编辑通用）、
                          PublishDialog、FileUploader、FilePreview
```

---

## 4. 数据模型

```
User(id, username unique, password_hash, name, avatar, role[admin|teacher|student], student_no, created_at)
Course(id, name, code(6位访问码 unique), cover, description, semester, owner_id, archived,
       completion JSON(见 schemas.CompletionSettings：video_percent, homework, exam, pass_percent), created_at)
CourseMember(course_id, user_id, role[teacher|ta|student], joined_at)            主键(course_id, user_id)
Chapter(id, course_id, parent_id NULL=章节 / 非空=单元, title, sort)
Activity(id, course_id, chapter_id, type[material|video|homework|exam],
         title, description, sort, is_published,
         open_at, close_at,     # 定时发布：学生可见的时间段
         start_at,              # 测试开始时间
         due_at,                # 作业截止 / 测试结束时间
         full_score, score_ratio(0-100), settings JSON, created_at)
   settings（由 schemas.SETTINGS_MODELS 校验并补默认值）：
     material → {file_ids: [], allow_download: true}
     video    → {file_id | url, duration_s}
     homework → {max_attempts(0=不限), score_rule: "last"|"max"|"avg"}
     exam     → {duration_min(0=不限时), attempts(0=不限), shuffle_options, show_answer,
                 score_publish: "none"|"immediate"|"scheduled", score_publish_at}
   测试的 full_score 在保存题目时自动更新为题目分值之和
FileObj(id, key(随机串), owner_id, filename, path, mime, size, created_at)
Question(id, activity_id, type[single|multiple|judge|fill|short], stem, options JSON,
         answer JSON, score, analysis, sort)
Submission(id, activity_id, user_id, attempt_no, content TEXT, file_ids JSON, answers JSON,
           auto_score, question_scores JSON, score, comment, status[draft|submitted|graded],
           started_at, submitted_at, graded_at)
   作业和测试共用这张表：作业用 content 和 file_ids，测试用 answers = {question_id: answer}
GradeOverride(course_id, user_id, activity_id NULL=总评, score)     # 教师手动改过的分数
Progress(activity_id, user_id, completed, watched_seconds, last_pos, duration(前端上报的视频时长), updated_at)
RecentVisit(user_id, course_id, visited_at)
```

### 核心规则（每条规则只在一个地方实现，其他地方都调用它）

**学生可见性 `services/visibility.py`**
- 学生能看到一个活动，要同时满足：已发布（`is_published`）、在 `open_at`~`close_at` 时间段内（为空表示不限）、学生是课程成员。过了 `close_at` 学生就看不到了（手册原文："如有定时，学生在结束时间后不可查看"）。
- 作业过了 `due_at` 仍然能看，但不能再提交。
- 测试：在 `start_at`~`due_at` 之间才能开始作答；单次作答截止 = min(开始时间 + 时长, `due_at`)，后端多给 60 秒缓冲；超时未交的答卷按最后一次自动保存的答案自动交卷。
- 打乱选项时，选项仍用原始下标作为 key，学生提交的是 key，所以判分不需要换算。
- 所有给学生用的查询（课程大纲、首页动态、待办）都必须经过这个函数。

**成绩计算 `services/scoring.py`**
- 作业得分：从这个学生所有已批改的提交里，按 `score_rule` 取最后一次、最高分或平均分。
- 测试得分：在已提交的答卷里取最高分。客观题由 `exam_grader.py` 自动判分，规则如下：
  - 单选和判断：答案相等就得分。
  - 多选：全部选对才得分。
  - 填空：每个空单独判分，比较前去掉首尾空格；一个空有多个正确答案时用 `|` 分隔。
  - 简答：先记 0 分，等教师打分后再重新算总分。
- 课程总评 = Σ（活动得分 ÷ 活动满分 × 成绩占比）。有 `GradeOverride` 的格子用改过的值。
- 成绩占比：只有作业和测试计分（资料、视频的占比强制为 0）；一门课所有作业、测试的占比合计不能超过 100%，新建、编辑和「成绩比例设定」都会校验。

**成绩公布 `visibility.score_published`**
- 只对测试生效（作业批改后学生即可见）。未公布时，所有给学生的接口都去掉分数（`score`、`auto_score`、`question_scores`、逐题 `got`），也不显示答案和解析；学生的成绩表里该列标 `hidden`，且不计入学生看到的总评。教师和助教始终能看到。

**完成指标 `services/completion.py`**
- 资料：打开即完成；视频：累积观看 ≥ `video_percent`%（0 表示打开即完成）；作业/测试：`submit` 提交即完成，`pass` 计入成绩的得分 ≥ 满分的 `pass_percent`%。
- 完成状态按课程当前规则**动态计算**，老师改了规则，学生的进度立即按新规则显示。

**权限 `deps.py`**
- 管理员：所有操作都可以。
- 教师和助教：只能管理自己是成员的课程。助教可以批改，但不能删除课程，也不能改成员。
- 学生：只能访问自己加入的课程，只能看自己的提交。
- 权限分三级：`member`（课程成员）、`grader`（教师和助教）、`manager`（教师）。路径里带 `course_id` 的接口用 `Depends(require_course_member(level))`；带 `activity_id`、`chapter_id` 的接口在函数里调用 `check_activity` 或 `check_course`。
- 学生访问不可见的活动时，一律返回 404。
- 学生看成绩表时只返回本人一行，并且隐藏未发布的活动列。

---

## 5. API 约定

- 所有接口都以 `/api` 开头。成功时直接返回数据；出错时返回 `{"detail": "中文错误信息"}`，并带上合适的状态码。
- 鉴权方式：`Authorization: Bearer <jwt>`。
- 列表接口用 `?page=&size=` 分页，返回 `{items, total}`。
- 数据库里的时间统一存 UTC，用 ISO8601 格式；前端用 dayjs 转成本地时间显示。

```
POST /api/auth/login                    GET/PUT /api/me        PUT /api/me/password
GET  /api/dashboard                     # 动态、待办、最近访问，一次全部返回
GET/POST /api/courses                   GET/PUT/DELETE /api/courses/{id}
POST /api/courses/join {code}           POST /api/courses/{id}/regenerate-code
POST /api/courses/{id}/copy-to/{target_id}
GET/POST/DELETE /api/courses/{id}/members      PUT /api/courses/{id}/members/{uid} {role}
GET  /api/courses/{id}/outline          # 章节树和活动；学生调用时会过滤掉不可见的活动
POST/PUT/DELETE /api/chapters[/{id}]    POST /api/chapters/{id}/move {direction}
POST/GET/PUT/DELETE /api/activities[/{id}]     POST /api/activities/{id}/move {direction}
POST /api/activities/batch-publish {ids, publish, open_at?, close_at?}
POST /api/files (multipart)             GET /api/files/{id}[?inline=1]
GET/PUT /api/activities/{id}/questions  # 一次保存整张试卷
GET  /api/courses/{id}/activities?type=homework|exam   # 作业/测试列表（教师带统计，学生带自己的状态）
POST /api/activities/{id}/exam/start    # 生成一个 draft 提交（已有未交的就返回它），返回不含答案的题目
PUT  /api/submissions/{id}/answers      # 作答中自动保存
POST /api/submissions/{id}/submit       # 交卷，自动判分
GET  /api/submissions/{id}              # 单份提交详情；测试会附带题目（以及满足条件时的答案）
POST /api/activities/{id}/submissions   # 提交作业
GET  /api/activities/{id}/submissions   # 教师查看全部提交（可筛选）
GET  /api/activities/{id}/submissions/mine
PUT  /api/submissions/{id}/grade {score?, comment?, question_scores?}
GET  /api/activities/{id}/export.zip    # 作业打包下载
POST /api/activities/{id}/progress {watched_seconds, last_pos}
GET  /api/courses/{id}/grades           PUT /api/courses/{id}/grades/override
GET/PUT /api/courses/{id}/score-ratios  # 成绩比例一览（含剩余可分配）/ 一次调整多个活动的占比
GET  /api/courses/{id}/grades/export.xlsx
CRUD /api/admin/users                   POST /api/admin/users/import (CSV)
```

---

## 6. 常用命令

```bash
cd backend && uv sync                          # 或：python3 -m venv .venv && .venv/bin/pip install -r requirements.txt
cd backend && uv run python seed.py            # 重建演示数据（会删掉 data/app.db）
cd backend && uv run uvicorn app.main:app --reload --port 8000
cd backend && uv run pytest -q

cd frontend && npm install                      # 需要 Node 20+（nvm 安装的需先 source ~/.nvm/nvm.sh）
cd frontend && npm run dev                      # http://localhost:5173，/api 代理到 8000
cd frontend && npm run build                    # 会同时跑 vue-tsc 类型检查
```

演示账号（由 `seed.py` 生成，**只在本地使用**）：`admin / admin123`、`teacher1 / 123456`、`student1` 到 `student30` 的密码都是 `123456`。
seed 会准备 2 门完整的课程，包括章节、资料、视频、作业（有已交和已批改的）、测试（有已作答的），打开就能看到所有页面的效果。

---

## 7. 两天排期

**第 1 天上午：后端**
1. 搭好后端项目：db、所有模型、JWT 登录、`deps.py` 权限
2. 课程、成员、访问码、章节、活动的增删改查，`visibility.py`，文件上传和下载，批量发布
3. 作业提交和批改、试卷保存、开始作答和交卷、自动判分、`scoring.py`、成绩表接口
4. 写 `seed.py`，补上 `scoring`、`visibility`、`exam_grader` 的 pytest

**第 1 天下午：前端主框架**
5. 搭前端项目、登录页、MainLayout、首页 Dashboard、我的课程、新建课程、加入课程
6. CourseLayout、课程内容页（章节树、新增活动对话框、发布和批量发布、学生视角）
7. 资料预览页、视频播放页（上报观看进度）

**第 2 天上午：作业、测试、成绩**
8. 作业：教师新建和编辑、学生提交（多个版本）、三栏批改页、打包下载
9. 测试：题目编辑器（5 种题型）、学生作答页（倒计时、自动交卷）、答卷查看和人工打分
10. 成绩总表（手动改分、导出 Excel）

**第 2 天下午：收尾**
11. 成员管理、课程设置、复制课程、个人资料、管理员用户管理
12. 用教师和学生两个账号把完整流程走一遍，修 bug，统一界面细节，补全 seed 数据
13. 还有时间的话，按顺序做"可选"清单：公告 → 学习分析 → 讨论区

**验收标准**：教师建课 → 建章节 → 上传资料和视频 → 布置作业和测试并发布 → 学生用访问码加入 → 看资料、交作业、做测试 → 教师批改 → 成绩表自动汇总并能导出。这条流程必须完整无报错。

---

## 8. 编码约定（给 Claude 的工作规则）

- **先打通完整流程，再补细节**。每做完一个模块，都要用 seed 账号在浏览器里实际操作一遍，确认没问题再继续。
- 后端路由函数只做参数处理，业务逻辑放进 `services/`。不要为了"以后可能用到"写抽象层或插件机制。
- 改了模型就直接重跑 `seed.py`，不用迁移工具。
- 前端页面放 `views/`，复用的组件放 `components/`。所有请求都写在 `src/api/*.ts` 里，组件里不要直接调用 axios。表单、表格、对话框统一用 Element Plus。
- 界面文案和错误提示用中文；代码里的变量名、函数名用英文。
- 不要引入 Redis、Celery、WebSocket、消息队列、微服务。单进程运行。
- 不要提交 `.env`、`data/`、`uploads/` 到 git。
- 根目录的手册只用来理解功能，不要把里面的图片和文字搬进产品界面。
- 测试只写这几块：成绩计算、可见性、测试自动判分、权限（学生不能访问没加入的课程）、成绩占比校验、完成指标、成绩公布（`tests/test_features.py`）。
- 根目录的 `课程平台爬取数据/` 含真实个人信息和登录凭据，已在 `.gitignore` 中；只能参考其中的截图和页面规格，不要把里面的任何数据用进代码、seed 或提交。
