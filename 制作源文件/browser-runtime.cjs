/* Portable Playwright resolution; optional environment overrides, no downloads. */
const fs=require('node:fs'),path=require('node:path'),os=require('node:os');
const candidates=[process.env.PLAYWRIGHT_MODULE_PATH,'playwright',path.join(os.homedir(),'.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright')].filter(Boolean);
let playwright;
for(const candidate of candidates){try{playwright=require(candidate);break;}catch(error){if(candidate===process.env.PLAYWRIGHT_MODULE_PATH)throw error;}}
if(!playwright)throw Error('Playwright not found. Install playwright locally or set PLAYWRIGHT_MODULE_PATH.');
let executablePath=process.env.CHROME_EXECUTABLE_PATH;
if(executablePath&&!fs.existsSync(executablePath))throw Error('CHROME_EXECUTABLE_PATH does not exist: '+executablePath);
if(!executablePath){
 const bundled=playwright.chromium.executablePath();
 if(fs.existsSync(bundled))executablePath=bundled;
 else {
  const cache=path.join(os.homedir(),'.cache/hyperframes/chrome/chrome-headless-shell');
  if(fs.existsSync(cache))for(const version of fs.readdirSync(cache).sort().reverse()){
   const file=path.join(cache,version,'chrome-headless-shell-win64/chrome-headless-shell.exe');
   if(fs.existsSync(file)){executablePath=file;break;}
  }
 }
}
module.exports={chromium:playwright.chromium,executablePath};
