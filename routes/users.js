const express = require('express');
const mongoose = require('mongoose');
const User = require('../models/User');
const Post = require('../models/Post');
const Comment = require('../models/Comment');
const Follow = require('../models/Follow');

const router = express.Router();

// Мидлваре для авторизации
const isAuth = (req, res, next) => {
  if (!req.session.user) return res.Status(401).json({ message: 'Not authorized' });
  next();
};

// 🔹 ВАЖНО: Поиск пользователей должен быть ДО маршрута /:id
router.get('/search', isAuth, async (req, res) => {
  try {
    const query = req.query.query?.trim();
    
    if (!query) {
      return res.status(400).json({ message: 'Query parameter is required' });
    }

    const users = await User.find({ 
      username: new RegExp(query, 'i') 
    }).select('username followers following');
    
    if (users.length === 0) {
      return res.status(404).json({ message: 'No users found' });
    }
    
    res.json(users);
  } catch (err) {
    console.error('Ошибка при поиске пользователей:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// 🔹 Получить рекомендации пользователей
router.get('/suggestions', isAuth, async (req, res) => {
  try {
    const currentUserId = req.session.user.id;
    
    // Получаем пользователей, на которых текущий пользователь не подписан
    const currentUser = await User.findById(currentUserId);
    const followingIds = currentUser.following;
    
    const suggestions = await User.find({
      _id: { 
        $nin: [...followingIds, currentUserId] // Исключаем подписки и самого себя
      }
    })
    .select('username followers following')
    .limit(10)
    .sort({ 'followers.length': -1 }); // Сортируем по количеству подписчиков

    // Добавляем информацию о подписчиках
    const suggestionsWithStats = suggestions.map(user => ({
      _id: user._id,
      username: user.username,
      followersCount: user.followers.length,
      followingCount: user.following.length,
      followed: false // Поскольку это рекомендации, пользователь не подписан
    }));

    res.json(suggestionsWithStats);
  } catch (err) {
    console.error('Ошибка при получении рекомендаций:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// 🔹 Получить профиль по ID (должен быть ПОСЛЕ /search и /suggestions)
router.get('/:id', isAuth, async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ message: 'Invalid user ID' });
    }

    const user = await User.findById(req.params.id).select('username followers following');
    if (!user) return res.status(404).json({ message: 'User not found' });

    // Проверяем, подписан ли текущий пользователь на этого пользователя
    const currentUserId = req.session.user.id;
    const isFollowed = user.followers.includes(currentUserId);

    res.json({
      _id: user._id,
      username: user.username,
      followersCount: user.followers.length,
      followingCount: user.following.length,
      followed: isFollowed
    });
  } catch (err) {
    console.error('Ошибка при получении профиля:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// 🔹 Получить посты пользователя с комментариями
router.get('/:id/posts', isAuth, async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ message: 'Invalid user ID' });
    }

    const posts = await Post.find({ author: req.params.id })
      .sort({ createdAt: -1 })
      .populate('author', 'username');

    // Загружаем комментарии для каждого поста
    const postsWithComments = await Promise.all(
      posts.map(async (post) => {
        const comments = await Comment.find({ post: post._id })
          .sort({ createdAt: 1 })
          .populate('author', 'username')
          .limit(5); // Загружаем только последние 5 комментариев

        const commentsCount = await Comment.countDocuments({ post: post._id });

        return {
          ...post.toObject(),
          comments: comments,
          commentsCount: commentsCount
        };
      })
    );

    res.json(postsWithComments);
  } catch (err) {
    console.error('Ошибка при получении постов:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// 🔹 Подписка / отписка
router.post('/follow/:id', isAuth, async (req, res) => {
  try {
    const targetId = req.params.id;
    const userId = req.session.user.id;

    if (!mongoose.Types.ObjectId.isValid(targetId)) {
      return res.status(400).json({ message: 'Invalid user ID' });
    }

    if (userId === targetId) {
      return res.status(400).json({ message: 'Нельзя подписаться на себя' });
    }

    const user = await User.findById(userId);
    const target = await User.findById(targetId);

    if (!target) {
      return res.status(404).json({ message: 'Пользователь не найден' });
    }

    const isFollowing = user.following.includes(targetId);

    if (isFollowing) {
      user.following.pull(targetId);
      target.followers.pull(userId);
    } else {
      user.following.push(targetId);
      target.followers.push(userId);
    }

    await user.save();
    await target.save();

    // Отправляем обновление через Socket.IO
    const io = req.app.get('io');
    io.to('general').emit('followUpdate', {
      targetUserId: targetId,
      followerId: userId,
      followed: !isFollowing,
      followersCount: target.followers.length
    });

    // Отправляем уведомление пользователю, на которого подписались
    if (!isFollowing) {
      io.to(`user_${targetId}`).emit('newFollower', {
        follower: {
          id: userId,
          username: user.username
        }
      });
    }

    res.json({ 
      following: !isFollowing,
      followersCount: target.followers.length,
      followingCount: user.following.length
    });
  } catch (err) {
    console.error('Ошибка подписки/отписки:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// 🔹 Получить подписчиков пользователя
router.get('/:id/followers', isAuth, async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ message: 'Invalid user ID' });
    }

    const user = await User.findById(req.params.id)
      .populate('followers', 'username followers following');
    
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const followersWithStats = user.followers.map(follower => ({
      _id: follower._id,
      username: follower.username,
      followersCount: follower.followers.length,
      followingCount: follower.following.length
    }));

    res.json(followersWithStats);
  } catch (err) {
    console.error('Ошибка при получении подписчиков:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// 🔹 Получить подписки пользователя
router.get('/:id/following', isAuth, async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ message: 'Invalid user ID' });
    }

    const user = await User.findById(req.params.id)
      .populate('following', 'username followers following');
    
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const followingWithStats = user.following.map(following => ({
      _id: following._id,
      username: following.username,
      followersCount: following.followers.length,
      followingCount: following.following.length
    }));

    res.json(followingWithStats);
  } catch (err) {
    console.error('Ошибка при получении подписок:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;