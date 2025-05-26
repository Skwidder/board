/*
Copyright (c) 2025 Jared Nishikawa

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
*/

import { opposite } from './common.js';
export {
    NetworkHandler
}

const letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";

// specifically into 4 bytes
function pack_int(n) {
    let byte_array = new Uint8Array([0, 0, 0, 0]);
    for (let i=0; i<4; i++) {
        let each_byte = n & 0xff;
        byte_array[i] = each_byte;
        n = (n-each_byte)/256;
    }
    return byte_array;
}

// it's really both a network handler and event handler
class NetworkHandler {
    constructor(shared, url) {
        this.shared = shared;
        this.url = url;
        this.connect();

        this.add_listeners();

        // in a var for now so we can do exponential backoff in the future
        this.backoff = 1000;

        // necessary because of cloudfront's auto-timeout max of 60sec
        setInterval(() => this.keep_warm(), 30000)
    }

    connect() {
        if (this.shared) {
            this.socket = new WebSocket(this.url);
            this.socket.onmessage = (event) => this.onmessage(event);
            this.socket.onopen = (event) => this.onopen(event);
            this.socket.onclose = (event) => this.reconnect(event);
        }
    }

    debug(message) {
        let payload = {"event": "debug", "value": message};
        this.send(payload);
    }

    onopen(event) {
        console.log("connected!");
        this.state.modals.hide_modal("info-modal");
        this.prepare_isprotected();
    }

    reconnect(event) {
        this.state.reset();
        if (!this.state.modals.modals_up.has("info-modal")) {
            this.state.modals.show_info_modal("Reconnecting...");
        }
        console.log("reconnecting in", this.backoff, "ms");
        setTimeout(() => this.connect(), this.backoff);
    }

    ready_state() {
        if (!this.shared) {
            return WebSocket.OPEN;
        }
        return this.socket.readyState;
    }

    // evidently necessary because unfocused tabs don't hide modals
    focus() {
        if (this.ready_state() == WebSocket.OPEN) {
            this.state.modals.hide_modal("info-modal");
        }
    }

    add_listeners() {
        document.addEventListener("click", (event) => this.click(event));
        document.addEventListener("pointermove", (event) => this.pointermove(event));
        document.addEventListener("pointerdown", (event) => this.pointerdown(event));
        document.addEventListener("pointerup", (event) => this.pointerup(event));

        document.addEventListener("touchstart", (event) => this.touchstart(event));
        document.addEventListener("touchend", (event) => this.touchend(event));
        // the passive arg is necessary to disable regular touch events
        document.addEventListener("touchmove", (event) => this.touchmove(event), {passive: false});

        document.addEventListener("keydown", (event) => this.keydown(event));
        document.addEventListener("keyup", (event) => this.keyup(event));

        window.addEventListener("focus", () => this.focus());
    }

    set_state(state) {
        this.state = state;
    }

    keep_warm() {
        let payload = {"event": "ping"};
        this.prepare(payload);
    }

