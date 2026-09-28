# NexoFolio 阿里云前端部署

本地构建 → 上传 OSS → 服务器下载并校验 ZIP → 解压为独立版本 → 原子切换 `current` → Nginx 提供 HTTPS。

本文中的服务器命令由你手动执行；本次仅在本机准备文件、构建并验证，不代表服务器已部署或证书已签发。

- 域名：`nexofolio.net`；本次不包含 `www`。
- OSS：`oss://asynctest/linux_files/nexofolio/front/`，深圳地域。
- 服务器目录：`/home/nexofolio/front`。
- Nginx root：`/home/nexofolio/front/current/dist`。
- 当前仅部署静态前端；登录、项目等依赖后端的功能暂不可用，`/api` 返回明确的 503 JSON。

## 1. 本地配置与上传

需要 Node.js >= 22.13.0、项目指定的 pnpm、zip 和 ossutil。脚本使用 `pnpm install --frozen-lockfile` 和 `pnpm build`（包含类型检查），构建时固定同源 `/api` 与 live 数据来源。

OSS 密钥不写入项目。本地上传使用现有 ossutil 配置，或通过交互方式创建专用配置；服务器通过 HTTPS 匿名下载公共读对象，无需配置密钥：

```bash
mkdir -p ~/.config/nexofolio
ossutil config -c ~/.config/nexofolio/ossutil.config
chmod 600 ~/.config/nexofolio/ossutil.config
```

交互中 Endpoint 填 `oss-cn-shenzhen.aliyuncs.com`；AccessKey 在本机终端输入。不同 ossutil 版本若要求 Region，填写 `cn-shenzhen`。

```bash
cd /Users/sheldon/Documents/GithubProject/NexoFolio-Front
OSS_CONFIG_FILE="$HOME/.config/nexofolio/ossutil.config" ./upload-server.sh
```

脚本会自动读取已存在的 `~/.config/nexofolio/ossutil.config`，也可直接运行 `./upload-server.sh`；显式传入 `OSS_CONFIG_FILE` 时以该路径为准，否则最后回退到 ossutil 默认配置。如果 VSCode 新终端找不到 pnpm 或 Node 版本不符合要求，脚本会加载本机 nvm，并按 `.nvmrc` 切换到已安装的 Node，不需要每次手工 export PATH。只构建、暂不上传可用 `./upload-server.sh --build-only`。

上传对象结构：

```text
linux_files/nexofolio/front/
  latest.txt                         # 版本号 + ZIP 的 SHA-256，最后上传
  releases/<版本号>/dist.zip           # ZIP 内含 dist/index.html 和静态资源
```

本地产物保存在 Git 忽略的 `artifacts/front-releases/<版本号>/`。上传包成功后才更新 `latest.txt`，服务器通过该清单下载对应版本。不要同时运行多个本地发布，否则最后写入清单的版本会成为最新版。

## 2. 首次将部署文件复制到服务器

以下命令在本地执行，将 `你的服务器IP` 替换为实际公网 IP；如使用其他 SSH 用户，请相应调整并使用 sudo 安装文件。

```bash
ssh root@你的服务器IP 'mkdir -p /home/nexofolio/front/deploy'
scp deploy/update-front.sh root@你的服务器IP:/home/nexofolio/front/
scp deploy/nexofolio.net.conf deploy/nexofolio.net.bootstrap.conf.example \
  root@你的服务器IP:/home/nexofolio/front/deploy/
```

