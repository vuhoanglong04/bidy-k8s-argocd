import { AppDataSource } from '../../database/data-source.js';
import { SupportTicket } from './entity/support-ticket.entity.js';
import { SupportMessage } from './entity/support-message.entity.js';
import supportChatWebSocketService from './support-chat-websocket.service.js';
import { logger } from '../../common/util/logger.js';
import { fileService } from '../file/file.provider.js';
import { SupportTicketStatus, SUPPORT_TICKET_STATUSES } from './enum/support-ticket-status.enum.js';

/**
 * Opens the caller's support chat, or hands back the one already open.
 *
 * Idempotent under concurrency, not just on paper: the find-then-insert below is a
 * check-then-act, so two starts arriving together (the REST route and the socket event,
 * a double-tapped button, a client retry) can both find nothing and both insert. The
 * uq_support_tickets_user_open partial index makes the loser of that race fail instead
 * of duplicating, and the insert is committed under that constraint before the winner
 * is read back. Returning the existing row on 23505 is what turns the constraint from
 * an error the caller sees into the idempotency the caller asked for.
 */
export const startOrGetUserChat = async (userId: string, subject: string) => {
  const ticketRepo = AppDataSource.getRepository(SupportTicket);
  const findOpen = () => ticketRepo.findOne({
    where: { userId: userId, status: SupportTicketStatus.OPEN },
    relations: { user: true, admin: true },
  });

  let ticket = await findOpen();

  if (!ticket) {
    try {
      const created = ticketRepo.create({ userId: userId, subject, status: SupportTicketStatus.OPEN });
      await ticketRepo.save(created);
    } catch (error: any) {
      // 23505 = unique_violation. Someone else opened the ticket between the read and
      // the insert; their row is the one open ticket, so adopt it. Any other failure is
      // a real error and must not be swallowed into a misleading null.
      if (error?.code !== '23505') throw error;
    }
    ticket = await findOpen();
    // The row is guaranteed to exist here — either this call inserted it or the race
    // winner did — unless it was closed in the same instant. Treating that as an error
    // is better than returning a half-built object the caller would read fields off.
    if (!ticket) throw new Error('TICKET_NOT_FOUND');
  }

  return { ...ticket, user: await publicUser(ticket.user), admin: await publicUser(ticket.admin) };
};

/**
 * The participant fields a chat bubble needs, and nothing else.
 *
 * Loading a `user` relation hands back the whole row — email, account state, lock
 * reason — and returning it verbatim puts all of that in a payload the counterpart
 * can read. That is how the auction payloads once leaked bidder PII; the same rule
 * applies here, and it matters more on the user-facing routes, where the
 * counterpart is an admin.
 */
const publicUser = async (user: any) =>
  user
    ? {
        id: user.id,
        username: user.username,
        fullname: user.fullname,
        avatarUrl: await fileService.urlOf(user.avatarFile),
      }
    : null;

/**
 * For the admin views, which legitimately see a user's contact details. Same avatar
 * treatment, and the raw file row is dropped: it carries a bucket key, which is not
 * something a client can render or should hold.
 */
const withAvatarUrl = async (user: any) => {
  if (!user) return null;
  const { avatarFile, ...rest } = user;
  return { ...rest, avatarUrl: await fileService.urlOf(avatarFile) };
};

/**
 * The caller's open ticket, seeded with the most recent page of its messages.
 *
 * The messages used to come from a `messages` relation on the findOne, which was wrong
 * twice over. It had no ORDER BY, so the rows arrived in whatever order Postgres chose
 * — observed newest-first on one ticket and not chronological at all — and it was
 * unbounded, so a ticket that had been open for months would ship its entire history in
 * one response.
 *
 * Delegating to getChatMessages instead of ordering and slicing here keeps one
 * implementation of "a page of this ticket's history": same DESC-by-page ordering, same
 * oldest-first rows within the page, same senderType, same PII filtering.
 */
export const getUserActiveChat = async (userId: string, limit = 30) => {
  const ticketRepo = AppDataSource.getRepository(SupportTicket);
  const ticket = await ticketRepo.findOne({
    where: { userId: userId, status: SupportTicketStatus.OPEN },
    relations: { user: true, admin: true },
    order: { createdAt: 'DESC' }
  });
  if (!ticket) return null;

  const history = await getChatMessages(ticket.id, 1, limit, userId);

  return {
    ...ticket,
    user: await publicUser(ticket.user),
    admin: await publicUser(ticket.admin),
    messages: history.messages,
    // So a caller seeding its list from here knows whether to offer "load older"
    // without having to call the messages endpoint just to find out.
    hasMoreMessages: history.hasMore,
    totalMessages: history.totalMessages,
  };
};

