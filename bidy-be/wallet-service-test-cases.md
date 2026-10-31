# Bidy Wallet Service — Test Cases

> Bộ test case cho ví điện tử + escrow. Bám theo `docs/wallet-plan.md` (bản đã audit) và `docs/newdb.dbml`.
> Trạng thái: **viết trước khi implement**. Dùng làm spec đối chiếu khi code Phase 1–7.

---

## 0. Quy ước

**Nơi đặt test.** Theo convention repo: các check chạy được nằm ở `src/tests/*.check.ts` (xem `order-payment.check.ts`, `route-mounting.check.ts`). Mở rộng file có sẵn trước khi tạo file mới. Không thêm framework test mới.

**Ưu tiên:**

| Mức | Nghĩa |
|---|---|
| **P0** | Sai = mất tiền thật hoặc in tiền. Phải pass trước khi merge. |
| **P1** | Sai = số liệu lệch, nghiệp vụ hỏng. Phải pass trước khi lên production. |
| **P2** | Biên, trải nghiệm, thông báo lỗi. |

**Dữ liệu nền dùng chung** (seed một lần cho cả bộ):

| Alias | Mô tả |
|---|---|
| `W_PLATFORM` | Ví của `system_platform`, id lấy từ env `PLATFORM_WALLET_ID` |
| `W_BUYER` | Ví user thường, số dư khởi tạo 0 |
| `W_SELLER` | Ví user thường, số dư khởi tạo 0 |
| `W_LOCKED` | Ví có `status='locked'` |
| `ORDER_A` | `final_price=1.000.000`, `shipping_fee=30.000`, `total_amount=1.030.000`, `payment_status='pending'`, `fund_status='none'` |

**Ký hiệu:** `L(type, wallet)` = dòng ledger loại `type` trên ví đó. `B(wallet)` = `wallets.balance`.

---

## 1. Ledger engine — `postEntry` / `postTransfer` (P0)

Lớp nền. Mọi thứ khác vô nghĩa nếu phần này sai.

| ID | Mục tiêu | Tiền điều kiện | Hành động | Kỳ vọng |
|---|---|---|---|---|
| LED-01 | Ghi bút toán cộng cơ bản | `B(W_BUYER)=0` | `postEntry(+100.000, topup_success)` | `B=100.000`; đúng 1 dòng ledger; `balance_after=100.000` |
| LED-02 | Ghi bút toán trừ cơ bản | `B(W_BUYER)=100.000` | `postEntry(-40.000, payment)` | `B=60.000`; `balance_after=60.000` |
| LED-03 | Trừ đúng bằng số dư | `B=100.000` | `postEntry(-100.000)` | Thành công, `B=0`. Không được coi là lỗi |
| LED-04 | Trừ vượt số dư | `B=100.000` | `postEntry(-100.001)` | Throw `INSUFFICIENT_BALANCE`; **không** có dòng ledger nào; `B` không đổi |
| LED-05 | Ví bị khóa | `W_LOCKED` active=false | `postEntry(+10.000)` | Throw `WALLET_LOCKED`; không ghi gì. Kể cả bút toán **cộng** cũng bị chặn |
| LED-06 | Ví không tồn tại | — | `postEntry(walletId=999999)` | Throw `WALLET_NOT_FOUND` |
| LED-07 | `balance_after` là snapshot đúng | 3 bút toán liên tiếp `+100k, -30k, +50k` | — | `balance_after` lần lượt `100k, 70k, 120k`; `B=120.000` |
| LED-08 | **Idempotency — lặp tuần tự** | — | Gọi `postEntry` 10 lần cùng `idempotency_key` | Đúng **1** dòng ledger; `B` chỉ đổi 1 lần; 9 lần sau trả về dòng đã tồn tại, **không throw** |
| LED-09 | **Idempotency — lặp song song** | — | 100 lần `postEntry` đồng thời, cùng key | Đúng 1 dòng; `B` đổi đúng 1 lần; không có lỗi 500 lọt ra ngoài |
| LED-10 | Unique violation bắt đúng mã lỗi | — | Ghi trùng key | Bắt Postgres `23505` cụ thể, không nuốt mọi loại lỗi bằng `catch {}` |
| LED-11 | Key khác nhau thì ghi bình thường | — | 2 `postEntry` khác key, cùng ví | 2 dòng ledger; `B` cộng dồn đủ |
| LED-12 | `postTransfer` cân bằng | — | `postTransfer([-100k buyer, +100k platform])` | 2 dòng; `SUM(amount)=0`; cả hai `B` đổi |
| LED-13 | **`postTransfer` không cân bằng bị chặn** | — | `postTransfer([-100k payment, +90k escrow_in])` | Throw trước khi ghi; **0 dòng ledger**; không ví nào đổi |
| LED-13b | **Assert chỉ áp cho vế nội bộ** | — | `postTransfer([+1.030k topup_success, -1.030k payment, +1.030k escrow_in])` | **Thành công.** Tổng toàn bộ = `+1.030k` nhưng tổng vế nội bộ = 0. Assert `SUM(all)=0` sẽ chặn nhầm luồng QR 4D |
| LED-14 | `postTransfer` atomic khi một vế fail | `B(W_BUYER)=50.000` | `postTransfer([-100k buyer, +100k platform])` | Rollback toàn bộ; `B(W_PLATFORM)` **không** tăng; 0 dòng ledger |
| LED-15 | `postTransfer` 3 vế (release) | — | `[-1.030k platform, +980k seller, +50k platform]` | `SUM=0`; 3 dòng; platform ròng `-980k` |
| LED-16 | **Thứ tự khóa ví tăng dần** | — | Chạy song song: A khóa (buyer=5, platform=1), B khóa (platform=1, seller=9) | Không deadlock. Cả hai đều lock theo `wallet_id ASC` |
| LED-17 | Không service nào update balance trực tiếp | — | `grep -rn "UPDATE wallets SET balance" src/` ngoài ledger service | Không có kết quả nào |
| LED-18 | Ledger append-only | — | Thử `UPDATE` / `DELETE` trên `wallet_ledger` từ code | Không tồn tại code nào làm việc này (kiểm tra bằng grep + review) |
| LED-19 | `metadata` lưu được `admin_id` | — | `postEntry(..., metadata:{admin_id:7, reason:'x'})` | Đọc lại `metadata->>'admin_id' = '7'` |

