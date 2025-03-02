/*
Copyright (c) 2025 Jared Nishikawa

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
*/

export {
    BoardGraphics
}

const letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";

class BoardGraphics {
    constructor(state) {
        this.state = state;

        this.width = this.state.width;
        this.size = this.state.size;
        this.side = this.state.side;
        this.pad = this.state.pad;

        this.canvases = new Map();

        this.bgcolor = "#f2bc74"

        this.bg_canvases = new Map();
        this.new_canvas("board", 0);
        this.new_canvas("lines", 10);
        this.new_canvas("coords", 20);

        this.new_canvas("backdrop-0", 30);
        this.new_canvas("backdrop-1", 30);

        this.new_canvas("ghost", 50);

        this.new_canvas("shadows-0", 800);
        this.new_canvas("shadows-1", 800);

        // first i tried to have each stone on its own canvas
        // that was way too slow
        // then i tried all the stones on the same canvas
        // this made clearing stones a bit annoying as i had to ensure
        // there was enough padding around the stone so they didn't clear
        // bits of the surrounding stones
        // then it occurred to me just have two canvases and have stones
        // that are touching on different canvases
        this.new_canvas("stones-0", 900);
        this.new_canvas("stones-1", 900);

        this.new_canvas("current", 950);

        this.new_canvas("marks-0", 1000);
        this.new_canvas("marks-1", 1000);

        this.new_canvas("ghost-marks", 1000);
        this.new_canvas("eraser", 1000);

        this.new_canvas("pen", 1050);

        this.used_letters = new Array(26).fill(0);
        this.letter_map = new Map();
        this.used_numbers = new Map();
        this.used_numbers.set(0, 1);
        this.number_map = new Map();

        this.triangles = new Map();
        this.squares = new Map();
        this.letters = new Map();
        this.numbers = new Map();
        this.marks = new Map();
    }

    new_canvas(id, z_index) {
        // derp
        if (this.canvases.has(id)) {
            return;
        }
        let review = document.getElementById("review");
        let canvas = document.createElement("canvas");
        let ratio = window.devicePixelRatio;
        canvas.setAttribute("id", id);
        let w = (this.width + this.pad*2);
        canvas.width = w*ratio;
        canvas.height = w*ratio;

        //canvas.setAttribute("style", "z-index: " + z_index + ";");

        canvas.style.position = "absolute";
        canvas.style.margin = "auto";
        canvas.style.display = "flex";
        canvas.style.zIndex = z_index;
        canvas.style.width = w + "px";
        canvas.style.height = w + "px";

        canvas.getContext("2d").scale(ratio, ratio);
        review.appendChild(canvas);
        this.canvases.set(id, canvas);
        return canvas;
    }

    recompute_consts() {
        this.size = this.state.size;
        this.width = this.state.width;
        this.side = this.state.side;
        this.pad = this.state.pad;
    }

    resize_all() {
        for (let [id, canvas] of this.canvases) {
            this.resize_canvas(id);
        }
    }

    resize_canvas(id) {
        let review = document.getElementById("review");
        let canvas = this.canvases.get(id);
        if (canvas == null) {
            return;
        }
        let ratio = window.devicePixelRatio;
        let w = (this.width + this.pad*2);
        canvas.width = w*ratio;
        canvas.height = w*ratio;

        canvas.style.width = w + "px";
        canvas.style.height = w + "px";

        canvas.getContext("2d").scale(ratio, ratio);
        review.appendChild(canvas);
        this.canvases.set(id, canvas);
    }

    draw_board() {
        this.draw_boardbg();
        this.draw_lines();
        this.draw_coords();
        this.draw_stars();
    }

    reset_board() {
        this.remove_marks();
        this.clear_all();
        this.clear_board();
        this.resize_all();
        this.draw_board();
    }

    resize() {
        this.clear_all();
        this.clear_board();
        this.resize_all();

        this.draw_board();
        this.draw_marks();
        this.draw_stones();
    }

