"""重建演示数据：会删除现有数据库和上传目录。

运行：uv run python seed.py
账号：admin/admin123，teacher1、teacher2/123456，student1..student30/123456
"""

import random
import secrets
import shutil
from datetime import timedelta

from app.config import settings
from app.db import SessionLocal, engine, init_db, utcnow
from app.models import (
    Activity,
    Chapter,
    Course,
    CourseMember,
    FileObj,
    Progress,
    Question,
    RecentVisit,
    Submission,
    User,
)
from app.security import hash_password
from app.services import exam as exam_svc
from app.services.course_ops import new_course_code

random.seed(42)
NOW = utcnow()
DAY = timedelta(days=1)
SAMPLE_VIDEO = "https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4"

SURNAMES = "王李张刘陈杨黄赵吴周徐孙马朱胡郭何林罗高"
GIVEN = ["子涵", "浩然", "一诺", "梓轩", "欣怡", "宇航", "思远", "雨桐", "俊杰", "诗琪", "嘉怡", "明轩", "若曦", "博文", "佳琪"]


def make_pdf(lines: list[str]) -> bytes:
    """生成一个只含英文文字的最小 PDF（不依赖第三方库）。"""
    text = "BT /F1 16 Tf 60 780 Td 22 TL " + " ".join(
        f"({ln.replace('(', '[').replace(')', ']')}) Tj T*" for ln in lines
    ) + " ET"
    objs = [
        b"<< /Type /Catalog /Pages 2 0 R >>",
        b"<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
        b"<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>",
        f"<< /Length {len(text)} >>\nstream\n{text}\nendstream".encode(),
        b"<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
    ]
    out = bytearray(b"%PDF-1.4\n")
    offsets = []
    for i, body in enumerate(objs, start=1):
        offsets.append(len(out))
        out += f"{i} 0 obj\n".encode() + body + b"\nendobj\n"
    xref = len(out)
    out += f"xref\n0 {len(objs) + 1}\n0000000000 65535 f \n".encode()
    for off in offsets:
        out += f"{off:010d} 00000 n \n".encode()
    out += f"trailer\n<< /Size {len(objs) + 1} /Root 1 0 R >>\nstartxref\n{xref}\n%%EOF\n".encode()
    return bytes(out)


def save_file(db, owner: User, filename: str, data: bytes, mime: str) -> FileObj:
    key = secrets.token_hex(16)
    rel = f"{key[:2]}/{key}{'.' + filename.rsplit('.', 1)[-1] if '.' in filename else ''}"
    path = settings.upload_dir / rel
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(data)
    f = FileObj(key=key, owner_id=owner.id, filename=filename, path=rel, mime=mime, size=len(data))
    db.add(f)
    db.flush()
    return f


def reset() -> None:
    db_path = settings.database_url.removeprefix("sqlite:///")
    engine.dispose()
    if settings.database_url.startswith("sqlite"):
        from pathlib import Path

        Path(db_path).unlink(missing_ok=True)
    shutil.rmtree(settings.upload_dir, ignore_errors=True)
    init_db()


def create_users(db):
    pw = hash_password("123456", rounds=10)
    admin = User(username="admin", password_hash=hash_password("admin123", rounds=10), name="系统管理员", role="admin")
    t1 = User(username="teacher1", password_hash=pw, name="陈老师", role="teacher")
    t2 = User(username="teacher2", password_hash=pw, name="林老师", role="teacher")
    students = []
    for i in range(1, 31):
        name = random.choice(SURNAMES) + random.choice(GIVEN)
        students.append(
            User(username=f"student{i}", password_hash=pw, name=name, role="student", student_no=f"2024{i:04d}")
        )
    db.add_all([admin, t1, t2, *students])
    db.flush()
    return admin, t1, t2, students


def add_chapter(db, course, title, sort, parent=None):
    ch = Chapter(course_id=course.id, parent_id=parent.id if parent else None, title=title, sort=sort)
    db.add(ch)
    db.flush()
    return ch


