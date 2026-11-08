// Pictures of the things in the database. They are not embedded: a picture is a file in a
// folder named IMG beside this HTML file, and the row holds its name. The folder travels with
// the file. Where the browser lets a page write into a folder the user picks (Chrome, Edge),
// choosing a picture copies it there; elsewhere the user copies it by hand, and is told how.
import { h, button } from './dom.js';

export const IMAGE_DIR = 'IMG';
export const imageSrc = (name) => `${IMAGE_DIR}/${encodeURIComponent(String(name || '')).replace(/%2F/gi, '/')}`;
export const GUIDE = `Pictures live in a folder named ${IMAGE_DIR} beside this HTML file (next to it, not inside Downloads unless the file is there too). Copy the picture into that folder and enter its file name here; move the folder together with the file.`;

/** A thumbnail that opens the picture full size; a placeholder with the name when the file is not beside this one. */
export function thumb(name, { size = 40, caption = '' } = {}) {
  if (!name) return null;
  const img = h('img', { class: 'thumb', src: imageSrc(name), alt: caption || name, title: `${name} — click to enlarge`, style: { width: `${size}px`, height: `${size}px` }, onclick: (e) => { e.stopPropagation(); lightbox(name, caption); } });
  img.addEventListener('error', () => { img.replaceWith(h('span', { class: 'thumb missing', title: `${IMAGE_DIR}/${name} was not found beside this file. ${GUIDE}`, style: { width: `${size}px`, height: `${size}px` } }, '🖼')); });
  return img;
}

/** The picture at full size over the page; a click or Escape closes it. */
export function lightbox(name, caption = '') {
  const close = () => { box.remove(); document.removeEventListener('keydown', onKey); };
  const onKey = (e) => { if (e.key === 'Escape') close(); };
  const box = h('div', { class: 'lightbox', onclick: close },
    h('figure', { onclick: (e) => e.stopPropagation() }, h('img', { src: imageSrc(name), alt: caption || name }), h('figcaption', caption || name, ' ', h('span', { class: 'muted' }, `${IMAGE_DIR}/${name}`), ' ', button('Close', close, { class: 'small' }))));
  document.addEventListener('keydown', onKey);
  document.body.appendChild(box);
}

let folder = null; // the IMG folder handle, once chosen in this session

const canWrite = () => typeof window !== 'undefined' && typeof window.showDirectoryPicker === 'function';

/**
 * Lets the user choose a picture for a row. Returns the file name to store, or null when the
 * user gave up. With the File System Access API the picture is copied into the IMG folder the
 * user points at (asked once per session); without it, the name is taken and the copy is left
 * to the user, who is told how. `notify(kind, text)` carries the outcome.
 */
export async function chooseImage({ notify = () => {} } = {}) {
  const file = await pickImageFile();
  if (!file) return null;
  if (!canWrite()) { notify('warn', `«${file.name}» noted. This browser cannot copy it for you: ${GUIDE}`); return file.name; }
  try {
    if (!folder) {
      notify('info', `Choose the ${IMAGE_DIR} folder beside this HTML file (create it first if it is not there).`);
      folder = await window.showDirectoryPicker({ mode: 'readwrite', id: 'vulcano-img', startIn: 'documents' });
      if (folder.name !== IMAGE_DIR) notify('warn', `The folder is named «${folder.name}», not ${IMAGE_DIR}: the pictures will only show if it is renamed ${IMAGE_DIR} and sits beside this file.`);
    }
    const handle = await folder.getFileHandle(file.name, { create: true });
    const w = await handle.createWritable();
    await w.write(file);
    await w.close();
    notify('ok', `«${file.name}» copied into ${folder.name}/.`);
    return file.name;
  } catch (e) {
    if (e && e.name === 'AbortError') return null;
    notify('warn', `«${file.name}» noted, but it could not be copied (${e.message || e}). ${GUIDE}`);
    return file.name;
  }
}

/** The picked file, through the file dialog. */
function pickImageFile() {
  return new Promise((resolve) => {
    const inp = h('input', { type: 'file', accept: 'image/*', style: { display: 'none' } });
    inp.addEventListener('change', () => { resolve(inp.files[0] || null); inp.remove(); });
    inp.addEventListener('cancel', () => { resolve(null); inp.remove(); });
    document.body.appendChild(inp);
    inp.click();
  });
}

/** The forget button: a new folder may be chosen next time. */
export const forgetFolder = () => { folder = null; };
export const folderChosen = () => !!folder;
