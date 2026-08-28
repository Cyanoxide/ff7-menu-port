/**
 * What happens during a single tap, recorded on the device.
 *
 * Off unless the URL carries ?probe=1.
 *
 * Two faults on iOS have survived three attempts at a fix: tapping Name focuses
 * Message, and tapping Email opens the keyboard and closes it again. The
 * standing theory was that the app moves between the pointer going down and the
 * click resolving, so the click lands on a different field. Holding the layout
 * still during a tap did not help, which means either the theory is wrong or
 * the hold is not engaging.
 *
 * This distinguishes the two. For every event in a tap it records what was
 * targeted, what is under those coordinates *at that instant*, and where the
 * app is — so the frame in which the target changes, if it changes at all, is
 * visible rather than inferred.
 */
export function startTapProbe() {
    if (typeof window === "undefined") return;
    if (!new URLSearchParams(window.location.search).has("probe")) return;

    // A reload during the first run took the whole log with it, so keep it in
    // sessionStorage and restore on boot. Reload boundaries stay visible as
    // "load" lines in the middle of the record.
    const KEY = "ff7.tapProbe";
    const lines: string[] = JSON.parse(sessionStorage.getItem(KEY) || "[]");
    const started = Date.now();
    const persist = () => { try { sessionStorage.setItem(KEY, JSON.stringify(lines)); } catch { /* full */ } };

    const panel = document.createElement("div");
    panel.style.cssText = [
        "position:fixed", "left:0", "right:0", "top:26px", "height:45vh",
        "z-index:2147483646", "background:rgba(8,10,16,.96)", "color:#e8ecf4",
        "font:10.5px/1.3 ui-monospace,Menlo,monospace", "white-space:pre",
        "overflow:auto", "padding:6px 8px", "-webkit-overflow-scrolling:touch",
        "display:none",
    ].join(";");

    // Collapsed to a thin bar by default: the form has to stay tappable, and
    // with a keyboard up there is very little screen left to share.
    const bar = document.createElement("div");
    bar.style.cssText = "position:fixed;left:0;right:0;top:0;height:26px;z-index:2147483647;"
        + "display:flex;gap:6px;align-items:center;padding:0 6px;background:#11151f;"
        + "font:11px ui-monospace,Menlo,monospace;color:#9fb2cc";

    const count = document.createElement("span");
    const button = (text: string, onTap: () => void) => {
        const b = document.createElement("button");
        b.textContent = text;
        b.style.cssText = "padding:3px 10px;font:11px ui-monospace,monospace;background:#1f5f8b;"
            + "color:#fff;border:0;border-radius:4px";
        b.addEventListener("click", e => { e.stopPropagation(); onTap(); }, true);
        return b;
    };

    const copy = button("COPY", () => {
        navigator.clipboard?.writeText(navigator.userAgent + "\n\n" + lines.slice().reverse().join("\n"));
        copy.textContent = "COPIED";
        setTimeout(() => { copy.textContent = "COPY"; }, 1500);
    });
    const toggle = button("LOG", () => {
        const opening = panel.style.display === "none";
        panel.style.display = opening ? "block" : "none";
        // note() only paints while open, so catch up on everything recorded
        // while it was collapsed
        if (opening) panel.textContent = lines.join("\n");
    });
    const clear = button("CLR", () => {
        lines.length = 0; persist(); panel.textContent = ""; count.textContent = "0";
    });
    bar.append(copy, toggle, clear, count);

    /** A short, recognisable name for whatever element this is. */
    const label = (el: Element | null | undefined): string => {
        if (!el) return "-";
        const named = el as HTMLInputElement;
        if (named.name) return named.name;
        const field = el.closest?.("li")?.querySelector?.("input,textarea") as HTMLInputElement | null;
        if (field?.name) return field.name + "(li)";
        return el.tagName.toLowerCase();
    };

    const note = (why: string, x?: number, y?: number, target?: EventTarget | null) => {
        // The probe's own chrome is not part of what it is recording. Window
        // capture listeners run before the buttons' own, so stopping
        // propagation there cannot filter this - test the target instead.
        const node = target as Node | null;
        if (node && (bar.contains(node) || panel.contains(node))) return;

        const root = document.getElementById("root");
        const box = root?.getBoundingClientRect();
        const view = window.visualViewport;
        // what is under those coordinates right now, which is the whole question
        const under = (x !== undefined && y !== undefined) ? document.elementFromPoint(x, y) : null;

        lines.unshift(
            `${String(Date.now() - started).padStart(6)}ms ${why.padEnd(12)}`
            + ` target=${label(target as Element).padEnd(12)}`
            + ` at(${x === undefined ? "-" : Math.round(x)},${y === undefined ? "-" : Math.round(y)})`
            + `=${label(under).padEnd(12)}`
            + ` rootTop=${box ? Math.round(box.top) : "-"}`
            + ` band=${view ? Math.round(view.height) : "-"}`
            + ` vvTop=${view ? Math.round(view.offsetTop) : "-"}`
            + ` scrollY=${Math.round(window.scrollY)}`
            + ` focus=${label(document.activeElement)}`,
        );
        if (lines.length > 400) lines.pop();
        persist();
        count.textContent = String(lines.length);
        if (panel.style.display !== "none") panel.textContent = lines.join("\n");
    };

    const point = (e: Event) => {
        const t = e as PointerEvent & { changedTouches?: TouchList };
        if (typeof t.clientX === "number") return { x: t.clientX, y: t.clientY };
        const touch = t.changedTouches?.[0];
        return touch ? { x: touch.clientX, y: touch.clientY } : { x: undefined, y: undefined };
    };

    (["touchstart", "pointerdown", "pointerup", "touchend", "mousedown", "mouseup", "click"] as const)
        .forEach(name => window.addEventListener(name, e => {
            const { x, y } = point(e);
            note(name, x, y, e.target);
        }, { capture: true, passive: true }));

    (["focusin", "focusout"] as const)
        .forEach(name => window.addEventListener(name, e => note(name, undefined, undefined, e.target), true));

    window.visualViewport?.addEventListener("resize", () => note("vv:resize"));
    window.visualViewport?.addEventListener("scroll", () => note("vv:scroll"));
    window.addEventListener("scroll", () => note("win:scroll"), { passive: true });

    // The app is repositioned by writing #root's transform, so watch for that
    const root = document.getElementById("root");
    if (root) new MutationObserver(() => note("root:moved")).observe(root, {
        attributes: true, attributeFilter: ["style"],
    });

    document.body.appendChild(panel);
    document.body.appendChild(bar);

    // A client-side route change moves the whole screen, so mark it
    let path = location.pathname;
    setInterval(() => {
        if (location.pathname === path) return;
        path = location.pathname;
        note("nav:" + path);
    }, 100);

    note("load " + location.pathname);
}
