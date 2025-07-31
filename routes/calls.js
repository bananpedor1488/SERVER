const express = require('express');
const mongoose = require('mongoose');
const Call = require('../models/Call');
const Chat = require('../models/Chat');
const User = require('../models/User');
const router = express.Router();

// Middleware проверки авторизации
const isAuth = (req, res, next) => {
  if (!req.session.user) return res.status(401).json({ message: 'Not authorized' });
  next();
};

// Инициировать звонок
router.post('/initiate', isAuth, async (req, res) => {
  try {
    const { chatId, type = 'audio' } = req.body;
    const callerId = req.session.user.id;

    if (!chatId) {
      return res.status(400).json({ message: 'Chat ID is required' });
    }

    // Проверяем существование чата и доступ
    const chat = await Chat.findById(chatId).populate('participants', 'username');
    if (!chat || !chat.participants.some(p => p._id.toString() === callerId)) {
      return res.status(403).json({ message: 'Access denied' });
    }

    // Находим собеседника
    const callee = chat.participants.find(p => p._id.toString() !== callerId);
    if (!callee) {
      return res.status(400).json({ message: 'Callee not found' });
    }

    // Проверяем, что пользователь не звонит сам себе
    if (callerId === callee._id.toString()) {
      return res.status(400).json({ message: 'Cannot call yourself' });
    }

    // Сначала очищаем старые "зависшие" звонки (старше 5 минут)
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
    await Call.updateMany({
      $or: [
        { caller: callerId, status: 'pending', createdAt: { $lt: fiveMinutesAgo } },
        { callee: callerId, status: 'pending', createdAt: { $lt: fiveMinutesAgo } },
        { caller: callee._id, status: 'pending', createdAt: { $lt: fiveMinutesAgo } },
        { callee: callee._id, status: 'pending', createdAt: { $lt: fiveMinutesAgo } }
      ]
    }, {
      status: 'missed',
      endedAt: new Date()
    });

    // Проверяем, нет ли активного звонка
    const activeCall = await Call.findOne({
      $or: [
        { caller: callerId, status: { $in: ['pending', 'accepted'] } },
        { callee: callerId, status: { $in: ['pending', 'accepted'] } },
        { caller: callee._id, status: { $in: ['pending', 'accepted'] } },
        { callee: callee._id, status: { $in: ['pending', 'accepted'] } }
      ]
    });

    if (activeCall) {
      console.log('Active call found:', activeCall);
      return res.status(409).json({ 
        message: 'User is already in a call',
        activeCallId: activeCall._id,
        status: activeCall.status
      });
    }

    // Создаем новый звонок
    const newCall = await Call.create({
      caller: callerId,
      callee: callee._id,
      chat: chatId,
      type: type
    });

    const populatedCall = await Call.findById(newCall._id)
      .populate('caller', 'username')
      .populate('callee', 'username')
      .populate('chat');

    // Отправляем уведомление через Socket.IO
    const io = req.app.get('io');
    
    // Уведомляем вызываемого пользователя
    io.to(`user_${callee._id}`).emit('incomingCall', {
      callId: populatedCall._id,
      caller: populatedCall.caller,
      type: populatedCall.type,
      chat: populatedCall.chat
    });

    // Уведомляем вызывающего пользователя
    io.to(`user_${callerId}`).emit('callInitiated', {
      callId: populatedCall._id,
      callee: populatedCall.callee,
      type: populatedCall.type,
      chat: populatedCall.chat
    });

    res.status(201).json({
      callId: populatedCall._id,
      status: 'initiated',
      callee: populatedCall.callee,
      type: populatedCall.type
    });
  } catch (error) {
    console.error('Error initiating call:', error);
    res.status(500).json({ message: 'Error initiating call' });
  }
});

// Принять звонок
router.post('/accept/:callId', isAuth, async (req, res) => {
  try {
    const { callId } = req.params;
    const userId = req.session.user.id;

    const call = await Call.findById(callId)
      .populate('caller', 'username')
      .populate('callee', 'username');

    if (!call) {
      return res.status(404).json({ message: 'Call not found' });
    }

    if (call.callee._id.toString() !== userId) {
      return res.status(403).json({ message: 'Access denied' });
    }

    if (call.status !== 'pending') {
      return res.status(400).json({ message: 'Call is not pending' });
    }

    // Обновляем статус звонка
    call.status = 'accepted';
    call.startedAt = new Date();
    await call.save();

    // Уведомляем обоих участников
    const io = req.app.get('io');
    
    io.to(`user_${call.caller._id}`).emit('callAccepted', {
      callId: call._id,
      acceptedBy: call.callee
    });

    io.to(`user_${call.callee._id}`).emit('callAccepted', {
      callId: call._id,
      acceptedBy: call.callee
    });

    res.json({
      callId: call._id,
      status: 'accepted',
      startedAt: call.startedAt
    });
  } catch (error) {
    console.error('Error accepting call:', error);
    res.status(500).json({ message: 'Error accepting call' });
  }
});

// Отклонить звонок
router.post('/decline/:callId', isAuth, async (req, res) => {
  try {
    const { callId } = req.params;
    const userId = req.session.user.id;

    const call = await Call.findById(callId)
      .populate('caller', 'username')
      .populate('callee', 'username');

    if (!call) {
      return res.status(404).json({ message: 'Call not found' });
    }

    if (call.callee._id.toString() !== userId) {
      return res.status(403).json({ message: 'Access denied' });
    }

    if (call.status !== 'pending') {
      return res.status(400).json({ message: 'Call is not pending' });
    }

    // Обновляем статус звонка
    call.status = 'declined';
    call.endedAt = new Date();
    await call.save();

    // Уведомляем вызывающего
    const io = req.app.get('io');
    
    io.to(`user_${call.caller._id}`).emit('callDeclined', {
      callId: call._id,
      declinedBy: call.callee
    });

    res.json({
      callId: call._id,
      status: 'declined'
    });
  } catch (error) {
    console.error('Error declining call:', error);
    res.status(500).json({ message: 'Error declining call' });
  }
});

