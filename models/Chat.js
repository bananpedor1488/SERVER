const mongoose = require('mongoose');

const chatSchema = new mongoose.Schema({
  participants: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  }],
  type: {
    type: String,
    enum: ['private', 'group'],
    default: 'private'
  },
  name: {
    type: String,
    maxlength: 100
  },
  lastMessage: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Message'
  },
  lastActivity: {
    type: Date,
    default: Date.now
  },
  unreadCount: [{
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    count: {
      type: Number,
      default: 0
    }
  }]
}, {
  timestamps: true
});

// Индексы для производительности
chatSchema.index({ participants: 1 });
chatSchema.index({ lastActivity: -1 });
chatSchema.index({ 'participants': 1, 'type': 1 });

// Виртуальное поле для получения другого участника в приватном чате
chatSchema.virtual('otherParticipant').get(function() {
  if (this.type === 'private' && this.participants.length === 2) {
    return this.participants.find(p => p._id.toString() !== this.currentUserId);
  }
  return null;
});

// Метод для получения непрочитанных сообщений для пользователя
chatSchema.methods.getUnreadCountForUser = function(userId) {
  const userUnread = this.unreadCount.find(u => u.user.toString() === userId.toString());
  return userUnread ? userUnread.count : 0;
};

// Метод для сброса счетчика непрочитанных сообщений
chatSchema.methods.markAsReadForUser = function(userId) {
  const userUnread = this.unreadCount.find(u => u.user.toString() === userId.toString());
  if (userUnread) {
    userUnread.count = 0;
  }
};

// Метод для увеличения счетчика непрочитанных сообщений
chatSchema.methods.incrementUnreadForUser = function(userId) {
  let userUnread = this.unreadCount.find(u => u.user.toString() === userId.toString());
  if (!userUnread) {
    userUnread = { user: userId, count: 0 };
    this.unreadCount.push(userUnread);
  }
  userUnread.count += 1;
};

chatSchema.set('toJSON', { virtuals: true });

module.exports = mongoose.model('Chat', chatSchema);