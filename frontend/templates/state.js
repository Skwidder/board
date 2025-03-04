/*
Copyright (c) 2025 Jared Nishikawa

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
*/

import { Board, from_sgf } from './board.js';
import { BoardGraphics } from './boardgraphics.js';
import { TreeGraphics } from './treegraphics.js';

import { create_buttons } from './buttons.js';
import { create_modals } from './modals.js';

import { letters2coord, opposite, Coord } from './common.js';

export {
    State
}

function b64_encode_unicode(str) {
    const text_encoder = new TextEncoder('utf-8');
    const encoded_data = text_encoder.encode(str);
    return btoa(String.fromCharCode(...encoded_data));
}

function prefer_dark_mode() {
    return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
}
/* if i want to monitor for dark mode changes:
 window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', event => {
    const newColorScheme = event.matches ? "dark" : "light";
});
*/

class State {
    constructor() {
        window.addEventListener("resize", (event) => this.resize(event));
        this.compute_consts();
        this.color = 1;
        this.saved_color = 1;
        this.toggling = true;
        this.mark = "";
        this.input_buffer = 250;

        // pen variables
        this.pen_color = "#0000FF";
        this.ispointerdown = false;
        this.penx = null;
        this.peny = null;

        this.keys_down = new Map();

        this.branch_jump = true;

        this.dark_mode = false;
        this.board = new Board(this.size);

        this.board_graphics = new BoardGraphics(this);
        this.tree_graphics = new TreeGraphics();

        this.board_graphics.draw_board();
        this.tree_graphics.update(this.board.tree);

        create_buttons(this);

        this.modals = create_modals(this);
        if (prefer_dark_mode()) {
            this.dark_mode_toggle();
        }

        this.resize();

    }

    set_network_handler(handler) {
        this.network_handler = handler;
    }

    handshake(value) {
        let sgf = value["sgf"];
        let loc = value["loc"];
        let prefs = value["prefs"];
        let next_index = value["next_index"];
        let input_buffer = value["buffer"];

        // update buffer
        this.input_buffer = input_buffer;

        // set board
        this.board = from_sgf(sgf);
        this.size = this.board.size;
        let review = document.getElementById("review");
        review.setAttribute("size", this.size);
        this.recompute_consts();
        this.board_graphics.reset_board();

        // update settings modal
        this.modals.update_settings_modal();

        // handicap stones, for example
        this.init_stones();

        this.color = 1;
        let fields = this.board.tree.root.fields;
        if (fields != null && fields.has("HA")) {
            this.color = 2;
        }

        // update info
        this.modals.update_gameinfo_modal();

        // set prefs
        this.board.tree.set_prefs(prefs);

        // set next index
        this.board.tree.next_index = next_index;

        if (loc != "") {
            let dirs = loc.split(",");
            for (let d of dirs) {
                // currently i don't even need the actual direction
                // because i have the preferred child
                // and the current location is always guaranteed to be
                // in the direction of the preferred child
                // (for now anyway)
                this.right(false);
            }
        }

        // only update graphics once
        this.update_move_number();
        this.tree_graphics.update(this.board.tree, true, true);
        this.board_graphics.draw_stones();
    }

    update_settings(settings) {
        this.input_buffer = settings["buffer"];
        if (settings["size"] != this.size) {
            this.size = settings["size"];
            let review = document.getElementById("review");
            review.setAttribute("size", this.size);
            this.recompute_consts();
            this.board_graphics.reset_board();
            this.reset();
        }
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
    }

    cut(index) {
        // can't cut the root node
        if (index == 0){
            return;
        }

        // go left FIRST!!
        this.left();

        // cut the node
        this.board.tree.cut(index);

        // then do regular update stuff
        this.update_move_number();
        this.tree_graphics.update(this.board.tree, true, true);
        this.update_toggle_color();
    }

    get_index() {
        return this.board.tree.current.index;
    }

