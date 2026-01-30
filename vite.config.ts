import path from 'path';
import fs from 'fs';
import { defineConfig, loadEnv, Plugin } from 'vite';
import react from '@vitejs/plugin-react';

// Generate a consistent build version based on timestamp (YY.MM.DD.HHMM)
const buildVersion = (() => {
  const now = new Date();
  const yy = now.getFullYear().toString().slice(-2);
  const mm = (now.getMonth() + 1).toString().padStart(2, '0');
  const dd = now.getDate().toString().padStart(2, '0');
  const hh = now.getHours().toString().padStart(2, '0');
  const min = now.getMinutes().toString().padStart(2, '0');
  return `${yy}.${mm}.${dd}.${hh}${min}`;
})();

// Plugin to generate version.ts and public/version.json
function appVersionPlugin(): Plugin {
  return {
    name: 'app-version-inject',

    buildStart() {
      // 2. Generate version.ts for the app to consume
      const versionFilePath = path.resolve(__dirname, 'version.ts');
      const versionContent = `export const APP_VERSION = '${buildVersion}';\n`;
      fs.writeFileSync(versionFilePath, versionContent);
      console.log(`[Version] Generated version.ts: ${buildVersion}`);

      // 3. Generate public/version.json for runtime checks (robust update detection)
      const publicVersionPath = path.resolve(__dirname, 'public/version.json');
      // Ensure public dir exists
      if (!fs.existsSync(path.resolve(__dirname, 'public'))) {
        fs.mkdirSync(path.resolve(__dirname, 'public'));
      }
      fs.writeFileSync(publicVersionPath, JSON.stringify({ version: buildVersion, timestamp: new Date().toISOString() }, null, 2));
      console.log(`[Version] Generated public/version.json: ${buildVersion}`);
    }
  };
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', '');
  return {
    server: {
      port: 3000,
      host: '0.0.0.0',
    },
    plugins: [react(), appVersionPlugin()],
    define: {
      'process.env.API_KEY': JSON.stringify(env.GEMINI_API_KEY),
      'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY)
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      }
    }
  };
});
