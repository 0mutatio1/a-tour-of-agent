import DOMPurify from "dompurify";
import hljs from "highlight.js/lib/common";
import MarkdownIt from "markdown-it";

const markdown = new MarkdownIt({
  html: false,
  linkify: true,
  highlight(str: string, lang: string): string {
    try {
      if (lang && hljs.getLanguage(lang)) {
        return `<pre><code class="hljs language-${lang}">${hljs.highlight(str, { language: lang }).value}</code></pre>`;
      }
      return `<pre><code class="hljs">${hljs.highlightAuto(str).value}</code></pre>`;
    } catch {
      return `<pre><code class="hljs">${markdown.utils.escapeHtml(str)}</code></pre>`;
    }
  },
});

export function renderMarkdown(text: string): string {
  return DOMPurify.sanitize(markdown.render(text));
}