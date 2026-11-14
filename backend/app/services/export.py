"""导出：成绩表 Excel、作业打包 zip。"""

import io
import re
import zipfile
from collections import defaultdict
from datetime import timezone

from openpyxl import Workbook
from openpyxl.styles import Font
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.config import settings
from app.models import Activity, CourseMember, FileObj, Submission, User
from app.services.scoring import activity_score, submission_status

_STATUS_CN = {"not_submitted": "未提交", "pending": "待批改", "graded": "已批改"}


def _safe(name: str) -> str:
    return re.sub(r'[\\/:*?"<>|]+', "_", name).strip() or "未命名"


def _fmt(dt) -> str:
    return dt.astimezone(timezone.utc).strftime("%Y-%m-%d %H:%M:%S UTC") if dt else ""


def _xlsx_bytes(wb: Workbook) -> bytes:
    buf = io.BytesIO()
    wb.save(buf)
    return buf.getvalue()


def grades_xlsx(table: dict) -> bytes:
    wb = Workbook()
    ws = wb.active
    ws.title = "成绩"
    header = ["学号", "姓名"] + [f"{a['title']}（满分{a['full_score']:g}，占比{a['score_ratio']:g}%）" for a in table["activities"]] + ["总评"]
    ws.append(header)
    for c in ws[1]:
        c.font = Font(bold=True)
    for row in table["rows"]:
        line = [row["user"]["student_no"] or "", row["user"]["name"]]
        for a in table["activities"]:
            line.append(row["cells"][str(a["id"])]["final"])
        line.append(row["total"])
        ws.append(line)
    ws.column_dimensions["A"].width = 14
    ws.column_dimensions["B"].width = 12
    return _xlsx_bytes(wb)


def homework_zip(db: Session, act: Activity) -> bytes:
    students = db.scalars(
        select(User)
        .join(CourseMember, CourseMember.user_id == User.id)
        .where(CourseMember.course_id == act.course_id, CourseMember.role == "student")
        .order_by(User.student_no, User.id)
    ).all()
    subs_by: dict[int, list[Submission]] = defaultdict(list)
    for s in db.scalars(
        select(Submission).where(Submission.activity_id == act.id, Submission.status != "draft").order_by(Submission.attempt_no)
    ):
        subs_by[s.user_id].append(s)
    all_file_ids = {fid for subs in subs_by.values() for s in subs for fid in (s.file_ids or [])}
    files = {f.id: f for f in db.scalars(select(FileObj).where(FileObj.id.in_(all_file_ids)))} if all_file_ids else {}

    wb = Workbook()
    ws = wb.active
    ws.title = "作业汇总"
    ws.append(["学号", "姓名", "状态", "提交次数", "最近提交时间", "得分", "评语"])
    for c in ws[1]:
        c.font = Font(bold=True)

    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as zf:
        for stu in students:
            subs = subs_by.get(stu.id, [])
            latest = subs[-1] if subs else None
            ws.append(
                [
                    stu.student_no or "",
                    stu.name,
                    _STATUS_CN[submission_status(subs)],
                    len(subs),
                    _fmt(latest.submitted_at) if latest else "",
                    activity_score(act, subs),
                    latest.comment if latest else "",
                ]
            )
            if not subs:
                continue
            folder = _safe(f"{stu.student_no or stu.username}_{stu.name}")
            for s in subs:
                prefix = f"{folder}/第{s.attempt_no}次提交"
                if s.content:
                    zf.writestr(f"{prefix}/文本内容.txt", s.content)
                for fid in s.file_ids or []:
                    f = files.get(fid)
                    if not f:
                        continue
                    path = settings.upload_dir / f.path
                    if path.exists():
                        zf.write(path, f"{prefix}/{_safe(f.filename)}")
        zf.writestr("作业汇总.xlsx", _xlsx_bytes(wb))
    return buf.getvalue()
