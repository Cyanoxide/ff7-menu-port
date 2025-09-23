
import ContentBox from './components/contentBox/ContentBox';
import PartyMember from './components/PartyMember/PartyMember';
import { QueryClientProvider, QueryClient } from '@tanstack/react-query';

function App() {
  const queryClient = new QueryClient();

  return (
    <QueryClientProvider client={queryClient}>
      <div className="flex h-screen">
        <div className="w-[1100px] h-[800px] m-auto relative">
          <ContentBox className="w-[1000px] h-[750px] m-auto" top={25}>
            <PartyMember memberId={1}/>
          </ContentBox>
          <ContentBox className="w-[275px] h-[500px] m-auto" right={0}>Test</ContentBox>
          <ContentBox className="w-[275px] h-[100px] m-auto" right={0} bottom={85}>Test</ContentBox>
          <ContentBox className="w-[500px] h-[75px] m-auto" right={0} bottom={0}>Test</ContentBox>
        </div>
      </div>
    </QueryClientProvider>
  )
}

export default App;
