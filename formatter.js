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
  var inlinePreservedTags = {
    A: true,
    BR: true,
    EM: true,
    SPAN: true,
    STRONG: true,
  };

  function escapeHtml(value) {
    return String(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/\"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function formatInlineSizeDelta(markerCount, direction) {
    var amount = (markerCount * 0.05).toFixed(2).replace(/0+$/, "").replace(/\.$/, "");
    return (direction < 0 ? "-" : "") + amount + "em";
  }

  function applyInlineSizeMarkup(html, marker, direction) {
    var escapedMarker = marker.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    var pattern = new RegExp(
      "(^|[^A-Za-z0-9])(" +
        escapedMarker +
        "{1,6})([^" +
        escapedMarker +
        "\\n][^" +
        escapedMarker +
        "\\n]*?)\\2(?=($|[^A-Za-z0-9]))",
      "g"
    );

    return html.replace(pattern, function (match, prefix, markers, content) {
      return (
        prefix +
        '<span class="inline-size" style="--inline-size-adjust:' +
        formatInlineSizeDelta(markers.length, direction) +
        ';">' +
        content +
        "</span>"
      );
    });
  }

  function formatInlineHtml(value, options) {
    var html = escapeHtml(value);
    var settings = options || {};

    if (settings.enableSizeMarkup) {
      html = applyInlineSizeMarkup(html, "-", -1);
      html = applyInlineSizeMarkup(html, "+", 1);
    }

    if (settings.enableParagraphMarkup) {
      html = html.replace(/\[hr\]/g, '<span class="formatter-rule" aria-hidden="true"></span>');
    }

    html = html.replace(/\/\/(.+?)\/\//g, '<span class="inline-label">$1</span>');
    html = html.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
    html = html.replace(/\*(.+?)\*/g, "<em>$1</em>");

    return html;
  }

  function trimEmptyOuterLines(lines) {
    var startIndex = 0;
    var endIndex = lines.length - 1;

    while (startIndex <= endIndex && !lines[startIndex].trim()) {
      startIndex += 1;
    }

    while (endIndex >= startIndex && !lines[endIndex].trim()) {
      endIndex -= 1;
    }

    return lines.slice(startIndex, endIndex + 1);
  }

  function formatBlockHtmlWithReplacements(value, replacements, options) {
    var lines = String(value || "")
      .replace(/\r\n/g, "\n")
      .replace(/\r/g, "\n")
      .split(/\\n|\/n|\n/g);
    var map = replacements || {};
    var settings = options || {};
    var output = "";
    var wroteContent = false;
    var pendingSpacer = false;
    var lastWasRule = false;
    var lineIndex;

    function applyReplacements(html) {
      var keys = Object.keys(map);
      var keyIndex;

      for (keyIndex = 0; keyIndex < keys.length; keyIndex += 1) {
        html = html.split(keys[keyIndex]).join(map[keys[keyIndex]]);
      }

      return html;
    }

    lines = trimEmptyOuterLines(lines);

    for (lineIndex = 0; lineIndex < lines.length; lineIndex += 1) {
      var trimmed = lines[lineIndex].trim();
      var formatted;
      var lineEndsWithRule =
        settings.enableParagraphMarkup && /\[hr\]\s*$/.test(trimmed);

      if (!trimmed) {
        if (wroteContent && !lastWasRule) {
          pendingSpacer = true;
        }
        continue;
      }

      if (settings.enableParagraphMarkup && trimmed === "[hr]") {
        if (wroteContent) {
          output += '<br class="formatter-break">';
        }

        output += '<span class="formatter-rule" aria-hidden="true"></span>';
        wroteContent = true;
        pendingSpacer = false;
        lastWasRule = true;
        continue;
      }

      if (/^- /.test(trimmed)) {
        formatted = applyReplacements(
          '<span class="formatter-bullet">&#8226;</span> ' +
            formatInlineHtml(trimmed.replace(/^- /, ""), settings)
        );
      } else {
        formatted = applyReplacements(formatInlineHtml(trimmed, settings));
      }

      if (wroteContent && !lastWasRule) {
        output += pendingSpacer
          ? '<br class="formatter-break"><span class="formatter-break--spacer" aria-hidden="true"></span>'
          : '<br class="formatter-break">';
      }

      output += formatted;
      wroteContent = true;
      pendingSpacer = false;
      lastWasRule = lineEndsWithRule;
    }

    return output;
  }

  function formatBlockHtml(value, options) {
    return formatBlockHtmlWithReplacements(value, null, options);
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

  function formatRichTextHtml(element) {
    var raw = "";
    var replacements = {};
    var nodeIndex;

    for (nodeIndex = 0; nodeIndex < element.childNodes.length; nodeIndex += 1) {
      var node = element.childNodes[nodeIndex];

      if (node.nodeType === Node.TEXT_NODE) {
        raw += node.nodeValue;
        continue;
      }

      if (node.nodeType !== Node.ELEMENT_NODE) {
        continue;
      }

      if (node.tagName === "BR") {
        raw += "\n";
        continue;
      }

      var token = "__HTML_TOKEN_" + nodeIndex + "__";
      replacements[token] = node.outerHTML;
      raw += token;
    }

    return formatBlockHtmlWithReplacements(raw, replacements, {
      enableSizeMarkup: element.tagName === "P",
      enableParagraphMarkup: element.tagName === "P",
    });
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
      if (
        (element.tagName === "P" || element.tagName === "LI" || element.tagName === "DD") &&
        inlinePreservedTags[children[index].tagName]
      ) {
        continue;
      }

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

      if (
        (node.tagName === "P" || node.tagName === "LI" || node.tagName === "DD") &&
        node.children.length
      ) {
        node.innerHTML = formatRichTextHtml(node);
        continue;
      }

      node.innerHTML = formatBlockHtml(raw, {
        enableSizeMarkup: node.tagName === "P",
        enableParagraphMarkup: node.tagName === "P",
      });
    }
  }

  window.siteTextFormatter = {
    apply: apply,
    formatBlockHtml: formatBlockHtml,
    formatInlineHtml: formatInlineHtml,
  };
})();
