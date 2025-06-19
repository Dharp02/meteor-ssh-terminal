import React, { useState } from 'react';
import TerminalInstance from '/imports/ui/components/TerminalInstance.jsx';
import ActiveContainersPanel from '/imports/ui/components/ActiveContainersPanel';
import Chatbot from '/imports/ui/components/Chatbox'; 
import './main.css';
import EnhancedChatbot from '/imports/ui/components/EnhancedChatbox';

const TerminalComponent = () => {
  const [terminals, setTerminals] = useState([]);
  const [activeTab, setActiveTab] = useState(null);
  const [isTerminalExpanded, setIsTerminalExpanded] = useState(false); // Hidden by default
  const [isTerminalFullscreen, setIsTerminalFullscreen] = useState(false);

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
    setTerminals(prev => {
      const newTerminals = prev.filter(tab => tab.id !== id);
      return newTerminals;
    });
    
    if (activeTab === id) {
      const remainingTerminals = terminals.filter(tab => tab.id !== id);
      if (remainingTerminals.length > 0) {
        const fallback = remainingTerminals[remainingTerminals.length - 1];
        setActiveTab(fallback.id);
      } else {
        setActiveTab(null);
      }
    }
  };

  const renameTab = (id, newTitle) => {
    if (newTitle.trim()) {
      setTerminals(prev => prev.map(tab => 
        tab.id === id ? { ...tab, title: newTitle.trim() } : tab
      ));
    }
  };

  const finishEditing = (id) => {
    setTerminals(prev => prev.map(tab => 
      tab.id === id ? { ...tab, isEditing: false } : tab
    ));
  };

  const startEditing = (id) => {
    setTerminals(prev => prev.map(tab => 
      tab.id === id ? { ...tab, isEditing: true } : tab
    ));
  };

  const toggleTerminal = () => {
    setIsTerminalExpanded(prev => !prev);
  };

  const toggleFullscreen = () => {
    setIsTerminalFullscreen(prev => !prev);
    // If entering fullscreen, make sure terminal is expanded
    if (!isTerminalFullscreen) {
      setIsTerminalExpanded(true);
    }
  };

  const minimizeTerminal = () => {
    setIsTerminalFullscreen(false);
    setIsTerminalExpanded(false);
  };

  return (
    <div className="terminal-page">
      <h1>SSH Terminal</h1>
      
      {/* Active Containers Panel - Expands when terminal is collapsed */}
      <div className={`active-containers-panel ${isTerminalExpanded ? 'normal' : 'expanded'}`}>
        <ActiveContainersPanel />
      </div>

      {/* Terminal Container - Slides to bottom when collapsed */}
      <div className={`terminal-container ${isTerminalExpanded ? 'expanded' : 'collapsed'}`}>
        {/* Terminal Toggle Button - Inside terminal container */}
        <div className="terminal-toggle-container">
          <button 
            className="terminal-toggle-btn"
            onClick={toggleTerminal}
            title={isTerminalExpanded ? 'Hide Terminal' : 'Show Terminal'}
          >
            <span className="toggle-icon">
              {isTerminalExpanded ? (
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M6 9L12 15L18 9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              ) : (
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M18 15L12 9L6 15" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              )}
            </span>
            <span className="toggle-text">
              {isTerminalExpanded ? 'Hide Terminal' : 'Show Terminal'}
            </span>
          </button>
        </div>
        {/* Fixed Tab Bar - Always visible */}
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
                  autoFocus
                  onBlur={(e) => {
                    renameTab(tab.id, e.target.value);
                    finishEditing(tab.id);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      renameTab(tab.id, e.target.value);
                      finishEditing(tab.id);
                    } else if (e.key === 'Escape') {
                      finishEditing(tab.id);
                    }
                  }}
                  onClick={(e) => e.stopPropagation()}
                />
              ) : (
                <span onDoubleClick={() => startEditing(tab.id)} title={tab.title}>
                  {tab.title}
                </span>
              )}
              <button 
                className="close-btn" 
                onClick={(e) => { 
                  e.stopPropagation(); 
                  closeTab(tab.id); 
                }}
                title="Close tab"
              >
                ×
              </button>
            </div>
          ))}
          <button 
            className="add-tab" 
            onClick={createNewTerminalTab}
            title="Add new terminal"
          >
            +
          </button>
        </div>

        {/* Terminal Content Area - Only show when expanded */}
        {isTerminalExpanded && (
          <div className="terminal-content">
            {terminals.length === 0 ? (
              <div style={{ 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'center', 
                height: '100%',
                color: '#7f8c8d',
                fontSize: '18px'
              }}>
                Click the + button to create a new terminal
              </div>
            ) : (
              terminals.map(tab => (
                <div 
                  key={tab.id} 
                  className="terminal-tab-content"
                  style={{ 
                    display: activeTab === tab.id ? 'flex' : 'none',
                    flexDirection: 'column',
                    height: '100%'
                  }}
                >
                  <TerminalInstance 
                    tabId={tab.id} 
                    label={tab.title} 
                    onRename={(newTitle) => renameTab(tab.id, newTitle)} 
                  />
                </div>
              ))
            )}
          </div>
        )}
      </div>

      {/* Add the Chatbot component  */}
      <EnhancedChatbot />
    </div>
  );
};

export default TerminalComponent;