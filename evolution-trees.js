(function () {
  var treeData = window.evolutionTreeData || [];
  var monsterGuideData = window.monsterGuideData || [];
  var allViewSlug = "all";
  var stageLabels = ["Origin", "First Stage", "Second Stage", "Third Stage"];
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
  var monsterCardUtils = window.monsterCardUtils || {};
  var textFormatter = window.siteTextFormatter || {};
  var resizeFrame = 0;
  var currentLineSlug = allViewSlug;
  var selectedNodeKey = "";
  var allViewRoot = null;
  var allViewContexts = {};
  var singleViewRoot = null;
  var singleViewContext = null;
  var allMonstersMarkup = "";
  var lineMonsterIndexMarkupCache = {};
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
  var lineDetailsBySlug = {};
  var monsterLookupBySlug = {};

  if (!chartContent || !selectionTitle || !selectionCopy || !selectionCards) {
    return;
  }

  monsterGuideData.forEach(function (line) {
    var lookup = {};

    lineDetailsBySlug[line.slug] = line;
    (line.monsters || []).forEach(function (monster) {
      lookup[monster.name] = monster;
    });
    monsterLookupBySlug[line.slug] = lookup;
  });

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

  function parseNodeKey(value) {
    var parts;

    if (!value) {
      return null;
    }

    parts = String(value).split(":");

    return {
      slug: parts[0],
      pathIndex: Number(parts[1]),
      stepIndex: Number(parts[2]),
    };
  }

  function getSelectedNode() {
    return parseNodeKey(selectedNodeKey);
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

  function getLineDetails(slug) {
    return lineDetailsBySlug[slug] || null;
  }

  function getMonster(slug, name) {
    var lookup = monsterLookupBySlug[slug] || {};
    return lookup[name] || null;
  }

  function getRequestedMonsterName() {
    return new URLSearchParams(window.location.search).get("monster") || "";
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

  function isDemonVariantBase(name) {
    return Boolean(demonVariantOptions[name]);
  }

  function isAngelVariantBase(name) {
    return Boolean(angelVariantOptions[name]);
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
      return demonVariantState.selectedByBase[logicalName] || logicalName;
    }

    if (lineSlug === "angel-line" && isAngelVariantBase(logicalName)) {
      return angelVariantState.selectedByBase[logicalName] || logicalName;
    }

    return logicalName;
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

  function getDisplayPath(line, pathIndex, stepIndex) {
    return line.paths[pathIndex].slice(0, stepIndex + 1).map(function (name) {
      return getDisplayNameForNode(line.slug, name);
    });
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
            demonVariantState.selectedByBase["Sin Demon"] || "Sin Demon",
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
            angelVariantState.selectedByBase.Virtue || "Virtue",
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

  function renderStageHeadings(target) {
    target.innerHTML = stageLabels
      .map(function (label) {
        return "<span>" + escapeHtml(label) + "</span>";
      })
      .join("");
  }

  function buildTree(line) {
    var nodesByKey = {};
    var nodes = [];
    var edges = [];

    getDisplayPaths(line).forEach(function (displayPath) {
      var previousNode = null;

      displayPath.names.forEach(function (name, stepIndex) {
        var logicalName = displayPath.logical[stepIndex];
        var key = stepIndex + "::" + name;
        var node = nodesByKey[key];

        if (!node) {
          node = {
            key: key,
            name: name,
            logicalName: logicalName,
            label: getNodeLabel(line.slug, logicalName, name),
            depth: stepIndex,
            parents: [],
            children: [],
            pathIndices: [],
            firstPathIndex: displayPath.pathIndex,
            firstSeenOrder: nodes.length,
            layoutX: 0,
            layoutY: 0,
          };
          nodesByKey[key] = node;
          nodes.push(node);
        }

        node.pathIndices.push(displayPath.pathIndex);

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
          }

          edge.pathIndices.push(displayPath.pathIndex);
        }

        previousNode = node;
      });
    });

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
    var nodeHeight = 46;
    var rowGap = 9;
    var topPadding = 10;
    var nodesByDepth = {};
    var maxRows = 1;

    tree.nodes.forEach(function (node) {
      if (!nodesByDepth[node.depth]) {
        nodesByDepth[node.depth] = [];
      }

      nodesByDepth[node.depth].push(node);
    });

    Object.keys(nodesByDepth).forEach(function (depthKey) {
      maxRows = Math.max(maxRows, nodesByDepth[depthKey].length);
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

    Object.keys(nodesByDepth).forEach(function (depthKey) {
      var depth = Number(depthKey);
      var depthNodes = nodesByDepth[depth] || [];
      var totalBlockHeight = depthNodes.length * nodeHeight + Math.max(0, depthNodes.length - 1) * rowGap;
      var availableBlockHeight = maxRows * nodeHeight + Math.max(0, maxRows - 1) * rowGap;
      var startOffset = topPadding + Math.max(0, (availableBlockHeight - totalBlockHeight) / 2);

      sortByPathAverage(depthNodes);

      depthNodes.forEach(function (node, index) {
        node.layoutY = startOffset + index * (nodeHeight + rowGap) + nodeHeight / 2;
      });
    });

    tree.nodes.forEach(function (node) {
      node.layoutX = leftPadding + node.depth * (nodeWidth + columnGap);
    });

    tree.width = leftPadding * 2 + stageLabels.length * nodeWidth + (stageLabels.length - 1) * columnGap;
    tree.height = topPadding * 2 + maxRows * nodeHeight + Math.max(0, maxRows - 1) * rowGap;
    tree.nodeWidth = nodeWidth;
    tree.nodeHeight = nodeHeight;
    tree.columnGap = columnGap;
  }

  function isNodeActive(node, line) {
    var selected = getSelectedNode();
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
    var selected = getSelectedNode();
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

  function isEdgeActive(edge, line, tree) {
    var selected = getSelectedNode();
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

  function getResolvedPathIndex(line, nodeName, stepIndex, logicalName) {
    var candidatePathIndices = [];
    var selected = getSelectedNode();
    var bestPathIndex = -1;
    var bestScore = -1;

    line.paths.forEach(function (path, index) {
      if (path[stepIndex] === (logicalName || nodeName)) {
        candidatePathIndices.push(index);
      }
    });

    if (!candidatePathIndices.length) {
      return -1;
    }

    if (!selected || selected.slug !== line.slug) {
      return candidatePathIndices[0];
    }

    candidatePathIndices.forEach(function (candidateIndex) {
      var candidatePath = line.paths[candidateIndex];
      var selectedPath = line.paths[selected.pathIndex];
      var compareDepth = Math.min(stepIndex, selected.stepIndex);
      var score = 0;
      var compareIndex;

      for (compareIndex = 0; compareIndex <= compareDepth; compareIndex += 1) {
        if (candidatePath[compareIndex] !== selectedPath[compareIndex]) {
          break;
        }

        score += 1;
      }

      if (score > bestScore || (score === bestScore && bestPathIndex !== -1 && candidateIndex < bestPathIndex)) {
        bestScore = score;
        bestPathIndex = candidateIndex;
      }
    });

    return bestPathIndex === -1 ? candidatePathIndices[0] : bestPathIndex;
  }

  function createChartContext(line, target, options) {
    var showHeader = Boolean(options && options.showHeader);

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

    return {
      line: line,
      target: target,
      showHeader: showHeader,
      scaleLayer: target.querySelector("[data-tree-scale]"),
      stageHeadings: target.querySelector("[data-tree-stage-headings]"),
      diagramWrap: target.querySelector(".tree-diagram-wrap"),
      diagram: target.querySelector("[data-tree-diagram]"),
      lineSvg: target.querySelector("[data-tree-lines]"),
      nodesLayer: target.querySelector("[data-tree-nodes]"),
      tree: null,
      nodeButtons: [],
      edgeElements: [],
    };
  }

  function renderChartContext(context, availableWidth) {
    var tree = buildTree(context.line);
    var lineMarkup = "";
    var nodeMarkup = "";
    var segmentMap = {};

    context.line = context.line;
    renderStageHeadings(context.stageHeadings);
    layoutTree(tree, availableWidth || context.diagramWrap);

    function addSegment(x1, y1, x2, y2) {
      var key = [Math.min(x1, x2), Math.min(y1, y2), Math.max(x1, x2), Math.max(y1, y2)].join(":");

      if (!segmentMap[key]) {
        segmentMap[key] = {
          x1: x1,
          y1: y1,
          x2: x2,
          y2: y2,
        };
      }
    }

    tree.edges.forEach(function (edge) {
      var fromNode = tree.nodesByKey[edge.from];
      var toNode = tree.nodesByKey[edge.to];
      var startX = fromNode.layoutX + tree.nodeWidth;
      var startY = fromNode.layoutY;
      var endX = toNode.layoutX;
      var endY = toNode.layoutY;
      var connectorGap = endX - startX;
      var compactLayout = (context.diagramWrap.clientWidth || availableWidth || tree.width) <= 640;
      var branchOffset = compactLayout
        ? connectorGap / 2
        : Math.min(22, Math.max(14, connectorGap / 2));
      var branchX = startX + Math.max(6, Math.min(connectorGap - 6, branchOffset));

      addSegment(startX, startY, branchX, startY);
      addSegment(branchX, startY, branchX, endY);
      addSegment(branchX, endY, endX, endY);
    });

    Object.keys(segmentMap).forEach(function (key) {
      var segment = segmentMap[key];
      lineMarkup +=
        '<line class="tree-connector" data-edge-key="' +
        escapeHtml(key) +
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

    tree.nodes.forEach(function (node) {
      var variantBase =
        (context.line.slug === "demon-line" && isDemonVariantBase(node.logicalName)) ||
        (context.line.slug === "angel-line" && isAngelVariantBase(node.logicalName))
          ? node.logicalName
          : "";
      var variantOption =
        (context.line.slug === "demon-line" && demonVariantState.expandedBase === node.logicalName) ||
        (context.line.slug === "angel-line" && angelVariantState.expandedBase === node.logicalName);

      nodeMarkup +=
        '<button class="tree-node" type="button" style="left:' +
        node.layoutX +
        "px;top:" +
        (node.layoutY - tree.nodeHeight / 2) +
        "px;width:" +
        tree.nodeWidth +
        "px;height:" +
        tree.nodeHeight +
        'px" data-tree-line="' +
        escapeHtml(context.line.slug) +
        '" data-tree-node-key="' +
        escapeHtml(node.key) +
        '" data-tree-node-name="' +
        escapeHtml(node.name) +
        '" data-tree-node-logical="' +
        escapeHtml(node.logicalName) +
        '" data-tree-variant-base="' +
        escapeHtml(variantBase) +
        '" data-tree-variant-option="' +
        (variantOption ? "true" : "false") +
        '" data-tree-node-step="' +
        node.depth +
        '">' +
        '<span class="tree-node__name">' +
        escapeHtml(node.label || node.name) +
        "</span>" +
        "</button>";
    });

    context.tree = tree;
    context.diagram.style.width = tree.width + "px";
    context.diagram.style.height = tree.height + "px";
    context.stageHeadings.style.width = tree.width + "px";
    context.stageHeadings.style.gridTemplateColumns = "repeat(" + stageLabels.length + ", " + tree.nodeWidth + "px)";
    context.stageHeadings.style.columnGap = tree.columnGap + "px";
    context.scaleLayer.style.width = tree.width + "px";
    context.lineSvg.setAttribute("viewBox", "0 0 " + tree.width + " " + tree.height);
    context.lineSvg.innerHTML = lineMarkup;
    context.nodesLayer.innerHTML = nodeMarkup;
    context.nodeButtons = Array.prototype.slice.call(context.nodesLayer.querySelectorAll(".tree-node"));
    context.edgeElements = Array.prototype.slice.call(context.lineSvg.querySelectorAll(".tree-connector"));
    applySelectionStateToChart(context);

    window.requestAnimationFrame(function () {
      var wrapWidth = context.diagramWrap.clientWidth || tree.width;
      var scale = Math.min(1, wrapWidth / tree.width);

      context.scaleLayer.style.setProperty("--tree-scale", scale);

      window.requestAnimationFrame(function () {
        var scaledRect = context.scaleLayer.getBoundingClientRect();
        context.diagramWrap.style.height = Math.ceil(scaledRect.height) + "px";
      });
    });
  }

  function applySelectionStateToChart(context) {
    if (!context || !context.tree) {
      return;
    }

    context.nodeButtons.forEach(function (button) {
      var node = context.tree.nodesByKey[button.dataset.treeNodeKey];

      button.classList.toggle("is-in-path", Boolean(node && isNodeActive(node, context.line)));
      button.classList.toggle("is-selected", Boolean(node && isNodeSelected(node, context.line)));
    });

    context.edgeElements.forEach(function (lineElement) {
      var edgeKey = lineElement.dataset.edgeKey || "";
      var parts = edgeKey.split(":");
      var segment = {
        from: null,
        to: null,
      };
      var matchingEdge = null;

      if (parts.length < 4) {
        lineElement.classList.remove("is-active");
        return;
      }

      context.tree.edges.some(function (edge) {
        var fromNode = context.tree.nodesByKey[edge.from];
        var toNode = context.tree.nodesByKey[edge.to];
        var startX = fromNode.layoutX + context.tree.nodeWidth;
        var startY = fromNode.layoutY;
        var endX = toNode.layoutX;
        var endY = toNode.layoutY;
        var connectorGap = endX - startX;
        var compactLayout = (context.diagramWrap.clientWidth || context.tree.width) <= 640;
        var branchOffset = compactLayout
          ? connectorGap / 2
          : Math.min(22, Math.max(14, connectorGap / 2));
        var branchX = startX + Math.max(6, Math.min(connectorGap - 6, branchOffset));
        var edgeSegments = [
          [Math.min(startX, branchX), Math.min(startY, startY), Math.max(startX, branchX), Math.max(startY, startY)],
          [Math.min(branchX, branchX), Math.min(startY, endY), Math.max(branchX, branchX), Math.max(startY, endY)],
          [Math.min(branchX, endX), Math.min(endY, endY), Math.max(branchX, endX), Math.max(endY, endY)],
        ];

        return edgeSegments.some(function (segmentValues) {
          var key = segmentValues.join(":");

          if (key === edgeKey) {
            matchingEdge = edge;
            return true;
          }

          return false;
        });
      });

      lineElement.classList.toggle("is-active", Boolean(matchingEdge && isEdgeActive(matchingEdge, context.line, context.tree)));
    });
  }

  function getCurrentChartWidth() {
    return chartContent.clientWidth || chartContent.offsetWidth || 0;
  }

  function ensureAllViewRoot() {
    if (allViewRoot) {
      return;
    }

    allViewRoot = document.createElement("div");
    allViewRoot.className = "tree-chart-stack";
    allViewContexts = {};

    treeData.forEach(function (line) {
      var block = document.createElement("section");
      var context;

      block.className = "tree-chart-block";
      block.setAttribute("data-tree-chart-block", line.slug);
      allViewRoot.appendChild(block);
      context = createChartContext(line, block, { showHeader: true });
      allViewContexts[line.slug] = context;
    });
  }

  function renderAllViewCharts() {
    var width = getCurrentChartWidth();

    ensureAllViewRoot();
    Object.keys(allViewContexts).forEach(function (slug) {
      renderChartContext(allViewContexts[slug], width);
    });
  }

  function ensureSingleViewRoot() {
    if (!singleViewRoot) {
      singleViewRoot = document.createElement("section");
      singleViewRoot.className = "tree-chart-block";
    }
  }

  function renderSingleViewChart(line) {
    var width = getCurrentChartWidth();

    ensureSingleViewRoot();
    if (!singleViewContext) {
      singleViewContext = createChartContext(line, singleViewRoot, { showHeader: false });
    } else {
      singleViewContext.line = line;
    }
    renderChartContext(singleViewContext, width);
  }

  function updateVisibleChartSelection(previousSelectionKey) {
    var previous = parseNodeKey(previousSelectionKey);
    var current = getSelectedNode();
    var slugs = {};

    if (currentLineSlug === allViewSlug) {
      if (previous && previous.slug) {
        slugs[previous.slug] = true;
      }

      if (current && current.slug) {
        slugs[current.slug] = true;
      }

      Object.keys(slugs).forEach(function (slug) {
        if (allViewContexts[slug]) {
          applySelectionStateToChart(allViewContexts[slug]);
        }
      });
      return;
    }

    if (singleViewContext) {
      applySelectionStateToChart(singleViewContext);
    }
  }

  function rerenderVisibleLine(slug) {
    var width = getCurrentChartWidth();

    if (currentLineSlug === allViewSlug) {
      if (allViewContexts[slug]) {
        renderChartContext(allViewContexts[slug], width);
      }
      return;
    }

    if (singleViewContext && singleViewContext.line.slug === slug) {
      renderChartContext(singleViewContext, width);
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

  function renderSelectionTraitSummary(line, pathIndex, stepIndex) {
    var logicalPath;
    var path;
    var markup = "";

    if (!selectionTraits) {
      return;
    }

    logicalPath = line.paths[pathIndex].slice(0, stepIndex + 1);
    path = getDisplayPath(line, pathIndex, stepIndex);
    markup += '<div class="tree-selection__trait-list">';

    path.forEach(function (name, index) {
      var monster =
        getMonster(line.slug, name) ||
        getMonster(line.slug, logicalPath[index]) || {
          name: name,
          traits: "---",
        };

      markup +=
        '<div class="tree-selection__trait-copy" data-format-skip="true">' +
        formatSelectionTraitHtml(stripInheritedTraitSummary(monster.traits || "---")) +
        "</div>";
    });

    markup += "</div>";
    selectionTraits.innerHTML = markup;
  }

  function renderSelectionDetails(line, pathIndex, stepIndex) {
    var path = getDisplayPath(line, pathIndex, stepIndex);

    selectionTitle.textContent = path[path.length - 1] + " Path";
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
    var mode = "path:" + line.slug + ":" + pathIndex + ":" + stepIndex;

    if (selectionCards.dataset.mode === mode) {
      return;
    }

    path.forEach(function (name, index) {
      var monster = getMonster(line.slug, name) || getMonster(line.slug, logicalPath[index]) || {
        name: name,
        rarity: "---",
        commonality: "---",
        tags: [],
        origin: "---",
        description: "---",
      };

      markup += buildMonsterCardMarkup(monster);
    });

    markup += "</div>";
    selectionCards.dataset.mode = mode;
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
    var markup = "";

    if (!detailLine) {
      return "";
    }

    detailLine.monsters
      .slice()
      .sort(function (left, right) {
        var leftOrder = orderMap[getOrderLookupName(line, left.name)] || { depth: 99, order: 999 };
        var rightOrder = orderMap[getOrderLookupName(line, right.name)] || { depth: 99, order: 999 };

        if (leftOrder.depth !== rightOrder.depth) {
          return leftOrder.depth - rightOrder.depth;
        }

        if (leftOrder.order !== rightOrder.order) {
          return leftOrder.order - rightOrder.order;
        }

        return left.name.localeCompare(right.name);
      })
      .forEach(function (monster) {
        var meta = orderMap[getOrderLookupName(line, monster.name)] || { depth: 0 };

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
      if (!group.length) {
        return;
      }

      markup +=
        '<div class="tree-line-group__stage-block">' +
        '<p class="tree-line-group__stage">' +
        escapeHtml(stageLabels[depth]) +
        "</p>" +
        '<div class="monster-card-grid">';

      group.forEach(function (monster) {
        markup += buildMonsterCardMarkup(monster);
      });

      markup += "</div></div>";
    });

    if (includeHeader) {
      markup += "</section>";
    }

    return markup;
  }

  function renderAllMonsterIndex() {
    if (!allMonstersMarkup) {
      treeData.forEach(function (line) {
        allMonstersMarkup += buildLineMonsterIndexMarkup(line, true);
      });
    }

    if (selectionCards.dataset.mode === "all") {
      return;
    }

    selectionCards.dataset.mode = "all";
    selectionCards.innerHTML = allMonstersMarkup;

    if (textFormatter.apply) {
      textFormatter.apply(selectionCards);
    }
  }

  function renderSingleLineMonsterIndex(line) {
    var mode = "line:" + line.slug;
    var markup = lineMonsterIndexMarkupCache[line.slug];

    if (!markup) {
      markup = buildLineMonsterIndexMarkup(line, false);
      lineMonsterIndexMarkupCache[line.slug] = markup;
    }

    if (selectionCards.dataset.mode === mode) {
      return;
    }

    selectionCards.dataset.mode = mode;
    selectionCards.innerHTML = markup;

    if (textFormatter.apply) {
      textFormatter.apply(selectionCards);
    }
  }

  function updateSelectionPanelAndCards() {
    var selected = getSelectedNode();
    var line = getLine(currentLineSlug);

    if (currentLineSlug === allViewSlug || !line) {
      if (selected && getLine(selected.slug)) {
        renderSelectionDetails(getLine(selected.slug), selected.pathIndex, selected.stepIndex);
      } else {
        renderSelectionPrompt("All Lines", "Click any node on any tree to load that branch up to the selected stage.");
      }
      renderAllMonsterIndex();
      return;
    }

    if (!selected || selected.slug !== line.slug) {
      renderSelectionPrompt(line.name, "Click any node on the tree to load that branch up to the selected stage.");
      renderSingleLineMonsterIndex(line);
      return;
    }

    renderSelectionDetails(line, selected.pathIndex, selected.stepIndex);
    renderSelectedPathCards(line, selected.pathIndex, selected.stepIndex);
  }

  function showAllView() {
    currentLineSlug = allViewSlug;
    if (treeWorkspace) {
      treeWorkspace.classList.add("is-all-view");
    }
    updateActiveLinks(allViewSlug);
    chartTitle.textContent = "All Lines";
    chartCount.textContent = treeData.length + " Lines";
    ensureAllViewRoot();
    if (chartContent.firstChild !== allViewRoot) {
      chartContent.innerHTML = "";
      chartContent.appendChild(allViewRoot);
    }
    renderAllViewCharts();
    updateSelectionPanelAndCards();
  }

  function showSingleLine(line) {
    currentLineSlug = line.slug;
    if (treeWorkspace) {
      treeWorkspace.classList.remove("is-all-view");
    }
    updateActiveLinks(line.slug);
    chartTitle.textContent = line.name;
    chartCount.textContent = line.paths.length + " Paths";
    ensureSingleViewRoot();
    if (chartContent.firstChild !== singleViewRoot) {
      chartContent.innerHTML = "";
      chartContent.appendChild(singleViewRoot);
    }
    renderSingleViewChart(line);
    updateSelectionPanelAndCards();
  }

  function renderVisibleView() {
    var line = getLine(currentLineSlug);

    if (currentLineSlug === allViewSlug || !line) {
      showAllView();
      return;
    }

    showSingleLine(line);
  }

  function setLine(slug) {
    selectedNodeKey = "";
    demonVariantState.expandedBase = "";
    angelVariantState.expandedBase = "";
    currentLineSlug = slug;
    renderVisibleView();

    if (window.location.hash !== "#" + slug) {
      if (window.history && typeof window.history.replaceState === "function") {
        window.history.replaceState(null, "", "#" + slug);
      } else {
        window.location.hash = slug;
      }
    }
  }

  function syncFromLocation() {
    var hash = window.location.hash.replace("#", "");
    var requestedMonster = getRequestedMonsterName();
    var line = getLine(hash);

    selectedNodeKey = "";
    demonVariantState.expandedBase = "";
    angelVariantState.expandedBase = "";

    if ((!hash || hash === allViewSlug) && requestedMonster) {
      line = findLineForMonster(requestedMonster);
      if (line) {
        currentLineSlug = line.slug;
        selectedNodeKey = findSelectionForMonster(line, requestedMonster);
        showSingleLine(line);
        return;
      }
    }

    if (line) {
      currentLineSlug = line.slug;
      if (requestedMonster) {
        selectedNodeKey = findSelectionForMonster(line, requestedMonster);
      }
      showSingleLine(line);
      return;
    }

    currentLineSlug = allViewSlug;
    showAllView();
  }

  function bindLineLinks(collection, dataKey) {
    var index;

    for (index = 0; index < collection.length; index += 1) {
      collection[index].addEventListener("click", function (event) {
        event.preventDefault();
        setLine(this.dataset[dataKey]);
      });
    }
  }

  function handleSelectionCardsClick(event) {
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
  }

  function handleChartClick(event) {
    var jumpTrigger = event.target.closest("[data-tree-group-jump]");
    var trigger = event.target.closest("[data-tree-node-name]");
    var line;
    var stepIndex;
    var pathIndex;
    var nextSelectionKey;
    var logicalName;
    var variantBase;
    var variantOption;
    var pairedVariant;
    var previousSelectionKey = selectedNodeKey;
    var targetGroup;

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
          demonVariantState.selectedByBase["Sin Demon"] = getMatchingVariant("Sin Demon", trigger.dataset.treeNodeName);
        }

        demonVariantState.expandedBase = "";
        rerenderVisibleLine(line.slug);
      } else if (trigger.dataset.treeNodeName === variantBase) {
        demonVariantState.expandedBase = demonVariantState.expandedBase === variantBase ? "" : variantBase;
        rerenderVisibleLine(line.slug);
        updateSelectionPanelAndCards();
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
          angelVariantState.selectedByBase.Virtue = getMatchingVariant("Virtue", trigger.dataset.treeNodeName);
        }

        angelVariantState.expandedBase = "";
        rerenderVisibleLine(line.slug);
      } else if (trigger.dataset.treeNodeName === variantBase) {
        angelVariantState.expandedBase = angelVariantState.expandedBase === variantBase ? "" : variantBase;
        rerenderVisibleLine(line.slug);
        updateSelectionPanelAndCards();
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
      trigger.dataset.treeNodeName === getDisplayNameForNode(line.slug, variantBase) &&
      selectedNodeKey === nextSelectionKey
    ) {
      demonVariantState.expandedBase = variantBase;
      rerenderVisibleLine(line.slug);
      updateSelectionPanelAndCards();
      return;
    }

    if (
      line.slug === "angel-line" &&
      variantBase &&
      !variantOption &&
      trigger.dataset.treeNodeName === getDisplayNameForNode(line.slug, variantBase) &&
      selectedNodeKey === nextSelectionKey
    ) {
      angelVariantState.expandedBase = variantBase;
      rerenderVisibleLine(line.slug);
      updateSelectionPanelAndCards();
      return;
    }

    if (selectedNodeKey === nextSelectionKey) {
      selectedNodeKey = "";
    } else {
      selectedNodeKey = nextSelectionKey;
    }

    updateVisibleChartSelection(previousSelectionKey);
    updateSelectionPanelAndCards();
  }

  function handleResize() {
    if (resizeFrame) {
      window.cancelAnimationFrame(resizeFrame);
    }

    resizeFrame = window.requestAnimationFrame(function () {
      resizeFrame = 0;

      if (currentLineSlug === allViewSlug) {
        renderAllViewCharts();
        return;
      }

      if (singleViewContext) {
        renderSingleViewChart(singleViewContext.line);
      }
    });
  }

  bindLineLinks(lineButtons, "treeLineTarget");
  bindLineLinks(sidebarLinks, "treeSidebarTarget");
  selectionCards.addEventListener("click", handleSelectionCardsClick);
  chartContent.addEventListener("click", handleChartClick);
  window.addEventListener("hashchange", syncFromLocation);
  window.addEventListener("resize", handleResize);

  syncFromLocation();
})();