// Завершить звонок
router.post('/end/:callId', isAuth, async (req, res) => {
  try {
    const { callId } = req.params;
    const userId = req.session.user.id;

    console.log(`Ending call ${callId} by user ${userId}`);

    const call = await Call.findById(callId)
      .populate('caller', 'username')
      .populate('callee', 'username');

    if (!call) {
      console.log('Call not found, might be already ended');
      return res.status(404).json({ message: 'Call not found' });
    }

    const isParticipant = call.caller._id.toString() === userId || 
                         call.callee._id.toString() === userId;

    if (!isParticipant) {
      return res.status(403).json({ message: 'Access denied' });
    }

    // Разрешаем завершение звонка в любом состоянии
    console.log(`Call status before ending: ${call.status}`);

    // Рассчитываем продолжительность
    const endTime = new Date();
    let duration = 0;
    
    if (call.startedAt) {
      duration = Math.floor((endTime - call.startedAt) / 1000);
    }

    // Обновляем статус звонка
    call.status = 'ended';
    call.endedAt = endTime;
    call.duration = duration;
    await call.save();

    console.log(`Call ${callId} ended successfully`);

    // Уведомляем обоих участников
    const io = req.app.get('io');
    
    const endedByUser = userId === call.caller._id.toString() ? call.caller : call.callee;
    
    io.to(`user_${call.caller._id}`).emit('callEnded', {
      callId: call._id,
      endedBy: endedByUser,
      duration: duration
    });

    io.to(`user_${call.callee._id}`).emit('callEnded', {
      callId: call._id,
      endedBy: endedByUser,
      duration: duration
    });

    res.json({
      callId: call._id,
      status: 'ended',
      duration: duration
    });
  } catch (error) {
    console.error('Error ending call:', error);
    res.status(500).json({ message: 'Error ending call' });
  }
});

// Получить историю звонков для чата
router.get('/history/:chatId', isAuth, async (req, res) => {
  try {
    const { chatId } = req.params;
    const userId = req.session.user.id;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;

    // Проверяем доступ к чату
    const chat = await Chat.findById(chatId);
    if (!chat || !chat.participants.includes(userId)) {
      return res.status(403).json({ message: 'Access denied' });
    }

    const calls = await Call.find({ chat: chatId })
      .populate('caller', 'username')
      .populate('callee', 'username')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean();

    res.json(calls);
  } catch (error) {
    console.error('Error fetching call history:', error);
    res.status(500).json({ message: 'Error fetching call history' });
  }
});

// Получить активный звонок пользователя
router.get('/active', isAuth, async (req, res) => {
  try {
    const userId = req.session.user.id;

    console.log(`Checking active call for user ${userId}`);

    const activeCall = await Call.findOne({
      $or: [
        { caller: userId, status: { $in: ['pending', 'accepted'] } },
        { callee: userId, status: { $in: ['pending', 'accepted'] } }
      ]
    })
    .populate('caller', 'username')
    .populate('callee', 'username')
    .populate('chat');

    if (activeCall) {
      console.log(`Found active call: ${activeCall._id} with status ${activeCall.status}`);
    } else {
      console.log('No active call found');
    }

    res.json(activeCall);
  } catch (error) {
    console.error('Error fetching active call:', error);
    res.status(500).json({ message: 'Error fetching active call' });
  }
});

// Принудительно завершить все активные звонки пользователя
router.post('/cleanup', isAuth, async (req, res) => {
  try {
    const userId = req.session.user.id;
    
    // Сначала находим все зависшие звонки для логирования
    const activeCallsToClean = await Call.find({
      $or: [
        { caller: userId, status: { $in: ['pending', 'accepted'] } },
        { callee: userId, status: { $in: ['pending', 'accepted'] } }
      ]
    }).populate('caller', 'username').populate('callee', 'username');

    if (activeCallsToClean.length > 0) {
      console.log(`🧹 Cleanup for user ${userId}:`);
      activeCallsToClean.forEach(call => {
        console.log(`  - Call ${call._id}: ${call.caller.username} -> ${call.callee.username} (${call.status}, ${call.type})`);
      });
    }
    
    // Обновляем статусы
    const result = await Call.updateMany({
      $or: [
        { caller: userId, status: { $in: ['pending', 'accepted'] } },
        { callee: userId, status: { $in: ['pending', 'accepted'] } }
      ]
    }, {
      status: 'ended',
      endedAt: new Date()
    });
    
    console.log(`✅ Cleanup completed: ${result.modifiedCount} calls ended`);
    
    res.json({ 
      message: result.modifiedCount > 0 ? 'Stuck calls cleaned up' : 'No stuck calls found',
      cleanedCount: result.modifiedCount,
      cleanedCalls: activeCallsToClean.map(call => ({
        id: call._id,
        from: call.caller.username,
        to: call.callee.username,
        status: call.status,
        type: call.type
      }))
    });
  } catch (error) {
    console.error('Error cleaning up calls:', error);
    res.status(500).json({ message: 'Error cleaning up calls' });
  }
});

module.exports = router;