"""作业提交与批改、测试题目与作答。"""

from collections import defaultdict
from urllib.parse import quote

from fastapi import APIRouter, Depends, HTTPException, Response
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db import get_db, utcnow
from app.deps import check_activity, check_course, get_current_user
from app.models import Activity, CourseMember, FileObj, GradeOverride, Question, Submission, User
from app.schemas import AnswersIn, GradeIn, HomeworkSubmitIn, QuestionIn, QuestionsIn, SubmitExamIn
from app.serializers import question_for_student, question_full, submission_out, user_brief
from app.services import exam as exam_svc
from app.services import scoring
from app.services.export import homework_zip
from app.services.visibility import exam_deadline, exam_expired, homework_submit_error, score_published

router = APIRouter(tags=["作业与测试"])


def _hide_scores(data: dict) -> dict:
    """成绩未公布时，学生看到的提交里去掉所有分数。"""
    data.update(score=None, auto_score=None, question_scores={}, comment="")
    return data


def _publish_info(act: Activity) -> dict:
    s = act.settings or {}
    return {"score_published": score_published(act), "score_publish": s.get("score_publish", "immediate"), "score_publish_at": s.get("score_publish_at")}


def _require_type(act: Activity, *types: str) -> None:
    if act.type not in types:
        raise HTTPException(400, "该活动不支持此操作")


def _attachment(data: bytes, filename: str, media_type: str) -> Response:
    return Response(
        content=data,
        media_type=media_type,
        headers={"Content-Disposition": f"attachment; filename*=UTF-8''{quote(filename)}"},
    )


# ======================= 题目管理 =======================
def _validate_question(i: int, q: QuestionIn) -> None:
    n = f"第 {i + 1} 题"
    if q.type in ("single", "multiple"):
        if len(q.options) < 2:
            raise HTTPException(400, f"{n}至少需要 2 个选项")
        if any(not str(o).strip() for o in q.options):
            raise HTTPException(400, f"{n}有空选项")
        if q.type == "single":
            if not isinstance(q.answer, int) or not 0 <= q.answer < len(q.options):
                raise HTTPException(400, f"{n}请设置正确答案")
        else:
            if not isinstance(q.answer, list) or not q.answer or any(
                not isinstance(x, int) or not 0 <= x < len(q.options) for x in q.answer
            ):
                raise HTTPException(400, f"{n}请设置正确答案")
    elif q.type == "judge":
        if not isinstance(q.answer, bool):
            raise HTTPException(400, f"{n}请设置正确答案")
    elif q.type == "fill":
        if not isinstance(q.answer, list) or not q.answer or any(not str(x).strip() for x in q.answer):
            raise HTTPException(400, f"{n}请填写每个空的答案")


