const { Octokit } = require('@octokit/rest');

// Конфигурация GitHub
const GITHUB_TOKEN = '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';
const GITHUB_OWNER = 'bananpedor1488';
const GITHUB_REPO = 'files'; // Репозиторий для хранения файлов

// Создаем экземпляр Octokit
const octokit = new Octokit({
  auth: GITHUB_TOKEN,
});

/**
 * Загружает файл на GitHub и возвращает ссылку на него
 * @param {Buffer} fileBuffer - Буфер файла
 * @param {string} fileName - Имя файла
 * @param {string} mimeType - MIME тип файла
 * @returns {Promise<string>} - URL файла на GitHub
 */
async function uploadFileToGitHub(fileBuffer, fileName, mimeType) {
  try {
    // Создаем уникальное имя файла с временной меткой
    const timestamp = Date.now();
    const fileExtension = fileName.split('.').pop();
    const uniqueFileName = `${timestamp}_${fileName}`;
    
    // Путь к файлу в репозитории
    const filePath = `uploads/${uniqueFileName}`;
    
    // Конвертируем буфер в base64
    const base64Content = fileBuffer.toString('base64');
    
    // Загружаем файл на GitHub
    const response = await octokit.rest.repos.createOrUpdateFileContents({
      owner: GITHUB_OWNER,
      repo: GITHUB_REPO,
      path: filePath,
      message: `Upload file: ${fileName}`,
      content: base64Content,
      committer: {
        name: 'SocialSpace Bot',
        email: 'bot@socialspace.com'
      },
      author: {
        name: 'SocialSpace Bot',
        email: 'bot@socialspace.com'
      }
    });

    // Формируем URL для скачивания файла
    const downloadUrl = `https://raw.githubusercontent.com/${GITHUB_OWNER}/${GITHUB_REPO}/main/${filePath}`;
    
    console.log('Файл успешно загружен на GitHub:', downloadUrl);
    
    return {
      url: downloadUrl,
      githubUrl: response.data.content.html_url,
      sha: response.data.content.sha,
      path: filePath
    };
    
  } catch (error) {
    console.error('Ошибка при загрузке файла на GitHub:', error);
    throw new Error(`Не удалось загрузить файл на GitHub: ${error.message}`);
  }
}

/**
 * Проверяет, существует ли репозиторий, и создает его если нет
 */
async function ensureRepositoryExists() {
  try {
    // Проверяем существование репозитория
    await octokit.rest.repos.get({
      owner: GITHUB_OWNER,
      repo: GITHUB_REPO
    });
    console.log('Репозиторий существует');
  } catch (error) {
    if (error.status === 404) {
      console.log('Репозиторий не найден, создаем новый...');
      try {
        await octokit.rest.repos.createForAuthenticatedUser({
          name: GITHUB_REPO,
          description: 'Файловое хранилище для SocialSpace',
          private: false,
          auto_init: true
        });
        console.log('Репозиторий успешно создан');
      } catch (createError) {
        console.error('Ошибка при создании репозитория:', createError);
        throw createError;
      }
    } else {
      console.error('Ошибка при проверке репозитория:', error);
      throw error;
    }
  }
}

module.exports = {
  uploadFileToGitHub,
  ensureRepositoryExists
};
