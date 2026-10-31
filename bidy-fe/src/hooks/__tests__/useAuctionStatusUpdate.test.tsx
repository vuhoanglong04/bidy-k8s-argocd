import { renderHook, act } from '@testing-library/react';
import { WEBSOCKET_EVENTS } from '@/constants/app.enum';
import { useAuctionStatusUpdate } from '../useAuctionStatusUpdate';

const mockOn = jest.fn();
const mockOff = jest.fn();
const mockSocket = {
  on: mockOn,
  off: mockOff,
};

jest.mock('../useWebSocketCore', () => ({
  useWebSocketCore: () => ({
    socket: mockSocket,
    isConnected: true,
  }),
}));

describe('useAuctionStatusUpdate', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('registers and unregisters socket listener on mount and unmount', () => {
    const callback = jest.fn();
    const { unmount } = renderHook(() => useAuctionStatusUpdate('auction-123', callback));

    expect(mockOn).toHaveBeenCalledWith(
      WEBSOCKET_EVENTS.AUCTION_STATUS_UPDATE,
      expect.any(Function)
    );

    unmount();

    expect(mockOff).toHaveBeenCalledWith(
      WEBSOCKET_EVENTS.AUCTION_STATUS_UPDATE,
      expect.any(Function)
    );
  });

  it('calls callback when status update matches auctionId', () => {
    let handler: ((data: unknown) => void) | undefined;
    mockOn.mockImplementation((event, cb) => {
      if (event === WEBSOCKET_EVENTS.AUCTION_STATUS_UPDATE) {
        handler = cb;
      }
    });

    const callback = jest.fn();
    renderHook(() => useAuctionStatusUpdate('auction-123', callback));

    expect(handler).toBeDefined();

    // Event for another auction -> ignored
    act(() => {
      handler?.({ auctionId: 'other-auction', status: 'ended', timestamp: '2026-09-20T12:00:00Z' });
    });
    expect(callback).not.toHaveBeenCalled();

    // Event for matching auction
    act(() => {
      handler?.({ auctionId: 'auction-123', status: 'ended', timestamp: '2026-09-20T12:00:00Z' });
    });
    expect(callback).toHaveBeenCalledTimes(1);
    expect(callback).toHaveBeenCalledWith({
      auctionId: 'auction-123',
      status: 'ended',
      timestamp: '2026-09-20T12:00:00Z',
    });
  });

  it('ignores non-happening and non-ended status', () => {
    let handler: ((data: unknown) => void) | undefined;
    mockOn.mockImplementation((event, cb) => {
      if (event === WEBSOCKET_EVENTS.AUCTION_STATUS_UPDATE) {
        handler = cb;
      }
    });

    const callback = jest.fn();
    renderHook(() => useAuctionStatusUpdate('auction-123', callback));

    act(() => {
      handler?.({ auctionId: 'auction-123', status: 'cancelled' });
    });
    expect(callback).not.toHaveBeenCalled();
  });
});
