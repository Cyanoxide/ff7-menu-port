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

function App() {
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    setIsLoaded(true);
  }, []);

  useEffect(() => {
    function scaleApp() {
      const app = document.getElementById("root");
      if (app) {
        const scale = Math.min(
          window.innerWidth / 1250,
          window.innerHeight / 975
        );
        const offsetY = Math.max(0, (window.innerHeight - 975 * scale) / 2);
        app.style.transform = `translateY(${offsetY}px) scale(${scale})`;
      }
    }

    window.addEventListener("load", scaleApp);
    window.addEventListener("resize", scaleApp);
    window.addEventListener("orientationchange", scaleApp);
    window.visualViewport?.addEventListener("resize", scaleApp);
    window.visualViewport?.addEventListener("scroll", scaleApp);

    scaleApp();
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
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
          <Menu />
        </div>
      </div>
    </Provider>
  )
}

export default App;
