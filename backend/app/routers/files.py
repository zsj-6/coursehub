import mimetypes
import secrets
from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException, UploadFile
from fastapi.responses import FileResponse
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.config import settings
from app.db import get_db
from app.deps import get_current_user
from app.models import FileObj, User
from app.serializers import file_out

router = APIRouter(tags=["文件"])

_CHUNK = 1024 * 1024


@router.post("/files")
def upload(file: UploadFile, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    filename = Path(file.filename or "file").name
    key = secrets.token_hex(16)
    rel = Path(key[:2]) / (key + Path(filename).suffix.lower())
    dest = settings.upload_dir / rel
    dest.parent.mkdir(parents=True, exist_ok=True)
    limit = settings.max_upload_mb * 1024 * 1024
    size = 0
    with dest.open("wb") as out:
        while chunk := file.file.read(_CHUNK):
            size += len(chunk)
            if size > limit:
                out.close()
                dest.unlink(missing_ok=True)
                raise HTTPException(413, f"文件不能超过 {settings.max_upload_mb}MB")
            out.write(chunk)
    mime = file.content_type or mimetypes.guess_type(filename)[0] or "application/octet-stream"
    f = FileObj(key=key, owner_id=user.id, filename=filename, path=str(rel), mime=mime, size=size)
    db.add(f)
    db.commit()
    return file_out(f)


@router.get("/files/{key}")
def download(key: str, download: bool = False, db: Session = Depends(get_db)):
    """不需要登录：key 是 128 位随机串，拿到链接即可访问（方便 <img>/<video> 直接引用）。"""
    f = db.scalar(select(FileObj).where(FileObj.key == key))
    path = settings.upload_dir / f.path if f else None
    if not f or not path.exists():
        raise HTTPException(404, "文件不存在")
    return FileResponse(
        path,
        media_type=f.mime,
        filename=f.filename,
        content_disposition_type="attachment" if download else "inline",
    )
