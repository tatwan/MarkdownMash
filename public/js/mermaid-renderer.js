(function initializeMermaidRenderer(root) {
  const policy = root.MarkdownMashMermaidPolicy;
  // The tiny distribution exposes mermaid through this namespace in v11.
  const renderer = root.mermaid || root.__esbuild_esm_mermaid_nm?.mermaid?.default;
  if (renderer) renderer.initialize(policy.configuration());
  let nextId = 0;

  function parsedDiagramData(diagram) {
    const methods = {
      flowchart: 'getEdges', 'flowchart-v2': 'getEdges', swimlane: 'getEdges', block: 'getEdges',
      er: 'getRelationships', requirement: 'getRelationships',
      class: 'getRelations', classDiagram: 'getRelations',
      state: 'getData', stateDiagram: 'getData', sequence: 'getMessages',
      sankey: 'getLinks', c4: 'getRels', gitGraph: 'getCommitsArray',
      eventmodeling: 'getState', wardley: 'getWardleyData', cynefin: 'getTransitions',
      treeView: 'getRoot', ishikawa: 'getRoot', railroad: 'getRules',
      railroadEbnf: 'getRules', railroadAbnf: 'getRules', railroadPeg: 'getRules'
    };
    const method = methods[diagram.type];
    return method ? diagram.db[method]() : null;
  }

  root.addEventListener('message', async event => {
    if (event.source !== root.parent || event.data?.type !== 'render-mermaid') return;
    const port = event.ports[0];
    if (!port) return;
    const source = event.data.source;
    const error = policy.sourceError(source);
    if (error || !renderer) {
      port.postMessage({ error: error || 'The diagram renderer could not be loaded.' });
      port.close();
      return;
    }
    const container = document.createElement('div');
    document.body.append(container);
    try {
      // Tiny's maxEdges only protects flowcharts. Check every parsed graph
      // before invoking layout, including ER relationships and sequence events.
      const diagram = await renderer.mermaidAPI.getDiagramFromText(source);
      const budgetError = policy.diagramError(diagram.type, parsedDiagramData(diagram));
      if (budgetError) {
        port.postMessage({ error: budgetError });
        return;
      }
      const { svg } = await renderer.render(`mash-diagram-${++nextId}`, source, container);
      // No callbacks or interactive Mermaid bindings cross the frame boundary.
      port.postMessage({ svg });
    } catch (failure) {
      port.postMessage({ error: 'Check the diagram syntax and supported diagram type.' });
    } finally {
      container.remove();
      port.close();
    }
  });
}(globalThis));
