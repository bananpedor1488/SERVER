# 🚀 Создание администратора SocialSpace

## Способ 1: Через скрипт (Рекомендуется)

### Запуск скрипта:
```bash
cd SERVER
npm run create-admin
```

### Что делает скрипт:
- ✅ Создает пользователя с username `@admin`
- ✅ Email: `admin@socialspace.com`
- ✅ Пароль: `admin123`
- ✅ Роль: `admin`
- ✅ Премиум статус: включен
- ✅ Баллы: 10000
- ✅ Email верифицирован

### Если админ уже существует:
- Обновляет роль на `admin`

---

## Способ 2: Через API (если нет админов)

### Запрос:
```bash
curl -X POST http://localhost:5000/api/setup/create-first-admin \
  -H "Content-Type: application/json" \
  -d '{
    "username": "admin",
    "email": "admin@socialspace.com", 
    "password": "admin123",
    "displayName": "Администратор"
  }'
```

### Условия:
- Работает только если в системе НЕТ админов
- После создания первого админа этот роут блокируется

---

## Способ 3: Через MongoDB напрямую

### Подключение к MongoDB:
```bash
mongosh "mongodb://localhost:27017/socialspace"
```

### Создание админа:
```javascript
// Хешируем пароль
const bcrypt = require('bcrypt');
const hashedPassword = await bcrypt.hash('admin123', 10);

// Создаем админа
db.users.insertOne({
  username: "admin",
  email: "admin@socialspace.com",
  password: hashedPassword,
  displayName: "Администратор",
  bio: "Главный администратор SocialSpace",
  role: "admin",
  emailVerified: true,
  premium: true,
  points: 10000,
  createdAt: new Date(),
  updatedAt: new Date()
});
```

---

## 🔐 Данные для входа:

- **Username:** `admin`
- **Email:** `admin@socialspace.com`
- **Пароль:** `admin123`
- **Роль:** `admin`

---

## ✅ Проверка:

После создания админа:
1. Войдите в приложение с данными выше
2. В сайдбаре должна появиться кнопка "Админ-панель"
3. В профиле должен быть красный значок "ADMIN"
4. В постах должен отображаться админ-значок

---

## 🛡️ Безопасность:

- После создания админа смените пароль через настройки профиля
- Удалите или закомментируйте setup роуты в продакшене
- Используйте сильные пароли в продакшене

---

## 🎯 Функции админа:

- 👑 Назначение/снятие админ-роли
- 🚫 Бан пользователей
- 🗑️ Удаление постов
- 📊 Просмотр статистики
- 🔍 Поиск по пользователям и постам
