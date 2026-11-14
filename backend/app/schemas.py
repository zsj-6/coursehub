from datetime import datetime
from typing import Annotated, Any, Literal

from pydantic import AfterValidator, BaseModel, ConfigDict, Field

from app.db import to_utc

# 入参时间：无时区按 UTC 处理，统一转成 UTC
DT = Annotated[datetime, AfterValidator(to_utc)]

ActivityType = Literal["material", "video", "homework", "exam"]
QuestionType = Literal["single", "multiple", "judge", "fill", "short"]
MemberRole = Literal["teacher", "ta", "student"]
UserRole = Literal["admin", "teacher", "student"]


class ORM(BaseModel):
    model_config = ConfigDict(from_attributes=True)


# ---------- 用户 ----------
class UserOut(ORM):
    id: int
    username: str
    name: str
    avatar: str | None = None
    role: str
    student_no: str | None = None


class LoginIn(BaseModel):
    username: str
    password: str


class MeUpdate(BaseModel):
    name: str | None = Field(None, min_length=1, max_length=64)
    avatar: str | None = None


class PasswordIn(BaseModel):
    old_password: str
    new_password: str = Field(min_length=6, max_length=64)


class AdminUserIn(BaseModel):
    username: str = Field(min_length=2, max_length=64)
    password: str = Field("123456", min_length=6, max_length=64)
    name: str = Field(min_length=1, max_length=64)
    role: UserRole = "student"
    student_no: str | None = None


class AdminUserUpdate(BaseModel):
    name: str | None = Field(None, min_length=1, max_length=64)
    role: UserRole | None = None
    student_no: str | None = None
    password: str | None = Field(None, min_length=6, max_length=64)


# ---------- 课程 ----------
class CourseIn(BaseModel):
    name: str = Field(min_length=1, max_length=128)
    description: str = ""
    semester: str = ""
    cover: str | None = None


class CourseUpdate(BaseModel):
    name: str | None = Field(None, min_length=1, max_length=128)
    description: str | None = None
    semester: str | None = None
    cover: str | None = None
    archived: bool | None = None


class JoinIn(BaseModel):
    code: str = Field(min_length=6, max_length=6)


class MembersAddIn(BaseModel):
    usernames: list[str] = Field(min_length=1)
    role: MemberRole = "student"


class MemberRoleIn(BaseModel):
    role: MemberRole


# ---------- 章节 ----------
class ChapterIn(BaseModel):
    title: str = Field(min_length=1, max_length=200)
    parent_id: int | None = None


class ChapterUpdate(BaseModel):
    title: str = Field(min_length=1, max_length=200)


class MoveIn(BaseModel):
    direction: Literal["up", "down"]


# ---------- 活动 ----------
class ActivityIn(BaseModel):
    chapter_id: int
    type: ActivityType
    title: str = Field(min_length=1, max_length=200)
    description: str = ""
    is_published: bool = False
    open_at: DT | None = None
    close_at: DT | None = None
    start_at: DT | None = None
    due_at: DT | None = None
    full_score: float = Field(100, ge=0)
    score_ratio: float = Field(0, ge=0, le=100)
    settings: dict[str, Any] = {}


class ActivityUpdate(BaseModel):
    """只更新传了的字段；时间字段传 null 表示清空。"""

    chapter_id: int | None = None
    title: str | None = Field(None, min_length=1, max_length=200)
    description: str | None = None
    is_published: bool | None = None
    open_at: DT | None = None
    close_at: DT | None = None
    start_at: DT | None = None
    due_at: DT | None = None
    full_score: float | None = Field(None, ge=0)
    score_ratio: float | None = Field(None, ge=0, le=100)
    settings: dict[str, Any] | None = None


class BatchPublishIn(BaseModel):
    ids: list[int] = Field(min_length=1)
    publish: bool
    open_at: DT | None = None
    close_at: DT | None = None


class ProgressIn(BaseModel):
    delta_seconds: int = Field(0, ge=0, le=600)  # 距上次上报新增的观看秒数
    last_pos: float | None = Field(None, ge=0)
    duration: float | None = Field(None, ge=0)  # 视频总时长（前端读到的）
    completed: bool | None = None  # 资料类打开即完成


# ---------- 各类型活动的 settings ----------
class MaterialSettings(BaseModel):
    file_ids: list[int] = []
    allow_download: bool = True


class VideoSettings(BaseModel):
    file_id: int | None = None
    url: str | None = None
    duration_s: float | None = None


class HomeworkSettings(BaseModel):
    max_attempts: int = Field(0, ge=0)  # 0 表示不限
    score_rule: Literal["last", "max", "avg"] = "last"


class ExamSettings(BaseModel):
    duration_min: int = Field(0, ge=0)  # 0 表示不限时
    attempts: int = Field(1, ge=0)  # 0 表示不限
    shuffle_options: bool = False
    show_answer: bool = True  # 交卷后是否给学生看答案和解析


SETTINGS_MODELS: dict[str, type[BaseModel]] = {
    "material": MaterialSettings,
    "video": VideoSettings,
    "homework": HomeworkSettings,
    "exam": ExamSettings,
}


# ---------- 题目 ----------
class QuestionIn(BaseModel):
    id: int | None = None  # 带 id 表示保留原题（保持 id 不变，已有答卷才能对上）
    type: QuestionType
    stem: str = Field(min_length=1)
    options: list[str] = []
    answer: Any = None
    score: float = Field(ge=0)
    analysis: str = ""


class QuestionsIn(BaseModel):
    questions: list[QuestionIn]


# ---------- 提交 ----------
class HomeworkSubmitIn(BaseModel):
    content: str = ""
    file_ids: list[int] = []


class AnswersIn(BaseModel):
    answers: dict[str, Any] = {}


class SubmitExamIn(BaseModel):
    answers: dict[str, Any] | None = None


class GradeIn(BaseModel):
    score: float | None = Field(None, ge=0)
    comment: str | None = None
    question_scores: dict[str, float] | None = None  # 测试主观题逐题给分


class OverrideIn(BaseModel):
    user_id: int
    activity_id: int | None = None  # 为空表示改总评
    score: float | None = Field(None, ge=0)  # 为空表示撤销手动修改
