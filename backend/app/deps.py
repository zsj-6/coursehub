"""鉴权与权限检查。所有权限判断都放在这里，路由里不要自己写。

课程内权限分三级：
  member  —— 课程成员（教师/助教/学生）
  grader  —— 能批改：教师、助教
  manager —— 能管理课程：教师
系统管理员（User.role == "admin"）在任何课程里都按教师处理。
"""

from dataclasses import dataclass
from typing import Literal

from fastapi import Depends, HTTPException, Query
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from app.db import get_db
from app.models import Activity, Course, CourseMember, User
from app.security import decode_token
from app.services.visibility import is_visible

Level = Literal["member", "grader", "manager"]
LEVEL_ROLES: dict[str, set[str]] = {
    "member": {"teacher", "ta", "student"},
    "grader": {"teacher", "ta"},
    "manager": {"teacher"},
}

_bearer = HTTPBearer(auto_error=False)


def get_current_user(
    cred: HTTPAuthorizationCredentials | None = Depends(_bearer),
    token: str | None = Query(None, include_in_schema=False),  # 下载链接里可以用 ?token= 代替请求头
    db: Session = Depends(get_db),
) -> User:
    raw = cred.credentials if cred else token
    if not raw:
        raise HTTPException(401, "未登录")
    uid = decode_token(raw)
    user = db.get(User, uid) if uid else None
    if not user:
        raise HTTPException(401, "登录已失效，请重新登录")
    return user


def require_role(*roles: str):
    def dep(user: User = Depends(get_current_user)) -> User:
        if user.role not in roles:
            raise HTTPException(403, "没有权限")
        return user

    return dep


def check_course(db: Session, user: User, course_id: int, level: Level = "member") -> tuple[Course, str]:
    """返回 (课程, 当前用户在课程里的角色)。管理员视为 teacher。"""
    course = db.get(Course, course_id)
    if not course:
        raise HTTPException(404, "课程不存在")
    if user.role == "admin":
        return course, "teacher"
    member = db.get(CourseMember, (course_id, user.id))
    if not member:
        raise HTTPException(403, "你不是该课程的成员")
    if member.role not in LEVEL_ROLES[level]:
        raise HTTPException(403, "没有权限进行此操作")
    return course, member.role


def check_activity(db: Session, user: User, activity_id: int, level: Level = "member") -> tuple[Activity, str]:
    """返回 (活动, 角色)。学生看不到的活动一律按不存在处理。"""
    act = db.get(Activity, activity_id)
    if not act:
        raise HTTPException(404, "活动不存在")
    _, role = check_course(db, user, act.course_id, level)
    if role == "student" and not is_visible(act):
        raise HTTPException(404, "活动不存在或未开放")
    return act, role


@dataclass
class CourseCtx:
    course: Course
    role: str
    user: User

    @property
    def is_student(self) -> bool:
        return self.role == "student"


def require_course_member(level: Level = "member"):
    """用于路径里带 {course_id} 的路由。"""

    def dep(
        course_id: int,
        user: User = Depends(get_current_user),
        db: Session = Depends(get_db),
    ) -> CourseCtx:
        course, role = check_course(db, user, course_id, level)
        return CourseCtx(course, role, user)

    return dep
