"""完成指标：判断学生是否完成某个学习活动。规则由课程设置决定（Course.completion），动态计算。

- 参考资料：打开即完成
- 音视频：累积观看达到 video_percent%（0 表示打开即完成）
- 作业 / 测试：submit = 提交即完成；pass = 计入成绩的得分达到满分的 pass_percent%
"""

from collections import defaultdict

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import Activity, Course, GradeOverride, Progress, Submission
from app.schemas import CompletionSettings
from app.services.scoring import activity_score


def criteria(course: Course) -> dict:
    return CompletionSettings(**(course.completion or {})).model_dump()


def video_done(act: Activity, p: Progress | None, c: dict) -> bool:
    if p is None:
        return False
    pct = c["video_percent"]
    if pct <= 0:
        return True
    duration = (act.settings or {}).get("duration_s") or p.duration
    if not duration:
        return False
    return (p.watched_seconds or 0) >= duration * pct / 100


def completed_activity_ids(db: Session, course: Course, user_id: int, acts: list[Activity]) -> set[int]:
    if not acts:
        return set()
    c = criteria(course)
    ids = [a.id for a in acts]
    progress = {
        p.activity_id: p
        for p in db.scalars(select(Progress).where(Progress.user_id == user_id, Progress.activity_id.in_(ids)))
    }
    subs: dict[int, list[Submission]] = defaultdict(list)
    for s in db.scalars(
        select(Submission).where(
            Submission.user_id == user_id, Submission.activity_id.in_(ids), Submission.status != "draft"
        )
    ):
        subs[s.activity_id].append(s)
    overrides = {
        o.activity_id: o.score
        for o in db.scalars(
            select(GradeOverride).where(GradeOverride.user_id == user_id, GradeOverride.activity_id.in_(ids))
        )
    }

    done: set[int] = set()
    for a in acts:
        if a.type == "material":
            p = progress.get(a.id)
            if p and p.completed:
                done.add(a.id)
        elif a.type == "video":
            if video_done(a, progress.get(a.id), c):
                done.add(a.id)
        else:
            mine = subs.get(a.id, [])
            if c[a.type] == "submit":
                if mine:
                    done.add(a.id)
            else:
                score = overrides.get(a.id)
                if score is None:
                    score = activity_score(a, mine)
                if score is not None and a.full_score and score / a.full_score * 100 >= c["pass_percent"]:
                    done.add(a.id)
    return done
