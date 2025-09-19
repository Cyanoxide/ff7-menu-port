import ContentBox from './components/contentBox/contentBox'

function App() {

  fetch("http://localhost:8000/partymember/1")
    .then(res => res.json())
    .then(data => console.log(data));

  return (
    <>
      <ContentBox>Test</ContentBox>
    </>
  )
}

export default App;