    get_index_up() {
        let index = this.board.tree.current.index;
        let [grid, loc] = this.tree_graphics.fill_grid(this.board.tree);
        let [x,y] = loc.get(index);
        while (true) {
            y--;
            if (y < 0) {
                return -1;
            }

            // there could be a 1 if it's not a tree node but has tree nodes below
            if (grid[y][x] == 1) {
                continue;
            }

            if (grid[y][x] != 0) {
                return grid[y][x].index;
            }
        }
    }

    get_index_down() {
        let index = this.board.tree.current.index;
        let [grid, loc] = this.tree_graphics.fill_grid(this.board.tree);
        let [x,y] = loc.get(index);
        while (true) {
            y++;
            if (y >= grid.length) {
                return -1;
            }

            // there could be a 1 if it's not a tree node but has tree nodes below
            if (grid[y][x] == 1) {
                continue;
            }

            if (grid[y][x] != 0) {
                return grid[y][x].index;
            }
        }
    }

    goto_index(index) {
        this.board.tree.set_preferred(index);
        this.board_graphics.clear_and_remove();
        this.board.clear();
        this.board.tree.rewind();
        this.init_stones();
        //let most = 20;
        let i = 0;
        while (this.board.tree.current.index != index) {
            // this boolean indicates not to draw anything
            this.right(false);
            i++;
            //if (i > most) {
            //    break;
            //}
        }

        // wait to update the stones until the end
        this.board_graphics.draw_stones();

        this.update_move_number();
        // wait to update the tree until the end
        this.tree_graphics.update(this.board.tree, true);

        this.update_toggle_color();
    }

    goto_coord(x, y) {
        let cur = this.board.tree.current;

        // look forward
        while (true) {
            let coord = cur.coord();
            if (coord != null && coord.x == x && coord.y == y) {
                // if found looking forward, return
                this.goto_index(cur.index);
                return;
            }
            if (cur.down.length == 0) {
                break;
            }
            cur = cur.down[cur.preferred_child];
        }

        // look backward
        cur = this.board.tree.current;
        while (true) {
            let coord = cur.coord();
            if (coord != null && coord.x == x && coord.y == y) {
                // if found looking backward, return
                this.goto_index(cur.index);
                return;
            }
            if (cur.up == null) {
                break;
            }
            cur = cur.up;
        }
    }

    left() {
        // this is the node we just moved from
        let node = this.board.tree.left();
        if (node == null) {
            return;
        }
        let coord = node.coord();
        let captured = node.captured;
        let color = node.color();

        this.board_graphics.clear_canvas("current");

        // clear previous move
        if (coord != null) {
            this.board_graphics.clear_stone(coord.x,coord.y);
            this.board.set(coord, 0);
        }

        // clear additional stones
        let a_stones = node.a_stones();
        for (let col of [1,2]) {
            for (let c of a_stones[col]) {
                let a_coord = letters2coord(c);
                this.board_graphics.clear_stone(a_coord.x, a_coord.y, col);
                this.board.set(a_coord, 0);
            }
        }

        // find current move
        let cur = this.board.tree.current;

        // draw current
        this.board_graphics.draw_current();

        // get color
        let new_color = 2;
        if (color == 2) {
            new_color = 1;
        }

        // redraw captured stones
        for (let col of [1, 2]) {
            for (let c of captured[col]) {
                this.board_graphics.draw_stone(c.x, c.y, col);
                this.board.set(c, col);
            }
        }

        this.update_toggle_color();

        // clear marks
        this.board_graphics.clear_and_remove_marks();

        // update move number
        this.update_move_number();

        // update explorer
        this.tree_graphics.update(this.board.tree);
    }
    
