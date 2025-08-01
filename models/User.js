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
}, { timestamps: true });

module.exports = mongoose.model('User', UserSchema);
