# Copyright (c) 2025 Jared Nishikawa
# 
# Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:
# 
# The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.
# 
# THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.

from flask import Flask, render_template, make_response, redirect, request, abort
from websockets.sync.client import connect
import jinja2
import json
import base64
import uuid
import os
import logging
import struct

app = Flask(__name__)

ws_port = 9000
ws_host = "localhost"

def sanitize(s):
    ok = ""
    for c in s:
        if (c >= '0' and c <= '9') or (c >= 'A' and c <= 'Z') or (c >= 'a' and c <= 'z'):

            ok += c
    return ok

@app.route('/favicon.ico')
def favicon():
    return app.send_static_file("favicon.svg")

@app.get("/<path>.js")
def any_js(path):
    try:
        resp = make_response(render_template(f"{path}.js"))
        resp.headers["Content-Type"] = "text/javascript"
        return resp
    except jinja2.exceptions.TemplateNotFound:
        app.logger.info("404 - " + request.path)
        return render_template("404.html"), 404

@app.get("/")
def index():
    return render_template("index.html")

@app.get("/about", strict_slashes=False)
def about():
    return render_template("about.html")

@app.get("/b/<path>", strict_slashes=False)
def board(path):
    if path != sanitize(path):
        app.logger.info("400 - " + request.path)
        return render_template("400.html"), 400

    app.logger.info("[*] - " + "/b/" + path)
    return render_template("board.html")

@app.get("/b/<path>/sgf", strict_slashes=False)
def sgf(path):
    ws_url = f"ws://{ws_host}:{ws_port}/b/{path}/sgf"

    with connect(ws_url) as websocket:
        message = websocket.recv()
        decoded =  base64.b64decode(message)
        resp = make_response(decoded)
        resp.headers["Content-Type"] = "text/plain"
        return resp

@app.get("/b/<path>/sgfix", strict_slashes=False)
def sgfix(path):
    ws_url = f"ws://{ws_host}:{ws_port}/b/{path}/sgfix"

    with connect(ws_url) as websocket:
        message = websocket.recv()
        decoded =  base64.b64decode(message)
        resp = make_response(decoded)
        resp.headers["Content-Type"] = "text/plain"
        return resp

@app.post("/new")
def new_board():
    board_id = request.form.get("board_id")
    board_id = sanitize(board_id)

    if not board_id.strip():
        board_id = uuid.uuid4().hex
    return redirect(f"/b/{board_id}")

@app.get("/upload")
def upload_board():
    url = request.args.get("url")
    board_id = request.args.get("board_id")
    if not board_id:
        board_id = ""
    board_id = sanitize(board_id)
    if not board_id.strip():
        board_id = uuid.uuid4().hex
    if url is not None:
        request_sgf(board_id, url)
    return redirect(f"/b/{board_id}")

@app.errorhandler(404)
def page404(e):
    app.logger.info("404 - " + request.path)
    return render_template("404.html"), 404

def websocket_send(json_payload, board_id):
    route = f"/b/{board_id}"
    ws_url = f"ws://{ws_host}:{ws_port}{route}"
    payload = json.dumps(json_payload).encode()
    length = struct.pack("I", len(payload))
    with connect(ws_url) as websocket:
        websocket.send(length)
        websocket.send(payload)

def request_sgf(board_id, url):
    json_payload = {"event": "request_sgf", "value": url}
    websocket_send(json_payload, board_id)

if __name__ == "__main__":
    app.run(port=8080)

