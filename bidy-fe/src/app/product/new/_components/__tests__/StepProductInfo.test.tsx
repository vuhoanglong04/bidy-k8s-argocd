import { render, screen, waitFor } from '@testing-library/react';
import { useState, useEffect } from 'react';
import StepProductInfo from '../StepProductInfo';
import { PRODUCT_CONDITION, PRODUCT_CONDITION_LABELS } from '@/constants/app.enum';

jest.mock('@/services/category', () => ({
  useActiveCategories: () => ({
    categories: [{ id: 'cat-1', name: 'Điện tử' }],
    isPending: false,
  }),
}));

/** Mô phỏng wizard: dữ liệu sản phẩm về SAU khi form đã mount (useEffect). */
function Harness() {
  const [info, setInfo] = useState<undefined | {
    name: string; categoryId: string; condition: PRODUCT_CONDITION; description: string;
  }>(undefined);

  useEffect(() => {
    setInfo({
      name: 'MacBook Pro 14 M3',
      categoryId: 'cat-1',
      condition: PRODUCT_CONDITION.USED,
      description: 'Còn bảo hành',
    });
  }, []);

  return (
    <StepProductInfo
      defaultValues={info}
      isSaved
      isSubmitting={false}
      onSubmit={() => {}}
    />
  );
}

it('điền sẵn form khi dữ liệu về sau lúc mount (luồng ?edit=)', async () => {
  render(<Harness />);
  await waitFor(() => {
    expect(screen.getByLabelText(/Tên sản phẩm/)).toHaveValue('MacBook Pro 14 M3');
  });
  expect(screen.getByLabelText(/Mô tả/)).toHaveValue('Còn bảo hành');

  // Ô danh mục phải hiện tên đã chọn, không phải placeholder.
  expect(document.getElementById('product-category')).toHaveTextContent('Điện tử');


  // Nút tình trạng tương ứng phải ở trạng thái được chọn.
  const usedLabel = PRODUCT_CONDITION_LABELS[PRODUCT_CONDITION.USED];
  expect(screen.getByRole('button', { name: usedLabel })).toHaveAttribute('aria-pressed', 'true');
});
