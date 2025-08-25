// Telegram бот для верификации номеров телефонов
console.log('🤖 Loading telegram-bot.js...');

const TelegramBot = require('node-telegram-bot-api');
const mongoose = require('mongoose');
const User = require('./models/User');

// Токен бота
const token = '8481849743:AAHOM7yAhs3evhou_rHxR5ktJwVsWxZfwrc';

// Создание экземпляра бота
const bot = new TelegramBot(token, { polling: true });

// Состояния пользователей (временное хранилище)
const userStates = new Map();

// Проверка подключения к MongoDB
const checkDBConnection = async () => {
  try {
    if (mongoose.connection.readyState === 1) {
      console.log('✅ MongoDB already connected for Telegram bot');
      return true;
    } else {
      console.log('⚠️ MongoDB not connected, waiting for main server connection...');
      return false;
    }
  } catch (error) {
    console.error('❌ MongoDB connection check error:', error);
    return false;
  }
};

// Обработка команды /start
bot.onText(/\/start/, async (msg) => {
  const chatId = msg.chat.id;
  const username = msg.from.username || msg.from.first_name;
  
  console.log(`👤 User ${username} (${chatId}) started bot`);
  
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
  
  bot.sendMessage(chatId, welcomeMessage, { parse_mode: 'Markdown' });
  bot.sendMessage(chatId, 'Нажмите кнопку для автоматической верификации:', keyboard);
});

// Обработка получения контакта
bot.on('contact', async (msg) => {
  const chatId = msg.chat.id;
  const contact = msg.contact;
  const username = msg.from.username || msg.from.first_name;
  
  console.log(`📱 Contact received from ${username} (${chatId}): ${contact.phone_number}`);
  
  try {
    // Проверяем, что контакт принадлежит пользователю
    if (contact.user_id !== msg.from.id) {
      bot.sendMessage(chatId, '❌ Ошибка: контакт должен принадлежать вам.');
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
      bot.sendMessage(chatId, '❌ Этот номер телефона уже используется другим пользователем.');
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
    
    bot.sendMessage(chatId, successMessage, { 
      parse_mode: 'Markdown',
      reply_markup: {
        remove_keyboard: true
      }
    });
    
    console.log(`✅ Auto-verification completed for ${phoneNumber} (chatId: ${chatId})`);
    
    // Автоматически верифицируем номер для всех пользователей с этим chatId
    await autoVerifyPhoneNumber(chatId, phoneNumber);
    
  } catch (error) {
    console.error('❌ Error processing contact:', error);
    bot.sendMessage(chatId, '❌ Произошла ошибка при обработке контакта. Попробуйте позже.');
  }
});

// Обработка текстовых сообщений
bot.on('message', (msg) => {
  const chatId = msg.chat.id;
  
  // Игнорируем команды и контакты (они обрабатываются отдельно)
  if (msg.text && !msg.text.startsWith('/')) {
    bot.sendMessage(chatId, '📱 Пожалуйста, используйте кнопку "Отправить номер телефона" для верификации.');
  }
});

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
    
    bot.sendMessage(parseInt(code), successMessage, { parse_mode: 'Markdown' });
    
    console.log(`✅ Phone verification completed for user ${userId}: ${userState.phoneNumber}`);
    
    return { 
      success: true, 
      message: 'Номер телефона успешно верифицирован',
      phoneNumber: userState.phoneNumber
    };
    
  } catch (error) {
    console.error('❌ Error verifying code:', error);
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
    console.error('❌ Error getting verification status:', error);
    return { success: false, message: 'Ошибка при получении статуса' };
  }
};

// Функция для автоматической верификации номера телефона
const autoVerifyPhoneNumber = async (chatId, phoneNumber) => {
  try {
    // Находим пользователя по chatId (если он был сохранен)
    // Или верифицируем номер для всех пользователей с этим номером
    const users = await User.find({ 
      phoneNumber: phoneNumber,
      phoneVerified: false 
    });
    
    if (users.length > 0) {
      // Верифицируем всех пользователей с этим номером
      for (const user of users) {
        user.phoneVerified = true;
        user.phoneVerifiedAt = new Date();
        await user.save();
        
        console.log(`✅ Auto-verified phone for user ${user.username} (${user._id}): ${phoneNumber}`);
      }
    } else {
      // Если пользователь не найден, сохраняем информацию для последующей верификации
      console.log(`📝 Phone number ${phoneNumber} ready for verification (chatId: ${chatId})`);
    }
    
    return { success: true, message: 'Номер телефона автоматически верифицирован' };
  } catch (error) {
    console.error('❌ Error auto-verifying phone number:', error);
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
      console.log(`🗑️ Expired verification code removed: ${code}`);
    }
  }
}, 5 * 60 * 1000); // 5 минут

