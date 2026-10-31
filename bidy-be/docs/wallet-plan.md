# Bidy Platform — Wallet Service Implementation Plan

> Tài liệu triển khai ví điện tử + escrow cho nền tảng đấu giá Bidy.
> Phạm vi: nạp tiền (chuyển khoản ngân hàng + webhook Sepay), thanh toán order (escrow), release cho seller (trừ 5%), rút tiền (admin chuyển khoản thủ công), thống kê & đối soát.
>
> **Phiên bản này đã được đối chiếu với codebase thực tế** (branch `feature/migrate-postgres`).
> Các mục có nhãn `[AUDIT]` là chỗ plan gốc lệch với code đang chạy — đọc kỹ trước khi implement.

---

## 0. Nguyên tắc thiết kế (đọc trước khi code)

Sáu nguyên tắc dưới đây chi phối toàn bộ phần còn lại của tài liệu. Nếu một đoạn code vi phạm bất kỳ nguyên tắc nào, đó là bug — kể cả khi test vẫn pass.

1. **Ledger là nguồn sự thật, `balance` chỉ là cache.** `wallets.balance` tồn tại để đọc nhanh. Số dư đúng luôn là `SUM(wallet_ledger.amount)`. Mọi thay đổi `balance` phải đi kèm đúng một dòng ledger, trong cùng một transaction.
2. **Ledger là append-only.** Không `UPDATE`, không `DELETE` trên `wallet_ledger`. Sai thì ghi bút toán đảo (`adjustment`), không sửa lịch sử.
3. **Double-entry.** Tiền không tự sinh ra hay biến mất. Mỗi sự kiện phải có đủ vế trừ và vế cộng, nên `SUM(wallet_ledger.amount)` trên toàn hệ thống luôn bằng 0.
4. **Idempotent by construction.** Mỗi sự kiện nghiệp vụ có một `idempotency_key` duy nhất do DB ràng buộc, không dựa vào application tự kiểm tra trước khi ghi.
5. **Phí thu đúng một lần, tại thời điểm release.** Seller nhận vào ví số tiền đã sạch (`final_price − 5%`). Rút tiền **luôn hoàn đủ 100%**, không phân loại nguồn tiền, không có cờ khấu trừ.

   Lý do nguyên tắc 5 quan trọng: tiền trong ví là fungible — một khi đã cộng vào `balance` thì không còn phân biệt được đồng nào từ đấu giá, đồng nào user tự nạp. Nếu để việc khấu trừ xảy ra lúc rút, ta buộc phải tách số dư thành nhiều "hũ" (`available_balance` / `earning_balance`) và duy trì đồng bộ giữa chúng — phức tạp hơn nhiều mà kết quả tài chính cuối cùng vẫn giống hệt. Thu phí ngay tại release làm bài toán này biến mất hoàn toàn.

6. **`[AUDIT]` Không làm số học tiền tệ trong JavaScript trên giá trị TypeORM trả về.**
   TypeORM map cột `decimal` thành **string**, trong khi entity hiện tại khai `amount!: number` (`src/modules/order/entity/transaction.entity.ts:33`) — nên code phải `Number(...)` thủ công khắp nơi (`order.service.ts:212, 336`). Với ledger, một phép `balance + amount` trên string sẽ ra **nối chuỗi**, và đây là tiền.

   Bắt buộc chọn một trong hai, thống nhất toàn module:
   - **Ưu tiên:** để Postgres tính — `UPDATE wallets SET balance = balance + $1 ... RETURNING balance`. Số học `numeric` chạy trong DB, không qua JS.
   - Hoặc: khai `ColumnNumericTransformer` cho mọi cột tiền của wallet module và không bao giờ đọc raw.

   Không dùng `parseFloat`/`Number` rồi cộng trong JS rồi ghi ngược lại — float 64-bit không biểu diễn chính xác được tiền VND ở mức nghìn tỷ.

---

## 0.1 Mô hình dòng tiền thật — đọc trước khi hiểu bất kỳ luồng nào

**Sepay không phải cổng thanh toán. Sepay không giữ tiền, không xử lý giao dịch, không có API hoàn tiền.**

Tiền thật đi như thế này:

```
Buyer  ──(chuyển khoản ngân hàng thật)──►  TÀI KHOẢN NGÂN HÀNG CỦA ADMIN
                                                    │
                                          Sepay đọc biến động số dư
                                          của tài khoản đó
                                                    │
                                                    ▼
                                          POST webhook  ──►  Bidy backend
                                                                  │
                                                        ghi wallet_ledger
                                                        (số dư trong DB)
```

Ba hệ quả chi phối toàn bộ thiết kế:

**a) Ví, escrow, platform wallet đều chỉ là con số trong DB.**
Không có tài khoản ngân hàng riêng cho escrow. Toàn bộ tiền của mọi user — số dư chưa tiêu, tiền đang giữ escrow, hoa hồng nền tảng — nằm chung trong **một tài khoản ngân hàng duy nhất** của admin. `wallet_ledger` là sổ ghi *ai sở hữu bao nhiêu* trong cái tài khoản chung đó. Đây là tiền giữ hộ (liability), không phải doanh thu.

**b) Webhook Sepay là con đường duy nhất tiền "vào" hệ thống — và nó tạo ra số dư từ hư không.**
`topup_success` là bút toán duy nhất trong hệ thống không có vế đối ứng nội bộ (vế đối ứng của nó là tài khoản ngân hàng thật, nằm ngoài DB). Nghĩa là **bất kỳ ai gọi được endpoint webhook đều in được tiền**. Middleware `verifySepayWebhook` không phải một lớp bảo vệ "nên có" — nó là thứ duy nhất đứng giữa kẻ tấn công và số dư vô hạn. Số tiền **luôn** lấy từ payload đã xác thực của Sepay, không bao giờ từ input của client.

> Ghi chú cho nguyên tắc 3 (double-entry): `SUM(wallet_ledger.amount) = 0` chỉ đúng nếu coi `topup_success` và `withdraw_hold` là hai cửa ra/vào biên. Trên thực tế `SUM` toàn bảng sẽ bằng **tổng tiền đang nằm trong tài khoản ngân hàng thuộc về user và nền tảng**. Xem Invariant 1 đã sửa lại ở Phase 6.

**c) Rút tiền là admin tự chuyển khoản tay, không có API nào làm hộ.**
Không có lệnh chi tự động. Admin mở app ngân hàng, chuyển tiền, chụp biên lai, upload lên hệ thống. Đó là lý do bảng `wallet_withdrawal_requests` có `proof_url`, `admin_id`, `deadline_at` — nó là một **quy trình vận hành của con người** được hệ thống theo dõi, không phải một giao dịch tự động.

Vì vậy ràng buộc thật của việc rút tiền không phải số dư trong DB, mà là **số dư thật trong tài khoản ngân hàng của admin**. Hệ thống không biết con số đó. Admin phải tự biết trước khi bấm `complete`.

