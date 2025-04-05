import React, { useState } from 'react';

const TerminalHeader = ({ 
  connectionStatus, 
  serverInfo, 
  handleInputChange, 
  connectSSH, 
  disconnectSSH, 
  isConnected,
  connectionHistory,
  loadSavedConnection,
  clearConnectionHistory
}) => {
  const [showHistory, setShowHistory] = useState(false);
  
  // Format date for display
  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleString();
  };
  
  return (
    <div className="connection-controls">
      <div className="status-bar">
        <span className={`status-indicator ${isConnected ? 'connected' : 'disconnected'}`}></span>
        <span className="status-text">{connectionStatus}</span>
        
        {connectionHistory.length > 0 && (
          <div className="history-controls">
            <button 
              className="history-button"
              onClick={() => setShowHistory(!showHistory)}
            >
              {showHistory ? 'Hide History' : 'Show History'}
            </button>
            {showHistory && (
              <button 
                className="clear-history-button"
                onClick={clearConnectionHistory}
                title="Remove all saved connections"
              >
                Clear History
              </button>
            )}
          </div>
        )}
      </div>
      
      {showHistory && connectionHistory.length > 0 && (
        <div className="connection-history">
          <h4>Recent Connections</h4>
          <div className="history-list">
            {connectionHistory.map((conn, index) => (
              <div key={index} className="history-item" onClick={() => loadSavedConnection(conn)}>
                <div className="history-details">
                  <span className="history-host">{conn.host}:{conn.port}</span>
                  <span className="history-username">{conn.username}</span>
                  {conn.useKeyAuth && (
                    <span className="auth-method">(Key Authentication)</span>
                  )}
                </div>
                <span className="history-timestamp">{formatDate(conn.timestamp)}</span>
              </div>
            ))}
          </div>
        </div>
      )}
      
      <div className="connection-form">
        <div className="form-row">
          <label>Host:</label>
          <input 
            type="text" 
            name="host" 
            value={serverInfo.host} 
            onChange={handleInputChange}
            placeholder="IP address or hostname"
          />
          
          <label>Port:</label>
          <input 
            type="number" 
            name="port" 
            value={serverInfo.port} 
            onChange={handleInputChange}
            placeholder="22"
          />
        </div>
        
        <div className="form-row">
          <label>Username:</label>
          <input 
            type="text" 
            name="username" 
            value={serverInfo.username} 
            onChange={handleInputChange}
            placeholder="username"
          />
        </div>
        
        <div className="auth-toggle">
          <label>
            <input
              type="checkbox"
              checked={serverInfo.useKeyAuth}
              onChange={(e) => handleInputChange({
                target: {
                  name: 'useKeyAuth',
                  value: e.target.checked
                }
              })}
            />
            Use SSH Key Authentication
          </label>
        </div>

        {serverInfo.useKeyAuth ? (
          <div className="form-row key-auth">
            <label>Private Key:</label>
            <textarea
              name="privateKey"
              value={serverInfo.privateKey}
              onChange={handleInputChange}
              placeholder="Paste your private key here"
              rows={3}
            />
            
            <label>Passphrase:</label>
            <input
              type="password"
              name="passphrase"
              value={serverInfo.passphrase}
              onChange={handleInputChange}
              placeholder="Leave empty if no passphrase"
            />
          </div>
        ) : (
          <div className="form-row">
            <label>Password:</label>
            <input
              type="password"
              name="password"
              value={serverInfo.password}
              onChange={handleInputChange}
              placeholder="SSH password"
            />
          </div>
        )}
        
        <div className="button-row">
          {connectionStatus === 'SSH Connected' ? (
            <button 
              className="disconnect-button" 
              onClick={disconnectSSH}
            >
              Disconnect
            </button>
          ) : (
            <button 
              className="connect-button" 
              onClick={connectSSH} 
              disabled={!isConnected}
            >
              Connect
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default TerminalHeader;