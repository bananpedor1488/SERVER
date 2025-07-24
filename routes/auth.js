const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const router = express.Router();

// Функция для генерации JWT токенов
const generateTokens = (user) => {
  const payload = {
    id: user._id.toString(),
    username: user.username,
    email: user.email
  };

  const accessToken = jwt.sign(
    payload,
    process.env.JWT_SECRET || 'fallback-secret',
    { expiresIn: '14d' }
  );

  const refreshToken = jwt.sign(
    payload,
    process.env.JWT_REFRESH_SECRET || 'fallback-refresh-secret',
    { expiresIn: '90d' }
  );

  return { accessToken, refreshToken };
};

// Middleware для логирования
router.use((req, res, next) => {
  console.log(`AUTH: ${req.method} ${req.path}`);
  console.log('Body:', req.body);
  next();
});

// Register
router.post('/register', async (req, res) => {
  try {
    console.log('Registration attempt:', { username: req.body.username, email: req.body.email });
    
    const { username, email, password } = req.body;
    
    // Валидация входных данных
    if (!username || !email || !password) {
      return res.status(400).json({ 
        message: 'Все поля обязательны для заполнения' 
      });
    }

    if (password.length < 6) {
      return res.status(400).json({ 
        message: 'Пароль должен содержать минимум 6 символов' 
      });
    }

    // Проверяем email формат
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ 
        message: 'Введите корректный email адрес' 
      });
    }

    // Проверяем существующих пользователей
    const existingUser = await User.findOne({
      $or: [{ email: email.toLowerCase() }, { username }]
    });

    if (existingUser) {
      const field = existingUser.email === email.toLowerCase() ? 'email' : 'username';
      return res.status(400).json({ 
        message: field === 'email' ? 'Пользователь с таким email уже существует' : 'Имя пользователя уже занято'
      });
    }

    // Хешируем пароль
    const hash = await bcrypt.hash(password, 12);
    
    // Создаем пользователя
    const user = await User.create({ 
      username, 
      email: email.toLowerCase(), 
      password: hash 
    });
    
    // Генерируем JWT токены
    const tokens = generateTokens(user);
    
    console.log('User registered successfully:', user.username);
    
    res.status(201).json({ 
      message: 'Регистрация прошла успешно',
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      user: {
        id: user._id.toString(),
        username: user.username,
        email: user.email
      }
    });
    
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ 
      message: 'Ошибка регистрации. Попробуйте еще раз', 
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Login
router.post('/login', async (req, res) => {
  try {
    console.log('Login attempt for:', req.body.email);
    
    const { email, password } = req.body;
    
    // Валидация входных данных
    if (!email || !password) {
      return res.status(400).json({ 
        message: 'Email и пароль обязательны для заполнения' 
      });
    }

    // Ищем пользователя по email или username
    const user = await User.findOne({
      $or: [
        { email: email.toLowerCase() }, 
        { username: email }
      ]
    });

    if (!user) {
      console.log('User not found:', email);
      return res.status(400).json({ 
        message: 'Пользователь не найден' 
      });
    }

    // Проверяем пароль
    const valid = await bcrypt.compare(password, user.password);
    if (!valid) {
      console.log('Invalid password for user:', email);
      return res.status(401).json({ 
        message: 'Неверный пароль' 
      });
    }

    // Генерируем JWT токены
    const tokens = generateTokens(user);
    
    console.log('User logged in successfully:', user.username);
    
    res.json({ 
      message: 'Вход выполнен успешно',
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      user: {
        id: user._id.toString(),
        username: user.username,
        email: user.email
      }
    });
    
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ 
      message: 'Ошибка входа. Попробуйте еще раз', 
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Refresh tokens
router.post('/refresh', (req, res) => {
  const { refreshToken } = req.body;
  
  if (!refreshToken) {
    return res.status(401).json({ 
      message: 'Refresh token обязателен',
      authenticated: false
    });
  }

  jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET || 'fallback-refresh-secret', (err, user) => {
    if (err) {
      console.log('Refresh token verification failed:', err.message);
      return res.status(403).json({ 
        message: 'Недействительный refresh token',
        authenticated: false
      });
    }

    // Генерируем новые токены
    const tokens = generateTokens(user);
    console.log('Tokens refreshed for user:', user.username);
    
    res.json({
      message: 'Токены обновлены',
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      user: { 
        id: user.id, 
        username: user.username,
        email: user.email
      }
    });
  });
});

// Logout (для JWT просто возвращаем успех)
router.post('/logout', (req, res) => {
  console.log('Logout request - JWT tokens should be removed on client side');
  res.json({ 
    message: 'Выход выполнен успешно',
    authenticated: false
  });
});

// Check auth status
router.get('/status', (req, res) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  
  if (!token) {
    return res.json({ 
      authenticated: false,
      message: 'Токен отсутствует'
    });
  }

  jwt.verify(token, process.env.JWT_SECRET || 'fallback-secret', (err, user) => {
    if (err) {
      console.log('Token verification failed:', err.message);
      return res.json({ 
        authenticated: false,
        message: 'Недействительный токен'
      });
    }
    
    res.json({ 
      authenticated: true,
      message: 'Пользователь авторизован',
      user: {
        id: user.id,
        username: user.username,
        email: user.email
      }
    });
  });
});

module.exports = router;