    draw_marks() {
        this.clear_canvas("marks-0");
        this.clear_canvas("marks-1");
        this.clear_canvas("backdrop-0");
        this.clear_canvas("backdrop-1");
        for (let [key, value] of this.marks) {
            let spl = key.split("-");
            if (spl.length != 2) {
                return;
            }
            let x = parseInt(spl[0]);
            let y = parseInt(spl[1]);

            let hexcolor = "#000000";
            if (this.state.board.points[x][y] == 1) {
                hexcolor = "#FFFFFF";
            }
            let canvas_id = "marks-0";
            if ((x+y)%2 == 1) {
                canvas_id = "marks-1";
            }

            if (value == "square") {
                this.draw_square(x, y, hexcolor, canvas_id);
            } else if (value == "triangle") {
                this.draw_triangle(x, y, hexcolor, canvas_id);
            } else if (value.startsWith("letter")) {
                spl = value.split(":");
                let letter_index = parseInt(spl[1]);
                let letter = letters[letter_index%26];
                this.draw_backdrop(x,y);
                this.draw_letter(x, y, letter, hexcolor, canvas_id);
            } else if (value.startsWith("number")) {
                spl = value.split(":");
                let number = parseInt(spl[1]);
                this.draw_backdrop(x,y);
                this.draw_number(x, y, number, hexcolor, canvas_id);
            }
        }
    }

    draw_stones() {
        this.clear_canvas("stones-0");
        this.clear_canvas("stones-1");
        this.clear_canvas("shadows-0");
        this.clear_canvas("shadows-1");
        for (let i=0; i<this.size; i++) {
            for (let j=0; j<this.size; j++) {
                if (this.state.board.points[i][j] == 0) {
                    continue;
                }
                let color = this.state.board.points[i][j];
                this.draw_stone(i, j, color);
            }
        }

        this.draw_current();
    }

    draw_boardbg(hex_color="") {
        if (hex_color == "") {
            hex_color = this.bgcolor;
        }
        let canvas = this.canvases.get("board");
        let ctx = canvas.getContext("2d");
        ctx.beginPath();
        ctx.fillStyle = hex_color;
        //ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.fillRect(0, 0, this.width+this.pad*2, this.width+this.pad*2);
        this.bgcolor = hex_color;

        // very low on the priority list for fixing some day
        this.clear_marks();
    }

    draw_lines() {
        var i;
        let canvas = this.canvases.get("lines");
        let ctx = canvas.getContext("2d");

        for (i=0; i<this.size; i++) {
            ctx.beginPath();
            ctx.moveTo(this.side*i + this.pad, this.pad);
            ctx.lineTo(this.side*i + this.pad, this.width + this.pad);
            ctx.stroke();

            ctx.beginPath();
            ctx.moveTo(this.pad, this.side*i + this.pad);
            ctx.lineTo(this.width + this.pad, this.side*i + this.pad);
            ctx.stroke();
        }
    }

    draw_coords() {
        var i;
        let canvas = this.canvases.get("coords");
        let ctx = canvas.getContext("2d");

        let font_size = this.width/50;
        ctx.font = font_size.toString() + "px Arial";
        ctx.fillStyle = "#000000";
        let letters = "ABCDEFGHJKLMNOPQRST";

        for (i=0; i<this.size; i++) {

            // letters along the top
            ctx.fillText(letters[i], this.side*i+this.pad*7/8, this.pad/2);

            // letters along the bottom
            ctx.fillText(letters[i], this.side*i+this.pad*7/8, this.width + this.pad*7/4);

            // numbers along the left
            ctx.fillText((this.size-i).toString(), this.pad/8, this.side*i+this.pad*9/8);

            // numbers along the right
            ctx.fillText((this.size-i).toString(), this.width + this.pad*12/8, this.side*i+this.pad*9/8);
        }
    }

