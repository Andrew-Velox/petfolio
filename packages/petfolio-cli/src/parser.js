import fs from 'fs';
import path from 'path';
import {parse} from '@babel/parser';
import _traverse from '@babel/traverse';

const traverse = _traverse.default || _traverse;

// =============================================================
// Heuristics to classify a string as "code" vs "human text".
// Everything that looks like code is dropped — we only keep
// strings an AI assistant would actually use to answer questions
// about the project (project descriptions, quotes, headings, etc).
// =============================================================

const TAILWIND_CLASS_RE =
    /\b(?:[a-z]+-)?(?:xs|sm|md|lg|xl|2xl|focus|hover|active|disabled|group|peer|first|last|odd|even|dark|light|open|checked|motion|print|rtl|ltr|placeholder|file|marker|selection|first-letter|first-line|backdrop|before|after)\b/;

// Drop strings that contain ANY of these tokens — they're CSS / icon / code.
const NOISE_TOKEN_RE =
    /(?:rgba?\(|var\(--|cubic-bezier|linear-gradient|radial-gradient|polygon\(|\bpx\b|\brem\b|\b\d+(?:\.\d+)?(?:px|rem|em|vh|vw|%|s|ms)\b|^\s*[MmLlHhVvCcSsQqTtAaZz][\d-MnvgMlHhVcCsSaAzZ\s.]*$|class(?:Name)?=|tailwind|stroke=|fill=|opacity-|translate-|rotate-|scale-|translate-x-|translate-y-|w-\d|h-\d|p-\d|m-\d|flex|grid-|items-|justify-|gap-|space-|bg-|text-|border-|hover:|focus:|active:|disabled:|sm:|md:|lg:|xl:|2xl:)/;

// Lines in code that start with these prefixes are almost never user-facing text.
const CODE_PREFIX_RE =
    /^(?:import |export |const |let |var |function |class |interface |type |from |return |if |else |for |while |switch |case |break |continue |new |this\.|async |await |throw |try |delete |typeof |instanceof |void |yield |default)/;

// Minimum length a "real" text string must be.
const MIN_TEXT_LEN = 30;
// Maximum length per content piece (anything longer is almost certainly code).
const MAX_TEXT_LEN = 300;

// Tags whose attributes we care about (semantic, screen-reader-relevant text).
const SEMANTIC_ATTRS = new Set(['title', 'alt', 'placeholder', 'aria-label', 'description']);

// Detect SVG path strings (everything starts with M/L/C etc. and is coordinate-like).
function looksLikeSvgPath(s) {
    // Strip whitespace, then check first 2 chars are SVG path commands.
    const trimmed = s.trim();
    if (trimmed.length < 8) return false;
    const first = trimmed[0];
    if (!'MLHVCSQTAZmlhvcsqta'.includes(first)) return false;
    // SVG path strings are made of digits, dots, spaces, commas, and command letters.
    return /^[MLHVCSQTAZmlhvcsqta0-9.\-\s,]+$/.test(trimmed);
}

// Strings that start with these prefixes are technical artifacts.
const TECHNICAL_PREFIXES = [
    'data:image/',      // base64 / data URLs
    'data:application/',
    'data:video/',
    'data:audio/',
    '/images/',         // local asset paths
    '/icons/',
    '/sprites/',
    'media_/',          // folder-prefixed asset paths
    'http://localhost',
    'blob:',
];

function hasTechnicalPrefix(s) {
    const t = s.trim();
    return TECHNICAL_PREFIXES.some((p) => t.startsWith(p));
}

// CSS property names listed as a comma-separated string (e.g. "opacity, transform, background-color, border-color")
const CSS_PROP_LIST_RE = /^\s*(?:[a-z-]+,\s*)+[a-z-]+\s*$/i;

// Detect Tailwind class strings (sequences of class names separated by spaces).
function looksLikeClassList(s) {
    const tokens = s.trim().split(/\s+/);
    if (tokens.length < 2) return false;
    // 80%+ of tokens must look like Tailwind utility classes.
    const classLike = tokens.filter((t) => /^[a-z][a-z0-9-]*[a-z0-9]$/.test(t));
    return classLike.length / tokens.length >= 0.8 && classLike.length >= 3;
}

// Detect hex colors, gradients, keyframe definitions.
function looksLikeCssValue(s) {
    return (
        /^#[0-9a-fA-F]{3,8}$/.test(s.trim()) ||
        /\b(?:rgba?|hsla?)\(/.test(s) ||
        /var\(--/.test(s) ||
        /cubic-bezier/.test(s) ||
        /@(?:keyframes|font-face|media)/.test(s)
    );
}

// Generic "is this likely human-readable prose?" test.
function isHumanText(s) {
    const t = s.trim();
    if (t.length < MIN_TEXT_LEN) return false;
    if (t.length > MAX_TEXT_LEN) return false;
    if (hasTechnicalPrefix(t)) return false;
    if (looksLikeClassList(t)) return false;
    if (looksLikeCssValue(t)) return false;
    if (looksLikeSvgPath(t)) return false;
    if (CSS_PROP_LIST_RE.test(t)) return false;
    if (NOISE_TOKEN_RE.test(t)) return false;
    // Words ratio — prose has letters and spaces, code has lots of punctuation/symbols.
    const letters = (t.match(/[A-Za-z]/g) || []).length;
    const total = t.replace(/\s/g, '').length;
    if (total === 0) return false;
    if (letters / total < 0.55) return false; // Less than 55% letters = likely code
    // No code-like prefixes (for cases captured as raw text via JSXText).
    if (CODE_PREFIX_RE.test(t)) return false;
    return true;
}

export function extractTextFromFile(filePath) {
    const content = fs.readFileSync(filePath, 'utf-8');
    const ext = path.extname(filePath);

    // Plain-text files go through directly (after stripping noise lines).
    if (['.md', '.mdx', '.txt'].includes(ext)) {
        return cleanText(filterProseLines(content));
    }

    if (['.js', '.jsx', '.ts', '.tsx'].includes(ext)) {
        try {
            const ast = parse(content, {
                sourceType: 'module',
                plugins: ['jsx', 'typescript'],
            });

            const pieces = [];

            traverse(ast, {
                // 1) Visible text inside JSX elements: <h1>Hello</h1> → "Hello"
                JSXText(p) {
                    const val = p.node.value.trim();
                    if (val && isHumanText(val)) pieces.push(val);
                },
                // 2) Semantic accessibility attributes
                JSXAttribute(p) {
                    const name = p.node.name?.name;
                    if (!SEMANTIC_ATTRS.has(name)) return;
                    const v = p.node.value;
                    let raw = null;
                    if (v && v.type === 'StringLiteral') raw = v.value;
                    else if (v && v.type === 'JSXExpressionContainer') {
                        const expr = v.expression;
                        if (expr && expr.type === 'StringLiteral') raw = expr.value;
                    }
                    if (raw && isHumanText(raw)) pieces.push(raw);
                },
                // 3) String literals in JS code (object values, message constants)
                StringLiteral(p) {
                    const parent = p.parent;
                    // Skip JSX attributes (already handled), imports, exports,
                    // variable declarators where the string is used as a *key*
                    // for something technical.
                    if (!parent) return;
                    if (parent.type === 'ImportDeclaration') return;
                    if (parent.type === 'ExportNamedDeclaration') return;
                    if (
                        parent.type === 'JSXAttribute' &&
                        (parent.name?.name === 'className' ||
                            parent.name?.name === 'style')
                    ) {
                        return;
                    }
                    // Skip arguments to console.* (any method), logger.* — those are
                    // developer-facing debug messages, not user-facing copy.
                    if (parent.type === 'CallExpression' && parent.callee) {
                        const calleeName =
                            parent.callee.type === 'MemberExpression'
                                ? parent.callee.property?.name || ''
                                : parent.callee.name || '';
                        const isConsoleCall =
                            parent.callee.type === 'MemberExpression'
                                ? parent.callee.object?.name === 'console'
                                : /^(console|logger|debug)$/.test(calleeName);
                        if (isConsoleCall) return;
                    }
                    // Skip CSS selector / media-query strings (matchMedia args).
                    if (
                        parent.type === 'CallExpression' &&
                        parent.callee?.type === 'MemberExpression' &&
                        parent.callee.property?.name === 'matchMedia'
                    ) {
                        return;
                    }
                    const val = p.node.value.trim();
                    if (isHumanText(val)) pieces.push(val);
                },
            });

            return cleanText(pieces.join(' '));
        } catch {
            return '';
        }
    }
    return '';
}

// For .md/.txt files: keep only lines that look like prose, drop code blocks.
function filterProseLines(content) {
    const lines = content.split('\n');
    const out = [];
    let inCodeBlock = false;
    for (const raw of lines) {
        const line = raw.trim();
        if (line.startsWith('```')) {
            inCodeBlock = !inCodeBlock;
            continue;
        }
        if (inCodeBlock) continue;
        // Drop pure heading markers but keep their text.
        const stripped = line.replace(/^#+\s*/, '').replace(/^[-*]\s+/, '');
        if (!stripped) continue;
        // Prose files are hand-written text: only drop lines that are clearly CSS
        // class lists. (NOISE_TOKEN_RE is for string literals in code and would
        // wrongly drop sentences containing "flex", "text-", "grid-", ...)
        if (looksLikeClassList(stripped)) continue;
        out.push(stripped);
    }
    return out.join('\n');
}

function cleanText(text) {
    return text
        .replace(/\s+/g, ' ')
        .replace(/\n\s*\n/g, '\n')
        .trim();
}