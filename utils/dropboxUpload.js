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
  if (!sharedUrl) return null;
  if (sharedUrl.includes('?dl=')) return sharedUrl.replace(/\?dl=\d$/, '?dl=1');
  return sharedUrl + '?dl=1';
}

async function getOrCreateSharedLink(path) {
  try {
    const existing = await dbx.sharingListSharedLinks({ path, direct_only: true });
    if (existing.links && existing.links.length > 0) {
      return toDirectDownloadUrl(existing.links[0].url);
    }
  } catch (_) {}
  const created = await dbx.sharingCreateSharedLinkWithSettings({ path });
  return toDirectDownloadUrl(created.url);
}

async function uploadFileToDropbox(fileBuffer, fileName, mimeType) {
  if (!dbx) throw new Error('Dropbox is not configured');
  await ensureBaseFolder();

  const timestamp = Date.now();
  const safeName = fileName.replace(/[^\w\-.]/g, '_');
  const dropboxPath = `${BASE_FOLDER}/${timestamp}_${safeName}`;

  await dbx.filesUpload({
    path: dropboxPath,
    contents: fileBuffer,
    mode: { '.tag': 'add' },
    autorename: true,
    mute: true
  });

  const directUrl = await getOrCreateSharedLink(dropboxPath);

  return {
    url: directUrl,
    dropboxPath,
    fileName: `${timestamp}_${safeName}`,
    mimeType
  };
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
