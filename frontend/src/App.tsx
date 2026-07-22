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
          viewportWidth / 1250,
          viewportHeight / 975
        );
        const offsetY = Math.max(0, (viewportHeight - 975 * scale) / 2);
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
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
          <Menu />
        </div>
      </div>
    </Provider>
  )
}

export default App;
