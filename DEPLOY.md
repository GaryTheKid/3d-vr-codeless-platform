# 部署到 GitHub Pages(给客户试玩)

**入口在仓库根目录** `index.html`,应用代码在 `xr-edu-agent/`。GitHub Pages 选 **root** 即可,无需把全部文件搬到根目录。

## 一键部署

```bash
# 在仓库根目录(Demo/)
git add .
git commit -m "Deploy: root index.html for GitHub Pages"
git push origin main
```

1. GitHub 仓库 → **Settings** → **Pages**
2. **Source**: Deploy from a branch
3. **Branch**: `main` / **Folder**: `/ (root)`
4. 访问:`https://YOUR_ORG.github.io/YOUR_REPO/`(不再是 `/YOUR_REPO/xr-edu-agent/`)

根目录已有:
- `index.html` — 加载 React/HTM 与 `xr-edu-agent/react-main.js`
- `.nojekyll` — 禁用 Jekyll

## 本地开发(与 Pages 同结构)

```bash
python server.py    # 在仓库根目录运行
# → http://localhost:8000/
```

**不要**再在 `xr-edu-agent/` 里单独跑旧版 `server.py`(已弃用,仅保留重定向说明)。

## 密钥

- `xr-edu-agent/api-keys.txt` 已在 `.gitignore`,不会进仓库
- 应用只调用 `https://astonelearning.com/api/v1/claude/{sonnet|opus|fable5}`,不会直连 Anthropic
- 公网试玩版不显示代理密钥设置按钮；凭据由部署方统一配置
- 本地开发:复制 `xr-edu-agent/api-keys.example.txt` 为 `api-keys.txt`,填写 `CLAUDE_PROXY_API_KEY`

### 重要安全限制

GitHub Pages 是公开静态前端。把一个共享代理密钥写进 JS、HTML、GitHub
Secret 或构建产物都**不能保密**——测试者能在 DevTools 的 Network 面板读到
`x-api-key`。移除设置按钮并不会改变这个事实。

若希望测试者“打开即用”且不接触共享密钥,代理服务必须改为以下之一:

1. `astonelearning.com` 先登录,再用 HttpOnly session cookie 鉴权；
2. 自己的后端签发短期、限额、限来源的临时 token；
3. 每位测试者单独分配可撤销/限额的 `cpx-…` key。

同时代理需允许 GitHub Pages 域名的 CORS `OPTIONS`、`POST` 和
`x-api-key` 请求头。

## GitHub Pages 上不可用的服务端功能

| 功能 | 根目录 `python server.py` | GitHub Pages |
|------|---------------------------|--------------|
| 静态页面 / 3D / VR | ✅ | ✅ |
| AI(自备 Key) | ✅ | ✅ |
| 日志 `logs/*.jsonl` | ✅ | ❌ |
| 导出写入 `download/` | ✅ | ❌(浏览器下载) |

完整说明见 [xr-edu-agent/DEPLOY.md](xr-edu-agent/DEPLOY.md) 中的性能与客户使用章节。
