// The dialog of «Check for updates…», the reminder line and the one notice — the shape and the
// order of DEDALO's (../heronforge-kb/patterns/self-update.md), in VULCANO's own words. Nothing
// here runs until the reader chooses the menu entry; the only thing remembered is the date.
import { APP_NAME, APP_VERSION } from '../version.js';
import { download } from '../io/exports.js';
import { fetchAnnouncement, buildUpdatedFile, isNewer, rememberCheck, lastChecked, checkOverdue, daysSinceCheck, RELEASE_PAGE, CHECK_INTERVAL_DAYS } from '../io/update.js';
import { h, button, modal } from './dom.js';

const storage = () => { try { return window.localStorage; } catch { return null; } };

export const updateOverdue = () => checkOverdue(storage());
export const updateAge = () => daysSinceCheck(storage());

const whenText = (iso) => { const d = new Date(`${String(iso).slice(0, 10)}T12:00:00`); return Number.isNaN(d.getTime()) ? String(iso) : d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' }); };

const stampLine = () => {
  const at = lastChecked(storage());
  if (!at) return 'This file has never been checked against the project.';
  const days = daysSinceCheck(storage());
  const when = whenText(new Date(at).toISOString());
  return days === 0 ? `Last checked today (${when}).` : `Last checked ${days} day${days === 1 ? '' : 's'} ago (${when}).`;
};

const releaseLink = () => h('a', { href: RELEASE_PAGE, target: '_blank', rel: 'noreferrer' }, RELEASE_PAGE);

/**
 * `ctx` is the app's context: the session (database, project, whether it is unsaved) and the
 * save action. The dialog re-reads the session when it needs it, so «Save first» is seen.
 */
export function checkForUpdates(ctx) {
  const m = modal({ title: 'Check for updates' });
  const close = () => m.close();
  const state = () => { const s = ctx.session; return { db: s.db, job: s.job, identity: s.job ? ctx.meta().identity : null }; };

  const offer = () => {
    m.show(
      h('p', `This file is ${APP_NAME} ${APP_VERSION}. Checking asks the project’s page on GitHub which build is the latest one. Nothing is sent: the question is which version exists, and the answer is a version number.`),
      h('p', { class: 'muted small' }, stampLine(), ' Nothing is ever checked on its own — only when you ask here.'));
    m.act(button('Close', close), button('Check now', ask, { class: 'btn-primary' }));
  };

  const ask = async () => {
    m.show(h('p', 'Asking the project…'));
    m.act(button('Close', close));
    const { ok, announcement, error } = await fetchAnnouncement();
    if (!ok) {
      m.show(
        h('p', 'The project could not be reached: ', h('strong', error), '.'),
        h('p', { class: 'muted small' }, 'A machine with no way out to the internet is the normal case for a test bench. The latest build is always at ', releaseLink(), '.'));
      return;
    }
    rememberCheck(storage(), { version: announcement.version });
    ctx.update();
    if (!isNewer(announcement.version, APP_VERSION)) {
      m.show(
        h('p', h('strong', `${APP_NAME} ${APP_VERSION}`), ' is the latest build.'),
        h('p', { class: 'muted small' }, `Checked just now; the next reminder is in ${CHECK_INTERVAL_DAYS} days.`));
      return;
    }
    found(announcement);
  };

  const found = (announcement) => {
    const dirty = ctx.session.dirty;
    m.show(
      h('p', h('strong', `${APP_NAME} ${announcement.version}`), announcement.date ? ` · ${whenText(announcement.date)}` : '', ` is available. This file is ${APP_VERSION}.`),
      announcement.changes.length ? h('ul', { class: 'update-changes' }, announcement.changes.slice(0, 8).map((c) => h('li', c))) : null,
      h('p', 'Updating downloads the new build with your database and project already inside it, as a new file. The file you are using is not touched and not replaced: keep it until the new one has opened and you have seen your work in it.'),
      dirty
        ? h('p', { class: 'notice warn' }, 'There are unsaved changes. Save first, or the new file would carry the database and the project as they were at the last save.')
        : h('p', { class: 'muted small' }, 'Everything is saved: the new file will carry exactly what is on screen.'),
      announcement.app ? null : h('p', { class: 'notice warn' }, 'The announcement does not name a build to download. Get it from ', releaseLink(), '.'));
    m.act(
      button('Not now', close),
      dirty ? button('Save first', async () => { await ctx.actions.save(); found(announcement); }, { class: 'btn-primary' })
        : announcement.app ? button(`Download ${APP_NAME} ${announcement.version} with my work`, () => fetchBuild(announcement), { class: 'btn-primary' }) : null);
  };

  const fetchBuild = async (announcement) => {
    m.show(
      h('p', `Downloading ${APP_NAME} ${announcement.version} and writing your database and project into it…`),
      h('p', { class: 'muted small' }, 'A build is a few hundred kilobytes; the file that comes out is larger when the project carries the specification’s pictures.'));
    m.act(button('Close', close));
    try {
      const { html, name } = await buildUpdatedFile(state(), announcement);
      const { bytes } = download(html, name, 'text/html;charset=utf-8');
      m.show(
        h('p', h('strong', name), ' has been downloaded.'),
        h('p', 'Open it and check that everything is there — the tables of the database, the assignments, the quote. Only then is the old file safe to replace with it. A folder named IMG beside the old file has to go beside the new one too.'),
        h('p', { class: 'muted small' }, `${APP_NAME} ${announcement.version} · ${Math.round(bytes / 1024)} KB`));
    } catch (err) {
      m.show(
        h('p', 'The update could not be prepared: ', h('strong', err.message), '.'),
        h('p', { class: 'muted small' }, 'Nothing was changed here. The build can also be downloaded by hand from ', releaseLink(), ', and your work carried into it from the File menu: export the project and the database here, import them there.'));
    }
  };

  offer();
}

/** The quiet line of the status row, shown only when the last check is a quarter old. */
export function updateReminderButton(ctx) {
  return h('button', { type: 'button', class: 'status-link status-update', title: `The last check for a newer build was ${updateAge()} days ago. Click to check now — nothing is ever checked on its own.`, onclick: () => checkForUpdates(ctx) }, 'Updates unchecked');
}

export const reminderText = () => `It has been ${updateAge()} days since this file was checked against the project. File ▸ Check for updates asks — nothing is ever checked on its own.`;
