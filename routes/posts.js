const express = require('express');
const Post = require('../models/Post');
const Repost = require('../models/Repost');
const Comment = require('../models/Comment');
const User = require('../models/User');
const { sendLikeNotification, sendCommentNotification, sendRepostNotification } = require('../utils/notificationUtils');
const { uploadFiles, handleUploadError } = require('../middleware/upload');
const { uploadFileToImgBB } = require('../utils/imgbbUpload');
const path = require('path');
const fs = require('fs');
const router = express.Router();

// Функция для проверки конфигурации ImgBB
const checkImgBBConfig = () => {
  const hasApiKey = !!process.env.IMGBB_API_KEY;
  
  console.log('ImgBB конфигурация:');
  console.log('- IMGBB_API_KEY:', hasApiKey ? 'Настроен' : 'Не настроен');
  
  return hasApiKey;
};

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
    console.log('=== Создание нового поста ===');
    console.log('Пользователь:', req.session.user.id);
    console.log('Контент:', req.body.content);
    console.log('Файлы:', req.files ? req.files.length : 0);
    // Dropbox больше не используется
    
    const content = req.body.content?.trim();
    if (!content && (!req.files || req.files.length === 0)) {
      console.log('Ошибка: Нет контента и файлов');
      return res.status(400).json({ message: 'Content or files required' });
    }

    // Обрабатываем загруженные файлы
    const files = [];
    if (req.files && req.files.length > 0) {
      console.log(`Обрабатываем ${req.files.length} файлов...`);
      
      // Проверяем конфигурацию ImgBB
      const imgbbConfigured = checkImgBBConfig();
      
      if (!imgbbConfigured) {
        console.error('ImgBB не настроен! Необходимо настроить переменные окружения.');
        return res.status(500).json({ 
          message: 'Файловое хранилище не настроено. Обратитесь к администратору.' 
        });
      }
      
      for (const file of req.files) {
        try {
          // Проверяем размер файла (максимум 32MB для ImgBB)
          const maxSize = 32 * 1024 * 1024; // 32MB
          if (file.size > maxSize) {
            return res.status(400).json({ 
              message: `Файл ${file.originalname} слишком большой. Максимальный размер: 32MB` 
            });
          }
          
          // Загружаем файл в ImgBB
          console.log(`Загружаем файл ${file.originalname} в ImgBB...`);
          const imgbbResult = await uploadFileToImgBB(
            file.buffer, 
            file.originalname, 
            file.mimetype
          );
          
          files.push({
            filename: file.originalname,
            originalName: file.originalname,
            mimetype: file.mimetype,
            size: imgbbResult.size,
            url: imgbbResult.url,           // URL ImgBB
            displayUrl: imgbbResult.displayUrl, // URL для отображения
            deleteUrl: imgbbResult.deleteUrl,   // URL для удаления
            fileName: imgbbResult.fileName,
            id: imgbbResult.id
          });
          
          console.log(`Файл ${file.originalname} успешно загружен в ImgBB:`, {
            url: imgbbResult.url,
            displayUrl: imgbbResult.displayUrl,
            id: imgbbResult.id
          });
        } catch (uploadError) {
          console.error(`Ошибка загрузки файла ${file.originalname}:`, uploadError);
          console.error('Детали ошибки:', {
            message: uploadError.message,
            status: uploadError.status,
            error: uploadError.error
          });
          
          return res.status(500).json({ 
            message: `Ошибка загрузки файла ${file.originalname}: ${uploadError.message}` 
          });
        }
      }
    }

    console.log('Создаем пост в базе данных...');
    
    // Подготавливаем данные поста
    const postData = {
      author: req.session.user.id,
      content: content || '',
      files: files,
      postType: req.body.postType || 'text'
    };

    // Добавляем данные для интерактивных элементов
    if (req.body.postType === 'giveaway' && req.body.giveawayData) {
      const giveawayData = JSON.parse(req.body.giveawayData);
      postData.giveawayData = {
        prize: giveawayData.prize,
        description: giveawayData.description,
        endDate: giveawayData.endDate ? new Date(giveawayData.endDate) : null,
        participants: [],
        pointsRequired: giveawayData.pointsRequired || 0,
        isCompleted: false
      };
    }

    if (req.body.postType === 'poll' && req.body.pollData) {
      const pollData = JSON.parse(req.body.pollData);
      postData.pollData = {
        question: pollData.question,
        options: pollData.options.filter(opt => opt.trim()),
        allowMultiple: pollData.allowMultiple || false,
        endDate: pollData.endDate ? new Date(pollData.endDate) : null,
        votes: new Map(),
        isActive: true
      };
    }

    if (req.body.postType === 'quiz' && req.body.quizData) {
      const quizData = JSON.parse(req.body.quizData);
      postData.quizData = {
        question: quizData.question,
        options: quizData.options.filter(opt => opt.trim()),
        correctAnswer: quizData.correctAnswer || 0,
        explanation: quizData.explanation || '',
        attempts: new Map(),
        isActive: true
      };
    }

    const post = await Post.create(postData);

    console.log('Пост создан с ID:', post._id);
    const populated = await post.populate('author', 'username displayName avatar premium');
    
    // Добавляем пустой массив комментариев для консистентности
    const postWithComments = {
      ...populated.toJSON(),
      comments: [],
      commentsCount: 0,
      isRepost: false
    };

    console.log('Отправляем real-time обновление...');
    // Отправляем real-time обновление всем подключенным пользователям
    const io = req.app.get('io');
    io.to('posts').emit('newPost', postWithComments);

    console.log('Пост успешно создан и отправлен клиентам');
    res.status(201).json(postWithComments);
  } catch (error) {
    console.error('Error creating post:', error);
    console.error('Error details:', {
      message: error.message,
      stack: error.stack,
      name: error.name
    });
    
    // Provide more specific error messages
    if (error.name === 'ValidationError') {
      return res.status(400).json({ 
        message: 'Validation error', 
        details: error.message 
      });
    }
    
    if (error.message.includes('ImgBB')) {
      return res.status(500).json({ 
        message: 'File upload service unavailable. Please try again later.' 
      });
    }
    
    res.status(500).json({ 
      message: 'Error creating post',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
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

// ===== МАРШРУТЫ ДЛЯ ИНТЕРАКТИВНЫХ ЭЛЕМЕНТОВ =====

// Участие в розыгрыше
router.post('/:id/join-giveaway', isAuth, async (req, res) => {
  try {
    const post = await Post.findById(req.params.id);
    if (!post) return res.status(404).json({ message: 'Пост не найден' });
    
    if (post.postType !== 'giveaway') {
      return res.status(400).json({ message: 'Этот пост не является розыгрышем' });
    }

    const userId = req.session.user.id;
    
    // Проверяем, не участвует ли уже пользователь
    if (post.giveawayData.participants.includes(userId)) {
      return res.status(400).json({ message: 'Вы уже участвуете в этом розыгрыше' });
    }

    // Проверяем, не завершен ли розыгрыш
    if (post.giveawayData.isCompleted) {
      return res.status(400).json({ message: 'Розыгрыш уже завершен' });
    }

    // Проверяем, не истек ли срок
    if (post.giveawayData.endDate && new Date() > post.giveawayData.endDate) {
      return res.status(400).json({ message: 'Срок участия в розыгрыше истек' });
    }

    // Проверяем баллы, если требуется
    if (post.giveawayData.pointsRequired > 0) {
      const user = await User.findById(userId);
      if (!user || user.points < post.giveawayData.pointsRequired) {
        return res.status(400).json({ 
          message: `Недостаточно баллов. Требуется: ${post.giveawayData.pointsRequired}` 
        });
      }
      
      // Списываем баллы
      user.points -= post.giveawayData.pointsRequired;
      await user.save();
    }

    // Добавляем участника
    post.giveawayData.participants.push(userId);
    await post.save();

    // Отправляем real-time обновление
    const io = req.app.get('io');
    io.to('posts').emit('giveawayUpdate', {
      postId: post._id.toString(),
      participantsCount: post.giveawayData.participants.length
    });

    res.json({ 
      message: 'Вы успешно присоединились к розыгрышу',
      participantsCount: post.giveawayData.participants.length
    });
  } catch (error) {
    console.error('Error joining giveaway:', error);
    res.status(500).json({ message: 'Ошибка при участии в розыгрыше' });
  }
});

// Завершить розыгрыш и выбрать победителя
router.post('/:id/complete-giveaway', isAuth, async (req, res) => {
  try {
    const post = await Post.findById(req.params.id);
    if (!post) return res.status(404).json({ message: 'Пост не найден' });
    
    if (post.postType !== 'giveaway') {
      return res.status(400).json({ message: 'Этот пост не является розыгрышем' });
    }

    // Проверяем, что пользователь - автор поста
    if (post.author.toString() !== req.session.user.id) {
      return res.status(403).json({ message: 'Только автор может завершить розыгрыш' });
    }

    if (post.giveawayData.isCompleted) {
      return res.status(400).json({ message: 'Розыгрыш уже завершен' });
    }

    if (post.giveawayData.participants.length === 0) {
      return res.status(400).json({ message: 'Нет участников для розыгрыша' });
    }

    // Выбираем случайного победителя
    const randomIndex = Math.floor(Math.random() * post.giveawayData.participants.length);
    const winnerId = post.giveawayData.participants[randomIndex];
    
    post.giveawayData.winner = winnerId;
    post.giveawayData.isCompleted = true;
    await post.save();

    // Получаем информацию о победителе
    const winner = await User.findById(winnerId).select('username displayName');

    // Отправляем real-time обновление
    const io = req.app.get('io');
    io.to('posts').emit('giveawayCompleted', {
      postId: post._id.toString(),
      winner: winner,
      participantsCount: post.giveawayData.participants.length
    });

    res.json({ 
      message: 'Розыгрыш завершен',
      winner: winner,
      participantsCount: post.giveawayData.participants.length
    });
  } catch (error) {
    console.error('Error completing giveaway:', error);
    res.status(500).json({ message: 'Ошибка при завершении розыгрыша' });
  }
});

// Голосование в опросе
router.post('/:id/vote-poll', isAuth, async (req, res) => {
  try {
    const post = await Post.findById(req.params.id);
    if (!post) return res.status(404).json({ message: 'Пост не найден' });
    
    if (post.postType !== 'poll') {
      return res.status(400).json({ message: 'Этот пост не является опросом' });
    }

    const userId = req.session.user.id;
    const { optionIndex } = req.body;

    if (optionIndex < 0 || optionIndex >= post.pollData.options.length) {
      return res.status(400).json({ message: 'Неверный вариант ответа' });
    }

    // Проверяем, не истек ли срок
    if (post.pollData.endDate && new Date() > post.pollData.endDate) {
      return res.status(400).json({ message: 'Срок голосования истек' });
    }

    if (!post.pollData.isActive) {
      return res.status(400).json({ message: 'Опрос неактивен' });
    }

    // Получаем текущие голоса пользователя
    const userVotes = post.pollData.votes.get(userId.toString()) || [];

    if (!post.pollData.allowMultiple) {
      // Одиночный выбор - заменяем предыдущий голос
      post.pollData.votes.set(userId.toString(), [optionIndex]);
    } else {
      // Множественный выбор - добавляем/удаляем голос
      if (userVotes.includes(optionIndex)) {
        userVotes.splice(userVotes.indexOf(optionIndex), 1);
      } else {
        userVotes.push(optionIndex);
      }
      post.pollData.votes.set(userId.toString(), userVotes);
    }

    await post.save();

    // Отправляем real-time обновление
    const io = req.app.get('io');
    io.to('posts').emit('pollUpdate', {
      postId: post._id.toString(),
      votes: Object.fromEntries(post.pollData.votes)
    });

    res.json({ 
      message: 'Голос засчитан',
      userVotes: userVotes
    });
  } catch (error) {
    console.error('Error voting in poll:', error);
    res.status(500).json({ message: 'Ошибка при голосовании' });
  }
});

// Ответ на квиз
router.post('/:id/answer-quiz', isAuth, async (req, res) => {
  try {
    const post = await Post.findById(req.params.id);
    if (!post) return res.status(404).json({ message: 'Пост не найден' });
    
    if (post.postType !== 'quiz') {
      return res.status(400).json({ message: 'Этот пост не является квизом' });
    }

    const userId = req.session.user.id;
    const { answerIndex } = req.body;

    if (answerIndex < 0 || answerIndex >= post.quizData.options.length) {
      return res.status(400).json({ message: 'Неверный вариант ответа' });
    }

    if (!post.quizData.isActive) {
      return res.status(400).json({ message: 'Квиз неактивен' });
    }

    // Проверяем, не отвечал ли уже пользователь
    if (post.quizData.attempts.has(userId.toString())) {
      return res.status(400).json({ message: 'Вы уже отвечали на этот квиз' });
    }

    // Сохраняем ответ
    post.quizData.attempts.set(userId.toString(), answerIndex);
    await post.save();

    // Проверяем правильность ответа
    const isCorrect = answerIndex === post.quizData.correctAnswer;
    const explanation = post.quizData.explanation || '';

    // Отправляем real-time обновление
    const io = req.app.get('io');
    io.to('posts').emit('quizAnswer', {
      postId: post._id.toString(),
      userId: userId,
      answerIndex: answerIndex,
      isCorrect: isCorrect
    });

    res.json({ 
      correct: isCorrect,
      explanation: explanation,
      correctAnswer: post.quizData.correctAnswer
    });
  } catch (error) {
    console.error('Error answering quiz:', error);
    res.status(500).json({ message: 'Ошибка при ответе на квиз' });
  }
});

// Добавить реакцию
router.post('/:id/reaction', isAuth, async (req, res) => {
  try {
    const post = await Post.findById(req.params.id);
    if (!post) return res.status(404).json({ message: 'Пост не найден' });

    const userId = req.session.user.id;
    const { reactionType } = req.body;

    const validReactions = ['laugh', 'love', 'wow', 'sad', 'angry'];
    if (!validReactions.includes(reactionType)) {
      return res.status(400).json({ message: 'Неверный тип реакции' });
    }

    // Инициализируем Map если не существует
    if (!post.reactions) {
      post.reactions = new Map();
    }

    // Получаем текущие реакции пользователя для этого типа
    const userReactions = post.reactions.get(reactionType) || [];
    
    if (userReactions.includes(userId)) {
      // Убираем реакцию
      const index = userReactions.indexOf(userId);
      userReactions.splice(index, 1);
    } else {
      // Добавляем реакцию
      userReactions.push(userId);
    }

    post.reactions.set(reactionType, userReactions);
    await post.save();

    // Отправляем real-time обновление
    const io = req.app.get('io');
    io.to('posts').emit('reactionUpdate', {
      postId: post._id.toString(),
      reactionType: reactionType,
      count: userReactions.length,
      userId: userId
    });

    res.json({ 
      reactionType: reactionType,
      count: userReactions.length,
      hasReacted: userReactions.includes(userId)
    });
  } catch (error) {
    console.error('Error updating reaction:', error);
    res.status(500).json({ message: 'Ошибка при обновлении реакции' });
  }
});

module.exports = router;