// Маршруты для верификации номера телефона
const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const { verifyCode, getVerificationStatus } = require('../telegram-bot');

// Получить статус верификации телефона
router.get('/status', auth, async (req, res) => {
  try {
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
router.post('/verify', auth, async (req, res) => {
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
router.get('/instructions', auth, async (req, res) => {
  try {
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
      message: 'Инструкции по верификации номера телефона',
      steps: [
        {
          step: 1,
          title: 'Откройте Telegram',
          description: 'Перейдите в приложение Telegram на вашем устройстве'
        },
        {
          step: 2,
          title: 'Найдите нашего бота',
          description: 'Найдите бота @SocialSpaceVerificationBot или перейдите по ссылке'
        },
        {
          step: 3,
          title: 'Отправьте контакт',
          description: 'Нажмите кнопку "📱 Отправить номер телефона" и подтвердите отправку'
        },
        {
          step: 4,
          title: 'Получите код',
          description: 'Бот отправит вам код верификации (действителен 10 минут)'
        },
        {
          step: 5,
          title: 'Введите код на сайте',
          description: 'Вернитесь на сайт и введите полученный код в поле ниже'
        }
      ],
             botUsername: 'SocialSpaceWEB_bot',
       botLink: 'https://t.me/SocialSpaceWEB_bot'
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

module.exports = router;
