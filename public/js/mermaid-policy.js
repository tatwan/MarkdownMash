(function attachMermaidPolicy(root, factory) {
  const policy = factory();
  if (typeof module === 'object' && module.exports) module.exports = policy;
  else root.MarkdownMashMermaidPolicy = policy;
}(globalThis, function createMermaidPolicy() {
  const MAX_SOURCE_LENGTH = 12000;
  const MAX_EDGES = 100;

  function isMermaidFence(language) {
    return /^mermaid$/i.test(String(language || '').trim());
  }

  function sourceError(source) {
    if (typeof source !== 'string' || !source.trim()) return 'The diagram is empty.';
    if (source.length > MAX_SOURCE_LENGTH) return 'The diagram is too large.';
    // Site settings must not be replaceable through either Mermaid config syntax.
    if (/^\s*---/.test(source) || /%%\s*\{/.test(source)) {
      return 'Diagram configuration overrides are unavailable.';
    }
    if (/(?:^|[;\n])\s*click\b/i.test(source)
      || /(?:https?:|data:|javascript:|vbscript:|file:|blob:|url\s*\()/i.test(source)
      || /<\/?[a-z][^>]*>|!\[|\b(?:img|icon)\s*:/i.test(source)) {
      return 'Use text labels without HTML, links, images or icons.';
    }
    return null;
  }

  function configuration() {
    return {
      startOnLoad: false,
      securityLevel: 'strict',
      suppressErrorRendering: true,
      maxTextSize: MAX_SOURCE_LENGTH,
      maxEdges: MAX_EDGES,
      htmlLabels: false,
      theme: 'default',
      fontFamily: 'Arial, sans-serif',
      flowchart: { htmlLabels: false, useMaxWidth: false },
      secure: [
        'secure', 'securityLevel', 'startOnLoad', 'suppressErrorRendering',
        'maxTextSize', 'maxEdges', 'htmlLabels', 'flowchart', 'theme',
        'themeCSS', 'themeVariables', 'fontFamily', 'altFontFamily',
        'dompurifyConfig'
      ]
    };
  }

  function treeSize(value) {
    if (!value || typeof value !== 'object') return 0;
    if (Array.isArray(value)) return value.reduce((sum, item) => sum + treeSize(item), 0);
    return 1 + Object.values(value).reduce((sum, item) => sum + treeSize(item), 0);
  }

  function diagramError(type, data) {
    let items;
    // These are the parsed data contracts of the exact pinned Tiny version.
    // Count parsed connections, not arrow-like text in labels or comments.
    switch (type) {
      case 'flowchart':
      case 'flowchart-v2':
      case 'swimlane':
      case 'block':
      case 'er':
      case 'requirement':
      case 'class':
      case 'classDiagram':
      case 'sankey':
      case 'c4':
      case 'cynefin':
      case 'sequence':
        // Sequence notes, activations and controls also consume layout work.
        items = data;
        break;
      case 'state':
      case 'stateDiagram':
        // getRelations() only includes the current state's top-level edges.
        items = data.edges;
        break;
      case 'gitGraph':
        if (!data.every(commit => Array.isArray(commit.parents))) return 'The diagram rendering budget could not be checked.';
        items = data.flatMap(commit => commit.parents);
        break;
      case 'eventmodeling':
        items = data.relations;
        break;
      case 'wardley':
        items = [...data.links, ...data.trends];
        break;
      case 'treeView':
      case 'ishikawa':
        if (!data || typeof data !== 'object') return 'The diagram rendering budget could not be checked.';
        return treeSize(data) - 1 > MAX_EDGES ? 'The diagram has too many connections or events.' : null;
      case 'railroad':
      case 'railroadEbnf':
      case 'railroadAbnf':
      case 'railroadPeg':
        if (!data.every(rule => rule.definition && typeof rule.definition === 'object')) {
          return 'The diagram rendering budget could not be checked.';
        }
        return treeSize(data.map(rule => rule.definition)) > MAX_EDGES
          ? 'The diagram has too many connections or events.' : null;
      case 'gantt':
      case 'info':
      case 'pie':
      case 'timeline':
      case 'journey':
      case 'quadrantChart':
      case 'packet':
      case 'xychart':
      case 'kanban':
      case 'radar':
      case 'treemap':
      case 'venn':
        return null;
      default:
        return 'This diagram type has no supported rendering budget.';
    }
    if (!Array.isArray(items)) return 'The diagram rendering budget could not be checked.';
    return items.length > MAX_EDGES ? 'The diagram has too many connections or events.' : null;
  }

  return { isMermaidFence, sourceError, configuration, diagramError, MAX_SOURCE_LENGTH, MAX_EDGES };
}));
