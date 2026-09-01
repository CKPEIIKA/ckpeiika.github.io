# AGENTS.md — Bulletproof GitHub Pages JavaScript

Build tiny, fast, durable browser applications that run directly on GitHub Pages.

The production environment is:

```text
static HTML + CSS + JavaScript
browser
HTTPS
GitHub Pages
```

Nothing else.

Priority:

```text
correctness
> simplicity
> browser robustness
> performance
> small code
> cleverness
```

## 1. Hard constraints

- Must run directly on GitHub Pages.
- Vanilla JavaScript.
- Native ES modules.
- Zero runtime dependencies.
- Prefer zero dependencies entirely.
- No framework.
- No bundler.
- No transpiler.
- No npm runtime.
- No server.
- No server-side rendering.
- No database server.
- No backend assumptions.
- No secret keys in browser code.
- No build step unless the existing project already requires one.
- Do not add a dependency without explicit approval.

Preferred production tree:

```text
index.html
style.css
src/
  app.js
  ...
assets/
tests/
.nojekyll
```

Everything deployed must be understandable as ordinary static files.

## 2. GitHub Pages is not `/`

A project may be served from:

```text
https://user.github.io/project/
```

not:

```text
https://user.github.io/
```

Therefore NEVER assume the site lives at domain root.

Bad:

```js
fetch('/data/items.json')
```

Bad:

```html
<script src="/src/app.js"></script>
```

Bad:

```css
background: url("/assets/bg.webp");
```

Good:

```js
fetch('./data/items.json')
```

Good:

```html
<script type="module" src="./src/app.js"></script>
```

Good:

```css
background: url("../assets/bg.webp");
```

For resources relative to a JS module prefer:

```js
const url = new URL('../data/items.json', import.meta.url)
```

Test paths as if deployed under:

```text
/foo/bar/
```

Root-relative URLs are forbidden unless there is a specific documented reason.

## 3. Static means static

GitHub Pages cannot execute application server code.

Do not design code requiring:

```text
Express
Node.js server
PHP
Python backend
server middleware
server sessions
server redirects
secret environment variables
private API tokens
filesystem writes
SQL server
WebSocket server
```

Browser storage is allowed where appropriate:

```text
localStorage
sessionStorage
IndexedDB
Cache API
```

Remote APIs are allowed only when they:

- intentionally support browser clients;
- permit the site's origin through CORS;
- require no private secret embedded in the page.

Any credential shipped to the browser is public.

Never pretend otherwise.

## 4. Default HTML

Prefer a boring entry point:

```html
<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>App</title>
  <link rel="stylesheet" href="./style.css">
</head>
<body>
  <main id="app"></main>
  <script type="module" src="./src/app.js"></script>
</body>
</html>
```

No script loader.
No module loader.
No CDN dependency.

The browser already has a module system.

Use it.

## 5. JavaScript style

Prefer small functions operating on explicit data.

Good:

```js
export function total(items) {
  let sum = 0

  for (const item of items) {
    sum += item.price
  }

  return sum
}
```

Avoid architectural cosplay.

Do not introduce:

- controllers;
- services;
- repositories;
- providers;
- dependency injection;
- event buses;
- factories;
- registries;
- plugin systems;
- class hierarchies;

unless the problem genuinely requires them.

Prefer:

```text
data
→ pure transformation
→ small DOM update
```

Keep browser-specific code at the edge.

## 6. Separate logic from DOM

The easiest zero-dependency frontend to test is one where most code does not know the DOM exists.

Prefer:

```js
export function calculateScore(data) {
  return data.correct * 2 - data.wrong
}

export function renderScore(element, score) {
  element.textContent = String(score)
}
```

not:

```js
export function calculateScore() {
  const correct = +document.querySelector('#correct').value
  const wrong = +document.querySelector('#wrong').value

  document.querySelector('#score').textContent =
    correct * 2 - wrong
}
```

Keep these separate:

```text
logic
state
storage
network
DOM
```

but do not create layers merely to satisfy this list.

Usually a few modules are enough.

## 7. State

Start with plain JavaScript objects.

```js
const state = {
  page: 'home',
  items: [],
  selected: null
}
```

Prefer one obvious owner of mutable state.

Avoid:

- hidden module mutation everywhere;
- duplicated state;
- DOM-as-database;
- synchronization between several representations of the same fact.

