import http.server
import os
import urllib.parse
import sys

class MyHandler(http.server.SimpleHTTPRequestHandler):
    def translate_path(self, path):
        path = urllib.parse.unquote(path)
        path = path.split('?', 1)[0]
        path = path.split('#', 1)[0]
        return super().translate_path(path)

    def end_headers(self):
        self.send_header('Cache-Control', 'no-cache, no-store, must-revalidate')
        self.send_header('Pragma', 'no-cache')
        self.send_header('Expires', '0')
        super().end_headers()

web_dir = os.path.dirname(os.path.realpath(__file__))
os.chdir(web_dir)

port = 8085

try:
    server = http.server.ThreadingHTTPServer(("127.0.0.1", port), MyHandler)
    print(f"Servidor Casino Egipto corriendo en http://127.0.0.1:{port}", flush=True)
    server.serve_forever()
except Exception as e:
    print(f"Error al iniciar servidor: {e}", flush=True)
