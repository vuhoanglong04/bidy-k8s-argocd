export interface PolicySection {
  id: string;
  heading: string;
  paragraphs: string[];
}

export interface PolicyDoc {
  slug: string;
  title: string;
  group: "legal" | "trade";
  summary: string;
  updatedAt: string;
  sections: PolicySection[];
}

export const POLICY_DOCS: PolicyDoc[] = [
  {
    slug: "terms",
    title: "Điều khoản dịch vụ",
    group: "legal",
    summary: "Quy định chung về quyền và nghĩa vụ của người dùng khi tham gia nền tảng đấu giá Bidy.",
    updatedAt: "2026-09-23",
    sections: [
      {
        id: "pham-vi-ap-dung",
        heading: "Phạm vi áp dụng",
        paragraphs: [
          "[Nội dung đang được cập nhật — quy định phạm vi áp dụng điều khoản đối với toàn bộ người dùng truy cập và sử dụng dịch vụ trên hệ thống].",
        ],
      },
      {
        id: "tai-khoan-nguoi-dung",
        heading: "Tài khoản người dùng",
        paragraphs: [
          "[Nội dung đang được cập nhật — nguyên tắc đăng ký, quản lý bảo mật thông tin tài khoản và trách nhiệm của chủ tài khoản].",
        ],
      },
      {
        id: "quy-dinh-dau-gia",
        heading: "Quy định đấu giá",
        paragraphs: [
          "[Nội dung đang được cập nhật — quy tắc đặt giá, bước giá, tính ràng buộc của lệnh đặt giá và quy trình xác định người thắng cuộc].",
        ],
      },
      {
        id: "trach-nhiem-va-gioi-han",
        heading: "Trách nhiệm & giới hạn",
        paragraphs: [
          "[Nội dung đang được cập nhật — giới hạn trách nhiệm pháp lý của nền tảng và nghĩa vụ bồi thường khi có vi phạm].",
        ],
      },
      {
        id: "thay-doi-dieu-khoan",
        heading: "Thay đổi điều khoản",
        paragraphs: [
          "[Nội dung đang được cập nhật — quy trình cập nhật, thông báo sửa đổi điều khoản dịch vụ đến người dùng].",
        ],
      },
    ],
  },
  {
    slug: "privacy",
    title: "Chính sách bảo mật",
    group: "legal",
    summary: "Cam kết bảo vệ dữ liệu cá nhân, cách thức thu thập và sử dụng thông tin người dùng trên Bidy.",
    updatedAt: "2026-09-23",
    sections: [
      {
        id: "thu-thap-thong-tin",
        heading: "Thu thập thông tin",
        paragraphs: [
          "[Nội dung đang được cập nhật — các loại thông tin cá nhân và dữ liệu hoạt động được thu thập khi người dùng sử dụng dịch vụ].",
        ],
      },
      {
        id: "muc-dich-su-dung",
        heading: "Mục đích sử dụng dữ liệu",
        paragraphs: [
          "[Nội dung đang được cập nhật — mục đích xử lý thông tin nhằm phục vụ vận hành phiên đấu giá, giao hàng và hỗ trợ người dùng].",
        ],
      },
      {
        id: "chia-se-va-bao-ve-thong-tin",
        heading: "Chia sẻ & bảo vệ thông tin",
        paragraphs: [
          "[Nội dung đang được cập nhật — các biện pháp bảo mật kỹ thuật và trường hợp chia sẻ thông tin theo quy định pháp luật].",
        ],
      },
      {
        id: "quyen-cua-nguoi-dung",
        heading: "Quyền của chủ thể dữ liệu",
        paragraphs: [
          "[Nội dung đang được cập nhật — quyền truy cập, chỉnh sửa, yêu cầu xóa dữ liệu cá nhân và rút lại sự đồng ý].",
        ],
      },
    ],
  },
  {
    slug: "regulations",
    title: "Quy chế hoạt động",
    group: "legal",
    summary: "Quy chế vận hành sàn thương mại điện tử đấu giá trực tuyến, tiêu chuẩn niêm yết và giải quyết tranh chấp.",
    updatedAt: "2026-09-23",
    sections: [
      {
        id: "nguyen-tac-chung",
        heading: "Nguyên tắc chung",
        paragraphs: [
          "[Nội dung đang được cập nhật — nguyên tắc hoạt động minh bạch, công bằng và tuân thủ pháp luật thương mại điện tử].",
        ],
      },
      {
        id: "tieu-chuan-hang-hoa",
        heading: "Tiêu chuẩn hàng hóa niêm yết",
        paragraphs: [
          "[Nội dung đang được cập nhật — điều kiện hàng hóa được phép đấu giá, danh mục hàng cấm và quy trình kiểm duyệt sản phẩm].",
        ],
      },
      {
        id: "quy-trinh-giao-dich",
        heading: "Quy trình giao dịch",
        paragraphs: [
          "[Nội dung đang được cập nhật — trình tự thực hiện phiên đấu giá, xác nhận giao dịch và chuyển giao quyền sở hữu].",
        ],
      },
      {
        id: "giai-quyet-tranh-chap",
        heading: "Cơ chế giải quyết tranh chấp",
        paragraphs: [
          "[Nội dung đang được cập nhật — quy trình tiếp nhận khiếu nại, hòa giải và xử lý vi phạm giữa các bên tham gia].",
        ],
      },
    ],
  },
  {
    slug: "buyer-protection",
    title: "An toàn người mua",
    group: "trade",
    summary: "Chính sách bảo vệ quyền lợi người mua, cơ chế giữ tiền trung gian và xử lý sự cố giao dịch.",
    updatedAt: "2026-09-23",
    sections: [
      {
        id: "co-che-giu-tien-trung-gian",
        heading: "Cơ chế bảo vệ ký quỹ",
        paragraphs: [
          "[Nội dung đang được cập nhật — phương thức giữ tiền an toàn cho đến khi người mua nhận và kiểm tra hàng hóa thành công].",
        ],
      },
      {
        id: "kiem-tra-va-nhan-hang",
        heading: "Kiểm tra và xác nhận nhận hàng",
        paragraphs: [
          "[Nội dung đang được cập nhật — thời hạn kiểm tra hàng hóa, đối chiếu mô tả sản phẩm và xác nhận hoàn tất giao dịch].",
        ],
      },
      {
        id: "doi-tra-va-hoan-tien",
        heading: "Đổi trả và hoàn tiền",
        paragraphs: [
          "[Nội dung đang được cập nhật — điều kiện yêu cầu hoàn tiền khi hàng giả, hàng không đúng mô tả hoặc không nhận được hàng].",
        ],
      },
      {
        id: "bao-cao-gian-lan",
        heading: "Báo cáo hành vi gian lận",
        paragraphs: [
          "[Nội dung đang được cập nhật — kênh tiếp nhận tố cáo người bán gian lận và biện pháp xử lý tài khoản vi phạm].",
        ],
      },
    ],
  },
  {
    slug: "account-verification",
    title: "Xác minh tài khoản",
    group: "trade",
    summary: "Quy trình định danh người dùng nhằm đảm bảo tính trung thực và an toàn cho toàn bộ hệ thống đấu giá.",
    updatedAt: "2026-09-23",
    sections: [
      {
        id: "muc-dich-xac-minh",
        heading: "Mục đích xác minh",
        paragraphs: [
          "[Nội dung đang được cập nhật — lý do thực hiện định danh nhằm phòng chống gian lận giá ảo và bảo vệ thành viên].",
        ],
      },
      {
        id: "cac-cap-do-xac-minh",
        heading: "Các cấp độ xác minh",
        paragraphs: [
          "[Nội dung đang được cập nhật — phân hạng tài khoản theo cấp độ xác thực email, số điện thoại và định danh cá nhân/doanh nghiệp].",
        ],
      },
      {
        id: "ho-so-va-tai-lieu",
        heading: "Hồ sơ và tài liệu yêu cầu",
        paragraphs: [
          "[Nội dung đang được cập nhật — danh mục giấy tờ cần cung cấp và tiêu chuẩn chất lượng hình ảnh/tài liệu tải lên].",
        ],
      },
      {
        id: "thoi-gian-xu-ly",
        heading: "Thời gian xử lý & bảo mật hồ sơ",
        paragraphs: [
          "[Nội dung đang được cập nhật — quy trình xét duyệt hồ sơ định danh và cam kết mã hóa bảo mật thông tin giấy tờ].",
        ],
      },
    ],
  },
  {
    slug: "fees",
    title: "Phí dịch vụ",
    group: "trade",
    summary: "Biểu phí minh bạch áp dụng cho các hoạt động đăng bán, giao dịch thành công và dịch vụ liên quan.",
    updatedAt: "2026-09-23",
    sections: [
      {
        id: "bieu-phi-dang-tin",
        heading: "Phí niêm yết & đăng phiên",
        paragraphs: [
          "[Nội dung đang được cập nhật — quy định về chi phí tạo phiên đấu giá và các gói tính năng quảng bá nổi bật].",
        ],
      },
      {
        id: "phi-giao-dich-thanh-cong",
        heading: "Phí giao dịch thành công",
        paragraphs: [
          "[Nội dung đang được cập nhật — tỷ lệ phần trăm khấu trừ trên giá trị gõ búa cuối cùng khi phiên đấu giá kết thúc thành công].",
        ],
      },
      {
        id: "phi-rut-tien-va-thanh-toan",
        heading: "Phí nạp rút tiền & cổng thanh toán",
        paragraphs: [
          "[Nội dung đang được cập nhật — biểu phí xử lý thanh toán qua ngân hàng và các kênh giao dịch trực tuyến].",
        ],
      },
      {
        id: "chinh-sach-mien-giam",
        heading: "Chính sách miễn giảm & ưu đãi",
        paragraphs: [
          "[Nội dung đang được cập nhật — các chương trình hỗ trợ phí cho người bán mới hoặc thành viên tích cực].",
        ],
      },
    ],
  },
  {
    slug: "payment-methods",
    title: "Phương thức thanh toán",
    group: "trade",
    summary: "Các hình thức nạp tiền, thanh toán phiên thắng và quy trình rút tiền an toàn về tài khoản ngân hàng.",
    updatedAt: "2026-09-23",
    sections: [
      {
        id: "hinh-thuc-thanh-toan-ho-tro",
        heading: "Các hình thức thanh toán hỗ trợ",
        paragraphs: [
          "[Nội dung đang được cập nhật — danh sách phương thức thanh toán gồm chuyển khoản QR ngân hàng, ví Bidy và cổng trực tuyến].",
        ],
      },
      {
        id: "thoi-han-thanh-toan",
        heading: "Thời hạn thanh toán đơn hàng",
        paragraphs: [
          "[Nội dung đang được cập nhật — khung thời gian quy định để người thắng hoàn tất thanh toán trước khi bị hủy kết quả].",
        ],
      },
      {
        id: "quy-trinh-rut-tien",
        heading: "Quy trình rút tiền về ngân hàng",
        paragraphs: [
          "[Nội dung đang được cập nhật — các bước tạo lệnh rút tiền từ số dư khả dụng về tài khoản ngân hàng chính chủ].",
        ],
      },
      {
        id: "an-toan-giao-dich-tai-chinh",
        heading: "An toàn giao dịch tài chính",
        paragraphs: [
          "[Nội dung đang được cập nhật — tiêu chuẩn mã hóa bảo mật giao dịch tài chính và cảnh báo phòng chống lừa đảo].",
        ],
      },
    ],
  },
];

export const getPolicyBySlug = (slug: string): PolicyDoc | undefined =>
  POLICY_DOCS.find((p) => p.slug === slug);
