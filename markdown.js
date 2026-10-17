/*
 * Book of Ixoria — Markdown page loader.
 *
 * Every content page contains an element like
 *     <article id="content" data-source="page_name.md"></article>
 * This script fetches that Markdown file and renders it into the element,
 * so each page's text only ever needs to be edited in its .md file.
 * It also adds a menu of the other pages in the same section of the index.
 *
 * Supported Markdown:
 *   # to ###### headings          paragraphs (separated by blank lines)
 *   > quotes (may span paragraphs) - bulleted and 1. numbered lists
 *   | tables | with a header row | --- horizontal rules
 *   *italic*  **bold**             line breaks: end a line with \ or two spaces
 *   \* \| \\  escaped characters
 */
(function () {
    "use strict";

    function escapeHtml(text) {
        return text
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;");
    }

    // Inline formatting: escapes, line breaks, bold and italics.
    function inline(text) {
        const escapes = [];
        // Protect backslash-escaped characters (except a line-ending backslash).
        text = text.replace(/\\([\\`*_{}\[\]()#+\-.!|>])/g, function (_, ch) {
            escapes.push(ch);
            return "\u0000" + (escapes.length - 1) + "\u0000";
        });
        text = escapeHtml(text);
        // Hard line breaks: a line ending with a backslash or two spaces.
        text = text.replace(/(\\| {2,})\n/g, "<br>\n");
        text = text.replace(/\\$/, "");
        text = text.replace(/\n/g, " ");
        text = text.replace(/\*\*(?=\S)([\s\S]*?\S)\*\*/g, "<strong>$1</strong>");
        text = text.replace(/\*(?=\S)([\s\S]*?\S)\*/g, "<em>$1</em>");
        text = text.replace(/\u0000(\d+)\u0000/g, function (_, i) {
            return escapeHtml(escapes[Number(i)]);
        });
        return text.trim();
    }

    function splitRow(line) {
        line = line.trim().replace(/^\|/, "").replace(/\|$/, "");
        const cells = [];
        let current = "";
        for (let i = 0; i < line.length; i++) {
            if (line[i] === "\\" && line[i + 1] === "|") {
                current += "\\|";
                i++;
            } else if (line[i] === "|") {
                cells.push(current.trim());
                current = "";
            } else {
                current += line[i];
            }
        }
        cells.push(current.trim());
        return cells;
    }

    const patterns = {
        blank: /^\s*$/,
        heading: /^(#{1,6})\s+(.*?)\s*#*\s*$/,
        rule: /^\s*(-{3,}|\*{3,})\s*$/,
        quote: /^\s*>/,
        listItem: /^(\s*)([-*+]|\d+\.)\s+(.*)$/,
        tableSeparator: /^\s*\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)*\|?\s*$/
    };

    function isTableStart(lines, i) {
        return lines[i].trim().startsWith("|") &&
            i + 1 < lines.length && patterns.tableSeparator.test(lines[i + 1]);
    }

    function startsBlock(lines, i) {
        const line = lines[i];
        return patterns.blank.test(line) || patterns.heading.test(line) ||
            patterns.rule.test(line) || patterns.quote.test(line) ||
            patterns.listItem.test(line) || isTableStart(lines, i);
    }

    // Convert a block of Markdown text into HTML.
    function render(markdown) {
        const lines = markdown.replace(/\r\n?/g, "\n").split("\n");
        const html = [];
        let i = 0;

        while (i < lines.length) {
            const line = lines[i];
            let match;

            if (patterns.blank.test(line)) {
                i++;
            } else if ((match = line.match(patterns.heading))) {
                const level = match[1].length;
                html.push("<h" + level + ">" + inline(match[2]) + "</h" + level + ">");
                i++;
            } else if (patterns.rule.test(line)) {
                html.push("<hr>");
                i++;
            } else if (patterns.quote.test(line)) {
                const inner = [];
                while (i < lines.length && patterns.quote.test(lines[i])) {
                    inner.push(lines[i].replace(/^\s*>\s?/, ""));
                    i++;
                }
                html.push("<blockquote>" + render(inner.join("\n")) + "</blockquote>");
            } else if (isTableStart(lines, i)) {
                const header = splitRow(lines[i]);
                i += 2;
                let table = "<table><thead><tr>" + header.map(function (cell) {
                    return "<th>" + inline(cell) + "</th>";
                }).join("") + "</tr></thead><tbody>";
                while (i < lines.length && lines[i].trim().startsWith("|")) {
                    table += "<tr>" + splitRow(lines[i]).map(function (cell) {
                        return "<td>" + inline(cell) + "</td>";
                    }).join("") + "</tr>";
                    i++;
                }
                html.push(table + "</tbody></table>");
            } else if ((match = line.match(patterns.listItem))) {
                const ordered = /\d/.test(match[2]);
                const items = [];
                while (i < lines.length && (match = lines[i].match(patterns.listItem)) &&
                       /\d/.test(match[2]) === ordered) {
                    let text = match[3];
                    i++;
                    // Indented lines continue the current item.
                    while (i < lines.length && /^\s+\S/.test(lines[i]) &&
                           !patterns.listItem.test(lines[i])) {
                        text += "\n" + lines[i].trim();
                        i++;
                    }
                    items.push("<li>" + inline(text) + "</li>");
                }
                const tag = ordered ? "ol" : "ul";
                html.push("<" + tag + ">" + items.join("") + "</" + tag + ">");
            } else {
                const paragraph = [line];
                i++;
                while (i < lines.length && !startsBlock(lines, i)) {
                    paragraph.push(lines[i]);
                    i++;
                }
                html.push("<p>" + inline(paragraph.join("\n")) + "</p>");
            }
        }
        return html.join("\n");
    }

    // ---- Section menu -------------------------------------------------
    // Next to the Index link, each page gets a menu listing the other pages
    // of its section (Kindreds, Myths...). Sections and their pages are read
    // from index.html, so adding a page to the index adds it to the menu.

    const siteRoot = new URL(".", document.currentScript ? document.currentScript.src : location.href);

    function samePage(a, b) {
        const clean = function (path) { return decodeURIComponent(path).replace(/\/index\.html$/, "/"); };
        return clean(a.pathname) === clean(b.pathname);
    }

    function buildSectionMenu(nav, indexHtml) {
        const doc = new DOMParser().parseFromString(indexHtml, "text/html");
        const here = new URL(location.href);
        let current = null;
        for (const link of doc.querySelectorAll(".menu a[href]")) {
            if (samePage(new URL(link.getAttribute("href"), siteRoot), here)) { current = link; break; }
        }
        if (!current) return;

        // The section is the top-level entry of the index that contains this page.
        const section = current.closest(".menu-level-1 > li");
        const label = section && section.querySelector(":scope > .menu-label");
        if (!label) return;

        const menu = document.createElement("div");
        menu.className = "branch-menu";
        const toggle = document.createElement("button");
        toggle.type = "button";
        toggle.className = "contents-link branch-toggle";
        toggle.setAttribute("aria-expanded", "false");
        toggle.setAttribute("aria-controls", "section-options");
        toggle.textContent = label.textContent.trim() + " ▾";
        const list = document.createElement("ul");
        list.className = "branch-options";
        list.id = "section-options";
        list.hidden = true;

        for (const link of section.querySelectorAll(".menu a[href]")) {
            const url = new URL(link.getAttribute("href"), siteRoot);
            const item = document.createElement("li");
            const a = document.createElement("a");
            a.href = url.href;
            a.textContent = link.textContent.trim();
            if (samePage(url, here)) a.setAttribute("aria-current", "page");
            item.appendChild(a);
            list.appendChild(item);
        }

        function setOpen(open) {
            list.hidden = !open;
            toggle.setAttribute("aria-expanded", String(open));
        }
        toggle.addEventListener("click", function () { setOpen(list.hidden); });
        document.addEventListener("click", function (event) {
            if (!menu.contains(event.target)) setOpen(false);
        });
        document.addEventListener("keydown", function (event) {
            if (event.key === "Escape" && !list.hidden) { setOpen(false); toggle.focus(); }
        });

        menu.append(toggle, list);
        nav.classList.add("branch-navigation");
        nav.appendChild(menu);
    }

    function loadSectionMenu() {
        const nav = document.querySelector('nav[aria-label="Page navigation"]');
        if (!nav || nav.querySelector(".branch-menu")) return;
        fetch(new URL("index.html", siteRoot))
            .then(function (response) {
                if (!response.ok) throw new Error(response.status);
                return response.text();
            })
            .then(function (html) { buildSectionMenu(nav, html); })
            .catch(function () { /* the Index link still works without the menu */ });
    }

    function load() {
        loadSectionMenu();
        const target = document.getElementById("content");
        if (!target || !target.dataset.source) return;

        fetch(target.dataset.source)
            .then(function (response) {
                if (!response.ok) throw new Error(response.status);
                return response.text();
            })
            .then(function (markdown) {
                target.innerHTML = render(markdown);
            })
            .catch(function () {
                target.innerHTML = "<p>This page could not be loaded. Please try again later.</p>";
            });
    }

    window.IxoriaMarkdown = { render: render };

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", load);
    } else {
        load();
    }
})();
