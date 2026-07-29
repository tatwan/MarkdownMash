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

  if (parser && root.hljs) {
    parser.use({
      breaks: true,
      renderer: {
        code(token) {
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
