/*
 * Book of Ixoria — the Ixorian script.
 *
 * Draws words in the Ixorian script and its interactive tools. It is loaded
 * automatically by markdown.js when a page uses any of these in its Markdown,
 * each on a line of its own:
 *
 *   {{script:strokes}}     the three spikes and the link
 *   {{script:writer}}      a box to write words, typed by sound
 *   {{script:consonants}}  the chart of the twenty-one consonants
 *   {{script:vowels}}      the vowel marks, shown on the carrier
 *
 * Every consonant is a chain of spikes: s (short, one line high), t (tall,
 * two lines high) and d (falling, one line below). A link, half a line high,
 * stands between consonants. Vowels are marks above or below the consonant
 * they follow; a silent carrier (a small loop) holds a word's opening vowel.
 */
(function () {
    "use strict";

    // ---- Proportions (one line height = 10 units; baseline at y = 0, up is negative) ----
    var LINE = 10;
    var HEIGHT = { t: 2 * LINE, s: LINE, k: LINE / 2 };   // tall spike, short spike, link
    var DEPTH = LINE;                                       // falling spike
    var SLANT = Math.tan(20 * Math.PI / 180);               // italic lean
    var FOOT = 1.6;                                         // curve at each spike's foot
    var PEN = 0.42;                                         // stroke width

    // ---- Letters ---------------------------------------------------------------------------
    var MAP = { _: "o", n: "s", l: "t", r: "d", t: "ss", d: "st", k: "sd", s: "ts", m: "tt", w: "td",
                g: "ds", y: "dt", h: "dd", p: "sss", b: "sst", f: "sts", v: "stt", th: "tss",
                dh: "tst", z: "tts", sh: "ttt", j: "ssd" };
    var SOUNDS = [
        ["b", "B", "base"], ["d", "D", "data"], ["f", "F", "fire"], ["g", "G", "game"], ["h", "H", "hat"],
        ["j", "J", "jam"], ["k", "K", "case"], ["l", "L", "long"], ["m", "M", "moon"], ["n", "N", "news"],
        ["p", "P", "potato"], ["r", "R", "rock"], ["s", "S", "seed"], ["t", "T", "tea"], ["v", "V", "vessel"],
        ["w", "W", "water"], ["y", "Y", "yeast"], ["z", "Z", "zebra"], ["sh", "SH", "ship"],
        ["dh", "TH", "that"], ["th", "TH", "thought"]
    ];
    var VOWELS = [
        ["a", "A", "bat, laugh, far"], ["e", "E", "fair, medical, sit"], ["ii", "Long I", "hear, beat, sleep"],
        ["o", "Short O", "hot, bro"], ["oo", "Long O", "door, moon"], ["u", "U", "as in French tu"]
    ];
    var EXAMPLES = [["noon", "noon"], ["moon", "moon"], ["seed", "siid"], ["shop", "shop"],
                    ["the moon is back", "dhe moon ez bak"], ["check", "tshek"], ["thought", "thoot"],
                    ["at", "at"], ["Ixoria", "eksooreya"]];

    var state = { rules: true, links: "accent" };
    try {
        if (localStorage.getItem("ixs-rules") === "off") state.rules = false;
        if (localStorage.getItem("ixs-links") === "plain") state.links = "plain";
    } catch (e) {}
    var redraws = [];

    // ---- Reading typed sound codes --------------------------------------------------------
    var CONS = ["sh", "th", "dh", "b", "d", "f", "g", "h", "j", "k", "l", "m", "n", "p", "r", "s", "t", "v", "w", "y", "z"];
    var VOWS = ["ii", "oo", "a", "e", "o", "u"];
    function parse(text) {
        var words = [], unknown = [];
        text.toLowerCase().split(/\s+/).filter(Boolean).forEach(function (raw) {
            var units = [], i = 0;
            while (i < raw.length) {
                var rest = raw.slice(i), found = null, type = null, n;
                for (n = 0; n < CONS.length && !found; n++) if (rest.indexOf(CONS[n]) === 0) { found = CONS[n]; type = "c"; }
                for (n = 0; n < VOWS.length && !found; n++) if (rest.indexOf(VOWS[n]) === 0) { found = VOWS[n]; type = "v"; }
                if (!found && rest[0] === "i") { found = "i"; type = "v"; }   // a lone i is read as E (sit)
                if (!found) { if (unknown.indexOf(rest[0]) < 0) unknown.push(rest[0]); i++; continue; }
                if (type === "c") units.push({ c: found, v: null });
                else {
                    var v = found === "i" ? "e" : found, last = units[units.length - 1];
                    if (!last || last.v) units.push({ c: "_", v: v });   // the carrier holds an opening or second vowel
                    else last.v = v;
                }
                i += found.length;
            }
            if (units.length) words.push(units);
        });
        return { words: words, unknown: unknown };
    }

    // ---- The pen ------------------------------------------------------------------------------
    // Each spike has a tip and a kind. Words are drawn upright, then leaned into italics.
    function layout(units) {
        var spikes = [], letters = [], x = 0, prev = null;
        function add(kind, isLink) {
            var up = kind !== "d", h = kind === "d" ? DEPTH : HEIGHT[kind];
            if (prev) {
                if (prev.up && up) x += 2.4 + 0.15 * h;      // the rise is a long diagonal, wider for taller spikes
                else if (prev.up && !up) x += 0.8;
                else if (!prev.up && up) x += 2.8 + 0.12 * h;
                else x += 4;
            }
            var s = { up: up, x: x, y: up ? -h : DEPTH, link: !!isLink };
            spikes.push(s); prev = s;
            return s;
        }
        units.forEach(function (u, i) {
            if (i > 0) add("k", true);
            var first = spikes.length;
            MAP[u.c].split("").forEach(function (k) { add(k === "o" ? "s" : k).loop = k === "o"; });
            letters.push({ unit: u, spikes: spikes.slice(first) });
        });
        return { spikes: spikes, letters: letters };
    }

    function f(n) { return n.toFixed(2); }

    // The pen's path, split so that links can be highlighted.
    function penPath(spikes) {
        var segs = [], d = "", cur = null;
        function move(x, y) { d += "M" + f(x) + "," + f(y); cur = [x, y]; }
        function line(x, y) { d += "L" + f(x) + "," + f(y); cur = [x, y]; }
        function curve(cx, cy, x, y) { d += "Q" + f(cx) + "," + f(cy) + " " + f(x) + "," + f(y); cur = [x, y]; }
        function flush(isLink) { if (d) segs.push({ d: d, link: isLink }); d = ""; if (cur) move(cur[0], cur[1]); }

        var first = spikes[0];
        move(first.x - (first.up ? 3.2 + 0.1 * -first.y : 1.5), first.up ? 0.6 : -1.2);   // lead-in
        spikes.forEach(function (s, i) {
            var next = spikes[i + 1];
            if (s.loop) {
                // The carrier: a small loop one line high.
                line(s.x + 0.6, -LINE * 0.62);
                d += "C" + f(s.x + 3) + "," + f(-LINE * 1.08) + " " + f(s.x - 1.8) + "," + f(-LINE * 1.12) + " " + f(s.x - 0.4) + "," + f(-LINE * 0.55);
                cur = [s.x - 0.4, -LINE * 0.55];
            } else {
                line(s.x, s.y);
            }
            if (!next) {
                if (s.up) { line(s.x, -FOOT); curve(s.x, 0.15, s.x + FOOT, 0); curve(s.x + FOOT + 1.4, -0.1, s.x + FOOT + 2.4, -1.2); }
                else line(s.x + 2.4, -0.8);
                return;
            }
            if (s.up && next.up) {
                line(s.x, -FOOT);
                curve(s.x, 0.15, s.x + FOOT * 0.9, -FOOT * 0.25);
                if (next.link || s.link) flush(s.link);
            } else if (!s.up && !next.up) {
                var mx = (s.x + next.x) / 2;
                line(mx - FOOT * 0.6, FOOT * 0.4);
                curve(mx, -0.2, mx + FOOT * 0.6, FOOT * 0.4);
            } else if (s.link || next.link) {
                flush(s.link);
            }
        });
        flush(spikes[spikes.length - 1].link);
        return segs;
    }

    // ---- Vowel marks ---------------------------------------------------------------------------
    function tick(cx, cy) { return '<path class="ixs-mark" stroke-width="0.5" d="M' + f(cx - 0.9) + "," + f(cy + 1.4) + " L" + f(cx + 0.9) + "," + f(cy - 1.4) + '"/>'; }
    function comma(cx, cy) {
        return '<path class="ixs-mark" stroke-width="0.5" d="M' + f(cx + 0.7) + "," + f(cy - 1.6) +
            " a0.75,0.75 0 1 0 0.01,0 Q" + f(cx + 1.6) + "," + f(cy - 0.4) + " " + f(cx - 0.2) + "," + f(cy + 1.6) + '"/>';
    }
    function ring(cx, cy) { return '<circle class="ixs-mark" stroke-width="0.5" cx="' + f(cx) + '" cy="' + f(cy) + '" r="1.1"/>'; }
    function vowelMark(v, cx, top, bottom) {
        switch (v) {
            case "a": return tick(cx, top - 3.4);
            case "e": return tick(cx, bottom + 3.4);
            case "ii": return tick(cx - 1.3, bottom + 3.4) + tick(cx + 1.3, bottom + 3.4);
            case "o": return comma(cx, top - 3.6);
            case "oo": return comma(cx - 1.3, top - 3.6) + comma(cx + 1.3, top - 3.6);
            case "u": return ring(cx, top - 3.4);
        }
        return "";
    }

    // ---- Drawing a word ------------------------------------------------------------------------
    function draw(units, label) {
        var lay = layout(units), segs = penPath(lay.spikes), marks = "";
        lay.letters.forEach(function (L) {
            if (!L.unit.v) return;
            var xs = L.spikes.map(function (s) { return s.x; }), ys = L.spikes.map(function (s) { return s.y; });
            var cx = (Math.min.apply(null, xs) + Math.max.apply(null, xs)) / 2;
            marks += vowelMark(L.unit.v, cx, Math.min(-LINE, Math.min.apply(null, ys)), Math.max(0, Math.max.apply(null, ys)));
        });
        var xs = lay.spikes.map(function (s) { return s.x; });
        var x0 = Math.min.apply(null, xs) - 6, x1 = Math.max.apply(null, xs) + 6;
        var yTop = -2 * LINE - 7, yBot = LINE + 5;
        var vx = x0 - SLANT * LINE - 1, vw = (x1 - x0) + SLANT * 3 * LINE + 2;
        var ruled = "";
        if (state.rules) {
            [-2 * LINE, -LINE, 0, LINE].forEach(function (y) {
                ruled += '<line class="ixs-ruled" stroke-width="' + (y === 0 ? 0.3 : 0.18) + '" x1="' + f(vx) + '" x2="' + f(vx + vw) + '" y1="' + y + '" y2="' + y + '"/>';
            });
        }
        var ink = segs.map(function (s) {
            return '<path class="ixs-pen' + (s.link && state.links === "accent" ? " ixs-link" : "") + '" stroke-width="' + PEN + '" d="' + s.d + '"/>';
        }).join("");
        return '<svg class="ixs-word-svg" viewBox="' + f(vx) + " " + yTop + " " + f(vw) + " " + (yBot - yTop) + '"' +
            (label ? ' role="img" aria-label="' + label + '"' : ' aria-hidden="true"') + ">" + ruled +
            '<g transform="matrix(1 0 ' + f(-SLANT) + ' 1 0 0)">' + ink + marks + "</g></svg>";
    }

    function tile(units, name, ex, label) {
        return '<div class="ixs-tile">' + draw(units, label) + '<span class="ixs-name">' + name + '</span><span class="ixs-ex">' + ex + "</span></div>";
    }

    // ---- Tools ----------------------------------------------------------------------------------
    function strokes(box) {
        function render() {
            box.innerHTML = '<div class="ixs-tiles">' +
                tile([{ c: "l", v: null }], "Tall spike", "two lines high") +
                tile([{ c: "n", v: null }], "Short spike", "one line high") +
                tile([{ c: "r", v: null }], "Falling spike", "one line below") +
                tile([{ c: "n", v: null }, { c: "n", v: null }], "The link", "half a line, between letters") + "</div>";
        }
        render(); redraws.push(render);
    }

    function vowels(box) {
        function render() {
            box.innerHTML = '<div class="ixs-tiles">' + VOWELS.map(function (v) {
                return tile([{ c: "_", v: v[0] }], v[1], v[2]);
            }).join("") + "</div>";
        }
        render(); redraws.push(render);
    }

    function consonants(box) {
        function render() {
            box.innerHTML = '<div class="ixs-chart">' + SOUNDS.map(function (s) {
                return tile([{ c: s[0], v: null }], s[1], s[2], s[1]);
            }).join("") + "</div>";
        }
        render(); redraws.push(render);
    }

    var writers = 0;
    function writer(box) {
        var id = "ixs-text-" + (++writers);
        box.innerHTML =
            '<div class="ixs-writer"><label for="' + id + '">Type Ixorian by sound</label>' +
            '<input id="' + id + '" type="text" autocomplete="off" spellcheck="false" value="noon moon siid shop">' +
            '<p class="ixs-codes">Consonants: <code>b d f g h j k l m n p r s t v w y z</code>, <code>sh</code> (ship), ' +
            '<code>th</code> (thought), <code>dh</code> (that). Vowels: <code>a</code> (bat), <code>e</code> (fair, sit), ' +
            '<code>ii</code> (sleep), <code>o</code> (hot), <code>oo</code> (door, moon), <code>u</code> (French tu). ' +
            'CH is written <code>tsh</code>.</p>' +
            '<p class="ixs-warning" aria-live="polite"></p>' +
            '<div class="ixs-buttons" role="group" aria-label="Examples"></div>' +
            '<div class="ixs-buttons" role="group" aria-label="Display">' +
            '<span class="ixs-soft">Ruled lines</span><button type="button" data-rules="on">Show</button><button type="button" data-rules="off">Hide</button>' +
            '<span class="ixs-soft ixs-gap">Links</span><button type="button" data-links="accent">Highlight</button><button type="button" data-links="plain">Plain</button></div>' +
            '</div><div class="ixs-rendering" aria-live="polite"></div>';
        var input = box.querySelector("input"), warning = box.querySelector(".ixs-warning");
        var out = box.querySelector(".ixs-rendering"), examples = box.querySelectorAll(".ixs-buttons")[0];
        EXAMPLES.forEach(function (ex) {
            var b = document.createElement("button");
            b.type = "button"; b.textContent = ex[0]; b.title = ex[1];
            b.addEventListener("click", function () { input.value = ex[1]; render(); });
            examples.appendChild(b);
        });
        function render() {
            var parsed = parse(input.value);
            warning.textContent = parsed.unknown.length ?
                "Not part of Ixorian: " + parsed.unknown.join(", ") + ". Use the codes above (CH is tsh, C is k or s)." : "";
            out.innerHTML = parsed.words.length ? '<div class="ixs-line">' + parsed.words.map(function (w) {
                var code = w.map(function (u) { return (u.c === "_" ? "" : u.c) + (u.v || ""); }).join("");
                return '<div class="ixs-word">' + draw(w, code) + '<span class="ixs-code">' + code + "</span></div>";
            }).join("") + "</div>" : '<p class="ixs-soft">Type a word above to see it written.</p>';
            box.querySelectorAll("[data-rules]").forEach(function (b) { b.setAttribute("aria-pressed", String((b.dataset.rules === "on") === state.rules)); });
            box.querySelectorAll("[data-links]").forEach(function (b) { b.setAttribute("aria-pressed", String(b.dataset.links === state.links)); });
        }
        input.addEventListener("input", render);
        box.querySelectorAll("[data-rules]").forEach(function (b) {
            b.addEventListener("click", function () { state.rules = b.dataset.rules === "on"; save(); redrawAll(); });
        });
        box.querySelectorAll("[data-links]").forEach(function (b) {
            b.addEventListener("click", function () { state.links = b.dataset.links; save(); redrawAll(); });
        });
        render(); redraws.push(render);
    }

    function save() {
        try { localStorage.setItem("ixs-rules", state.rules ? "on" : "off"); localStorage.setItem("ixs-links", state.links); } catch (e) {}
    }
    function redrawAll() { redraws.forEach(function (r) { r(); }); }

    var TOOLS = { strokes: strokes, vowels: vowels, consonants: consonants, writer: writer };
    function hydrate(root) {
        (root || document).querySelectorAll("[data-script]").forEach(function (box) {
            var tool = TOOLS[box.dataset.script];
            if (tool && !box.dataset.ready) { box.dataset.ready = "1"; tool(box); }
        });
    }

    window.IxorianScript = { hydrate: hydrate, draw: draw, parse: parse };
})();
