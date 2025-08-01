/*
Copyright (c) 2025 Jared Nishikawa

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
*/


import { merge } from './sgf.js';
import { Board, from_sgf } from './board.js';
import { BoardGraphics } from './boardgraphics.js';
import { TreeGraphics } from './treegraphics.js';

import { create_comments } from './comments.js';
import { create_buttons } from './buttons.js';
import { create_modals } from './modals.js';

import { letterstocoord, coordtoid, opposite, Coord, prefer_dark_mode } from './common.js';

export {
    State
}

const FrameType = {
    DIFF: 0,
    FULL: 1,
}

const letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";

function b64_encode_unicode(str) {
    const text_encoder = new TextEncoder('utf-8');
    const encoded_data = text_encoder.encode(str);
    return btoa(String.fromCharCode(...encoded_data));
}

class State {
    constructor() {
        window.addEventListener("resize", (event) => this.resize(event));
        this.compute_consts();
        this.color = 1;
        this.saved_color = 1;
        this.toggling = true;
        this.mark = "";
        this.input_buffer = 250;
        this.password = "";

        // pen variables
        this.pen_color = "#0000FF";
        this.ispointerdown = false;
        this.penx = null;
        this.peny = null;

        this.keys_down = new Map();

        this.branch_jump = true;

        this.dark_mode = false;
        this.board = new Board(this.size);
        this.marks = new Map();
        this.current = null;
        this.numbers = new Map();
        this.letters = new Array(26).fill(0);

        this.board_graphics = new BoardGraphics(this);
        this.tree_graphics = new TreeGraphics();

        this.comments = create_comments(this);
        this.connected_users = {};

        this.board_graphics.draw_board();

        create_buttons(this);

        this.modals = create_modals(this);
        if (prefer_dark_mode()) {
            this.dark_mode_toggle();
        }

        this.resize();
        this.gameinfo = new Map();
    }

    set_network_handler(handler) {
        this.network_handler = handler;
    }

    guest_nick(id) {
        return "Guest-" + id.substring(0, 4);
    }

    handle_current_users(users) {
        this.connected_users = {};
        for (let id in users) {
            let nick = users[id];
            if (nick == "") {
                nick = this.guest_nick(id);
            }
            this.connected_users[id] = nick;
        }
        this.modals.update_users_modal();
    }

    update_password(password) {
        this.password = password;
        this.modals.update_settings_modal();
    }

    update_settings(settings) {
        this.input_buffer = settings["buffer"];
        if (settings["size"] != this.size) {
            this.size = settings["size"];
            let review = document.getElementById("review");
            review.setAttribute("size", this.size);
            this.recompute_consts();
            this.board_graphics.reset_board();
            //this.tree_graphics.
            this.reset();
        }
        this.password = settings["password"];
        this.modals.update_settings_modal();
    }

    resize(event) {
        let content = document.getElementById("content");
        let arrows = document.getElementById("arrows");
        let h = arrows.offsetHeight*4.5;
        let new_width = Math.min(window.innerHeight*1.5 - h, window.innerWidth);
        content.style.width = new_width + "px";

        this.recompute_consts();
        this.board_graphics.resize();
        this.tree_graphics.resize();
        this.comments.resize();
        this.apply_pen();
    }

    get_index_up() {
        let [x,y] = this.tree_graphics.current;

        while (true) {
            y--;
            if (y < 0) {
                return -1;
            }

            if (!this.tree_graphics.grid.has(y)) {
                continue;
            }

            let row = this.tree_graphics.grid.get(y);
            if (row.has(x)) {
                return row.get(x);
            }
        }
    }

    get_index_down() {
        let [x,y] = this.tree_graphics.current;

        while (true) {
            y++;
            if (!this.tree_graphics.grid.has(y)) {
                return -1;
            }

            let row = this.tree_graphics.grid.get(y);
            if (row.has(x)) {
                return row.get(x);
            }
        }

    }

    next_letter() {
        for (let i = 0; i < 26; i++) {
            if (this.letters[i] == 0) {
                return letters[i];
            }
        }
        return null;
    }

    free_letter(l) {
        let letter_index = l.charCodeAt(0)-65;
        this.letters[letter_index] = 0;
    }

    next_number() {
        let i = 1;
        while (true) {
            if (this.numbers.get(i) == null) {
                return i;
            }
            i++;
        }
    }

    free_number(i) {
        this.numbers.delete(i);
    }

