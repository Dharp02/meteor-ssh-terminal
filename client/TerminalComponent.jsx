// TerminalComponent.jsx
import React, { useState } from 'react';
import TerminalInstance from '/imports/ui/components/TerminalInstance.jsx';
import './main.css';

const TerminalComponent = () => {
  const [terminals, setTerminals] = useState([]);
  const [activeTab, setActiveTab] = useState(null);

  const createNewTerminalTab = () => {
    const id = Date.now();
    const newTab = {
      id,
      title: `Terminal ${terminals.length + 1}`,
      isEditing: false
    };
    setTerminals(prev => [...prev, newTab]);
    setActiveTab(id);
  };

  const closeTab = (id) => {
    setTerminals(prev => prev.filter(tab => tab.id !== id));
    if (activeTab === id && terminals.length > 1) {
      const fallback = terminals.find(tab => tab.id !== id);
      if (fallback) setActiveTab(fallback.id);
    }
  };

  const renameTab = (id, newTitle) => {
    setTerminals(prev => prev.map(tab => tab.id === id ? { ...tab, title: newTitle } : tab));
  };

  const finishEditing = (id) => {
    setTerminals(prev => prev.map(tab => tab.id === id ? { ...tab, isEditing: false } : tab));
  };

  const startEditing = (id) => {
    setTerminals(prev => prev.map(tab => tab.id === id ? { ...tab, isEditing: true } : tab));
  };

  return (
    <div>
      <div className="tab-bar">
        {terminals.map(tab => (
          <div
            key={tab.id}
            className={`tab ${activeTab === tab.id ? 'active' : ''}`}
            onClick={() => setActiveTab(tab.id)}
          >
            {tab.isEditing ? (
              <input
                type="text"
                className="tab-rename-input"
                defaultValue={tab.title}
                ref={(input) => { if (input) input.focus(); }}
                onBlur={(e) => {
                  renameTab(tab.id, e.target.value);
                  finishEditing(tab.id);
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    renameTab(tab.id, e.target.value);
                    finishEditing(tab.id);
                  }
                }}
              />
            ) : (
              <span onDoubleClick={() => startEditing(tab.id)}>{tab.title}</span>
            )}
            <button className="close-btn" onClick={(e) => { e.stopPropagation(); closeTab(tab.id); }}>×</button>
          </div>
        ))}
        <button className="add-tab" onClick={createNewTerminalTab}>+</button>
      </div>

      {terminals.map(tab => (
        <div key={tab.id} style={{ display: activeTab === tab.id ? 'block' : 'none' }}>
          <TerminalInstance tabId={tab.id} label={tab.title} onRename={(newTitle) => renameTab(tab.id, newTitle)} />
        </div>
      ))}
    </div>
  );
};

export default TerminalComponent;
