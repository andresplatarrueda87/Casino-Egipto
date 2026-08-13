import http.server
import socketserver
import os
import urllib.parse

PORT = 8085

class MyHTTPRequestHandler(http.server.SimpleHTTPRequestHandler):
    def translate_path(self, path):
        # Strip query parameters and fragment IDs before translating path for Windows OS
        path = urllib.parse.unquote(path)
        path = path.split('?', 1)[0]
        path = path.split('#', 1)[0]
        return super().translate_path(path)

    def end_headers(self):
        self.send_header('Cache-Control', 'no-cache, no-store, must-revalidate')
        self.send_header('Pragma', 'no-cache')
        self.send_header('Expires', '0')
        super().end_headers()

class ThreadingTCPServer(socketserver.ThreadingMixIn, socketserver.TCPServer):
    daemon_threads = True
    allow_reuse_address = True

web_dir = os.path.dirname(os.path.realpath(__file__))
os.chdir(web_dir)

ports_to_try = [8085, 8088, 8090]
httpd = None
bound_port = None

for port in ports_to_try:
    try:
        httpd = ThreadingTCPServer(("0.0.0.0", port), MyHTTPRequestHandler)
        bound_port = port
        break
    except OSError:
        continue

if httpd and bound_port:
    print(f"Servidor Multihilo Casino Egipto corriendo en http://localhost:{bound_port}")
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\nServidor detenido.")
else:
    print("Error: No se pudo iniciar el servidor en ninguno de los puertos especificados.")
