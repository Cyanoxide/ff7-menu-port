
import ContentBox from './components/contentBox/ContentBox';
import PartyMember from './components/PartyMember/PartyMember';
import { QueryClientProvider, QueryClient } from '@tanstack/react-query';
import textToSprite from "./util/textToSprite";
import Time from './components/Time/Time';
import Menu from './components/Menu/Menu';
import { useEffect, useState } from 'react';

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
          {activePage === "home" &&
            <>
              <ContentBox className="w-[1000px] h-[720px] m-auto" top={44} data-label="party">
                <PartyMember memberId={1} />
                <ContentBox left={53} bottom={79} right={220} top={303} data-label="bio">
                  <p className="mb-2">{textToSprite("I'm a Senior Web Developer based in")}</p>
                  <p className="mb-6">{textToSprite("Gloucester, UK.")}</p>
                  <p className="mb-6">{textToSprite("Welcome to my WIP sandbox.")}</p>
                  <p className="mb-2">{textToSprite("I plan to add an ever-growing collection")}</p>
                  <p className="mb-2">{textToSprite("of small technical projects here, mostly")}</p>
                  <p className="mb-2">{textToSprite("built with PS1 aesthetics in mind.")}</p>
                </ContentBox>
              </ContentBox>
              <ContentBox className="w-[280px] h-[110px] m-auto" right={0} bottom={110} data-label="metaInfo">
                <ul className="flex justify-between flex-col h-full">
                  <li className="flex justify-between">
                    <span>{textToSprite("Time")}</span>
                    <Time />
                  </li>
                  <li className="flex justify-between">
                    <span>{textToSprite("Gil")}</span>
                    <span>{textToSprite("77777", true)}</span>
                  </li>
                </ul>
              </ContentBox>
              <ContentBox className="w-[535px] h-[95px] m-auto" right={0} bottom={0} data-label="pageInfo">{textToSprite("Homepage")}</ContentBox>
            </>
          }
          {activePage !== "home" && <ContentBox data-label="test">{textToSprite("Test")}</ContentBox>}
          <Menu activePage={activePage} setActivePage={setActivePage} />
        </div>
      </div>
    </QueryClientProvider>
  )
}

export default App;
