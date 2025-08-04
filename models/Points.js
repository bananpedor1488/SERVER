const mongoose = require('mongoose');

const PointsSchema = new mongoose.Schema({
  // Уникальный код транзакции
  transactionCode: { 
    type: String, 
    required: true, 
    unique: true 
  },
  
  // Отправитель и получатель
  sender: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User', 
    required: true 
  },
  recipient: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User', 
    required: true 
  },
  
  // Сумма транзакции
  amount: { 
    type: Number, 
    required: true,
    min: 1 
  },
  
  // Тип транзакции
  type: { 
    type: String, 
    enum: ['transfer', 'reward', 'bonus', 'system', 'premium', 'premium_gift'],
    default: 'transfer'
  },
  
  // Описание транзакции
  description: { 
    type: String, 
    maxlength: 200 
  },
  
  // Статус транзакции
  status: { 
    type: String, 
    enum: ['pending', 'completed', 'failed', 'cancelled'],
    default: 'completed'
  },
  
  // Баланс отправителя до и после
  senderBalanceBefore: { type: Number, required: true },
  senderBalanceAfter: { type: Number, required: true },
  
  // Баланс получателя до и после
  recipientBalanceBefore: { type: Number, required: true },
  recipientBalanceAfter: { type: Number, required: true }
}, { 
  timestamps: true 
});

// Индексы для быстрого поиска
PointsSchema.index({ sender: 1, createdAt: -1 });
PointsSchema.index({ recipient: 1, createdAt: -1 });
PointsSchema.index({ transactionCode: 1 });

module.exports = mongoose.model('Points', PointsSchema); 