    fromserver(payload) {
        let evt = payload["event"];
        var coords;
        var index;
        var value;
        var userid;
        switch (evt) {
            case "keydown":
                if (payload["value"] == "ArrowLeft") {
                    this.state.left();
                } else if (payload["value"] == "ArrowRight") {
                    this.state.right();
                } else if (payload["value"] == "ArrowUp") {
                    this.state.up();
                } else if (payload["value"] == "ArrowDown") {
                    this.state.down();
                }
                break;
            case "add_stone":
                coords = payload["value"];
                this.state.place_stone(coords[0], coords[1], payload["color"]);
                break;
            case "remove_stone":
                coords = payload["value"];
                this.state.remove_stone(coords[0], coords[1]);
                break;
            case "pass":
                this.state.pass(payload["color"]);
                break;
            case "triangle":
                coords = payload["value"];
                this.state.place_triangle(coords[0], coords[1]);
                break;
            case "square":
                coords = payload["value"];
                this.state.place_square(coords[0], coords[1]);
                break;
            case "letter":
                coords = payload["value"]["coords"];
                this.state.place_letter(coords[0], coords[1], payload["value"]["letter"]);
                break;
            case "number":
                coords = payload["value"]["coords"];
                this.state.place_number(coords[0], coords[1], payload["value"]["number"]);
                break;
            case "remove_mark":
                coords = payload["value"];
                this.state.remove_mark(coords[0], coords[1]);
                break;
            case "handshake":
                value = payload["value"];
                this.state.handshake(JSON.parse(value));
                break;
            case "upload_sgf":
                value = payload["value"];
                // just reset the board and reuse the handshake function
                this.state.reset();
                this.state.handshake(JSON.parse(value));
                break;
            case "button":
                if (payload["value"] == "Rewind") {
                    this.state.rewind();
                } else if (payload["value"] = "FastForward") {
                    this.state.fastforward();
                }
                break;
            case "goto_grid":
                index = payload["value"];
                this.state.goto_index(index);
                break;
            case "goto_coord":
                coords = payload["value"];
                this.state.goto_coord(coords[0], coords[1]);
                break;
            case "trash":
                this.state.reset();
                break;
            case "scissors":
                index = payload["value"];
                this.state.cut(index);
                break;
            case "update_buffer":
                value = payload["value"];
                this.state.update_buffer(value);
                break;
            case "update_settings":
                value = payload["value"];
                this.state.update_settings(value);
                break;
            case "draw":
                let [x0,y0,x1,y1, pen_color] = payload["value"];
                this.state.draw_pen(x0, y0, x1, y1, pen_color);
                break;
            case "erase_pen":
                this.state.erase_pen();
                break;
            case "comment":
                this.state.comments.update(payload["value"]);
                this.state.comments.store(payload["value"]);
                break;
            case "error":
                value = payload["value"];
                this.state.modals.show_error_modal(value);
                console.log(this.state.board.tree.to_sgf());
                break;
            case "isprotected":
                if (payload["value"]) {
                    let handler = () => {
                        let v = this.state.modals.get_prompt_bar();
                        this.prepare_checkpassword(v);
                    }
                    this.state.modals.show_prompt_modal(
                        "Enter password:",
                        handler
                    );
                }
                break;
            case "checkpassword":
                if (payload["value"] != "") {
                    this.state.update_password(payload["value"]);
                } else {
                    this.state.modals.show_toast(
                        "Wrong password. You can observe, but not edit"
                    );
                }
                break;
            case "global":
                value = payload["value"];
                this.state.modals.show_toast(value);
                break;
            case "connection":
                userid = payload["userid"];
                this.state.handle_connection(userid);
                break;
            case "disconnection":
                userid = payload["userid"];
                this.state.handle_disconnection(userid);
                break;
            case "connected_users":
                value = payload["value"];
                this.state.handle_current_users(value);
                break;
        }
    }

    prepare_pass() {
        let payload = {"event":"pass", "color":this.state.color};
        this.prepare(payload);
    }

    prepare_rewind() {
        let payload = {"event":"button", "value":"Rewind"};
        this.prepare(payload);
    }

    prepare_fastforward() {
        let payload = {"event":"button", "value":"FastForward"};
        this.prepare(payload);
    }

    prepare_left() {
        let payload = {"event":"keydown","value":"ArrowLeft"};
        this.prepare(payload);
    }

    prepare_right() {
        let payload = {"event":"keydown","value":"ArrowRight"};
        this.prepare(payload);
    }

    prepare_up() {
        let payload = {"event":"keydown","value":"ArrowUp"};
        this.prepare(payload);
    }

    prepare_down() {
        let payload = {"event":"keydown","value":"ArrowDown"};
        this.prepare(payload);
    }

    prepare_upload(data) {
        let payload = {"event":"upload_sgf", "value": data};
        this.prepare(payload);
    }

    prepare_request(url) {
        let payload = {"event":"request_sgf", "value": url};
        this.prepare(payload);
    }

    prepare_link_ogs_game(url) {
        let payload = {"event":"link_ogs_game", "value": url};
        this.prepare(payload);
    }

    prepare_trash() {
        let payload = {"event":"trash", "value": "all"};
        this.prepare(payload);
    }

    prepare_scissors() {
        let payload = {"event":"scissors", "value": this.state.board.tree.current.index};
        this.prepare(payload);
    }

    prepare_settings(settings) {
        let payload = {"event": "update_settings", "value": settings};
        this.prepare(payload);
    }

    prepare_buffer(num) {
        let payload = {"event":"update_buffer", "value": num};
        this.prepare(payload);
    }

    prepare_erase_pen() {
        let payload = {"event":"erase_pen"};
        this.prepare(payload);
    }

