# About Petfolio

Petfolio is a tiny animated friend for websites. It is a small pet that lives on top of a web page, walks around, jumps, climbs the walls and the ceiling, and says cute things.
It is free and open source under the MIT license. The source code is on GitHub at Andrew-Velox/petfolio and the packages are on npm.

## What it does

The pet moves like a classic Shimeji desktop mascot. It walks, runs, sits, jumps onto walls, climbs along the walls, crawls on the ceiling and falls back down with gravity.
Visitors can drag the pet with the mouse and throw it, and it reacts to how fast it was thrown.
The pet says short, cute messages by itself every few seconds while it wanders, and it can greet visitors with a speech bubble.

## Chat

Visitors right-click the pet and choose the chat button. The pet then stands still and shows a chat box where it normally shows its speech bubble.
The pet answers questions about the website using only the website's own content, so it does not make things up. When it does not know, it says so.
The answers come from a free AI model. Groq and Google Gemini are supported, and both have free tiers.

## How to install

Install the package with the command npm install petfolio and then call Petfolio.summon() once in the browser. That one line adds the pet to the page.
There is also a script tag for sites without a bundler, loaded from the unpkg CDN.
The package works with plain JavaScript, React, Next.js, Vue and any other framework, and it includes TypeScript types.

## How the pet learns about your site

Run npx petfolio-cli in your project. It reads your source files and Markdown files and writes a knowledge base file called petfolio-knowledgeBase.json into the public folder.
The pet searches that file in the browser to find the most relevant parts for each question, and sends only those parts to the AI model.
To teach the pet more, write facts about yourself or your project in a Markdown file such as about.md and run the command again.

## Keeping the API key safe

The AI key must never be in browser code. Petfolio sends chat requests to a small server route on your own site, and that route adds the secret key from an environment variable.
The command npx petfolio-cli saves the key to a local .env file, which must stay out of git.

## Right-click menu

Right-clicking the pet opens a small menu with four buttons: switch avatar, chat, settings and exit.
Exit sends the pet off screen where it peeks in from the corner, and clicking it brings it back.

## Avatars

Petfolio comes with more than one avatar, and visitors can switch between them from the menu. The avatars are pixel art characters.

## License and cost

Petfolio is MIT licensed, so it is free to use in personal and commercial projects. The AI chat only needs a free API key from Groq or Google Gemini.