Derive values rather than storing duplicates.

Bad:

```js
state.items = items
state.itemCount = items.length
```

Prefer:

```js
state.items = items
```

and:

```js
state.items.length
```

## 8. DOM

Use native DOM APIs.

Prefer:

```js
document.querySelector()
document.querySelectorAll()
document.createElement()
element.replaceChildren()
element.classList
element.dataset
element.addEventListener()
```

Do not build a home-made frontend framework.

Prefer event delegation when many similar dynamic elements exist:

```js
list.addEventListener('click', event => {
  const button = event.target.closest('[data-action]')
  if (!button) return

  handleAction(button.dataset.action)
})
```

Use `textContent` for plain text.

Do not put untrusted strings into `innerHTML`.

If HTML construction becomes complicated, first reconsider whether it needs to be complicated.

## 9. HTML and CSS before JavaScript

If HTML can do it, use HTML.

If CSS can do it, use CSS.

Examples:

```text
<details>
<dialog>
<form>
required
pattern
min
max
CSS grid
CSS flex
:checked
:target
@media
```

Do not write JavaScript to imitate browser features badly.

JavaScript should provide behavior that HTML and CSS cannot reasonably provide themselves.

## 10. Routing

GitHub Pages does not provide application-server fallback routing.

Therefore avoid pathname-based SPA routing by default.

This:

```text
/project/users/42
```

may work after client navigation and then produce a 404 when reloaded directly.

For a small static application prefer:

```text
/project/#users/42
```

Hash routing works without server rewrites.

Even better: do not add routing unless the application actually needs it.

Do not introduce an SPA-router dependency.

## 11. Fetch

Always handle HTTP failure explicitly.

Bad:

```js
const data = await fetch(url).then(r => r.json())
```

Better:

```js
const response = await fetch(url)

if (!response.ok) {
  throw new Error(`HTTP ${response.status}`)
}

const data = await response.json()
```

For local resources use relative URLs.

Prefer cancellation for operations that can become stale:

```js
const controller = new AbortController()

fetch(url, {
  signal: controller.signal
})
```

Network failure is normal.

Design UI for:

```text
loading
success
empty
failure
```

Do not leave the interface permanently saying "Loading…" after an exception.

## 12. Persistence

For tiny data:

```js
localStorage
```

For larger structured data:

```js
IndexedDB
```

Validate loaded data.

Storage contents may be:

- old;
- malformed;
- manually edited;
- from an earlier application version.

Never assume:

```js
JSON.parse(localStorage.x)
```

contains what current code expects.

Prefer a versioned representation where persistence matters:

```js
{
  version: 1,
  data: {...}
}
```

## 13. Tests

Tests are mandatory for non-trivial logic.

Use Node only as a DEVELOPMENT test runner when useful.

Production code must not depend on Node.

Preferred:

```js
// src/math.js
export function clamp(x, min, max) {
  return Math.max(min, Math.min(max, x))
}
```

```js
// tests/math.test.js
import test from 'node:test'
import assert from 'node:assert/strict'

import { clamp } from '../src/math.js'

test('clamp limits both sides', () => {
  assert.equal(clamp(-1, 0, 10), 0)
  assert.equal(clamp(20, 0, 10), 10)
})
```

Run:

```sh
node --test
```

Node is allowed for:

```text
tests
local scripts
CI
verification
```

Node APIs are forbidden from browser production modules.

Never import things such as:

```js
node:fs
node:path
node:http
node:crypto
```

from code shipped to GitHub Pages.

## 14. Browser tests without dependencies

Keep DOM behavior thin enough that most behavior can be tested as pure modules.

For important browser integration, a tiny static test page is acceptable:

```text
tests/browser.html
```

It should import production modules directly.

Example:

```html
<script type="module">
import { calculateScore } from '../src/score.js'

const failures = []

function equal(actual, expected, name) {
  if (actual !== expected) {
    failures.push(`${name}: ${actual} !== ${expected}`)
  }
}

equal(calculateScore({
  correct: 3,
  wrong: 1
}), 5, 'score')

if (failures.length) {
  document.body.textContent = failures.join('\n')
  throw new Error(failures.join('\n'))
}

document.body.textContent = 'PASS'
</script>
```

Do not invent a 500-line test framework.

If testing the UI requires enormous mocking machinery, move more logic out of the UI.

