# Đêm Trăng — Ma Sói online

Game Ma Sói chơi trên trình duyệt, không cần cài ứng dụng hoặc ở cùng mạng nội bộ. Người tạo phòng cũng là người chơi; trò chơi tự động chia vai, điều phối đêm/ngày, năng lực và bỏ phiếu.

## Chơi thử

Mở `index.html` trên trình duyệt có kết nối Internet. Tạo phòng, gửi link hoặc mã 6 ký tự cho bạn bè. Mỗi phòng hỗ trợ 5–16 người.

Để bạn bè truy cập từ thiết bị khác, hãy xuất bản thư mục này lên một dịch vụ hosting web HTTPS, ví dụ GitHub Pages:

1. Mở **Settings → Pages** trong repository.
2. Chọn **Deploy from a branch**, nhánh `main`, thư mục `/ (root)`, rồi lưu.
3. Mở đường dẫn Pages được cung cấp; chủ phòng tạo phòng và gửi link mời cho những người còn lại.

Trang web tĩnh dùng PeerJS Cloud để tìm nhau và thiết lập kết nối trực tiếp qua Internet; không cần dựng server riêng. Tất cả người chơi cần Internet và truy cập cùng đường dẫn web. Google Fonts và thư viện PeerJS được tải từ dịch vụ bên ngoài.

## Luật và vai trò

- Chọn số lượng Ma sói, Tiên tri, Phù thủy, Bảo vệ, Thợ săn và Trưởng làng trong phòng chờ. Dân làng tự lấp đầy số chỗ còn lại.
- Cần ít nhất 5 người và tối thiểu một vai Ma sói.
- Đêm: Sói bỏ phiếu chọn mục tiêu; Tiên tri soi phe; Phù thủy có một thuốc cứu và một thuốc độc; Bảo vệ chọn người để che chở. Các lượt đêm tự kết thúc khi mọi vai trò cần hành động đã chọn hoặc hết giờ.
- Thợ săn được chọn một người còn sống để bắn khi bị loại; nếu bắn trúng Thợ săn khác, người đó cũng có lượt bắn. Trưởng làng có lá phiếu nặng gấp đôi.
- Ngày: người chơi tự thảo luận bằng hình thức bên ngoài game, sau đó bỏ phiếu kín trên trang. Hòa phiếu thì không ai bị loại.
- Phe Sói thắng khi số sói còn sống bằng hoặc nhiều hơn số người phe làng; phe làng thắng khi loại hết sói.

## Lưu ý kết nối và riêng tư

- Chủ phòng cần giữ trang phòng mở và trực tuyến trong suốt ván; nếu chủ phòng đóng trang hoặc mất kết nối, phòng có thể kết thúc. Người chơi khác có thể tải lại trang để kết nối lại khi phòng vẫn hoạt động.
- Trạng thái trò chơi được giữ trong trình duyệt chủ phòng và gửi qua kết nối ngang hàng. Vai trò người còn sống chỉ được gửi riêng cho từng người chơi, nhưng mô hình này không chống được chủ phòng xem dữ liệu trò chơi hoặc người chơi cố tình gian lận.
- Đây là game giải trí, không phải dịch vụ có xác thực tài khoản hoặc lưu trữ phòng lâu dài.
