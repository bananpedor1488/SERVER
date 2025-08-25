const { Telegraf } = require('telegraf');
require('dotenv').config();

// Тестовый скрипт для проверки стабильности Telegram бота
async function testBotStability() {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  
  if (!token) {
    console.error('❌ TELEGRAM_BOT_TOKEN не найден в переменных окружения');
    return;
  }
  
  console.log('🔍 Тестирование стабильности Telegram бота...');
  console.log('Token:', token ? `${token.substring(0, 10)}...` : 'NOT SET');
  
  const bot = new Telegraf(token);
  
  try {
    // Тест 1: Проверка создания экземпляра бота
    console.log('\n1. Тестирование создания экземпляра бота...');
    if (bot && typeof bot.launch === 'function') {
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
    
    if (typeof bot.stop === 'function') {
      console.log('✅ bot.stop() доступен');
    } else {
      console.log('❌ bot.stop() недоступен (это нормально для Telegraf)');
    }
    
    // Тест 3: Проверка запуска и остановки
    console.log('\n3. Тестирование запуска и остановки...');
    
    try {
      console.log('🚀 Запуск бота...');
      await bot.launch();
      console.log('✅ Бот запущен успешно');
      
      // Ждем немного
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      console.log('🛑 Остановка бота...');
      bot.stopPolling();
      console.log('✅ Бот остановлен успешно');
      
    } catch (error) {
      console.error('❌ Ошибка при запуске/остановке бота:', error.message);
    }
    
    console.log('\n🎉 Тестирование завершено!');
    
  } catch (error) {
    console.error('❌ Ошибка при тестировании:', error.message);
  }
}

testBotStability();
