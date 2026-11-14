"""课程公告、活动讨论区、学习分析。"""

from collections import defaultdict

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.db import get_db, utcnow
from app.deps import CourseCtx, check_activity, check_course, get_current_user, require_course_member
from app.models import Activity, Announcement, CourseMember, Post, PostLike, Progress, User
from app.schemas import AnnouncementIn, PostIn
from app.serializers import user_brief
from app.services.completion import completed_activity_ids
from app.services.visibility import announcement_visible, is_visible

router = APIRouter(tags=["公告与讨论"])


# ---------- 公告 ----------
def announcement_out(a: Announcement, now=None) -> dict:
    return {
        "id": a.id,
        "course_id": a.course_id,
        "title": a.title,
        "content": a.content,
        "open_at": a.open_at,
        "close_at": a.close_at,
        "pinned": a.pinned,
        "created_at": a.created_at,
        "author": user_brief(a.author) if a.author else None,
        "visible": announcement_visible(a, now),
    }


def _check_times(open_at, close_at) -> None:
    if open_at and close_at and close_at <= open_at:
        raise HTTPException(400, "截止时间必须晚于开放时间")


@router.get("/courses/{course_id}/announcements")
def list_announcements(ctx: CourseCtx = Depends(require_course_member()), db: Session = Depends(get_db)):
    now = utcnow()
    items = db.scalars(
        select(Announcement)
        .where(Announcement.course_id == ctx.course.id)
        .order_by(Announcement.pinned.desc(), Announcement.created_at.desc())
    ).all()
    if ctx.is_student:
        items = [a for a in items if announcement_visible(a, now)]
    return [announcement_out(a, now) for a in items]


@router.post("/courses/{course_id}/announcements")
def create_announcement(
    body: AnnouncementIn, ctx: CourseCtx = Depends(require_course_member("manager")), db: Session = Depends(get_db)
):
    _check_times(body.open_at, body.close_at)
    a = Announcement(course_id=ctx.course.id, author_id=ctx.user.id, **body.model_dump())
    db.add(a)
    db.commit()
    db.refresh(a)
    return announcement_out(a)


def _load_announcement(db: Session, user: User, aid: int) -> Announcement:
    a = db.get(Announcement, aid)
    if not a:
        raise HTTPException(404, "公告不存在")
    check_course(db, user, a.course_id, "manager")
    return a


@router.put("/announcements/{aid}")
def update_announcement(
    aid: int, body: AnnouncementIn, user: User = Depends(get_current_user), db: Session = Depends(get_db)
):
    a = _load_announcement(db, user, aid)
    _check_times(body.open_at, body.close_at)
    for k, v in body.model_dump().items():
        setattr(a, k, v)
    db.commit()
    db.refresh(a)
    return announcement_out(a)


