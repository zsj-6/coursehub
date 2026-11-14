"""测试客观题自动判分。纯函数，不碰数据库。"""

from typing import Any

from app.models import Question

_TRUE_WORDS = {"true", "1", "对", "正确", "是", "t", "yes"}


def _to_bool(v: Any) -> bool:
    if isinstance(v, str):
        return v.strip().lower() in _TRUE_WORDS
    return bool(v)


def _to_int(v: Any) -> int | None:
    try:
        return int(v)
    except (TypeError, ValueError):
        return None


def _norm(s: Any) -> str:
    return str(s).strip().casefold()


def grade_question(q_type: str, answer: Any, score: float, given: Any) -> float | None:
    """返回得分；简答题返回 None（需要人工评分）。"""
    if q_type == "short":
        return None
    if given is None or given == "" or given == []:
        return 0.0
    if q_type == "single":
        return float(score) if _to_int(given) is not None and _to_int(given) == _to_int(answer) else 0.0
    if q_type == "judge":
        return float(score) if _to_bool(given) == _to_bool(answer) else 0.0
    if q_type == "multiple":
        if not isinstance(given, list) or not isinstance(answer, list):
            return 0.0
        g = {_to_int(x) for x in given}
        a = {_to_int(x) for x in answer}
        return float(score) if g == a else 0.0  # 多选全对才得分
    if q_type == "fill":
        blanks = answer if isinstance(answer, list) else [answer]
        if not blanks:
            return 0.0
        given_list = given if isinstance(given, list) else [given]
        per = score / len(blanks)
        total = 0.0
        for i, expected in enumerate(blanks):
            alternatives = {_norm(x) for x in str(expected).split("|")}
            g = given_list[i] if i < len(given_list) else ""
            if _norm(g) in alternatives:
                total += per
        return round(total, 2)
    return 0.0


def grade_exam(questions: list[Question], answers: dict[str, Any]) -> tuple[float, dict[str, float | None], bool]:
    """返回 (客观题总分, 逐题得分, 是否含主观题)。逐题得分里简答题为 None。"""
    per_question: dict[str, float | None] = {}
    total = 0.0
    has_subjective = False
    for q in questions:
        s = grade_question(q.type, q.answer, q.score, answers.get(str(q.id)))
        per_question[str(q.id)] = s
        if s is None:
            has_subjective = True
        else:
            total += s
    return round(total, 2), per_question, has_subjective
