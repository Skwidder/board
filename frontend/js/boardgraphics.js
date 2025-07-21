/*
Copyright (c) 2025 Jared Nishikawa

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
*/

export {
    BoardGraphics,
    letters,
}

const letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";

function make_linear_gradient(svgns, color1, color2, id) {
    let grad = document.createElementNS(svgns, "linearGradient");
    grad.id = id;
    grad.setAttributeNS(null, "x1", "0%");
    grad.setAttributeNS(null, "y1", "0%");
    grad.setAttributeNS(null, "x2", "100%");
    grad.setAttributeNS(null, "y2", "100%");

    let stop1 = document.createElementNS(svgns, "stop");
    stop1.setAttributeNS(null, "offset", "25%");
    stop1.setAttributeNS(null, "stop-color", color1);

    let stop2 = document.createElementNS(svgns, "stop");
    stop2.setAttributeNS(null, "offset", "100%");
    stop2.setAttributeNS(null, "stop-color", color2);

    grad.appendChild(stop1);
    grad.appendChild(stop2);
    return grad;
}

function make_white_gradient(svgns) {
    return make_linear_gradient(svgns, "#FFFFFF", "#BBBBBB", "white_grad");
}

function make_black_gradient(svgns) {
    return make_linear_gradient(svgns, "#444444", "#000000", "black_grad");
}

class BoardGraphics {
    constructor(state) {
        this.state = state;

        let review = document.getElementById("review");

        this.size = this.state.size;
        this.width = parseInt(review.offsetHeight)*(this.size-1)/(this.size+1);
        this.side = this.width/(this.size-1);

        this.minstroke = this.side / 64;
        this.pad = this.side;

        this.svgs = new Map();
        this.svgns = "http://www.w3.org/2000/svg";

        this.bgcolor = "#f2bc74"

        this.new_svg("board", 0);
        this.new_svg("lines", 10);
        this.new_svg("coords", 20);
        this.new_svg("backdrop", 30);
        this.new_svg("ghost", 50);
        this.new_svg("shadows", 800);
        this.new_svg("stones", 900);
        this.new_svg("current", 950);
        this.new_svg("marks", 1000);
        this.new_svg("ghost-marks", 1000);

        this.new_svg("pen", 1050);

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

    new_svg(id, z_index) {
        // derp
        if (this.svgs.has(id)) {
            return;
        }
        let review = document.getElementById("review");
        let svg = document.createElementNS(this.svgns, "svg");
        let w = (this.width + this.pad*2);

        svg.id = id;
        svg.style.position = "absolute";
        svg.style.margin = "auto";
        svg.style.display = "flex";
        svg.style.width = review.offsetHeight + "px";
        svg.style.height = review.offsetHeight + "px";

        svg.style.zIndex = z_index;

        this.svgs.set(id, svg);

        review.appendChild(svg);
    }

    add_def(id, elt) {
        if (!this.svgs.has(id)) {
            return;
        }
        let svg = this.svgs.get(id);
        let defs = svg.querySelector("defs")
            || document.createElementNS(this.svgns, "defs");
        defs.appendChild(elt);
        if (!svg.querySelector("defs")) {
            svg.appendChild(defs);
        }
    }

    clear_svg(id) {
        if (!this.svgs.has(id)) {
            return;
        }
        this.svgs.get(id).innerHTML = "";
    }

    recompute_consts() {
        let review = document.getElementById("review");

        this.size = this.state.size;
        this.width = parseInt(review.offsetHeight)*(this.size-1)/(this.size+1);
        this.side = this.width/(this.size-1);
        this.minstroke = this.side / 64;
        this.pad = this.side;
    }

    resize_all() {
        for (let [id, _] of this.svgs) {
            this.resize_svg(id);
        }
    }

    resize_svg(id) {
        let review = document.getElementById("review");
        let svg = this.svgs.get(id);
        if (svg == null) {
            return;
        }
        let w = (this.width + this.pad*2);

        svg.style.position = "absolute";
        svg.style.margin = "auto";
        svg.style.display = "flex";

        svg.style.width = review.offsetHeight + "px";
        svg.style.height = review.offsetHeight + "px";
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
        this.clear_svg("marks");
        this.clear_svg("backdrop");
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
            let svg_id = "marks";

            if (value == "square") {
                this.draw_square(x, y, hexcolor, svg_id);
            } else if (value == "triangle") {
                this.draw_triangle(x, y, hexcolor, svg_id);
            } else if (value.startsWith("letter")) {
                spl = value.split(":");
                let letter_index = parseInt(spl[1]);
                let letter = letters[letter_index%26];
                this.draw_backdrop(x,y);
                this.draw_letter(x, y, letter, hexcolor, svg_id);
            } else if (value.startsWith("number")) {
                spl = value.split(":");
                let number = parseInt(spl[1]);
                this.draw_backdrop(x,y);
                this.draw_number(x, y, number, hexcolor, svg_id);
            }
        }
    }