@router.get("/activities/{activity_id}/questions")
def get_questions(activity_id: int, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    act, _ = check_activity(db, user, activity_id, "grader")
    _require_type(act, "exam")
    return [question_full(q) for q in act.questions]


@router.put("/activities/{activity_id}/questions")
def save_questions(
    activity_id: int, body: QuestionsIn, user: User = Depends(get_current_user), db: Session = Depends(get_db)
):
    """整卷保存：带 id 的题目更新，不带 id 的新增，没出现的删除。满分自动更新为题目分值之和。"""
    act, _ = check_activity(db, user, activity_id, "manager")
    _require_type(act, "exam")
    for i, q in enumerate(body.questions):
        _validate_question(i, q)
    existing = {q.id: q for q in act.questions}
    keep: set[int] = set()
    for i, qin in enumerate(body.questions):
        fields = qin.model_dump(exclude={"id"})
        if qin.type not in ("single", "multiple"):
            fields["options"] = []
        if qin.id and qin.id in existing:
            q = existing[qin.id]
            for k, v in fields.items():
                setattr(q, k, v)
            q.sort = i
            keep.add(q.id)
        else:
            db.add(Question(activity_id=act.id, sort=i, **fields))
    for qid, q in existing.items():
        if qid not in keep:
            db.delete(q)
    act.full_score = round(sum(q.score for q in body.questions), 2)
    db.commit()
    db.refresh(act)
    return [question_full(q) for q in act.questions]


# ======================= 学生：作业 =======================
@router.post("/activities/{activity_id}/submissions")
def submit_homework(
    activity_id: int, body: HomeworkSubmitIn, user: User = Depends(get_current_user), db: Session = Depends(get_db)
):
    act, role = check_activity(db, user, activity_id)
    _require_type(act, "homework")
    if role != "student":
        raise HTTPException(403, "只有学生可以提交作业")
    if not body.content.strip() and not body.file_ids:
        raise HTTPException(400, "请填写内容或上传附件")
    if body.file_ids:
        own = set(db.scalars(select(FileObj.id).where(FileObj.id.in_(body.file_ids), FileObj.owner_id == user.id)))
        if own != set(body.file_ids):
            raise HTTPException(400, "附件不存在")
    used = exam_svc.used_attempts(db, act.id, user.id)
    err = homework_submit_error(act, used)
    if err:
        raise HTTPException(400, err)
    sub = Submission(
        activity_id=act.id,
        user_id=user.id,
        attempt_no=used + 1,
        content=body.content,
        file_ids=body.file_ids,
        status="submitted",
        submitted_at=utcnow(),
    )
    db.add(sub)
    db.commit()
    return submission_out(db, sub)


@router.get("/activities/{activity_id}/submissions/mine")
def my_submissions(activity_id: int, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    act, _ = check_activity(db, user, activity_id)
    _require_type(act, "homework", "exam")
    if act.type == "exam":
        exam_svc.finalize_expired(db, act, user.id)
    subs = db.scalars(
        select(Submission)
        .where(Submission.activity_id == act.id, Submission.user_id == user.id)
        .order_by(Submission.attempt_no)
    ).all()
    real = [s for s in subs if s.status != "draft"]
    draft = next((s for s in subs if s.status == "draft"), None)
    info = _publish_info(act)
    items = [submission_out(db, s, include_user=False) for s in real]
    if not info["score_published"]:
        items = [_hide_scores(x) for x in items]
    return {
        "submissions": items,
        "draft_id": draft.id if draft else None,
        "status": scoring.submission_status(real),
        "score": scoring.activity_score(act, real) if info["score_published"] else None,
        "attempts_used": len(real),
        **info,
    }


# ======================= 学生：测试 =======================
def _exam_paper(act: Activity, sub: Submission) -> dict:
    orders = (sub.meta or {}).get("option_orders", {})
    return {
        "submission_id": sub.id,
        "attempt_no": sub.attempt_no,
        "started_at": sub.started_at,
        "deadline": exam_deadline(act, sub),
        "server_now": utcnow(),
        "answers": sub.answers or {},
        "questions": [question_for_student(q, orders.get(str(q.id))) for q in act.questions],
    }


@router.post("/activities/{activity_id}/exam/start")
def start_exam(activity_id: int, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """开始作答；如果有未交的答卷，返回那一份（刷新页面可以继续作答）。"""
    act, role = check_activity(db, user, activity_id)
    _require_type(act, "exam")
    if role != "student":
        raise HTTPException(403, "只有学生可以参加测试")
    sub = exam_svc.start(db, act, user.id)
    return _exam_paper(act, sub)


def _load_own_draft(db: Session, user: User, submission_id: int) -> tuple[Activity, Submission]:
    sub = db.get(Submission, submission_id)
    if not sub or sub.user_id != user.id:
        raise HTTPException(404, "答卷不存在")
    act, _ = check_activity(db, user, sub.activity_id)
    if sub.status != "draft":
        raise HTTPException(400, "这份答卷已经交过了")
    return act, sub


@router.put("/submissions/{submission_id}/answers")
def autosave_answers(
    submission_id: int, body: AnswersIn, user: User = Depends(get_current_user), db: Session = Depends(get_db)
):
    act, sub = _load_own_draft(db, user, submission_id)
    if exam_expired(act, sub):
        exam_svc.finalize(db, act, sub)
        db.commit()
        raise HTTPException(400, "作答时间已到，已自动交卷")
    sub.answers = body.answers
    db.commit()
    return {"saved_at": utcnow()}


@router.post("/submissions/{submission_id}/submit")
def submit_exam(
    submission_id: int, body: SubmitExamIn, user: User = Depends(get_current_user), db: Session = Depends(get_db)
):
    act, sub = _load_own_draft(db, user, submission_id)
    if body.answers is not None and not exam_expired(act, sub):
        sub.answers = body.answers  # 超时后提交的答案不采用，按最后一次自动保存的答案交卷
    exam_svc.finalize(db, act, sub)
    db.commit()
    data = submission_out(db, sub, include_user=False)
    return data if score_published(act) else _hide_scores(data)


# ======================= 查看单份提交 =======================
@router.get("/submissions/{submission_id}")
def get_submission(submission_id: int, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """学生看自己的；教师/助教看本课程的。测试会附带题目，满足条件时附带答案。"""
    sub = db.get(Submission, submission_id)
    if not sub:
        raise HTTPException(404, "提交不存在")
    act = db.get(Activity, sub.activity_id)
    _, role = check_course(db, user, act.course_id)
    if role == "student" and sub.user_id != user.id:
        raise HTTPException(404, "提交不存在")
    data = submission_out(db, sub)
    hide = role == "student" and not score_published(act)
    if hide:
        _hide_scores(data)
    data.update(_publish_info(act))
    if act.type == "exam":
        # 学生要等成绩公布后、且老师允许时才能看到答案和解析
        show_answer = role != "student" or (
            sub.status != "draft" and not hide and (act.settings or {}).get("show_answer", True)
        )
        questions = []
        for q in act.questions:
            item = question_full(q)
            if not show_answer:
                item["answer"] = None
                item["analysis"] = ""
            if q.type == "fill":
                item["blank_count"] = len(q.answer) if isinstance(q.answer, list) else 1
            item["given"] = (sub.answers or {}).get(str(q.id))
            item["got"] = None if hide else (sub.question_scores or {}).get(str(q.id))
            questions.append(item)
        data["questions"] = questions
        data["show_answer"] = show_answer
    return data


# ======================= 教师：批改 =======================
@router.get("/activities/{activity_id}/submissions")
def list_submissions(
    activity_id: int,
    submit_status: str | None = None,  # submitted | not_submitted
    grade_status: str | None = None,  # pending | graded
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """按学生列出：每人一行（含未提交的），用于批改页左侧和作业/测试详情列表。"""
    act, _ = check_activity(db, user, activity_id, "grader")
    _require_type(act, "homework", "exam")
    if act.type == "exam":
        exam_svc.finalize_expired(db, act)
    students = db.scalars(
        select(User)
        .join(CourseMember, CourseMember.user_id == User.id)
        .where(CourseMember.course_id == act.course_id, CourseMember.role == "student")
        .order_by(User.student_no, User.id)
    ).all()
    subs_by: dict[int, list[Submission]] = defaultdict(list)
    for s in db.scalars(
        select(Submission)
        .where(Submission.activity_id == act.id, Submission.status != "draft")
        .order_by(Submission.attempt_no)
    ):
        subs_by[s.user_id].append(s)
    overrides = {
        o.user_id: o.score
        for o in db.scalars(select(GradeOverride).where(GradeOverride.activity_id == act.id))
    }

    rows = []
    for stu in students:
        subs = subs_by.get(stu.id, [])
        status = scoring.submission_status(subs)
        if submit_status == "submitted" and status == "not_submitted":
            continue
        if submit_status == "not_submitted" and status != "not_submitted":
            continue
        if grade_status and status != grade_status:
            continue
        raw = scoring.activity_score(act, subs)
        latest = subs[-1] if subs else None
        rows.append(
            {
                "user": user_brief(stu),
                "status": status,
                "attempts": len(subs),
                "submission_ids": [s.id for s in subs],
                "latest_submitted_at": latest.submitted_at if latest else None,
                "score": raw,
                "override": overrides.get(stu.id),
                "final": overrides.get(stu.id, raw),
            }
        )
    return {"activity_id": act.id, "full_score": act.full_score, "rows": rows}


@router.put("/submissions/{submission_id}/grade")
def grade_submission(
    submission_id: int, body: GradeIn, user: User = Depends(get_current_user), db: Session = Depends(get_db)
):
    sub = db.get(Submission, submission_id)
    if not sub or sub.status == "draft":
        raise HTTPException(404, "提交不存在")
    act, _ = check_activity(db, user, sub.activity_id, "grader")
    if body.score is None and body.comment is None and not body.question_scores:
        raise HTTPException(400, "请至少填写成绩或评语其中一项")
    if body.comment is not None:
        sub.comment = body.comment
    if act.type == "exam" and body.question_scores:
        exam_svc.apply_manual_grade(act, sub, body.question_scores)
    if body.score is not None:
        if act.full_score and body.score > act.full_score:
            raise HTTPException(400, f"得分不能超过满分 {act.full_score:g}")
        sub.score = body.score
        sub.status = "graded"
        sub.graded_at = utcnow()
    db.commit()
    return submission_out(db, sub)


@router.get("/activities/{activity_id}/export.zip")
def export_homework(activity_id: int, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    act, _ = check_activity(db, user, activity_id, "grader")
    _require_type(act, "homework")
    return _attachment(homework_zip(db, act), f"{act.title}.zip", "application/zip")