### 1.1 Bẫy kiểu số — `decimal` trả về string (P0)

Nguyên tắc 6 của plan. Nhóm này hay bị bỏ qua vì test với số nhỏ vẫn "trông đúng".

| ID | Mục tiêu | Hành động | Kỳ vọng |
|---|---|---|---|
| NUM-01 | Cộng không bị nối chuỗi | `B=100.000`, `postEntry(+200.000)` | `B=300000`, **không phải** `"100000200000"` |
| NUM-02 | Số lớn không mất chính xác | `B=0`, nạp `99.999.999.999,99` | Đọc lại đúng từng chữ số, không làm tròn |
| NUM-03 | Hai chữ số thập phân giữ nguyên | `postEntry(+0.05)` rồi `+0.05` | `B=0.10` chính xác, không `0.1000000001` |
| NUM-04 | So sánh số dư không so string | `B=9.000.000`, trừ `10.000.000` | Phải fail. Nếu so string thì `"9000000" > "10000000"` → lọt |
| NUM-05 | Tính toán chạy trong SQL | Review code `postEntry` | `balance = balance + $1` trong SQL, hoặc transformer nhất quán. Không `Number()` rồi cộng trong JS |

---

## 2. Nạp tiền — webhook Sepay (P0)

> Nhắc lại mục 0.1 của plan: Sepay **không** giữ tiền. Tiền vào thẳng ngân hàng admin, webhook chỉ là thông báo. Endpoint này **in ra số dư từ hư không** — đây là ranh giới tin cậy quan trọng nhất hệ thống.

### 2.1 Bảo mật (P0 — tất cả)

| ID | Mục tiêu | Hành động | Kỳ vọng |
|---|---|---|---|
| SEC-01 | Không chữ ký → từ chối | POST webhook không header xác thực | 401; **0 dòng ledger**; không log lộ secret |
| SEC-02 | Chữ ký sai → từ chối | Header `Authorization: Apikey sai` | 401; 0 dòng ledger |
| SEC-03 | Chữ ký đúng → xử lý | Header đúng theo `sepayConfig.apiKey` | 200; ghi ledger |
| SEC-04 | **Số tiền lấy từ payload Sepay, không từ client** | Payload hợp lệ `transferAmount=100.000` nhưng body kèm thêm `amount=999.999.999` | Cộng đúng `100.000` |
| SEC-05 | Không cho phép chỉ định `walletId` từ ngoài | Payload có thêm `walletId=<ví admin>` | Bỏ qua; ví đích chỉ suy ra từ nội dung CK |
| SEC-06 | Không cho `type` tùy ý | Payload có `type='adjustment'` | Bỏ qua; type do server quyết định |
| SEC-07 | Endpoint không nằm sau `isAuth` | — | Webhook dùng `verifySepayWebhook`, không dùng JWT user |
| SEC-08 | Rate limit webhook | Bắn 1000 req/phút | Bị chặn, nhưng **không** trả 4xx/5xx cho request hợp lệ của Sepay (cân nhắc allowlist IP) |

### 2.2 Nghiệp vụ nạp

