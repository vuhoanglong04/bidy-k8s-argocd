import { AppError } from '../../middlewares/error.middleware.js';

export class ForbiddenError extends AppError {
  constructor(message: string) {
    super(message, 403);
    this.name = 'ForbiddenError';
  }
}