**d) Sepay có thể bỏ sót — phải có đường đối soát thủ công.**
Nếu webhook không tới (Sepay lỗi, mạng rớt, đổi cấu hình), tiền đã nằm trong ngân hàng nhưng ledger không biết — user mất tiền trên giấy tờ. Đây không phải giả thuyết, đây là chế độ hỏng bình thường của kiến trúc đọc-biến-động-số-dư.

Bắt buộc có: admin đối chiếu sao kê ngân hàng, tìm giao dịch thiếu, ghi `adjustment` với `metadata` chứa mã giao dịch ngân hàng và lý do. `adjustment` không phải "tính năng phụ cho trường hợp hiếm" — nó là van an toàn của toàn hệ thống nạp tiền.

---

## 1. Schema cuối cùng

### 1.1 Bảng mới

```dbml
Table wallets {
  id bigint [primary key, increment]
  user_id bigint [not null, unique, ref: > users.id]
  balance decimal(14,2) [not null, default: 0, note: "Cache. Nguồn sự thật là SUM(wallet_ledger.amount)"]
  status varchar(20) [not null, default: 'active', note: "active, locked (tranh chấp/gian lận)"]
  created_at timestamptz [not null, default: `now()`]
  updated_at timestamptz [not null, default: `now()`]
}

Table wallet_ledger {
  id bigint [primary key, increment]
  wallet_id bigint [not null, ref: > wallets.id]
  type varchar(30) [not null, note: "Xem mục 1.2"]
  amount decimal(14,2) [not null, note: "Có dấu: dương = cộng, âm = trừ"]
  balance_after decimal(14,2) [not null, note: "Snapshot số dư sau bút toán, phục vụ đối soát"]
  reference_type varchar(30) [note: "sepay_webhook, order, auction_deposit, withdrawal_request"]
  reference_id bigint [note: "Polymorphic FK"]
  idempotency_key varchar(255) [unique, not null, note: "Format {type}:{reference_id}. Xem mục 1.3"]
  metadata jsonb [note: "Payload phụ: admin_id thao tác, lý do adjustment, fee_rate áp dụng..."]
  created_at timestamptz [not null, default: `now()`]

  Indexes {
    wallet_id
    (reference_type, reference_id)
    (wallet_id, created_at) [note: "Phân trang lịch sử giao dịch của user"]
  }
}

Table wallet_withdrawal_requests {
  id bigint [primary key, increment]
  wallet_id bigint [not null, ref: > wallets.id]
  user_id bigint [not null, ref: > users.id, note: "Denormalized, khỏi join wallets"]
  amount decimal(14,2) [not null]
  bank_account_no varchar(50) [not null]
  bank_account_name varchar(255) [not null]
  bank_code varchar(20) [not null]
  status varchar(20) [not null, default: 'pending', note: "pending, processing, completed, rejected, cancelled"]
  cancelled_by varchar(20) [note: "user | admin. NULL nếu chưa đóng"]
  deadline_at timestamptz [not null, note: "= created_at + 10 ngày (SLA cam kết với user)"]
  admin_id bigint [ref: > users.id, note: "Admin thao tác. Không phải người sở hữu tiền"]
  proof_url varchar(1024) [note: "Biên lai chuyển khoản admin upload"]
  reject_reason text
  processed_at timestamptz
  created_at timestamptz [not null, default: `now()`]
  updated_at timestamptz [not null, default: `now()`]

  Indexes {
    wallet_id
    user_id
    status
    deadline_at
    (user_id) [unique, note: "PARTIAL: WHERE status IN ('pending','processing'). Mỗi user chỉ một request đang mở tại một thời điểm"]
  }
}

Table wallet_daily_summary {
  id bigint [primary key, increment]
  summary_date date [not null]
  total_topup decimal(14,2) [not null, default: 0]
  total_payment decimal(14,2) [not null, default: 0]
  total_withdraw decimal(14,2) [not null, default: 0]
  total_platform_fee decimal(14,2) [not null, default: 0]
  active_wallets int [not null, default: 0]
  created_at timestamptz [not null, default: `now()`]

  Indexes {
    summary_date [unique]
  }
}
```

### 1.2 Danh sách `wallet_ledger.type`

| Nhóm | Type | Dấu amount | Ý nghĩa |
|---|---|---|---|
| Nạp | `topup_success` | `+` | Sepay webhook xác nhận tiền về |
| Nạp | `topup_failed` | — | Không ghi ledger, chỉ log ở `transactions` |
| Thanh toán | `payment` | `−` (buyer) | Buyer trả tiền order, tiền vào escrow |
| Thanh toán | `payment_escrow_in` | `+` (platform) | Vế đối ứng: tiền nằm ở platform wallet |
| Thanh toán | `payment_release` | `+` (seller) | Release cho seller sau khi trừ hoa hồng |
| Thanh toán | `payment_escrow_out` | `−` (platform) | Vế đối ứng của release |
| Thanh toán | `platform_fee` | `+` (platform) | Hoa hồng 5% giữ lại |
| Thanh toán | `payment_refund` | `+` (buyer) | Hoàn tiền buyer khi hủy trước release |
| Rút | `withdraw_hold` | `−` | Trừ ví ngay khi tạo request |
| Rút | `withdraw_success` | `0` | Đóng sổ khi admin xác nhận đã chuyển |
| Rút | `withdraw_failed` | `+` | Hoàn tiền khi admin reject |
| Rút | `withdraw_cancelled` | `+` | Hoàn tiền khi user tự hủy |
| Khác | `adjustment` | `±` | Admin điều chỉnh thủ công, bắt buộc có lý do |

> **`[AUDIT]` Nhóm tiền cọc (`deposit_hold` / `deposit_release` / `deposit_forfeit`) đã được cắt khỏi scope v1.**
> Bảng `auction_deposits` có tồn tại (`src/modules/auction/entity/auction-deposit.entity.ts`) nhưng là **bảng chết**: không service nào import nó, chỉ `data-source.ts` đăng ký entity. Không có flow đấu giá nào đang giữ hay hoàn cọc. Tích hợp cọc vào ví là một tính năng mới hoàn toàn, không phải "nối ví vào cái sẵn có" — nên tách thành phase riêng sau khi ledger engine ổn định. Xem mục 5.1.

### 1.3 Quy ước `idempotency_key`

```
topup_success       → sepay:{provider_transaction_id}
payment             → order_payment:{order_id}
payment_escrow_in   → order_escrow_in:{order_id}
payment_release     → payment_release:{order_id}
payment_escrow_out  → order_escrow_out:{order_id}
platform_fee        → platform_fee:{order_id}
payment_refund      → order_refund:{order_id}
withdraw_hold       → withdraw_hold:{withdrawal_request_id}
withdraw_success    → withdraw_success:{withdrawal_request_id}
withdraw_failed     → withdraw_failed:{withdrawal_request_id}
withdraw_cancelled  → withdraw_cancelled:{withdrawal_request_id}
adjustment          → adjustment:{uuid}
```

