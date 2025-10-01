
import ContentBox from './components/contentBox/ContentBox';
import PartyMember from './components/PartyMember/PartyMember';
import { QueryClientProvider, QueryClient } from '@tanstack/react-query';
import textToSprite from "./util/textToSprite";
import Time from './components/Time/Time';

function App() {
  const queryClient = new QueryClient();

  return (
    <QueryClientProvider client={queryClient}>
      <div className="flex h-screen">
        <div className="w-[1100px] h-[825px] m-auto relative">
          <ContentBox className="w-[1000px] h-[720px] m-auto" top={44}> {/* Right */}
            <PartyMember memberId={1} />
          </ContentBox>
          <ContentBox className="w-[270px] h-[530px] m-auto" right={0} data-label="menu"> {/* Down */}
            <ul>
              <li className="h-[29px] mb-4">{textToSprite("Item")}</li>
              <li className="h-[29px] mb-4">{textToSprite("Magic")}</li>
              <li className="h-[29px] mb-4">{textToSprite("Materia")}</li>
              <li className="h-[29px] mb-4">{textToSprite("Equip")}</li>
              <li className="h-[29px] mb-4">{textToSprite("Status")}</li>
              <li className="h-[29px] mb-4">{textToSprite("Order")}</li>
              <li className="h-[29px] mb-4">{textToSprite("Limit")}</li>
              <li className="h-[29px] mb-4">{textToSprite("Config")}</li>
              <li className="h-[29px] mb-4">{textToSprite("PHS")}</li>
              <li className="h-[29px] mb-4">{textToSprite("Save")}</li>
              <li className="h-[29px] mb-4">{textToSprite("Quit")}</li>
            </ul>
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
          </ContentBox> {/* left */}
          <ContentBox className="w-[535px] h-[95px] m-auto" right={0} bottom={0} data-label="pageInfo">{textToSprite("Sector 7 Slums")}</ContentBox> {/* Up */}
        </div>
      </div>
    </QueryClientProvider>
  )
}

export default App;
