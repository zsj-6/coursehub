"""接口级：权限 + 建课→作业→测试→成绩 主流程。"""

from datetime import timedelta

from app.db import utcnow
from tests.conftest import login


def _setup_course(client):
    t = login(client, "t1")
    course = client.post("/api/courses", json={"name": "测试课程"}, headers=t).json()
    cid = course["id"]
    ch = client.post(f"/api/courses/{cid}/chapters", json={"title": "第一章"}, headers=t).json()
    return t, cid, ch["id"], course["code"]


def test_permissions(client):
    t, cid, ch_id, code = _setup_course(client)
    s1 = login(client, "s1")
    t2 = login(client, "t2")

    # 学生不能建课；没加入的课程看不到
    assert client.post("/api/courses", json={"name": "x"}, headers=s1).status_code == 403
    assert client.get(f"/api/courses/{cid}", headers=s1).status_code == 403
    # 其他教师也不能改
    assert client.put(f"/api/courses/{cid}", json={"name": "改名"}, headers=t2).status_code == 403
    # 未登录
    assert client.get("/api/me").status_code == 401

    # 访问码加入后可以看
    assert client.post("/api/courses/join", json={"code": code}, headers=s1).status_code == 200
    assert client.get(f"/api/courses/{cid}", headers=s1).status_code == 200
    # 学生不能新建活动
    r = client.post(f"/api/courses/{cid}/activities", json={"chapter_id": ch_id, "type": "homework", "title": "x"}, headers=s1)
    assert r.status_code == 403

    # 草稿活动学生看不到
    act = client.post(
        f"/api/courses/{cid}/activities", json={"chapter_id": ch_id, "type": "homework", "title": "草稿"}, headers=t
    ).json()
    assert client.get(f"/api/activities/{act['id']}", headers=s1).status_code == 404
    outline = client.get(f"/api/courses/{cid}/outline", headers=s1).json()
    assert outline[0]["activities"] == []
    # 发布后可见
    client.post(f"/api/courses/{cid}/activities/batch-publish", json={"ids": [act["id"]], "publish": True}, headers=t)
    assert client.get(f"/api/activities/{act['id']}", headers=s1).status_code == 200


