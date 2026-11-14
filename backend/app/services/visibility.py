"""学生可见性与可提交规则。所有面向学生的查询都必须走这里。"""

from datetime import datetime, timedelta

from app.db import utcnow
from app.models import Activity, Submission

# 测试到时间后，给前端自动交卷留的网络缓冲
EXAM_GRACE = timedelta(seconds=60)


def is_visible(act: Activity, now: datetime | None = None) -> bool:
    """已发布，且在定时发布的时间段内（open_at/close_at 为空表示不限）。"""
    now = now or utcnow()
    if not act.is_published:
        return False
    if act.open_at and now < act.open_at:
        return False
    if act.close_at and now > act.close_at:
        return False
    return True


def homework_submit_error(act: Activity, used_attempts: int, now: datetime | None = None) -> str | None:
    """能提交作业返回 None，否则返回原因。"""
    now = now or utcnow()
    if not is_visible(act, now):
        return "作业未开放"
    if act.due_at and now > act.due_at:
        return "已过截止时间"
    max_attempts = (act.settings or {}).get("max_attempts", 0)
    if max_attempts and used_attempts >= max_attempts:
        return f"最多只能提交 {max_attempts} 次"
    return None


def exam_start_error(act: Activity, used_attempts: int, now: datetime | None = None) -> str | None:
    """能开始一次新作答返回 None，否则返回原因。"""
    now = now or utcnow()
    if not is_visible(act, now):
        return "测试未开放"
    if act.start_at and now < act.start_at:
        return "测试尚未开始"
    if act.due_at and now > act.due_at:
        return "测试已结束"
    attempts = (act.settings or {}).get("attempts", 1)
    if attempts and used_attempts >= attempts:
        return "作答次数已用完"
    return None


def exam_deadline(act: Activity, sub: Submission) -> datetime | None:
    """一次作答的截止时间：开始时间 + 时长，与测试结束时间取较早者。"""
    candidates = []
    duration = (act.settings or {}).get("duration_min", 0)
    if duration and sub.started_at:
        candidates.append(sub.started_at + timedelta(minutes=duration))
    if act.due_at:
        candidates.append(act.due_at)
    return min(candidates) if candidates else None


def exam_expired(act: Activity, sub: Submission, now: datetime | None = None) -> bool:
    """超过截止时间加缓冲，就不再接受新的答案。"""
    now = now or utcnow()
    deadline = exam_deadline(act, sub)
    return deadline is not None and now > deadline + EXAM_GRACE
