import { useState } from 'react';
import { Platform } from 'react-native';
import { Directory, File, Paths } from 'expo-file-system';
import { getPref, setPref } from '@/utils/prefs';
import { useStore } from 'react-redux';
import { Download } from 'lucide-react-native';
import { Button } from './Button';
import { showToast } from './Toast';
import { API_BASE_URL } from '@/constants';

const TIMEOUT_MS = 90000; // working-draft quotations are rendered by a headless browser on each request

// GET a server document with the user's token. Uses fetch, not File.downloadFileAsync: that one gives up after 10 s
// (too short for rendered PDFs) and hides the server's error message. Throws an Error whose message is user-ready.
async function fetchServer(path, token) {
  const abort = new AbortController();
  const timer = setTimeout(() => abort.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(`${API_BASE_URL}${path}`, { headers: { Authorization: `Bearer ${token}`, 'X-Client': 'mobile' }, signal: abort.signal });
    if (!res.ok) {
      const body = await res.json().catch(() => null);
      throw new Error(body?.message || `The server answered ${res.status}. Try again.`);
    }
    return res;
  } catch (e) {
    if (e?.name === 'AbortError') throw new Error('The server took too long to make the document. Try again.');
    if (e instanceof TypeError) throw new Error('Check your connection and try again.');
    throw e;
  } finally {
    clearTimeout(timer);
  }
}

// The document's HTML (same page the website shows), for the in-app preview.
export async function fetchServerHtml(path, token) {
  return (await fetchServer(path, token)).text();
}


const FOLDER_KEY = 'pdfDownloadFolder';
// Android's folder picker opens here. Android 11+ won't let apps use the Download root itself, so the user
// picks or creates a folder inside it once (e.g. Download/Rudhram CRM); the app keeps write access to it.
const ANDROID_DOWNLOADS = 'content://com.android.externalstorage.documents/document/primary%3ADownload';

const pickAndroidFolder = async () => {
  showToast({ title: 'Choose where to save PDFs', message: 'In Downloads, tap "New folder" (e.g. Rudhram CRM), then "Use this folder". Asked only once.' });
  const dir = await Directory.pickDirectoryAsync(ANDROID_DOWNLOADS);
  await setPref(FOLDER_KEY, dir.uri);
  return dir;
};

const writeInto = async (dir, fileName, bytes) => {
  const file = dir.createFile(fileName.replace(/\.pdf$/i, ''), 'application/pdf');
  await file.write(bytes);
  return file;
};

// One tap: saves the PDF to the device. Android: into the remembered folder under Downloads (picked on first use).
// iOS (no shared Downloads): into the app's Documents, shown in Files › On My iPhone › Rudhram CRM.
export async function downloadServerPdf(path, fileName, token, label = 'PDF') {
  try {
    const bytes = new Uint8Array(await (await fetchServer(path, token)).arrayBuffer());
    if (Platform.OS === 'android') {
      const saved = await getPref(FOLDER_KEY);
      let dir = saved ? new Directory(saved) : await pickAndroidFolder();
      try {
        await writeInto(dir, fileName, bytes);
      } catch (e) {
        if (!saved) throw e;
        // The remembered folder was deleted or its access was removed: ask once more.
        await setPref(FOLDER_KEY, null);
        dir = await pickAndroidFolder();
        await writeInto(dir, fileName, bytes);
      }
      showToast({ title: `${fileName} downloaded`, message: `Saved in ${decodeURIComponent(dir.uri).split(':').pop() || 'Downloads'}.` });
      return;
    }
    const file = new File(Paths.document, fileName);
    if (file.exists) file.delete();
    file.create();
    await file.write(bytes);
    showToast({ title: `${fileName} downloaded`, message: 'Find it in Files › On My iPhone › Rudhram CRM.' });
  } catch (e) {
    const cancelled = /cancel/i.test(e?.message || '');
    showToast({ title: cancelled ? 'Download cancelled' : `Couldn't download the ${label}`, message: cancelled ? 'No folder was chosen.' : e?.message || 'Try again.' });
  }
}

// "Download PDF": one tap saves the server PDF to the device (see downloadServerPdf).
// `refresh` (the screen's refetch) runs first so an expired login is renewed, since this direct request can't refresh it.
export function PdfActions({ path, fileName, label = 'PDF', title = 'Download PDF', refresh }) {
  const store = useStore();
  const [busy, setBusy] = useState(false);
  const download = async () => {
    setBusy(true);
    await refresh?.();
    await downloadServerPdf(path, fileName, store.getState().auth.accessToken, label);
    setBusy(false);
  };
  return <Button title={title} icon={Download} variant="secondary" loading={busy} onPress={download} />;
}
