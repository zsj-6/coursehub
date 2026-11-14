"""首页：动态、待办、最近访问、统计。"""

from collections import defaultdict
from datetime import timedelta

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db import get_db, utcnow
from app.deps import get_current_user
from app.models import Activity, Course, CourseMember, RecentVisit, Submission, User
from app.serializers import course_out
from app.services.scoring import submission_status
from app.services.visibility import is_visible

router = APIRouter(tags=["首页"])

FEED_DAYS = 14


def _act_ref(a: Activity, course: Course) -> dict:
    return {
        "activity": {"id": a.id, "type": a.type, "title": a.title, "due_at": a.due_at, "start_at": a.start_at},
        "course": {"id": course.id, "name": course.name},
    }


@router.get("/dashboard")
def dashboard(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    now = utcnow()
    since = now - timedelta(days=FEED_DAYS)

    memberships = db.execute(
        select(Course, CourseMember.role)
        .join(CourseMember, CourseMember.course_id == Course.id)
        .where(CourseMember.user_id == user.id, Course.archived.is_(False))
    ).all()
    courses = {c.id: c for c, _ in memberships}
    teach_ids = [c.id for c, r in memberships if r in ("teacher", "ta")]
    learn_ids = [c.id for c, r in memberships if r == "student"]

    recent = db.execute(
        select(Course)
        .join(RecentVisit, RecentVisit.course_id == Course.id)
        .join(CourseMember, (CourseMember.course_id == Course.id) & (CourseMember.user_id == user.id))
        .where(RecentVisit.user_id == user.id, Course.archived.is_(False))
        .order_by(RecentVisit.visited_at.desc())
        .limit(6)
    ).scalars().all()

    feed: list[dict] = []
    todos: list[dict] = []

    # ---------- 作为学生 ----------
    if learn_ids:
        acts = [
            a
            for a in db.scalars(select(Activity).where(Activity.course_id.in_(learn_ids)))
            if is_visible(a, now)
        ]
        mine = defaultdict(list)
        for s in db.scalars(
            select(Submission).where(
                Submission.user_id == user.id,
                Submission.activity_id.in_([a.id for a in acts] or [0]),
                Submission.status != "draft",
            )
        ):
            mine[s.activity_id].append(s)
        for a in acts:
            c = courses[a.course_id]
            opened = a.open_at or a.created_at
            if opened >= since:
                feed.append({"kind": "opened", "time": opened, **_act_ref(a, c)})
            if a.type in ("homework", "exam"):
                subs = mine.get(a.id, [])
                if not subs and a.due_at and a.due_at >= now:
                    todos.append({"kind": "todo", "time": a.due_at, **_act_ref(a, c)})
                for s in subs:
                    if s.status == "graded" and s.graded_at and s.graded_at >= since:
                        feed.append({"kind": "graded", "time": s.graded_at, "score": s.score, **_act_ref(a, c)})

    # ---------- 作为教师/助教 ----------
    if teach_ids:
        acts = db.scalars(
            select(Activity).where(Activity.course_id.in_(teach_ids), Activity.type.in_(("homework", "exam")))
        ).all()
        students_by_course = defaultdict(set)
        for cid, uid in db.execute(
            select(CourseMember.course_id, CourseMember.user_id).where(
                CourseMember.course_id.in_(teach_ids), CourseMember.role == "student"
            )
        ):
            students_by_course[cid].add(uid)
        subs_by = defaultdict(lambda: defaultdict(list))
        for s in db.scalars(
            select(Submission).where(
                Submission.activity_id.in_([a.id for a in acts] or [0]), Submission.status != "draft"
            )
        ):
            subs_by[s.activity_id][s.user_id].append(s)
        for a in acts:
            c = courses[a.course_id]
            per_user = subs_by.get(a.id, {})
            pending = sum(submission_status(v) == "pending" for v in per_user.values())
            if pending:
                todos.append({"kind": "to_grade", "time": a.due_at, "pending": pending, **_act_ref(a, c)})
            recent_subs = [s for v in per_user.values() for s in v if s.submitted_at and s.submitted_at >= since]
            if recent_subs:
                feed.append(
                    {
                        "kind": "submissions",
                        "time": max(s.submitted_at for s in recent_subs),
                        "count": len(recent_subs),
                        **_act_ref(a, c),
                    }
                )
            if a.is_published and a.due_at and since <= a.due_at <= now:
                missing = len(students_by_course[a.course_id] - set(per_user.keys()))
                if missing:
                    feed.append({"kind": "missing", "time": a.due_at, "missing": missing, **_act_ref(a, c)})

    feed.sort(key=lambda x: x["time"], reverse=True)
    todos.sort(key=lambda x: (x["time"] is None, x["time"] or now))

    return {
        "stats": {
            "teaching_courses": len(teach_ids),
            "learning_courses": len(learn_ids),
        },
        "recent_courses": [course_out(c) for c in recent],
        "todos": todos,
        "feed": feed[:30],
    }
