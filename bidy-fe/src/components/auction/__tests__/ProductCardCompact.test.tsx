import { render, screen, fireEvent, act } from '@testing-library/react';
import '@testing-library/jest-dom';
import ProductCardCompact from '../ProductCardCompact';
import { UnifiedAuctionItem } from '../types';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// Create a test query client
const createTestQueryClient = () => new QueryClient({
  defaultOptions: {
    queries: {
      retry: false,
    },
  },
});

// Wrapper component for tests
const TestWrapper = ({ children }: { children: React.ReactNode }) => {
  const queryClient = createTestQueryClient();
  return (
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>
  );
};

// Mock Next.js components
jest.mock('next/image', () => ({
  __esModule: true,
  default: ({ src, alt, ...rest }: React.ComponentPropsWithoutRef<'img'>) => {
    const cleanRest = { ...(rest as Record<string, unknown>) }
    delete (cleanRest as Record<string, unknown>).fill
    // Remove Next.js specific prop to avoid React warnings in tests
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={typeof src === 'string' ? src : ''} alt={alt as string} {...cleanRest} />;
  },
}));

jest.mock('next/link', () => ({
  __esModule: true,
  default: ({ children, href }: { children: React.ReactNode; href: string }) => <a href={href}>{children}</a>,
}));

jest.mock('@/hooks', () => ({
  useAuth: () => ({ user: { _id: 'user123' }, isAuthenticated: true }),
  useAuctionStatusUpdate: jest.fn(),
}));

jest.mock('@/services/user/user.query', () => ({
  useWishlist: () => ({ data: { wishlist: [] } }),
  useAddWishlist: () => ({ mutateAsync: jest.fn() }),
  useRemoveWishlist: () => ({ mutateAsync: jest.fn() }),
}));

const mockProduct: UnifiedAuctionItem = {
  id: '1',
  _id: '1',
  name: 'Test Product',
  description: 'Test description for product',
  image: ['/test-image.jpg'],
  startingPrice: 1000,
  currentPrice: 2000,
  buyNow: 5000,
  endTime: new Date(Date.now() + 3600000).toISOString(), // 1 hour from now
  status: 'active',
  seller: 'Test Seller',
};