export const assertTicketAccess = async (ticketId: string, requesterId?: string) => {
  if (requesterId === undefined) return;

  const ticketRepo = AppDataSource.getRepository(SupportTicket);
  const ticket = await ticketRepo.findOne({ where: { id: ticketId } });

  if (!ticket || String(ticket.userId) !== String(requesterId)) {
    throw new Error('TICKET_NOT_FOUND');
  }
};

export const sendMessage = async (data: { ticketId: string, senderId: string, content: string, messageType?: string, metadata?: Record<string, unknown>, requesterId?: string, clientMessageId?: string }) => {
  // The ticket is read here rather than through assertTicketAccess because the same row
  // answers two questions: whether the requester owns it, and whether the sender is the
  // ticket's user or an admin. Deriving senderType from the ticket is what makes it
  // trustworthy — a client cannot claim to be the admin, and it stays correct when a
  // second admin replies to a ticket the first one is looking at. A recipient comparing
  // senderId against its own id gets that case wrong.
  const ticketRepo = AppDataSource.getRepository(SupportTicket);
  const ticket = await ticketRepo.findOne({ where: { id: data.ticketId } });

  // Admin paths pass no requesterId, but a message still cannot be attached to a ticket
  // that does not exist — that used to create rows no conversation would ever show.
  if (!ticket) throw new Error('TICKET_NOT_FOUND');
  if (data.requesterId !== undefined && String(ticket.userId) !== String(data.requesterId)) {
    throw new Error('TICKET_NOT_FOUND');
  }

  const senderType = String(ticket.userId) === String(data.senderId) ? 'user' : 'admin';

  const msgRepo = AppDataSource.getRepository(SupportMessage);
  const msg = msgRepo.create({
    ticketId: data.ticketId,
    senderId: data.senderId,
    content: data.content,
    messageType: data.messageType || 'text',
    metadata: data.metadata ?? null,
    isRead: false
  });
  await msgRepo.save(msg);

  // Broadcast lives here rather than at the call sites: the socket handler, the user
  // REST route and the admin reply all funnel through this function, and a message
  // saved without being announced is invisible to the other side until a reload.
  // The row is already committed, so a socket failure must not fail the send.
  try {
    supportChatWebSocketService.broadcastSupportMessage({
      chatId: data.ticketId,
      messageId: msg.id,
      senderId: data.senderId,
      senderType,
      message: msg.content,
      messageType: msg.messageType,
      timestamp: msg.createdAt,
      // The counterpart's personal room, so a message reaches someone who has the app
      // open but is not sitting in this ticket's room. Without it the second channel in
      // broadcastSupportMessage never fired.
      receiverId: senderType === 'user' ? (ticket.adminId ?? undefined) : ticket.userId,
      // Echoed back untouched so the sender can match this record to the bubble it
      // rendered optimistically. Without it a client can only guess by content, and
      // the same text sent twice collapses into one.
      clientMessageId: data.clientMessageId ?? null,
    });
  } catch (error: any) {
    logger.warn('[SupportChat] Message saved but not broadcast: ' + error.message);
  }

  return msg;
};

/**
 * A page of a ticket's history, newest page first.
 *
 * Ordered DESC because this is what a chat scrolling upwards needs: page 1 is the most
 * recent messages, page 2 the ones before those. Ordered ASC — as it was — page 1 is the
 * oldest message ever sent, so opening a chat at the latest message means first asking
 * how many pages exist and then requesting the last one, which races with every message
 * that arrives in between. Within the page the rows are returned oldest-first, so the
 * caller can render them top to bottom without reversing.
 */
