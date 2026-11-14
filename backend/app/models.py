from datetime import datetime
from typing import Any

from sqlalchemy import JSON, Boolean, Float, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db import Base, UTCDateTime, utcnow

# 删除时依赖数据库外键的 ON DELETE CASCADE（SQLite 在 db.py 里打开了 foreign_keys）


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(primary_key=True)
    username: Mapped[str] = mapped_column(String(64), unique=True, index=True)
    password_hash: Mapped[str] = mapped_column(String(128))
    name: Mapped[str] = mapped_column(String(64))
    avatar: Mapped[str | None] = mapped_column(String(255), default=None)
    role: Mapped[str] = mapped_column(String(16), default="student")  # admin|teacher|student
    student_no: Mapped[str | None] = mapped_column(String(32), default=None)
    created_at: Mapped[datetime] = mapped_column(UTCDateTime, default=utcnow)


class Course(Base):
    __tablename__ = "courses"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(128))
    code: Mapped[str] = mapped_column(String(6), unique=True, index=True)
    cover: Mapped[str | None] = mapped_column(String(255), default=None)
    description: Mapped[str] = mapped_column(Text, default="")
    semester: Mapped[str] = mapped_column(String(32), default="")
    owner_id: Mapped[int | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"))
    archived: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(UTCDateTime, default=utcnow)

    owner: Mapped[User | None] = relationship()


class CourseMember(Base):
    __tablename__ = "course_members"

    course_id: Mapped[int] = mapped_column(ForeignKey("courses.id", ondelete="CASCADE"), primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), primary_key=True)
    role: Mapped[str] = mapped_column(String(16), default="student")  # teacher|ta|student
    joined_at: Mapped[datetime] = mapped_column(UTCDateTime, default=utcnow)

    user: Mapped[User] = relationship(lazy="joined")


class Chapter(Base):
    """parent_id 为空是章节，不为空是单元。"""

    __tablename__ = "chapters"

    id: Mapped[int] = mapped_column(primary_key=True)
    course_id: Mapped[int] = mapped_column(ForeignKey("courses.id", ondelete="CASCADE"), index=True)
    parent_id: Mapped[int | None] = mapped_column(ForeignKey("chapters.id", ondelete="CASCADE"))
    title: Mapped[str] = mapped_column(String(200))
    sort: Mapped[int] = mapped_column(Integer, default=0)


class Activity(Base):
    """学习活动。open_at/close_at 是定时发布的可见时间段；
    due_at 是作业截止或测试结束时间；start_at 是测试开始时间。"""

    __tablename__ = "activities"

    id: Mapped[int] = mapped_column(primary_key=True)
    course_id: Mapped[int] = mapped_column(ForeignKey("courses.id", ondelete="CASCADE"), index=True)
    chapter_id: Mapped[int] = mapped_column(ForeignKey("chapters.id", ondelete="CASCADE"), index=True)
    type: Mapped[str] = mapped_column(String(16))  # material|video|homework|exam
    title: Mapped[str] = mapped_column(String(200))
    description: Mapped[str] = mapped_column(Text, default="")
    sort: Mapped[int] = mapped_column(Integer, default=0)
    is_published: Mapped[bool] = mapped_column(Boolean, default=False)
    open_at: Mapped[datetime | None] = mapped_column(UTCDateTime, default=None)
    close_at: Mapped[datetime | None] = mapped_column(UTCDateTime, default=None)
    start_at: Mapped[datetime | None] = mapped_column(UTCDateTime, default=None)
    due_at: Mapped[datetime | None] = mapped_column(UTCDateTime, default=None)
    full_score: Mapped[float] = mapped_column(Float, default=100)
    score_ratio: Mapped[float] = mapped_column(Float, default=0)
    settings: Mapped[dict[str, Any]] = mapped_column(JSON, default=dict)
    created_at: Mapped[datetime] = mapped_column(UTCDateTime, default=utcnow)

    questions: Mapped[list["Question"]] = relationship(
        order_by="Question.sort", passive_deletes=True
    )