def add_activity(db, course, chapter, sort, **kw):
    a = Activity(course_id=course.id, chapter_id=chapter.id, sort=sort, **kw)
    db.add(a)
    db.flush()
    return a


EXAM_QUESTIONS = [
    dict(type="single", stem="栈的特点是？", options=["先进先出", "后进先出", "随机访问", "按优先级出"], answer=1, score=10,
         analysis="栈（stack）是后进先出（LIFO）的线性表。"),
    dict(type="single", stem="在长度为 n 的顺序表中按下标访问一个元素的时间复杂度是？", options=["O(1)", "O(log n)", "O(n)", "O(n²)"],
         answer=0, score=10, analysis="顺序表支持随机访问。"),
    dict(type="multiple", stem="下列哪些是线性结构？", options=["数组", "链表", "二叉树", "队列"], answer=[0, 1, 3], score=20,
         analysis="二叉树是非线性结构。"),
    dict(type="judge", stem="队列只允许在一端进行插入和删除。", answer=False, score=10, analysis="队列在队尾插入、队头删除。"),
    dict(type="fill", stem="二分查找要求线性表必须采用____存储结构，且元素____。", answer=["顺序", "有序|按关键字有序"], score=20,
         analysis="二分查找需要随机访问，并且元素有序。"),
    dict(type="short", stem="简述链表相对于顺序表的优缺点。", answer="优点：插入删除不需移动元素、空间动态分配；缺点：不能随机访问、额外指针开销。",
         score=30, analysis="从存储方式、访问方式、插入删除代价三方面回答即可。"),
]


def random_answer(q: Question, good: bool):
    if q.type == "single":
        return q.answer if good else random.randrange(len(q.options))
    if q.type == "multiple":
        return q.answer if good else random.sample(range(len(q.options)), k=random.randint(1, len(q.options)))
    if q.type == "judge":
        return q.answer if good else random.choice([True, False])
    if q.type == "fill":
        return [a.split("|")[0] if good or random.random() < 0.5 else "不知道" for a in q.answer]
    return random.choice(["链表插入删除方便，但不能随机访问。", "链表节省空间。", "链表更灵活，需要额外指针。"])


