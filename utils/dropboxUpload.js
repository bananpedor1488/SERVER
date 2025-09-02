const { Dropbox } = require('dropbox');
const fetch = require('node-fetch');

// Env configuration
const DROPBOX_TOKEN = process.env.DROPBOX_TOKEN; // Long-lived access token (scoped apps can generate one in console)
const DROPBOX_REFRESH_TOKEN = process.env.DROPBOX_REFRESH_TOKEN; // OAuth refresh token
const DROPBOX_APP_KEY = process.env.DROPBOX_APP_KEY; // App key
const DROPBOX_APP_SECRET = process.env.DROPBOX_APP_SECRET; // App secret

let dbx;
if (DROPBOX_TOKEN) {
  dbx = new Dropbox({ accessToken: DROPBOX_TOKEN, fetch });
  console.log('Dropbox инициализирован с токеном доступа');
} else if (DROPBOX_REFRESH_TOKEN && DROPBOX_APP_KEY && DROPBOX_APP_SECRET) {
  dbx = new Dropbox({ clientId: DROPBOX_APP_KEY, clientSecret: DROPBOX_APP_SECRET, refreshToken: DROPBOX_REFRESH_TOKEN, fetch });
  console.log('Dropbox инициализирован с OAuth конфигурацией');
} else {
  console.warn('Warning: Dropbox is not fully configured. Set DROPBOX_TOKEN or (DROPBOX_APP_KEY, DROPBOX_APP_SECRET, DROPBOX_REFRESH_TOKEN).');
}

// Функция для проверки прав доступа Dropbox
async function checkDropboxPermissions() {
  if (!dbx) {
    console.error('Dropbox не инициализирован');
    return false;
  }
  
  try {
    console.log('Проверяем права доступа Dropbox...');
    const account = await dbx.usersGetCurrentAccount();
    console.log('Dropbox аккаунт:', account.result.email);
    
    // Проверяем права на создание ссылок
    const features = await dbx.usersGetAccount();
    console.log('Dropbox функции аккаунта:', features.result);
    
    return true;
  } catch (error) {
    console.error('Ошибка проверки прав Dropbox:', error);
    return false;
  }
}

// Ensure base folder exists
const BASE_FOLDER = '/socialspace/uploads';

async function ensureBaseFolder() {
  try {
    await dbx.filesGetMetadata({ path: BASE_FOLDER });
    return true;
  } catch (error) {
    if (error?.error?.error_summary?.includes('not_found')) {
      await dbx.filesCreateFolderV2({ path: BASE_FOLDER, autorename: false });
      return true;
    }
    throw error;
  }
}

function toDirectDownloadUrl(sharedUrl) {
  if (!sharedUrl) {
    console.log('toDirectDownloadUrl: sharedUrl is null or undefined');
    return null;
  }
  
  if (typeof sharedUrl !== 'string') {
    console.log('toDirectDownloadUrl: sharedUrl is not a string:', typeof sharedUrl, sharedUrl);
    return null;
  }
  
  // Убираем все параметры и добавляем ?dl=1 для прямого скачивания
  const baseUrl = sharedUrl.split('?')[0];
  const directUrl = baseUrl + '?dl=1';
  
  console.log('toDirectDownloadUrl: converted to direct download URL:', directUrl);
  return directUrl;
}

