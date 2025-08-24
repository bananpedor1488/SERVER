require('dotenv').config();

console.log('🧪 Testing Nodemailer installation...\n');

try {
  const nodemailer = require('nodemailer');
  
  console.log('📦 Nodemailer version:', nodemailer.version);
  console.log('📦 Nodemailer type:', typeof nodemailer);
  console.log('📦 createTransporter type:', typeof nodemailer.createTransporter);
  
  if (typeof nodemailer.createTransporter === 'function') {
    console.log('✅ Nodemailer is properly installed and imported!');
    
    // Проверяем переменные окружения
    console.log('\n📋 Environment variables:');
    console.log('   EMAIL_USER:', process.env.EMAIL_USER ? '✅ Set' : '❌ Missing');
    console.log('   EMAIL_PASSWORD:', process.env.EMAIL_PASSWORD ? '✅ Set' : '❌ Missing');
    
    if (process.env.EMAIL_USER && process.env.EMAIL_PASSWORD) {
      console.log('\n🔧 Attempting to create transporter...');
      
      const transporter = nodemailer.createTransporter({
        service: 'gmail',
        auth: {
          user: process.env.EMAIL_USER,
          pass: process.env.EMAIL_PASSWORD
        }
      });
      
      console.log('✅ Transporter created successfully!');
      
      // Тестируем подключение
      console.log('\n🔗 Testing connection...');
      transporter.verify((error, success) => {
        if (error) {
          console.log('❌ Connection failed:', error.message);
        } else {
          console.log('✅ Connection successful!');
        }
        process.exit(0);
      });
      
    } else {
      console.log('\n❌ Email configuration is missing. Please check your .env file.');
      process.exit(1);
    }
    
  } else {
    console.log('❌ Nodemailer.createTransporter is not a function!');
    console.log('This might indicate an installation issue.');
    process.exit(1);
  }
  
} catch (error) {
  console.error('❌ Error testing nodemailer:', error.message);
  console.error('Stack trace:', error.stack);
  process.exit(1);
}
