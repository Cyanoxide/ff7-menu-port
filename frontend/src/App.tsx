import { Provider } from "./context/provider";
import { startViewportProbe } from "./util/viewportProbe";
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
        const scale = Math.min(
          viewportWidth / 1250,
          viewportHeight / 975
        );
        /**
         * offsetTop is where the visible band starts. It is 0 for a keyboard
         * docked at the bottom, but not once the browser has panned the visual
         * viewport, and without it the app would be centred on a band that has
         * moved out from under it.
         */
        const bandTop = window.visualViewport?.offsetTop ?? 0;

        /**
         * And the document's own scroll, which is the part that was missing.
         *
         * translateY places the app in *document* space, so a scrolled document
         * carries it up the screen by exactly that much. Focusing a field is
         * what does it: the browser scrolls to bring the field into view, and
         * `overflow: hidden` on the body stops a *person* scrolling but not the
         * browser. body is 975px tall inside a viewport of 731 or 775, so there
         * is real room to scroll into.
         *
         * Measured on a desktop Safari with the document scrolled 155px: the
         * app was computed at 197.8 and rendered at 42.8, which is 197.8 - 155.
         * With a keyboard up the offset is smaller than the scroll, so the top
         * goes off screen — and nothing puts it back when the keyboard closes,
         * because the scroll stays.
         *
         * Adding it back pins the app to the visible band whatever the document
         * does, rather than fighting the browser for control of the scroll.
         */
        const scrolled = window.scrollY || document.documentElement.scrollTop || 0;

        const offsetY = scrolled + bandTop + Math.max(0, (viewportHeight - 975 * scale) / 2);
        app.style.transform = `translateY(${offsetY}px) scale(${scale})`;
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
    // No-op unless the URL carries ?probe=1
    startViewportProbe();
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
    // The browser scrolls the document to reveal a focused field; the app has
    // to follow that or it is carried off the top of the screen.
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
            <Route path="/projects" element={<Projects />} />
            <Route path="/history" element={<MemCardSelector />} />
            <Route path="/config" element={<Config />} />
            <Route path="/resume" element={<Resume />} />
            <Route path="/contact" element={<Contact />} />
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
