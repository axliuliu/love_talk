#!/usr/bin/env bash
#
# supervisor 用的自愈循环：每 NZ_INTERVAL 秒（默认 10）巡检一次，
# 掉线/掉进程时由 nezha-keepalive.sh 通过 supervisorctl 重启 nezha-agent。
# 本脚本本身也由 supervisor 守护，挂了会被重新拉起。
#
set -uo pipefail

INTERVAL="${NZ_INTERVAL:-10}"
CHECK="${NZ_CHECK:-/usr/local/bin/nezha-keepalive.sh}"

while :; do
    "$CHECK"
    sleep "$INTERVAL"
done
