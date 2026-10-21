#!/usr/bin/env bash
#
# 幂等启动 supervisord（无 init / 无 systemd 的环境里用于“重新拉起”）
#   已在运行 -> 只打印状态，不会起第二份
#   未运行   -> 清理陈旧单实例状态文件后启动
#
set -uo pipefail

BASE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CONF="${SUPERVISOR_CONF:-$BASE/supervisord.conf}"

SCTL="${NZ_SUPERVISORCTL:-$(command -v supervisorctl || true)}"
[ -n "$SCTL" ] || SCTL="/usr/bin/supervisorctl"
SD="$(dirname "$SCTL")/supervisord"
[ -x "$SD" ] || SD="$(command -v supervisord || true)"
[ -x "$SD" ] || { echo "ERROR: 找不到 supervisord，请先安装 supervisor" >&2; exit 1; }
[ -f "$CONF" ] || { echo "ERROR: 找不到配置 $CONF" >&2; exit 1; }

if "$SCTL" -c "$CONF" pid >/dev/null 2>&1; then
    echo "supervisord 已在运行，pid=$("$SCTL" -c "$CONF" pid)"
else
    # 上一次被 SIGKILL / 容器重启后，残留的 agent-*.stat 会让新实例不建连
    [ -d /tmp/nezha-agent ] && rm -rf /tmp/nezha-agent
    "$SD" -c "$CONF"
    sleep 3
    echo "supervisord 已启动，pid=$("$SCTL" -c "$CONF" pid 2>/dev/null)"
fi

"$SCTL" -c "$CONF" status
