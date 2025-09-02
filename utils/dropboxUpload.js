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
} else if (DROPBOX_REFRESH_TOKEN && DROPBOX_APP_KEY && DROPBOX_APP_SECRET) {
  dbx = new Dropbox({ clientId: DROPBOX_APP_KEY, clientSecret: DROPBOX_APP_SECRET, refreshToken: DROPBOX_REFRESH_TOKEN, fetch });
} else {
  console.warn('Warning: Dropbox is not fully configured. Set DROPBOX_TOKEN or (DROPBOX_APP_KEY, DROPBOX_APP_SECRET, DROPBOX_REFRESH_TOKEN).');
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
  
  // Убираем все параметры и добавляем ?dl=1 для прямого скачивания
  const baseUrl = sharedUrl.split('?')[0];
  const directUrl = baseUrl + '?dl=1';
  
  console.log('toDirectDownloadUrl: converted to direct download URL:', directUrl);
  return directUrl;
}

async function getOrCreateSharedLink(path) {
  try {
    const existing = await dbx.sharingListSharedLinks({ path, direct_only: true });
    if (existing.links && existing.links.length > 0) {
      const directUrl = toDirectDownloadUrl(existing.links[0].url);
      console.log(`Found existing shared link for ${path}:`, directUrl);
      return directUrl;
    }
  } catch (error) {
    console.log(`No existing shared link for ${path}:`, error.message);
  }
  const created = await dbx.sharingCreateSharedLinkWithSettings({ path });
  const directUrl = toDirectDownloadUrl(created.url);
  console.log(`Created new shared link for ${path}:`, directUrl);
  return directUrl;
}

async function uploadFileToDropbox(fileBuffer, fileName, mimeType) {
  if (!dbx) {
    console.error('Dropbox не настроен! Проверьте переменные окружения.');
    throw new Error('Dropbox is not configured. Please check environment variables.');
  }
  
  try {
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
  ensureBaseFolder
};
