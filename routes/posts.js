const express = require('express');
const Post = require('../models/Post');
const router = express.Router();
const Comment = require('../models/Comment');

// Middleware проверки сессии
const isAuth = (req, res, next) => {
  if (!req.session.user) return res.status(401).json({ message: 'Not authorized' });
  next();
};

// Получить все посты (сортированы по дате)
router.get('/', isAuth, async (req, res) => {
  const posts = await Post.find()
    .sort({ createdAt: -1 })
    .populate('author', 'username');
  res.json(posts);
});

// Создать пост
router.post('/', isAuth, async (req, res) => {
  const content = req.body.content?.trim();
  if (!content) return res.status(400).json({ message: 'Content required' });

  const post = await Post.create({
    author: req.session.user.id,
    content
  });

  const populated = await post.populate('author', 'username');
  res.status(201).json(populated);
});
// Добавить комментарий
router.post('/:id/comment', isAuth, async (req, res) => {
  const content = req.body.content?.trim();
  if (!content) return res.status(400).json({ message: 'Комментарий пустой' });

  const post = await Post.findById(req.params.id);
  if (!post) return res.status(404).json({ message: 'Пост не найден' });

  const comment = await Comment.create({
    post: post._id,
    author: req.session.user.id,
    content
  });

  const populated = await comment.populate('author', 'username');
  res.status(201).json(populated);
});

// Получить комментарии поста
router.get('/:id/comments', isAuth, async (req, res) => {
  const comments = await Comment.find({ post: req.params.id })
    .sort({ createdAt: 1 })
    .populate('author', 'username');

  res.json(comments);
});
// Лайк / дизлайк
router.post('/:id/like', isAuth, async (req, res) => {
  const post = await Post.findById(req.params.id);
  if (!post) return res.status(404).json({ message: 'Post not found' });

  const userId = req.session.user.id;
  const index = post.likes.indexOf(userId);

  if (index === -1) {
    post.likes.push(userId);
  } else {
    post.likes.splice(index, 1);
  }

  await post.save();
  res.json({ liked: index === -1, likes: post.likes.length });
});

module.exports = router;