    right(update=true) {
        let node = this.board.tree.right();
        if (node == null) {
            return;
        }
        let coord = node.coord();
        let captured = node.captured;
        let color = node.color();
        if (update) {
            this.board_graphics.clear_canvas("current");
        }

        // so, if the coord is null, it could be a pass
        if (!node.is_pass()) {

            // add new stones
            let add = node.a_stones();
            for (let c of [1,2]) {
                for (let xy of add[c]) {
                    let a_coord = letters2coord(xy);
                    this.board.set(a_coord, c);
                    if (update) {
                        this.board_graphics.draw_stone(a_coord.x, a_coord.y, c);
                    }
                }
            }

            if (node.has_move()) {
                // add current stone
                this.board.set(coord, color);
                if (update) {
                    this.board_graphics.draw_stone(coord.x, coord.y, color);
                    this.board_graphics.draw_current();
                }
            }

        }

        let new_color = 2;
        if (color == 2) {
            new_color = 1;
        }

        // clear captured stones
        for (let col of [1, 2]) {
            for (let c of captured[col]) {
                if (update) {
                    this.board_graphics.clear_stone(c.x, c.y);
                }
                this.board.set(c, 0);
            }
        }

        this.update_toggle_color();

        // clear marks
        if (update) {
            this.board_graphics.clear_and_remove_marks();
        }

        // update explorer
        if (update) {
            this.update_move_number();
            this.tree_graphics.update(this.board.tree);
        }
    }

    up() {
        this.board.tree.up();
        this.tree_graphics.update(this.board.tree, true);
    }

    down() {
        this.board.tree.down();
        this.tree_graphics.update(this.board.tree, true);
    }

    rewind() {
        //console.time("rewind");

        // reset graphics
        this.board_graphics.clear_and_remove();

        // reset board
        this.board.clear();

        // rewind tree
        this.board.tree.rewind();

        // handicap stones
        this.init_stones();

        // change color
        this.color = 1;
        let fields = this.board.tree.root.fields;
        if (fields != null && fields.has("HA")) {
            this.color = 2;
        }

        // update move number
        this.update_move_number();

        // update explorer
        this.tree_graphics.update(this.board.tree);

        // update color
        this.update_toggle_color();
        //console.timeEnd("rewind");

    }

    fastforward() {
        while (true) {
            if (this.board.tree.current.down.length == 0) {
                break;
            }
            // this boolean indicates not to draw anything
            this.right(false);
        }

        // wait to update the stones until the end
        this.board_graphics.draw_stones();

        // update move number
        this.update_move_number();

        // wait to update the tree until the end
        this.tree_graphics.update(this.board.tree);

        // update color
        this.update_toggle_color();
    }

    reset() {
        this.board_graphics.clear_and_remove();
        this.color = 1;
        this.saved_color = 1;
        this.toggling = true;
        this.mark = "";

        this.board = new Board(this.size);
        this.tree_graphics.clear_all();
        // update move number
        this.update_move_number();

        this.modals.update_modals();
        this.tree_graphics.update(this.board.tree, true, true);
    }

