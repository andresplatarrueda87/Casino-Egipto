import http.server
import os
import urllib.parse
import sys
import json
import base64
import re
import time

web_dir = os.path.dirname(os.path.realpath(__file__))
os.chdir(web_dir)
port = 8085

class CasinoHandler(http.server.SimpleHTTPRequestHandler):
    def translate_path(self, path):
        path = urllib.parse.unquote(path)
        path = path.split('?', 1)[0]
        path = path.split('#', 1)[0]
        return super().translate_path(path)

    def do_OPTIONS(self):
        self.send_response(200)
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'POST, GET, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        self.end_headers()

    def do_POST(self):
        if self.path.startswith('/api/upload'):
            try:
                content_length = int(self.headers.get('Content-Length', 0))
                post_data = self.rfile.read(content_length)
                payload = json.loads(post_data.decode('utf-8'))
                
                raw_filename = payload.get('filename', f"prod_{int(time.time())}.jpg")
                image_data = payload.get('image', '')
                
                clean_name = re.sub(r'[^a-zA-Z0-9_\-\.]', '_', raw_filename)
                if not clean_name.lower().endswith(('.jpg', '.jpeg', '.png', '.webp')):
                    clean_name += '.jpg'
                
                if ',' in image_data:
                    _, base64_str = image_data.split(',', 1)
                else:
                    base64_str = image_data
                
                img_bytes = base64.b64decode(base64_str)
                img_dir = os.path.join(web_dir, 'img')
                os.makedirs(img_dir, exist_ok=True)
                
                file_path = os.path.join(img_dir, clean_name)
                with open(file_path, 'wb') as f:
                    f.write(img_bytes)
                
                rel_path = f"img/{clean_name}"
                response = json.dumps({"success": True, "path": rel_path}).encode('utf-8')
                
                self.send_response(200)
                self.send_header('Content-Type', 'application/json')
                self.send_header('Access-Control-Allow-Origin', '*')
                self.send_header('Content-Length', str(len(response)))
                self.end_headers()
                self.wfile.write(response)
                print(f"[Upload] Imagen guardada en: {rel_path}", flush=True)
            except Exception as e:
                err_resp = json.dumps({"success": False, "error": str(e)}).encode('utf-8')
                self.send_response(500)
                self.send_header('Content-Type', 'application/json')
                self.send_header('Access-Control-Allow-Origin', '*')
                self.send_header('Content-Length', str(len(err_resp)))
                self.end_headers()
                self.wfile.write(err_resp)
        else:
            self.send_error(404, "Endpoint not found")

try:
    http.server.ThreadingHTTPServer.allow_reuse_address = True
    server = http.server.ThreadingHTTPServer(("127.0.0.1", port), CasinoHandler)
    print(f"Servidor Casino Egipto corriendo en http://127.0.0.1:{port}", flush=True)
    server.serve_forever()
except Exception as e:
    print(f"Error al iniciar servidor: {e}", flush=True)
