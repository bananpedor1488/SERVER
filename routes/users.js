const express = require('express');
const mongoose = require('mongoose');
const User = require('../models/User');
const Post = require('../models/Post');
const Repost = require('../models/Repost');
const Comment = require('../models/Comment');
const Follow = require('../models/Follow');
const requireAuth = require('../middleware/requireAuth');
const jwtAuth = require('../middleware/jwtAuth');

const router = express.Router();

// Мидлваре для авторизации
const isAuth = (req, res, next) => {
  if (!req.session.user) return res.status(401).json({ message: 'Not authorized' });
  next();
};

// 🔹 ВАЖНО: Поиск пользователей должен быть ДО маршрута /:id
router.get('/search', isAuth, async (req, res) => {
  const query = req.query.query?.trim();
  
  // Если запрос пустой или имеет некорректный формат, возвращаем ошибку
  if (!query) {
    return res.status(400).json({ message: 'Query parameter is required' });
  }

  try {
    // Вместо _id используем поле username для поиска
    const users = await User.find({ username: new RegExp(query, 'i') }).select('username displayName avatar premium').lean();
    if (users.length === 0) {
      return res.status(404).json({ message: 'No users found' });
    }
    res.json(users);
  } catch (err) {
    console.error('Ошибка при поиске пользователей:', err);
    res.status(500).send('Ошибка при поиске пользователей');
  }
});

