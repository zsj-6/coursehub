"""课程相关的杂项操作：访问码、排序、复制课程内容。"""

import secrets

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models import Activity, Chapter, Course, Question

_CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"  # 去掉了 0/O/1/I 这类容易看错的字符


def new_course_code(db: Session) -> str:
    while True:
        code = "".join(secrets.choice(_CODE_CHARS) for _ in range(6))
        if not db.scalar(select(Course.id).where(Course.code == code)):
            return code


def next_sort(db: Session, model, **filters) -> int:
    q = select(func.max(model.sort))
    for k, v in filters.items():
        col = getattr(model, k)
        q = q.where(col.is_(None) if v is None else col == v)
    cur = db.scalar(q)
    return 0 if cur is None else cur + 1


def move(siblings: list, item, direction: str) -> None:
    """在同级列表中上移/下移一位，并把 sort 重排成 0..n-1。"""
    items = sorted(siblings, key=lambda x: (x.sort, x.id))
    i = next(idx for idx, x in enumerate(items) if x.id == item.id)
    j = i - 1 if direction == "up" else i + 1
    if 0 <= j < len(items):
        items[i], items[j] = items[j], items[i]
    for idx, x in enumerate(items):
        x.sort = idx


def copy_course_content(db: Session, src: Course, dst: Course) -> int:
    """把 src 的章节、活动、题目复制到 dst 末尾。复制出的活动都是草稿。返回复制的活动数。"""
    base_sort = next_sort(db, Chapter, course_id=dst.id, parent_id=None)
    chapters = db.scalars(select(Chapter).where(Chapter.course_id == src.id)).all()
    mapping: dict[int, int] = {}
    # 先复制章节，再复制单元，保证父节点已存在
    for ch in sorted(chapters, key=lambda c: (c.parent_id is not None, c.sort, c.id)):
        new = Chapter(
            course_id=dst.id,
            parent_id=mapping.get(ch.parent_id) if ch.parent_id else None,
            title=ch.title,
            sort=ch.sort + (base_sort if ch.parent_id is None else 0),
        )
        db.add(new)
        db.flush()
        mapping[ch.id] = new.id

    count = 0
    for a in db.scalars(select(Activity).where(Activity.course_id == src.id)):
        new_act = Activity(
            course_id=dst.id,
            chapter_id=mapping[a.chapter_id],
            type=a.type,
            title=a.title,
            description=a.description,
            sort=a.sort,
            is_published=False,
            full_score=a.full_score,
            score_ratio=a.score_ratio,
            settings=dict(a.settings or {}),
        )
        db.add(new_act)
        db.flush()
        for q in a.questions:
            db.add(
                Question(
                    activity_id=new_act.id,
                    type=q.type,
                    stem=q.stem,
                    options=list(q.options or []),
                    answer=q.answer,
                    score=q.score,
                    analysis=q.analysis,
                    sort=q.sort,
                )
            )
        count += 1
    return count