    prepare_comment(text) {
        let payload = {"event": "comment", "value": text};
        this.prepare(payload);
    }

    prepare_isprotected() {
        let payload = {"event": "isprotected"};
        this.prepare(payload);
    }

    prepare_checkpassword(text) {
        let payload = {"event": "checkpassword", "value": text};
        this.prepare(payload);
    }

    prepare(payload) {
        // before anything check for integrity of socket
        if (this.ready_state() != WebSocket.OPEN) {
            return;
        }

        let evt = payload["event"];

        // if a modal is up, then the events we allow are:
        // "trash"
        // "update_settings"
        // "scissors"
        // "upload_sgf"
        // "request_sgf"
        // "link_ogs_game"
        // "checkpassword"
        if (
            this.state.modals.modals_up.size > 0 &&
            evt != "trash" &&
            evt != "update_settings" &&
            evt != "scissors" &&
            evt != "upload_sgf" &&
            evt != "request_sgf" &&
            evt != "link_ogs_game" &&
            evt != "checkpassword") {
            return;
        }

        // pointer movements don't get shared...
        // ...unless the pointer is down or the mark is "pen"
        if (evt == "pointermove") {
            let coords = payload["value"];
            if (this.state.mark != "") {
                this.state.board_graphics.draw_ghost_mark(coords[0], coords[1]);
            } else {
                this.state.board_graphics.draw_ghost_stone(coords[0], coords[1], this.state.color);
            }
            return;
        }

        if (this.shared) {
            this.send(payload);
            return;
        }

        // only gets called if not shared
        // because server repeats messages to everyone
        this.fromserver(payload);
    }

    send(payload) {
        //console.log("sending:", payload);
        
        // first create the json payload
        let json_payload = JSON.stringify(payload);

        // then send the length to the socket
        let length = pack_int(json_payload.length);
        this.socket.send(length);

        // then send the payload
        this.socket.send(json_payload);
    }


    onmessage(event) {
        //console.log("receiving:", event.data);
        let payload = JSON.parse(event.data);
        this.fromserver(payload);
    }

    keydown(event) {
        let payload = {"event": "keydown", "value": event.key};
        let shift = this.state.keys_down.has("Shift");
        let ctrl = this.state.keys_down.has("Control");
        let alt = this.state.keys_down.has("Alt");
        // logical xor
        let jump = this.state.branch_jump != shift

        switch(event.key) {
            case "ArrowUp":
                if (jump){
                    let index = this.state.get_index_up();
                    if (index == -1) {
                        return;
                    }
                    payload = {"event": "goto_grid", "value": index};
                    this.prepare(payload);
                }else{
                    this.prepare(payload);
                }
                break;

            case "ArrowDown":
                if (jump){
                    let index = this.state.get_index_down();
                    if (index == -1) {
                        return;
                    }
                    payload = {"event": "goto_grid", "value": index};
                    this.prepare(payload);
                }else{
                    this.prepare(payload);
                }
                break;

            case "ArrowLeft":
            case "ArrowRight":
                this.prepare(payload);
                break;
            
            case "1":
                if (shift || ctrl || alt) {break;}
                this.state.set_toggle();
                break;
            case "2":
                if (shift || ctrl || alt) {break;}
                this.state.set_black();
                break;
            case "3":
                if (shift || ctrl || alt) {break;}
                this.state.set_white();
                break;
            case "4":
                if (shift || ctrl || alt) {break;}
                this.prepare_pass();
                break;
            case "5":
                if (shift || ctrl || alt) {break;}
                this.state.set_triangle();
                break;
            case "6":
                if (shift || ctrl || alt) {break;}
                this.state.set_square();
                break;
            case "7":
                if (shift || ctrl || alt) {break;}
                this.state.set_letter();
                break;
            case "8":
                if (shift || ctrl || alt) {break;}
                this.state.set_number();
                break;
            case "9":
                if (shift || ctrl || alt) {break;}
                this.state.set_pen();
                break;
            case "0":
                if (shift || ctrl || alt) {break;}
                this.prepare_erase_pen();
                break;
            default:
                this.state.keys_down.set(event.key, true);
        }
    }

    keyup(event) {
        if (this.state.keys_down.has(event.key)) {
            this.state.keys_down.delete(event.key);
        }
    }

    pointerdown(event) {
        if (event.pointerType == "mouse") {
            this.state.ispointerdown = true;
            //let payload = {"event": "pointerdown"};
            //this.prepare(payload);
        }
    }

