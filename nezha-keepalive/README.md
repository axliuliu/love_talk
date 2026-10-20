# Nezha Agent 开机自启 + 5 分钟保活

针对 Nezha（哪吒监控）agent 的「开机自启 + 掉线自动拉起」方案，两层保险：

| 层 | 机制 | 作用 |
|---|---|---|
| 1 | `systemctl enable nezha-agent` + drop-in `Restart=always` / `StartLimitIntervalSec=0` | 进程崩溃秒级自愈（10s），且不会因为反复重启被 systemd 限流放弃 |
| 2 | `nezha-keepalive.timer`（5 分钟） | 进程没了就 `start`；进程在但**连不上面板**就 `restart`；面板整体不可达时只记录不折腾 |

> agent 自带的 systemd 单元只有 `StartLimitInterval=5` / `StartLimitBurst=10`，一小时反复崩溃超过 10 次就会被 systemd 拒绝再启动 —— 第 1 层的 drop-in 就是解决这个。

## 文件

| 文件 | 说明 |
|---|---|
| `nezha-keepalive.sh` | 巡检脚本（自动探测 `nezha-agent*.service`，无 systemd 时退化为直接拉进程） |
| `nezha-keepalive.service` | oneshot 服务 |
| `nezha-keepalive.timer` | 开机 90s 后首次执行，之后每 5 分钟 |
| `nezha-agent-restart-override.conf` | agent 单元的 drop-in（Restart=always、关闭启动限流） |
| `install.sh` | 一键安装（有 systemd 用 timer，没有就用 cron） |

## 安装

先把整个目录传到服务器，然后：

```bash
scp -r nezha-keepalive root@你的服务器:/root/
ssh root@你的服务器
cd /root/nezha-keepalive
chmod +x install.sh nezha-keepalive.sh
sudo ./install.sh
```

或者直接在服务器上手工三步：

```bash
sudo install -m 0755 nezha-keepalive.sh /usr/local/bin/nezha-keepalive.sh
sudo install -m 0644 nezha-keepalive.service nezha-keepalive.timer /etc/systemd/system/
sudo install -d /etc/systemd/system/nezha-agent.service.d
sudo install -m 0644 nezha-agent-restart-override.conf \
     /etc/systemd/system/nezha-agent.service.d/10-restart-always.conf
sudo systemctl daemon-reload
sudo systemctl enable nezha-agent
sudo systemctl enable --now nezha-keepalive.timer
```

> 单元名不是 `nezha-agent.service` 时（例如多实例），先 `systemctl list-unit-files 'nezha-agent*'` 确认，
> drop-in 目录改成对应的 `<单元名>.d`，或给脚本传 `NZ_AGENT_UNIT=<单元名>`。

## 验证

```bash
systemctl list-timers nezha-keepalive.timer       # NEXT 应在 5 分钟内
sudo /usr/local/bin/nezha-keepalive.sh --dry-run  # 只判断不动手
sudo /usr/local/bin/nezha-keepalive.sh            # 真跑一次
tail -f /var/log/nezha-keepalive.log
journalctl -u nezha-keepalive -n 30 --no-pager
```

故意制造掉线来验证：

```bash
sudo systemctl stop nezha-agent        # 模拟进程消失 -> 下次巡检 start
sudo pkill -9 -x nezha-agent           # 模拟崩溃 -> systemd 10s 内自己拉起
sudo iptables -A OUTPUT -p tcp --dport 10063 -j DROP   # 模拟连不上面板 -> 10 分钟后 restart（测完 -D 删掉）
```

## 可调参数（环境变量）

| 变量 | 默认 | 说明 |
|---|---|---|
| `NZ_AGENT_BIN` | `/opt/nezha/agent/nezha-agent` | agent 路径 |
| `NZ_AGENT_CONF` | `/opt/nezha/agent/config.yml` | 配置路径（多实例时指向对应 config） |
| `NZ_AGENT_UNIT` | 自动探测 | systemd 单元名 |
| `NZ_FAIL_THRESHOLD` | `2` | 连续几次「进程在但没连上」才重启（2 × 5min = 10min） |
| `NZ_CONNECT_TIMEOUT` | `5` | 探测面板端口超时（秒） |
| `NZ_LOG_FILE` | `/var/log/nezha-keepalive.log` | 日志（超 1MB 自动轮转一份 `.1`） |
| `NZ_STATE_DIR` | `/run/nezha-keepalive` | 失败计数/状态（重启后归零，符合预期） |
| `NZ_DRY_RUN` | `0` | `1` 或 `--dry-run`：只打印将要执行的动作 |

改阈值示例（写进 timer 的 drop-in 或改 service 的 `Environment=`）：

```ini
# /etc/systemd/system/nezha-keepalive.service.d/env.conf
[Service]
Environment=NZ_FAIL_THRESHOLD=1
```

## 卸载

```bash
sudo systemctl disable --now nezha-keepalive.timer
sudo rm -f /etc/systemd/system/nezha-keepalive.{service,timer}
sudo rm -rf /etc/systemd/system/nezha-agent.service.d
sudo rm -f /usr/local/bin/nezha-keepalive.sh /var/log/nezha-keepalive.log*
sudo systemctl daemon-reload
```

## 注意

- 脚本从 `config.yml` 读 `server` / `tls` 判断面板地址；没有端口时按 `tls: true -> 443`、否则 `8008` 处理。
- 这里只做「本机侧」保活。如果面板本身挂了，agent 重启也没用，所以脚本会先探测面板端口，不可达时只记日志。
- 没有 systemd 的容器里，第 1 层失效，`install.sh` 会退化成 `/etc/cron.d/nezha-keepalive`（`*/5` + `@reboot`），但容器重启后仍需宿主重新拉起容器。
