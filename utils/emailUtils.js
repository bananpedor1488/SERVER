// Упрощенная версия emailUtils для тестирования
console.log('🔧 Loading emailUtils-simple.js...');

// Простой импорт nodemailer
const nodemailer = require('nodemailer');

console.log('📦 Nodemailer loaded:', {
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
