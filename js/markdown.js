(function () {
  function escapeHtml(text) {
    return text
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function inline(text) {
    let out = escapeHtml(text);
    const codes = [];
    out = out.replace(/`([^`]+)`/g, (_, code) => {
      codes.push(code);
      return `\u0000C${codes.length - 1}\u0000`;
    });
    out = out.replace(
      /\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g,
      '<a href="$2" target="_blank" rel="noreferrer">$1</a>'
    );
    out = out.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
    out = out.replace(/\u0000C(\d+)\u0000/g, (_, i) => `<code>${codes[Number(i)]}</code>`);
    return out;
  }

  function render(markdown) {
    if (!markdown) return "";
    const blocks = [];
    let text = markdown.replace(/(?:```|~~~)(\w*)\r?\n([\s\S]*?)(?:```|~~~)/g, (_, lang, code) => {
      const cls = lang ? ` class="language-${escapeHtml(lang)}"` : "";
      blocks.push(`<pre><code${cls}>${escapeHtml(code.replace(/\n$/, ""))}</code></pre>`);
      return `\u0000B${blocks.length - 1}\u0000`;
    });

    const lines = text.split(/\r?\n/);
    const html = [];
    let paragraph = [];
    let listType = null;

    const flushParagraph = () => {
      if (paragraph.length) {
        html.push(`<p>${inline(paragraph.join(" "))}</p>`);
        paragraph = [];
      }
    };
    const flushList = () => {
      if (listType) {
        html.push(`</${listType}>`);
        listType = null;
      }
    };

    for (const rawLine of lines) {
      const line = rawLine.trim();

      if (!line) {
        flushParagraph();
        flushList();
        continue;
      }

      const blockMatch = line.match(/^\u0000B(\d+)\u0000$/);
      if (blockMatch) {
        flushParagraph();
        flushList();
        html.push(blocks[Number(blockMatch[1])]);
        continue;
      }

      const heading = line.match(/^(#{2,4})\s+(.*)$/);
      if (heading) {
        flushParagraph();
        flushList();
        const level = heading[1].length;
        html.push(`<h${level}>${inline(heading[2])}</h${level}>`);
        continue;
      }

      if (/^---+$/.test(line)) {
        flushParagraph();
        flushList();
        html.push("<hr>");
        continue;
      }

      const quote = line.match(/^>\s?(.*)$/);
      if (quote) {
        flushParagraph();
        flushList();
        html.push(`<blockquote>${inline(quote[1])}</blockquote>`);
        continue;
      }

      const unordered = line.match(/^[-*]\s+(.*)$/);
      const ordered = line.match(/^\d+\.\s+(.*)$/);
      if (unordered || ordered) {
        flushParagraph();
        const wanted = unordered ? "ul" : "ol";
        if (listType !== wanted) {
          flushList();
          html.push(`<${wanted}>`);
          listType = wanted;
        }
        html.push(`<li>${inline((unordered || ordered)[1])}</li>`);
        continue;
      }

      flushList();
      paragraph.push(line);
    }

    flushParagraph();
    flushList();
    return html.join("\n");
  }

  window.renderMarkdown = render;
})();
