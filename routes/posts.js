const express = require('express');
const Post = require('../models/Post');
const Repost = require('../models/Repost');
const Comment = require('../models/Comment');
const User = require('../models/User');
const { sendLikeNotification, sendCommentNotification, sendRepostNotification } = require('../utils/notificationUtils');
const { uploadFiles, handleUploadError } = require('../middleware/upload');
const { uploadFileToGitLab, checkProjectExists } = require('../utils/gitlabUpload');
const router = express.Router();

// Middleware проверки сессии
const isAuth = (req, res, next) => {
  if (!req.session.user) return res.status(401).json({ message: 'Not authorized' });
  next();
};

// Получить все посты (включая репосты) с комментариями
router.get('/', isAuth, async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    // Получаем обычные посты
    const posts = await Post.find()
      .sort({ createdAt: -1 })
      .populate('author', 'username displayName avatar premium')
      .lean();

    // Получаем репосты
    const reposts = await Repost.find()
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
          createdAt: repost.createdAt
        });
      }
    });

    // Сортируем по дате создания
    allItems.sort((a, b) => new Date(b.sortDate) - new Date(a.sortDate));

    // Применяем пагинацию
    const paginatedItems = allItems.slice(skip, skip + limit);

    // Получаем ID всех постов (включая оригинальные посты из репостов)
    const postIds = [];
    paginatedItems.forEach(item => {
      if (item.type === 'post') {
        postIds.push(item._id);
      } else if (item.type === 'repost' && item.originalPost) {
        postIds.push(item.originalPost._id);
      }
    });

    // Получаем комментарии для всех постов одним запросом
    const comments = await Comment.find({ post: { $in: postIds } })
      .sort({ createdAt: 1 })
      .populate('author', 'username displayName avatar premium')
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

    // Форматируем результат
    const formattedItems = paginatedItems.map(item => {
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
          _id: item._id,
          isRepost: true,
          originalPost: {
            ...item.originalPost,
            comments: commentsByPost[originalPostId] || [],
            commentsCount: (commentsByPost[originalPostId] || []).length
          },
          repostedBy: item.repostedBy,
          createdAt: item.createdAt,
          // Для совместимости с фронтендом
          author: item.originalPost.author,
          content: item.originalPost.content,
          likes: item.originalPost.likes || [],
          comments: commentsByPost[originalPostId] || [],
          commentsCount: (commentsByPost[originalPostId] || []).length
        };
      }
    });

    res.json(formattedItems);
  } catch (error) {
    console.error('Error fetching posts:', error);
    res.status(500).json({ message: 'Error fetching posts' });
  }
});

