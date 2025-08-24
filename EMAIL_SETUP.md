# Настройка Email Верификации

## Шаг 1: Настройка Gmail

1. Включите двухфакторную аутентификацию в вашем Google аккаунте
2. Создайте пароль приложения:
   - Перейдите в настройки безопасности Google
   - Найдите "Пароли приложений"
   - Создайте новый пароль для "Социальная сеть"
   - Сохраните этот пароль

## Шаг 2: Создание .env файла

Создайте файл `.env` в корневой папке сервера со следующим содержимым:

```env
# Database
MONGODB_URI=mongodb://localhost:27017/socialspace

# JWT Secrets
JWT_SECRET=your-super-secret-jwt-key-here
JWT_REFRESH_SECRET=your-super-secret-refresh-key-here

# Email Configuration (Gmail)
EMAIL_USER=your-email@gmail.com
EMAIL_PASSWORD=your-app-password-from-step-1

# Server Configuration
PORT=5000
NODE_ENV=development

# CORS
CORS_ORIGIN=http://localhost:3000
```

## Шаг 3: Установка зависимостей

```bash
npm install nodemailer
```

## Шаг 4: Проверка работы

1. Запустите сервер: `npm run dev`
2. Попробуйте зарегистрировать нового пользователя
3. Проверьте, что код подтверждения приходит на email

## Важные замечания

- **EMAIL_PASSWORD** - это пароль приложения, а не ваш обычный пароль от Gmail
- Убедитесь, что двухфакторная аутентификация включена
- Для продакшена рекомендуется использовать специализированные сервисы (SendGrid, Mailgun и т.д.)

## Альтернативные провайдеры

Если хотите использовать другие email провайдеры, измените настройки в `utils/emailUtils.js`:

### Для Outlook/Hotmail:
```javascript
const transporter = nodemailer.createTransporter({
  service: 'outlook',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASSWORD
  }
});
```

### Для Yandex:
```javascript
const transporter = nodemailer.createTransporter({
  host: 'smtp.yandex.ru',
  port: 465,
  secure: true,
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASSWORD
  }
});
```
