// Тестовый скрипт для проверки GitHub API

console.log('Тестируем GitHub API...');

try {
  const { uploadFileToGitHub, ensureRepositoryExists } = require('./utils/githubUpload');
  
  async function testGitHub() {
    console.log('1. Проверяем репозиторий...');
    await ensureRepositoryExists();
    
    console.log('2. Создаем тестовый файл...');
    const testContent = Buffer.from('Привет, это тестовый файл!', 'utf8');
    
    console.log('3. Загружаем файл на GitHub...');
    const result = await uploadFileToGitHub(testContent, 'test.txt', 'text/plain');
    
    console.log('4. Результат:', result);
    console.log('✅ GitHub интеграция работает!');
  }
  
  testGitHub().catch(error => {
    console.error('❌ Ошибка:', error.message);
  });
  
} catch (error) {
  console.error('❌ Ошибка при импорте:', error.message);
  console.log('Возможно, нужно установить @octokit/rest');
  console.log('Запустите: npm install @octokit/rest');
}
