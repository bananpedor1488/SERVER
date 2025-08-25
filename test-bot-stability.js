const TelegramBot = require('node-telegram-bot-api');
require('dotenv').config();

// Тестовый скрипт для проверки стабильности Telegram бота
async function testBotStability() {
  const token = process.env.TELEGRAM_BOT_TOKEN || '8481849743:AAHOM7yAhs3evhou_rHxR5ktJwVsWxZfwrc';
  
  if (!token) {
    console.error('❌ TELEGRAM_BOT_TOKEN не найден в переменных окружения');
    return;
  }
  
  console.log('🔍 Тестирование стабильности Telegram бота...');
  console.log('Token:', token ? `${token.substring(0, 10)}...` : 'NOT SET');
  
  const bot = new TelegramBot(token, { polling: false }); // Создаем без polling для тестирования
  
  try {
    // Тест 1: Проверка создания экземпляра бота
    console.log('\n1. Тестирование создания экземпляра бота...');
    if (bot && typeof bot.getMe === 'function') {
      console.log('✅ Экземпляр бота создан успешно');
    } else {
      console.log('❌ Ошибка создания экземпляра бота');
      return;
    }
    
    // Тест 2: Проверка методов остановки
    console.log('\n2. Тестирование методов остановки...');
    
    if (typeof bot.stopPolling === 'function') {
      console.log('✅ bot.stopPolling() доступен');
    } else {
      console.log('❌ bot.stopPolling() недоступен');
    }
    
    if (typeof bot.stopWebhook === 'function') {
      console.log('✅ bot.stopWebhook() доступен');
    } else {
      console.log('❌ bot.stopWebhook() недоступен');
    }
    
    if (typeof bot.close === 'function') {
      console.log('✅ bot.close() доступен');
    } else {
      console.log('❌ bot.close() недоступен');
    }
    
    // Тест 3: Проверка подключения к API
    console.log('\n3. Тестирование подключения к API...');
    
    try {
      console.log('🚀 Проверка подключения к Telegram API...');
      const me = await bot.getMe();
      console.log('✅ Подключение к API успешно');
      console.log(`🤖 Bot info: @${me.username} (${me.first_name})`);
      
    } catch (error) {
      console.error('❌ Ошибка при подключении к API:', error.message);
    }
    
         // Тест 4: Проверка запуска и остановки polling
     console.log('\n4. Тестирование запуска и остановки polling...');
     
     try {
       console.log('🚀 Запуск polling...');
       bot.startPolling();
       console.log('✅ Polling запущен успешно');
       
       // Ждем немного
       await new Promise(resolve => setTimeout(resolve, 3000));
       
       console.log('🛑 Остановка polling...');
       try {
         bot.stopPolling();
         console.log('✅ Polling остановлен успешно');
       } catch (stopError) {
         console.log('⚠️ Ошибка при остановке polling (может быть уже остановлен):', stopError.message);
       }
       
     } catch (error) {
       console.error('❌ Ошибка при запуске/остановке polling:', error.message);
     }
    
    console.log('\n🎉 Тестирование завершено!');
    
  } catch (error) {
    console.error('❌ Ошибка при тестировании:', error.message);
     } finally {
     // Закрываем соединение
     if (bot && typeof bot.close === 'function') {
       try {
         bot.close();
         console.log('✅ Bot connection closed in test');
       } catch (closeError) {
         console.log('⚠️ Error closing bot connection in test:', closeError.message);
       }
     }
   }
}

testBotStability();
