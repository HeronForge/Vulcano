// Entry point of the single-file build: captures the shell of this file (so that «Save» can
// rebuild it with the data blocks), then mounts the application on #app.
import { captureShell } from './io/file.js';
import { start } from './ui/app.js';

const boot = () => { captureShell(); start(document.getElementById('app')); };
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
else boot();