## 15. Regression doctrine

For bugs:

```text
reproduce
→ regression test
→ smallest fix
→ focused test
→ full tests
```

Every fixed bug should become harder to reintroduce.

When practical, preserve the actual failing input as a test fixture.

## 16. Test ugly inputs

For meaningful logic consider:

```text
null
undefined
""
[]
{}
0
-1
NaN
Infinity
very large values
very long strings
Unicode
duplicate values
malformed JSON
missing object keys
unexpected extra keys
```

Do not merely test the demonstration example.

Test boundaries.

## 17. Cheap property testing

No package is required for basic randomized testing.

For serializers:

```js
decode(encode(x))
```

should reproduce `x` where promised.

For normalization:

```js
normalize(normalize(x))
```

should often equal:

```js
normalize(x)
```

For sorting:

```text
same number of elements
same values
ordered output
```

For numeric results check invariants:

```js
Number.isFinite(result)
```

Use deterministic generated inputs when practical.

If random testing discovers a failure, convert it into a fixed regression case.

## 18. Performance

A GitHub Pages app should feel immediate.

Prefer:

- small initial HTML;
- small JS;
- small images;
- no dependency payload;
- no unnecessary network requests;
- no enormous JSON blobs;
- no forced layout loops.

Avoid repeated DOM modification in loops.

Bad:

```js
for (const item of items) {
  list.append(render(item))
}
```

when thousands of updates cause measurable trouble.

Prefer building a fragment or complete subtree and inserting it together.

For large CPU jobs:

```text
Web Worker
```

is available without dependencies.

For long lists consider:

```text
pagination
virtualization
incremental rendering
```

before importing a framework.

Measure before optimizing.

## 19. Large data

Do not casually download 100 MB into a user's browser.

Remember:

```text
repository size
network transfer
parse time
memory
DOM size
```

are different costs.

Keep datasets compact.

For static structured data prefer formats that are easy to parse without dependencies:

```text
JSON
CSV when parsing requirements are simple
plain text
binary only when justified
```

Do not write an incomplete CSV parser and pretend CSV is trivial if arbitrary RFC-compatible CSV is required.

Know the actual input contract.

## 20. Security

Everything in a GitHub Pages deployment is public.

Never put these in source:

```text
private API key
password
private token
database credential
client secret
private certificate
```

Do not use:

```js
eval()
new Function()
```

Do not insert untrusted text with:

```js
innerHTML
outerHTML
insertAdjacentHTML
```

unless proper sanitization exists and is genuinely necessary.

Prefer:

```js
textContent
```

Validate URLs before using user-provided values as navigation targets.

Be careful with:

```text
javascript:
data:
blob:
```

URLs.

Never trust localStorage merely because it came from the same browser.

## 21. Dependencies

Default answer:

```text
no
```

Before adding one ask:

1. Can the browser already do it?
2. Is it less than roughly 20–50 clear lines locally?
3. Can the feature be simplified?
4. What code will the dependency indirectly bring?
5. Does this now require npm/build tooling?
6. Does it make GitHub Pages deployment more fragile?
7. Will this still work in five years after cloning the repository?

Prefer native APIs such as:

```text
fetch
URL
URLSearchParams
FormData
Intl
structuredClone
crypto.subtle
TextEncoder
TextDecoder
DOMParser
Web Worker
Canvas
File
Blob
CompressionStream
localStorage
IndexedDB
```

Do not install packages that merely wrap these.

But zero dependencies is not religion.

Do not hand-roll:

```text
cryptography
complex sanitization
serious compression formats
complex parsers
authentication protocols
```

just to keep a badge saying "0 dependencies".

If external code is genuinely safer, stop and justify it before adding it.

## 22. External CDNs

A CDN dependency is still a dependency.

Avoid:

```html
<script src="https://cdn.example.com/library.js"></script>
```

Problems include:

```text
third-party outage
version drift
privacy
supply chain
CSP complications
offline failure
unexpected breaking changes
```

If a tiny piece of third-party code is genuinely required, prefer an explicitly vendored, pinned, licensed copy after approval.

Do not silently introduce CDN dependencies.

## 23. Offline friendliness

The basic application should not require unnecessary remote assets.

Prefer local:

```text
CSS
JS
icons
fonts
data
```

System fonts are often better than shipping megabytes of typography.

Do not add a service worker automatically.