| ID | Mục tiêu | Tiền điều kiện | Hành động | Kỳ vọng |
|---|---|---|---|---|
| TOP-01 | Nạp thành công | `B(W_BUYER)=0` | Webhook nạp `500.000`, mã topup hợp lệ | `B=500.000`; 1 dòng `topup_success`; 1 dòng `transactions` status `success`, `order_id=NULL`, `wallet_id` đúng |
| TOP-02 | **Replay webhook** | sau TOP-01 | Bắn lại y hệt payload 10 lần | `B` vẫn `500.000`; vẫn 1 dòng ledger; **trả 200** mỗi lần (trả lỗi → Sepay retry vô ích) |
| TOP-03 | Hai webhook đồng thời cùng `provider_transaction_id` | — | 2 request song song | 1 dòng `transactions` (chặn bởi unique index), 1 dòng ledger |
| TOP-04 | `transferType != 'in'` | — | Payload `transferType='out'` | Bỏ qua, 200, không ghi gì |
| TOP-05 | Không parse được nội dung CK | — | Nội dung CK `"chuyen tien"` | Không cộng ví; ghi log để admin xử lý; trả 200 |
| TOP-06 | Số tiền 0 hoặc âm | — | `transferAmount=0` | Bỏ qua, không ghi ledger |
| TOP-07 | Ví đích đang khóa | `W_LOCKED` | Webhook nạp vào ví đó | Không cộng; ghi log; trả 200 (không để Sepay retry) |
| TOP-08 | `transactions` và `wallet_ledger` khớp | sau TOP-01 | So 2 bảng | Cùng số tiền, cùng `provider_transaction_id` ↔ `idempotency_key` = `sepay:{id}` |
| TOP-09 | Tạo QR nạp tiền | — | `POST /api/v1/wallet/topup` | Trả `qrCodeUrl`, nội dung CK có mã định danh; tạo `transactions` status `pending` |
| TOP-10 | Rate limit topup | — | Gọi `/topup` liên tục | Bị chặn sau ngưỡng |

### 2.3 Van an toàn — `adjustment` (P0)

> Mục 0.1d: Sepay **sẽ** bỏ sót. Đây là đường duy nhất sửa được.

| ID | Mục tiêu | Hành động | Kỳ vọng |
|---|---|---|---|
| ADJ-01 | Admin cộng bù tiền webhook sót | `POST /admin/wallet/adjustment` `+500.000`, reason + mã GD ngân hàng | `B` tăng; ledger `adjustment`; `metadata` chứa `admin_id`, `reason`, mã GD |
| ADJ-02 | Thiếu `reason` → từ chối | Không gửi `reason` | 400; không ghi ledger |
| ADJ-03 | Adjustment âm (thu hồi nhầm) | `-500.000` khi `B=500.000` | Thành công, `B=0` |
| ADJ-04 | Adjustment âm vượt số dư | `-600.000` khi `B=500.000` | `INSUFFICIENT_BALANCE`; không ghi |
| ADJ-05 | Non-admin bị chặn | User thường gọi endpoint | 403 |
| ADJ-06 | Mỗi adjustment một key riêng | Gọi 2 lần cùng số tiền | 2 dòng ledger (key `adjustment:{uuid}` khác nhau) — adjustment **không** idempotent theo số tiền |

---

## 3. Thanh toán & escrow

### 3.1 Trả bằng số dư ví — 4A (P0)

| ID | Mục tiêu | Tiền điều kiện | Hành động | Kỳ vọng |
|---|---|---|---|---|
| PAY-01 | Thanh toán thành công | `B(W_BUYER)=2.000.000`, ORDER_A pending | `POST /orders/{id}/pay` | `B(W_BUYER)=970.000`; `B(W_PLATFORM)+=1.030.000`; `payment_status='paid'`; `fund_status='held'`; `payment_channel='wallet'` |
| PAY-02 | Đủ tiền sát nút | `B=1.030.000` | pay | Thành công, `B=0` |
| PAY-03 | Không đủ tiền | `B=1.029.999` | pay | `INSUFFICIENT_BALANCE`; order không đổi; `fund_status` vẫn `none` |
| PAY-04 | Không phải buyer | user khác gọi | pay | 403; không ghi ledger |
| PAY-05 | Đơn đã thanh toán | `payment_status='paid'` | pay lần nữa | Từ chối; `B` không đổi |
| PAY-06 | **Double-click** | `B` đủ | Gửi 2 request song song | Đúng 1 lần trừ tiền (chặn bởi key `order_payment:{id}`) |
| PAY-07 | Quá hạn thanh toán | `payment_deadline < now()` | pay | Từ chối |
| PAY-08 | Ví bị khóa | `W_LOCKED` là buyer | pay | `WALLET_LOCKED`; không ghi |
| PAY-09 | Double-entry đúng | sau PAY-01 | Kiểm ledger | `payment -1.030.000` (buyer) + `payment_escrow_in +1.030.000` (platform), tổng = 0 |
| PAY-10 | Đơn không tồn tại | — | pay order id lạ | 404 |

### 3.2 Thanh toán QR trực tiếp — 4D (P0)

