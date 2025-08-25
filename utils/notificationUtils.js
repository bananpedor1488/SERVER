// Система email-уведомлений для SocialSpace
console.log('🔔 Loading notificationUtils.js...');

const nodemailer = require('nodemailer');

// Создание транспорта для отправки email
const createTransporter = () => {
  if (!process.env.EMAIL_USER || !process.env.EMAIL_PASSWORD) {
    console.error('❌ Email configuration missing');
    throw new Error('Email configuration is missing');
  }

  return nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASSWORD
    }
  });
};

// Базовый HTML шаблон для уведомлений
const createEmailTemplate = (title, content, actionText = null, actionUrl = null) => {
  return `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 20px; text-align: center; color: white;">
        <h1 style="margin: 0;">SocialSpace</h1>
        <p style="margin: 10px 0 0 0;">${title}</p>
      </div>
      
      <div style="padding: 30px; background: #f9f9f9;">
        ${content}
        
        ${actionText && actionUrl ? `
          <div style="text-align: center; margin-top: 30px;">
            <a href="${actionUrl}" style="background: #667eea; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
              ${actionText}
            </a>
          </div>
        ` : ''}
      </div>
      
      <div style="background: #333; color: white; padding: 15px; text-align: center; font-size: 12px;">
        <p style="margin: 0;">© 2025 SocialSpace. Все права защищены.</p>
        <p style="margin: 5px 0 0 0;">
          <a href="#" style="color: #667eea; text-decoration: none;">Отписаться от уведомлений</a>
        </p>
      </div>
    </div>
  `;
};

// Уведомление о новой подписке
const sendFollowNotification = async (follower, followedUser) => {
  try {
    const transporter = createTransporter();
    
    const avatarUrl = follower.avatar || 'https://via.placeholder.com/60x60/667eea/ffffff?text=' + follower.username.charAt(0).toUpperCase();
    
    const content = `
      <h2 style="color: #333; margin-bottom: 20px;">Новая подписка!</h2>
      <div style="display: flex; align-items: center; margin-bottom: 20px;">
        <img src="${avatarUrl}" alt="${follower.username}" style="width: 60px; height: 60px; border-radius: 50%; margin-right: 15px; border: 3px solid #667eea;">
        <div>
          <p style="color: #666; line-height: 1.6; margin: 0;">
            <strong style="color: #333;">${follower.username}</strong> подписался на ваш профиль.
          </p>
        </div>
      </div>
      <div style="background: white; border-radius: 8px; padding: 15px; margin: 20px 0;">
        <p style="margin: 0; color: #333;">
          <strong>Подписчик:</strong> ${follower.username}<br>
          <strong>Дата:</strong> ${new Date().toLocaleDateString('ru-RU')}
        </p>
      </div>
    `;

    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: followedUser.email,
      subject: `Новая подписка от ${follower.username} - SocialSpace`,
      text: `${follower.username} подписался на ваш профиль в SocialSpace`,
      html: createEmailTemplate('Новая подписка', content, 'Посмотреть профиль', '#')
    };

    const result = await transporter.sendMail(mailOptions);
    console.log('✅ Follow notification sent:', result.messageId);
    return true;
  } catch (error) {
    console.error('❌ Error sending follow notification:', error.message);
    return false;
  }
};

// Уведомление о новом лайке
const sendLikeNotification = async (liker, postAuthor, post) => {
  try {
    const transporter = createTransporter();
    
    const avatarUrl = liker.avatar || 'https://via.placeholder.com/60x60/667eea/ffffff?text=' + liker.username.charAt(0).toUpperCase();
    
    const content = `
      <h2 style="color: #333; margin-bottom: 20px;">Новый лайк!</h2>
      <div style="display: flex; align-items: center; margin-bottom: 20px;">
        <img src="${avatarUrl}" alt="${liker.username}" style="width: 60px; height: 60px; border-radius: 50%; margin-right: 15px; border: 3px solid #667eea;">
        <div>
          <p style="color: #666; line-height: 1.6; margin: 0;">
            <strong style="color: #333;">${liker.username}</strong> поставил лайк вашему посту.
          </p>
        </div>
      </div>
      <div style="background: white; border-radius: 8px; padding: 15px; margin: 20px 0;">
        <p style="margin: 0; color: #333;">
          <strong>Пост:</strong> ${post.content.substring(0, 100)}${post.content.length > 100 ? '...' : ''}<br>
          <strong>Лайкнул:</strong> ${liker.username}<br>
          <strong>Дата:</strong> ${new Date().toLocaleDateString('ru-RU')}
        </p>
      </div>
    `;

    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: postAuthor.email,
      subject: `Новый лайк от ${liker.username} - SocialSpace`,
      text: `${liker.username} поставил лайк вашему посту`,
      html: createEmailTemplate('Новый лайк', content, 'Посмотреть пост', '#')
    };

    const result = await transporter.sendMail(mailOptions);
    console.log('✅ Like notification sent:', result.messageId);
    return true;
  } catch (error) {
    console.error('❌ Error sending like notification:', error.message);
    return false;
  }
};

