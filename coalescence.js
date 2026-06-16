(function () {
  const GENERATIONS = 100;
  const DURATION = 10000;
  const SEGMENT_DRAW_DURATION = DURATION / GENERATIONS;
  const MAX_ACTIVE = 100;
  const BRANCH_WIDTH = 0.6;
  const TIP_RADIUS = 1;
  const LANE_GAP = 4;
  const SESSION_DRAWN_KEY = "coalescence-drawn";
  const SESSION_SEED_KEY = "coalescence-seed";

  const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

  function makeSeed() {
    return String(Math.floor(Math.random() * 2 ** 32));
  }

  function makeRandom(seed) {
    let state = Number(seed) >>> 0;

    return function random() {
      state = (state + 0x6d2b79f5) >>> 0;
      let value = state;
      value = Math.imul(value ^ (value >>> 15), value | 1);
      value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
      return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
    };
  }

  function rand(random, min, max) {
    return min + random() * (max - min);
  }

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

  function maxLaneCount(top, bottom) {
    return Math.floor((bottom - top) / LANE_GAP) + 1;
  }

  function descendants(random, activeCount, cap) {
    const roll = random();

    if (activeCount <= 2) {
      if (roll < 0.08) return 1;
      return 2;
    }

    if (activeCount >= cap * 0.8) {
      if (roll < 0.25) return 0;
      if (roll < 0.75) return 1;
      return 2;
    }

    if (roll < 0.25) return 0;
    if (roll < 0.7) return 1;
    return 2;
  }

  function mutateHue(random, hue) {
    return (hue + rand(random, -18, 18) + 360) % 360;
  }

  function fitCountsToCap(random, counts, cap) {
    while (counts.reduce((sum, count) => sum + count, 0) > cap) {
      const candidates = counts
        .map((count, index) => ({ count, index }))
        .filter((item) => item.count > 0);
      const picked = candidates[Math.floor(random() * candidates.length)];
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

  function makeLineage(canvas, header, brand, heading, seed) {
    const random = makeRandom(seed);
    const headerBox = header.getBoundingClientRect();
    const brandBox = brand.getBoundingClientRect();
    const headingRange = document.createRange();
    headingRange.selectNodeContents(heading);
    const headingBox = headingRange.getBoundingClientRect();
    headingRange.detach();
    const top = 6;
    const bottom = Math.max(top + 64, brandBox.height - 6);
    const activeCap = Math.min(MAX_ACTIVE, maxLaneCount(top, bottom));
    const startX = clamp(headingBox.right - headerBox.left + 22, 24, headerBox.width - 90);
    const startY = bottom;
    const available = Math.max(180, headerBox.width - startX);
    const stepX = available / GENERATIONS;
    const baseHue = rand(random, 185, 315);
    let active = [{ x: startX, y: startY, hue: baseHue }];
    const segments = [];
    const tips = [];

    for (let generation = 0; generation < GENERATIONS; generation += 1) {
      active.sort((a, b) => b.y - a.y);
      let counts = active.map(() => descendants(random, active.length, activeCap));

      if (!counts.some(Boolean)) {
        counts[Math.floor(random() * counts.length)] = 1;
      }

      counts = fitCountsToCap(random, counts, activeCap);

      const nextCount = counts.reduce((sum, count) => sum + count, 0);
      const nextYs = laneYs(nextCount, top, bottom);
      const next = [];
      let childIndex = 0;

      active.forEach((node, parentIndex) => {
        if (counts[parentIndex] === 0) {
          tips.push({
            generation,
            x: node.x,
            y: node.y,
            hue: node.hue,
          });
          return;
        }

        for (let i = 0; i < counts[parentIndex]; i += 1) {
          const childY = nextYs[childIndex];
          const child = {
            x: node.x + stepX,
            y: childY,
            hue: mutateHue(random, node.hue),
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
      tips,
      tipKeys: new Set(tips.map((tip) => `${tip.x},${tip.y}`)),
      startX,
      startY,
      maxActive: activeCap,
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
    const navigation = performance.getEntriesByType("navigation")[0];
    const isReload = navigation ? navigation.type === "reload" : performance.navigation?.type === 1;
    const shouldAnimateInitialDraw = isReload || sessionStorage.getItem(SESSION_DRAWN_KEY) !== "true";
    let seed = sessionStorage.getItem(SESSION_SEED_KEY);

    if (shouldAnimateInitialDraw || !seed) {
      seed = makeSeed();
      sessionStorage.setItem(SESSION_SEED_KEY, seed);
    }

    if (shouldAnimateInitialDraw) {
      sessionStorage.setItem(SESSION_DRAWN_KEY, "true");
    }

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

    function branchPath(fromX, fromY, toX, toY, trimEnd = 0) {
      const bend = (toX - fromX) * 0.5;
      const cp1x = fromX + bend;
      const cp1y = fromY;
      const cp2x = toX - bend;
      const cp2y = toY;
      let endX = toX;
      let endY = toY;

      if (trimEnd > 0) {
        const dx = endX - cp2x;
        const dy = endY - cp2y;
        const len = Math.hypot(dx, dy) || 1;
        endX -= (dx / len) * trimEnd;
        endY -= (dy / len) * trimEnd;
      }

      return `M ${fromX} ${fromY} C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${endX} ${endY}`;
    }

    function animateBranchDraw(path) {
      const length = path.getTotalLength();
      if (!length) return;

      path.style.strokeDasharray = String(length);
      path.style.strokeDashoffset = String(length);
      path.getBoundingClientRect();
      path.style.transition = `stroke-dashoffset ${SEGMENT_DRAW_DURATION}ms ease-out`;
      path.style.strokeDashoffset = "0";
    }

    function addSvgBranch(segment, animate) {
      const endsAtTip = lineage.tipKeys.has(`${segment.toX},${segment.toY}`);
      const trimEnd = endsAtTip ? TIP_RADIUS - BRANCH_WIDTH / 2 : 0;
      const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
      path.setAttribute("d", branchPath(segment.fromX, segment.fromY, segment.toX, segment.toY, trimEnd));
      path.setAttribute("fill", "none");
      path.setAttribute("stroke", hsla(segment.hue, 0.52, 0.54, 1));
      path.setAttribute("stroke-width", String(BRANCH_WIDTH));
      path.setAttribute("stroke-linecap", endsAtTip ? "butt" : "round");
      path.setAttribute("stroke-linejoin", "round");
      svg.appendChild(path);

      if (animate) {
        animateBranchDraw(path);
      }
    }

    function addSvgTip(tip, animate) {
      const circle = document.createElementNS("http://www.w3.org/2000/svg", "circle");
      circle.setAttribute("cx", String(tip.x));
      circle.setAttribute("cy", String(tip.y));
      circle.setAttribute("r", String(TIP_RADIUS));
      circle.setAttribute("fill", "none");
      circle.setAttribute("stroke", hsla(tip.hue, 0.52, 0.54, 1));
      circle.setAttribute("stroke-width", String(BRANCH_WIDTH));
      svg.appendChild(circle);

      if (animate) {
        circle.style.opacity = "0";
        circle.getBoundingClientRect();
        circle.style.transition = `opacity ${SEGMENT_DRAW_DURATION}ms ease-out`;
        circle.style.opacity = "1";
      }
    }

    function drawSvg(animate) {
      svg.replaceChildren();
      const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      const drawSegment = (segment) => {
        addSvgBranch(segment, animate && !reduceMotion);
      };

      lineage.segments.forEach((segment) => {
        if (!animate || reduceMotion) {
          drawSegment(segment);
          return;
        }

        const timer = setTimeout(() => drawSegment(segment), (segment.generation / GENERATIONS) * DURATION);
        generationTimers.push(timer);
      });

      lineage.tips.forEach((tip) => {
        if (!animate || reduceMotion) {
          addSvgTip(tip, false);
          return;
        }

        const timer = setTimeout(() => addSvgTip(tip, true), (tip.generation / GENERATIONS) * DURATION);
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
      lineage = makeLineage(svg, header, brand, heading, seed);
      svg.dataset.seed = seed;
      svg.dataset.generations = String(GENERATIONS);
      svg.dataset.segments = String(lineage.segments.length);
      svg.dataset.tips = String(lineage.tips.length);
      svg.dataset.maxActive = String(lineage.maxActive);
      svg.dataset.branchWidth = String(BRANCH_WIDTH);
      svg.dataset.startX = String(Math.round(lineage.startX));
      svg.dataset.startY = String(Math.round(lineage.startY));
      svg.dataset.maxX = String(Math.round(lineage.maxX));
      svg.dataset.minY = String(Math.round(lineage.minY));
      svg.dataset.maxY = String(Math.round(lineage.maxY));
      svg.dataset.lastGeneration = String(lineage.lastGeneration);
    }

    function restart(animate) {
      generationTimers.forEach((timer) => clearTimeout(timer));
      generationTimers = [];
      sizeGraphic();
      restartCount += 1;
      svg.dataset.restartCount = String(restartCount);
      drawSvg(animate);
    }

    restart(shouldAnimateInitialDraw);
    window.addEventListener(
      "resize",
      () => {
        const box = header.getBoundingClientRect();
        if (Math.abs(box.width - lastWidth) > 1 || Math.abs(box.height - lastHeight) > 1) {
          restart(false);
        }
      },
      { passive: true }
    );
  }

  document.querySelectorAll(".site-header").forEach(initHeader);
})();
