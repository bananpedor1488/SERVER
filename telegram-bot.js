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

Для верификации номера телефона, пожалуйста, нажмите кнопку ниже и отправьте свой контакт.

📱 Это необходимо для:
• Безопасности аккаунта
• Восстановления доступа
• Подтверждения личности

_Ваш номер будет использоваться только для верификации._
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
  bot.sendMessage(chatId, 'Нажмите кнопку для отправки контакта:', keyboard);
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
    
    const confirmMessage = `
✅ **Номер получен!**

📱 Ваш номер: +${phoneNumber}

Теперь перейдите на сайт SocialSpace и введите этот код для завершения верификации:

🔐 **Код верификации:** \`${chatId}\`

⚠️ **Важно:** 
• Код действителен 10 минут
• Введите код на сайте в разделе "Верификация телефона"
• Не передавайте код третьим лицам
  `;
    
    bot.sendMessage(chatId, confirmMessage, { 
      parse_mode: 'Markdown',
      reply_markup: {
        remove_keyboard: true
      }
    });
    
    console.log(`✅ Verification code ${chatId} generated for ${phoneNumber}`);
    
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
});

bot.on('polling_error', (error) => {
  console.error('❌ Telegram bot polling error:', error);
});

// Запуск бота
const startBot = async () => {
  try {
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
    
    console.log('🤖 Telegram bot started successfully');
    console.log('📱 Bot token:', token);
    console.log('🔗 Users can start the bot with /start');
  } catch (error) {
    console.error('❌ Error starting Telegram bot:', error);
    throw error;
  }
};

// Экспорт функций для использования в других модулях
module.exports = {
  bot,
  verifyCode,
  getVerificationStatus,
  startBot
};

// Бот теперь запускается из основного сервера
// Убираем автономный запуск
