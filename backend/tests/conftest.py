import os
import tempfile

_tmp = tempfile.mkdtemp(prefix="coursehub-test-")
os.environ["DATABASE_URL"] = f"sqlite:///{_tmp}/test.db"
os.environ["UPLOAD_DIR"] = f"{_tmp}/uploads"

import pytest  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402

from app.db import Base, SessionLocal, engine, init_db  # noqa: E402
from app.main import app  # noqa: E402
from app.models import User  # noqa: E402
from app.security import hash_password  # noqa: E402


@pytest.fixture()
def client():
    Base.metadata.drop_all(engine)
    init_db()
    db = SessionLocal()
    pw = hash_password("123456", rounds=4)
    db.add_all(
        [
            User(username="admin", password_hash=pw, name="管理员", role="admin"),
            User(username="t1", password_hash=pw, name="教师一", role="teacher"),
            User(username="t2", password_hash=pw, name="教师二", role="teacher"),
            User(username="s1", password_hash=pw, name="学生一", role="student", student_no="001"),
            User(username="s2", password_hash=pw, name="学生二", role="student", student_no="002"),
            User(username="s3", password_hash=pw, name="学生三", role="student", student_no="003"),
        ]
    )
    db.commit()
    db.close()
    with TestClient(app) as c:
        yield c


def login(client, username: str) -> dict:
    r = client.post("/api/auth/login", json={"username": username, "password": "123456"})
    assert r.status_code == 200, r.text
    return {"Authorization": f"Bearer {r.json()['token']}"}
