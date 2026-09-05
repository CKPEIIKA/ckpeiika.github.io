# Chalkish

This is the dependency-free browser library used by the DSMC, DG/FV, and
Lecture 2 PDE demos on this site. It is checked into the site deliberately: browsers import its ES
modules directly, so updating it requires no bundler or generated assets.

The deployed subset contains:

- the complete public API in `src/`;
- the DG/FV and DSMC model-view adapters in `examples/boards/`;
- the unchanged numerical kernels from the former standalone demos;
- deterministic and invariant tests;
- the upstream roadmap and open work in `docs/ROADMAP.md` and `TODO.md`.

Run the checks from the site root:

```sh
npm test
```

The site copy is maintained here, including `src/plot.js` and `src/pde.js`.
An upstream sync can overwrite these changes: reconcile them in the source
checkout before using the optional import tool. It excludes generated examples:

```sh
node scripts/sync-chalkish.mjs /path/to/chalkish-cfd-starter
```

The browser entry point remains `src/index.js`. There are no runtime
dependencies and no build step.

For responsive scientific plots, reusable PDE kernels, coordinate contracts,
and verification cases, see [PDE primitives](docs/PDE_PRIMITIVES.md).
The [lecture roadmap](docs/PDE_LECTURE_ROADMAP.md) separates implemented pages
from remaining teaching and model limitations.
