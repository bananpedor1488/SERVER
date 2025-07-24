const express = require('express');
const Post = require('../models/Post');
const Comment = require('../models/Comment');
const router = express.Router();

// Middleware проверки сессии
const isAuth = (req, res, next) => {
  if (!req.session.user) return res.status(401).json({ message: 'Not authorized' });
  next();
};

// Получить все посты (сортированы по дате) с комментариями
router.get('/', isAuth, async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    const posts = await Post.find()
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
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
  } catch (error) {
    console.error('Error fetching posts:', error);
    res.status(500).json({ message: 'Server error' });
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
    
    // Добавляем пустые комментарии для нового поста
    const postWithComments = {
      ...populated.toObject(),
      comments: [],
      commentsCount: 0
    };

    // Отправляем через Socket.IO всем пользователям
    const io = req.app.get('io');
    io.to('general').emit('newPost', postWithComments);

    res.status(201).json(postWithComments);
  } catch (error) {
    console.error('Error creating post:', error);
    res.status(500).json({ message: 'Server error' });
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
    
    // Получаем обновленное количество комментариев
    const commentsCount = await Comment.countDocuments({ post: post._id });

    // Отправляем через Socket.IO всем пользователям
    const io = req.app.get('io');
    io.to('general').emit('newComment', {
      postId: post._id,
      comment: populated,
      commentsCount: commentsCount
    });

    res.status(201).json(populated);
  } catch (error) {
    console.error('Error creating comment:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Получить комментарии поста
router.get('/:id/comments', isAuth, async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    const comments = await Comment.find({ post: req.params.id })
      .sort({ createdAt: 1 })
      .skip(skip)
      .limit(limit)
      .populate('author', 'username');

    const totalComments = await Comment.countDocuments({ post: req.params.id });

    res.json({
      comments: comments,
      totalComments: totalComments,
      hasMore: skip + comments.length < totalComments
    });
  } catch (error) {
    console.error('Error fetching comments:', error);
    res.status(500).json({ message: 'Server error' });
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
    
    const liked = index === -1;
    const likesCount = post.likes.length;

    // Отправляем через Socket.IO всем пользователям
    const io = req.app.get('io');
    io.to('general').emit('postLiked', {
      postId: post._id,
      liked: liked,
      likesCount: likesCount,
      userId: userId
    });

    res.json({ liked: liked, likes: likesCount });
  } catch (error) {
    console.error('Error liking post:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Репост
router.post('/:id/repost', isAuth, async (req, res) => {
  try {
    const originalPost = await Post.findById(req.params.id).populate('author', 'username');
    if (!originalPost) return res.status(404).json({ message: 'Post not found' });

    // Создаем новый пост как репост
    const repost = await Post.create({
      author: req.session.user.id,
      content: `Репост от @${originalPost.author.username}: ${originalPost.content}`,
      originalPost: originalPost._id
    });

    const populated = await repost.populate('author', 'username');
    
    const repostWithComments = {
      ...populated.toObject(),
      comments: [],
      commentsCount: 0
    };

    // Отправляем через Socket.IO всем пользователям
    const io = req.app.get('io');
    io.to('general').emit('newPost', repostWithComments);

    res.status(201).json(repostWithComments);
  } catch (error) {
    console.error('Error reposting:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Удалить пост (только автор может удалить)
router.delete('/:id', isAuth, async (req, res) => {
  try {
    const post = await Post.findById(req.params.id);
    if (!post) return res.status(404).json({ message: 'Post not found' });

    // Проверяем, является ли текущий пользователь автором поста
    if (post.author.toString() !== req.session.user.id) {
      return res.status(403).json({ message: 'Not authorized to delete this post' });
    }

    // Удаляем все комментарии к посту
    await Comment.deleteMany({ post: post._id });
    
    // Удаляем сам пост
    await Post.findByIdAndDelete(req.params.id);

    // Отправляем через Socket.IO всем пользователям
    const io = req.app.get('io');
    io.to('general').emit('postDeleted', {
      postId: post._id
    });

    res.json({ message: 'Post deleted successfully' });
  } catch (error) {
    console.error('Error deleting post:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;