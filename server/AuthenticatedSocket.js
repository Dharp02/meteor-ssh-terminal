import io from 'socket.io-client';
import { AuthHelpers } from '../../authHelpers';

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