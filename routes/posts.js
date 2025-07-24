const express = require('express');
const Post = require('../models/Post');
const router = express.Router();
const Comment = require('../models/Comment');

// Middleware проверки сессии
const isAuth = (req, res, next) => {
  if (!req.session.user) return res.status(401).json({ message: 'Not authorized' });
  next();
};

// Получить все посты (сортированы по дате) с комментариями
router.get('/', isAuth, async (req, res) => {
  try {
    const posts = await Post.find()
      .sort({ createdAt: -1 })
      .populate('author', 'username')
      .lean(); // Используем lean для лучшей производительности

    // Получаем комментарии для всех постов одним запросом
    const postIds = posts.map(post => post._id);
    const comments = await Comment.find({ post: { $in: postIds } })
      .sort({ createdAt: 1 })
      .populate('author', 'username')
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

    // Добавляем комментарии к каждому посту
    const postsWithComments = posts.map(post => ({
      ...post,
      comments: commentsByPost[post._id.toString()] || [],
      commentsCount: (commentsByPost[post._id.toString()] || []).length
    }));

    res.json(postsWithComments);
  } catch (error) {
    console.error('Error fetching posts:', error);
    res.status(500).json({ message: 'Error fetching posts' });
  }
});

// Создать пост
router.post('/', isAuth, async (req, res) => {
  try {
    const content = req.body.content?.trim();
    if (!content) return res.status(400).json({ message: 'Content required' });

    const post = await Post.create({
      author: req.session.user.id,
      content
    });

    const populated = await post.populate('author', 'username');
    
    // Добавляем пустой массив комментариев для консистентности
    const postWithComments = {
      ...populated.toJSON(),
      comments: [],
      commentsCount: 0
    };

    // Отправляем real-time обновление всем подключенным пользователям
    const io = req.app.get('io');
    io.to('posts').emit('newPost', postWithComments);

    res.status(201).json(postWithComments);
  } catch (error) {
    console.error('Error creating post:', error);
    res.status(500).json({ message: 'Error creating post' });
  }
});

// Добавить комментарий
router.post('/:id/comment', isAuth, async (req, res) => {
  try {
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

    // Отправляем real-time обновление всем подключенным пользователям
    const io = req.app.get('io');
    io.to('posts').emit('newComment', {
      postId: post._id.toString(),
      comment: populated.toJSON()
    });

    res.status(201).json(populated);
  } catch (error) {
    console.error('Error adding comment:', error);
    res.status(500).json({ message: 'Error adding comment' });
  }
});

// Получить комментарии поста (оставляем для совместимости)
router.get('/:id/comments', isAuth, async (req, res) => {
  try {
    const comments = await Comment.find({ post: req.params.id })
      .sort({ createdAt: 1 })
      .populate('author', 'username');

    res.json(comments);
  } catch (error) {
    console.error('Error fetching comments:', error);
    res.status(500).json({ message: 'Error fetching comments' });
  }
});

// Лайк / дизлайк
router.post('/:id/like', isAuth, async (req, res) => {
  try {
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
    
    const result = { 
      liked: index === -1, 
      likes: post.likes.length,
      postId: post._id.toString()
    };

    // Отправляем real-time обновление всем подключенным пользователям
    const io = req.app.get('io');
    io.to('posts').emit('likeUpdate', {
      postId: post._id.toString(),
      liked: result.liked,
      likesCount: result.likes,
      userId: userId
    });

    res.json(result);
  } catch (error) {
    console.error('Error updating like:', error);
    res.status(500).json({ message: 'Error updating like' });
  }
});

// Удалить пост (новый роут)
router.delete('/:id', isAuth, async (req, res) => {
  try {
    const post = await Post.findById(req.params.id);
    if (!post) return res.status(404).json({ message: 'Post not found' });

    // Проверяем, что пользователь может удалить пост (только автор)
    if (post.author.toString() !== req.session.user.id) {
      return res.status(403).json({ message: 'Not authorized to delete this post' });
    }

    // Удаляем все комментарии к посту
    await Comment.deleteMany({ post: post._id });
    
    // Удаляем сам пост
    await Post.findByIdAndDelete(req.params.id);

    // Отправляем real-time обновление всем подключенным пользователям
    const io = req.app.get('io');
    io.to('posts').emit('postDeleted', {
      postId: post._id.toString()
    });

    res.json({ message: 'Post deleted successfully' });
  } catch (error) {
    console.error('Error deleting post:', error);
    res.status(500).json({ message: 'Error deleting post' });
  }
});

// Удалить комментарий (новый роут)
router.delete('/:postId/comment/:commentId', isAuth, async (req, res) => {
  try {
    const comment = await Comment.findById(req.params.commentId);
    if (!comment) return res.status(404).json({ message: 'Comment not found' });

    // Проверяем, что пользователь может удалить комментарий (только автор)
    if (comment.author.toString() !== req.session.user.id) {
      return res.status(403).json({ message: 'Not authorized to delete this comment' });
    }

    await Comment.findByIdAndDelete(req.params.commentId);

    // Отправляем real-time обновление всем подключенным пользователям
    const io = req.app.get('io');
    io.to('posts').emit('commentDeleted', {
      postId: req.params.postId,
      commentId: req.params.commentId
    });

    res.json({ message: 'Comment deleted successfully' });
  } catch (error) {
    console.error('Error deleting comment:', error);
    res.status(500).json({ message: 'Error deleting comment' });
  }
});

module.exports = router;