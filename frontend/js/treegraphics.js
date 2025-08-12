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

const NOCOLOR = 0;
const BLACK = 1;
const WHITE = 2;

class TreeGraphics {
    constructor() {
        let review = document.getElementById("review");
        let container = document.getElementById("explorer_container");
        container.addEventListener("scroll", () => this.render());

        // apparently this is idiomatic
        const resizeObserver = new ResizeObserver(entries => {
            for (let entry of entries) {
                if (entry.target.id == "explorer_container") {
                    this.render();
                }
            }
        });
        resizeObserver.observe(container);

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
        //this.new_svg("xs", 50);
        this.new_svg("preferred-stones", 60);
        //this.new_svg("preferred-xs", 60);

        this.grid = new Map();
        this.index = 0;

        this.r = 12;
        this.step = this.r*3;
        this.x_offset = 2*this.r;
        this.y_offset = 2*this.r;

        this.current = [0,0];
        this.height = container.offsetHeight;
        this.edges = [];

        // draw initial shapes for blank board
        this.draw_root();
        this.draw_current();

        this.resize();
    }

    new_svg(id, z_index) {
        let svg = document.createElementNS(this.svgns, "svg");
        svg.style.position = "absolute";
        svg.style.margin = "auto";
        svg.style.display = "flex";
        svg.style.width = this.width + "px";
        svg.style.height = this.height + "px";
        svg.style.zIndex = z_index;
        svg.id = id;

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
        this.render();
    }

    capture_mouse(x, y) {
        let container_rect = this.container.getBoundingClientRect();
        let rect = this.explorer.getBoundingClientRect();

        // first make sure mouse is within containing element

        if (x < container_rect.left || x > container_rect.right) {
            // x out of bounds
            return -1;

        }

        if (y < container_rect.top || y > container_rect.bottom) {
            // y out of bounds
            return -1;
        }

        let grid_x = Math.floor((x-rect.left)/this.step);
        let grid_y = Math.floor((y-rect.top)/this.step);
        if (grid_x < 0 || grid_y < 0) {
            return -1;
        }

        if (this.grid.has(grid_y)) {
            let row = this.grid.get(grid_y);
            if (row.has(grid_x)) {
                return row.get(grid_x).index;
            }
        }

        return -1;
    }

    render() {
        this.draw_current();
        // we should only render the section of the explorer that we can see
        // so i should start by just identifying the boundaries of the
        // explorer container

        // let's try to compute the x and y coords that will be visible

        let x0 = this.container.scrollLeft;
        let x1 = x0 + this.container.offsetWidth;
        let y0 = this.container.scrollTop;
        let y1 = y0 + this.container.offsetHeight;

        let x_left = Math.floor((x0 - this.x_offset) / this.step - 1);
        let x_right = Math.ceil((x1 - this.x_offset) / this.step + 1);
        let y_top = Math.floor((y0 - this.y_offset) / this.step - 1);
        let y_bottom = Math.ceil((y1 - this.y_offset) / this.step + 1);
        
        let render_nodes = [];
        for (let x = x_left; x <= x_right; x++) {
            for (let y = y_top; y <= y_bottom; y++) {
                // check for nodes to render
                if (this.grid.has(y)) {
                    let row = this.grid.get(y);
                    if (row.has(x)) {
                        render_nodes.push(row.get(x));
                    }
                }

                // check for edges to render
            }
        }

        let render_edges = [];
        for (let edge of this.edges) {
            if ((edge.start.x >= x_left &&
                edge.start.x <= x_right &&
                edge.start.y >= y_top &&
                edge.start.y <= y_bottom) ||
                (edge.end.x >= x_left &&
                edge.end.x <= x_right &&
                edge.end.y >= y_top &&
                edge.end.y <= y_bottom)) {

                render_edges.push(edge);
            }
        }

        this._draw_stones(render_nodes);
        this._draw_lines(render_edges);
    }

    _update(explorer) {

        let max_x = 0;
        let max_y = 0;
        let grid = new Map();

        if (explorer.current != null) {
            this.current = [explorer.current.x, explorer.current.y];
        }

        this.set_scroll();

        if (explorer.nodes != null) {
            for (let node of explorer.nodes) {
                let coord = node.coord;
                if (coord.x > max_x) {
                    max_x = coord.x;
                }
                if (coord.y > max_y) {
                    max_y = coord.y;
                }
    
                if (!grid.has(coord.y)) {
                    grid.set(coord.y, new Map());
                }
                grid.get(coord.y).set(coord.x, node);
            }

            this.grid = grid;
            this.edges = explorer.edges;
            this.set_dims_all(max_x+1, max_y+1);
        }

        if (explorer.preferred_nodes != null) {
            this._draw_preferred_stones(explorer.preferred_nodes);
            let edges = this.derive_edges(explorer.preferred_nodes);
            this._draw_preferred_lines(edges);
        }

    }

