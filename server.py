# ═══════════════════════════════════════════════════════════════
#  本地开发服务器:静态伺服仓库根目录 + 结构化日志/导出端点
#  · 运行:在仓库根目录执行 python server.py → http://localhost:8000
#  · 入口页:根目录 index.html(GitHub Pages 同款结构)
#  · POST /__log → logs/<启动时间>.jsonl
#  · POST /__export → download/<场景>.html
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
        pass


if __name__ == '__main__':
    print(f'XR EduAgent 开发服务器: http://localhost:{PORT}/')
    print(f'本次会话日志文件: {LOG_FILE}')
    ThreadingHTTPServer(('localhost', PORT), Handler).serve_forever()
