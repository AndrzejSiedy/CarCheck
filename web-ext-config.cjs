// web-ext configuration — https://extensionworkshop.com/documentation/develop/web-ext-configuration-file/
// Run: npm run dev (starts esbuild watch + Chrome together)

module.exports = {
  sourceDir: './dist',
  run: {
    target: ['chromium'],
    startUrl: [
      'https://www.autotrader.co.uk',
      'chrome://extensions',
    ],
    // Windows: web-ext usually finds Chrome automatically.
    // If it doesn't, uncomment and adjust the path below:
    // chromiumBinary: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    keepProfileChanges: false,
  },
};
