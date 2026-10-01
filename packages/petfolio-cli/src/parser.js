import fs from 'fs';
import path from 'path';
import {parse} from '@babel/parser';
import _traverse from '@babel/traverse';



const traverse = _traverse.default || _traverse;


export function extractTextFromFile(filePath) {

    const content = fs.readFileSync(filePath, 'utf-8');

    const ext = path.extname(filePath);



    if(['.md','.mdx','.txt'].includes(ext)) {
        return cleanText(content);
    }


    if (['.js','.jsx','.ts','.tsx'].includes(ext)) {
    
        try {
            const ast = parse(content, {
                sourceType: 'module',
                plugins: ['jsx', 'typescript']
            });
            
            const extractedTokens = [];


            traverse(ast, {
                JSXText(nodePath) {
                    const val = nodePath.node.value.trim();
                    if (val) extractedTokens.push(val);
                    },
                    // Capture string literals in JSX attributes like alt="..." or title="..."
                JSXAttribute(nodePath) {
                    const attrName = nodePath.node.name?.name;
                    if (['title', 'alt', 'placeholder', 'aria-label'].includes(attrName)) {
                        const val = nodePath.node.value?.value;
                        if (val && typeof val === 'string') extractedTokens.push(val);
                    }
                },
                StringLiteral(nodePath) {
                    const parent = nodePath.parent;
                    
                    // Stop Babel from capturing className and inline style attributes
                    if (parent.type === 'JSXAttribute' && ['className', 'style'].includes(parent.name?.name)) {
                        return;
                    }

                    const val = nodePath.node.value.trim();
                    
                    // Define patterns that indicate CSS values rather than human-readable text
                    const isCSS = val.includes('rgba(') || val.includes('rgb(') || val.includes('gradient') || val.includes('var(--');
                    
                    // Filter out short identifiers, paths, imports, and CSS strings
                    if (
                        val.length > 25 && 
                        !val.startsWith('http') && 
                        !val.includes('/') && 
                        !val.includes('px') &&
                        !isCSS
                    ) {
                        extractedTokens.push(val);
                    }
                }
            });

            return cleanText(extractedTokens.join(' '));
        } catch {
            // fallback return empty string if parsing fails
            return '';
        }
    }
    return '';
}


function cleanText(text) {
    return text
        .replace(/\s+/g, ' ')       // Replace multiple spaces/newlines with a single space
        .replace(/\n\s*\n/g, '\n')  // Remove excess blank lines
        .trim();                    // Remove leading/trailing whitespace
}