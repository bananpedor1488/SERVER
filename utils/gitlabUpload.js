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
 * Загружает файл на GitLab и возвращает ссылку на него
 * @param {Buffer} fileBuffer - Буфер файла
 * @param {string} fileName - Имя файла
 * @param {string} mimeType - MIME тип файла
 * @returns {Promise<Object>} - Объект с URL и информацией о файле
 */
async function uploadFileToGitLab(fileBuffer, fileName, mimeType) {
  try {
    // Создаем уникальное имя файла с временной меткой
    const timestamp = Date.now();
    const fileExtension = fileName.split('.').pop();
    const uniqueFileName = `${timestamp}_${fileName}`;
    
    // Путь к файлу в репозитории
    const filePath = `uploads/${uniqueFileName}`;
    
    // Конвертируем буфер в base64
    const base64Content = fileBuffer.toString('base64');
    
    // Загружаем файл через GitLab API
    const response = await gitlabApi.post(`/projects/${GITLAB_PROJECT_ID}/repository/files/${encodeURIComponent(filePath)}`, {
      branch: 'main',
      content: base64Content,
      commit_message: `Upload file: ${fileName}`,
      encoding: 'base64'
    });

    // URL для скачивания файла
    const downloadUrl = `${GITLAB_URL}/api/v4/projects/${GITLAB_PROJECT_ID}/repository/files/${encodeURIComponent(filePath)}/raw?ref=main`;
    
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
    const response = await gitlabApi.get(`/projects/${GITLAB_PROJECT_ID}/repository/files/${encodeURIComponent(filePath)}/raw`, {
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
    await gitlabApi.delete(`/projects/${GITLAB_PROJECT_ID}/repository/files/${encodeURIComponent(filePath)}`, {
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
    const response = await gitlabApi.get(`/projects/${GITLAB_PROJECT_ID}/repository/tree`, {
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

/**
 * Проверяет, существует ли проект, и получает информацию о нем
 */
async function checkProjectExists() {
  try {
    const response = await gitlabApi.get(`/projects/${GITLAB_PROJECT_ID}`);
    console.log('Проект GitLab найден:', response.data.name);
    return response.data;
  } catch (error) {
    console.error('Ошибка при проверке проекта GitLab:', error);
    throw new Error(`Проект GitLab не найден: ${error.message}`);
  }
}

module.exports = {
  uploadFileToGitLab,
  readFileFromGitLab,
  deleteFileFromGitLab,
  listFilesInUploads,
  checkProjectExists
};