    // board graphics
    draw_circle(x, y, r, hexColor, id, filled=true, stroke=3) {
        let real_x = x*this.side + this.pad;
        let real_y = y*this.side + this.pad;
        this.draw_raw_circle(real_x, real_y, r, hexColor, id, filled, stroke);
    }

    // board graphics
    draw_gradient_circle(x, y, r, colors, id, filled=true, stroke=3) {
        let real_x = x*this.side + this.pad;
        let real_y = y*this.side + this.pad;
        this.draw_raw_gradient_circle(real_x, real_y, r, colors, id, filled, stroke);
    }


    draw_highlight(x, y, r, id) {
        this.draw_crescent(x, y, r, 3*Math.PI/4, 7*Math.PI/4, "#FFFFFF", id);

        //let ratio = window.devicePixelRatio;
        //let color = "#FFFFFF";
        //let real_x = x*this.side + this.pad - 8/ratio;
        //let real_y = y*this.side + this.pad - 8/ratio;
        //let ctx = this.canvases.get(id).getContext("2d");
        //ctx.beginPath();
        //ctx.strokeStyle = color;
        //ctx.arc(real_x, real_y, r/4, 0, 2*Math.PI);
        //ctx.fillStyle = color;
        //ctx.fill();
        //ctx.stroke();
    }

    draw_shadow(x, y, r, id) {
        this.draw_crescent(x, y, r, -Math.PI/4, 3*Math.PI/4, "#00000011", id);
    }

    draw_crescent(x, y, r, theta_0, theta_1, color, id) {
        let frac = 1/4;
        let ctx = this.canvases.get(id).getContext("2d");
        let real_x = x*this.side + this.pad;
        let real_y = y*this.side + this.pad;

        let center_theta = (theta_0 + theta_1)/2;
        let new_x = real_x - Math.cos(center_theta)*r*frac;
        let new_y = real_y - Math.sin(center_theta)*r*frac;
        ctx.beginPath();
        ctx.strokeStyle = color;
        ctx.arc(real_x, real_y, r, theta_0, theta_1);
        ctx.arc(new_x, new_y, r, theta_1, theta_0, true);
        ctx.fillStyle = color;
        ctx.fill();
        ctx.stroke();
    }

    draw_raw_circle(x, y, r, hexColor, id, filled=true, stroke=3) {
        let ctx = this.canvases.get(id).getContext("2d");
        let ratio = window.devicePixelRatio;
        ctx.beginPath();
        if (filled) {
            ctx.strokeStyle = "#00000000";
        } else {
            ctx.lineWidth = stroke/ratio;
            ctx.strokeStyle = hexColor;
        }
        ctx.arc(x, y, r, 0, 2*Math.PI);
        if (filled) {
            ctx.fillStyle = hexColor;
            ctx.fill();
        }
        ctx.stroke();
    }

    draw_raw_gradient_circle(x, y, r, colors, id, filled=true, stroke=3) {
        if (colors.length == 1) {
            return;
        }
        
        let ctx = this.canvases.get(id).getContext("2d");

        // Create linear gradient
        const grad=ctx.createLinearGradient(x-r,y-r,x+r,y+r);
        let step = 1/(colors.length-1);
        for (let i=0; i<colors.length; i++) {
            grad.addColorStop(step*i, colors[i]);

        }
        //grad.addColorStop(0, "lightblue");
        //grad.addColorStop(1, "darkblue");
        
        let ratio = window.devicePixelRatio;
        ctx.beginPath();
        if (filled) {
            ctx.strokeStyle = "#00000000";
        } else {
            ctx.lineWidth = stroke/ratio;
            ctx.strokeStyle = hexColor;
        }
        ctx.arc(x, y, r, 0, 2*Math.PI);
        if (filled) {
            ctx.fillStyle = grad;
            ctx.fill();
        }
        ctx.stroke();
    }


