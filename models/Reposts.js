const mongoose = require('mongoose');

const repostSchema = new mongoose.Schema({
  originalPost: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Post',
    required: true
  },
  repostedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

// Индекс для предотвращения дублирования репостов
repostSchema.index({ originalPost: 1, repostedBy: 1 }, { unique: true });

// Индекс для быстрого поиска репостов пользователя
repostSchema.index({ repostedBy: 1, createdAt: -1 });

module.exports = mongoose.model('Repost', repostSchema);