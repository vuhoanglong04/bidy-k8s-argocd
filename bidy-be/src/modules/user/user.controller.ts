import { Request, Response } from 'express';
import { UserService } from './user.service.js';
import { apiResponse } from '../../common/util/api-response.js';
import { logger } from '../../common/util/logger.js';

export interface CustomRequest<T = any, Q = any> extends Request<any, any, T, Q> {
    idUser?: string;
    /** Set by isAuth alongside idUser; services use it for the admin override. */
    role?: string;
    file?: any;
    files?: any;
}

export class UserController {
    constructor(private readonly userService: UserService) {}

    viewProfile = async (req: CustomRequest, res: Response) => {
        try {
            const profile = await this.userService.viewProfile(req.idUser!);
            if (!profile) {
                return res.status(404).json(apiResponse('fail', 'Người dùng không tồn tại'));
            }
            return res.status(200).json(apiResponse('success', 'Lấy thông tin cá nhân thành công', profile));
        } catch (error: any) {
            logger.error('Error fetching profile', error);
            return res.status(500).json(apiResponse('error', 'Lỗi hệ thống, vui lòng thử lại'));
        }
    };

    userUpdate = async (req: CustomRequest, res: Response) => {
        try {
            const { fullName, email, phone } = req.body;
            const updated = await this.userService.userUpdate(req.idUser!, fullName, email, phone);
            return res.status(200).json(apiResponse('success', 'Cập nhật thông tin thành công', updated));
        } catch (error: any) {
            if (error.message === 'EMAIL_EXISTS') {
                return res.status(409).json(apiResponse('fail', 'Email đã tồn tại'));
            }
            if (error.message === 'PHONE_EXISTS') {
                return res.status(409).json(apiResponse('fail', 'Số điện thoại đã tồn tại'));
            }

            logger.error('Error updating user', error);
            return res.status(500).json(apiResponse('error', 'Lỗi hệ thống, vui lòng thử lại'));
        }
    };

    changePassword = async (req: CustomRequest, res: Response) => {
        try {
            const oldPassword = req.body.oldPassword ?? req.body.old_password;
            const newPassword = req.body.newPassword ?? req.body.new_password;

            if (!oldPassword || !newPassword) {
                return res.status(400).json(apiResponse('fail', 'Vui lòng nhập mật khẩu cũ và mật khẩu mới'));
            }

            await this.userService.changePassword(req.idUser!, oldPassword, newPassword);
            return res.status(200).json(apiResponse('success', 'Đổi mật khẩu thành công'));
        } catch (error: any) {
            if (error.message === 'USER_NOT_FOUND') {
                return res.status(404).json(apiResponse('fail', 'Người dùng không tồn tại'));
            }
            if (error.message === 'INVALID_PASSWORD') {
                return res.status(400).json(apiResponse('fail', 'Mật khẩu cũ không chính xác'));
            }

            logger.error('Error changing password', error);
            return res.status(500).json(apiResponse('error', 'Lỗi hệ thống, vui lòng thử lại'));
        }
    };

    checkUser = async (req: CustomRequest, res: Response) => {
        try {
            const { email, phone, userName } = req.body;
            const result = await this.userService.checkUser({ email, phone, userName });
            return res.status(200).json(apiResponse('success', 'Kiểm tra thông tin thành công', result));
        } catch (error: any) {
            logger.error('Error checking user', error);
            return res.status(500).json(apiResponse('error', 'Lỗi hệ thống, vui lòng thử lại'));
        }
    };

    updateAvatar = async (req: CustomRequest, res: Response) => {
        try {
            const data = await this.userService.updateAvatar(req.idUser!, req.file);
            return res.status(200).json(apiResponse('success', 'Cập nhật ảnh đại diện thành công', data));
        } catch (error: any) {
            if (error.message === 'NO_FILE_PROVIDED') {
                return res.status(400).json(apiResponse('fail', 'Vui lòng chọn một ảnh để tải lên'));
            }
            if (error.message === 'USER_NOT_FOUND') {
                return res.status(404).json(apiResponse('fail', 'Người dùng không tồn tại'));
            }

            logger.error('Error updating avatar', error);
            return res.status(500).json(apiResponse('error', 'Lỗi hệ thống khi tải ảnh lên'));
        }
    };

    getUserStats = async (req: CustomRequest, res: Response) => {
        try {
            const data = await this.userService.getUserStats(req.idUser!);
            return res.status(200).json(apiResponse('success', 'Lấy thống kê người dùng thành công', data));
        } catch (error: any) {
            logger.error('Error getting user stats', error);
            return res.status(500).json(apiResponse('error', 'Lỗi hệ thống, vui lòng thử lại'));
        }
    };

