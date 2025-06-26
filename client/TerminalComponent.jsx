// client/TerminalComponent.jsx - Updated to include user info and logout
import React, { useState } from 'react';
import TerminalInstance from '/imports/ui/components/TerminalInstance.jsx';
import ActiveContainersPanel from '/imports/ui/components/ActiveContainersPanel';
import EnhancedChatbot from '/imports/ui/components/EnhancedChatbox';
import UserMenu from '/imports/ui/components/UserMenu';
import './main.css';

const TerminalComponent = ({ currentUser, onLogout }) => {
  const [terminals, setTerminals] = useState([]);
  const [activeTab, setActiveTab] = useState(null);
  const [isTerminalExpanded, setIsTerminalExpanded] = useState(false);
  const [isTerminalFullscreen, setIsTerminalFullscreen] = useState(false);

  const createNewTerminalTab = (connectionInfo = null) => {
    const id = Date.now();
    const newTab = {
      id,
      title: connectionInfo ? `${connectionInfo.name}` : `Terminal ${terminals.length + 1}`,
      isEditing: false,
      connectionInfo
    };
    setTerminals(prev => [...prev, newTab]);
    setActiveTab(id);
    
    if (!isTerminalExpanded) {
      setIsTerminalExpanded(true);
    }
  };

  const connectToContainer = (containerInfo) => {
    const connectionInfo = {
      host: 'localhost',
      port: containerInfo.port,
      username: 'root',
      password: 'password123',
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
    if (isTerminalExpanded && isTerminalFullscreen) {
      setIsTerminalFullscreen(false);
    }
  };

  const toggleFullscreen = () => {
    setIsTerminalFullscreen(prev => !prev);
    if (!isTerminalFullscreen) {
      setIsTerminalExpanded(true);
    }
  };

  const minimizeTerminal = () => {
    setIsTerminalFullscreen(false);
    setIsTerminalExpanded(true);
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
      {/* Header with User Menu - Hidden in fullscreen */}
      {!isTerminalFullscreen && (
        <div className="page-header">
          <h1>SSH Terminal</h1>
          <UserMenu currentUser={currentUser} onLogout={onLogout} />
        </div>
      )}
      
      {/* Active Containers Panel */}
      {!isTerminalFullscreen && (
        <div className={`active-containers-panel ${isTerminalExpanded ? 'normal' : 'expanded'}`}>
          <ActiveContainersPanel onConnectToContainer={connectToContainer} />
        </div>
      )}

      {/* Terminal Container */}
      <div className={`terminal-container ${getTerminalContainerClass()}`}>
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

        <div className="terminal-content" style={{ display: isTerminalExpanded ? 'block' : 'none' }}>
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
      </div>

      {!isTerminalFullscreen && <EnhancedChatbot />}
    </div>
  );
};

export default TerminalComponent;