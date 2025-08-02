const express = require('express');
const mongoose = require('mongoose');
const Chat = require('../models/Chat');
const Message = require('../models/Message');
const User = require('../models/User');
const router = express.Router();

// Middleware проверки авторизации
const isAuth = (req, res, next) => {
  if (!req.session.user) return res.status(401).json({ message: 'Not authorized' });
  next();
};

// Получить все чаты пользователя
router.get('/chats', isAuth, async (req, res) => {
  try {
    const userId = req.session.user.id;

    const chats = await Chat.find({ 
      participants: userId 
    })
    .populate({
      path: 'participants',
      select: 'username displayName avatar'
    })
    .populate({
      path: 'lastMessage',
      populate: {
        path: 'sender',
        select: 'username'
      }
    })
    .sort({ lastActivity: -1 })
    .lean();

    // Форматируем чаты для фронтенда
    const formattedChats = chats.map(chat => {
      const otherParticipant = chat.participants.find(p => p._id.toString() !== userId);
      const unreadCount = chat.unreadCount?.find(u => u.user.toString() === userId)?.count || 0;

      return {
        _id: chat._id,
        type: chat.type,
        name: chat.type === 'private' ? otherParticipant?.username : chat.name,
        participants: chat.participants,
        otherParticipant: otherParticipant,
        lastMessage: chat.lastMessage,
        lastActivity: chat.lastActivity,
        unreadCount: unreadCount,
        createdAt: chat.createdAt
      };
    });

    res.json(formattedChats);
  } catch (error) {
    console.error('Error fetching chats:', error);
    res.status(500).json({ message: 'Error fetching chats' });
  }
});

// Создать новый чат или найти существующий
router.post('/chats', isAuth, async (req, res) => {
  try {
    const { participantId } = req.body;
    const userId = req.session.user.id;

    if (!participantId) {
      return res.status(400).json({ message: 'Participant ID is required' });
    }

    if (participantId === userId) {
      return res.status(400).json({ message: 'Cannot create chat with yourself' });
    }

    // Проверяем, существует ли пользователь
    const participant = await User.findById(participantId);
    if (!participant) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Проверяем, есть ли уже чат между этими пользователями
    const existingChat = await Chat.findOne({
      type: 'private',
      participants: { $all: [userId, participantId] }
    })
    .populate('participants', 'username displayName avatar')
    .populate({
      path: 'lastMessage',
      populate: {
        path: 'sender',
        select: 'username'
      }
    });

    if (existingChat) {
      const otherParticipant = existingChat.participants.find(p => p._id.toString() !== userId);
      const unreadCount = existingChat.unreadCount?.find(u => u.user.toString() === userId)?.count || 0;

      return res.json({
        _id: existingChat._id,
        type: existingChat.type,
        name: otherParticipant.username,
        participants: existingChat.participants,
        otherParticipant: otherParticipant,
        lastMessage: existingChat.lastMessage,
        lastActivity: existingChat.lastActivity,
        unreadCount: unreadCount,
        createdAt: existingChat.createdAt
      });
    }

    // Создаем новый чат
    const newChat = await Chat.create({
      participants: [userId, participantId],
      type: 'private'
    });

    const populatedChat = await Chat.findById(newChat._id)
      .populate('participants', 'username displayName avatar');

    const otherParticipant = populatedChat.participants.find(p => p._id.toString() !== userId);

    const formattedChat = {
      _id: populatedChat._id,
      type: populatedChat.type,
      name: otherParticipant.username,
      participants: populatedChat.participants,
      otherParticipant: otherParticipant,
      lastMessage: null,
      lastActivity: populatedChat.lastActivity,
      unreadCount: 0,
      createdAt: populatedChat.createdAt
    };

    // Отправляем уведомление через Socket.IO обоим участникам
    const io = req.app.get('io');
    
    // Уведомляем создателя чата
    io.to(`user_${userId}`).emit('chatCreated', formattedChat);
    
    // Уведомляем второго участника о новом чате
    const participantFormattedChat = {
      ...formattedChat,
      name: req.session.user.username // Для второго участника имя чата - это имя создателя
    };
    io.to(`user_${participantId}`).emit('newChat', participantFormattedChat);

    res.status(201).json(formattedChat);
  } catch (error) {
    console.error('Error creating chat:', error);
    res.status(500).json({ message: 'Error creating chat' });
  }
});