Key có cấu trúc `{type}:{reference_id}` vừa đảm bảo unique, vừa tự chống trùng nghiệp vụ: nếu code lỡ gọi release hai lần cho cùng một order do bug hoặc do user double-click, DB chặn ngay ở tầng constraint thay vì phải tin vào logic kiểm tra ở application.

### 1.4 Sửa bảng có sẵn

```dbml
// orders — thêm trạng thái escrow + mốc giao hàng
Table orders {
  // ... giữ nguyên các cột cũ
  fund_status varchar(20) [not null, default: 'none', note: "none, held, released, refunded"]
  platform_fee decimal(14,2) [note: "Snapshot tiền hoa hồng, ghi lúc release"]
  seller_payout decimal(14,2) [note: "Snapshot final_price + shipping_fee - platform_fee"]
  fee_rate decimal(5,4) [note: "Snapshot tỷ lệ áp dụng (0.0500). Giữ lại phòng khi đổi chính sách phí"]
  payment_channel varchar(20) [note: "wallet | qr_direct. Buyer trả bằng số dư ví hay quét QR trả thẳng"]
  delivered_at timestamptz [note: "THÊM MỚI. Mốc giao hàng, FE dùng để cảnh báo đơn quá hạn chưa release"]
  released_at timestamptz
  released_by bigint [ref: > users.id, note: "Admin bấm release. Luôn có giá trị — không có auto-release"]
}

// transactions — nới ràng buộc để phục vụ nạp ví
Table transactions {
  order_id bigint [ref: > orders.id, note: "ĐỔI: nullable. Giao dịch nạp ví không gắn order"]
  wallet_id bigint [ref: > wallets.id, note: "THÊM"]
  provider_transaction_id varchar(255) [unique, note: "ĐỔI: thêm unique, chặn Sepay ghi trùng"]
  // ... giữ nguyên phần còn lại
}
```

**`[AUDIT]` Xác nhận trạng thái hiện tại của code:**

| Điểm | Thực tế trong repo |
|---|---|
| `orders.delivered_at` | **Chưa có.** `order.entity.ts` chỉ có `shipping_status`, `tracking_number`, `payment_deadline`. Phải thêm cột ở Phase 1, và `OrderService` phải set nó khi `shipping_status` chuyển sang `delivered`. Không dùng cho auto-release (đã chốt bỏ), mà để FE tính và hiện cảnh báo đơn quá hạn chưa release. |
| `transactions.order_id` | **NOT NULL** (`transaction.entity.ts:19`) → đúng như plan dự đoán, cần `ALTER ... DROP NOT NULL`. |
| `transactions.provider_transaction_id` | **Chưa có unique.** Idempotency hiện chỉ dựa vào `manager.findOne({providerTransactionId})` bên trong transaction (`order.service.ts:305`) — hai webhook Sepay đến đồng thời vẫn lọt cả hai. Unique index là fix đúng gốc. |
| Precision | Xác nhận `decimal(12,2)` ở `orders.final_price/shipping_fee/total_amount`, `transactions.amount`, `auction_deposits.amount` → mục 1.5 áp dụng đúng. |

Phân vai rõ ràng giữa hai bảng log: `transactions` ghi nhận **biến động ở tài khoản ngân hàng thật** (do Sepay báo về), còn `wallet_ledger` ghi nhận **quyền sở hữu số tiền đó trong hệ thống**. Một lần nạp thành công sinh ra một dòng ở mỗi bảng.

`payment_method = 'sepay'` là cách gọi tắt đang dùng trong code hiện tại; đúng bản chất thì phương thức là **chuyển khoản ngân hàng**, còn Sepay chỉ là nguồn thông báo. Giữ nguyên giá trị để không phá dữ liệu cũ, nhưng đừng hiểu nhầm khi đọc.

### 1.5 Thống nhất precision

Đưa toàn bộ cột tiền tệ về `decimal(14,2)`: `orders.final_price`, `orders.shipping_fee`, `orders.total_amount`, `transactions.amount`, `auctions.*_price`, `auction_deposits.amount`, `bid_history.amount`. Trộn `(12,2)` và `(14,2)` không gây lỗi ngay nhưng sẽ khiến việc cộng trừ giữa các bảng khó rà soát về sau.

---

## 1.6 `[AUDIT]` Quy ước tích hợp với codebase

Những điểm dưới đây là **quyết định đã chốt**, không phải gợi ý.

**a) Prefix API là `/api/v1`, không phải `/api`.**
`src/routes/index.ts:22` đặt `api_prefixes = 'api/v1'`. Mọi endpoint trong tài liệu này đã được viết lại theo đúng prefix thật.

**b) Wallet router hiện mount hai lần — phải gỡ một.**
`src/routes/index.ts:37-38` đang mount cùng một router vào cả `/api/v1/wallets` và `/api/v1/wallet`. Chốt giữ **`/api/v1/wallet`** (số ít, khớp với "ví của tôi" — mỗi user một ví), xoá dòng `/wallets`. Làm ngay ở Phase 1 trước khi có client nào bám vào đường dẫn sai.

**c) Guard admin dùng `isAdmin`, không dùng `requirePermission`.**
`src/middlewares/permission.middleware.ts:24` đọc `req.user.role`, nhưng `isAuth` chỉ set `req.idUser / req.email / req.role` (`authen.middleware.ts:52-54`) — `requirePermission` sẽ luôn trả 401. Không route nào trong repo đang dùng nó; toàn bộ admin routes dùng `isAdmin` (`src/modules/admin/admin.route.ts`).

→ Wallet admin endpoints dùng `isAuth, isAdmin` giống `admin.route.ts`. **Không** thêm permission `wallet.*` (YAGNI — hệ role hiện tại chỉ có `user | admin`, chưa có nhu cầu tách quyền trong admin). Việc truy vết ai làm gì đã được bảo đảm bằng `admin_id` trong `wallet_ledger.metadata`.

**d) Platform user seed với `role='admin'`, định danh bằng env.**
`UserRole` chỉ có `user | admin` (`src/modules/user/enum/user.enum.ts:1`) — `role='system'` sẽ không khớp enum ở tầng application. Seed user hệ thống với `role='admin'`, `status='active'`, `password_hash` là chuỗi bcrypt không thể đăng nhập, email `system@internal.bidy`. Việc nhận diện platform wallet **chỉ** dựa vào `PLATFORM_WALLET_ID` trong env, không bao giờ query theo role.

**e) Mã QR giữ nguyên format đang chạy: `BIDY{orderId padStart 3}`.**
`order.service.ts:214-216` sinh `BIDY001`, và webhook parse bằng regex `new RegExp('BIDY(\\d{3,10})', 'i')` (`order.service.ts:281`). Prefix lấy từ `sepayConfig.paymentPrefix`. **Không** đổi sang `BIDYORD{order_id}` — sẽ phá regex và mọi QR đã phát hành.