// Обработка ошибок
bot.on('error', (error) => {
  console.error('❌ Telegram bot error:', error);
  
  // Если ошибка связана с конфликтом, попробуем перезапустить бота
  if (error.code === 'ETELEGRAM' && error.response && error.response.statusCode === 409) {
    console.log('🔄 Detected bot conflict, attempting to restart...');
    setTimeout(() => {
      try {
        bot.stopPolling();
        setTimeout(() => {
          bot.startPolling();
          console.log('✅ Bot restarted successfully');
        }, 2000);
      } catch (restartError) {
        console.error('❌ Failed to restart bot:', restartError);
      }
    }, 1000);
  }
});

bot.on('polling_error', (error) => {
  console.error('❌ Telegram bot polling error:', error);
  
  // Если ошибка связана с конфликтом, попробуем перезапустить бота
  if (error.code === 'ETELEGRAM' && error.response && error.response.statusCode === 409) {
    console.log('🔄 Detected polling conflict, attempting to restart...');
    setTimeout(() => {
      try {
        bot.stopPolling();
        setTimeout(() => {
          bot.startPolling();
          console.log('✅ Bot polling restarted successfully');
        }, 2000);
      } catch (restartError) {
        console.error('❌ Failed to restart bot polling:', restartError);
      }
    }, 1000);
  }
});

// Обработка успешного подключения
bot.on('polling_start', () => {
  console.log('✅ Bot polling started successfully');
});

bot.on('polling_stop', () => {
  console.log('🛑 Bot polling stopped');
});

// Функция для принудительной остановки всех экземпляров бота
const forceStopBot = async () => {
  try {
    console.log('🛑 Force stopping bot...');
    
    // Останавливаем polling если он запущен
    if (bot && typeof bot.stopPolling === 'function') {
      bot.stopPolling();
      console.log('✅ Bot polling stopped');
    }
    
    // Останавливаем webhook если он запущен
    if (bot && typeof bot.stopWebhook === 'function') {
      bot.stopWebhook();
      console.log('✅ Bot webhook stopped');
    }
    
    // Для node-telegram-bot-api также можно использовать close()
    if (bot && typeof bot.close === 'function') {
      bot.close();
      console.log('✅ Bot connection closed');
    }
    
    console.log('✅ Bot force stopped');
  } catch (error) {
    console.error('❌ Error force stopping bot:', error);
  }
};

// Запуск бота
const startBot = async () => {
  try {
    console.log('🤖 Starting Telegram bot...');
    
    // Сначала принудительно останавливаем все экземпляры
    await forceStopBot();
    
    // Ждем немного перед запуском нового экземпляра
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Проверяем подключение к БД
    const isConnected = await checkDBConnection();
    if (!isConnected) {
      console.log('⏳ Waiting for MongoDB connection...');
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
    
    // Запускаем polling с обработкой ошибок (для node-telegram-bot-api)
    try {
      // Для node-telegram-bot-api polling запускается автоматически при создании
      // Проверяем, что бот работает
      const me = await bot.getMe();
      console.log('✅ Bot polling started successfully');
      console.log(`🤖 Bot info: @${me.username} (${me.first_name})`);
    } catch (launchError) {
      console.error('❌ Error starting bot polling:', launchError);
      throw launchError;
    }
    
    console.log('🤖 Telegram bot started successfully');
    console.log('📱 Bot token:', token ? `${token.substring(0, 10)}...` : 'NOT SET');
    console.log('🔗 Users can start the bot with /start');
    
  } catch (error) {
    console.error('❌ Error starting Telegram bot:', error);
    // Не выбрасываем ошибку, чтобы сервер продолжал работать
    console.log('⚠️ Telegram bot failed to start, but server continues running');
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
    
    console.log(`🔗 Linked user ${user.username} (${userId}) to chatId ${chatId}`);
    return { success: true, message: 'Пользователь связан с Telegram' };
  } catch (error) {
    console.error('❌ Error linking user to chat:', error);
    return { success: false, message: 'Ошибка при связывании пользователя' };
  }
};

// Экспорт функций для использования в других модулях
module.exports = {
  bot,
  verifyCode,
  getVerificationStatus,
  startBot,
  linkUserToChat,
  autoVerifyPhoneNumber,
  forceStopBot
};

// Обработка закрытия процесса
process.on('SIGINT', async () => {
  console.log('🛑 Received SIGINT, stopping bot gracefully...');
  try {
    await forceStopBot();
    console.log('✅ Bot stopped gracefully');
  } catch (error) {
    console.error('❌ Error during graceful shutdown:', error);
  }
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('🛑 Received SIGTERM, stopping bot gracefully...');
  try {
    await forceStopBot();
    console.log('✅ Bot stopped gracefully');
  } catch (error) {
    console.error('❌ Error during graceful shutdown:', error);
  }
  process.exit(0);
});

// Обработка необработанных ошибок
process.on('uncaughtException', (error) => {
  console.error('❌ Uncaught Exception:', error);
  // Не завершаем процесс сразу, даем время на логирование
  setTimeout(() => {
    process.exit(1);
  }, 1000);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
  // Не завершаем процесс сразу, даем время на логирование
  setTimeout(() => {
    process.exit(1);
  }, 1000);
});

// Бот теперь запускается из основного сервера
// Убираем автономный запуск
