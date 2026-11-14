# CourseHub

一个精简的混合式教学课程平台：课程建设、课件与视频、作业、测试、成绩。
后端 FastAPI + SQLite，前端 Vue 3 + Element Plus。

## 功能

- **课程**：新建课程、6 位访问码加入、成员与助教管理、复制课程内容、归档
- **课程建设**：章节 → 单元 → 学习活动；草稿 / 立即发布 / 定时发布 / 批量发布；学生视角预览
- **资料与视频**：PDF、图片在线预览，可设置是否允许下载；视频观看进度统计
- **作业**：多次提交并保留版本、三栏批改页、按最后一次 / 最高 / 平均计分、打包下载（zip + 汇总 Excel）
- **测试**：单选、多选、判断、填空、简答；限时作答、自动保存、超时自动交卷、选项乱序；客观题自动判分，简答题人工评分
- **成绩**：按成绩占比自动计算总评，可手动修改任意成绩，导出 Excel
- **首页**：待办（按今天 / 七天内 / 以后分组）、动态、最近访问
- **管理员**：用户增删改，CSV 批量导入

## 本地运行

需要 Python 3.10+（推荐用 [uv](https://docs.astral.sh/uv/)）和 Node.js 20+。

```bash
# 后端
cd backend
uv sync                       # 或：python3 -m venv .venv && .venv/bin/pip install -r requirements.txt
uv run python seed.py         # 生成演示数据
uv run uvicorn app.main:app --reload --port 8000

# 前端（另开一个终端）
cd frontend
npm install
npm run dev                   # http://localhost:5173
```

接口文档：http://localhost:8000/docs

### 演示账号（seed.py 生成，仅用于本地）

| 账号 | 密码 | 身份 |
|---|---|---|
| teacher1 / teacher2 | 123456 | 教师 |
| student1 | 123456 | 「数据结构」的助教 |
| student2 ~ student30 | 123456 | 学生 |
| admin | admin123 | 管理员 |

## 测试

```bash
cd backend && uv run pytest -q
cd frontend && npm run build   # 含 vue-tsc 类型检查
```

## 目录

```
backend/   FastAPI 应用（app/）、演示数据（seed.py）、测试（tests/）
frontend/  Vue 3 应用（src/）
CLAUDE.md  设计说明：功能范围、数据模型、成绩与可见性规则、接口约定
```
