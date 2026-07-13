# ═══════════════════════════════════════════════════════════════
#  本地开发服务器:静态伺服本目录 + 结构化日志端点(零依赖,Python 3)
#  · 运行:python server.py(默认 http://localhost:8000)
#  · POST /__log:页面上报的结构化日志追加到 logs/<启动时间>.jsonl
#    (一次服务 = 一份文件;测试完直接翻这份文件排查)
#  · POST /__export:把导出的单文件 HTML 场景写入 download/ 目录
#    (页面「⬇ 下载」按钮;端点不可用时前端降级为浏览器下载)
#  · 用其它静态服务器(python -m http.server / npx serve)页面也能跑,
#    只是日志会降级为浏览器内存缓冲(见 js/agent/logger.js)
# ═══════════════════════════════════════════════════════════════
import json
import os
from datetime import datetime
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer

PORT = int(os.environ.get('PORT', 8000))
ROOT = os.path.dirname(os.path.abspath(__file__))

os.makedirs(os.path.join(ROOT, 'logs'), exist_ok=True)
LOG_FILE = os.path.join(ROOT, 'logs', datetime.now().strftime('%Y-%m-%dT%H-%M-%S') + '.jsonl')


class Handler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=ROOT, **kwargs)

    # 禁用浏览器缓存:开发期改完代码普通刷新即生效,避免加载到旧的 ES 模块
    # (SimpleHTTPRequestHandler 默认不发 Cache-Control,浏览器会启发式缓存 js 模块)
    def end_headers(self):
        self.send_header('Cache-Control', 'no-store, must-revalidate')
        self.send_header('Expires', '0')
        super().end_headers()

    def do_POST(self):
        if self.path == '/__log':
            length = min(int(self.headers.get('content-length', 0)), 1_000_000)
            body = self.rfile.read(length).decode('utf-8', 'replace').strip()
            if body:
                with open(LOG_FILE, 'a', encoding='utf-8') as f:
                    f.write(body + '\n')
            self.send_response(204)
            self.end_headers()
        elif self.path == '/__export':
            # 单文件 HTML 场景导出 → download/ 目录(面板贴图烘焙成 dataURL,给足上限)
            length = min(int(self.headers.get('content-length', 0)), 100_000_000)
            body = self.rfile.read(length).decode('utf-8', 'replace')
            try:
                data = json.loads(body)
                name = os.path.basename(data.get('name') or 'scene.html')
                if not name.endswith('.html'):
                    name += '.html'
                out_dir = os.path.join(ROOT, 'download')
                os.makedirs(out_dir, exist_ok=True)
                path = os.path.join(out_dir, name)
                with open(path, 'w', encoding='utf-8') as f:
                    f.write(data['html'])
                payload = json.dumps({'path': 'download/' + name}).encode('utf-8')
                self.send_response(200)
                self.send_header('Content-Type', 'application/json')
                self.send_header('Content-Length', str(len(payload)))
                self.end_headers()
                self.wfile.write(payload)
            except Exception as e:
                self.send_error(400, str(e))
        else:
            self.send_error(404)

    def log_message(self, fmt, *args):
        pass  # 静态请求不刷屏;日志都在 LOG_FILE 里


if __name__ == '__main__':
    print(f'XR EduAgent 开发服务器: http://localhost:{PORT}')
    print(f'本次会话日志文件: {LOG_FILE}')
    ThreadingHTTPServer(('localhost', PORT), Handler).serve_forever()
