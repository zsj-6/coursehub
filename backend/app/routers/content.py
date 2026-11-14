"""课程建设：大纲、章节/单元、学习活动、发布、学习进度。"""

from collections import defaultdict

from fastapi import APIRouter, Depends, HTTPException
from pydantic import ValidationError
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db import get_db, utcnow
from app.deps import CourseCtx, check_activity, check_course, get_current_user, require_course_member
from app.models import Activity, Chapter, CourseMember, FileObj, Progress, Submission, User
from app.schemas import (
    SETTINGS_MODELS,
    ActivityIn,
    ActivityUpdate,
    BatchPublishIn,
    ChapterIn,
    ChapterUpdate,
    MoveIn,
    ProgressIn,
)
from app.serializers import activity_brief, activity_detail
from app.services import scoring
from app.services.course_ops import move, next_sort
from app.services.visibility import is_visible

router = APIRouter(tags=["课程建设"])


# ---------------- 大纲 ----------------
@router.get("/courses/{course_id}/outline")
def outline(
    as_student: bool = False,
    ctx: CourseCtx = Depends(require_course_member()),
    db: Session = Depends(get_db),
):
    """章节树 + 活动。学生只看到可见活动；教师传 as_student=1 可预览学生视角。"""
    student_view = ctx.is_student or as_student
    chapters = db.scalars(
        select(Chapter).where(Chapter.course_id == ctx.course.id).order_by(Chapter.sort, Chapter.id)
    ).all()
    acts = db.scalars(
        select(Activity).where(Activity.course_id == ctx.course.id).order_by(Activity.sort, Activity.id)
    ).all()
    if student_view:
        now = utcnow()
        acts = [a for a in acts if is_visible(a, now)]

    completed: set[int] = set()
    if ctx.is_student:
        completed = set(
            db.scalars(
                select(Progress.activity_id).where(Progress.user_id == ctx.user.id, Progress.completed.is_(True))
            )
        )
        # 交过的作业/测试也算完成
        completed |= set(
            db.scalars(
                select(Submission.activity_id).where(
                    Submission.user_id == ctx.user.id, Submission.status != "draft"
                )
            )
        )

    acts_by_ch: dict[int, list[dict]] = defaultdict(list)
    for a in acts:
        item = activity_brief(a)
        if ctx.is_student:
            item["completed"] = a.id in completed
        acts_by_ch[a.chapter_id].append(item)

    units_by_parent: dict[int, list[Chapter]] = defaultdict(list)
    for c in chapters:
        if c.parent_id is not None:
            units_by_parent[c.parent_id].append(c)

    def node(c: Chapter) -> dict:
        return {"id": c.id, "title": c.title, "sort": c.sort, "parent_id": c.parent_id, "activities": acts_by_ch.get(c.id, [])}

    return [
        {**node(c), "units": [node(u) for u in units_by_parent.get(c.id, [])]}
        for c in chapters
        if c.parent_id is None
    ]


# ---------------- 章节 / 单元 ----------------
def _load_chapter(db: Session, user: User, chapter_id: int) -> Chapter:
    ch = db.get(Chapter, chapter_id)
    if not ch:
        raise HTTPException(404, "章节不存在")
    check_course(db, user, ch.course_id, "manager")
    return ch


@router.post("/courses/{course_id}/chapters")
def create_chapter(
    body: ChapterIn,
    ctx: CourseCtx = Depends(require_course_member("manager")),
    db: Session = Depends(get_db),
):
    if body.parent_id is not None:
        parent = db.get(Chapter, body.parent_id)
        if not parent or parent.course_id != ctx.course.id:
            raise HTTPException(400, "所属章节不存在")
        if parent.parent_id is not None:
            raise HTTPException(400, "单元下面不能再建单元")
    ch = Chapter(
        course_id=ctx.course.id,
        parent_id=body.parent_id,
        title=body.title,
        sort=next_sort(db, Chapter, course_id=ctx.course.id, parent_id=body.parent_id),
    )
    db.add(ch)
    db.commit()
    return {"id": ch.id, "title": ch.title, "sort": ch.sort, "parent_id": ch.parent_id}


@router.put("/chapters/{chapter_id}")
def update_chapter(
    chapter_id: int, body: ChapterUpdate, user: User = Depends(get_current_user), db: Session = Depends(get_db)
):
    ch = _load_chapter(db, user, chapter_id)
    ch.title = body.title
    db.commit()
    return {"id": ch.id, "title": ch.title}


