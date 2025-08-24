// Резервная версия emailUtils без nodemailer
console.log('🔧 Loading emailUtils.js (fallback mode)...');

// Генерация случайного кода подтверждения
const generateVerificationCode = () => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

// Заглушка для создания транспорта
const createTransporter = () => {
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
};



// Отправка кода подтверждения на email (заглушка)
const sendVerificationEmail = async (email, code) => {
  try {
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
  } catch (error) {
    console.error('❌ [FALLBACK] Error sending verification email:', error.message);
    return false;
  }
};

// Отправка кода повторно (заглушка)
const resendVerificationEmail = async (email, code) => {
  return sendVerificationEmail(email, code);
};

// Проверка подключения к email сервису (заглушка)
const testEmailConnection = async () => {
  try {
    const transporter = createTransporter();
    await transporter.verify();
    console.log('✅ [FALLBACK] Email connection verified successfully');
    return true;
  } catch (error) {
    console.error('❌ [FALLBACK] Email connection failed:', error.message);
    return false;
  }
};

module.exports = {
  generateVerificationCode,
  sendVerificationEmail,
  resendVerificationEmail,
  testEmailConnection
};
