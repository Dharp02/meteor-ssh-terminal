// imports/ui/components/ConnectionForm.jsx
import React, { useState } from 'react';

const ConnectionForm = ({
  serverInfo,
  onInputChange,
  onConnect,
  onDisconnect,
  isConnected,
  connectionHistory,
  onLoadConnection,
  onClearHistory
}) => {
  const [showHistory, setShowHistory] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);

  const handleConnect = async () => {
    setIsConnecting(true);
    try {
      await onConnect();
    } finally {
      setTimeout(() => setIsConnecting(false), 2000); // Reset after 2 seconds
    }
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleString();
  };

  const validateForm = () => {
    const { host, username, password, privateKey, useKeyAuth } = serverInfo;
    
    if (!host.trim() || !username.trim()) {
      return false;
    }
    
    if (useKeyAuth && !privateKey.trim()) {
      return false;
    }
    
    if (!useKeyAuth && !password.trim()) {
      return false;
    }
    
    return true;
  };

  const getConnectionStatus = () => {
    if (isConnecting) return 'Connecting...';
    if (isConnected) return 'Connected';
    return 'Disconnected';
  };

  const getStatusColor = () => {
    if (isConnecting) return '#f39c12';
    if (isConnected) return '#2ecc71';
    return '#e74c3c';
  };

  return (
    <div className="connection-form-container">
      {/* Status Header */}
      <div className="connection-status-header">
        <div className="status-indicator-group">
          <div 
            className="status-dot"
            style={{ backgroundColor: getStatusColor() }}
          ></div>
          <span className="status-text">{getConnectionStatus()}</span>
        </div>
        
        {connectionHistory.length > 0 && (
          <div className="history-controls">
            <button 
              className="history-toggle-btn"
              onClick={() => setShowHistory(!showHistory)}
              title="Connection History"
            >
              📋 {showHistory ? 'Hide' : 'Show'} History
            </button>
          </div>
        )}
      </div>

      {/* Connection History */}
      {showHistory && connectionHistory.length > 0 && (
        <div className="connection-history">
          <div className="history-header">
            <h4>Recent Connections</h4>
            <button 
              className="clear-history-btn"
              onClick={onClearHistory}
              title="Clear all history"
            >
              🗑️ Clear
            </button>
          </div>
          
          <div className="history-list">
            {connectionHistory.map((conn, index) => (
              <div 
                key={index} 
                className="history-item"
                onClick={() => onLoadConnection(conn)}
                title="Click to load connection"
              >
                <div className="history-main">
                  <div className="history-connection">
                    <span className="history-host">{conn.host}:{conn.port}</span>
                    <span className="history-username">@{conn.username}</span>
                  </div>
                  {conn.useKeyAuth && (
                    <span className="auth-badge">🔑 Key Auth</span>
                  )}
                </div>
                <div className="history-time">
                  {formatDate(conn.timestamp)}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Main Connection Form */}
      <div className="connection-form">
        <div className="form-section">
          <h3>SSH Connection</h3>
          
          {/* Basic Connection Info */}
          <div className="form-row">
            <div className="input-group">
              <label htmlFor="host">Host *</label>
              <input
                id="host"
                type="text"
                name="host"
                value={serverInfo.host}
                onChange={onInputChange}
                placeholder="IP address or hostname"
                disabled={isConnected}
                required
              />
            </div>
            
            <div className="input-group port-group">
              <label htmlFor="port">Port</label>
              <input
                id="port"
                type="number"
                name="port"
                value={serverInfo.port}
                onChange={onInputChange}
                placeholder="22"
                min="1"
                max="65535"
                disabled={isConnected}
              />
            </div>
          </div>

          <div className="form-row">
            <div className="input-group">
              <label htmlFor="username">Username *</label>
              <input
                id="username"
                type="text"
                name="username"
                value={serverInfo.username}
                onChange={onInputChange}
                placeholder="SSH username"
                disabled={isConnected}
                required
              />
            </div>
          </div>

          {/* Authentication Method Toggle */}
          <div className="auth-method-toggle">
            <label className="toggle-label">
              <input
                type="checkbox"
                checked={serverInfo.useKeyAuth}
                onChange={(e) => onInputChange({
                  target: {
                    name: 'useKeyAuth',
                    type: 'checkbox',
                    checked: e.target.checked
                  }
                })}
                disabled={isConnected}
              />
              <span className="toggle-switch"></span>
              Use SSH Key Authentication
            </label>
          </div>

          {/* Authentication Fields */}
          {serverInfo.useKeyAuth ? (
            <div className="auth-section key-auth">
              <div className="form-row">
                <div className="input-group">
                  <label htmlFor="privateKey">Private Key *</label>
                  <textarea
                    id="privateKey"
                    name="privateKey"
                    value={serverInfo.privateKey}
                    onChange={onInputChange}
                    placeholder="-----BEGIN PRIVATE KEY-----&#10;...&#10;-----END PRIVATE KEY-----"
                    rows={6}
                    disabled={isConnected}
                    required
                  />
                  <small className="input-hint">
                    Paste your private key here (RSA, DSA, ECDSA, or Ed25519)
                  </small>
                </div>
              </div>
              
              <div className="form-row">
                <div className="input-group">
                  <label htmlFor="passphrase">Passphrase</label>
                  <input
                    id="passphrase"
                    type="password"
                    name="passphrase"
                    value={serverInfo.passphrase}
                    onChange={onInputChange}
                    placeholder="Enter passphrase (if required)"
                    disabled={isConnected}
                  />
                  <small className="input-hint">
                    Leave empty if your private key has no passphrase
                  </small>
                </div>
              </div>
            </div>
          ) : (
            <div className="auth-section password-auth">
              <div className="form-row">
                <div className="input-group">
                  <label htmlFor="password">Password *</label>
                  <input
                    id="password"
                    type="password"
                    name="password"
                    value={serverInfo.password}
                    onChange={onInputChange}
                    placeholder="SSH password"
                    disabled={isConnected}
                    required
                  />
                </div>
              </div>
            </div>
          )}

          {/* Advanced Options */}
          <div className="advanced-section">
            <button
              type="button"
              className="advanced-toggle"
              onClick={() => setShowAdvanced(!showAdvanced)}
            >
              ⚙️ Advanced Options {showAdvanced ? '▼' : '▶'}
            </button>
            
            {showAdvanced && (
              <div className="advanced-options">
                <div className="form-row">
                  <div className="input-group">
                    <label htmlFor="keepAlive">Keep Alive Interval (seconds)</label>
                    <input
                      id="keepAlive"
                      type="number"
                      name="keepAlive"
                      value={serverInfo.keepAlive || 30}
                      onChange={onInputChange}
                      min="10"
                      max="300"
                      disabled={isConnected}
                    />
                  </div>
                  
                  <div className="input-group">
                    <label htmlFor="timeout">Connection Timeout (seconds)</label>
                    <input
                      id="timeout"
                      type="number"
                      name="timeout"
                      value={serverInfo.timeout || 30}
                      onChange={onInputChange}
                      min="5"
                      max="120"
                      disabled={isConnected}
                    />
                  </div>
                </div>
                
                <div className="form-row">
                  <div className="checkbox-group">
                    <label>
                      <input
                        type="checkbox"
                        name="compression"
                        checked={serverInfo.compression || false}
                        onChange={onInputChange}
                        disabled={isConnected}
                      />
                      Enable compression
                    </label>
                  </div>
                  
                  <div className="checkbox-group">
                    <label>
                      <input
                        type="checkbox"
                        name="x11Forwarding"
                        checked={serverInfo.x11Forwarding || false}
                        onChange={onInputChange}
                        disabled={isConnected}
                      />
                      Enable X11 forwarding
                    </label>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Connection Buttons */}
          <div className="connection-actions">
            {isConnected ? (
              <button
                type="button"
                className="disconnect-btn"
                onClick={onDisconnect}
              >
                🔌 Disconnect
              </button>
            ) : (
              <button
                type="button"
                className="connect-btn"
                onClick={handleConnect}
                disabled={!validateForm() || isConnecting}
              >
                {isConnecting ? (
                  <>
                    <span className="spinner"></span>
                    Connecting...
                  </>
                ) : (
                  <>
                    🚀 Connect
                  </>
                )}
              </button>
            )}
            
            {!isConnected && (
              <button
                type="button"
                className="test-connection-btn"
                onClick={() => {
                  // Could implement a test connection feature
                  console.log('Test connection feature - to be implemented');
                }}
                disabled={!validateForm() || isConnecting}
              >
                🔍 Test Connection
              </button>
            )}
          </div>

          {/* Connection Tips */}
          <div className="connection-tips">
            <h4>💡 Connection Tips</h4>
            <ul>
              <li>Use SSH keys for better security instead of passwords</li>
              <li>Default SSH port is 22, but many servers use custom ports</li>
              <li>Sessions automatically expire after 30 minutes of inactivity</li>
              <li>Use Ctrl+Shift+C/V for copy/paste in the terminal</li>
              <li>Enable compression for slower network connections</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ConnectionForm;