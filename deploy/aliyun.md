# NexoFolio 双环境前端发布与阿里云部署

本地构建 → 上传 OSS → 服务器下载并校验 ZIP → 解压为独立版本 → 原子切换 `current` → Nginx 提供 HTTPS。

本文中的服务器命令由你手动执行；本次仅在本机准备文件、构建并验证，不代表服务器已部署或证书已签发。

- 域名：`nexofolio.net`；本次不包含 `www`。
- OSS：`oss://asynctest/linux_files/nexofolio/front/`，深圳地域。
- 服务器目录：`/home/nexofolio/front`。
- Nginx root：`/home/nexofolio/front/current/dist`。
- 仓库中的 Nginx 示例保留 `/api` 的 503 占位；后端部署时应替换为实际代理，登录与项目请求才能到达后端。

线上发布脚本现在默认使用 `VITE_WORKSPACE_ENABLED=true`：点击登录或工作空间入口会走真实登录和会话验证流程，不再默认显示「敬请期待」。本地开发同样默认开放登录；发布脚本显式传入该值，不修改本地环境文件。

直接运行 `./upload-server.sh` 会从同一份源码快照构建并发布外网、内网两个版本，再分别更新服务器静态产物。该值属于构建时配置，已经部署的旧产物仍需替换才会生效。仅在刻意发布预览版时使用 `VITE_WORKSPACE_ENABLED=false ./upload-server.sh` 关闭入口；普通 `pnpm build` 默认保留登录能力。

## 两个环境，一套源码

| 环境            | 页面基础路径  | API 基础路径     | OSS 清单                                          |
| --------------- | ------------- | ---------------- | ------------------------------------------------- |
| 外网 `public`   | `/`           | `/api`           | `linux_files/nexofolio/front/latest.txt`          |
| 内网 `intranet` | `/nexofolio/` | `/nexofolio/api` | `linux_files/nexofolio/front/intranet/latest.txt` |

发布入口会捕获包括未提交和未跟踪相关源码的稳定快照，在临时目录安装锁定依赖、检查类型，再分别构建。两个包内的 `dist/.nexofolio-release.tsv` 记录同一个 `source_sha` 和各自的环境、页面/API 前缀；本地 `dist`、本地环境文件和正在运行的开发服务不参与修改。真实 `.env`、`.npmrc` 凭据和 `node_modules` 不进入源码快照或发布包。

所有选中环境的版本包先上传并回下载核对 SHA-256，之后分别更新两个 latest。两个 OSS 指针独立写入；发布成功后才在各服务器执行更新命令，发布脚本不会登录服务器。

```bash
./upload-server.sh
./upload-server.sh --build-only
./upload-server.sh --env public
./upload-server.sh --env intranet
```

服务器首次下载或替换更新脚本后，先执行一次 `chmod 755 /home/nexofolio/front/update-front.sh`。进入该目录，新服务器内网首次执行 `./update-front.sh --env intranet`，外网使用 `./update-front.sh --env public`。首次成功后，环境写入部署目录的 `.environment`；旧外网部署默认识别为 public。目录绑定后拒绝切换到另一环境，发布包的环境及基础路径也必须一致。

两边以后都使用同样的命令：

```bash
cd /home/nexofolio/front
./update-front.sh
./update-front.sh status
./update-front.sh --rollback
```

新发布版本支持 `--release <版本号>` 固定更新，该版本目录保存自己的 `release.txt`、`dist.zip`、`manifest.tsv` 和 `update-front.sh`。公网原有 latest/ZIP 路径与两列清单格式保持兼容；已有旧更新脚本仍可继续读取公网包。内网需配置 `/nexofolio/` 静态路由及 `/nexofolio/api/` 同源反向代理，部署主机及后端允许列表独立设置。

## 1. 本地配置与上传

需要 Node.js >= 22.13.0、项目指定的 pnpm、zip、curl 和 ossutil。脚本在临时源码快照中执行 `pnpm install --frozen-lockfile`、类型检查与两次 Vite 构建，分别设置页面/API 前缀和 live 数据来源。

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
  latest.txt                         # 外网版本号 + ZIP SHA-256
  releases/<外网版本号>/dist.zip
  releases/<外网版本号>/release.txt
  releases/<外网版本号>/manifest.tsv
  releases/<外网版本号>/update-front.sh
  intranet/latest.txt                # 内网独立清单
  intranet/releases/<内网版本号>/...  # 相同文件布局
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

