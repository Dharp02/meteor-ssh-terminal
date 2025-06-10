import React, { useState } from 'react';
import TerminalInstance from './components/TerminalInstance.jsx';
import SessionPanel from './components/SessionPanel.jsx';
 

export const App = () => {
  const [tabs, setTabs] = useState([{ id: 'tab1', label: 'Terminal 1' }]);
  const [activeTabId, setActiveTabId] = useState('tab1');

  const addNewTab = () => {
    const newId = `tab${Date.now()}`;
    const newTab = { id: newId, label: `Terminal ${tabs.length + 1}` };
    setTabs([...tabs, newTab]);
    setActiveTabId(newId);
  };

  const removeTab = (tabId) => {
    const updated = tabs.filter(t => t.id !== tabId);
    setTabs(updated);
    if (tabId === activeTabId && updated.length > 0) {
      setActiveTabId(updated[0].id);
    }
  };

  return (

    <div>
      <BAD-TAG>hello</BAD-TAG>

    
    <div style={{ padding: '1rem', height: '100vh', display: 'flex', flexDirection: 'row' }}>
      
      {/* Tab bar with + beside each tab */}

      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '1rem' }}>
        {tabs.map(tab => (
          <div
            key={tab.id}
            style={{
              display: 'flex',
              alignItems: 'center',
              background: tab.id === activeTabId ? '#ccc' : '#eee',
              padding: '5px 10px',
              borderRadius: '4px',
              cursor: 'pointer'
            }}
            onClick={() => setActiveTabId(tab.id)}
          >
            {tab.label}
            <button
              onClick={(e) => {
                e.stopPropagation();
                removeTab(tab.id);
              }}
              style={{
                marginLeft: '8px',
                background: 'transparent',
                border: 'none',
                cursor: 'pointer',
                fontWeight: 'bold'
              }}
            >
              ×
            </button>
          </div>
        ))}
        <button onClick={addNewTab} style={{ fontSize: '20px', padding: '0 10px' }}>+</button>
      </div>

      {/* Main Content */}

      <div style={{ display: 'flex', flex: 1 }}>
        <div style={{ flex: 2 }}>
          {tabs.map(tab =>
            tab.id === activeTabId ? (
              <TerminalInstance key={tab.id} tabId={tab.id} />
            ) : null
          )}
        </div>
        

        <div style={{ flex: 1 }}>
          <SessionPanel />
        </div>
      </div>
    </div>
  </div>
  );
};
