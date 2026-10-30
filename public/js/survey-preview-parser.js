// Preview uses the same pure parser as live sessions.
(function attachSurveyPreview(root) {
  const parser = typeof module === 'object' && module.exports
    ? require('./mash-parser') : root.MarkdownMashParser;
  if (typeof module === 'object' && module.exports) {
    module.exports = { parseSurveyMarkdown: parser.parseSurveyMarkdown };
  } else {
    root.parseSurveyMarkdownLocal = parser.parseSurveyMarkdown;
  }
}(globalThis));
