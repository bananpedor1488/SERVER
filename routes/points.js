const express = require('express');
const router = express.Router();
const Points = require('../models/Points');
const User = require('../models/User');

// Генерация уникального кода транзакции
const generateTransactionCode = () => {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 8);
  return `TXN-${timestamp}-${random}`.toUpperCase();
};

// Получить баланс пользователя
router.get('/balance', async (req, res) => {
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
router.get('/transactions', async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;

    const transactions = await Points.find({
      $or: [{ sender: req.user.id }, { recipient: req.user.id }]
    })
    .populate('sender', 'username displayName avatar premium')
    .populate('recipient', 'username displayName avatar premium')
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
router.post('/transfer', async (req, res) => {
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
      .populate('sender', 'username displayName avatar premium')
      .populate('recipient', 'username displayName avatar premium');

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
router.get('/leaderboard', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 10;
    
    const leaderboard = await User.find()
      .select('username displayName avatar points premium')
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
router.get('/transaction/:transactionCode', async (req, res) => {
  try {
    const { transactionCode } = req.params;

    const transaction = await Points.findOne({ transactionCode })
      .populate('sender', 'username displayName avatar premium')
      .populate('recipient', 'username displayName avatar premium');

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

// Купить премиум
router.post('/buy-premium', async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    const premiumCost = 300; // Стоимость премиума в баллах

    if (user.points < premiumCost) {
      return res.status(400).json({ message: 'Недостаточно баллов для покупки премиума' });
    }

    // Вычислить дату окончания премиума (30 дней)
    const premiumExpiresAt = new Date();
    premiumExpiresAt.setDate(premiumExpiresAt.getDate() + 30);

    // Обновить пользователя
    user.points -= premiumCost;
    user.premium = true;
    user.premiumExpiresAt = premiumExpiresAt;
    await user.save();

    // Создать транзакцию
    const transactionCode = generateTransactionCode();
    const transaction = new Points({
      transactionCode,
      sender: req.user.id,
      recipient: req.user.id, // Пользователь сам себе
      amount: premiumCost,
      description: 'Покупка премиума на 30 дней',
      type: 'premium',
      senderBalanceBefore: user.points + premiumCost,
      senderBalanceAfter: user.points,
      recipientBalanceBefore: user.points + premiumCost,
      recipientBalanceAfter: user.points
    });
    await transaction.save();

    res.json({
      message: 'Премиум успешно куплен',
      premium: {
        active: true,
        expiresAt: premiumExpiresAt
      },
      newBalance: user.points
    });

  } catch (error) {
    console.error('Error buying premium:', error);
    res.status(500).json({ message: 'Ошибка покупки премиума' });
  }
});

// Подарить премиум другому пользователю
router.post('/gift-premium', async (req, res) => {
  try {
    const { recipientUsername } = req.body;
    const premiumCost = 300; // Стоимость премиума в баллах

    if (!recipientUsername) {
      return res.status(400).json({ message: 'Укажите имя пользователя' });
    }

    const sender = await User.findById(req.user.id);
    const recipient = await User.findOne({ username: recipientUsername });

    if (!recipient) {
      return res.status(404).json({ message: 'Пользователь не найден' });
    }

    if (sender.points < premiumCost) {
      return res.status(400).json({ message: 'Недостаточно баллов для покупки премиума' });
    }

    // Вычислить дату окончания премиума (30 дней)
    const premiumExpiresAt = new Date();
    premiumExpiresAt.setDate(premiumExpiresAt.getDate() + 30);

    // Обновить получателя
    recipient.premium = true;
    recipient.premiumExpiresAt = premiumExpiresAt;
    await recipient.save();

    // Обновить отправителя
    sender.points -= premiumCost;
    await sender.save();

    // Создать транзакцию
    const transactionCode = generateTransactionCode();
    const transaction = new Points({
      transactionCode,
      sender: req.user.id,
      recipient: recipient._id,
      amount: premiumCost,
      description: `Подарок премиума пользователю @${recipientUsername}`,
      type: 'premium_gift',
      senderBalanceBefore: sender.points + premiumCost,
      senderBalanceAfter: sender.points,
      recipientBalanceBefore: recipient.points,
      recipientBalanceAfter: recipient.points
    });
    await transaction.save();

    res.json({
      message: `Премиум успешно подарен пользователю @${recipientUsername}`,
      newBalance: sender.points
    });

  } catch (error) {
    console.error('Error gifting premium:', error);
    res.status(500).json({ message: 'Ошибка дарения премиума' });
  }
});

// Получить информацию о премиуме
router.get('/premium-info', async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('premium premiumExpiresAt points');
    
    const now = new Date();
    const isPremiumActive = user.premium && user.premiumExpiresAt && user.premiumExpiresAt > now;
    
    // Если премиум истек, обновить статус
    if (user.premium && user.premiumExpiresAt && user.premiumExpiresAt <= now) {
      user.premium = false;
      user.premiumExpiresAt = null;
      await user.save();
    }

    res.json({
      premium: {
        active: isPremiumActive,
        expiresAt: user.premiumExpiresAt
      },
      points: user.points,
      premiumCost: 300
    });

  } catch (error) {
    console.error('Error fetching premium info:', error);
    res.status(500).json({ message: 'Ошибка получения информации о премиуме' });
  }
});

module.exports = router; 