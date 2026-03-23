(function () {
  function escapeHtml(value) {
    return String(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/\"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function normalizeTags(tags) {
    if (!Array.isArray(tags) || !tags.length) {
      return ["---"];
    }

    return tags;
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

  function buildMonsterCardMarkup(monster) {
    return (
      '<article class="card monster-entry">' +
      '<header class="monster-entry__header">' +
      "<h3>" +
      escapeHtml(monster.name || "---") +
      "</h3>" +
      "</header>" +
      '<dl class="monster-entry__meta">' +
      '<div class="monster-entry__meta-row">' +
      "<dt>Origin</dt>" +
      "<dd>" +
      escapeHtml(monster.origin || "---") +
      "</dd>" +
      "</div>" +
      '<div class="monster-entry__meta-row">' +
      "<dt>Commonality</dt>" +
      "<dd>" +
      escapeHtml(monster.commonality || "---") +
      "</dd>" +
      "</div>" +
      '<div class="monster-entry__meta-row monster-entry__meta-row--full">' +
      "<dt>Info Tags</dt>" +
      "<dd>" +
      escapeHtml(monster.tagsText || normalizeTags(monster.tags).join(", ")) +
      "</dd>" +
      "</div>" +
      "</dl>" +
      '<div class="monster-entry__description">' +
      '<p class="monster-entry__description-label">Description</p>' +
      '<p data-format-skip="true">' +
      formatBlockHtml(monster.description || "---") +
      "</p>" +
      "</div>" +
      '<div class="monster-entry__description">' +
      '<p class="monster-entry__description-label">Traits</p>' +
      '<p data-format-skip="true">' +
      formatBlockHtml(monster.traits || "---") +
      "</p>" +
      "</div>" +
      "</article>"
    );
  }

  window.monsterCardUtils = {
    buildMonsterCardMarkup: buildMonsterCardMarkup,
  };
})();
