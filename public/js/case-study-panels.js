// Reference navigation is local DOM work: it never emits a quiz-flow event.
(function attachCaseStudyPanels(root) {
  let nextId = 0;
  const selections = new WeakMap();

  function render(container, caseStudy) {
    container.replaceChildren();
    container.hidden = !caseStudy;
    if (!caseStudy || !caseStudy.panels?.length) return;

    const signature = JSON.stringify(caseStudy);
    const storageKey = `markdown-mash:reference-panel:${location.pathname}:${container.id}:${caseStudy.id}`;
    let selected = 0;
    try {
      const saved = JSON.parse(sessionStorage.getItem(storageKey));
      if (saved?.signature === signature) selected = saved.index;
    } catch (error) { /* Browsing still works when storage is unavailable. */ }
    const remembered = selections.get(container) || new Map();
    const prior = remembered.get(caseStudy.id);
    if (prior?.signature === signature) selected = prior.index;
    if (!Number.isInteger(selected) || selected < 0 || selected >= caseStudy.panels.length) selected = 0;

    const heading = document.createElement('h3');
    heading.className = 'case-study-title';
    heading.textContent = caseStudy.title;
    const hint = document.createElement('p');
    hint.className = 'case-study-hint';
    hint.textContent = 'Reference panels · Browse while the current question stays open.';
    const tabs = document.createElement('div');
    tabs.className = 'case-study-tabs';
    tabs.setAttribute('role', 'tablist');
    tabs.setAttribute('aria-label', 'Reference panels');
    const panel = document.createElement('div');
    panel.className = 'case-study-content';
    panel.setAttribute('role', 'tabpanel');
    panel.tabIndex = 0;
    const id = `case-study-${++nextId}`;
    panel.id = `${id}-panel`;
    const footer = document.createElement('div');
    footer.className = 'case-study-footer';
    const previous = document.createElement('button');
    previous.type = 'button';
    previous.className = 'btn btn-secondary btn-small';
    previous.textContent = 'Previous panel';
    const count = document.createElement('span');
    count.setAttribute('role', 'status');
    const next = document.createElement('button');
    next.type = 'button';
    next.className = 'btn btn-secondary btn-small';
    next.textContent = 'Next panel';
    const buttons = caseStudy.panels.map((reference, index) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.id = `${id}-tab-${index}`;
      button.textContent = reference.title;
      button.setAttribute('role', 'tab');
      button.setAttribute('aria-controls', panel.id);
      button.addEventListener('click', () => select(index));
      button.addEventListener('keydown', event => {
        let target;
        if (event.key === 'ArrowRight') target = (index + 1) % buttons.length;
        if (event.key === 'ArrowLeft') target = (index + buttons.length - 1) % buttons.length;
        if (event.key === 'Home') target = 0;
        if (event.key === 'End') target = buttons.length - 1;
        if (target === undefined) return;
        event.preventDefault();
        select(target);
        buttons[target].focus();
      });
      tabs.append(button);
      return button;
    });

    function select(index) {
      selected = index;
      buttons.forEach((button, i) => {
        button.setAttribute('aria-selected', String(i === selected));
        button.tabIndex = i === selected ? 0 : -1;
      });
      panel.setAttribute('aria-labelledby', buttons[selected].id);
      panel.innerHTML = root.MarkdownMashMarkdown.block(caseStudy.panels[selected].text);
      panel.scrollTop = 0;
      previous.disabled = selected === 0;
      next.disabled = selected === buttons.length - 1;
      count.textContent = `Panel ${selected + 1} of ${buttons.length}`;
      const selection = { signature, index: selected };
      remembered.set(caseStudy.id, selection);
      selections.set(container, remembered);
      try { sessionStorage.setItem(storageKey, JSON.stringify(selection)); } catch (error) { /* Optional. */ }
    }

    previous.addEventListener('click', () => {
      if (selected > 0) select(selected - 1);
    });
    next.addEventListener('click', () => {
      if (selected < buttons.length - 1) select(selected + 1);
    });
    footer.append(previous, count, next);
    container.append(heading, hint, tabs, panel, footer);
    select(selected);
  }

  root.MarkdownMashReferences = { render };
}(globalThis));
