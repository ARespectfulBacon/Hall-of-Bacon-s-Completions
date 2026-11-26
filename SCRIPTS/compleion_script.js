// =========================================================
// Hall of Completions
// - The published list lives in data/completions.json
//   (that's what every visitor sees on GitHub Pages)
// - Edits made on the page are saved in this browser only
//   (localStorage) and override the published list for you
// - Export downloads completions.json -> replace the one in
//   the repo's data/ folder and push to publish your edits
// =========================================================

const STORAGE_KEY = "hallOfCompletions.v1";
const DATA_URL = "data/completions.json";

document.addEventListener("DOMContentLoaded", () => {
    // ---------- Elements ----------
    const tbody       = document.getElementById("completions-body");
    const searchInput = document.getElementById("search");
    const sortSelect  = document.getElementById("sort");
    const resultCount = document.getElementById("result-count");
    const emptyState  = document.getElementById("empty-state");
    const navLinks    = document.querySelectorAll(".nav-link");

    const addBtn      = document.getElementById("add-btn");
    const modal       = document.getElementById("entry-modal");
    const form        = document.getElementById("entry-form");
    const modalTitle  = document.getElementById("modal-title");
    const formError   = document.getElementById("form-error");
    const closeBtn    = document.getElementById("close-btn");
    const cancelBtn   = document.getElementById("cancel-btn");
    const deleteBtn   = document.getElementById("delete-btn");
    const diffOut     = document.getElementById("difficulty-out");
    const enjoyOut    = document.getElementById("enjoyment-out");

    const exportBtn   = document.getElementById("export-btn");
    const importBtn   = document.getElementById("import-btn");
    const importFile  = document.getElementById("import-file");
    const revertBtn   = document.getElementById("revert-btn");
    const localBadge  = document.getElementById("local-badge");

    let completions = [];
    let published = [];      // what's in data/completions.json
    let loadFailed = false;  // true if data/completions.json couldn't be fetched
    let editingId = null;

    // ---------- Storage ----------

    function makeId() {
        return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
    }

    function clampScore(n) {
        const v = Math.round(Number(n));
        return Number.isFinite(v) ? Math.min(10, Math.max(1, v)) : 5;
    }

    // Makes sure every entry has all fields with sensible types
    function normalise(entry) {
        return {
            id:         entry.id || makeId(),
            game:       String(entry.game || "").trim(),
            platform:   String(entry.platform || "").trim(),
            challenge:  String(entry.challenge || "").trim(),
            difficulty: clampScore(entry.difficulty),
            enjoyment:  clampScore(entry.enjoyment),
            tier:       ["auto", "extreme", "hard", "medium"].includes(entry.tier) ? entry.tier : "auto",
            time:       Math.max(0, parseFloat(entry.time) || 0),
            date:       /^\d{4}-\d{2}-\d{2}$/.test(entry.date || "") ? entry.date : "",
            proofUrl:   String(entry.proofUrl || "").trim(),
            proofLabel: String(entry.proofLabel || "").trim(),
            notes:      String(entry.notes || "").trim(),
        };
    }

    // This browser's own edits, or null if there are none
    function loadLocal() {
        try {
            const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
            if (Array.isArray(saved)) return saved.map(normalise);
        } catch (err) {
            console.warn("Couldn't read locally saved completions.", err);
        }
        return null;
    }

    // The published list from data/completions.json
    async function loadPublished() {
        try {
            const res = await fetch(DATA_URL, { cache: "no-cache" });
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const data = await res.json();
            if (!Array.isArray(data)) throw new Error("completions.json must contain a list");
            return data.map(normalise);
        } catch (err) {
            loadFailed = true;
            console.error(`Couldn't load ${DATA_URL}.`, err);
            return [];
        }
    }

    function hasLocalEdits() {
        return localStorage.getItem(STORAGE_KEY) !== null;
    }

    function updateLocalIndicator() {
        const local = hasLocalEdits();
        localBadge.hidden = !local;
        revertBtn.hidden = !local;
    }

    function save() {
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(completions));
        } catch (err) {
            alert("Couldn't save to this browser's storage. Try exporting a backup.");
            console.error(err);
        }
        updateLocalIndicator();
    }

    // ---------- Formatting helpers ----------

    function tierFor(entry) {
        if (entry.tier !== "auto") return entry.tier;
        if (entry.difficulty >= 9) return "extreme";
        if (entry.difficulty >= 7) return "hard";
        return "medium";
    }

    // Parse "YYYY-MM-DD" as a local date (avoids timezone off-by-one)
    function parseDate(str) {
        if (!str) return null;
        const [y, m, d] = str.split("-").map(Number);
        return new Date(y, m - 1, d);
    }

    function formatDate(str) {
        const d = parseDate(str);
        return d
            ? d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })
            : "—";
    }

    function formatHours(h) {
        return h ? `${Number.isInteger(h) ? h : h.toFixed(1)}h` : "—";
    }

    // Only allow real web links in proof (blocks things like javascript: URLs)
    function safeUrl(url) {
        try {
            const u = new URL(url);
            return u.protocol === "http:" || u.protocol === "https:" ? u.href : "";
        } catch {
            return "";
        }
    }

    // Small helper for building elements without innerHTML (keeps user text safe)
    function el(tag, className, text) {
        const node = document.createElement(tag);
        if (className) node.className = className;
        if (text !== undefined) node.textContent = text;
        return node;
    }

    // ---------- Rendering ----------

    function buildRating(score, kind) {
        const span = el("span", `rating rating-${kind}`, String(score));
        span.style.setProperty("--score", score);
        span.appendChild(el("span", "rating-max", "/10"));
        return span;
    }

    function buildRow(entry, rank) {
        const tr = el("tr");
        tr.dataset.id = entry.id;
        tr.dataset.tier = tierFor(entry);

        // #
        tr.appendChild(el("td", "col-rank", String(rank)));

        // Game + platform
        const gameTd = el("td", "col-game");
        gameTd.appendChild(el("span", "game-title", entry.game));
        if (entry.platform) gameTd.appendChild(el("span", "game-platform", entry.platform));
        tr.appendChild(gameTd);

        // Challenge
        tr.appendChild(el("td", "col-challenge", entry.challenge));

        // Ratings
        const diffTd = el("td", "col-difficulty");
        diffTd.appendChild(buildRating(entry.difficulty, "difficulty"));
        tr.appendChild(diffTd);

        const enjoyTd = el("td", "col-enjoyment");
        enjoyTd.appendChild(buildRating(entry.enjoyment, "enjoyment"));
        tr.appendChild(enjoyTd);

        // Time
        tr.appendChild(el("td", "col-time", formatHours(entry.time)));

        // Date
        const dateTd = el("td", "col-date");
        if (entry.date) {
            const time = el("time", "", formatDate(entry.date));
            time.dateTime = entry.date;
            dateTd.appendChild(time);
        } else {
            dateTd.textContent = "—";
        }
        tr.appendChild(dateTd);

        // Proof
        const proofTd = el("td", "col-proof");
        const url = safeUrl(entry.proofUrl);
        if (url) {
            const a = el("a", "proof-link", entry.proofLabel || "Link");
            a.href = url;
            a.target = "_blank";
            a.rel = "noopener noreferrer";
            proofTd.appendChild(a);
        } else {
            proofTd.appendChild(el("span", "proof-none", "—"));
        }
        tr.appendChild(proofTd);

        // Notes
        tr.appendChild(el("td", "col-notes", entry.notes));

        // Edit button
        const actionsTd = el("td", "col-actions");
        const editBtn = el("button", "icon-btn edit-btn");
        editBtn.type = "button";
        editBtn.dataset.action = "edit";
        editBtn.setAttribute("aria-label", `Edit ${entry.game}`);
        editBtn.title = "Edit";
        editBtn.innerHTML =
            '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 20h4L19 9l-4-4L4 16v4z" /><path d="M13.5 6.5l4 4" /></svg>';
        actionsTd.appendChild(editBtn);
        tr.appendChild(actionsTd);

        return tr;
    }

    const sorters = {
        date:       (a, b) => (b.date || "").localeCompare(a.date || ""),
        difficulty: (a, b) => b.difficulty - a.difficulty || b.enjoyment - a.enjoyment,
        enjoyment:  (a, b) => b.enjoyment - a.enjoyment || b.difficulty - a.difficulty,
        time:       (a, b) => b.time - a.time,
        game:       (a, b) => a.game.localeCompare(b.game, undefined, { sensitivity: "base" }),
    };

    function matchesSearch(entry, query) {
        if (!query) return true;
        return [entry.game, entry.platform, entry.challenge, entry.notes, entry.proofLabel]
            .join(" ")
            .toLowerCase()
            .includes(query);
    }

    function render() {
        const query = searchInput.value.trim().toLowerCase();
        const compare = sorters[sortSelect.value] || sorters.date;

        const visible = completions
            .filter((entry) => matchesSearch(entry, query))
            .sort(compare);

        tbody.replaceChildren(...visible.map((entry, i) => buildRow(entry, i + 1)));

        // Count + empty message
        resultCount.textContent = query
            ? `${visible.length} of ${completions.length}`
            : `${completions.length} total`;

        if (visible.length === 0) {
            emptyState.textContent = completions.length
                ? "No completions match your search ( ˘･з･)"
                : loadFailed
                    ? "Couldn't load data/completions.json (ノ_<) If you opened the file directly, run it through a local server instead."
                    : "No completions yet, hit the + button to add your first one ♡";
            emptyState.hidden = false;
        } else {
            emptyState.hidden = true;
        }

        updateStats();
    }

    function updateStats() {
        const count = completions.length;
        const avg = (key) =>
            count ? (completions.reduce((sum, c) => sum + c[key], 0) / count).toFixed(1) : "–";
        const totalTime = completions.reduce((sum, c) => sum + c.time, 0);

        document.getElementById("stat-count").textContent      = count;
        document.getElementById("stat-difficulty").textContent = avg("difficulty");
        document.getElementById("stat-enjoyment").textContent  = avg("enjoyment");
        document.getElementById("stat-time").textContent       = `${Math.round(totalTime)}h`;
    }

    // ---------- Add / edit window ----------

    function syncRangeOutputs() {
        diffOut.textContent  = form.elements.difficulty.value;
        enjoyOut.textContent = form.elements.enjoyment.value;
    }

    function openModal(entry = null) {
        editingId = entry ? entry.id : null;
        form.reset();
        formError.hidden = true;

        modalTitle.textContent = entry ? "Edit completion" : "New completion";
        deleteBtn.hidden = !entry;

        if (entry) {
            for (const [key, value] of Object.entries(entry)) {
                if (form.elements[key]) form.elements[key].value = value;
            }
            if (!entry.time) form.elements.time.value = "";
        } else {
            // Default the date to today for new entries
            const now = new Date();
            const pad = (n) => String(n).padStart(2, "0");
            form.elements.date.value = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
        }

        syncRangeOutputs();
        modal.showModal();
        form.elements.game.focus();
    }

    function closeModal() {
        modal.close();
        editingId = null;
    }

    function showError(message, field) {
        formError.textContent = message;
        formError.hidden = false;
        if (field) form.elements[field].focus();
    }

    form.addEventListener("submit", (event) => {
        event.preventDefault();

        const data = Object.fromEntries(new FormData(form));

        if (!data.game.trim())      return showError("Please enter the game's name.", "game");
        if (!data.challenge.trim()) return showError("Please describe the challenge.", "challenge");
        if (data.proofUrl.trim() && !safeUrl(data.proofUrl.trim())) {
            return showError("The proof link needs to start with http:// or https://", "proofUrl");
        }

        if (editingId) {
            const index = completions.findIndex((c) => c.id === editingId);
            if (index !== -1) completions[index] = normalise({ ...data, id: editingId });
        } else {
            completions.push(normalise(data));
        }

        save();
        render();
        closeModal();
    });

    deleteBtn.addEventListener("click", () => {
        const entry = completions.find((c) => c.id === editingId);
        if (!entry) return;
        if (!confirm(`Delete "${entry.game} – ${entry.challenge}"? This can't be undone.`)) return;

        completions = completions.filter((c) => c.id !== editingId);
        save();
        render();
        closeModal();
    });

    form.elements.difficulty.addEventListener("input", syncRangeOutputs);
    form.elements.enjoyment.addEventListener("input", syncRangeOutputs);

    addBtn.addEventListener("click", () => openModal());
    closeBtn.addEventListener("click", closeModal);
    cancelBtn.addEventListener("click", closeModal);

    // Click outside the window (on the dimmed backdrop) to close
    modal.addEventListener("click", (event) => {
        if (event.target === modal) closeModal();
    });

    // Pencil buttons in the table
    tbody.addEventListener("click", (event) => {
        const btn = event.target.closest("[data-action='edit']");
        if (!btn) return;
        const id = btn.closest("tr").dataset.id;
        const entry = completions.find((c) => c.id === id);
        if (entry) openModal(entry);
    });

    // ---------- Export / Import ----------

    exportBtn.addEventListener("click", () => {
        const blob = new Blob([JSON.stringify(completions, null, 2)], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = "completions.json";
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
    });

    importBtn.addEventListener("click", () => importFile.click());

    importFile.addEventListener("change", async () => {
        const file = importFile.files[0];
        importFile.value = "";
        if (!file) return;

        try {
            const parsed = JSON.parse(await file.text());
            if (!Array.isArray(parsed)) throw new Error("File doesn't contain a list of completions.");

            const imported = parsed.map(normalise).filter((c) => c.game && c.challenge);
            const ok = confirm(
                `Import ${imported.length} completion(s)? This will replace the ${completions.length} currently on the page.`
            );
            if (!ok) return;

            completions = imported;
            save();
            render();
        } catch (err) {
            alert("That file couldn't be imported. Make sure it's a backup exported from this page.");
            console.error(err);
        }
    });

    // ---------- Search / sort / nav ----------

    searchInput.addEventListener("input", render);
    sortSelect.addEventListener("change", render);

    navLinks.forEach((link) => {
        link.addEventListener("click", () => {
            navLinks.forEach((l) => l.classList.remove("active"));
            link.classList.add("active");
        });
    });

    // ---------- Discard local edits ----------

    revertBtn.addEventListener("click", () => {
        if (!confirm("Discard the edits saved in this browser and show the published list again?")) return;
        localStorage.removeItem(STORAGE_KEY);
        completions = published.map((c) => ({ ...c }));
        updateLocalIndicator();
        render();
    });

    // ---------- Start ----------

    // Compare two lists ignoring the internal ids
    function sameList(a, b) {
        const strip = (list) => JSON.stringify(list.map(({ id, ...rest }) => rest));
        return strip(a) === strip(b);
    }

    async function init() {
        published = await loadPublished();
        const local = loadLocal();

        // Once your exported file has been pushed, the local copy matches the
        // published one, so drop it and go back to following the published list.
        if (local && !loadFailed && sameList(local, published)) {
            localStorage.removeItem(STORAGE_KEY);
            completions = published.map((c) => ({ ...c }));
        } else {
            completions = local || published.map((c) => ({ ...c }));
        }
        updateLocalIndicator();
        render();
    }

    init();
});
