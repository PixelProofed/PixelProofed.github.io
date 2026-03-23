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
      "<dt>Rarity</dt>" +
      "<dd>" +
      escapeHtml(monster.rarity || "---") +
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
      "<p>" +
      escapeHtml(monster.description || "---") +
      "</p>" +
      "</div>" +
      "</article>"
    );
  }

  window.monsterCardUtils = {
    buildMonsterCardMarkup: buildMonsterCardMarkup,
  };
})();
