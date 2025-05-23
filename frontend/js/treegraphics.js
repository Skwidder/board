/*
Copyright (c) 2025 Jared Nishikawa

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
*/

import { get_viewport } from './common.js';

export {
    TreeGraphics
}

class TreeGraphics {
    constructor() {
        let review = document.getElementById("review");
        let container = document.getElementById("explorer_container");
        let explorer = document.getElementById("explorer");
        this.container = container;
        this.explorer = explorer;
        let size = explorer.getAttribute("size");
        this.bgcolor = "#DEDDDA";

        //let review_height = review.offsetHeight;
        //let container_height = review_height

        // TODO: the fact that this is a fixed number
        // is a little bothersome
        this.saved_height = review.offsetHeight/3;
        container.style.height = this.saved_height + "px";
        container.style.background = this.bgcolor;

        this.width = container.offsetWidth;

        this.svgns = "http://www.w3.org/2000/svg";
        this.svgs = new Map();

        this.shapes = new Map();

        this.shapes.set("circles", new Map());
        this.shapes.set("preferred-circles", new Map());
        this.shapes.set("xs", new Map());
        this.shapes.set("preferred-xs", new Map());
        //this.shapes.set("texts", new Map());
        //this.shapes.set("preferred-texts", new Map());

        this.new_svg("current", 10);
        this.new_svg("lines", 20);
        this.new_svg("preferred-lines", 30);
        this.new_svg("root", 40);
        this.new_svg("stones", 50);
        this.new_svg("xs", 50);
        this.new_svg("preferred-stones", 60);
        this.new_svg("preferred-xs", 60);

        this.grid = [];

        this.r = 12;
        this.step = this.r*3;
        this.x_offset = 2*this.r;
        this.y_offset = 2*this.r;

        this.resize();
        this.height = container.offsetHeight;
        this.current = [0,0];

        this.draw_root();
    }

    new_svg(id, z_index) {
        let svg = document.createElementNS(this.svgns, "svg");
        svg.style.position = "absolute";
        svg.style.margin = "auto";
        svg.style.display = "flex";
        svg.style.width = this.width + "px";
        svg.style.height = this.height + "px";
        svg.style.zIndex = z_index;

        this.svgs.set(id, svg);

        explorer.appendChild(svg);
    }

    clear_svg(id) {
        this.svgs.get(id).innerHTML = "";
    }

    clear_all() {
    }

    resize() {
        let vp = get_viewport();
        let new_width = 0;
        if (vp == "xs" || vp == "sm" || vp == "md") {
            let content = document.getElementById("content");
            new_width = content.offsetWidth;

            let review = document.getElementById("review");
            let arrows = document.getElementById("arrows");
            let h = review.offsetHeight + arrows.offsetHeight*4.5;
            let new_height = window.innerHeight - h;
            // TODO:
            // still annoying that this '100' is hardcoded
            this.container.style.height = Math.max(new_height, 100) + "px";
        } else {
            let review = document.getElementById("review")
            new_width = window.innerWidth - review.offsetWidth - 100;
            this.container.style.height = this.saved_height + "px";
        }

        this.container.style.width = new_width + "px";
    }

    capture_mouse(x, y) {
        let container_rect = this.container.getBoundingClientRect();
        let rect = this.explorer.getBoundingClientRect();

        // first make sure mouse is within containing element

        if (x < container_rect.left || x > container_rect.right) {
            // x out of bounds
            return 0;

        }

        if (y < container_rect.top || y > container_rect.bottom) {
            // y out of bounds
            return 0;
        }

        let grid_x = Math.floor((x-rect.left)/this.step);
        let grid_y = Math.floor((y-rect.top)/this.step);
        if (grid_x < 0 || grid_y < 0) {
            return 0;
        }
        if (grid_y < this.grid.length) {
            if (grid_x < this.grid[grid_y].length) {
                return this.grid[grid_y][grid_x];
            }
        }
        return 0;
    }

    update(tree, change_preferred=false, change_stones=false) {
        // fill grid
        let [grid, loc] = this.fill_grid(tree);
        this.grid = grid;

        // set dimensions
        this.set_dims_all(tree.max_depth, grid.length);

        // draw lines and stones
        // [x,y] will be the location of the current blue square
        let [x,y] = this.draw_tree(tree, grid, loc, change_preferred, change_stones);

        // adjust scroll (of the container)
        // this should be based on the current move
        this.set_scroll(x, y);
    }