后续步骤在服务器执行。服务器需要 Bash、Python 3、curl、Nginx、Certbot；无需安装 Node.js 或 ossutil。现有 AsyncTest Nginx 已由 Certbot 管理，可先 `certbot --version` 检查是否可复用。若尚未安装 Certbot，请按[官方安装说明](https://certbot.eff.org/instructions)选择服务器实际操作系统。

文件变更范围：首次新增 `/home/nexofolio/front/update-front.sh` 和 `deploy/` 下两个配置副本（再次复制会覆盖同名文件）；`/etc/nginx/conf.d/nexofolio.net.conf` 首次新增，申请证书后会由 HTTPS 版本覆盖。若服务器已经存在同名站点配置，请先备份再执行 `cp`。主配置 `/etc/nginx/nginx.conf` 保持不动。

确保 `latest.txt` 和对应的 `dist.zip` 都允许公共读，然后在服务器直接拉取：

```bash
chmod +x /home/nexofolio/front/update-front.sh
bash /home/nexofolio/front/update-front.sh
```

服务器脚本不读取 ossutil 配置或 AccessKey；之前配置的凭证也不会被使用。脚本先校验 SHA-256、ZIP 路径、入口文件，再切换 `current`；失败时保留当前已部署版本。`previous` 指向上一版本，历史版本保留在 `releases/`。

## 3. DNS 与首次 HTTP 配置

在域名 DNS 中将 `nexofolio.net` 的 A 记录指向这台服务器公网 IPv4，并确保阿里云安全组及服务器防火墙允许入站 TCP 80、443。当前配置使用 IPv4；若已有 AAAA 记录，请先移除，或另行配置好 IPv6 监听及连通性后再申请。Certbot 的 HTTP 验证和后续续期都需要公网能访问 80 端口。

你提供的主配置已有 `include /etc/nginx/conf.d/*.conf;`，因此只新增独立站点文件即可。不要替换整个 `/etc/nginx/nginx.conf`，也不要修改 AsyncTest 的证书和站点。

```bash
mkdir -p /var/www/letsencrypt/.well-known/acme-challenge
chmod 755 /var/www/letsencrypt /var/www/letsencrypt/.well-known \
  /var/www/letsencrypt/.well-known/acme-challenge
cp /home/nexofolio/front/deploy/nexofolio.net.bootstrap.conf.example \
  /etc/nginx/conf.d/nexofolio.net.conf
nginx -t && systemctl reload nginx
printf 'nexofolio-acme-ok\n' > /var/www/letsencrypt/.well-known/acme-challenge/check
```

从本机或其他公网机器访问 `http://nexofolio.net/.well-known/acme-challenge/check`，应返回 `nexofolio-acme-ok`。验证成功再申请证书。首次配置只有 HTTP，避免证书尚不存在时 Nginx 无法加载。

## 4. 用 Certbot 申请免费证书并开启 HTTPS

使用 Let's Encrypt 免费证书。以下命令在服务器执行，交互时填写你的联系邮箱并确认服务条款。Webroot 方式利用现有 Nginx 完成验证，无需停机。

```bash
certbot certonly --webroot \
  --webroot-path /var/www/letsencrypt \
  --cert-name nexofolio.net \
  -d nexofolio.net
```

申请成功后检查证书路径，并启用正式配置：

```bash
test -s /etc/letsencrypt/live/nexofolio.net/fullchain.pem
test -s /etc/letsencrypt/live/nexofolio.net/privkey.pem
cp /home/nexofolio/front/deploy/nexofolio.net.conf \
  /etc/nginx/conf.d/nexofolio.net.conf
nginx -t && systemctl reload nginx
```

现在 HTTP 自动跳转 HTTPS，ACME 验证目录仍通过 HTTP 提供，供后续续期使用。只有证书签发成功后才复制正式 HTTPS 配置；若 `nginx -t` 失败，应恢复 bootstrap 配置并检查报错。

正式配置对 `/nexofolio/nexofolio-elastic.mjs` 显式设置 `text/javascript`，兼容未包含 `.mjs` 映射的旧版系统 `mime.types`。缺少该配置时，浏览器会拒绝加载动画模块，首页仅显示静态备用图，无法播放或拖动。更新配置可用 `/bin/cp -f` 覆盖，以绕过 root 的交互式 `cp` 别名，然后执行 `nginx -t && systemctl reload nginx`。

## 5. 续期与验证

安装续期成功后的重载钩子（不会主动更改其他站点配置）：

```bash
mkdir -p /etc/letsencrypt/renewal-hooks/deploy
cat > /etc/letsencrypt/renewal-hooks/deploy/nexofolio-reload-nginx.sh <<'SH'
#!/bin/sh
set -eu
nginx -t
systemctl reload nginx
SH
chmod 755 /etc/letsencrypt/renewal-hooks/deploy/nexofolio-reload-nginx.sh
certbot renew --cert-name nexofolio.net --dry-run
/etc/letsencrypt/renewal-hooks/deploy/nexofolio-reload-nginx.sh
```

`--dry-run` 验证续期流程；默认不会执行 deploy hook，所以上面另行执行一次钩子验证配置与重载。

确认系统已经有 Certbot 定时任务：

```bash
systemctl list-timers --all | grep -i certbot
ls /etc/cron.d/
crontab -l
```

已有 timer/cron 时直接复用。只有确认没有自动续期任务时，再创建下面的专用 cron（要求服务器 cron 服务已启用）：

```bash
CERTBOT_BIN="$(command -v certbot)"
test -n "$CERTBOT_BIN" && printf 'PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin\n17 3,15 * * * root %s renew --cert-name nexofolio.net --quiet\n' "$CERTBOT_BIN" \
  > /etc/cron.d/nexofolio-certbot
chmod 644 /etc/cron.d/nexofolio-certbot
```

最后验证：

```bash
curl -I http://nexofolio.net/
curl -I https://nexofolio.net/
curl -I https://nexofolio.net/settings
curl -i https://nexofolio.net/api/v1/auth/me
curl -I https://nexofolio.net/assets/does-not-exist.js
```

预期依次为：301 跳转、200、SPA 路由 200、后端未接入的 503 JSON、不存在静态资源的 404。浏览器还需确认页面和实际 JS/CSS 均可加载。

## 6. 日常更新与回退

本地运行 `./upload-server.sh`（使用专用配置时继续加 `OSS_CONFIG_FILE=...`），然后服务器运行：

```bash
bash /home/nexofolio/front/update-front.sh
# 需要时回退到上一个版本，不访问 OSS：
bash /home/nexofolio/front/update-front.sh --rollback
```

静态代码更新不需要重载 Nginx。回退后下一次普通更新会重新部署 OSS `latest.txt` 指向的版本。脚本不自动删除历史版本；按需清理时保留 `current`、`previous` 指向的两个目录。已打开的旧页面若在更新后加载旧版本延迟资源失败，刷新页面即可获取新入口。

脚本使用 `.update-lock` 防止服务器并发更新；若进程被强制杀死而留下锁，先确认没有更新进程，再手工删除该空锁目录。服务器支持通过环境变量覆盖 `DEPLOY_DIR`、`OSS_BUCKET`、`OSS_PATH` 和 `OSS_ENDPOINT`（填写不带协议的 OSS 域名）。`OSS_CONFIG_FILE` 和 `OSSUTIL_BIN` 仅用于本地上传脚本。

后端接入时，按仓库 README 的 `/api` 反向代理配置替换两个 503 location，目标端口以服务器实际后端为准。

参考：[Certbot Webroot 与续期](https://eff-certbot.readthedocs.io/en/stable/using.html)、[Nginx 静态目录和路由](https://nginx.org/en/docs/http/ngx_http_core_module.html)、[ossutil 配置](https://www.alibabacloud.com/help/en/oss/developer-reference/configure-ossutil)。