async function getOrCreateSharedLink(path) {
  try {
    console.log(`Проверяем существующие ссылки для ${path}...`);
    
    // Сначала проверяем существующие ссылки
    const existing = await dbx.sharingListSharedLinks({ path, direct_only: true });
    if (existing.links && existing.links.length > 0) {
      const directUrl = toDirectDownloadUrl(existing.links[0].url);
      console.log(`Найдена существующая ссылка для ${path}:`, directUrl);
      return directUrl;
    }
    
    console.log(`Создаем новую публичную ссылку для ${path}...`);
    
    // Создаем новую ссылку с настройками
    const created = await dbx.sharingCreateSharedLinkWithSettings({ 
      path,
      settings: {
        requested_visibility: 'public',
        audience: 'public',
        access: 'viewer'
      }
    });
    
    console.log('Dropbox API ответ при создании ссылки:', created);
    
    if (created && created.url) {
      const directUrl = toDirectDownloadUrl(created.url);
      console.log(`Создана новая ссылка для ${path}:`, directUrl);
      return directUrl;
    } else {
      console.error('Dropbox API не вернул URL в ответе:', created);
      return null;
    }
    
  } catch (error) {
    console.error(`Ошибка при создании ссылки для ${path}:`, error);
    console.error('Детали ошибки:', {
      message: error.message,
      status: error.status,
      error: error.error
    });
    
    // Пробуем альтернативный способ - создание ссылки без настроек
    try {
      console.log(`Пробуем альтернативный способ создания ссылки для ${path}...`);
      const simpleCreated = await dbx.sharingCreateSharedLinkWithSettings({ path });
      
      if (simpleCreated && simpleCreated.url) {
        const directUrl = toDirectDownloadUrl(simpleCreated.url);
        console.log(`Альтернативная ссылка создана для ${path}:`, directUrl);
        return directUrl;
      }
    } catch (altError) {
      console.error(`Альтернативный способ тоже не сработал:`, altError);
    }
    
    // Последний способ - создаем временную ссылку
    try {
      console.log(`Пробуем создать временную ссылку для ${path}...`);
      const tempLink = await dbx.filesGetTemporaryLink({ path });
      
      if (tempLink && tempLink.link) {
        console.log(`Временная ссылка создана для ${path}:`, tempLink.link);
        return tempLink.link;
      }
    } catch (tempError) {
      console.error(`Создание временной ссылки не удалось:`, tempError);
    }
    
    return null;
  }
}

async function uploadFileToDropbox(fileBuffer, fileName, mimeType) {
  if (!dbx) {
    console.error('Dropbox не настроен! Проверьте переменные окружения.');
    throw new Error('Dropbox is not configured. Please check environment variables.');
  }
  
  try {
    // Проверяем права доступа
    const hasPermissions = await checkDropboxPermissions();
    if (!hasPermissions) {
      console.warn('Предупреждение: Не удалось проверить права Dropbox, продолжаем...');
    }
    
    await ensureBaseFolder();

    const timestamp = Date.now();
    const safeName = fileName.replace(/[^\w\-.]/g, '_');
    const dropboxPath = `${BASE_FOLDER}/${timestamp}_${safeName}`;

    console.log(`Загружаем файл в Dropbox: ${dropboxPath}`);
    
    const uploadResult = await dbx.filesUpload({
      path: dropboxPath,
      contents: fileBuffer,
      mode: { '.tag': 'add' },
      autorename: true,
      mute: true
    });

    console.log('Файл успешно загружен в Dropbox:', uploadResult.result);

    const directUrl = await getOrCreateSharedLink(dropboxPath);

    if (!directUrl) {
      console.error(`Не удалось создать публичную ссылку для ${dropboxPath}`);
      throw new Error(`Failed to create shared link for file ${fileName}`);
    }

    console.log(`Публичная ссылка создана: ${directUrl}`);

    return {
      url: directUrl,
      dropboxPath,
      fileName: `${timestamp}_${safeName}`,
      mimeType
    };
  } catch (error) {
    console.error('Ошибка загрузки в Dropbox:', error);
    
    // Более детальная информация об ошибке
    if (error.error) {
      console.error('Dropbox API Error:', error.error);
    }
    
    throw new Error(`Dropbox upload failed: ${error.message}`);
  }
}

async function readFileFromDropbox(path) {
  if (!dbx) throw new Error('Dropbox is not configured');
  const res = await dbx.filesDownload({ path });
  const buffer = Buffer.from(res.result.fileBinary || res.result.fileBlob || []);
  return buffer;
}

async function deleteFileFromDropbox(path) {
  if (!dbx) throw new Error('Dropbox is not configured');
  await dbx.filesDeleteV2({ path });
  return true;
}

async function listFilesInUploads() {
  if (!dbx) throw new Error('Dropbox is not configured');
  await ensureBaseFolder();
  const res = await dbx.filesListFolder({ path: BASE_FOLDER, recursive: false });
  return (res.entries || []).filter(e => e['.tag'] === 'file');
}

module.exports = {
  uploadFileToDropbox,
  readFileFromDropbox,
  deleteFileFromDropbox,
  listFilesInUploads,
  ensureBaseFolder,
  checkDropboxPermissions
};
