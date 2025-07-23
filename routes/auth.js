const express = require('express');
const bcrypt = require('bcrypt');
const User = require('../models/User');
const router = express.Router();

// Middleware для логирования авторизации
router.use((req, res, next) => {
  console.log(`AUTH: ${req.method} ${req.path}`);
  console.log('Session ID:', req.sessionID);
  console.log('Current user:', req.session?.user);
  next();
});

// Logout
router.post('/logout', (req, res) => {
  console.log('Logout attempt for user:', req.session?.user);
  
  if (req.session) {
    req.session.destroy((err) => {
      if (err) {
        console.error('Session destroy error:', err);
        return res.status(500).json({ message: 'Logout failed' });
      }
      
      // Очищаем cookie
      res.clearCookie('socialspace.sid', {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax'
      });
      
      console.log('User logged out successfully');
      res.json({ message: 'Logged out successfully' });
    });
  } else {
    res.json({ message: 'Already logged out' });
  }
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
    
    // Создаем сессию
    req.session.user = { 
      id: user._id.toString(), 
      username: user.username 
    };
    
    // Сохраняем сессию принудительно
    req.session.save((err) => {
      if (err) {
        console.error('Session save error:', err);
        return res.status(500).json({ message: 'Registration successful but session error' });
      }
      
      console.log('User registered and session created:', req.session.user);
      res.status(201).json({ 
        user: req.session.user,
        sessionId: req.sessionID
      });
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

    // Создаем сессию
    req.session.user = { 
      id: user._id.toString(), 
      username: user.username 
    };
    
    // Принудительно сохраняем сессию
    req.session.save((err) => {
      if (err) {
        console.error('Session save error during login:', err);
        return res.status(500).json({ message: 'Login successful but session error' });
      }
      
      console.log('User logged in successfully:', req.session.user);
      console.log('Session ID:', req.sessionID);
      
      res.json({ 
        user: req.session.user,
        sessionId: req.sessionID
      });
    });
    
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ message: 'Login failed', error: error.message });
  }
});

// Check session status
router.get('/status', (req, res) => {
  console.log('Auth status check');
  console.log('Session ID:', req.sessionID);
  console.log('User in session:', req.session?.user);
  
  if (req.session && req.session.user) {
    res.json({ 
      authenticated: true, 
      user: req.session.user,
      sessionId: req.sessionID
    });
  } else {
    res.json({ 
      authenticated: false,
      sessionId: req.sessionID
    });
  }
});

module.exports = router;