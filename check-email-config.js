#!/usr/bin/env node

require('dotenv').config();
const { testEmailConnection } = require('./utils/emailUtils');

console.log('🔍 Checking Email Configuration...\n');

// Проверяем переменные окружения
console.log('📋 Environment Variables:');
console.log('   EMAIL_USER:', process.env.EMAIL_USER ? '✅ Set' : '❌ Missing');
console.log('   EMAIL_PASSWORD:', process.env.EMAIL_PASSWORD ? '✅ Set' : '❌ Missing');
console.log('   NODE_ENV:', process.env.NODE_ENV || 'development');
console.log('');

// Проверяем подключение к email сервису
async function checkEmailConnection() {
  try {
    console.log('🧪 Testing email connection...');
    const isConnected = await testEmailConnection();
    
    if (isConnected) {
      console.log('✅ Email connection is working properly!');
      console.log('');
      console.log('🎉 Your email configuration is ready!');
      console.log('   You can now use email verification in your app.');
    } else {
      console.log('❌ Email connection failed!');
      console.log('');
      console.log('🔧 Troubleshooting:');
      console.log('   1. Make sure 2FA is enabled in your Google account');
      console.log('   2. Check that you\'re using the correct app password');
      console.log('   3. Verify your .env file has the correct values');
      console.log('   4. Make sure you have internet connection');
    }
  } catch (error) {
    console.log('❌ Error testing email connection:', error.message);
  }
}

checkEmailConnection();
