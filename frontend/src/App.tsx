import { Provider } from "./context/provider";
import { useEffect, useState } from "react";
import { Routes, Route, Navigate } from "react-router-dom";

import Menu from './components/Menu/Menu';
import Landing from "./pages/Landing/Landing";
import Projects from "./pages/Projects/Projects";
import Skills from "./pages/Skills/SkillsContent";
import Equip from "./pages/Equip/Equip";
import MemCardSelector from "./components/MemCardSelector/MemCardSelector";
import Config from "./pages/Config/Config";
import Resume from "./pages/Resume/Resume";
import Contact from "./pages/Contact/Contact";
import NameEntry from "./pages/NameEntry/NameEntry";

/**
 * The canvas the app is scaled to fit.
 *
 * The height is the design height. The width only has to cover the 1100px stage
 * plus the widest thing hung outside it. Cursors and the close button overhang:
 * measured at 1440x900 and on a phone, the Projects tab cursor reaches ~40px
 * past the left edge and the close button ~21px past the right. The canvas is
 * centred on the stage, so it needs twice the worst side — 1100 + 2x40 = 1180 —
 * and 1200 leaves a margin on top of that.
 *
 * It used to be 1250. The extra was never reached by anything, and on a phone,
 * where the width is the limiting term, it letterboxed dead space onto both
 * sides for nothing. Desktop is unaffected: an ordinary window is limited by its
 * height, so min() still picks the height term and the scale is identical.
 *
 * If a page grows a wider overhang, this has to grow with it or the overhang
 * clips at the screen edge. Check with a screenshot on the narrowest phone, not
 * by eye on a desktop — desktop has hundreds of pixels of slack and hides it.
 */
const DESIGN_WIDTH = 1200;
const DESIGN_HEIGHT = 975;

/**
 * A phone gets a shorter canvas. The stage is 825 tall and sits in 975, so 150px
 * of the height is margin that exists to give a desktop window some air. On a
 * landscape phone that margin is most of the screen, and the menu ends up tiny
 * with wide empty bands above and below.
 *
 * Only phone-sized viewports, deliberately: desktop is limited by its height, so
 * shortening the canvas there would scale the whole app up and the user is happy
 * with how it looks. "Phone" is the shorter side, which catches both
 * orientations and leaves tablets and every desktop window alone.
 */
const COMPACT_MAX_SIDE = 500;
const COMPACT_DESIGN_HEIGHT = 880;

const canvasHeight = (width: number, height: number) =>
    Math.min(width, height) < COMPACT_MAX_SIDE ? COMPACT_DESIGN_HEIGHT : DESIGN_HEIGHT;

