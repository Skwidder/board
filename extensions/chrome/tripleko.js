const observer = new MutationObserver(function(mutations) {
    let once = 0;
    mutations.forEach(function(mutation) {
        if (mutation.target.getAttribute("class") == "Goban") {
            if (once == 0) {
                once++;
                main();
            }
        }
    });
});

// Start observing the document
observer.observe(document.body, {
    childList: true,
    subtree: true
});

function main() {
    if (document.getElementById("tripleko") != null) {
        return;
    }
    let head = document.head;
    let link = document.createElement("link");
    link.setAttribute("rel", "stylesheet");
    link.setAttribute("href", "https://cdn.jsdelivr.net/npm/bootstrap-icons@1.11.3/font/bootstrap-icons.min.css");
    head.appendChild(link);
    
    let dock = document.getElementsByClassName("Dock")[0];
    if (dock == null) {
        return;
    }
    
    let tooltip_container = document.createElement("div");
    tooltip_container.setAttribute("class", "TooltipContainer");
    tooltip_container.id = "tripleko";
    
    let disabled = document.createElement("div");
    disabled.setAttribute("clasS", "Tooltip disabled");
    
    tooltip_container.appendChild(disabled);
    
    let p = document.createElement("p");
    p.setAttribute("class", "title");
    p.innerHTML = "Upload to Tripleko";
    
    let div = document.createElement("div");
    let anchor = document.createElement("a");
    anchor.href = "https://board.tripleko.com/upload?url=" + window.location.href;
    anchor.target = "_blank";
    
    let icon = document.createElement("i");
    icon.setAttribute("class", "bi bi-mask");
    
    anchor.innerHTML += "&nbsp;";
    anchor.appendChild(icon);
    anchor.innerHTML += "&nbsp;";
    anchor.innerHTML += "&nbsp;";
    anchor.innerHTML += "&nbsp;";
    anchor.innerHTML += "Upload to Tripleko";
    
    div.appendChild(anchor);
    tooltip_container.appendChild(div);
    
    dock.appendChild(tooltip_container);
}
