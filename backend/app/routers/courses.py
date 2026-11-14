from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session

from app.db import get_db, utcnow
from app.deps import CourseCtx, check_course, get_current_user, require_course_member, require_role
from app.models import Course, CourseMember, RecentVisit, User
from app.schemas import CourseIn, CourseUpdate, JoinIn, MemberRoleIn, MembersAddIn
from app.serializers import course_out, user_brief
from app.services.course_ops import copy_course_content, new_course_code

router = APIRouter(tags=["课程"])


def _student_counts(db: Session, course_ids: list[int]) -> dict[int, int]:
    if not course_ids:
        return {}
    rows = db.execute(
        select(CourseMember.course_id, func.count())
        .where(CourseMember.course_id.in_(course_ids), CourseMember.role == "student")
        .group_by(CourseMember.course_id)
    )
    return dict(rows.all())


@router.get("/courses")
def list_courses(
    q: str | None = None,
    archived: bool = False,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """我的课程。管理员看到全部课程。q 按课程名或访问码搜索。"""
    if user.role == "admin":
        stmt = select(Course, func.coalesce(CourseMember.role, "teacher")).outerjoin(
            CourseMember, (CourseMember.course_id == Course.id) & (CourseMember.user_id == user.id)
        )
    else:
        stmt = select(Course, CourseMember.role).join(
            CourseMember, (CourseMember.course_id == Course.id) & (CourseMember.user_id == user.id)
        )
    stmt = stmt.where(Course.archived == archived)
    if q:
        like = f"%{q.strip()}%"
        stmt = stmt.where(or_(Course.name.ilike(like), Course.code == q.strip().upper()))
    rows = db.execute(stmt.order_by(Course.created_at.desc())).all()
    counts = _student_counts(db, [c.id for c, _ in rows])
    return [course_out(c, role, counts.get(c.id, 0)) for c, role in rows]


@router.post("/courses")
def create_course(
    body: CourseIn,
    user: User = Depends(require_role("teacher", "admin")),
    db: Session = Depends(get_db),
):
    course = Course(**body.model_dump(), owner_id=user.id, code=new_course_code(db))
    db.add(course)
    db.flush()
    db.add(CourseMember(course_id=course.id, user_id=user.id, role="teacher"))
    db.commit()
    return course_out(course, "teacher", 0)


@router.get("/courses/{course_id}")
def get_course(ctx: CourseCtx = Depends(require_course_member()), db: Session = Depends(get_db)):
    visit = db.get(RecentVisit, (ctx.user.id, ctx.course.id))
    if visit:
        visit.visited_at = utcnow()
    else:
        db.add(RecentVisit(user_id=ctx.user.id, course_id=ctx.course.id))
    db.commit()
    return course_out(ctx.course, ctx.role, _student_counts(db, [ctx.course.id]).get(ctx.course.id, 0))


@router.put("/courses/{course_id}")
def update_course(
    body: CourseUpdate,
    ctx: CourseCtx = Depends(require_course_member("manager")),
    db: Session = Depends(get_db),
):
    for k, v in body.model_dump(exclude_unset=True).items():
        if v is not None or k == "cover":
            setattr(ctx.course, k, v)
    db.commit()
    return course_out(ctx.course, ctx.role)


@router.delete("/courses/{course_id}")
def delete_course(ctx: CourseCtx = Depends(require_course_member("manager")), db: Session = Depends(get_db)):
    if ctx.user.role != "admin" and ctx.course.owner_id != ctx.user.id:
        raise HTTPException(403, "只有课程创建者可以删除课程")
    db.delete(ctx.course)
    db.commit()
    return {"ok": True}


@router.post("/courses/{course_id}/regenerate-code")
def regenerate_code(ctx: CourseCtx = Depends(require_course_member("manager")), db: Session = Depends(get_db)):
    ctx.course.code = new_course_code(db)
    db.commit()
    return {"code": ctx.course.code}


@router.post("/courses/join")
def join_course(body: JoinIn, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    course = db.scalar(select(Course).where(Course.code == body.code.strip().upper()))
    if not course or course.archived:
        raise HTTPException(404, "访问码无效")
    if not db.get(CourseMember, (course.id, user.id)):
        db.add(CourseMember(course_id=course.id, user_id=user.id, role="student"))
        db.commit()
    return course_out(course, (db.get(CourseMember, (course.id, user.id))).role)


@router.post("/courses/{course_id}/copy-to/{target_id}")
def copy_to(
    target_id: int,
    ctx: CourseCtx = Depends(require_course_member("manager")),
    db: Session = Depends(get_db),
):
    if target_id == ctx.course.id:
        raise HTTPException(400, "不能复制到同一门课程")
    target, _ = check_course(db, ctx.user, target_id, "manager")
    n = copy_course_content(db, ctx.course, target)
    db.commit()
    return {"copied_activities": n}


# ---------------- 成员 ----------------
@router.get("/courses/{course_id}/members")
def list_members(ctx: CourseCtx = Depends(require_course_member()), db: Session = Depends(get_db)):
    members = db.scalars(select(CourseMember).where(CourseMember.course_id == ctx.course.id)).all()
    order = {"teacher": 0, "ta": 1, "student": 2}
    members = sorted(members, key=lambda m: (order.get(m.role, 9), m.user.student_no or "", m.user.id))
    return [{"role": m.role, "joined_at": m.joined_at, "user": user_brief(m.user)} for m in members]


@router.post("/courses/{course_id}/members")
def add_members(
    body: MembersAddIn,
    ctx: CourseCtx = Depends(require_course_member("manager")),
    db: Session = Depends(get_db),
):
    added, existed, not_found = [], [], []
    for raw in body.usernames:
        name = raw.strip()
        if not name:
            continue
        u = db.scalar(select(User).where(User.username == name))
        if not u:
            not_found.append(name)
        elif db.get(CourseMember, (ctx.course.id, u.id)):
            existed.append(name)
        else:
            db.add(CourseMember(course_id=ctx.course.id, user_id=u.id, role=body.role))
            added.append(name)
    db.commit()
    return {"added": added, "existed": existed, "not_found": not_found}


def _teacher_count(db: Session, course_id: int) -> int:
    return db.scalar(
        select(func.count()).select_from(CourseMember).where(
            CourseMember.course_id == course_id, CourseMember.role == "teacher"
        )
    ) or 0


@router.put("/courses/{course_id}/members/{user_id}")
def set_member_role(
    user_id: int,
    body: MemberRoleIn,
    ctx: CourseCtx = Depends(require_course_member("manager")),
    db: Session = Depends(get_db),
):
    m = db.get(CourseMember, (ctx.course.id, user_id))
    if not m:
        raise HTTPException(404, "该用户不是课程成员")
    if m.role == "teacher" and body.role != "teacher" and _teacher_count(db, ctx.course.id) <= 1:
        raise HTTPException(400, "课程至少要保留一位教师")
    m.role = body.role
    db.commit()
    return {"ok": True}


@router.delete("/courses/{course_id}/members/{user_id}")
def remove_member(
    user_id: int,
    ctx: CourseCtx = Depends(require_course_member("manager")),
    db: Session = Depends(get_db),
):
    m = db.get(CourseMember, (ctx.course.id, user_id))
    if not m:
        raise HTTPException(404, "该用户不是课程成员")
    if m.role == "teacher" and _teacher_count(db, ctx.course.id) <= 1:
        raise HTTPException(400, "课程至少要保留一位教师")
    db.delete(m)
    db.commit()
    return {"ok": True}