    set_scroll(x, y) {
        let old_left = this.container.scrollLeft;
        let old_top = this.container.scrollTop;
        let x_padding = 5*this.step;
        let y_padding = 2*this.step;
        // basically, i want to see if the blue square is already there
        // and only update if not

        let width = this.container.offsetWidth;
        if (old_left > x-x_padding || x + x_padding > old_left + width) {
            this.container.scrollLeft = x - x_padding;
        }
        if (old_top > y - y_padding || y + y_padding > old_top + this.height) {
            this.container.scrollTop = y - y_padding;
        }

    }

    set_dims_all(m, g) {
        let changes = false;
        let width = this.width;
        let w = (m+1)*this.step;
        if (w != width) {
            width = w;
            this.width = w;
            changes = true;
        }

        let height = this.height;
        let h = (g+1)*this.step;
        if (h != height) {
            height = h;
            this.height = height;
            changes = true;
        }

        if (changes) {
            this.explorer.style.height = height + "px";
            this.explorer.style.width = width + "px";

            for (let [key, svg] of this.svgs.entries()) {
                svg.style.height = height + "px";
                svg.style.width = width + "px";
            }
        }
    }

    fill_grid(tree) {
        // there is a 2d "grid" that every move will exist on
        let row = new Array(tree.max_depth).fill(0);
        let grid = [];
        grid.push(row);

        // we'll also keep track of placements in the grid with a map
        let loc = new Map();

        // thus we should always be able to calculate your place
        // in the grid

        let stack = [tree.root];
        let x = 0;
        let y = 0;
        while (stack.length > 0) {
            let cur = stack.pop();
            if (typeof cur == "string") {
                if (cur == "<") {
                    x--;
                }
                continue;
            }
            // y is the row
            // start with the last row
            y = grid.length - 1;

            if (grid[y][x] != 0) {
                // if there's something in the last row (in the x coord)
                // add a new row
                grid.push(new Array(tree.max_depth).fill(0));
                y++;
            } else {
                while (true) {
                    if (y == 0) {
                        break;
                    }

                    // look at the parent
                    let p = cur.up;
                    if (p != null) {
                        let [x1, y1] = loc.get(p.index);
                        // actually, don't go any farther than the 
                        // diagonal connecting the parent
                        if (x-y >= x1-y1) {
                            break;
                        }
                        // don't go any farther than the parent row
                        if (y == y1) {
                            break;
                        }

                    }

                    // i want to find the earliest row
                    // (before going past the parent)
                    // that is empty
                    if (grid[y][x] == 0 && grid[y-1][x] != 0) {
                        break;
                    }
                    y--;
                }
            }

            grid[y][x] = cur;
            loc.set(cur.index, [x,y]);

            // if the parent is a diagonal away, we have to take up
            // another node
            // (this is for all the "angled" edges)
            let p = cur.up;
            if (p != null) {
                let [x1, y1] = loc.get(p.index);
                if (y - y1 > 1) {
                    if (grid[y-1][x-1] == 0) {
                        grid[y-1][x-1] = 1;
                    }
                }
            }

            x ++;

            // push on children in reverse order
            for (let i=cur.down.length-1; i >=0; i--) {
                stack.push("<")
                stack.push(cur.down[i]);
            }
        }
        return [grid, loc];
    }

    get_xpos(x) {
        return this.x_offset + x*this.step;
    }

    get_ypos(y) {
        return this.y_offset + y*this.step;
    }

    get_xypos(x,y) {
        return [this.get_xpos(x), this.get_ypos(y)];
    }

    draw_lines(grid, loc) {
        let lines = [];

        for (let row of grid) {
            for (let cur of row) {
                if (cur == 0 || cur == 1) {
                    continue;
                }
                if (cur.up == null) {
                    continue;
                }
                lines.push(...this.get_connecting_line(cur, loc));
            }
        }
        this.svg_draw_polyline(lines, "#BBBBBB", "lines");
    }

    draw_preferred_line(tree, loc) {
        let cur = tree.root;
        let lines = [];

        while (true) {
            if (cur.down.length == 0) {
                break;
            }

            cur = cur.down[cur.preferred_child];
            lines.push(...this.get_connecting_line(cur, loc));
        }
        this.svg_draw_polyline(lines, "#8d42eb", "preferred-lines");
    }