    pointerup(event) {
        if (event.pointerType == "mouse") {
            this.state.ispointerdown = false;
            this.state.penx = null;
            this.state.peny = null;

            //let payload = {"event": "pointerup"};
            //this.prepare(payload);
        }
    }

    pointermove(event) {
        if (event.pointerType == "mouse") {
            if (this.state.mark == "pen" && this.state.ispointerdown) {
                let [x,y,inside] = this.state.board_graphics.board_relative_coords(event.clientX, event.clientY);
                let payload = {"event": "draw", "value": [this.state.penx, this.state.peny, x, y, this.state.pen_color]};
                this.state.penx = x;
                this.state.peny = y;
                this.prepare(payload);
            } else {
                let coords = this.state.board_graphics.pos_to_coord(event.clientX, event.clientY);
                let payload = {"event": "pointermove", "value": coords};
                this.prepare(payload);
            }
        }
        // mobile doesn't get ghosts
    }

    touchstart(event) {
        this.state.ispointerdown = true;
    }

    touchend(event) {
        this.state.ispointerdown = false;
        this.state.penx = null;
        this.state.peny = null;
    }

    touchmove(event) {
        if (this.state.mark == "pen" && this.state.ispointerdown) {
            let touch = event.touches[0];
            let [x,y,inside] = this.state.board_graphics.board_relative_coords(touch.clientX, touch.clientY);
            if (inside) {
                // necessary for capturing touch inside svg
                // for example, disables "pull refresh" on android
                event.preventDefault();
            }
            let payload = {"event": "draw", "value": [this.state.penx, this.state.peny, x,y, this.state.pen_color]};
            this.state.penx = x;
            this.state.peny = y;

            this.prepare(payload);
        }
        // nothing to do if this.mark != "pen"
    }

    click(event) {
        // check to see if it's within explorer
        let x = event.clientX;
        let y = event.clientY;
        let flip = this.state.keys_down.has("Shift");

        let explorer_node = this.state.tree_graphics.capture_mouse(x, y);
        if (explorer_node != 0 && explorer_node != 1) {
            let payload = {"event": "goto_grid", "value": explorer_node.index};
            this.prepare(payload);
            return;
        }
        let coords = this.state.board_graphics.pos_to_coord(x, y);

        // don't need to share if click is outside the board
        if (coords[0] < 0 || coords[1] < 0 || coords[0] >= this.state.size || coords[1] >= this.state.size) {
            return;
        }

        // also don't need to share if there is already a stone there
        let has_child = false;
        let stone_there = this.state.board.points[coords[0]][coords[1]] != 0;

        let payload = {};

        if (this.state.mark != "") {
            let id = coords[0].toString() + "-" + coords[1].toString();
            if (this.state.board_graphics.marks.has(id)) {
                payload = {"event": "remove_mark", value: coords};
            } else {
                payload = {"event": this.state.mark};
                switch(this.state.mark) {
                    case "triangle":
                        payload["value"] = coords;
                        break;
                    case "square":
                        payload["value"] = coords;
                        break;
                    case "letter":
                        let letter_index = this.state.board_graphics.get_letter();
                        let letter = "";
                        if (letter_index != null) {
                            letter = letters[letter_index%26];
                        }
    
                        payload["value"] = {"coords": coords, "letter": letter};
                        break;
                    case "number":
                        let number = this.state.board_graphics.get_number();
                        payload["value"] = {"coords": coords, "number": number};
                        break;
                }
            }
        } else if (this.state.toggling) {
            if (this.state.keys_down.has("Shift")) {
                payload = {"event": "goto_coord", "value": coords};
            } else {
                if (stone_there) {
                    return;
                }
                //payload = {"event": "stone-toggle", "value": coords, "color": this.state.color};
                payload = {"event": "add_stone", "value": coords, "color": this.state.color};
            }
        } else {
            if (stone_there) {
                // if there is a stone there already and we are in manual mode
                // then remove the stone
                payload = {"event": "remove_stone", "value": coords};
            } else {
                let color = this.state.color;
                if (flip) {
                    color = opposite(color);
                }
                //payload = {"event": "stone-manual", "value": coords, "color": color};
                payload = {"event": "add_stone", "value": coords, "color": color};
            }
        }
        this.prepare(payload);
    }
}