// Уведомление о новом комментарии
const sendCommentNotification = async (commenter, postAuthor, post, comment) => {
  try {
    const transporter = createTransporter();
    
    const avatarUrl = commenter.avatar || 'https://via.placeholder.com/60x60/667eea/ffffff?text=' + commenter.username.charAt(0).toUpperCase();
    
    const content = `
      <h2 style="color: #333; margin-bottom: 20px;">Новый комментарий!</h2>
      <div style="display: flex; align-items: center; margin-bottom: 20px;">
        <img src="${avatarUrl}" alt="${commenter.username}" style="width: 60px; height: 60px; border-radius: 50%; margin-right: 15px; border: 3px solid #667eea;">
        <div>
          <p style="color: #666; line-height: 1.6; margin: 0;">
            <strong style="color: #333;">${commenter.username}</strong> прокомментировал ваш пост.
          </p>
        </div>
      </div>
      <div style="background: white; border-radius: 8px; padding: 15px; margin: 20px 0;">
        <p style="margin: 0; color: #333;">
          <strong>Пост:</strong> ${post.content.substring(0, 100)}${post.content.length > 100 ? '...' : ''}<br>
          <strong>Комментарий:</strong> ${comment.content}<br>
          <strong>Автор:</strong> ${commenter.username}<br>
          <strong>Дата:</strong> ${new Date().toLocaleDateString('ru-RU')}
        </p>
      </div>
    `;

    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: postAuthor.email,
      subject: `Новый комментарий от ${commenter.username} - SocialSpace`,
      text: `${commenter.username} прокомментировал ваш пост`,
      html: createEmailTemplate('Новый комментарий', content, 'Ответить', '#')
    };

    const result = await transporter.sendMail(mailOptions);
    console.log('✅ Comment notification sent:', result.messageId);
    return true;
  } catch (error) {
    console.error('❌ Error sending comment notification:', error.message);
    return false;
  }
};

// Уведомление о репосте
const sendRepostNotification = async (reposter, originalAuthor, post) => {
  try {
    const transporter = createTransporter();
    
    const avatarUrl = reposter.avatar || 'https://via.placeholder.com/60x60/667eea/ffffff?text=' + reposter.username.charAt(0).toUpperCase();
    
    const content = `
      <h2 style="color: #333; margin-bottom: 20px;">Ваш пост репостнули!</h2>
      <div style="display: flex; align-items: center; margin-bottom: 20px;">
        <img src="${avatarUrl}" alt="${reposter.username}" style="width: 60px; height: 60px; border-radius: 50%; margin-right: 15px; border: 3px solid #667eea;">
        <div>
          <p style="color: #666; line-height: 1.6; margin: 0;">
            <strong style="color: #333;">${reposter.username}</strong> репостнул ваш пост.
          </p>
        </div>
      </div>
      <div style="background: white; border-radius: 8px; padding: 15px; margin: 20px 0;">
        <p style="margin: 0; color: #333;">
          <strong>Пост:</strong> ${post.content.substring(0, 100)}${post.content.length > 100 ? '...' : ''}<br>
          <strong>Репостнул:</strong> ${reposter.username}<br>
          <strong>Дата:</strong> ${new Date().toLocaleDateString('ru-RU')}
        </p>
      </div>
    `;

    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: originalAuthor.email,
      subject: `${reposter.username} репостнул ваш пост - SocialSpace`,
      text: `${reposter.username} репостнул ваш пост`,
      html: createEmailTemplate('Репост', content, 'Посмотреть репост', '#')
    };

    const result = await transporter.sendMail(mailOptions);
    console.log('✅ Repost notification sent:', result.messageId);
    return true;
  } catch (error) {
    console.error('❌ Error sending repost notification:', error.message);
    return false;
  }
};