    reset() {
        this.board_graphics.clear_and_remove();
        this.color = 1;
        this.saved_color = 1;
        this.toggling = true;
        this.mark = "";

        this.board = new Board(this.size);
        //this.tree_graphics.clear_all();
        // update move number
        this.update_move_number();

        // update comments
        this.update_comments();

        this.modals.update_modals();
    }

    get_gameinfo() {
        return this.gameinfo;
    }

    set_gameinfo(fields_object) {
        let fields = new Map(Object.entries(fields_object));
        if (fields == null) {
            fields = new Map();
        }
        let gameinfo = {};

        // currently doesn't play very nice with chinese characters

        if (fields.has("PB")) {
            let rank = "";
            if (fields.has("BR")) {
                rank = " [" + fields.get("BR") + "]";
            }
            gameinfo["Black"] = fields.get("PB") + rank;
        } else {
            gameinfo["Black"] = "Black";
        }

        if (fields.has("PW")) {
            let rank = "";
            if (fields.has("WR")) {
                rank = " [" + fields.get("WR") + "]";
            }
            gameinfo["White"] = fields.get("PW") + rank;
        } else {
            gameinfo["White"] = "White";
        }

        if (fields.has("RE")) {
            gameinfo["Result"] = fields.get("RE");
        }

        if (fields.has("KM")) {
            gameinfo["Komi"] = fields.get("KM");
        }

        if (fields.has("DT")) {
            gameinfo["Date"] = fields.get("DT");
        }

        if (fields.has("RU")) {
            gameinfo["Ruleset"] = fields.get("RU");
        }

        /*
        if (fields.has("PC")) {
            gameinfo["Place"] = fields.get("PC");
        }

        if (fields.has("SO")) {
            gameinfo["Source"] = fields.get("SO");
        }

        if (fields.has("EV")) {
            gameinfo["Event"] = fields.get("EV");
        }

        if (fields.has("N")) {
            gameinfo["Name"] = fields.get("N");
        }

        if (fields.has("GN")) {
            gameinfo["Game Name"] = fields.get("GN");
        }
        */

        this.gameinfo = gameinfo;
    }

    compute_consts() {
        let review = document.getElementById("review");
        let size = parseInt(review.getAttribute("size"));
        let arrows = document.getElementById("arrows");

        // this is the number of "squares" across the board, including margins
        let n = size+1;
        this.width = parseInt(review.offsetWidth) * (n-2)/n;
        this.size = size;
        this.side = this.width/(this.size-1);
        this.pad = this.side;

        // this is not very elegant
        let w = this.width + this.pad*2;
        review.style.height = w + "px";
        arrows.style.width = w + "px";
    }


    recompute_consts() {
        this.compute_consts();
        this.board_graphics.recompute_consts();
    }

    dark_mode_toggle() {
        let color = "#1A1A1A";
        let old_class = "btn-light";
        let new_class = "btn-dark";
        let new_setting = true;
        let old_icon = "bi-moon-fill";
        let new_icon = "bi-sun-fill";
        let old_black_stone = "bi-circle-fill";
        let new_black_stone = "bi-circle";
        if (this.dark_mode) {
            color = "#F5F5F5";
            old_class = "btn-dark";
            new_class = "btn-light";
            new_setting = false;
            old_icon = "bi-sun-fill";
            new_icon = "bi-moon-fill";
        }

        // change the setting
        this.dark_mode = new_setting;

        // change the background
        document.body.style.background = color;

        // change the buttons
        let buttons = document.querySelectorAll("button");
        for (let button of buttons) {
            let cls = button.getAttribute("class");
            let new_cls = cls.replace(old_class, new_class);
            button.setAttribute("class", new_cls);
        }

        // change the color picker
        let picker = document.getElementById("color-picker");
        if (picker != null) {
            let cls = picker.getAttribute("class");
            let new_cls = cls.replace(old_class, new_class);
            picker.setAttribute("class", new_cls);
        }

        // change the dark mode button
        //let dark_mode_icon = document.getElementsByClassName(old_icon)[0];
        //dark_mode_icon.setAttribute("class", new_icon);

        // change the black and white stone icons
        let black_stone_icon = document.getElementsByClassName(old_black_stone)[0];
        let white_stone_icon = document.getElementsByClassName(new_black_stone)[0];
        black_stone_icon.setAttribute("class", new_black_stone);
        white_stone_icon.setAttribute("class", old_black_stone);

    }

