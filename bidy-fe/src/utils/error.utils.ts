import { AxiosError } from "axios";
import { toast } from "sonner";

// Map common error messages to user-friendly Vietnamese messages
const ERROR_MESSAGES: Record<string, string> = {
  // Network errors
  'Network Error': 'Lỗi kết nối mạng. Vui lòng kiểm tra kết nối internet.',
  'timeout': 'Kết nối quá chậm. Vui lòng thử lại.',
  
  // Auth errors
  'Invalid login credentials': 'Tên đăng nhập hoặc mật khẩu không đúng.',
  'User not found': 'Không tìm thấy người dùng.',
  'Invalid or expired reset token': 'Liên kết đặt lại mật khẩu đã hết hạn hoặc không hợp lệ.',
  'Password too weak': 'Mật khẩu quá yếu. Vui lòng chọn mật khẩu mạnh hơn.',
  
  // Registration errors  
  'Email already exists': 'Email này đã được đăng ký.',
  'Username already exists': 'Tên đăng nhập này đã được sử dụng.',
  'Phone already exists': 'Số điện thoại này đã được đăng ký.',
  'Identity already exists': 'CMND/CCCD này đã được đăng ký.',
  
  // Category errors — backend trả về mã lỗi thô, không phải câu tiếng Anh
  'CATEGORY_NOT_FOUND': 'Không tìm thấy danh mục.',
  'CATEGORY_ALREADY_EXISTS': 'Đã có danh mục cùng tên trong cùng cấp cha.',
  'CATEGORY_CYCLE_DETECTED': 'Không thể chọn chính nó hoặc danh mục con làm cha.',
  'MAX_CATEGORY_DEPTH_EXCEEDED': 'Cây danh mục chỉ cho phép tối đa 3 cấp.',
  'CATEGORY_HAS_CHILDREN': 'Danh mục còn danh mục con, hãy xoá hoặc chuyển chúng trước.',
  'CATEGORY_HAS_PRODUCTS': 'Danh mục còn sản phẩm, không thể xoá.',

  // Validation errors
  'Invalid email format': 'Định dạng email không hợp lệ.',
  'Required field': 'Trường này là bắt buộc.',
  
  // Server errors
  'Internal server error': 'Lỗi hệ thống. Vui lòng thử lại sau.',
  'Service unavailable': 'Dịch vụ tạm thời không khả dụng. Vui lòng thử lại sau.',
};

export type ErrorType = "error" | "warning" | "network" | "validation";

export interface ProcessedError {
  message: string;
  type: ErrorType;
  retryable: boolean;
  statusCode?: number;
}

export const processError = (error: AxiosError | Error): ProcessedError => {
  let errorMessage = "Đã xảy ra lỗi. Vui lòng thử lại.";
  let errorType: ErrorType = "error";
  let retryable = false;
  let statusCode: number | undefined;
  
  if (error instanceof AxiosError) {
    const response = error.response;
    const data = response?.data;
    statusCode = response?.status;
    
    // Handle network errors first
    if (error.code === 'ECONNABORTED' || error.message.includes('timeout')) {
      errorMessage = ERROR_MESSAGES['timeout'];
      errorType = "network";
      retryable = true;
    } else if (error.message === 'Network Error') {
      errorMessage = ERROR_MESSAGES['Network Error'];
      errorType = "network";
      retryable = true;
    } else {
      // Handle different status codes
      switch (response?.status) {
        case 400:
          errorMessage = data?.message || "Dữ liệu không hợp lệ.";
          errorType = "validation";
          break;
        case 401:
          // For login endpoints, show the server message; for other endpoints, show generic auth message
          if (error.config?.url?.includes('/user/login') && data?.message) {
            errorMessage = data.message;
          } else {
            errorMessage = "Bạn cần đăng nhập để tiếp tục.";
          }
          errorType = "error";
          break;
        case 403:
          errorMessage = "Bạn không có quyền thực hiện hành động này.";
          errorType = "warning";
          break;
        case 404:
          errorMessage = "Không tìm thấy tài nguyên yêu cầu.";
          errorType = "error";
          break;
        case 409:
          errorMessage = data?.message || "Dữ liệu đã tồn tại.";
          errorType = "validation";
          break;
        case 422:
          errorMessage = data?.message || "Dữ liệu không hợp lệ.";
          errorType = "validation";
          break;
        case 429:
          errorMessage = "Bạn đang thực hiện quá nhiều yêu cầu. Vui lòng chờ một chút.";
          errorType = "warning";
          retryable = true;
          break;
        case 500:
          errorMessage = "Lỗi hệ thống. Vui lòng thử lại sau.";
          errorType = "error";
          retryable = true;
          break;
        case 502:
        case 503:
        case 504:
          errorMessage = "Dịch vụ tạm thời không khả dụng. Vui lòng thử lại sau.";
          errorType = "network";
          retryable = true;
          break;
        default:
          errorMessage = data?.message || "Đã xảy ra lỗi không xác định.";
          errorType = "error";
      }
      
      // Check for specific error messages
      const serverMessage = data?.message || "";
      const mappedMessage = Object.keys(ERROR_MESSAGES).find(key => 
        serverMessage.toLowerCase().includes(key.toLowerCase())
      );
      
      if (mappedMessage) {
        errorMessage = ERROR_MESSAGES[mappedMessage];
        // Set appropriate error type for mapped messages
        if (['Invalid email format', 'Password too weak'].includes(mappedMessage)) {
          errorType = "validation";
        }
      }
    }
  } else {
    // Handle regular JavaScript errors
    const errorMsg = error?.message || "";
    const mappedMessage = Object.keys(ERROR_MESSAGES).find(key => 
      errorMsg.toLowerCase().includes(key.toLowerCase())
    );
    
    if (mappedMessage) {
      errorMessage = ERROR_MESSAGES[mappedMessage];
    } else {
      errorMessage = error?.message || "Đã xảy ra lỗi không xác định.";
    }
  }
  
  return {
    message: errorMessage,
    type: errorType,
    retryable,
    statusCode
  };
};

export const handleErrorMessage = (error: AxiosError | Error) => {
  const processedError = processError(error);
  toast.error(processedError.message);
  
  // Log the original error for debugging
  if (process.env.NODE_ENV === 'development') {
    console.error('Error details:', error);
  }
  
  return processedError;
};

// Success message handler for consistency
export const handleSuccessMessage = (message?: string, defaultMessage?: string) => {
  toast.success(message || defaultMessage || "Thao tác thành công!");
};

// Warning message handler
export const handleWarningMessage = (message: string) => {
  toast.warning(message);
};

// Info message handler
export const handleInfoMessage = (message: string) => {
  toast.info(message);
};
