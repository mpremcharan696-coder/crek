import os
import subprocess
import threading
import sys
from http.server import BaseHTTPRequestHandler, HTTPServer

class HealthHandler(BaseHTTPRequestHandler):
    def do_GET(self):
        if self.path == "/health" or self.path == "/":
            self.send_response(200)
            self.send_header("Content-type", "text/plain")
            self.end_headers()
            self.wfile.write(b"worker is healthy")
        else:
            self.send_response(404)
            self.end_headers()

def run_health_server():
    port = int(os.environ.get("PORT", "8000"))
    server = HTTPServer(("0.0.0.0", port), HealthHandler)
    server.serve_forever()

if __name__ == "__main__":
    # Start the HTTP health check server in a background thread
    threading.Thread(target=run_health_server, daemon=True).start()
    
    # Run the ARQ worker in the main thread/subprocess
    try:
        subprocess.run(
            ["python", "-m", "arq", "app.workers.settings.WorkerSettings"],
            check=True
        )
    except KeyboardInterrupt:
        sys.exit(0)