Service workers create persistent state and unusually annoying cache bugs.

Add one only if offline behavior is a real requirement, and test upgrades carefully.

## 24. Accessibility

Use semantic HTML before ARIA.

Prefer:

```html
<button>
<a>
<input>
<label>
<nav>
<main>
```

over clickable `<div>` elements.

Everything interactive must work with a keyboard.

Inputs need labels.

Images need sensible `alt` text.

Do not destroy focus outlines without replacing them.

Do not communicate essential state by color alone.

Accessibility fixes are usually small when the HTML is sane.

## 25. Mobile

Assume the page will be opened on a phone.

Never require hover for essential functionality.

Avoid fixed pixel layouts.

Use:

```html
<meta name="viewport" content="width=device-width, initial-scale=1">
```

Test narrow screens.

Prevent controls from becoming microscopic.

Avoid horizontal scrolling unless the content genuinely requires it.

## 26. Progressive enhancement

The initial HTML should contain useful structure whenever practical.

JavaScript should enhance it.

Avoid rendering an entirely blank document merely because the application has JavaScript.

Exceptions are acceptable for genuinely application-like tools.

But do not build a React-shaped architecture without React simply because that architecture is fashionable.

## 27. Error handling

Never silently swallow failures.

Bad:

```js
try {
  ...
} catch {}
```

Good:

```js
try {
  ...
} catch (error) {
  showError('Could not load data')
  console.error(error)
}
```

The user-facing message should explain what failed.

The console error should preserve technical detail.

Avoid showing raw stack traces to ordinary users.

## 28. Hacks

Good hacks are:

```text
small
local
obvious
documented
tested
easy to delete
```

Good:

```js
// Safari may report an empty MIME type for this local file.
// Extension check is therefore intentional.
```

Bad:

```text
mysterious timeout
global monkey patch
unexplained magic number
copy-pasted minified blob
browser sniffing where feature detection works
undocumented mutation
```

Prefer feature detection:

```js
if ('CompressionStream' in globalThis) {
  ...
}
```

not user-agent archaeology.

## 29. Scope discipline

When fixing something:

Do not also:

- redesign the UI;
- reformat the whole repository;
- rename unrelated functions;
- move every file;
- add a framework;
- add TypeScript;
- add npm;
- introduce a build system;
- rewrite working modules;
- implement speculative features.

Make surgical diffs.

Five changed lines that completely fix a bug are excellent engineering.

Do not feel embarrassed by them.

## 30. GitHub Pages deployment

Prefer direct static publication when possible.

Keep:

```text
.nojekyll
```

in the published root when Jekyll processing is unnecessary.

The deployed directory should already contain usable:

```text
HTML
CSS
JS
assets
```

A GitHub Actions build is acceptable only when there is an actual reason to build something.

Do not create a CI Rube Goldberg machine merely to copy static files.

Always verify deployment assumptions:

```text
site works under repository subpath
relative assets resolve
ES modules load
local fetches resolve
refreshing supported URLs works
404 behavior is sensible
```

## 31. Before completing a change

Run relevant tests:

```sh
node --test
```

Then inspect the diff.

Also verify that production source contains no accidental Node imports:

```text
node:
require(
process.
__dirname
Buffer
```

unless explicitly browser-polyfilled for a justified reason.

Check for accidental root paths:

```text
src="/
href="/
fetch('/
url('/
```

Check that no package dependency was introduced.

If practical, serve the project locally over HTTP and manually exercise the changed behavior.

Never rely exclusively on opening:

```text
file://...
```

Browser security behavior differs from HTTPS hosting.

## 32. Definition of done

A change is finished when:

- it works as static files;
- it works under a GitHub Pages repository subpath;
- no backend is required;
- no private credential is exposed;
- relevant tests exist;
- tests pass;
- failure states behave sensibly;
- mobile is not obviously broken;
- keyboard interaction is not obviously broken;
- no unnecessary dependency was added;
- no unrelated code changed;
- deployment paths are correct.

Do not say "works" because the code looks plausible.

Prove as much as cheaply possible.

## 33. Final rule

Build software that could plausibly still run after being abandoned for five years.

The ideal GitHub Pages application has:

```text
index.html
some CSS
a handful of JS modules
tests
zero dependencies
zero build step
zero server
```

Clone it.

Serve it.

Understand it.

Fix it.

That is the architecture.
