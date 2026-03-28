(function () {
  var allowedTags = {
    P: true,
    LI: true,
    A: true,
    BUTTON: true,
    H1: true,
    H2: true,
    H3: true,
    H4: true,
    H5: true,
    H6: true,
    DD: true,
    SPAN: true,
  };

  function escapeHtml(value) {
    return String(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/\"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function formatInlineHtml(value) {
    var html = escapeHtml(value);

    html = html.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
    html = html.replace(/\*(.+?)\*/g, "<em>$1</em>");

    return html;
  }

  function formatBlockHtml(value) {
    var lines = String(value || "")
      .replace(/\r\n/g, "\n")
      .replace(/\r/g, "\n")
      .split(/\\n|\/n|\n/g);

    return lines
      .map(function (line) {
        var trimmed = line.trim();

        if (!trimmed) {
          return "";
        }

        if (/^- /.test(trimmed)) {
          return "&#8226; " + formatInlineHtml(trimmed.replace(/^- /, ""));
        }

        return formatInlineHtml(trimmed);
      })
      .join("<br>");
  }

  function extractRawText(element) {
    var raw = "";
    var index;

    for (index = 0; index < element.childNodes.length; index += 1) {
      var node = element.childNodes[index];

      if (node.nodeType === Node.TEXT_NODE) {
        raw += node.nodeValue;
        continue;
      }

      if (node.nodeType === Node.ELEMENT_NODE && node.tagName === "BR") {
        raw += "/n";
      }
    }

    return raw;
  }

  function isLeafFormatTarget(element) {
    var children;
    var index;

    if (!element || !allowedTags[element.tagName]) {
      return false;
    }

    if (element.dataset.formatSkip !== undefined) {
      return false;
    }

    if (element.classList && element.classList.contains("menu-button")) {
      return false;
    }

    children = element.children;

    for (index = 0; index < children.length; index += 1) {
      if (children[index].tagName !== "BR") {
        return false;
      }
    }

    return true;
  }

  function apply(root) {
    var target = root || document.body;
    var nodes;
    var index;

    if (!target || !target.querySelectorAll) {
      return;
    }

    nodes = target.querySelectorAll("p, li, a, button, h1, h2, h3, h4, h5, h6, dd, span");

    for (index = 0; index < nodes.length; index += 1) {
      var node = nodes[index];
      var raw;

      if (!isLeafFormatTarget(node)) {
        continue;
      }

      raw = extractRawText(node);

      if (!raw || !raw.trim()) {
        continue;
      }

      node.innerHTML = formatBlockHtml(raw);
    }
  }

  window.siteTextFormatter = {
    apply: apply,
    formatBlockHtml: formatBlockHtml,
    formatInlineHtml: formatInlineHtml,
  };
})();