// 🔹 Получить онлайн статус пользователей
router.get('/online-status', isAuth, async (req, res) => {
  try {
    const userIds = req.query.userIds;
    
    if (!userIds) {
      return res.status(400).json({ message: 'userIds parameter is required' });
    }
    
    // Парсим userIds (может быть строкой или массивом)
    let idsArray;
    if (typeof userIds === 'string') {
      idsArray = userIds.split(',');
    } else if (Array.isArray(userIds)) {
      idsArray = userIds;
    } else {
      return res.status(400).json({ message: 'Invalid userIds format' });
    }
    
    // Получаем статус пользователей
    const users = await User.find(
      { _id: { $in: idsArray } },
      'username isOnline lastSeen'
    );
    
    const statusMap = {};
    users.forEach(user => {
      statusMap[user._id] = {
        username: user.username,
        isOnline: user.isOnline,
        lastSeen: user.lastSeen
      };
    });
    
    res.json(statusMap);
  } catch (error) {
    console.error('Error fetching online status:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// 🔹 Получить рекомендации пользователей
router.get('/suggestions', isAuth, async (req, res) => {
  try {
    const currentUserId = req.session.user.id;
    
    // Получаем пользователя и его подписки
    const currentUser = await User.findById(currentUserId).select('following');
    const followingIds = currentUser ? currentUser.following : [];
    
    // Исключаем текущего пользователя и тех, на кого уже подписан
    const excludeIds = [currentUserId, ...followingIds];
    
    // Получаем случайных пользователей
    const suggestions = await User.aggregate([
      { $match: { _id: { $nin: excludeIds.map(id => new mongoose.Types.ObjectId(id)) } } },
      { $sample: { size: 3 } },
      {
        $project: {
          username: 1,
          displayName: 1,
          avatar: 1,
          premium: 1,
          followersCount: { $size: '$followers' }
        }
      }
    ]);

    res.json(suggestions);
  } catch (err) {
    console.error('Ошибка при получении рекомендаций:', err);
    res.status(500).json({ message: 'Error fetching suggestions' });
  }
});

// 🔹 Получить профиль по ID с информацией о подписке (должен быть ПОСЛЕ /search и /suggestions)
router.get('/:id', isAuth, async (req, res) => {
  try {
    // Проверяем, что id является валидным ObjectId
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ message: 'Invalid user ID' });
    }

    const currentUserId = req.session.user.id;
    const user = await User.findById(req.params.id).select('username displayName bio avatar followers following premium');
    if (!user) return res.status(404).json({ message: 'User not found' });

    // Проверяем, подписан ли текущий пользователь на этого пользователя
    const isFollowing = user.followers.includes(currentUserId);

    res.json({
      _id: user._id,
      username: user.username,
      displayName: user.displayName,
      bio: user.bio,
      avatar: user.avatar,
      premium: user.premium,
      followersCount: user.followers.length,
      followingCount: user.following.length,
      followed: isFollowing
    });
  } catch (err) {
    console.error('Ошибка при получении профиля:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// 🔹 Получить посты пользователя (включая репосты)
router.get('/:id/posts', isAuth, async (req, res) => {
  try {
    // Проверяем, что id является валидным ObjectId
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ message: 'Invalid user ID' });
    }

    // Получаем обычные посты пользователя
    const posts = await Post.find({ author: req.params.id })
      .sort({ createdAt: -1 })
      .populate('author', 'username displayName avatar premium')
      .lean();

    // Получаем репосты пользователя
    const reposts = await Repost.find({ repostedBy: req.params.id })
      .sort({ createdAt: -1 })
      .populate('repostedBy', 'username displayName avatar premium')
      .populate({
        path: 'originalPost',
        populate: {
          path: 'author',
          select: 'username displayName avatar premium'
        }
      })
      .lean();

    // Объединяем посты и репосты
    const allItems = [];

    // Добавляем обычные посты
    posts.forEach(post => {
      allItems.push({
        ...post,
        type: 'post',
        sortDate: post.createdAt,
        isRepost: false
      });
    });

    // Добавляем репосты
    reposts.forEach(repost => {
      if (repost.originalPost) { // Проверяем, что оригинальный пост существует
        allItems.push({
          _id: repost._id,
          type: 'repost',
          sortDate: repost.createdAt,
          isRepost: true,
          originalPost: repost.originalPost,
          repostedBy: repost.repostedBy,
          createdAt: repost.createdAt,
          // Для совместимости с фронтендом
          author: repost.originalPost.author,
          content: repost.originalPost.content,
          likes: repost.originalPost.likes || []
        });
      }
    });

    // Сортируем по дате создания
    allItems.sort((a, b) => new Date(b.sortDate) - new Date(a.sortDate));

    // Получаем ID всех постов для загрузки комментариев
    const postIds = [];
    allItems.forEach(item => {
      if (item.type === 'post') {
        postIds.push(item._id);
      } else if (item.type === 'repost' && item.originalPost) {
        postIds.push(item.originalPost._id);
      }
    });

    // Получаем комментарии для всех постов
    const comments = await Comment.find({ post: { $in: postIds } })
      .sort({ createdAt: 1 })
      .populate('author', 'username displayName avatar')
      .lean();

    // Группируем комментарии по постам
    const commentsByPost = {};
    comments.forEach(comment => {
      const postId = comment.post.toString();
      if (!commentsByPost[postId]) {
        commentsByPost[postId] = [];
      }
      commentsByPost[postId].push(comment);
    });

    // Добавляем комментарии к постам
    const postsWithComments = allItems.map(item => {
      if (item.type === 'post') {
        return {
          ...item,
          comments: commentsByPost[item._id.toString()] || [],
          commentsCount: (commentsByPost[item._id.toString()] || []).length
        };
      } else {
        // Это репост
        const originalPostId = item.originalPost._id.toString();
        return {
          ...item,
          comments: commentsByPost[originalPostId] || [],
          commentsCount: (commentsByPost[originalPostId] || []).length
        };
      }
    });

    res.json(postsWithComments);
  } catch (err) {
    console.error('Ошибка при получении постов:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// 🔹 Обновление профиля пользователя (используем JWT авторизацию)
router.put('/profile/:id', jwtAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const { displayName, bio, avatar } = req.body;
    const currentUserId = req.userId;

    // Проверяем, что пользователь обновляет свой собственный профиль
    if (id !== currentUserId) {
      return res.status(403).json({ message: 'You can only update your own profile' });
    }

    // Проверяем, что id является валидным ObjectId
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: 'Invalid user ID' });
    }

    // Валидация данных
    const updateData = {};
    
    if (displayName !== undefined) {
      if (displayName.length > 50) {
        return res.status(400).json({ message: 'Display name cannot exceed 50 characters' });
      }
      updateData.displayName = displayName.trim();
    }
    
    if (bio !== undefined) {
      if (bio.length > 160) {
        return res.status(400).json({ message: 'Bio cannot exceed 160 characters' });
      }
      updateData.bio = bio.trim();
    }
    
    if (avatar !== undefined) {
      // Проверяем размер base64 аватарки (примерно 5MB в base64)
      if (avatar && avatar.length > 7000000) {
        return res.status(400).json({ message: 'Avatar file is too large. Maximum size is 5MB' });
      }
      updateData.avatar = avatar;
    }

    // Обновляем пользователя
    const updatedUser = await User.findByIdAndUpdate(
      id,
      updateData,
      { new: true, runValidators: true }
    ).select('username displayName bio avatar premium');

    if (!updatedUser) {
      return res.status(404).json({ message: 'User not found' });
    }

    res.json({
      message: 'Profile updated successfully',
      user: {
        _id: updatedUser._id,
        username: updatedUser.username,
        displayName: updatedUser.displayName,
        bio: updatedUser.bio,
        avatar: updatedUser.avatar,
        premium: updatedUser.premium
      }
    });

  } catch (error) {
    console.error('Error updating profile:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;