function App() {
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    setIsLoaded(true);
  }, []);

  useEffect(() => {
    /**
     * How much of the screen the app actually has, which is not the same as how
     * tall the window is once a soft keyboard is up.
     *
     * The layout viewport does not shrink for a keyboard — on iOS
     * documentElement.clientHeight is identical with the keyboard open and
     * closed — so scaling against it left the app the same size with a third of
     * it underneath the keyboard. The browser then panned to bring the focused
     * field into view, which is what cropped the top.
     *
     * The visual viewport is the one that shrinks, so it is the right measure.
     * It also shrinks under pinch zoom, where the layout viewport is the stable
     * reference and the app must NOT resize — hence the scale check.
     */
    function availableHeight() {
      const viewport = window.visualViewport;
      if (viewport && Math.abs(viewport.scale - 1) < 0.01) return viewport.height;
      return document.documentElement.clientHeight;
    }

    function scaleApp() {

      const app = document.getElementById("root");
      if (app) {
        // The layout viewport stays stable while pinch-zooming, unlike innerWidth/innerHeight
        const viewportWidth = document.documentElement.clientWidth;
        const viewportHeight = availableHeight();

        /**
         * Which canvas applies is decided from the *layout* viewport, but the
         * fit is measured against the visual one.
         *
         * canvasHeight asks whether this is a phone by looking at the shorter
         * side. Handing it the visual height would make a keyboard the answer:
         * on a tablet or a small window the band drops under 500px while the
         * keyboard is up, the compact canvas kicks in, and the whole app
         * changes size mid-sentence. The device does not stop being a tablet
         * because someone is typing.
         */
        const canvas = canvasHeight(viewportWidth, document.documentElement.clientHeight);
        const scale = Math.min(viewportWidth / DESIGN_WIDTH, viewportHeight / canvas);
        /**
         * offsetTop is where the visible band starts. It is 0 for a keyboard
         * docked at the bottom, but not once the browser has panned the visual
         * viewport, and without it the app would be centred on a band that has
         * moved out from under it.
         *
         * The centring itself is measured from the element's own box rather
         * than assumed from the canvas, and is allowed to go negative so a box
         * taller than the window overhangs evenly instead of hanging off the
         * bottom. offsetHeight is layout pixels, so the transform does not feed
         * back into it.
         *
         * Deliberately NOT adding window.scrollY. It was, briefly, and it made
         * things worse: translateY moves the app in document space, so shifting
         * it down by the scroll moves the focused field down too, the browser
         * scrolls further to chase it, and the two push each other until the
         * keyboard is covering the bottom. #root is position:fixed instead, so
         * the document has nothing to scroll and there is no scroll to correct
         * for. html's own `overflow: hidden` stops a stray swipe; being out of
         * flow is what stops the browser scrolling to a focused field.
         */
        const bandTop = window.visualViewport?.offsetTop ?? 0;
        const offsetY = bandTop + (viewportHeight - app.offsetHeight * scale) / 2;
        // translateX(-50%) pairs with left: 50% in index.css — see the note there
        app.style.transform = `translateX(-50%) translateY(${offsetY}px) scale(${scale})`;
      }
    }

    /**
     * The keyboard animates, and the resize can land while it is still moving —
     * so re-measure once it has settled as well. Closing it is the case that
     * needs this most: without the second pass the app can be left centred on
     * the band the keyboard was occupying.
     */
    let settle: ReturnType<typeof setTimeout>;
    function scaleAfterKeyboard() {
      scaleApp();
      clearTimeout(settle);
      settle = setTimeout(scaleApp, 300);
    }

    // iOS ignores user-scalable=no, so block pinch zoom; the app scales itself anyway
    const preventGesture = (event: Event) => event.preventDefault();
    const preventPinch = (event: TouchEvent) => {
      if (event.touches.length > 1) event.preventDefault();
    };

    window.addEventListener("load", scaleApp);
    window.addEventListener("resize", scaleApp);
    // Focus moving in and out of a field is what raises and drops the keyboard
    window.addEventListener("focusin", scaleAfterKeyboard);
    window.addEventListener("focusout", scaleAfterKeyboard);
    window.addEventListener("orientationchange", scaleApp);
    // Still worth listening: if anything does manage to scroll, re-place the app
    window.addEventListener("scroll", scaleApp, { passive: true });
    window.visualViewport?.addEventListener("resize", scaleApp);
    window.visualViewport?.addEventListener("scroll", scaleApp);
    document.addEventListener("gesturestart", preventGesture);
    document.addEventListener("gesturechange", preventGesture);
    document.addEventListener("touchmove", preventPinch, { passive: false });

    scaleApp();

    return () => {
      clearTimeout(settle);
      window.removeEventListener("load", scaleApp);
      window.removeEventListener("resize", scaleApp);
      window.removeEventListener("focusin", scaleAfterKeyboard);
      window.removeEventListener("focusout", scaleAfterKeyboard);
      window.removeEventListener("orientationchange", scaleApp);
      window.removeEventListener("scroll", scaleApp);
      window.visualViewport?.removeEventListener("resize", scaleApp);
      window.visualViewport?.removeEventListener("scroll", scaleApp);
      document.removeEventListener("gesturestart", preventGesture);
      document.removeEventListener("gesturechange", preventGesture);
      document.removeEventListener("touchmove", preventPinch);
    };
  }, []);

  return (
    <Provider>
      <div className="flex h-screen" data-active={isLoaded}>
        <div className="w-[1100px] h-[825px] mx-auto my-[5rem] relative">
          <Routes>
            <Route path="/" element={<Landing />} />
            <Route path="/skills" element={<Skills />} />
            <Route path="/equip" element={<Equip />} />
            {/* The tabs are addressable: /projects/websites, /contact/guestbook.
                Optional, so /projects and /contact still open the first tab. */}
            <Route path="/projects/:projectsTab?" element={<Projects />} />
            <Route path="/history/:historyType?" element={<MemCardSelector />} />
            <Route path="/config" element={<Config />} />
            <Route path="/resume" element={<Resume />} />
            <Route path="/contact/:contactTab?" element={<Contact />} />
            <Route path="/name" element={<NameEntry />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
          <Menu />
        </div>
      </div>
    </Provider>
  )
}

export default App;