// Уведомление о новом сообщении
const sendMessageNotification = async (sender, recipient, message) => {
  try {
    const transporter = createTransporter();
    
    const avatarUrl = sender.avatar || 'https://via.placeholder.com/60x60/667eea/ffffff?text=' + sender.username.charAt(0).toUpperCase();
    
    const content = `
      <h2 style="color: #333; margin-bottom: 20px;">Новое сообщение!</h2>
      <div style="display: flex; align-items: center; margin-bottom: 20px;">
        <img src="${avatarUrl}" alt="${sender.username}" style="width: 60px; height: 60px; border-radius: 50%; margin-right: 15px; border: 3px solid #667eea;">
        <div>
          <p style="color: #666; line-height: 1.6; margin: 0;">
            <strong style="color: #333;">${sender.username}</strong> отправил вам сообщение.
          </p>
        </div>
      </div>
      <div style="background: white; border-radius: 8px; padding: 15px; margin: 20px 0;">
        <p style="margin: 0; color: #333;">
          <strong>Сообщение:</strong> ${message.content.substring(0, 150)}${message.content.length > 150 ? '...' : ''}<br>
          <strong>От:</strong> ${sender.username}<br>
          <strong>Дата:</strong> ${new Date().toLocaleDateString('ru-RU')}
        </p>
      </div>
    `;

    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: recipient.email,
      subject: `Новое сообщение от ${sender.username} - SocialSpace`,
      text: `${sender.username} отправил вам сообщение`,
      html: createEmailTemplate('Новое сообщение', content, 'Ответить', '#')
    };

    const result = await transporter.sendMail(mailOptions);
    console.log('✅ Message notification sent:', result.messageId);
    return true;
  } catch (error) {
    console.error('❌ Error sending message notification:', error.message);
    return false;
  }
};

// Уведомление о входящем звонке (если пропущен)
const sendMissedCallNotification = async (caller, recipient) => {
  try {
    const transporter = createTransporter();
    
    const avatarUrl = caller.avatar || 'https://via.placeholder.com/60x60/667eea/ffffff?text=' + caller.username.charAt(0).toUpperCase();
    
    const content = `
      <h2 style="color: #333; margin-bottom: 20px;">Пропущенный звонок!</h2>
      <div style="display: flex; align-items: center; margin-bottom: 20px;">
        <img src="${avatarUrl}" alt="${caller.username}" style="width: 60px; height: 60px; border-radius: 50%; margin-right: 15px; border: 3px solid #667eea;">
        <div>
          <p style="color: #666; line-height: 1.6; margin: 0;">
            <strong style="color: #333;">${caller.username}</strong> звонил вам, но вы не ответили.
          </p>
        </div>
      </div>
      <div style="background: white; border-radius: 8px; padding: 15px; margin: 20px 0;">
        <p style="margin: 0; color: #333;">
          <strong>Звонил:</strong> ${caller.username}<br>
          <strong>Время:</strong> ${new Date().toLocaleString('ru-RU')}<br>
          <strong>Статус:</strong> Пропущен
        </p>
      </div>
    `;

    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: recipient.email,
      subject: `Пропущенный звонок от ${caller.username} - SocialSpace`,
      text: `${caller.username} звонил вам`,
      html: createEmailTemplate('Пропущенный звонок', content, 'Перезвонить', '#')
    };

    const result = await transporter.sendMail(mailOptions);
    console.log('✅ Missed call notification sent:', result.messageId);
    return true;
  } catch (error) {
    console.error('❌ Error sending missed call notification:', error.message);
    return false;
  }
};

// Уведомление о достижении в рейтинге
const sendRankingNotification = async (user, newRank, oldRank) => {
  try {
    const transporter = createTransporter();
    
    const content = `
      <h2 style="color: #333; margin-bottom: 20px;">Изменение в рейтинге!</h2>
      <p style="color: #666; line-height: 1.6; margin-bottom: 20px;">
        Ваша позиция в рейтинге изменилась.
      </p>
      <div style="background: white; border-radius: 8px; padding: 15px; margin: 20px 0;">
        <p style="margin: 0; color: #333;">
          <strong>Новая позиция:</strong> ${newRank}<br>
          <strong>Предыдущая позиция:</strong> ${oldRank}<br>
          <strong>Изменение:</strong> ${oldRank > newRank ? 'Улучшение' : 'Ухудшение'}<br>
          <strong>Дата:</strong> ${new Date().toLocaleDateString('ru-RU')}
        </p>
      </div>
    `;

    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: user.email,
      subject: `Изменение в рейтинге - SocialSpace`,
      text: `Ваша позиция в рейтинге изменилась с ${oldRank} на ${newRank}`,
      html: createEmailTemplate('Изменение в рейтинге', content, 'Посмотреть рейтинг', '#')
    };

    const result = await transporter.sendMail(mailOptions);
    console.log('✅ Ranking notification sent:', result.messageId);
    return true;
  } catch (error) {
    console.error('❌ Error sending ranking notification:', error.message);
    return false;
  }
};

