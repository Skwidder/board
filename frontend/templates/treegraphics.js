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
        this.ratio = window.devicePixelRatio;
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
        this.saved_height = review.offsetHeight/2;
        container.style.height = this.saved_height + "px";
        container.style.background = this.bgcolor;

        this.width = container.offsetWidth;

        this.canvases = new Map();

        this.new_canvas("background", 0);
        this.new_canvas("current", 10);
        this.new_canvas("lines", 20);
        this.new_canvas("preferred-lines", 30);
        this.new_canvas("stones", 40);
        this.new_canvas("preferred-stones", 50);

        this.grid = [];

        this.r = 12;
        this.step = this.r*3;
        this.x_offset = 2*this.r;
        this.y_offset = 2*this.r;

        this.resize();
        this.height = container.offsetHeight;
        this.draw_background();
    }

    new_buffer_canvas() {
        let canvas = new OffscreenCanvas(this.width*this.ratio, this.height*this.ratio);
        canvas.getContext("2d").scale(this.ratio, this.ratio);
        return canvas;
    }

    new_canvas(id, z_index) {
        if (this.canvases.has(id)) {
            return;
        }
        let canvas = document.createElement("canvas");


        canvas.width = this.width*this.ratio;
        canvas.height = this.height*this.ratio;

        canvas.style.position = "absolute";
        canvas.style.margin = "auto";
        canvas.style.display = "flex";
        canvas.style.width = this.width + "px";
        canvas.style.height = this.height + "px";
        canvas.style.zIndex = z_index;

        this.canvases.set(id, canvas);

        this.explorer.appendChild(canvas);
    }

    clear_canvas(id) {
        let canvas = this.canvases.get(id);
        if (canvas == null) {
            return;
        }
        let ctx = canvas.getContext("2d");
        ctx.clearRect(0, 0, canvas.width, canvas.height);
    }

    clear_all() {
        this.clear_canvas("background");
        this.clear_canvas("current");
        this.clear_canvas("lines");
        this.clear_canvas("preferred-lines");
        this.clear_canvas("stones");
        this.clear_canvas("preferred-stones");
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
        let canvas = this.canvases.get("background");
        let container_rect = this.container.getBoundingClientRect();
        let rect = canvas.getBoundingClientRect();

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

    /*
    clear() {
        let ctx = this.canvas.getContext("2d");
        ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    }
    */

    update(tree, change_preferred=false, change_stones=false) {
        // draw background
        this.draw_background();

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
            this.set_dims("background", width, height);
            this.set_dims("current", width, height);
            this.set_dims("lines", width, height);
            this.set_dims("preferred-lines", width, height);
            this.set_dims("stones", width, height);
            this.set_dims("preferred-stones", width, height);
        }
    }

    set_dims(id, width, height) {
        let canvas = this.canvases.get(id);
        canvas.width = width*this.ratio;
        canvas.height = height*this.ratio;

        canvas.style.width = width + "px";
        canvas.style.height = height + "px";
    }

    draw_background() {
        let canvas = this.canvases.get("background");
        let ctx = canvas.getContext("2d");
        ctx.beginPath();
        ctx.fillStyle = this.bgcolor;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.closePath();
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
        let buffer_canvas = this.new_buffer_canvas();
        let buffer_ctx = buffer_canvas.getContext("2d");
        let canvas = this.canvases.get("lines");
        let ctx = canvas.getContext("2d");

        for (let row of grid) {
            for (let cur of row) {
                if (cur == 0 || cur == 1) {
                    continue;
                }
                if (cur.up == null) {
                    continue;
                }
                this.draw_connecting_line(cur, loc, "#BBBBBB", buffer_ctx);
            }
        }
        ctx.drawImage(buffer_canvas, 0, 0);
    }

    draw_preferred_line(tree, loc) {
        let buffer_canvas = this.new_buffer_canvas();
        let buffer_ctx = buffer_canvas.getContext("2d");
        let canvas = this.canvases.get("preferred-lines");
        let ctx = canvas.getContext("2d");

        let start = tree.root;
        while (true) {
            if (start.down.length == 0) {
                break;
            }

            start = start.down[start.preferred_child];
            this.draw_connecting_line(start, loc, "#8d42eb", buffer_ctx);
        }
        ctx.drawImage(buffer_canvas, 0, 0);
    }

    draw_preferred_stones(tree, loc) {
        let buffer_canvas = this.new_buffer_canvas();
        let buffer_ctx = buffer_canvas.getContext("2d");
        let canvas = this.canvases.get("preferred-stones");
        let ctx = canvas.getContext("2d");

        let start = tree.root;
        while (true) {
            if (start.down.length == 0) {
                break;
            }
            start = start.down[start.preferred_child];
            this.draw_stone(start, loc, true, buffer_ctx);
        }
        ctx.drawImage(buffer_canvas, 0, 0);
    }

    draw_stone(cur, loc, preferred, ctx) {
        let [x,y] = loc.get(cur.index);
        let colors = cur.colors();
        let is_x = true;
        let hexColor = "#AA0000";
        if (colors.has(1) && colors.has(2)) {
            is_x = false;
        } else if (colors.has(2)) {
            is_x = false;
            hexColor = "#FFFFFF";
        } else if (colors.has(1)) {
            is_x = false;
            hexColor = "#000000";
        }
        if (!preferred) {
            hexColor += "44";
        }

        let [pos_x, pos_y] = this.get_xypos(x, y);

        if (is_x) {
            this.draw_x(pos_x, pos_y, this.r, hexColor, ctx);
        } else {
            this.draw_circle(pos_x, pos_y, this.r, hexColor, ctx, true);
            let text_color = "#FFFFFF";
            if (colors.has(2) && !colors.has(1)) {
                text_color = "#000000";
                // shadow
                //this.draw_shadow(pos_x, pos_y, this.r, ctx);

                // outline
                let outline_color = "#000000";
                if (!preferred) {
                    outline_color += "44";
                }
                this.draw_circle(pos_x, pos_y, this.r, outline_color, ctx, false, 1.5);
            }
            if (!preferred) {
                text_color += "44";
            }
            this.draw_text(cur.depth.toString(), pos_x, pos_y, text_color, ctx);
        }

    }

    draw_stones(tree, grid, loc) {
        let buffer_canvas = this.new_buffer_canvas();
        let buffer_ctx = buffer_canvas.getContext("2d");
        let canvas = this.canvases.get("stones");
        let ctx = canvas.getContext("2d");

        // get indexes of tree's preferred nodes
        let preferred = tree.preferred();

        for (let row of grid) {
            for (let cur of row) {
                if (cur == 0 || cur == 1) {
                    continue;
                }
                if (cur.index == 0) {
                    continue;
                }

                // draw stone
                this.draw_stone(cur, loc, false, buffer_ctx);
            }
        }
        ctx.drawImage(buffer_canvas, 0, 0);
    }

    draw_tree(tree, grid, loc, change_preferred, change_stones) {
        if (change_preferred) {
            this.clear_canvas("preferred-lines");
            this.clear_canvas("preferred-stones");
        }
        if (change_stones) {
            this.clear_all();
        }

        // draw "current" blue square
        let w = this.step/2;
        let [x,y] = loc.get(tree.current.index);
        let [pos_x, pos_y] = this.get_xypos(x,y);
        this.clear_canvas("current");

        let current_ctx = this.canvases.get("current").getContext("2d");
        let buffer_canvas = this.new_buffer_canvas();
        let buffer_ctx = buffer_canvas.getContext("2d");
        this.draw_square(pos_x-w, pos_y-w, 2*w, "#81d0eb", buffer_ctx, true);
        current_ctx.drawImage(buffer_canvas, 0, 0);
        let current_x = pos_x;
        let current_y = pos_y;

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

        // draw root
        let origin = this.get_xypos(0, 0);
        buffer_canvas = this.new_buffer_canvas();
        buffer_ctx = buffer_canvas.getContext("2d");
        let ctx = this.canvases.get("stones").getContext("2d");
        this.draw_root(origin[0], origin[1], w, buffer_ctx);
        ctx.drawImage(buffer_canvas, 0, 0);


        // draw stones
        // we only need to redraw stones if there are new ones to draw
        if (change_stones) {
            this.draw_stones(tree, grid, loc);
        }
        if (change_preferred) {
            this.draw_preferred_stones(tree, loc);
        }
        return [current_x, current_y];
    }

    draw_text(text, x, y, color, ctx) {
        let font_size = this.r;

        ctx.font = "bold " + font_size.toString() + "px Arial";
        ctx.fillStyle = color;
        ctx.lineWidth = 2;
        let x_offset = font_size/3;
        if (text.length == 2) {
            x_offset *= 1.6;
        } else if (text.length == 3) {
            x_offset *= 2.5;
        }
        let y_offset = font_size/3;

        ctx.fillText(text, x-x_offset, y+y_offset);
    }

    draw_connecting_line(cur, loc, color, ctx) {

        let [x,y] = loc.get(cur.index);
        let [pos_x, pos_y] = this.get_xypos(x,y);

        let par = cur.up;
        let [x1, y1] = loc.get(par.index);
        let [back_x, back_y] = this.get_xypos(x1, y1);

        if (y == y1) {
            this.draw_line(pos_x, pos_y, back_x, back_y, color, ctx);
        } else {
            let [mid_x, mid_y] = this.get_xypos(x-1, y-1);
            this.draw_line(pos_x, pos_y, mid_x, mid_y, color, ctx);
            this.draw_line(mid_x, mid_y, back_x, back_y, color, ctx);
        }
    }

    draw_line(x0, y0, x1, y1, hexColor, ctx) {
        ctx.beginPath();
        ctx.lineWidth = 2;
        ctx.strokeStyle = hexColor;
        ctx.moveTo(x0, y0);
        ctx.lineTo(x1, y1);
        ctx.stroke();
    }

    draw_x(x, y, r, hexColor, ctx) {
        let l = r/2;

        ctx.lineWidth = 3;
        ctx.strokeStyle = hexColor;

        ctx.beginPath();
        ctx.moveTo(x - l, y - l);
        ctx.lineTo(x + l, y + l);
        ctx.stroke();

        ctx.moveTo(x + l, y - l);
        ctx.lineTo(x - l, y + l);
        ctx.stroke();

    }

    // tree graphics
    draw_circle(x, y, r, hexColor, ctx, filled=true, stroke=3, theta_0=0, theta_1=2*Math.PI) {
        ctx.beginPath();
        if (filled) {
            ctx.strokeStyle = "#00000000";
        } else {
            ctx.lineWidth = stroke;
            ctx.strokeStyle = hexColor;
        }
        ctx.arc(x, y, r, theta_0, theta_1);
        if (filled) {
            ctx.fillStyle = hexColor;
            ctx.fill();
        }
        ctx.stroke();
    }

    draw_shadow(x, y, r, ctx) {
        this.draw_crescent(x, y, r, -Math.PI/4, 3*Math.PI/4, "#00000011", ctx);
    }

    draw_crescent(x, y, r, theta_0, theta_1, color, ctx) {
        let frac = 1/4;

        let center_theta = (theta_0 + theta_1)/2;
        let new_x = x - Math.cos(center_theta)*r*frac;
        let new_y = y - Math.sin(center_theta)*r*frac;
        ctx.beginPath();
        ctx.lineWidth = 1;
        ctx.strokeStyle = color;
        ctx.arc(x, y, r, theta_0, theta_1);
        ctx.arc(new_x, new_y, r, theta_1, theta_0, true);
        ctx.fillStyle = color;
        ctx.fill();
        ctx.stroke();
    }

    draw_square(x, y, w, hexColor, ctx, filled=true) {
        ctx.beginPath();
        ctx.fillStyle = hexColor;
        ctx.fillRect(x, y, w, w);
    }

    draw_root(x, y, w, ctx) {
        let r = w/3;

        // half black circle
        this.draw_circle(x, y, r, "#000000", ctx, true, 0, -Math.PI/2, Math.PI/2);

        // half white circle
        this.draw_circle(x, y, r, "#FFFFFF", ctx, true, 0, Math.PI/2, 3*Math.PI/2);

        this.draw_circle(x, y+r/2, r/2, "#000000", ctx, true, 0);
        this.draw_circle(x, y-r/2, r/2, "#FFFFFF", ctx, true, 0);
    }
}


