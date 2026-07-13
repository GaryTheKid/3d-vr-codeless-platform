# XR EduAgent — VR 教学场景智能创作平台

给**没有编程背景的老师**用的 VR 课堂搭建工具:用自然语言指挥 AI 在 Three.js/WebXR 场景里搭建交互式课程。

## 快速开始

```bash
# 在仓库根目录(本 README 所在位置)
python server.py
# 浏览器打开 http://localhost:8000/
```

**GitHub Pages**: 根目录 `index.html` 即入口,应用代码在 `xr-edu-agent/` 子目录。详见 [DEPLOY.md](DEPLOY.md)。

**开发文档**: [xr-edu-agent/README.md](xr-edu-agent/README.md) · [xr-edu-agent/AGENTS.md](xr-edu-agent/AGENTS.md)

## 仓库结构

```
index.html              ← GitHub Pages 入口(指向 xr-edu-agent/)
server.py               ← 本地开发服务器(伺服整个仓库根)
xr-edu-agent/
  react-main.js         ← React 启动入口
  main.js               ← Three.js/Agent 运行时入口
  style.css
  js/                   ← 核心代码
  api-keys.txt          ← 本地密钥(勿提交,见 .gitignore)
```

## 给客户试玩

1. 推送到 GitHub,Settings → Pages → 分支 `main` / 文件夹 `/ (root)`
2. 访问 `https://<你的用户名>.github.io/<仓库名>/`
3. AI 代理凭据由部署方配置；未配置时仍可离线试玩示例场景