// Уведомление о переводе средств
const sendTransferNotification = async (sender, recipient, amount, description) => {
  try {
    const transporter = createTransporter();
    
    const avatarUrl = sender.avatar || 'https://via.placeholder.com/60x60/667eea/ffffff?text=' + sender.username.charAt(0).toUpperCase();
    
    const content = `
      <h2 style="color: #333; margin-bottom: 20px;">Перевод средств!</h2>
      <div style="display: flex; align-items: center; margin-bottom: 20px;">
        <img src="${avatarUrl}" alt="${sender.username}" style="width: 60px; height: 60px; border-radius: 50%; margin-right: 15px; border: 3px solid #667eea;">
        <div>
          <p style="color: #666; line-height: 1.6; margin: 0;">
            <strong style="color: #333;">${sender.username}</strong> перевел вам средства.
          </p>
        </div>
      </div>
      <div style="background: white; border-radius: 8px; padding: 15px; margin: 20px 0;">
        <p style="margin: 0; color: #333;">
          <strong>Сумма:</strong> ${amount} монет<br>
          <strong>От:</strong> ${sender.username}<br>
          <strong>Описание:</strong> ${description || 'Без описания'}<br>
          <strong>Дата:</strong> ${new Date().toLocaleDateString('ru-RU')}
        </p>
      </div>
    `;

    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: recipient.email,
      subject: `Перевод от ${sender.username} - SocialSpace`,
      text: `${sender.username} перевел вам ${amount} монет`,
      html: createEmailTemplate('Перевод средств', content, 'Посмотреть кошелек', '#')
    };

    const result = await transporter.sendMail(mailOptions);
    console.log('✅ Transfer notification sent:', result.messageId);
    return true;
  } catch (error) {
    console.error('❌ Error sending transfer notification:', error.message);
    return false;
  }
};

// Уведомление о подарке премиум
const sendPremiumGiftNotification = async (sender, recipient) => {
  try {
    const transporter = createTransporter();
    
    const avatarUrl = sender.avatar || 'https://via.placeholder.com/60x60/667eea/ffffff?text=' + sender.username.charAt(0).toUpperCase();
    
    const content = `
      <h2 style="color: #333; margin-bottom: 20px;">Подарок премиум!</h2>
      <div style="display: flex; align-items: center; margin-bottom: 20px;">
        <img src="${avatarUrl}" alt="${sender.username}" style="width: 60px; height: 60px; border-radius: 50%; margin-right: 15px; border: 3px solid #667eea;">
        <div>
          <p style="color: #666; line-height: 1.6; margin: 0;">
            <strong style="color: #333;">${sender.username}</strong> подарил вам премиум статус!
          </p>
        </div>
      </div>
      <div style="background: white; border-radius: 8px; padding: 15px; margin: 20px 0;">
        <p style="margin: 0; color: #333;">
          <strong>Подарок:</strong> Премиум статус<br>
          <strong>От:</strong> ${sender.username}<br>
          <strong>Дата:</strong> ${new Date().toLocaleDateString('ru-RU')}
        </p>
      </div>
      <p style="color: #666; font-size: 14px; margin-top: 20px;">
        Теперь у вас есть доступ ко всем премиум функциям!
      </p>
    `;

    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: recipient.email,
      subject: `Подарок премиум от ${sender.username} - SocialSpace`,
      text: `${sender.username} подарил вам премиум статус`,
      html: createEmailTemplate('Подарок премиум', content, 'Активировать', '#')
    };

    const result = await transporter.sendMail(mailOptions);
    console.log('✅ Premium gift notification sent:', result.messageId);
    return true;
  } catch (error) {
    console.error('❌ Error sending premium gift notification:', error.message);
    return false;
  }
};

module.exports = {
  sendFollowNotification,
  sendLikeNotification,
  sendCommentNotification,
  sendRepostNotification,
  sendMessageNotification,
  sendMissedCallNotification,
  sendRankingNotification,
  sendTransferNotification,
  sendPremiumGiftNotification
};
