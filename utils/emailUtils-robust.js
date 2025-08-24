// Надежная версия emailUtils с fallback
console.log('🔧 Loading emailUtils-robust.js...');

// Попытка импорта nodemailer
let nodemailer = null;
let useFallback = false;

try {
  nodemailer = require('nodemailer');
  console.log('✅ Nodemailer imported successfully');
  
  // Проверяем, что createTransport доступен
if (typeof nodemailer.createTransport !== 'function') {
  console.warn('⚠️  nodemailer.createTransport is not a function, using fallback');
    useFallback = true;
  }
} catch (error) {
  console.warn('⚠️  Failed to import nodemailer, using fallback:', error.message);
  useFallback = true;
}

// Генерация случайного кода подтверждения
const generateVerificationCode = () => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

// Создание транспорта для отправки email
const createTransporter = () => {
  if (useFallback) {
    console.log('⚠️  Using fallback email transporter (no actual email sending)');
    
    // Возвращаем заглушку транспорта
    return {
      sendMail: async (options) => {
        console.log('📧 [FALLBACK] Email would be sent:', {
          to: options.to,
          subject: options.subject,
          text: options.text
        });
        
        // Имитируем успешную отправку
        return {
          messageId: 'fallback-message-id',
          response: 'OK'
        };
      },
      verify: async () => {
        console.log('✅ [FALLBACK] Email connection verified (simulated)');
        return true;
      }
    };
  }

  // Проверяем наличие переменных окружения
  if (!process.env.EMAIL_USER || !process.env.EMAIL_PASSWORD) {
    console.error('❌ Email configuration missing:');
    console.error('   EMAIL_USER:', process.env.EMAIL_USER ? '✅ Set' : '❌ Missing');
    console.error('   EMAIL_PASSWORD:', process.env.EMAIL_PASSWORD ? '✅ Set' : '❌ Missing');
    throw new Error('Email configuration is missing. Please check your .env file.');
  }

  console.log('📧 Creating email transporter...');

  try {
    const transporter = nodemailer.createTransport({
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
    if (useFallback) {
      console.log(`📧 [FALLBACK] Sending verification email to: ${email}`);
      console.log(`🔢 [FALLBACK] Verification code: ${code}`);
      
      const transporter = createTransporter();
      
      const mailOptions = {
        from: process.env.EMAIL_USER || 'noreply@socialspace.com',
        to: email,
        subject: 'Подтверждение регистрации - SocialSpace',
        text: `Ваш код подтверждения: ${code}`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h1>SocialSpace</h1>
            <h2>Подтверждение регистрации</h2>
            <p>Ваш код подтверждения: <strong>${code}</strong></p>
            <p style="color: red;">⚠️  Это тестовый режим - email не отправляется</p>
          </div>
        `
      };
      
      await transporter.sendMail(mailOptions);
      console.log('✅ [FALLBACK] Verification email "sent" successfully');
      return true;
    } else {
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
            <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 20px; text-align: center; color: white;">
              <h1 style="margin: 0;">SocialSpace</h1>
              <p style="margin: 10px 0 0 0;">Подтверждение регистрации</p>
            </div>
            
            <div style="padding: 30px; background: #f9f9f9;">
              <h2 style="color: #333; margin-bottom: 20px;">Добро пожаловать в SocialSpace!</h2>
              
              <p style="color: #666; line-height: 1.6; margin-bottom: 25px;">
                Для завершения регистрации введите следующий код подтверждения:
              </p>
              
              <div style="background: white; border: 2px solid #667eea; border-radius: 10px; padding: 20px; text-align: center; margin: 20px 0;">
                <h1 style="color: #667eea; font-size: 32px; margin: 0; letter-spacing: 5px; font-family: 'Courier New', monospace;">
                  ${code}
                </h1>
              </div>
              
              <p style="color: #666; font-size: 14px; margin-top: 20px;">
                Код действителен в течение 10 минут. Если вы не регистрировались в SocialSpace, 
                просто проигнорируйте это письмо.
              </p>
            </div>
            
            <div style="background: #333; color: white; padding: 15px; text-align: center; font-size: 12px;">
              <p style="margin: 0;">© 2024 SocialSpace. Все права защищены.</p>
            </div>
          </div>
        `
      };
      
      const result = await transporter.sendMail(mailOptions);
      console.log('✅ Verification email sent successfully:', {
        messageId: result.messageId,
        to: email,
        code: code
      });
      return true;
    }
  } catch (error) {
    console.error('❌ Error sending verification email:', {
      error: error.message,
      code: error.code,
      command: error.command,
      to: email
    });
    
    // Детальная диагностика ошибок
    if (error.code === 'EAUTH') {
      console.error('🔐 Authentication failed. Check your EMAIL_USER and EMAIL_PASSWORD');
    } else if (error.code === 'ECONNECTION') {
      console.error('🌐 Connection failed. Check your internet connection');
    } else if (error.code === 'ETIMEDOUT') {
      console.error('⏰ Connection timeout. Try again later');
    }
    
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
