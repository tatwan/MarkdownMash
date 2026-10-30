const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const { Marked } = require('marked');
const policy = require('./public/js/mermaid-policy');
const { parseQuizMarkdown, gradedCount, pointsPerQuestion, questionForStep } = require('./quiz-structure');
const { parseQuizMarkdownLocal } = require('./public/js/quiz-preview-parser');
const { parseSurveyMarkdown } = require('./survey-structure');
const { parseSurveyMarkdown: parseSurveyPreview } = require('./public/js/survey-preview-parser');
const { getQuestionForParticipants } = require('./question-payload');

for (const language of ['mermaid', ' Mermaid ', 'MERMAID']) assert.ok(policy.isMermaidFence(language));
for (const language of ['', 'text', 'mermaid extra', 'not-mermaid']) assert.equal(policy.isMermaidFence(language), false);

const diagram = 'flowchart TD\n C[bi.dim_customer] -->|customer_id| F["?"]\n P[bi.dim_product] -->|product_id| F\n D[Date table] -->|order_date| F';
assert.equal(policy.sourceError(diagram), null);
assert.equal(policy.sourceError('sequenceDiagram\n A->>B: Hello'), null);
assert.equal(policy.sourceError('erDiagram\n CUSTOMER ||--o{ SALE : makes'), null);
for (const source of [
  '', 'x'.repeat(policy.MAX_SOURCE_LENGTH + 1),
  '---\nconfig:\n securityLevel: loose\n---\nflowchart TD\n A-->B',
  '%%{init: {"securityLevel":"loose"}}%%\nflowchart TD\n A-->B',
  'flowchart TD\n A-->B\n click A callback',
  'flowchart TD\n A-->B;click A "https://example.com"',
  'flowchart TD\n A["<img src=x onerror=alert(1)>"]',
  'flowchart TD\n A@{img: "//example.com/a.png"}',
  'flowchart TD\n style A fill:url(//example.com/a.png)'
]) assert.ok(policy.sourceError(source), `unsafe/unsupported source must fail: ${source.slice(0,70)}`);
const config = policy.configuration();
assert.equal(config.securityLevel, 'strict');
assert.equal(config.startOnLoad, false);
assert.equal(config.htmlLabels, false);
assert.equal(config.flowchart.htmlLabels, false);
assert.equal(config.maxEdges, 100);
for (const key of ['securityLevel', 'secure', 'htmlLabels', 'flowchart', 'themeCSS', 'fontFamily', 'maxEdges']) {
  assert.ok(config.secure.includes(key), `${key} cannot be overridden by an author`);
}

const records = count => Array.from({ length: count }, () => ({}));
for (const type of ['flowchart', 'flowchart-v2', 'swimlane', 'block', 'er', 'requirement',
  'class', 'classDiagram', 'sequence', 'sankey', 'c4', 'cynefin']) {
  assert.equal(policy.diagramError(type, records(100)), null, `${type} accepts 100`);
  assert.ok(policy.diagramError(type, records(101)), `${type} refuses 101`);
  assert.ok(policy.diagramError(type, {}), `${type} refuses an unexpected engine shape`);
}
for (const type of ['state', 'stateDiagram']) {
  assert.equal(policy.diagramError(type, { edges: records(100) }), null);
  assert.ok(policy.diagramError(type, { edges: records(101) }));
}
assert.equal(policy.diagramError('gitGraph', [{ parents: records(100) }]), null);
assert.ok(policy.diagramError('gitGraph', [{ parents: records(99) }, { parents: records(2) }]));
assert.ok(policy.diagramError('gitGraph', [{}]));
assert.equal(policy.diagramError('wardley', { links: records(99), trends: records(1) }), null);
assert.ok(policy.diagramError('wardley', { links: records(99), trends: records(2) }));
assert.equal(policy.diagramError('eventmodeling', { relations: records(100) }), null);
assert.ok(policy.diagramError('eventmodeling', { relations: records(101) }));
for (const type of ['treeView', 'ishikawa']) {
  const root = { children: [{ children: records(99) }] };
  assert.equal(policy.diagramError(type, root), null);
  root.children[0].children.push({});
  assert.ok(policy.diagramError(type, root), `${type} includes nested items`);
  assert.ok(policy.diagramError(type, null));
}
for (const type of ['railroad', 'railroadEbnf', 'railroadAbnf', 'railroadPeg']) {
  const rules = [{ definition: { type: 'sequence', items: records(99) } }];
  assert.equal(policy.diagramError(type, rules), null);
  rules[0].definition.items.push({});
  assert.ok(policy.diagramError(type, rules));
  assert.ok(policy.diagramError(type, [{}]));
}
assert.equal(policy.diagramError('pie', null), null);
assert.ok(policy.diagramError('new-unreviewed-type', []));

