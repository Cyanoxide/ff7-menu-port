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
    function scaleApp() {
      const app = document.getElementById("root");
      if (app) {
        // The layout viewport stays stable while pinch-zooming, unlike innerWidth/innerHeight
        const viewportWidth = document.documentElement.clientWidth;
        const viewportHeight = document.documentElement.clientHeight;
        const scale = Math.min(
          viewportWidth / DESIGN_WIDTH,
          viewportHeight / canvasHeight(viewportWidth, viewportHeight)
        );
        /**
         * Centres the element's own box, measured rather than assumed, and is
         * allowed to go negative so a box taller than the window overhangs
         * evenly instead of hanging off the bottom. offsetHeight is layout
         * pixels, so the transform does not feed back into it.
         *
         * This used to centre the design canvas and clamp at 0, which is the
         * same answer whenever the canvas and the box are the same height —
         * every case before the compact canvas existed.
         */
        const offsetY = (viewportHeight - app.offsetHeight * scale) / 2;
        app.style.transform = `translateY(${offsetY}px) scale(${scale})`;
      }
    }

    // iOS ignores user-scalable=no, so block pinch zoom; the app scales itself anyway
    const preventGesture = (event: Event) => event.preventDefault();
    const preventPinch = (event: TouchEvent) => {
      if (event.touches.length > 1) event.preventDefault();
    };

    window.addEventListener("load", scaleApp);
    window.addEventListener("resize", scaleApp);
    window.addEventListener("orientationchange", scaleApp);
    window.visualViewport?.addEventListener("resize", scaleApp);
    window.visualViewport?.addEventListener("scroll", scaleApp);
    document.addEventListener("gesturestart", preventGesture);
    document.addEventListener("gesturechange", preventGesture);
    document.addEventListener("touchmove", preventPinch, { passive: false });

    scaleApp();

    return () => {
      window.removeEventListener("load", scaleApp);
      window.removeEventListener("resize", scaleApp);
      window.removeEventListener("orientationchange", scaleApp);
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
            <Route path="/projects" element={<Projects />} />
            <Route path="/history" element={<MemCardSelector />} />
            <Route path="/config" element={<Config />} />
            <Route path="/resume" element={<Resume />} />
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
