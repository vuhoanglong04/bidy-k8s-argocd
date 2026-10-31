import { io, Socket } from 'socket.io-client';
import { CONFIG } from './config';

/**
 * Connects a test Socket.IO client using the user's JWT access token.
 */
export async function connectTestSocket(
  token: string,
  wsUrl: string = CONFIG.WS_URL
): Promise<Socket> {
  return new Promise((resolve, reject) => {
    const socket = io(wsUrl, {
      transports: ['websocket', 'polling'],
      auth: { token },
      extraHeaders: {
        Authorization: `Bearer ${token}`,
      },
      timeout: 10000,
      forceNew: true,
    });

    const timer = setTimeout(() => {
      socket.disconnect();
      reject(new Error(`Socket connection timed out after 10s to ${wsUrl}`));
    }, 10000);

    socket.once('connect', () => {
      clearTimeout(timer);
      resolve(socket);
    });

    socket.once('connect_error', (err) => {
      clearTimeout(timer);
      reject(new Error(`Socket connection error to ${wsUrl}: ${err.message}`));
    });
  });
}

/**
 * Waits for a specific WebSocket event with a predicate filter and timeout (default 15s).
 */
export function waitForSocketEvent<T = any>(
  socket: Socket,
  eventName: string,
  timeoutMs: number = 15000,
  predicate?: (payload: T) => boolean
): Promise<T> {
  return new Promise((resolve, reject) => {
    let timer: NodeJS.Timeout;

    const listener = (data: T) => {
      try {
        if (!predicate || predicate(data)) {
          clearTimeout(timer);
          socket.off(eventName, listener);
          resolve(data);
        }
      } catch (err) {
        clearTimeout(timer);
        socket.off(eventName, listener);
        reject(err);
      }
    };

    timer = setTimeout(() => {
      socket.off(eventName, listener);
      reject(
        new Error(
          `Timed out after ${timeoutMs}ms waiting for WebSocket event "${eventName}" on socket ${socket.id}`
        )
      );
    }, timeoutMs);

    socket.on(eventName, listener);
  });
}
