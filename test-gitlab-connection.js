const axios = require('axios');

// Конфигурация GitLab
const GITLAB_TOKEN = 'glpat-HSRmN5i2RM7pbzVu9YZZK286MQp1Omh2N2ZlCw.01.1214lr8of';
const GITLAB_URL = 'https://gitlab.com';

// Создаем axios instance для GitLab API
const gitlabApi = axios.create({
  baseURL: `${GITLAB_URL}/api/v4`,
  headers: {
    'Authorization': `Bearer ${GITLAB_TOKEN}`,
    'Content-Type': 'application/json'
  }
});

async function testGitLabConnection() {
  try {
    console.log('🔍 Тестируем подключение к GitLab...');
    
    // 1. Проверяем токен - получаем информацию о текущем пользователе
    console.log('\n1. Проверяем токен...');
    try {
      const userResponse = await gitlabApi.get('/user');
      console.log('✅ Токен валиден');
      console.log(`👤 Пользователь: ${userResponse.data.name} (${userResponse.data.username})`);
      console.log(`📧 Email: ${userResponse.data.email}`);
    } catch (error) {
      console.error('❌ Ошибка с токеном:', error.response?.status, error.response?.data?.message || error.message);
      return;
    }
    
    // 2. Получаем список доступных проектов
    console.log('\n2. Получаем список доступных проектов...');
    try {
      const projectsResponse = await gitlabApi.get('/projects', {
        params: {
          membership: true,
          per_page: 20,
          order_by: 'updated_at',
          sort: 'desc'
        }
      });
      
      console.log(`✅ Найдено проектов: ${projectsResponse.data.length}`);
      
      if (projectsResponse.data.length > 0) {
        console.log('\n📋 Доступные проекты:');
        projectsResponse.data.forEach((project, index) => {
          console.log(`${index + 1}. ${project.name} (ID: ${project.id})`);
          console.log(`   Путь: ${project.path_with_namespace}`);
          console.log(`   Видимость: ${project.visibility}`);
          console.log(`   Последнее обновление: ${project.last_activity_at}`);
          console.log('');
        });
        
        // Предлагаем использовать первый доступный проект
        const firstProject = projectsResponse.data[0];
        console.log(`💡 Рекомендуем использовать проект: ${firstProject.name} (ID: ${firstProject.id})`);
        console.log(`   Обновите GITLAB_PROJECT_ID в gitlabUpload.js на: ${firstProject.id}`);
      } else {
        console.log('⚠️ Нет доступных проектов. Создайте новый проект на GitLab.');
      }
      
    } catch (error) {
      console.error('❌ Ошибка при получении проектов:', error.response?.status, error.response?.data?.message || error.message);
    }
    
    // 3. Проверяем конкретный проект из конфигурации
    console.log('\n3. Проверяем проект из конфигурации...');
    const configProjectId = '796e02a65991f829fb08189b820390acbef4f11c';
    try {
      const projectResponse = await gitlabApi.get(`/projects/${configProjectId}`);
      console.log(`✅ Проект ${configProjectId} найден: ${projectResponse.data.name}`);
      console.log(`   Путь: ${projectResponse.data.path_with_namespace}`);
      console.log(`   Видимость: ${projectResponse.data.visibility}`);
    } catch (error) {
      console.error(`❌ Проект ${configProjectId} не найден:`, error.response?.status, error.response?.data?.message || error.message);
      
      if (error.response?.status === 404) {
        console.log('💡 Проект не существует или у вас нет доступа к нему.');
        console.log('   Создайте новый проект на GitLab или используйте существующий доступный проект.');
      }
    }
    
    // 4. Проверяем возможность создания файлов
    console.log('\n4. Проверяем права на запись...');
    try {
      const projectsResponse = await gitlabApi.get('/projects', {
        params: {
          membership: true,
          per_page: 1
        }
      });
      
      if (projectsResponse.data.length > 0) {
        const testProject = projectsResponse.data[0];
        console.log(`🧪 Тестируем права на проект: ${testProject.name}`);
        
        // Проверяем права на ветку main
        try {
          const branchResponse = await gitlabApi.get(`/projects/${testProject.id}/repository/branches/main`);
          console.log(`✅ Ветка main доступна`);
          console.log(`   Последний коммит: ${branchResponse.data.commit.short_id}`);
        } catch (error) {
          console.log(`⚠️ Ветка main недоступна: ${error.response?.data?.message || error.message}`);
        }
      }
    } catch (error) {
      console.error('❌ Ошибка при проверке прав:', error.message);
    }
    
  } catch (error) {
    console.error('❌ Общая ошибка:', error.message);
  }
}

// Запускаем тест
testGitLabConnection();
