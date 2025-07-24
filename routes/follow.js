const express = require('express');
const User = require('../models/User');
const router = express.Router();

const isAuth = (req, res, next) => {
  if (!req.session.user) return res.status(401).json({ message: 'Not authorized' });
  next();
};

// Подписка / отписка
router.post('/:id', isAuth, async (req, res) => {
  try {
    const targetId = req.params.id;
    const userId = req.session.user.id;

    if (userId === targetId) return res.status(400).json({ message: 'Нельзя подписаться на себя' });

    const user = await User.findById(userId);
    const target = await User.findById(targetId);

    if (!target) return res.status(404).json({ message: 'Пользователь не найден' });

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

    // Отправляем real-time обновление
    const io = req.app.get('io');
    
    // Уведомляем пользователя, которого подписались/отписались
    io.to('posts').emit('followUpdate', {
      targetUserId: targetId,
      followerId: userId,
      followerUsername: req.session.user.username,
      isFollowing: !isFollowing,
      followersCount: target.followers.length
    });

    // Также уведомляем самого пользователя об изменении счетчика подписок
    io.to('posts').emit('followingUpdate', {
      userId: userId,
      followingCount: user.following.length
    });

    res.json({ 
      following: !isFollowing,
      followersCount: target.followers.length,
      followingCount: user.following.length
    });
  } catch (error) {
    console.error('Error updating follow status:', error);
    res.status(500).json({ message: 'Error updating follow status' });
  }
});

// Получить подписчиков
router.get('/:id/followers', isAuth, async (req, res) => {
  try {
    const user = await User.findById(req.params.id).populate('followers', 'username');
    if (!user) return res.status(404).json({ message: 'Пользователь не найден' });

    res.json(user.followers);
  } catch (error) {
    console.error('Error fetching followers:', error);
    res.status(500).json({ message: 'Error fetching followers' });
  }
});

// Получить список подписок
router.get('/:id/following', isAuth, async (req, res) => {
  try {
    const user = await User.findById(req.params.id).populate('following', 'username');
    if (!user) return res.status(404).json({ message: 'Пользователь не найден' });

    res.json(user.following);
  } catch (error) {
    console.error('Error fetching following:', error);
    res.status(500).json({ message: 'Error fetching following' });
  }
});

// Получить статус подписки на пользователя
router.get('/:id/status', isAuth, async (req, res) => {
  try {
    const targetId = req.params.id;
    const userId = req.session.user.id;

    if (userId === targetId) {
      return res.json({ isFollowing: false, isOwnProfile: true });
    }

    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ message: 'Пользователь не найден' });

    const isFollowing = user.following.includes(targetId);
    
    res.json({ 
      isFollowing: isFollowing,
      isOwnProfile: false
    });
  } catch (error) {
    console.error('Error fetching follow status:', error);
    res.status(500).json({ message: 'Error fetching follow status' });
  }
});

module.exports = router;