    draw_preferred_stones(tree, loc) {
        let cur = tree.root;

        let white_stones = [];
        let black_stones = [];
        let xs = [];
        let black_numbers = [];
        let white_numbers = [];
        let circles = new Map();

        while (true) {
            if (cur.down.length == 0) {
                break;
            }
            cur = cur.down[cur.preferred_child];
            // collect stones
            let coord = loc.get(cur.index);
            let cols = cur.colors();
            if (!cols.has(1) && !cols.has(2)){
                xs.push(coord);
            } else if (cols.has(2)) {
                let [x,y] = coord;
                let circle_id = "preferred-stones" + ":" + x + ":" + y + ":" + 2;
                let text_id = "preferred-texts" + ":" + x + ":" + y + ":text";
                circles.set(circle_id, 1);
                if (this.shapes.get("preferred-circles").has(circle_id)) {
                    this.shapes.get("preferred-circles").delete(circle_id);
                    //this.shapes.get("preferred-texts").delete(text_id);
                } else {
                    white_stones.push(coord);
                    black_numbers.push([coord, cur.depth.toString()]);
                }
            } else {
                let [x,y] = coord;
                let circle_id = "preferred-stones" + ":" + x + ":" + y + ":" + 1;
                let text_id = "preferred-texts" + ":" + x + ":" + y + ":text";
                circles.set(circle_id, 1);
                if (this.shapes.get("preferred-circles").has(circle_id)) {
                    this.shapes.get("preferred-circles").delete(circle_id);
                    //this.shapes.get("preferred-texts").delete(text_id);
                } else {
                    black_stones.push(coord);
                    white_numbers.push([coord, cur.depth.toString()]);
                }
            }
        }

        // clear all the circles that we don't want anymore
        for (let [id,v] of this.shapes.get("preferred-circles").entries()) {
            document.getElementById(id).remove();
            let spl = id.split(":");
            let text_id = spl.slice(0, 3).join(":") + ":text";
            document.getElementById(text_id).remove();
        }

        //for (let [id,v] of this.shapes.get("preferred-texts").entries()) {
        //    document.getElementById(id).remove();
        //}


        // draw the new circles
        this.svg_draw_xs(xs, true);
        this.svg_draw_circles(black_stones, 1, true, "preferred-stones");
        this.svg_draw_circles(white_stones, 2, true, "preferred-stones");

        this.shapes.set("preferred-circles", circles);

        this.svg_draw_texts(black_numbers, 1, true, "preferred-stones");
        this.svg_draw_texts(white_numbers, 2, true, "preferred-stones");

    }

    draw_stones(tree, grid, loc) {
        // get indexes of tree's preferred nodes
        let preferred = tree.preferred();

        let white_stones = [];
        let black_stones = [];
        let xs = [];
        let black_numbers = [];
        let white_numbers = [];
        let circles = new Map();
        for (let row of grid) {
            for (let cur of row) {
                if (cur == 0 || cur == 1) {
                    continue;
                }
                if (cur.index == 0) {
                    continue;
                }

                // collect stones
                let coord = loc.get(cur.index);
                let cols = cur.colors();
                if (!cols.has(1) && !cols.has(2)){
                    xs.push(coord);
                } else if (cols.has(2)) {
                    let [x,y] = coord;
                    let circle_id = "stones" + ":" + x + ":" + y + ":" + 2;
                    let text_id = "stones" + ":" + x + ":" + y + ":text";
                    circles.set(circle_id, 1);
                    if (this.shapes.get("circles").has(circle_id)) {
                        this.shapes.get("circles").delete(circle_id);
                        //this.shapes.get("texts").delete(text_id);
                    } else {
                        // only add new stones that aren't already in the map
                        white_stones.push(coord);
                        black_numbers.push([coord, cur.depth.toString()]);
                    }
                } else {
                    let [x,y] = coord;
                    let circle_id = "stones" + ":" + x + ":" + y + ":" + 1;
                    let text_id = "stones" + ":" + x + ":" + y + ":text";
                    circles.set(circle_id, 1);
                    if (this.shapes.get("circles").has(circle_id)) {
                        this.shapes.get("circles").delete(circle_id);
                        //this.shapes.get("texts").delete(text_id);
                    } else {
                        // only add new stones that aren't already in the map
                        black_stones.push(coord);
                        white_numbers.push([coord, cur.depth.toString()]);
                    }
                }
            }
        }

        this.svg_draw_xs(xs, false);

        // clear all the circles that we don't want anymore
        for (let [id,v] of this.shapes.get("circles").entries()) {
            document.getElementById(id).remove();
            let spl = id.split(":");
            let text_id = spl.slice(0, 3).join(":") + ":text";
            document.getElementById(text_id).remove();
        }

        //for (let [id,v] of this.shapes.get("texts").entries()) {
        //    document.getElementById(id).remove();
        //}

        // draw all the circles that weren't already there
        this.svg_draw_circles(black_stones, 1, false, "stones");
        this.svg_draw_circles(white_stones, 2, false, "stones");

        this.shapes.set("circles", circles);

        // and the text
        this.svg_draw_texts(black_numbers, 1, false, "stones");
        this.svg_draw_texts(white_numbers, 2, false, "stones");
    }

