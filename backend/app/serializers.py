"""把 ORM 对象转成接口返回的 dict。"""

from typing import Any

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import Activity, Course, FileObj, Question, Submission, User


def user_out(u: User | None) -> dict | None:
    if u is None:
        return None
    return {
        "id": u.id,
        "username": u.username,
        "name": u.name,
        "avatar": u.avatar,
        "role": u.role,
        "student_no": u.student_no,
    }


def user_brief(u: User) -> dict:
    return {"id": u.id, "name": u.name, "username": u.username, "student_no": u.student_no, "avatar": u.avatar}


def file_out(f: FileObj) -> dict:
    return {
        "id": f.id,
        "key": f.key,
        "filename": f.filename,
        "mime": f.mime,
        "size": f.size,
        "url": f"/api/files/{f.key}",
    }


def files_by_ids(db: Session, ids: list[int]) -> list[dict]:
    if not ids:
        return []
    found = {f.id: f for f in db.scalars(select(FileObj).where(FileObj.id.in_(ids)))}
    return [file_out(found[i]) for i in ids if i in found]


def course_out(c: Course, my_role: str | None = None, student_count: int | None = None) -> dict:
    return {
        "id": c.id,
        "name": c.name,
        "code": c.code,
        "cover": c.cover,
        "description": c.description,
        "semester": c.semester,
        "archived": c.archived,
        "owner": {"id": c.owner.id, "name": c.owner.name} if c.owner else None,
        "created_at": c.created_at,
        "my_role": my_role,
        "student_count": student_count,
    }


def activity_brief(a: Activity) -> dict:
    return {
        "id": a.id,
        "course_id": a.course_id,
        "chapter_id": a.chapter_id,
        "type": a.type,
        "title": a.title,
        "sort": a.sort,
        "is_published": a.is_published,
        "open_at": a.open_at,
        "close_at": a.close_at,
        "start_at": a.start_at,
        "due_at": a.due_at,
        "full_score": a.full_score,
        "score_ratio": a.score_ratio,
    }


def activity_detail(db: Session, a: Activity) -> dict:
    data = activity_brief(a)
    data["description"] = a.description
    data["settings"] = a.settings or {}
    data["created_at"] = a.created_at
    s = a.settings or {}
    if a.type == "material":
        data["files"] = files_by_ids(db, s.get("file_ids", []))
    elif a.type == "video":
        data["files"] = files_by_ids(db, [s["file_id"]] if s.get("file_id") else [])
    elif a.type == "exam":
        data["question_count"] = len(a.questions)
    return data


def question_full(q: Question) -> dict:
    """教师用：含答案和解析。"""
    return {
        "id": q.id,
        "type": q.type,
        "stem": q.stem,
        "options": q.options or [],
        "answer": q.answer,
        "score": q.score,
        "analysis": q.analysis,
        "sort": q.sort,
    }


def question_for_student(q: Question, order: list[int] | None = None) -> dict:
    """学生作答用：不含答案。选项保留原始下标 key，作答时提交 key。"""
    opts = q.options or []
    idx = order if order and len(order) == len(opts) else list(range(len(opts)))
    data: dict[str, Any] = {
        "id": q.id,
        "type": q.type,
        "stem": q.stem,
        "score": q.score,
        "options": [{"key": i, "text": opts[i]} for i in idx] if q.type in ("single", "multiple") else [],
    }
    if q.type == "fill":
        data["blank_count"] = len(q.answer) if isinstance(q.answer, list) else 1
    return data


def submission_out(db: Session, s: Submission, include_user: bool = True) -> dict:
    data = {
        "id": s.id,
        "activity_id": s.activity_id,
        "user_id": s.user_id,
        "attempt_no": s.attempt_no,
        "content": s.content,
        "files": files_by_ids(db, s.file_ids or []),
        "auto_score": s.auto_score,
        "question_scores": s.question_scores or {},
        "score": s.score,
        "comment": s.comment,
        "status": s.status,
        "started_at": s.started_at,
        "submitted_at": s.submitted_at,
        "graded_at": s.graded_at,
    }
    if include_user:
        data["user"] = user_brief(s.user)
    return data