// Получить сообщения чата
router.get('/chats/:chatId/messages', isAuth, async (req, res) => {
  try {
    const { chatId } = req.params;
    const userId = req.session.user.id;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 50;
    const skip = (page - 1) * limit;

    // Проверяем, является ли пользователь участником чата
    const chat = await Chat.findById(chatId);
    if (!chat || !chat.participants.includes(userId)) {
      return res.status(403).json({ message: 'Access denied' });
    }

    // Получаем сообщения
    const messages = await Message.find({ chat: chatId })
      .populate('sender', 'username')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean();

    // Отмечаем сообщения как прочитанные
    const unreadMessages = await Message.find({
      chat: chatId, 
      sender: { $ne: userId },
      'readBy.user': { $ne: userId }
    });

    if (unreadMessages.length > 0) {
      await Message.updateMany(
        { 
          chat: chatId, 
          sender: { $ne: userId },
          'readBy.user': { $ne: userId }
        },
        { 
          $push: { 
            readBy: { 
              user: userId, 
              readAt: new Date() 
            } 
          } 
        }
      );

      // Уведомляем других участников о прочтении
      const io = req.app.get('io');
      chat.participants.forEach(participantId => {
        if (participantId.toString() !== userId) {
          io.to(`user_${participantId}`).emit('messagesRead', {
            chatId: chatId,
            readBy: userId,
            readByUsername: req.session.user.username
          });
        }
      });
    }

    // Сбрасываем счетчик непрочитанных сообщений
    await Chat.findByIdAndUpdate(chatId, {
      $set: {
        'unreadCount.$[elem].count': 0
      }
    }, {
      arrayFilters: [{ 'elem.user': userId }]
    });

    // Форматируем сообщения
    const formattedMessages = messages.reverse().map(message => ({
      _id: message._id,
      content: message.content,
      sender: message.sender,
      createdAt: message.createdAt,
      edited: message.edited,
      editedAt: message.editedAt,
      isRead: message.readBy.some(read => read.user.toString() !== userId.toString())
    }));

    res.json(formattedMessages);
  } catch (error) {
    console.error('Error fetching messages:', error);
    res.status(500).json({ message: 'Error fetching messages' });
  }
});

