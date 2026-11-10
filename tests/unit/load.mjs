// loads a classic-script module of src/ (a global const) into Node
import fs from 'node:fs';
export function load(file, name) { return new Function(fs.readFileSync(new URL('../../src/' + file, import.meta.url), 'utf8') + `;return ${name}`)(); }