| ID | Mục tiêu | Hành động | Kỳ vọng |
|---|---|---|---|
| QRD-01 | **Format mã QR giữ nguyên** | `GET /orders/{id}/payment-qr` với `order.id=1` | Nội dung CK = `BIDY001` (padStart 3), **không** phải `BIDYORD1` |
| QRD-02 | Order id 4 chữ số | `order.id=1024` | `BIDY1024` |
| QRD-03 | Pass-through đủ 3 bút toán | Webhook về đúng `1.030.000` cho ORDER_A | Ledger: `topup_success +1.030.000` (buyer), `payment -1.030.000` (buyer), `payment_escrow_in +1.030.000` (platform). `B(W_BUYER)` trước/sau **không đổi** |
| QRD-04 | Trạng thái đơn sau QR | sau QRD-03 | `payment_status='paid'`, `fund_status='held'`, `payment_channel='qr_direct'` |
| QRD-05 | Lịch sử giao dịch hiển thị đủ | sau QRD-03 | `GET /wallet/transactions` thấy cả tiền vào và tiền ra |
| QRD-06 | Đơn đã paid, webhook lại về | — | Không trừ lần hai; trả 200 |
| QRD-07 | Regex parse chịu được nội dung bẩn | Nội dung `"CT DEN:0123 BIDY001 GD 123456"` | Vẫn parse ra order 1 |
| QRD-08 | Prefix lấy từ config | Đổi `SEPAY_PAYMENT_PREFIX=TEST` | QR sinh `TEST001`, webhook parse `TEST001` |

### 3.3 Chuyển thiếu / chuyển dư — 4E (P0)

> **Đây là hai thay đổi hành vi so với code hiện tại.** `order.service.ts` bản cũ: thiếu → ghi `underpaid` không cộng gì; dư → đánh `paid` và nuốt phần chênh.

| ID | Mục tiêu | Tiền điều kiện | Hành động | Kỳ vọng |
|---|---|---|---|---|
| UND-01 | **Chuyển thiếu → cộng ví, đơn chưa paid** | ORDER_A cần `1.030.000` | Webhook về `1.000.000` | `B(W_BUYER)=1.000.000`; ledger chỉ có `topup_success`; `payment_status` vẫn `pending`; `fund_status='none'` |
| UND-02 | Không còn nhánh `underpaid` đặc biệt | sau UND-01 | Kiểm `transactions` | Không tạo bản ghi `transaction_status='underpaid'` như bản cũ |
| UND-03 | Bù nốt bằng số dư ví | sau UND-01, nạp thêm `100.000` | `POST /orders/{id}/pay` | Thành công; `B=70.000`; `fund_status='held'` |
| UND-04 | Notify buyer bù thêm | sau UND-01 | — | Có notification/socket báo thiếu bao nhiêu |
| OVR-01 | **Chuyển dư → phần chênh ở lại ví** | ORDER_A cần `1.030.000` | Webhook về `1.100.000` | `topup_success +1.100.000`, `payment -1.030.000` → `B(W_BUYER)=70.000`; đơn `paid`, `fund_status='held'` |
| OVR-02 | Không nuốt tiền dư | sau OVR-01 | `SUM(ledger W_BUYER)` | `= 70.000`, không phải 0 |
| OVR-03 | Chuyển đúng bằng | Webhook `1.030.000` | — | `B(W_BUYER)` thay đổi ròng = 0 |
| OVR-04 | Chuyển dư rất lớn | Webhook `50.000.000` cho đơn `1.030.000` | Đơn `paid`; `B=48.970.000` | Không chặn, không cảnh báo (đã chốt: không hạn mức) |

### 3.4 Release cho seller — 4B (P0)

Công thức đã chốt: `platform_fee = ROUND(final_price × 0.05, 2)`, **không** tính trên `shipping_fee`.

| ID | Mục tiêu | Tiền điều kiện | Hành động | Kỳ vọng |
|---|---|---|---|---|
| REL-01 | **Phí tính trên `final_price`** | ORDER_A `held` (final 1.000.000, ship 30.000) | admin release | `platform_fee=50.000`; `seller_payout=980.000`; **không phải** `51.500` |
| REL-02 | Seller nhận đủ tiền ship | sau REL-01 | — | `B(W_SELLER)=980.000` = `1.000.000 + 30.000 − 50.000` |
| REL-03 | Platform ròng | sau REL-01 | — | Platform: `−1.030.000 + 50.000` = ròng `−980.000`. `B(W_PLATFORM)` giảm `980.000` |
| REL-04 | Snapshot ghi đủ | sau REL-01 | Kiểm `orders` | `platform_fee=50.000`, `seller_payout=980.000`, `fee_rate=0.0500`, `released_at`, `released_by=<admin_id>` |
| REL-05 | Double-entry cân | sau REL-01 | — | 3 dòng: `-1.030.000`, `+980.000`, `+50.000` → tổng 0 |
| REL-06 | **Release hai lần bị chặn** | `fund_status='released'` | release lại | Từ chối (assert `fund_status='held'`); `B(W_SELLER)` không đổi |
| REL-07 | Double-click release | `held` | 2 request song song | Đúng 1 lần cộng tiền (key `payment_release:{id}`) |
| REL-08 | Đơn chưa thanh toán | `fund_status='none'` | release | Từ chối |
| REL-09 | Non-admin bị chặn | user thường | release | 403 |
| REL-10 | `released_by` luôn có giá trị | sau REL-01 | — | Không NULL — đã chốt không có auto-release |
| REL-11 | Làm tròn phí lẻ | `final_price=999.999` | release | `platform_fee=ROUND(49.999,95)=49.999,95` hoặc `50.000,00` tùy quy tắc — **chốt và test cứng một giá trị** |
| REL-12 | `fee_rate` là snapshot | Đổi config phí thành 0.07 sau khi release | — | Đơn cũ vẫn `fee_rate=0.0500` |
| REL-13 | Notify seller | sau REL-01 | — | Notification `PAYMENT_RELEASED` tới seller |
| REL-14 | Ship = 0 | `shipping_fee=0`, final `1.000.000` | release | `seller_payout=950.000` |
| REL-15 | **Không có cron auto-release** | Đơn `delivered` 60 ngày, `fund_status='held'` | Chạy toàn bộ scheduler | `fund_status` vẫn `held`. Không job nào tự release |