    update_comments() {
        this.comments.clear();
        if (!this.board.tree.current.fields.has("C")) {
            return;
        }
        let cmts = this.board.tree.current.fields.get("C");
        for (let cmt of cmts) {
            cmt = cmt.trim();
            for (let cmt_line of cmt.split("\n")) {
                this.comments.update(cmt_line);
            }
        }
    }

    comments_toggle() {
        if (this.comments.hidden()) {
            this.comments.show();
        } else {
            this.comments.hide();
        }
    }

    update_move_number() {
        let num = document.getElementById("move-number");
        let d = this.board.tree.current_depth-1;
        num.innerHTML = d;
    }

    toggle_color() {
        if (this.color == 1) {
            this.color = 2;
        } else {
            this.color = 1;
        }
    }

    set_black() {
        this.saved_color = this.color;
        this.color = 1;
        this.toggling = false;
        this.mark = "";
        this.board_graphics.clear_ghosts();
    }

    set_white() {
        this.saved_color = this.color;
        this.color = 2;
        this.toggling = false;
        this.mark = "";
        this.board_graphics.clear_ghosts();
    }

    set_toggle() {
        this.toggling = true;
        this.update_toggle_color();
        this.mark = "";
        this.board_graphics.clear_ghosts();
    }

    set_eraser() {
        this.mark = "eraser";
        this.board_graphics.clear_ghosts();
    }

    set_pen() {
        this.mark = "pen";
        this.board_graphics.clear_ghosts();
    }

    draw_pen(x0, y0, x1, y1, pen_color) {
        // draw it
        this.board_graphics.draw_pen(x0, y0, x1, y1, pen_color);

        // save in the sgf

        if (x0 == null) {
            x0 = -1.0;
        }
        if (y0 == null) {
            y0 = -1.0;
        }
        let digs = 4;
        let s = x0.toFixed(digs) + ":" + y0.toFixed(digs) + ":" +
            x1.toFixed(digs) + ":" + y1.toFixed(digs) + ":" + pen_color;
        this.board.tree.current.add_field("PX", s);
    }

    apply_pen() {
        for (let [key, values] of this.board.tree.current.fields) {
            if (key == "PX") {
                for (let v of values) {
                    let tokens = v.split(":");
                    if (tokens.length != 5) {
                        continue;
                    }
                    let x0 = parseFloat(tokens[0]);
                    let y0 = parseFloat(tokens[1]);
                    let x1 = parseFloat(tokens[2]);
                    let y1 = parseFloat(tokens[3]);
                    let pen_color = tokens[4];
                    if (x0 == -1.0) {
                        x0 = null;
                    }
                    if (y0 == -1.0) {
                        y0 = null;
                    }

                    this.board_graphics.draw_pen(x0, y0, x1, y1, pen_color);
                }
            }
        }

    }

    erase_pen() {
        this.board_graphics.clear_pen();
        this.board.tree.current.fields.delete("PX");
    }

    update_toggle_color() {
        // update color
        if (this.toggling) {
            let cur = this.board.tree.current;

            if (cur.color() == 1) {
                this.color = 2;
            } else if (cur.color() == 2) {
                this.color = 1;
            } else if (cur.down.length > 0) {
                // TODO: make this better. make toggling better everywhere
                let c = cur.down[0].color();
                if (c > 0) {
                    this.color = c;
                }
            }
            // just make sure the color doesn't end up 0
            if (this.color == 0) {
                this.color = 1;
            }
        }
    }

    set_triangle() {
        this.mark = "triangle";
        this.board_graphics.clear_ghosts();
    }

    set_square() {
        this.mark = "square";
        this.board_graphics.clear_ghosts();
    }

    set_letter() {
        this.mark = "letter";
        this.board_graphics.clear_ghosts();
    }

    set_number() {
        this.mark = "number";
        this.board_graphics.clear_ghosts();
    }