// Отправить сообщение
router.post('/chats/:chatId/messages', isAuth, async (req, res) => {
  try {
    const { chatId } = req.params;
    const { content } = req.body;
    const userId = req.session.user.id;

    if (!content || !content.trim()) {
      return res.status(400).json({ message: 'Message content is required' });
    }

    // Проверяем, является ли пользователь участником чата
    const chat = await Chat.findById(chatId).populate('participants', 'username');
    if (!chat || !chat.participants.some(p => p._id.toString() === userId)) {
      return res.status(403).json({ message: 'Access denied' });
    }

    // Создаем сообщение
    const message = await Message.create({
      chat: chatId,
      sender: userId,
      content: content.trim(),
      readBy: [{ user: userId }]
    });

    // Обновляем чат
    await Chat.findByIdAndUpdate(chatId, {
      lastMessage: message._id,
      lastActivity: new Date()
    });

    // Увеличиваем счетчик непрочитанных для других участников
    const otherParticipants = chat.participants.filter(p => p._id.toString() !== userId);
    for (const participant of otherParticipants) {
      const participantId = participant._id.toString();
      
      // Проверяем, есть ли уже запись о непрочитанных для этого пользователя
      const existingChat = await Chat.findById(chatId);
      const hasUnreadEntry = Array.isArray(existingChat.unreadCount) && existingChat.unreadCount.some(u => u.user.toString() === participantId);
      
              if (hasUnreadEntry) {
          // Безопасно инкрементируем счётчик
          await Chat.updateOne(
            { _id: chatId, 'unreadCount.user': participantId },
            { $inc: { 'unreadCount.$.count': 1 } }
          );
        } else {
          // Добавляем новую запись для участника
          await Chat.updateOne(
            { _id: chatId },
            { $push: { unreadCount: { user: participantId, count: 1 } } }
          );
        }
    }

    // Получаем полную информацию о сообщении
    const populatedMessage = await Message.findById(message._id)
      .populate('sender', 'username');

    const formattedMessage = {
      _id: populatedMessage._id,
      content: populatedMessage.content,
      sender: populatedMessage.sender,
      createdAt: populatedMessage.createdAt,
      edited: populatedMessage.edited,
      editedAt: populatedMessage.editedAt,
      isRead: false
    };

    // Отправляем real-time уведомления
    const io = req.app.get('io');
    
    // Уведомляем отправителя об успешной отправке
    io.to(`user_${userId}`).emit('messageSent', {
      chatId: chatId,
      message: formattedMessage
    });
    
    // Отправляем сообщение другим участникам чата
    otherParticipants.forEach(participant => {
      const participantId = participant._id.toString();
      io.to(`user_${participantId}`).emit('newMessage', {
        chatId: chatId,
        message: formattedMessage
      });
      
      // Обновляем список чатов с новым последним сообщением
      io.to(`user_${participantId}`).emit('chatUpdated', {
        chatId: chatId,
        lastMessage: formattedMessage,
        lastActivity: new Date(),
        unreadIncrement: 1
      });
    });

    // Обновляем список чатов для отправителя (без увеличения счетчика непрочитанных)
    io.to(`user_${userId}`).emit('chatUpdated', {
      chatId: chatId,
      lastMessage: formattedMessage,
      lastActivity: new Date(),
      unreadIncrement: 0
    });

    res.status(201).json(formattedMessage);
  } catch (error) {
    console.error('Error sending message:', error);
    res.status(500).json({ message: 'Error sending message' });
  }
});

// Отметить сообщения как прочитанные
router.put('/chats/:chatId/read', isAuth, async (req, res) => {
  try {
    const { chatId } = req.params;
    const userId = req.session.user.id;

    // Проверяем доступ к чату
    const chat = await Chat.findById(chatId);
    if (!chat || !chat.participants.includes(userId)) {
      return res.status(403).json({ message: 'Access denied' });
    }

    // Получаем количество непрочитанных сообщений перед обновлением
    const unreadCount = chat.unreadCount.find(u => u.user.toString() === userId)?.count || 0;

    // Отмечаем все сообщения как прочитанные
    await Message.updateMany(
      { 
        chat: chatId, 
        sender: { $ne: userId },
        'readBy.user': { $ne: userId }
      },
      { 
        $push: { 
          readBy: { 
            user: userId, 
            readAt: new Date() 
          } 
        } 
      }
    );

    // Сбрасываем счетчик непрочитанных
    await Chat.findByIdAndUpdate(chatId, {
      $set: {
        'unreadCount.$[elem].count': 0
      }
    }, {
      arrayFilters: [{ 'elem.user': userId }]
    });

    // Уведомляем других участников о прочтении
    const io = req.app.get('io');
    chat.participants.forEach(participantId => {
      if (participantId.toString() !== userId) {
        io.to(`user_${participantId}`).emit('messagesRead', {
          chatId: chatId,
          readBy: userId,
          readByUsername: req.session.user.username
        });
      }
    });

    // Уведомляем пользователя об обновлении счетчика
    io.to(`user_${userId}`).emit('unreadCountUpdated', {
      chatId: chatId,
      unreadCount: 0,
      totalUnreadDecrement: unreadCount
    });

    res.json({ message: 'Messages marked as read' });
  } catch (error) {
    console.error('Error marking messages as read:', error);
    res.status(500).json({ message: 'Error marking messages as read' });
  }
});

