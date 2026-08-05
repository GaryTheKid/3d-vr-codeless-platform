# ═══════════════════════════════════════════════════════════════
#  Local dev server: static root + log/export + document convert + LLM proxy
#  · Run from repo root: python server.py → http://localhost:8000
#  · POST /__log      → logs/<startup>.jsonl
#  · POST /__export   → download/<scene>.html
#  · POST /__doc/convert → Docling PDF/DOCX/… → markdown + images
#  · POST /__llm/{sonnet|opus|fable5|messages} → same-origin LLM proxy
#      cpx-…  → AStone  https://astonelearning.com/api/v1/claude/{endpoint}
#      sk-ant → Anthropic https://api.anthropic.com/v1/messages
#  · POST /__openai/images/generations → OpenAI Images API (gpt-image-2)
#    Client: xr-edu-agent/api-keys.txt  GPT API: / OPENAI_API_KEY=
# ═══════════════════════════════════════════════════════════════
import base64
import json
import os
import re
import traceback
import uuid
import urllib.error
import urllib.request
from datetime import datetime
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer

PORT = int(os.environ.get('PORT', 8000))
ROOT = os.path.dirname(os.path.abspath(__file__))
CLAUDE_PROXY_BASE = os.environ.get(
    'CLAUDE_PROXY_BASE', 'https://astonelearning.com/api/v1/claude'
).rstrip('/')
ANTHROPIC_MESSAGES_URL = os.environ.get(
    'ANTHROPIC_MESSAGES_URL', 'https://api.anthropic.com/v1/messages'
)
ANTHROPIC_VERSION = os.environ.get('ANTHROPIC_VERSION', '2023-06-01')
OPENAI_IMAGES_URL = os.environ.get(
    'OPENAI_IMAGES_URL', 'https://api.openai.com/v1/images/generations'
)
LLM_ENDPOINTS = {'sonnet', 'opus', 'fable5', 'messages'}
# AStone-only id → closest Anthropic Messages model id
ANTHROPIC_MODEL_ALIAS = {
    'claude-fable-5': 'claude-opus-5',
}

os.makedirs(os.path.join(ROOT, 'logs'), exist_ok=True)
os.makedirs(os.path.join(ROOT, 'uploads'), exist_ok=True)
LOG_FILE = os.path.join(ROOT, 'logs', datetime.now().strftime('%Y-%m-%dT%H-%M-%S') + '.jsonl')

# Keep in sync with the chat upload accept= list
ALLOWED_EXT = {
    '.pdf', '.docx', '.doc', '.pptx', '.ppt', '.xlsx', '.xls',
    '.html', '.htm', '.md', '.txt', '.asciidoc', '.adoc',
    '.png', '.jpg', '.jpeg', '.tif', '.tiff', '.bmp', '.webp',
}
MAX_DOC_BYTES = 40 * 1024 * 1024  # 40 MB


def _json_bytes(obj, status=200):
    payload = json.dumps(obj, ensure_ascii=False).encode('utf-8')
    return status, payload


def _safe_filename(name: str) -> str:
    base = os.path.basename(name or 'document.bin')
    base = re.sub(r'[^\w.\-()+ ]+', '_', base, flags=re.UNICODE).strip('._ ') or 'document.bin'
    return base[:180]


