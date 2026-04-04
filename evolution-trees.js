(function () {
  var treeData = window.evolutionTreeData || [];
  var monsterGuideData = window.monsterGuideData || [];
  var allViewSlug = "all";
  var lineButtons = document.querySelectorAll("[data-tree-line-target]");
  var sidebarLinks = document.querySelectorAll("[data-tree-sidebar-target]");
  var treeWorkspace = document.querySelector(".tree-workspace");
  var chartTitle = document.querySelector("[data-tree-current-title]");
  var chartCount = document.querySelector("[data-tree-current-count]");
  var chartContent = document.querySelector("[data-tree-chart-content]");
  var selectionTitle = document.querySelector("[data-tree-selection-title]");
  var selectionCopy = document.querySelector("[data-tree-selection-copy]");
  var selectionTraits = document.querySelector("[data-tree-selection-traits]");
  var selectionCards = document.querySelector("[data-tree-selected-cards]");
  var stageLabels = ["Origin", "First Stage", "Second Stage", "Third Stage"];
  var monsterCardUtils = window.monsterCardUtils || {};
  var textFormatter = window.siteTextFormatter || {};
  var demonVariantOptions = {
    "Sin Demon": [
      "Sin Demon of Pride",
      "Sin Demon of Sloth",
      "Sin Demon of Lust",
      "Sin Demon of Wrath",
      "Sin Demon of Greed",
      "Sin Demon of Gluttony",
      "Sin Demon of Envy",
    ],
    "Demon Lord": [
      "Demon Lord of Pride",
      "Demon Lord of Sloth",
      "Demon Lord of Lust",
      "Demon Lord of Wrath",
      "Demon Lord of Greed",
      "Demon Lord of Gluttony",
      "Demon Lord of Envy",
    ],
  };
  var demonVariantState = {
    expandedBase: "",
    selectedByBase: {
      "Sin Demon": "",
      "Demon Lord": "",
    },
  };
  var angelVariantOptions = {
    Virtue: [
      "Virtue of Humility",
      "Virtue of Chastity",
      "Virtue of Temperance",
      "Virtue of Kindness",
      "Virtue of Charity",
      "Virtue of Patience",
      "Virtue of Diligence",
    ],
    Principality: [
      "Principality of Humility",
      "Principality of Chastity",
      "Principality of Temperance",
      "Principality of Kindness",
      "Principality of Charity",
      "Principality of Patience",
      "Principality of Diligence",
    ],
  };
  var angelVariantState = {
    expandedBase: "",
    selectedByBase: {
      Virtue: "",
      Principality: "",
    },
  };
  var currentLineSlug = "";
  var selectedNodeKey = "";
  var resizeFrame = 0;
  var allMonstersMarkup = "";
  var pendingFocusRestore = null;
  var pendingScrollRestore = null;

  if (!chartContent || !selectionTitle || !selectionCopy || !selectionCards) {
    return;
  }

  function escapeHtml(value) {
    return String(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/\"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function average(values) {
    var total = 0;
    var index;

    if (!values.length) {
      return 0;
    }

    for (index = 0; index < values.length; index += 1) {
      total += values[index];
    }

    return total / values.length;
  }

  function uniqueSorted(values) {
    var seen = {};
    var result = [];
    var index;

    for (index = 0; index < values.length; index += 1) {
      if (!seen[values[index]]) {
        seen[values[index]] = true;
        result.push(values[index]);
      }
    }

    result.sort(function (left, right) {
      return left - right;
    });

    return result;
  }

  function parseSelectedNodeKey() {
    var parts;

    if (!selectedNodeKey) {
      return null;
    }

    parts = selectedNodeKey.split(":");

    return {
      slug: parts[0],
      pathIndex: Number(parts[1]),
      stepIndex: Number(parts[2]),
    };
  }

  function getLine(slug) {
    var index;

    for (index = 0; index < treeData.length; index += 1) {
      if (treeData[index].slug === slug) {
        return treeData[index];
      }
    }

    return null;
  }

  function getRequestedMonsterName() {
    var params = new URLSearchParams(window.location.search);
    return params.get("monster") || "";
  }

  function findSelectionForMonster(line, monsterName) {
    var normalizedTarget = String(monsterName || "").trim().toLowerCase();
    var pathIndex;
    var stepIndex;

    if (!line || !normalizedTarget) {
      return "";
    }

    for (pathIndex = 0; pathIndex < line.paths.length; pathIndex += 1) {
      for (stepIndex = 0; stepIndex < line.paths[pathIndex].length; stepIndex += 1) {
        if (String(line.paths[pathIndex][stepIndex] || "").trim().toLowerCase() === normalizedTarget) {
          return line.slug + ":" + pathIndex + ":" + stepIndex;
        }
      }
    }

    return "";
  }

  function findLineForMonster(monsterName) {
    var normalizedTarget = String(monsterName || "").trim().toLowerCase();
    var lineIndex;
    var pathIndex;
    var stepIndex;

    if (!normalizedTarget) {
      return null;
    }

    for (lineIndex = 0; lineIndex < treeData.length; lineIndex += 1) {
      for (pathIndex = 0; pathIndex < treeData[lineIndex].paths.length; pathIndex += 1) {
        for (stepIndex = 0; stepIndex < treeData[lineIndex].paths[pathIndex].length; stepIndex += 1) {
          if (
            String(treeData[lineIndex].paths[pathIndex][stepIndex] || "").trim().toLowerCase() ===
            normalizedTarget
          ) {
            return treeData[lineIndex];
          }
        }
      }
    }

    return null;
  }

  function getLineDetails(slug) {
    var index;

    for (index = 0; index < monsterGuideData.length; index += 1) {
      if (monsterGuideData[index].slug === slug) {
        return monsterGuideData[index];
      }
    }

    return null;
  }

  function getMonster(slug, name) {
    var line = getLineDetails(slug);
    var index;

    if (!line) {
      return null;
    }

    for (index = 0; index < line.monsters.length; index += 1) {
      if (line.monsters[index].name === name) {
        return line.monsters[index];
      }
    }

    return null;
  }

  function isDemonVariantBase(name) {
    return Boolean(demonVariantOptions[name]);
  }

  function getDemonVariantSelection(baseName) {
    return demonVariantState.selectedByBase[baseName] || "";
  }

  function isAngelVariantBase(name) {
    return Boolean(angelVariantOptions[name]);
  }

  function getAngelVariantSelection(baseName) {
    return angelVariantState.selectedByBase[baseName] || "";
  }

  function getMatchingVariant(baseName, sourceName) {
    var suffix;

    if (!sourceName || sourceName.indexOf(" of ") === -1) {
      return "";
    }

    suffix = sourceName.split(" of ")[1];

    if (!suffix) {
      return "";
    }

    return baseName + " of " + suffix;
  }

  function getVariantSuffix(name) {
    if (!name || name.indexOf(" of ") === -1) {
      return name;
    }

    return name.split(" of ")[1];
  }

  function getDisplayNameForNode(lineSlug, logicalName) {
    if (lineSlug === "demon-line" && isDemonVariantBase(logicalName)) {
      return getDemonVariantSelection(logicalName) || logicalName;
    }

    if (lineSlug === "angel-line" && isAngelVariantBase(logicalName)) {
      return getAngelVariantSelection(logicalName) || logicalName;
    }

    return logicalName;
  }

  function getDisplayPath(line, pathIndex, stepIndex) {
    return line.paths[pathIndex].slice(0, stepIndex + 1).map(function (name) {
      return getDisplayNameForNode(line.slug, name);
    });
  }

  function getNodeLabel(lineSlug, logicalName, displayName) {
    if (
      ((lineSlug === "demon-line" && demonVariantState.expandedBase === logicalName) ||
        (lineSlug === "angel-line" && angelVariantState.expandedBase === logicalName)) &&
      displayName.indexOf(" of ") !== -1
    ) {
      return getVariantSuffix(displayName);
    }

    return displayName;
  }

  function getDisplayPaths(line) {
    var displayPaths = line.paths.map(function (path, pathIndex) {
      return {
        pathIndex: pathIndex,
        logical: path.slice(),
        names: path.map(function (name) {
          return getDisplayNameForNode(line.slug, name);
        }),
      };
    });

    if (line.slug !== "demon-line" || !demonVariantState.expandedBase) {
      if (line.slug !== "angel-line" || !angelVariantState.expandedBase) {
        return displayPaths;
      }
    }

    if (line.slug === "demon-line" && demonVariantState.expandedBase === "Sin Demon") {
      return demonVariantOptions["Sin Demon"].map(function (variantName) {
        return {
          pathIndex: 2,
          logical: ["Imp", "Demon", "Sin Demon"],
          names: ["Imp", "Demon", variantName],
        };
      });
    }

    if (line.slug === "demon-line" && demonVariantState.expandedBase === "Demon Lord") {
      return demonVariantOptions["Demon Lord"].map(function (variantName) {
        return {
          pathIndex: 2,
          logical: ["Imp", "Demon", "Sin Demon", "Demon Lord"],
          names: [
            "Imp",
            "Demon",
            getDemonVariantSelection("Sin Demon") || "Sin Demon",
            variantName,
          ],
        };
      });
    }

    if (line.slug === "angel-line" && angelVariantState.expandedBase === "Virtue") {
      return angelVariantOptions.Virtue.map(function (variantName) {
        return {
          pathIndex: 0,
          logical: ["Cherub", "Angel", "Virtue"],
          names: ["Cherub", "Angel", variantName],
        };
      });
    }

    if (line.slug === "angel-line" && angelVariantState.expandedBase === "Principality") {
      return angelVariantOptions.Principality.map(function (variantName) {
        return {
          pathIndex: 0,
          logical: ["Cherub", "Angel", "Virtue", "Principality"],
          names: [
            "Cherub",
            "Angel",
            getAngelVariantSelection("Virtue") || "Virtue",
            variantName,
          ],
        };
      });
    }

    return displayPaths;
  }

  function updateActiveLinks(slug) {
    var index;

    for (index = 0; index < lineButtons.length; index += 1) {
      lineButtons[index].classList.toggle("is-active", lineButtons[index].dataset.treeLineTarget === slug);
    }

    for (index = 0; index < sidebarLinks.length; index += 1) {
      sidebarLinks[index].classList.toggle("is-active", sidebarLinks[index].dataset.treeSidebarTarget === slug);
    }
  }

  function buildFocusSelector(descriptor) {
    if (!descriptor) {
      return "";
    }

    if (descriptor.type === "node") {
      return (
        '.tree-node[data-tree-line="' +
        descriptor.line +
        '"][data-tree-node-step="' +
        descriptor.step +
        '"][data-tree-node-logical="' +
        descriptor.logical +
        '"][data-tree-node-name="' +
        descriptor.name +
        '"]'
      );
    }

    if (descriptor.type === "line-link") {
      return descriptor.selector || "";
    }

    return "";
  }

  function queueFocusRestoreFromElement(element) {
    var slug;

    pendingFocusRestore = null;

    if (!element) {
      return;
    }

    if (element.hasAttribute("data-tree-node-name")) {
      pendingFocusRestore = {
        type: "node",
        line: element.dataset.treeLine || "",
        step: element.dataset.treeNodeStep || "",
        logical: element.dataset.treeNodeLogical || "",
        name: element.dataset.treeNodeName || "",
      };
      return;
    }

    slug = element.dataset.treeLineTarget || element.dataset.treeSidebarTarget || "";

    if (slug) {
      pendingFocusRestore = {
        type: "line-link",
        selector:
          '[data-tree-line-target="' +
          slug +
          '"], [data-tree-sidebar-target="' +
          slug +
          '"]',
      };
    }
  }

  function restoreQueuedFocus() {
    var descriptor = pendingFocusRestore;
    var selector;

    pendingFocusRestore = null;

    if (!descriptor) {
      return;
    }

    selector = buildFocusSelector(descriptor);

    if (!selector) {
      return;
    }

    window.requestAnimationFrame(function () {
      var target = document.querySelector(selector);

      if (!target || typeof target.focus !== "function") {
        return;
      }

      try {
        target.focus({ preventScroll: true });
      } catch (error) {
        target.focus();
      }
    });
  }

  function queueScrollRestore() {
    pendingScrollRestore = {
      x: window.scrollX || window.pageXOffset || 0,
      y: window.scrollY || window.pageYOffset || 0,
    };
  }

  function restoreQueuedScroll() {
    var position = pendingScrollRestore;

    pendingScrollRestore = null;

    if (!position) {
      return;
    }

    window.requestAnimationFrame(function () {
      window.requestAnimationFrame(function () {
        window.scrollTo(position.x, position.y);
      });
    });
  }

  function renderStageHeadings(target) {
    var markup = "";
    var index;

    for (index = 0; index < stageLabels.length; index += 1) {
      markup += "<span>" + escapeHtml(stageLabels[index]) + "</span>";
    }

    target.innerHTML = markup;
  }

  function buildTree(line) {
    var nodesByKey = {};
    var nodes = [];
    var edges = [];
    var pathIndex;
    var displayPaths = getDisplayPaths(line);

    for (pathIndex = 0; pathIndex < displayPaths.length; pathIndex += 1) {
      var path = displayPaths[pathIndex].names;
      var logicalPath = displayPaths[pathIndex].logical;
      var basePathIndex = displayPaths[pathIndex].pathIndex;
      var previousNode = null;
      var stepIndex;

      for (stepIndex = 0; stepIndex < path.length; stepIndex += 1) {
        var name = path[stepIndex];
        var key = stepIndex + "::" + name;
        var node = nodesByKey[key];

        if (!node) {
          node = {
            key: key,
            name: name,
            logicalName: logicalPath[stepIndex],
            label: getNodeLabel(line.slug, logicalPath[stepIndex], name),
            depth: stepIndex,
            parents: [],
            children: [],
            pathRefs: [],
            pathIndices: [],
            firstPathIndex: basePathIndex,
            firstSeenOrder: nodes.length,
            layoutX: 0,
            layoutY: 0,
          };
          nodesByKey[key] = node;
          nodes.push(node);
        }

        node.pathRefs.push({ pathIndex: basePathIndex, stepIndex: stepIndex });
        node.pathIndices.push(basePathIndex);

        if (previousNode) {
          var edgeKey = previousNode.key + "->" + node.key;
          var edge = null;
          var edgeIndex;

          for (edgeIndex = 0; edgeIndex < edges.length; edgeIndex += 1) {
            if (edges[edgeIndex].key === edgeKey) {
              edge = edges[edgeIndex];
              break;
            }
          }

          if (!edge) {
            edge = {
              key: edgeKey,
              from: previousNode.key,
              to: node.key,
              pathIndices: [],
            };
            edges.push(edge);
            previousNode.children.push(node.key);
            node.parents.push(previousNode.key);
          }

          edge.pathIndices.push(basePathIndex);
        }

        previousNode = node;
      }
    }

    nodes.sort(function (left, right) {
      if (left.depth !== right.depth) {
        return left.depth - right.depth;
      }

      return left.name.localeCompare(right.name);
    });

    return {
      nodesByKey: nodesByKey,
      nodes: nodes,
      edges: edges,
    };
  }

  function layoutTree(tree, availableWidthSource) {
    var availableWidth =
      typeof availableWidthSource === "number"
        ? Math.max(availableWidthSource - 4, 560)
        : availableWidthSource
          ? Math.max(availableWidthSource.clientWidth - 4, 560)
          : 760;
    var leftPadding = 10;
    var usableWidth = availableWidth - leftPadding * 2;
    var columnGap = Math.max(16, Math.min(26, usableWidth * 0.03));
    var nodeWidth = Math.floor((usableWidth - columnGap * (stageLabels.length - 1)) / stageLabels.length);
    var columnWidth = nodeWidth;
    var nodeHeight = 46;
    var rowGap = 9;
    var topPadding = 10;
    var nodeIndex;
    var nodesByDepth = {};
    var depthKeys;
    var maxRows = 1;

    for (nodeIndex = 0; nodeIndex < tree.nodes.length; nodeIndex += 1) {
      var node = tree.nodes[nodeIndex];

      if (!nodesByDepth[node.depth]) {
        nodesByDepth[node.depth] = [];
      }

      nodesByDepth[node.depth].push(node);
    }

    depthKeys = Object.keys(nodesByDepth)
      .map(function (key) {
        return Number(key);
      })
      .sort(function (left, right) {
        return left - right;
      });

    depthKeys.forEach(function (depth) {
      maxRows = Math.max(maxRows, nodesByDepth[depth].length);
    });

    function sortByPathAverage(nodes) {
      nodes.sort(function (left, right) {
        var leftAverage = average(uniqueSorted(left.pathIndices));
        var rightAverage = average(uniqueSorted(right.pathIndices));

        if (leftAverage !== rightAverage) {
          return leftAverage - rightAverage;
        }

        if (left.firstPathIndex !== right.firstPathIndex) {
          return left.firstPathIndex - right.firstPathIndex;
        }

        if (left.firstSeenOrder !== right.firstSeenOrder) {
          return left.firstSeenOrder - right.firstSeenOrder;
        }

        return left.name.localeCompare(right.name);
      });
    }

    function placeDepthOnGrid(depth) {
      var nodes = nodesByDepth[depth] || [];
      var totalBlockHeight = nodes.length * nodeHeight + Math.max(0, nodes.length - 1) * rowGap;
      var availableBlockHeight = maxRows * nodeHeight + Math.max(0, maxRows - 1) * rowGap;
      var startOffset = topPadding + Math.max(0, (availableBlockHeight - totalBlockHeight) / 2);
      var idx;

      sortByPathAverage(nodes);

      for (idx = 0; idx < nodes.length; idx += 1) {
        nodes[idx].layoutY = startOffset + idx * (nodeHeight + rowGap) + nodeHeight / 2;
      }
    }

    for (nodeIndex = 0; nodeIndex < tree.nodes.length; nodeIndex += 1) {
      tree.nodes[nodeIndex].layoutX = leftPadding + tree.nodes[nodeIndex].depth * (columnWidth + columnGap);
    }

    depthKeys.forEach(placeDepthOnGrid);

    tree.width = leftPadding * 2 + stageLabels.length * columnWidth + (stageLabels.length - 1) * columnGap;
    tree.height = topPadding * 2 + maxRows * nodeHeight + Math.max(0, maxRows - 1) * rowGap;
    tree.nodeWidth = nodeWidth;
    tree.nodeHeight = nodeHeight;
    tree.columnWidth = columnWidth;
    tree.columnGap = columnGap;
  }

  function isNodeActive(node, line) {
    var selected = parseSelectedNodeKey();
    var path;
    var displayName;

    if (!selected || selected.slug !== line.slug) {
      return false;
    }

    path = line.paths[selected.pathIndex];
    displayName = getDisplayNameForNode(line.slug, node.logicalName);

    return Boolean(
      path &&
        node.depth <= selected.stepIndex &&
        path[node.depth] === node.logicalName &&
        node.name === displayName,
    );
  }

  function isNodeSelected(node, line) {
    var selected = parseSelectedNodeKey();
    var path;
    var displayName;

    if (!selected || selected.slug !== line.slug) {
      return false;
    }

    path = line.paths[selected.pathIndex];
    displayName = getDisplayNameForNode(line.slug, node.logicalName);

    return Boolean(
      path &&
        node.depth === selected.stepIndex &&
        path[node.depth] === node.logicalName &&
        node.name === displayName,
    );
  }

  function getResolvedPathIndex(line, nodeName, stepIndex, logicalName) {
    var candidatePathIndices = [];
    var pathIndex;
    var selected = parseSelectedNodeKey();
    var selectedPath;
    var selectedStepIndex;
    var bestPathIndex = -1;
    var bestScore = -1;

    for (pathIndex = 0; pathIndex < line.paths.length; pathIndex += 1) {
      if (line.paths[pathIndex][stepIndex] === (logicalName || nodeName)) {
        candidatePathIndices.push(pathIndex);
      }
    }

    if (!candidatePathIndices.length) {
      return -1;
    }

    if (!selected || selected.slug !== line.slug) {
      return candidatePathIndices[0];
    }

    selectedPath = line.paths[selected.pathIndex];
    selectedStepIndex = selected.stepIndex;

    candidatePathIndices.forEach(function (candidateIndex) {
      var candidatePath = line.paths[candidateIndex];
      var compareDepth = Math.min(stepIndex, selectedStepIndex);
      var score = 0;
      var compareIndex;

      for (compareIndex = 0; compareIndex <= compareDepth; compareIndex += 1) {
        if (candidatePath[compareIndex] !== selectedPath[compareIndex]) {
          break;
        }

        score += 1;
      }

      if (score > bestScore) {
        bestScore = score;
        bestPathIndex = candidateIndex;
        return;
      }

      if (score === bestScore && bestPathIndex !== -1 && candidateIndex < bestPathIndex) {
        bestPathIndex = candidateIndex;
      }
    });

    return bestPathIndex === -1 ? candidatePathIndices[0] : bestPathIndex;
  }

  function isEdgeActive(edge, line, tree) {
    var selected = parseSelectedNodeKey();
    var path;
    var parentNode;
    var childNode;

    if (!selected || selected.slug !== line.slug) {
      return false;
    }

    path = line.paths[selected.pathIndex];
    parentNode = tree.nodesByKey[edge.from];
    childNode = tree.nodesByKey[edge.to];

    return Boolean(
      path &&
        parentNode &&
        childNode &&
        childNode.depth <= selected.stepIndex &&
        path[parentNode.depth] === parentNode.logicalName &&
        path[childNode.depth] === childNode.logicalName,
    );
  }

  function renderTreeChartInto(line, target, options) {
    var tree = buildTree(line);
    var nodeMarkup = "";
    var lineMarkup = "";
    var nodeIndex;
    var edgeIndex;
    var segmentMap = {};
    var showHeader = Boolean(options && options.showHeader);
    var availableWidth = options && options.availableWidth;

    target.innerHTML =
      (showHeader
        ? '<div class="tree-chart-block__header">' +
          '<button class="tree-chart-block__link card__label" type="button" data-tree-chart-id="' +
          escapeHtml(line.slug) +
          '" data-tree-group-jump="' +
          escapeHtml(line.slug) +
          '">' +
          escapeHtml(line.name) +
          "</button>" +
          '<p class="card__label">' +
          escapeHtml(String(line.paths.length) + " Paths") +
          "</p>" +
          "</div>"
        : "") +
      '<div class="tree-diagram-wrap">' +
      '<div class="tree-diagram-scale" data-tree-scale>' +
      '<div class="tree-stage-headings" data-tree-stage-headings></div>' +
      '<div class="tree-diagram" data-tree-diagram>' +
      '<svg class="tree-diagram__lines" data-tree-lines aria-hidden="true"></svg>' +
      '<div class="tree-diagram__nodes" data-tree-nodes></div>' +
      "</div>" +
      "</div>" +
      "</div>";

    function addSegment(x1, y1, x2, y2, isActive) {
      var startX = Math.min(x1, x2);
      var startY = Math.min(y1, y2);
      var endX = Math.max(x1, x2);
      var endY = Math.max(y1, y2);
      var key = [startX, startY, endX, endY].join(":");

      if (!segmentMap[key]) {
        segmentMap[key] = {
          x1: x1,
          y1: y1,
          x2: x2,
          y2: y2,
          isActive: Boolean(isActive),
        };
        return;
      }

      if (isActive) {
        segmentMap[key].isActive = true;
      }
    }

    var stageHeadings = target.querySelector("[data-tree-stage-headings]");
    var diagram = target.querySelector("[data-tree-diagram]");
    var diagramWrap = target.querySelector(".tree-diagram-wrap");
    var scaleLayer = target.querySelector("[data-tree-scale]");
    var lineSvg = target.querySelector("[data-tree-lines]");
    var nodesLayer = target.querySelector("[data-tree-nodes]");
    var compactConnectorLayout = false;

    renderStageHeadings(stageHeadings);
    layoutTree(tree, availableWidth || diagramWrap);
    compactConnectorLayout = (diagramWrap.clientWidth || availableWidth || tree.width) <= 640;

    diagram.style.width = tree.width + "px";
    diagram.style.height = tree.height + "px";
    stageHeadings.style.width = tree.width + "px";
    stageHeadings.style.gridTemplateColumns = "repeat(" + stageLabels.length + ", " + tree.columnWidth + "px)";
    stageHeadings.style.columnGap = tree.columnGap + "px";
    lineSvg.setAttribute("viewBox", "0 0 " + tree.width + " " + tree.height);
    scaleLayer.style.width = tree.width + "px";

    for (edgeIndex = 0; edgeIndex < tree.edges.length; edgeIndex += 1) {
      var edge = tree.edges[edgeIndex];
      var fromNode = tree.nodesByKey[edge.from];
      var toNode = tree.nodesByKey[edge.to];
      var startX = fromNode.layoutX + tree.nodeWidth;
      var startY = fromNode.layoutY;
      var endX = toNode.layoutX;
      var endY = toNode.layoutY;
      var connectorGap = endX - startX;
      var branchOffset = compactConnectorLayout
        ? connectorGap / 2
        : Math.min(22, Math.max(14, connectorGap / 2));
      var branchX = startX + Math.max(6, Math.min(connectorGap - 6, branchOffset));
      var isActive = isEdgeActive(edge, line, tree);

      addSegment(startX, startY, branchX, startY, isActive);
      addSegment(branchX, startY, branchX, endY, isActive);
      addSegment(branchX, endY, endX, endY, isActive);
    }

    Object.keys(segmentMap)
      .map(function (key) {
        return segmentMap[key];
      })
      .sort(function (left, right) {
        if (left.isActive === right.isActive) {
          return 0;
        }

        return left.isActive ? 1 : -1;
      })
      .forEach(function (segment) {
        lineMarkup +=
          '<line class="tree-connector' +
          (segment.isActive ? " is-active" : "") +
          '" x1="' +
          segment.x1 +
          '" y1="' +
          segment.y1 +
          '" x2="' +
          segment.x2 +
          '" y2="' +
          segment.y2 +
          '"></line>';
      });

    for (nodeIndex = 0; nodeIndex < tree.nodes.length; nodeIndex += 1) {
      var node = tree.nodes[nodeIndex];
      var active = isNodeActive(node, line);
      var selected = isNodeSelected(node, line);

      nodeMarkup +=
        '<button class="tree-node' +
        (active ? " is-in-path" : "") +
        (selected ? " is-selected" : "") +
        '" type="button" style="left:' +
        node.layoutX +
        "px;top:" +
        (node.layoutY - tree.nodeHeight / 2) +
        "px;width:" +
        tree.nodeWidth +
        "px;height:" +
        tree.nodeHeight +
        'px" data-tree-line="' +
        escapeHtml(line.slug) +
        '" data-tree-node-name="' +
        escapeHtml(node.name) +
        '" data-tree-node-logical="' +
        escapeHtml(node.logicalName) +
        '" data-tree-variant-base="' +
        escapeHtml(
          (line.slug === "demon-line" && isDemonVariantBase(node.logicalName)) ||
            (line.slug === "angel-line" && isAngelVariantBase(node.logicalName))
            ? node.logicalName
            : "",
        ) +
        '" data-tree-variant-option="' +
        ((line.slug === "demon-line" && demonVariantState.expandedBase === node.logicalName) ||
        (line.slug === "angel-line" && angelVariantState.expandedBase === node.logicalName)
          ? "true"
          : "false") +
        '" data-tree-node-step="' +
        node.depth +
        '">' +
        '<span class="tree-node__name">' +
        escapeHtml(node.label || node.name) +
        "</span>" +
        "</button>";
    }

    lineSvg.innerHTML = lineMarkup;
    nodesLayer.innerHTML = nodeMarkup;

    window.requestAnimationFrame(function () {
      var wrapWidth = diagramWrap.clientWidth || tree.width;
      var scale = Math.min(1, wrapWidth / tree.width);

      scaleLayer.style.setProperty("--tree-scale", scale);

      window.requestAnimationFrame(function () {
        var scaledRect = scaleLayer.getBoundingClientRect();
        diagramWrap.style.height = Math.ceil(scaledRect.height) + "px";
      });
    });
  }

  function renderSelectionPrompt(title, copy) {
    selectionTitle.textContent = title;
    selectionCopy.textContent = copy;

    if (selectionTraits) {
      selectionTraits.innerHTML = "";
    }

    if (textFormatter.apply) {
      textFormatter.apply(selectionTitle.parentNode);
    }
  }

  function formatSelectionTraitHtml(value) {
    if (textFormatter.formatBlockHtml) {
      return textFormatter.formatBlockHtml(value || "---");
    }

    return escapeHtml(value || "---");
  }

  function stripInheritedTraitSummary(value) {
    var lines = String(value || "")
      .replace(/\r\n/g, "\n")
      .replace(/\r/g, "\n")
      .split(/\\n|\/n|\n/g)
      .filter(function (line) {
        return !/^\s*-\s+\*\*Traits From /.test(line.trim());
      });

    return lines.join("\n").trim() || "---";
  }

  function renderSelectionTraitSummary(line, pathIndex, stepIndex) {
    var logicalPath;
    var path;
    var markup = "";
    var index;

    if (!selectionTraits) {
      return;
    }

    logicalPath = line.paths[pathIndex].slice(0, stepIndex + 1);
    path = getDisplayPath(line, pathIndex, stepIndex);

    markup += '<div class="tree-selection__trait-list">';

    for (index = 0; index < path.length; index += 1) {
      var monster =
        getMonster(line.slug, path[index]) ||
        getMonster(line.slug, logicalPath[index]) || {
          name: path[index],
          traits: "---",
        };

      markup +=
        '<div class="tree-selection__trait-copy" data-format-skip="true">' +
        formatSelectionTraitHtml(stripInheritedTraitSummary(monster.traits || "---")) +
        "</div>";
    }

    markup += "</div>";
    selectionTraits.innerHTML = markup;
  }

  function renderSelectionDetails(line, pathIndex, stepIndex) {
    var path = getDisplayPath(line, pathIndex, stepIndex);
    var title = path[path.length - 1];

    selectionTitle.textContent = title + " Path";
    selectionCopy.textContent = path.join(" -> ");
    renderSelectionTraitSummary(line, pathIndex, stepIndex);

    if (textFormatter.apply) {
      textFormatter.apply(selectionTitle.parentNode);
    }
  }

  function buildMonsterCardMarkup(monster) {
    if (monsterCardUtils.buildMonsterCardMarkup) {
      return monsterCardUtils.buildMonsterCardMarkup(monster);
    }

    return "";
  }

  function renderSelectedPathCards(line, pathIndex, stepIndex) {
    var logicalPath = line.paths[pathIndex].slice(0, stepIndex + 1);
    var path = getDisplayPath(line, pathIndex, stepIndex);
    var markup = '<div class="monster-card-grid">';
    var index;

    for (index = 0; index < path.length; index += 1) {
      var monster = getMonster(line.slug, path[index]) || getMonster(line.slug, logicalPath[index]) || {
        name: path[index],
        rarity: "---",
        commonality: "---",
        tags: [],
        origin: "---",
        description: "---",
      };

      markup += buildMonsterCardMarkup(monster);
    }

    markup += "</div>";
    selectionCards.dataset.mode = "path";
    selectionCards.innerHTML = markup;

    if (textFormatter.apply) {
      textFormatter.apply(selectionCards);
    }
  }

  function getLineMonsterOrder(line) {
    var order = {};
    var nextOrder = 0;

    line.paths.forEach(function (path) {
      path.forEach(function (name, depth) {
        if (!order[name]) {
          order[name] = {
            depth: depth,
            order: nextOrder,
          };
          nextOrder += 1;
        }
      });
    });

    return order;
  }

  function getOrderLookupName(line, monsterName) {
    if (line.slug === "demon-line") {
      if (/^Sin Demon of /.test(monsterName)) {
        return "Sin Demon";
      }

      if (/^Demon Lord of /.test(monsterName)) {
        return "Demon Lord";
      }
    }

    if (line.slug === "angel-line") {
      if (/^Virtue of /.test(monsterName)) {
        return "Virtue";
      }

      if (/^Principality of /.test(monsterName)) {
        return "Principality";
      }
    }

    return monsterName;
  }

  function buildLineMonsterIndexMarkup(line, includeHeader) {
    var detailLine = getLineDetails(line.slug);
    var orderMap = getLineMonsterOrder(line);
    var stageGroups = [[], [], [], []];
    var monsters;
    var markup = "";

    if (!detailLine) {
      return "";
    }

    monsters = detailLine.monsters.slice().sort(function (left, right) {
      var leftOrder = orderMap[getOrderLookupName(line, left.name)] || { depth: 99, order: 999 };
      var rightOrder = orderMap[getOrderLookupName(line, right.name)] || { depth: 99, order: 999 };

      if (leftOrder.depth !== rightOrder.depth) {
        return leftOrder.depth - rightOrder.depth;
      }

      if (leftOrder.order !== rightOrder.order) {
        return leftOrder.order - rightOrder.order;
      }

      return left.name.localeCompare(right.name);
    });

    monsters.forEach(function (monster) {
      var meta = orderMap[getOrderLookupName(line, monster.name)] || { depth: 0 };

      if (!stageGroups[meta.depth]) {
        stageGroups[meta.depth] = [];
      }

      stageGroups[meta.depth].push(monster);
    });

    if (includeHeader) {
      markup +=
        '<section class="tree-line-group" data-tree-group-id="' +
        escapeHtml(line.slug) +
        '">' +
        '<div class="tree-line-group__header">' +
        '<button class="tree-line-group__link card__label" type="button" data-tree-chart-jump="' +
        escapeHtml(line.slug) +
        '">' +
        escapeHtml(line.name) +
        "</button>" +
        "</div>";
    }

    stageGroups.forEach(function (group, depth) {
      var index;

      if (!group.length) {
        return;
      }

      markup +=
        '<div class="tree-line-group__stage-block">' +
        '<p class="tree-line-group__stage">' +
        escapeHtml(stageLabels[depth]) +
        "</p>" +
        '<div class="monster-card-grid">';

      for (index = 0; index < group.length; index += 1) {
        markup += buildMonsterCardMarkup(group[index]);
      }

      markup += "</div></div>";
    });

    if (includeHeader) {
      markup += "</section>";
    }

    return markup;
  }

  function renderAllMonsterIndex() {
    var markup = "";

    if (!allMonstersMarkup) {
      treeData.forEach(function (line) {
        markup += buildLineMonsterIndexMarkup(line, true);
      });

      allMonstersMarkup = markup;
    }

    if (selectionCards.dataset.mode !== "all") {
      selectionCards.dataset.mode = "all";
      selectionCards.innerHTML = allMonstersMarkup;
    }

    if (textFormatter.apply) {
      textFormatter.apply(selectionCards);
    }
  }

  function clearSelectedCards() {
    selectionCards.dataset.mode = "empty";
    selectionCards.innerHTML = "";
  }

  function renderAllView() {
    var selected = parseSelectedNodeKey();
    var selectedLine = selected ? getLine(selected.slug) : null;
    var stack = document.createElement("div");
    var sharedChartWidth = chartContent.clientWidth || chartContent.offsetWidth || 0;

    currentLineSlug = allViewSlug;
    if (treeWorkspace) {
      treeWorkspace.classList.add("is-all-view");
    }
    updateActiveLinks(allViewSlug);
    chartTitle.textContent = "All Lines";
    chartCount.textContent = treeData.length + " Lines";
    chartContent.innerHTML = "";
    stack.className = "tree-chart-stack";

    treeData.forEach(function (line) {
      var block = document.createElement("section");

      block.className = "tree-chart-block";
      renderTreeChartInto(line, block, { showHeader: true, availableWidth: sharedChartWidth });
      stack.appendChild(block);
    });

    chartContent.appendChild(stack);

    if (selected && selectedLine) {
      renderSelectionDetails(selectedLine, selected.pathIndex, selected.stepIndex);
    } else {
      renderSelectionPrompt("All Lines", "Click any node on any tree to load that branch up to the selected stage.");
    }

    renderAllMonsterIndex();

    if (textFormatter.apply) {
      textFormatter.apply(treeWorkspace || document.body);
    }
  }

  function renderSingleLineView(line) {
    var selected = parseSelectedNodeKey();
    var sharedChartWidth = chartContent.clientWidth || chartContent.offsetWidth || 0;

    currentLineSlug = line.slug;
    if (treeWorkspace) {
      treeWorkspace.classList.remove("is-all-view");
    }
    updateActiveLinks(line.slug);
    chartTitle.textContent = line.name;
    chartCount.textContent = line.paths.length + " Paths";
    renderTreeChartInto(line, chartContent, { showHeader: false, availableWidth: sharedChartWidth });

    if (!selected || selected.slug !== line.slug) {
      renderSelectionPrompt(line.name, "Click any node on the tree to load that branch up to the selected stage.");
      selectionCards.dataset.mode = "line";
      selectionCards.innerHTML = buildLineMonsterIndexMarkup(line, false);
      if (textFormatter.apply) {
        textFormatter.apply(treeWorkspace || document.body);
      }
      return;
    }

    renderSelectionDetails(line, selected.pathIndex, selected.stepIndex);
    renderSelectedPathCards(line, selected.pathIndex, selected.stepIndex);

    if (textFormatter.apply) {
      textFormatter.apply(treeWorkspace || document.body);
    }
  }

  function renderCurrentView() {
    var line = getLine(currentLineSlug);

    if (currentLineSlug === allViewSlug || !line) {
      renderAllView();
      restoreQueuedFocus();
      restoreQueuedScroll();
      return;
    }

    renderSingleLineView(line);
    restoreQueuedFocus();
    restoreQueuedScroll();
  }

  function setLine(slug) {
    selectedNodeKey = "";
    currentLineSlug = slug;
    demonVariantState.expandedBase = "";
    angelVariantState.expandedBase = "";
    renderCurrentView();

    if (window.location.hash !== "#" + slug) {
      if (window.history && typeof window.history.replaceState === "function") {
        window.history.replaceState(null, "", "#" + slug);
      } else {
        window.location.hash = slug;
      }
    }
  }

  function syncFromHash() {
    var hash = window.location.hash.replace("#", "");
    var line = getLine(hash);
    var requestedMonster = getRequestedMonsterName();

    selectedNodeKey = "";
    demonVariantState.expandedBase = "";
    angelVariantState.expandedBase = "";

    if (hash === allViewSlug || !hash) {
      if (requestedMonster) {
        line = findLineForMonster(requestedMonster);

        if (line) {
          currentLineSlug = line.slug;
          selectedNodeKey = findSelectionForMonster(line, requestedMonster);
          renderSingleLineView(line);
          return;
        }
      }

      currentLineSlug = allViewSlug;
      renderAllView();
      return;
    }

    if (line) {
      currentLineSlug = line.slug;
      if (requestedMonster) {
        selectedNodeKey = findSelectionForMonster(line, requestedMonster);
      }
      renderSingleLineView(line);
      return;
    }

    currentLineSlug = allViewSlug;
    renderAllView();
  }

  function bindLineLinks(collection, dataKey) {
    var index;

    for (index = 0; index < collection.length; index += 1) {
      collection[index].addEventListener("mousedown", function (event) {
        if (event.button === 0) {
          event.preventDefault();
        }
      });

      collection[index].addEventListener("click", function (event) {
        event.preventDefault();
        queueScrollRestore();
        queueFocusRestoreFromElement(this);
        setLine(this.dataset[dataKey]);
      });
    }
  }

  bindLineLinks(lineButtons, "treeLineTarget");
  bindLineLinks(sidebarLinks, "treeSidebarTarget");

  chartContent.addEventListener("mousedown", function (event) {
    var trigger;

    if (event.button !== 0) {
      return;
    }

    trigger = event.target.closest("[data-tree-node-name], [data-tree-group-jump]");

    if (trigger) {
      event.preventDefault();
    }
  });

  selectionCards.addEventListener("click", function (event) {
    var trigger = event.target.closest("[data-tree-chart-jump]");
    var targetChart;

    if (!trigger) {
      return;
    }

    event.preventDefault();
    targetChart = chartContent.querySelector('[data-tree-chart-id="' + trigger.dataset.treeChartJump + '"]');

    if (targetChart) {
      targetChart.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  });

  chartContent.addEventListener("click", function (event) {
    var jumpTrigger = event.target.closest("[data-tree-group-jump]");
    var trigger = event.target.closest("[data-tree-node-name]");
    var line;
    var stepIndex;
    var pathIndex;
    var nextSelectionKey;
    var targetGroup;
    var logicalName;
    var variantBase;
    var variantOption;
    var pairedVariant;

    if (jumpTrigger) {
      event.preventDefault();
      targetGroup = selectionCards.querySelector('[data-tree-group-id="' + jumpTrigger.dataset.treeGroupJump + '"]');

      if (targetGroup) {
        targetGroup.scrollIntoView({ behavior: "smooth", block: "start" });
      }

      return;
    }

    if (!trigger) {
      return;
    }

    event.preventDefault();
    queueScrollRestore();
    queueFocusRestoreFromElement(trigger);

    line = getLine(trigger.dataset.treeLine);

    if (!line) {
      return;
    }

    stepIndex = Number(trigger.dataset.treeNodeStep);
    logicalName = trigger.dataset.treeNodeLogical || trigger.dataset.treeNodeName;
    variantBase = trigger.dataset.treeVariantBase || "";
    variantOption = trigger.dataset.treeVariantOption === "true";

    if (line.slug === "demon-line" && variantBase) {
      if (variantOption) {
        demonVariantState.selectedByBase[variantBase] = trigger.dataset.treeNodeName;

        if (variantBase === "Sin Demon") {
          pairedVariant = getMatchingVariant("Demon Lord", trigger.dataset.treeNodeName);
          demonVariantState.selectedByBase["Demon Lord"] = pairedVariant;
        }

        if (variantBase === "Demon Lord") {
          demonVariantState.selectedByBase["Sin Demon"] =
            getMatchingVariant("Sin Demon", trigger.dataset.treeNodeName);
        }

        demonVariantState.expandedBase = "";
      } else if (trigger.dataset.treeNodeName === variantBase) {
        demonVariantState.expandedBase =
          demonVariantState.expandedBase === variantBase ? "" : variantBase;
        renderCurrentView();
        return;
      }
    }

    if (line.slug === "angel-line" && variantBase) {
      if (variantOption) {
        angelVariantState.selectedByBase[variantBase] = trigger.dataset.treeNodeName;

        if (variantBase === "Virtue") {
          pairedVariant = getMatchingVariant("Principality", trigger.dataset.treeNodeName);
          angelVariantState.selectedByBase.Principality = pairedVariant;
        }

        if (variantBase === "Principality") {
          angelVariantState.selectedByBase.Virtue =
            getMatchingVariant("Virtue", trigger.dataset.treeNodeName);
        }

        angelVariantState.expandedBase = "";
      } else if (trigger.dataset.treeNodeName === variantBase) {
        angelVariantState.expandedBase =
          angelVariantState.expandedBase === variantBase ? "" : variantBase;
        renderCurrentView();
        return;
      }
    }

    pathIndex = getResolvedPathIndex(line, trigger.dataset.treeNodeName, stepIndex, logicalName);

    if (pathIndex === -1) {
      return;
    }

    nextSelectionKey = line.slug + ":" + pathIndex + ":" + stepIndex;

    if (
      line.slug === "demon-line" &&
      variantBase &&
      !variantOption &&
      trigger.dataset.treeNodeName === getDemonVariantSelection(variantBase) &&
      selectedNodeKey === nextSelectionKey
    ) {
      demonVariantState.expandedBase = variantBase;
      renderCurrentView();
      return;
    }

    if (
      line.slug === "angel-line" &&
      variantBase &&
      !variantOption &&
      trigger.dataset.treeNodeName === getAngelVariantSelection(variantBase) &&
      selectedNodeKey === nextSelectionKey
    ) {
      angelVariantState.expandedBase = variantBase;
      renderCurrentView();
      return;
    }

    if (selectedNodeKey === nextSelectionKey) {
      selectedNodeKey = "";
      renderCurrentView();
      return;
    }

    selectedNodeKey = nextSelectionKey;
    renderCurrentView();
  });

  window.addEventListener("hashchange", syncFromHash);
  window.addEventListener("resize", function () {
    if (!currentLineSlug) {
      return;
    }

    if (resizeFrame) {
      window.cancelAnimationFrame(resizeFrame);
    }

    resizeFrame = window.requestAnimationFrame(function () {
      renderCurrentView();
    });
  });

  syncFromHash();
})();
