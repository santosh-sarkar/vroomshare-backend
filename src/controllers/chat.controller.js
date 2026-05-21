const Conversation = require('../models/conversation.model');
const Message = require('../models/message.model');
const User = require('../models/users/user.model');

/**
 * GET /chat/conversations
 * Returns all conversations for the logged-in user, populated with
 * the other participant's name, avatar and the linked booking/vehicle data.
 */
async function getConversations(req, res) {
  const userId = req.user.sub;

  const conversations = await Conversation.find({ participants: userId })
    .sort({ updatedAt: -1 })
    .populate({ path: 'participants', select: 'name image' })
    .populate({
      path: 'bookingId',
      select: 'status totalPrice startDate endDate vehicle owner renter',
      populate: {
        path: 'vehicle',
        select: 'brand model year photos pickup pricing',
      },
    });

  const result = conversations.map((c) => {
    const other = c.participants.find((p) => p._id.toString() !== userId);
    const booking = c.bookingId ?? null;

    let trip = null;
    if (booking) {
      const v = booking.vehicle || {};
      const start = booking.startDate ? new Date(booking.startDate) : null;
      const end = booking.endDate ? new Date(booking.endDate) : null;
      const days = start && end ? Math.max(1, Math.ceil((end - start) / 86400000)) : null;

      trip = {
        bookingId: booking._id,
        vehicleTitle: [v.brand, v.model, v.year].filter(Boolean).join(' '),
        vehicleImage: v.photos?.[0] ?? null,
        dailyRate: v.pricing?.dailyRate ?? null,
        status: booking.status,
        totalPrice: booking.totalPrice,
        startDate: booking.startDate,
        endDate: booking.endDate,
        days,
        pickup: v.pickup ?? null,
        ownerId: booking.owner?.toString() ?? null,
        renterId: booking.renter?.toString() ?? null,
      };
    }

    return {
      id: c._id,
      name: other?.name ?? 'Unknown',
      img: other?.image?.profile ?? null,
      title: trip ? trip.vehicleTitle : '',
      text: c.lastMessage?.text ?? '',
      time: c.lastMessage?.sentAt
        ? formatTime(c.lastMessage.sentAt)
        : formatTime(c.updatedAt),
      online: false,
      otherUserId: other?._id,
      trip,
    };
  });

  return res.json({ ok: true, conversations: result });
}

/**
 * POST /chat/conversations
 * Body: { recipientId, bookingId? }
 * Creates a new conversation if one doesn't already exist for this
 * booking (or between these two users when no bookingId), otherwise
 * returns the existing one.
 */
async function getOrCreateConversation(req, res) {
  const userId = req.user.sub;
  const { recipientId, bookingId } = req.body;

  if (!recipientId) {
    return res.status(400).json({ ok: false, msg: 'recipientId is required' });
  }
  if (recipientId === userId) {
    return res.status(400).json({ ok: false, msg: 'Cannot start a conversation with yourself' });
  }

  const recipientExists = await User.exists({ _id: recipientId });
  if (!recipientExists) {
    return res.status(404).json({ ok: false, msg: 'Recipient not found' });
  }

  // Build query — scope to booking when provided, otherwise just participants
  const query = bookingId
    ? { participants: { $all: [userId, recipientId] }, bookingId }
    : { participants: { $all: [userId, recipientId] }, bookingId: null };

  let conversation = await Conversation.findOne(query);

  if (!conversation) {
    conversation = await Conversation.create({
      participants: [userId, recipientId],
      bookingId: bookingId ?? null,
    });
  }

  return res.json({ ok: true, conversationId: conversation._id });
}

/**
 * GET /chat/conversations/:id/messages
 * Returns paginated messages for a conversation the user participates in.
 */
async function getMessages(req, res) {
  const userId = req.user.sub;
  const { id } = req.params;
  const page = Math.max(1, parseInt(req.query.page) || 1);
  const limit = Math.min(100, parseInt(req.query.limit) || 50);

  const conversation = await Conversation.findById(id);
  if (!conversation) {
    return res.status(404).json({ ok: false, msg: 'Conversation not found' });
  }

  const isMember = conversation.participants.some((p) => p.toString() === userId);
  if (!isMember) {
    return res.status(403).json({ ok: false, msg: 'Access denied' });
  }

  const messages = await Message.find({ conversationId: id })
    .sort({ createdAt: -1 })
    .skip((page - 1) * limit)
    .limit(limit)
    .lean();

    messages.reverse(); // Return in chronological order

  // Mark messages sent to this user as read
  await Message.updateMany(
    { conversationId: id, senderId: { $ne: userId }, read: false },
    { read: true }
  );

  return res.json({ ok: true, messages });
}

/**
 * POST /chat/conversations/:id/messages  (REST fallback — Socket.io is preferred)
 * Body: { text }
 */
async function sendMessage(req, res) {
  const userId = req.user.sub;
  const { id } = req.params;
  const { text } = req.body;

  if (!text || !text.trim()) {
    return res.status(400).json({ ok: false, msg: 'Message text is required' });
  }

  const conversation = await Conversation.findById(id);
  if (!conversation) {
    return res.status(404).json({ ok: false, msg: 'Conversation not found' });
  }

  const isMember = conversation.participants.some((p) => p.toString() === userId);
  if (!isMember) {
    return res.status(403).json({ ok: false, msg: 'Access denied' });
  }

  const message = await Message.create({
    conversationId: id,
    senderId: userId,
    text: text.trim(),
  });

  conversation.lastMessage = { text: message.text, senderId: userId, sentAt: message.createdAt };
  await conversation.save();

  return res.status(201).json({ ok: true, message });
}

// ── helpers ──────────────────────────────────────────────────────────────────
function formatTime(date) {
  if (!date) return '';
  const d = new Date(date);
  const now = new Date();
  const diffDays = Math.floor((now - d) / 86400000);
  if (diffDays === 0) return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return d.toLocaleDateString([], { weekday: 'short' });
  return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
}

module.exports = { getConversations, getOrCreateConversation, getMessages, sendMessage };
