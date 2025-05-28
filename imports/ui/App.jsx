import React from 'react';
import { Hello } from './Hello.jsx';
import { Info } from './Info.jsx';
import TerminalInstance from './components/TerminalInstance.jsx';
import SessionPanel from './components/SessionPanel.jsx';

export const App = () => (
  <div style={{ display: 'flex', flexDirection: 'row', gap: '1rem', padding: '1rem' }}>
    <div style={{ flex: 2 }}>
      <h1>Welcome to Meteor!</h1>
      <Hello />
      <Info />
      <TerminalInstance tabId="tab1" label="Terminal 1" />
    </div>
    <div style={{ flex: 1 }}>
      <h2>Active Sessions</h2>
      <SessionPanel />
    </div>
  </div>
);
