/*
 * Book of Ixoria — Character Sheet.
 *
 * Runs coreMechanics/ixoria_cm_character_sheet_v1_0.html. Everything is
 * calculated from the rules in Character Design and Casting Spells:
 * race and class modifiers, Lingering Blood, attribute modifiers, Hit Points,
 * Natural AC, Affinity Points, Proficiency progression and casting difficulty.
 *
 * Known spells are offered from the Grimoire pages (grimoire/*.html): each
 * page's `const spells=[...]` list is read for spell names and tiers, so a
 * spell added to the Grimoire appears here without changing this file.
 *
 * There is no server: a sheet is saved as a JSON file on the player's device
 * ("Save sheet") and opened again with "Load sheet".
 */
(function () {
    "use strict";

    // ---- Rules (Character Design 1.4, Casting Spells 1.2) ----------------
    // Race modifiers in attribute order STR, AGI, END, PER, INT, CHA:
    // ++ = 4, + = 2, = = 0, − = −2, −− = −4.
    const RACES = [
        { k: "human", n: "Human", m: [0, 0, 0, 0, 0, 0], ac: 5 },
        { k: "eren", n: "Eren — Elf", m: [-2, 2, -2, 4, 2, 0], ac: 5 },
        { k: "amdir", n: "Amdir — Dwarf", m: [2, -2, 4, 0, 0, -2], ac: 6 },
        { k: "halfling", n: "Halfling", m: [-4, 4, -2, 2, 0, 2], ac: 5 },
        { k: "keel", n: "Keel — Gnome", m: [-4, 2, -2, 0, 4, 0], ac: 5 },
        { k: "halfelf", n: "Half-Elf", m: [0, 0, 0, 2, 0, 2], ac: 5 },
        { k: "halforc", n: "Half-Orc", m: [4, 0, 2, -2, -2, -4], ac: 6 },
        { k: "aevra", n: "Aevra — Dragonborn", m: [2, -2, 2, 0, 0, 2], ac: 6 },
        { k: "ilie", n: "Ilie — Tiefling", m: [-2, 0, 0, 2, 2, 4], ac: 5 },
        { k: "wolf", n: "Wolf Beastkin", m: [0, 2, 2, 4, -2, 0], ac: 5 },
        { k: "dog", n: "Dog Beastkin", m: [0, 0, 2, 2, -2, 4], ac: 5 },
        { k: "cat", n: "Cat Beastkin", m: [-2, 4, -2, 2, 0, 0], ac: 5 },
        { k: "lion", n: "Lion Beastkin", m: [4, 0, 2, 0, -2, 2], ac: 6 },
        { k: "suli", n: "Suli — Fox Folk", m: [-2, 2, -2, 2, 4, 0], ac: 5 },
        { k: "borru", n: "Borru — Bear Folk", m: [2, -4, 4, 2, -4, 0], ac: 7 },
        { k: "oshi", n: "Oshi — Owl Folk", m: [-2, 2, -2, 4, 2, 0], ac: 5 },
        { k: "nyr", n: "Nyr — Raven Folk", m: [-2, 2, -2, 2, 4, 0], ac: 5 },
        { k: "keluma", n: "Keluma — Frog Folk", m: [-4, 4, 0, 2, 2, -2], ac: 5 },
        { k: "sketh", n: "Sketh — Lizard Folk", m: [0, 2, 4, 0, -2, -2], ac: 6 },
        { k: "vishani", n: "Vishani — Monkey Folk", m: [-2, 4, -2, 0, 2, 2], ac: 5 }
    ];
    // Class: attribute index for +2, +1 and −1, and the HP Bonus.
    const CLASSES = [
        { k: "Barbarian", p2: 0, p1: 2, m1: 5, hp: 3 },
        { k: "Bard", p2: 5, p1: 3, m1: 0, hp: 0 },
        { k: "Devout", p2: 3, p1: 5, m1: 0, hp: 1 },
        { k: "Druid", p2: 3, p1: 2, m1: 5, hp: 1 },
        { k: "Fighter", p2: 0, p1: 1, m1: 3, hp: 2 },
        { k: "Vindicator", p2: 0, p1: 5, m1: 3, hp: 2 },
        { k: "Adventurer", p2: 2, p1: 3, m1: 5, hp: 2 },
        { k: "Rogue", p2: 1, p1: 4, m1: 2, hp: 1 },
        { k: "Mage", p2: 4, p1: 3, m1: 0, hp: 0, magic: true },
        { k: "Warlock", p2: 5, p1: 2, m1: 3, hp: 0, magic: true }
    ];
    const ATTRS = ["STR", "AGI", "END", "PER", "INT", "CHA"];
    const ALIGNMENTS = ["Lawful Good", "Neutral Good", "Chaotic Good", "Lawful Neutral", "True Neutral", "Chaotic Neutral", "Lawful Evil", "Neutral Evil", "Chaotic Evil"];
    const SOCIAL = ["Down and Out", "Street Urchin", "Wanderer", "Commoner", "Well-Off", "Privileged", "Noble"];
    const BRANCHES = ["Form", "Force", "Space", "Manifestation", "Perception", "Connection", "Vitality"];
    const LEVELS = ["Novice", "Apprentice", "Practiced", "Expert", "Master"];
    // Meaningful successful casts needed to advance, by Affinity Rank (rows)
    // and current Proficiency (columns: Novice→Apprentice … Expert→Master).
    const NEED = [[12, 24, 36, 48], [11, 22, 32, 43], [10, 19, 29, 38], [8, 17, 25, 34], [7, 14, 22, 29]];
    // Casting Difficulty by spell tier (rows) and Proficiency (columns).
    const DIFF = [
        ["Easy", "Easy", "Automatic", "Automatic", "Automatic"],
        ["Moderate", "Easy", "Easy", "Automatic", "Automatic"],
        ["Hard", "Moderate", "Easy", "Easy", "Automatic"],
        ["Very Hard", "Hard", "Moderate", "Easy", "Easy"],
        ["Nearly Impossible", "Very Hard", "Hard", "Moderate", "Easy"]
    ];
    const ROLL = { "Automatic": "no roll", "Easy": "d20 ≥ 6", "Moderate": "d20 ≥ 10", "Hard": "d20 ≥ 14", "Very Hard": "d20 ≥ 17", "Nearly Impossible": "natural 20" };
    const ROMAN = ["", "I", "II", "III", "IV", "V"];
    const COINS = [["c", "Copper", "var(--accent)"], ["s", "Silver", "var(--ink)"], ["g", "Gold", "var(--cs-gold)"]];
    const SAVE_FORMAT = "ixoria-character-sheet";
    const SAVE_KEYS = ["name", "player", "age", "race", "cls", "align", "social", "transformed", "birth", "blood", "armor", "hpLost", "level", "aff", "prog", "spells", "items", "coins", "look", "story", "notes"];

    // Spells read from the Grimoire pages: { Form: [{ n, t }], … }
    const grimoire = {};

    function blankState() {
        const aff = {};
        const prog = {};
        BRANCHES.forEach(function (b) { aff[b] = 0; prog[b] = { lvl: -1, casts: 0 }; });
        return {
            name: "", player: "", age: "", race: "", cls: "", align: "", social: "",
            transformed: false, birth: "human", blood: "lingering",
            armor: "", hpLost: 0, level: 1,
            aff: aff, prog: prog, spells: [], items: [], coins: { c: 0, s: 0, g: 0 },
            look: "", story: "", notes: ""
        };
    }

    let state = blankState();
    let dirty = false;

    // ---- Helpers ------------------------------------------------------------
    const $ = function (id) { return document.getElementById(id); };
    function signed(n) { return n > 0 ? "+" + n : (n < 0 ? "−" + Math.abs(n) : "0"); }
    function race(k) { return RACES.find(function (r) { return r.k === k; }) || null; }
    function cls(k) { return CLASSES.find(function (c) { return c.k === k; }) || null; }
    function el(tag, props, children) {
        const node = document.createElement(tag);
        Object.keys(props || {}).forEach(function (key) {
            if (key === "text") node.textContent = props[key];
            else if (key === "className") node.className = props[key];
            else if (key === "style") node.style.cssText = props[key];
            else if (key === "dataset") Object.assign(node.dataset, props[key]);
            else node.setAttribute(key, props[key]);
        });
        (children || []).forEach(function (child) { if (child) node.appendChild(child); });
        return node;
    }
    function button(label, action, extra) {
        const props = Object.assign({ type: "button", className: "cs-btn", text: label, dataset: { action: action } }, extra || {});
        if (extra && extra.dataset) props.dataset = Object.assign({ action: action }, extra.dataset);
        return el("button", props);
    }
    function fillSelect(select, options, placeholder) {
        select.innerHTML = "";
        if (placeholder) select.appendChild(el("option", { value: "", text: placeholder }));
        options.forEach(function (o) { select.appendChild(el("option", { value: o.v, text: o.label })); });
    }
    function change(updates) {
        Object.assign(state, updates);
        dirty = true;
        render();
    }

    // ---- Derived values -------------------------------------------------------
    function derive() {
        const r = race(state.race);
        let mods = r ? r.m.slice() : [0, 0, 0, 0, 0, 0];
        let ac = r ? r.ac : null;
        const lingering = !!(r && r.k === "ilie" && state.transformed && state.blood === "lingering");
        if (lingering) {
            const birth = race(state.birth) || RACES[0];
            // Lingering Blood: average with the birth race, rounding towards the Ilie value.
            mods = mods.map(function (ilie, i) {
                let v = (ilie + birth.m[i]) / 2;
                if (v % 2 !== 0) v = ilie > v ? v + 1 : v - 1;
                return v;
            });
            let avg = (r.ac + birth.ac) / 2;
            if (avg % 1 !== 0) avg = avg > r.ac ? Math.floor(avg) : Math.ceil(avg);
            ac = avg;
        }
        const c = cls(state.cls);
        const bonus = [0, 0, 0, 0, 0, 0];
        if (c) { bonus[c.p2] += 2; bonus[c.p1] += 1; bonus[c.m1] -= 1; }
        const scores = mods.map(function (m, i) { return 10 + m + bonus[i]; });
        const modifiers = scores.map(function (s) { return Math.floor((s - 10) / 2); });
        const hpMax = 10 + modifiers[2] + (c ? c.hp : 0);
        return { r: r, c: c, scores: scores, modifiers: modifiers, ac: ac, hpMax: hpMax, lingering: lingering, magic: !!(c && c.magic) };
    }

    // ---- Rendering ------------------------------------------------------------
    function render() {
        const d = derive();

        // Header
        $("cs-level").textContent = state.level;
        const birth = race(state.birth);
        $("cs-summary").textContent = [
            d.r ? d.r.n + (d.lingering && birth ? " (Lingering Blood, born " + birth.n + ")" : "") : "",
            d.c ? d.c.k : "", state.align, state.social
        ].filter(Boolean).join(" · ");

        // Hit Points and Armor Class
        state.hpLost = Math.max(0, Math.min(state.hpLost, d.hpMax));
        const hpNow = d.hpMax - state.hpLost;
        $("cs-hp-now").textContent = hpNow;
        $("cs-hp-max").textContent = d.hpMax;
        $("cs-hp-bar").style.width = (d.hpMax > 0 ? Math.round(hpNow / d.hpMax * 100) : 0) + "%";
        const armor = parseInt(state.armor, 10);
        if (!isNaN(armor)) { $("cs-ac").textContent = armor; $("cs-ac-source").textContent = "armor"; }
        else { $("cs-ac").textContent = d.ac === null ? "—" : d.ac; $("cs-ac-source").textContent = d.ac === null ? "choose a race" : "natural"; }

        // Lingering Blood
        const isIlie = !!(d.r && d.r.k === "ilie");
        $("cs-ilie").hidden = !isIlie;
        $("cs-transformed").checked = !!state.transformed;
        $("cs-ilie-options").hidden = !state.transformed;
        $("cs-blood-full").setAttribute("aria-pressed", String(state.blood === "full"));
        $("cs-blood-ling").setAttribute("aria-pressed", String(state.blood === "lingering"));
        $("cs-blood-note").textContent = state.blood === "lingering"
            ? "Each modifier and the Natural AC are averaged with the birth race, rounded towards the Ilie value."
            : "The birth race leaves no trace: Ilie modifiers and Natural AC apply.";

        // Attributes
        const attrs = $("cs-attrs");
        attrs.innerHTML = "";
        ATTRS.forEach(function (a, i) {
            attrs.appendChild(el("div", { className: "cs-attr" }, [
                el("span", { className: "cs-key", text: a }),
                el("span", { className: "cs-attr-score", text: String(d.scores[i]) }),
                el("span", { className: "cs-attr-mod", text: signed(d.modifiers[i]) })
            ]));
        });
        $("cs-no-magic").hidden = d.magic;
        $("cs-magic").hidden = !d.magic;

        if (d.magic) { renderBranches(); renderSpells(); renderLearn(); }
        renderItems();
        renderCoins();
    }

    function renderBranches() {
        let spent = 0;
        BRANCHES.forEach(function (b) { spent += state.aff[b] || 0; });
        const left = 4 - spent;
        $("cs-points").textContent = left > 0 ? left + " Affinity Point" + (left === 1 ? "" : "s") + " to distribute" : "";

        const list = $("cs-branches");
        list.innerHTML = "";
        BRANCHES.forEach(function (b) {
            const rank = state.aff[b] || 0;
            const p = state.prog[b];
            const pips = el("span", { className: "cs-inline", "aria-label": "Affinity Rank " + rank, style: "gap: 3px" });
            for (let i = 0; i < 4; i++) pips.appendChild(el("span", { className: "cs-pip" + (i < rank ? " on" : "") }));
            const levels = el("span", { className: "cs-inline", "aria-hidden": "true", style: "gap: 4px" });
            LEVELS.forEach(function (L, i) { levels.appendChild(el("span", { className: "cs-lvl" + (p.lvl >= i ? " on" : ""), text: L.charAt(0) })); });
            let pct = 0;
            let progress = "not yet practiced";
            if (p.lvl >= 4) { pct = 100; progress = "mastered"; }
            else if (p.lvl >= 0) { const need = NEED[rank][p.lvl]; pct = Math.round(p.casts / need * 100); progress = p.casts + " / " + need + " → " + LEVELS[p.lvl + 1]; }
            const bar = el("span", { className: "cs-bar cs-thick" }, [el("span", { style: "width: " + pct + "%" })]);
            list.appendChild(el("div", { className: "cs-branch" }, [
                el("div", { className: "cs-line" }, [
                    el("span", { className: "cs-branch-name", text: b }),
                    el("div", { className: "cs-inline" }, [
                        el("span", { className: "cs-meta", text: "Affinity" }),
                        button("−", "aff-down", { className: "cs-btn cs-small", "aria-label": "Remove an Affinity Point from " + b, dataset: { branch: b } }),
                        pips,
                        button("+", "aff-up", { className: "cs-btn cs-small", "aria-label": "Add an Affinity Point to " + b, dataset: { branch: b } })
                    ])
                ]),
                el("div", { className: "cs-inline", style: "gap: 0.6rem" }, [
                    levels,
                    el("span", { className: p.lvl < 0 ? "cs-meta" : "", text: p.lvl < 0 ? "No Proficiency yet" : LEVELS[p.lvl] })
                ]),
                el("div", { className: "cs-inline", style: "gap: 0.6rem" }, [
                    bar,
                    el("span", { className: "cs-progress", text: progress }),
                    button("undo", "undo", { className: "cs-btn cs-quiet", "aria-label": "Undo the last successful cast in " + b, dataset: { branch: b } })
                ])
            ]));
        });
    }

    function renderSpells() {
        const list = $("cs-spells");
        list.innerHTML = "";
        if (!state.spells.length) {
            list.appendChild(el("p", { className: "cs-empty", text: "No spells yet. Open “Learn a new spell” to add one." }));
            return;
        }
        state.spells.forEach(function (sp, idx) {
            const p = state.prog[sp.b] || { lvl: -1 };
            const diff = DIFF[(sp.t || 1) - 1][p.lvl < 0 ? 0 : Math.min(p.lvl, 4)];
            const hard = !(diff === "Automatic" || diff === "Easy");
            list.appendChild(el("div", { className: "cs-spell" }, [
                el("div", { className: "cs-spell-text" }, [
                    el("span", { className: "cs-spell-name", text: sp.n }),
                    el("span", { className: "cs-meta", text: sp.b + " · Tier " + ROMAN[sp.t] }),
                    el("span", { className: "cs-meta" + (hard ? " cs-hard" : ""), text: diff + " · " + ROLL[diff] })
                ]),
                button("+ Success", "cast", { className: "cs-btn cs-strong", "aria-label": "Successful cast of " + sp.n, dataset: { index: String(idx) } }),
                button("×", "forget", { className: "cs-btn cs-small", "aria-label": "Forget " + sp.n, dataset: { index: String(idx) } })
            ]));
        });
    }

    function knownKey(n, t) { return n + "|" + t; }
    function availableSpells(branch) {
        const known = {};
        state.spells.forEach(function (sp) { known[knownKey(sp.n, sp.t)] = true; });
        return (grimoire[branch] || []).filter(function (g) { return !known[knownKey(g.n, g.t)]; });
    }

    let learnBranch = "Form";
    function renderLearn() {
        const branchSelect = $("cs-new-branch");
        if (!branchSelect.options.length) fillSelect(branchSelect, BRANCHES.map(function (b) { return { v: b, label: b }; }));
        branchSelect.value = learnBranch;
        const spellSelect = $("cs-new-spell");
        const previous = spellSelect.value;
        const spells = availableSpells(learnBranch);
        fillSelect(spellSelect, spells.map(function (g) { return { v: knownKey(g.n, g.t), label: g.n + " · Tier " + ROMAN[g.t] }; }));
        spellSelect.appendChild(el("option", { value: "__other", text: "Other spell…" }));
        if ([].some.call(spellSelect.options, function (o) { return o.value === previous; })) spellSelect.value = previous;
        $("cs-custom").hidden = spellSelect.value !== "__other";
    }

    function renderItems() {
        const list = $("cs-items");
        list.innerHTML = "";
        if (!state.items.length) list.appendChild(el("p", { className: "cs-empty", text: "No items yet." }));
        state.items.forEach(function (it, idx) {
            list.appendChild(el("div", { className: "cs-item" }, [
                el("span", { className: "cs-item-name", text: it.n }),
                button("−", "item-down", { className: "cs-btn cs-small", "aria-label": "One fewer " + it.n, dataset: { index: String(idx) } }),
                el("span", { className: "cs-qty", text: String(it.q) }),
                button("+", "item-up", { className: "cs-btn cs-small", "aria-label": "One more " + it.n, dataset: { index: String(idx) } }),
                button("×", "item-remove", { className: "cs-btn cs-small", "aria-label": "Remove " + it.n, dataset: { index: String(idx) } })
            ]));
        });
    }

    function renderCoins() {
        const list = $("cs-coins");
        const active = document.activeElement;
        const focused = active && active.tagName === "INPUT" && active.dataset ? active.dataset.coin : null;
        if (focused) {
            // Keep the field the player is typing in; only refresh the others.
            COINS.forEach(function (c) { if (c[0] !== focused) $("cs-coin-" + c[0]).value = state.coins[c[0]] || 0; });
            return;
        }
        list.innerHTML = "";
        COINS.forEach(function (c) {
            const input = el("input", { id: "cs-coin-" + c[0], type: "text", inputmode: "numeric", dataset: { coin: c[0] } });
            input.value = state.coins[c[0]] || 0;
            list.appendChild(el("div", { className: "cs-coin" }, [
                el("label", { for: "cs-coin-" + c[0], text: c[1], style: "color: " + c[2] }),
                button("−", "coin-down", { "aria-label": "Spend one " + c[1].toLowerCase() + " coin", dataset: { coin: c[0] } }),
                input,
                button("+", "coin-up", { "aria-label": "Add one " + c[1].toLowerCase() + " coin", dataset: { coin: c[0] } })
            ]));
        });
    }

    // ---- Progression ------------------------------------------------------------
    function cast(branch) {
        const prog = Object.assign({}, state.prog);
        const p = Object.assign({}, prog[branch]);
        const rank = state.aff[branch] || 0;
        if (p.lvl < 0) { p.lvl = 0; p.casts = 0; }
        if (p.lvl >= 4) return;
        p.casts += 1;
        if (p.casts >= NEED[rank][p.lvl]) { p.lvl += 1; p.casts = 0; }
        prog[branch] = p;
        change({ prog: prog });
    }

    function undo(branch) {
        const prog = Object.assign({}, state.prog);
        const p = Object.assign({}, prog[branch]);
        const rank = state.aff[branch] || 0;
        if (p.lvl < 0) return;
        if (p.casts > 0) p.casts -= 1;
        else if (p.lvl > 0) { p.lvl -= 1; p.casts = NEED[rank][p.lvl] - 1; }
        else p.lvl = -1;
        prog[branch] = p;
        change({ prog: prog });
    }

    // ---- Events -------------------------------------------------------------------
    function onAction(event) {
        const target = event.target.closest("button[data-action]");
        if (!target) return;
        const a = target.dataset.action;
        const b = target.dataset.branch;
        const i = parseInt(target.dataset.index, 10);
        const coin = target.dataset.coin;
        if (a === "aff-up" || a === "aff-down") {
            let spent = 0;
            BRANCHES.forEach(function (x) { spent += state.aff[x] || 0; });
            const rank = state.aff[b] || 0;
            const aff = Object.assign({}, state.aff);
            if (a === "aff-up" && spent < 4 && rank < 4) aff[b] = rank + 1;
            if (a === "aff-down" && rank > 0) aff[b] = rank - 1;
            change({ aff: aff });
        } else if (a === "undo") {
            undo(b);
        } else if (a === "cast") {
            cast(state.spells[i].b);
        } else if (a === "forget") {
            const spells = state.spells.slice(); spells.splice(i, 1); change({ spells: spells });
        } else if (a === "item-up" || a === "item-down") {
            const items = state.items.slice();
            const q = items[i].q + (a === "item-up" ? 1 : -1);
            if (q >= 1) { items[i] = { n: items[i].n, q: q }; change({ items: items }); }
        } else if (a === "item-remove") {
            const items = state.items.slice(); items.splice(i, 1); change({ items: items });
        } else if (a === "coin-up" || a === "coin-down") {
            const coins = Object.assign({}, state.coins);
            coins[coin] = Math.max(0, (coins[coin] || 0) + (a === "coin-up" ? 1 : -1));
            change({ coins: coins });
        }
    }

    function fillInputsFromState() {
        document.querySelectorAll("[data-field]").forEach(function (field) {
            field.value = state[field.dataset.field] == null ? "" : state[field.dataset.field];
        });
    }

    function bind() {
        fillSelect($("cs-race"), RACES.map(function (r) { return { v: r.k, label: r.n }; }), "Choose…");
        fillSelect($("cs-class"), CLASSES.map(function (c) { return { v: c.k, label: c.k }; }), "Choose…");
        fillSelect($("cs-birth"), RACES.filter(function (r) { return r.k !== "ilie"; }).map(function (r) { return { v: r.k, label: r.n }; }));
        fillSelect($("cs-align"), ALIGNMENTS.map(function (a) { return { v: a, label: a }; }), "Choose…");
        fillSelect($("cs-social"), SOCIAL.map(function (a) { return { v: a, label: a }; }), "Choose…");

        document.querySelectorAll("[data-field]").forEach(function (field) {
            field.addEventListener(field.tagName === "SELECT" ? "change" : "input", function () {
                const updates = {};
                updates[field.dataset.field] = field.value;
                change(updates);
            });
        });

        $("cs-transformed").addEventListener("change", function (e) { change({ transformed: e.target.checked }); });
        $("cs-blood-full").addEventListener("click", function () { change({ blood: "full" }); });
        $("cs-blood-ling").addEventListener("click", function () { change({ blood: "lingering" }); });
        $("cs-hp-down").addEventListener("click", function () { change({ hpLost: state.hpLost + 1 }); });
        $("cs-hp-up").addEventListener("click", function () { change({ hpLost: Math.max(0, state.hpLost - 1) }); });
        $("cs-level-up").addEventListener("click", function () { change({ level: state.level + 1 }); });
        $("cs-level-down").addEventListener("click", function () { change({ level: Math.max(1, state.level - 1) }); });

        // Learning spells
        $("cs-learn-toggle").addEventListener("click", function () {
            const open = $("cs-learn").hidden;
            $("cs-learn").hidden = !open;
            $("cs-learn-toggle").setAttribute("aria-expanded", String(open));
            $("cs-learn-icon").textContent = open ? "−" : "+";
        });
        $("cs-new-branch").addEventListener("change", function (e) { learnBranch = e.target.value; $("cs-new-spell").value = ""; renderLearn(); });
        $("cs-new-spell").addEventListener("change", function () { $("cs-custom").hidden = $("cs-new-spell").value !== "__other"; });
        $("cs-add-spell").addEventListener("click", function () {
            const choice = $("cs-new-spell").value;
            let entry = null;
            if (choice === "__other") {
                const name = $("cs-new-name").value.trim();
                if (name) entry = { n: name, b: learnBranch, t: parseInt($("cs-new-tier").value, 10) || 1 };
            } else {
                const found = (grimoire[learnBranch] || []).find(function (g) { return knownKey(g.n, g.t) === choice; });
                if (found) entry = { n: found.n, b: learnBranch, t: found.t };
            }
            if (!entry) return;
            $("cs-new-name").value = "";
            $("cs-learn").hidden = true;
            $("cs-learn-toggle").setAttribute("aria-expanded", "false");
            $("cs-learn-icon").textContent = "+";
            change({ spells: state.spells.concat([entry]) });
        });

        // Equipment and wealth
        function addItem() {
            const name = $("cs-new-item").value.trim();
            if (!name) return;
            $("cs-new-item").value = "";
            change({ items: state.items.concat([{ n: name, q: 1 }]) });
        }
        $("cs-add-item").addEventListener("click", addItem);
        $("cs-new-item").addEventListener("keydown", function (e) { if (e.key === "Enter") addItem(); });
        $("cs-coins").addEventListener("input", function (e) {
            const key = e.target.dataset.coin;
            if (!key) return;
            const n = parseInt(e.target.value.replace(/[^0-9]/g, ""), 10);
            const coins = Object.assign({}, state.coins);
            coins[key] = isNaN(n) ? 0 : n;
            change({ coins: coins });
        });
        $("cs-coins").addEventListener("focusout", function () { setTimeout(renderCoins, 0); });

        document.querySelector("main.cs").addEventListener("click", onAction);

        // Saving and loading
        $("cs-save").addEventListener("click", save);
        $("cs-load").addEventListener("change", load);
        window.addEventListener("beforeunload", function (e) {
            if (!dirty) return;
            e.preventDefault();
            e.returnValue = "";
        });
    }

    function message(text) { $("cs-file-msg").textContent = text; }

    function save() {
        const out = { format: SAVE_FORMAT, version: 1, savedAt: new Date().toISOString(), sheet: {} };
        SAVE_KEYS.forEach(function (k) { out.sheet[k] = state[k]; });
        const blob = new Blob([JSON.stringify(out, null, 2)], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = ((state.name || "character").trim().replace(/[^A-Za-z0-9-]+/g, "_") || "character") + ".json";
        document.body.appendChild(link);
        link.click();
        link.remove();
        setTimeout(function () { URL.revokeObjectURL(url); }, 2000);
        dirty = false;
        message("Sheet saved to your downloads.");
    }

    function load(event) {
        const input = event.target;
        const file = input.files && input.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = function () {
            try {
                const data = JSON.parse(reader.result);
                if (!data || data.format !== SAVE_FORMAT || !data.sheet) throw new Error("format");
                const next = blankState();
                SAVE_KEYS.forEach(function (k) { if (data.sheet[k] !== undefined) next[k] = data.sheet[k]; });
                BRANCHES.forEach(function (b) {
                    if (!next.prog[b]) next.prog[b] = { lvl: -1, casts: 0 };
                    if (next.aff[b] === undefined) next.aff[b] = 0;
                });
                state = next;
                fillInputsFromState();
                render();
                dirty = false;
                message("Sheet loaded: " + (state.name || "unnamed character") + ".");
            } catch (err) {
                message("This file is not an Ixoria character sheet.");
            }
            input.value = "";
        };
        reader.readAsText(file);
    }

    // ---- Grimoire -----------------------------------------------------------------
    // Reads spell names and tiers from each Grimoire page's spell list.
    function loadGrimoire() {
        const pattern = /"?name"?\s*:\s*"([^"]+)"\s*,\s*"?tier"?\s*:\s*(\d)/g;
        BRANCHES.forEach(function (b) {
            fetch(new URL("../grimoire/" + b.toLowerCase() + ".html", location.href))
                .then(function (response) { if (!response.ok) throw new Error(response.status); return response.text(); })
                .then(function (html) {
                    const seen = {};
                    const spells = [];
                    let match;
                    while ((match = pattern.exec(html)) !== null) {
                        const t = Math.min(5, Math.max(1, parseInt(match[2], 10)));
                        const key = knownKey(match[1], t);
                        if (!seen[key]) { seen[key] = true; spells.push({ n: match[1], t: t }); }
                    }
                    spells.sort(function (x, y) { return x.n.localeCompare(y.n) || x.t - y.t; });
                    grimoire[b] = spells;
                    if (!$("cs-magic").hidden) renderLearn();
                })
                .catch(function () { grimoire[b] = []; });
        });
    }

    function start() {
        bind();
        fillInputsFromState();
        render();
        loadGrimoire();
    }

    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start);
    else start();
})();