    upload() {
        let inp = document.getElementById("upload-sgf");
        inp.onchange = () => {
            // hide the upload modal
            this.modals.hide_modal("upload-modal");

            if (inp.files.length == 0) {
                // i guess do nothing
                return;
            } else if (inp.files.length == 1) {
                // if 1 file, it's easy
                let f = inp.files[0];
                let reader = new FileReader();
                reader.readAsText(f);

                reader.addEventListener(
                    "load",
                    () => {
                        // encode unicode, and encode with base64
                        this.network_handler.prepare_upload(b64_encode_unicode(reader.result));
                    },
                    false,
                );
            } else {
                // max out at 10, just in case
                let max = 10;
                let i = 0;
                // if multiple files, build promises
                let promises = [];
                for (let f of inp.files) {
                    if (i >= max) {
                        break;
                    }
                    i++;
                    promises.push(
                        new Promise((resolve, reject) => {
                            let reader = new FileReader();
                            reader.readAsText(f);
                            reader.addEventListener(
                                "load",
                                () => resolve(reader.result),
                                false,
                            );
                        })
                    );
                }
    
                // turn list of promises into 1 promise
                Promise.all(promises)
                    .then((values) => {
                        let sgf = merge(values);
                        // encode unicode, and encode with base64
                        this.network_handler.prepare_upload(b64_encode_unicode(sgf));
                    }
                    );
            }

        }
    }

    paste() {
        let textarea = document.getElementById("upload-textarea");
        // get the textarea value
        let value = textarea.value;
        // hide the upload modal
        textarea.value = "";

        // because of promises, i have to wait until the data from the
        // url is fetched before i hide the upload modal
        // otherwise the upload modal is hidden before the data returns
        // and an erroneous stone shows up on the board for a split
        // second before the new sgf is loaded
        if (value.startsWith("http")) {
            this.network_handler.prepare_request(value);
            setTimeout(() => this.modals.hide_modal("upload-modal"), 0);
        } else {
            this.network_handler.prepare_upload(b64_encode_unicode(value));
            // i swear...
            // even though the timeout is set to 0, if we take it out
            // then there is a problem where the "click" event closes the modal
            // first and then a stone appears on the board
            // so just... leave this alone, even if it looks weird
            setTimeout(() => this.modals.hide_modal("upload-modal"), 0);
        }
    }

    link_ogs_game() {
        let textarea = document.getElementById("ogs-textarea");
        // get the textarea value
        let value = textarea.value;
        textarea.value = "";

        this.network_handler.prepare_link_ogs_game(value);

        // hide the upload modal
        this.modals.hide_modal("upload-modal");
    }


    get_sgf_link() {
        let href = window.location.href;
        return href + "/sgf";
    }

    get_link() {
        return window.location.href;
    }

    copy(text) {
        navigator.clipboard.writeText(text);
    }

    download() {
        // stolen from stack overflow
        //let text = this.board.to_sgf();
        var element = document.createElement('a');
        let href = window.location.href;
        element.setAttribute("href", href + "/sgf");
        //element.setAttribute('href', 'data:text/plain;charset=utf-8,' + encodeURIComponent(text));
        let basename = href.split("/").pop();
        element.setAttribute('download', basename + ".sgf");

        element.style.display = 'none';
        document.body.appendChild(element);

        element.click();

        document.body.removeChild(element);
    }

    handle_frame(frame) {
        // clear all marks
        this.marks = new Map();
        this.numbers = new Map();
        this.letters = new Array(26).fill(0);

        this.handle_metadata(frame.metadata);

        if (frame.type == FrameType.DIFF) {
            this.apply_diff(frame.diff);
        } else if (frame.type == FrameType.FULL) {
            this.full_frame(frame.diff);
        }
        if (frame.marks != null) {
            this.handle_marks(frame.marks);
        }

        if (frame.explorer != null) {
            this.tree_graphics._update(frame.explorer);
        }

    }

    handle_marks(marks) {
        if ("current" in marks && marks.current != null) {

            let coord = marks.current;
            this.board_graphics.clear_current();
            // TODO: fix color here
            this.board_graphics._draw_current(coord.x, coord.y, opposite(this.board.get(coord)));
            this.current = coord;
        }

        if ("squares" in marks && marks.squares != null) {

            let squares = marks.squares;
            for (let coord of squares) {
                this.place_square(coord);
                /*
                let color = 1;
                if (this.board.get(coord) == 1) {
                    color = 2;
                }
                this.board_graphics._draw_square(coord.x, coord.y, color);
                let id = coordtoid(coord);
                this.marks.set(id, "square");
                */
            }
        }

        if ("triangles" in marks && marks.triangles != null) {

            let triangles = marks.triangles;

            for (let coord of triangles) {
                this.place_triangle(coord);
                /*
                let color = 1;
                if (this.board.get(coord) == 1) {
                    color = 2;
                }
                this.board_graphics._draw_triangle(coord.x, coord.y, color);

                let id = coordtoid(coord);
                this.marks.set(id, "triangle");
                */
            }
        }

        if ("labels" in marks && marks.labels != null) {

            let labels = marks.labels;
            for (let lb of labels) {
                this.place_label(lb);

                /*
                let coord = lb.coord
                let id = coordtoid(coord);

                let i = parseInt(lb.text);
                if (Number.isInteger(i)) {
                    this.marks.set(id, "number:" + lb.text);
                    this.numbers.set(i, 1);
                    this.board_graphics._draw_manual_number(coord.x, coord.y, lb.text);
                } else {
                    this.marks.set(id, "letter:" + lb.text);
                    let letter_index = lb.text.charCodeAt(0)-65;
                    this.letters[letter_index] = 1;
                    this.board_graphics._draw_manual_letter(coord.x, coord.y, lb.text);
                }
                */
            }
        }
    }

