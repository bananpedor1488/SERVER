const express = require('express');
const bcrypt = require('bcrypt');
const User = require('../models/User');
const router = express.Router();

// Специальный роут для создания первого админа (без авторизации)
router.post('/create-first-admin', async (req, res) => {
  try {
    // Проверяем, есть ли уже админы в системе
    const existingAdmins = await User.countDocuments({ role: 'admin' });
    
    if (existingAdmins > 0) {
      return res.status(403).json({ 
        error: 'Админы уже существуют в системе. Используйте обычную авторизацию.' 
      });
    }

    const { username, email, password, displayName } = req.body;

    // Валидация
    if (!username || !email || !password) {
      return res.status(400).json({ 
        error: 'Username, email и password обязательны' 
      });
    }

    // Проверяем, не существует ли пользователь
    const existingUser = await User.findOne({
      $or: [{ username }, { email }]
    });

    if (existingUser) {
      return res.status(400).json({ 
        error: 'Пользователь с таким username или email уже существует' 
      });
    }

    // Хешируем пароль
    const hashedPassword = await bcrypt.hash(password, 10);

    // Создаем админа
    const admin = new User({
      username,
      email: email.toLowerCase(),
      password: hashedPassword,
      displayName: displayName || username,
      role: 'admin',
      emailVerified: true,
      premium: true,
      points: 10000,
      bio: 'Системный администратор'
    });

    await admin.save();

    res.json({
      message: 'Первый админ создан успешно!',
      admin: {
        id: admin._id,
        username: admin.username,
        email: admin.email,
        role: admin.role
      }
    });

  } catch (error) {
    console.error('Ошибка создания первого админа:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

module.exports = router;
