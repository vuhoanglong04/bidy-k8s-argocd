import webSocketService from './websocket.service.js';
import chatService from '../chat/chat.service.js';
import supportChatService from '../support-chat/support.service.js';
import { verifyAccessToken } from '../../middlewares/authen.middleware.js';

/**
 * Reads the caller's identity off the socket, or tells the client it must
 * authenticate. Every event carrying a user identity goes through this: an id
 * taken from the payload is an id the sender chose for themselves, which let
 * anyone read another user's conversation or post messages under their name.
 */
const requireUser = (socket: any, event: string): string | null => {
	const userId = socket.data?.userId;
	if (!userId) {
		console.error(`❌[Socket]: Unauthenticated ${event} from ${socket.id}`);
		socket.emit('error', {
			message: 'Authentication required',
			code: 'SOCKET_UNAUTHENTICATED',
			timestamp: new Date().toISOString(),
		});
		return null;
	}
	return userId;
};

/**
 * Tells the sender what happened to the message it just sent, keyed by the id the
 * client made up for its optimistic bubble.
 *
 * Without this a socket send is fire-and-forget: the sender learns the message landed
 * only by seeing it come back on the room broadcast, and learns nothing at all when it
 * fails — the generic 'error' event carries no clientMessageId, so a client with three
 * messages in flight cannot tell which bubble to roll back. That is the gap that pushed
 * the frontend to POST each message instead, just to get a response to await.
 */
const ackMessage = (socket: any, clientMessageId: string | undefined, result: any) => {
	if (!clientMessageId) return;
	socket.emit('support_message_ack', { clientMessageId, ...result });
};

/** Same as requireUser, plus the admin role the `admin_*` events assume. */
const requireAdmin = (socket: any, event: string): string | null => {
	const adminId = requireUser(socket, event);
	if (!adminId) return null;

	if (socket.data.role !== 'admin') {
		console.error(`❌[Socket]: Non-admin ${adminId} attempted ${event}`);
		socket.emit('error', {
			message: 'Access denied: Insufficient permissions',
			code: 'SOCKET_FORBIDDEN',
			timestamp: new Date().toISOString(),
		});
		return null;
	}
	return adminId;
};

