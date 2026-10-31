import Joi from 'joi';
import { Request, Response, NextFunction } from 'express';
import { apiResponse } from '../common/util/api-response';


/**
 * Generic validation middleware factory
 * @param {Joi.Schema} schema - Joi validation schema
 * @param {string} target - 'body', 'params', 'query'
 * @returns {Function} Express middleware function
 */
export const validateRequest = (schema: Joi.Schema, target: 'body' | 'params' | 'query' = 'body') => {
  return (req: Request, res: Response, next: NextFunction) => {
    const dataToValidate = req[target];

    const { error, value } = schema.validate(dataToValidate, {
      abortEarly: false, // Collect all validation errors
      stripUnknown: true, // Remove unknown properties
    });

    if (error) {
      const errorDetails = error.details.map(detail => ({
        field: detail.path.join('.'),
        message: detail.message,
      }));

      return res.status(400).json(
        apiResponse('fail', 'Validation Error', { errors: errorDetails }),
      );
    }

    // Replace the original data with sanitized/validated data
    req[target] = value;
    next();
  };
};

// Common validation schemas
export const validationSchemas = {
  // User validation schemas
  userLogin: Joi.object({
    userName: Joi.string().alphanum().min(3).max(30).required()
      .messages({
        'string.alphanum': 'Username must only contain alphanumeric characters',
        'string.min': 'Username must be at least 3 characters long',
        'string.max': 'Username must not exceed 30 characters',
        'any.required': 'Username is required',
      }),
    password: Joi.string().min(6).max(100).required()
      .messages({
        'string.min': 'Password must be at least 6 characters long',
        'string.max': 'Password must not exceed 100 characters',
        'any.required': 'Password is required',
      }),
  }),

  userRegister: Joi.object({
    userName: Joi.string().alphanum().min(3).max(30).required(),
    password: Joi.string().min(6).max(100).required(),
    fullName: Joi.string().min(2).max(100).required()
      .pattern(/^[a-zA-Z\s\u00C0-\u024F\u1EA0-\u1EF9]+$/)
      .messages({
        'string.pattern.base': 'Full name can only contain letters and spaces',
      }),
    email: Joi.string().email().required()
      .messages({
        'string.email': 'Please provide a valid email address',
      }),
    identity: Joi.string().pattern(/^\d{9,12}$/).required()
      .messages({
        'string.pattern.base': 'Identity number must be 9-12 digits',
      }),
    phone: Joi.string().pattern(/^(\+84|84|0)[3|5|7|8|9][0-9]{8}$/).required()
      .messages({
        'string.pattern.base': 'Please provide a valid Vietnamese phone number',
      }),
  }),

  changePassword: Joi.object({
    old_password: Joi.string().min(6).max(100).required(),
    new_password: Joi.string().min(6).max(100).required()
      .invalid(Joi.ref('old_password'))
      .messages({
        'any.invalid': 'New password must be different from old password',
      }),
  }),

  forgotPassword: Joi.object({
    email: Joi.string().email().required(),
  }),

  resetPassword: Joi.object({
    token: Joi.string().required(),
    newPassword: Joi.string().min(6).max(100).required(),
  }),

  // Common parameter validation
  mongoIdParam: Joi.object({
    id: Joi.string().pattern(/^[0-9a-fA-F]{24}$/).required()
      .messages({
        'string.pattern.base': 'Invalid ID format',
      }),
  }),

  // Pagination validation
  pagination: Joi.object({
    page: Joi.number().integer().min(1).default(1),
    limit: Joi.number().integer().min(1).max(100).default(10),
  }).unknown(true),

  // Auction creation validation
  auctionCreation: Joi.object({
    name: Joi.string().trim().min(3).max(200).required()
      .messages({
        'string.min': 'Tên sản phẩm phải có ít nhất 3 ký tự',
        'string.max': 'Tên sản phẩm không được vượt quá 200 ký tự',
        'any.required': 'Tên sản phẩm là bắt buộc',
        'string.empty': 'Tên sản phẩm không được để trống',
      }),
    description: Joi.string().trim().min(10).max(2000).required()
      .messages({
        'string.min': 'Mô tả sản phẩm phải có ít nhất 10 ký tự',
        'string.max': 'Mô tả sản phẩm không được vượt quá 2000 ký tự',
        'any.required': 'Mô tả sản phẩm là bắt buộc',
        'string.empty': 'Mô tả sản phẩm không được để trống',
      }),
    price: Joi.string().pattern(/^\d+(\.\d{1,2})?$/).custom((value, helpers) => {
      const numValue = parseFloat(value);
      if (numValue <= 0) {
        return helpers.error('number.positive');
      }
      return value;
    }).required()
      .messages({
        'string.pattern.base': 'Giá phải là một số hợp lệ',
        'number.positive': 'Giá phải lớn hơn 0',
        'any.required': 'Giá khởi điểm là bắt buộc',
        'string.empty': 'Giá khởi điểm không được để trống',
      }),
    priceBuyNow: Joi.string().pattern(/^\d+(\.\d{1,2})?$/).optional().custom((value, helpers) => {
      if (value) {
        const numValue = parseFloat(value);
        if (numValue <= 0) {
          return helpers.error('number.positive');
        }
        // Get the starting price from the same object for comparison
        const startingPrice = parseFloat(helpers.state.ancestors[0].price);
        if (numValue <= startingPrice) {
          return helpers.error('number.higher');
        }
      }
      return value;
    })
      .messages({
        'string.pattern.base': 'Giá mua ngay phải là một số hợp lệ',
        'number.positive': 'Giá mua ngay phải lớn hơn 0',
        'number.higher': 'Giá mua ngay phải cao hơn giá khởi điểm',
      }),
    quantity: Joi.string().pattern(/^\d+$/).custom((value, helpers) => {
      const numValue = parseInt(value);
      if (numValue <= 0) {
        return helpers.error('number.positive');
      }
      return value;
    }).required()
      .messages({
        'string.pattern.base': 'Số lượng phải là một số nguyên',
        'number.positive': 'Số lượng phải lớn hơn 0',
        'any.required': 'Số lượng là bắt buộc',
      }),
    category: Joi.string().pattern(/^[0-9a-fA-F]{24}$/).required()
      .messages({
        'string.pattern.base': 'ID danh mục không hợp lệ',
        'any.required': 'Danh mục sản phẩm là bắt buộc',
      }),
    durationDays: Joi.string().pattern(/^\d+$/).custom((value, helpers) => {
      const numValue = parseInt(value);
      if (numValue <= 0) {
        return helpers.error('number.positive');
      }
      if (numValue > 30) {
        return helpers.error('number.max');
      }
      return value;
    }).required()
      .messages({
        'string.pattern.base': 'Thời gian đấu giá phải là một số nguyên',
        'number.positive': 'Thời gian đấu giá phải từ 1 ngày trở lên',
        'number.max': 'Thời gian đấu giá không được vượt quá 30 ngày',
        'any.required': 'Thời gian đấu giá là bắt buộc',
      }),
    startDate: Joi.date().iso().min('now').required()
      .messages({
        'date.base': 'Ngày bắt đầu phải là một ngày hợp lệ',
        'date.min': 'Ngày bắt đầu phải ở tương lai',
        'any.required': 'Ngày bắt đầu là bắt buộc',
      }),
  }),

  // Support chat validation schemas
  supportChatStart: Joi.object({
    subject: Joi.string().max(200).trim().optional()
      .messages({
        'string.max': 'Subject must not exceed 200 characters',
      }),
  }),

  supportMessage: Joi.object({
    chatId: Joi.string().pattern(/^[0-9a-fA-F]{24}$/).required()
      .messages({
        'string.pattern.base': 'Invalid chat ID format',
        'any.required': 'Chat ID is required',
      }),
    message: Joi.string().min(1).max(2000).trim().required()
      .messages({
        'string.min': 'Message cannot be empty',
        'string.max': 'Message must not exceed 2000 characters',
        'any.required': 'Message is required',
      }),
    messageType: Joi.string().valid('text', 'image', 'file').optional().default('text')
      .messages({
        'any.only': 'Message type must be text, image, or file',
      }),
  }),

  chatMessagesQuery: Joi.object({
    page: Joi.number().integer().min(1).optional().default(1)
      .messages({
        'number.base': 'Page must be a number',
        'number.integer': 'Page must be an integer',
        'number.min': 'Page must be at least 1',
      }),
    limit: Joi.number().integer().min(1).max(50).optional().default(20)
      .messages({
        'number.base': 'Limit must be a number',
        'number.integer': 'Limit must be an integer',
        'number.min': 'Limit must be at least 1',
        'number.max': 'Limit must not exceed 50',
      }),
  }),

  adminChatQuery: Joi.object({
    status: Joi.string().valid('open', 'in_progress', 'resolved', 'closed').optional()
      .messages({
        'any.only': 'Status must be open, in_progress, resolved, or closed',
      }),
    priority: Joi.string().valid('low', 'medium', 'high').optional()
      .messages({
        'any.only': 'Priority must be low, medium, or high',
      }),
    isActive: Joi.string().valid('true', 'false').optional()
      .messages({
        'any.only': 'isActive must be true or false',
      }),
    page: Joi.number().integer().min(1).optional().default(1)
      .messages({
        'number.base': 'Page must be a number',
        'number.integer': 'Page must be an integer',
        'number.min': 'Page must be at least 1',
      }),
    limit: Joi.number().integer().min(1).max(50).optional().default(20)
      .messages({
        'number.base': 'Limit must be a number',
        'number.integer': 'Limit must be an integer',
        'number.min': 'Limit must be at least 1',
        'number.max': 'Limit must not exceed 50',
      }),
  }),

  chatStatusUpdate: Joi.object({
    status: Joi.string().valid('open', 'in_progress', 'resolved', 'closed').required()
      .messages({
        'any.only': 'Status must be open, in_progress, resolved, or closed',
        'any.required': 'Status is required',
      }),
  }),

  objectIdParam: Joi.object({
    chatId: Joi.string().pattern(/^[0-9a-fA-F]{24}$/).required()
      .messages({
        'string.pattern.base': 'Invalid chat ID format',
        'any.required': 'Chat ID is required',
      }),
  }),
};

