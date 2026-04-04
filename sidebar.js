(function () {
  var body = document.body;
  var root = document.querySelector("[data-sidebar-root]");

  if (!body || !root) {
    return;
  }

  var sharedNav = [
    { slug: "home", href: "index.html", label: "Home" },
    { slug: "setting", href: "setting.html", label: "Setting" },
    { slug: "starter-guide", href: "starter-guide.html", label: "Starter Guide" },
    { slug: "monster-guide", href: "monster-guide.html", label: "Monster Guide" },
    { slug: "bot-info", href: "bot-info.html", label: "Bot Info" },
  ];

  var settingIndex = {
    label: "Setting Index",
    links: [
      { href: "setting.html#background", label: "Background" },
      { href: "setting.html#professions", label: "Professions" },
      { href: "setting.html#locations", label: "Locations" },
      { href: "setting.html#dungeons", label: "Dungeons" },
      { href: "setting.html#religions", label: "Religions" },
      { href: "setting.html#system", label: "System" },
      { href: "setting.html#characters", label: "Characters" },
      { href: "setting.html#races", label: "Races" },
      { href: "setting.html#monsters", label: "Monsters" },
      { href: "setting.html#skills", label: "Skills" },
      { href: "setting.html#traits", label: "Traits" },
      { href: "setting.html#stats", label: "Stats" },
    ],
  };

  var localSettingIndex = {
    label: "Setting Index",
    links: [
      { href: "#background", label: "Background" },
      { href: "#professions", label: "Professions" },
      { href: "#locations", label: "Locations" },
      { href: "#dungeons", label: "Dungeons" },
      { href: "#religions", label: "Religions" },
      { href: "#system", label: "System" },
      { href: "#characters", label: "Characters" },
      { href: "#races", label: "Races" },
      { href: "#monsters", label: "Monsters" },
      { href: "#skills", label: "Skills" },
      { href: "#traits", label: "Traits" },
      { href: "#stats", label: "Stats" },
    ],
  };

  var monsterIndex = {
    label: "Monster Index",
    links: [
      { href: "evolution-trees.html", label: "Evolution Trees" },
      { href: "#monster-overview", label: "Overview", attrs: ' data-hash-target="overview"' },
      { href: "#undead-line", label: "Undead Line", attrs: ' data-hash-target="undead-line"' },
      { href: "#goblin-line", label: "Goblin Line", attrs: ' data-hash-target="goblin-line"' },
      { href: "#fire-elemental-line", label: "Fire Elemental Line", attrs: ' data-hash-target="fire-elemental-line"' },
      { href: "#earth-elemental-line", label: "Earth Elemental Line", attrs: ' data-hash-target="earth-elemental-line"' },
      { href: "#water-elemental-line", label: "Water Elemental Line", attrs: ' data-hash-target="water-elemental-line"' },
      { href: "#wind-elemental-line", label: "Wind Elemental Line", attrs: ' data-hash-target="wind-elemental-line"' },
      { href: "#slime-line", label: "Slime Line", attrs: ' data-hash-target="slime-line"' },
      { href: "#phantom-line", label: "Phantom Line", attrs: ' data-hash-target="phantom-line"' },
      { href: "#plant-line", label: "Plant Line", attrs: ' data-hash-target="plant-line"' },
      { href: "#demon-line", label: "Demon Line", attrs: ' data-hash-target="demon-line"' },
      { href: "#wolf-line", label: "Wolf Line", attrs: ' data-hash-target="wolf-line"' },
      { href: "#draconic-line", label: "Draconic Line", attrs: ' data-hash-target="draconic-line"' },
      { href: "#spider-line", label: "Spider Line", attrs: ' data-hash-target="spider-line"' },
      { href: "#fox-line", label: "Fox Line", attrs: ' data-hash-target="fox-line"' },
      { href: "#bird-line", label: "Bird Line", attrs: ' data-hash-target="bird-line"' },
      { href: "#angel-line", label: "Angel Line", attrs: ' data-hash-target="angel-line"' },
      { href: "#rabbit-line", label: "Rabbit Line", attrs: ' data-hash-target="rabbit-line"' },
      { href: "#cat-line", label: "Cat Line", attrs: ' data-hash-target="cat-line"' },
      { href: "#insect-line", label: "Insect Line", attrs: ' data-hash-target="insect-line"' },
      { href: "#equine-line", label: "Equine Line", attrs: ' data-hash-target="equine-line"' },
      { href: "#primate-line", label: "Primate Line", attrs: ' data-hash-target="primate-line"' },
      { href: "#non-evo-monsters", label: "Non-Evo Monsters", attrs: ' data-hash-target="non-evo-monsters"' },
    ],
  };

  var starterGuideIndex = {
    label: "Starter Guide",
    links: [
      { href: "starter-guide.html", label: "Overview" },
      { href: "starter-stats.html", label: "Stats" },
      { href: "starter-traits.html", label: "Traits" },
      { href: "starter-skills.html", label: "Skills" },
      { href: "starter-races.html", label: "Races" },
      { href: "monster-guide.html", label: "Monsters" },
    ],
  };

  var starterSkillsIndex = {
    label: "Skills Guide",
    links: [
      { href: "skill-examples.html", label: "Skill Examples" },
      { href: "buffs.html", label: "Buffs" },
      { href: "debuffs.html", label: "Debuffs" },
      { href: "magic.html", label: "Magic" },
      { href: "charisma-actions.html", label: "Charisma Actions" },
    ],
  };

  var manaStonesIndex = {
    label: "Related Pages",
    links: [
      { href: "monster-guide.html", label: "Monsters" },
      { href: "adventurers-guild.html", label: "Adventurer's Guild" },
      { href: "magic.html", label: "Magic" },
      { href: "alchemy.html", label: "Alchemy" },
    ],
  };

  var starterRacesIndex = {
    label: "Related Pages",
    links: [
      { href: "locations.html", label: "Locations" },
      { href: "adventurers-guild.html", label: "Adventurer's Guild" },
      { href: "alchemy.html", label: "Alchemy" },
      { href: "blacksmithing.html", label: "Blacksmithing" },
      { href: "herbalism.html", label: "Herbalism" },
      { href: "mining.html", label: "Mining" },
    ],
  };

  var treeIndex = {
    label: "Tree Index",
    links: [
      { href: "#all", label: "All Lines", attrs: ' data-tree-sidebar-target="all"' },
      { href: "#undead-line", label: "Undead Line", attrs: ' data-tree-sidebar-target="undead-line"' },
      { href: "#goblin-line", label: "Goblin Line", attrs: ' data-tree-sidebar-target="goblin-line"' },
      { href: "#fire-elemental-line", label: "Fire Elemental Line", attrs: ' data-tree-sidebar-target="fire-elemental-line"' },
      { href: "#earth-elemental-line", label: "Earth Elemental Line", attrs: ' data-tree-sidebar-target="earth-elemental-line"' },
      { href: "#water-elemental-line", label: "Water Elemental Line", attrs: ' data-tree-sidebar-target="water-elemental-line"' },
      { href: "#wind-elemental-line", label: "Wind Elemental Line", attrs: ' data-tree-sidebar-target="wind-elemental-line"' },
      { href: "#slime-line", label: "Slime Line", attrs: ' data-tree-sidebar-target="slime-line"' },
      { href: "#phantom-line", label: "Phantom Line", attrs: ' data-tree-sidebar-target="phantom-line"' },
      { href: "#plant-line", label: "Plant Line", attrs: ' data-tree-sidebar-target="plant-line"' },
      { href: "#demon-line", label: "Demon Line", attrs: ' data-tree-sidebar-target="demon-line"' },
      { href: "#wolf-line", label: "Wolf Line", attrs: ' data-tree-sidebar-target="wolf-line"' },
      { href: "#draconic-line", label: "Draconic Line", attrs: ' data-tree-sidebar-target="draconic-line"' },
      { href: "#spider-line", label: "Spider Line", attrs: ' data-tree-sidebar-target="spider-line"' },
      { href: "#fox-line", label: "Fox Line", attrs: ' data-tree-sidebar-target="fox-line"' },
      { href: "#bird-line", label: "Bird Line", attrs: ' data-tree-sidebar-target="bird-line"' },
      { href: "#angel-line", label: "Angel Line", attrs: ' data-tree-sidebar-target="angel-line"' },
      { href: "#rabbit-line", label: "Rabbit Line", attrs: ' data-tree-sidebar-target="rabbit-line"' },
      { href: "#cat-line", label: "Cat Line", attrs: ' data-tree-sidebar-target="cat-line"' },
      { href: "#insect-line", label: "Insect Line", attrs: ' data-tree-sidebar-target="insect-line"' },
      { href: "#equine-line", label: "Equine Line", attrs: ' data-tree-sidebar-target="equine-line"' },
      { href: "#primate-line", label: "Primate Line", attrs: ' data-tree-sidebar-target="primate-line"' },
    ],
  };

  var sidebarConfigs = {
    home: {
      eyebrow: "Welcome to",
      title: "New Game Plus",
      section: settingIndex,
    },
    setting: {
      eyebrow: "Welcome to",
      title: "New Game Plus",
      section: localSettingIndex,
    },
    "bot-info": {
      eyebrow: "Welcome to",
      title: "New Game Plus",
      section: settingIndex,
    },
    "starter-guide": {
      eyebrow: "Welcome to",
      title: "New Game Plus",
      section: starterGuideIndex,
    },
    "starter-skills": {
      eyebrow: "Welcome to",
      title: "New Game Plus",
      section: starterSkillsIndex,
    },
    "starter-races": {
      eyebrow: "Welcome to",
      title: "New Game Plus",
      section: starterRacesIndex,
    },
    "mana-stones": {
      eyebrow: "Welcome to",
      title: "New Game Plus",
      section: manaStonesIndex,
    },
    "monster-guide": {
      eyebrow: "Testing",
      title: "Pixel Proofed",
      section: monsterIndex,
    },
    "evolution-trees": {
      eyebrow: "Welcome to",
      title: "New Game Plus",
      section: treeIndex,
    },
  };

  function escapeHtml(value) {
    return String(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function renderNav(links) {
    return links
      .map(function (link) {
        return (
          '<a class="nav-link" data-nav-page="' +
          escapeHtml(link.slug) +
          '" href="' +
          escapeHtml(link.href) +
          '">' +
          escapeHtml(link.label) +
          "</a>"
        );
      })
      .join("");
  }

  function renderSection(section) {
    if (!section) {
      return "";
    }

    return (
      '<div class="sidebar__section">' +
      '<p class="sidebar__label">' +
      escapeHtml(section.label) +
      "</p>" +
      '<div class="sidebar__subnav">' +
      section.links
        .map(function (link) {
          return (
            '<a href="' +
            escapeHtml(link.href) +
            '"' +
            (link.attrs || "") +
            ">" +
            escapeHtml(link.label) +
            "</a>"
          );
        })
        .join("") +
      "</div>" +
      "</div>"
    );
  }

  var config = sidebarConfigs[body.dataset.sidebar || body.dataset.page] || sidebarConfigs.home;

  root.innerHTML =
    '<aside class="sidebar" id="sidebar">' +
    '<div class="sidebar__inner">' +
    '<a class="brand" href="index.html">' +
    '<span class="brand__eyebrow">' +
    escapeHtml(config.eyebrow) +
    "</span>" +
    '<span class="brand__title">' +
    escapeHtml(config.title) +
    "</span>" +
    "</a>" +
    '<nav class="sidebar__nav" aria-label="Primary">' +
    renderNav(sharedNav) +
    "</nav>" +
    renderSection(config.section) +
    "</div>" +
    "</aside>" +
    '<div class="backdrop" id="backdrop"></div>';

  if (window.siteTextFormatter && window.siteTextFormatter.apply) {
    window.siteTextFormatter.apply(root);
  }
})();