**f) Cron đặt ở `src/schedulers/`.**
`src/server.ts:9` gọi `startCronJob` từ `src/schedulers/index.js`. `src/modules/cron/auction.job.ts` là file rỗng — đừng dùng. `node-cron` đã có sẵn trong deps.

**g) Rate limit dùng lại hạ tầng có sẵn.**
`express-rate-limit` + `rate-limit-redis` + `ioredis` đã cài. Không thêm dependency mới.

**h) Notification types mới cần thêm vào enum.**
`src/modules/notification/enum/notification-type.enum.ts` chưa có type nào cho ví. Thêm: `PAYMENT_RELEASED`, `WITHDRAWAL_COMPLETED`, `WITHDRAWAL_REJECTED`, `TOPUP_SUCCESS`.

**i) Mọi route/DTO mới phải có khối `@swagger` JSDoc** — theo convention đang áp dụng ở `wallet.route.ts` và các module khác. Thiếu thì endpoint biến mất khỏi `/api-docs`.

---

## 2. Phase triển khai

### Phase 1 — Migration, seed & dọn nền (1 ngày)

> `[AUDIT]` Tăng từ 0.5 → 1 ngày: thêm việc gỡ mount trùng, thêm `delivered_at`, quyết định platform user, thêm notification types.

- [ ] Viết migration tạo 4 bảng mới (mục 1.1).
- [ ] Viết migration `ALTER` các bảng có sẵn (mục 1.4, 1.5) — bao gồm `orders.delivered_at` và unique index trên `transactions.provider_transaction_id`.
- [ ] Cập nhật entity TypeORM tương ứng: `order.entity.ts`, `transaction.entity.ts`, và 4 entity wallet mới trong `src/modules/wallet/entity/`.
- [ ] **Seed user hệ thống + platform wallet** (`src/database/seeds/wallet.seed.ts`):
  ```sql
  INSERT INTO users (username, email, password_hash, role, status)
  VALUES ('system_platform', 'system@internal.bidy', '<bcrypt hash không đăng nhập được>', 'admin', 'active')
  ON CONFLICT (email) DO NOTHING;

  INSERT INTO wallets (user_id, balance, status)
  VALUES (<id vừa tạo>, 0, 'active')
  ON CONFLICT (user_id) DO NOTHING;
  ```
  Đăng ký seed vào `src/database/seeds/index.ts` cùng các seed hiện có.
- [ ] Lưu `PLATFORM_WALLET_ID` vào `.env` + `.env.example`, đọc qua `src/config/`. Không query theo `role` mỗi request — dữ liệu users có thể thay đổi, config thì không.
- [ ] Backfill: tạo wallet (balance = 0) cho toàn bộ user hiện có.
- [ ] Hook vào flow đăng ký (`AuthService`): mọi user mới tạo xong phải có wallet ngay **trong cùng transaction**.
- [ ] `[AUDIT]` Xoá dòng mount `/api/v1/wallets` trùng lặp ở `src/routes/index.ts:37`.
- [ ] `[AUDIT]` Thêm 4 giá trị mới vào `NotificationType`.
- [ ] Re-index GitNexus sau khi xong (`node .gitnexus/run.cjs analyze`).

### Phase 2 — Ledger engine (1–1.5 ngày)

Đây là lớp nền, tất cả nghiệp vụ phía sau đều gọi qua nó. Không cho phép bất kỳ service nào `UPDATE wallets.balance` trực tiếp.

Đặt tại `src/modules/wallet/wallet-ledger.service.ts`. `WalletService` hiện tại (`wallet.service.ts`) đang là stub trả số dư cứng `0` — thay thế bằng bản đọc thật.

- [ ] Hàm nội bộ `postEntry({ walletId, type, amount, referenceType, referenceId, idempotencyKey, metadata })`:
  1. `SELECT * FROM wallets WHERE id = ? FOR UPDATE` (khóa dòng, chống race condition).
  2. Kiểm tra `wallet.status = 'active'`.
  3. Nếu `amount < 0`: kiểm tra `balance + amount >= 0`, không đủ thì throw `INSUFFICIENT_BALANCE`.
  4. Tính `balance_after = balance + amount` — **trong SQL, không trong JS** (nguyên tắc 6).
  5. `INSERT INTO wallet_ledger (...)` — nếu dính unique violation trên `idempotency_key` (Postgres error code `23505`) thì bắt lỗi và trả về dòng ledger đã tồn tại (coi như thành công, không throw).
  6. `UPDATE wallets SET balance = balance_after, updated_at = now()`.
- [ ] Hàm `postTransfer(entries[])` — ghi nhiều bút toán trong **một** transaction, dùng cho các nghiệp vụ double-entry (thanh toán, release).

  **Assert đúng: chỉ các vế nội bộ mới phải cân bằng.**

  ```ts
  const BOUNDARY_TYPES = new Set([
    'topup_success', 'withdraw_hold', 'withdraw_success',
    'withdraw_failed', 'withdraw_cancelled', 'adjustment',
  ]);
  // vế đối ứng của nhóm này là tài khoản ngân hàng thật, nằm ngoài DB (mục 0.1b)
  assert(SUM(entries.filter(e => !BOUNDARY_TYPES.has(e.type)).amount) === 0)
  ```

  Assert `SUM(toàn bộ entries) = 0` là **sai** và sẽ chặn nhầm luồng QR pass-through ở 4D — luồng đó mở đầu bằng một vế `topup_success` (tiền từ ngân hàng vào) rồi mới tới hai vế nội bộ. Lỗi này đã bị `src/tests/wallet-e2e.check.ts` (E2E-02) bắt được khi kiểm tra tính nhất quán của chính tài liệu này.

  Quy tắc trên khớp chính xác với Invariant 1b ở Phase 6 — cùng một định nghĩa "nội bộ", dùng ở hai nơi.
- [ ] Chuẩn hóa thứ tự khóa ví: khi một transaction cần khóa nhiều ví, luôn `SELECT ... FOR UPDATE` theo `wallet_id` tăng dần để tránh deadlock.
- [ ] Error handling theo convention repo: dùng `AppError` / `ForbiddenError` trong `src/common/exceptions/`, response qua `apiResponse(...)`.
- [ ] Test: ghi trùng `idempotency_key` 100 lần song song → chỉ một dòng ledger được tạo, balance chỉ đổi một lần.
- [ ] **`src/tests/wallet-e2e.check.ts` đã có sẵn và đang chờ service này.** File tự phát hiện khi `WalletLedgerService` xuất hiện với đủ `postEntry`/`postTransfer`, rồi chạy 6 kịch bản E2E thật thay vì reference engine. Khi implement, chạy `npx tsx src/tests/wallet-e2e.check.ts` để biết mình đã khớp contract chưa.

