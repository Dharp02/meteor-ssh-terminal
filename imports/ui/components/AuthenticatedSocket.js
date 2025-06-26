// imports/ui/components/AuthenticatedSocket.js - Enhanced Socket.IO connection with auth
import io from 'socket.io-client';
import { AuthHelpers } from '../../../client/authHelpers';


export const createAuthenticatedSocket = () => {
  const userId = AuthHelpers.getCurrentUserId();
  const sessionToken = Session.get('sessionToken') || 'web-session';

  if (!userId) {
    throw new Error('User not authenticated');
  }

  return io(window.location.origin, {
    auth: {
      userId,
      sessionToken
    },
    forceNew: true,
    transports: ['websocket', 'polling']
  });
};