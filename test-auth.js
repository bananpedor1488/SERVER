const axios = require('axios');

// Тестовый скрипт для проверки аутентификации
async function testAuth() {
  const baseURL = 'https://server-pqqy.onrender.com';
  
  try {
    console.log('🔍 Тестирование аутентификации...');
    
    // Тест 1: Проверка health endpoint
    console.log('\n1. Тестирование health endpoint...');
    const healthResponse = await axios.get(`${baseURL}/api/health`);
    console.log('✅ Health endpoint работает:', healthResponse.data.status);
    
    // Тест 2: Попытка доступа к защищенному endpoint без токена
    console.log('\n2. Тестирование доступа без токена...');
    try {
      await axios.get(`${baseURL}/api/phone-verification/status`);
      console.log('❌ Ошибка: получили доступ без токена');
    } catch (error) {
      if (error.response && error.response.status === 401) {
        console.log('✅ Правильно: доступ заблокирован без токена');
        console.log('Сообщение:', error.response.data.message);
      } else {
        console.log('❌ Неожиданная ошибка:', error.message);
      }
    }
    
    // Тест 3: Попытка доступа с неверным токеном
    console.log('\n3. Тестирование доступа с неверным токеном...');
    try {
      await axios.get(`${baseURL}/api/phone-verification/status`, {
        headers: {
          'Authorization': 'Bearer invalid-token'
        }
      });
      console.log('❌ Ошибка: получили доступ с неверным токеном');
    } catch (error) {
      if (error.response && error.response.status === 403) {
        console.log('✅ Правильно: доступ заблокирован с неверным токеном');
        console.log('Сообщение:', error.response.data.message);
      } else {
        console.log('❌ Неожиданная ошибка:', error.message);
      }
    }
    
    console.log('\n🎉 Тестирование завершено!');
    
  } catch (error) {
    console.error('❌ Ошибка при тестировании:', error.message);
  }
}

testAuth();
