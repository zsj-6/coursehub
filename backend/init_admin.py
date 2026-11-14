"""生产环境初始化：建表并创建（或重置）一个管理员账号。不会删除任何已有数据。

用法：
  ADMIN_PASSWORD='你的强密码' python init_admin.py            # 管理员账号默认 admin
  python init_admin.py --username boss                         # 不设环境变量时会提示输入密码

与 seed.py 的区别：seed.py 会清空数据库并创建弱密码的演示账号，只能在本地或内网演示时用。
"""

import argparse
import getpass
import os
import sys

from sqlalchemy import select

from app.db import SessionLocal, init_db
from app.models import User
from app.security import hash_password


def main() -> None:
    parser = argparse.ArgumentParser(description="创建或重置管理员账号")
    parser.add_argument("--username", default="admin")
    parser.add_argument("--name", default="系统管理员")
    args = parser.parse_args()

    password = os.environ.get("ADMIN_PASSWORD") or getpass.getpass(f"设置 {args.username} 的密码（至少 8 位）：")
    if len(password) < 8:
        sys.exit("密码至少 8 位")

    init_db()
    db = SessionLocal()
    try:
        user = db.scalar(select(User).where(User.username == args.username))
        if user:
            user.password_hash = hash_password(password)
            user.role = "admin"
            action = "已重置密码"
        else:
            db.add(User(username=args.username, name=args.name, role="admin", password_hash=hash_password(password)))
            action = "已创建"
        db.commit()
        print(f"管理员 {args.username} {action}。登录后可在「用户管理」里添加教师和学生（支持 CSV 导入）。")
    finally:
        db.close()


if __name__ == "__main__":
    main()
