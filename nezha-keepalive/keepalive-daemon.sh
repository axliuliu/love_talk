#!/usr/bin/env bash
#
# nezha-agent 保活守护（没有 systemd / cron 的环境用这个，例如容器）
#   每 NZ_INTERVAL 秒（默认 300）执行一次 nezha-keepalive.sh
#   flock 保证同时只有一个守护在跑
#
# 用法: NZ_BASE=/home/node/nezha ./keepalive-daemon.sh &
#       NZ_INTERVAL=60 ... （调小间隔做测试）
#
set -uo pipefail

BASE="${NZ_BASE:-/opt/nezha}"
INTERVAL="${NZ_INTERVAL:-300}"
CHECK="${NZ_CHECK:-/usr/local/bin/nezha-keepalive.sh}"
LOCK="$BASE/keepalive.lock"
OUT="$BASE/keepalive-daemon.log"

export NZ_AGENT_BIN="${NZ_AGENT_BIN:-$BASE/agent/nezha-agent}"
export NZ_AGENT_CONF="${NZ_AGENT_CONF:-$BASE/agent/config.yml}"
export NZ_STATE_DIR="${NZ_STATE_DIR:-$BASE/state}"
export NZ_LOG_FILE="${NZ_LOG_FILE:-$BASE/keepalive.log}"
export NZ_AGENT_OUT_LOG="${NZ_AGENT_OUT_LOG:-$BASE/agent/agent.out}"

mkdir -p "$BASE" "$NZ_STATE_DIR"

log() { printf '%s %s\n' "$(date '+%F %T')" "$*" >>"$OUT"; }

# 单实例锁：第二个守护直接退出，不会重复拉起 agent
exec 9>"$LOCK"
if ! flock -n 9; then
    log "已有守护在运行（锁 $LOCK 被占用），本次退出"
    exit 0
fi

log "守护启动 pid=$$ interval=${INTERVAL}s check=$CHECK"
trap 'log "守护退出 pid=$$"; exit 0' TERM INT

while :; do
    "$CHECK" >>"$OUT" 2>&1 9>&-
    rc=$?
    log "巡检完成 rc=$rc, 下次 $(date -d "+${INTERVAL} seconds" '+%F %T')"
    # 9>&- ：不要让子进程（含 agent）继承锁 fd，否则守护死后锁不释放
    sleep "$INTERVAL" 9>&- &
    wait $!
done