    draw_stones() {
        this.clear_stones();
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
        let svg = this.svgs.get("board");
        let rect = document.createElementNS(this.svgns, "rect");
        rect.setAttributeNS(null, "width", this.width+this.pad*2);
        rect.setAttributeNS(null, "height", this.width+this.pad*2);
        rect.setAttributeNS(null, "x", 0);
        rect.setAttributeNS(null, "y", 0);
        rect.setAttributeNS(null, "rx", 0);
        rect.setAttributeNS(null, "ry", 0);
        rect.setAttributeNS(null, "fill", hex_color);
        svg.appendChild(rect);

        this.bgcolor = hex_color;

        // very low on the priority list for fixing some day
        this.clear_marks();
    }

    draw_lines() {
        var i;

        let coord_pairs = [];

        for (i=0; i<this.size; i++) {
            let x0 = this.side*i + this.pad;
            let y0 = this.pad;
            let x1 = this.side*i + this.pad;
            let y1 = this.width + this.pad;

            coord_pairs.push([[x0, y0], [x1, y1]]);
            coord_pairs.push([[y0, x0], [y1, x1]]);
        }
        this.svg_draw_polyline(coord_pairs, "#000000", "lines");
    }

    svg_draw_polyline(coord_pairs, hexColor, id, stroke=this.minstroke) {
        let svg = this.svgs.get(id);
        let d = "";

        let path = document.createElementNS(this.svgns, "path");
        for (let [[x0, y0], [x1, y1]]  of coord_pairs) {
            d += "M";
            d += x0.toString() + " ";
            d += y0.toString() + " ";
            d += "L";
            d += x1.toString() + " ";
            d += y1.toString() + " ";
        }

        path.style.stroke = hexColor;
        path.style.strokeWidth = stroke;

        path.setAttribute("d", d);
        
        svg.appendChild(path);
        return path;
    }

    svg_draw_text(x, y, txt, color, id, font_size, bold=true) {
        //let font_size = this.width/36;
        let text = document.createElementNS(this.svgns, "text");
        let svg = this.svgs.get(id);

        text.setAttribute("x", x);
        text.setAttribute("y", y);
        text.setAttribute("font-family", "Arial");
        if (bold) {
            text.setAttribute("font-weight", "bold");
        }
        text.style.fontSize = font_size + "px";
        text.style.fill = color;
        text.innerHTML = txt;
        //text.setAttributeNS(null, "id", text_id);
        text.style.cursor = "default";
        text.style.userSelect = "none";
        svg.appendChild(text);
        return text;
    }

    draw_coords() {
        var i;

        let font_size = this.width/50;
        let letters = "ABCDEFGHJKLMNOPQRST";
        let review = document.getElementById("review");

        for (i=0; i<this.size; i++) {

            // letters along the top
            this.svg_draw_text(
                this.side*i+this.pad*7/8,
                this.pad/2,
                letters[i],
                "#000000",
                "coords",
                font_size,
                false);

            // letters along the bottom
            this.svg_draw_text(
                this.side*i+this.pad*7/8,
                this.width+this.pad*7/4,
                letters[i],
                "#000000",
                "coords",
                font_size,
                false);

            // numbers along the left
            this.svg_draw_text(
                this.pad/8,
                this.side*i+this.pad*9/8,
                (this.size-i).toString(),
                "#000000",
                "coords",
                font_size,
                false);

            // numbers along the right
            this.svg_draw_text(
                this.width + this.pad*12/8,
                this.side*i+this.pad*9/8,
                (this.size-i).toString(),
                "#000000",
                "coords",
                font_size,
                false);
        }
    }

