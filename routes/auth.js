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
    { expiresIn: '15m' }
  );

  const refreshToken = jwt.sign(
    payload,
    process.env.JWT_REFRESH_SECRET || 'fallback-refresh-secret',
    { expiresIn: '7d' }
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
    
    if (!username || !email || !password) {
      return res.status(400).json({ message: 'All fields are required' });
    }

    // Проверяем существующих пользователей
    const existingUser = await User.findOne({
      $or: [{ email }, { username }]
    });

    if (existingUser) {
      return res.status(400).json({ 
        message: existingUser.email === email ? 'Email already exists' : 'Username already exists'
      });
    }

    const hash = await bcrypt.hash(password, 10);
    const user = await User.create({ username, email, password: hash });
    
    // Генерируем JWT токены
    const tokens = generateTokens(user);
    
    console.log('User registered successfully:', user.username);
    
    res.status(201).json({ 
      message: 'Registration successful',
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
    res.status(500).json({ message: 'Registration failed', error: error.message });
  }
});

// Login
router.post('/login', async (req, res) => {
  try {
    console.log('Login attempt for:', req.body.email);
    
    const { email, password } = req.body;
    
    if (!email || !password) {
      return res.status(400).json({ message: 'Email and password are required' });
    }

    const user = await User.findOne({
      $or: [{ email }, { username: email }]
    });

    if (!user) {
      console.log('User not found:', email);
      return res.status(400).json({ message: 'User not found' });
    }

    const valid = await bcrypt.compare(password, user.password);
    if (!valid) {
      console.log('Invalid password for user:', email);
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    // Генерируем JWT токены
    const tokens = generateTokens(user);
    
    console.log('User logged in successfully:', user.username);
    
    res.json({ 
      message: 'Login successful',
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
    res.status(500).json({ message: 'Login failed', error: error.message });
  }
});

// Refresh tokens
router.post('/refresh', (req, res) => {
  const { refreshToken } = req.body;
  
  if (!refreshToken) {
    return res.status(401).json({ message: 'Refresh token required' });
  }

  jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET || 'fallback-refresh-secret', (err, user) => {
    if (err) {
      console.log('Refresh token verification failed:', err.message);
      return res.status(403).json({ message: 'Invalid refresh token' });
    }

    const tokens = generateTokens(user);
    console.log('Tokens refreshed for user:', user.username);
    
    res.json({
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

// Logout (опциональный - для JWT просто удаляем токены на клиенте)
router.post('/logout', (req, res) => {
  console.log('Logout request - JWT tokens should be removed on client side');
  res.json({ message: 'Logged out successfully' });
});

// Check auth status
router.get('/status', (req, res) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  
  if (!token) {
    return res.json({ authenticated: false });
  }

  jwt.verify(token, process.env.JWT_SECRET || 'fallback-secret', (err, user) => {
    if (err) {
      return res.json({ authenticated: false });
    }
    
    res.json({ 
      authenticated: true, 
      user: {
        id: user.id,
        username: user.username,
        email: user.email
      }
    });
  });
});

module.exports = router;