### 3.5 Refund trước release — 4C (P1)

| ID | Mục tiêu | Tiền điều kiện | Hành động | Kỳ vọng |
|---|---|---|---|---|
| REF-01 | Hoàn tiền thành công | ORDER_A `held` | admin refund | `B(W_BUYER)+=1.030.000`; `B(W_PLATFORM)-=1.030.000`; `payment_status='refunded'`, `fund_status='refunded'` |
| REF-02 | Refund hoàn **đủ** total_amount | sau REF-01 | — | Hoàn cả tiền ship, không trừ phí (chưa release nên chưa thu phí) |
| REF-03 | **Không refund sau khi release** | `fund_status='released'` | refund | Từ chối. Đã chốt: `released` là trạng thái cuối |
| REF-04 | Refund hai lần | `fund_status='refunded'` | refund lại | Từ chối; `B` không đổi |
| REF-05 | Double-click refund | `held` | 2 request song song | Đúng 1 lần hoàn (key `order_refund:{id}`) |
| REF-06 | Non-admin | user thường | refund | 403 |
| REF-07 | **Ví seller không bao giờ âm** | Mọi kịch bản | Quét toàn bộ ví sau test suite | `B >= 0` với mọi ví. Không có đường nào làm âm vì không có clawback |

### 3.6 Đơn quá hạn — `PaymentDeadlineService` (P0)

> Sibling path bắt buộc. Bỏ sót = tiền buyer kẹt vĩnh viễn ở platform wallet.

| ID | Mục tiêu | Tiền điều kiện | Hành động | Kỳ vọng |
|---|---|---|---|---|
| DLN-01 | **Đơn đã trả bị hủy → hoàn tiền** | `fund_status='held'`, quá `payment_deadline` | Chạy `processPaymentDeadlines` | Ghi `payment_refund`; `B(W_BUYER)` được hoàn; `fund_status='refunded'` |
| DLN-02 | Đơn chưa trả quá hạn | `fund_status='none'`, quá hạn | Chạy job | Đổi `payment_status='expired'`; **không** ghi ledger nào |
| DLN-03 | Không đụng đơn đã release | `fund_status='released'` | Chạy job | Không hoàn tiền, không đổi gì |
| DLN-04 | Job chạy lại không nhân đôi | sau DLN-01 | Chạy job lần 2 | Không hoàn thêm lần nữa |
| DLN-05 | Hành vi khóa tài khoản giữ nguyên | — | Chạy job | Logic lock/unlock cũ không bị regression |

---

## 4. Rút tiền (P0/P1)

SLA đã chốt = **10 ngày**. Không hạn mức. Mỗi user **một** request đang mở.

