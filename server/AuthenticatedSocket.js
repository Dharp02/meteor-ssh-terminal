import io from 'socket.io-client';
// Update the import path below if 'authHelpers' is located elsewhere, e.g. '../authHelpers' or './authHelpers'
import { AuthHelpers } from './authHelpers';

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