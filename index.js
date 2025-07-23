const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const dotenv = require('dotenv');
const session = require('express-session');
const MongoStore = require('connect-mongo');

dotenv.config();
const app = express();

// Trust proxy для Render
app.set('trust proxy', 1);

// Улучшенное логирование
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
  console.log('Origin:', req.get('Origin'));
  console.log('User-Agent:', req.get('User-Agent'));
  console.log('Cookie:', req.get('Cookie'));
  next();
});

// CORS настройки - ИСПРАВЛЕНО для Render
const corsOptions = {
  origin: function (origin, callback) {
    const allowedOrigins = [
      'https://social-space-3pce.vercel.app',
      'http://localhost:3000',
      'http://localhost:3001',
      'http://localhost:5173',
      'http://127.0.0.1:5173'
    ];

    console.log('CORS check - Origin:', origin);
    
    // Разрешаем запросы без origin (Postman, мобильные приложения)
    if (!origin) {
      console.log('No origin - allowing');
      return callback(null, true);
    }

    if (allowedOrigins.includes(origin)) {
      console.log('Origin allowed:', origin);
      callback(null, true);
    } else {
      // В development режиме разрешаем все
      if (process.env.NODE_ENV !== 'production') {
        console.log('Dev mode - allowing origin:', origin);
        callback(null, true);
      } else {
        console.log('Origin blocked:', origin);
        callback(new Error('Not allowed by CORS'));
      }
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
  allowedHeaders: [
    'Content-Type', 
    'Authorization', 
    'X-Requested-With',
    'Accept',
    'Origin',
    'Cache-Control',
    'Pragma'
  ],
  exposedHeaders: ['Set-Cookie'],
  optionsSuccessStatus: 200
};

app.use(cors(corsOptions));

// Preflight для всех роутов
app.options('*', (req, res) => {
  console.log('OPTIONS request for:', req.path);
  const origin = req.get('Origin');
  if (origin) {
    res.header('Access-Control-Allow-Origin', origin);
  }
  res.header('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS,PATCH');
  res.header('Access-Control-Allow-Headers', 'Content-Type,Authorization,X-Requested-With,Accept,Origin,Cache-Control,Pragma');
  res.header('Access-Control-Allow-Credentials', 'true');
  res.sendStatus(200);
});

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Настройка сессий для Render - КРИТИЧЕСКИ ВАЖНО
const sessionConfig = {
  secret: process.env.SESSION_SECRET || 'your-super-secret-key-change-in-production',
  resave: false,
  saveUninitialized: false,
  name: 'socialspace.sid', // Кастомное имя cookie
  store: MongoStore.create({ 
    mongoUrl: process.env.MONGO_URI,
    touchAfter: 24 * 3600,
    ttl: 24 * 60 * 60, // 24 hours
    autoRemove: 'native'
  }),
  cookie: {
    httpOnly: true,
    maxAge: 24 * 60 * 60 * 1000, // 24 hours
    sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
    secure: process.env.NODE_ENV === 'production', // true для HTTPS
    domain: process.env.NODE_ENV === 'production' ? undefined : undefined
  }
};

console.log('Session config:', {
  ...sessionConfig,
  cookie: {
    ...sessionConfig.cookie,
    secure: sessionConfig.cookie.secure,
    sameSite: sessionConfig.cookie.sameSite
  }
});

app.use(session(sessionConfig));

// Middleware для добавления CORS заголовков
app.use((req, res, next) => {
  const origin = req.get('Origin');
  if (origin) {
    res.header('Access-Control-Allow-Origin', origin);
  }
  res.header('Access-Control-Allow-Credentials', 'true');
  next();
});

// Отладка сессий
app.use((req, res, next) => {
  console.log('=== SESSION DEBUG ===');
  console.log('Session ID:', req.sessionID);
  console.log('Session exists:', !!req.session);
  console.log('User in session:', req.session?.user);
  console.log('Session store ready:', req.sessionStore.ready);
  console.log('====================');
  next();
});

// Тестовый роут для проверки сессий
app.post('/api/test-session', (req, res) => {
  console.log('Test session endpoint hit');
  if (!req.session.testData) {
    req.session.testData = { timestamp: new Date().toISOString() };
  }
  res.json({
    sessionId: req.sessionID,
    testData: req.session.testData,
    user: req.session.user
  });
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
  console.log('GET /api/me called');
  console.log('Session ID:', req.sessionID);
  console.log('Session data:', req.session);
  console.log('User in session:', req.session?.user);
  
  if (req.session && req.session.user) {
    res.json({ 
      user: req.session.user,
      sessionId: req.sessionID,
      debug: {
        hasSession: !!req.session,
        sessionKeys: Object.keys(req.session || {})
      }
    });
  } else {
    res.status(401).json({ 
      message: 'Not logged in',
      sessionId: req.sessionID,
      debug: {
        hasSession: !!req.session,
        sessionKeys: Object.keys(req.session || {}),
        cookies: req.get('Cookie')
      }
    });
  }
});

// Health check с подробной информацией
app.get('/api/health', async (req, res) => {
  try {
    // Проверяем соединение с MongoDB
    const dbState = mongoose.connection.readyState;
    const dbStatus = ['disconnected', 'connected', 'connecting', 'disconnecting'][dbState];
    
    res.json({ 
      status: 'OK',
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV || 'development',
      database: {
        status: dbStatus,
        readyState: dbState
      },
      session: {
        id: req.sessionID,
        hasUser: !!req.session?.user,
        storeReady: req.sessionStore?.ready || false
      },
      cors: {
        origin: req.get('Origin'),
        userAgent: req.get('User-Agent'),
        cookie: req.get('Cookie')
      }
    });
  } catch (error) {
    res.status(500).json({
      status: 'ERROR',
      message: error.message
    });
  }
});

// Базовый роут
app.get('/', (req, res) => {
  res.json({ 
    message: 'Social Space API is running on Render!', 
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development',
    endpoints: [
      '/api/posts',
      '/api/users', 
      '/api/follow',
      '/api/auth',
      '/api/me',
      '/api/health',
      '/api/test-session'
    ]
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Error occurred:', {
    message: err.message,
    stack: err.stack,
    url: req.url,
    method: req.method,
    origin: req.get('Origin'),
    userAgent: req.get('User-Agent')
  });
  
  if (err.message === 'Not allowed by CORS') {
    res.status(403).json({ 
      error: 'CORS policy violation',
      origin: req.get('Origin'),
      allowed: [
        'https://social-space-3pce.vercel.app',
        'http://localhost:3000'
      ]
    });
  } else {
    res.status(500).json({ 
      error: 'Internal server error',
      message: process.env.NODE_ENV === 'development' ? err.message : 'Something went wrong'
    });
  }
});

// 404 handler
app.use('*', (req, res) => {
  console.log('404 - Route not found:', req.method, req.originalUrl);
  res.status(404).json({ 
    error: 'Route not found',
    path: req.originalUrl,
    method: req.method
  });
});

// Подключение к MongoDB
mongoose.connect(process.env.MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true
}).then(() => {
  console.log('✅ MongoDB connected successfully');
  console.log('Database name:', mongoose.connection.name);
}).catch(err => {
  console.error('❌ MongoDB connection error:', err);
  process.exit(1);
});

// Обработка событий MongoDB
mongoose.connection.on('error', err => {
  console.error('MongoDB error:', err);
});

mongoose.connection.on('disconnected', () => {
  console.log('MongoDB disconnected');
});

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('Shutting down gracefully...');
  try {
    await mongoose.connection.close();
    console.log('MongoDB connection closed');
    process.exit(0);
  } catch (err) {
    console.error('Error during shutdown:', err);
    process.exit(1);
  }
});

process.on('SIGTERM', async () => {
  console.log('SIGTERM received, shutting down...');
  try {
    await mongoose.connection.close();
    process.exit(0);
  } catch (err) {
    console.error('Error during shutdown:', err);
    process.exit(1);
  }
});

// Запуск сервера
const PORT = process.env.PORT || 3000;
const server = app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📝 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`🌐 Access: https://your-app.onrender.com`);
  console.log('🔧 Debug endpoints:');
  console.log('   - GET  /api/health');
  console.log('   - POST /api/test-session');
  console.log('   - GET  /api/me');
});

server.on('error', (err) => {
  console.error('Server error:', err);
});

module.exports = app;