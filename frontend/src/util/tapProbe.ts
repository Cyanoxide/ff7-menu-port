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

    const lines: string[] = [];
    const started = Date.now();

    const panel = document.createElement("div");
    panel.style.cssText = [
        "position:fixed", "left:0", "right:0", "bottom:0", "height:38vh",
        "z-index:2147483647", "background:rgba(8,10,16,.95)", "color:#e8ecf4",
        "font:10.5px/1.3 ui-monospace,Menlo,monospace", "white-space:pre",
        "overflow:auto", "padding:6px 8px", "-webkit-overflow-scrolling:touch",
    ].join(";");

    const copy = document.createElement("button");
    copy.textContent = "Copy";
    copy.style.cssText = "position:fixed;right:6px;bottom:calc(38vh + 6px);z-index:2147483647;"
        + "padding:12px 18px;font:13px ui-monospace,monospace;background:#1f5f8b;color:#fff;border:0;border-radius:6px";
    copy.addEventListener("click", () => {
        navigator.clipboard?.writeText(navigator.userAgent + "\n\n" + lines.slice().reverse().join("\n"));
        copy.textContent = "Copied";
        setTimeout(() => { copy.textContent = "Copy"; }, 1500);
    });

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
        if (lines.length > 200) lines.pop();
        panel.textContent = lines.join("\n");
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
    document.body.appendChild(copy);
    note("load");
}
