import ContentBox from './components/contentBox/ContentBox'
import { useState, useEffect } from 'react';

function App() {
  interface PartyMember {
    name: string;
    level: number;
    hp: number;
    mp: number;
    limit_level: number;
    image_path: string;
  }

  const [partyMember, setPartyMember] = useState<PartyMember | null>(null);

  useEffect(() => {
    fetch("http://localhost:8000/partymember/1")
      .then(res => res.json())
      .then(data => {
        console.log(data)
        setPartyMember(data)
      });
  }, [])

  return (
    <>
      <div className="flex h-screen">
        <div className="w-[1100px] h-[800px] m-auto relative">
          <ContentBox className="w-[1000px] h-[750px] m-auto" top={25}>{partyMember && partyMember.name}</ContentBox>
          <ContentBox className="w-[275px] h-[500px] m-auto" right={0}>Test</ContentBox>
          <ContentBox className="w-[275px] h-[100px] m-auto" right={0} bottom={85}>Test</ContentBox>
          <ContentBox className="w-[500px] h-[75px] m-auto" right={0} bottom={0}>Test</ContentBox>
        </div>
      </div>
    </>
  )
}

export default App;
