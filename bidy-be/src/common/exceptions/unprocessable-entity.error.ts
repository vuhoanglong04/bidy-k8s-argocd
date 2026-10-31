import { AppError } from '../../middlewares/error.middleware.js';

export class UnprocessableEntityError extends AppError {
  constructor(message: string) {
    super(message, 422);
    this.name = 'UnprocessableEntityError';
  }
}
