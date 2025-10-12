#!/usr/bin/env python3
"""
WSGI Bridge Application
This runs the Node.js application alongside a Flask proxy for gunicorn compatibility.
"""
import os
import subprocess
import threading
import time
import sys
from flask import Flask, request, Response
import requests

app = Flask(__name__)

# Set environment variables
os.environ['NODE_ENV'] = 'development'
os.environ['PORT'] = '5001'  # Run Node on 5001, Flask on 5000

# Node.js process holder
node_process = None
node_ready = False

def start_node_server():
    """Start the Node.js server in a separate thread"""
    global node_process, node_ready
    try:
        print("🚀 Starting Node.js server...")
        node_process = subprocess.Popen(
            ['npx', 'tsx', 'server/index.ts'],
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            env=os.environ.copy(),
            text=True,
            bufsize=1
        )
        
        # Monitor Node.js output
        for line in node_process.stdout:
            print(f"[Node.js] {line.strip()}")
            if "serving on port" in line.lower():
                node_ready = True
                
    except Exception as e:
        print(f"❌ Error starting Node.js: {e}")

# Start Node.js server in background thread
node_thread = threading.Thread(target=start_node_server, daemon=True)
node_thread.start()

# Wait for Node.js to be ready
print("⏳ Waiting for Node.js server...")
for _ in range(30):
    time.sleep(1)
    if node_ready:
        break

if node_ready:
    print("✅ Node.js server is ready!")
else:
    print("⚠️  Node.js server may not be fully ready yet")

@app.route('/', defaults={'path': ''})
@app.route('/<path:path>', methods=['GET', 'POST', 'PUT', 'DELETE', 'PATCH'])
def proxy(path):
    """Proxy all requests to the Node.js server"""
    try:
        url = f"http://localhost:5001/{path}"
        if request.query_string:
            url += f"?{request.query_string.decode()}"
        
        resp = requests.request(
            method=request.method,
            url=url,
            headers={key: value for key, value in request.headers if key.lower() != 'host'},
            data=request.get_data(),
            cookies=request.cookies,
            allow_redirects=False,
            timeout=30
        )
        
        excluded_headers = ['content-encoding', 'content-length', 'transfer-encoding', 'connection']
        headers = [(name, value) for name, value in resp.raw.headers.items()
                   if name.lower() not in excluded_headers]
        
        return Response(resp.content, resp.status_code, headers)
    except requests.exceptions.RequestException as e:
        return f"Proxy error: {str(e)}", 502

if __name__ == '__main__':
    print("🌐 Flask proxy running on port 5000, forwarding to Node.js on port 5001")
    app.run(host='0.0.0.0', port=5000, debug=False)
