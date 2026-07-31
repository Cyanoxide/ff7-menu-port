import borderPng from "../../assets/kit/border.png?inline";
import cursorPng from "../../assets/kit/cursor.png?inline";
import materiaPng from "../../assets/kit/materia-spritesheet.png?inline";

/**
 * The kit's assets, inlined as data URIs at build time by Vite's `?inline`.
 *
 * The point of the exercise: a snippet somebody pastes into their own project
 * has to carry its images with it, or it either breaks or quietly hotlinks this
 * site's files. They are small enough for that to cost nothing — the border is
 * under half a kilobyte, and base64 adds about a third.
 */
export const KIT_ASSETS = {
    border: borderPng,
    cursor: cursorPng,
    materia: materiaPng,
};

/**
 * The left-hand column. Only three while this is a proof of concept, but the
 * page is built around the idea that there will be many more.
 */
export const KIT_GROUPS = [
    { id: "surfaces", name: "Surfaces" },
    { id: "indicators", name: "Indicators" },
    { id: "icons", name: "Icons" },
];

export type KitEntry = {
    name: string;
    /** Which group in the left-hand column this belongs under */
    group: string;
    /** What it is, and anything a person pasting it needs to know */
    notes: string[];
    /** The snippet, with data URIs already substituted in */
    code: string;
    /** Rendered beside the code */
    demo: "contentBox" | "progressBar" | "cursor" | "materia";
};

const shortened = (dataUri: string) => `${dataUri.slice(0, 48)}…`;

/**
 * Snippets are plain CSS and markup rather than React, deliberately: the point
 * is that they can be pasted anywhere, and half of what makes these elements
 * work is the border-image and background trickery rather than any component.
 */
export const KIT_ENTRIES: KitEntry[] = [
    {
        name: "Window",
        group: "surfaces",
        notes: [
            "The panel every screen is built from. Corners come from a nine-slice border image so it keeps its shape at any size.",
            "Two overlaid gradients give the window its diagonal sheen.",
        ],
        demo: "contentBox",
        code: `.ff7-window {
  padding: 1.5rem;
  border: 2px solid #78797a;
  border-radius: 5px;
  border-image: url("${shortened(KIT_ASSETS.border)}") 9 / 24px / 5px;
  background-color: #000;
  background-image:
    linear-gradient(135deg, rgb(4,25,86) 0%, transparent 50%, rgb(9,50,122) 100%),
    linear-gradient(45deg, rgb(4,20,103) 0%, rgb(11,66,151) 100%);
}`,
    },
    {
        name: "Progress bar",
        group: "indicators",
        notes: [
            "A light outer track with an inset shadow over the fill. That is what makes it read as recessed.",
            "Set the fill width as a percentage. The limit variant cycles its colour instead of sitting still.",
        ],
        demo: "progressBar",
        code: `.ff7-bar {
  background: #cfcfcf;
  width: 13.5rem;
  height: 1.7rem;
  position: relative;
}

.ff7-bar > .track {
  position: absolute;
  inset: 0;
  margin: 0.2rem 0.3rem;
  background: #7b7a78;
}

.ff7-bar > .track::after {
  content: "";
  position: absolute;
  inset: 0;
  box-shadow: inset 0 2px 3px 3px rgba(0, 0, 0, 0.5);
}

.ff7-bar .fill {
  height: 100%;
  background: #f5c4d0;
}`,
    },
    {
        name: "Cursor",
        group: "indicators",
        notes: [
            "The pointing hand that marks the focused row. Drawn as a before so it needs no element of its own.",
            "The hand is not centred in its own sprite. Without the nudge below it rides high.",
        ],
        demo: "cursor",
        code: `.ff7-row[data-focused="true"]::before {
  content: "";
  position: absolute;
  left: -81px;
  top: 50%;
  transform: translateY(-50%);
  margin-top: 9px;
  width: 76px;
  height: 46px;
  background-image: url("${shortened(KIT_ASSETS.cursor)}");
  background-size: contain;
  background-repeat: no-repeat;
  pointer-events: none;
}`,
    },
    {
        name: "Materia",
        group: "icons",
        notes: [
            "One sheet holds all five colours. Shift the background sideways to pick one.",
            "Sized in rems so it sits inline with the text beside it.",
        ],
        demo: "materia",
        code: `.ff7-materia::before {
  content: "";
  display: inline-block;
  width: 2.5rem;
  height: 30px;
  background-image: url("${shortened(KIT_ASSETS.materia)}");
  background-repeat: no-repeat;
  background-size: 200px 30px;
  /* green 4px, pink -39px, red -82px, yellow -167px */
  background-position-x: -124px;
}`,
    },
];
