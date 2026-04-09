# VPS 代理服务器信息

## 服务器信息

| 项目 | 值 |
|---|---|
| VPS IP | `154.26.188.12` |
| SSH 登录 | `ssh root@154.26.188.12` |
| 操作系统 | Ubuntu 24.04 LTS |
| sing-box 版本 | 1.13.6 |
| 配置文件路径 | `/etc/sing-box/config.json` |
| 服务名称 | `sing-box.service` |

## 两个节点

| 节点 | 端口 | 路径 | 延迟 | 出口 IP |
|---|---|---|---|---|
| VLESS-住宅代理 | 443 | VPS → SOCKS5 住宅 → 目标 | 较高 | 64.51.26.194 |
| VLESS-直连 | 8443 | VPS → 目标 | 较低 | 154.26.188.12 |

## VLESS + Reality 连接信息

| 项目 | 值 |
|---|---|
| UUID | `e042ed1d-6236-471b-b189-7775e27c3c68` |
| Flow | `xtls-rprx-vision` |
| TLS | Reality |
| SNI | `icloud.com` |
| Public Key | `SpQGEu1gmrJzHiXDmr-RNoJaICB6ErytkcuIX1YmJ2c` |
| Private Key | `SI3fmmAe7qJvElm13DebCTPkZYXv8lU00oJJEgdTYlI` |
| Short ID | `73e93f303814f287` |
| 指纹 | `chrome` |

## SOCKS5 住宅代理出口

| 项目 | 值 |
|---|---|
| 代理 IP | `64.51.26.194` |
| 端口 | `443` |
| 用户名 | `KgDqKiRwxTzg` |
| 密码 | `1apZ73OXpE` |

## 客户端 URI

### 住宅代理出口（端口 443）

```
vless://e042ed1d-6236-471b-b189-7775e27c3c68@154.26.188.12:443?encryption=none&flow=xtls-rprx-vision&security=reality&sni=icloud.com&fp=chrome&pbk=SpQGEu1gmrJzHiXDmr-RNoJaICB6ErytkcuIX1YmJ2c&sid=73e93f303814f287&type=tcp#VPS-VLESS-住宅
```

### VPS 直连出口（端口 8443）

```
vless://e042ed1d-6236-471b-b189-7775e27c3c68@154.26.188.12:8443?encryption=none&flow=xtls-rprx-vision&security=reality&sni=icloud.com&fp=chrome&pbk=SpQGEu1gmrJzHiXDmr-RNoJaICB6ErytkcuIX1YmJ2c&sid=73e93f303814f287&type=tcp#VPS-VLESS-直连
```

## Clash Meta 配置

```yaml
proxies:
  # 住宅代理出口
  - type: vless
    name: 'VLESS-住宅代理'
    server: '154.26.188.12'
    port: 443
    uuid: 'e042ed1d-6236-471b-b189-7775e27c3c68'
    tls: true
    servername: 'icloud.com'
    network: tcp
    flow: 'xtls-rprx-vision'
    client-fingerprint: chrome
    reality-opts:
      public-key: 'SpQGEu1gmrJzHiXDmr-RNoJaICB6ErytkcuIX1YmJ2c'
      short-id: '73e93f303814f287'

  # VPS 直连出口
  - type: vless
    name: 'VLESS-直连'
    server: '154.26.188.12'
    port: 8443
    uuid: 'e042ed1d-6236-471b-b189-7775e27c3c68'
    tls: true
    servername: 'icloud.com'
    network: tcp
    flow: 'xtls-rprx-vision'
    client-fingerprint: chrome
    reality-opts:
      public-key: 'SpQGEu1gmrJzHiXDmr-RNoJaICB6ErytkcuIX1YmJ2c'
      short-id: '73e93f303814f287'
```

## sing-box 服务端完整配置

```json
{
  "log": {
    "level": "info",
    "timestamp": true
  },
  "dns": {
    "servers": [
      {
        "tag": "dns-resolver",
        "type": "https",
        "server": "1.1.1.1",
        "detour": "proxy-out"
      }
    ],
    "strategy": "prefer_ipv4"
  },
  "inbounds": [
    {
      "type": "vless",
      "tag": "vless-proxy",
      "listen": "::",
      "listen_port": 443,
      "users": [
        {
          "uuid": "e042ed1d-6236-471b-b189-7775e27c3c68",
          "flow": "xtls-rprx-vision"
        }
      ],
      "tls": {
        "enabled": true,
        "server_name": "icloud.com",
        "reality": {
          "enabled": true,
          "handshake": {
            "server": "icloud.com",
            "server_port": 443
          },
          "private_key": "SI3fmmAe7qJvElm13DebCTPkZYXv8lU00oJJEgdTYlI",
          "short_id": [
            "73e93f303814f287"
          ]
        }
      }
    },
    {
      "type": "vless",
      "tag": "vless-direct",
      "listen": "::",
      "listen_port": 8443,
      "users": [
        {
          "uuid": "e042ed1d-6236-471b-b189-7775e27c3c68",
          "flow": "xtls-rprx-vision"
        }
      ],
      "tls": {
        "enabled": true,
        "server_name": "icloud.com",
        "reality": {
          "enabled": true,
          "handshake": {
            "server": "icloud.com",
            "server_port": 443
          },
          "private_key": "SI3fmmAe7qJvElm13DebCTPkZYXv8lU00oJJEgdTYlI",
          "short_id": [
            "73e93f303814f287"
          ]
        }
      }
    }
  ],
  "outbounds": [
    {
      "type": "socks",
      "tag": "proxy-out",
      "server": "64.51.26.194",
      "server_port": 443,
      "username": "KgDqKiRwxTzg",
      "password": "1apZ73OXpE"
    },
    {
      "type": "direct",
      "tag": "direct"
    }
  ],
  "route": {
    "default_domain_resolver": "dns-resolver",
    "rules": [
      {
        "inbound": ["vless-direct"],
        "outbound": "direct"
      },
      {
        "inbound": ["vless-proxy"],
        "outbound": "proxy-out"
      }
    ],
    "final": "proxy-out"
  }
}
```

## 常用管理命令

```bash
# 查看服务状态
systemctl status sing-box

# 查看实时日志
journalctl -u sing-box -f

# 重启服务
systemctl restart sing-box

# 停止服务
systemctl stop sing-box

# 启动服务
systemctl start sing-box

# 验证配置文件
sing-box check -c /etc/sing-box/config.json

# 编辑配置
nano /etc/sing-box/config.json
```

## 备注

- 住宅代理节点 DNS 通过 SOCKS5 代理查询 (DoH 1.1.1.1)，防止 DNS 泄漏
- 直连节点 DNS 同样通过代理查询，保证一致性
- 两个节点共享相同的 UUID 和密钥，仅端口不同
- 部署日期：2026-04-07
