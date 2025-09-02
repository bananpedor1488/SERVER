// Telegram бот для верификации номеров телефонов

const TelegramBot = require('node-telegram-bot-api');
const mongoose = require('mongoose');
const User = require('./models/User');

// Глобальный флаг для предотвращения множественных экземпляров
let botInstance = null;
let isInitialized = false;

// Токен бота
const token = '8481849743:AAHOM7yAhs3evhou_rHxR5ktJwVsWxZfwrc';

// Состояния пользователей (временное хранилище)
const userStates = new Map();

// Проверка подключения к MongoDB
const checkDBConnection = async () => {
  try {
    if (mongoose.connection.readyState === 1) {
      return true;
    } else {
      return false;
    }
  } catch (error) {
    return false;
  }
};

// Функция для создания и настройки бота
const createBot = () => {
  if (botInstance) {
    return botInstance;
  }

  botInstance = new TelegramBot(token, { polling: false });

  // Обработка команды /start
  botInstance.onText(/\/start/, async (msg) => {
    const chatId = msg.chat.id;
    const username = msg.from.username || msg.from.first_name;
    
    const welcomeMessage = `
🤖 **Добро пожаловать в SocialSpace!**

Для автоматической верификации номера телефона, пожалуйста, нажмите кнопку ниже и отправьте свой контакт.

📱 Это необходимо для:
• Безопасности аккаунта
• Восстановления доступа
• Подтверждения личности

_Ваш номер будет использоваться только для верификации._
_После отправки контакта верификация произойдет автоматически!_
    `;
    
    const keyboard = {
      reply_markup: {
        keyboard: [
          [{
            text: '📱 Отправить номер телефона',
            request_contact: true
          }]
        ],
        resize_keyboard: true,
        one_time_keyboard: true
      }
    };
    
    botInstance.sendMessage(chatId, welcomeMessage, { parse_mode: 'Markdown' });
    botInstance.sendMessage(chatId, 'Нажмите кнопку для автоматической верификации:', keyboard);
  });

  // Обработка получения контакта
  botInstance.on('contact', async (msg) => {
    const chatId = msg.chat.id;
    const contact = msg.contact;
    const username = msg.from.username || msg.from.first_name;
    
    try {
      // Проверяем, что контакт принадлежит пользователю
      if (contact.user_id !== msg.from.id) {
        botInstance.sendMessage(chatId, '❌ Ошибка: контакт должен принадлежать вам.');
        return;
      }
      
      // Форматируем номер телефона
      let phoneNumber = contact.phone_number;
      if (phoneNumber.startsWith('+')) {
        phoneNumber = phoneNumber.substring(1);
      }
      
      // Проверяем, не используется ли номер уже другим пользователем
      const existingUser = await User.findOne({ 
        phoneNumber: phoneNumber,
        phoneVerified: true 
      });
      
      if (existingUser) {
        botInstance.sendMessage(chatId, '❌ Этот номер телефона уже используется другим пользователем.');
        return;
      }
      
      // Сохраняем номер в состоянии пользователя
      userStates.set(chatId, {
        phoneNumber: phoneNumber,
        username: username,
        timestamp: Date.now()
      });
      
      const successMessage = `
🎉 **Верификация успешно завершена!**

✅ Ваш номер телефона +${phoneNumber} автоматически подтвержден.

Теперь вы можете вернуться на сайт SocialSpace - ваш номер уже верифицирован!

Спасибо за использование нашего сервиса! 🚀
      `;
      
      botInstance.sendMessage(chatId, successMessage, { 
        parse_mode: 'Markdown',
        reply_markup: {
          remove_keyboard: true
        }
      });
      
      // Автоматически верифицируем номер для всех пользователей с этим chatId
      await autoVerifyPhoneNumber(chatId, phoneNumber);
      
    } catch (error) {
      console.error('Error processing contact:', error);
      botInstance.sendMessage(chatId, '❌ Произошла ошибка при обработке контакта. Попробуйте позже.');
    }
  });

  // Обработка текстовых сообщений
  botInstance.on('message', (msg) => {
    const chatId = msg.chat.id;
    
    // Игнорируем команды и контакты (они обрабатываются отдельно)
    if (msg.text && !msg.text.startsWith('/')) {
      botInstance.sendMessage(chatId, '📱 Пожалуйста, используйте кнопку "Отправить номер телефона" для верификации.');
    }
  });

  // Обработка ошибок - только критические
  botInstance.on('error', (error) => {
    // Игнорируем 409 и 429 ошибки для уменьшения логирования
    if (error.code === 'ETELEGRAM' && error.response) {
      const statusCode = error.response.statusCode;
      if (statusCode === 409) {
        // Конфликт - другой экземпляр бота уже работает
        isInitialized = false;
        return;
      }
      if (statusCode === 429) {
        // Rate limiting - просто ждем
        return;
      }
    }
    
    // Логируем только серьезные ошибки
    console.error('Telegram bot error:', error.message);
  });

  botInstance.on('polling_error', (error) => {
    // Игнорируем 409 и 429 ошибки для уменьшения логирования
    if (error.code === 'ETELEGRAM' && error.response) {
      const statusCode = error.response.statusCode;
      if (statusCode === 409) {
        // Конфликт - другой экземпляр бота уже работает
        isInitialized = false;
        return;
      }
      if (statusCode === 429) {
        // Rate limiting - просто ждем
        return;
      }
    }
    
    // Логируем только серьезные ошибки
    console.error('Telegram bot polling error:', error.message);
  });

  return botInstance;
};

