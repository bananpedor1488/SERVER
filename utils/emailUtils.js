// Альтернативная версия emailUtils с исправленным импортом
console.log('🔧 Loading emailUtils.js...');

// Попробуем разные способы импорта nodemailer
let nodemailer;

try {
  // Способ 1: Обычный импорт
  nodemailer = require('nodemailer');
  console.log('✅ Nodemailer imported normally');
} catch (error) {
  console.log('❌ Normal import failed:', error.message);
  
  try {
    // Способ 2: Импорт с .default
    nodemailer = require('nodemailer').default;
    console.log('✅ Nodemailer imported with .default');
  } catch (error2) {
    console.log('❌ .default import failed:', error2.message);
    
    try {
      // Способ 3: Динамический импорт
      const nodemailerModule = require('nodemailer');
      nodemailer = nodemailerModule.default || nodemailerModule;
      console.log('✅ Nodemailer imported dynamically');
    } catch (error3) {
      console.log('❌ Dynamic import failed:', error3.message);
      throw new Error('Failed to import nodemailer. Please install it: npm install nodemailer@6.9.7');
    }
  }
}

// Проверяем, что nodemailer работает
if (!nodemailer || typeof nodemailer.createTransporter !== 'function') {
  console.error('❌ Nodemailer is not working properly:', {
    nodemailer: typeof nodemailer,
    createTransporter: typeof nodemailer?.createTransporter,
    availableMethods: nodemailer ? Object.keys(nodemailer) : 'nodemailer is null'
  });
  
  // Попробуем создать транспортер напрямую
  try {
    const testTransporter = nodemailer.createTransporter({
      service: 'gmail',
      auth: {
        user: 'test@test.com',
        pass: 'test'
      }
    });
    console.log('✅ Test transporter created successfully');
  } catch (testError) {
    console.error('❌ Test transporter failed:', testError.message);
    throw new Error('Nodemailer is not properly configured. Please check installation.');
  }
}

console.log('📦 Nodemailer loaded successfully:', {
  type: typeof nodemailer,
  hasCreateTransporter: typeof nodemailer.createTransporter === 'function',
  version: nodemailer.version || 'unknown'
});

// Генерация случайного кода подтверждения
const generateVerificationCode = () => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

// Создание транспорта для отправки email
const createTransporter = () => {
  // Проверяем наличие переменных окружения
  if (!process.env.EMAIL_USER || !process.env.EMAIL_PASSWORD) {
    console.error('❌ Email configuration missing:');
    console.error('   EMAIL_USER:', process.env.EMAIL_USER ? '✅ Set' : '❌ Missing');
    console.error('   EMAIL_PASSWORD:', process.env.EMAIL_PASSWORD ? '✅ Set' : '❌ Missing');
    throw new Error('Email configuration is missing. Please check your .env file.');
  }

  console.log('📧 Creating email transporter...');

  try {
    const transporter = nodemailer.createTransporter({
      service: 'gmail',
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASSWORD
      }
    });
    
    console.log('✅ Email transporter created successfully');
    return transporter;
  } catch (error) {
    console.error('❌ Error creating email transporter:', error);
    throw error;
  }
};

// Отправка кода подтверждения на email
const sendVerificationEmail = async (email, code) => {
  try {
    console.log(`📧 Sending verification email to: ${email}`);
    console.log(`🔢 Verification code: ${code}`);
    
    const transporter = createTransporter();
    
    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: email,
      subject: 'Подтверждение регистрации - SocialSpace',
      text: `Ваш код подтверждения: ${code}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h1>SocialSpace</h1>
          <h2>Подтверждение регистрации</h2>
          <p>Ваш код подтверждения: <strong>${code}</strong></p>
        </div>
      `
    };
    
    const result = await transporter.sendMail(mailOptions);
    console.log('✅ Verification email sent successfully');
    return true;
  } catch (error) {
    console.error('❌ Error sending verification email:', error.message);
    return false;
  }
};

// Отправка кода повторно
const resendVerificationEmail = async (email, code) => {
  return sendVerificationEmail(email, code);
};

// Проверка подключения к email сервису
const testEmailConnection = async () => {
  try {
    const transporter = createTransporter();
    await transporter.verify();
    console.log('✅ Email connection verified successfully');
    return true;
  } catch (error) {
    console.error('❌ Email connection failed:', error.message);
    return false;
  }
};

module.exports = {
  generateVerificationCode,
  sendVerificationEmail,
  resendVerificationEmail,
  testEmailConnection
};
