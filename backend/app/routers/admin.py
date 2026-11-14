import csv
import io

from fastapi import APIRouter, Depends, HTTPException, UploadFile
from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session

from app.db import get_db
from app.deps import require_role
from app.models import User
from app.schemas import AdminUserIn, AdminUserUpdate
from app.security import hash_password
from app.serializers import user_out

router = APIRouter(prefix="/admin", tags=["管理员"])
admin_only = require_role("admin")


@router.get("/users")
def list_users(
    q: str | None = None,
    role: str | None = None,
    page: int = 1,
    size: int = 20,
    _: User = Depends(admin_only),
    db: Session = Depends(get_db),
):
    stmt = select(User)
    if q:
        like = f"%{q.strip()}%"
        stmt = stmt.where(or_(User.username.ilike(like), User.name.ilike(like), User.student_no.ilike(like)))
    if role:
        stmt = stmt.where(User.role == role)
    total = db.scalar(select(func.count()).select_from(stmt.subquery()))
    size = max(1, min(size, 200))
    items = db.scalars(stmt.order_by(User.id).offset((max(page, 1) - 1) * size).limit(size)).all()
    return {"items": [user_out(u) for u in items], "total": total}


@router.post("/users")
def create_user(body: AdminUserIn, _: User = Depends(admin_only), db: Session = Depends(get_db)):
    if db.scalar(select(User.id).where(User.username == body.username)):
        raise HTTPException(400, "用户名已存在")
    u = User(
        username=body.username,
        password_hash=hash_password(body.password),
        name=body.name,
        role=body.role,
        student_no=body.student_no,
    )
    db.add(u)
    db.commit()
    return user_out(u)


@router.put("/users/{user_id}")
def update_user(user_id: int, body: AdminUserUpdate, admin: User = Depends(admin_only), db: Session = Depends(get_db)):
    u = db.get(User, user_id)
    if not u:
        raise HTTPException(404, "用户不存在")
    if u.id == admin.id and body.role and body.role != "admin":
        raise HTTPException(400, "不能取消自己的管理员身份")
    data = body.model_dump(exclude_unset=True)
    if data.get("password"):
        u.password_hash = hash_password(data.pop("password"))
    data.pop("password", None)
    for k, v in data.items():
        if v is not None or k == "student_no":
            setattr(u, k, v)
    db.commit()
    return user_out(u)


@router.delete("/users/{user_id}")
def delete_user(user_id: int, admin: User = Depends(admin_only), db: Session = Depends(get_db)):
    if user_id == admin.id:
        raise HTTPException(400, "不能删除自己")
    u = db.get(User, user_id)
    if not u:
        raise HTTPException(404, "用户不存在")
    db.delete(u)
    db.commit()
    return {"ok": True}


@router.post("/users/import")
def import_users(file: UploadFile, _: User = Depends(admin_only), db: Session = Depends(get_db)):
    """CSV 表头：username,name,role,student_no,password（后三列可省略；role 默认 student，密码默认 123456）。"""
    raw = file.file.read()
    try:
        text = raw.decode("utf-8-sig")
    except UnicodeDecodeError:
        text = raw.decode("gbk", errors="replace")  # Excel 另存的中文 CSV 常是 GBK
    reader = csv.DictReader(io.StringIO(text))
    if not reader.fieldnames or not {"username", "name"} <= {f.strip() for f in reader.fieldnames}:
        raise HTTPException(400, "CSV 需要包含 username 和 name 两列")
    created, skipped, errors = 0, [], []
    seen: set[str] = set()
    for line_no, row in enumerate(reader, start=2):
        row = {(k or "").strip(): (v or "").strip() for k, v in row.items()}
        username, name = row.get("username"), row.get("name")
        if not username or not name:
            errors.append(f"第 {line_no} 行缺少 username 或 name")
            continue
        role = row.get("role") or "student"
        if role not in ("admin", "teacher", "student"):
            errors.append(f"第 {line_no} 行角色不正确：{role}")
            continue
        if username in seen or db.scalar(select(User.id).where(User.username == username)):
            skipped.append(username)
            continue
        seen.add(username)
        db.add(
            User(
                username=username,
                name=name,
                role=role,
                student_no=row.get("student_no") or None,
                password_hash=hash_password(row.get("password") or "123456", rounds=10),
            )
        )
        created += 1
    db.commit()
    return {"created": created, "skipped": skipped, "errors": errors}
