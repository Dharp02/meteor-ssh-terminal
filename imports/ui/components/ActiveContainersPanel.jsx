import React, { useEffect, useState } from 'react';

const ActiveContainersPanel = () => {
  const [containers, setContainers] = useState([]);

  useEffect(() => {
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

  return (
    <div style={{ background: '#1e1e1e', color: '#fff', padding: '1rem', borderRadius: '8px', marginBottom: '1rem' }}>
      <h3 style={{ marginBottom: '1rem' }}>Active Containers</h3>

      <div
        style={{
          display: 'flex',
          flexDirection: 'row',
          overflowX: 'auto',
          overflowY: 'hidden',
          gap: '1rem',
          paddingBottom: '0.5rem',
          whiteSpace: 'nowrap'
        }}
      >
        {containers.length === 0 ? (
          <p style={{ color: '#aaa' }}>No running containers</p>
        ) : (
          containers.map(container => {
            const name = container.name || container.Names?.[0]?.replace('/', '') || 'Unnamed';
            const image = container.image || container.Image || 'Unknown Image';
            const status = container.status || container.Status || 'Unknown';
            const state = container.state || container.State || 'Unknown';
            const createdTime = container.created || container.Created;
            const created = createdTime
              ? new Date(createdTime * 1000).toLocaleString()
              : 'N/A';

            return (
              <div
                key={container.id || container.Id}
                style={{
                  background: '#2c2c2c',
                  padding: '1rem',
                  borderRadius: '8px',
                  minWidth: '250px',
                  maxWidth: '250px',
                  boxShadow: '0 2px 6px rgba(0,0,0,0.3)',
                  flex: '0 0 auto'
                }}
              >
                <strong style={{ fontSize: '16px' }}>{name}</strong>
                <p style={{ margin: '4px 0' }}><em>{image}</em></p>
                <p style={{ margin: '4px 0' }}>Status: <strong>{status}</strong></p>
                <p style={{ margin: '4px 0' }}>State: {state}</p>
                <p style={{ margin: '4px 0' }}>Started: {created}</p>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

export default ActiveContainersPanel;
