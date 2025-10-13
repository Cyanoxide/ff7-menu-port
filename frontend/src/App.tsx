
import { QueryClientProvider, QueryClient } from '@tanstack/react-query';
import { Provider, useContext } from "./context/context";
import { use, useEffect, useState } from 'react';

import Menu from './components/Menu/Menu';
import LandingContent from './components/LandingContent/LandingContent';
import ProjectsContent from "./components/ProjectsContent/ProjectsContent";
import SkillsContent from "./components/SkillsContent/SkillsContent";
import HistoryContent from './components/HistoryContent/HistoryContent';
import ConfigContent from './components/ConfigContent/ConfigContent';

function App() {
  const queryClient = new QueryClient();

  const [isLoaded, setIsLoaded] = useState(false);
  const [activePage, setActivePage] = useState("home");

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
        app.style.transform = `scale(${scale})`;
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
      <QueryClientProvider client={queryClient}>
        <div className="flex h-screen" data-active={isLoaded}>
          <div className="w-[1100px] h-[825px] mx-auto my-[5rem] relative">
            {activePage === "home" && <LandingContent />}
            {(activePage === "skills" && <SkillsContent />)}
            {(activePage === "projects" && <ProjectsContent />)}
            {(activePage === "history" && <HistoryContent />)}
            {(activePage === "config" && <ConfigContent />)}
            <Menu activePage={activePage} setActivePage={setActivePage} />
          </div>
        </div>
      </QueryClientProvider>
    </Provider>
  )
}

export default App;