    draw_current() {
        this.clear_canvas("current");
        let cur = this.state.board.tree.current;
        if (cur.has_move() && !cur.is_pass()) {
            let coord = cur.coord();
            let color = cur.color();
            this._draw_current(coord.x, coord.y, color);
        }
    }

    _draw_current(x, y, color) {
        let hexcolor = "#FFFFFF";
        if (color == 2) {
            hexcolor = "#000000";
        }
        this.draw_circle(x, y, this.side/4, hexcolor, "current", false);
    }

    draw_triangle(x, y, hexColor, id) {
        let ratio = window.devicePixelRatio;
        if (x < 0 || x >= this.size || y < 0 || y >= this.size) {
            return;
        }
        let real_x = x*this.side + this.pad;
        let real_y = y*this.side + this.pad;
        let ctx = this.canvases.get(id).getContext("2d");
        let r = (this.side/3);
        let s = 2*r*Math.cos(Math.PI/6);
        let a = r/2;

        ctx.lineWidth = 3/ratio;
        ctx.strokeStyle = hexColor;
        ctx.beginPath();
        ctx.moveTo(real_x, real_y-r);
        ctx.lineTo(real_x+s/2, real_y+a);
        ctx.lineTo(real_x-s/2, real_y+a);
        ctx.closePath();
        ctx.stroke();
    }

    draw_ghost_triangle(x, y) {
        this.clear_canvas("ghost-marks");
        if (x < 0 || x >= this.size || y < 0 || y >= this.size) {
            return;
        }
        let hexcolor = "#000000";
        if (this.state.board.points[x][y] == 1) {
            hexcolor = "#FFFFFF";
        }
        this.draw_triangle(x, y, hexcolor, "ghost-marks");
    }

    draw_square(x, y, hexColor, id) {
        let ratio = window.devicePixelRatio;
        if (x < 0 || x >= this.size || y < 0 || y >= this.size) {
            return;
        }
        let real_x = x*this.side + this.pad;
        let real_y = y*this.side + this.pad;
        let ctx = this.canvases.get(id).getContext("2d");
        let r = (this.side/3);
        let h = 3*r/2;
        let b = h/2;

        ctx.lineWidth = 3/ratio;
        ctx.strokeStyle = hexColor;
        ctx.beginPath();

        ctx.moveTo(real_x+b, real_y-b);
        ctx.lineTo(real_x+b, real_y+b);
        ctx.lineTo(real_x-b, real_y+b);
        ctx.lineTo(real_x-b, real_y-b);

        ctx.closePath();
        ctx.stroke();
    }

    draw_ghost_square(x, y) {
        this.clear_canvas("ghost-marks");
        if (x < 0 || x >= this.size || y < 0 || y >= this.size) {
            return;
        }
        let hexcolor = "#000000";
        if (this.state.board.points[x][y] == 1) {
            hexcolor = "#FFFFFF";
        }
        this.draw_square(x, y, hexcolor, "ghost-marks");
    }

    draw_star(x, y) {
        let radius = this.side/12;
        this.draw_circle(x, y, radius, "#000000", "lines");
    }

    draw_stars() {
        let stars = []
        if (this.size == 19) {
            let xs = [3, 9, 15]
            for (let x of xs) {
                for (let y of xs) {
                    stars.push([x,y]);
                }
            }
        } else if (this.size == 13) {
            stars.push([3,3]);
            stars.push([3,9]);
            stars.push([9,3]);
            stars.push([9,9]);
            stars.push([6,6]);
        } else if (this.size == 9) {
            stars.push([2,2]);
            stars.push([2,6]);
            stars.push([6,2]);
            stars.push([6,6]);
            stars.push([4,4]);
        }
        for (let [x,y] of stars) {
            this.draw_star(x,y);
        }
    }

