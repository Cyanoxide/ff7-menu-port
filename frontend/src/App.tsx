
import { QueryClientProvider, QueryClient } from '@tanstack/react-query';
import { Provider } from "./context/context";
import { useEffect, useState } from 'react';

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
    const app = document.getElementById('root');
    if (app) {
      const scaleApp = () => {
        const originalWidth = 1250;
        const originalHeight = 975;

        const windowWidth = window.innerWidth;
        const windowHeight = window.innerHeight;

        const scale = Math.min(windowWidth / originalWidth, windowHeight / originalHeight);
        app.style.zoom = String(scale);
      }

      window.addEventListener('load', scaleApp);
      window.addEventListener('resize', scaleApp);
      scaleApp();
    }
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