| ID | Mục tiêu | Tiền điều kiện | Hành động | Kỳ vọng |
|---|---|---|---|---|
| WDR-01 | Tạo request thành công | `B(W_SELLER)=1.000.000` | `POST /wallet/withdrawals` `500.000` + thông tin NH | Request `pending`; ledger `withdraw_hold -500.000`; `B=500.000`; `deadline_at = created_at + 10 ngày` |
| WDR-02 | **Trừ ví ngay lúc tạo** | sau WDR-01 | — | Tiền bị giữ, không tiêu lại được |
| WDR-03 | Rút vượt số dư | `B=500.000` | rút `500.001` | `INSUFFICIENT_BALANCE`; không tạo request |
| WDR-04 | Rút hết số dư | `B=500.000` | rút `500.000` | Thành công, `B=0` |
| WDR-05 | **Không có hạn mức tối thiểu** | `B=1.000` | rút `1.000` | Thành công (đã chốt: không hạn mức) |
| WDR-06 | **Không có hạn mức tối đa** | `B=5.000.000.000` | rút hết | Thành công |
| WDR-07 | **Một request đang mở** | Đã có 1 request `pending` | Tạo request thứ 2 | `WITHDRAWAL_ALREADY_PENDING`; không trừ ví |
| WDR-08 | **Chặn ở DB, không ở service** | — | 2 request tạo **song song** | Đúng 1 thành công. Chặn bởi partial unique index, không phải `SELECT` check |
| WDR-09 | Status `processing` cũng tính là đang mở | Request đang `processing` | Tạo request mới | Bị chặn |
| WDR-10 | Sau khi đóng thì tạo được | Request cũ `completed` | Tạo mới | Thành công |
| WDR-11 | Platform wallet không được rút | `PLATFORM_WALLET_ID` | Tạo request | Từ chối ở tầng application |
| WDR-12 | Admin nhận xử lý | `pending` | `PATCH .../process` | `status='processing'`, `admin_id` được ghi; **không** ledger mới |
| WDR-13 | Complete cần `proof_url` | `processing`, không gửi proof | `POST .../complete` | 400; status không đổi |
| WDR-14 | Complete thành công | có `proof_url` | complete | `status='completed'`; ledger `withdraw_success` **amount = 0**; `B` không đổi; `processed_at` được ghi |
| WDR-15 | Reject hoàn tiền | `pending`, `B=500.000` | `POST .../reject` + lý do | `withdraw_failed +500.000`; `B=1.000.000`; `status='rejected'`; `reject_reason` lưu |
| WDR-16 | Reject cần lý do | không gửi lý do | reject | 400 |
| WDR-17 | User tự hủy khi `pending` | `pending` | `DELETE /wallet/withdrawals/{id}` | `withdraw_cancelled +amount`; `B` hoàn; `cancelled_by='user'` |
| WDR-18 | **Không hủy được khi `processing`** | `processing` | user hủy | Từ chối — admin có thể đã chuyển khoản ngoài hệ thống |
| WDR-19 | Không hủy request người khác | request của user B | user A hủy | 403 |
| WDR-20 | Double-click hủy | `pending` | 2 request song song | Hoàn tiền đúng 1 lần (key `withdraw_cancelled:{id}`) |
| WDR-21 | Complete rồi reject | `completed` | reject | Từ chối |
| WDR-22 | Reject rồi complete | `rejected` | complete | Từ chối |
| WDR-23 | Cron cảnh báo SLA | `deadline_at < now()`, status `pending` | Chạy cron | Notify admin; **không** tự hoàn tiền |
| WDR-24 | Không tự hoàn khi quá hạn | sau WDR-23 | — | `status` vẫn `pending`; `B` không đổi |
| WDR-25 | **Không thu phí lúc rút** | rút `500.000` | complete | Ghi nhận chuyển đủ `500.000`. Không có bút toán phí nào trong luồng rút |
| WDR-26 | Rate limit tạo request | — | Gọi liên tục | Bị chặn |
| WDR-27 | Breakdown nguồn tiền (hiển thị) | Ví có `600.000` nạp + `400.000` từ release | Admin xem request | Hiện `600.000 tự nạp / 400.000 doanh thu`; **số tiền chuyển vẫn đủ 100%** |

---

## 5. Thống kê & API đọc (P1)

| ID | Mục tiêu | Hành động | Kỳ vọng |
|---|---|---|---|
| STA-01 | `GET /api/v1/wallet` trả số thật | — | Trả `B` từ DB, **không** phải `balance: 0` hardcode của stub cũ |
| STA-02 | Chỉ xem được ví mình | User A gọi | Không có cách nào truyền `userId` để xem ví người khác |
| STA-03 | Lịch sử phân trang cursor | 100 dòng ledger | `GET /wallet/transactions?cursor=` | Không dùng OFFSET; cursor theo `(wallet_id, created_at)` |
| STA-04 | Lọc theo type | — | `?type=topup_success` | Chỉ trả đúng loại |
| STA-05 | Lọc theo khoảng ngày | — | `?from=&to=` | Đúng khoảng; biên inclusive rõ ràng |
| STA-06 | Summary group by type | — | `GET /wallet/summary` | `SUM(amount)` theo từng type, khớp với ledger |
| STA-07 | Admin overview đọc từ summary table | — | `GET /admin/wallet/overview` | Query `wallet_daily_summary`, **không** quét full ledger |
| STA-08 | **Escrow sort theo `delivered_at` tăng dần** | 3 đơn `held` giao cách nhau | `GET /admin/wallet/escrow` | Đơn giao lâu nhất nằm đầu — cách duy nhất phát hiện escrow đọng khi không có auto-release |
| STA-09 | Escrow tính đúng tổng | 3 đơn `held` | — | `SUM(total_amount) WHERE fund_status='held'` |
| STA-10 | Lọc withdrawal quá hạn | — | `GET /admin/wallet/withdrawals?overdue=true` | Chỉ trả request `deadline_at < now()` và còn mở |
| STA-11 | Non-admin không gọi được API admin | user thường | Mọi endpoint `/admin/wallet/*` | 403 |
| STA-12 | Swagger đầy đủ | — | Mở `/api-docs` | Mọi route wallet mới đều hiện |

---

## 6. Đối soát — cron hằng đêm (P0)

