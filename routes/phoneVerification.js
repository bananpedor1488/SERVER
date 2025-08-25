// Маршруты для верификации номера телефона
const express = require('express');
const router = express.Router();
const { verifyCode, getVerificationStatus, linkUserToChat, autoVerifyPhoneNumber } = require('../telegram-bot');

// Получить статус верификации телефона
router.get('/status', async (req, res) => {
  try {
    // Проверяем, что пользователь аутентифицирован
    if (!req.user || !req.user.id) {
      console.error('❌ User not authenticated in /status');
      return res.status(401).json({ 
        success: false, 
        message: 'Пользователь не аутентифицирован' 
      });
    }
    
    console.log('🔍 Checking verification status for user:', req.user.id);
    const status = await getVerificationStatus(req.user.id);
    
    if (!status.success) {
      return res.status(400).json({ 
        success: false, 
        message: status.message 
      });
    }
    
    res.json({
      success: true,
      phoneVerified: status.phoneVerified,
      phoneNumber: status.phoneNumber,
      phoneVerifiedAt: status.phoneVerifiedAt
    });
    
  } catch (error) {
    console.error('❌ Error getting phone verification status:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Ошибка сервера при получении статуса верификации' 
    });
  }
});

// Верифицировать номер телефона по коду
router.post('/verify', async (req, res) => {
  try {
    const { code } = req.body;
    
    if (!code) {
      return res.status(400).json({ 
        success: false, 
        message: 'Код верификации обязателен' 
      });
    }
    
    // Проверяем формат кода (должен быть числом)
    if (isNaN(code) || code.length < 5) {
      return res.status(400).json({ 
        success: false, 
        message: 'Неверный формат кода верификации' 
      });
    }
    
    const result = await verifyCode(code, req.user.id);
    
    if (!result.success) {
      return res.status(400).json({ 
        success: false, 
        message: result.message 
      });
    }
    
    res.json({
      success: true,
      message: result.message,
      phoneNumber: result.phoneNumber
    });
    
  } catch (error) {
    console.error('❌ Error verifying phone code:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Ошибка сервера при верификации кода' 
    });
  }
});

// Получить инструкции для верификации
router.get('/instructions', async (req, res) => {
  try {
    // Проверяем, что пользователь аутентифицирован
    if (!req.user || !req.user.id) {
      console.error('❌ User not authenticated in /instructions');
      return res.status(401).json({ 
        success: false, 
        message: 'Пользователь не аутентифицирован' 
      });
    }
    
    console.log('📋 Getting instructions for user:', req.user.id);
    const status = await getVerificationStatus(req.user.id);
    
    if (status.success && status.phoneVerified) {
      return res.json({
        success: true,
        verified: true,
        message: 'Ваш номер телефона уже верифицирован',
        phoneNumber: status.phoneNumber
      });
    }
    
    const instructions = {
      success: true,
      verified: false,
      message: 'Инструкции по автоматической верификации номера телефона',
      steps: [
        {
          step: 1,
          title: 'Нажмите кнопку "Перейти в бота"',
          description: 'Откроется Telegram с нашим ботом'
        },
        {
          step: 2,
          title: 'Отправьте команду /start',
          description: 'Бот покажет приветственное сообщение'
        },
        {
          step: 3,
          title: 'Нажмите кнопку "📱 Отправить номер телефона"',
          description: 'Подтвердите отправку вашего контакта'
        },
        {
          step: 4,
          title: 'Верификация завершена!',
          description: 'Вернитесь на сайт - ваш номер уже верифицирован автоматически'
        }
      ],
      botUsername: 'SocialSpaceWEB_bot',
      botLink: 'https://t.me/SocialSpaceWEB_bot',
      autoVerification: true
    };
    
    res.json(instructions);
    
  } catch (error) {
    console.error('❌ Error getting verification instructions:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Ошибка сервера при получении инструкций' 
    });
  }
});

// Инициация автоматической верификации
router.post('/start-auto-verification', async (req, res) => {
  try {
    // Проверяем, что пользователь аутентифицирован
    if (!req.user || !req.user.id) {
      console.error('❌ User not authenticated in /start-auto-verification');
      return res.status(401).json({ 
        success: false, 
        message: 'Пользователь не аутентифицирован' 
      });
    }
    
    const userId = req.user.id;
    console.log('🚀 Starting auto-verification for user:', userId);
    
    // Генерируем уникальный chatId для пользователя
    const chatId = `user_${userId}_${Date.now()}`;
    
    // Связываем пользователя с chatId
    const linkResult = await linkUserToChat(userId, chatId);
    
    if (!linkResult.success) {
      return res.status(400).json({
        success: false,
        message: linkResult.message
      });
    }
    
    res.json({
      success: true,
      message: 'Автоматическая верификация инициирована',
      botLink: 'https://t.me/SocialSpaceWEB_bot',
      chatId: chatId
    });
    
  } catch (error) {
    console.error('❌ Error starting auto-verification:', error);
    res.status(500).json({
      success: false,
      message: 'Ошибка сервера при инициации верификации'
    });
  }
});

module.exports = router;
