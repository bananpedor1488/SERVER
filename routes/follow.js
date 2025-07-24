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
  } catch (error) {
    console.error('Follow error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Получить подписчиков
router.get('/:id/followers', isAuth, async (req, res) => {
  try {
    const user = await User.findById(req.params.id).populate('followers', 'username');
    if (!user) return res.status(404).json({ message: 'Пользователь не найден' });

    res.json(user.followers);
  } catch (error) {
    console.error('Get followers error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Получить список подписок
router.get('/:id/following', isAuth, async (req, res) => {
  try {
    const user = await User.findById(req.params.id).populate('following', 'username');
    if (!user) return res.status(404).json({ message: 'Пользователь не найден' });

    res.json(user.following);
  } catch (error) {
    console.error('Get following error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;