### Phase 3 — Nạp tiền qua chuyển khoản ngân hàng (1 ngày)

> Xem mục 0.1 trước. Tiền vào thẳng tài khoản ngân hàng của admin; Sepay chỉ bắn webhook báo có biến động.

- [ ] `POST /api/v1/wallet/topup` — tạo `transactions` (status=pending, `order_id = NULL`, `wallet_id` = ví người gọi), trả về QR/nội dung chuyển khoản. Tái sử dụng cách build URL `qr.sepay.vn` đã có ở `OrderService.getOrderPaymentQr`.
- [ ] Endpoint webhook: **đã tồn tại** — `POST /api/v1/orders/sepay/webhook` với `verifySepayWebhook` (`src/middlewares/sepay-auth.middleware.ts`). Dùng lại, không tạo endpoint thứ hai. Logic phân nhánh topup-vs-order nằm trong `processSepayWebhook`.
  1. Verify chữ ký/API key của Sepay **trước tiên** — middleware đã làm. Đây là ranh giới tin cậy quan trọng nhất của hệ thống: qua được nó là in được tiền (mục 0.1b).
  2. Parse nội dung chuyển khoản để phân loại: khớp `BIDY{orderId}` → luồng thanh toán đơn (Phase 4D); khớp mã topup → luồng nạp ví.
  3. `postEntry({ type: 'topup_success', amount: +X, idempotencyKey: 'sepay:' + provider_transaction_id })`.
  4. `UPDATE transactions SET transaction_status = 'success'`.
  5. Trả **200 OK** kể cả khi phát hiện trùng lặp — nếu trả lỗi, Sepay sẽ retry vô ích. (Hành vi này code hiện tại đã đúng.)
- [ ] Trường hợp không parse được nội dung CK (user ghi sai): không cộng ví, ghi log riêng để admin xử lý thủ công bằng `adjustment`.
- [ ] **Đường đối soát thủ công (mục 0.1d):** `POST /api/v1/admin/wallet/adjustment` phải dùng được cho tình huống "tiền có trong sao kê ngân hàng nhưng webhook không về". Bắt buộc `reason` và mã giao dịch ngân hàng trong `metadata`. Đây là van an toàn, không phải tính năng phụ.
- [ ] Số tiền cộng vào ví **luôn** lấy từ `payload.transferAmount` của Sepay, không bao giờ từ body do client gửi.
- [ ] Rate limit endpoint topup.
- [ ] Test: bắn lại cùng một payload webhook 10 lần → balance chỉ tăng một lần.

### Phase 4 — Thanh toán order & escrow (2–2.5 ngày)

> `[AUDIT]` Tăng từ 1.5–2 → 2–2.5 ngày. Đây **không phải** viết mới: `OrderService.processSepayWebhook` (`order.service.ts:267-381`, 115 dòng) đã làm phần lớn việc — parse code, lock order, check idempotency, ghi `transactions`, set `payment_status='paid'`, emit socket `order:paid`. Công việc thật là chèn `postTransfer` vào đúng chỗ và xử lý hai thay đổi hành vi ở mục 4E.

**4A. Buyer thanh toán bằng số dư ví** — `POST /api/v1/orders/{id}/pay`

Double-entry, hai vế trong một transaction:

```
postTransfer([
  { wallet: buyer,    type: 'payment',           amount: -total_amount,
    key: 'order_payment:{order_id}' },
  { wallet: platform, type: 'payment_escrow_in', amount: +total_amount,
    key: 'order_escrow_in:{order_id}' }
])
UPDATE orders SET payment_status='paid', fund_status='held', payment_channel='wallet'
```

Kiểm tra trước khi ghi: `order.buyer_id = current_user`, `order.payment_status = 'pending'`, `now() <= order.payment_deadline`.

**4B. Release cho seller** — `POST /api/v1/admin/orders/{id}/release` *(isAuth, isAdmin)*

```
SELECT orders WHERE id=? FOR UPDATE
Assert fund_status = 'held'                       -- chặn release hai lần

fee_rate      = 0.05
platform_fee  = ROUND(final_price * fee_rate, 2)  -- CHỐT: tính trên final_price, KHÔNG gồm shipping_fee
seller_payout = final_price + shipping_fee - platform_fee   -- seller nhận nguyên tiền ship

postTransfer([
  { wallet: platform, type: 'payment_escrow_out', amount: -(total_amount),
    key: 'order_escrow_out:{order_id}' },
  { wallet: seller,   type: 'payment_release',    amount: +seller_payout,
    key: 'payment_release:{order_id}' },
  { wallet: platform, type: 'platform_fee',       amount: +platform_fee,
    key: 'platform_fee:{order_id}' }
])
UPDATE orders SET fund_status='released', platform_fee=?, seller_payout=?,
                  fee_rate=?, released_at=now(), released_by=?
```

Release **chỉ chạy bằng tay qua endpoint này**. Không có cron auto-release — xem 4F.

**4C. Refund trước khi release** — `POST /api/v1/admin/orders/{id}/refund` *(isAuth, isAdmin)*

Dùng khi đơn bị hủy hoặc quá hạn trong lúc tiền còn nằm ở escrow. **Đã chốt: không có luồng refund sau khi release** — nền tảng không nhận khiếu nại sau khi tiền về ví seller. Do đó không có clawback, không có chính sách giữ tiền N ngày, và seller không bao giờ bị âm ví. `postEntry` giữ nguyên guard `balance + amount >= 0` như một invariant cứng, không có ngoại lệ.

```
Assert fund_status = 'held'    -- 'released' là trạng thái cuối, không đảo ngược được
postTransfer([
  { wallet: platform, type: 'payment_escrow_out', amount: -total_amount,
    key: 'order_escrow_out:{order_id}' },
  { wallet: buyer,    type: 'payment_refund',     amount: +total_amount,
    key: 'order_refund:{order_id}' }
])
UPDATE orders SET payment_status='refunded', fund_status='refunded'
```

**4D. Thanh toán QR trực tiếp** — `GET /api/v1/orders/{id}/payment-qr` *(endpoint đã tồn tại)*

Buyer quét QR trả thẳng, không dùng số dư ví. Xử lý theo mô hình **pass-through**: nạp và thanh toán gộp trong một transaction, không tạo luồng tiền song song bỏ qua ví.

```
1. Sinh QR với nội dung CK BIDY{orderId padStart 3}   -- format hiện hành, GIỮ NGUYÊN
   Tạo transactions (status=pending, order_id={order_id}, wallet_id=buyer_wallet)

2. Webhook Sepay về (processSepayWebhook):
   postTransfer([
     { wallet: buyer,    type: 'topup_success',     amount: +total_amount,
       key: 'sepay:{provider_transaction_id}' },
     { wallet: buyer,    type: 'payment',           amount: -total_amount,
       key: 'order_payment:{order_id}' },
     { wallet: platform, type: 'payment_escrow_in', amount: +total_amount,
       key: 'order_escrow_in:{order_id}' }
   ])
   UPDATE orders SET payment_status='paid', fund_status='held',
                     payment_channel='qr_direct'
```

