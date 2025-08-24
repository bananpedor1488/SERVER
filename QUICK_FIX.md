# Быстрое исправление проблемы с nodemailer

## 🚨 Проблема
`nodemailer.createTransporter is not a function` на Render.com

## ⚡ Быстрое решение (5 минут)

### Вариант 1: Использовать резервную версию (Рекомендуется)

1. **Переименуйте файлы:**
   ```bash
   mv utils/emailUtils.js utils/emailUtils-backup.js
   mv utils/emailUtils-fallback.js utils/emailUtils.js
   ```

2. **Перезапустите сервер на Render**

Это позволит тестировать систему верификации без отправки реальных email.

### Вариант 2: Принудительная переустановка nodemailer

1. **В Render Dashboard:**
   - Перейдите в ваш сервис
   - Нажмите "Manual Deploy" → "Clear build cache & deploy"

2. **Или добавьте в Build Command:**
   ```bash
   npm install && npm install nodemailer@6.9.7 --force
   ```

### Вариант 3: Изменить версию Node.js

В Render Dashboard:
1. Перейдите в настройки сервиса
2. Измените версию Node.js на **18.x**
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

**Используйте Вариант 1** - он самый быстрый и позволит тестировать систему верификации. Email не будет отправляться, но код будет генерироваться и сохраняться в базе данных.

## 🔍 Диагностика

Если проблема остается, запустите:
```bash
node check-dependencies.js
```

Это покажет, установлен ли nodemailer и какие переменные окружения настроены.