@router.delete("/chapters/{chapter_id}")
def delete_chapter(chapter_id: int, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """会连同下面的单元和活动一起删除。"""
    ch = _load_chapter(db, user, chapter_id)
    db.delete(ch)
    db.commit()
    return {"ok": True}


@router.post("/chapters/{chapter_id}/move")
def move_chapter(chapter_id: int, body: MoveIn, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    ch = _load_chapter(db, user, chapter_id)
    stmt = select(Chapter).where(Chapter.course_id == ch.course_id)
    stmt = stmt.where(Chapter.parent_id.is_(None) if ch.parent_id is None else Chapter.parent_id == ch.parent_id)
    move(db.scalars(stmt).all(), ch, body.direction)
    db.commit()
    return {"ok": True}


# ---------------- 学习活动 ----------------
def _normalize_settings(db: Session, act_type: str, raw: dict, user: User) -> dict:
    try:
        settings = SETTINGS_MODELS[act_type](**(raw or {})).model_dump()
    except ValidationError as e:
        raise HTTPException(422, f"活动设置不正确：{e.errors()[0]['msg']}")
    file_ids = settings.get("file_ids") or ([settings["file_id"]] if settings.get("file_id") else [])
    if file_ids:
        found = set(db.scalars(select(FileObj.id).where(FileObj.id.in_(file_ids))))
        if set(file_ids) - found:
            raise HTTPException(400, "引用的文件不存在")
    if act_type == "video" and not settings.get("file_id") and not settings.get("url"):
        raise HTTPException(400, "请上传视频或填写视频链接")
    return settings


def _check_times(a: Activity) -> None:
    if a.open_at and a.close_at and a.open_at >= a.close_at:
        raise HTTPException(400, "开放时间必须早于结束时间")
    if a.start_at and a.due_at and a.start_at >= a.due_at:
        raise HTTPException(400, "开始时间必须早于截止时间")


def _check_chapter(db: Session, course_id: int, chapter_id: int) -> None:
    ch = db.get(Chapter, chapter_id)
    if not ch or ch.course_id != course_id:
        raise HTTPException(400, "所属章节不存在")


@router.post("/courses/{course_id}/activities")
def create_activity(
    body: ActivityIn,
    ctx: CourseCtx = Depends(require_course_member("manager")),
    db: Session = Depends(get_db),
):
    _check_chapter(db, ctx.course.id, body.chapter_id)
    data = body.model_dump()
    data["settings"] = _normalize_settings(db, body.type, body.settings, ctx.user)
    if body.type == "exam":
        data["full_score"] = 0  # 测试满分 = 题目分值之和，保存题目时更新
    act = Activity(
        course_id=ctx.course.id,
        sort=next_sort(db, Activity, chapter_id=body.chapter_id),
        **data,
    )
    _check_times(act)
    db.add(act)
    db.commit()
    return activity_detail(db, act)


@router.get("/courses/{course_id}/activities")
def list_activities(
    type: str | None = None,
    ctx: CourseCtx = Depends(require_course_member()),
    db: Session = Depends(get_db),
):
    """作业列表 / 测试列表页。教师看到提交统计，学生看到自己的状态和得分。"""
    stmt = select(Activity).where(Activity.course_id == ctx.course.id)
    if type:
        stmt = stmt.where(Activity.type == type)
    acts = db.scalars(stmt.order_by(Activity.created_at)).all()
    if ctx.is_student:
        now = utcnow()
        acts = [a for a in acts if is_visible(a, now)]
    if not acts:
        return []
    act_ids = [a.id for a in acts]

    sub_q = select(Submission).where(Submission.activity_id.in_(act_ids), Submission.status != "draft")
    if ctx.is_student:
        sub_q = sub_q.where(Submission.user_id == ctx.user.id)
    subs_by: dict[tuple[int, int], list[Submission]] = defaultdict(list)
    for s in db.scalars(sub_q):
        subs_by[(s.activity_id, s.user_id)].append(s)

    result = []
    if ctx.is_student:
        for a in acts:
            mine = subs_by.get((a.id, ctx.user.id), [])
            item = activity_brief(a)
            item.update(
                my_status=scoring.submission_status(mine),
                my_score=scoring.activity_score(a, mine),
                my_attempts=len(mine),
            )
            result.append(item)
        return result

    student_ids = set(
        db.scalars(
            select(CourseMember.user_id).where(
                CourseMember.course_id == ctx.course.id, CourseMember.role == "student"
            )
        )
    )
    for a in acts:
        statuses = [
            scoring.submission_status(subs_by.get((a.id, uid), [])) for uid in student_ids
        ]
        item = activity_brief(a)
        item.update(
            student_count=len(student_ids),
            submitted_count=sum(s != "not_submitted" for s in statuses),
            pending_count=sum(s == "pending" for s in statuses),
            graded_count=sum(s == "graded" for s in statuses),
        )
        result.append(item)
    return result


@router.get("/activities/{activity_id}")
def get_activity(activity_id: int, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    act, role = check_activity(db, user, activity_id)
    data = activity_detail(db, act)
    data["my_role"] = role
    if role == "student":
        p = db.get(Progress, (act.id, user.id))
        data["progress"] = (
            {"completed": p.completed, "watched_seconds": p.watched_seconds, "last_pos": p.last_pos} if p else None
        )
    return data


@router.put("/activities/{activity_id}")
def update_activity(
    activity_id: int, body: ActivityUpdate, user: User = Depends(get_current_user), db: Session = Depends(get_db)
):
    act, _ = check_activity(db, user, activity_id, "manager")
    data = body.model_dump(exclude_unset=True)
    if "chapter_id" in data and data["chapter_id"] is not None:
        _check_chapter(db, act.course_id, data["chapter_id"])
    if "settings" in data and data["settings"] is not None:
        data["settings"] = _normalize_settings(db, act.type, {**(act.settings or {}), **data["settings"]}, user)
    if act.type == "exam":
        data.pop("full_score", None)  # 测试满分由题目决定
    nullable = {"open_at", "close_at", "start_at", "due_at"}
    for k, v in data.items():
        if v is None and k not in nullable:
            continue
        setattr(act, k, v)
    _check_times(act)
    db.commit()
    return activity_detail(db, act)


@router.delete("/activities/{activity_id}")
def delete_activity(activity_id: int, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    act, _ = check_activity(db, user, activity_id, "manager")
    db.delete(act)
    db.commit()
    return {"ok": True}


@router.post("/activities/{activity_id}/move")
def move_activity(activity_id: int, body: MoveIn, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    act, _ = check_activity(db, user, activity_id, "manager")
    siblings = db.scalars(select(Activity).where(Activity.chapter_id == act.chapter_id)).all()
    move(siblings, act, body.direction)
    db.commit()
    return {"ok": True}


@router.post("/courses/{course_id}/activities/batch-publish")
def batch_publish(
    body: BatchPublishIn,
    ctx: CourseCtx = Depends(require_course_member("manager")),
    db: Session = Depends(get_db),
):
    """批量发布/取消发布。发布时可同时设置定时（open_at/close_at）。"""
    acts = db.scalars(
        select(Activity).where(Activity.id.in_(body.ids), Activity.course_id == ctx.course.id)
    ).all()
    if len(acts) != len(set(body.ids)):
        raise HTTPException(400, "部分活动不属于本课程")
    for a in acts:
        a.is_published = body.publish
        if body.publish and "open_at" in body.model_fields_set:
            a.open_at = body.open_at
        if body.publish and "close_at" in body.model_fields_set:
            a.close_at = body.close_at
        _check_times(a)
    db.commit()
    return {"updated": len(acts)}


# ---------------- 学习进度 ----------------
@router.post("/activities/{activity_id}/progress")
def report_progress(
    activity_id: int, body: ProgressIn, user: User = Depends(get_current_user), db: Session = Depends(get_db)
):
    act, role = check_activity(db, user, activity_id)
    if role != "student":
        return {"ignored": True}
    p = db.get(Progress, (act.id, user.id))
    if not p:
        p = Progress(activity_id=act.id, user_id=user.id, watched_seconds=0, last_pos=0, completed=False)
        db.add(p)
    p.watched_seconds = (p.watched_seconds or 0) + body.delta_seconds
    if body.last_pos is not None:
        p.last_pos = body.last_pos
    duration = (act.settings or {}).get("duration_s") or body.duration
    if body.completed and act.type == "material":
        p.completed = True
    if act.type == "video" and duration and p.watched_seconds >= 0.9 * duration:
        p.completed = True
    p.updated_at = utcnow()
    db.commit()
    return {"completed": p.completed, "watched_seconds": p.watched_seconds, "last_pos": p.last_pos}