Nhờ đi vòng qua ví, thống kê "tổng đã nạp" và "tổng đã trả" của user vẫn chỉ cần query một bảng `wallet_ledger` duy nhất, không phải union hai nguồn dữ liệu. Lịch sử giao dịch cũng hiển thị tự nhiên: thấy tiền vào rồi tiền ra, số dư cuối không đổi.

**4E. `[AUDIT]` Hai thay đổi hành vi so với code đang chạy — ĐÃ GHI NHẬN, cần implement có chủ đích**

Cả hai đều nằm trong `processSepayWebhook`. Không phải bug đang có, mà là quyết định đổi nghiệp vụ:

| Tình huống | Hành vi hiện tại | Hành vi mới |
|---|---|---|
| **Chuyển thiếu** (`transferAmount < total_amount`) | `order.service.ts:334-346`: ghi `transactions` với `transaction_status='underpaid'`, **không cộng gì cho user**. Tiền treo, chỉ có log. | Ghi `topup_success` `+transferAmount` vào ví buyer. Đơn **không** đánh `paid`, `fund_status` vẫn `none`. Notify buyer bù thêm bằng số dư ví. |
| **Chuyển dư** (`transferAmount > total_amount`) | `order.service.ts:333` chỉ so `<`, nên dư vẫn `paid` và **phần chênh bị nuốt** — không ghi vào đâu cả. | Ghi `topup_success` `+transferAmount` (toàn bộ), rồi `payment` `−total_amount`. Phần chênh tự động ở lại ví buyer. Đơn `paid` như cũ. |

Cả hai đều rơi tự nhiên ra khỏi mô hình pass-through ở 4D: **luôn** cộng đủ số tiền thật nhận được vào ví trước, rồi mới trừ đúng số tiền đơn hàng. Không còn nhánh `underpaid` đặc biệt.

- [ ] **Không parse được `order_id`** từ nội dung CK → ghi `topup_success` như một lần nạp thường, để user tự thanh toán bằng số dư hoặc đẩy admin xử lý thủ công. Không tự đoán gán vào đơn.
**4F. Không có auto-release**

Đã chốt: tiền chỉ rời escrow khi admin bấm 4B. Không cron, không ngưỡng ngày. Thay vào đó API trả `delivered_at` cho FE, FE tự hiện cảnh báo khi đơn đã giao lâu mà `fund_status` vẫn `held`.

Đánh đổi có ý thức: escrow có thể đọng vô hạn nếu admin quên. Invariant 3 ở Phase 6 (số dư platform wallet ≥ tổng escrow đang giữ) vẫn đúng, nhưng nó không phát hiện được việc đọng — nên `GET /api/v1/admin/wallet/escrow` phải sắp xếp theo `delivered_at` tăng dần để đơn cũ nhất nổi lên đầu.

- [ ] Set `orders.delivered_at = now()` khi `shipping_status` chuyển sang `delivered`.
- [ ] Trả `delivered_at` + `fund_status` trong response chi tiết đơn để FE tính cảnh báo.
- [ ] `[AUDIT]` **`PaymentDeadlineService` là sibling path bắt buộc phải sửa.** `src/modules/order/payment-deadline.service.ts:17-155` đang xử lý order quá hạn thanh toán và khóa tài khoản. Khi có escrow, job này phải: nếu `fund_status='held'` mà đơn bị hủy/hết hạn → ghi `payment_refund` trả tiền buyer, không chỉ đổi `payment_status`. Bỏ sót chỗ này = tiền buyer kẹt vĩnh viễn ở platform wallet.
- [ ] Notification cho seller khi tiền được release (`NotificationType.PAYMENT_RELEASED`).

### Phase 5 — Rút tiền (1 ngày)

| Action | Endpoint | Guard | Ledger |
|---|---|---|---|
| Tạo request | `POST /api/v1/wallet/withdrawals` | isAuth | `withdraw_hold` `−amount` |
| Admin nhận xử lý | `PATCH /api/v1/admin/wallet/withdrawals/{id}/process` | isAuth, isAdmin | Không ghi ledger, chỉ đổi status |
| Admin xác nhận xong | `POST /api/v1/admin/wallet/withdrawals/{id}/complete` | isAuth, isAdmin | `withdraw_success` `0` |
| Admin từ chối | `POST /api/v1/admin/wallet/withdrawals/{id}/reject` | isAuth, isAdmin | `withdraw_failed` `+amount` |
| User tự hủy | `DELETE /api/v1/wallet/withdrawals/{id}` | isAuth | `withdraw_cancelled` `+amount` |

> **Rút tiền luôn chuyển đủ 100% số yêu cầu.** Không khấu trừ, không phân loại nguồn tiền, không có cờ nào ở bước này — phí 5% đã được thu trọn vẹn tại thời điểm release (Phase 4B). Nếu thấy trong code xuất hiện logic tính phí ở luồng rút, đó là sai thiết kế.

- [ ] Tạo request: `deadline_at = now() + 10 days` (SLA đã chốt), trừ ví ngay để tiền không bị dùng trùng vào việc khác.
- [ ] **Mỗi user chỉ một request đang mở.** Chặn bằng **partial unique index** trên `(user_id) WHERE status IN ('pending','processing')`, không bằng `SELECT` kiểm tra trước trong service — hai request gửi đồng thời sẽ lọt qua mọi check ở tầng application (nguyên tắc 4). Bắt lỗi `23505` và trả về lỗi nghiệp vụ `WITHDRAWAL_ALREADY_PENDING`.
- [ ] **Không có hạn mức** — không giới hạn số tiền rút tối thiểu/tối đa, không hạn mức nạp mỗi ngày. Chặn duy nhất là số dư khả dụng (`postEntry` đã đảm bảo không âm) và ràng buộc một-request-một-lúc ở trên.
- [ ] **Breakdown nguồn tiền (chỉ hiển thị, không ảnh hưởng số tiền chuyển):** màn hình admin duyệt rút nên show cơ cấu số dư để admin có ngữ cảnh, đọc trực tiếp từ ledger, không cần thêm cột:
  ```
  Yêu cầu rút: 1.500.000đ  →  Chuyển đủ 1.500.000đ
  Nguồn: 1.000.000đ tự nạp | 500.000đ doanh thu bán hàng (đã trừ phí 5% lúc release)
  ```
