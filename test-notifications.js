// Тестовый файл для проверки системы email-уведомлений
const {
  sendFollowNotification,
  sendLikeNotification,
  sendCommentNotification,
  sendRepostNotification,
  sendMessageNotification,
  sendMissedCallNotification,
  sendRankingNotification,
  sendTransferNotification,
  sendPremiumGiftNotification
} = require('./utils/notificationUtils');

// Тестовые данные
const testUser1 = {
  _id: 'test-user-1',
  username: 'testuser1',
  email: 'test1@example.com',
  displayName: 'Test User 1',
  avatar: 'https://via.placeholder.com/200x200/667eea/ffffff?text=T1'
};

const testUser2 = {
  _id: 'test-user-2',
  username: 'testuser2',
  email: 'test2@example.com',
  displayName: 'Test User 2',
  avatar: 'https://via.placeholder.com/200x200/764ba2/ffffff?text=T2'
};

const testPost = {
  _id: 'test-post-1',
  content: 'Это тестовый пост для проверки уведомлений. Он содержит достаточно текста для отображения в email.',
  author: testUser2._id
};

const testComment = {
  _id: 'test-comment-1',
  content: 'Это тестовый комментарий для проверки уведомлений.',
  author: testUser1._id
};

const testMessage = {
  _id: 'test-message-1',
  content: 'Это тестовое сообщение для проверки уведомлений. Оно содержит достаточно текста для отображения в email.',
  sender: testUser1._id
};

// Функция для тестирования всех типов уведомлений
async function testAllNotifications() {
  console.log('🧪 Начинаем тестирование системы уведомлений...\n');

  try {
    // Тест 1: Уведомление о подписке
    console.log('1️⃣ Тестируем уведомление о подписке...');
    await sendFollowNotification(testUser1, testUser2);
    console.log('✅ Уведомление о подписке отправлено\n');

    // Тест 2: Уведомление о лайке
    console.log('2️⃣ Тестируем уведомление о лайке...');
    await sendLikeNotification(testUser1, testUser2, testPost);
    console.log('✅ Уведомление о лайке отправлено\n');

    // Тест 3: Уведомление о комментарии
    console.log('3️⃣ Тестируем уведомление о комментарии...');
    await sendCommentNotification(testUser1, testUser2, testPost, testComment);
    console.log('✅ Уведомление о комментарии отправлено\n');

    // Тест 4: Уведомление о репосте
    console.log('4️⃣ Тестируем уведомление о репосте...');
    await sendRepostNotification(testUser1, testUser2, testPost);
    console.log('✅ Уведомление о репосте отправлено\n');

    // Тест 5: Уведомление о сообщении
    console.log('5️⃣ Тестируем уведомление о сообщении...');
    await sendMessageNotification(testUser1, testUser2, testMessage);
    console.log('✅ Уведомление о сообщении отправлено\n');

    // Тест 6: Уведомление о пропущенном звонке
    console.log('6️⃣ Тестируем уведомление о пропущенном звонке...');
    await sendMissedCallNotification(testUser1, testUser2);
    console.log('✅ Уведомление о пропущенном звонке отправлено\n');

    // Тест 7: Уведомление об изменении в рейтинге
    console.log('7️⃣ Тестируем уведомление об изменении в рейтинге...');
    await sendRankingNotification(testUser1, 5, 10);
    console.log('✅ Уведомление об изменении в рейтинге отправлено\n');

    // Тест 8: Уведомление о переводе средств
    console.log('8️⃣ Тестируем уведомление о переводе средств...');
    await sendTransferNotification(testUser1, testUser2, 1000, 'Тестовый перевод');
    console.log('✅ Уведомление о переводе средств отправлено\n');

    // Тест 9: Уведомление о подарке премиум
    console.log('9️⃣ Тестируем уведомление о подарке премиум...');
    await sendPremiumGiftNotification(testUser1, testUser2);
    console.log('✅ Уведомление о подарке премиум отправлено\n');

    console.log('🎉 Все тесты уведомлений выполнены успешно!');
    console.log('📧 Проверьте почтовые ящики для получения тестовых писем.');

  } catch (error) {
    console.error('❌ Ошибка при тестировании уведомлений:', error);
  }
}

// Функция для тестирования одного типа уведомлений
async function testSingleNotification(type) {
  console.log(`🧪 Тестируем уведомление типа: ${type}\n`);

  try {
    switch (type) {
      case 'follow':
        await sendFollowNotification(testUser1, testUser2);
        console.log('✅ Уведомление о подписке отправлено');
        break;
      
      case 'like':
        await sendLikeNotification(testUser1, testUser2, testPost);
        console.log('✅ Уведомление о лайке отправлено');
        break;
      
      case 'comment':
        await sendCommentNotification(testUser1, testUser2, testPost, testComment);
        console.log('✅ Уведомление о комментарии отправлено');
        break;
      
      case 'repost':
        await sendRepostNotification(testUser1, testUser2, testPost);
        console.log('✅ Уведомление о репосте отправлено');
        break;
      
      case 'message':
        await sendMessageNotification(testUser1, testUser2, testMessage);
        console.log('✅ Уведомление о сообщении отправлено');
        break;
      
      case 'missed-call':
        await sendMissedCallNotification(testUser1, testUser2);
        console.log('✅ Уведомление о пропущенном звонке отправлено');
        break;
      
      case 'ranking':
        await sendRankingNotification(testUser1, 5, 10);
        console.log('✅ Уведомление об изменении в рейтинге отправлено');
        break;
      
      case 'transfer':
        await sendTransferNotification(testUser1, testUser2, 1000, 'Тестовый перевод');
        console.log('✅ Уведомление о переводе средств отправлено');
        break;
      
      case 'premium-gift':
        await sendPremiumGiftNotification(testUser1, testUser2);
        console.log('✅ Уведомление о подарке премиум отправлено');
        break;
      
      default:
        console.log('❌ Неизвестный тип уведомления. Доступные типы:');
        console.log('   follow, like, comment, repost, message, missed-call, ranking, transfer, premium-gift');
    }
  } catch (error) {
    console.error('❌ Ошибка при отправке уведомления:', error);
  }
}

// Проверяем аргументы командной строки
const args = process.argv.slice(2);

if (args.length === 0) {
  // Запускаем все тесты
  testAllNotifications();
} else if (args.length === 1) {
  // Запускаем тест конкретного типа уведомления
  testSingleNotification(args[0]);
} else {
  console.log('📖 Использование:');
  console.log('   node test-notifications.js                    # Запустить все тесты');
  console.log('   node test-notifications.js follow             # Тест уведомления о подписке');
  console.log('   node test-notifications.js like               # Тест уведомления о лайке');
  console.log('   node test-notifications.js comment            # Тест уведомления о комментарии');
  console.log('   node test-notifications.js repost             # Тест уведомления о репосте');
  console.log('   node test-notifications.js message            # Тест уведомления о сообщении');
  console.log('   node test-notifications.js missed-call        # Тест уведомления о пропущенном звонке');
  console.log('   node test-notifications.js ranking            # Тест уведомления об изменении в рейтинге');
  console.log('   node test-notifications.js transfer           # Тест уведомления о переводе средств');
  console.log('   node test-notifications.js premium-gift       # Тест уведомления о подарке премиум');
}

module.exports = {
  testAllNotifications,
  testSingleNotification
};
