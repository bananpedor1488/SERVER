const mongoose = require('mongoose');

const postSchema = new mongoose.Schema({
  author: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  content: {
    type: String,
    required: true,
    maxlength: 280
  },
  files: [{
    filename: String,
    originalName: String,
    mimetype: String,
    size: Number,
    data: String, // base64 данные файла
    url: String   // для обратной совместимости
  }],
  likes: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  repostsCount: {
    type: Number,
    default: 0
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

// Индексы для производительности
postSchema.index({ author: 1, createdAt: -1 });
postSchema.index({ createdAt: -1 });

// Виртуальное поле для подсчета лайков
postSchema.virtual('likesCount').get(function() {
  return this.likes ? this.likes.length : 0;
});

// Виртуальное поле для подсчета комментариев
postSchema.virtual('commentsCount', {
  ref: 'Comment',
  localField: '_id',  
  foreignField: 'post',
  count: true
});

// Настройки для включения виртуальных полей при сериализации
postSchema.set('toJSON', { virtuals: true });
postSchema.set('toObject', { virtuals: true });

module.exports = mongoose.model('Post', postSchema);