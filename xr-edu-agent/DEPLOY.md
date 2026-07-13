# 部署到 GitHub Pages(给客户试玩)

本原型**不需要**打包成单个 `index.html`。当前仓库约 **0.8 MB** 源码,已是标准静态站点:`index.html` + ES Modules + CDN 上的 Three.js。GitHub Pages 通过 HTTPS 提供这些文件即可,与本地 `python server.py` 的体验基本一致。

## 为什么不建议合并成单文件 index.html?

| 方案 | 优点 | 缺点 |
|------|------|------|
| **多文件(推荐)** | 易维护、易 diff、加载可并行缓存、与开发环境一致 | 首次打开约 30+ 个小请求(HTTP/2 下很快) |
| **单文件 bundle** | 只有一个 HTML | 需引入打包工具(Webpack/Vite)、体积 2–5 MB+、每次改代码都要重打包、调试困难 |

给学生用的**单文件 HTML 播放器**已经由编辑器内「⬇ 下载」按钮生成;老师用的**创作端**保持多文件结构更合理。

## 一键部署步骤

### 1. 创建 GitHub 仓库并推送

```bash
# 在仓库根目录(Demo/,含 index.html 的那一层)
git add .
git commit -m "Initial prototype for client play-testing"
git push origin main
```

**切勿提交** `xr-edu-agent/api-keys.txt`(已在根 `.gitignore`)。

### 2. 开启 GitHub Pages

1. 仓库 → **Settings** → **Pages**
2. **Source**: Deploy from a branch
3. **Branch**: `main` / **Folder**: `/ (root)`
4. 保存后访问:`https://YOUR_ORG.github.io/YOUR_REPO/`(根目录 `index.html` 即首页)

根目录已有 `index.html` 与 `.nojekyll`。应用代码在 `xr-edu-agent/` 子目录,**不必**全部搬到根目录。

### 3. 给客户的使用说明

- **浏览器**: Chrome 或 Edge(推荐,支持 WebXR + 本地项目文件夹)
- **AI 功能**: 顶栏点 **🔑 API**,各自填入 Claude API Key(仅存本机浏览器,不上传 GitHub)
- **无 Key**: 仍可离线试玩(关键词规则生成示例场景)
- **保存项目**:
  - 默认:浏览器 localStorage(简单,但清站点数据会丢)
  - 推荐:左栏「📁 项目」→ **📂 选择项目文件夹** → 项目存为磁盘上的 `.xrscene` 文件
- **VR**: Quest Link + Chrome/Edge → 点「🥽 进入 VR 预览」
- **导出给学生**: 「⬇ 下载」→ 单文件 HTML(首次需联网加载 Three.js CDN)

### 4. 在 GitHub Pages 上不可用的功能

| 功能 | 本地 `server.py` | GitHub Pages |
|------|------------------|--------------|
| 静态页面 / 3D / VR | ✅ | ✅ |
| AI Agent(自备 Key) | ✅ | ✅(浏览器填 Key) |
| 结构化日志 `logs/*.jsonl` | ✅ | ❌(降级为内存) |
| 导出写入 `download/` 目录 | ✅ | ❌(改为浏览器下载) |
| `api-keys.txt` 自动加载 | ✅ | ❌(用 🔑 API 按钮) |

## GitHub 会限制 3D 性能吗?

**基本不会。** GitHub Pages 只是**静态文件 CDN**,不做任何 3D 渲染:

- **帧率 / WebGL / 动画**: 100% 在客户电脑的 GPU 和浏览器里跑,与文件托管在哪无关
- **带宽**: 免费账户软限制约 **100 GB/月**(对一个试玩原型绰绰有余);超出可能被限速,不会删仓库
- **仓库大小**: 建议 < 1 GB;本原型 < 1 MB
- **单文件大小**: 建议 < 100 MB;本仓库无大资产
- **首次加载延迟**: 主要来自 **jsdelivr CDN 上的 Three.js**(~600 KB)和你的 ~30 个 JS 模块;GitHub CDN 缓存后第二次打开很快
- **并发**: Pages 没有「同时在线人数」硬上限,高流量时可能稍慢,不影响单机 3D 性能

真正影响体验的是:**客户显卡、是否用 Quest 独立头显、场景复杂度(对象数/面数)**,不是 GitHub。

## 本地项目文件夹(已实现)

左栏 **📁 项目** → **📂 选择项目文件夹**:

1. 浏览器弹出授权(Chrome/Edge 的 File System Access API)
2. 选一个目录,例如 `Documents/XR-EduAgent-Projects/`
3. 每次保存写入 `{项目名}.xrscene` JSON 文件
4. 刷新页面后会请求重新授权同一文件夹(句柄存在 IndexedDB)

这比 localStorage 更适合老师长期使用:项目可备份、同步盘、版本管理。Safari/Firefox 暂不支持,会自动隐藏该按钮并继续用 localStorage。

## 私有部署 / 带后端的正式版(未来)

若需要服务端日志、统一 API Key 代理、用户账号,应部署到自己的 VPS / Cloudflare Pages + Workers,而不是公开 GitHub Pages。密钥**永远不要**写进公开仓库。