后续步骤在服务器执行。静态更新需要 Bash、curl、unzip、SHA-256 工具和 Nginx；服务器无需 Python、Node.js 或 ossutil。以下公网 HTTPS 步骤另需 Certbot；内网现有 HTTP 子路径部署不执行证书申请。现有 AsyncTest Nginx 已由 Certbot 管理，可先 `certbot --version` 检查是否可复用。若尚未安装 Certbot，请按[官方安装说明](https://certbot.eff.org/instructions)选择服务器实际操作系统。

文件变更范围：首次新增 `/home/nexofolio/front/update-front.sh` 和 `deploy/` 下两个配置副本（再次复制会覆盖同名文件）；`/etc/nginx/conf.d/nexofolio.net.conf` 首次新增，申请证书后会由 HTTPS 版本覆盖。若服务器已经存在同名站点配置，请先备份再执行 `cp`。主配置 `/etc/nginx/nginx.conf` 保持不动。

确保 `latest.txt` 和对应的 `dist.zip` 都允许公共读，然后在服务器直接拉取：

```bash
chmod 755 /home/nexofolio/front/update-front.sh
cd /home/nexofolio/front
./update-front.sh --env public
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
curl -I https://nexofolio.net/docs
curl -I https://nexofolio.net/docs/
curl -I https://nexofolio.net/docs/fetcher
curl -I https://nexofolio.net/docs/fetcher/welcome.png
curl -i https://nexofolio.net/api/v1/auth/me
curl -I https://nexofolio.net/assets/does-not-exist.js
```

预期 HTTP 首页返回 301；HTTPS 首页、页面路由和现有文档图片均返回 200；后端未接入的 API 返回 503 JSON；不存在的 assets 返回 404。浏览器还需确认页面和实际 JS/CSS 均可加载。

### 文档直接访问或刷新返回 403

发布产物包含 `dist/docs/fetcher/` 图片目录。如果 `location /` 使用 `try_files $uri $uri/ /index.html;`，直接访问 `/docs` 或 `/docs/fetcher` 会匹配真实目录，跳转到带尾斜杠的地址后，因为目录没有 `index.html` 而返回 403。站内点击由 Vue Router 处理，因此仍能正常显示。

本项目的正式配置使用 `try_files $uri /index.html;`，只匹配真实文件；页面路由（包括末尾带 `/` 的地址）回退到前端入口，现有图片仍正常提供。已经部署的服务器需要将生效的 `/etc/nginx/conf.d/nexofolio.net.conf` 中对应规则改为：

```nginx
location / {
    try_files $uri /index.html;
}
```

编辑前备份当前站点配置，编辑后执行 `nginx -t && systemctl reload nginx`。该修复必须更新生效的 Nginx 配置；只运行 `upload-server.sh` 和 `update-front.sh` 更新静态产物不能应用这条规则。完成后用上面的 `/docs`、`/docs/`、`/docs/fetcher` 和图片地址验证，再在浏览器中直接打开并刷新文档页。

## 6. 日常更新与回退

本地运行 `./upload-server.sh`（使用专用配置时继续加 `OSS_CONFIG_FILE=...`），然后服务器运行：

```bash
cd /home/nexofolio/front
./update-front.sh
# 需要时回退到上一个版本，不访问 OSS：
./update-front.sh --rollback
```

静态代码更新不需要重载 Nginx。回退后下一次普通更新会重新部署 OSS `latest.txt` 指向的版本。脚本不自动删除历史版本；按需清理时保留 `current`、`previous` 指向的两个目录。已打开的旧页面若在更新后加载旧版本延迟资源失败，刷新页面即可获取新入口。

脚本使用 `.update-lock` 防止服务器并发更新；若进程被强制杀死而留下锁，先确认没有更新进程，再手工删除该空锁目录。服务器支持通过环境变量覆盖 `DEPLOY_DIR`、`OSS_BUCKET`、`OSS_PATH` 和 `OSS_ENDPOINT`（填写不带协议的 OSS 域名）。`OSS_CONFIG_FILE` 和 `OSSUTIL_BIN` 仅用于本地上传脚本。

后端接入时，按仓库 README 的 `/api` 反向代理配置替换两个 503 location，目标端口以服务器实际后端为准。

参考：[Certbot Webroot 与续期](https://eff-certbot.readthedocs.io/en/stable/using.html)、[Nginx 静态目录和路由](https://nginx.org/en/docs/http/ngx_http_core_module.html)、[ossutil 配置](https://www.alibabacloud.com/help/en/oss/developer-reference/configure-ossutil)。
