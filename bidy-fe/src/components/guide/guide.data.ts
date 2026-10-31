import { APP_ROUTES } from "@/constants/routes.constants";

export interface GuideBlock {
  heading?: string;
  lines: string[];
  ordered?: boolean;
}

export interface GuideItem {
  id: string;
  title: string;
  blocks: GuideBlock[];
  related?: {
    label: string;
    href: string;
  };
}

export interface GuideSection {
  id: string;
  title: string;
  items: GuideItem[];
}

export const GUIDE_SECTIONS: GuideSection[] = [
  {
    id: "huong-dan-cho-nguoi-moi",
    title: "Hướng dẫn cho người mới",
    items: [
      {
        id: "cach-tao-tai-khoan-va-dang-nhap",
        title: "Cách tạo tài khoản và đăng nhập",
        blocks: [
          {
            heading: "Đăng ký tài khoản",
            ordered: true,
            lines: [
              "Nhấn vào 'Đăng ký' ở góc trên cùng",
              "Điền đầy đủ thông tin: tên đăng nhập, họ tên, email, SĐT, CMND/CCCD",
              "Tạo mật khẩu mạnh (ít nhất 8 ký tự, có chữ hoa, chữ thường và số)",
              "Xác nhận mật khẩu và đồng ý điều khoản",
              "Nhấn 'Tạo tài khoản'",
            ],
          },
          {
            heading: "Mẹo",
            lines: ["Sử dụng email thật để nhận thông báo quan trọng!"],
          },
        ],
      },
      {
        id: "cach-tham-gia-dau-gia",
        title: "Cách tham gia đấu giá",
        blocks: [
          {
            heading: "Quy trình đấu giá",
            ordered: true,
            lines: [
              "Tìm kiếm sản phẩm bạn quan tâm trên trang chủ",
              "Nhấn vào sản phẩm để xem chi tiết",
              "Kiểm tra: giá khởi điểm, thời gian còn lại, số người đấu giá",
              "Nhập số tiền đấu giá (phải cao hơn giá hiện tại)",
              "Nhấn 'Đấu giá' để xác nhận",
              "Theo dõi kết quả thời gian thực",
            ],
          },
          {
            heading: "Lưu ý",
            lines: ["Giá đấu giá tối thiểu tăng 10.000 VNĐ mỗi lần!"],
          },
        ],
      },
      {
        id: "cach-dang-ban-san-pham-dau-gia",
        title: "Cách đăng bán sản phẩm đấu giá",
        blocks: [
          {
            heading: "Đăng sản phẩm",
            ordered: true,
            lines: [
              "Vào 'Tài khoản của tôi' > 'Đấu giá của tôi'",
              "Nhấn 'Tạo đấu giá mới'",
              "Điền thông tin sản phẩm: tên, mô tả chi tiết, số lượng",
              "Đặt giá khởi điểm và giá mua ngay (tùy chọn)",
              "Chọn danh mục phù hợp",
              "Chọn thời gian bắt đầu và kết thúc đấu giá",
              "Tải lên hình ảnh sản phẩm (tối đa 10 ảnh)",
              "Kiểm tra và nhấn 'Đăng sản phẩm'",
            ],
          },
          {
            heading: "Mẹo",
            lines: ["Chụp ảnh rõ nét, nhiều góc độ để thu hút người mua!"],
          },
        ],
      },
      {
        id: "cac-meo-dau-gia-thanh-cong",
        title: "Các mẹo đấu giá thành công",
        blocks: [
          {
            heading: "Về thời gian",
            lines: [
              "Đấu giá vào phút cuối để tránh bị người khác vượt giá",
              "Theo dõi thời gian kết thúc, chuẩn bị sẵn số tiền",
              "Đặt báo thức 5-10 phút trước khi kết thúc",
            ],
          },
          {
            heading: "Về giá cả",
            lines: [
              "Đặt ngân sách tối đa trước khi bắt đầu",
              "Tăng giá từ từ, đừng đấu giá quá sớm",
              "Chú ý giá 'Mua ngay' nếu muốn sở hữu ngay",
            ],
          },
          {
            heading: "Nghiên cứu sản phẩm",
            lines: [
              "Xem kỹ hình ảnh và mô tả",
              "Kiểm tra uy tín người bán",
              "So sánh giá với thị trường",
            ],
          },
        ],
      },
    ],
  },
  {
    id: "thanh-toan-giao-dich",
    title: "Thanh toán & Giao dịch",
    items: [
      {
        id: "cach-thanh-toan-sau-khi-thang-dau-gia",
        title: "Cách thanh toán sau khi thắng đấu giá",
        blocks: [
          {
            heading: "Sau khi thắng đấu giá",
            ordered: true,
            lines: [
              "Bạn sẽ nhận thông báo qua email và trên web",
              "Có 48 giờ để hoàn tất thanh toán",
              "Vào 'Đơn hàng' để xem chi tiết",
              "Chọn phương thức thanh toán phù hợp",
            ],
          },
          {
            heading: "Phương thức thanh toán",
            lines: [
              "Chuyển khoản ngân hàng",
              "Ví điện tử (MoMo, ZaloPay, ViettelPay)",
              "Thanh toán khi nhận hàng (COD)",
              "Thẻ tín dụng/ghi nợ",
            ],
          },
          {
            heading: "Chú ý",
            lines: [
              "Không thanh toán trong 48h sẽ bị hủy đơn và có thể bị khóa tài khoản!",
            ],
          },
        ],
      },
      {
        id: "phi-dich-vu-va-cac-khoan-phi",
        title: "Phí dịch vụ và các khoản phí",
        related: {
          label: "Xem chính sách phí dịch vụ",
          href: APP_ROUTES.POLICY("fees"),
        },
        blocks: [
          {
            heading: "Người mua",
            lines: [
              "Miễn phí tham gia đấu giá",
              "Chỉ trả tiền sản phẩm + phí vận chuyển",
              "Không có phí ẩn",
            ],
          },
          {
            heading: "Người bán",
            lines: [
              "Đăng sản phẩm: Miễn phí",
              "Phí giao dịch thành công: 3% giá trị đơn hàng",
              "Phí rút tiền: 10.000 VNĐ/lần",
              "Phí quảng cáo sản phẩm: 50.000 VNĐ/7 ngày",
            ],
          },
          {
            heading: "Phí vận chuyển",
            lines: [
              "Tính theo khoảng cách và khối lượng",
              "Người mua thanh toán",
              "Có thể thỏa thuận với người bán",
            ],
          },
        ],
      },
      {
        id: "chinh-sach-hoan-tien-va-doi-tra",
        title: "Chính sách hoàn tiền và đổi trả",
        related: {
          label: "Xem chính sách an toàn người mua",
          href: APP_ROUTES.POLICY("buyer-protection"),
        },
        blocks: [
          {
            heading: "Được đổi trả khi",
            lines: [
              "Sản phẩm không đúng mô tả",
              "Hàng bị lỗi, hư hỏng do vận chuyển",
              "Người bán gửi sai sản phẩm",
              "Sản phẩm không đúng chất lượng cam kết",
            ],
          },
          {
            heading: "Thời gian",
            lines: [
              "Báo lỗi trong 24h sau khi nhận hàng",
              "Hoàn tiền trong 3-7 ngày làm việc",
              "Giữ nguyên bao bì và tem mác",
            ],
          },
          {
            heading: "Không đổi trả khi",
            lines: [
              "Đã sử dụng sản phẩm",
              "Thay đổi ý kiến cá nhân",
              "Quá thời hạn báo lỗi",
              "Sản phẩm thuộc danh mục không đổi trả",
            ],
          },
        ],
      },
      {
        id: "bao-mat-giao-dich",
        title: "Bảo mật giao dịch",
        related: {
          label: "Xem phương thức thanh toán",
          href: APP_ROUTES.POLICY("payment-methods"),
        },
        blocks: [
          {
            heading: "Hệ thống bảo mật",
            lines: [
              "Mã hóa SSL 256-bit cho mọi giao dịch",
              "Xác thực 2 lớp (2FA) cho tài khoản",
              "Hệ thống giám sát gian lận 24/7",
              "Không lưu trữ thông tin thẻ thanh toán",
            ],
          },
          {
            heading: "Mẹo an toàn",
            lines: [
              "Không chia sẻ mật khẩu với ai",
              "Đăng xuất sau khi sử dụng",
              "Kiểm tra URL có https:// và biểu tượng khóa",
              "Báo cáo ngay nếu phát hiện giao dịch lạ",
            ],
          },
          {
            heading: "Hỗ trợ",
            lines: ["Liên hệ 1900-xxxx nếu cần hỗ trợ khẩn cấp!"],
          },
        ],
      },
    ],
  },
  {
    id: "quan-ly-tai-khoan",
    title: "Quản lý tài khoản",
    items: [
      {
        id: "cach-cap-nhat-thong-tin-ca-nhan",
        title: "Cách cập nhật thông tin cá nhân",
        blocks: [
          {
            heading: "Các bước thực hiện",
            ordered: true,
            lines: [
              "Vào 'Tài khoản của tôi' > 'Cài đặt'",
              "Nhấn 'Chỉnh sửa thông tin'",
              "Cập nhật các thông tin cần thiết: Họ tên, SĐT, email, Địa chỉ giao hàng, CMND/CCCD",
              "Nhấn 'Lưu thay đổi'",
              "Xác thực qua email/SMS nếu cần",
            ],
          },
          {
            heading: "Thay đổi email",
            lines: [
              "Cần xác thực email mới",
              "Email cũ vẫn hoạt động cho đến khi xác thực",
            ],
          },
          {
            heading: "Đổi mật khẩu",
            lines: [
              "Nhập mật khẩu cũ",
              "Tạo mật khẩu mới (8+ ký tự, có chữ hoa, chữ thường, số)",
            ],
          },
        ],
      },
      {
        id: "quan-ly-dau-gia-va-don-hang",
        title: "Quản lý đấu giá và đơn hàng",
        blocks: [
          {
            heading: "Đấu giá của tôi",
            lines: [
              "'Đang tham gia': Các phiên đấu giá bạn đang theo dõi",
              "'Đã thắng': Đấu giá thành công, cần thanh toán",
              "'Đã thua': Lịch sử đấu giá không thành công",
              "'Yêu thích': Sản phẩm đã lưu để theo dõi",
            ],
          },
          {
            heading: "Đơn hàng",
            lines: [
              "'Chờ thanh toán': Cần thanh toán trong 48h",
              "'Đã thanh toán': Chờ người bán gửi hàng",
              "'Đang giao': Đơn hàng đang vận chuyển",
              "'Đã nhận': Giao dịch hoàn tất",
              "'Đã hủy/Hoàn tiền': Đơn hàng có vấn đề",
            ],
          },
          {
            heading: "Bán hàng",
            lines: [
              "Theo dõi tình trạng sản phẩm đang bán",
              "Xem số lượt đấu giá và giá hiện tại",
              "Quản lý đơn hàng cần giao",
            ],
          },
        ],
      },
      {
        id: "cai-dat-thong-bao",
        title: "Cài đặt thông báo",
        blocks: [
          {
            heading: "Thông báo email",
            lines: [
              "Kết quả đấu giá (thắng/thua)",
              "Nhắc nhở thanh toán",
              "Cập nhật trạng thái đơn hàng",
              "Khuyến mại và ưu đãi mới",
              "Tin tức và hướng dẫn",
            ],
          },
          {
            heading: "Thông báo trên web",
            lines: [
              "Thông báo thời gian thực",
              "Cập nhật giá đấu giá",
              "Tin nhắn từ người mua/bán",
              "Thông báo hệ thống",
            ],
          },
          {
            heading: "Tùy chỉnh",
            ordered: true,
            lines: [
              "Vào 'Cài đặt' > 'Thông báo'",
              "Bật/tắt từng loại thông báo",
              "Chọn thời gian nhận thông báo",
              "Thiết lập mức độ ưu tiên",
            ],
          },
          {
            heading: "Khuyến cáo",
            lines: ["Bật thông báo đấu giá để không bỏ lỡ cơ hội!"],
          },
        ],
      },
      {
        id: "bao-mat-tai-khoan",
        title: "Bảo mật tài khoản",
        blocks: [
          {
            heading: "Xác thực 2 lớp (2FA)",
            ordered: true,
            lines: [
              "Vào 'Cài đặt' > 'Bảo mật'",
              "Bật 'Xác thực 2 lớp'",
              "Liên kết với ứng dụng Google Authenticator",
              "Lưu mã khôi phục ở nơi an toàn",
            ],
          },
          {
            heading: "Dấu hiệu tài khoản bị hack",
            lines: [
              "Đăng nhập từ địa điểm lạ",
              "Thay đổi mật khẩu không do bạn",
              "Giao dịch không rõ nguồn gốc",
              "Email thông báo lạ",
            ],
          },
          {
            heading: "Biện pháp phòng chống",
            lines: [
              "Sử dụng mật khẩu mạnh, độc nhất",
              "Không đăng nhập trên máy công cộng",
              "Luôn đăng xuất sau khi sử dụng",
              "Cập nhật trình duyệt thường xuyên",
              "Báo cáo ngay khi phát hiện bất thường",
            ],
          },
          {
            heading: "SOS",
            lines: ["Gọi hotline 1900-xxxx nếu tài khoản bị xâm nhập!"],
          },
        ],
      },
    ],
  },
  {
    id: "ho-tro-va-lien-he",
    title: "Hỗ trợ & Liên hệ",
    items: [
      {
        id: "cach-lien-he-ho-tro-khach-hang",
        title: "Cách liên hệ hỗ trợ khách hàng",
        related: {
          label: "Gửi yêu cầu hỗ trợ",
          href: APP_ROUTES.CONTACT,
        },
        blocks: [
          {
            heading: "Hỗ trợ trực tuyến",
            lines: [
              "Chat trực tiếp trên website (góc dưới phải)",
              "Thời gian: 8:00 - 22:00 hàng ngày",
              "Phản hồi trong 2-5 phút",
            ],
          },
          {
            heading: "Email hỗ trợ",
            lines: [
              "Email: support@bidy.vn",
              "Phản hồi trong 2-4 giờ (giờ hành chính)",
              "Đính kèm ảnh chụp màn hình nếu có lỗi",
            ],
          },
          {
            heading: "Hotline",
            lines: [
              "SĐT: 1900-1234 (miễn phí)",
              "Thời gian: 8:00 - 18:00 (T2-T6)",
              "Hỗ trợ khẩn cấp 24/7 cho giao dịch",
            ],
          },
          {
            heading: "Mạng xã hội",
            lines: [
              "Facebook: @BidyVietnam",
              "Zalo OA: Bidy - Đấu Giá Trực Tuyến",
            ],
          },
          {
            heading: "Khi liên hệ, cung cấp",
            lines: [
              "Tên đăng nhập",
              "Mô tả chi tiết vấn đề",
              "Ảnh chụp màn hình (nếu có)",
              "Mã đơn hàng (nếu liên quan)",
            ],
          },
        ],
      },
      {
        id: "bao-cao-su-co-va-khieu-nai",
        title: "Báo cáo sự cố và khiếu nại",
        related: {
          label: "Gửi yêu cầu hỗ trợ",
          href: APP_ROUTES.CONTACT,
        },
        blocks: [
          {
            heading: "Sự cố khẩn cấp",
            lines: [
              "Tài khoản bị hack",
              "Giao dịch không rõ nguồn gốc",
              "Lỗi thanh toán",
              "Không nhận được hàng sau 7 ngày",
              "Liên hệ ngay: 1900-1234 (24/7)",
            ],
          },
          {
            heading: "Khiếu nại thường",
            ordered: true,
            lines: [
              "Vào 'Tài khoản' > 'Hỗ trợ' > 'Gửi khiếu nại'",
              "Chọn loại khiếu nại: Sản phẩm không đúng mô tả, Người bán không giao hàng, Chất lượng dịch vụ, Vấn đề thanh toán",
              "Mô tả chi tiết vấn đề",
              "Đính kèm bằng chứng (ảnh, video)",
              "Gửi khiếu nại",
            ],
          },
          {
            heading: "Thời gian xử lý",
            lines: [
              "Khiếu nại thường: 1-3 ngày",
              "Khiếu nại phức tạp: 3-7 ngày",
              "Tranh chấp: 7-15 ngày",
            ],
          },
          {
            heading: "Cam kết",
            lines: ["Xử lý công bằng, minh bạch 100%!"],
          },
        ],
      },
      {
        id: "cau-hoi-thuong-gap-faq",
        title: "Câu hỏi thường gặp (FAQ)",
        blocks: [
          {
            heading: "Tại sao tôi không đấu giá được?",
            lines: [
              "Kiểm tra: đăng nhập chưa, số dư tài khoản, giá đấu có hợp lệ không",
            ],
          },
          {
            heading: "Làm sao biết mình thắng đấu giá?",
            lines: [
              "Nhận thông báo qua email và trên web ngay khi phiên kết thúc",
            ],
          },
          {
            heading: "Quên mật khẩu thì làm sao?",
            lines: [
              "Nhấn 'Quên mật khẩu' → nhập email → làm theo hướng dẫn",
            ],
          },
          {
            heading: "Tại sao không nhận được email thông báo?",
            lines: [
              "Kiểm tra thùng spam, xác nhận email đã đúng chưa",
            ],
          },
          {
            heading: "Có thể hủy đấu giá sau khi đã đặt?",
            lines: [
              "Không thể hủy, cân nhắc kỹ trước khi đấu giá",
            ],
          },
          {
            heading: "Phí vận chuyển tính như thế nào?",
            lines: [
              "Dựa trên khoảng cách và trọng lượng, hiển thị trước khi thanh toán",
            ],
          },
          {
            heading: "Làm sao để kiểm tra uy tín người bán?",
            lines: [
              "Xem điểm đánh giá, số lượng giao dịch thành công, nhận xét từ người mua khác",
            ],
          },
        ],
      },
      {
        id: "huong-dan-su-dung-tinh-nang-nang-cao",
        title: "Hướng dẫn sử dụng tính năng nâng cao",
        blocks: [
          {
            heading: "Đấu giá tự động",
            ordered: true,
            lines: [
              "Vào chi tiết sản phẩm",
              "Nhấn 'Đấu giá tự động'",
              "Đặt giá tối đa bạn sẵn sàng trả",
              "Hệ thống sẽ tự động đấu giá thay bạn",
            ],
          },
          {
            heading: "Lợi ích đấu giá tự động",
            lines: ["Không cần theo dõi liên tục, tăng cơ hội thắng"],
          },
          {
            heading: "Danh sách yêu thích",
            lines: [
              "Lưu sản phẩm quan tâm để theo dõi",
              "Nhận thông báo khi có sản phẩm tương tự",
              "Theo dõi thay đổi giá",
            ],
          },
          {
            heading: "Bộ lọc nâng cao",
            lines: [
              "Lọc theo giá, thời gian, địa điểm",
              "Tìm kiếm theo từ khóa chính xác",
              "Sắp xếp theo mức độ phổ biến",
            ],
          },
          {
            heading: "Thống kê cá nhân",
            lines: [
              "Xem lịch sử đấu giá chi tiết",
              "Phân tích tỷ lệ thắng/thua",
              "Theo dõi số tiền đã chi tiêu",
              "Đánh giá hiệu quả đấu giá",
            ],
          },
          {
            heading: "Khuyến cáo",
            lines: [
              "Sử dụng các tính năng này để tối ưu hóa trải nghiệm đấu giá!",
            ],
          },
        ],
      },
    ],
  },
];