    full_frame(frame) {
        if (frame == null) {
            return;
        }

        this.board.clear();
        this.board_graphics.clear_and_remove();
        for (let a of frame.add) {
            let col = a["color"];
            let coords = a["coords"];
            for (let coord of coords) {
                this._place_stone(coord.x, coord.y, col);
            }
        }
    }

    handle_metadata(metadata) {
        if (metadata == null) {
            return;
        }
        if (metadata.size != null) {

            this.set_gameinfo(metadata.fields);

            let review = document.getElementById("review");
            review.setAttribute("size", metadata.size);
            this.recompute_consts();
            this.board_graphics.reset_board();
            this.reset();
        }
    }

    apply_diff(diff) {
        if (diff == null) {
            return;
        }
        for (let a of diff.add) {
            let col = a["color"];
            let coords = a["coords"];
            for (let coord of coords) {
                this._place_stone(coord.x, coord.y, col);
                this.board.set(coord, col);
            }
        }
        for (let r of diff.remove) {
            let coords = r["coords"];
            for (let coord of coords) {
                this.remove_stone(coord.x, coord.y);
                this.board.set(coord, 0);
            }
        }
    }

    // TODO: this function does too much
    _place_stone(x, y, color) {
        // if out of bounds, just return
        if (x < 0 || x >= this.size || y < 0 || y >= this.size) {
            return;
        }

        let coord = new Coord(x, y);
        this.board.set(coord, color);

        this.board_graphics.remove_marks();
        this.board_graphics.draw_stone(x, y, color);

        if (this.toggling) {
            this.toggle_color();
        }

        this.update_comments();
        this.update_move_number();
    }

    place_triangle(coord) {
        let color = 1;
        if (this.board.get(coord) == 1) {
            color = 2;
        }
        this.board_graphics._draw_triangle(coord.x, coord.y, color);

        let id = coordtoid(coord);
        this.marks.set(id, "triangle");

        /*
        if (x < 0 || x >= this.size || y < 0 || y >= this.size) {
            return;
        }

        let coord = new Coord(x, y);
        let l = coord.to_letters();

        this.board_graphics.draw_mark(x, y, "triangle");
        this.board.tree.current.add_field("TR", l);
        */
    }

    place_square(coord) {
        let color = 1;
        if (this.board.get(coord) == 1) {
            color = 2;
        }
        this.board_graphics._draw_square(coord.x, coord.y, color);
        let id = coordtoid(coord);
        this.marks.set(id, "square");

        /*
        if (x < 0 || x >= this.size || y < 0 || y >= this.size) {
            return;
        }

        let coord = new Coord(x, y);
        let l = coord.to_letters();

        this.board_graphics.draw_mark(x, y, "square");
        this.board.tree.current.add_field("SQ", l);
        */
    }

    place_label(lb) {
        // each lb has a coord and a text
        
        let coord = lb.coord
        let id = coordtoid(coord);

        let i = parseInt(lb.text);
        if (Number.isInteger(i)) {
            this.marks.set(id, "number:" + lb.text);
            this.numbers.set(i, 1);
            this.board_graphics._draw_manual_number(coord.x, coord.y, lb.text);
        } else {
            this.marks.set(id, "letter:" + lb.text);
            let letter_index = lb.text.charCodeAt(0)-65;
            this.letters[letter_index] = 1;
            this.board_graphics._draw_manual_letter(coord.x, coord.y, lb.text);
        }

    }

    remove_mark(x, y) {
        this.board_graphics.remove_mark(x, y);
    }

    remove_stone(x, y) {
        let erased = this.board.remove(x, y);
        // if there was no stone there, do nothing
        if (!erased) {
            return;
        }

        this.board_graphics.erase_stone(x, y);
        this.update_comments();
        this.update_move_number();
    }
}
