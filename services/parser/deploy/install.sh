#!/usr/bin/env bash
# 幂等安装/更新 bank-statement-parser（Amazon Linux 2023 / ec2-user）。
set -euo pipefail

APP_DIR="/home/ec2-user/apps/parser"
ENV_FILE="/etc/bank-statement-parser.env"
SERVICE_NAME="bank-statement-parser"
UNIT_SRC="${APP_DIR}/deploy/${SERVICE_NAME}.service"
UNIT_DST="/etc/systemd/system/${SERVICE_NAME}.service"

export PATH="${HOME}/.local/bin:${PATH}"

if [[ "$(id -un)" != "ec2-user" ]]; then
  echo "Run this script as ec2-user (without sudo)." >&2
  exit 1
fi

cd "${APP_DIR}"

if ! sudo test -f "${ENV_FILE}"; then
  echo "缺少 ${ENV_FILE}，请先创建并写入 PARSER_SHARED_SECRET。" >&2
  exit 1
fi

if ! command -v uv >/dev/null 2>&1; then
  curl -LsSf https://astral.sh/uv/install.sh | UV_NO_MODIFY_PATH=1 sh
fi

uv python install 3.14

if [[ ! -x .venv/bin/python ]]; then
  uv venv --python 3.14 .venv
fi

uv pip install --python .venv/bin/python -r requirements.lock
uv pip install --python .venv/bin/python --no-deps .

sudo install -m 644 "${UNIT_SRC}" "${UNIT_DST}"
sudo systemctl daemon-reload
sudo systemctl enable "${SERVICE_NAME}"
sudo systemctl restart "${SERVICE_NAME}"
sudo systemctl --no-pager --full status "${SERVICE_NAME}"