class Question(Base):
    """答案格式：single → 选项下标 int；multiple → 下标列表；judge → bool；
    fill → 每个空一个字符串（多个正确答案用 | 分隔）；short → 参考答案字符串（不自动判分）。"""

    __tablename__ = "questions"

    id: Mapped[int] = mapped_column(primary_key=True)
    activity_id: Mapped[int] = mapped_column(ForeignKey("activities.id", ondelete="CASCADE"), index=True)
    type: Mapped[str] = mapped_column(String(16))  # single|multiple|judge|fill|short
    stem: Mapped[str] = mapped_column(Text)
    options: Mapped[list[str]] = mapped_column(JSON, default=list)
    answer: Mapped[Any] = mapped_column(JSON, default=None)
    score: Mapped[float] = mapped_column(Float, default=0)
    analysis: Mapped[str] = mapped_column(Text, default="")
    sort: Mapped[int] = mapped_column(Integer, default=0)


class FileObj(Base):
    """key 是随机串，下载地址 /api/files/{key} 靠它不可猜测来保护。"""

    __tablename__ = "files"

    id: Mapped[int] = mapped_column(primary_key=True)
    key: Mapped[str] = mapped_column(String(32), unique=True, index=True)
    owner_id: Mapped[int | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"))
    filename: Mapped[str] = mapped_column(String(255))
    path: Mapped[str] = mapped_column(String(255))  # 相对 upload_dir
    mime: Mapped[str] = mapped_column(String(128), default="application/octet-stream")
    size: Mapped[int] = mapped_column(Integer, default=0)
    created_at: Mapped[datetime] = mapped_column(UTCDateTime, default=utcnow)


class Submission(Base):
    """作业和测试共用。作业用 content/file_ids；测试用 answers = {"题目id": 答案}。
    status: draft(测试作答中) | submitted(待批改) | graded(已批改)"""

    __tablename__ = "submissions"

    id: Mapped[int] = mapped_column(primary_key=True)
    activity_id: Mapped[int] = mapped_column(ForeignKey("activities.id", ondelete="CASCADE"), index=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    attempt_no: Mapped[int] = mapped_column(Integer, default=1)
    content: Mapped[str] = mapped_column(Text, default="")
    file_ids: Mapped[list[int]] = mapped_column(JSON, default=list)
    answers: Mapped[dict[str, Any]] = mapped_column(JSON, default=dict)
    auto_score: Mapped[float | None] = mapped_column(Float, default=None)
    question_scores: Mapped[dict[str, Any]] = mapped_column(JSON, default=dict)
    score: Mapped[float | None] = mapped_column(Float, default=None)
    comment: Mapped[str] = mapped_column(Text, default="")
    status: Mapped[str] = mapped_column(String(16), default="submitted")
    meta: Mapped[dict[str, Any]] = mapped_column(JSON, default=dict)
    started_at: Mapped[datetime | None] = mapped_column(UTCDateTime, default=None)
    submitted_at: Mapped[datetime | None] = mapped_column(UTCDateTime, default=None)
    graded_at: Mapped[datetime | None] = mapped_column(UTCDateTime, default=None)

    user: Mapped[User] = relationship(lazy="joined")


class GradeOverride(Base):
    """教师手动改过的分数。activity_id 为空表示改的是课程总评。"""

    __tablename__ = "grade_overrides"

    id: Mapped[int] = mapped_column(primary_key=True)
    course_id: Mapped[int] = mapped_column(ForeignKey("courses.id", ondelete="CASCADE"), index=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"))
    activity_id: Mapped[int | None] = mapped_column(ForeignKey("activities.id", ondelete="CASCADE"))
    score: Mapped[float] = mapped_column(Float)
    updated_at: Mapped[datetime] = mapped_column(UTCDateTime, default=utcnow, onupdate=utcnow)


class Progress(Base):
    __tablename__ = "progress"

    activity_id: Mapped[int] = mapped_column(ForeignKey("activities.id", ondelete="CASCADE"), primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), primary_key=True)
    completed: Mapped[bool] = mapped_column(Boolean, default=False)
    watched_seconds: Mapped[int] = mapped_column(Integer, default=0)
    last_pos: Mapped[float] = mapped_column(Float, default=0)
    updated_at: Mapped[datetime] = mapped_column(UTCDateTime, default=utcnow, onupdate=utcnow)


class RecentVisit(Base):
    __tablename__ = "recent_visits"

    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), primary_key=True)
    course_id: Mapped[int] = mapped_column(ForeignKey("courses.id", ondelete="CASCADE"), primary_key=True)
    visited_at: Mapped[datetime] = mapped_column(UTCDateTime, default=utcnow)
