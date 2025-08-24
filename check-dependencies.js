console.log('🔍 Checking dependencies...\n');

// Проверяем nodemailer
try {
  const nodemailer = require('nodemailer');
  console.log('✅ Nodemailer is installed');
  console.log('   Version:', nodemailer.version || 'unknown');
  console.log('   Type:', typeof nodemailer);
  console.log('   createTransport:', typeof nodemailer.createTransport);

if (typeof nodemailer.createTransport === 'function') {
  console.log('✅ createTransport is available');
} else {
  console.log('❌ createTransport is not available');
  }
} catch (error) {
  console.log('❌ Nodemailer is NOT installed:', error.message);
  console.log('\n📦 Installing nodemailer...');
  
  const { execSync } = require('child_process');
  try {
    execSync('npm install nodemailer@6.9.7', { stdio: 'inherit' });
    console.log('✅ Nodemailer installed successfully');
  } catch (installError) {
    console.log('❌ Failed to install nodemailer:', installError.message);
  }
}

// Проверяем другие зависимости
const dependencies = [
  'express',
  'mongoose',
  'bcrypt',
  'jsonwebtoken',
  'cors',
  'dotenv'
];

console.log('\n📋 Checking other dependencies:');
dependencies.forEach(dep => {
  try {
    require(dep);
    console.log(`   ✅ ${dep}`);
  } catch (error) {
    console.log(`   ❌ ${dep}: ${error.message}`);
  }
});

console.log('\n🔧 Environment variables:');
console.log('   EMAIL_USER:', process.env.EMAIL_USER ? '✅ Set' : '❌ Missing');
console.log('   EMAIL_PASSWORD:', process.env.EMAIL_PASSWORD ? '✅ Set' : '❌ Missing');
console.log('   MONGO_URI:', process.env.MONGO_URI ? '✅ Set' : '❌ Missing');
console.log('   JWT_SECRET:', process.env.JWT_SECRET ? '✅ Set' : '❌ Missing');
