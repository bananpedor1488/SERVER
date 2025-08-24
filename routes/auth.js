const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { generateVerificationCode, sendVerificationEmail, resendVerificationEmail, testEmailConnection } = require('../utils/emailUtil22s');
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

// Register - первый этап (создание пользователя и отправка кода)
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
    
    // Генерируем код подтверждения
    const verificationCode = generateVerificationCode();
    const verificationExpires = new Date(Date.now() + 10 * 60 * 1000); // 10 минут
    
    // Создаем пользователя (не верифицированного)
    const user = await User.create({ 
      username, 
      email: email.toLowerCase(), 
      password: hash,
      emailVerified: false,
      emailVerificationCode: verificationCode,
      emailVerificationExpires: verificationExpires
    });
    
    // Отправляем код подтверждения на email
    const emailSent = await sendVerificationEmail(email, verificationCode);
    
    if (!emailSent) {
      // Если email не отправлен, удаляем пользователя
      await User.findByIdAndDelete(user._id);
      return res.status(500).json({ 
        message: 'Ошибка отправки кода подтверждения. Попробуйте еще раз' 
      });
    }
    
    console.log('User registered successfully, verification code sent:', user.username);
    
    res.status(201).json({ 
      message: 'Код подтверждения отправлен на ваш email',
      userId: user._id.toString(),
      email: user.email,
      requiresVerification: true
    });
    
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ 
      message: 'Ошибка регистрации. Попробуйте еще раз', 
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Verify email - второй этап (подтверждение кода)
router.post('/verify-email', async (req, res) => {
  try {
    const { userId, code } = req.body;
    
    if (!userId || !code) {
      return res.status(400).json({ 
        message: 'ID пользователя и код подтверждения обязательны' 
      });
    }

    // Находим пользователя
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ 
        message: 'Пользователь не найден' 
      });
    }

    // Проверяем, не верифицирован ли уже email
    if (user.emailVerified) {
      return res.status(400).json({ 
        message: 'Email уже подтвержден' 
      });
    }

    // Проверяем код и время истечения
    if (!user.emailVerificationCode || user.emailVerificationCode !== code) {
      return res.status(400).json({ 
        message: 'Неверный код подтверждения' 
      });
    }

    if (new Date() > user.emailVerificationExpires) {
      return res.status(400).json({ 
        message: 'Код подтверждения истек. Запросите новый код' 
      });
    }

    // Подтверждаем email
    user.emailVerified = true;
    user.emailVerificationCode = undefined;
    user.emailVerificationExpires = undefined;
    await user.save();

    // Генерируем JWT токены
    const tokens = generateTokens(user);
    
    console.log('Email verified successfully:', user.username);
    
    res.json({ 
      message: 'Email подтвержден успешно',
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      user: {
        id: user._id.toString(),
        username: user.username,
        email: user.email,
        displayName: user.displayName,
        bio: user.bio,
        avatar: user.avatar,
        emailVerified: user.emailVerified
      }
    });
    
  } catch (error) {
    console.error('Email verification error:', error);
    res.status(500).json({ 
      message: 'Ошибка подтверждения email. Попробуйте еще раз', 
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Resend verification code
router.post('/resend-verification', async (req, res) => {
  try {
    const { userId } = req.body;
    
    if (!userId) {
      return res.status(400).json({ 
        message: 'ID пользователя обязателен' 
      });
    }

    // Находим пользователя
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ 
        message: 'Пользователь не найден' 
      });
    }

    // Проверяем, не верифицирован ли уже email
    if (user.emailVerified) {
      return res.status(400).json({ 
        message: 'Email уже подтвержден' 
      });
    }

    // Генерируем новый код
    const verificationCode = generateVerificationCode();
    const verificationExpires = new Date(Date.now() + 10 * 60 * 1000); // 10 минут
    
    // Обновляем код в базе
    user.emailVerificationCode = verificationCode;
    user.emailVerificationExpires = verificationExpires;
    await user.save();

    // Отправляем новый код
    const emailSent = await resendVerificationEmail(user.email, verificationCode);
    
    if (!emailSent) {
      return res.status(500).json({ 
        message: 'Ошибка отправки кода подтверждения. Попробуйте еще раз' 
      });
    }
    
    console.log('Verification code resent for user:', user.username);
    
    res.json({ 
      message: 'Новый код подтверждения отправлен на ваш email'
    });
    
  } catch (error) {
    console.error('Resend verification error:', error);
    res.status(500).json({ 
      message: 'Ошибка отправки кода. Попробуйте еще раз', 
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

    // Проверяем верификацию email
    if (!user.emailVerified) {
      // Генерируем новый код подтверждения
      const verificationCode = generateVerificationCode();
      const verificationExpires = new Date(Date.now() + 10 * 60 * 1000); // 10 минут
      
      // Обновляем код в базе
      user.emailVerificationCode = verificationCode;
      user.emailVerificationExpires = verificationExpires;
      await user.save();

      // Отправляем код подтверждения
      const emailSent = await sendVerificationEmail(user.email, verificationCode);
      
      if (!emailSent) {
        return res.status(500).json({ 
          message: 'Ошибка отправки кода подтверждения. Попробуйте еще раз' 
        });
      }

      return res.status(403).json({ 
        message: 'Email не подтвержден. Код подтверждения отправлен на ваш email',
        requiresVerification: true,
        userId: user._id.toString(),
        email: user.email // Возвращаем email из базы данных
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
        email: user.email,
        displayName: user.displayName,
        bio: user.bio,
        avatar: user.avatar,
        emailVerified: user.emailVerified
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

// Тестовый endpoint для проверки email
router.get('/test-email', async (req, res) => {
  try {
    console.log('🧪 Testing email configuration...');
    
    // Проверяем переменные окружения
    console.log('📋 Environment variables:');
    console.log('   EMAIL_USER:', process.env.EMAIL_USER ? '✅ Set' : '❌ Missing');
    console.log('   EMAIL_PASSWORD:', process.env.EMAIL_PASSWORD ? '✅ Set' : '❌ Missing');
    
    if (!process.env.EMAIL_USER || !process.env.EMAIL_PASSWORD) {
      return res.status(400).json({
        error: 'Email configuration missing',
        EMAIL_USER: !!process.env.EMAIL_USER,
        EMAIL_PASSWORD: !!process.env.EMAIL_PASSWORD
      });
    }
    
    // Тестируем подключение
    const testResult = await testEmailConnection();
    
    if (testResult) {
      res.json({
        success: true,
        message: 'Email configuration is working',
        email: process.env.EMAIL_USER
      });
    } else {
      res.status(500).json({
        error: 'Email connection failed',
        email: process.env.EMAIL_USER
      });
    }
    
  } catch (error) {
    console.error('❌ Email test error:', error);
    res.status(500).json({
      error: 'Email test failed',
      message: error.message
    });
  }
});

// Change email endpoint
router.post('/change-email', async (req, res) => {
  try {
    const { userId, newEmail } = req.body;
    
    if (!userId || !newEmail) {
      return res.status(400).json({ 
        message: 'ID пользователя и новый email обязательны' 
      });
    }

    // Валидация email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(newEmail)) {
      return res.status(400).json({ 
        message: 'Введите корректный email адрес' 
      });
    }

    // Находим пользователя
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ 
        message: 'Пользователь не найден' 
      });
    }

    // Проверяем, не верифицирован ли уже email
    if (user.emailVerified) {
      return res.status(400).json({ 
        message: 'Email уже подтвержден' 
      });
    }

    // Проверяем, не занят ли новый email другим пользователем
    const existingUser = await User.findOne({ 
      email: newEmail.toLowerCase(),
      _id: { $ne: userId } // Исключаем текущего пользователя
    });

    if (existingUser) {
      return res.status(400).json({ 
        message: 'Пользователь с таким email уже существует' 
      });
    }

    // Генерируем новый код подтверждения
    const verificationCode = generateVerificationCode();
    const verificationExpires = new Date(Date.now() + 10 * 60 * 1000); // 10 минут
    
    // Обновляем email и код
    user.email = newEmail.toLowerCase();
    user.emailVerified = false;
    user.emailVerificationCode = verificationCode;
    user.emailVerificationExpires = verificationExpires;
    await user.save();

    // Отправляем новый код на новый email
    const emailSent = await sendVerificationEmail(newEmail, verificationCode);
    
    if (!emailSent) {
      // Если email не отправлен, откатываем изменения
      user.email = user.email; // Возвращаем старый email
      await user.save();
      return res.status(500).json({ 
        message: 'Ошибка отправки кода подтверждения. Попробуйте еще раз' 
      });
    }
    
    console.log('Email changed successfully for user:', user.username);
    
    res.json({ 
      message: 'Email изменен. Новый код подтверждения отправлен',
      email: newEmail
    });
    
  } catch (error) {
    console.error('Change email error:', error);
    res.status(500).json({ 
      message: 'Ошибка изменения email. Попробуйте еще раз', 
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

module.exports = router;