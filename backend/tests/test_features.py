"""成绩占比校验、完成指标、测试公布成绩。"""

from datetime import timedelta

from app.db import utcnow
from tests.conftest import login


def _course(client):
    t = login(client, "t1")
    c = client.post("/api/courses", json={"name": "课"}, headers=t).json()
    ch = client.post(f"/api/courses/{c['id']}/chapters", json={"title": "第一章"}, headers=t).json()
    s1 = login(client, "s1")
    client.post("/api/courses/join", json={"code": c["code"]}, headers=s1)
    return t, s1, c["id"], ch["id"]


def _act(client, t, cid, ch, **kw):
    body = {"chapter_id": ch, "type": "homework", "title": "作业", "is_published": True, **kw}
    return client.post(f"/api/courses/{cid}/activities", json=body, headers=t)


def test_score_ratio_limit(client):
    t, _, cid, ch = _course(client)
    a1 = _act(client, t, cid, ch, score_ratio=60).json()
    r = _act(client, t, cid, ch, score_ratio=50)
    assert r.status_code == 400 and "40" in r.json()["detail"]
    a2 = _act(client, t, cid, ch, score_ratio=40).json()
    # 编辑时排除自身：a1 改成 60 不算超
    assert client.put(f"/api/activities/{a1['id']}", json={"score_ratio": 60}, headers=t).status_code == 200
    assert client.put(f"/api/activities/{a1['id']}", json={"score_ratio": 61}, headers=t).status_code == 400
    # 资料/视频的占比强制为 0
    m = _act(client, t, cid, ch, type="material", score_ratio=30, settings={"file_ids": []}).json()
    assert m["score_ratio"] == 0

    info = client.get(f"/api/courses/{cid}/score-ratios", headers=t).json()
    assert info["total"] == 100 and info["left"] == 0
    bad = client.put(f"/api/courses/{cid}/score-ratios", json={"ratios": {str(a1["id"]): 70}}, headers=t)
    assert bad.status_code == 400
    ok = client.put(f"/api/courses/{cid}/score-ratios", json={"ratios": {str(a1["id"]): 30, str(a2["id"]): 50}}, headers=t)
    assert ok.status_code == 200 and ok.json()["left"] == 20


def test_completion_criteria(client):
    t, s1, cid, ch = _course(client)
    v = _act(client, t, cid, ch, type="video", settings={"url": "https://example.com/a.mp4", "duration_s": 100}).json()
    hw = _act(client, t, cid, ch, full_score=100).json()

    def done():
        tree = client.get(f"/api/courses/{cid}/outline", headers=s1).json()
        return {a["id"]: a["completed"] for a in tree[0]["activities"]}

    # 默认：视频看 80%，作业提交即完成
    client.post(f"/api/activities/{v['id']}/progress", json={"delta_seconds": 70}, headers=s1)
    assert done()[v["id"]] is False
    r = client.post(f"/api/activities/{v['id']}/progress", json={"delta_seconds": 10}, headers=s1).json()
    assert r["completed"] is True
    sub = client.post(f"/api/activities/{hw['id']}/submissions", json={"content": "x"}, headers=s1).json()
    assert done()[hw["id"]] is True

    # 改为：视频 90%，作业需达标（60%）
    client.put(f"/api/courses/{cid}", json={"completion": {"video_percent": 90, "homework": "pass", "exam": "submit", "pass_percent": 60}}, headers=t)
    assert done() == {v["id"]: False, hw["id"]: False}
    client.put(f"/api/submissions/{sub['id']}/grade", json={"score": 59}, headers=t)
    assert done()[hw["id"]] is False
    client.put(f"/api/submissions/{sub['id']}/grade", json={"score": 60}, headers=t)
    assert done()[hw["id"]] is True
    assert client.get(f"/api/courses/{cid}", headers=t).json()["completion"]["video_percent"] == 90

    # 非法设置
    assert client.put(f"/api/courses/{cid}", json={"completion": {"video_percent": 120}}, headers=t).status_code == 422