// Функция для верификации кода на сайте
const verifyCode = async (code, userId) => {
  try {
    // Проверяем, существует ли код в состояниях
    const userState = userStates.get(parseInt(code));
    
    if (!userState) {
      return { success: false, message: 'Код верификации не найден или устарел' };
    }
    
    // Проверяем время жизни кода (10 минут)
    const now = Date.now();
    const codeAge = now - userState.timestamp;
    const maxAge = 10 * 60 * 1000; // 10 минут
    
    if (codeAge > maxAge) {
      userStates.delete(parseInt(code));
      return { success: false, message: 'Код верификации устарел. Получите новый код.' };
    }
    
    // Находим пользователя в БД
    const user = await User.findById(userId);
    if (!user) {
      return { success: false, message: 'Пользователь не найден' };
    }
    
    // Проверяем, не используется ли номер уже
    const existingUser = await User.findOne({ 
      phoneNumber: userState.phoneNumber,
      phoneVerified: true,
      _id: { $ne: userId }
    });
    
    if (existingUser) {
      return { success: false, message: 'Этот номер телефона уже используется другим пользователем' };
    }
    
    // Обновляем пользователя
    user.phoneNumber = userState.phoneNumber;
    user.phoneVerified = true;
    user.phoneVerifiedAt = new Date();
    await user.save();
    
    // Удаляем код из состояний
    userStates.delete(parseInt(code));
    
    // Отправляем уведомление в Telegram
    const successMessage = `
🎉 **Верификация успешно завершена!**

✅ Ваш номер телефона +${userState.phoneNumber} подтвержден.

Теперь вы можете использовать все функции SocialSpace.

Спасибо за использование нашего сервиса! 🚀
    `;
    
    const bot = createBot();
    bot.sendMessage(parseInt(code), successMessage, { parse_mode: 'Markdown' });
    
    return { 
      success: true, 
      message: 'Номер телефона успешно верифицирован',
      phoneNumber: userState.phoneNumber
    };
    
  } catch (error) {
    console.error('Error verifying code:', error);
    return { success: false, message: 'Ошибка при верификации кода' };
  }
};

// Функция для получения статуса верификации
const getVerificationStatus = async (userId) => {
  try {
    const user = await User.findById(userId);
    if (!user) {
      return { success: false, message: 'Пользователь не найден' };
    }
    
    return {
      success: true,
      phoneVerified: user.phoneVerified || false,
      phoneNumber: user.phoneNumber || null,
      phoneVerifiedAt: user.phoneVerifiedAt || null
    };
  } catch (error) {
    console.error('Error getting verification status:', error);
    return { success: false, message: 'Ошибка при получении статуса' };
  }
};

// Функция для автоматической верификации номера телефона
const autoVerifyPhoneNumber = async (chatId, phoneNumber) => {
  try {
    // Сначала ищем пользователя по chatId (если он был сохранен)
    let users = await User.find({ 
      telegramChatId: chatId,
      phoneVerified: false 
    });
    
    // Если не нашли по chatId, ищем по номеру телефона
    if (users.length === 0) {
      users = await User.find({ 
        phoneNumber: phoneNumber,
        phoneVerified: false 
      });
    }
    
    // Если все еще не нашли, ищем пользователей без номера телефона (для новых пользователей)
    if (users.length === 0) {
      users = await User.find({ 
        phoneNumber: { $exists: false },
        phoneVerified: false 
      });
    }
    
    if (users.length > 0) {
      // Верифицируем всех найденных пользователей
      for (const user of users) {
        user.phoneNumber = phoneNumber;
        user.phoneVerified = true;
        user.phoneVerifiedAt = new Date();
        user.telegramChatId = chatId; // Сохраняем chatId для будущих верификаций
        await user.save();
      }
    } else {
      // Если пользователь не найден, сохраняем информацию для последующей верификации
      
      // Создаем временную запись для последующей верификации
      const tempUser = new User({
        phoneNumber: phoneNumber,
        phoneVerified: true,
        phoneVerifiedAt: new Date(),
        telegramChatId: chatId,
        username: `temp_${chatId}`,
        email: `temp_${chatId}@temp.com`,
        emailVerified: true // Временно верифицируем email для temp пользователя
      });
      
      await tempUser.save();
    }
    
    return { success: true, message: 'Номер телефона автоматически верифицирован' };
  } catch (error) {
    console.error('Error auto-verifying phone number:', error);
    return { success: false, message: 'Ошибка при автоматической верификации' };
  }
};