// Удалить сообщение
router.delete('/messages/:messageId', isAuth, async (req, res) => {
  try {
    const { messageId } = req.params;
    const userId = req.session.user.id;

    const message = await Message.findById(messageId);
    if (!message) {
      return res.status(404).json({ message: 'Message not found' });
    }

    // Проверяем, что пользователь - отправитель сообщения
    if (message.sender.toString() !== userId) {
      return res.status(403).json({ message: 'Access denied' });
    }

    const chatId = message.chat;
    await Message.findByIdAndDelete(messageId);

    // Получаем информацию о чате
    const chat = await Chat.findById(chatId).populate('participants', 'username');

    // Обновляем последнее сообщение чата, если удаленное было последним
    const chatInfo = await Chat.findById(chatId).populate('lastMessage');
    if (chatInfo.lastMessage && chatInfo.lastMessage._id.toString() === messageId) {
      const newLastMessage = await Message.findOne({ chat: chatId }).sort({ createdAt: -1 });
      await Chat.findByIdAndUpdate(chatId, {
        lastMessage: newLastMessage ? newLastMessage._id : null,
        lastActivity: newLastMessage ? newLastMessage.createdAt : new Date()
      });
    }

    // Отправляем уведомление об удалении всем участникам
    const io = req.app.get('io');
    chat.participants.forEach(participant => {
      io.to(`user_${participant._id}`).emit('messageDeleted', {
        chatId: chatId,
        messageId: messageId,
        deletedBy: userId,
        deletedByUsername: req.session.user.username
      });
    });

    res.json({ message: 'Message deleted successfully' });
  } catch (error) {
    console.error('Error deleting message:', error);
    res.status(500).json({ message: 'Error deleting message' });
  }
});

// Получить общее количество непрочитанных сообщений
router.get('/unread-count', isAuth, async (req, res) => {
  try {
    const userId = req.session.user.id;

    const chats = await Chat.find({ 
      participants: userId 
    }).select('unreadCount');

    let totalUnread = 0;
    chats.forEach(chat => {
      const userUnread = chat.unreadCount.find(u => u.user.toString() === userId);
      if (userUnread) {
        totalUnread += userUnread.count;
      }
    });

    res.json({ totalUnread });
  } catch (error) {
    console.error('Error getting unread count:', error);
    res.status(500).json({ message: 'Error getting unread count' });
  }
});

// Получить статус пользователя (онлайн/оффлайн)
router.get('/users/:userId/status', isAuth, async (req, res) => {
  try {
    const { userId } = req.params;
    const io = req.app.get('io');
    
    // Проверяем, подключен ли пользователь через Socket.IO
    const isOnline = io.sockets.sockets.size > 0 && 
      Array.from(io.sockets.sockets.values()).some(socket => socket.userId === userId);
    
    res.json({ 
      userId, 
      isOnline,
      lastSeen: isOnline ? new Date() : null 
    });
  } catch (error) {
    console.error('Error getting user status:', error);
    res.status(500).json({ message: 'Error getting user status' });
  }
});

// Обновить статус "печатает"
router.post('/chats/:chatId/typing', isAuth, async (req, res) => {
  try {
    const { chatId } = req.params;
    const { isTyping } = req.body;
    const userId = req.session.user.id;

    // Проверяем доступ к чату
    const chat = await Chat.findById(chatId);
    if (!chat || !chat.participants.includes(userId)) {
      return res.status(403).json({ message: 'Access denied' });
    }

    // Отправляем уведомление о статусе печати другим участникам
    const io = req.app.get('io');
    chat.participants.forEach(participantId => {
      if (participantId.toString() !== userId) {
        io.to(`user_${participantId}`).emit('userTyping', {
          chatId: chatId,
          userId: userId,
          username: req.session.user.username,
          isTyping: isTyping
        });
      }
    });

    res.json({ message: 'Typing status updated' });
  } catch (error) {
    console.error('Error updating typing status:', error);
    res.status(500).json({ message: 'Error updating typing status' });
  }
});

module.exports = router;