export const socket = (io: any) => {
	webSocketService.initialize(io);

	// Identity is established once, from the token, at handshake — never from an
	// event payload. It does not reject: auction status updates below are public
	// and anonymous visitors must keep receiving them.
	io.use((socket: any, next: any) => {
		const handshake = socket.handshake;
		const raw = handshake.auth?.token || handshake.headers?.authorization;
		const token = typeof raw === 'string' && raw.toLowerCase().startsWith('bearer ')
			? raw.substring(7)
			: raw;

		const user = verifyAccessToken(token);
		if (user) {
			socket.data.userId = String(user.idUser);
			socket.data.role = user.role;
		}

		next();
	});

	io.on('connection', (socket: any) => {
		console.log(`💬[Chat]: Client connected - ${socket.id}`);

		// The lifecycle cron broadcasts every pending->happening->ended flip to this
		// room. Nothing joined it, so those updates reached nobody. Status changes are
		// public and not scoped to one auction, so every client subscribes on connect.
		socket.join('auction_status_sync');

		// Per-user room: the address for anything aimed at one person (conversation
		// activity, notifications). Keyed off the verified token, so it cannot be
		// joined by asking.
		if (socket.data.userId) {
			socket.join(`user_${socket.data.userId}`);
			webSocketService.addChatUser(socket.id, socket.data.userId);
		}

		socket.on('sendMessage', async ({ conversationId, message }: any) => {
			const senderId = requireUser(socket, 'sendMessage');
			if (!senderId) return;

			try {
				if (!conversationId || !message) {
					console.error('❌[Chat]: Missing required fields for sendMessage');
					socket.emit('error', { message: 'Missing required message fields' });
					return;
				}

				await chatService.createMessage(senderId, conversationId, message);
				console.log(`💬[Chat]: Message sent from ${senderId} to conversation ${conversationId}`);

			} catch (error: any) {
				console.error('❌[Chat]: Error handling sendMessage:', {
					error: error.message,
					stack: error.stack,
					senderId,
					conversationId,
				});
				socket.emit('error', {
					message: 'Failed to send message',
					code: 'SEND_MESSAGE_ERROR',
					details: error.message,
					context: { conversationId },
					timestamp: new Date().toISOString(),
				});
			}
		});

		socket.on('joinAuction', ({ auctionId, userId }: any) => {
			webSocketService.joinAuctionRoom(socket.id, auctionId, userId);
		});

		socket.on('leaveAuction', ({ auctionId }: any) => {
			webSocketService.leaveAuctionRoom(socket.id, auctionId);
		});

		socket.on('joinOrder', ({ orderId }: any) => {
			if (orderId) socket.join(`order_${orderId}`);
		});

		socket.on('leaveOrder', ({ orderId }: any) => {
			if (orderId) socket.leave(`order_${orderId}`);
		});

		socket.on('requestAuctionStatus', ({ auctionId }: any) => {
			webSocketService.sendCurrentAuctionStatus(socket.id, auctionId);
		});

		socket.on('requestBidderStats', (auctionId: string) => {
			webSocketService.sendCurrentBidderStats(socket.id, auctionId);
		});

		// No 'newBid' listener on purpose: it rebroadcast whatever the client sent,
		// unauthenticated and unvalidated, so anyone could inject a fake price into
		// the room. Bids are broadcast by the server after POST /auctions/:id/bid
		// commits — that is the only path that can announce a bid.

		socket.on('joinConversation', async ({ conversationId }: any) => {
			const userId = requireUser(socket, 'joinConversation');
			if (!userId) return;

			try {
				if (!conversationId) {
					console.error('❌[Chat]: Missing parameters for joinConversation', { conversationId });
					socket.emit('error', {
						message: 'Missing conversation parameters',
						code: 'MISSING_PARAMETERS',
						details: 'conversationId is required',
						required: ['conversationId'],
						timestamp: new Date().toISOString(),
					});
					return;
				}

				await webSocketService.joinConversationRoom(socket.id, conversationId, userId);
				console.log(`💬[Chat]: User ${userId} joined conversation ${conversationId}`);
			} catch (error: any) {
				console.error('❌[Chat]: Error joining conversation:', {
					error: error.message,
					stack: error.stack,
					userId,
					conversationId,
					socketId: socket.id,
				});
				socket.emit('error', {
					message: 'Failed to join conversation',
					code: 'JOIN_CONVERSATION_ERROR',
					details: error.message,
					context: { userId, conversationId },
					timestamp: new Date().toISOString(),
				});
			}
		});

		socket.on('leaveConversation', ({ conversationId }: any) => {
			try {
				if (!conversationId) {
					console.error('❌[Chat]: Missing conversationId for leaveConversation', { conversationId });
					socket.emit('error', {
						message: 'Missing conversationId parameter',
						code: 'MISSING_CONVERSATION_ID',
						details: 'conversationId is required to leave conversation',
						timestamp: new Date().toISOString(),
					});
					return;
				}

				webSocketService.leaveConversationRoom(socket.id, conversationId);
				console.log(`💬[Chat]: User left conversation ${conversationId}`);
			} catch (error: any) {
				console.error('❌[Chat]: Error leaving conversation:', {
					error: error.message,
					stack: error.stack,
					conversationId,
					socketId: socket.id,
				});
				socket.emit('error', {
					message: 'Failed to leave conversation',
					code: 'LEAVE_CONVERSATION_ERROR',
					details: error.message,
					context: { conversationId },
					timestamp: new Date().toISOString(),
				});
			}
		});

		// Goes through the same service as POST /api/v1/support-chat/start rather than
		// inventing a ticket in memory: this handler used to emit a hardcoded
		// 'temp_chat_id' and persist nothing, so the id the client got back could not be
		// used to join a room or send a message, and the admin was notified about a chat
		// that did not exist. The service is idempotent, so re-emitting this event — a
		// reconnect, a second tab — returns the same ticket instead of opening another.
		socket.on('user_start_chat', async ({ subject, priority = 'medium' }: any) => {
			const userId = requireUser(socket, 'user_start_chat');
			if (!userId) return;

			try {
				const chat = await supportChatService.startOrGetUserChat(
					userId,
					subject || 'Hỗ trợ khách hàng Bidy',
				);

				webSocketService.addSupportChatUser(socket.id, userId, 'user');
				// Joined here so the opener receives messages on this ticket without having
				// to make a second user_join_chat round trip — which it could only do after
				// learning the id from the emit below, leaving a window where an admin reply
				// would be broadcast to a room the user is not in yet.
				webSocketService.joinSupportChatRoom(socket.id, chat.id, userId, 'user');

				console.log(`💬[SupportChat]: User ${userId} started support chat ${chat.id}`);

				webSocketService.notifyAdminNewSupportChat({ ...chat, priority });

				socket.emit('support_chat_created', { success: true, chat });

			} catch (error: any) {
				console.error('❌[SupportChat]: Error starting support chat:', error);
				socket.emit('error', {
					message: 'Failed to start support chat',
					code: 'START_CHAT_ERROR',
					details: error.message,
				});
			}
		});

		// messageType is the documented name; _messageType is accepted alongside it because
		// the field shipped with that underscore and clients are still sending it. The
		// underscore was a slip — it reads as the "deliberately unused" convention used
		// elsewhere in this file, on a field that is very much used.
		socket.on('user_send_message', async ({ chatId, message, clientMessageId, messageType, _messageType }: any) => {
			const userId = requireUser(socket, 'user_send_message');
			if (!userId) return;

			try {
				if (!chatId || !message) {
					console.error('❌[SupportChat]: Missing required fields for user_send_message');
					socket.emit('error', {
						message: 'Missing required message fields (chatId, message)',
						code: 'MISSING_PARAMETERS',
						context: { chatId },
						timestamp: new Date().toISOString(),
					});
					return;
				}

				// Joining before the send, not after: the broadcast goes to the ticket room,
				// so a sender who never joined does not receive its own message back and
				// its optimistic bubble stays provisional forever. Re-joining a room the
				// socket is already in is a no-op.
				webSocketService.joinSupportChatRoom(socket.id, chatId, userId, 'user');

				// requesterId makes sendMessage check ticket ownership. Omitting it skips
				// that check entirely, which let any authenticated user post into another
				// user's support ticket by guessing its id. Admins reply to every ticket,
				// so admin_send_message below deliberately does not pass it.
				const saved = await supportChatService.sendMessage({
					ticketId: chatId,
					senderId: userId,
					content: message,
					messageType: messageType ?? _messageType ?? 'text',
					requesterId: userId,
					clientMessageId,
				});

				ackMessage(socket, clientMessageId, {
					status: 'saved',
					chatId,
					messageId: saved.id,
					createdAt: saved.createdAt,
				});

				console.log(`💬[SupportChat]: User message sent to chat ${chatId} and saved`);

			} catch (error: any) {
				console.error('❌[SupportChat]: Error sending user message:', error);
				// Nothing was stored, so the sender must be told which bubble to remove.
				ackMessage(socket, clientMessageId, {
					status: 'failed',
					chatId,
					code: error.message === 'TICKET_NOT_FOUND' ? 'TICKET_NOT_FOUND' : 'SEND_MESSAGE_ERROR',
				});
				socket.emit('error', {
					message: 'Failed to send message',
					code: 'SEND_MESSAGE_ERROR',
					details: error.message,
					context: { chatId, operation: 'user_send_message' },
					timestamp: new Date().toISOString(),
				});
			}
		});

		socket.on('user_join_chat', ({ chatId }: any) => {
			const userId = requireUser(socket, 'user_join_chat');
			if (!userId) return;

			try {
				if (!chatId) {
					console.error('❌[SupportChat]: Missing parameters for user_join_chat');
					socket.emit('error', { message: 'Missing required parameters' });
					return;
				}

				webSocketService.joinSupportChatRoom(socket.id, chatId, userId, 'user');
				console.log(`💬[SupportChat]: User ${userId} joined support chat ${chatId}`);

			} catch (error: any) {
				console.error('❌[SupportChat]: Error joining support chat:', error);
				socket.emit('error', {
					message: 'Failed to join support chat',
					code: 'JOIN_CHAT_ERROR',
					details: error.message,
				});
			}
		});

		socket.on('user_typing', ({ chatId, isTyping }: any) => {
			const userId = socket.data.userId;
			try {
				if (!chatId || !userId) {
					console.error('❌[SupportChat]: Missing parameters for user_typing');
					return;
				}

				webSocketService.broadcastSupportChatTyping(chatId, userId, 'user', isTyping);

			} catch (error) {
				console.error('❌[SupportChat]: Error handling typing indicator:', error);
			}
		});

		// Persists as well as announcing. This used to broadcast only, so a read receipt
		// sent over the socket was forgotten the moment the counterpart reloaded, and
		// support_messages.is_read stayed false until someone happened to call the REST
		// route. The service now owns the broadcast, so this handler just records it.
		socket.on('user_read_messages', async ({ chatId }: any) => {
			const userId = requireUser(socket, 'user_read_messages');
			if (!userId) return;

			try {
				if (!chatId) {
					console.error('❌[SupportChat]: Missing parameters for user_read_messages');
					return;
				}

				await supportChatService.markMessagesAsRead(chatId, userId);

			} catch (error: any) {
				console.error('❌[SupportChat]: Error handling read receipt:', error);
			}
		});

		socket.on('admin_join_chat', ({ chatId }: any) => {
			const adminId = requireAdmin(socket, 'admin_join_chat');
			if (!adminId) return;

			try {
				if (!chatId) {
					console.error('❌[SupportChat]: Missing parameters for admin_join_chat');
					socket.emit('error', { message: 'Missing required parameters' });
					return;
				}

				webSocketService.addSupportChatUser(socket.id, adminId, 'admin');
				webSocketService.joinSupportChatRoom(socket.id, chatId, adminId, 'admin');

				console.log(`👑[SupportChat]: Admin ${adminId} joined support chat ${chatId}`);

			} catch (error: any) {
				console.error('❌[SupportChat]: Error admin joining chat:', error);
				socket.emit('error', {
					message: 'Failed to join support chat',
					code: 'ADMIN_JOIN_ERROR',
					details: error.message,
				});
			}
		});

		socket.on('admin_join_all', () => {
			const adminId = requireAdmin(socket, 'admin_join_all');
			if (!adminId) return;

			try {
				webSocketService.addSupportChatUser(socket.id, adminId, 'admin');
				webSocketService.joinAdminRoom(socket.id, adminId);
				webSocketService.broadcastAdminStatusChange(adminId, true);

				console.log(`👑[SupportChat]: Admin ${adminId} joined all notification rooms`);

			} catch (error: any) {
				console.error('❌[SupportChat]: Error admin joining all:', error);
				socket.emit('error', {
					message: 'Failed to join admin rooms',
					code: 'ADMIN_JOIN_ALL_ERROR',
					details: error.message,
				});
			}
		});

		socket.on('admin_send_message', async ({ chatId, message, clientMessageId, messageType, _messageType }: any) => {
			const adminId = requireAdmin(socket, 'admin_send_message');
			if (!adminId) return;

			try {
				if (!chatId || !message) {
					console.error('❌[SupportChat]: Missing required fields for admin_send_message');
					socket.emit('error', {
						message: 'Missing required message fields',
						code: 'MISSING_PARAMETERS',
						context: { chatId, adminId },
						timestamp: new Date().toISOString(),
					});
					return;
				}

				// Same reason as user_send_message: an admin replying from a chat list they
				// never explicitly opened would otherwise not see their own reply arrive.
				webSocketService.joinSupportChatRoom(socket.id, chatId, adminId, 'admin');

				const saved = await supportChatService.sendMessage({
					ticketId: chatId,
					senderId: adminId,
					content: message,
					messageType: messageType ?? _messageType ?? 'text',
					clientMessageId,
				});

				ackMessage(socket, clientMessageId, {
					status: 'saved',
					chatId,
					messageId: saved.id,
					createdAt: saved.createdAt,
				});

				console.log(`👑[SupportChat]: Admin message sent to chat ${chatId} and saved`);

			} catch (error: any) {
				console.error('❌[SupportChat]: Error sending admin message:', error);
				ackMessage(socket, clientMessageId, {
					status: 'failed',
					chatId,
					code: 'SEND_MESSAGE_ERROR',
				});
				socket.emit('error', {
					message: 'Failed to send message',
					code: 'SEND_MESSAGE_ERROR',
					details: error.message,
					context: { chatId, adminId, operation: 'admin_send_message' },
					timestamp: new Date().toISOString(),
				});
			}
		});

		socket.on('admin_typing', ({ chatId, isTyping }: any) => {
			const adminId = socket.data.role === 'admin' ? socket.data.userId : null;
			try {
				if (!chatId || !adminId) {
					console.error('❌[SupportChat]: Missing parameters for admin_typing');
					return;
				}

				webSocketService.broadcastSupportChatTyping(chatId, adminId, 'admin', isTyping);

			} catch (error) {
				console.error('❌[SupportChat]: Error handling admin typing:', error);
			}
		});

		// Persists as well as announcing, mirroring PATCH /chats/:chatId/status. Before,
		// the two disagreed: the REST route wrote the status without telling anyone and
		// this event told everyone without writing it, so the ticket's state depended on
		// which one the admin panel happened to call.
		socket.on('admin_status_update', async ({ chatId, status }: any) => {
			const adminId = requireAdmin(socket, 'admin_status_update');
			if (!adminId) return;

			try {
				if (!chatId || !status) {
					console.error('❌[SupportChat]: Missing parameters for admin_status_update');
					socket.emit('error', { message: 'Missing required parameters' });
					return;
				}

				await supportChatService.updateChatStatus(chatId, status, adminId);
				console.log(`👑[SupportChat]: Admin ${adminId} updated chat ${chatId} status to ${status}`);

			} catch (error: any) {
				console.error('❌[SupportChat]: Error updating chat status:', error);
				socket.emit('error', {
					message: error.message === 'INVALID_STATUS'
						? 'Status must be one of: open, in_progress, resolved, closed'
						: 'Failed to update chat status',
					code: error.message === 'INVALID_STATUS' ? 'INVALID_STATUS' : 'STATUS_UPDATE_ERROR',
					details: error.message,
				});
			}
		});

		// Replaces the io.emit('getUsers') that fired on every connect and disconnect:
		// that pushed the whole presence list to every socket, so one page reload cost
		// O(connected²) writes. Whoever needs the list now asks for it.
		socket.on('getUsers', () => {
			socket.emit('getUsers', webSocketService.getChatUsers());
		});

		socket.on('disconnect', (reason: any) => {
			try {
				webSocketService.removeChatUser(socket.id, socket.data.userId || '');
				webSocketService.removeSupportChatUser(socket.id, socket.data.userId || '', 'user');

				console.log(`💬[Chat]: Client disconnected - ${socket.id}`, { reason });

			} catch (error: any) {
				console.error('❌[Chat]: Error handling disconnect:', {
					error: error.message,
					stack: error.stack,
					socketId: socket.id,
					reason,
				});
			}
		});
	});
};

export default { socket };