describe('ProductCardCompact', () => {
  it('renders product information correctly', () => {
    render(<ProductCardCompact item={mockProduct} />, { wrapper: TestWrapper });

    expect(screen.getByText('Test Product')).toBeInTheDocument();
    expect(screen.getByText('Test Seller')).toBeInTheDocument();
  });

  it('chỉ hiện mô tả ở mật độ comfortable', () => {
    const { rerender } = render(<ProductCardCompact item={mockProduct} />, {
      wrapper: TestWrapper,
    });
    // Ở lưới dày, mô tả bị cắt để nhường chỗ cho giá.
    expect(screen.queryByText('Test description for product')).not.toBeInTheDocument();

    rerender(<ProductCardCompact item={mockProduct} density="comfortable" />);
    expect(screen.getByText('Test description for product')).toBeInTheDocument();
  });

  it('displays pricing information', () => {
    render(<ProductCardCompact item={mockProduct} />, { wrapper: TestWrapper });

    expect(screen.getByText('Giá hiện tại')).toBeInTheDocument();
    expect(screen.getByText(/^KĐ /)).toBeInTheDocument();
    expect(screen.getByText(/^Mua ngay /)).toBeInTheDocument();
  });

  it('renders image with correct src', () => {
    render(<ProductCardCompact item={mockProduct} />, { wrapper: TestWrapper });

    const image = screen.getByAltText('Test Product');
    expect(image).toBeInTheDocument();
    expect(image).toHaveAttribute('src');
  });

  it('displays status badge for active auction', () => {
    render(<ProductCardCompact item={mockProduct} />, { wrapper: TestWrapper });

    expect(screen.getByText('Đang đấu giá')).toBeInTheDocument();
  });

  it('displays ended status badge for ended auction', () => {
    const endedProduct = { ...mockProduct, status: 'ended' };
    render(<ProductCardCompact item={endedProduct} />, { wrapper: TestWrapper });

    expect(screen.getByText('Đã kết thúc')).toBeInTheDocument();
  });

  it('displays "Sắp đấu giá" for initial auction', () => {
    const initialProduct = { ...mockProduct, status: 'initial' };
    render(<ProductCardCompact item={initialProduct} />, { wrapper: TestWrapper });

    expect(screen.getByText('Sắp đấu giá')).toBeInTheDocument();
  });

  it('displays countdown timer for active auction', () => {
    render(<ProductCardCompact item={mockProduct} />, { wrapper: TestWrapper });

    const timerElement = screen.getByLabelText(/^Còn lại:/);
    expect(timerElement).toBeInTheDocument();
  });

  it('has correct link to product detail page', () => {
    render(<ProductCardCompact item={mockProduct} />, { wrapper: TestWrapper });

    const link = screen.getByRole('link');
    expect(link).toHaveAttribute('href', '/product/1');
  });

  it('applies custom className', () => {
    const { container } = render(
      <ProductCardCompact item={mockProduct} className="custom-class" />,
      { wrapper: TestWrapper }
    );

    const article = container.querySelector('article');
    expect(article).toHaveClass('custom-class');
  });

  it('nhấn giá hiện tại cho phiên đang mở', () => {
    render(<ProductCardCompact item={mockProduct} />, { wrapper: TestWrapper });

    const label = screen.getByText('Giá hiện tại');
    expect(label).toBeInTheDocument();
    // Giá đứng ngay dưới nhãn và là con số duy nhất được nhấn.
    expect(label.nextElementSibling).toHaveClass('text-primary');
  });

  it('displays final price for ended auction', () => {
    const endedProduct = {
      ...mockProduct,
      status: 'ended',
      finalPrice: 3000,
    };
    render(<ProductCardCompact item={endedProduct} />, { wrapper: TestWrapper });

    // Phiên đã kết thúc thì ô giá chính đổi nhãn và hiện thẳng giá cuối.
    expect(screen.getByText('Giá cuối')).toBeInTheDocument();
    expect(screen.getByText('3.000đ')).toBeInTheDocument();
  });

  it('hides buy now price if not available', () => {
    const productWithoutBuyNow = { ...mockProduct, buyNow: undefined };
    render(<ProductCardCompact item={productWithoutBuyNow} />, { wrapper: TestWrapper });

    expect(screen.queryByText(/^Mua ngay /)).not.toBeInTheDocument();
  });

  it('displays winner badge for winning user', () => {
    const winningProduct = {
      ...mockProduct,
      top_ownerships: [{ user_id: 'user123' }],
    };
    render(<ProductCardCompact item={winningProduct} />, { wrapper: TestWrapper });

    expect(screen.getByText('Thắng')).toBeInTheDocument();
  });

  it('does not display winner badge for non-winning user', () => {
    const nonWinningProduct = {
      ...mockProduct,
      top_ownerships: [{ user_id: 'other-user' }],
    };
    render(<ProductCardCompact item={nonWinningProduct} />, { wrapper: TestWrapper });

    expect(screen.queryByText('Thắng')).not.toBeInTheDocument();
  });

  it('has proper accessibility attributes', () => {
    const { container } = render(<ProductCardCompact item={mockProduct} />, { wrapper: TestWrapper });

    // Card không còn giả làm button: link nằm ở tiêu đề và phủ toàn card,
    // nên chỉ có đúng một điểm dừng tab cho việc mở sản phẩm.
    const article = container.querySelector('article');
    expect(article).not.toHaveAttribute('role');
    expect(article).not.toHaveAttribute('tabIndex');

    const link = screen.getByRole('link', { name: 'Test Product' });
    expect(link).toHaveAttribute('href', expect.stringContaining('1'));
  });

  it('handles missing description gracefully', () => {
    const productWithoutDescription = { ...mockProduct, description: undefined };
    render(<ProductCardCompact item={productWithoutDescription} density="comfortable" />, {
      wrapper: TestWrapper,
    });

    expect(screen.getByText('Test Product')).toBeInTheDocument();
    expect(screen.queryByText('Test description')).not.toBeInTheDocument();
  });

  it('formats prices correctly', () => {
    render(<ProductCardCompact item={mockProduct} />, { wrapper: TestWrapper });

    // Prices should be formatted with Vietnamese locale
    expect(screen.getByText(/1\.000đ/)).toBeInTheDocument(); // Starting price
    expect(screen.getByText(/2\.000đ/)).toBeInTheDocument(); // Current price
    expect(screen.getByText(/5\.000đ/)).toBeInTheDocument(); // Buy now price
  });

  it('handles image load error', () => {
    const { container } = render(<ProductCardCompact item={mockProduct} />, { wrapper: TestWrapper });

    const img = container.querySelector('img');
    expect(img).toBeTruthy();

    if (img) {
      // Simulate error event
      fireEvent.error(img);

      // Should fallback to default image
      expect(img.src).toContain('images.jpeg');
    }
  });

  it('handles click on card', () => {
    render(<ProductCardCompact item={mockProduct} />, { wrapper: TestWrapper });

    const link = screen.getByRole('link');
    expect(link).toBeInTheDocument();

    // Click should navigate (handled by Link component)
    fireEvent.click(link);
    expect(link.getAttribute('href')).toBe('/product/1');
  });

  it('renders correctly with minimal product data', () => {
    const minimalProduct: UnifiedAuctionItem = {
      id: '2',
      name: 'Minimal Product',
      image: '/test.jpg',
      startingPrice: 100,
    };

    render(<ProductCardCompact item={minimalProduct} />, { wrapper: TestWrapper });

    expect(screen.getByText('Minimal Product')).toBeInTheDocument();
    expect(screen.getAllByText(/100đ/).length).toBeGreaterThan(0);
  });

  it('displays seller name from different field formats', () => {
    const productWithOwner = {
      ...mockProduct,
      seller: undefined,
      owner: { full_name: 'Owner Name', _id: 'owner123' },
    };

    render(<ProductCardCompact item={productWithOwner} />, { wrapper: TestWrapper });

    expect(screen.getByText('Owner Name')).toBeInTheDocument();
  });

  it('shows default seller name if seller info is missing', () => {
    const productWithoutSeller = {
      ...mockProduct,
      seller: undefined,
      owner: undefined,
    };

    render(<ProductCardCompact item={productWithoutSeller} />, { wrapper: TestWrapper });

    expect(screen.getByText('Không rõ người bán')).toBeInTheDocument();
  });
});

