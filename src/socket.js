const { Server } = require('socket.io');
const cookie = require('cookie');
const { verifyToken } = require('./utils/jwt');
const Message = require('./models/message.model');
const Conversation = require('./models/conversation.model');
const User = require('./models/users/user.model');

/**
 * Attaches Socket.io to the given HTTP server and wires up chat events.
 * @param {import('http').Server} httpServer
 * @param {string[]} allowedOrigins
 */
function attachSocketServer(httpServer, allowedOrigins) {
  const io = new Server(httpServer, {
    cors: {
      origin: allowedOrigins,
      credentials: true,
    },
  });

  // ── Auth middleware: parse the accessToken cookie ─────────────────────────
  io.use((socket, next) => {
    try {
      const rawCookies = socket.handshake.headers.cookie || '';
      const cookies = cookie.parse(rawCookies);
      const token = cookies.accessToken;
      if (!token) return next(new Error('Authentication required'));
      const decoded = verifyToken(token);
      socket.userId = decoded.sub;
      next();
    } catch {
      next(new Error('Invalid or expired token'));
    }
  });

  // Track online users:  userId -> Set of socketIds
  const onlineUsers = new Map();

  io.on('connection', (socket) => {
    const userId = socket.userId;

    // Register online presence
    if (!onlineUsers.has(userId)) onlineUsers.set(userId, new Set());
    onlineUsers.get(userId).add(socket.id);
    io.emit('user_status', { userId, online: true });

    // ── Join a conversation room ───────────────────────────────────────────
    socket.on('join_conversation', async (conversationId) => {
      try {
        const conversation = await Conversation.findById(conversationId);
        if (!conversation) return socket.emit('error', { msg: 'Conversation not found' });

        const isMember = conversation.participants.some((p) => p.toString() === userId);
        if (!isMember) return socket.emit('error', { msg: 'Access denied' });

        socket.join(conversationId);
      } catch {
        socket.emit('error', { msg: 'Failed to join conversation' });
      }
    });

    // ── Send a message ─────────────────────────────────────────────────────
    socket.on('send_message', async ({ conversationId, text }) => {
      try {
        if (!text || !text.trim()) return;

        const conversation = await Conversation.findById(conversationId);
        if (!conversation) return socket.emit('error', { msg: 'Conversation not found' });

        const isMember = conversation.participants.some((p) => p.toString() === userId);
        if (!isMember) return socket.emit('error', { msg: 'Access denied' });

        const message = await Message.create({
          conversationId,
          senderId: userId,
          text: text.trim(),
        });

        // Update last message metadata
        conversation.lastMessage = {
          text: message.text,
          senderId: userId,
          sentAt: message.createdAt,
        };
        await conversation.save();

        // Broadcast to everyone in the room (including sender)
        const sender = await User.findById(userId).select('name');
        io.to(conversationId).emit('new_message', {
          id: message._id,
          conversationId,
          senderId: userId,
          senderName: sender?.name || 'Someone',
          text: message.text,
          createdAt: message.createdAt,
        });
      } catch {
        socket.emit('error', { msg: 'Failed to send message' });
      }
    });

    // ── Typing indicators ─────────────────────────────────────────────────
    socket.on('typing_start', ({ conversationId }) => {
      socket.to(conversationId).emit('typing_start', { userId, conversationId });
    });

    socket.on('typing_stop', ({ conversationId }) => {
      socket.to(conversationId).emit('typing_stop', { userId, conversationId });
    });

    // ── Disconnect ────────────────────────────────────────────────────────
    socket.on('disconnect', () => {
      const sockets = onlineUsers.get(userId);
      if (sockets) {
        sockets.delete(socket.id);
        if (sockets.size === 0) {
          onlineUsers.delete(userId);
          io.emit('user_status', { userId, online: false });
        }
      }
    });
  });

  return io;
}

module.exports = { attachSocketServer };
