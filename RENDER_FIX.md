# Быстрое исправление для Render.com

## 🚨 Проблема
Ошибка: `nodemailer.createTransporter is not a function` на Render.com с Node.js v24

## ⚡ Быстрое решение

### Вариант 1: Использовать упрощенную версию

1. **Переименуйте файлы:**
   ```bash
   mv utils/emailUtils.js utils/emailUtils-backup.js
   mv utils/emailUtils-simple.js utils/emailUtils.js
   ```

2. **Перезапустите сервер на Render**

### Вариант 2: Обновить package.json

Добавьте в `package.json`:
```json
{
  "type": "commonjs",
  "engines": {
    "node": "18.x"
  }
}
```

### Вариант 3: Использовать более старую версию Node.js

В Render dashboard:
1. Перейдите в настройки сервиса
2. Измените версию Node.js на 18.x
3. Перезапустите сервис

## 🔧 Альтернативное решение

Если ничего не помогает, используйте этот код в `utils/emailUtils.js`:

```javascript
// Простой импорт nodemailer
const nodemailer = require('nodemailer');

// Генерация кода
const generateVerificationCode = () => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

// Создание транспорта
const createTransporter = () => {
  if (!process.env.EMAIL_USER || !process.env.EMAIL_PASSWORD) {
    throw new Error('Email configuration missing');
  }

  return nodemailer.createTransporter({
    service: 'gmail',
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASSWORD
    }
  });
};

// Отправка email
const sendVerificationEmail = async (email, code) => {
  try {
    const transporter = createTransporter();
    await transporter.sendMail({
      from: process.env.EMAIL_USER,
      to: email,
      subject: 'Подтверждение - SocialSpace',
      text: `Код: ${code}`
    });
    return true;
  } catch (error) {
    console.error('Email error:', error.message);
    return false;
  }
};

const resendVerificationEmail = sendVerificationEmail;
const testEmailConnection = async () => {
  try {
    const transporter = createTransporter();
    await transporter.verify();
    return true;
  } catch (error) {
    return false;
  }
};

module.exports = {
  generateVerificationCode,
  sendVerificationEmail,
  resendVerificationEmail,
  testEmailConnection
};
```

## 📋 Проверка

После изменений:
1. Перезапустите сервер на Render
2. Проверьте логи - не должно быть ошибок импорта
3. Попробуйте зарегистрироваться

## 🎯 Рекомендация

**Используйте Вариант 1** - он самый простой и надежный для быстрого исправления.
