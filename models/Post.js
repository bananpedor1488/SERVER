const mongoose = require('mongoose');

const postSchema = new mongoose.Schema({
  author: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  content: {
    type: String,
    required: function() {
      return !this.files || this.files.length === 0;
    },
    maxlength: 280
  },
  files: [{
    filename: String,
    originalName: String,
    mimetype: String,
    size: Number,
    url: String,           // URL ImgBB
    displayUrl: String,    // URL для отображения
    deleteUrl: String,     // URL для удаления
    fileName: String,      // Имя файла
    id: String,           // ID файла в ImgBB
    format: String        // Формат файла
  }],
  likes: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  repostsCount: {
    type: Number,
    default: 0
  },
  // Новые поля для интерактивных элементов
  postType: {
    type: String,
    enum: ['text', 'giveaway', 'poll', 'quiz'],
    default: 'text'
  },
  giveawayData: {
    prize: String,
    prizeType: {
      type: String,
      enum: ['text', 'balance', 'premium'],
      default: 'text'
    },
    prizeAmount: {
      type: Number,
      default: 0
    },
    description: String,
    endDate: Date,
    participants: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    }],
    winner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    isCompleted: {
      type: Boolean,
      default: false
    }
  },
  pollData: {
    question: String,
    options: [String],
    allowMultiple: {
      type: Boolean,
      default: false
    },
    endDate: Date,
    votes: {
      type: Map,
      of: [Number] // Массив индексов выбранных вариантов
    },
    isActive: {
      type: Boolean,
      default: true
    }
  },
  quizData: {
    question: String,
    options: [String],
    correctAnswer: {
      type: Number,
      min: 0,
      max: 3
    },
    explanation: String,
    attempts: {
      type: Map,
      of: Number // Индекс выбранного ответа
    },
    isActive: {
      type: Boolean,
      default: true
    }
  },
  reactions: {
    type: Map,
    of: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    }]
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