import {globSync} from 'glob';
import path from 'node:path';
import {extractTextFromFile} from './parser.js';

// Paths we skip because they contain generated/dependency/test code.
const DEFAULT_IGNORES = [
    '**/node_modules/**',
    '**/.next/**',
    '**/.nuxt/**',
    '**/.svelte-kit/**',
    '**/.vue/**',
    '**/dist/**',
    '**/build/**',
    '**/out/**',
    '**/.git/**',
    '**/coverage/**',
    '**/.turbo/**',
    '**/.cache/**',
    '**/.vercel/**',
    '**/.netlify/**',
    '**/bin/**',
    // Generated artifacts from this same CLI
    '**/public/petfolio-knowledgeBase.json',
    // Tests produce noise that's not representative of the product
    '**/__tests__/**',
    '**/*.test.{js,jsx,ts,tsx}',
    '**/*.spec.{js,jsx,ts,tsx}',
    // Config files rarely contain user-facing prose
    '**/*.config.{js,ts,mjs}',
    // Hooks (mostly logic, not prose) — keep if you want them, drop if not
    '**/hooks/**',
    // README is usually scaffold boilerplate with no real product info
    'README.md',
];

export function scanDirectory(targetDir, options = {}) {
    const ignores = [...DEFAULT_IGNORES, ...(options.ignore ?? [])];

    const files = globSync('**/*.{js,jsx,ts,tsx,md,mdx,txt}', {
        cwd: targetDir,
        nodir: true,
        ignore: ignores,
    });

    const knowledgeBase = [];

    for (const relativePath of files) {
        const fullPath = path.join(targetDir, relativePath);
        const content = extractTextFromFile(fullPath);

        // Drop empty / tiny entries to avoid cluttering the KB with fragments.
        if (content && content.length > 40) {
            knowledgeBase.push({
                source: relativePath,
                content,
            });
        }
    }

    return knowledgeBase;
}