    draw_current(x, y) {
        let w = this.step/2;
        let [pos_x, pos_y] = this.get_xypos(x,y);
        this.svg_draw_square(pos_x-w, pos_y-w, 2*w, "#81d0eb", "current");
        this.current = [x,y];
    }

    draw_tree(tree, grid, loc, change_preferred, change_stones) {
        if (change_preferred) {
            this.clear_svg("preferred-lines");
            this.clear_svg("preferred-xs");
            //this.clear_svg("preferred-stones");
        }
        if (change_stones) {
            this.clear_svg("lines");
            this.clear_svg("xs");
            //this.clear_svg("stones");
        }

        // draw "current" blue square
        let w = this.step/2;
        let [x,y] = loc.get(tree.current.index);
        this.clear_svg("current");
        this.draw_current(x, y);

        let [pos_x, pos_y] = this.get_xypos(x,y);

        // draw lines
        // only if there's new stones
        if (change_stones) {
            this.draw_lines(grid, loc);
        }

        // draw preferred line
        // only if there's a change in preferred line
        if (change_preferred) {
            this.draw_preferred_line(tree, loc);
        }

        // draw stones
        // we only need to redraw stones if there are new ones to draw
        if (change_stones) {
            this.draw_stones(tree, grid, loc);
        }

        if (change_preferred) {
            this.draw_preferred_stones(tree, loc);
        }
        return [pos_x, pos_y];
    }

    svg_draw_texts(values, color, preferred, id) {
        let hex_color = "#000000";
        if (color == 2) {
            hex_color = "#FFFFFF";
        }
        if (!preferred) {
            hex_color += "44";
        }
        let svg = this.svgs.get(id);
        for (let [[x,y], text_value] of values) {
            let text_id = id + ":" + x + ":" + y + ":text";

            //if (preferred) {
            //    this.shapes.get("preferred-texts").set(text_id, 1);
            //} else {
            //    this.shapes.get("texts").set(text_id, 1);
            //}

            let [pos_x, pos_y] = this.get_xypos(x, y);
            let text = document.createElementNS(this.svgns, "text");
            let font_size = this.r;

            let x_offset = font_size/3;
            if (text_value.length == 2) {
                x_offset *= 1.6;
            } else if (text_value.length == 3) {
                x_offset *= 2.5;
            }
            let y_offset = font_size/3;

            text.setAttribute("x", pos_x-x_offset);
            text.setAttribute("y", pos_y+y_offset);
            text.style.fontSize = font_size + "px";
            text.style.fill = hex_color;
            text.innerHTML = text_value;
            text.setAttributeNS(null, "id", text_id);
            text.style.cursor = "default";
            text.style.userSelect = "none";
            svg.appendChild(text);
        }
    }

    get_connecting_line(cur, loc) {
        let lines = [];

        let [x,y] = loc.get(cur.index);

        let par = cur.up;
        let [x1, y1] = loc.get(par.index);

        if (y == y1) {
            lines.push([[x,y], [x1, y1]]);
        } else {
            lines.push([[x,y], [x-1, y-1]]);
            lines.push([[x-1, y-1], [x1, y1]]);
        }
        return lines;
    }

    svg_draw_polyline(coord_pairs, hexColor, id) {
        let svg = this.svgs.get(id);
        let d = "";

        let path = document.createElementNS(this.svgns, "path");
        for (let [[x0, y0], [x1, y1]]  of coord_pairs) {
            let [pos_x0, pos_y0] = this.get_xypos(x0, y0);
            let [pos_x1, pos_y1] = this.get_xypos(x1, y1);
            d += "M";
            d += pos_x0.toString() + " ";
            d += pos_y0.toString() + " ";
            d += "L";
            d += pos_x1.toString() + " ";
            d += pos_y1.toString() + " ";
        }
        //path.style.fill = hexColor;
        path.style.stroke = hexColor;
        path.style.strokeWidth = 2;

        path.setAttribute("d", d);
        
        svg.appendChild(path);
    }