    wishlist = async (req: CustomRequest, res: Response) => {
        try {
            const { page, limit } = req.query;
            const result = await this.userService.wishlist(req.idUser!, { page, limit });
            return res.status(200).json(apiResponse('success', 'Lấy danh sách yêu thích thành công', result));
        } catch (error: any) {
            logger.error('Error getting wishlist', error);
            return res.status(500).json(apiResponse('error', 'Lỗi hệ thống, vui lòng thử lại'));
        }
    };

    addWishlist = async (req: CustomRequest, res: Response) => {
        try {
            const auctionId = req.body.auctionId || req.params.id;
            if (!auctionId) {
                return res.status(400).json(apiResponse('fail', 'Thiếu mã phiên đấu giá'));
            }

            const item = await this.userService.addWishlist(req.idUser!, auctionId);
            return res.status(201).json(apiResponse('success', 'Đã thêm vào danh sách yêu thích', item));
        } catch (error: any) {
            if (error.message === 'AUCTION_ALREADY_IN_WISHLIST') {
                return res.status(409).json(apiResponse('fail', 'Phiên đấu giá đã có trong danh sách yêu thích'));
            }

            logger.error('Error adding to wishlist', error);
            return res.status(500).json(apiResponse('error', 'Lỗi hệ thống, vui lòng thử lại'));
        }
    };

    removeWishlist = async (req: CustomRequest, res: Response) => {
        try {
            const auctionId = req.body.auctionId || req.params.id;
            if (!auctionId) {
                return res.status(400).json(apiResponse('fail', 'Thiếu mã phiên đấu giá'));
            }

            await this.userService.removeWishlist(req.idUser!, auctionId);
            return res.status(200).json(apiResponse('success', 'Đã xóa khỏi danh sách yêu thích'));
        } catch (error: any) {
            logger.error('Error removing from wishlist', error);
            return res.status(500).json(apiResponse('error', 'Lỗi hệ thống, vui lòng thử lại'));
        }
    };

    listAddresses = async (req: CustomRequest, res: Response) => {
        try {
            const addresses = await this.userService.listAddresses(req.idUser!);
            return res.status(200).json(apiResponse('success', 'Lấy danh sách địa chỉ thành công', addresses));
        } catch (error: any) {
            logger.error('Error listing addresses', error);
            return res.status(500).json(apiResponse('error', 'Lỗi hệ thống, vui lòng thử lại'));
        }
    };

    createAddress = async (req: CustomRequest, res: Response) => {
        try {
            const address = await this.userService.createAddress(req.idUser!, req.body);
            return res.status(201).json(apiResponse('success', 'Thêm địa chỉ thành công', address));
        } catch (error: any) {
            logger.error('Error creating address', error);
            return res.status(500).json(apiResponse('error', 'Lỗi hệ thống, vui lòng thử lại'));
        }
    };

    updateAddress = async (req: CustomRequest, res: Response) => {
        try {
            const address = await this.userService.updateAddress(req.idUser!, String(req.params.id), req.body);
            return res.status(200).json(apiResponse('success', 'Cập nhật địa chỉ thành công', address));
        } catch (error: any) {
            return this.handleAddressError(res, error, 'Error updating address');
        }
    };

    setDefaultAddress = async (req: CustomRequest, res: Response) => {
        try {
            const address = await this.userService.setDefaultAddress(req.idUser!, String(req.params.id));
            return res.status(200).json(apiResponse('success', 'Đã đặt làm địa chỉ mặc định', address));
        } catch (error: any) {
            return this.handleAddressError(res, error, 'Error setting default address');
        }
    };

    removeAddress = async (req: CustomRequest, res: Response) => {
        try {
            await this.userService.removeAddress(req.idUser!, String(req.params.id));
            return res.status(200).json(apiResponse('success', 'Đã xóa địa chỉ'));
        } catch (error: any) {
            return this.handleAddressError(res, error, 'Error removing address');
        }
    };

    /** The address routes share one error vocabulary; mapping it once keeps them in step. */
    private handleAddressError(res: Response, error: any, context: string) {
        if (error.message === 'ADDRESS_NOT_FOUND') {
            return res.status(404).json(apiResponse('fail', 'Không tìm thấy địa chỉ', 'ADDRESS_NOT_FOUND'));
        }
        if (error.message === 'ADDRESS_IN_USE') {
            return res.status(409).json(
                apiResponse('fail', 'Địa chỉ này đang gắn với đơn hàng, không thể xóa', 'ADDRESS_IN_USE'),
            );
        }

        logger.error(context, error);
        return res.status(500).json(apiResponse('error', 'Lỗi hệ thống, vui lòng thử lại'));
    }

    removeAllWishlist = async (req: CustomRequest, res: Response) => {
        try {
            await this.userService.removeAllWishlist(req.idUser!);
            return res.status(200).json(apiResponse('success', 'Đã xóa tất cả sản phẩm khỏi danh sách yêu thích'));
        } catch (error: any) {
            logger.error('Error clearing wishlist', error);
            return res.status(500).json(apiResponse('error', 'Lỗi hệ thống, vui lòng thử lại'));
        }
    };
}
