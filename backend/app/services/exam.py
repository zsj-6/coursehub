"""测试作答流程：开始 → 自动保存 → 交卷（自动判分）→ 教师批改主观题。"""

import random

from fastapi import HTTPException
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.db import utcnow
from app.models import Activity, Submission
from app.services.exam_grader import grade_exam
from app.services.visibility import exam_expired, exam_start_error


def used_attempts(db: Session, act_id: int, user_id: int) -> int:
    return db.scalar(
        select(func.count()).select_from(Submission).where(
            Submission.activity_id == act_id,
            Submission.user_id == user_id,
            Submission.status != "draft",
        )
    ) or 0


def finalize(db: Session, act: Activity, sub: Submission) -> Submission:
    """交卷：客观题判分；没有主观题就直接出分。"""
    auto, per_q, has_subjective = grade_exam(act.questions, sub.answers or {})
    sub.auto_score = auto
    sub.question_scores = per_q
    sub.submitted_at = utcnow()
    if has_subjective:
        sub.status = "submitted"
        sub.score = None
    else:
        sub.status = "graded"
        sub.score = auto
        sub.graded_at = sub.submitted_at
    return sub


def finalize_expired(db: Session, act: Activity, user_id: int | None = None) -> None:
    """把超时还没交的答卷按已保存的答案自动交卷。"""
    q = select(Submission).where(Submission.activity_id == act.id, Submission.status == "draft")
    if user_id is not None:
        q = q.where(Submission.user_id == user_id)
    changed = False
    for sub in db.scalars(q):
        if exam_expired(act, sub):
            finalize(db, act, sub)
            changed = True
    if changed:
        db.commit()


def start(db: Session, act: Activity, user_id: int) -> Submission:
    finalize_expired(db, act, user_id)
    draft = db.scalar(
        select(Submission).where(
            Submission.activity_id == act.id, Submission.user_id == user_id, Submission.status == "draft"
        )
    )
    if draft:
        return draft
    used = used_attempts(db, act.id, user_id)
    err = exam_start_error(act, used)
    if err:
        raise HTTPException(400, err)
    if not act.questions:
        raise HTTPException(400, "该测试还没有题目")
    meta = {}
    if (act.settings or {}).get("shuffle_options"):
        orders = {}
        for q in act.questions:
            if q.type in ("single", "multiple") and q.options:
                idx = list(range(len(q.options)))
                random.shuffle(idx)
                orders[str(q.id)] = idx
        meta["option_orders"] = orders
    sub = Submission(
        activity_id=act.id,
        user_id=user_id,
        attempt_no=used + 1,
        status="draft",
        answers={},
        meta=meta,
        started_at=utcnow(),
    )
    db.add(sub)
    db.commit()
    db.refresh(sub)
    return sub


def apply_manual_grade(act: Activity, sub: Submission, question_scores: dict[str, float]) -> None:
    """教师给主观题打分后重新计算总分；所有主观题都有分时状态变为已批改。"""
    full = {str(q.id): q for q in act.questions}
    merged = dict(sub.question_scores or {})
    for qid, val in question_scores.items():
        q = full.get(qid)
        if q is None:
            raise HTTPException(400, f"题目 {qid} 不在这份试卷中")
        if val < 0 or val > q.score:
            raise HTTPException(400, f"第 {q.sort + 1} 题得分须在 0 ~ {q.score} 之间")
        merged[qid] = val
    sub.question_scores = merged
    if all(merged.get(str(q.id)) is not None for q in act.questions):
        sub.score = round(sum(merged[str(q.id)] for q in act.questions), 2)
        sub.status = "graded"
        sub.graded_at = utcnow()
