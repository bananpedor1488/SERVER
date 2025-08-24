const mongoose = require('mongoose');

const UserSchema = new mongoose.Schema({
  username:  { type: String, required: true, unique: true },
  email:     { type: String, required: true, unique: true },
  password:  { type: String, required: true },
  followers: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  following: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  
  // Новые поля профиля
  displayName: { type: String, maxlength: 50 }, // Отображаемое имя
  bio: { type: String, maxlength: 160 }, // Описание профиля
  avatar: { type: String }, // Base64 аватарка или URL
  
  // Онлайн статус и активность
  isOnline: { type: Boolean, default: false },
  lastSeen: { type: Date, default: Date.now },
  socketId: { type: String }, // Для отслеживания Socket.IO соединения
  
  // Система баллов
  points: { type: Number, default: 0 }, // Начальный баланс 0 баллов
  
  // Премиум система
  premium: { type: Boolean, default: false }, // Премиум статус
  premiumExpiresAt: { type: Date }, // Дата окончания премиума
  
  // Верификация email
  emailVerified: { type: Boolean, default: false }, // Статус верификации email
  emailVerificationCode: { type: String }, // Код подтверждения
  emailVerificationExpires: { type: Date }, // Время истечения кода
  
  // Отслеживание входа и сессий
  lastLogin: { type: Date }, // Последний вход
  lastLoginIP: { type: String }, // IP адрес последнего входа
  lastLoginUserAgent: { type: String }, // User Agent последнего входа
  sessions: [{
    sessionId: { type: String, required: true },
    device: { type: String },
    deviceType: { type: String, enum: ['desktop', 'mobile', 'tablet'] },
    browser: { type: String },
    os: { type: String },
    ip: { type: String },
    location: { type: String },
    userAgent: { type: String },
    lastActivity: { type: Date, default: Date.now },
    isCurrent: { type: Boolean, default: false },
    createdAt: { type: Date, default: Date.now }
  }]
}, { timestamps: true });

module.exports = mongoose.model('User', UserSchema);
