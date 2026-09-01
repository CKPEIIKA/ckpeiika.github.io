# Chalkish

This is the dependency-free browser library used by the two numerical demos on
this site. It is checked into the site deliberately: browsers import its ES
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

Update this subset from a Chalkish checkout without copying its gallery or
generated examples:

```sh
node scripts/sync-chalkish.mjs /path/to/chalkish-cfd-starter
```

The browser entry point remains `src/index.js`. There are no runtime
dependencies and no build step.
