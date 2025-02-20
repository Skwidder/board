/*
Copyright (c) 2025 Jared Nishikawa

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
*/

export {
    Coord,
    opposite,
    ObjectSet,
    Result,
    letters2coord,
    new_icon_button,
    add_tooltip,
    get_viewport,
}

class Coord {
    constructor(x, y) {
        this.x = x;
        this.y = y;
    }

    to_letters() {
        let alphabet = "abcdefghijklmnopqrs";
        return alphabet[this.x] + alphabet[this.y];
    }

    is_equal(other) {
        return this.x == other.x && this.y == other.y;
    }
}

function opposite(color) {
    if (color == 1) {
        return 2;
    }
    return 1;
}

function letters2coord(s) {
    if (s == null || s.length != 2) {
        return null;
    }
    let a = s[0].toLowerCase();
    let b = s[1].toLowerCase();
    let x = a.charCodeAt(0) - 97;
    let y = b.charCodeAt(0) - 97;
    return new Coord(x,y);
}

class ObjectSet extends Set{
    add(elem) {
        return super.add(typeof elem === 'object' ? JSON.stringify(elem) : elem);
    }
    has(elem) {
        return super.has(typeof elem === 'object' ? JSON.stringify(elem) : elem);
    }
}

class Result {
    constructor(ok, values) {
        this.ok = ok;
        this.values = values;
    }
}

function new_icon_button(cls, handler) {
    let button = document.createElement("button");
    button.setAttribute("class", "btn btn-light wide-button");
    button.onclick = handler;
    let obj = document.createElement("i");
    obj.setAttribute("class", cls);
    button.appendChild(obj);
    return button;
}

function add_tooltip(element, title, show=500, hide=0) {
    if (is_touch_device()) {
        return;
    }
    let delay = {"show": show, "hide": hide};
    element.setAttribute("data-bs-toggle", "tooltip");
    element.setAttribute("data-bs-placement", "bottom");
    element.setAttribute("data-bs-trigger", "hover");
    element.setAttribute("data-bs-delay", JSON.stringify(delay));
    element.setAttribute("data-bs-title", title);
}

function is_touch_device() {
    return "ontouchstart" in window || window.DocumentTouch && document instanceof DocumentTouch;
}


function get_viewport () {
  // https://stackoverflow.com/a/8876069
  const width = Math.max(
      document.documentElement.clientWidth,
      window.innerWidth || 0);
  if (width <= 576) return 'xs';
  if (width <= 768) return 'sm';
  if (width <= 992) return 'md';
  if (width <= 1200) return 'lg';
  if (width <= 1400) return 'xl';
  return 'xxl';
}


