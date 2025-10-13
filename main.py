#!/usr/bin/env python3
"""
WSGI Bridge with WebSocket Support
Runs Node.js application with Flask proxy that supports WebSocket connections
"""
import os
import subprocess
import threading
import time
import sys
from flask import Flask, request, Response
import requests
from werkzeug.serving import run_simple
from gevent import monkey
from geventwebsocket import WebSocketError
from geventwebsocket.handler import WebSocketHandler
import socket

monkey.patch_all()

app = Flask(__name__)

os.environ['NODE_ENV'] = 'development'
os.environ['PORT'] = '5001'

node_process = None
node_ready = False

def start_node_server():
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
        
        for line in node_process.stdout:
            print(f"[Node.js] {line.strip()}")
            if "serving on port" in line.lower():
                node_ready = True
                
    except Exception as e:
        print(f"❌ Error starting Node.js: {e}")

node_thread = threading.Thread(target=start_node_server, daemon=True)
node_thread.start()

print("⏳ Waiting for Node.js server...")
for _ in range(30):
    time.sleep(1)
    if node_ready:
        break

if node_ready:
    print("✅ Node.js server is ready!")
else:
    print("⚠️  Node.js server may not be fully ready yet")

@app.route('/ws')
def websocket():
    """Handle WebSocket connections by proxying to Node.js WebSocket server"""
    if request.environ.get('wsgi.websocket'):
        ws = request.environ['wsgi.websocket']
        
        try:
            import websocket
            node_ws = websocket.create_connection("ws://localhost:5001/ws")
            
            def forward_to_node():
                while True:
                    try:
                        message = ws.receive()
                        if message:
                            node_ws.send(message)
                    except:
                        break
            
            def forward_from_node():
                while True:
                    try:
                        message = node_ws.recv()
                        if message:
                            ws.send(message)
                    except:
                        break
            
            t1 = threading.Thread(target=forward_to_node, daemon=True)
            t2 = threading.Thread(target=forward_from_node, daemon=True)
            t1.start()
            t2.start()
            
            t1.join()
            t2.join()
            
        except Exception as e:
            print(f"WebSocket error: {e}")
        finally:
            try:
                node_ws.close()
            except:
                pass
    
    return Response(status=426, headers={'Upgrade': 'websocket'})

@app.route('/', defaults={'path': ''})
@app.route('/<path:path>', methods=['GET', 'POST', 'PUT', 'DELETE', 'PATCH'])
def proxy(path):
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
    print("🌐 Flask proxy with WebSocket support running on port 5000")
    from gevent.pywsgi import WSGIServer
    from geventwebsocket.handler import WebSocketHandler
    
    http_server = WSGIServer(('0.0.0.0', 5000), app, handler_class=WebSocketHandler)
    http_server.serve_forever()