// Pre-built validation middlewares
export const validationMiddlewares = {
  // User validations
  validateUserLogin: validateRequest(validationSchemas.userLogin, 'body'),
  validateUserRegister: validateRequest(validationSchemas.userRegister, 'body'),
  validateChangePassword: validateRequest(validationSchemas.changePassword, 'body'),
  validateForgotPassword: validateRequest(validationSchemas.forgotPassword, 'body'),
  validateResetPassword: validateRequest(validationSchemas.resetPassword, 'body'),

  // Parameter validations
  validateMongoId: validateRequest(validationSchemas.mongoIdParam, 'params'),

  // Query validations
  validatePagination: validateRequest(validationSchemas.pagination, 'query'),

  // Auction validations
  validateAuctionCreation: validateRequest(validationSchemas.auctionCreation, 'body'),

  // Support chat validations
  validateSupportChatStart: validateRequest(validationSchemas.supportChatStart, 'body'),
  validateSupportMessage: validateRequest(validationSchemas.supportMessage, 'body'),
  validateChatMessagesQuery: validateRequest(validationSchemas.chatMessagesQuery, 'query'),
  validateAdminChatQuery: validateRequest(validationSchemas.adminChatQuery, 'query'),
  validateChatStatusUpdate: validateRequest(validationSchemas.chatStatusUpdate, 'body'),

  // Generic ObjectId validation for params
  validateObjectId: (paramName: string) => validateRequest(Joi.object({
    [paramName]: Joi.string().pattern(/^[0-9a-fA-F]{24}$/).required()
      .messages({
        'string.pattern.base': `Invalid ${paramName} format`,
        'any.required': `${paramName} is required`,
      }),
  }), 'params'),
};
