const axios = require('axios');

// Конфигурация GitLab
const GITLAB_TOKEN = 'glpat-HSRmN5i2RM7pbzVu9YZZK286MQp1Omh2N2ZlCw.01.1214lr8of';
const GITLAB_URL = 'https://gitlab.com';
const GITLAB_PROJECT_ID = '796e02a65991f829fb08189b820390acbef4f11c';

// Создаем axios instance для GitLab API
const gitlabApi = axios.create({
  baseURL: `${GITLAB_URL}/api/v4`,
  headers: {
    'Authorization': `Bearer ${GITLAB_TOKEN}`,
    'Content-Type': 'application/json'
  }
});

/**
 * Создает новый проект на GitLab, если он не существует
 */
async function createProjectIfNotExists() {
  try {
    // Сначала пытаемся получить информацию о проекте
    const response = await gitlabApi.get(`/projects/${GITLAB_PROJECT_ID}`);
    console.log('Проект GitLab найден:', response.data.name);
    return response.data;
  } catch (error) {
    if (error.response?.status === 404) {
      console.log('Проект не найден, создаем новый...');
      
      try {
        // Создаем новый проект
        const createResponse = await gitlabApi.post('/projects', {
          name: 'SocialSpace-Files',
          path: 'socialspace-files',
          description: 'Хранилище файлов для SocialSpace',
          visibility: 'private',
          initialize_with_readme: true,
          default_branch: 'main'
        });
        
        console.log('Новый проект создан:', createResponse.data.name);
        console.log('⚠️ ВАЖНО: Обновите GITLAB_PROJECT_ID в gitlabUpload.js на:', createResponse.data.id);
        
        // Возвращаем информацию о созданном проекте
        return createResponse.data;
      } catch (createError) {
        console.error('Ошибка при создании проекта:', createError.response?.data?.message || createError.message);
        
        // Если не удалось создать проект, попробуем найти доступный
        console.log('Пытаемся найти доступный проект...');
        try {
          const projectsResponse = await gitlabApi.get('/projects', {
            params: {
              membership: true,
              per_page: 1,
              order_by: 'updated_at',
              sort: 'desc'
            }
          });
          
          if (projectsResponse.data.length > 0) {
            const availableProject = projectsResponse.data[0];
            console.log(`Найден доступный проект: ${availableProject.name} (ID: ${availableProject.id})`);
            console.log('⚠️ ВАЖНО: Обновите GITLAB_PROJECT_ID в gitlabUpload.js на:', availableProject.id);
            return availableProject;
          }
        } catch (findError) {
          console.error('Не удалось найти доступные проекты:', findError.message);
        }
        
        throw new Error('Не удалось создать или найти доступный проект GitLab');
      }
    } else {
      throw error;
    }
  }
}

/**
 * Проверяет, существует ли проект, и создает его при необходимости
 */
async function checkProjectExists() {
  try {
    return await createProjectIfNotExists();
  } catch (error) {
    console.error('Ошибка при проверке/создании проекта GitLab:', error);
    throw new Error(`Проблема с проектом GitLab: ${error.message}`);
  }
}

/**
 * Загружает файл на GitLab и возвращает ссылку на него
 * @param {Buffer} fileBuffer - Буфер файла
 * @param {string} fileName - Имя файла
 * @param {string} mimeType - MIME тип файла
 * @returns {Promise<Object>} - Объект с URL и информацией о файле
 */
async function uploadFileToGitLab(fileBuffer, fileName, mimeType) {
  try {
    // Убеждаемся, что проект существует
    const project = await checkProjectExists();
    const projectId = project.id;
    
    // Создаем уникальное имя файла с временной меткой
    const timestamp = Date.now();
    const fileExtension = fileName.split('.').pop();
    const uniqueFileName = `${timestamp}_${fileName}`;
    
    // Путь к файлу в репозитории
    const filePath = `uploads/${uniqueFileName}`;
    
    // Конвертируем буфер в base64
    const base64Content = fileBuffer.toString('base64');
    
    // Загружаем файл через GitLab API
    const response = await gitlabApi.post(`/projects/${projectId}/repository/files/${encodeURIComponent(filePath)}`, {
      branch: 'main',
      content: base64Content,
      commit_message: `Upload file: ${fileName}`,
      encoding: 'base64'
    });

    // URL для скачивания файла
    const downloadUrl = `${GITLAB_URL}/api/v4/projects/${projectId}/repository/files/${encodeURIComponent(filePath)}/raw?ref=main`;
    
    console.log('Файл успешно загружен на GitLab:', downloadUrl);
    
    return {
      url: downloadUrl,
      gitlabUrl: response.data.file_path,
      path: filePath,
      fileName: uniqueFileName
    };
    
  } catch (error) {
    console.error('Ошибка при загрузке файла на GitLab:', error);
    throw new Error(`Не удалось загрузить файл на GitLab: ${error.message}`);
  }
}

/**
 * Читает файл с GitLab
 * @param {string} filePath - Путь к файлу в репозитории
 * @returns {Promise<Buffer>} - Содержимое файла
 */
async function readFileFromGitLab(filePath) {
  try {
    const project = await checkProjectExists();
    const projectId = project.id;
    
    const response = await gitlabApi.get(`/projects/${projectId}/repository/files/${encodeURIComponent(filePath)}/raw`, {
      params: { ref: 'main' },
      responseType: 'arraybuffer'
    });
    
    return Buffer.from(response.data);
  } catch (error) {
    console.error('Ошибка при чтении файла с GitLab:', error);
    throw new Error(`Не удалось прочитать файл с GitLab: ${error.message}`);
  }
}

/**
 * Удаляет файл с GitLab
 * @param {string} filePath - Путь к файлу в репозитории
 * @returns {Promise<boolean>} - true если файл удален
 */
async function deleteFileFromGitLab(filePath) {
  try {
    const project = await checkProjectExists();
    const projectId = project.id;
    
    await gitlabApi.delete(`/projects/${projectId}/repository/files/${encodeURIComponent(filePath)}`, {
      data: {
        branch: 'main',
        commit_message: `Delete file: ${filePath}`
      }
    });
    
    console.log('Файл успешно удален с GitLab');
    return true;
  } catch (error) {
    console.error('Ошибка при удалении файла с GitLab:', error);
    throw new Error(`Не удалось удалить файл с GitLab: ${error.message}`);
  }
}

/**
 * Получает список файлов в папке uploads
 * @returns {Promise<Array>} - Список файлов
 */
async function listFilesInUploads() {
  try {
    const project = await checkProjectExists();
    const projectId = project.id;
    
    const response = await gitlabApi.get(`/projects/${projectId}/repository/tree`, {
      params: { 
        path: 'uploads',
        ref: 'main',
        per_page: 100
      }
    });
    
    return response.data;
  } catch (error) {
    console.error('Ошибка при получении списка файлов:', error);
    return [];
  }
}

module.exports = {
  uploadFileToGitLab,
  readFileFromGitLab,
  deleteFileFromGitLab,
  listFilesInUploads,
  checkProjectExists
};
