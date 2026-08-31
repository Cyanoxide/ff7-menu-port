import { useEffect, useState } from "react";
import ContentBox from "../../components/ContentBox/ContentBox";
import PartyMember from "../../components/PartyMember/PartyMember";
import Time from "../../components/Time/Time";
import textToSprite from "../../util/textToSprite";
import playSound from "../../util/sounds";
import { useContext } from "../../context/context";
import locations from "../../data/locations.json";
import styles from "./Landing.module.scss";

// The bio types itself out on arrival, one character at a time.
//
// The glyphs are sprite spans of differing widths, so the un-typed ones are
// rendered but hidden rather than omitted: dropping them would make each line
// grow as it types and shift the whole block inside its centred container.
const BIO_LINES: [string, string][] = [
    ["I'm a Senior Web Developer based in", "mb-[13.2px]"],
    ["Gloucester, UK.", "mb-[29.2px]"],
    ["Welcome to my personal sandbox.", "mb-[29.2px]"],
    ["I plan to add an ever-growing collection", "mb-[13.2px]"],
    ["of small technical projects here, mostly", "mb-[13.2px]"],
    ["built with nostalgic aesthetics in mind.", "mb-[13.2px]"],
];

const CHAR_MS = 13;       // per character
const LINE_PAUSE_MS = 110;  // extra beat at the end of each line

// The bio box opens on its own transition, separate from the panel fade:
// `transition: all 0.3s ease-in 0.65s` in ContentBox.module.scss, so it isn't
// fully open until ~950ms. Start after that, plus a beat, or the first line or
// two types inside a box that is still zero-height and clipping it.
const START_DELAY_MS = 1100;

// Cumulative character count at the end of each line, so the pause at a line
// break lands in the right place.
const LINE_ENDS = BIO_LINES.reduce<number[]>((acc, [line]) => {
    acc.push((acc[acc.length - 1] ?? 0) + line.length);
    return acc;
}, []);

const TOTAL_CHARS = LINE_ENDS[LINE_ENDS.length - 1];

// How many characters should be showing after `elapsed` ms of typing. Driven by
// elapsed time rather than by a timer per character: setTimeout can't fire
// faster than a frame, so a per-character timer quantises the rate to whole
// characters per 16ms frame and CHAR_MS stops meaning anything between about
// 8 and 16.
function charsAt(elapsed: number) {
    let budget = elapsed - START_DELAY_MS;
    if (budget <= 0) return 0;

    for (let n = 0; n < TOTAL_CHARS; n++) {
        budget -= CHAR_MS;
        if (budget < 0) return n;
        if (LINE_ENDS.includes(n + 1)) budget -= LINE_PAUSE_MS;
    }
    return TOTAL_CHARS;
}

/**
 * Whether the browser loaded *this* page, rather than some other route.
 *
 * Read at module scope, so it is the URL of the initial document load and not
 * of wherever the router has since gone. Refreshing on /history and then
 * navigating here leaves it false, which is the case the plain "have we typed
 * yet" flag got wrong: the module reloaded, so the flag was clear, and the bio
 * typed itself on what was to the visitor a return visit.
 */
const LOADED_ON_LANDING = typeof window !== "undefined" && window.location.pathname === "/";

/**
 * Set once the reveal has run, so coming back from another page shows the
 * finished text. Starts already set when the document was loaded elsewhere, so
 * the animation belongs to a load of the landing page and nothing else.
 *
 * (There is no StrictMode here, so the effect runs once per mount and this is
 * not tripped by a double-invoked mount in development.)
 */
let hasTyped = !LOADED_ON_LANDING;

function TypedBio() {
    const [typed, setTyped] = useState(hasTyped ? TOTAL_CHARS : 0);

    useEffect(() => {
        if (hasTyped) return;
        hasTyped = true;

        const started = performance.now();
        let frame = 0;

        const step = () => {
            const n = charsAt(performance.now() - started);
            setTyped(n);
            if (n < TOTAL_CHARS) frame = requestAnimationFrame(step);
        };

        frame = requestAnimationFrame(step);
        return () => cancelAnimationFrame(frame);
    }, []);

    let consumed = 0;

    return (
        <>
            {BIO_LINES.map(([line, margin]) => {
                const shown = Math.max(0, Math.min(line.length, typed - consumed));
                consumed += line.length;

                return (
                    <p key={line} className={margin}>
                        <span className="font flex" data-text-color="white">
                            {line.split("").map((glyph, index) => (
                                <span
                                    key={index}
                                    className="font-glyph"
                                    data-sprite={glyph}
                                    style={{ visibility: index < shown ? "visible" : "hidden" }}
                                >
                                    {glyph}
                                </span>
                            ))}
                        </span>
                    </p>
                );
            })}
        </>
    );
}
function LandingContent() {
    const { isSoundEnabled } = useContext();

    // Show a random FF7 location screen name, re-rolled on each page load
    // or whenever the refresh button is pressed.
    const [location, setLocation] = useState(
        () => locations[Math.floor(Math.random() * locations.length)]
    );

    const refreshLocation = () => {
        playSound("select", isSoundEnabled);
        setLocation(prev => {
            if (locations.length < 2) return prev;
            let next = prev;
            while (next === prev) next = locations[Math.floor(Math.random() * locations.length)];
            return next;
        });
    };

    return (
        // Fades as one group: the location and meta panels overlap the main one,
        // and fading them separately shows the hidden borders through each other
        <div className="panel-group">
            <ContentBox className="w-[894.8px] h-[720px] m-auto absolute top-[44px]" data-label="party">
                <PartyMember memberId={1} showProgressBars={true} healthReduction={true} />
                <div className="flex items-center justify-center h-[340px] w-[716.82px] left-[56.18px] right-[220px] top-[290.5px] absolute">
                    <ContentBox data-label="bio">
                        <TypedBio />
                    </ContentBox>
                </div>
            </ContentBox>
            <ContentBox className="w-[280px] h-[110px] m-auto absolute right-0 bottom-[94.2px]" data-label="metaInfo">
                <ul className="flex justify-between flex-col h-full">
                    <li className="flex justify-between">
                        <span>{textToSprite("Time")}</span>
                        <Time />
                    </li>
                    <li className="flex justify-between">
                        <span>{textToSprite("Gil")}</span>
                        <span>{textToSprite("86675", true)}</span>
                    </li>
                </ul>
            </ContentBox>
            <ContentBox className={`${styles.pageInfo} w-[535px] h-[88px] m-auto absolute right-0 top-0 flex items-center justify-between`} data-label="pageInfo">
                <span>{textToSprite(location)}</span>
                <span className={`${styles.refresh} font-glyph`} data-sprite="reset-icon" onClick={refreshLocation}></span>
            </ContentBox>
        </div>
    );
}

export default LandingContent;