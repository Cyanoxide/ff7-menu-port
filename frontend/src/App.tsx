
import { QueryClientProvider, QueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';

import Menu from './components/Menu/Menu';
import LandingContent from './components/LandingContent/LandingContent';
import ProjectsContent from "./components/ProjectsContent/ProjectsContent";
import SkillsContent from "./components/SkillsContent/SkillsContent";
import HistoryContent from './components/HistoryContent/HistoryContent';

function App() {
  const queryClient = new QueryClient();

  const [isLoaded, setIsLoaded] = useState(false);
  const [activePage, setActivePage] = useState("home");

  useEffect(() => {
    setIsLoaded(true);
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <div className="flex h-screen" data-active={isLoaded}>
        <div className="w-[1100px] h-[825px] m-auto relative">
          {activePage === "home" && <LandingContent />}
          {(activePage === "skills" && <SkillsContent />)}
          {(activePage === "projects" && <ProjectsContent />)}
          {(activePage === "history" && <HistoryContent />)}
          <Menu activePage={activePage} setActivePage={setActivePage} />
        </div>
      </div>
    </QueryClientProvider>
  )
}

export default App;
