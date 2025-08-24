# Устранение неполадок с Nodemailer

## 🔍 Диагностика проблемы

Ошибка `nodemailer.createTransporter is not a function` указывает на проблемы с установкой или импортом nodemailer.

## 🛠️ Пошаговое решение:

### 1. **Проверьте установку nodemailer**

```bash
cd SERVER
npm list nodemailer
```

Если nodemailer не установлен, выполните:
```bash
npm install nodemailer
```

### 2. **Проверьте package.json**

Убедитесь, что в `package.json` есть:
```json
{
  "dependencies": {
    "nodemailer": "^6.9.7"
  }
}
```

### 3. **Переустановите зависимости**

```bash
rm -rf node_modules package-lock.json
npm install
```

### 4. **Проверьте .env файл**

Убедитесь, что файл `.env` существует и содержит правильные данные:

```env
EMAIL_USER=prawllolituh@gmail.com
EMAIL_PASSWORD=ваш-16-значный-app-password
```

**Важно:** Проверьте правильность email адреса!

### 5. **Запустите тестовый скрипт**

```bash
node test-nodemailer.js
```

Этот скрипт проверит:
- Установку nodemailer
- Импорт модуля
- Переменные окружения
- Создание транспорта
- Подключение к Gmail

### 6. **Проверьте версию Node.js**

```bash
node --version
```

Убедитесь, что версия Node.js >= 16.0.0

## 🔧 Альтернативные решения:

### Если проблема с импортом:

Попробуйте изменить импорт в `utils/emailUtils.js`:

```javascript
// Вместо:
const nodemailer = require('nodemailer');

// Попробуйте:
const nodemailer = require('nodemailer').default;
```

### Если проблема с Gmail:

1. **Проверьте двухфакторную аутентификацию**
2. **Убедитесь, что App Password правильный**
3. **Попробуйте другой email провайдер**

### Для Render.com:

1. **Добавьте переменные окружения в Render dashboard**
2. **Перезапустите сервис**
3. **Проверьте логи в Render**

## 📋 Чек-лист:

- [ ] Nodemailer установлен (`npm list nodemailer`)
- [ ] .env файл существует и содержит правильные данные
- [ ] EMAIL_USER и EMAIL_PASSWORD установлены
- [ ] Двухфакторная аутентификация включена в Google
- [ ] App Password создан и правильный
- [ ] Тестовый скрипт проходит успешно
- [ ] Сервер перезапущен после изменений

## 🆘 Если ничего не помогает:

1. **Проверьте логи сервера полностью**
2. **Попробуйте использовать другой email сервис (SendGrid, Mailgun)**
3. **Создайте новый Google аккаунт для тестирования**
4. **Проверьте, не блокирует ли Gmail подключения**

## 📞 Поддержка:

Если проблема остается, предоставьте:
- Полные логи сервера
- Результат выполнения `node test-nodemailer.js`
- Версию Node.js
- Содержимое package.json (без секретов)