// Очистка устаревших кодов каждые 5 минут
setInterval(() => {
  const now = Date.now();
  const maxAge = 10 * 60 * 1000; // 10 минут
  
  for (const [code, state] of userStates.entries()) {
    if (now - state.timestamp > maxAge) {
      userStates.delete(code);
    }
  }
}, 5 * 60 * 1000); // 5 минут

// Функция для принудительной остановки всех экземпляров бота
const forceStopBot = async () => {
  try {
    isInitialized = false;
    
    if (botInstance) {
      // Останавливаем polling если он запущен
      if (typeof botInstance.stopPolling === 'function') {
        try {
          botInstance.stopPolling();
        } catch (pollingError) {
          // Polling might already be stopped
        }
      }
      
      // Останавливаем webhook если он запущен
      if (typeof botInstance.stopWebhook === 'function') {
        try {
          botInstance.stopWebhook();
        } catch (webhookError) {
          // Webhook might already be stopped
        }
      }
      
      botInstance = null;
    }
  } catch (error) {
    console.error('Error force stopping bot:', error);
  }
};

// Запуск бота
const startBot = async () => {
  // Проверяем, не запущен ли уже бот
  if (isInitialized) {
    return;
  }
  
  try {
    // Проверяем подключение к БД
    const isConnected = await checkDBConnection();
    if (!isConnected) {
      // Ждем подключения к БД
      let attempts = 0;
      while (mongoose.connection.readyState !== 1 && attempts < 30) {
        await new Promise(resolve => setTimeout(resolve, 1000));
        attempts++;
      }
      
      if (mongoose.connection.readyState !== 1) {
        throw new Error('MongoDB connection timeout');
      }
    }
    
    // Проверяем, что токен бота существует
    if (!token) {
      throw new Error('Telegram bot token is not configured');
    }
    
    const bot = createBot();
    
    // Проверяем, что бот работает
    try {
      const me = await bot.getMe();
      
      // Если все проверки пройдены, запускаем polling только если он не запущен
      if (!bot.isPolling()) {
        bot.startPolling();
        isInitialized = true;
      }
      
    } catch (launchError) {
      // Если это rate limiting, ждем и пробуем снова
      if (launchError.code === 'ETELEGRAM' && launchError.response && launchError.response.statusCode === 429) {
        const retryAfter = launchError.response.headers['retry-after'] || 60;
        
        await new Promise(resolve => setTimeout(resolve, retryAfter * 1000));
        
        try {
          const me = await bot.getMe();
          
          // Если все проверки пройдены, запускаем polling только если он не запущен
          if (!bot.isPolling()) {
            bot.startPolling();
            isInitialized = true;
          }
          
        } catch (retryError) {
          console.error('Error after rate limit retry:', retryError);
          throw retryError;
        }
      } else if (launchError.code === 'ETELEGRAM' && launchError.response && launchError.response.statusCode === 409) {
        // Конфликт - другой экземпляр уже работает, просто выходим
        return;
      } else {
        throw launchError;
      }
    }
    
  } catch (error) {
    console.error('Error starting Telegram bot:', error);
    // Не выбрасываем ошибку, чтобы сервер продолжал работать
  }
};

// Функция для связывания пользователя с chatId
const linkUserToChat = async (userId, chatId) => {
  try {
    const user = await User.findById(userId);
    if (!user) {
      return { success: false, message: 'Пользователь не найден' };
    }
    
    // Сохраняем chatId в пользователе для автоматической верификации
    user.telegramChatId = chatId;
    await user.save();
    
    return { success: true, message: 'Пользователь связан с Telegram' };
  } catch (error) {
    console.error('Error linking user to chat:', error);
    return { success: false, message: 'Ошибка при связывании пользователя' };
  }
};

// Экспорт функций для использования в других модулях
module.exports = {
  bot: () => createBot(),
  verifyCode,
  getVerificationStatus,
  startBot,
  linkUserToChat,
  autoVerifyPhoneNumber,
  forceStopBot
};

// Обработка закрытия процесса
process.on('SIGINT', async () => {
  try {
    await forceStopBot();
  } catch (error) {
    console.error('Error during graceful shutdown:', error);
  }
  // Даем время на завершение операций
  setTimeout(() => {
    process.exit(0);
  }, 2000);
});

process.on('SIGTERM', async () => {
  try {
    await forceStopBot();
  } catch (error) {
    console.error('Error during graceful shutdown:', error);
  }
  // Даем время на завершение операций
  setTimeout(() => {
    process.exit(0);
  }, 2000);
});

// Обработка необработанных ошибок
process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
  // Не завершаем процесс сразу, даем время на логирование
  setTimeout(() => {
    process.exit(1);
  }, 1000);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  // Не завершаем процесс сразу, даем время на логирование
  setTimeout(() => {
    process.exit(1);
  }, 1000);
});

// Бот теперь запускается из основного сервера
// Убираем автономный запуск
