from urllib.parse import quote

from fastapi import APIRouter, Depends, HTTPException, Response
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db import get_db
from app.deps import CourseCtx, require_course_member
from app.models import Activity, CourseMember, GradeOverride
from app.schemas import OverrideIn, ScoreRatiosIn
from app.services.export import grades_xlsx
from app.services.scoring import grade_table, graded_activities

router = APIRouter(tags=["成绩"])


@router.get("/courses/{course_id}/grades")
def get_grades(ctx: CourseCtx = Depends(require_course_member()), db: Session = Depends(get_db)):
    """教师/助教看全班；学生只看到自己这一行。"""
    if ctx.is_student:
        return grade_table(db, ctx.course, only_user_id=ctx.user.id)
    return grade_table(db, ctx.course)


def _ratios_out(acts) -> dict:
    total = round(sum(a.score_ratio for a in acts), 2)
    return {
        "items": [
            {"id": a.id, "title": a.title, "type": a.type, "full_score": a.full_score, "score_ratio": a.score_ratio, "is_published": a.is_published}
            for a in acts
        ],
        "total": total,
        "left": round(max(100 - total, 0), 2),
    }


@router.get("/courses/{course_id}/score-ratios")
def get_score_ratios(ctx: CourseCtx = Depends(require_course_member("grader")), db: Session = Depends(get_db)):
    """作业、测试的成绩占比一览，以及剩余可分配比例。"""
    return _ratios_out(graded_activities(db, ctx.course.id))


@router.put("/courses/{course_id}/score-ratios")
def set_score_ratios(
    body: ScoreRatiosIn,
    ctx: CourseCtx = Depends(require_course_member("manager")),
    db: Session = Depends(get_db),
):
    """成绩比例设定：一次调整多个活动的占比，合计不能超过 100%。"""
    acts = graded_activities(db, ctx.course.id)
    by_id = {a.id: a for a in acts}
    for aid, ratio in body.ratios.items():
        if aid not in by_id:
            raise HTTPException(400, "部分活动不属于本课程或不计分")
        if ratio < 0 or ratio > 100:
            raise HTTPException(400, "成绩占比须在 0 ~ 100 之间")
    total = sum(body.ratios.get(a.id, a.score_ratio) for a in acts)
    if total > 100 + 1e-6:
        raise HTTPException(400, f"成绩占比合计为 {total:g}%，不能超过 100%")
    for aid, ratio in body.ratios.items():
        by_id[aid].score_ratio = ratio
    db.commit()
    return _ratios_out(acts)


@router.put("/courses/{course_id}/grades/override")
def set_override(
    body: OverrideIn,
    ctx: CourseCtx = Depends(require_course_member("grader")),
    db: Session = Depends(get_db),
):
    m = db.get(CourseMember, (ctx.course.id, body.user_id))
    if not m or m.role != "student":
        raise HTTPException(400, "该学生不在本课程中")
    if body.activity_id is not None:
        act = db.get(Activity, body.activity_id)
        if not act or act.course_id != ctx.course.id or act.type not in ("homework", "exam"):
            raise HTTPException(400, "活动不存在")
        if body.score is not None and act.full_score and body.score > act.full_score:
            raise HTTPException(400, f"得分不能超过满分 {act.full_score:g}")
    elif body.score is not None and body.score > 100:
        raise HTTPException(400, "总评不能超过 100")

    stmt = select(GradeOverride).where(
        GradeOverride.course_id == ctx.course.id, GradeOverride.user_id == body.user_id
    )
    stmt = stmt.where(
        GradeOverride.activity_id.is_(None) if body.activity_id is None else GradeOverride.activity_id == body.activity_id
    )
    ov = db.scalar(stmt)
    if body.score is None:
        if ov:
            db.delete(ov)
    elif ov:
        ov.score = body.score
    else:
        db.add(GradeOverride(course_id=ctx.course.id, user_id=body.user_id, activity_id=body.activity_id, score=body.score))
    db.commit()
    return {"ok": True}


@router.get("/courses/{course_id}/grades/export.xlsx")
def export_grades(ctx: CourseCtx = Depends(require_course_member("grader")), db: Session = Depends(get_db)):
    data = grades_xlsx(grade_table(db, ctx.course))
    return Response(
        content=data,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f"attachment; filename*=UTF-8''{quote(ctx.course.name + '-成绩.xlsx')}"},
    )