    derive_edges(nodes) {
        let edges = [];
        for (let i=0; i < nodes.length-1; i++) {
            let start = nodes[i].coord;
            let end = nodes[i+1].coord;
            let edge = {start: start, end: end};
            edges.push(edge);
        }
        return edges;
    }

    _draw_stones(nodes) {
        this._draw_explorer_stones(nodes, "stones", false);
    }

    _draw_preferred_stones(nodes) {
        this._draw_explorer_stones(nodes, "preferred-stones", true);
    }

    _draw_explorer_stones(nodes, id, preferred) {
        this.clear_svg(id);
        let black_stones = [];
        let white_stones = [];

        let dots = [];
        
        let black_numbers = [];
        let white_numbers = [];

        for (let node of nodes) {
            if (node.color == BLACK) {
                black_stones.push([node.coord.x, node.coord.y]);
                black_numbers.push([node.coord, node.coord.x.toString()]);
            } else if (node.color == WHITE) {
                white_stones.push([node.coord.x, node.coord.y]);
                white_numbers.push([node.coord, node.coord.x.toString()]);
            } else {
                dots.push([node.coord.x, node.coord.y]);
            }
        }

        // draw circles
        this.svg_draw_circles(black_stones, BLACK, preferred, id);
        this.svg_draw_circles(white_stones, WHITE, preferred, id);

        // draw numbers
        this.svg_draw_texts(black_numbers, WHITE, preferred, id);
        this.svg_draw_texts(white_numbers, BLACK, preferred, id);

        // draw dots
        this.svg_draw_dots(dots, preferred, id);
    }

    _draw_lines(edges) {
        this._draw_explorer_lines(edges, "lines", "#BBBBBB");
    }
   
    _draw_preferred_lines(edges) {
        this._draw_explorer_lines(edges, "preferred-lines", "#8d42eb");
    }

    _draw_explorer_lines(edges, id, color) {
        this.clear_svg(id);
        let lines = [];

        for (let edge of edges) {
            if (edge.end.y - edge.start.y > 1) {
                let line = [
                    [edge.start.x, edge.end.y-1],
                    [edge.end.x, edge.end.y]];
                lines.push(line);
                line = [
                    [edge.start.x, edge.start.y],
                    [edge.start.x, edge.end.y-1]];
                lines.push(line);
            } else {
                let line = [
                    [edge.start.x, edge.start.y],
                    [edge.end.x, edge.end.y]];
                lines.push(line);
            }
        }
        this.svg_draw_polyline(lines, color, id);

    }

    set_scroll() {
        let [x,y] = this.current;
        let [x_pos, y_pos] = this.get_xypos(x,y);
        let old_left = this.container.scrollLeft;
        let old_top = this.container.scrollTop;

        let x_padding = 5*this.step;
        let y_padding = 2*this.step;

        // basically, i want to see if the blue square is already there
        // and only update if not

        let width = this.container.offsetWidth;
        if (old_left > x_pos-x_padding || x_pos + x_padding > old_left + width) {
            this.container.scrollLeft = x_pos - x_padding;
        }

        let height = this.container.offsetHeight;

        // if y_pos is out of view, then rescroll
        if (old_top + height < y_pos || y_pos - y_padding < old_top) {
            this.container.scrollTop = y_pos - y_padding;
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

    get_xpos(x) {
        return this.x_offset + x*this.step;
    }

    get_ypos(y) {
        return this.y_offset + y*this.step;
    }

    get_xypos(x,y) {
        return [this.get_xpos(x), this.get_ypos(y)];
    }


    draw_current() {
        let [x,y] = this.current;
        this.clear_svg("current");
        let w = this.step/2;
        let [pos_x, pos_y] = this.get_xypos(x,y);
        this.svg_draw_square(pos_x-w, pos_y-w, 2*w, "#81d0eb", "current");
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
        for (let [coord, text_value] of values) {
            let x = coord.x;
            let y = coord.y;
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

    svg_draw_dots(coords, preferred, id) {
        let hex_color = "#BBBBBB";
        if (preferred) {
            hex_color = "#8d42eb";
        }
 
        let svg = this.svgs.get(id);
        for (let[x,y] of coords) {
            // skip the dot on the root node
            if (x == 0) {
                continue;
            }
            let [pos_x, pos_y] = this.get_xypos(x, y);

            let circle = document.createElementNS(this.svgns, "circle");
            circle.setAttributeNS(null, 'cx', pos_x);
            circle.setAttributeNS(null, 'cy', pos_y);
            circle.setAttributeNS(null, 'r', 2);
            circle.style.fill = hex_color;
            //circle.style.stroke = stroke_style;
            circle.style.strokeWidth = 1.5;
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


