// imports/ui/utils/sessionRestore.js
import { Meteor } from 'meteor/meteor';

export class SessionRestore {
  constructor() {
    this.storageKey = 'ssh-terminal-session';
    this.restoreInProgress = false;
  }

  // Save session data to localStorage
  saveSession(sessionData) {
    try {
      const sessionInfo = {
        ...sessionData,
        timestamp: new Date().toISOString(),
        url: window.location.href
      };
      
      localStorage.setItem(this.storageKey, JSON.stringify(sessionInfo));
      console.log('Session saved for restoration:', sessionInfo);
    } catch (error) {
      console.error('Failed to save session:', error);
    }
  }

  // Get saved session data
  getSavedSession() {
    try {
      const saved = localStorage.getItem(this.storageKey);
      if (!saved) return null;

      const sessionInfo = JSON.parse(saved);
      
      // Check if session is too old (older than 24 hours)
      const sessionTime = new Date(sessionInfo.timestamp);
      const now = new Date();
      const hoursDiff = (now - sessionTime) / (1000 * 60 * 60);
      
      if (hoursDiff > 24) {
        this.clearSession();
        return null;
      }

      return sessionInfo;
    } catch (error) {
      console.error('Failed to get saved session:', error);
      this.clearSession();
      return null;
    }
  }

  // Clear saved session
  clearSession() {
    try {
      localStorage.removeItem(this.storageKey);
      console.log('Session cleared');
    } catch (error) {
      console.error('Failed to clear session:', error);
    }
  }

  // Attempt to restore session
  async restoreSession() {
    if (this.restoreInProgress) return null;
    
    const savedSession = this.getSavedSession();
    if (!savedSession || !savedSession.restoreKey) {
      console.log('No restorable session found');
      return null;
    }

    this.restoreInProgress = true;

    try {
      console.log('Attempting to restore session:', savedSession.restoreKey);
      
      // Call server to check if session can be restored
      const response = await fetch('/api/restore-session', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          restoreKey: savedSession.restoreKey,
          socketId: `restored-${Date.now()}`
        })
      });

      if (response.ok) {
        const result = await response.json();
        console.log('Session restoration successful:', result);
        return {
          ...savedSession,
          ...result.sessionInfo
        };
      } else {
        console.log('Session restoration failed, starting fresh');
        this.clearSession();
        return null;
      }
    } catch (error) {
      console.error('Session restoration error:', error);
      this.clearSession();
      return null;
    } finally {
      this.restoreInProgress = false;
    }
  }

  // Save current terminal state
  saveTerminalState(terminalId, state) {
    try {
      const stateKey = `terminal-state-${terminalId}`;
      const terminalState = {
        ...state,
        timestamp: new Date().toISOString()
      };
      
      localStorage.setItem(stateKey, JSON.stringify(terminalState));
    } catch (error) {
      console.error('Failed to save terminal state:', error);
    }
  }

  // Get saved terminal state
  getTerminalState(terminalId) {
    try {
      const stateKey = `terminal-state-${terminalId}`;
      const saved = localStorage.getItem(stateKey);
      
      if (!saved) return null;
      
      const state = JSON.parse(saved);
      
      // Check if state is too old (older than 1 hour)
      const stateTime = new Date(state.timestamp);
      const now = new Date();
      const minutesDiff = (now - stateTime) / (1000 * 60);
      
      if (minutesDiff > 60) {
        localStorage.removeItem(stateKey);
        return null;
      }
      
      return state;
    } catch (error) {
      console.error('Failed to get terminal state:', error);
      return null;
    }
  }

  // Clear all terminal states
  clearAllTerminalStates() {
    try {
      const keysToRemove = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith('terminal-state-')) {
          keysToRemove.push(key);
        }
      }
      
      keysToRemove.forEach(key => localStorage.removeItem(key));
      console.log(`Cleared ${keysToRemove.length} terminal states`);
    } catch (error) {
      console.error('Failed to clear terminal states:', error);
    }
  }
}

// Create global instance
export const sessionRestore = new SessionRestore();