@router.delete("/announcements/{aid}")
def delete_announcement(aid: int, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    db.delete(_load_announcement(db, user, aid))
    db.commit()
    return {"ok": True}


# ---------- 活动讨论区 ----------
def _roles(db: Session, course_id: int) -> dict[int, str]:
    return dict(db.execute(select(CourseMember.user_id, CourseMember.role).where(CourseMember.course_id == course_id)).all())


@router.get("/activities/{activity_id}/posts")
def list_posts(activity_id: int, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    act, role = check_activity(db, user, activity_id)
    posts = db.scalars(select(Post).where(Post.activity_id == act.id).order_by(Post.created_at)).all()
    ids = [p.id for p in posts] or [0]
    likes = dict(
        db.execute(select(PostLike.post_id, func.count()).where(PostLike.post_id.in_(ids)).group_by(PostLike.post_id)).all()
    )
    mine = set(db.scalars(select(PostLike.post_id).where(PostLike.post_id.in_(ids), PostLike.user_id == user.id)))
    roles = _roles(db, act.course_id)
    can_moderate = role in ("teacher", "ta")

    def out(p: Post) -> dict:
        r = "admin" if p.user.role == "admin" else roles.get(p.user_id, "student")
        return {
            "id": p.id,
            "parent_id": p.parent_id,
            "content": p.content,
            "pinned": p.pinned,
            "created_at": p.created_at,
            "user": user_brief(p.user),
            "user_role": r,
            "likes": likes.get(p.id, 0),
            "liked": p.id in mine,
            "can_delete": can_moderate or p.user_id == user.id,
        }

    replies = defaultdict(list)
    for p in posts:
        if p.parent_id:
            replies[p.parent_id].append(out(p))
    roots = [dict(out(p), replies=replies.get(p.id, [])) for p in posts if not p.parent_id]
    roots.sort(key=lambda x: (not x["pinned"], -x["created_at"].timestamp()))
    return {"items": roots, "can_moderate": can_moderate}


@router.post("/activities/{activity_id}/posts")
def create_post(activity_id: int, body: PostIn, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    act, _ = check_activity(db, user, activity_id)
    parent_id = None
    if body.parent_id:
        parent = db.get(Post, body.parent_id)
        if not parent or parent.activity_id != act.id:
            raise HTTPException(400, "回复的帖子不存在")
        parent_id = parent.parent_id or parent.id  # 回复的回复挂到主帖下，只保留两级
    p = Post(activity_id=act.id, user_id=user.id, parent_id=parent_id, content=body.content.strip())
    db.add(p)
    db.commit()
    return {"id": p.id}


def _load_post(db: Session, user: User, post_id: int, level: str = "member") -> tuple[Post, str]:
    p = db.get(Post, post_id)
    if not p:
        raise HTTPException(404, "帖子不存在")
    _, role = check_activity(db, user, p.activity_id, level)  # type: ignore[arg-type]
    return p, role


@router.post("/posts/{post_id}/like")
def toggle_like(post_id: int, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    p, _ = _load_post(db, user, post_id)
    like = db.get(PostLike, (p.id, user.id))
    if like:
        db.delete(like)
    else:
        db.add(PostLike(post_id=p.id, user_id=user.id))
    db.commit()
    return {"liked": not like}


@router.post("/posts/{post_id}/pin")
def toggle_pin(post_id: int, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    p, _ = _load_post(db, user, post_id, "grader")
    if p.parent_id:
        raise HTTPException(400, "只能置顶主帖")
    p.pinned = not p.pinned
    db.commit()
    return {"pinned": p.pinned}


@router.delete("/posts/{post_id}")
def delete_post(post_id: int, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    p, role = _load_post(db, user, post_id)
    if p.user_id != user.id and role not in ("teacher", "ta"):
        raise HTTPException(403, "只能删除自己的帖子")
    db.delete(p)
    db.commit()
    return {"ok": True}


# ---------- 学习分析 ----------
@router.get("/courses/{course_id}/analytics")
def analytics(ctx: CourseCtx = Depends(require_course_member("grader")), db: Session = Depends(get_db)):
    """完成度表格（学生 × 已发布活动）和视频观看进度。完成规则见 services/completion.py。"""
    now = utcnow()
    acts = [
        a
        for a in db.scalars(select(Activity).where(Activity.course_id == ctx.course.id).order_by(Activity.chapter_id, Activity.sort))
        if is_visible(a, now)
    ]
    students = db.scalars(
        select(User)
        .join(CourseMember, CourseMember.user_id == User.id)
        .where(CourseMember.course_id == ctx.course.id, CourseMember.role == "student")
        .order_by(User.student_no, User.id)
    ).all()
    video_ids = [a.id for a in acts if a.type == "video"]
    progress = {
        (p.activity_id, p.user_id): p
        for p in db.scalars(select(Progress).where(Progress.activity_id.in_(video_ids or [0])))
    }

    rows = []
    done_count: dict[int, int] = defaultdict(int)
    for s in students:
        done = completed_activity_ids(db, ctx.course, s.id, acts)
        for aid in done:
            done_count[aid] += 1
        videos = {}
        for a in acts:
            if a.type != "video":
                continue
            p = progress.get((a.id, s.id))
            duration = (a.settings or {}).get("duration_s") or (p.duration if p else 0)
            pct = min(100, round((p.watched_seconds / duration) * 100)) if p and duration else 0
            videos[a.id] = pct
        rows.append(
            {
                "user": user_brief(s),
                "done": sorted(done),
                "rate": round(len(done) / len(acts) * 100) if acts else 0,
                "video_percent": videos,
            }
        )
    n = len(students) or 1
    return {
        "activities": [
            {"id": a.id, "type": a.type, "title": a.title, "done_rate": round(done_count[a.id] / n * 100)} for a in acts
        ],
        "rows": rows,
        "avg_rate": round(sum(r["rate"] for r in rows) / n) if rows else 0,
    }
