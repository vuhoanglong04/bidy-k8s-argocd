import { renderHook, act, waitFor } from '@testing-library/react';

const handlers: Record<string, Array<(...a: unknown[]) => void>> = {};
const fakeSocket = {
  connected: false,
  id: 'fake',
  on: (e: string, cb: (...a: unknown[]) => void) => { (handlers[e] ||= []).push(cb); },
  once: (e: string, cb: (...a: unknown[]) => void) => { (handlers[e] ||= []).push(cb); },
  off: jest.fn(),
  emit: jest.fn(),
  disconnect: jest.fn(() => {
    fakeSocket.connected = false;
    (handlers['disconnect'] || []).forEach((cb) => cb('io client disconnect'));
  }),
  connect: jest.fn(() => {
    fakeSocket.connected = true;
    (handlers['connect'] || []).forEach((cb) => cb());
  }),
};

jest.mock('socket.io-client', () => ({ io: jest.fn(() => fakeSocket) }));
jest.mock('@/lib/auth-cookies', () => ({ getAppCookie: () => 'token-abc' }));
jest.mock('@/lib/auth-refresh', () => ({ refreshSession: jest.fn() }));

import { useWebSocketCore } from '../useWebSocketCore';

const tick = () => act(async () => { await new Promise((r) => setTimeout(r, 50)); });

it('consumer tạo socket unmount thì consumer còn lại vẫn giữ kết nối', async () => {
  // A = trang sản phẩm (tạo socket). B = widget chat, sống suốt vòng đời app.
  const a = renderHook(() => useWebSocketCore());
  await tick();
  await waitFor(() => expect(a.result.current.isConnected).toBe(true));

  const b = renderHook(() => useWebSocketCore());
  await tick();
  expect(b.result.current.isConnected).toBe(true);

  fakeSocket.disconnect.mockClear();

  // Rời trang sản phẩm.
  await act(async () => { a.unmount(); await new Promise((r) => setTimeout(r, 50)); });

  // Widget vẫn còn dùng socket -> KHÔNG được hạ.
  expect(fakeSocket.disconnect).not.toHaveBeenCalled();
  expect(b.result.current.isConnected).toBe(true);
});