def _convert_document(data: dict):
    from services.docling_service import DoclingUnavailable, docling_service

    filename = _safe_filename(data.get('filename') or 'document.bin')
    ext = os.path.splitext(filename)[1].lower()
    if ext not in ALLOWED_EXT:
        return _json_bytes({'ok': False, 'error': f'Unsupported file type: {ext or "(none)"}'}, 400)

    b64 = data.get('data_b64') or data.get('content_base64') or ''
    if not b64:
        return _json_bytes({'ok': False, 'error': 'Missing data_b64'}, 400)
    try:
        raw = base64.b64decode(b64, validate=False)
    except Exception:
        return _json_bytes({'ok': False, 'error': 'Invalid base64 payload'}, 400)
    if not raw:
        return _json_bytes({'ok': False, 'error': 'Empty file'}, 400)
    if len(raw) > MAX_DOC_BYTES:
        return _json_bytes({'ok': False, 'error': f'File too large (max {MAX_DOC_BYTES // (1024 * 1024)} MB)'}, 400)

    job_id = datetime.now().strftime('%Y%m%d-%H%M%S') + '-' + uuid.uuid4().hex[:8]
    out_dir = os.path.join(ROOT, 'uploads', job_id)
    os.makedirs(out_dir, exist_ok=True)
    src_path = os.path.join(out_dir, 'source' + ext)
    with open(src_path, 'wb') as f:
        f.write(raw)

    url_prefix = f'/uploads/{job_id}'
    try:
        result = docling_service.convert_document(src_path, out_dir, url_prefix)
    except DoclingUnavailable as e:
        return _json_bytes({'ok': False, 'error': str(e)}, 503)
    except Exception as e:
        traceback.print_exc()
        return _json_bytes({'ok': False, 'error': f'Conversion failed: {e}'}, 500)

    md_rel = f'uploads/{job_id}/content.md'
    return _json_bytes({
        'ok': True,
        'jobId': job_id,
        'filename': filename,
        'markdown': result['markdown'],
        'markdownUrl': '/' + md_rel,
        'images': result['images'],
        'imageCount': len(result['images']),
        'charCount': len(result['markdown']),
    })


def _proxy_llm(endpoint: str, api_key: str, body: bytes, stream: bool):
    """Forward request to AStone (cpx-) or Anthropic direct (sk-ant-)."""
    if endpoint not in LLM_ENDPOINTS:
        return 404, b'{"error":"unknown llm endpoint"}', 'application/json'

    key = (api_key or '').strip()
    use_anthropic = key.startswith('sk-ant')
    headers = {
        'content-type': 'application/json',
        'x-api-key': key,
        'accept': 'text/event-stream' if stream else 'application/json',
    }
    out_body = body
    if use_anthropic:
        url = ANTHROPIC_MESSAGES_URL
        headers['anthropic-version'] = ANTHROPIC_VERSION
        try:
            data = json.loads(body.decode('utf-8'))
            mid = data.get('model') or ''
            if mid in ANTHROPIC_MODEL_ALIAS:
                data['model'] = ANTHROPIC_MODEL_ALIAS[mid]
            out_body = json.dumps(data).encode('utf-8')
        except Exception:
            out_body = body
    else:
        # Path-selected models on AStone; "messages" is Anthropic-only
        if endpoint == 'messages':
            return 400, b'{"error":"messages endpoint requires sk-ant Anthropic key"}', 'application/json'
        url = f'{CLAUDE_PROXY_BASE}/{endpoint}'

    req = urllib.request.Request(url, data=out_body, method='POST', headers=headers)
    try:
        upstream = urllib.request.urlopen(req, timeout=300)
    except urllib.error.HTTPError as e:
        err_body = e.read() or str(e).encode('utf-8')
        return e.code, err_body, e.headers.get('Content-Type', 'application/json')
    except Exception as e:
        payload = json.dumps({'error': f'LLM proxy upstream failed: {e}'}).encode('utf-8')
        return 502, payload, 'application/json; charset=utf-8'
    return upstream


