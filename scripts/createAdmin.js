const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
const User = require('../models/User');
require('dotenv').config();

const createAdmin = async () => {
  try {
    // Подключаемся к MongoDB
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb+srv://biznestim777:FLAmF8jA8YdPuihY@cluster0.wtsrzsf.mongodb.net/');
    console.log('✅ Подключено к MongoDB');

    // Ищем твой аккаунт по username или email
    const yourUsername = 'admin'; // ← Твой username
    const yourEmail = 'biznestim777@gmail.com'; // ← Твоя почта
    
    console.log(`🔍 Ищем аккаунт: @${yourUsername} или ${yourEmail}...`);
    
    const yourAccount = await User.findOne({
      $or: [
        { username: yourUsername },
        { email: yourEmail }
      ]
    });
    
    if (!yourAccount) {
      console.log('❌ Аккаунт не найден!');
      console.log('💡 Проверь правильность username/email в скрипте');
      console.log('📝 Доступные пользователи:');
      
      const allUsers = await User.find({}, 'username email displayName').limit(10);
      allUsers.forEach(user => {
        console.log(`   - @${user.username} (${user.email}) - ${user.displayName || 'Без имени'}`);
      });
      
      return;
    }
    
    console.log(`✅ Найден аккаунт: @${yourAccount.username}`);
    console.log(`📧 Email: ${yourAccount.email}`);
    console.log(`👤 Имя: ${yourAccount.displayName || 'Не указано'}`);
    console.log(`🎭 Текущая роль: ${yourAccount.role || 'user'}`);
    
    // Делаем админом
    yourAccount.role = 'admin';
    yourAccount.premium = true;
    yourAccount.points = Math.max(yourAccount.points || 0, 10000);
    
    await yourAccount.save();
    
    console.log('\n🎉 УСПЕХ! Твой аккаунт теперь админ!');
    console.log('🎯 Обновленная информация:');
    console.log(`   Username: @${yourAccount.username}`);
    console.log(`   Email: ${yourAccount.email}`);
    console.log(`   Role: ${yourAccount.role}`);
    console.log(`   Premium: ${yourAccount.premium}`);
    console.log(`   Points: ${yourAccount.points}`);
    console.log(`   ID: ${yourAccount._id}`);

    console.log('\n🚀 Теперь можешь:');
    console.log('   1. Войти в приложение');
    console.log('   2. Увидеть кнопку "Админ-панель" в сайдбаре');
    console.log('   3. Увидеть красный значок ADMIN в профиле');
    console.log('   4. Управлять пользователями и постами');

  } catch (error) {
    console.error('❌ Ошибка:', error);
  } finally {
    // Закрываем соединение
    await mongoose.connection.close();
    console.log('🔌 Соединение с MongoDB закрыто');
    process.exit(0);
  }
};

// Запускаем скрипт
createAdmin();
