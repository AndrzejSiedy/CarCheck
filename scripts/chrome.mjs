// Launches Chrome with the CarCheck extension loaded via web-ext API.
// Called by `npm run dev` — avoids shell quoting issues on Windows.

import webExt from 'web-ext';

await webExt.cmd.run(
  {
    target: ['chromium'],
    sourceDir: './dist',
    startUrl: ['https://www.autotrader.co.uk'],
    chromiumBinary: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    keepProfileChanges: false,
    browserConsole: false,
  },
  { shouldExitProgram: true }
);
