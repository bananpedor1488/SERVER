const jwt = require('jsonwebtoken');
const User = require('../models/User');

const jwtAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

    if (!token) {
      return res.status(401).json({ message: 'Access token is missing' });
    }

    // Верифицируем токен
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'fallback-secret');
    
    // Проверяем существует ли пользователь
    const user = await User.findById(decoded.id).select('-password');
    if (!user) {
      return res.status(401).json({ message: 'User not found' });
    }

    // Добавляем пользователя в req
    req.user = user;
    req.userId = user._id.toString();

    next();
  } catch (error) {
    console.error('JWT Auth error:', error);
    
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({ message: 'Invalid token' });
    } else if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ message: 'Token expired' });
    }
    
    return res.status(500).json({ message: 'Server error during authentication' });
  }
};

module.exports = jwtAuth;