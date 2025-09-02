const axios = require('axios');
const FormData = require('form-data');

// Функция для проверки конфигурации ImgBB
const checkImgBBConfig = () => {
  const hasApiKey = !!process.env.IMGBB_API_KEY;
  
  console.log('ImgBB конфигурация:');
  console.log('- IMGBB_API_KEY:', hasApiKey ? 'Настроен' : 'Не настроен');
  
  return hasApiKey;
};

// Функция для загрузки файла в ImgBB
const uploadFileToImgBB = async (fileBuffer, fileName, mimeType) => {
  if (!checkImgBBConfig()) {
    throw new Error('ImgBB is not configured. Please set IMGBB_API_KEY environment variable.');
  }
  
  try {
    console.log(`Загружаем файл ${fileName} в ImgBB...`);
    
    // Проверяем поддерживаемые типы файлов
    const supportedImageTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/bmp', 'image/webp'];
    const supportedVideoTypes = ['video/mp4', 'video/webm', 'video/avi'];
    
    if (!supportedImageTypes.includes(mimeType) && !supportedVideoTypes.includes(mimeType)) {
      throw new Error(`Неподдерживаемый тип файла: ${mimeType}. ImgBB поддерживает только изображения и видео.`);
    }
    
    // Проверяем размер файла (максимум 32MB)
    const maxSize = 32 * 1024 * 1024; // 32MB
    if (fileBuffer.length > maxSize) {
      throw new Error(`Файл слишком большой. Максимальный размер: 32MB`);
    }
    
    // Создаем FormData для загрузки
    const formData = new FormData();
    formData.append('key', process.env.IMGBB_API_KEY);
    formData.append('image', fileBuffer, {
      filename: fileName,
      contentType: mimeType
    });
    
    // Загружаем файл в ImgBB
    const response = await axios.post('https://api.imgbb.com/1/upload', formData, {
      headers: {
        ...formData.getHeaders(),
      },
      timeout: 30000 // 30 секунд таймаут
    });
    
    if (response.data.success) {
      const result = response.data.data;
      
      console.log(`Файл успешно загружен в ImgBB:`, {
        id: result.id,
        url: result.url,
        display_url: result.display_url,
        size: result.size
      });
      
      return {
        url: result.url,
        displayUrl: result.display_url,
        deleteUrl: result.delete_url,
        fileName: fileName,
        mimeType: mimeType,
        size: result.size,
        id: result.id
      };
    } else {
      throw new Error(`ImgBB API error: ${response.data.error?.message || 'Unknown error'}`);
    }
    
  } catch (error) {
    console.error('Ошибка загрузки в ImgBB:', error);
    
    if (error.response) {
      console.error('ImgBB API Response:', error.response.data);
    }
    
    throw new Error(`ImgBB upload failed: ${error.message}`);
  }
};

// Функция для удаления файла из ImgBB
const deleteFileFromImgBB = async (deleteUrl) => {
  if (!deleteUrl) {
    throw new Error('Delete URL is required');
  }
  
  try {
    console.log(`Удаляем файл из ImgBB: ${deleteUrl}`);
    
    const response = await axios.get(deleteUrl, {
      timeout: 10000
    });
    
    console.log('Файл удален из ImgBB:', response.data);
    return response.data;
  } catch (error) {
    console.error('Ошибка удаления файла из ImgBB:', error);
    throw error;
  }
};

// Функция для получения информации о файле
const getFileInfo = async (imageUrl) => {
  try {
    // ImgBB не предоставляет API для получения метаданных
    // Возвращаем базовую информацию
    return {
      url: imageUrl,
      displayUrl: imageUrl,
      timestamp: new Date().toISOString()
    };
  } catch (error) {
    console.error('Ошибка получения информации о файле:', error);
    throw error;
  }
};

module.exports = {
  uploadFileToImgBB,
  deleteFileFromImgBB,
  getFileInfo,
  checkImgBBConfig
};
