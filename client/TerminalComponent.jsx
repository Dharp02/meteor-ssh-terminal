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

  const createNewTerminalTab = (connectionInfo = null) => {
    const id = Date.now();
    const newTab = {
      id,
      title: connectionInfo ? `${connectionInfo.name}` : `Terminal ${terminals.length + 1}`,
      isEditing: false,
      connectionInfo // Store connection info with the tab
    };
    setTerminals(prev => [...prev, newTab]);
    setActiveTab(id);
    
    // Auto-expand terminal when creating first tab
    if (!isTerminalExpanded) {
      setIsTerminalExpanded(true);
    }
  };

  // Add a method to handle container connections
  const connectToContainer = (containerInfo) => {
    // Create a new tab with pre-filled connection info
    const connectionInfo = {
      host: 'localhost',
      port: containerInfo.port,
      username: 'root',
      password: 'password123', // Default password from Dockerfile
      name: containerInfo.name
    };
    createNewTerminalTab(connectionInfo);
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
    // If collapsing, also exit fullscreen
    if (isTerminalExpanded && isTerminalFullscreen) {
      setIsTerminalFullscreen(false);
    }
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
    setIsTerminalExpanded(true); // Keep expanded but not fullscreen
  };

  const getPageClass = () => {
    if (isTerminalFullscreen) return 'fullscreen-mode';
    return '';
  };

  const getTerminalContainerClass = () => {
    if (isTerminalFullscreen) return 'fullscreen';
    if (isTerminalExpanded) return 'expanded';
    return 'collapsed';
  };

  return (
    <div className={`terminal-page ${getPageClass()}`}>
      {/* Header - Hidden in fullscreen */}
      {!isTerminalFullscreen && (
        <h1>SSH Terminal</h1>
      )}
      
      {/* Active Containers Panel - Expands when terminal is collapsed, hidden in fullscreen */}
      {!isTerminalFullscreen && (
        <div className={`active-containers-panel ${isTerminalExpanded ? 'normal' : 'expanded'}`}>
          <ActiveContainersPanel onConnectToContainer={connectToContainer} />
        </div>
      )}

      {/* Terminal Container - Slides to bottom when collapsed */}
      <div className={`terminal-container ${getTerminalContainerClass()}`}>
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

          {/* Terminal Controls - Positioned absolutely when expanded */}
          {isTerminalExpanded && (
            <div className="terminal-controls">
              <button 
                className="control-btn minimize-btn"
                onClick={minimizeTerminal}
                title="Minimize (Half Screen)"
                style={{ display: isTerminalFullscreen ? 'flex' : 'none' }}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M6 12L18 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                </svg>
              </button>
              
              <button 
                className="control-btn fullscreen-btn"
                onClick={toggleFullscreen}
                title={isTerminalFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}
              >
                {isTerminalFullscreen ? (
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M8 3V5H5V8H3V5C3 3.89543 3.89543 3 5 3H8ZM16 3H19C20.1046 3 21 3.89543 21 5V8H19V5H16V3ZM21 16V19C21 20.1046 20.1046 21 19 21H16V19H19V16H21ZM8 21H5C3.89543 21 3 20.1046 3 19V16H5V19H8V21Z" fill="currentColor"/>
                  </svg>
                ) : (
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M3 7H5V5H8V3H5C3.89543 3 3 3.89543 3 5V7ZM3 17V19C3 20.1046 3.89543 21 5 21H8V19H5V17H3ZM16 3V5H19V7H21V5C21 3.89543 20.1046 3 19 3H16ZM19 17V19H16V21H19C20.1046 21 21 20.1046 21 19V17H19Z" fill="currentColor"/>
                  </svg>
                )}
              </button>
            </div>
          )}
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
            onClick={() => createNewTerminalTab()}
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
                    initialConnection={tab.connectionInfo}
                  />
                </div>
              ))
            )}
          </div>
        )}
      </div>

      {/* Add the Chatbot component - Hidden in fullscreen */}
      {!isTerminalFullscreen && <EnhancedChatbot />}
    </div>
  );
};

export default TerminalComponent;