def seed_ds_course(db, t1: User, students: list[User]) -> Course:
    c = Course(name="数据结构", code=new_course_code(db), description="面向计算机专业本科二年级的核心课程，涵盖线性表、树、图、查找与排序。",
               semester="2025-2026 第一学期", owner_id=t1.id)
    db.add(c)
    db.flush()
    db.add(CourseMember(course_id=c.id, user_id=t1.id, role="teacher"))
    db.add(CourseMember(course_id=c.id, user_id=students[0].id, role="ta"))
    for s in students[1:]:
        db.add(CourseMember(course_id=c.id, user_id=s.id, role="student"))
    learners = students[1:]

    ch1 = add_chapter(db, c, "第一章 绪论", 0)
    ch2 = add_chapter(db, c, "第二章 线性表", 1)
    u21 = add_chapter(db, c, "2.1 顺序表", 0, ch2)
    u22 = add_chapter(db, c, "2.2 链表", 1, ch2)
    ch3 = add_chapter(db, c, "第三章 栈和队列", 2)
    ch4 = add_chapter(db, c, "第四章 树（备课中）", 3)

    pdf1 = save_file(db, t1, "第一章-课件.pdf", make_pdf(["Chapter 1: Introduction", "Data, data element, data structure", "Algorithm and complexity"]), "application/pdf")
    pdf2 = save_file(db, t1, "第二章-顺序表.pdf", make_pdf(["Chapter 2.1: Sequential List", "Random access O(1)", "Insert / delete O(n)"]), "application/pdf")

    m1 = add_activity(db, c, ch1, 0, type="material", title="绪论课件", description="课前请先浏览。", is_published=True,
                      settings={"file_ids": [pdf1.id], "allow_download": True}, created_at=NOW - 20 * DAY)
    v1 = add_activity(db, c, ch1, 1, type="video", title="什么是数据结构（视频）", is_published=True,
                      settings={"url": SAMPLE_VIDEO, "duration_s": 5}, created_at=NOW - 19 * DAY)
    hw1 = add_activity(db, c, ch1, 2, type="homework", title="作业1：复杂度分析", description="分析课件中三段代码的时间复杂度，写出推导过程。",
                       is_published=True, due_at=NOW - 5 * DAY, full_score=100, score_ratio=20,
                       settings={"max_attempts": 3, "score_rule": "last"}, created_at=NOW - 18 * DAY)
    add_activity(db, c, u21, 0, type="material", title="顺序表讲义", is_published=True,
                 settings={"file_ids": [pdf2.id], "allow_download": False}, created_at=NOW - 10 * DAY)
    hw2 = add_activity(db, c, u21, 1, type="homework", title="作业2：实现顺序表", description="用 C 或 Python 实现顺序表的插入、删除、查找，提交代码和运行截图。",
                       is_published=True, due_at=NOW + 5 * DAY, full_score=100, score_ratio=20,
                       settings={"max_attempts": 0, "score_rule": "max"}, created_at=NOW - 3 * DAY)
    add_activity(db, c, u22, 0, type="video", title="链表图解（视频）", is_published=True, open_at=NOW + 2 * DAY,
                 settings={"url": SAMPLE_VIDEO, "duration_s": 5}, created_at=NOW - 1 * DAY)
    ex1 = add_activity(db, c, ch3, 0, type="exam", title="阶段测验：线性表", description="闭卷，限时 30 分钟，只能作答一次。",
                       is_published=True, start_at=NOW - 7 * DAY, due_at=NOW - 6 * DAY, full_score=0, score_ratio=30,
                       settings={"duration_min": 30, "attempts": 1, "shuffle_options": True, "show_answer": True}, created_at=NOW - 8 * DAY)
    ex2 = add_activity(db, c, ch3, 1, type="exam", title="栈和队列小测", description="可作答 2 次，取最高分。",
                       is_published=True, start_at=NOW - 1 * DAY, due_at=NOW + 3 * DAY, full_score=0, score_ratio=30,
                       settings={"duration_min": 20, "attempts": 2, "shuffle_options": False, "show_answer": True}, created_at=NOW - 2 * DAY)
    add_activity(db, c, ch4, 0, type="homework", title="作业3：二叉树遍历（草稿）", description="尚未发布。", is_published=False,
                 full_score=100, score_ratio=0, settings={"max_attempts": 1, "score_rule": "last"})

    for ex, qs in ((ex1, EXAM_QUESTIONS), (ex2, EXAM_QUESTIONS[:5])):
        for i, q in enumerate(qs):
            db.add(Question(activity_id=ex.id, sort=i, **q))
        ex.full_score = sum(q["score"] for q in qs)
    db.flush()
    db.refresh(ex1)
    db.refresh(ex2)

    # 作业1：25 人提交，前 18 人已批改，部分人交了两次
    for i, s in enumerate(learners[:25]):
        attempts = 2 if i % 5 == 0 else 1
        for n in range(1, attempts + 1):
            att = save_file(db, s, f"复杂度分析-v{n}.txt", f"{s.name} 的作业第 {n} 版\nT1: O(n)\nT2: O(n log n)\nT3: O(n^2)\n".encode(), "text/plain") if i % 3 == 0 else None
            sub = Submission(activity_id=hw1.id, user_id=s.id, attempt_no=n, content=f"第 {n} 次提交：三段代码分别为 O(n)、O(n log n)、O(n²)，推导见附件。",
                             file_ids=[att.id] if att else [], status="submitted", submitted_at=hw1.due_at - timedelta(days=2, hours=i) + timedelta(hours=n))
            if i < 18:
                sub.status = "graded"
                sub.score = random.choice([72, 78, 85, 88, 90, 95]) + (3 if n == 2 else 0)
                sub.comment = random.choice(["推导清晰。", "第三题循环次数分析有误。", "很好，注意书写规范。"])
                sub.graded_at = hw1.due_at + DAY
            db.add(sub)

    # 作业2：8 人已提交
    for i, s in enumerate(learners[:8]):
        db.add(Submission(activity_id=hw2.id, user_id=s.id, attempt_no=1, content="代码见附件，已通过自测。",
                          status="submitted", submitted_at=NOW - timedelta(hours=10 + i)))

    # 阶段测验：22 人作答，客观题自动判分；前 12 人简答题已批改
    for i, s in enumerate(learners[:22]):
        good = random.random() < 0.65
        sub = Submission(activity_id=ex1.id, user_id=s.id, attempt_no=1, status="draft",
                         started_at=ex1.start_at + timedelta(hours=1, minutes=i))
        sub.answers = {str(q.id): random_answer(q, good or random.random() < 0.5) for q in ex1.questions}
        db.add(sub)
        db.flush()
        exam_svc.finalize(db, ex1, sub)
        sub.submitted_at = sub.started_at + timedelta(minutes=random.randint(12, 28))
        if i < 12:
            short_q = ex1.questions[-1]
            exam_svc.apply_manual_grade(ex1, sub, {str(short_q.id): random.choice([15, 20, 25, 30])})
            sub.graded_at = ex1.due_at + DAY

    # 栈和队列小测：5 人已作答一次
    for s in learners[:5]:
        sub = Submission(activity_id=ex2.id, user_id=s.id, attempt_no=1, status="draft", started_at=NOW - timedelta(hours=5))
        sub.answers = {str(q.id): random_answer(q, random.random() < 0.7) for q in ex2.questions}
        db.add(sub)
        db.flush()
        exam_svc.finalize(db, ex2, sub)

    # 学习进度
    for s in learners:
        if random.random() < 0.8:
            db.add(Progress(activity_id=m1.id, user_id=s.id, completed=True))
        if random.random() < 0.6:
            db.add(Progress(activity_id=v1.id, user_id=s.id, completed=True, watched_seconds=5, last_pos=5))
    return c


