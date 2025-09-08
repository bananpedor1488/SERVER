const express = require('express');
const router = express.Router();
const User = require('../models/User');
const Post = require('../models/Post');
const requireAdmin = require('../middleware/requireAdmin');

// Все роуты требуют админ-права
router.use(requireAdmin);

// Получить всех пользователей
router.get('/users', async (req, res) => {
  try {
    const { search, page = 1, limit = 50 } = req.query;
    const query = {};
    
    if (search) {
      query.$or = [
        { username: { $regex: search, $options: 'i' } },
        { displayName: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } }
      ];
    }

    const users = await User.find(query)
      .select('-password -emailVerificationCode -sessions')
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .populate('followers following', 'username displayName');

    // Добавляем статистику для каждого пользователя
    const usersWithStats = await Promise.all(users.map(async (user) => {
      const postsCount = await Post.countDocuments({ author: user._id });
      const followersCount = user.followers.length;
      const followingCount = user.following.length;

      return {
        ...user.toObject(),
        postsCount,
        followersCount,
        followingCount
      };
    }));

    const totalUsers = await User.countDocuments(query);

    res.json({
      users: usersWithStats,
      totalUsers,
      currentPage: page,
      totalPages: Math.ceil(totalUsers / limit)
    });
  } catch (error) {
    console.error('Ошибка получения пользователей:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// Изменить роль пользователя
router.put('/users/:userId/role', async (req, res) => {
  try {
    const { userId } = req.params;
    const { role } = req.body;

    if (!['user', 'admin'].includes(role)) {
      return res.status(400).json({ error: 'Недопустимая роль' });
    }

    // Не позволяем снимать себя с админа
    if (userId === req.user._id.toString() && role === 'user') {
      return res.status(400).json({ error: 'Нельзя снять админские права с самого себя' });
    }

    const user = await User.findByIdAndUpdate(
      userId,
      { role },
      { new: true }
    ).select('-password -emailVerificationCode -sessions');

    if (!user) {
      return res.status(404).json({ error: 'Пользователь не найден' });
    }

    res.json({ message: 'Роль успешно изменена', user });
  } catch (error) {
    console.error('Ошибка изменения роли:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// Забанить/разбанить пользователя
router.put('/users/:userId/ban', async (req, res) => {
  try {
    const { userId } = req.params;
    const { banned = true, reason } = req.body;

    // Не позволяем банить себя
    if (userId === req.user._id.toString()) {
      return res.status(400).json({ error: 'Нельзя забанить самого себя' });
    }

    const user = await User.findByIdAndUpdate(
      userId,
      { 
        banned,
        banReason: banned ? reason : undefined,
        bannedAt: banned ? new Date() : undefined,
        bannedBy: banned ? req.user._id : undefined
      },
      { new: true }
    ).select('-password -emailVerificationCode -sessions');

    if (!user) {
      return res.status(404).json({ error: 'Пользователь не найден' });
    }

    res.json({ 
      message: banned ? 'Пользователь забанен' : 'Пользователь разбанен', 
      user 
    });
  } catch (error) {
    console.error('Ошибка бана пользователя:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// Получить все посты
router.get('/posts', async (req, res) => {
  try {
    const { search, page = 1, limit = 50 } = req.query;
    const query = {};
    
    if (search) {
      query.content = { $regex: search, $options: 'i' };
    }

    const posts = await Post.find(query)
      .populate('author', 'username displayName avatar role')
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const postsWithStats = posts.map(post => ({
      _id: post._id,
      content: post.content,
      author: post.author,
      likes: Array.isArray(post.likes) ? post.likes.length : 0,
      commentsCount: post.commentsCount || 0,
      createdAt: post.createdAt,
      postType: post.postType,
      files: post.files
    }));

    const totalPosts = await Post.countDocuments(query);

    res.json({
      posts: postsWithStats,
      totalPosts,
      currentPage: page,
      totalPages: Math.ceil(totalPosts / limit)
    });
  } catch (error) {
    console.error('Ошибка получения постов:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// Удалить пост
router.delete('/posts/:postId', async (req, res) => {
  try {
    const { postId } = req.params;

    const post = await Post.findByIdAndDelete(postId);

    if (!post) {
      return res.status(404).json({ error: 'Пост не найден' });
    }

    res.json({ message: 'Пост успешно удален' });
  } catch (error) {
    console.error('Ошибка удаления поста:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// Получить статистику
router.get('/stats', async (req, res) => {
  try {
    const [
      totalUsers,
      totalAdmins,
      totalPosts,
      onlineUsers,
      todayPosts,
      todayUsers
    ] = await Promise.all([
      User.countDocuments(),
      User.countDocuments({ role: 'admin' }),
      Post.countDocuments(),
      User.countDocuments({ isOnline: true }),
      Post.countDocuments({ 
        createdAt: { 
          $gte: new Date(new Date().setHours(0, 0, 0, 0)) 
        } 
      }),
      User.countDocuments({ 
        createdAt: { 
          $gte: new Date(new Date().setHours(0, 0, 0, 0)) 
        } 
      })
    ]);

    // Получаем статистику по дням за последнюю неделю
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);

    const dailyStats = [];
    for (let i = 6; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      const startOfDay = new Date(date.setHours(0, 0, 0, 0));
      const endOfDay = new Date(date.setHours(23, 59, 59, 999));

      const [dayPosts, dayUsers] = await Promise.all([
        Post.countDocuments({ 
          createdAt: { $gte: startOfDay, $lte: endOfDay } 
        }),
        User.countDocuments({ 
          createdAt: { $gte: startOfDay, $lte: endOfDay } 
        })
      ]);

      dailyStats.push({
        date: startOfDay.toISOString().split('T')[0],
        posts: dayPosts,
        users: dayUsers
      });
    }

    res.json({
      totalUsers,
      totalAdmins,
      totalPosts,
      onlineUsers,
      todayPosts,
      todayUsers,
      dailyStats
    });
  } catch (error) {
    console.error('Ошибка получения статистики:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// Получить активность пользователей
router.get('/activity', async (req, res) => {
  try {
    const recentActivity = await Post.find()
      .populate('author', 'username displayName avatar role')
      .sort({ createdAt: -1 })
      .limit(20)
      .select('content author createdAt postType');

    res.json({ recentActivity });
  } catch (error) {
    console.error('Ошибка получения активности:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

module.exports = router;
