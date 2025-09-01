const { checkProjectExists } = require('./utils/gitlabUpload');

async function testGitLab() {
  try {
    console.log('🧪 Тестируем GitLab подключение...');
    
    const project = await checkProjectExists();
    console.log('✅ Успех!');
    console.log(`📁 Проект: ${project.name}`);
    console.log(`🆔 ID: ${project.id}`);
    console.log(`🔗 URL: ${project.web_url}`);
    
    if (project.id !== '796e02a65991f829fb08189b820390acbef4f11c') {
      console.log('\n⚠️ ВАЖНО: Обновите GITLAB_PROJECT_ID в gitlabUpload.js на:', project.id);
    }
    
  } catch (error) {
    console.error('❌ Ошибка:', error.message);
  }
}

testGitLab();
