(function attachSafeMarkdown(root) {
  function escapeHtml(value) {
    return String(value || '')
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#039;');
  }

  const parser = root.marked;
  const sanitizer = root.DOMPurify;

  if (parser) {
    const defaultRenderer = new parser.Renderer();
    parser.use({
      breaks: true,
      renderer: {
        table(token) {
          const table = defaultRenderer.table.call(this, token);
          return `<div class="markdown-table-scroll" role="region" tabindex="0" aria-label="Scrollable table">${table}</div>`;
        },
        image(token) {
          return defaultRenderer.image.call(this, token).replace(
            '<img ',
            '<img class="markdown-image" referrerpolicy="no-referrer" decoding="async" '
          );
        },
        code(token) {
          if (root.MarkdownMashMermaidPolicy?.isMermaidFence(token.lang)) {
            return `<div class="mermaid-diagram"><pre><code>${escapeHtml(token.text)}</code></pre></div>`;
          }
          if (!root.hljs) return defaultRenderer.code.call(this, token);
          const requestedLanguage = String(token.lang || '').trim();
          const language = root.hljs.getLanguage(requestedLanguage)
            ? requestedLanguage
            : 'plaintext';
          const highlighted = root.hljs.highlight(token.text, { language }).value;
          return `<pre><code class="hljs language-${language}">${highlighted}</code></pre>`;
        }
      }
    });
  }

  const sanitizeOptions = {
    USE_PROFILES: { html: true },
    ADD_ATTR: ['referrerpolicy'],
    FORBID_TAGS: [
      'base',
      'button',
      'embed',
      'form',
      'iframe',
      'input',
      'link',
      'meta',
      'object',
      'option',
      'select',
      'style',
      'textarea'
    ],
    FORBID_ATTR: [
      'action',
      'formaction',
      'id',
      'name',
      'srcdoc',
      'style'
    ]
  };

  function sanitize(rendered) {
    if (!sanitizer) return escapeHtml(rendered);
    return sanitizer.sanitize(rendered, sanitizeOptions);
  }

  function block(value) {
    if (!parser) return escapeHtml(value);
    return sanitize(parser.parse(String(value || '')));
  }

  function inline(value) {
    if (!parser) return escapeHtml(value);
    return sanitize(parser.parseInline(String(value || '')));
  }

  root.MarkdownMashMarkdown = {
    block,
    inline
  };
}(globalThis));
