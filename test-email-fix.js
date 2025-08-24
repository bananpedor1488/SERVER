// Тест исправления email функциональности
console.log('🧪 Testing email fix...');

try {
  const nodemailer = require('nodemailer');
  console.log('✅ Nodemailer imported successfully');
  console.log('📦 Nodemailer version:', nodemailer.version);
  console.log('📦 createTransport type:', typeof nodemailer.createTransport);
  
  if (typeof nodemailer.createTransport === 'function') {
    console.log('✅ createTransport method is available!');
    
    // Тестируем создание транспорта (без реальной отправки)
    try {
      const transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
          user: 'test@example.com',
          pass: 'test-password'
        }
      });
      console.log('✅ Transporter created successfully');
      console.log('📧 Transporter type:', typeof transporter);
    } catch (error) {
      console.log('⚠️  Expected error creating transporter (no real credentials):', error.message);
    }
    
  } else {
    console.log('❌ createTransport method is not available!');
    process.exit(1);
  }
  
} catch (error) {
  console.error('❌ Error importing nodemailer:', error.message);
  process.exit(1);
}

console.log('🎉 Email fix test completed successfully!');
