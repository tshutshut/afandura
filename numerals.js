/*
 * Book of Ixoria — Ixorian numerals.
 *
 * Draws Ixorian (base 64) numerals and their interactive tools. It is loaded
 * automatically by markdown.js when a page uses any of these in its Markdown:
 *
 *   {{64:100}}            the number 100 written inline in Ixorian digits
 *   {{numerals:builder}}  build a digit by adding or removing crossbars
 *   {{numerals:converter}} write any number in Ixorian digits
 *   {{numerals:table}}    the table of all sixty-four digits
 *
 * Each digit is an upright stroke with six crossbar positions, counted down
 * the left side, then down the right: 1, 2, 4 (left) and 8, 16, 32 (right).
 */
(function () {
    "use strict";

    var SLOTS = [
        { side: -1, y: 12, v: 1,  name: "Top left" },
        { side: -1, y: 50, v: 2,  name: "Middle left" },
        { side: -1, y: 88, v: 4,  name: "Bottom left" },
        { side:  1, y: 12, v: 8,  name: "Top right" },
        { side:  1, y: 50, v: 16, name: "Middle right" },
        { side:  1, y: 88, v: 32, name: "Bottom right" }
    ];
    var POWERS = { 1: "2⁰", 2: "2¹", 4: "2²", 8: "2³", 16: "2⁴", 32: "2⁵" };

    // The upright stroke, slightly flared at both ends like an engraved letter.
    var STEM = "M27.5,9 L36.5,9 L34.6,17 L34.6,83 L36.5,91 L27.5,91 L29.4,83 L29.4,17 Z";

    // A crossbar on the right of the stroke, ending in a bracketed wedge serif.
    // Crossbars on the left are the same shape, mirrored.
    function crossbar(slot, cls) {
        var y = slot.y, t = 1.7;
        var shape = '<rect class="' + cls + '" x="34" y="' + (y - t) + '" width="16" height="' + (2 * t) + '"/>' +
            '<path class="' + cls + '" d="M49,' + (y - t) + " Q52.6," + (y - t) + " 53.1," + (y - 5.6) +
            " L55.8," + (y - 5.6) + " L55.8," + (y + 5.6) + " L53.1," + (y + 5.6) +
            " Q52.6," + (y + t) + " 49," + (y + t) + ' Z"/>';
        return slot.side < 0 ? '<g transform="translate(64 0) scale(-1 1)">' + shape + "</g>" : shape;
    }

    // One digit (0 to 63) as an SVG string. With ghosts, absent crossbars are drawn faintly.
    function digit(value, ghosts) {
        var parts = ['<path class="ixn-ink" d="' + STEM + '"/>'];
        SLOTS.forEach(function (s) {
            var on = (value & s.v) !== 0;
            if (on || ghosts) parts.push(crossbar(s, on ? "ixn-ink" : "ixn-ghost"));
        });
        return '<svg class="ixn-digit" viewBox="0 0 64 100" aria-hidden="true">' + parts.join("") + "</svg>";
    }

    // The digits of a whole number, most significant first.
    function toDigits(n) {
        var digits = [];
        do { digits.unshift(n % 64); n = Math.floor(n / 64); } while (n > 0);
        return digits;
    }

    function format(n) { return n.toLocaleString("en-US"); }

    // ---- Inline numbers: {{64:100}} ----
    function hydrateInline(el) {
        var n = Number(el.dataset.value);
        if (!Number.isSafeInteger(n)) return;
        el.innerHTML = toDigits(n).map(function (d) { return digit(d, false); }).join("");
        el.setAttribute("role", "img");
        el.setAttribute("aria-label", format(n));
        el.title = format(n);
    }

    // ---- Builder ----
    var builders = [];
    function makeBuilder(box) {
        var state = { value: 5 };
        box.innerHTML =
            '<div class="ixn-builder-glyph"></div>' +
            '<div class="ixn-builder-side">' +
            '<p class="ixn-builder-value" aria-live="polite"></p>' +
            '<p class="ixn-builder-sum"></p></div>' +
            '<div class="ixn-toggles" role="group" aria-label="Crossbars"></div>';
        var glyphBox = box.querySelector(".ixn-builder-glyph");
        var valueEl = box.querySelector(".ixn-builder-value");
        var sumEl = box.querySelector(".ixn-builder-sum");
        var toggles = box.querySelector(".ixn-toggles");

        // Buttons laid out like the digit: left crossbars on the left, right ones on the right.
        [0, 3, 1, 4, 2, 5].forEach(function (i) {
            var s = SLOTS[i];
            var b = document.createElement("button");
            b.type = "button";
            b.dataset.v = s.v;
            b.innerHTML = "<span>" + s.name + '</span><span class="ixn-pow">' + s.v + "</span>";
            b.addEventListener("click", function () { set(state.value ^ s.v); });
            toggles.appendChild(b);
        });

        function render() {
            var v = state.value;
            var parts = ['<path class="ixn-ink" d="' + STEM + '"/>'];
            SLOTS.forEach(function (s) {
                var on = (v & s.v) !== 0;
                parts.push('<g class="ixn-slot" data-v="' + s.v + '">' + crossbar(s, on ? "ixn-ink" : "ixn-ghost") +
                    '<rect class="ixn-hit" x="' + (s.side > 0 ? 34 : 4) + '" y="' + (s.y - 11) + '" width="26" height="22"/></g>');
            });
            glyphBox.innerHTML = '<svg class="ixn-digit" viewBox="0 0 64 100" role="img" aria-label="Digit ' + v + '">' + parts.join("") + "</svg>";
            valueEl.textContent = v;
            var on = SLOTS.filter(function (s) { return v & s.v; }).map(function (s) { return s.v; });
            sumEl.textContent = on.length === 0 ? "The bare stroke" : (on.length === 1 ? on[0] + " = " + POWERS[on[0]] : on.join(" + "));
            toggles.querySelectorAll("button").forEach(function (b) {
                b.setAttribute("aria-pressed", String((v & Number(b.dataset.v)) !== 0));
            });
            document.querySelectorAll(".ixn-cell").forEach(function (c) {
                c.setAttribute("aria-current", String(Number(c.dataset.v) === v));
            });
        }
        function set(v) { state.value = v; render(); }

        glyphBox.addEventListener("click", function (e) {
            var slot = e.target.closest(".ixn-slot");
            if (slot) set(state.value ^ Number(slot.dataset.v));
        });
        render();
        var api = { set: set, element: box };
        builders.push(api);
        return api;
    }

    // ---- Converter ----
    var converterCount = 0;
    function makeConverter(box) {
        var id = "ixn-number-" + (++converterCount);
        box.innerHTML =
            '<div class="ixn-converter-input"><label for="' + id + '">Number</label>' +
            '<input id="' + id + '" type="text" inputmode="numeric" autocomplete="off" maxlength="15" value="100"></div>' +
            '<div class="ixn-converter-out" role="img"></div>' +
            '<p class="ixn-breakdown"></p>';
        var input = box.querySelector("input");
        var out = box.querySelector(".ixn-converter-out");
        var breakdown = box.querySelector(".ixn-breakdown");

        function render() {
            var raw = input.value.replace(/[^0-9]/g, "");
            if (raw !== input.value) input.value = raw;
            if (raw === "") {
                out.innerHTML = "";
                breakdown.textContent = "Enter a whole number to see it written in Ixorian digits.";
                return;
            }
            var n = Number(raw);
            if (!Number.isSafeInteger(n)) {
                out.innerHTML = "";
                breakdown.textContent = "This number is too large to show here. Try one with fewer digits.";
                return;
            }
            var digits = toDigits(n), places = digits.length;
            out.innerHTML = digits.map(function (d, i) {
                var weight = Math.pow(64, places - 1 - i);
                return '<div class="ixn-place">' + digit(d, false) + '<span class="ixn-place-label">' + d +
                    (places > 1 ? "<br>× " + format(weight) : "") + "</span></div>";
            }).join("");
            out.setAttribute("aria-label", format(n) + " in Ixorian digits: " + digits.join(", "));
            breakdown.textContent = places === 1 ? format(n) + " is written as a single digit." :
                format(n) + " = " + digits.map(function (d, i) {
                    var p = places - 1 - i;
                    return p === 0 ? String(d) : d + " × " + format(Math.pow(64, p));
                }).join(" + ");
        }
        input.addEventListener("input", render);
        render();
    }

    // ---- Table of the sixty-four digits ----
    function makeTable(box) {
        var html = "";
        for (var v = 0; v < 64; v++) {
            html += '<button type="button" class="ixn-cell" data-v="' + v + '" aria-label="Digit ' + v + '">' +
                digit(v, false) + '<span class="ixn-cell-value">' + v + "</span></button>";
        }
        box.innerHTML = html;
        box.addEventListener("click", function (e) {
            var cell = e.target.closest(".ixn-cell");
            if (!cell || !builders.length) return;
            builders[0].set(Number(cell.dataset.v));
            var reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
            builders[0].element.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "center" });
        });
    }

    function hydrate(root) {
        root = root || document;
        root.querySelectorAll(".ixn[data-value]").forEach(hydrateInline);
        root.querySelectorAll('[data-numerals="builder"]').forEach(makeBuilder);
        root.querySelectorAll('[data-numerals="converter"]').forEach(makeConverter);
        root.querySelectorAll('[data-numerals="table"]').forEach(makeTable);
        // Mark the builder's current digit in any table.
        if (builders.length) builders[0].set(Number(builders[0].element.querySelector(".ixn-builder-value").textContent));
    }

    window.IxoriaNumerals = { hydrate: hydrate, digit: digit, toDigits: toDigits };
})();
