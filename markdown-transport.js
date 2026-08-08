const MAX_MARKDOWN_BYTES = 700 * 1024;

function decodeMarkdownPayload(payload = {}) {
  if (payload.markdownBase64 !== undefined && payload.markdownBase64 !== null) {
    if (typeof payload.markdownBase64 !== 'string'
      || payload.markdownBase64.length === 0
      || payload.markdownBase64.length % 4 !== 0
      || !/^[A-Za-z0-9+/]*={0,2}$/.test(payload.markdownBase64)) {
      throw new Error('Quiz Markdown encoding is invalid');
    }

    const decoded = Buffer.from(payload.markdownBase64, 'base64');
    if (decoded.length > MAX_MARKDOWN_BYTES) {
      throw new Error('Quiz Markdown is too large');
    }
    return decoded.toString('utf8');
  }

  // Backward compatibility for older clients and local trial drivers.
  if (typeof payload.markdown === 'string') {
    if (Buffer.byteLength(payload.markdown, 'utf8') > MAX_MARKDOWN_BYTES) {
      throw new Error('Quiz Markdown is too large');
    }
    return payload.markdown;
  }

  return '';
}

module.exports = {
  MAX_MARKDOWN_BYTES,
  decodeMarkdownPayload
};
