// Preview uses the same pure parser as live sessions.
(function attachQuizPreview(root) {
  const parser = typeof module === 'object' && module.exports
    ? require('./mash-parser') : root.MarkdownMashParser;
  if (typeof module === 'object' && module.exports) {
    module.exports = { parseQuizMarkdownLocal: parser.parseQuizMarkdown };
  } else {
    root.parseQuizMarkdownLocal = parser.parseQuizMarkdown;
  }
}(globalThis));