def _proxy_openai_images(api_key: str, body: bytes):
    """Forward to OpenAI Images API (gpt-image-2 etc.)."""
    key = (api_key or '').strip()
    if key.lower().startswith('bearer '):
        key = key[7:].strip()
    if not key:
        return 401, b'{"error":"missing OpenAI API key"}', 'application/json'
    try:
        data = json.loads(body.decode('utf-8'))
    except Exception:
        return 400, b'{"error":"invalid JSON body"}', 'application/json'
    data.setdefault('model', os.environ.get('OPENAI_IMAGE_MODEL', 'gpt-image-2'))
    data.setdefault('n', 1)

    def _call(payload: dict):
        out_body = json.dumps(payload).encode('utf-8')
        headers = {
            'content-type': 'application/json',
            'authorization': f'Bearer {key}',
            'accept': 'application/json',
        }
        req = urllib.request.Request(OPENAI_IMAGES_URL, data=out_body, method='POST', headers=headers)
        try:
            upstream = urllib.request.urlopen(req, timeout=180)
        except urllib.error.HTTPError as e:
            err_body = e.read() or str(e).encode('utf-8')
            return e.code, err_body, e.headers.get('Content-Type', 'application/json')
        except Exception as e:
            payload_err = json.dumps({'error': f'OpenAI images proxy failed: {e}'}).encode('utf-8')
            return 502, payload_err, 'application/json; charset=utf-8'
        try:
            body_out = upstream.read()
            ctype = upstream.headers.get('Content-Type', 'application/json')
            return upstream.status, body_out, ctype
        finally:
            upstream.close()

    # Prefer b64; if model rejects response_format, retry without it
    attempt = dict(data)
    if 'response_format' not in attempt and 'output_format' not in attempt:
        attempt['response_format'] = 'b64_json'
    status, payload, ctype = _call(attempt)
    if status == 400 and b'response_format' in payload and 'response_format' in attempt:
        attempt.pop('response_format', None)
        status, payload, ctype = _call(attempt)
    return status, payload, ctype


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
        elif self.path == '/__doc/convert':
            length = min(int(self.headers.get('content-length', 0)), MAX_DOC_BYTES + 1_000_000)
            body = self.rfile.read(length).decode('utf-8', 'replace')
            try:
                data = json.loads(body)
            except Exception:
                self.send_error(400, 'Invalid JSON')
                return
            status, payload = _convert_document(data)
            self.send_response(status)
            self.send_header('Content-Type', 'application/json; charset=utf-8')
            self.send_header('Content-Length', str(len(payload)))
            self.end_headers()
            self.wfile.write(payload)
        elif self.path.startswith('/__llm/'):
            endpoint = self.path[len('/__llm/'):].split('?', 1)[0].strip('/')
            length = min(int(self.headers.get('content-length', 0)), 20_000_000)
            body = self.rfile.read(length)
            api_key = self.headers.get('x-api-key') or self.headers.get('X-Api-Key') or ''
            stream = False
            try:
                stream = bool(json.loads(body.decode('utf-8')).get('stream'))
            except Exception:
                stream = b'"stream":true' in body.replace(b' ', b'')
            result = _proxy_llm(endpoint, api_key, body, stream)
            if isinstance(result, tuple):
                status, payload, ctype = result
                self.send_response(status)
                self.send_header('Content-Type', ctype)
                self.send_header('Content-Length', str(len(payload)))
                self.end_headers()
                self.wfile.write(payload)
                return
            upstream = result
            try:
                self.send_response(upstream.status)
                ctype = upstream.headers.get('Content-Type', 'application/json')
                self.send_header('Content-Type', ctype)
                # Stream SSE / JSON through without buffering the whole body
                self.end_headers()
                while True:
                    chunk = upstream.read(8192)
                    if not chunk:
                        break
                    self.wfile.write(chunk)
            finally:
                upstream.close()
        elif self.path.rstrip('/') == '/__openai/images/generations':
            length = min(int(self.headers.get('content-length', 0)), 2_000_000)
            body = self.rfile.read(length)
            api_key = (
                self.headers.get('authorization')
                or self.headers.get('Authorization')
                or self.headers.get('x-api-key')
                or self.headers.get('X-Api-Key')
                or ''
            )
            status, payload, ctype = _proxy_openai_images(api_key, body)
            self.send_response(status)
            self.send_header('Content-Type', ctype)
            self.send_header('Content-Length', str(len(payload)))
            self.end_headers()
            self.wfile.write(payload)
        else:
            self.send_error(404)

    def log_message(self, fmt, *args):
        pass


if __name__ == '__main__':
    print(f'XR EduAgent 开发服务器: http://localhost:{PORT}/')
    print(f'本次会话日志文件: {LOG_FILE}')
    print('文档转换: POST /__doc/convert  (需要: python install_requirements.py)')
    print(f'LLM 同域代理: POST /__llm/{{sonnet|opus|fable5}}')
    print(f'  · cpx-… → {CLAUDE_PROXY_BASE}/…')
    print(f'  · sk-ant-… (Test API) → {ANTHROPIC_MESSAGES_URL}')
    print(f'OpenAI 图片代理: POST /__openai/images/generations → {OPENAI_IMAGES_URL}')
    ThreadingHTTPServer(('localhost', PORT), Handler).serve_forever()
