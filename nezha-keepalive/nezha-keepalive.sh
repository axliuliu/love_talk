#!/usr/bin/env bash
#
# nezha-agent 保活巡检脚本
#   1. 进程不在 -> 拉起
#   2. 进程在但未与面板建立 TCP 连接（连续 N 次）-> 重启
#   3. 面板端口本身不可达 -> 只记录，不重启（重启也没用，避免无效抖动）
#
# 用法:  nezha-keepalive.sh [--dry-run]
# 退出码: 0 正常 / 已处置; 1 处置失败
#
set -uo pipefail

AGENT_BIN="${NZ_AGENT_BIN:-/opt/nezha/agent/nezha-agent}"
AGENT_CONF="${NZ_AGENT_CONF:-/opt/nezha/agent/config.yml}"
AGENT_UNIT="${NZ_AGENT_UNIT:-}"           # 留空则自动探测 nezha-agent*.service
STATE_DIR="${NZ_STATE_DIR:-/run/nezha-keepalive}"
LOG_FILE="${NZ_LOG_FILE:-/var/log/nezha-keepalive.log}"
AGENT_OUT_LOG="${NZ_AGENT_OUT_LOG:-/var/log/nezha-agent.out}"
FAIL_THRESHOLD="${NZ_FAIL_THRESHOLD:-2}"  # 连续 N 次未连接才重启（2 x 5min = 10min）
CONNECT_TIMEOUT="${NZ_CONNECT_TIMEOUT:-5}"
STARTUP_GRACE="${NZ_STARTUP_GRACE:-25}"   # 进程启动不足 N 秒时不做“是否连上”判定（10s 巡检必须留）
RESTART_COOLDOWN="${NZ_RESTART_COOLDOWN:-60}"  # 两次 restart 的最小间隔，防止重连风暴
STALE_STATE_DIR="${NZ_STATE_FILE_DIR:-/tmp/nezha-agent}"  # agent 单实例状态文件目录
MAX_LOG_BYTES="${NZ_MAX_LOG_BYTES:-1048576}"
DRY_RUN="${NZ_DRY_RUN:-0}"

[ "${1:-}" = "--dry-run" ] && DRY_RUN=1

HOST=""
PORT=""

log() {
    local msg
    msg="$(date '+%F %T') $*"
    printf '%s\n' "$msg" >&2
    if [ -n "$LOG_FILE" ]; then
        printf '%s\n' "$msg" >>"$LOG_FILE" 2>/dev/null
    fi
}

rotate_log() {
    [ -n "$LOG_FILE" ] || return 0
    [ -f "$LOG_FILE" ] || return 0
    local size
    size=$(stat -c %s "$LOG_FILE" 2>/dev/null || echo 0)
    [ "$size" -gt "$MAX_LOG_BYTES" ] && mv -f "$LOG_FILE" "$LOG_FILE.1" 2>/dev/null
    return 0
}

# 读取 config.yml 中的顶层 key（只取第一个匹配）
read_cfg() {
    [ -f "$AGENT_CONF" ] || return 0
    awk -v key="$1" '
        $0 ~ "^[[:space:]]*"key":[[:space:]]*" {
            sub("^[[:space:]]*"key":[[:space:]]*", "")
            gsub(/^["\x27]|["\x27]$/, "")
            print; exit
        }' "$AGENT_CONF"
}

# 解析 server 字段: host:port / [v6]:port / host
parse_server() {
    local s="$1"
    if [[ "$s" == \[*\]:* ]]; then
        HOST="${s%%]:*}"; HOST="${HOST#[}"
        PORT="${s##*]:}"
    elif [[ "$s" == *:* ]]; then
        HOST="${s%:*}"; PORT="${s##*:}"
    else
        HOST="$s"; PORT=""
    fi
}

have_systemd() {
    command -v systemctl >/dev/null 2>&1 && [ -d /run/systemd/system ]
}

# 排除僵尸进程（Z），僵尸没有任何入站/出站连接，不能算“活着”
agent_pids() {
    local p state
    for p in $(pgrep -x nezha-agent 2>/dev/null); do
        state=$(sed 's/.*) //' "/proc/$p/stat" 2>/dev/null | cut -d' ' -f1)
        [ "$state" = "Z" ] && continue
        printf '%s\n' "$p"
    done
}

detect_unit() {
    if [ -n "$AGENT_UNIT" ]; then
        echo "$AGENT_UNIT"
        return 0
    fi
    have_systemd || return 0
    local u
    u=$(systemctl list-unit-files --type=service --no-legend 'nezha-agent*.service' 2>/dev/null |
        awk 'NR==1{print $1}')
    if [ -z "$u" ] && [ -f /etc/systemd/system/nezha-agent.service ]; then
        u="nezha-agent.service"
    fi
    echo "$u"
}