    // board graphics
    draw_circle(x, y, r, hexColor, id, filled=true, stroke=3*this.minstroke) {
        let real_x = x*this.side + this.pad;
        let real_y = y*this.side + this.pad;
        return this.draw_raw_circle(real_x, real_y, r, hexColor, id, filled, stroke);
    }

    // board graphics
    draw_gradient_circle(x, y, r, grad_id, id, stroke=3*this.minstroke) {
        let real_x = x*this.side + this.pad;
        let real_y = y*this.side + this.pad;
        return this.draw_raw_gradient_circle(real_x, real_y, r, grad_id, id, stroke);
    }


    draw_raw_circle(x, y, r, hexColor, id, filled=true, stroke=3*this.minstroke) {

        // for kicks and giggles
        //r = 0.8*r;
        //return this.draw_raw_square(x, y, r, hexColor, id, filled, stroke);
        
        let svg = this.svgs.get(id);
        let circle = document.createElementNS(this.svgns, "circle");
        circle.setAttributeNS(null, 'cx', x);
        circle.setAttributeNS(null, 'cy', y);
        circle.setAttributeNS(null, 'r', r);
        circle.style.stroke = "#000000";
        if (filled) {
            circle.style.fill = hexColor;
        } else {
            circle.style.stroke = hexColor;
            circle.style.fillOpacity = "0%";
        }
        circle.style.strokeWidth = stroke;
        svg.appendChild(circle);
        return circle;
    }

    draw_raw_square(x, y, r, hexColor, id, filled=true, stroke=3*this.minstroke) {
        let svg = this.svgs.get(id);
        let square = document.createElementNS(this.svgns, "rect");

        square.setAttributeNS(null, "width", 2*r);
        square.setAttributeNS(null, "height", 2*r);
        square.setAttributeNS(null, "x", x-r);
        square.setAttributeNS(null, "y", y-r);
        square.setAttributeNS(null, "rx", 0);
        square.setAttributeNS(null, "ry", 0);
        square.setAttributeNS(null, "fill", hexColor);
        svg.appendChild(square);
        return square
    }

    draw_raw_gradient_circle(x, y, r, grad_id, id, stroke=3*this.minstroke) {
        let color = "url(#" + grad_id + ")";
        return this.draw_raw_circle(x, y, r, color, id, true, stroke);
    }

    draw_current_coord(x, y) {
    }

    draw_current() {
        this.clear_svg("current");
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
        if (x < 0 || x >= this.size || y < 0 || y >= this.size) {
            return;
        }
        let real_x = x*this.side + this.pad;
        let real_y = y*this.side + this.pad;
        let r = (this.side/3);
        let s = 2*r*Math.cos(Math.PI/6);
        let a = r/2;

        let coord_pairs = [];
        let A = [real_x, real_y-r];
        let B = [real_x+s/2, real_y+a];
        let C = [real_x-s/2, real_y+a];
        coord_pairs.push([A, B]);
        coord_pairs.push([B, C]);
        coord_pairs.push([C, A]);
        let t = this.svg_draw_polyline(coord_pairs, hexColor, id, 3*this.minstroke);
        t.id = "mark-" + x.toString() + "-" + y.toString();

    }

    draw_ghost_triangle(x, y) {
        this.clear_svg("ghost-marks");
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
        if (x < 0 || x >= this.size || y < 0 || y >= this.size) {
            return;
        }
        let real_x = x*this.side + this.pad;
        let real_y = y*this.side + this.pad;
        let r = (this.side/3);
        let h = 3*r/2;
        let b = h/2;

        let A = [real_x+b, real_y-b];
        let B = [real_x+b, real_y+b];
        let C = [real_x-b, real_y+b];
        let D = [real_x-b, real_y-b];
        let coord_pairs = [[A, B], [B, C], [C, D], [D, A]];
        let s = this.svg_draw_polyline(coord_pairs, hexColor, id, 3*this.minstroke);
        s.id = "mark-" + x.toString() + "-" + y.toString();
    }

    draw_ghost_square(x, y) {
        this.clear_svg("ghost-marks");
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
        this.draw_circle(x, y, radius, "#000000", "lines", true, 0);
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
        let id = "stone-" + x.toString() + "-" + y.toString();
        let stone = document.getElementById(id);
        if (stone == null) {
            return;
        }
        stone.remove();

        // clear cast shadow
        this.clear_cast_shadow(x, y);
    }

