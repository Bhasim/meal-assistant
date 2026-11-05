"""Optional loopback-only web server and Claude API relay. No dependencies or stored keys.

Run: python3 server.py
The app asks for the user's own API key and sends it only with an explicitly requested analysis.
No API calls are made on server startup. No keys or uploaded images are logged or saved.
"""
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
import argparse
import base64
import json
import re
import socket
from urllib.parse import urlsplit, unquote
from urllib.request import Request, urlopen
from urllib.error import HTTPError, URLError

ROOT = Path(__file__).resolve().parent
ALLOWED_FILES = {'index.html', 'Meal-Assistant.html', 'app.js', 'ai.js', 'styles.css'}
MAX_BODY = 8 * 1024 * 1024


def claude_payload(data):
    """Validate the request and build a fixed-destination Messages payload."""
    if not isinstance(data, dict) or data.get('provider') != 'claude':
        raise ValueError('Unsupported provider')
    key = data.get('key', '')
    model = data.get('model', '')
    prompt = data.get('prompt', '')
    image = data.get('image', '')
    if not isinstance(key, str) or not 15 <= len(key) <= 1000 or re.search(r'[\s\x00-\x1f]', key):
        raise ValueError('Invalid API key')
    if not isinstance(model, str) or not re.fullmatch(r'[a-zA-Z0-9_-]{3,120}', model):
        raise ValueError('Invalid model')
    if not isinstance(prompt, str) or not 1 <= len(prompt) <= 20000:
        raise ValueError('Invalid prompt')
    if data.get('mime') != 'image/jpeg' or not isinstance(image, str):
        raise ValueError('Invalid image format')
    try:
        raw = base64.b64decode(image, validate=True)
    except (ValueError, TypeError) as exc:
        raise ValueError('Invalid image data') from exc
    if not 3 <= len(raw) <= 5 * 1024 * 1024 or not raw.startswith(b'\xff\xd8\xff'):
        raise ValueError('Invalid JPEG')
    body = {'model': model, 'max_tokens': 4500, 'messages': [{'role': 'user', 'content': [
        {'type': 'image', 'source': {'type': 'base64', 'media_type': 'image/jpeg', 'data': image}},
        {'type': 'text', 'text': prompt},
    ]}]}
    return key, body


class Handler(SimpleHTTPRequestHandler):
    server_version = 'MealAssistant/2.1'

    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(ROOT), **kwargs)

    def log_message(self, format, *args):
        # Do not log requests, request bodies, provider errors, keys or image data.
        pass

    def local_request(self):
        port = self.server.server_port
        hosts = {f'127.0.0.1:{port}', f'localhost:{port}'}
        return self.headers.get('Host') in hosts

    def end_headers(self):
        self.send_header('Cache-Control', 'no-store')
        self.send_header('X-Content-Type-Options', 'nosniff')
        self.send_header('Referrer-Policy', 'no-referrer')
        self.send_header('X-Frame-Options', 'DENY')
        super().end_headers()

    def json_response(self, status, data):
        raw = json.dumps(data, ensure_ascii=False).encode('utf-8')
        self.send_response(status)
        self.send_header('Content-Type', 'application/json; charset=utf-8')
        self.send_header('Content-Length', str(len(raw)))
        self.end_headers()
        self.wfile.write(raw)

    def do_GET(self):
        if not self.local_request():
            self.json_response(403, {'error': 'Loopback access only'})
            return
        path = unquote(urlsplit(self.path).path).lstrip('/') or 'index.html'
        resolved = (ROOT / path).resolve()
        asset = path.startswith('assets/') and resolved.is_relative_to(ROOT / 'assets') and resolved.suffix.lower() in {'.jpg', '.jpeg', '.png', '.webp', '.svg'}
        if path not in ALLOWED_FILES and not asset:
            self.json_response(404, {'error': 'Not found'})
            return
        super().do_GET()

    def do_HEAD(self):
        # Use the same path/host restrictions as GET rather than inherited directory access.
        self.send_error(405)

    def do_POST(self):
        if not self.local_request() or self.path != '/api/analyze':
            self.json_response(403, {'error': 'Not allowed'})
            return
        allowed_origins = {f'http://127.0.0.1:{self.server.server_port}', f'http://localhost:{self.server.server_port}'}
        if self.headers.get('Origin') not in allowed_origins or self.headers.get('X-Meal-Assistant') != '1' or self.headers.get_content_type() != 'application/json':
            self.json_response(403, {'error': 'Invalid origin or request type'})
            return
        try:
            size = int(self.headers.get('Content-Length', '0'))
            if not 1 <= size <= MAX_BODY:
                self.json_response(413, {'error': 'Request too large'})
                return
            self.connection.settimeout(100)
            data = json.loads(self.rfile.read(size))
            key, body = claude_payload(data)
        except (ValueError, TypeError, socket.timeout, json.JSONDecodeError):
            self.json_response(400, {'error': 'Invalid request'})
            return
        request = Request('https://api.anthropic.com/v1/messages', data=json.dumps(body).encode(), headers={
            'Content-Type': 'application/json', 'x-api-key': key, 'anthropic-version': '2023-06-01',
        }, method='POST')
        try:
            with urlopen(request, timeout=85) as response:
                result = json.loads(response.read(2 * 1024 * 1024))
            if result.get('stop_reason') == 'max_tokens':
                self.json_response(502, {'error': 'Response was truncated'})
                return
            text = '\n'.join(x['text'] for x in result.get('content', []) if x.get('type') == 'text')
            self.json_response(200, {'text': text})
        except HTTPError as exc:
            # Do not echo remote bodies: they may contain sensitive request context.
            self.json_response(exc.code if 400 <= exc.code < 600 else 502, {'error': 'Provider rejected request'})
        except (URLError, TimeoutError, OSError, ValueError, KeyError):
            self.json_response(502, {'error': 'Provider connection failed'})


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--port', type=int, default=8768)
    args = parser.parse_args()
    server = ThreadingHTTPServer(('127.0.0.1', args.port), Handler)
    print(f'Meal Assistant: http://127.0.0.1:{server.server_port}', flush=True)
    print('Keys and images are never stored. Ctrl+C to stop.', flush=True)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()


if __name__ == '__main__':
    main()
