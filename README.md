# ua-parser-server

基于 [ua-parser-js](https://github.com/faisalman/ua-parser-js) 的 User-Agent 解析服务,零框架(仅用 Node.js 内置 `node:http`),唯一依赖是 `ua-parser-js`。

## 运行

```bash
pnpm install
pnpm start          # 生产启动,默认监听 0.0.0.0:3000
pnpm dev            # 开发启动(文件变更自动重启)

# 可用环境变量
PORT=8080 HOST=127.0.0.1 pnpm start
```

## 接口

### `GET /parse`

解析指定 UA;不带 `ua` 参数时解析请求自身的 `User-Agent` 头。

```bash
curl 'http://localhost:3000/parse?ua=Mozilla/5.0 (Windows NT 10.0; Win64; x64) ... Chrome/131.0.0.0 Safari/537.36'
```

### `POST /parse`

body 为 JSON(`{"ua": "..."}`)或纯文本 UA 字符串(请求体上限 16KB,超限返回 413)。

```bash
curl -X POST http://localhost:3000/parse \
  -H 'Content-Type: application/json' \
  -d '{"ua":"Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) ... Safari/604.1"}'
```

### 响应

返回 ua-parser-js 的解析结果:

```json
{
  "ua": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) ...",
  "browser": { "name": "Chrome", "version": "131.0.0.0", "major": "131" },
  "cpu": { "architecture": "amd64" },
  "device": { "type": "desktop" },
  "engine": { "name": "Blink", "version": "131.0.0.0" },
  "os": { "name": "Windows", "version": "10" }
}
```

当 UA 未识别出具体设备类型时(桌面浏览器 UA 通常如此),`device.type` 默认返回 `"desktop"`;识别为移动端时返回 `"mobile"`,其余为 ua-parser-js 原生值(`tablet` / `wearable` / `smarttv` 等)。

### 其他

- `GET /health` — 健康检查,返回 `{"status":"ok"}`
- 未知路径返回 404,`/parse` 不支持的方法返回 405,非法 JSON 返回 400

## Docker

```bash
docker build -t ua-parser-server .
docker run -d -p 3000:3000 ua-parser-server
# 自定义端口:容器内默认监听 0.0.0.0:3000,可通过环境变量覆盖
docker run -d -p 8080:8080 -e PORT=8080 ua-parser-server
```

镜像特性:基于 `node:24-alpine` 多阶段构建(运行阶段只含 node 与生产依赖),以非 root 用户(`node`)运行,依赖经 `pnpm install --frozen-lockfile` 按锁文件安装。

## CI/CD(构建并推送 Docker Hub)

`.github/workflows/docker-publish.yml` 为**手动触发**:仓库 Actions 页 → Build and Push Docker Image → Run workflow。

- 镜像标签取 `package.json` 的 `version`,并同时更新 `latest`
- 发布新版本的流程:修改 `package.json` 的 `version` → 提交 → 手动触发 workflow

镜像构建为 `linux/amd64` + `linux/arm64` 双架构,使用 GitHub Actions 缓存加速。

**首次使用前需在仓库配置两个 secret**([Settings → Secrets and variables → Actions](https://github.com/kjhch/ua-parser-server/settings/secrets/actions)):

| Secret | 值 |
|---|---|
| `DOCKERHUB_USERNAME` | Docker Hub 用户名(同时决定镜像名 `<用户名>/ua-parser-server`) |
| `DOCKERHUB_TOKEN` | Docker Hub 访问令牌([Account Settings → Security → New Access Token](https://hub.docker.com/settings/security),权限选 Read & Write) |

## 说明

ua-parser-js v2 默认不再把爬虫(如 Googlebot)和命令行工具(如 curl)识别为浏览器,这类 UA 的 `browser` / `os` 等字段会返回空结果;如需识别可参考 [ua-parser-js v2 的 extensions 机制](https://github.com/faisalman/ua-parser-js/blob/master/docs/ua-parser-js-v2.md)扩展。
