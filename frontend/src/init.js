/*
Copyright (c) 2025 Jared Nishikawa

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
*/

import { State } from './state.js'
import { NetworkHandler } from './network_handler.js'
import * as config from './config.js';


function add_style() {
    document.body.style.background = "#F5F5F5";
    let style = document.createElement("style");
    style.type = "text/css";
    style.innerHTML = `
    .wide-button {display: block; width: 100%;}
    `;
    document.getElementsByTagName("head")[0].appendChild(style);
}

function init() {
    add_style();
    let host = window.location.hostname;
    let path = window.location.pathname;
    var network_handler;
    if (config.debug) {
        network_handler = new NetworkHandler(config.shared, "ws://" + host + ":" + config.port + path);
    } else {
        let url = "wss://" + host + "/socket" + path
        network_handler = new NetworkHandler(config.shared, url);
    }
    let state = new State();

    state.set_network_handler(network_handler);
    network_handler.set_state(state);
}


window.onload = function(e) {
    init();
}