describe('ProductCardCompact - CountdownTimer', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    act(() => {
      jest.runOnlyPendingTimers();
    });
    jest.useRealTimers();
  });

  it('updates countdown every second', () => {
    const futureTime = new Date(Date.now() + 3545000); // 59 phút 5 giây
    const product = { ...mockProduct, endTime: futureTime.toISOString() };

    render(<ProductCardCompact item={product} />, { wrapper: TestWrapper });

    // Initial render should show time
    expect(screen.getByText('59:05')).toBeInTheDocument();

    // Fast-forward 1 second
    act(() => {
      jest.advanceTimersByTime(1000);
    });

    // Time should decrease
    expect(screen.getByText('59:04')).toBeInTheDocument();
  });

  it('displays formatted time for 1 hour 1 minute', () => {
    const futureTime = new Date(Date.now() + 3661000); // 1 giờ 1 phút 1 giây
    const product = { ...mockProduct, endTime: futureTime.toISOString() };

    render(<ProductCardCompact item={product} />, { wrapper: TestWrapper });

    expect(screen.getByText('1 giờ 1 phút')).toBeInTheDocument();
  });

  it('displays formatted time for 2 days 3 hours', () => {
    const futureTime = new Date(Date.now() + 183600000 + 30000); // 2 ngày 3 giờ (183600000 ms + 30000)
    const product = { ...mockProduct, endTime: futureTime.toISOString() };

    render(<ProductCardCompact item={product} />, { wrapper: TestWrapper });

    expect(screen.getByText('2 ngày 3 giờ')).toBeInTheDocument();
  });

  it('shows zero when time expires', () => {
    const pastTime = new Date(Date.now() - 1000); // 1 second ago
    const product = { ...mockProduct, endTime: pastTime.toISOString() };

    render(<ProductCardCompact item={product} />, { wrapper: TestWrapper });

    act(() => {
      jest.runOnlyPendingTimers();
    });

    expect(screen.getByText('Đã hết giờ')).toBeInTheDocument();
  });
});
