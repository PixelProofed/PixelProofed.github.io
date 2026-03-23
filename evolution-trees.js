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
  var selectionCards = document.querySelector("[data-tree-selected-cards]");
  var stageLabels = ["Origin", "First Stage", "Second Stage", "Third Stage"];
  var monsterCardUtils = window.monsterCardUtils || {};
  var currentLineSlug = "";
  var selectedNodeKey = "";
  var resizeFrame = 0;
  var allMonstersMarkup = "";

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

    for (pathIndex = 0; pathIndex < line.paths.length; pathIndex += 1) {
      var path = line.paths[pathIndex];
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
            depth: stepIndex,
            parents: [],
            children: [],
            pathRefs: [],
            pathIndices: [],
            firstPathIndex: pathIndex,
            firstSeenOrder: nodes.length,
            layoutX: 0,
            layoutY: 0,
          };
          nodesByKey[key] = node;
          nodes.push(node);
        }

        node.pathRefs.push({ pathIndex: pathIndex, stepIndex: stepIndex });
        node.pathIndices.push(pathIndex);

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

          edge.pathIndices.push(pathIndex);
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

    if (!selected || selected.slug !== line.slug) {
      return false;
    }

    path = line.paths[selected.pathIndex];

    return Boolean(path && node.depth <= selected.stepIndex && path[node.depth] === node.name);
  }

  function isNodeSelected(node, line) {
    var selected = parseSelectedNodeKey();
    var path;

    if (!selected || selected.slug !== line.slug) {
      return false;
    }

    path = line.paths[selected.pathIndex];

    return Boolean(path && node.depth === selected.stepIndex && path[node.depth] === node.name);
  }

  function getResolvedPathIndex(line, nodeName, stepIndex) {
    var candidatePathIndices = [];
    var pathIndex;
    var selected = parseSelectedNodeKey();
    var selectedPath;
    var selectedStepIndex;
    var bestPathIndex = -1;
    var bestScore = -1;

    for (pathIndex = 0; pathIndex < line.paths.length; pathIndex += 1) {
      if (line.paths[pathIndex][stepIndex] === nodeName) {
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
        path[parentNode.depth] === parentNode.name &&
        path[childNode.depth] === childNode.name,
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

    renderStageHeadings(stageHeadings);
    layoutTree(tree, availableWidth || diagramWrap);

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
      var branchX = startX + Math.min(22, Math.max(14, (endX - startX) / 2));
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
        '" data-tree-node-step="' +
        node.depth +
        '">' +
        '<span class="tree-node__name">' +
        escapeHtml(node.name) +
        "</span>" +
        "</button>";
    }

    lineSvg.innerHTML = lineMarkup;
    nodesLayer.innerHTML = nodeMarkup;

    window.requestAnimationFrame(function () {
      var contentHeight = scaleLayer.scrollHeight;
      var wrapWidth = diagramWrap.clientWidth || tree.width;
      var scale = Math.min(1, wrapWidth / tree.width);

      scaleLayer.style.setProperty("--tree-scale", scale);
      diagramWrap.style.height = contentHeight * scale + "px";
    });
  }

  function renderSelectionPrompt(title, copy) {
    selectionTitle.textContent = title;
    selectionCopy.textContent = copy;
  }

  function renderSelectionDetails(line, pathIndex, stepIndex) {
    var path = line.paths[pathIndex].slice(0, stepIndex + 1);
    var title = path[path.length - 1];

    selectionTitle.textContent = title + " Path";
    selectionCopy.textContent = path.join(" -> ");
  }

  function buildMonsterCardMarkup(monster) {
    if (monsterCardUtils.buildMonsterCardMarkup) {
      return monsterCardUtils.buildMonsterCardMarkup(monster);
    }

    return "";
  }

  function renderSelectedPathCards(line, pathIndex, stepIndex) {
    var path = line.paths[pathIndex].slice(0, stepIndex + 1);
    var markup = '<div class="monster-card-grid">';
    var index;

    for (index = 0; index < path.length; index += 1) {
      var monster = getMonster(line.slug, path[index]) || {
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
      var leftOrder = orderMap[left.name] || { depth: 99, order: 999 };
      var rightOrder = orderMap[right.name] || { depth: 99, order: 999 };

      if (leftOrder.depth !== rightOrder.depth) {
        return leftOrder.depth - rightOrder.depth;
      }

      if (leftOrder.order !== rightOrder.order) {
        return leftOrder.order - rightOrder.order;
      }

      return left.name.localeCompare(right.name);
    });

    monsters.forEach(function (monster) {
      var meta = orderMap[monster.name] || { depth: 0 };

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
      return;
    }

    renderSelectionDetails(line, selected.pathIndex, selected.stepIndex);
    renderSelectedPathCards(line, selected.pathIndex, selected.stepIndex);
  }

  function renderCurrentView() {
    var line = getLine(currentLineSlug);

    if (currentLineSlug === allViewSlug || !line) {
      renderAllView();
      return;
    }

    renderSingleLineView(line);
  }

  function setLine(slug) {
    selectedNodeKey = "";
    currentLineSlug = slug;
    renderCurrentView();

    if (window.location.hash !== "#" + slug) {
      window.location.hash = slug;
    }
  }

  function syncFromHash() {
    var hash = window.location.hash.replace("#", "");
    var line = getLine(hash);

    selectedNodeKey = "";

    if (hash === allViewSlug || !hash) {
      currentLineSlug = allViewSlug;
      renderAllView();
      return;
    }

    if (line) {
      currentLineSlug = line.slug;
      renderSingleLineView(line);
      return;
    }

    currentLineSlug = allViewSlug;
    renderAllView();
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

  bindLineLinks(lineButtons, "treeLineTarget");
  bindLineLinks(sidebarLinks, "treeSidebarTarget");

  selectionCards.addEventListener("click", function (event) {
    var trigger = event.target.closest("[data-tree-chart-jump]");
    var targetChart;

    if (!trigger) {
      return;
    }

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

    if (jumpTrigger) {
      targetGroup = selectionCards.querySelector('[data-tree-group-id="' + jumpTrigger.dataset.treeGroupJump + '"]');

      if (targetGroup) {
        targetGroup.scrollIntoView({ behavior: "smooth", block: "start" });
      }

      return;
    }

    if (!trigger) {
      return;
    }

    line = getLine(trigger.dataset.treeLine);

    if (!line) {
      return;
    }

    stepIndex = Number(trigger.dataset.treeNodeStep);
    pathIndex = getResolvedPathIndex(line, trigger.dataset.treeNodeName, stepIndex);

    if (pathIndex === -1) {
      return;
    }

    nextSelectionKey = line.slug + ":" + pathIndex + ":" + stepIndex;

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
