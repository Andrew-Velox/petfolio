#!/usr/bin/env node


import fs from 'fs';
import path from 'path';
import inquirer from 'inquirer';
import {scanDirectory} from '../src/scanner.js';



async function main() {



    console.log('initializing Petfolio CLI...!');



    const rootDir = process.cwd();
    const publicDir = path.join(rootDir, 'public');



    const answers = await inquirer.prompt([
        {
           type: 'select',
            name: 'provider',
            message: 'Select your AI inference provider:',
            choices: ['Groq (Recommended - Fast & Free tier)', 'Google Gemini (Free tier)']
        },
        {
            type: 'password',
            name: 'apiKey',
            message: 'Enter your API key:',
            mask: '*',
            validate: (input) => (input.trim() ? true : 'API key cannot be empty.')
        }
    ]);


    const envPath = path.join(rootDir, '.env');
    const envKey = answers.provider.includes('Groq') ? 'PETFOLIO_GROQ_API_KEY' : 'PETFOLIO_GEMINI_API_KEY';
    const envLine = `\n${envKey}="${answers.apiKey.trim()}"\n`;

    // Read existing content (if any) and replace just our key line.
    // Never blindly overwrite the whole file — user's other vars would be lost.
    let existing = '';
    if (fs.existsSync(envPath)) {
        existing = fs.readFileSync(envPath, 'utf-8');
    }

    // Drop any previous line for this key, then append the new one.
    const lines = existing.split('\n').filter(
        (line) => !line.trim().startsWith(envKey + '=')
    );
    const updated = lines.join('\n').replace(/\s+$/, '') + envLine;

    fs.writeFileSync(envPath, updated, 'utf-8');

    console.log(`API key saved to ${envPath} (keep .env out of git).`);


    console.log('Scanning project directory for relevant files...');


    const knowledgeBase = scanDirectory(rootDir);

    if (!fs.existsSync(publicDir)) {
        fs.mkdirSync(publicDir, { recursive: true });
    }



    const outputPath = path.join(publicDir, 'petfolio-knowledgeBase.json');
    fs.writeFileSync(outputPath, JSON.stringify(knowledgeBase, null, 2), 'utf-8');

    console.log(`Knowledge base generated and saved to ${outputPath}`);
    console.log(`Indexed ${knowledgeBase.length} file(s).`);
    console.log(`
Next steps
  1. Serve the knowledge base: it is in public/, so it is available at /petfolio-knowledgeBase.json.
  2. Keep your API key private: add a small server route that reads ${envKey} from .env and
     forwards chat requests to the provider, then pass its URL to the widget:
         Petfolio.summon({ ai: { endpoint: '/api/petfolio' } })
     (example route in the Petfolio README, "AI chat").
  3. Quick local test only: skip the route and paste the key into the chat panel — never ship that.
`);
    console.log('Petfolio CLI setup complete!');

}


main().catch((error) => {
    console.error('\n initialization failed:', error);
    process.exit(1);
});