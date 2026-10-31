import nodemailer from 'nodemailer';

const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.MAIL_FROM,
        pass: process.env.MAIL_PASSWORD,
    },
});

export const sendVerifyEmail = async (to: string, verifyUrl: string): Promise<void> => {
    await transporter.sendMail({
        from: `"Bidy" <${process.env.MAIL_FROM}>`,
        to,
        subject: 'Xác thực tài khoản Bidy của bạn',
        html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <h2>Chào mừng đến với Bidy!</h2>
                <p>Vui lòng nhấn vào nút bên dưới để xác thực tài khoản của bạn.</p>
                <p>
                    <a href="${verifyUrl}"
                       style="display:inline-block;padding:12px 24px;background:#4F46E5;color:#fff;text-decoration:none;border-radius:6px;">
                        Xác thực tài khoản
                    </a>
                </p>
                <p style="color:#888;font-size:13px;">
                    Link có hiệu lực trong 24 giờ. Nếu bạn không đăng ký tài khoản này, hãy bỏ qua email này.
                </p>
            </div>
        `,
    });
};

export const sendResetPasswordEmail = async (to: string, resetUrl: string): Promise<void> => {
    await transporter.sendMail({
        from: `"Bidy" <${process.env.MAIL_FROM}>`,
        to,
        subject: 'Đặt lại mật khẩu Bidy của bạn',
        html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <h2>Đặt lại mật khẩu</h2>
                <p>Chúng tôi nhận được yêu cầu đặt lại mật khẩu cho tài khoản của bạn.</p>
                <p>
                    <a href="${resetUrl}"
                       style="display:inline-block;padding:12px 24px;background:#4F46E5;color:#fff;text-decoration:none;border-radius:6px;">
                        Đặt lại mật khẩu
                    </a>
                </p>
                <p style="color:#888;font-size:13px;">
                    Link có hiệu lực trong 15 phút. Nếu bạn không yêu cầu điều này, hãy bỏ qua email này.
                </p>
            </div>
        `,
    });
};
