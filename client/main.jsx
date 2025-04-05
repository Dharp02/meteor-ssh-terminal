import { Meteor } from 'meteor/meteor';
import React from 'react';
import { createRoot } from 'react-dom/client';
import TerminalComponent from './TerminalComponent';
import './main.css';
import './terminal.css';

// Wait for the DOM to be ready
Meteor.startup(() => {
  // Get the target DOM element
  const container = document.getElementById('react-target');
  
  if (container) {
    // Create a React root
    const root = createRoot(container);
    
    // Render our app into the root
    root.render(
      <React.StrictMode>
        <TerminalComponent />
      </React.StrictMode>
    );
  } else {
    console.error("Could not find element with id 'react-target'");
  }
});