    draw_pen(x0, y0, x1, y1, pen_color) {
        // TODO: what to do if click and don't move
        if (x0 == null) {
            // interestingly, OGS doesn't draw anything in this case either
            return;
        }

        let svg = this.svgs.get("pen");
        let rect = svg.getBoundingClientRect();
        let coord_pairs = [];
        coord_pairs.push(
            [
                [x0*rect.width, y0*rect.height],
                [x1*rect.width, y1*rect.height]
            ]
        );
        this.svg_draw_polyline(coord_pairs, pen_color, "pen", 4*this.minstroke);
    }

    draw_stone(x, y, color) {
        let radius = this.side/2 * 0.98;
        let hexcolor = "#000000";
        if (color == 2) {
            hexcolor = "#F0F0F0";
        }
        // this could be more idiomatic and universal
        let id = x.toString() + "-" + y.toString();

        let svg_id = "stones";

        // stone
        
        let stroke = 0.5*this.minstroke;

        let stone;
        if (color == 2) {
            // regular fill
            //this.draw_circle(x, y, radius, hexcolor, svg_id);

            // gradient fill
            stone = this.draw_gradient_circle(x, y, radius, "white_grad", svg_id, stroke);
            
        } else if (color == 1) {
            // regular fill
            //this.draw_circle(x, y, radius, hexcolor, svg_id);
            
            // gradient fill
            stone = this.draw_gradient_circle(x, y, radius, "black_grad", svg_id, stroke);

        }
        stone.setAttribute("id", "stone-"+id);

        // cast shadow
        let shadow = this.draw_cast_shadow(x, y);
        shadow.setAttribute("id", "shadow-"+id);

    }

    draw_cast_shadow(x, y) {
        let radius = this.side/2 * 0.98;
        let real_x = x*this.side + this.pad;
        let real_y = y*this.side + this.pad;
        let offset = 3*this.minstroke;
        let id = "shadows";

        return this.draw_raw_circle(real_x+offset, real_y+offset, radius, "#00000055", id, true, 0);
    }

    clear_cast_shadow(x, y) {
        let id = "shadow-" + x.toString() + "-" + y.toString();
        let shadow = document.getElementById(id);
        if (shadow == null) {
            return;
        }
        shadow.remove();

    }

    draw_ghost_stone(x, y, color) {
        this.clear_svg("ghost");
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
        this.draw_circle(x, y, radius, hexcolor, "ghost", true, 0);
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
        let real_x = x*this.side + this.pad;
        let real_y = y*this.side + this.pad;

        let font_size = this.width/36;

        let x_offset = font_size/3;
        if (letter == "I") {
            x_offset = font_size/8;
        }
        let y_offset = font_size/3;

        return this.svg_draw_text(
            real_x-x_offset, real_y+y_offset, letter, color, id, font_size);
    }

    draw_ghost_letter(x, y, color) {
        this.clear_svg("ghost-marks");
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
        let real_x = x*this.side + this.pad;
        let real_y = y*this.side + this.pad;

        let font_size = this.width/36;

        let x_offset = font_size/3;
        if (number >= 10) {
            x_offset = font_size/2;
        } if (number >= 100) {
            x_offset = font_size;
        }
        let y_offset = font_size/3;
        return this.svg_draw_text(
            real_x-x_offset, real_y+y_offset, number, color, id, font_size);
    }

    draw_ghost_number(x, y, color) {
        this.clear_svg("ghost-marks");
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
        let svg_id = "marks";
        let id = x.toString() + "-" + y.toString();

        if (this.marks.has(id)) {
            this.remove_mark(x, y);
            return;
        }

        if (mark == "triangle") {
            this.triangles.set(id, 1);
            this.marks.set(id, "triangle");
            this.draw_triangle(x, y, hexcolor, svg_id);
        } else if (mark == "square") {
            this.squares.set(id, 1);
            this.marks.set(id, "square");
            this.draw_square(x, y, hexcolor, svg_id);
        } else if (mark == "letter") {
            let letter_index = this.get_letter();
            if (letter_index == null) {
                return;
            }
            let letter = letters[letter_index%26];
            this.use_letter(letter_index);
            this.marks.set(id, "letter:" + letter_index.toString());
            this.draw_backdrop(x,y);
            let l = this.draw_letter(x, y, letter, hexcolor, svg_id);
            l.id = "mark-" + id;
        } else if (mark == "number") {
            let number = this.get_number();
            this.use_number(number);
            this.marks.set(id, "number:" + number.toString());
            this.draw_backdrop(x, y);
            let n = this.draw_number(x, y, number, hexcolor, svg_id);
            n.id = "mark-" + id;
        } else if (mark == "eraser") {
            this.erase_stone(x, y);
        }
    }