| ID | Mục tiêu | Hành động | Kỳ vọng |
|---|---|---|---|
| REC-01 | **Invariant 0 — đối soát ngân hàng** | Job tính `SUM(wallets.balance)` toàn hệ thống | Hiển thị con số cho admin đối chiếu tay với app ngân hàng. Không tự đọc số dư NH được |
| REC-02 | **Invariant 1 — nội bộ cân bằng** | — | `SUM(wallet_ledger.amount) = SUM(wallets.balance)`. **Không phải `= 0`** — `topup_success`/`withdraw_hold` là cửa biên |
| REC-03 | Invariant 1b — nghiệp vụ nội bộ cân | Chỉ tính `payment*`, `platform_fee`, `payment_refund` | `SUM = 0` |
| REC-04 | Invariant 2 — từng ví khớp | — | `wallets.balance = SUM(ledger WHERE wallet_id=X)` với mọi ví |
| REC-05 | Invariant 2 phát hiện lệch | Cố tình `UPDATE wallets SET balance=999` | Job báo lệch đúng ví đó |
| REC-06 | Invariant 3 — escrow đủ | — | `B(W_PLATFORM) >= SUM(orders.total_amount WHERE fund_status='held')` |
| REC-07 | Invariant 4 — không ví âm | — | Không ví nào `balance < 0` |
| REC-08 | **Lệch → alert, không tự sửa** | Tạo lệch giả | Gửi alert; dữ liệu **không** bị job sửa |
| REC-09 | Summary tổng hợp đúng | Ngày có 3 topup, 2 payment, 1 withdraw | Job chạy | `wallet_daily_summary` khớp số liệu ngày hôm trước |
| REC-10 | Summary không trùng ngày | Chạy job 2 lần cùng ngày | 1 dòng duy nhất (unique `summary_date`) |
| REC-11 | Thứ tự job đúng | — | Đối soát chạy **trước** khi tổng hợp summary |

---

## 7. Concurrency & khả năng phục hồi (P0)

| ID | Mục tiêu | Hành động | Kỳ vọng |
|---|---|---|---|
| CON-01 | **Đua thanh toán từ một ví** | `B=1.030.000`, 50 request pay song song cho 50 đơn khác nhau | Đúng **1** đơn thành công; 49 đơn `INSUFFICIENT_BALANCE`; `B=0`; không âm |
| CON-02 | Đua thanh toán cùng một đơn | 50 request pay cùng `order_id` | Đúng 1 lần trừ tiền |
| CON-03 | **Deadlock release ↔ payment** | Song song: release (platform+seller) và pay (buyer+platform) | Không deadlock. Cả hai lock theo `wallet_id ASC` |
| CON-04 | Deadlock nhiều chiều | 20 luồng ngẫu nhiên pay/release/refund/withdraw | Không deadlock, không lost update |
| CON-05 | Đua rút tiền | `B=500.000`, 10 request rút `500.000` song song | Đúng 1 thành công (vừa do số dư, vừa do partial unique index) |
| CON-06 | Đua webhook + pay | Webhook QR về đúng lúc user bấm pay bằng ví | Đơn chỉ được trả một lần; tiền không trừ hai lần |
| CON-07 | **Crash giữa transaction** | Kill process sau `INSERT ledger`, trước `UPDATE balance` | Rollback sạch. Không có ledger mồ côi; Invariant 2 vẫn pass |
| CON-08 | Crash giữa `postTransfer` | Kill sau vế 1, trước vế 2 | Không có vế lẻ nào tồn tại |
| CON-09 | Timeout DB không để lại rác | Ép statement timeout | Transaction rollback toàn bộ |

---

## 8. Audit & truy vết (P1)

| ID | Mục tiêu | Hành động | Kỳ vọng |
|---|---|---|---|
| AUD-01 | Release ghi `admin_id` | admin release | `ledger.metadata->>'admin_id'` đúng |
| AUD-02 | Refund ghi `admin_id` | admin refund | Tương tự |
| AUD-03 | Reject withdrawal ghi `admin_id` | — | `wallet_withdrawal_requests.admin_id` + metadata ledger |
| AUD-04 | Adjustment ghi `admin_id` + lý do | — | Cả hai bắt buộc |
| AUD-05 | Không thao tác admin nào thiếu dấu vết | Quét toàn bộ ledger sau suite | Mọi dòng do admin tạo đều có `admin_id` |

---

## 9. Migration & seed — Phase 1 (P1)

| ID | Mục tiêu | Hành động | Kỳ vọng |
|---|---|---|---|
| MIG-01 | 4 bảng mới tạo đúng | Chạy migration | `wallets`, `wallet_ledger`, `wallet_withdrawal_requests`, `wallet_daily_summary` tồn tại |
| MIG-02 | Unique `idempotency_key` | Insert trùng bằng SQL trần | Postgres từ chối |
| MIG-03 | **Partial unique index withdrawal** | 2 request `pending` cùng user bằng SQL trần | Từ chối. Nhưng 1 `pending` + 1 `completed` thì được |
| MIG-04 | `transactions.order_id` nullable | Insert `order_id=NULL` | Thành công |
| MIG-05 | `transactions.provider_transaction_id` unique | Insert trùng | Từ chối |
| MIG-06 | `orders.delivered_at` tồn tại | — | Cột có, nullable |
| MIG-07 | Precision `decimal(14,2)` | Kiểm `information_schema` | Mọi cột tiền đều `(14,2)`, không còn `(12,2)` |
| MIG-08 | Seed platform user | Chạy seed | User `system_platform`, `role='admin'`, không đăng nhập được bằng password |
| MIG-09 | Seed chạy 2 lần không trùng | Chạy seed lại | `ON CONFLICT DO NOTHING`, vẫn 1 user, 1 ví |
| MIG-10 | `PLATFORM_WALLET_ID` khớp seed | — | Env trỏ đúng ví vừa seed |
| MIG-11 | Backfill ví cho user cũ | Chạy backfill | Mọi user có đúng 1 ví, `balance=0` |
| MIG-12 | **User mới tự có ví** | Đăng ký tài khoản mới | Ví được tạo **trong cùng transaction** với user |
| MIG-13 | Đăng ký fail không để lại ví mồ côi | Ép lỗi giữa chừng | Không có ví nào không có user |
| MIG-14 | **Gỡ mount router trùng** | `GET /api/v1/wallets/me` | 404. Chỉ còn `/api/v1/wallet` |
| MIG-15 | Notification types mới | — | Enum có `PAYMENT_RELEASED`, `WITHDRAWAL_COMPLETED`, `WITHDRAWAL_REJECTED`, `TOPUP_SUCCESS` |
| MIG-16 | Migration rollback được | `migration:revert` | Về trạng thái cũ không lỗi |