def test_homework_exam_grades_flow(client):
    t, cid, ch_id, code = _setup_course(client)
    s1, s2 = login(client, "s1"), login(client, "s2")
    for s in (s1, s2):
        client.post("/api/courses/join", json={"code": code}, headers=s)

    # ---------- 作业 ----------
    hw = client.post(
        f"/api/courses/{cid}/activities",
        json={
            "chapter_id": ch_id, "type": "homework", "title": "作业1", "is_published": True,
            "due_at": (utcnow() + timedelta(days=1)).isoformat(), "full_score": 100, "score_ratio": 40,
            "settings": {"max_attempts": 2, "score_rule": "max"},
        },
        headers=t,
    ).json()
    f = client.post("/api/files", files={"file": ("答案.txt", b"hello", "text/plain")}, headers=s1).json()
    r1 = client.post(f"/api/activities/{hw['id']}/submissions", json={"content": "v1", "file_ids": [f["id"]]}, headers=s1)
    assert r1.status_code == 200, r1.text
    r2 = client.post(f"/api/activities/{hw['id']}/submissions", json={"content": "v2"}, headers=s1)
    assert r2.json()["attempt_no"] == 2
    assert client.post(f"/api/activities/{hw['id']}/submissions", json={"content": "v3"}, headers=s1).status_code == 400

    rows = client.get(f"/api/activities/{hw['id']}/submissions", headers=t).json()["rows"]
    assert {r["user"]["name"]: r["status"] for r in rows} == {"学生一": "pending", "学生二": "not_submitted"}

    assert client.put(f"/api/submissions/{r1.json()['id']}/grade", json={"score": 90, "comment": "好"}, headers=t).status_code == 200
    client.put(f"/api/submissions/{r2.json()['id']}/grade", json={"score": 70}, headers=t)
    mine = client.get(f"/api/activities/{hw['id']}/submissions/mine", headers=s1).json()
    assert mine["score"] == 90 and mine["status"] == "graded"  # 取最高分

    zip_resp = client.get(f"/api/activities/{hw['id']}/export.zip", headers=t)
    assert zip_resp.status_code == 200 and zip_resp.content[:2] == b"PK"

    # ---------- 测试 ----------
    ex = client.post(
        f"/api/courses/{cid}/activities",
        json={"chapter_id": ch_id, "type": "exam", "title": "测验", "is_published": True, "score_ratio": 60,
              "settings": {"attempts": 1, "shuffle_options": True}},
        headers=t,
    ).json()
    qs = client.put(
        f"/api/activities/{ex['id']}/questions",
        json={"questions": [
            {"type": "single", "stem": "1+1", "options": ["1", "2", "3"], "answer": 1, "score": 30},
            {"type": "fill", "stem": "中国首都____", "answer": ["北京"], "score": 20},
            {"type": "short", "stem": "谈谈感想", "answer": "", "score": 50},
        ]},
        headers=t,
    ).json()
    assert client.get(f"/api/activities/{ex['id']}", headers=t).json()["full_score"] == 100

    paper = client.post(f"/api/activities/{ex['id']}/exam/start", json={}, headers=s1).json()
    assert "answer" not in paper["questions"][0]
    assert {o["key"] for o in paper["questions"][0]["options"]} == {0, 1, 2}
    answers = {str(qs[0]["id"]): 1, str(qs[1]["id"]): ["北京"], str(qs[2]["id"]): "很好"}
    client.put(f"/api/submissions/{paper['submission_id']}/answers", json={"answers": answers}, headers=s1)
    sub = client.post(f"/api/submissions/{paper['submission_id']}/submit", json={}, headers=s1).json()
    assert sub["auto_score"] == 50 and sub["status"] == "submitted"
    # 次数用完
    assert client.post(f"/api/activities/{ex['id']}/exam/start", json={}, headers=s1).status_code == 400

    graded = client.put(
        f"/api/submissions/{sub['id']}/grade", json={"question_scores": {str(qs[2]["id"]): 40}}, headers=t
    ).json()
    assert graded["score"] == 90 and graded["status"] == "graded"

    # ---------- 成绩 ----------
    table = client.get(f"/api/courses/{cid}/grades", headers=t).json()
    row = next(r for r in table["rows"] if r["user"]["name"] == "学生一")
    assert row["total"] == 90 / 100 * 40 + 90 / 100 * 60  # 90
    client.put(f"/api/courses/{cid}/grades/override", json={"user_id": row["user"]["id"], "activity_id": hw["id"], "score": 100}, headers=t)
    row = next(r for r in client.get(f"/api/courses/{cid}/grades", headers=t).json()["rows"] if r["user"]["name"] == "学生一")
    assert row["cells"][str(hw["id"])]["final"] == 100 and row["total"] == 94

    # 学生只看到自己
    mine = client.get(f"/api/courses/{cid}/grades", headers=s2).json()
    assert len(mine["rows"]) == 1 and mine["rows"][0]["user"]["name"] == "学生二"
    # 学生看不到未发布的活动列
    draft = client.post(
        f"/api/courses/{cid}/activities", json={"chapter_id": ch_id, "type": "homework", "title": "草稿作业"}, headers=t
    ).json()
    assert draft["id"] not in [a["id"] for a in client.get(f"/api/courses/{cid}/grades", headers=s2).json()["activities"]]
    assert draft["id"] in [a["id"] for a in client.get(f"/api/courses/{cid}/grades", headers=t).json()["activities"]]

    xlsx = client.get(f"/api/courses/{cid}/grades/export.xlsx", headers=t)
    assert xlsx.status_code == 200 and xlsx.content[:2] == b"PK"

    # 首页
    dash = client.get("/api/dashboard", headers=t).json()
    assert dash["stats"]["teaching_courses"] == 1


def test_copy_course(client):
    t, cid, ch_id, _ = _setup_course(client)
    client.post(f"/api/courses/{cid}/chapters", json={"title": "单元", "parent_id": ch_id}, headers=t)
    client.post(f"/api/courses/{cid}/activities", json={"chapter_id": ch_id, "type": "homework", "title": "作业", "is_published": True}, headers=t)
    other = client.post("/api/courses", json={"name": "新课"}, headers=t).json()
    r = client.post(f"/api/courses/{cid}/copy-to/{other['id']}", headers=t)
    assert r.json()["copied_activities"] == 1
    tree = client.get(f"/api/courses/{other['id']}/outline", headers=t).json()
    assert tree[0]["units"][0]["title"] == "单元"
    assert tree[0]["activities"][0]["is_published"] is False
