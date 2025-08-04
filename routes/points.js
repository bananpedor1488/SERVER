const express = require('express');
const router = express.Router();
const Points = require('../models/Points');
const User = require('../models/User');
const { isAuth } = require('../middleware/auth');

// Генерация уникального кода транзакции
const generateTransactionCode = () => {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 8);
  return `TXN-${timestamp}-${random}`.toUpperCase();
};

// Получить баланс пользователя
router.get('/balance', isAuth, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('points username displayName');
    res.json({ 
      points: user.points,
      username: user.username,
      displayName: user.displayName
    });
  } catch (error) {
    console.error('Error fetching balance:', error);
    res.status(500).json({ message: 'Ошибка получения баланса' });
  }
});

// Получить историю транзакций пользователя
router.get('/transactions', isAuth, async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;

    const transactions = await Points.find({
      $or: [{ sender: req.user.id }, { recipient: req.user.id }]
    })
    .populate('sender', 'username displayName avatar')
    .populate('recipient', 'username displayName avatar')
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit)
    .lean();

    const total = await Points.countDocuments({
      $or: [{ sender: req.user.id }, { recipient: req.user.id }]
    });

    const formattedTransactions = transactions.map(tx => ({
      ...tx,
      isOutgoing: tx.sender._id.toString() === req.user.id,
      isIncoming: tx.recipient._id.toString() === req.user.id
    }));

    res.json({
      transactions: formattedTransactions,
      pagination: {
        page,
        limit,
        total,
        hasMore: page * limit < total
      }
    });
  } catch (error) {
    console.error('Error fetching transactions:', error);
    res.status(500).json({ message: 'Ошибка получения истории транзакций' });
  }
});

// Перевести баллы другому пользователю
router.post('/transfer', isAuth, async (req, res) => {
  try {
    const { recipientUsername, amount, description } = req.body;

    if (!recipientUsername || !amount) {
      return res.status(400).json({ message: 'Необходимо указать получателя и сумму' });
    }

    if (amount <= 0) {
      return res.status(400).json({ message: 'Сумма должна быть больше 0' });
    }

    if (amount > 10000) {
      return res.status(400).json({ message: 'Максимальная сумма перевода: 10,000 баллов' });
    }

    // Найти получателя
    const recipient = await User.findOne({ username: recipientUsername });
    if (!recipient) {
      return res.status(404).json({ message: 'Пользователь не найден' });
    }

    if (recipient._id.toString() === req.user.id) {
      return res.status(400).json({ message: 'Нельзя переводить баллы самому себе' });
    }

    // Получить текущий баланс отправителя
    const sender = await User.findById(req.user.id);
    if (sender.points < amount) {
      return res.status(400).json({ message: 'Недостаточно баллов для перевода' });
    }

    // Создать транзакцию
    const transactionCode = generateTransactionCode();
    const transaction = new Points({
      transactionCode,
      sender: req.user.id,
      recipient: recipient._id,
      amount,
      description: description || `Перевод баллов пользователю @${recipientUsername}`,
      type: 'transfer',
      senderBalanceBefore: sender.points,
      senderBalanceAfter: sender.points - amount,
      recipientBalanceBefore: recipient.points,
      recipientBalanceAfter: recipient.points + amount
    });

    // Обновить балансы
    sender.points -= amount;
    recipient.points += amount;

    // Сохранить изменения в транзакции
    await transaction.save();
    await sender.save();
    await recipient.save();

    // Получить обновленные данные для ответа
    const populatedTransaction = await Points.findById(transaction._id)
      .populate('sender', 'username displayName avatar')
      .populate('recipient', 'username displayName avatar');

    res.json({
      message: 'Перевод выполнен успешно',
      transaction: {
        ...populatedTransaction.toObject(),
        isOutgoing: true,
        isIncoming: false
      },
      newBalance: sender.points
    });

  } catch (error) {
    console.error('Error transferring points:', error);
    res.status(500).json({ message: 'Ошибка выполнения перевода' });
  }
});

// Получить топ пользователей по баллам
router.get('/leaderboard', isAuth, async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 10;
    
    const leaderboard = await User.find()
      .select('username displayName avatar points')
      .sort({ points: -1 })
      .limit(limit)
      .lean();

    // Добавить позицию в рейтинге
    const leaderboardWithPosition = leaderboard.map((user, index) => ({
      ...user,
      position: index + 1
    }));

    res.json({ leaderboard: leaderboardWithPosition });
  } catch (error) {
    console.error('Error fetching leaderboard:', error);
    res.status(500).json({ message: 'Ошибка получения рейтинга' });
  }
});

// Получить детали конкретной транзакции
router.get('/transaction/:transactionCode', isAuth, async (req, res) => {
  try {
    const { transactionCode } = req.params;

    const transaction = await Points.findOne({ transactionCode })
      .populate('sender', 'username displayName avatar')
      .populate('recipient', 'username displayName avatar');

    if (!transaction) {
      return res.status(404).json({ message: 'Транзакция не найдена' });
    }

    // Проверить, что пользователь участвует в транзакции
    if (transaction.sender._id.toString() !== req.user.id && 
        transaction.recipient._id.toString() !== req.user.id) {
      return res.status(403).json({ message: 'Нет доступа к этой транзакции' });
    }

    const formattedTransaction = {
      ...transaction.toObject(),
      isOutgoing: transaction.sender._id.toString() === req.user.id,
      isIncoming: transaction.recipient._id.toString() === req.user.id
    };

    res.json({ transaction: formattedTransaction });
  } catch (error) {
    console.error('Error fetching transaction details:', error);
    res.status(500).json({ message: 'Ошибка получения деталей транзакции' });
  }
});

module.exports = router; 