// Создать пост
router.post('/', isAuth, uploadFiles, handleUploadError, async (req, res) => {
  try {
    const content = req.body.content?.trim();
    if (!content && (!req.files || req.files.length === 0)) {
      return res.status(400).json({ message: 'Content or files required' });
    }

    // Убеждаемся что проект GitLab существует
    await checkProjectExists();

    // Обрабатываем загруженные файлы
    const files = [];
    if (req.files && req.files.length > 0) {
      console.log(`Загружаем ${req.files.length} файлов на GitHub...`);
      
      for (const file of req.files) {
        try {
          // Загружаем файл на GitLab
          const gitlabResult = await uploadFileToGitLab(
            file.buffer, 
            file.originalname, 
            file.mimetype
          );
          
          files.push({
            filename: file.originalname,
            originalName: file.originalname,
            mimetype: file.mimetype,
            size: file.size,
            url: gitlabResult.url,           // GitLab raw URL
            gitlabUrl: gitlabResult.gitlabUrl, // GitLab web URL
            gitlabPath: gitlabResult.path,   // Путь в репозитории
            fileName: gitlabResult.fileName   // Имя файла
          });
          
          console.log(`Файл ${file.originalname} успешно загружен на GitLab`);
        } catch (uploadError) {
          console.error(`Ошибка загрузки файла ${file.originalname}:`, uploadError);
          // Продолжаем с другими файлами, но логируем ошибку
          return res.status(500).json({ 
            message: `Ошибка загрузки файла ${file.originalname}: ${uploadError.message}` 
          });
        }
      }
    }

    const post = await Post.create({
      author: req.session.user.id,
      content: content || '',
      files: files
    });

    const populated = await post.populate('author', 'username displayName avatar premium');
    
    // Добавляем пустой массив комментариев для консистентности
    const postWithComments = {
      ...populated.toJSON(),
      comments: [],
      commentsCount: 0,
      isRepost: false
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

// Создать репост
router.post('/:id/repost', isAuth, async (req, res) => {
  try {
    const originalPostId = req.params.id;
    const userId = req.session.user.id;

    // Проверяем, существует ли оригинальный пост
    const originalPost = await Post.findById(originalPostId).populate('author', 'username displayName avatar premium');
    if (!originalPost) {
      return res.status(404).json({ message: 'Пост не найден' });
    }

    // Проверяем, не репостит ли пользователь свой собственный пост
    if (originalPost.author._id.toString() === userId) {
      return res.status(400).json({ message: 'Нельзя репостить свой собственный пост' });
    }

    // Проверяем, не репостил ли пользователь уже этот пост
    const existingRepost = await Repost.findOne({
      originalPost: originalPostId,
      repostedBy: userId
    });

    if (existingRepost) {
      return res.status(400).json({ message: 'Вы уже репостили этот пост' });
    }

    // Создаем репост
    const repost = await Repost.create({
      originalPost: originalPostId,
      repostedBy: userId
    });

    // Получаем полную информацию о репосте
    const populatedRepost = await Repost.findById(repost._id)
      .populate('repostedBy', 'username displayName avatar premium')
      .populate({
        path: 'originalPost',
        populate: {
          path: 'author',
          select: 'username displayName avatar premium'
        }
      });

    // Формируем объект для отправки
    const repostData = {
      _id: populatedRepost._id,
      isRepost: true,
      originalPost: populatedRepost.originalPost,
      repostedBy: populatedRepost.repostedBy,
      createdAt: populatedRepost.createdAt
    };

    // Отправляем email-уведомление о репосте
    try {
      const reposter = await User.findById(userId);
      const originalAuthor = await User.findById(originalPost.author._id);
      
      if (reposter && originalAuthor) {
        await sendRepostNotification(reposter, originalAuthor, originalPost);
      }
    } catch (error) {
      console.error('Error sending repost notification:', error);
    }

    // Отправляем real-time обновление всем подключенным пользователям
    const io = req.app.get('io');
    io.to('posts').emit('newRepost', repostData);

    res.status(201).json(repostData);
  } catch (error) {
    console.error('Error creating repost:', error);
    if (error.code === 11000) {
      return res.status(400).json({ message: 'Вы уже репостили этот пост' });
    }
    res.status(500).json({ message: 'Error creating repost' });
  }
});

// Удалить репост
router.delete('/repost/:id', isAuth, async (req, res) => {
  try {
    const repost = await Repost.findById(req.params.id);
    if (!repost) {
      return res.status(404).json({ message: 'Репост не найден' });
    }

    // Проверяем, что пользователь может удалить репост (только автор)
    if (repost.repostedBy.toString() !== req.session.user.id) {
      return res.status(403).json({ message: 'Нет прав для удаления этого репоста' });
    }

    await Repost.findByIdAndDelete(req.params.id);

    // Отправляем real-time обновление всем подключенным пользователям
    const io = req.app.get('io');
    io.to('posts').emit('postDeleted', {
      postId: req.params.id
    });

    res.json({ message: 'Репост удален успешно' });
  } catch (error) {
    console.error('Error deleting repost:', error);
    res.status(500).json({ message: 'Error deleting repost' });
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

    const populated = await comment.populate('author', 'username displayName avatar premium');

    // Отправляем email-уведомление о новом комментарии
    try {
      const commenter = await User.findById(req.session.user.id);
      const postAuthor = await User.findById(post.author);
      
      if (commenter && postAuthor && postAuthor._id.toString() !== req.session.user.id) {
        await sendCommentNotification(commenter, postAuthor, post, populated);
      }
    } catch (error) {
      console.error('Error sending comment notification:', error);
    }

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
      .populate('author', 'username displayName avatar premium');

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
      
      // Отправляем email-уведомление о новом лайке
      try {
        const liker = await User.findById(userId);
        const postAuthor = await User.findById(post.author);
        
        if (liker && postAuthor && postAuthor._id.toString() !== userId) {
          await sendLikeNotification(liker, postAuthor, post);
        }
      } catch (error) {
        console.error('Error sending like notification:', error);
      }
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

// Удалить пост
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
    
    // Удаляем все репосты этого поста
    await Repost.deleteMany({ originalPost: post._id });
    
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

// Удалить комментарий
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