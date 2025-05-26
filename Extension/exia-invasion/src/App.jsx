// src/App.jsx
import './App.css'

function App() {
  const handleClick = () => {
    chrome.runtime.openOptionsPage()
  };
  
  return (
    <div style={{ width: 250, padding: 20 }}>
      <button onClick={handleClick} style={{ fontSize: 18 }}>
        {chrome.i18n.getMessage("set_accounts")}
      </button>
    </div>
  );
}
export default App;
