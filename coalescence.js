(function () {
  const GENERATIONS = 100;
  const DURATION = 3000;
  const MAX_ACTIVE = 100;
  const BRANCH_WIDTH = 0.6;
  const LANE_GAP = 4;

  const rand = (min, max) => min + Math.random() * (max - min);
  const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

  function hsla(hue, saturation, lightness, alpha) {
    const c = (1 - Math.abs(2 * lightness - 1)) * saturation;
    const h = hue / 60;
    const x = c * (1 - Math.abs((h % 2) - 1));
    const m = lightness - c / 2;
    let rgb = [0, 0, 0];

    if (h < 1) rgb = [c, x, 0];
    else if (h < 2) rgb = [x, c, 0];
    else if (h < 3) rgb = [0, c, x];
    else if (h < 4) rgb = [0, x, c];
    else if (h < 5) rgb = [x, 0, c];
    else rgb = [c, 0, x];

    const [r, g, b] = rgb.map((value) => Math.round((value + m) * 255));
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }

  function descendants(activeCount) {
    const roll = Math.random();

    if (activeCount <= 2) {
      if (roll < 0.08) return 1;
      return 2;
    }

    if (activeCount >= MAX_ACTIVE * 0.8) {
      if (roll < 0.42) return 0;
      if (roll < 0.88) return 1;
      return 2;
    }

    if (roll < 0.3) return 0;
    if (roll < 0.6) return 1;
    return 2;
  }

  function mutateHue(hue) {
    return (hue + rand(-18, 18) + 360) % 360;
  }

  function fitCountsToCap(counts) {
    while (counts.reduce((sum, count) => sum + count, 0) > MAX_ACTIVE) {
      const candidates = counts
        .map((count, index) => ({ count, index }))
        .filter((item) => item.count > 0);
      const picked = candidates[Math.floor(Math.random() * candidates.length)];
      counts[picked.index] -= 1;
    }

    return counts;
  }

  function laneYs(count, top, bottom) {
    if (count <= 0) return [];

    return Array.from({ length: count }, (_, index) => {
      return Math.max(top, bottom - LANE_GAP * index);
    });
  }

  function makeLineage(canvas, header, brand, heading) {
    const headerBox = header.getBoundingClientRect();
    const brandBox = brand.getBoundingClientRect();
    const headingRange = document.createRange();
    headingRange.selectNodeContents(heading);
    const headingBox = headingRange.getBoundingClientRect();
    headingRange.detach();
    const top = 6;
    const bottom = Math.max(top + 64, brandBox.height - 6);
    const startX = clamp(headingBox.right - headerBox.left + 22, 24, headerBox.width - 90);
    const startY = bottom;
    const available = Math.max(180, headerBox.width - startX);
    const stepX = available / GENERATIONS;
    const baseHue = rand(185, 315);
    let active = [{ x: startX, y: startY, hue: baseHue }];
    const segments = [];

    for (let generation = 0; generation < GENERATIONS; generation += 1) {
      active.sort((a, b) => b.y - a.y);
      let counts = active.map(() => descendants(active.length));

      if (!counts.some(Boolean)) {
        counts[Math.floor(Math.random() * counts.length)] = 1;
      }

      counts = fitCountsToCap(counts);

      const nextCount = counts.reduce((sum, count) => sum + count, 0);
      const nextYs = laneYs(nextCount, top, bottom);
      const next = [];
      let childIndex = 0;

      active.forEach((node, parentIndex) => {
        for (let i = 0; i < counts[parentIndex]; i += 1) {
          const childY = nextYs[childIndex];
          const child = {
            x: node.x + stepX,
            y: childY,
            hue: mutateHue(node.hue),
          };

          segments.push({
            generation,
            fromX: node.x,
            fromY: node.y,
            toX: child.x,
            toY: child.y,
            hue: child.hue,
          });
          next.push(child);
          childIndex += 1;
        }
      });

      active = next;
    }

    return {
      segments,
      startX,
      startY,
      maxActive: MAX_ACTIVE,
      maxX: Math.max(...segments.map((segment) => segment.toX)),
      minY: Math.min(...segments.map((segment) => Math.min(segment.fromY, segment.toY))),
      maxY: Math.max(...segments.map((segment) => Math.max(segment.fromY, segment.toY))),
      lastGeneration: Math.max(...segments.map((segment) => segment.generation)),
    };
  }

  function initHeader(header) {
    const brand = header.querySelector(".brand");
    const heading = header.querySelector(".brand h1");
    if (!brand || !heading) return;

    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.classList.add("coalescence-canvas");
    svg.setAttribute("aria-hidden", "true");
    svg.setAttribute("focusable", "false");
    header.prepend(svg);

    let lineage;
    let lastWidth = 0;
    let lastHeight = 0;
    let restartCount = 0;
    let generationTimers = [];

    function branchPath(fromX, fromY, toX, toY) {
      const bend = (toX - fromX) * 0.5;
      const cp1x = fromX + bend;
      const cp1y = fromY;
      const cp2x = toX - bend;
      const cp2y = toY;
      return `M ${fromX} ${fromY} C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${toX} ${toY}`;
    }

    function addSvgBranch(segment) {
      const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
      path.setAttribute("d", branchPath(segment.fromX, segment.fromY, segment.toX, segment.toY));
      path.setAttribute("fill", "none");
      path.setAttribute("stroke", hsla(segment.hue, 0.52, 0.54, 1));
      path.setAttribute("stroke-width", String(BRANCH_WIDTH));
      path.setAttribute("stroke-linecap", "round");
      path.setAttribute("stroke-linejoin", "round");
      svg.appendChild(path);
    }

    function drawSvg() {
      svg.replaceChildren();
      const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      const drawSegment = (segment) => {
        addSvgBranch(segment);
      };

      lineage.segments.forEach((segment) => {
        if (reduceMotion) {
          drawSegment(segment);
          return;
        }

        const timer = setTimeout(() => drawSegment(segment), (segment.generation / GENERATIONS) * DURATION);
        generationTimers.push(timer);
      });
    }

    function sizeGraphic() {
      const box = header.getBoundingClientRect();
      const brandBox = brand.getBoundingClientRect();
      const canvasWidth = box.width;
      const canvasHeight = brandBox.height;
      lastWidth = box.width;
      lastHeight = box.height;
      header.style.overflow = "visible";
      svg.style.inset = "auto";
      svg.style.left = "0";
      svg.style.top = `${brandBox.top - box.top}px`;
      svg.style.zIndex = "2";
      svg.style.background = "transparent";
      svg.style.width = `${canvasWidth}px`;
      svg.style.height = `${canvasHeight}px`;
      svg.setAttribute("viewBox", `0 0 ${canvasWidth} ${canvasHeight}`);
      svg.setAttribute("preserveAspectRatio", "none");
      svg.dataset.width = String(canvasWidth);
      svg.dataset.height = String(canvasHeight);
      lineage = makeLineage(svg, header, brand, heading);
      svg.dataset.generations = String(GENERATIONS);
      svg.dataset.segments = String(lineage.segments.length);
      svg.dataset.maxActive = String(lineage.maxActive);
      svg.dataset.branchWidth = String(BRANCH_WIDTH);
      svg.dataset.startX = String(Math.round(lineage.startX));
      svg.dataset.startY = String(Math.round(lineage.startY));
      svg.dataset.maxX = String(Math.round(lineage.maxX));
      svg.dataset.minY = String(Math.round(lineage.minY));
      svg.dataset.maxY = String(Math.round(lineage.maxY));
      svg.dataset.lastGeneration = String(lineage.lastGeneration);
    }

    function restart() {
      generationTimers.forEach((timer) => clearTimeout(timer));
      generationTimers = [];
      sizeGraphic();
      restartCount += 1;
      svg.dataset.restartCount = String(restartCount);
      drawSvg();
    }

    restart();
    window.addEventListener(
      "resize",
      () => {
        const box = header.getBoundingClientRect();
        if (Math.abs(box.width - lastWidth) > 1 || Math.abs(box.height - lastHeight) > 1) {
          restart();
        }
      },
      { passive: true }
    );
  }

  document.querySelectorAll(".site-header").forEach(initHeader);
})();