def seed_en_course(db, t2: User, students: list[User]) -> Course:
    c = Course(name="大学英语（二）", code=new_course_code(db), description="读写译综合训练。", semester="2025-2026 第一学期", owner_id=t2.id)
    db.add(c)
    db.flush()
    db.add(CourseMember(course_id=c.id, user_id=t2.id, role="teacher"))
    for s in students[:20]:
        db.add(CourseMember(course_id=c.id, user_id=s.id, role="student"))
    u1 = add_chapter(db, c, "Unit 1 Campus Life", 0)
    add_chapter(db, c, "Unit 2 Technology", 1)
    add_activity(db, c, u1, 0, type="video", title="Warm-up Video", is_published=True, settings={"url": SAMPLE_VIDEO, "duration_s": 5})
    add_activity(db, c, u1, 1, type="homework", title="Essay: My First Week", description="不少于 150 词。", is_published=True,
                 due_at=NOW + 2 * DAY, full_score=100, score_ratio=50, settings={"max_attempts": 2, "score_rule": "last"})
    return c


def main() -> None:
    reset()
    db = SessionLocal()
    try:
        _admin, t1, t2, students = create_users(db)
        ds = seed_ds_course(db, t1, students)
        en = seed_en_course(db, t2, students)
        for u, cs in ((t1, [ds]), (t2, [en]), (students[1], [ds, en]), (students[2], [en, ds])):
            for k, c in enumerate(cs):
                db.add(RecentVisit(user_id=u.id, course_id=c.id, visited_at=NOW - timedelta(hours=k)))
        db.commit()
        print(f"演示数据已生成：数据结构 访问码 {ds.code}，大学英语 访问码 {en.code}")
        print("账号：admin/admin123，teacher1、teacher2/123456，student1..student30/123456（student1 是数据结构的助教）")
    finally:
        db.close()


if __name__ == "__main__":
    main()