    clear_stone(x, y) {
        let id = "stones-0";
        if ((x+y)%2 == 1) {
            id = "stones-1";
        }
        let canvas = this.canvases.get(id);
        if (canvas == null) {
            return;
        }
        let ctx = canvas.getContext("2d");

        let real_x = x*this.side + this.pad;
        let real_y = y*this.side + this.pad;
        // TODO: this is not very idiomatic
        let r = this.side/1.9;
        ctx.clearRect(real_x-r, real_y-r, 2*r, 2*r);

        // clear cast shadow
        this.clear_cast_shadow(x, y);
    }

    draw_pen(x0, y0, x1, y1, pen_color) {
        // TODO: what to do if click and don't move
        if (x0 == null) {
            // interestingly, OGS doesn't draw anything in this case either
            return;
        }
        let ratio = window.devicePixelRatio;
        let canvas = this.canvases.get("pen");
        let rect = canvas.getBoundingClientRect();
        let ctx = canvas.getContext("2d");
        ctx.lineWidth = 4/ratio;
        ctx.strokeStyle = pen_color;
        ctx.beginPath();
        ctx.moveTo(x0*rect.width, y0*rect.height);
        ctx.lineTo(x1*rect.width, y1*rect.height);
        ctx.stroke();
    }

    draw_stone(x, y, color) {
        let ratio = window.devicePixelRatio;
        let radius = this.side/2;
        let hexcolor = "#000000";
        if (color == 2) {
            hexcolor = "#F0F0F0";
        }
        // this could be more idiomatic and universal
        let id = x.toString() + "-" + y.toString();

        let canvas_id = "stones-0";
        if ((x+y) % 2 == 1) {
            canvas_id = "stones-1";
        }

        // stone

        if (color == 2) {
            // special stuff to do for white stones

            // regular fill
            this.draw_circle(x, y, radius, hexcolor, canvas_id);

            // gradient fill
            //this.draw_gradient_circle(x, y, radius, ["#FFFFFF", "#C5C5C5"], canvas_id);
            
            // shadow
            this.draw_shadow(x, y, radius, canvas_id);

            // highlight
            //this.draw_highlight(x, y, radius, "stones");

            //outline
            this.draw_circle(x, y, radius, "#000000", canvas_id, false, 1);
        } else if (color == 1) {
            // regular fill
            //this.draw_circle(x, y, radius, hexcolor, canvas_id);
            
            // gradient fill
            this.draw_gradient_circle(x, y, radius, ["#555555", "#000000"], canvas_id);

            // outline
            this.draw_circle(x, y, radius, "#000000", canvas_id, false, 1);
        }

        // cast shadow
        this.draw_cast_shadow(x, y);

        /*
        // check if there's a letter or triangle here too
        let t_id = "triangle-" + id;
        let sq_id = "square-" + id;
        let letter_id = "letter-" + id;
        let number_id = "number-" + id;

        if (color == 1) {
            hexcolor = "#FFFFFF";
        } else {
            hexcolor = "#000000";
        }
        if (this.canvases.has(t_id)) {
            // redraw triangle in appropriate color
            this.draw_triangle(x, y, hexcolor, t_id);
        }
        if (this.canvases.has(sq_id)) {
            this.draw_square(x, y, hexcolor, sq_id);
        }
        if (this.canvases.has(letter_id)) {
            // redraw letter in appropriate color
            let c = this.canvases.get(letter_id);
            let letter = c.getAttribute("value");
            this.draw_letter(x, y, letter, hexcolor, letter_id);
        }
        if (this.canvases.has(number_id)) {
            // redraw number in appropriate color
            let c = this.canvases.get(number_id);
            let number = c.getAttribute("value");
            this.draw_number(x, y, number, hexcolor, number_id);
        }
        */

    }

    draw_cast_shadow(x, y) {
        let ratio = window.devicePixelRatio;
        let radius = this.side/2;
        let real_x = x*this.side + this.pad;
        let real_y = y*this.side + this.pad;
        let offset = 2/ratio;
        let id = "shadows-0";
        if ((x+y)%2 == 1) {
            id = "shadows-1";
        }

        this.draw_raw_circle(real_x+offset, real_y+offset, radius, "#00000055", id);
    }

