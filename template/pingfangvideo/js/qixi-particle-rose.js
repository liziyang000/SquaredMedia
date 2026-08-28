(function () {
  "use strict";

  // Original Canvas point-cloud implementation. Creative references:
  // https://github.com/jirotubuyaki/FlowerJS (flower layering, MIT)
  // https://github.com/valnub/particle-animation-javascript (Canvas particles, MIT)
  // Parametric rose surface adapted from https://github.com/Vasileios-Bellos/BloomingRose (MIT)
  var root = document.querySelector("[data-qixi-rose]");
  if (!root) return;

  var canvas = root.querySelector("[data-qixi-canvas]");
  var context = canvas && canvas.getContext("2d");
  if (!context) return;

  var bloomButton = root.querySelector("[data-qixi-bloom]");
  var shareButton = root.querySelector("[data-qixi-share]");
  var status = root.querySelector("[data-qixi-status]");
  var reducedMotionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
  var palette = ["#3a0717", "#701027", "#a91b3a", "#dc3157", "#ff6f8d", "#ffc0cb", "#f5d7a1", "#12382f", "#4e9f78"];
  var paletteOpacity = [0.7, 0.76, 0.82, 0.88, 0.93, 0.96, 0.92, 0.74, 0.82];
  var alphaLevels = [0.22, 0.52, 0.92];
  var depthBinCount = 36;
  var particles = [];
  var depthBuckets = createDepthBuckets();
  var random = createRandom(20260807);
  var roses = createRoseDome();
  var width = 0;
  var height = 0;
  var pixelRatio = 1;
  var quality = 0;
  var rotationY = 0.18;
  var rotationX = 0.32;
  var hoverRotationY = 0;
  var hoverRotationX = 0;
  var hoverTargetY = 0;
  var hoverTargetX = 0;
  var pointerId = null;
  var pointerStartX = 0;
  var pointerStartY = 0;
  var rotationStartY = 0;
  var rotationStartX = 0;
  var didDrag = false;
  var bloomStart = 0;
  var isBlooming = false;
  var bloomDuration = 3100;
  var entryStart = 0;
  var entryDuration = 2800;
  var isEntering = false;
  var hasEntered = false;
  var isVisible = true;
  var frameRequest = 0;
  var lastFrame = 0;

  function createRandom(seed) {
    var value = seed >>> 0;
    return function () {
      value = (value * 1664525 + 1013904223) >>> 0;
      return value / 4294967296;
    };
  }

  function clamp(value, minimum, maximum) {
    return Math.max(minimum, Math.min(maximum, value));
  }

  function easeOutCubic(value) {
    return 1 - Math.pow(1 - value, 3);
  }

  function easeOutQuart(value) {
    return 1 - Math.pow(1 - value, 4);
  }

  function easeOutQuint(value) {
    return 1 - Math.pow(1 - value, 5);
  }

  function normalizeVector(x, y, z) {
    var length = Math.sqrt(x * x + y * y + z * z) || 1;
    return { x: x / length, y: y / length, z: z / length };
  }

  function crossVector(left, right) {
    return {
      x: left.y * right.z - left.z * right.y,
      y: left.z * right.x - left.x * right.z,
      z: left.x * right.y - left.y * right.x
    };
  }

  function createRoseBasis(normal, spin) {
    var reference = Math.abs(normal.y) > 0.92 ? { x: 0, y: 0, z: 1 } : { x: 0, y: 1, z: 0 };
    var rightRaw = crossVector(reference, normal);
    var right = normalizeVector(rightRaw.x, rightRaw.y, rightRaw.z);
    var upRaw = crossVector(normal, right);
    var up = normalizeVector(upRaw.x, upRaw.y, upRaw.z);
    var cos = Math.cos(spin);
    var sin = Math.sin(spin);
    return {
      axisX: {
        x: right.x * cos + up.x * sin,
        y: right.y * cos + up.y * sin,
        z: right.z * cos + up.z * sin
      },
      axisY: {
        x: up.x * cos - right.x * sin,
        y: up.y * cos - right.y * sin,
        z: up.z * cos - right.z * sin
      },
      normal: normal
    };
  }

  function createRoseDome() {
    var dome = [];
    var ringCounts = [1, 7, 13, 20];
    var ringAngles = [0, 0.52, 0.93, 1.34];
    var ringSizes = [0.58, 0.54, 0.5, 0.46];
    var ringParticles = [650, 560, 500, 440];
    var centerY = 0.31;

    ringCounts.forEach(function (count, ring) {
      for (var index = 0; index < count; index += 1) {
        var polarJitter = count === 1 ? 0 : Math.cos((index + 1) * 5.713 + ring * 2.171) * 0.032;
        var polar = ringAngles[ring] + polarJitter;
        var sinPolar = Math.sin(polar);
        var cosPolar = Math.cos(polar);
        var angleJitter = count === 1 ? 0 : Math.sin((index + 1) * 7.137 + ring * 2.413) * 0.05;
        var angle = count === 1 ? 0 : (index / count) * Math.PI * 2 + ring * 0.37 + angleJitter;
        var normal = normalizeVector(sinPolar * Math.cos(angle), cosPolar, sinPolar * Math.sin(angle));
        var phase = ((index + 1) * 0.61803398875 + ring * 0.137) % 1;
        var basis = createRoseBasis(normal, angle * 0.21 + ring * 0.17 + phase * 0.46);
        var radialJitter = count === 1 ? 0 : Math.sin((index + 1) * 12.9898 + ring * 4.1414) * 0.028;
        var sizeJitter = count === 1 ? 0 : Math.cos((index + 1) * 4.573 + ring * 1.831) * 0.075;
        dome.push({
          x: normal.x * (1.14 + radialJitter),
          y: centerY + normal.y * (0.88 + radialJitter * 0.4),
          z: normal.z * (1.02 + radialJitter),
          size: ringSizes[ring] * (1 + sizeJitter),
          count: ringParticles[ring],
          normal: basis.normal,
          axisX: basis.axisX,
          axisY: basis.axisY,
          tone: (index + ring * 3) % 9 === 0 ? 1 : 0,
          phase: phase,
          openness: 0.82 + (Math.sin((index + 1) * 3.917 + ring * 1.53) * 0.5 + 0.5) * 0.36,
          petalWidth: 0.86 + (Math.cos((index + 1) * 6.173 + ring * 0.91) * 0.5 + 0.5) * 0.28,
          curl: 0.82 + (Math.sin((index + 1) * 8.113 + ring * 2.07) * 0.5 + 0.5) * 0.36,
          irregularity: 0.045 + (Math.cos((index + 1) * 2.731 + ring * 3.11) * 0.5 + 0.5) * 0.055,
          leanX: Math.sin((index + 1) * 9.17 + ring) * 0.038,
          leanY: Math.cos((index + 1) * 7.31 + ring * 1.7) * 0.038,
          petalShift: ((index + ring * 2) % 3) - 1
        });
      }
    });
    return dome;
  }

  function transformRosePoint(rose, x, y, z) {
    return {
      x: rose.x + rose.axisX.x * x + rose.axisY.x * y + rose.normal.x * z,
      y: rose.y + rose.axisX.y * x + rose.axisY.y * y + rose.normal.y * z,
      z: rose.z + rose.axisX.z * x + rose.axisY.z * y + rose.normal.z * z
    };
  }

  function transformRoseNormal(rose, x, y, z) {
    return normalizeVector(
      rose.axisX.x * x + rose.axisY.x * y + rose.normal.x * z,
      rose.axisX.y * x + rose.axisY.y * y + rose.normal.y * z,
      rose.axisX.z * x + rose.axisY.z * y + rose.normal.z * z
    );
  }

  function createDepthBuckets() {
    var bins = [];
    for (var depth = 0; depth < depthBinCount; depth += 1) {
      var colors = [];
      for (var color = 0; color < palette.length; color += 1) {
        colors.push([[], [], []]);
      }
      bins.push(colors);
    }
    return bins;
  }

  function clearDepthBuckets() {
    for (var depth = 0; depth < depthBuckets.length; depth += 1) {
      for (var color = 0; color < depthBuckets[depth].length; color += 1) {
        for (var alpha = 0; alpha < alphaLevels.length; alpha += 1) {
          depthBuckets[depth][color][alpha].length = 0;
        }
      }
    }
  }

  function addParticle(x, y, z, color, size, delay, kind, normal, opacity) {
    var safeNormal = normal || normalizeVector(x, y, z);
    var phase = random() * Math.PI * 2;
    var entryDistance = 1.75 + (Math.sin(phase * 2.31) * 0.5 + 0.5) * 1.65;
    var entryLift = kind === "petal" ? 0.46 : kind === "filler" ? 0.28 : -0.08;
    var entryDelayBase =
      kind === "wrapper"
        ? 0.04
        : kind === "stem"
          ? 0.08
          : kind === "leaf"
            ? 0.14
            : kind === "ribbon"
              ? 0.18
              : kind === "filler"
                ? 0.24
                : kind === "calyx"
                  ? 0.3
                  : 0.34;
    particles.push({
      x: x,
      y: y,
      z: z,
      ex: x + Math.cos(phase) * entryDistance,
      ey: y + Math.sin(phase * 1.37) * 1.12 + entryLift,
      ez: z + Math.sin(phase) * entryDistance,
      entryDelay: entryDelayBase + (phase / (Math.PI * 2)) * 0.14,
      bx: x,
      by: y,
      bz: z,
      color: color,
      size: size,
      delay: delay,
      kind: kind,
      nx: safeNormal.x,
      ny: safeNormal.y,
      nz: safeNormal.z,
      opacity: opacity == null ? 0.9 : opacity,
      phase: phase,
      screenX: 0,
      screenY: 0,
      screenRadius: 1
    });
  }

  function addRoseCalyx(rose, count) {
    for (var index = 0; index < count; index += 1) {
      var sepal = index % 5;
      var progress = random();
      var angle = (sepal / 5) * Math.PI * 2 + progress * 0.22;
      var radius = (0.025 + progress * 0.16) * rose.size;
      var localX = Math.cos(angle) * radius;
      var localY = Math.sin(angle) * radius;
      var localZ = (-0.05 - progress * 0.24) * rose.size;
      var point = transformRosePoint(rose, localX, localY, localZ);
      var normal = transformRoseNormal(rose, Math.cos(angle) * 0.8, Math.sin(angle) * 0.8, -0.4);
      addParticle(point.x, point.y, point.z, random() > 0.62 ? 8 : 7, 0.72 + random() * 0.72, 0.15 + random() * 0.12, "calyx", normal, 0.82);
    }
  }

  function positiveModulo(value, divisor) {
    return ((value % divisor) + divisor) % divisor;
  }

  function petalEnvelope(theta) {
    var petalPosition = positiveModulo(3.6 * theta, Math.PI * 2) / Math.PI;
    var inner = 1.25 * Math.pow(1 - petalPosition, 2) - 0.25;
    return 1 - 0.5 * inner * inner;
  }

  function roseSurfacePoint(radius, turnProgress) {
    var theta = -2 + turnProgress * (Math.PI * 20 + 2);
    var envelope = petalEnvelope(theta);
    var openness = 0.21 + turnProgress * 0.84;
    var phi = (Math.PI / 2) * openness * openness;
    var sinPhi = Math.sin(phi);
    var cosPhi = Math.cos(phi);
    var curl = 1.995653 * radius * radius * Math.pow(1.27689 * radius - 1, 2) * sinPhi;
    var radial = envelope * (radius * sinPhi + curl * cosPhi);
    return {
      x: radial * Math.sin(theta),
      y: radial * Math.cos(theta),
      z: envelope * (radius * cosPhi - curl * sinPhi),
      envelope: envelope
    };
  }

  function roseSurfaceNormal(radius, turnProgress) {
    var radiusStep = radius > 0.992 ? -0.008 : 0.008;
    var turnStep = turnProgress > 0.998 ? -0.002 : 0.002;
    var point = roseSurfacePoint(radius, turnProgress);
    var radiusPoint = roseSurfacePoint(radius + radiusStep, turnProgress);
    var turnPoint = roseSurfacePoint(radius, turnProgress + turnStep);
    var radiusVector = {
      x: (radiusPoint.x - point.x) / radiusStep,
      y: (radiusPoint.y - point.y) / radiusStep,
      z: (radiusPoint.z - point.z) / radiusStep
    };
    var turnVector = {
      x: (turnPoint.x - point.x) / turnStep,
      y: (turnPoint.y - point.y) / turnStep,
      z: (turnPoint.z - point.z) / turnStep
    };
    var normal = crossVector(radiusVector, turnVector);
    if (normal.z < 0) {
      normal.x *= -1;
      normal.y *= -1;
      normal.z *= -1;
    }
    return normalizeVector(normal.x / 0.52, normal.y / 0.52, normal.z / 0.42);
  }

  function petalSurfacePoint(band, angle, progress, across, rose, petalVariation) {
    var widthProfile = Math.pow(Math.sin(Math.PI * progress), 0.72) * (0.7 + progress * 0.3);
    var direction = angle + (band.twist + petalVariation.twist) * (progress - 0.38);
    var radial = band.base + band.length * petalVariation.length * (0.06 + progress * 0.94);
    var side = band.width * rose.petalWidth * petalVariation.width * widthProfile * across;
    var edgeCup = band.cup * rose.curl * Math.pow(Math.abs(across), 1.7) * widthProfile;
    var z =
      band.height +
      band.arch * Math.sin(Math.PI * progress) +
      edgeCup -
      band.drop * rose.openness * progress -
      band.tipCurl * rose.openness * Math.pow(progress, 3) +
      petalVariation.lift * progress;
    return {
      x: Math.cos(direction) * radial - Math.sin(direction) * side + rose.leanX * (1 - progress),
      y: Math.sin(direction) * radial + Math.cos(direction) * side + rose.leanY * (1 - progress),
      z: z
    };
  }

  function petalSurfaceNormal(band, angle, progress, across, rose, petalVariation) {
    var progressStep = progress > 0.992 ? -0.008 : 0.008;
    var acrossStep = across > 0.98 ? -0.02 : 0.02;
    var point = petalSurfacePoint(band, angle, progress, across, rose, petalVariation);
    var progressPoint = petalSurfacePoint(band, angle, progress + progressStep, across, rose, petalVariation);
    var acrossPoint = petalSurfacePoint(band, angle, progress, across + acrossStep, rose, petalVariation);
    var progressVector = {
      x: (progressPoint.x - point.x) / progressStep,
      y: (progressPoint.y - point.y) / progressStep,
      z: (progressPoint.z - point.z) / progressStep
    };
    var acrossVector = {
      x: (acrossPoint.x - point.x) / acrossStep,
      y: (acrossPoint.y - point.y) / acrossStep,
      z: (acrossPoint.z - point.z) / acrossStep
    };
    var normal = crossVector(progressVector, acrossVector);
    if (normal.z < 0) {
      normal.x *= -1;
      normal.y *= -1;
      normal.z *= -1;
    }
    return normalizeVector(normal.x, normal.y, normal.z);
  }

  function addRoseSurfaceDepth(rose, count) {
    var goldenAngle = 0.61803398875;
    var roseRimShare = 0.18;

    for (var index = 0; index < count; index += 1) {
      var sequence = (index * goldenAngle + rose.phase) % 1;
      var turnProgress = (index + 0.5) / count;
      var isRim = ((index * 37) % 100) / 100 < roseRimShare;
      var radius = isRim ? 0.92 + sequence * 0.08 : Math.sqrt(sequence) * 0.9;
      var surface = roseSurfacePoint(radius, turnProgress);
      var surfaceNormal = roseSurfaceNormal(radius, turnProgress);
      var localX = surface.x * rose.size * 0.43;
      var localY = surface.y * rose.size * 0.43;
      var localZ = (surface.z - 0.1) * rose.size * 0.34;
      var point = transformRosePoint(rose, localX, localY, localZ);
      var normal = transformRoseNormal(rose, surfaceNormal.x, surfaceNormal.y, surfaceNormal.z);
      addParticle(
        point.x,
        point.y,
        point.z,
        Math.min(3, (isRim ? 2 : 1) + rose.tone),
        isRim ? 0.92 + random() * 0.58 : 0.62 + random() * 0.7,
        0.18 + turnProgress * 0.12 + random() * 0.08,
        "petal",
        normal,
        isRim ? 0.82 : 0.68
      );
    }
  }

  function addRoseCore(rose, count) {
    for (var index = 0; index < count; index += 1) {
      var progress = index / Math.max(1, count - 1);
      var angle = rose.phase * Math.PI * 2 + progress * Math.PI * (8.4 + rose.curl * 0.8);
      var radius = 0.014 + progress * 0.12;
      var localX = (Math.cos(angle) * radius + rose.leanX * (1 - progress)) * rose.size;
      var localY = (Math.sin(angle) * radius * 0.82 + rose.leanY * (1 - progress)) * rose.size;
      var localZ = (0.35 - progress * 0.09 + Math.sin(progress * Math.PI * 3) * 0.008) * rose.size;
      var point = transformRosePoint(rose, localX, localY, localZ);
      addParticle(
        point.x,
        point.y,
        point.z,
        Math.min(5, (index % 7 === 0 ? 4 : index % 2 === 0 ? 2 : 1) + rose.tone),
        1.1 + random() * 0.9,
        0.24 + random() * 0.1,
        "petal",
        rose.normal,
        0.97
      );
    }
  }

  function addRosePetal(rose, band, bandIndex, petal, petalCount, count) {
    var petalAngle =
      rose.phase * Math.PI * 2 +
      band.offset +
      (petal / petalCount) * Math.PI * 2 +
      Math.sin((petal + 1) * 5.173 + rose.phase * 11.7 + bandIndex * 2.31) * rose.irregularity;
    var petalVariation = {
      length: 0.93 + (Math.sin((petal + 1) * 7.11 + rose.phase * 9.2 + bandIndex) * 0.5 + 0.5) * 0.14,
      width: 0.9 + (Math.cos((petal + 1) * 4.37 + rose.phase * 13.1 + bandIndex) * 0.5 + 0.5) * 0.2,
      twist: Math.sin((petal + 1) * 6.19 + rose.phase * 8.4) * rose.irregularity,
      lift: Math.cos((petal + 1) * 3.83 + rose.phase * 10.3) * rose.irregularity * 0.55
    };
    var edgeCount = Math.min(count, Math.max(6, Math.floor(count * 0.82)));
    var sideCount = Math.max(2, edgeCount - 2);
    var sidePairs = Math.max(1, Math.ceil(sideCount / 2) - 1);

    for (var sample = 0; sample < count; sample += 1) {
      var progress;
      var across;
      var isEdge = sample < edgeCount;
      if (sample < sideCount) {
        progress = 0.12 + (Math.floor(sample / 2) / sidePairs) * 0.76;
        across = (sample % 2 === 0 ? -1 : 1) * (0.91 + random() * 0.07);
      } else if (isEdge) {
        progress = 0.94 + random() * 0.035;
        across = sample === sideCount ? -0.5 : 0.5;
      } else {
        progress = 0.16 + Math.sqrt(random()) * 0.72;
        across = (random() * 2 - 1) * 0.76;
      }
      var surface = petalSurfacePoint(band, petalAngle, progress, across, rose, petalVariation);
      var surfaceNormal = petalSurfaceNormal(band, petalAngle, progress, across, rose, petalVariation);
      var point = transformRosePoint(rose, surface.x * rose.size, surface.y * rose.size, surface.z * rose.size);
      var normal = transformRoseNormal(rose, surfaceNormal.x, surfaceNormal.y, surfaceNormal.z);
      var color = Math.min(4, 1 + bandIndex + (isEdge ? 1 : 0) + rose.tone);
      if (isEdge && (sample + petal * 3 + bandIndex) % 11 === 0) color = 5;
      addParticle(
        point.x,
        point.y,
        point.z,
        color,
        isEdge ? 1.2 + random() * 0.82 : 0.76 + random() * 0.92,
        0.2 + bandIndex * 0.035 + random() * 0.08,
        "petal",
        normal,
        isEdge ? 0.98 : 0.8
      );
    }
  }

  function addRose(rose, count) {
    var rosePetalBands = [
      {
        petals: 3,
        share: 0.14,
        base: 0.012,
        length: 0.17,
        width: 0.12,
        height: 0.33,
        drop: 0.035,
        arch: 0.045,
        cup: 0.075,
        tipCurl: 0.015,
        twist: 0.16,
        offset: 0.2
      },
      {
        petals: 5,
        share: 0.2,
        base: 0.03,
        length: 0.23,
        width: 0.16,
        height: 0.31,
        drop: 0.07,
        arch: 0.052,
        cup: 0.07,
        tipCurl: 0.03,
        twist: 0.12,
        offset: 0.84
      },
      {
        petals: 7,
        share: 0.27,
        base: 0.07,
        length: 0.29,
        width: 0.195,
        height: 0.285,
        drop: 0.115,
        arch: 0.06,
        cup: 0.06,
        tipCurl: 0.055,
        twist: 0.09,
        offset: 1.42
      },
      {
        petals: 9,
        share: 0.39,
        base: 0.105,
        length: 0.36,
        width: 0.24,
        height: 0.25,
        drop: 0.175,
        arch: 0.065,
        cup: 0.055,
        tipCurl: 0.09,
        twist: 0.07,
        offset: 2.02
      }
    ];
    var surfaceCount = Math.floor(count * 0.05);
    var coreCount = Math.floor(count * 0.1);
    var petalPointCount = count - surfaceCount - coreCount;
    var remaining = petalPointCount;

    addRoseSurfaceDepth(rose, surfaceCount);
    addRoseCore(rose, coreCount);
    rosePetalBands.forEach(function (band, bandIndex) {
      var bandCount = bandIndex === rosePetalBands.length - 1 ? remaining : Math.floor(petalPointCount * band.share);
      var petalCount = band.petals + (bandIndex > 1 ? rose.petalShift : 0);
      var pointsPerPetal = Math.floor(bandCount / petalCount);
      var extra = bandCount % petalCount;
      remaining -= bandCount;
      for (var petal = 0; petal < petalCount; petal += 1) {
        addRosePetal(rose, band, bandIndex, petal, petalCount, pointsPerPetal + (petal < extra ? 1 : 0));
      }
    });
  }

  function addStem(rose, count) {
    var start = {
      x: rose.x - rose.normal.x * rose.size * 0.17,
      y: rose.y - rose.normal.y * rose.size * 0.17,
      z: rose.z - rose.normal.z * rose.size * 0.17
    };
    var end = { x: rose.x * 0.025, y: -1.5, z: rose.z * 0.025 };
    var steps = Math.max(4, Math.round(count / 2));
    for (var step = 0; step < steps; step += 1) {
      var progress = step / Math.max(1, steps - 1);
      var inverse = 1 - progress;
      var centerX = start.x * inverse + end.x * progress + Math.sin(progress * Math.PI) * rose.x * 0.055;
      var centerY = start.y * inverse + end.y * progress - Math.sin(progress * Math.PI) * 0.035;
      var centerZ = start.z * inverse + end.z * progress + Math.sin(progress * Math.PI) * rose.z * 0.055;
      for (var side = 0; side < 2; side += 1) {
        var angle = (side / 2) * Math.PI * 2 + step * 1.47 + random() * 0.4;
        var radius = 0.008 + random() * 0.007;
        var normal = normalizeVector(Math.cos(angle), 0.16, Math.sin(angle));
        addParticle(
          centerX + Math.cos(angle) * radius,
          centerY + (random() - 0.5) * 0.012,
          centerZ + Math.sin(angle) * radius,
          random() > 0.72 ? 8 : 7,
          0.78 + random() * 0.66,
          random() * 0.12,
          "stem",
          normal,
          0.82
        );
      }
    }
  }

  function addLeaves(count) {
    var leafCount = 12;
    var pointsPerLeaf = Math.max(12, Math.round(count / leafCount));
    for (var leaf = 0; leaf < leafCount; leaf += 1) {
      var angle = (leaf / leafCount) * Math.PI * 2 + (leaf % 3) * 0.22;
      var radial = { x: Math.cos(angle), y: 0, z: Math.sin(angle) };
      var tangent = { x: -Math.sin(angle), y: 0, z: Math.cos(angle) };
      var startY = -0.16 - (leaf % 4) * 0.16;
      var length = 0.34 + (leaf % 3) * 0.055;
      var rise = leaf % 2 === 0 ? 0.12 : -0.03;
      for (var pointIndex = 0; pointIndex < pointsPerLeaf; pointIndex += 1) {
        var progress = Math.sqrt(random());
        var across = random() * 2 - 1;
        var halfWidth = Math.sin(progress * Math.PI) * 0.105 * across;
        var curve = Math.sin(progress * Math.PI) * 0.045;
        var x = radial.x * (0.08 + length * progress + curve) + tangent.x * halfWidth;
        var y = startY + rise * progress + Math.sin(progress * Math.PI) * 0.035 + (random() - 0.5) * 0.012;
        var z = radial.z * (0.08 + length * progress + curve) + tangent.z * halfWidth;
        var normal = normalizeVector(radial.x * 0.65 + tangent.x * across * 0.18, 0.72, radial.z * 0.65 + tangent.z * across * 0.18);
        addParticle(x, y, z, random() > 0.58 ? 8 : 7, 0.78 + random() * 0.82, 0.08 + random() * 0.18, "leaf", normal, 0.86);
      }
    }
  }

  function wrapperPoint(progress, angle, radiusOffset) {
    var fold = 1 + Math.sin(angle * 12 + progress * 3.4) * 0.055;
    var radius = (0.1 + Math.pow(progress, 0.82) * 1.23 + (radiusOffset || 0)) * fold;
    return {
      x: Math.cos(angle) * radius,
      y: -1.62 + progress * 1.83,
      z: Math.sin(angle) * radius * 0.82
    };
  }

  function addWrappingCollar(count) {
    var panelCount = 14;
    var pointsPerPanel = Math.max(18, Math.round(count / panelCount));
    for (var panel = 0; panel < panelCount; panel += 1) {
      var panelAngle = (panel / panelCount) * Math.PI * 2 + (panel % 2) * 0.045;
      var panelLift = ((panel % 4) - 1.5) * 0.025;
      for (var pointIndex = 0; pointIndex < pointsPerPanel; pointIndex += 1) {
        var progress = Math.sqrt(random());
        var across = random() * 2 - 1;
        var fanWidth = 0.045 + progress * 0.16;
        var angle = panelAngle + across * fanWidth;
        var radius = 0.3 + progress * (1.03 + (panel % 3) * 0.045);
        var edge = Math.abs(across) > 0.76 || progress > 0.89;
        var normal = normalizeVector(Math.cos(angle), 0.18, Math.sin(angle) / 0.82);
        addParticle(
          Math.cos(angle) * radius,
          -0.72 + progress * (1.01 + panelLift) - Math.abs(across) * progress * 0.07,
          Math.sin(angle) * radius * 0.82,
          edge && panel % 3 === 0 ? 6 : edge ? 3 : panel % 3 === 0 ? 3 : 2,
          edge ? 1.22 + random() * 0.88 : 0.76 + random() * 0.86,
          0.08 + random() * 0.14,
          "wrapper",
          normal,
          edge ? 0.95 : 0.77
        );
      }
    }
  }

  function addWrappingParticles(count) {
    for (var index = 0; index < count; index += 1) {
      var progress = Math.pow(random(), 0.72);
      var angle = random() * Math.PI * 2;
      var point = wrapperPoint(progress, angle, (random() - 0.5) * 0.025);
      var normal = normalizeVector(Math.cos(angle), -0.14, Math.sin(angle) / 0.82);
      var colorRoll = random();
      var color = colorRoll > 0.96 ? 6 : colorRoll > 0.78 ? 3 : colorRoll > 0.26 ? 2 : 1;
      addParticle(point.x, point.y, point.z, color, 0.7 + random() * 0.82, 0.04 + random() * 0.18, "wrapper", normal, 0.56 + random() * 0.2);
    }

    var seamCount = 18;
    var seamSteps = Math.max(16, Math.round(28 * quality));
    for (var seam = 0; seam < seamCount; seam += 1) {
      var seamAngle = (seam / seamCount) * Math.PI * 2 + (seam % 2) * 0.07;
      for (var step = 0; step < seamSteps; step += 1) {
        var seamProgress = step / Math.max(1, seamSteps - 1);
        var seamPoint = wrapperPoint(seamProgress, seamAngle + Math.sin(seamProgress * Math.PI) * 0.025, 0.012);
        addParticle(
          seamPoint.x,
          seamPoint.y,
          seamPoint.z,
          seam % 5 === 0 ? 6 : seam % 2 === 0 ? 3 : 2,
          1.02 + random() * 0.76,
          0.08 + random() * 0.12,
          "wrapper",
          normalizeVector(Math.cos(seamAngle), -0.14, Math.sin(seamAngle) / 0.82),
          0.9
        );
      }
    }
  }

  function rotateAroundY(x, z, angle) {
    return {
      x: x * Math.cos(angle) + z * Math.sin(angle),
      z: -x * Math.sin(angle) + z * Math.cos(angle)
    };
  }

  function addRibbon(count) {
    var loopCount = Math.floor(count * 0.64);
    for (var index = 0; index < loopCount; index += 1) {
      var side = index % 2 === 0 ? -1 : 1;
      var angle = random() * Math.PI * 2;
      var localX = side * (0.13 + Math.cos(angle) * 0.25);
      var localZ = Math.sin(angle * 2) * 0.12 * side;
      var rotated = rotateAroundY(localX, localZ, 0.34);
      var tubeAngle = random() * Math.PI * 2;
      var tubeRadius = random() * 0.014;
      addParticle(
        rotated.x + Math.cos(tubeAngle) * tubeRadius,
        -1.08 + Math.sin(angle) * 0.19 + Math.sin(tubeAngle) * tubeRadius,
        rotated.z + Math.sin(tubeAngle) * tubeRadius,
        6,
        0.9 + random() * 0.88,
        0.22 + random() * 0.16,
        "ribbon",
        normalizeVector(Math.cos(tubeAngle), Math.sin(tubeAngle), Math.sin(angle)),
        0.9
      );
    }

    var tailCount = Math.floor(count * 0.25);
    for (var tail = 0; tail < tailCount; tail += 1) {
      var tailSide = tail % 2 === 0 ? -1 : 1;
      var progress = random();
      var tailPoint = rotateAroundY(tailSide * (0.055 + progress * 0.18), tailSide * Math.sin(progress * Math.PI) * 0.08, 0.34);
      addParticle(
        tailPoint.x + (random() - 0.5) * 0.025,
        -1.12 - progress * 0.48 + (random() - 0.5) * 0.02,
        tailPoint.z + (random() - 0.5) * 0.025,
        6,
        0.88 + random() * 0.86,
        0.24 + random() * 0.18,
        "ribbon",
        normalizeVector(tailSide, -0.4, tailSide * 0.4),
        0.88
      );
    }

    var knotCount = count - loopCount - tailCount;
    for (var knot = 0; knot < knotCount; knot += 1) {
      var theta = random() * Math.PI * 2;
      var cosine = random() * 2 - 1;
      var sine = Math.sqrt(1 - cosine * cosine);
      var radius = 0.035 * Math.cbrt(random());
      var knotNormal = normalizeVector(Math.cos(theta) * sine, cosine, Math.sin(theta) * sine);
      addParticle(
        knotNormal.x * radius,
        -1.08 + knotNormal.y * radius,
        knotNormal.z * radius,
        6,
        0.8 + random() * 0.7,
        0.22 + random() * 0.15,
        "ribbon",
        knotNormal,
        0.94
      );
    }
  }

  function addFillerClusters(count) {
    var clusterCount = 28;
    var pointsPerCluster = Math.max(4, Math.round(count / clusterCount));
    for (var cluster = 0; cluster < clusterCount; cluster += 1) {
      var polar = 0.34 + random() * 0.92;
      var angle = (cluster / clusterCount) * Math.PI * 2 + (cluster % 4) * 0.17;
      var normal = normalizeVector(Math.sin(polar) * Math.cos(angle), Math.cos(polar), Math.sin(polar) * Math.sin(angle));
      var center = {
        x: normal.x * 1.24,
        y: 0.36 + normal.y * 0.88,
        z: normal.z * 1.08
      };
      for (var pointIndex = 0; pointIndex < pointsPerCluster; pointIndex += 1) {
        var spread = 0.035 + random() * 0.075;
        var theta = random() * Math.PI * 2;
        var cosine = random() * 2 - 1;
        var sine = Math.sqrt(1 - cosine * cosine);
        addParticle(
          center.x + Math.cos(theta) * sine * spread,
          center.y + cosine * spread,
          center.z + Math.sin(theta) * sine * spread,
          random() > 0.2 ? 6 : 5,
          0.54 + random() * 0.78,
          0.28 + random() * 0.16,
          "filler",
          normal,
          0.86
        );
      }
    }
  }

  function qualityForWidth() {
    return width < 560 ? 0.56 : width < 940 ? 0.76 : 1;
  }

  function buildBouquet() {
    particles = [];
    random = createRandom(20260807);

    roses.forEach(function (rose) {
      addStem(rose, Math.round(20 * quality));
    });
    addLeaves(Math.round(900 * quality));
    addWrappingParticles(Math.round(1450 * quality));
    addWrappingCollar(Math.round(620 * quality));
    addRibbon(Math.round(420 * quality));
    addFillerClusters(Math.round(320 * quality));
    roses.forEach(function (rose) {
      addRoseCalyx(rose, Math.round(18 * quality));
      addRose(rose, Math.round(rose.count * quality));
    });
  }

  function resizeCanvas() {
    var bounds = root.getBoundingClientRect();
    var nextWidth = Math.max(1, Math.round(bounds.width));
    var nextHeight = Math.max(1, Math.round(bounds.height));
    var nextRatio = Math.min(window.devicePixelRatio || 1, 1.7);
    if (nextWidth === width && nextHeight === height && nextRatio === pixelRatio) return;
    width = nextWidth;
    height = nextHeight;
    pixelRatio = nextRatio;
    canvas.width = Math.round(width * pixelRatio);
    canvas.height = Math.round(height * pixelRatio);
    canvas.style.width = width + "px";
    canvas.style.height = height + "px";
    context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
    var nextQuality = qualityForWidth();
    if (!particles.length || nextQuality !== quality) {
      quality = nextQuality;
      buildBouquet();
    }
    draw(performance.now());
  }

  function shadeColor(particle, light) {
    if (particle.kind === "petal" || particle.kind === "wrapper") {
      var offset = light > 0.72 ? 1 : light < 0.32 ? -1 : 0;
      return clamp(particle.color + offset, 0, 5);
    }
    if (particle.color === 7 || particle.color === 8) return light > 0.58 ? 8 : 7;
    return particle.color;
  }

  function queueParticles(time, cosY, sinY, cosX, sinX) {
    var mobile = width < 700;
    var scale = mobile ? Math.min(width * 0.36, height * 0.18) : Math.min(width * 0.2, height * 0.25);
    var originX = mobile ? width * 0.5 : width * 0.72;
    var originY = mobile ? height * 0.7 : height * 0.53;
    var bloomElapsed = time - bloomStart;

    for (var index = 0; index < particles.length; index += 1) {
      var particle = particles[index];
      var x = particle.x;
      var y = particle.y;
      var z = particle.z;
      var entranceVisibility = 1;
      var entranceScale = 1;
      if (isEntering) {
        var entryDelay = particle.entryDelay * entryDuration;
        var entryProgress = clamp((time - entryStart - entryDelay) / Math.max(1, entryDuration - entryDelay), 0, 1);
        var entryEased = easeOutQuint(entryProgress);
        x = particle.ex + (particle.x - particle.ex) * entryEased;
        y = particle.ey + (particle.y - particle.ey) * entryEased;
        z = particle.ez + (particle.z - particle.ez) * entryEased;
        entranceVisibility = clamp(entryProgress * 2.4, 0, 1);
        entranceScale = 0.42 + entryEased * 0.58;
        if (entranceVisibility <= 0.01) continue;
      }
      if (isBlooming) {
        var burstDuration = 430;
        if (bloomElapsed <= burstDuration) {
          var burstProgress = easeOutCubic(clamp(bloomElapsed / burstDuration, 0, 1));
          x += (particle.bx - particle.x) * burstProgress;
          y += (particle.by - particle.y) * burstProgress;
          z += (particle.bz - particle.z) * burstProgress;
        } else {
          var gatherProgress = clamp((bloomElapsed - burstDuration - particle.delay * 1000) / (bloomDuration - burstDuration - particle.delay * 1000), 0, 1);
          var eased = easeOutQuart(gatherProgress);
          x = particle.bx + (particle.x - particle.bx) * eased;
          y = particle.by + (particle.y - particle.by) * eased;
          z = particle.bz + (particle.z - particle.bz) * eased;
        }
      }

      var viewX = x * cosY + z * sinY;
      var viewZ = -x * sinY + z * cosY;
      var viewY = y * cosX - viewZ * sinX;
      var depth = y * sinX + viewZ * cosX;
      var perspective = 7.2 / Math.max(2.5, 7.2 - depth);

      var normalX = particle.nx * cosY + particle.nz * sinY;
      var normalZ = -particle.nx * sinY + particle.nz * cosY;
      var normalY = particle.ny * cosX - normalZ * sinX;
      var normalDepth = particle.ny * sinX + normalZ * cosX;
      var light = clamp((normalX * -0.24 + normalY * 0.34 + normalDepth * 0.91 + 1) * 0.5, 0, 1);
      var depthAmount = clamp((depth + 2.25) / 4.5, 0, 1);
      var twinkle = 0.92 + Math.sin(time * 0.0014 + particle.phase) * 0.08;
      var alphaValue = particle.opacity * entranceVisibility * (0.34 + light * 0.66) * (0.38 + depthAmount * 0.62);
      var alphaIndex = alphaValue > 0.68 ? 2 : alphaValue > 0.38 ? 1 : 0;
      var depthIndex = clamp(Math.floor(depthAmount * depthBinCount), 0, depthBinCount - 1);
      var color = shadeColor(particle, light);

      particle.screenX = originX + viewX * scale * perspective;
      particle.screenY = originY - viewY * scale * perspective;
      particle.screenRadius = clamp(particle.size * perspective * twinkle * entranceScale * (0.74 + light * 0.38), 0.42, 2.52);
      depthBuckets[depthIndex][color][alphaIndex].push(particle);
    }
  }

  function drawDepthBuckets() {
    context.globalCompositeOperation = "source-over";
    for (var depth = 0; depth < depthBuckets.length; depth += 1) {
      var depthFog = 0.28 + (depth / Math.max(1, depthBuckets.length - 1)) * 0.72;
      for (var color = 0; color < palette.length; color += 1) {
        for (var alpha = 0; alpha < alphaLevels.length; alpha += 1) {
          var bucket = depthBuckets[depth][color][alpha];
          if (!bucket.length) continue;
          context.beginPath();
          for (var index = 0; index < bucket.length; index += 1) {
            var particle = bucket[index];
            context.moveTo(particle.screenX + particle.screenRadius, particle.screenY);
            context.arc(particle.screenX, particle.screenY, particle.screenRadius, 0, Math.PI * 2);
          }
          context.globalAlpha = alphaLevels[alpha] * paletteOpacity[color] * depthFog;
          context.fillStyle = palette[color];
          context.fill();
        }
      }
    }
  }

  function draw(time) {
    context.clearRect(0, 0, width, height);
    var angleY = rotationY + hoverRotationY;
    var angleX = rotationX + hoverRotationX;
    var cosY = Math.cos(angleY);
    var sinY = Math.sin(angleY);
    var cosX = Math.cos(angleX);
    var sinX = Math.sin(angleX);
    clearDepthBuckets();
    queueParticles(time, cosY, sinY, cosX, sinX);
    context.save();
    drawDepthBuckets();
    context.restore();
  }

  function setEnteringState(active) {
    isEntering = active;
    root.classList.toggle("is-entering", active);
    if (bloomButton) bloomButton.disabled = active || isBlooming;
  }

  function startEntrance() {
    if (hasEntered || isEntering || reducedMotionQuery.matches) return;
    entryStart = performance.now();
    root.classList.remove("is-entered");
    setEnteringState(true);
    status.textContent = "星光正在折成一束玫瑰……";
    window.requestAnimationFrame(function () {
      window.requestAnimationFrame(function () {
        if (!isEntering) return;
        root.classList.add("is-entered");
      });
    });
    requestFrame();
  }

  function completeEntrance() {
    hasEntered = true;
    setEnteringState(false);
    root.classList.remove("is-entered");
    status.textContent = "花已经抵达。拖动看看它的每一面。";
  }

  function setBloomingState(active) {
    isBlooming = active;
    if (bloomButton) bloomButton.disabled = active || isEntering;
    root.classList.toggle("is-blooming", active);
  }

  function triggerBloom() {
    if (isEntering || isBlooming) return;
    if (reducedMotionQuery.matches) {
      status.textContent = "花束已经为你盛开。";
      return;
    }
    particles.forEach(function (particle) {
      var angle = random() * Math.PI * 2;
      var baseDistance = particle.kind === "stem" ? 0.5 : particle.kind === "wrapper" ? 0.72 : 1.1;
      var distance = baseDistance + random() * 1.55;
      particle.bx = particle.x + Math.cos(angle) * distance;
      particle.by = particle.y + (random() - 0.42) * distance * 1.42;
      particle.bz = particle.z + Math.sin(angle) * distance;
    });
    bloomStart = performance.now();
    setBloomingState(true);
    status.textContent = "星光正在聚成一束玫瑰……";
    requestFrame();
  }

  function completeBloom() {
    setBloomingState(false);
    status.textContent = "花开好了。七夕快乐。";
  }

  function requestFrame() {
    if (frameRequest || !isVisible || reducedMotionQuery.matches) return;
    frameRequest = window.requestAnimationFrame(renderFrame);
  }

  function renderFrame(time) {
    frameRequest = 0;
    if (!lastFrame) lastFrame = time;
    var elapsed = Math.min(40, time - lastFrame);
    var frameInterval = width < 700 ? 1000 / 30 : 1000 / 45;
    if (time - lastFrame < frameInterval) {
      requestFrame();
      return;
    }
    lastFrame = time;
    if (pointerId === null) rotationY += elapsed * 0.0001;
    hoverRotationY += (hoverTargetY - hoverRotationY) * 0.055;
    hoverRotationX += (hoverTargetX - hoverRotationX) * 0.055;
    draw(time);
    if (isEntering && time - entryStart >= entryDuration) completeEntrance();
    if (isBlooming && time - bloomStart >= bloomDuration) completeBloom();
    requestFrame();
  }

  function handlePointerMove(event) {
    var bounds = canvas.getBoundingClientRect();
    if (pointerId === event.pointerId) {
      var deltaX = event.clientX - pointerStartX;
      var deltaY = event.clientY - pointerStartY;
      if (Math.abs(deltaX) + Math.abs(deltaY) > 5) didDrag = true;
      rotationY = rotationStartY + deltaX * 0.008;
      rotationX = clamp(rotationStartX + deltaY * 0.0045, -0.62, 0.4);
      hoverTargetY = 0;
      hoverTargetX = 0;
      draw(performance.now());
      return;
    }
    hoverTargetY = ((event.clientX - bounds.left) / bounds.width - 0.5) * 0.1;
    hoverTargetX = ((event.clientY - bounds.top) / bounds.height - 0.5) * -0.06;
  }

  canvas.addEventListener("pointerdown", function (event) {
    if (isEntering || pointerId !== null) return;
    pointerId = event.pointerId;
    pointerStartX = event.clientX;
    pointerStartY = event.clientY;
    rotationStartY = rotationY;
    rotationStartX = rotationX;
    didDrag = false;
    canvas.setPointerCapture(event.pointerId);
    root.classList.add("is-dragging");
  });

  canvas.addEventListener("pointermove", handlePointerMove);
  canvas.addEventListener("pointerleave", function () {
    if (pointerId !== null) return;
    hoverTargetY = 0;
    hoverTargetX = 0;
  });
  canvas.addEventListener("pointerup", function (event) {
    if (pointerId !== event.pointerId) return;
    if (canvas.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId);
    pointerId = null;
    root.classList.remove("is-dragging");
    if (!didDrag) triggerBloom();
  });
  canvas.addEventListener("pointercancel", function (event) {
    if (pointerId !== event.pointerId) return;
    pointerId = null;
    root.classList.remove("is-dragging");
  });

  if (bloomButton) bloomButton.addEventListener("click", triggerBloom);
  if (shareButton) {
    shareButton.addEventListener("click", function () {
      var shareUrl = window.location.href;
      try {
        var overrideUrl = new URL(String(window.PingFangQixiShareUrl || ""));
        if (overrideUrl.protocol === "http:" || overrideUrl.protocol === "https:") shareUrl = overrideUrl.href;
      } catch (error) {}
      var shareData = {
        title: "送你一束七夕粒子玫瑰",
        text: "把银河折成一束不会凋谢的玫瑰，送给最特别的你。",
        url: shareUrl
      };
      if (navigator.share) {
        navigator.share(shareData).then(
          function () {
            status.textContent = "这束花已经送出去了。";
          },
          function () {}
        );
        return;
      }
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(shareData.url).then(
          function () {
            status.textContent = "链接已复制，可以把这束花送给 TA 了。";
          },
          function () {
            status.textContent = "复制当前页面地址，就可以把花送给 TA。";
          }
        );
      } else {
        status.textContent = "复制当前页面地址，就可以把花送给 TA。";
      }
    });
  }

  window.addEventListener("resize", resizeCanvas, { passive: true });
  document.addEventListener("visibilitychange", function () {
    isVisible = !document.hidden;
    if (isVisible) requestFrame();
  });
  if ("IntersectionObserver" in window) {
    new IntersectionObserver(
      function (entries) {
        isVisible = entries[0] ? entries[0].isIntersecting : true;
        if (isVisible) requestFrame();
      },
      { threshold: 0.01 }
    ).observe(root);
  }

  function handleMotionPreference() {
    if (frameRequest) {
      window.cancelAnimationFrame(frameRequest);
      frameRequest = 0;
    }
    if (reducedMotionQuery.matches) {
      hasEntered = true;
      setEnteringState(false);
      root.classList.remove("is-entered");
      setBloomingState(false);
      status.textContent = "已按照你的动态效果偏好展示静态花束。";
      draw(performance.now());
    } else {
      if (!hasEntered && !isEntering) startEntrance();
      if (!isEntering && !isBlooming) status.textContent = "轻触花束，星光会重新聚拢。";
      requestFrame();
    }
  }

  if (reducedMotionQuery.addEventListener) reducedMotionQuery.addEventListener("change", handleMotionPreference);
  if (!reducedMotionQuery.matches) startEntrance();
  resizeCanvas();
  handleMotionPreference();
})();
