"""Local server tests: fixed relay payload, origin restrictions and no file leakage."""
import base64
import json
import threading
import unittest
from urllib.request import Request, urlopen
from urllib.error import HTTPError
from unittest.mock import patch
from http.server import ThreadingHTTPServer
import server


class ServerTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.http = ThreadingHTTPServer(('127.0.0.1', 0), server.Handler)
        cls.thread = threading.Thread(target=cls.http.serve_forever, daemon=True)
        cls.thread.start()
        cls.origin = f'http://127.0.0.1:{cls.http.server_port}'

    @classmethod
    def tearDownClass(cls):
        cls.http.shutdown()
        cls.http.server_close()
        cls.thread.join()

    def request(self, path='/', data=None, headers=None):
        req = Request(self.origin + path, data=data, headers=headers or {})
        try:
            with urlopen(req, timeout=3) as response:
                return response.status, response.read()
        except HTTPError as exc:
            return exc.code, exc.read()

    def test_static_app_serves(self):
        status, body = self.request()
        self.assertEqual(status, 200)
        self.assertIn(b'app.js', body)

    def test_non_app_files_and_traversal_are_blocked(self):
        for path in ['/server.py', '/.env', '/../README.md', '/assets/../server.py', '/assets/']:
            self.assertEqual(self.request(path)[0], 404)

    def test_untrusted_host_is_blocked(self):
        self.assertEqual(self.request(headers={'Host': 'attacker.example'})[0], 403)

    def test_cross_origin_analysis_is_blocked(self):
        self.assertEqual(self.request('/api/analyze', b'{}', {'Origin': 'https://attacker.example', 'Content-Type': 'application/json', 'X-Meal-Assistant': '1'})[0], 403)

    def test_invalid_local_analysis_is_rejected_without_network(self):
        self.assertEqual(self.request('/api/analyze', b'{}', {'Origin': self.origin, 'Content-Type': 'application/json', 'X-Meal-Assistant': '1'})[0], 400)

    def test_fixed_claude_payload_and_image_validation(self):
        data = {'provider': 'claude', 'key': 'test-only-not-a-real-api-key', 'model': 'claude-haiku-4-5', 'prompt': 'read label', 'image': base64.b64encode(b'\xff\xd8\xff\x00').decode(), 'mime': 'image/jpeg'}
        key, body = server.claude_payload(data)
        self.assertEqual(body['messages'][0]['content'][0]['source']['media_type'], 'image/jpeg')
        self.assertEqual(body['model'], 'claude-haiku-4-5')
        self.assertNotIn('key', body)
        with self.assertRaises(ValueError):
            server.claude_payload({**data, 'image': 'not base64'})
        with self.assertRaises(ValueError):
            server.claude_payload({**data, 'model': 'https://attacker.example'})


if __name__ == '__main__':
    unittest.main()