- [ ] Hủy: chỉ cho phép khi `status = 'pending'`, và `user_id = current_user`. Khi đã `processing` thì khóa lại, vì admin có thể đã thao tác chuyển khoản ngoài hệ thống.
- [ ] Complete: bắt buộc có `proof_url`. Upload qua module `file` có sẵn (`src/modules/file/`), không tự viết upload mới.
- [ ] `[AUDIT]` **Ràng buộc thật là số dư ngân hàng, không phải số dư DB (mục 0.1c).** Hệ thống chỉ đảm bảo user có đủ số dư *trên sổ*; việc tài khoản ngân hàng của admin có đủ tiền để chuyển hay không thì hệ thống không biết. Màn hình duyệt rút phải hiện `SUM(wallets.balance)` toàn hệ thống làm mốc để admin tự đối chiếu trước khi chuyển. Không tự động hoá phần này — không có API nào đọc được số dư ngân hàng.
- [ ] Cron cảnh báo SLA 10 ngày (chạy mỗi giờ, `src/schedulers/`): `status IN ('pending','processing') AND deadline_at < now()` → notify admin. **Không** tự động hoàn tiền khi quá hạn — request vẫn hợp lệ, chỉ là admin trễ.
- [ ] Chặn ở tầng application: `PLATFORM_WALLET_ID` không được phép tạo withdrawal request.
- [ ] Rate limit endpoint tạo withdrawal request.

### 5.1 `[AUDIT]` Phase 8 (tách riêng, chưa lên lịch) — Tích hợp tiền cọc đấu giá

Không nằm trong 7 phase trên. Điều kiện tiên quyết: Phase 2 ổn định **và** nghiệp vụ cọc được chốt.

Hiện trạng: `auction_deposits` là bảng chết — entity tồn tại, không code nào đọc/ghi. Trước khi nối vào ví cần trả lời: cọc thu lúc nào (đăng ký tham gia? bid đầu tiên?), bao nhiêu, hoàn khi nào, ai quyết định forfeit. Đó là thiết kế nghiệp vụ đấu giá, không phải thiết kế ví.

Khi làm, bổ sung 3 ledger type (`deposit_hold` `−`, `deposit_release` `+`, `deposit_forfeit` `−`/`+` sang platform wallet) và key theo `{type}:{auction_deposit_id}`.

### Phase 6 — Thống kê & đối soát (1 ngày)

**API cho user** *(isAuth)*:
- [ ] `GET /api/v1/wallet` → balance, status. *(thay thế stub `getWalletByUserId` đang trả `balance: 0` cứng)*
- [ ] `GET /api/v1/wallet/transactions?type=&from=&to=&cursor=` → phân trang theo `(wallet_id, created_at)` bằng cursor, không dùng OFFSET.
- [ ] `GET /api/v1/wallet/summary?from=&to=` → `SELECT type, SUM(amount) ... GROUP BY type`.

**API cho admin** *(isAuth, isAdmin)*:
- [ ] `GET /api/v1/admin/wallet/overview` → đọc từ `wallet_daily_summary`, không quét full ledger.
- [ ] `GET /api/v1/admin/wallet/escrow` → tổng tiền đang giữ: `SUM(total_amount) FROM orders WHERE fund_status='held'`.
- [ ] `GET /api/v1/admin/wallet/withdrawals?status=&overdue=true`.

**Cron đối soát (chạy hằng đêm, trước khi tổng hợp summary):**
- [ ] Invariant 0 — **đối soát với ngân hàng thật (quan trọng nhất, làm thủ công):** số dư thật trong tài khoản ngân hàng của admin phải `≥ SUM(wallets.balance)` của **toàn bộ** ví. Hệ thống không tự đọc được số dư ngân hàng, nên job chỉ tính và hiển thị vế phải; admin đối chiếu bằng mắt với app ngân hàng. Lệch = hoặc webhook sót (mục 0.1d), hoặc tiền đã bị rút ra ngoài mà không qua luồng withdrawal.
- [ ] Invariant 1 — nội bộ cân bằng: `SELECT SUM(amount) FROM wallet_ledger` phải `= SUM(wallets.balance)`. Đây là tổng nghĩa vụ của nền tảng với user, **không phải 0** — vì `topup_success` và `withdraw_hold` là hai cửa biên với thế giới thật (mục 0.1b). Chỉ riêng các nghiệp vụ nội bộ (payment/release/refund) mới có `SUM = 0`; kiểm tra riêng nhóm đó cũng nên thêm.
- [ ] Invariant 2 — từng ví: `wallets.balance` phải `= SUM(wallet_ledger.amount WHERE wallet_id = X)`.
- [ ] Invariant 3 — escrow khớp: số dư platform wallet phải `≥ SUM(orders.total_amount WHERE fund_status='held')`.
- [ ] Invariant 4 — không ví nào âm.
- [ ] Lệch bất kỳ invariant nào → alert ngay (Slack/email), **không** tự động sửa dữ liệu.
- [ ] Job tổng hợp `wallet_daily_summary` cho ngày hôm trước.

### Phase 7 — Test & hardening (1 ngày)

Theo convention repo: các check chạy được đặt ở `src/tests/*.check.ts` (xem `order-payment.check.ts`, `route-mounting.check.ts`). Mở rộng file có sẵn trước khi tạo file mới.

- [ ] Concurrency: 50 request thanh toán song song từ một ví chỉ đủ tiền cho một đơn → đúng một đơn thành công, balance không âm.
- [ ] Idempotency: replay webhook, double-click nút release/rút → không nhân đôi tiền.
- [ ] Deadlock: chạy song song release (khóa platform + seller) và thanh toán (khóa buyer + platform) → không deadlock nhờ thứ tự khóa theo `wallet_id`.
- [ ] Crash recovery: kill process giữa transaction → không có trạng thái ledger ghi mà balance chưa đổi.
- [ ] `[AUDIT]` Regression cho hai thay đổi hành vi ở 4E: webhook underpaid và overpaid → mở rộng `src/tests/order-payment.check.ts`.
- [ ] Audit log: mọi thao tác admin (`release`, `refund`, `reject`, `adjustment`) ghi `admin_id` vào `metadata` của ledger.

---

## 3. Vai trò của Admin (làm rõ)

Admin **không sở hữu ví riêng** *trong hệ thống*. Toàn bộ tiền escrow và hoa hồng nằm ở một platform wallet duy nhất.

Lưu ý phân biệt: tài khoản **ngân hàng** thì đúng là của admin, và nó chứa tiền của tất cả mọi người (mục 0.1a). Nhưng platform wallet trong DB chỉ ghi phần nền tảng *thực sự sở hữu* — hoa hồng đã thu và tiền đang giữ escrow. Phần còn lại trong tài khoản ngân hàng là tiền giữ hộ user, không được tiêu. Admin chỉ là người *thao tác* — bấm release, reject, xác nhận chuyển khoản — và mọi thao tác đều ghi lại `admin_id` để truy vết.

Điều này tránh được tình huống tiền của nền tảng bị phân tán vào ví cá nhân nhiều admin, gây khó đối soát và rủi ro khi có người nghỉ việc.

