const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const dotenv = require('dotenv');
const jwt = require('jsonwebtoken');
const http = require('http');
const socketIo = require('socket.io');

dotenv.config();
const app = express();
const server = http.createServer(app);

// Socket.IO настройка
const io = socketIo(server, {
  cors: {
    origin: [
      'https://social-space-3pce.vercel.app',
      'http://localhost:3000',
      'http://localhost:3001',
      'http://localhost:5173',
      'http://127.0.0.1:5173'
    ],
    methods: ['GET', 'POST'],
    credentials: false
  }
});

// Trust proxy для Render
app.set('trust proxy', 1);

// Улучшенное логирование
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
  console.log('Origin:', req.get('Origin'));
  console.log('Authorization header:', req.get('Authorization') ? 'Present' : 'Missing');
  next();
});

// CORS настройки для JWT
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
    
    if (!origin) {
      console.log('No origin - allowing');
      return callback(null, true);
    }

    if (allowedOrigins.includes(origin)) {
      console.log('Origin allowed:', origin);
      callback(null, true);
    } else {
      if (process.env.NODE_ENV !== 'production') {
        console.log('Dev mode - allowing origin:', origin);
        callback(null, true);
      } else {
        console.log('Origin blocked:', origin);
        callback(new Error('Not allowed by CORS'));
      }
    }
  },
  credentials: false,
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
  exposedHeaders: ['Authorization'],
  optionsSuccessStatus: 200
};

app.use(cors(corsOptions));

// Preflight requests
app.options('*', (req, res) => {
  console.log('OPTIONS request for:', req.path);
  const origin = req.get('Origin');
  if (origin) {
    res.header('Access-Control-Allow-Origin', origin);
  }
  res.header('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS,PATCH');
  res.header('Access-Control-Allow-Headers', 'Content-Type,Authorization,X-Requested-With,Accept,Origin,Cache-Control,Pragma');
  res.header('Access-Control-Allow-Credentials', 'false');
  res.sendStatus(200);
});

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Middleware для авторизации Socket.IO
const socketAuth = (socket, next) => {
  const token = socket.handshake.auth.token;
  
  if (!token) {
    return next(new Error('No token provided'));
  }

  jwt.verify(token, process.env.JWT_SECRET || 'fallback-secret', (err, user) => {
    if (err) {
      return next(new Error('Invalid token'));
    }
    socket.user = user;
    next();
  });
};

// Socket.IO обработчики
io.use(socketAuth);

io.on('connection', (socket) => {
  console.log(`User ${socket.user.username} connected via Socket.IO`);
  
  // Присоединяемся к комнате пользователя
  socket.join(`user_${socket.user.id}`);
  
  // Присоединяемся к общей комнате
  socket.join('general');

  socket.on('disconnect', () => {
    console.log(`User ${socket.user.username} disconnected`);
  });
});

// Делаем io доступным в роутах
app.set('io', io);

// JWT Middleware для проверки токенов
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  console.log('Auth check - Token present:', !!token);

  if (!token) {
    console.log('No token provided');
    return res.status(401).json({ 
      message: 'Access token required',
      authenticated: false 
    });
  }

  jwt.verify(token, process.env.JWT_SECRET || 'fallback-secret', (err, user) => {
    if (err) {
      console.log('Token verification failed:', err.message);
      
      if (err.name === 'TokenExpiredError') {
        return res.status(401).json({ 
          message: 'Token expired',
          expired: true,
          authenticated: false 
        });
      }
      
      return res.status(403).json({ 
        message: 'Invalid token',
        authenticated: false 
      });
    }

    console.log('Token verified for user:', user.username);
    req.user = user;
    next();
  });
};

// Middleware для добавления CORS заголовков
app.use((req, res, next) => {
  const origin = req.get('Origin');
  if (origin) {
    res.header('Access-Control-Allow-Origin', origin);
  }
  res.header('Access-Control-Allow-Credentials', 'false');
  next();
});

