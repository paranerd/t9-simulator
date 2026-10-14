import sharp from 'sharp';
import { mkdir, writeFile } from 'node:fs/promises';

const icon = `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512"><rect width="512" height="512" rx="104" fill="#28384a"/><rect x="137" y="77" width="238" height="358" rx="55" fill="#526375" stroke="#142332" stroke-width="9"/><rect x="172" y="132" width="168" height="133" rx="10" fill="#b5c496" stroke="#233528" stroke-width="6"/><path d="M195 157h57m-57 22h121m-121 22h94m-94 22h60" stroke="#3a5031" stroke-width="10"/><rect x="222" y="104" width="68" height="7" rx="3" fill="#142332"/><g fill="#dde2d7">${[291,327,363].map(y=>[175,237,299].map(x=>`<rect x="${x}" y="${y}" width="39" height="24" rx="7"/>`).join('')).join('')}</g><rect x="237" y="399" width="39" height="12" rx="5" fill="#dde2d7"/></svg>`;
await mkdir('public/icons', { recursive: true });
await writeFile('public/icons/favicon.svg', icon);
for (const size of [192, 512, 180]) await sharp(Buffer.from(icon)).resize(size, size).png().toFile(`public/icons/${size === 180 ? 'apple-touch-icon' : `icon-${size}`}.png`);
const mask = icon.replace('rx="104"', 'rx="0"');
await sharp(Buffer.from(mask)).png().toFile('public/icons/maskable-512.png');
console.log('PWA icons created.');