// Exercise the real sandbox entry point: an over-budget parsed graph must never
// reach render/layout, and every early exit still releases its container/port.
async function checkRendererBudget() {
  for (const type of ['er', 'sequence']) {
    for (const count of [100, 101]) {
      let listener;
      let rendered = 0;
      let removed = 0;
      let closed = 0;
      const messages = [];
      const parent = {};
      const db = { getRelationships: () => records(count), getMessages: () => records(count) };
      const sandbox = vm.createContext({
        MarkdownMashMermaidPolicy: policy, parent,
        addEventListener(event, callback) { listener = callback; },
        document: { body: { append() {} }, createElement: () => ({ remove() { removed++; } }) },
        mermaid: {
          initialize() {}, mermaidAPI: { getDiagramFromText: async () => ({ type, db }) },
          async render() { rendered++; return { svg: '<svg/>' }; }
        }
      });
      vm.runInContext(fs.readFileSync('public/js/mermaid-renderer.js', 'utf8'), sandbox);
      await listener({ source: parent, data: { type: 'render-mermaid', source: 'valid source' },
        ports: [{ postMessage(message) { messages.push(message); }, close() { closed++; } }] });
      assert.equal(rendered, count === 100 ? 1 : 0);
      assert.equal(Boolean(messages[0].svg), count === 100);
      assert.equal(Boolean(messages[0].error), count === 101);
      assert.equal(removed, 1);
      assert.equal(closed, 1);
    }
  }
}

// This checks the renderer's synchronous HTML/sanitizer contract, not DOMPurify itself.
const sanitized = [];
const context = vm.createContext({
  marked: new Marked(), MarkdownMashMermaidPolicy: policy,
  DOMPurify: { sanitize(html, options) { sanitized.push(options); return html; } }
});
vm.runInContext(fs.readFileSync('public/js/markdown.js', 'utf8'), context);
const html = context.MarkdownMashMarkdown.block('```mermaid\nA["</code><script>bad()</script>&"]\n```');
assert.match(html, /class="mermaid-diagram"/);
assert.match(html, /&lt;script&gt;/);
assert.doesNotMatch(html, /<script>/);
assert.equal(sanitized.at(-1).USE_PROFILES.html, true);
assert.ok(sanitized.at(-1).FORBID_TAGS.includes('style'));
assert.ok(sanitized.at(-1).FORBID_ATTR.includes('style'));
assert.doesNotMatch(context.MarkdownMashMarkdown.block('```text\nflowchart TD\n A-->B\n```'), /class="mermaid-diagram"/);
assert.doesNotMatch(context.MarkdownMashMarkdown.inline('`mermaid`'), /class="mermaid-diagram"/);

const source = [
  '# Diagram quiz', '# Score 100', ':::case star | Star schema',
  ':::panel The star', '```mermaid', diagram, '```',
  ':::panel Plain text', 'The original fallback stays available.', ':::endcase',
  '# Section: Model', '## Q1: Which fact belongs in the centre?', '::case=star',
  '```mermaid', diagram, '%% Structural-looking text remains opaque:',
  '## Q99: Not a question', '::time=999', ':::endcase', '- [x] Not an answer', '```',
  '- [x] fact_sales', '- [ ] dim_product', '::time=60',
  '## Q2: Opinion?', '::type=ungraded', '- [x] Ready', '- [ ] Again'
].join('\n');
for (const [parse, preview] of [[parseQuizMarkdown, parseQuizMarkdownLocal], [parseSurveyMarkdown, parseSurveyPreview]]) {
  const mash = parse(source);
  assert.deepEqual(preview(source), mash);
  assert.equal(mash.questions.length, 2);
  assert.deepEqual(mash.steps.map(step => step.kind), ['section', 'question', 'question']);
  assert.deepEqual(mash.questions.map(q => q.index), [0, 1]);
  assert.equal(mash.questions[0].timeLimit, 60);
  assert.match(mash.questions[0].text, /## Q99/);
  assert.deepEqual(mash.questions[0].options, ['fact_sales', 'dim_product']);
  const payload = getQuestionForParticipants(mash.questions[0], mash);
  assert.match(payload.caseStudy.panels[0].text, /flowchart TD/);
  assert.equal(payload.caseStudy.panels.length, 2);
  assert.equal(getQuestionForParticipants(mash.questions[1], mash).caseStudy, null);
  assert.equal('correctIndices' in payload, false);
}
const quiz = parseQuizMarkdown(source);
assert.equal(gradedCount(quiz), 1);
assert.equal(pointsPerQuestion(quiz), 100);
assert.equal(questionForStep(quiz, 0), null);
assert.equal(questionForStep(quiz, 1), quiz.questions[0]);

checkRendererBudget().then(() => {
  console.log('All Mermaid policy, renderer contract and parser parity tests passed.');
}).catch(error => { console.error(error); process.exitCode = 1; });
