import {globSync} from 'glob';
import path from 'node:path';
import {extractTextFromFile} from './parser.js';




export function scanDirectory(targetDir) {

    const pattern  = '**/*.{js,jsx,ts,tsx,md,mdx,txt}';


    const files = globSync(pattern, {
        cwd: targetDir, 
        nodir: true,
        ignore: [
            '**/node_modules/**',
            '**/.next/**',
            '**/dist/**',
            '**/build/**',
            '**/.git/**',
            '**/public/**',
            '**/coverage/**',
            '**/bin/**'
        ]
    });


    const knowledgeBase = [];



    for (const relativePath of files) {

        const fullPath = path.join(targetDir, relativePath);

        const content = extractTextFromFile(fullPath);


        if (content  && content.length > 20 ){
            knowledgeBase.push({
                source: relativePath,
                content: content
            });
        }
    }


    return knowledgeBase;

}