    clear_cast_shadow(x, y) {
        let ratio = window.devicePixelRatio;
        let offset = 2/ratio;
        let id = "shadows-0";
        if ((x+y)%2 == 1) {
            id = "shadows-1";
        }
        let canvas = this.canvases.get(id);
        if (canvas == null) {
            return;
        }
        let ctx = canvas.getContext("2d");

        let real_x = x*this.side + this.pad;
        let real_y = y*this.side + this.pad;
        let r = this.side/1.9;
        ctx.clearRect(real_x-r + offset, real_y-r + offset, 2*r, 2*r);
    }

    draw_ghost_stone(x, y, color) {
        this.clear_canvas("ghost");
        if (x < 0 || x >= this.size || y < 0 || y >= this.size) {
            return;
        }
        if (this.state.board.points[x][y] != 0) {
            return;
        }
        let radius = this.side/2.1;
        let hexcolor = "#00000077";
        if (color == 2) {
            hexcolor = "#FFFFFF77";
        }
        this.draw_circle(x, y, radius, hexcolor, "ghost");
    }

    // this goes through used letters until we find the first unused
    get_letter() {
        for (let i=0; i<this.used_letters.length; i++) {
            if (this.used_letters[i] == 0) {
                return i;
            }
        }
    }

    use_letter(i) {
        this.used_letters[i] = 1;
    }

    free_letter(i) {
        this.used_letters[i] = 0;
    }

    // this goes through used numbers until we find the first unused
    get_number() {
        let i = 0;
        while (true) {
            if (this.used_numbers.get(i) != 1) {
                return i;
            }
            i++;
        }
    }

    use_number(i) {
        this.used_numbers.set(i, 1);
    }

    free_number(i) {
        this.used_numbers.set(i, 0);
    }

    draw_letter(x, y, letter, color, id) {
        let ctx = this.canvases.get(id).getContext("2d");
        let real_x = x*this.side + this.pad;
        let real_y = y*this.side + this.pad;

        let font_size = this.width/36;

        ctx.font = "bold " + font_size.toString() + "px Arial";
        ctx.fillStyle = color;
        ctx.lineWidth = 2;
        let x_offset = font_size/3;
        if (letter == "I") {
            x_offset = font_size/8;
        }
        let y_offset = font_size/3;
        ctx.fillText(letter, real_x-x_offset, real_y+y_offset);
    }

    draw_ghost_letter(x, y, color) {
        this.clear_canvas("ghost-marks");
        if (x < 0 || x >= this.size || y < 0 || y >= this.size) {
            return;
        }
        let hexcolor = "#000000";
        if (this.state.board.points[x][y] == 1) {
            hexcolor = "#FFFFFF";
        }
        let letter_index = this.get_letter()
        let letter = letters[letter_index%26];
        if (letter_index == null) {
            return;
        }

        this.draw_letter(x, y, letter, hexcolor, "ghost-marks");
    }

    draw_number(x, y, number, color, id) {
        let ctx = this.canvases.get(id).getContext("2d");
        let real_x = x*this.side + this.pad;
        let real_y = y*this.side + this.pad;

        let font_size = this.width/36;

        ctx.font = "bold " + font_size.toString() + "px Arial";
        ctx.fillStyle = color;
        ctx.lineWidth = 2;
        let x_offset = font_size/3;
        if (number >= 10) {
            x_offset = font_size/2;
        } if (number >= 100) {
            x_offset = font_size;
        }
        let y_offset = font_size/3;
        ctx.fillText(number, real_x-x_offset, real_y+y_offset);
    }

    draw_ghost_number(x, y, color) {
        this.clear_canvas("ghost-marks");
        if (x < 0 || x >= this.size || y < 0 || y >= this.size) {
            return;
        }
        let hexcolor = "#000000";
        if (this.state.board.points[x][y] == 1) {
            hexcolor = "#FFFFFF";
        }
        let number = this.get_number();
        this.draw_number(x, y, number, hexcolor, "ghost-marks");
    }