# 进程已运行秒数（依赖 /proc/PID/stat 的 starttime + /proc/stat btime）
proc_age() {
    local pid="$1" st btime hz
    st=$(sed 's/.*) //' "/proc/$pid/stat" 2>/dev/null | awk '{print $20}')
    btime=$(awk '/^btime/{print $2}' /proc/stat 2>/dev/null)
    hz=$(getconf CLK_TCK 2>/dev/null || echo 100)
    [ -n "$st" ] && [ -n "$btime" ] || return 1
    echo $(( $(date +%s) - btime - st / hz ))
}

# 判断 pid 是否持有到面板端口的 ESTABLISHED 连接
is_connected() {
    local pid="$1" hexport sock_inodes
    [ -n "$HOST" ] && [ -n "$PORT" ] || return 1
    hexport=$(printf '%04X' "$PORT" 2>/dev/null) || return 1

    if command -v ss >/dev/null 2>&1; then
        ss -tnp state established "dport = :$PORT" 2>/dev/null | grep -q "pid=$pid,"
        return $?
    fi

    # 没有 ss 时回退到 /proc（对比 socket inode）
    sock_inodes=$(ls -l "/proc/$pid/fd" 2>/dev/null |
        sed -n 's/.*socket:\[\([0-9][0-9]*\)\].*/\1/p' | tr '\n' ' ')
    [ -n "$sock_inodes" ] || return 1
    awk -v hexport="$hexport" -v inodes="$sock_inodes" '
        BEGIN { n = split(inodes, a, " "); for (i = 1; i <= n; i++) want[a[i]] = 1 }
        FNR == 1 { next }
        {
            split($3, rem, ":")
            if (rem[2] == hexport && $4 == "01" && ($10 in want)) found = 1
        }
        END { exit(found ? 0 : 1) }
    ' /proc/net/tcp /proc/net/tcp6 2>/dev/null
}

panel_reachable() {
    local target="$HOST"
    [[ "$HOST" == *:* ]] && target="[$HOST]"
    timeout "$CONNECT_TIMEOUT" bash -c "exec 3<>/dev/tcp/$target/$PORT" 2>/dev/null
}

set_last_status() {
    [ "$DRY_RUN" = 1 ] && return 0
    mkdir -p "$STATE_DIR" 2>/dev/null
    printf '%s\n' "$1" >"$STATE_DIR/last_status" 2>/dev/null
}

last_status() {
    cat "$STATE_DIR/last_status" 2>/dev/null || echo none
}

bump_fail() {
    local n=0
    mkdir -p "$STATE_DIR" 2>/dev/null
    [ -f "$STATE_DIR/fail_count" ] && n=$(cat "$STATE_DIR/fail_count" 2>/dev/null)
    case "$n" in ''|*[!0-9]*) n=0 ;; esac
    n=$((n + 1))
    [ "$DRY_RUN" = 1 ] || printf '%s\n' "$n" >"$STATE_DIR/fail_count" 2>/dev/null
    echo "$n"
}

reset_fail() {
    [ "$DRY_RUN" = 1 ] && return 0
    rm -f "$STATE_DIR/fail_count" 2>/dev/null
}

service_action() {
    local action="$1" unit
    unit=$(detect_unit)

    if [ "$DRY_RUN" = 1 ]; then
        log "DRY-RUN: would $action agent (unit=${unit:-none}, bin=$AGENT_BIN)"
        return 0
    fi

    # supervisor 模式：必须经 supervisorctl 操作，否则会和 supervisord 抢进程
    if [ "${NZ_SUPERVISOR:-0}" = "1" ]; then
        local sctl="${NZ_SUPERVISORCTL:-supervisorctl}"
        local conf="${SUPERVISOR_CONF:-/etc/supervisor/supervisord.conf}"
        local prog="${NZ_SUPERVISOR_PROG:-nezha-agent}"
        "$sctl" -c "$conf" clear "$prog" >/dev/null 2>&1
        if [ "$action" = "restart" ]; then
            "$sctl" -c "$conf" restart "$prog" >/dev/null 2>&1
        else
            "$sctl" -c "$conf" start "$prog" >/dev/null 2>&1
        fi
        return $?
    fi

    if have_systemd && [ -n "$unit" ]; then
        systemctl reset-failed "$unit" >/dev/null 2>&1
        if systemctl "$action" "$unit"; then
            return 0
        fi
        log "ERROR: systemctl $action $unit failed"
        return 1
    fi

    if [ -x /etc/init.d/nezha-agent ]; then
        /etc/init.d/nezha-agent "$action"
        return $?
    fi

    # 兜底：没有服务管理器时直接拉起进程（容器场景）
    if [ "$action" = "restart" ]; then
        pkill -x nezha-agent >/dev/null 2>&1
        sleep 1
    fi
    nohup "$AGENT_BIN" -c "$AGENT_CONF" >>"$AGENT_OUT_LOG" 2>&1 &
    sleep 2
    [ -n "$(agent_pids)" ]
}

