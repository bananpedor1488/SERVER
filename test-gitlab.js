const { checkProjectExists, listFilesInUploads } = require('./utils/gitlabUpload');

async function testGitLabConnection() {
  try {
    console.log('🔍 Проверяем подключение к GitLab...');
    
    // Проверяем существование проекта
    const projectInfo = await checkProjectExists();
    console.log('✅ Проект найден:', projectInfo.name);
    console.log('📁 Путь:', projectInfo.web_url);
    
    // Получаем список файлов
    console.log('\n📂 Получаем список файлов в папке uploads...');
    const files = await listFilesInUploads();
    
    if (files.length === 0) {
      console.log('📁 Папка uploads пуста или не существует');
    } else {
      console.log(`📁 Найдено файлов: ${files.length}`);
      files.forEach(file => {
        console.log(`  - ${file.name} (${file.type})`);
      });
    }
    
    console.log('\n🎉 GitLab API работает корректно!');
    
  } catch (error) {
    console.error('❌ Ошибка при тестировании GitLab API:', error.message);
  }
}

// Запускаем тест
testGitLabConnection();