// Роуты аутентификации (без middleware)
const authRoutes = require('./routes/auth');
app.use('/api/auth', authRoutes);

// Защищенные роуты (с JWT middleware)
const postRoutes = require('./routes/posts');
const userRoutes = require('./routes/users');
const followRoutes = require('./routes/follow');

// Middleware для преобразования JWT в req.session.user для совместимости со старым кодом
const jwtToSession = (req, res, next) => {
  if (req.user) {
    req.session = { user: req.user };
  }
  next();
};

app.use('/api/posts', authenticateToken, jwtToSession, postRoutes);
app.use('/api/users', authenticateToken, jwtToSession, userRoutes);
app.use('/api/follow', authenticateToken, jwtToSession, followRoutes);

// Роут для проверки текущего пользователя с JWT
app.get('/api/me', authenticateToken, (req, res) => {
  console.log('GET /api/me called with JWT');
  console.log('User from token:', req.user);
  
  res.json({ 
    user: {
      id: req.user.id,
      username: req.user.username,
      email: req.user.email
    },
    authenticated: true,
    tokenValid: true
  });
});

// Тестовый роут для проверки JWT
app.get('/api/test-auth', authenticateToken, (req, res) => {
  res.json({
    message: 'JWT authentication working',
    user: req.user,
    timestamp: new Date().toISOString(),
    authenticated: true
  });
});

// Health check
app.get('/api/health', async (req, res) => {
  try {
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
      auth: {
        type: 'JWT Bearer Token',
        hasAuthHeader: !!req.get('Authorization')
      },
      cors: {
        origin: req.get('Origin'),
        userAgent: req.get('User-Agent')
      },
      socketConnections: io.sockets.sockets.size
    });
  } catch (error) {
    res.status(500).json({
      status: 'ERROR',
      message: error.message
    });
  }
});

// Роут для выхода (очистка токенов на клиенте)
app.post('/api/logout', (req, res) => {
  console.log('Logout request - JWT tokens should be removed on client side');
  res.json({ 
    message: 'Logged out successfully',
    authenticated: false 
  });
});

// Базовый роут
app.get('/', (req, res) => {
  res.json({ 
    message: 'Social Space API with JWT Auth and Socket.IO!', 
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development',
    auth: 'JWT Bearer Token (send in Authorization header)',
    realtime: 'Socket.IO enabled',
    connectedUsers: io.sockets.sockets.size,
    endpoints: [
      'POST /api/auth/login',
      'POST /api/auth/register', 
      'POST /api/auth/refresh',
      'POST /api/auth/logout',
      'GET  /api/auth/status',
      'GET  /api/me (requires Bearer token)',
      'GET  /api/posts (requires Bearer token)',
      'POST /api/posts (requires Bearer token)',
      'GET  /api/users/search (requires Bearer token)',
      'POST /api/logout',
      'GET  /api/health',
      'GET  /api/test-auth (requires Bearer token)',
      'Socket.IO: Real-time updates'
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
    origin: req.get('Origin')
  });
  
  if (err.message === 'Not allowed by CORS') {
    res.status(403).json({ 
      error: 'CORS policy violation',
      origin: req.get('Origin')
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
}).catch(err => {
  console.error('❌ MongoDB connection error:', err);
  process.exit(1);
});

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('Shutting down gracefully...');
  io.close();
  await mongoose.connection.close();
  process.exit(0);
});

// Запуск сервера
const PORT = process.env.PORT || 3000;
server.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📝 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`🔐 Auth: JWT Bearer Token`);
  console.log(`⚡ Socket.IO: Enabled`);
  console.log('🔧 Key endpoints:');
  console.log('   - POST /api/auth/login');
  console.log('   - POST /api/auth/register');
  console.log('   - POST /api/auth/refresh');
  console.log('   - GET  /api/me (with Bearer token)');
  console.log('   - GET  /api/test-auth (with Bearer token)');
  console.log('   - Socket.IO: Real-time updates');
});

module.exports = app;