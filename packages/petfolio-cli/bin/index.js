#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import inquirer from 'inquirer';
import { scanDirectory } from '../src/scanner.js';

const HELP = `
petfolio-cli — index your project's text for the Petfolio chat

Usage
  npx petfolio-cli                 interactive: asks for an AI provider + key (saved to .env),
                                   then writes public/petfolio-knowledgeBase.json
  npx petfolio-cli --scan-only     no prompts, no .env changes — just regenerate the knowledge
                                   base (use this in package.json "prebuild" / CI)

Options
  --out <dir>    where to write petfolio-knowledgeBase.json (default: public)
                 e.g. --out static (SvelteKit), --out src/assets (Angular)
  -h, --help     show this help
`;

function parseArgs(argv) {
    const args = { scanOnly: false, out: 'public', help: false };
    for (let i = 0; i < argv.length; i++) {
        const a = argv[i];
        if (a === '--scan-only' || a === '--ci') args.scanOnly = true;
        else if (a === '-h' || a === '--help') args.help = true;
        else if (a === '--out') args.out = argv[++i];
        else if (a.startsWith('--out=')) args.out = a.slice('--out='.length);
        else { console.error(`Unknown option: ${a}\n${HELP}`); process.exit(2); }
    }
    if (!args.out) { console.error(`--out needs a directory\n${HELP}`); process.exit(2); }
    return args;
}

/** True when the project's .gitignore already covers .env (so the key will not be committed). */
function envIsIgnored(rootDir) {
    try {
        const lines = fs.readFileSync(path.join(rootDir, '.gitignore'), 'utf-8').split('\n').map((l) => l.trim());
        return lines.some((l) => ['.env', '.env*', '*.env', '/.env', '.env.*'].includes(l));
    } catch {
        return false;
    }
}

async function askForKey(rootDir) {
    const answers = await inquirer.prompt([
        {
            type: 'select',
            name: 'provider',
            message: 'Select your AI inference provider:',
            choices: ['Groq (Recommended - Fast & Free tier)', 'Google Gemini (Free tier)'],
        },
        {
            type: 'password',
            name: 'apiKey',
            message: 'Enter your API key:',
            mask: '*',
            validate: (input) => (input.trim() ? true : 'API key cannot be empty.'),
        },
    ]);

    const envPath = path.join(rootDir, '.env');
    const envKey = answers.provider.includes('Groq') ? 'PETFOLIO_GROQ_API_KEY' : 'PETFOLIO_GEMINI_API_KEY';

    // Read existing content (if any) and replace just our key line.
    // Never blindly overwrite the whole file — user's other vars would be lost.
    const existing = fs.existsSync(envPath) ? fs.readFileSync(envPath, 'utf-8') : '';
    const lines = existing.split('\n').filter((line) => !line.trim().startsWith(envKey + '='));
    const kept = lines.join('\n').replace(/\s+$/, '');
    const updated = (kept ? kept + '\n' : '') + `${envKey}="${answers.apiKey.trim()}"\n`;
    fs.writeFileSync(envPath, updated, 'utf-8');

    console.log(`API key saved to ${envPath}`);
    if (!envIsIgnored(rootDir)) {
        console.warn('WARNING: .env is not listed in your .gitignore — add it so the key is never committed.');
    }
    return envKey;
}

async function main() {
    const args = parseArgs(process.argv.slice(2));
    if (args.help) { console.log(HELP); return; }

    console.log('initializing Petfolio CLI...!');
    const rootDir = process.cwd();
    const outDir = path.resolve(rootDir, args.out);

    const envKey = args.scanOnly ? 'PETFOLIO_GROQ_API_KEY' : await askForKey(rootDir);

    console.log('Scanning project directory for relevant files...');
    const knowledgeBase = scanDirectory(rootDir);

    fs.mkdirSync(outDir, { recursive: true });
    const outputPath = path.join(outDir, 'petfolio-knowledgeBase.json');
    fs.writeFileSync(outputPath, JSON.stringify(knowledgeBase, null, 2), 'utf-8');

    console.log(`Knowledge base generated and saved to ${outputPath}`);
    console.log(`Indexed ${knowledgeBase.length} file(s).`);
    if (knowledgeBase.length === 0) {
        console.warn('Nothing to index. The CLI reads .js/.jsx/.ts/.tsx/.md/.mdx/.txt files — add an about.md describing your site/portfolio.');
    }

    if (!args.scanOnly) {
        console.log(`
Next steps
  1. Serve the knowledge base from your site root as /petfolio-knowledgeBase.json
     (it is in ${path.relative(rootDir, outDir) || '.'}/ — pass ai.knowledge if you serve it elsewhere).
  2. Keep your API key private: add a small server route that reads ${envKey} from .env and
     forwards chat requests to the provider, then pass its URL to the widget:
         Petfolio.summon({ ai: { endpoint: '/api/petfolio' } })
     (example route in the Petfolio README, "AI chat").
  3. Quick local test only: skip the route and paste the key into the chat panel — never ship that.
  Tip: richer answers come from prose — put facts about you / your site in an about.md.
       Re-run \`npx petfolio-cli --scan-only\` whenever your content changes (e.g. in "prebuild").
`);
        console.log('Petfolio CLI setup complete!');
    }
}

main().catch((error) => {
    console.error('\n initialization failed:', error);
    process.exit(1);
});
