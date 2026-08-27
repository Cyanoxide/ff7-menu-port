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
         * Deliberately NOT adding window.scrollY here.
         *
         * It was, briefly, and it made things worse. translateY moves the app
         * in document space, so shifting it down by the scroll also moves the
         * focused field down — the browser scrolls further to chase it, and the
         * two push each other until the keyboard is covering the bottom.
         *
         * #root is position:fixed instead (index.css), so it is out of flow,
         * the document has nothing to scroll, and there is no scroll to correct
         * for. Fixing the cause beats following the symptom.
         */
        const offsetY = bandTop + Math.max(0, (viewportHeight - 975 * scale) / 2);
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