main() {
    rotate_log

    if [ ! -x "$AGENT_BIN" ]; then
        log "ERROR: agent 不存在或不可执行: $AGENT_BIN"
        exit 1
    fi
    if [ ! -f "$AGENT_CONF" ]; then
        log "ERROR: 找不到配置: $AGENT_CONF"
        exit 1
    fi

    local server tls
    server=$(read_cfg server)
    tls=$(read_cfg tls)
    parse_server "$server"
    if [ -z "$PORT" ]; then
        if [ "$tls" = "true" ]; then PORT=443; else PORT=8008; fi
    fi
    if [ -z "$HOST" ] || ! [[ "$PORT" =~ ^[0-9]+$ ]]; then
        log "ERROR: 无法从 $AGENT_CONF 解析 server（当前: '$server'）"
        exit 1
    fi

    local pids pid connected=0
    pids=$(agent_pids)

    if [ -z "$pids" ]; then
        log "进程不存在，执行 start（面板 $HOST:$PORT）"
        if service_action start; then
            if [ "$DRY_RUN" = 1 ] || [ -n "$(agent_pids)" ]; then
                reset_fail
                set_last_status started
                [ "$DRY_RUN" = 1 ] && { log "DRY-RUN: start 逻辑通过"; exit 0; }
                log "已拉起 nezha-agent"
                exit 0
            fi
        fi
        log "ERROR: 拉起 nezha-agent 失败"
        exit 1
    fi

    for pid in $pids; do
        if is_connected "$pid"; then
            connected=1
            break
        fi
    done

    if [ "$connected" = "1" ]; then
        reset_fail
        [ "$(last_status)" = "ok" ] || log "连接正常（pid=$pid, $HOST:$PORT）"
        set_last_status ok
        exit 0
    fi

    log "进程在（pid=$(echo "$pids" | tr '\n' ' ')）但未连上 $HOST:$PORT"

    # 启动宽限期：agent 刚起来那几秒必然还没建立连接，不能判成掉线
    local age
    age=$(proc_age "$(echo "$pids" | awk 'NR==1{print $1}')")
    if [ -n "$age" ] && [ "$age" -lt "$STARTUP_GRACE" ]; then
        log "进程仅运行 ${age}s（< ${STARTUP_GRACE}s 宽限期），跳过连接判定"
        exit 0
    fi

    if ! panel_reachable; then
        log "面板 $HOST:$PORT 不可达，先不重启（重启无法解决，等面板恢复）"
        exit 0
    fi

    local n
    n=$(bump_fail)
    if [ "$n" -lt "$FAIL_THRESHOLD" ]; then
        log "连续失败第 $n/$FAIL_THRESHOLD 次，暂不重启"
        exit 0
    fi

    log "连续失败达 $FAIL_THRESHOLD 次，执行 restart"

    # 重启冷却：避免 agent 刚起就被判掉线、反复重连把面板打爆
    local now last elapsed
    now=$(date +%s)
    last=$(cat "$STATE_DIR/last_restart" 2>/dev/null || echo 0)
    case "$last" in ''|*[!0-9]*) last=0 ;; esac
    elapsed=$((now - last))
    if [ "$last" -gt 0 ] && [ "$elapsed" -lt "$RESTART_COOLDOWN" ]; then
        log "距上次重启仅 ${elapsed}s（< ${RESTART_COOLDOWN}s 冷却），本次跳过"
        exit 0
    fi
    [ "$DRY_RUN" = 1 ] || { mkdir -p "$STATE_DIR" 2>/dev/null; printf '%s\n' "$now" >"$STATE_DIR/last_restart" 2>/dev/null; }

    # 清理陈旧单实例状态文件：agent 被 SIGKILL 后残留的 agent-*.stat 会让新实例
    # 起来却不建连（本机实测踩过）。只删超过 60s 没更新的，避免误删活跃实例的
    if [ "${NZ_CLEAN_STALE_STATE:-1}" = "1" ] && [ -d "$STALE_STATE_DIR" ]; then
        local f mtime
        for f in "$STALE_STATE_DIR"/agent-*.stat; do
            [ -e "$f" ] || continue
            mtime=$(stat -c %Y "$f" 2>/dev/null || echo 0)
            if [ "$((now - mtime))" -gt 60 ]; then
                log "清理陈旧状态文件: $f"
                [ "$DRY_RUN" = 1 ] || rm -f "$f" 2>/dev/null
            fi
        done
    fi

    reset_fail
    if service_action restart; then
        if [ "$DRY_RUN" = 1 ] || [ -n "$(agent_pids)" ]; then
            set_last_status restarted
            [ "$DRY_RUN" = 1 ] && { log "DRY-RUN: restart 逻辑通过"; exit 0; }
            log "已重启 nezha-agent"
            exit 0
        fi
    fi
    log "ERROR: 重启 nezha-agent 失败"
    exit 1
}

main "$@"