    remove_mark(x, y) {
        let id = x.toString() + "-" + y.toString();
        let mark = this.marks.get(id);
        this.marks.delete(id);
        this.clear_mark(x, y);
        let spl = mark.split(":");
        let type = spl[0];
        if (type == "square" || type == "triangle") {
            return;
        }
        this.clear_backdrop(x, y);
        if (type == "letter") {
            let i = parseInt(spl[1]);
            this.free_letter(i);
        } else if (type == "number") {
            let i = parseInt(spl[1]);
            this.free_number(i);
        }
    }

    draw_mark(x, y, mark) {
        this.saved_color = this.color;
        let hexcolor = "#000000";
        if (this.state.board.points[x][y] == 1) {
            hexcolor = "#FFFFFF";
        }
        let canvas_id = "marks-0";
        if ((x+y)%2 == 1) {
            canvas_id = "marks-1";
        }
        let id = x.toString() + "-" + y.toString();

        if (this.marks.has(id)) {
            this.remove_mark(x, y);
            return;
        }

        if (mark == "triangle") {
            this.triangles.set(id, 1);
            this.marks.set(id, "triangle");
            this.draw_triangle(x, y, hexcolor, canvas_id);
        } else if (mark == "square") {
            this.squares.set(id, 1);
            this.marks.set(id, "square");
            this.draw_square(x, y, hexcolor, canvas_id);
        } else if (mark == "letter") {
            let letter_index = this.get_letter();
            if (letter_index == null) {
                return;
            }
            let letter = letters[letter_index%26];
            this.use_letter(letter_index);
            this.marks.set(id, "letter:" + letter_index.toString());
            this.draw_backdrop(x,y);
            this.draw_letter(x, y, letter, hexcolor, canvas_id);
        } else if (mark == "number") {
            let number = this.get_number();
            this.use_number(number);
            this.marks.set(id, "number:" + number.toString());
            this.draw_backdrop(x, y);
            this.draw_number(x, y, number, hexcolor, canvas_id);
        } else if (mark == "eraser") {
            this.erase_stone(x, y);
        }
    }

    clear_mark(x, y) {
        let id = "marks-0";
        if ((x+y)%2 == 1) {
            id = "marks-1";
        }
        let canvas = this.canvases.get(id);
        if (canvas == null) {
            return;
        }
        let ctx = canvas.getContext("2d");

        let real_x = x*this.side + this.pad;
        let real_y = y*this.side + this.pad;
        let r = this.side/2;
        ctx.clearRect(real_x-r, real_y-r, 2*r, 2*r);
    }

    draw_backdrop(x, y) {
        let id = "backdrop-0";
        if ((x+y)%2 == 1) {
            id = "backdrop-1";
        }
        this.draw_circle(x, y, this.side/3, this.bgcolor, id);
    }

    clear_backdrop(x, y) {
        let id = "backdrop-0";
        if ((x+y)%2 == 1) {
            id = "backdrop-1";
        }
        let canvas = this.canvases.get(id);
        if (canvas == null) {
            return;
        }
        let ctx = canvas.getContext("2d");

        let real_x = x*this.side + this.pad;
        let real_y = y*this.side + this.pad;
        // TODO: this is not very idiomatic
        let r = this.side/2;
        ctx.clearRect(real_x-r, real_y-r, 2*r, 2*r);
    }

    erase_stone(x, y) {
        let coord = this.state.board.tree.current.value;
        let erased = this.state.board.remove(x, y);
        // if there was no stone there, do nothing
        if (!erased) {
            return;
        }
        // clear the stone from the canvas
        this.clear_stone(x, y);

        // clear marks
        this.clear_marks();

        // clearing "current" no matter what
        this.clear_canvas("current");
        this.state.update_move_number();
        this.state.tree_graphics.update(this.state.board.tree, true, true);
    }