---

## 10. Kịch bản end-to-end (P0)

| ID | Kịch bản | Bước | Kỳ vọng cuối |
|---|---|---|---|
| E2E-01 | **Vòng đời đầy đủ** | Buyer nạp `2.000.000` → thắng đấu giá → pay ORDER_A → seller giao hàng → admin release → seller rút `900.000` → admin complete | `B(buyer)=970.000`; `B(seller)=80.000`; `B(platform)=50.000` (hoa hồng); tổng ledger khớp; Invariant 1–4 pass |
| E2E-02 | **Vòng đời QR trực tiếp** | Buyer lấy QR ORDER_A → CK đúng `1.030.000` → admin release | `B(buyer)=0`; `B(seller)=980.000`; `B(platform)=50.000` |
| E2E-03 | Hủy giữa chừng | Buyer pay → admin refund | `B(buyer)` về như cũ; `B(platform)=0`; đơn `refunded` |
| E2E-04 | Chuyển thiếu rồi bù | CK `1.000.000` → nạp thêm `50.000` → pay bằng ví → release | `B(buyer)=20.000`; `B(seller)=980.000` |
| E2E-05 | Rút bị từ chối rồi rút lại | Rút `500.000` → admin reject → rút lại `500.000` → complete | Tiền hoàn rồi trừ lại đúng một lần mỗi chặng; `B` cuối chính xác |
| E2E-06 | **Đối soát sau toàn bộ suite** | Chạy hết mọi test ở trên | Invariant 1, 2, 3, 4 đều pass. Không ví âm. Không ledger mồ côi |

---

## 11. Ma trận độ phủ theo phase

| Phase | Nhóm test | Số case | Gate |
|---|---|---|---|
| 1 — Migration & seed | MIG | 16 | Pass hết trước khi sang Phase 2 |
| 2 — Ledger engine | LED, NUM | 24 | **Toàn bộ P0 phải pass.** Phase 3+ vô nghĩa nếu nhóm này đỏ |
| 3 — Nạp tiền | SEC, TOP, ADJ | 24 | SEC-01→08 là chặn merge |
| 4 — Thanh toán & escrow | PAY, QRD, UND, OVR, REL, REF, DLN | 55 | UND/OVR là hai thay đổi hành vi — cần review nghiệp vụ, không chỉ pass test |
| 5 — Rút tiền | WDR | 27 | WDR-07/08 (một request) là P0 |
| 6 — Thống kê & đối soát | STA, REC | 23 | REC-02 dễ viết sai thành `= 0` |
| 7 — Hardening | CON, AUD, E2E | 20 | Chạy cuối, trên dữ liệu tích lũy từ các phase trước |
| | **Tổng** | **~190** | |

---

## 12. Ghi chú khi viết test

**Bốn chỗ dễ viết test sai:**

0. **LED-13/13b** — `postTransfer` assert `SUM(tất cả entries) = 0` là **sai**, sẽ chặn nhầm luồng QR pass-through (4D mở đầu bằng `topup_success`, một vế biên với ngân hàng). Chỉ các vế **nội bộ** mới phải cân bằng. Lỗi này đã bị `src/tests/wallet-e2e.check.ts` bắt được trong chính bản plan đầu tiên.


1. **REC-02** — `SUM(wallet_ledger.amount) = 0` là sai (bản plan đầu mắc lỗi này). `topup_success` không có vế đối ứng nội bộ; tổng đúng phải bằng `SUM(wallets.balance)`. Viết nhầm thì alert dội ngay từ lần nạp đầu tiên.

2. **NUM-01→05** — test với số nhỏ vẫn "trông đúng" kể cả khi code đang nối chuỗi. Phải có case số lớn và case so sánh (NUM-04: `"9000000" > "10000000"` là `true` khi so string).

3. **LED-09, CON-01, WDR-08** — test concurrency chạy tuần tự sẽ pass giả. Phải thực sự bắn song song (`Promise.all` với connection riêng), không phải vòng lặp `for` có `await`.

**Thứ tự viết đề xuất:** LED + NUM trước tiên và độc lập hoàn toàn với HTTP layer. Nếu nhóm này chưa xanh thì mọi test phía trên chỉ đang đo lường một nền móng chưa chắc.