    draw_manual_letter(x, y, letter) {
        this.saved_color = this.color;
        let hexcolor = "#000000";
        if (this.state.board.points[x][y] == 1) {
            hexcolor = "#FFFFFF";
        }
        let svg_id = "marks";
        let id = x.toString() + "-" + y.toString();

        let letter_index = letter.charCodeAt(0)-65;
        this.use_letter(letter_index);
        this.marks.set(id, "letter:" + letter_index.toString());
        this.draw_backdrop(x, y);
        let l = this.draw_letter(x, y, letter, hexcolor, svg_id);

        let _id = "mark-" + x.toString() + "-" + y.toString();
        l.id = _id;
    }

    draw_manual_number(x, y, number) {
        this.saved_color = this.color;
        let hexcolor = "#000000";
        if (this.state.board.points[x][y] == 1) {
            hexcolor = "#FFFFFF";
        }
        let svg_id = "marks";
        let id = x.toString() + "-" + y.toString();

        this.use_number(number);
        this.marks.set(id, "number:" + number.toString());
        this.draw_backdrop(x, y);
        let n = this.draw_number(x, y, number, hexcolor, svg_id);

        let _id = "mark-" + x.toString() + "-" + y.toString();
        n.id = _id;
    }

    clear_mark(x, y) {
        let id = "mark-" + x.toString() + "-" + y.toString();
        let mark = document.getElementById(id);
        if (mark == null) {
            return;
        }
        mark.remove();
    }

    draw_backdrop(x, y) {
        let id = "backdrop";
        let backdrop = this.draw_circle(x, y, this.side/3, this.bgcolor, id, true, 0);
        backdrop.id = "backdrop-" + x.toString() + "-" + y.toString();
    }

    clear_backdrop(x, y) {
        let id = "backdrop-" + x.toString() + "-" + y.toString();
        let backdrop = document.getElementById(id);
        if (backdrop == null) {
            return;
        }
        backdrop.remove();
    }

    erase_stone(x, y) {
        // clear the stone (and shadow)
        this.clear_stone(x, y);

        // clear marks
        this.clear_marks();

        // clearing "current" no matter what
        this.clear_svg("current");
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
        }
    }

    pos_to_coord(x, y) {
        let board = this.svgs.get("board");
        let rect = board.getBoundingClientRect();

        let x_coord = (x-rect.left - this.pad)/this.side;
        let y_coord = (y-rect.top - this.pad)/this.side;
        return [Math.floor(x_coord+0.5), Math.floor(y_coord+0.5)];
    }

    board_relative_coords(x, y) {
        let board = this.svgs.get("board");
        let rect = board.getBoundingClientRect();
        let x_coord = x-rect.left;
        let y_coord = y-rect.top;
        let inside = x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom;
        return [x_coord/rect.width, y_coord/rect.height, inside];
    }

    clear_and_remove() {
        this.clear_all();
        this.remove_marks();
    }

    clear_current() {
        this.clear_svg("current");
    }

    clear_all() {
        this.clear_svg("current");
        this.clear_marks();
        this.clear_stones();
    }

    clear_stones() {
        this.clear_svg("stones");
        this.add_def("stones", make_black_gradient(this.svgns));
        this.add_def("stones", make_white_gradient(this.svgns));

        this.clear_svg("shadows");
    }

    clear_board() {
        this.clear_svg("board");
        this.clear_svg("lines");
        this.clear_svg("coords");
    }

    clear_pen() {
        this.clear_svg("pen");
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
        this.clear_svg("marks");
        this.clear_svg("backdrop");
        this.clear_pen();
    }

    clear_ghosts() {
        this.clear_svg("ghost");
        this.clear_svg("ghost-marks");

    }

}