    get_game_info() {
        let fields = this.board.tree.root.fields;
        if (fields == null) {
            fields = new Map();
        }
        let game_info = {};

        // currently doesn't play very nice with chinese characters

        if (fields.has("PB")) {
            let rank = "";
            if (fields.has("BR")) {
                rank = " [" + fields.get("BR") + "]";
            }
            game_info["Black"] = fields.get("PB") + rank;
        } else {
            game_info["Black"] = "Black";
        }

        if (fields.has("PW")) {
            let rank = "";
            if (fields.has("WR")) {
                rank = " [" + fields.get("WR") + "]";
            }
            game_info["White"] = fields.get("PW") + rank;
        } else {
            game_info["White"] = "White";
        }

        if (fields.has("RE")) {
            game_info["Result"] = fields.get("RE");
        }

        if (fields.has("KM")) {
            game_info["Komi"] = fields.get("KM");
        }

        if (fields.has("DT")) {
            game_info["Date"] = fields.get("DT");
        }

        if (fields.has("RU")) {
            game_info["Ruleset"] = fields.get("RU");
        }

        /*
        if (fields.has("PC")) {
            game_info["Place"] = fields.get("PC");
        }

        if (fields.has("SO")) {
            game_info["Source"] = fields.get("SO");
        }

        if (fields.has("EV")) {
            game_info["Event"] = fields.get("EV");
        }

        if (fields.has("N")) {
            game_info["Name"] = fields.get("N");
        }

        if (fields.has("GN")) {
            game_info["Game Name"] = fields.get("GN");
        }
        */

        return game_info;
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
        let dark_mode_icon = document.getElementsByClassName(old_icon)[0];
        dark_mode_icon.setAttribute("class", new_icon);

        // change the black and white stone icons
        let black_stone_icon = document.getElementsByClassName(old_black_stone)[0];
        let white_stone_icon = document.getElementsByClassName(new_black_stone)[0];
        black_stone_icon.setAttribute("class", new_black_stone);
        white_stone_icon.setAttribute("class", old_black_stone);

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

    erase_pen() {
        this.network_handler.prepare_erase_pen();
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

            // TODO: what shall we do when we get multiple files?
            const selectedFile = inp.files[0];
            const reader = new FileReader();
            reader.readAsText(selectedFile);

            reader.addEventListener(
                "load",
                () => {
                    // encode unicode, and encode with base64
                    this.network_handler.prepare_upload(b64_encode_unicode(reader.result));
                },
                false,
            );
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

    init_stones() {
        // there might be initialization stones
        let b = this.board.get_field("AB");
        let w = this.board.get_field("AW");
    
        for (let s of b) {
            let c = letters2coord(s);
            this.board.set(c, 1);
            this.board_graphics.draw_stone(c.x, c.y, 1);
        }
        for (let s of w) {
            let c = letters2coord(s);
            this.board.set(c, 2);
            this.board_graphics.draw_stone(c.x, c.y, 2);
        }
    }

    pass(color) {
        this.board.tree.push_pass(color);
        this.board_graphics.clear_marks();
        this.board_graphics.clear_canvas("current");
        if (this.toggling) {
            this.toggle_color();
        }
        this.update_move_number();
        this.tree_graphics.update(this.board.tree, true, true);
    }

    place_stone_toggle(x, y, color) {
        // if out of bounds, just return
        if (x < 0 || x >= this.size || y < 0 || y >= this.size) {
            return;
        }

        // returns list of dead stones
        let coord = new Coord(x, y);
        let result = this.board.place(coord, color);
        if (!result.ok) {
            return;
        }

        for (let v of result.values[opposite(color)]) {
            this.board_graphics.clear_stone(v.x, v.y);
        }

        this.board_graphics.remove_marks();
        this.board_graphics.draw_stone(x, y, color);
        this.board_graphics.draw_current();
        if (this.toggling) {
            this.toggle_color();
        }
        this.update_move_number();
        this.tree_graphics.update(this.board.tree, true, true);
    }

    place_stone_manual(x, y, color) {
        // if out of bounds, just return
        if (x < 0 || x >= this.size || y < 0 || y >= this.size) {
            return;
        }

        // returns list of dead stones
        let coord = new Coord(x, y);
        let result = this.board.place(coord, color);
        if (!result.ok) {
            return;
        }

        for (let v of result.values[opposite(color)]) {
            this.board_graphics.clear_stone(v.x, v.y);
        }

        this.board_graphics.remove_marks();
        this.board_graphics.draw_stone(x, y, color);
        this.board_graphics.draw_current();
        if (this.toggling) {
            this.toggle_color();
        }
        this.update_move_number();
        this.tree_graphics.update(this.board.tree, true, true);
    }

    place_mark(x, y, color, mark) {
        // if out of bounds, just return
        if (x < 0 || x >= this.size || y < 0 || y >= this.size) {
            return;
        }

        if (mark != "") {
            this.board_graphics.draw_mark(x, y, mark);
            return;
        }
    }
}
