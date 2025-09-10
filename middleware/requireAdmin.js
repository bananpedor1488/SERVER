const User = require('../models/User');

const requireAdmin = async (req, res, next) => {
  try {
    console.log('requireAdmin middleware - req.user:', req.user);
    
    // Пользователь уже аутентифицирован через JWT middleware
    if (!req.user) {
      console.log('requireAdmin: No req.user found');
      return res.status(401).json({ error: 'Пользователь не аутентифицирован' });
    }

    console.log('requireAdmin: Looking for user with ID:', req.user.id || req.user._id);
    
    // Получаем полные данные пользователя из базы данных
    const userId = req.user.id || req.user._id;
    const user = await User.findById(userId);
    
    if (!user) {
      console.log('requireAdmin: User not found in database for ID:', req.user.id);
      return res.status(401).json({ error: 'Пользователь не найден' });
    }

    console.log('requireAdmin: User found, role:', user.role);

    if (user.role !== 'admin') {
      console.log('requireAdmin: User is not admin, role:', user.role);
      return res.status(403).json({ error: 'Доступ запрещен. Требуются права администратора.' });
    }

    console.log('requireAdmin: Admin access granted');
    // Обновляем req.user с полными данными пользователя
    req.user = user;
    next();
  } catch (error) {
    console.error('Ошибка проверки админ-прав:', error);
    return res.status(500).json({ error: 'Ошибка сервера' });
  }
};

module.exports = requireAdmin;
