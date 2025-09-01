const axios = require('axios');

// Конфигурация GitLab
const GITLAB_TOKEN = 'glpat-HSRmNi2RM7pbzVu9YZZK286MQp1Omh2N2ZlCw.01.1214lr8of';
const GITLAB_URL = 'https://gitlab.com';

// Кэш для проекта
let cachedProject = null;

// Создаем axios instance для GitLab API
const gitlabApi = axios.create({
  baseURL: `${GITLAB_URL}/api/v4`,
  headers: {
    'Authorization': `Bearer ${GITLAB_TOKEN}`,
    'Content-Type': 'application/json'
  }
});

/**
 * Получает или создает проект для хранения файлов
 */
async function getOrCreateProject() {
  // Если проект уже кэширован, возвращаем его
  if (cachedProject) {
    return cachedProject;
  }

  try {
    // Сначала пытаемся найти существующий проект
    const projectsResponse = await gitlabApi.get('/projects', {
      params: {
        membership: true,
        per_page: 10,
        order_by: 'updated_at',
        sort: 'desc'
      }
    });

    if (projectsResponse.data.length > 0) {
      // Ищем проект с названием SocialSpace-Files или берем первый доступный
      let project = projectsResponse.data.find(p => p.name.includes('SocialSpace'));
      if (!project) {
        project = projectsResponse.data[0];
      }
      
      console.log(`Используем существующий проект: ${project.name} (ID: ${project.id})`);
      cachedProject = project;
      return project;
    }

    // Если проектов нет, создаем новый
    console.log('Создаем новый проект для SocialSpace...');
    
    // Получаем информацию о пользователе
    const userResponse = await gitlabApi.get('/user');
    
    const createResponse = await gitlabApi.post('/projects', {
      name: 'SocialSpace-Files',
      path: 'socialspace-files',
      namespace_id: userResponse.data.id,
      description: 'Хранилище файлов для SocialSpace',
      visibility: 'private',
      initialize_with_readme: true,
      default_branch: 'main'
    });

    console.log(`Новый проект создан: ${createResponse.data.name} (ID: ${createResponse.data.id})`);
    cachedProject = createResponse.data;
    return createResponse.data;

  } catch (error) {
    console.error('Ошибка при получении/создании проекта:', error.response?.data || error.message);
    throw new Error(`Не удалось получить или создать проект GitLab: ${error.message}`);
  }
}

/**
 * Проверяет, существует ли проект
 */
async function checkProjectExists() {
  try {
    return await getOrCreateProject();
  } catch (error) {
    console.error('Ошибка при проверке проекта GitLab:', error);
    throw new Error(`Проблема с проектом GitLab: ${error.message}`);
  }
}

/**
 * Убеждается, что папка uploads существует в репозитории
 */
async function ensureUploadsFolder() {
  try {
    const project = await getOrCreateProject();
    const projectId = project.id;

    // Проверяем, существует ли папка uploads
    try {
      const response = await gitlabApi.get(`/projects/${projectId}/repository/tree`, {
        params: { path: 'uploads', ref: 'main' }
      });
      
      if (response.data.length > 0) {
        return true;
      }
    } catch (error) {
      if (error.response?.status === 404) {
        // Создаем папку uploads, загружая пустой файл .gitkeep
        try {
          await gitlabApi.post(`/projects/${projectId}/repository/files/uploads%2F.gitkeep`, {
            branch: 'main',
            content: '', // Пустой файл
            commit_message: 'Create uploads folder',
            encoding: 'base64'
          });
          return true;
        } catch (createError) {
          console.error('Ошибка при создании папки uploads:', createError.response?.data || createError.message);
          return false;
        }
      }
    }
    
    return true;
  } catch (error) {
    console.error('Ошибка при проверке/создании папки uploads:', error);
    return false;
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
    const project = await getOrCreateProject();
    const projectId = project.id;
    
    // Убеждаемся, что папка uploads существует
    await ensureUploadsFolder();
    
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
    const project = await getOrCreateProject();
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
    const project = await getOrCreateProject();
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
    const project = await getOrCreateProject();
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
  checkProjectExists,
  ensureUploadsFolder
};
