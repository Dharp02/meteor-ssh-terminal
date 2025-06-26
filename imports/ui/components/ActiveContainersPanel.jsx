import React, { useEffect, useState, useRef } from 'react';

// Import the new modal component
const ContainerConnectionModal = ({ 
  isOpen, 
  onClose, 
  containerInfo, 
  onConnect 
}) => {
  const [password, setPassword] = useState('');
  const [isConnecting, setIsConnecting] = useState(false);

  const handleConnect = async () => {
    if (!password.trim()) {
      alert('Please enter a password');
      return;
    }

    setIsConnecting(true);
    try {
      await onConnect({
        host: containerInfo.host,
        port: containerInfo.port,
        username: 'root',
        password: password,
        name: containerInfo.name
      });
      onClose();
    } catch (error) {
      console.error('Connection failed:', error);
      alert('Connection failed. Please check your password and try again.');
    } finally {
      setIsConnecting(false);
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !isConnecting) {
      handleConnect();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay">
      <div className="modal-content">
        <div className="modal-header">
          <h3>🔌 Connect to Container</h3>
          <button 
            onClick={onClose} 
            className="modal-close"
            disabled={isConnecting}
          >
            ✕
          </button>
        </div>
        
        <div className="modal-body">
          <div className="connection-details">
            <h4>Connection Details</h4>
            <p><strong>Container:</strong> {containerInfo?.name}</p>
            <p><strong>Host:</strong> {containerInfo?.host}</p>
            <p><strong>Port:</strong> {containerInfo?.port}</p>
            <p><strong>Username:</strong> root</p>
          </div>
          
          <div className="password-input">
            <label htmlFor="container-password">Password *</label>
            <input
              id="container-password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="Enter container password"
              disabled={isConnecting}
              autoFocus
            />
          </div>
        </div>
        
        <div className="modal-footer">
          <button 
            onClick={onClose}
            className="modal-btn cancel-btn"
            disabled={isConnecting}
          >
            Cancel
          </button>
          <button 
            onClick={handleConnect}
            className="modal-btn connect-btn"
            disabled={isConnecting || !password.trim()}
          >
            {isConnecting ? (
              <>
                <div style={{
                  width: '16px',
                  height: '16px',
                  border: '2px solid #ffffff40',
                  borderTop: '2px solid #ffffff',
                  borderRadius: '50%',
                  animation: 'spin 1s linear infinite',
                  marginRight: '8px'
                }} />
                Connecting...
              </>
            ) : (
              '🚀 Connect'
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

const ActiveContainersPanel = ({ onConnectToContainer }) => {
  const [containers, setContainers] = useState([]);
  const [favorites, setFavorites] = useState([]);
  const [isCreating, setIsCreating] = useState(false);
  const [activeTab, setActiveTab] = useState('active');
  const fileInputRef = useRef(null);
  
  // NEW: Modal state
  const [showConnectionModal, setShowConnectionModal] = useState(false);
  const [selectedContainer, setSelectedContainer] = useState(null);

  useEffect(() => {
    // Load favorites from localStorage on component mount
    const savedFavorites = localStorage.getItem('favorite-containers');
    if (savedFavorites) {
      try {
        setFavorites(JSON.parse(savedFavorites));
      } catch (error) {
        console.error('Error parsing saved favorites:', error);
        localStorage.removeItem('favorite-containers');
      }
    }

    const fetchContainers = async () => {
      try {
        const res = await fetch('/api/active-containers');
        const data = await res.json();
        setContainers(data);
      } catch (err) {
        console.error('Failed to fetch containers:', err);
      }
    };

    fetchContainers();
    const interval = setInterval(fetchContainers, 5000);
    return () => clearInterval(interval);
  }, []);

  // Save favorites to localStorage whenever they change
  useEffect(() => {
    localStorage.setItem('favorite-containers', JSON.stringify(favorites));
  }, [favorites]);

  const createContainer = async () => {
    setIsCreating(true);
    try {
      const response = await fetch('/api/create-container', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const result = await response.json();
        console.log('Container created successfully:', result.containerName);
        
        // Refresh the containers list immediately
        const res = await fetch('/api/active-containers');
        const data = await res.json();
        setContainers(data);
      } else {
        const error = await response.json();
        console.error('Failed to create container:', error.message);
        alert(`Failed to create container: ${error.message}`);
      }
    } catch (error) {
      console.error('Error creating container:', error);
      alert(`Error creating container: ${error.message}`);
    } finally {
      setIsCreating(false);
    }
  };

  const stopContainer = async (containerId, containerName) => {
    try {
      const response = await fetch('/api/stop-container', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ containerId })
      });

      if (response.ok) {
        console.log(`Container ${containerName} stopped successfully`);
        setContainers(prevContainers => 
          prevContainers.filter(container => 
            (container.id || container.Id) !== containerId
          )
        );
        removeFavorite(containerId);
      } else {
        const error = await response.json();
        console.error('Failed to stop container:', error.message);
        alert(`Failed to stop container: ${error.message}`);
      }
    } catch (error) {
      console.error('Error stopping container:', error);
      alert(`Error stopping container: ${error.message}`);
    }
  };

  const handleStopClick = (e, containerId, containerName) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (window.confirm(`Are you sure you want to stop container "${containerName}"?`)) {
      stopContainer(containerId, containerName);
    }
  };

  // MODIFIED: Show modal instead of direct connection
  const handleContainerConnect = (containerInfo) => {
    setSelectedContainer(containerInfo);
    setShowConnectionModal(true);
  };

  // NEW: Handle modal connection
  const handleModalConnect = async (connectionInfo) => {
    if (onConnectToContainer) {
      onConnectToContainer(connectionInfo);
    }
  };

  // Toggle favorite status
  const toggleFavorite = (container) => {
    const containerId = container.id || container.Id;
    
    if (favorites.some(fav => (fav.id || fav.Id) === containerId)) {
      removeFavorite(containerId);
    } else {
      addToFavorites(container);
    }
  };

  const addToFavorites = (container) => {
    const containerCopy = { ...container, addedToFavoritesAt: new Date().toISOString() };
    setFavorites(prev => [...prev, containerCopy]);
  };

  const removeFavorite = (containerId) => {
    setFavorites(prev => 
      prev.filter(fav => (fav.id || fav.Id) !== containerId)
    );
  };

  const isFavorite = (containerId) => {
    return favorites.some(fav => (fav.id || fav.Id) === containerId);
  };

  const handleImportClick = () => {
    fileInputRef.current.click();
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const formData = new FormData();
    formData.append('dockerfile', file);

    try {
      setIsCreating(true);
      const response = await fetch('/api/import-dockerfile', {
        method: 'POST',
        body: formData,
      });

      if (response.ok) {
        const result = await response.json();
        console.log('Dockerfile imported successfully:', result);
        
        const res = await fetch('/api/active-containers');
        const data = await res.json();
        setContainers(data);
      } else {
        const error = await response.json();
        console.error('Failed to import Dockerfile:', error.message);
        alert(`Failed to import Dockerfile: ${error.message}`);
      }
    } catch (error) {
      console.error('Error importing Dockerfile:', error);
      alert(`Error importing Dockerfile: ${error.message}`);
    } finally {
      setIsCreating(false);
      e.target.value = '';
    }
  };

  const getPublicPort = (container) => {
    try {
      if (container.Ports && Array.isArray(container.Ports) && container.Ports.length > 0) {
        const portWithPublic = container.Ports.find(port => port.PublicPort);
        if (portWithPublic) {
          return portWithPublic.PublicPort;
        }
      }
      return 'N/A';
    } catch (error) {
      console.error('Error getting port:', error);
      return 'N/A';
    }
  };

  const getDisplayedContainers = () => {
    if (activeTab === 'favorites') {
      return favorites.filter(fav => {
        const favId = fav.id || fav.Id;
        const isStillActive = containers.some(c => (c.id || c.Id) === favId);
        return isStillActive;
      });
    }
    return containers;
  };

  const copyPortToClipboard = async (port, containerName) => {
    try {
      await navigator.clipboard.writeText(port.toString());
      alert(`Port ${port} copied to clipboard!\nUse this port in the SSH connection form.`);
    } catch (err) {
      const textArea = document.createElement('textarea');
      textArea.value = port.toString();
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
      alert(`Port ${port} copied to clipboard!\nUse this port in the SSH connection form.`);
    }
  };

  const displayedContainers = getDisplayedContainers();

  return (
    <div className="active-containers-content">
      {/* Connection Modal */}
      <ContainerConnectionModal
        isOpen={showConnectionModal}
        onClose={() => setShowConnectionModal(false)}
        containerInfo={selectedContainer}
        onConnect={handleModalConnect}
      />

      {/* Header Section with Tabs */}
      <div className="containers-header">
        <div className="header-title">
          <div className="tab-container">
            <button 
              className={`tab-button ${activeTab === 'active' ? 'active' : ''}`}
              onClick={() => setActiveTab('active')}
            >
              Active Containers
              <span className="container-count">{containers.length}</span>
            </button>
            <button 
              className={`tab-button ${activeTab === 'favorites' ? 'active' : ''}`}
              onClick={() => setActiveTab('favorites')}
            >
              Favorites
              <span className="container-count">{
                favorites.filter(fav => 
                  containers.some(c => (c.id || c.Id) === (fav.id || fav.Id))
                ).length
              }</span>
            </button>
          </div>
        </div>
        <div className="container-actions-header">
          <button
            onClick={handleImportClick}
            disabled={isCreating}
            className="import-dockerfile-icon-btn"
            title="Import Dockerfile"
          >
            📥
          </button>
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileUpload}
            style={{ display: 'none' }}
            accept=".dockerfile,.Dockerfile,Dockerfile,text/plain"
          />
          <button
            onClick={createContainer}
            disabled={isCreating}
            className="create-container-btn"
          >
            {isCreating ? 'Creating...' : 'Create'}
          </button>
        </div>
      </div>

      {/* Containers Grid */}
      <div className="containers-grid">
        {displayedContainers.length === 0 ? (
          <div className="no-containers">
            <div className="no-containers-icon">📦</div>
            <h4>
              {activeTab === 'active' 
                ? 'No Active Containers' 
                : 'No Favorite Containers'}
            </h4>
            <p>
              {activeTab === 'active'
                ? 'Click "Create" to start a new SSH container or import a Dockerfile'
                : 'Star containers to add them to your favorites'}
            </p>
          </div>
        ) : (
          displayedContainers.map(container => {
            const containerId = container.id || container.Id;
            const name = container.name || container.Names?.[0]?.replace('/', '') || 'Unnamed';
            const image = container.image || container.Image || 'Unknown Image';
            const status = container.status || container.Status || 'Unknown';
            const state = container.state || container.State || 'Unknown';
            const createdTime = container.created || container.Created;
            const created = createdTime
              ? new Date(createdTime * 1000).toLocaleString()
              : 'N/A';
            const publicPort = getPublicPort(container);
            const favorite = isFavorite(containerId);

            return (
              <div
                key={containerId}
                className="container-card"
              >
                <div className="container-card-header">
                  <div className="container-name">
                    <span className="name-text">{name}</span>
                    <span className="container-id">{containerId.substring(0, 12)}</span>
                  </div>
                  <div className="container-actions-top">
                    <button 
                      onClick={() => toggleFavorite(container)}
                      className={`favorite-btn ${favorite ? 'favorited' : ''}`}
                      title={favorite ? "Remove from favorites" : "Add to favorites"}
                    >
                      {favorite ? '★' : '☆'}
                    </button>
                    <button
                      onClick={(e) => handleStopClick(e, containerId, name)}
                      className="stop-btn"
                      title={`Stop container: ${name}`}
                    >
                      ×
                    </button>
                  </div>
                </div>

                <div className="container-info">
                  <div className="info-row">
                    <span className="info-label">Image:</span>
                    <span className="info-value">{image}</span>
                  </div>
                  <div className="info-row">
                    <span className="info-label">Status:</span>
                    <span className={`status-badge ${state.toLowerCase()}`}>{status}</span>
                  </div>
                  <div className="info-row">
                    <span className="info-label">SSH Port:</span>
                    <span 
                      className="port-value clickable-port" 
                      onClick={() => copyPortToClipboard(publicPort, name)}
                      title="Click to copy port number"
                      style={{ 
                        cursor: 'pointer',
                        textDecoration: 'underline'
                      }}
                    >
                      {publicPort} 📋
                    </span>
                  </div>
                  <div className="info-row">
                    <span className="info-label">Created:</span>
                    <span className="info-value">{created}</span>
                  </div>
                </div>

                {/* MODIFIED: Updated connect button */}
                <div className="container-actions">
                  <button 
                    className="action-btn connect-btn" 
                    onClick={() => handleContainerConnect({
                      id: containerId,
                      name: name,
                      port: publicPort,
                      host: 'localhost'
                    })}
                    title={`Connect to ${name} on port ${publicPort}`}
                    style={{ width: '100%' }}
                  >
                    🔌 Connect
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      <style jsx>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
};

export default ActiveContainersPanel;