export const getChatMessages = async (ticketId: string, page: number, limit: number, requesterId?: string) => {
  const ticketRepo = AppDataSource.getRepository(SupportTicket);
  const ticket = await ticketRepo.findOne({ where: { id: ticketId } });
  if (!ticket) throw new Error('TICKET_NOT_FOUND');
  if (requesterId !== undefined && String(ticket.userId) !== String(requesterId)) {
    throw new Error('TICKET_NOT_FOUND');
  }

  const msgRepo = AppDataSource.getRepository(SupportMessage);
  const skip = (page - 1) * limit;
  const [messages, total] = await msgRepo.findAndCount({
    where: { ticketId: ticketId },
    relations: { sender: true },
    order: { createdAt: 'DESC', id: 'DESC' },
    skip,
    take: limit
  });

  return {
    messages: await Promise.all(
      messages
        .slice()
        .reverse()
        .map(async (msg) => ({
          ...msg,
          // Same field, same meaning, same derivation as the socket broadcast. Without
          // it a client loading history has nothing to tell the two sides apart: the
          // message rows carry a senderId but not the ticket's owner to compare it to.
          senderType: String(ticket.userId) === String(msg.senderId) ? 'user' : 'admin',
          sender: await publicUser(msg.sender),
        })),
    ),
    totalPages: Math.ceil(total / limit),
    currentPage: page,
    totalMessages: total,
    hasMore: skip + messages.length < total,
  };
};

// ponytail: support_messages.is_read is a single boolean, so read state is per-ticket,
// not per-participant — whoever reads first clears it for both sides. Acceptable while
// support chats are strictly 1 user + 1 admin; add a support_message_reads join table
// if group tickets or per-user read receipts are ever needed.
export const markMessagesAsRead = async (ticketId: string, requesterId?: string, readerId?: string) => {
  await assertTicketAccess(ticketId, requesterId);

  const msgRepo = AppDataSource.getRepository(SupportMessage);
  await msgRepo.update({ ticketId, isRead: false }, { isRead: true });

  // Same reasoning as sendMessage: the broadcast belongs here, not at the call sites.
  // Read state was previously split in half — the REST route persisted without telling
  // the counterpart, and the socket event told the counterpart without persisting — so
  // whichever one the client used, the other side was wrong until a reload.
  const reader = readerId ?? requesterId;
  if (reader) {
    try {
      supportChatWebSocketService.broadcastSupportChatReadReceipt(ticketId, reader, []);
    } catch (error: any) {
      logger.warn('[SupportChat] Read state saved but not broadcast: ' + error.message);
    }
  }

  return true;
};

// Admin Service Methods
export const getAllSupportChats = async (page: number, limit: number, status?: string) => {
  const ticketRepo = AppDataSource.getRepository(SupportTicket);
  const skip = (page - 1) * limit;
  // The filter takes the same vocabulary as the column. Rejecting an unknown value
  // rather than quietly returning an empty page: a filter that matches nothing and a
  // filter that is misspelled look identical to the caller otherwise.
  if (status !== undefined && !SUPPORT_TICKET_STATUSES.includes(status as SupportTicketStatus)) {
    throw new Error('INVALID_STATUS');
  }
  const whereClause = status ? { status: status as SupportTicketStatus } : {};

  const [chats, total] = await ticketRepo.findAndCount({
    where: whereClause,
    relations: { user: true, admin: true },
    order: { updatedAt: 'DESC' },
    skip,
    take: limit
  });

  // One aggregate for the whole page rather than two queries per row. The admin list
  // needs a "last activity" time and a per-ticket unread badge, and neither is a column
  // on support_tickets: updatedAt moves when the status changes, not only when someone
  // writes, and /chats/unread-count is a single system-wide number that cannot be split
  // per row.
  //
  // ponytail: unread is counted as "messages from the ticket's own user that are still
  // unread", because support_messages.is_read is one boolean shared by both sides (see
  // markMessagesAsRead) — there is no per-participant read state to ask for. That
  // matches what the badge means to an admin, but it also means an admin marking a
  // ticket read clears the user's side too. A support_message_reads join table is the
  // fix if per-participant receipts are ever needed.
  const ids = chats.map((c) => c.id);
  const aggregates = ids.length
    ? await AppDataSource.query(
        `SELECT DISTINCT ON (m.ticket_id)
                m.ticket_id,
                m.id AS last_message_id,
                m.content AS last_message_content,
                m.sender_id AS last_message_sender_id,
                m.created_at AS last_message_at,
                m.message_type AS last_message_type,
                COUNT(*) FILTER (WHERE m.is_read = false AND m.sender_id = t.user_id) OVER (PARTITION BY m.ticket_id)::int AS unread_by_admin
         FROM support_messages m
         JOIN support_tickets t ON t.id = m.ticket_id
         WHERE m.ticket_id = ANY($1)
         ORDER BY m.ticket_id, m.created_at DESC, m.id DESC`,
        [ids],
      )
    : [];
  const byTicket = new Map(aggregates.map((row: any) => [String(row.ticket_id), row]));

  return {
    chats: await Promise.all(
      chats.map(async (chat) => {
        const agg: any = byTicket.get(String(chat.id));
        const lastMessage = agg?.last_message_id
          ? {
              id: String(agg.last_message_id),
              content: agg.last_message_content,
              message: agg.last_message_content,
              senderId: String(agg.last_message_sender_id),
              senderType: String(chat.userId) === String(agg.last_message_sender_id) ? 'user' : 'admin',
              messageType: agg.last_message_type || 'text',
              createdAt: agg.last_message_at,
            }
          : null;

        return {
          ...chat,
          user: await withAvatarUrl(chat.user),
          admin: await withAvatarUrl(chat.admin),
          // Null, not the ticket's createdAt: a ticket opened with no message yet has no
          // last activity, and inventing one sorts it among ticket that do.
          lastMessageAt: agg?.last_message_at ?? null,
          unreadByAdmin: agg?.unread_by_admin ?? 0,
          lastMessage,
        };
      }),
    ),
    totalPages: Math.ceil(total / limit),
    currentPage: page,
    totalChats: total,
    // Counts across every ticket, not just this page — a dashboard tile that only
    // counted the 20 rows on screen would be wrong. Keyed by the status values actually
    // present, because status is a free-form varchar with no enum behind it.
    statusCounts: await getStatusCounts(),
  };
};

