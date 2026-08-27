/**
 * Live viewport readings, taken from inside the running app.
 *
 * Off unless the URL carries ?probe=1, so it costs nothing normally.
 *
 * The standalone /viewport-probe.html answered what iOS reports on a *plain*
 * page: only visualViewport.height moves, nothing scrolls. That turned out not
 * to be enough. The app is not a plain page — the body is overflow:hidden and
 * flex-centred, #root is transform-scaled, and the field being focused sits
 * inside all of that. Whether the browser scrolls or pans to reveal a field
 * depends on precisely those things, so the measurement has to happen here.
 *
 * Reports #root's real position as well as the viewport numbers, which is the
 * thing the standalone page could not show: where the app actually ends up
 * relative to the part of the screen you can still see.
 */
export function startViewportProbe() {
    if (typeof window === "undefined") return;
    if (!new URLSearchParams(window.location.search).has("probe")) return;

    const lines: string[] = [];
    const started = Date.now();

    const panel = document.createElement("div");
    panel.style.cssText = [
        "position:fixed", "left:0", "right:0", "bottom:0", "max-height:45vh",
        "z-index:2147483647", "background:rgba(8,10,16,.94)", "color:#e8ecf4",
        "font:11px/1.35 ui-monospace,Menlo,monospace", "white-space:pre",
        "overflow:auto", "padding:6px 8px", "-webkit-overflow-scrolling:touch",
    ].join(";");

    const copy = document.createElement("button");
    copy.textContent = "Copy";
    copy.style.cssText = "position:fixed;right:6px;bottom:calc(45vh + 6px);z-index:2147483647;"
        + "padding:10px 14px;font:13px ui-monospace,monospace;background:#1f5f8b;color:#fff;border:0;border-radius:6px";
    copy.addEventListener("click", () => {
        const text = navigator.userAgent + "\n\n" + lines.slice().reverse().join("\n");
        navigator.clipboard?.writeText(text);
        copy.textContent = "Copied";
        setTimeout(() => { copy.textContent = "Copy"; }, 1500);
    });

    const snap = (why: string) => {
        const view = window.visualViewport;
        const root = document.getElementById("root");
        const box = root?.getBoundingClientRect();
        const active = document.activeElement;
        const band = view ? view.height : document.documentElement.clientHeight;
        const round = (n: number | undefined) => n === undefined ? "-" : Math.round(n * 10) / 10;

        lines.unshift(
            `${String(Date.now() - started).padStart(6)}ms ${why.padEnd(14)}`
            + ` band=${round(band)} client=${document.documentElement.clientHeight}`
            + ` vvTop=${round(view?.offsetTop)} pageTop=${round(view?.pageTop)}`
            + ` scale=${view ? Math.round(view.scale * 100) / 100 : "-"}`
            + ` scrollY=${round(window.scrollY)} docScroll=${round(document.documentElement.scrollTop)}`
            + ` bodyScroll=${round(document.body.scrollTop)}`
            + ` rootTop=${round(box?.top)} rootBot=${round(box?.bottom)}`
            + ` cutTop=${round(box ? -box.top : undefined)} below=${round(box ? box.bottom - band : undefined)}`
            + ` focus=${active ? (active as HTMLElement).getAttribute?.("name") ?? active.tagName : "-"}`,
        );
        if (lines.length > 150) lines.pop();
        panel.textContent = lines.join("\n");
    };

    const on = (target: EventTarget | undefined, name: string, label: string) =>
        target?.addEventListener(name, () => snap(label), true);

    on(window, "resize", "win:resize");
    on(window, "scroll", "win:scroll");
    on(window, "focusin", "focusin");
    on(window, "focusout", "focusout");
    on(window, "orientationchange", "orientation");
    on(window.visualViewport ?? undefined, "resize", "vv:resize");
    on(window.visualViewport ?? undefined, "scroll", "vv:scroll");

    // The keyboard animates and the useful values often settle after the event
    // that announced them, so sample on a timer too.
    window.addEventListener("focusin", () => {
        [100, 300, 600, 1000, 1500].forEach(ms => setTimeout(() => snap(`after+${ms}`), ms));
    });
    window.addEventListener("focusout", () => {
        [100, 300, 600, 1000, 1500].forEach(ms => setTimeout(() => snap(`closed+${ms}`), ms));
    });

    document.body.appendChild(panel);
    document.body.appendChild(copy);
    snap("load");
}
