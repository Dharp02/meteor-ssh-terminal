import React, { useEffect, useState } from 'react';
import io from 'socket.io-client';

const SessionPanel = () => {
  const [sessions, setSessions] = useState([]);
  const socket = React.useRef(null);

  useEffect(() => {
    socket.current = io(window.location.origin);

    socket.current.on('activeSessions', (data) => {
      setSessions(data);
    });

    // Request active sessions when component mounts
    socket.current.emit('getActiveSessions');

    return () => {
      socket.current.disconnect();
    };
  }, []);

  return (
    <div style={styles.panel}>
      <h2 style={styles.header}>Active SSH Sessions</h2>
      {sessions.length === 0 ? (
        <p style={styles.empty}>No active sessions</p>
      ) : (
        <ul style={styles.list}>
          {sessions.map((session, index) => (
            <li key={session.id || index} style={styles.session}>
              <strong>{session.username}@{session.host}</strong>
              <p>Started: {new Date(session.startTime).toLocaleString()}</p>
              {session.remainingTime && (
                <p>Time left: {Math.ceil(session.remainingTime / 1000)}s</p>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

const styles = {
  panel: {
    background: '#1e1e1e',
    color: '#fff',
    padding: '1rem',
    borderRadius: '8px',
    maxWidth: '400px',
    height: 'auto',
  },
  header: {
    fontSize: '1.2rem',
    marginBottom: '1rem',
  },
  empty: {
    color: '#ccc',
  },
  list: {
    listStyle: 'none',
    padding: 0,
    margin: 0,
  },
  session: {
    padding: '0.5rem',
    borderBottom: '1px solid #444',
  },
};

export default SessionPanel;