**`[AUDIT]` Phân quyền: dùng `isAdmin`, không tách permission chi tiết.**
Hệ role hiện tại chỉ có `user | admin` (`user.enum.ts`), và `requirePermission` trong repo đang hỏng (đọc `req.user.role` trong khi `isAuth` set `req.role`) — không route nào dùng. Thêm 4 permission `wallet.*` bây giờ là xây hạ tầng cho nhu cầu chưa tồn tại.

Truy vết được bảo đảm bằng `admin_id` trong `wallet_ledger.metadata` cho mọi thao tác. Khi nào thật sự cần tách quyền trong nội bộ admin (VD: chỉ 1–2 người được `adjustment`), lúc đó sửa `permission.middleware.ts` cho chạy được rồi mới thêm — một việc nhỏ, làm sau không tốn kém hơn làm bây giờ.

---

## 3b. Tổng hợp endpoint theo actor

Toàn bộ dùng prefix thật của project: **`/api/v1`**.

| Actor | Action | Endpoint | Trạng thái |
|---|---|---|---|
| User | Xem ví, balance | `GET /api/v1/wallet` | Có stub, cần viết lại |
| User | Lịch sử giao dịch | `GET /api/v1/wallet/transactions?type=&from=&to=&cursor=` | Mới |
| User | Thống kê theo loại | `GET /api/v1/wallet/summary?from=&to=` | Mới |
| User | Nạp tiền | `POST /api/v1/wallet/topup` → trả QR | Mới |
| User | Thanh toán bằng ví | `POST /api/v1/orders/{id}/pay` | Mới |
| User | Lấy QR thanh toán đơn | `GET /api/v1/orders/{id}/payment-qr` | **Đã có**, cần nối ledger |
| User | Tạo request rút | `POST /api/v1/wallet/withdrawals` | Mới |
| User | Xem request rút của mình | `GET /api/v1/wallet/withdrawals?cursor=` | Mới |
| User | Hủy request rút | `DELETE /api/v1/wallet/withdrawals/{id}` | Mới |
| Sepay | Webhook | `POST /api/v1/orders/sepay/webhook` | **Đã có**, cần refactor (4E) |
| Admin | Overview ví tổng | `GET /api/v1/admin/wallet/overview` | Mới |
| Admin | Tiền đang giữ escrow | `GET /api/v1/admin/wallet/escrow` | Mới |
| Admin | Release cho seller | `POST /api/v1/admin/orders/{id}/release` | Mới |
| Admin | Hoàn tiền buyer | `POST /api/v1/admin/orders/{id}/refund` | Mới |
| Admin | Danh sách request rút | `GET /api/v1/admin/wallet/withdrawals?status=&overdue=true` | Mới |
| Admin | Nhận xử lý rút | `PATCH /api/v1/admin/wallet/withdrawals/{id}/process` | Mới |
| Admin | Xác nhận đã chuyển | `POST /api/v1/admin/wallet/withdrawals/{id}/complete` | Mới |
| Admin | Từ chối rút | `POST /api/v1/admin/wallet/withdrawals/{id}/reject` | Mới |
| Admin | Điều chỉnh thủ công | `POST /api/v1/admin/wallet/adjustment` | Mới |

---

## 4. Quyết định & câu hỏi còn mở

**Đã chốt:**
- ✅ Thu phí 5% tại thời điểm **release**, rút tiền hoàn đủ 100% (Hướng A).
- ✅ Thanh toán QR trực tiếp đi vòng qua ví theo mô hình pass-through.
- ✅ `[AUDIT]` Prefix API `/api/v1`, gỡ mount trùng, giữ `/api/v1/wallet`.
- ✅ `[AUDIT]` Seed một system-user (`role='admin'`), định danh platform wallet bằng `PLATFORM_WALLET_ID`.
- ✅ `[AUDIT]` Giữ nguyên format mã QR `BIDY{orderId padStart 3}`.
- ✅ `[AUDIT]` Chấp nhận hai thay đổi hành vi webhook underpaid/overpaid (mục 4E).
- ✅ `[AUDIT]` Dùng `isAdmin` cho mọi admin endpoint, không thêm permission `wallet.*`.
- ✅ `[AUDIT]` Cắt nhóm ledger tiền cọc khỏi v1, tách sang Phase 8.
- ✅ **Hoa hồng 5% tính trên `final_price`**, không gồm `shipping_fee`. Seller nhận nguyên tiền ship. (4B)
- ✅ **Không có refund sau release, không clawback.** Nền tảng không nhận khiếu nại sau khi tiền về ví seller → ví không bao giờ âm, không cần chính sách giữ tiền N ngày. (4C)
- ✅ **Không có auto-release.** Chỉ admin bấm tay. FE dùng `delivered_at` để hiện cảnh báo đơn quá hạn. (4F)
- ✅ **SLA rút tiền = 10 ngày** → `deadline_at = created_at + 10 days`.
- ✅ **Không có hạn mức nạp/rút.** Mỗi user chỉ được có **một** request rút đang mở, chặn bằng partial unique index. (Phase 5)

**Không còn câu hỏi mở.** Toàn bộ nghiệp vụ đã chốt, có thể vào Phase 1.

**Các đánh đổi đã chấp nhận có ý thức** — ghi lại để sau này không phải đoán lại lý do:

| Quyết định | Đánh đổi | Xử lý khi cần đổi |
|---|---|---|
| Không auto-release | Escrow đọng vô hạn nếu admin quên | Thêm cron quét `delivered_at` — không đụng schema, cột đã có sẵn |
| Không refund sau release | Không xử lý được hàng lỗi phát hiện muộn | Thêm ledger type `clawback` + chính sách cho phép ví âm |
| Không hạn mức | Một request rút cực lớn có thể vượt khả năng chi trả thực tế của tài khoản ngân hàng nền tảng | Validate ở DTO, không đụng ledger |

---

## 5. Ước lượng

| Phase | Nội dung | Thời gian | Ghi chú |
|---|---|---|---|
| 1 | Migration, seed & dọn nền | 1 ngày | `[AUDIT]` +0.5 |
| 2 | Ledger engine | 1–1.5 ngày | |
| 3 | Nạp tiền (CK ngân hàng) | 1 ngày | |
| 4 | Thanh toán & escrow | 2–2.5 ngày | `[AUDIT]` +0.5, refactor code có sẵn |
| 5 | Rút tiền | 1 ngày | |
| 6 | Thống kê & đối soát | 1 ngày | |
| 7 | Test & hardening | 1 ngày | |
| | **Tổng** | **8–9 ngày công** | |
| 8 | *Tích hợp tiền cọc* | *chưa ước lượng* | Tách riêng, chờ chốt nghiệp vụ |

Thứ tự Phase 1 → 2 → 3 là bắt buộc tuần tự. Phase 4, 5, 6 có thể chạy song song nếu có nhiều dev, miễn là Phase 2 đã ổn định.
