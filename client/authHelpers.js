import { Session } from 'meteor/session';

export const AuthHelpers = {
  // Get current user from session
  getCurrentUser() {
    return Session.get('currentUser');
  },

  // Get current user ID
  getCurrentUserId() {
    return Session.get('currentUserId');
  },

  // Check if user is logged in
  isAuthenticated() {
    return !!Session.get('currentUserId');
  },

  // Check if user is admin
  isAdmin() {
    const user = this.getCurrentUser();
    return user && user.role === 'admin';
  },

  // Get auth headers for API requests
  getAuthHeaders() {
    const userId = this.getCurrentUserId();
    const sessionToken = Session.get('sessionToken') || 'web-session';
    
    return {
      'X-User-ID': userId,
      'X-Session-Token': sessionToken,
      'Content-Type': 'application/json'
    };
  },

  // Make authenticated API request
  async authenticatedFetch(url, options = {}) {
    const headers = {
      ...this.getAuthHeaders(),
      ...options.headers
    };

    return fetch(url, {
      ...options,
      headers
    });
  },

  // Clear authentication
  clearAuth() {
    Session.set('currentUserId', null);
    Session.set('currentUser', null);
    Session.set('sessionToken', null);
  }
};