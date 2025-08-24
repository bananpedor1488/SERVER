# Настройка для Продакшена

## 🔑 Получение App Password для Gmail

### Пошаговая инструкция:

1. **Войдите в Google аккаунт:**
   - Откройте [myaccount.google.com](https://myaccount.google.com)

2. **Перейдите в настройки безопасности:**
   - Нажмите "Безопасность" в левом меню

3. **Включите двухфакторную аутентификацию:**
   - Найдите "Вход в аккаунт Google"
   - Нажмите "Двухэтапная аутентификация"
   - Следуйте инструкциям для включения

4. **Создайте пароль приложения:**
   - Вернитесь в "Безопасность"
   - Найдите "Пароли приложений"
   - Нажмите "Создать"
   - Выберите "Другое (пользовательское имя)"
   - Введите название: "SocialSpace"
   - Нажмите "Создать"
   - **Скопируйте 16-значный пароль** (например: `abcd efgh ijkl mnop`)

## 🌐 Настройка переменных окружения

Создайте файл `.env` в папке SERVER со следующим содержимым:

```env
# Database - используйте вашу MongoDB URI
MONGO_URI=mongodb+srv://your-username:your-password@your-cluster.mongodb.net/socialspace

# JWT Secrets - замените на свои секретные ключи
JWT_SECRET=your-super-secret-jwt-key-here-make-it-long-and-random
JWT_REFRESH_SECRET=your-super-secret-refresh-key-here-make-it-long-and-random

# Email Configuration (Gmail)
EMAIL_USER=your-email@gmail.com
EMAIL_PASSWORD=your-16-digit-app-password

# Server Configuration
PORT=5000
NODE_ENV=production

# CORS - ваш домен
CORS_ORIGIN=https://social-space-3pce.vercel.app

# Дополнительные настройки
TRUST_PROXY=1
```

## 📝 Пример заполнения:

```env
# Database
MONGO_URI=mongodb+srv://admin:password123@cluster0.abc123.mongodb.net/socialspace

# JWT Secrets (сгенерируйте случайные строки)
JWT_SECRET=my-super-secret-jwt-key-for-socialspace-2024
JWT_REFRESH_SECRET=my-super-secret-refresh-key-for-socialspace-2024

# Email Configuration
EMAIL_USER=yourname@gmail.com
EMAIL_PASSWORD=abcd efgh ijkl mnop

# Server Configuration
PORT=5000
NODE_ENV=production

# CORS
CORS_ORIGIN=https://social-space-3pce.vercel.app

# Дополнительные настройки
TRUST_PROXY=1
```

## 🔧 Установка зависимостей

```bash
cd SERVER
npm install nodemailer
```

## 🚀 Запуск

```bash
npm start
```

## ✅ Проверка работы

1. Запустите сервер
2. Попробуйте зарегистрировать нового пользователя
3. Проверьте, что код подтверждения приходит на email

## ⚠️ Важные замечания

- **EMAIL_PASSWORD** - это 16-значный пароль приложения, а не ваш обычный пароль от Gmail
- Убедитесь, что двухфакторная аутентификация включена
- Для продакшена рекомендуется использовать специализированные email сервисы (SendGrid, Mailgun)
- Храните .env файл в безопасности и не коммитьте его в git

## 🆘 Если не работает

1. **Проверьте логи сервера** - там будут ошибки
2. **Убедитесь, что 2FA включена** в Google аккаунте
3. **Проверьте пароль приложения** - он должен быть 16 символов
4. **Проверьте CORS настройки** - домен должен совпадать