    draw_ghost_mark(x, y) {
        if (this.state.mark == "triangle") {
            this.draw_ghost_triangle(x, y);
        } else if (this.state.mark == "square") {
            this.draw_ghost_square(x, y);
        } else if (this.state.mark == "letter") {
            this.draw_ghost_letter(x, y);
        } else if (this.state.mark == "number") {
            this.draw_ghost_number(x, y);
        } else if (this.state.mark == "eraser") {
            this.draw_ghost_eraser(x, y);
        }
    }

    draw_ghost_eraser(x, y) {
        let ratio = window.devicePixelRatio;
        this.clear_canvas("eraser");
        if (x < 0 || x >= this.size || y < 0 || y >= this.size) {
            return;
        }
        //let radius = this.side/2.1;
        let hexColor = "#AA0000AA";
        let center_x = this.side*x + this.side;
        let center_y = this.side*y + this.side;
        let l = this.side/4;

        let ctx = this.canvases.get("eraser").getContext("2d");
        ctx.lineWidth = 5/ratio;
        ctx.strokeStyle = hexColor;

        ctx.beginPath();
        ctx.moveTo(center_x - l, center_y - l);
        ctx.lineTo(center_x + l, center_y + l);
        ctx.stroke();

        ctx.moveTo(center_x + l, center_y - l);
        ctx.lineTo(center_x - l, center_y + l);
        ctx.stroke();
    }

    clear_canvas(id) {
        let canvas = this.canvases.get(id);
        if (canvas == null) {
            return;
        }
        let ctx = canvas.getContext("2d");
        ctx.clearRect(0, 0, this.width + 2*this.pad, this.width+2*this.pad);
        //ctx.clearRect(0, 0, canvas.width, canvas.height);
    }

    pos_to_coord(x, y) {
        let canvas = this.canvases.get("board");
        let rect = canvas.getBoundingClientRect();

        //let rel_x = x - canvas.offsetLeft - this.pad - rect.left;
        //let rel_y = y - canvas.offsetTop - this.pad - rect.top;
        //let x_coord = rel_x / this.side;
        //let y_coord = rel_y / this.side;
        let x_coord = (x-rect.left - this.pad)/this.side;
        let y_coord = (y-rect.top - this.pad)/this.side;
        return [Math.floor(x_coord+0.5), Math.floor(y_coord+0.5)];
    }

    board_relative_coords(x, y) {
        let canvas = this.canvases.get("board");
        let rect = canvas.getBoundingClientRect();
        let x_coord = x-rect.left;
        let y_coord = y-rect.top;
        let inside = x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom;
        return [x_coord/rect.width, y_coord/rect.height, inside];
    }

    clear_and_remove() {
        this.clear_all();
        this.remove_marks();
    }

    clear_all() {
        this.clear_canvas("current");
        this.clear_marks();
        this.clear_stones();
    }

    clear_stones() {
        this.clear_canvas("stones-0");
        this.clear_canvas("stones-1");
        this.clear_canvas("shadows-0");
        this.clear_canvas("shadows-1");
    }

    clear_board() {
        this.clear_canvas("board");
        this.clear_canvas("lines");
        this.clear_canvas("coords");
        this.clear_canvas("stars");
    }

    remove_marks() {
        this.letter_map = new Map();
        this.used_letters = new Array(26).fill(0);
        this.number_map = new Map();
        this.used_numbers = new Map();
        this.used_numbers.set(0, 1);
        this.marks = new Map();
        this.clear_marks();
    }

    clear_marks() {
        this.clear_canvas("marks-0");
        this.clear_canvas("marks-1");
        this.clear_canvas("backdrop-0");
        this.clear_canvas("backdrop-1");
        this.clear_canvas("pen");
    }

    clear_ghosts(){
        this.clear_canvas("ghost");
        this.clear_canvas("ghost-marks");
    }
}
