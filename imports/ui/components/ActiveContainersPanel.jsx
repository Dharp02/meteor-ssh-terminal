import React, { useEffect, useState, useRef } from 'react';

const ActiveContainersPanel = ({ onConnectToContainer }) => {
  const [containers, setContainers] = useState([]);
  const [favorites, setFavorites] = useState([]);
  const [isCreating, setIsCreating] = useState(false);
  const [activeTab, setActiveTab] = useState('active'); // 'active' or 'favorites'
  const fileInputRef = useRef(null);

  useEffect(() => {
    // Load favorites from localStorage on component mount
    const savedFavorites = localStorage.getItem('favorite-containers');
    if (savedFavorites) {
      try {
        setFavorites(JSON.parse(savedFavorites));
      } catch (error) {
        console.error('Error parsing saved favorites:', error);
        // Reset if corrupted
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
        // Remove the container from the list immediately for better UX
        setContainers(prevContainers => 
          prevContainers.filter(container => 
            (container.id || container.Id) !== containerId
          )
        );
        
        // Also remove from favorites if present
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
    
    // Confirm before stopping
    if (window.confirm(`Are you sure you want to stop container "${containerName}"?`)) {
      stopContainer(containerId, containerName);
    }
  };

  // Toggle favorite status
  const toggleFavorite = (container) => {
    const containerId = container.id || container.Id;
    
    // Check if already in favorites
    if (favorites.some(fav => (fav.id || fav.Id) === containerId)) {
      removeFavorite(containerId);
    } else {
      addToFavorites(container);
    }
  };

  // Add container to favorites
  const addToFavorites = (container) => {
    // Make a copy to avoid modifying the original container object
    const containerCopy = { ...container, addedToFavoritesAt: new Date().toISOString() };
    setFavorites(prev => [...prev, containerCopy]);
  };

  // Remove container from favorites
  const removeFavorite = (containerId) => {
    setFavorites(prev => 
      prev.filter(fav => (fav.id || fav.Id) !== containerId)
    );
  };

  // Check if a container is in favorites
  const isFavorite = (containerId) => {
    return favorites.some(fav => (fav.id || fav.Id) === containerId);
  };

  // Import Dockerfile functionality
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
        
        // Refresh the containers list
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
      // Reset file input
      e.target.value = '';
    }
  };

  // Helper function to get the public port
  const getPublicPort = (container) => {
    try {
      // Handle the raw Docker API response format
      if (container.Ports && Array.isArray(container.Ports) && container.Ports.length > 0) {
        // Look for the first port with PublicPort
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

  // Get containers to display based on active tab
  const getDisplayedContainers = () => {
    if (activeTab === 'favorites') {
      // For favorites, we also check if they still exist in the active containers list
      // This gives a "real-time" view of favorite containers
      return favorites.filter(fav => {
        const favId = fav.id || fav.Id;
        // Either the container is still active, or we keep it but mark it as inactive
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
      // Fallback for older browsers
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
          {/* Import Dockerfile Button */}
          <button
            onClick={handleImportClick}
            disabled={isCreating}
            className="import-dockerfile-icon-btn"
            title="Import Dockerfile"
          >
            📥
          </button>
          {/* Hidden file input for Dockerfile import */}
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileUpload}
            style={{ display: 'none' }}
            accept=".dockerfile,.Dockerfile,Dockerfile,text/plain"
          />
          {/* Create Container Button */}
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
                {/* Container Header */}
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

                {/* Container Info */}
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

                {/* Container Actions */}
                <div className="container-actions">
                  <button 
                    className="action-btn connect-btn" 
                    onClick={() => {
                      // If the callback is provided, use it to create a pre-filled terminal
                      if (onConnectToContainer) {
                        onConnectToContainer({
                          id: containerId,
                          name: name,
                          port: publicPort,
                          host: 'localhost'
                        });
                      } else {
                        // Fallback to copying port
                        copyPortToClipboard(publicPort, name);
                      }
                    }}
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
    </div>
  );
};

export default ActiveContainersPanel;