    svg_draw_xs(coords, preferred) {
        if (coords.length==0) {
            return;
        }

        let hex_color = "#AA0000";
        let id = "preferred-xs";
        if (!preferred) {
            hex_color += "44";
            id = "xs";
        }
        let svg = this.svgs.get(id);
        let r = this.r;
        let l = r/2;
        let path = document.createElementNS(this.svgns, "path");
        let d = "";
        for (let [x,y] of coords) {
            let [pos_x, pos_y] = this.get_xypos(x, y);
            d += "M ";
            d += (pos_x-l) + " ";
            d += (pos_y-l) + " ";
            d += "L ";
            d += (pos_x+l) + " ";
            d += (pos_y+l) + " ";

            d += "M ";
            d += (pos_x+l) + " ";
            d += (pos_y-l) + " ";
            d += "L ";
            d += (pos_x-l) + " ";
            d += (pos_y+l) + " ";
        }

        path.style.stroke = hex_color;
        path.style.strokeWidth = 3;
        path.setAttribute("d", d);
 
        svg.appendChild(path);
    }

    svg_draw_semicircle(x, y, r, sweep, hexColor, id) {
        let svg = this.svgs.get(id);
        let path = document.createElementNS(this.svgns, "path");
        let d = "";
        d += "M ";
        d += x.toString() + " ";
        d += (y-r).toString() + " ";
        d += "A ";
        d += r.toString() + " ";
        d += r.toString() + " ";
        d += 0 + " ";
        d += 0 + " ";
        d += sweep + " ";
        d += x.toString() + " ";
        d += (y+r).toString() + " ";
        d += "Z";

        //path.style.stroke = "#000000";
        path.style.fill = hexColor;
        path.setAttribute("d", d);
 
        svg.appendChild(path);

    }

    svg_draw_circle(x, y, r, hexColor, id, strokeWidth=1) {
        let svg = this.svgs.get(id);
        let circle = document.createElementNS(this.svgns, "circle");
        circle.setAttributeNS(null, 'cx', x);
        circle.setAttributeNS(null, 'cy', y);
        circle.setAttributeNS(null, 'r', r);
        circle.style.fill = hexColor;
        circle.style.stroke = "#000000";
        circle.style.strokeWidth = strokeWidth;
        svg.appendChild(circle);
    }

    svg_draw_circles(coords, color, preferred, id)  {
        let stroke_style = "#000000";
        let hex_color = "#000000";
        if (color == 2) {
            hex_color = "#FFFFFF";
        }

        if (!preferred) {
            hex_color += "44";
            stroke_style += "44";
        }
        let svg = this.svgs.get(id);
        for (let[x,y] of coords) {
            let circle_id = id + ":" + x + ":" + y + ":" + color;
            if (preferred) {
                this.shapes.get("preferred-circles").set(circle_id, 1);
            } else {
                this.shapes.get("circles").set(circle_id, 1);
            }

            let [pos_x, pos_y] = this.get_xypos(x, y);

            let circle = document.createElementNS(this.svgns, "circle");
            circle.setAttributeNS(null, 'cx', pos_x);
            circle.setAttributeNS(null, 'cy', pos_y);
            circle.setAttributeNS(null, 'r', this.r);
            circle.style.fill = hex_color;
            circle.style.stroke = stroke_style;
            circle.style.strokeWidth = 1.5;
            circle.setAttributeNS(null, "id", circle_id);
            svg.appendChild(circle);
        }
    }

    svg_draw_square(x, y, w, hexColor, id) {
        let svg = this.svgs.get(id);
        let rect = document.createElementNS(this.svgns, "rect");
        let [pos_x,pos_y] = this.get_xypos(x, y);
        rect.setAttribute("width", w);
        rect.setAttribute("height", w);
        rect.setAttribute("x", x);
        rect.setAttribute("y", y);
        rect.setAttribute("fill", hexColor);
        svg.appendChild(rect);
    }

    draw_root() {
        let id = "root";
        let [x,y] = this.get_xypos(0, 0);
        let w = this.step/2;
        let r = w/3;

        // half black circle
        this.svg_draw_semicircle(x, y, r, 1, "#000000", id);

        // half white circle
        this.svg_draw_semicircle(x, y, r, 0, "#FFFFFF", id);

        this.svg_draw_circle(x, y+r/2, r/2, "#000000", id, 0);
        this.svg_draw_circle(x, y-r/2, r/2, "#FFFFFF", id, 0);
    }
}