def test_score_publish(client):
    t, s1, cid, ch = _course(client)
    ex = _act(client, t, cid, ch, type="exam", title="测验", score_ratio=50, settings={"score_publish": "none"}).json()
    q = client.put(
        f"/api/activities/{ex['id']}/questions",
        json={"questions": [{"type": "single", "stem": "1+1", "options": ["1", "2"], "answer": 1, "score": 10}]},
        headers=t,
    ).json()
    paper = client.post(f"/api/activities/{ex['id']}/exam/start", headers=s1).json()
    sub = client.post(f"/api/submissions/{paper['submission_id']}/submit", json={"answers": {str(q[0]["id"]): 1}}, headers=s1).json()
    assert sub["score"] is None and sub["auto_score"] is None  # 不公布

    detail = client.get(f"/api/submissions/{sub['id']}", headers=s1).json()
    assert detail["score"] is None and detail["show_answer"] is False and detail["questions"][0]["answer"] is None
    assert detail["questions"][0]["got"] is None
    mine = client.get(f"/api/activities/{ex['id']}/submissions/mine", headers=s1).json()
    assert mine["score"] is None and mine["score_published"] is False
    lst = client.get(f"/api/courses/{cid}/activities?type=exam", headers=s1).json()
    assert lst[0]["my_score"] is None
    g = client.get(f"/api/courses/{cid}/grades", headers=s1).json()
    assert g["rows"][0]["cells"][str(ex["id"])]["hidden"] is True and g["rows"][0]["total"] == 0
    # 教师照常看到
    assert client.get(f"/api/submissions/{sub['id']}", headers=t).json()["score"] == 10

    # 定时公布：时间未到看不到，过了能看到
    future = (utcnow() + timedelta(days=1)).isoformat()
    client.put(f"/api/activities/{ex['id']}", json={"settings": {"score_publish": "scheduled", "score_publish_at": future}}, headers=t)
    assert client.get(f"/api/activities/{ex['id']}/submissions/mine", headers=s1).json()["score"] is None
    past = (utcnow() - timedelta(minutes=1)).isoformat()
    client.put(f"/api/activities/{ex['id']}", json={"settings": {"score_publish_at": past}}, headers=t)
    assert client.get(f"/api/activities/{ex['id']}/submissions/mine", headers=s1).json()["score"] == 10
    assert client.get(f"/api/courses/{cid}/grades", headers=s1).json()["rows"][0]["total"] == 50

    # 定时公布必须给时间
    r = client.put(f"/api/activities/{ex['id']}", json={"settings": {"score_publish": "scheduled", "score_publish_at": None}}, headers=t)
    assert r.status_code == 422


def test_announcement_visibility_and_posts(client):
    t, s1, cid, ch = _course(client)
    now = utcnow()
    client.post(f"/api/courses/{cid}/announcements", json={"title": "现在可见"}, headers=t)
    client.post(f"/api/courses/{cid}/announcements", json={"title": "定时", "open_at": (now + timedelta(days=1)).isoformat()}, headers=t)
    # 学生只看到时间段内的公告，教师都能看到
    assert [a["title"] for a in client.get(f"/api/courses/{cid}/announcements", headers=s1).json()] == ["现在可见"]
    assert len(client.get(f"/api/courses/{cid}/announcements", headers=t).json()) == 2
    assert client.post(f"/api/courses/{cid}/announcements", json={"title": "x"}, headers=s1).status_code == 403

    # 讨论区：学生发帖、回复的回复挂到主帖、点赞；学生不能置顶，也不能删别人的帖子
    a = _act(client, t, cid, ch).json()
    root = client.post(f"/api/activities/{a['id']}/posts", json={"content": "提问"}, headers=s1).json()
    r1 = client.post(f"/api/activities/{a['id']}/posts", json={"content": "回复", "parent_id": root["id"]}, headers=t).json()
    client.post(f"/api/activities/{a['id']}/posts", json={"content": "再回复", "parent_id": r1["id"]}, headers=s1)
    client.post(f"/api/posts/{root['id']}/like", headers=t)
    data = client.get(f"/api/activities/{a['id']}/posts", headers=s1).json()
    assert len(data["items"]) == 1 and len(data["items"][0]["replies"]) == 2 and data["items"][0]["likes"] == 1
    assert client.post(f"/api/posts/{root['id']}/pin", headers=s1).status_code == 403
    assert client.delete(f"/api/posts/{r1['id']}", headers=s1).status_code == 403

    # 未加入课程的学生看不到讨论区
    s2 = login(client, "s2")
    assert client.get(f"/api/activities/{a['id']}/posts", headers=s2).status_code == 403
