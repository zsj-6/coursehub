"""成绩计算。成绩规则只在这里实现，其他地方都调用这里。

- 作业：按 score_rule 在已批改的提交中取 最后一次 / 最高 / 平均
- 测试：在已出分的答卷中取最高分
- 课程总评 = Σ(活动得分 ÷ 活动满分 × 成绩占比)，缺考/未交按 0 分
- 教师手动修改（GradeOverride）优先于计算值
"""

from collections import defaultdict
from statistics import mean

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import Activity, Chapter, Course, CourseMember, GradeOverride, Submission, User

GRADED_TYPES = ("homework", "exam")


def activity_score(act: Activity, subs: list[Submission]) -> float | None:
    """单个学生在单个活动上的得分；没有已出分的提交时返回 None。"""
    graded = [s for s in sorted(subs, key=lambda s: s.attempt_no) if s.status == "graded" and s.score is not None]
    if not graded:
        return None
    scores = [s.score for s in graded]
    if act.type == "exam":
        return max(scores)
    rule = (act.settings or {}).get("score_rule", "last")
    if rule == "max":
        return max(scores)
    if rule == "avg":
        return round(mean(scores), 2)
    return scores[-1]


def course_total(acts: list[Activity], scores: dict[int, float | None]) -> float:
    total = 0.0
    for a in acts:
        if a.full_score and a.full_score > 0 and a.score_ratio:
            total += (scores.get(a.id) or 0) / a.full_score * a.score_ratio
    return round(total, 2)


def submission_status(subs: list[Submission]) -> str:
    """not_submitted | pending（有待批改）| graded（全部已批改）"""
    real = [s for s in subs if s.status != "draft"]
    if not real:
        return "not_submitted"
    if any(s.status == "submitted" for s in real):
        return "pending"
    return "graded"


def graded_activities(db: Session, course_id: int) -> list[Activity]:
    """参与计分的活动，按课程目录顺序。"""
    chapters = {c.id: c for c in db.scalars(select(Chapter).where(Chapter.course_id == course_id))}

    def chapter_key(cid: int) -> tuple:
        c = chapters.get(cid)
        if not c:
            return (0, 0, 0, 0)
        if c.parent_id is None:
            return (c.sort, c.id, -1, 0)
        p = chapters.get(c.parent_id)
        return ((p.sort, p.id) if p else (0, 0)) + (c.sort, c.id)

    acts = db.scalars(
        select(Activity).where(Activity.course_id == course_id, Activity.type.in_(GRADED_TYPES))
    ).all()
    return sorted(acts, key=lambda a: (chapter_key(a.chapter_id), a.sort, a.id))


def grade_table(db: Session, course: Course, only_user_id: int | None = None) -> dict:
    """only_user_id 给学生用：只返回本人一行，并且隐藏未发布的活动。"""
    acts = graded_activities(db, course.id)
    if only_user_id is not None:
        acts = [a for a in acts if a.is_published]
    act_ids = [a.id for a in acts]

    q = (
        select(User)
        .join(CourseMember, CourseMember.user_id == User.id)
        .where(CourseMember.course_id == course.id, CourseMember.role == "student")
        .order_by(User.student_no, User.id)
    )
    if only_user_id is not None:
        q = q.where(User.id == only_user_id)
    students = db.scalars(q).all()
    student_ids = [s.id for s in students]

    subs_by: dict[tuple[int, int], list[Submission]] = defaultdict(list)
    if act_ids and student_ids:
        for s in db.scalars(
            select(Submission).where(
                Submission.activity_id.in_(act_ids),
                Submission.user_id.in_(student_ids),
                Submission.status != "draft",
            )
        ):
            subs_by[(s.user_id, s.activity_id)].append(s)

    overrides: dict[tuple[int, int | None], float] = {
        (o.user_id, o.activity_id): o.score
        for o in db.scalars(select(GradeOverride).where(GradeOverride.course_id == course.id))
    }

    rows = []
    for stu in students:
        cells = {}
        finals: dict[int, float | None] = {}
        for a in acts:
            subs = subs_by.get((stu.id, a.id), [])
            raw = activity_score(a, subs)
            ov = overrides.get((stu.id, a.id))
            final = ov if ov is not None else raw
            finals[a.id] = final
            cells[str(a.id)] = {
                "raw": raw,
                "override": ov,
                "final": final,
                "status": submission_status(subs),
            }
        calc = course_total(acts, finals)
        total_ov = overrides.get((stu.id, None))
        rows.append(
            {
                "user": {"id": stu.id, "name": stu.name, "username": stu.username, "student_no": stu.student_no},
                "cells": cells,
                "total_calc": calc,
                "total_override": total_ov,
                "total": total_ov if total_ov is not None else calc,
            }
        )

    return {
        "activities": [
            {
                "id": a.id,
                "title": a.title,
                "type": a.type,
                "full_score": a.full_score,
                "score_ratio": a.score_ratio,
                "is_published": a.is_published,
            }
            for a in acts
        ],
        "ratio_sum": round(sum(a.score_ratio for a in acts), 2),
        "rows": rows,
    }
