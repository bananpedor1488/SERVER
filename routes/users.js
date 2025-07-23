const express = require('express');
const mongoose = require('mongoose');
const User = require('../models/User');
const Post = require('../models/Post');
const Follow = require('../models/Follow');
const requireAuth = require('../middleware/requireAuth');

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
    const users = await User.find({ username: new RegExp(query, 'i') }).select('username');
    if (users.length === 0) {
      return res.status(404).json({ message: 'No users found' });
    }
    res.json(users);
  } catch (err) {
    console.error('Ошибка при поиске пользователей:', err);
    res.status(500).send('Ошибка при поиске пользователей');
  }
});

// 🔹 Получить профиль по ID (должен быть ПОСЛЕ /search)
router.get('/:id', isAuth, async (req, res) => {
  try {
    // Проверяем, что id является валидным ObjectId
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ message: 'Invalid user ID' });
    }

    const user = await User.findById(req.params.id).select('username followers following');
    if (!user) return res.status(404).json({ message: 'User not found' });

    res.json({
      _id: user._id,
      username: user.username,
      followersCount: user.followers.length,
      followingCount: user.following.length
    });
  } catch (err) {
    console.error('Ошибка при получении профиля:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// 🔹 Получить посты пользователя
router.get('/:id/posts', isAuth, async (req, res) => {
  try {
    // Проверяем, что id является валидным ObjectId
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ message: 'Invalid user ID' });
    }

    const posts = await Post.find({ author: req.params.id })
      .sort({ createdAt: -1 })
      .populate('author', 'username');
    res.json(posts);
  } catch (err) {
    console.error('Ошибка при получении постов:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;