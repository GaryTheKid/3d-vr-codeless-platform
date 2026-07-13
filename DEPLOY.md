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
- `index.html` — 加载 `xr-edu-agent/main.js` 与 `xr-edu-agent/style.css`
- `.nojekyll` — 禁用 Jekyll

## 本地开发(与 Pages 同结构)

```bash
python server.py    # 在仓库根目录运行
# → http://localhost:8000/
```

**不要**再在 `xr-edu-agent/` 里单独跑旧版 `server.py`(已弃用,仅保留重定向说明)。

## 密钥

- `xr-edu-agent/api-keys.txt` 已在 `.gitignore`,不会进仓库
- 公网试玩:每位老师点顶栏 **🔑 API** 在本机浏览器填 Key
- 本地开发:仍可在 `xr-edu-agent/api-keys.txt` 配置

## GitHub Pages 上不可用的服务端功能

| 功能 | 根目录 `python server.py` | GitHub Pages |
|------|---------------------------|--------------|
| 静态页面 / 3D / VR | ✅ | ✅ |
| AI(自备 Key) | ✅ | ✅ |
| 日志 `logs/*.jsonl` | ✅ | ❌ |
| 导出写入 `download/` | ✅ | ❌(浏览器下载) |

完整说明见 [xr-edu-agent/DEPLOY.md](xr-edu-agent/DEPLOY.md) 中的性能与客户使用章节。
