from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

from app.config import DEFAULT_JWT_SECRET, settings
from app.db import init_db
from app.routers import admin, auth, community, content, courses, dashboard, files, grades, submissions


@asynccontextmanager
async def lifespan(_: FastAPI):
    if settings.app_env == "production" and (settings.jwt_secret == DEFAULT_JWT_SECRET or len(settings.jwt_secret) < 32):
        raise RuntimeError("生产环境必须在环境变量或 .env 中设置 JWT_SECRET（至少 32 个字符）")
    init_db()
    yield


app = FastAPI(title="CourseHub API", version="0.1.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["Content-Disposition"],
)

for r in (auth, files, dashboard, courses, content, submissions, grades, community, admin):
    app.include_router(r.router, prefix="/api")


@app.get("/api/health")
def health():
    return {"ok": True}


# ---------- 托管前端（生产部署时）----------
# 开发时前端由 Vite（5173）提供，这里不生效；frontend/dist 存在时，后端同时提供页面，部署只需一个端口。
_dist = settings.frontend_dist
if (_dist / "index.html").exists():
    app.mount("/assets", StaticFiles(directory=_dist / "assets"), name="assets")

    @app.get("/{full_path:path}", include_in_schema=False)
    def spa(full_path: str):
        if full_path.startswith("api/"):
            raise HTTPException(404, "接口不存在")
        candidate = (_dist / full_path).resolve()
        if full_path and candidate.is_file() and _dist.resolve() in candidate.parents:
            return FileResponse(candidate)
        # 前端是 history 路由，其余路径都返回 index.html
        return FileResponse(_dist / "index.html", headers={"Cache-Control": "no-cache"})
