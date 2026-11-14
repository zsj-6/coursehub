"""纯函数：判分、可见性、成绩规则。"""

from datetime import timedelta

from app.db import utcnow
from app.models import Activity, Question, Submission
from app.services.exam_grader import grade_exam, grade_question
from app.services.scoring import activity_score, course_total, submission_status
from app.services.visibility import exam_start_error, homework_submit_error, is_visible

NOW = utcnow()
H = timedelta(hours=1)


# ---------- 判分 ----------
def test_single_and_judge():
    assert grade_question("single", 1, 5, 1) == 5
    assert grade_question("single", 1, 5, "1") == 5
    assert grade_question("single", 1, 5, 2) == 0
    assert grade_question("judge", False, 4, False) == 4
    assert grade_question("judge", False, 4, "错") == 4
    assert grade_question("judge", True, 4, False) == 0


def test_multiple_all_or_nothing():
    assert grade_question("multiple", [0, 2], 10, [2, 0]) == 10
    assert grade_question("multiple", [0, 2], 10, [0]) == 0
    assert grade_question("multiple", [0, 2], 10, [0, 1, 2]) == 0


def test_fill_per_blank_with_alternatives():
    ans = ["顺序", "有序|按关键字有序"]
    assert grade_question("fill", ans, 20, [" 顺序 ", "按关键字有序"]) == 20
    assert grade_question("fill", ans, 20, ["顺序", "无序"]) == 10
    assert grade_question("fill", ["ABC"], 6, ["abc"]) == 6


def test_unanswered_and_short():
    assert grade_question("single", 0, 5, None) == 0
    assert grade_question("short", "参考", 10, "随便写") is None


def test_grade_exam_totals():
    qs = [
        Question(id=1, type="single", answer=0, score=10),
        Question(id=2, type="short", answer="", score=20),
    ]
    total, per_q, subjective = grade_exam(qs, {"1": 0, "2": "xx"})
    assert total == 10 and per_q == {"1": 10, "2": None} and subjective


# ---------- 可见性 ----------
def _act(**kw) -> Activity:
    base = dict(is_published=True, open_at=None, close_at=None, start_at=None, due_at=None, settings={})
    base.update(kw)
    return Activity(**base)


def test_visibility_window():
    assert not is_visible(_act(is_published=False), NOW)
    assert is_visible(_act(), NOW)
    assert not is_visible(_act(open_at=NOW + H), NOW)
    assert not is_visible(_act(close_at=NOW - H), NOW)
    assert is_visible(_act(open_at=NOW - H, close_at=NOW + H), NOW)


def test_homework_submit_rules():
    assert homework_submit_error(_act(due_at=NOW + H), 0, NOW) is None
    assert homework_submit_error(_act(due_at=NOW - H), 0, NOW) == "已过截止时间"
    assert homework_submit_error(_act(settings={"max_attempts": 2}), 2, NOW)
    assert homework_submit_error(_act(settings={"max_attempts": 0}), 99, NOW) is None


def test_exam_start_rules():
    assert exam_start_error(_act(start_at=NOW + H), 0, NOW) == "测试尚未开始"
    assert exam_start_error(_act(due_at=NOW - H), 0, NOW) == "测试已结束"
    assert exam_start_error(_act(settings={"attempts": 1}), 1, NOW) == "作答次数已用完"
    assert exam_start_error(_act(settings={"attempts": 1}), 0, NOW) is None


# ---------- 成绩 ----------
def _sub(n, score, status="graded"):
    return Submission(attempt_no=n, score=score, status=status)


def test_homework_score_rules():
    subs = [_sub(1, 60), _sub(2, 90), _sub(3, 75), _sub(4, None, "submitted")]
    assert activity_score(_act(type="homework", settings={"score_rule": "last"}), subs) == 75
    assert activity_score(_act(type="homework", settings={"score_rule": "max"}), subs) == 90
    assert activity_score(_act(type="homework", settings={"score_rule": "avg"}), subs) == 75
    assert activity_score(_act(type="homework", settings={}), []) is None


def test_exam_takes_max():
    assert activity_score(_act(type="exam"), [_sub(1, 50), _sub(2, 40)]) == 50


def test_course_total():
    a1 = Activity(id=1, full_score=100, score_ratio=40)
    a2 = Activity(id=2, full_score=50, score_ratio=60)
    assert course_total([a1, a2], {1: 80, 2: 25}) == 62  # 80/100*40 + 25/50*60
    assert course_total([a1, a2], {1: 80, 2: None}) == 32


def test_submission_status():
    assert submission_status([]) == "not_submitted"
    assert submission_status([_sub(1, None, "draft")]) == "not_submitted"
    assert submission_status([_sub(1, 80), _sub(2, None, "submitted")]) == "pending"
    assert submission_status([_sub(1, 80)]) == "graded"
