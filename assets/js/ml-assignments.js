// ML 2026 assignments: typeset the plain-text formulas and open a task when its link is used.
// Runs before MathJax typesets the page (deferred script, MathJax waits for the document).

const formulas = document.querySelectorAll('.formula');
for (const formula of formulas) {
  formula.dataset.plainFormula = formula.textContent;
  formula.classList.add('mathjax-source');
  formula.textContent = `\\(${formula.textContent}\\)`;
}

// If MathJax cannot start, show the readable plain formulas again.
window.addEventListener('load', () => {
  const restore = (error) => {
    for (const formula of formulas) {
      formula.classList.remove('mathjax-source');
      formula.textContent = formula.dataset.plainFormula;
    }
    console.error('MathJax could not typeset assignment formulas.', error);
  };
  if (!window.MathJax?.startup?.promise) restore(new Error('MathJax did not load'));
  else window.MathJax.startup.promise.catch(restore);
});

document.addEventListener('click', (event) => {
  const link = event.target.closest('a.task, a.task0');
  if (!link?.hash) return;
  const details = document.getElementById(link.hash.slice(1));
  if (details instanceof HTMLDetailsElement) details.open = true;
});