/**
 * Per-status ticket count and unread total, for the admin dashboard tiles.
 *
 * Both numbers come from one grouped query over every ticket. Summing the current
 * page's unreadByAdmin instead gives an answer that is only correct while the whole
 * table fits on one page — the tiles describe the queue, not the rows on screen.
 *
 * count(DISTINCT t.id) rather than count(*): the LEFT JOIN produces one row per
 * message, so a ticket with nine messages would otherwise be counted nine times.
 * LEFT, not INNER, so a status whose tickets have no messages still reports its count.
 */
export const getStatusCounts = async (): Promise<Record<string, { count: number; unread: number }>> => {
  const rows = await AppDataSource.query(
    `SELECT t.status,
            count(DISTINCT t.id)::int AS count,
            count(m.id) FILTER (WHERE m.is_read = false AND m.sender_id = t.user_id)::int AS unread
     FROM support_tickets t
     LEFT JOIN support_messages m ON m.ticket_id = t.id
     GROUP BY t.status`,
  );
  return Object.fromEntries(rows.map((r: any) => [r.status, { count: r.count, unread: r.unread }]));
};

export const getUnreadCount = async () => {
  const msgRepo = AppDataSource.getRepository(SupportMessage);
  // Simplified logic, returns global unread count
  return msgRepo.count({ where: { isRead: false } });
};

export const getSupportChatDetails = async (ticketId: string) => {
   const ticketRepo = AppDataSource.getRepository(SupportTicket);
   const ticket = await ticketRepo.findOne({ where: { id: ticketId }, relations: { user: true, admin: true }});
   if (!ticket) return null;

   return {
     ...ticket,
     user: await withAvatarUrl(ticket.user),
     admin: await withAvatarUrl(ticket.admin),
   };
};

export const updateChatStatus = async (ticketId: string, status: string, adminId: string) => {
  // Checked here, not only in the DTO: admin_status_update arrives over the socket and
  // never passes through Express middleware, so a DTO alone would guard one of the two
  // ways in. The database CHECK constraint is the third layer, for anything that writes
  // the column directly.
  if (!SUPPORT_TICKET_STATUSES.includes(status as SupportTicketStatus)) {
    throw new Error('INVALID_STATUS');
  }

  const ticketRepo = AppDataSource.getRepository(SupportTicket);
  await ticketRepo.update({ id: ticketId }, { status: status as SupportTicketStatus, adminId: adminId });
  const ticket = await ticketRepo.findOne({ where: { id: ticketId }});

  // Broadcast here for the same reason as sendMessage and markMessagesAsRead: closing a
  // ticket from the admin panel used to persist silently, so the user sat in a chat the
  // server considered closed until they reloaded.
  try {
    supportChatWebSocketService.broadcastSupportChatStatusUpdate(ticketId, status, adminId);
  } catch (error: any) {
    logger.warn('[SupportChat] Status saved but not broadcast: ' + error.message);
  }

  return ticket;
};

export default {
  startOrGetUserChat,
  getUserActiveChat,
  assertTicketAccess,
  sendMessage,
  getChatMessages,
  markMessagesAsRead,
  getAllSupportChats,
  getStatusCounts,
  getUnreadCount,
  getSupportChatDetails,
  updateChatStatus
};
