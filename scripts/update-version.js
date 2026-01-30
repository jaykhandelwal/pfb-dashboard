import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Generate version based on date: YY.MM.DD.HHmm
const now = new Date();
const year = now.getFullYear().toString().slice(-2);
const month = (now.getMonth() + 1).toString().padStart(2, '0');
const day = now.getDate().toString().padStart(2, '0');
const hours = now.getHours().toString().padStart(2, '0');
const minutes = now.getMinutes().toString().padStart(2, '0');

const newVersion = `${year}.${month}.${day}.${hours}${minutes}`;

console.log(`Updating app version to: ${newVersion}`);

// Paths
const versionTsPath = path.join(__dirname, '../version.ts');
const publicVersionJsonPath = path.join(__dirname, '../public/version.json');

// Update version.ts
const versionTsContent = `export const APP_VERSION = '${newVersion}';\n`;
fs.writeFileSync(versionTsPath, versionTsContent);
console.log(`Updated ${versionTsPath}`);

// Update public/version.json
const versionJsonContent = JSON.stringify({ version: newVersion }, null, 2);
fs.writeFileSync(publicVersionJsonPath, versionJsonContent);
console.log(`Updated ${publicVersionJsonPath}`);
