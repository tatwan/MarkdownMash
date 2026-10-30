(function attachMermaidDiagrams(root) {
  const policy = root.MarkdownMashMermaidPolicy;
  const prepared = new WeakSet();
  const images = new Map();
  let frame = null;
  let frameReady = null;
  let queue = Promise.resolve();

  function rendererFrame() {
    if (frameReady) return frameReady;
    frameReady = new Promise((resolve, reject) => {
      frame = document.createElement('iframe');
      frame.className = 'mermaid-render-frame';
      frame.title = 'Diagram rendering';
      frame.tabIndex = -1;
      frame.setAttribute('aria-hidden', 'true');
      frame.setAttribute('sandbox', 'allow-scripts');
      const fail = () => {
        frame?.remove();
        frame = null;
        frameReady = null;
        reject(new Error('Diagram renderer could not be loaded.'));
      };
      const timeout = setTimeout(fail, 15000);
      frame.addEventListener('load', () => { clearTimeout(timeout); resolve(frame); }, { once: true });
      frame.addEventListener('error', () => {
        clearTimeout(timeout);
        fail();
      }, { once: true });
      frame.src = '/mermaid-renderer.html';
      document.body.append(frame);
    });
    return frameReady;
  }

  async function renderSource(source) {
    const target = await rendererFrame();
    return new Promise((resolve, reject) => {
      const channel = new MessageChannel();
      const timeout = setTimeout(() => {
        channel.port1.close();
        // Discard a failed renderer rather than queuing more work in it.
        frame.remove();
        frame = null;
        frameReady = null;
        reject(new Error('Diagram render timed out'));
      }, 10000);
      channel.port1.onmessage = event => {
        clearTimeout(timeout);
        channel.port1.close();
        if (typeof event.data?.svg === 'string') resolve(event.data.svg);
        else reject(new Error(event.data?.error || 'Diagram unavailable.'));
      };
      target.contentWindow.postMessage({ type: 'render-mermaid', source }, '*', [channel.port2]);
    });
  }

  function sanitizedImage(svg) {
    if (!root.DOMPurify || svg.length > 2000000) throw new Error('The rendered diagram could not be displayed.');
    const clean = root.DOMPurify.sanitize(svg, {
      USE_PROFILES: { svg: true, svgFilters: true },
      FORBID_TAGS: ['a', 'foreignObject', 'image', 'script', 'animate', 'animateMotion', 'animateTransform', 'set'],
      RETURN_DOM_FRAGMENT: true
    });
    const diagram = clean.querySelector('svg');
    if (!diagram) throw new Error('The rendered diagram could not be displayed.');
    for (const node of [diagram, ...diagram.querySelectorAll('*')]) {
      for (const attr of [...node.attributes]) {
        if ((/^(?:href|xlink:href)$/i.test(attr.name) && !/^#[\w:.-]+$/.test(attr.value))
          || /^on/i.test(attr.name)) node.removeAttribute(attr.name);
      }
    }
    const serialized = new XMLSerializer().serializeToString(diagram);
    // Fragment marker references are needed for arrows; external URLs are not.
    const withoutNamespaces = serialized.replaceAll('http://www.w3.org/2000/svg', '')
      .replaceAll('http://www.w3.org/1999/xlink', '');
    const urls = [...serialized.matchAll(/url\(([^)]*)\)/gi)];
    if (/(?:https?:|data:|javascript:|@import)/i.test(withoutNamespaces)
      || urls.some(match => !/^["']?#[\w:.-]+["']?$/.test(match[1].trim()))) {
      throw new Error('The rendered diagram could not be displayed.');
    }
    const title = diagram.querySelector('title')?.textContent;
    const description = diagram.querySelector('desc')?.textContent;
    return {
      url: URL.createObjectURL(new Blob([serialized], { type: 'image/svg+xml' })),
      alt: [title, description].filter(Boolean).join('. ') || 'Mermaid diagram'
    };
  }

  function showError(container, message) {
    const status = document.createElement('p');
    status.className = 'mermaid-error';
    status.textContent = `Diagram unavailable. ${message}`;
    container.prepend(status);
  }

  async function enhance(container) {
    if (!container.isConnected) return;
    const sourceNode = container.querySelector('code');
    const source = sourceNode?.textContent || '';
    const error = policy.sourceError(source);
    if (error) { showError(container, error); return; }
    container.setAttribute('aria-busy', 'true');
    try {
      const svg = await renderSource(source);
      // A preview edit, panel switch or next question can remove this work.
      if (!container.isConnected) return;
      const { url, alt } = sanitizedImage(svg);
      const image = document.createElement('img');
      image.className = 'markdown-image mermaid-image';
      image.alt = alt;
      image.addEventListener('error', () => {
        URL.revokeObjectURL(url);
        images.delete(image);
        image.remove();
        details.open = true;
        showError(container, 'The diagram image could not be displayed.');
      }, { once: true });
      image.src = url;
      images.set(image, url);
      const details = document.createElement('details');
      const summary = document.createElement('summary');
      summary.textContent = 'Diagram source';
      details.append(summary, sourceNode.parentElement);
      const hint = document.createElement('p');
      hint.className = 'mermaid-hint';
      hint.textContent = 'Tap the diagram to enlarge; choose Actual size to inspect details.';
      container.replaceChildren(image, hint, details);
    } catch (failure) {
      if (container.isConnected) showError(container, failure.message);
    } finally {
      container.removeAttribute('aria-busy');
    }
  }

  function prepare(container) {
    if (container.nodeType !== 1) return;
    const diagrams = [...container.querySelectorAll('.mermaid-diagram')];
    if (container.matches('.mermaid-diagram')) diagrams.unshift(container);
    for (const diagram of diagrams) {
      if (prepared.has(diagram)) continue;
      prepared.add(diagram);
      queue = queue.then(() => enhance(diagram));
    }
  }

  function initialize() {
    prepare(document.body);
    new MutationObserver(records => {
      for (const record of records) record.addedNodes.forEach(prepare);
      for (const [image, url] of images) {
        if (!image.isConnected) {
          URL.revokeObjectURL(url);
          images.delete(image);
        }
      }
    }).observe(document.body, { childList: true, subtree: true });
    root.addEventListener('pagehide', event => {
      if (event.persisted) return;
      for (const url of images.values()) URL.revokeObjectURL(url);
      images.clear();
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initialize, { once: true });
  else initialize();
}(globalThis));
