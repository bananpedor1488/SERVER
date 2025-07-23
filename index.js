const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const dotenv = require('dotenv');
const session = require('express-session');
const MongoStore = require('connect-mongo');

dotenv.config();
const app = express();

// CORS настройки - ИСПРАВЛЕНО
const corsOptions = {
  origin: function (origin, callback) {
    // Список разрешенных доменов
    const allowedOrigins = [
      'https://social-space-3pce.vercel.app',
      'http://localhost:3000',
      'http://localhost:3001',
      'http://localhost:5173', // Vite dev server
      'http://127.0.0.1:5173'
    ];

    // Разрешаем запросы без origin (например, мобильные приложения, Postman)
    if (!origin) return callback(null, true);

    if (allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      console.log('Blocked origin:', origin);
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  optionsSuccessStatus: 200 // для старых браузеров
};

app.use(cors(corsOptions));

// Добавляем preflight обработку для всех роутов
app.options('*', cors(corsOptions));

app.use(express.json());

// Настройка сессий - ОБНОВЛЕНО
app.use(session({
  secret: process.env.SESSION_SECRET || 'keyboard cat',
  resave: false,
  saveUninitialized: false,
  store: MongoStore.create({ 
    mongoUrl: process.env.MONGO_URI,
    touchAfter: 24 * 3600 // lazy session update
  }),
  cookie: {
    httpOnly: true,
    maxAge: 24 * 60 * 60 * 1000, // 24 hours
    sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
    secure: process.env.NODE_ENV === 'production' // true только в production
  }
}));

// Middleware для логирования запросов (для отладки)
app.use((req, res, next) => {
  console.log(`${req.method} ${req.path} - Origin: ${req.get('Origin')}`);
  next();
});

// Роуты
const postRoutes = require('./routes/posts');
app.use('/api/posts', postRoutes);

const userRoutes = require('./routes/users');
app.use('/api/users', userRoutes);

const followRoutes = require('./routes/follow');
app.use('/api/follow', followRoutes);

const authRoutes = require('./routes/auth');
app.use('/api/auth', authRoutes);

// Роут для проверки текущего пользователя
app.get('/api/me', (req, res) => {
  if (req.session.user) {
    res.json({ user: req.session.user });
  } else {
    res.status(401).json({ message: 'Not logged in' });
  }
});

// Health check роут
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'OK',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development'
  });
});

// Добавляем базовый роут для проверки работы сервера
app.get('/', (req, res) => {
  res.json({ 
    message: 'Social Space API is running!', 
    timestamp: new Date().toISOString(),
    endpoints: [
      '/api/posts',
      '/api/users', 
      '/api/follow',
      '/api/auth',
      '/api/me',
      '/api/health'
    ]
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Error:', err.message);
  if (err.message === 'Not allowed by CORS') {
    res.status(403).json({ error: 'CORS policy violation' });
  } else {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// Подключение к MongoDB
mongoose.connect(process.env.MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true
}).then(() => {
  console.log('MongoDB connected successfully');
}).catch(err => {
  console.error('MongoDB connection error:', err);
  process.exit(1);
});

// Для Replit нужно запустить сервер на порту 3000
const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server is running on port ${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`Access your app at: https://${process.env.REPLIT_DEV_DOMAIN || 'localhost:' + PORT}`);
});

// Экспортируем приложение (для совместимости с Vercel, если понадобится)
module.exports = app;