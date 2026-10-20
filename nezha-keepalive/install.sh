#!/usr/bin/env bash
#
# 一键安装 nezha-agent 开机自启 + 5 分钟保活
# 用法:  sudo ./install.sh
#
set -euo pipefail

SRC_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BIN_DST="/usr/local/bin/nezha-keepalive.sh"
AGENT_CONF="${NZ_AGENT_CONF:-/opt/nezha/agent/config.yml}"

[ "$(id -u)" -eq 0 ] || { echo "请用 root 运行: sudo $0" >&2; exit 1; }

echo "==> 安装保活脚本到 $BIN_DST"
install -m 0755 "$SRC_DIR/nezha-keepalive.sh" "$BIN_DST"

echo "==> 首次试跑（--dry-run）"
NZ_AGENT_CONF="$AGENT_CONF" "$BIN_DST" --dry-run || true

if [ -d /run/systemd/system ] && command -v systemctl >/dev/null 2>&1; then
    echo "==> 检测到 systemd，安装 timer"

    UNIT=$(systemctl list-unit-files --type=service --no-legend 'nezha-agent*.service' 2>/dev/null |
        awk 'NR==1{print $1}' || true)
    if [ -z "$UNIT" ] && [ -f /etc/systemd/system/nezha-agent.service ]; then
        UNIT="nezha-agent.service"
    fi
    if [ -z "$UNIT" ]; then
        echo "!! 未找到 nezha-agent 服务，请先运行官方 install.sh 安装 agent" >&2
        exit 1
    fi
    echo "    agent 单元: $UNIT"

    # 第 1 层：让 systemd 自己无限重启（关掉启动频率限制）
    install -d "/etc/systemd/system/${UNIT}.d"
    install -m 0644 "$SRC_DIR/nezha-agent-restart-override.conf" \
        "/etc/systemd/system/${UNIT}.d/10-restart-always.conf"

    # 第 2 层：5 分钟巡检
    install -m 0644 "$SRC_DIR/nezha-keepalive.service" /etc/systemd/system/nezha-keepalive.service
    install -m 0644 "$SRC_DIR/nezha-keepalive.timer" /etc/systemd/system/nezha-keepalive.timer

    systemctl daemon-reload
    systemctl enable "$UNIT" >/dev/null 2>&1 || true
    systemctl enable --now nezha-keepalive.timer

    echo "==> 完成"
    systemctl --no-pager --lines=0 status "$UNIT" || true
    systemctl list-timers nezha-keepalive.timer --no-pager || true
else
    echo "!! 没有 systemd（容器环境），改用 cron"
    command -v cron >/dev/null 2>&1 || command -v crond >/dev/null 2>&1 || {
        echo "!! 也没有 cron，无法安装定时任务；请手动每 5 分钟执行 $BIN_DST" >&2
        exit 1
    }
    cat >/etc/cron.d/nezha-keepalive <<EOF
# nezha-agent 保活：每 5 分钟检查一次
*/5 * * * * root NZ_AGENT_CONF=$AGENT_CONF $BIN_DST >/dev/null 2>&1
# 开机后补一次
@reboot root sleep 60; NZ_AGENT_CONF=$AGENT_CONF $BIN_DST >/dev/null 2>&1
EOF
    chmod 0644 /etc/cron.d/nezha-keepalive
    echo "==> 已写入 /etc/cron.d/nezha-keepalive"
fi
