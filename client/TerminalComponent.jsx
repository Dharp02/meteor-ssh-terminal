// TerminalComponent.jsx
import React, { useState } from 'react';
import TerminalInstance from '../imports/ui/components/TerminalInstance';
import './main.css';

const TerminalComponent = () => {
  const [terminals, setTerminals] = useState([]);
  const [activeTab, setActiveTab] = useState(null);

  const createNewTerminalTab = () => {
    const id = Date.now();
    const newTab = {
      id,
      title: `Terminal ${terminals.length + 1}`,
    };
    setTerminals(prev => [...prev, newTab]);
    setActiveTab(id);
  };

  const closeTab = (id) => {
    setTerminals(prev => prev.filter(tab => tab.id !== id));
    if (activeTab === id && terminals.length > 1) {
      const otherTab = terminals.find(tab => tab.id !== id);
      setActiveTab(otherTab?.id || null);
    } else if (terminals.length === 1) {
      setActiveTab(null);
    }
  };

  return (
    <div className="terminal-page">
      <div className="tabs-bar">
        {terminals.map(tab => (
          <button
            key={tab.id}
            className={`tab-btn ${tab.id === activeTab ? 'active' : ''}`}
            onClick={() => setActiveTab(tab.id)}
          >
            {tab.title}
            <span className="close-btn" onClick={(e) => { e.stopPropagation(); closeTab(tab.id); }}>&times;</span>
          </button>
        ))}
        <button className="tab-btn add-tab" onClick={createNewTerminalTab}>+</button>
      </div>
      <div className="terminal-container">
        {terminals.map(tab => (
          tab.id === activeTab ? (
            <TerminalInstance key={tab.id} tabId={tab.id} />
          ) : null
        ))}
      </div>
    </div>
  );
};

export default TerminalComponent;