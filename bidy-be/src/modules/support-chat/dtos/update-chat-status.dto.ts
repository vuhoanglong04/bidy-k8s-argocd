import { IsEnum } from 'class-validator';
import { SupportTicketStatus } from '../enum/support-ticket-status.enum.js';

/**
 * @swagger
 * components:
 *   schemas:
 *     UpdateChatStatusDto:
 *       type: object
 *       required: [status]
 *       properties:
 *         status:
 *           type: string
 *           enum: [open, in_progress, resolved, closed]
 *           description: >
 *             Target status. Any other value is rejected: `open` is what
 *             GET /support-chat/my-chat looks for and what the one-open-ticket-per-user
 *             constraint is keyed on, so an unrecognised status hides the ticket from
 *             the user and lets them open a second one.
 *           example: resolved
 */
export class UpdateChatStatusDto {
  @IsEnum(SupportTicketStatus, { message: 'status must be one of: open, in_progress, resolved, closed' })
  status!: SupportTicketStatus;
}
