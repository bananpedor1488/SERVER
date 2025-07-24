const Post = require('../models/Post');
const Repost = require('../models/Repost');

// Функция для обновления счетчика репостов в оригинальном посте
const updateRepostCount = async (originalPostId) => {
  try {
    const repostCount = await Repost.countDocuments({ originalPost: originalPostId });
    await Post.findByIdAndUpdate(originalPostId, { repostsCount: repostCount });
    console.log(`Updated repost count for post ${originalPostId}: ${repostCount}`);
  } catch (error) {
    console.error('Error updating repost count:', error);
  }
};

// Middleware для автоматического обновления счетчика при создании репоста
const afterRepostSave = function() {
  updateRepostCount(this.originalPost);
};

// Middleware для автоматического обновления счетчика при удалении репоста
const afterRepostRemove = function() {
  updateRepostCount(this.originalPost);
};

// Применяем middleware к модели Repost
Repost.schema.post('save', afterRepostSave);
Repost.schema.post('findOneAndDelete', afterRepostRemove);
Repost.schema.post('deleteMany', async function() {
  // При массовом удалении репостов (например, при удалении поста)
  // нужно обновить счетчики для всех затронутых постов
  console.log('Mass repost deletion detected');
});

// Экспортируем функцию для ручного обновления счетчиков
module.exports = {
  updateRepostCount,
  initializeRepostHooks: () => {
    console.log('Repost hooks initialized');
  }
};