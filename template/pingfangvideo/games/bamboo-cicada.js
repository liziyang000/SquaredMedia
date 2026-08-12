(function () {
  "use strict";

  var ROUND_DURATION = 36000;
  var MAX_VELOCITY = 10;
  var FULL_TURN = Math.PI * 2;
  var BEST_SCORE_KEY = "pingfang_bamboo_cicada_best";
  var STAGES = [
    { id: "awaken", label: "一 · 起鸣", start: 0, end: 7000 },
    { id: "resonance", label: "二 · 共鸣", start: 7000, end: 25000 },
    { id: "challenge", label: "三 · 应变", start: 25000, end: ROUND_DURATION }
  ];

  function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
  }

  function normalizeAngle(value) {
    while (value > Math.PI) value -= FULL_TURN;
    while (value < -Math.PI) value += FULL_TURN;
    return value;
  }

  function paddedScore(value) {
    return String(Math.max(0, Math.round(value))).padStart(4, "0");
  }

  function setText(node, value) {
    if (node && node.textContent !== String(value)) node.textContent = String(value);
  }

  function readBestScore() {
    try {
      return Number(window.localStorage.getItem(BEST_SCORE_KEY)) || 0;
    } catch (error) {
      return 0;
    }
  }

  function writeBestScore(value) {
    try {
      window.localStorage.setItem(BEST_SCORE_KEY, String(value));
    } catch (error) {}
  }

  function createCicadaAudio() {
    var context = null;
    var source = null;
    var filter = null;
    var shimmerFilter = null;
    var output = null;
    var shimmer = null;
    var master = null;
    var panner = null;
    var tremolo = null;
    var tremoloDepth = null;

    function destinationNode() {
      return panner || master;
    }

    function ensure() {
      if (context) return context;
      var AudioContext = window.AudioContext || window.webkitAudioContext;
      if (!AudioContext) return null;

      context = new AudioContext();
      var buffer = context.createBuffer(1, context.sampleRate * 2, context.sampleRate);
      var channel = buffer.getChannelData(0);
      for (var index = 0; index < channel.length; index += 1) {
        channel[index] = Math.random() * 2 - 1;
      }

      source = context.createBufferSource();
      source.buffer = buffer;
      source.loop = true;

      filter = context.createBiquadFilter();
      filter.type = "bandpass";
      filter.frequency.value = 1850;
      filter.Q.value = 5.4;

      shimmerFilter = context.createBiquadFilter();
      shimmerFilter.type = "highpass";
      shimmerFilter.frequency.value = 3200;
      shimmer = context.createGain();
      shimmer.gain.value = 0;

      output = context.createGain();
      output.gain.value = 0;
      master = context.createGain();
      master.gain.value = 0.82;

      if (context.createStereoPanner) {
        panner = context.createStereoPanner();
        panner.connect(master);
      }
      master.connect(context.destination);

      tremolo = context.createOscillator();
      tremolo.type = "square";
      tremolo.frequency.value = 38;
      tremoloDepth = context.createGain();
      tremoloDepth.gain.value = 0;

      source.connect(filter).connect(output).connect(destinationNode());
      source.connect(shimmerFilter).connect(shimmer).connect(destinationNode());
      tremolo.connect(tremoloDepth).connect(output.gain);
      source.start();
      tremolo.start();
      return context;
    }

    function resume() {
      var audioContext = ensure();
      if (audioContext && audioContext.state === "suspended") audioContext.resume();
    }

    function setIntensity(intensity, sweet, angle, energy) {
      if (!context || !output) return;
      var now = context.currentTime;
      var audible = clamp(intensity, 0, 1);
      var target = audible < 0.07 ? 0 : 0.014 + audible * (sweet ? 0.062 : 0.038);
      output.gain.setTargetAtTime(target, now, 0.035);
      shimmer.gain.setTargetAtTime(target * (0.08 + energy * 0.24), now, 0.05);
      tremoloDepth.gain.setTargetAtTime(target * 0.3, now, 0.04);
      filter.frequency.setTargetAtTime(1450 + audible * 2300 + energy * 260, now, 0.05);
      filter.Q.setTargetAtTime(4.2 + energy * 3.6, now, 0.06);
      tremolo.frequency.setTargetAtTime(26 + audible * 38, now, 0.05);
      if (panner) panner.pan.setTargetAtTime(Math.sin(angle) * 0.34, now, 0.06);
    }

    function playCue(kind) {
      var audioContext = ensure();
      if (!audioContext) return;
      var settings = {
        tick: [920, 1080, 0.035, 0.008, "triangle"],
        perfect: [980, 1560, 0.14, 0.045, "triangle"],
        good: [680, 920, 0.1, 0.028, "sine"],
        miss: [210, 130, 0.13, 0.02, "sawtooth"],
        stage: [460, 760, 0.18, 0.035, "triangle"],
        event: [330, 220, 0.16, 0.032, "square"]
      }[kind];
      if (!settings) return;

      var now = audioContext.currentTime;
      var oscillator = audioContext.createOscillator();
      var gain = audioContext.createGain();
      oscillator.type = settings[4];
      oscillator.frequency.setValueAtTime(settings[0], now);
      oscillator.frequency.exponentialRampToValueAtTime(settings[1], now + settings[2]);
      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.exponentialRampToValueAtTime(settings[3], now + 0.012);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + settings[2]);
      oscillator.connect(gain).connect(destinationNode());
      oscillator.start(now);
      oscillator.stop(now + settings[2] + 0.02);
    }

    function dispose() {
      if (!context) return;
      setIntensity(0, false, 0, 0);
      context.close();
      context = null;
    }

    return { resume: resume, setIntensity: setIntensity, playCue: playCue, dispose: dispose };
  }

  function initGame(root) {
    if (root.dataset.cicadaReady === "true") return;
    root.dataset.cicadaReady = "true";

    var arena = root.querySelector("[data-cicada-arena]");
    var layout = root.querySelector(".bamboo-cicada-layout");
    var rig = root.querySelector("[data-cicada-rig]");
    var toy = root.querySelector("[data-cicada-toy]");
    var beatRing = root.querySelector("[data-cicada-beat]");
    var resonance = root.querySelector("[data-cicada-resonance]");
    var particleLayer = root.querySelector("[data-cicada-particles]");
    var scoreNode = root.querySelector("[data-cicada-score]");
    var bestNode = root.querySelector("[data-cicada-best]");
    var comboNode = root.querySelector("[data-cicada-combo]");
    var timeNode = root.querySelector("[data-cicada-time]");
    var stageNode = root.querySelector("[data-cicada-stage]");
    var speedNode = root.querySelector("[data-cicada-speed]");
    var targetNode = root.querySelector("[data-cicada-target]");
    var directionNode = root.querySelector("[data-cicada-direction]");
    var energyNode = root.querySelector("[data-cicada-energy]");
    var energyLabel = root.querySelector("[data-cicada-energy-label]");
    var statusNode = root.querySelector("[data-cicada-status]");
    var judgmentNode = root.querySelector("[data-cicada-judgment]");
    var perfectNode = root.querySelector("[data-cicada-perfect]");
    var goodNode = root.querySelector("[data-cicada-good]");
    var missNode = root.querySelector("[data-cicada-miss]");
    var eventNode = root.querySelector("[data-cicada-event]");
    var eventIcon = root.querySelector("[data-cicada-event-icon]");
    var eventTitle = root.querySelector("[data-cicada-event-title]");
    var eventCopy = root.querySelector("[data-cicada-event-copy]");
    var phaseNodes = Array.prototype.slice.call(root.querySelectorAll("[data-cicada-phase]"));
    var startButton = root.querySelector("[data-cicada-start]");
    var soundButton = root.querySelector("[data-cicada-sound]");
    var result = root.querySelector("[data-cicada-result]");
    var resultTitle = root.querySelector("[data-cicada-result-title]");
    var resultGrade = root.querySelector("[data-cicada-result-grade]");
    var resultScore = root.querySelector("[data-cicada-result-score]");
    var resultPower = root.querySelector("[data-cicada-result-power]");
    var resultStability = root.querySelector("[data-cicada-result-stability]");
    var resultRhythm = root.querySelector("[data-cicada-result-rhythm]");
    var resultResponse = root.querySelector("[data-cicada-result-response]");
    var retryButton = root.querySelector("[data-cicada-retry]");
    if (!arena || !rig || !toy || !startButton || !retryButton) return;

    var audio = createCicadaAudio();
    var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    var state = {
      angle: -0.42,
      velocity: 0,
      dragging: false,
      pointerId: null,
      pointerAngle: 0,
      pointerTime: 0,
      running: false,
      finished: false,
      visible: true,
      startedAt: 0,
      lastFrame: performance.now(),
      score: 0,
      combo: 1,
      best: readBestScore(),
      soundEnabled: true,
      keyDirection: 0,
      stageIndex: -1,
      targetCenter: 0.42,
      targetWidth: 0.3,
      energy: 0.25,
      lastIntensity: 0,
      baseDirection: 0,
      requiredDirection: 0,
      windDirection: Math.random() < 0.5 ? -1 : 1,
      currentEvent: "",
      reverseActivated: false,
      reverseStartedAt: 0,
      reverseResponseMs: null,
      rotationTravel: 0,
      lastRevolutionAt: 0,
      lastTargetBeatAt: 0,
      nextTargetBeatAt: 0,
      judgmentUntil: 0,
      perfect: 0,
      good: 0,
      miss: 0,
      powerIntegral: 0,
      stabilityIntegral: 0,
      toyLag: 0,
      toyLagVelocity: 0
    };
    var observer = null;

    root.dataset.reducedMotion = reduceMotion ? "true" : "false";
    root.dataset.cicadaRunning = "false";
    root.dataset.cicadaVisible = "true";
    setText(bestNode, paddedScore(state.best));

    function angleFromPointer(event) {
      var bounds = arena.getBoundingClientRect();
      return Math.atan2(event.clientY - (bounds.top + bounds.height / 2), event.clientX - (bounds.left + bounds.width / 2));
    }

    function setStatus(text, level) {
      setText(statusNode, text);
      if (root.dataset.cicadaState !== level) root.dataset.cicadaState = level;
    }

    function haptic(pattern) {
      if (reduceMotion || !window.navigator.vibrate) return;
      window.navigator.vibrate(pattern);
    }

    function updateCounts() {
      setText(perfectNode, state.perfect);
      setText(goodNode, state.good);
      setText(missNode, state.miss);
      setText(comboNode, "连鸣 ×" + state.combo);
    }

    function updateStage(index) {
      if (state.stageIndex === index) return;
      state.stageIndex = index;
      root.dataset.cicadaStage = STAGES[index].id;
      setText(stageNode, STAGES[index].label);
      phaseNodes.forEach(function (node, nodeIndex) {
        if (nodeIndex === index) node.setAttribute("aria-current", "step");
        else node.removeAttribute("aria-current");
      });
      if (index > 0 && state.soundEnabled) audio.playCue("stage");
    }

    function stageIndexForElapsed(elapsed) {
      if (elapsed < STAGES[0].end) return 0;
      if (elapsed < STAGES[1].end) return 1;
      return 2;
    }

    function eventForElapsed(elapsed) {
      if (elapsed >= 11000 && elapsed < 15000) return "wind-one";
      if (elapsed >= 20500 && elapsed < 23500) return "wind-two";
      if (elapsed >= 25500 && elapsed < 28000) return "reverse-warning";
      if (elapsed >= 28000) return "reverse";
      return "";
    }

    function updateEvent(elapsed, now) {
      var eventKey = eventForElapsed(elapsed);
      if (eventKey === "reverse" && !state.reverseActivated) {
        state.reverseActivated = true;
        state.requiredDirection = -(state.baseDirection || 1);
        state.reverseStartedAt = now;
        state.rotationTravel = 0;
        state.lastRevolutionAt = 0;
        if (state.soundEnabled) audio.playCue("event");
        haptic([8, 36, 8]);
      }

      if (state.currentEvent !== eventKey) {
        state.currentEvent = eventKey;
        eventNode.dataset.active = eventKey ? "true" : "false";
        root.dataset.cicadaEvent = eventKey || "none";
        if ((eventKey === "wind-one" || eventKey === "wind-two" || eventKey === "reverse-warning") && state.soundEnabled) {
          audio.playCue("event");
        }
      }

      if (!eventKey) return;
      if (eventKey === "wind-one" || eventKey === "wind-two") {
        var wind = eventKey === "wind-one" ? state.windDirection : -state.windDirection;
        setText(eventIcon, wind > 0 ? "→" : "←");
        setText(eventTitle, eventKey === "wind-one" ? "穿林竹风" : "回旋竹风");
        setText(eventCopy, wind > 0 ? "风向右推，收住惯性" : "风向左推，稳住圆周");
        return;
      }
      if (eventKey === "reverse-warning") {
        setText(eventIcon, "↺");
        setText(eventTitle, "反向预备");
        setText(eventCopy, "共鸣环翻红后立即换向");
        return;
      }
      setText(eventIcon, state.requiredDirection > 0 ? "→" : "←");
      setText(eventTitle, state.reverseResponseMs === null ? "反向鸣叫" : "换向成功");
      setText(
        eventCopy,
        state.reverseResponseMs === null
          ? state.requiredDirection > 0
            ? "顺时针转动"
            : "逆时针转动"
          : "守住新的共鸣转速"
      );
    }

    function targetForElapsed(elapsed, eventKey) {
      var center;
      var width;
      if (state.stageIndex === 0) {
        center = 0.34 + clamp(elapsed / STAGES[0].end, 0, 1) * 0.17;
        width = 0.3;
      } else if (state.stageIndex === 1) {
        center = 0.55 + Math.sin((elapsed - STAGES[1].start) / 2300) * 0.09;
        width = 0.25;
      } else {
        center = 0.61 + Math.sin((elapsed - STAGES[2].start) / 1250) * 0.1;
        width = 0.19;
      }
      if (eventKey === "wind-one") center += state.windDirection * 0.07;
      if (eventKey === "wind-two") center -= state.windDirection * 0.07;
      return { center: clamp(center, 0.3, 0.82), width: width };
    }

    function showParticles() {
      if (reduceMotion || !particleLayer || !particleLayer.animate) return;
      for (var index = 0; index < 7; index += 1) {
        var particle = document.createElement("i");
        var angle = (FULL_TURN * index) / 7 + Math.random() * 0.32;
        var distance = 42 + Math.random() * 54;
        var x = Math.cos(angle) * distance;
        var y = Math.sin(angle) * distance;
        particleLayer.appendChild(particle);
        var animation = particle.animate(
          [
            { opacity: 0.9, transform: "translate(-50%, -50%) scale(1) rotate(0deg)" },
            { opacity: 0, transform: "translate(-50%, -50%) translate(" + x + "px, " + y + "px) scale(0.2) rotate(90deg)" }
          ],
          { duration: 460, easing: "cubic-bezier(0.22, 1, 0.36, 1)", fill: "forwards" }
        );
        animation.onfinish = (function (node) {
          return function () {
            node.remove();
          };
        })(particle);
      }
    }

    function showJudgment(label, level, now) {
      setText(judgmentNode, label);
      judgmentNode.dataset.level = level;
      root.dataset.cicadaJudgment = level;
      state.judgmentUntil = now + 620;
      if (!reduceMotion && judgmentNode.animate) {
        judgmentNode.animate(
          [
            { opacity: 0, transform: "translateY(6px) scale(0.9)" },
            { opacity: 1, transform: "translateY(0) scale(1.04)", offset: 0.45 },
            { opacity: 1, transform: "translateY(0) scale(1)" }
          ],
          { duration: 320, easing: "cubic-bezier(0.22, 1, 0.36, 1)" }
        );
      }
    }

    function judgeRevolution(now) {
      if (!state.lastRevolutionAt) {
        state.lastRevolutionAt = now;
        showJudgment("成圈", "ready", now);
        return;
      }

      var revolutionTime = now - state.lastRevolutionAt;
      state.lastRevolutionAt = now;
      if (revolutionTime < 320 || revolutionTime > 4200) return;

      var measuredIntensity = clamp(FULL_TURN / (revolutionTime / 1000) / MAX_VELOCITY, 0, 1);
      var speedError = Math.abs(measuredIntensity - state.targetCenter) / Math.max(state.targetWidth / 2, 0.08);
      var targetPeriod = Math.max(state.nextTargetBeatAt - state.lastTargetBeatAt, 600);
      var timingDistance = Math.min(Math.abs(now - state.lastTargetBeatAt), Math.abs(state.nextTargetBeatAt - now));
      var timingError = clamp(timingDistance / (targetPeriod / 2), 0, 1);
      var directionOk = !state.requiredDirection || Math.sign(state.velocity) === state.requiredDirection;
      var error = speedError * 0.68 + timingError * 0.32;

      if (directionOk && error <= 0.42) {
        state.perfect += 1;
        state.combo = Math.min(12, state.combo + 1);
        state.score += 240 + state.combo * 22;
        state.energy = clamp(state.energy + 0.08, 0, 1);
        showJudgment("准鸣", "perfect", now);
        showParticles();
        if (state.soundEnabled) audio.playCue("perfect");
        haptic(12);
      } else if (directionOk && error <= 0.9) {
        state.good += 1;
        state.combo = Math.min(12, state.combo + 1);
        state.score += 110 + state.combo * 10;
        state.energy = clamp(state.energy + 0.035, 0, 1);
        showJudgment("稳鸣", "good", now);
        if (state.soundEnabled) audio.playCue("good");
      } else {
        state.miss += 1;
        state.combo = 1;
        state.energy = clamp(state.energy - 0.09, 0, 1);
        showJudgment(directionOk ? "失拍" : "错向", "miss", now);
        if (state.soundEnabled) audio.playCue("miss");
      }
      updateCounts();
    }

    function trackRotation(delta, now) {
      if (!state.running) return;
      state.rotationTravel += Math.abs(delta);
      while (state.rotationTravel >= FULL_TURN) {
        state.rotationTravel -= FULL_TURN;
        judgeRevolution(now);
      }
    }

    function resetRound(now) {
      state.running = true;
      state.finished = false;
      state.startedAt = now;
      state.lastFrame = now;
      state.score = 0;
      state.combo = 1;
      state.stageIndex = -1;
      state.velocity = 0;
      state.keyDirection = 0;
      state.energy = 0.25;
      state.lastIntensity = 0;
      state.baseDirection = 0;
      state.requiredDirection = 0;
      state.windDirection = Math.random() < 0.5 ? -1 : 1;
      state.currentEvent = "";
      state.reverseActivated = false;
      state.reverseStartedAt = 0;
      state.reverseResponseMs = null;
      state.rotationTravel = 0;
      state.lastRevolutionAt = 0;
      state.lastTargetBeatAt = now;
      state.nextTargetBeatAt = now + 1300;
      state.judgmentUntil = 0;
      state.perfect = 0;
      state.good = 0;
      state.miss = 0;
      state.powerIntegral = 0;
      state.stabilityIntegral = 0;
      state.toyLag = 0;
      state.toyLagVelocity = 0;
      root.dataset.cicadaRunning = "true";
      root.dataset.cicadaJudgment = "ready";
      root.dataset.cicadaEvent = "none";
      eventNode.dataset.active = "false";
      if (layout) layout.inert = false;
      setText(scoreNode, "0000");
      setText(timeNode, "36.0");
      setText(judgmentNode, "起鸣");
      judgmentNode.dataset.level = "ready";
      setText(energyLabel, "25%");
      setText(directionNode, "顺逆皆可");
      result.hidden = true;
      startButton.textContent = "重新开始";
      updateCounts();
      updateStage(0);
      setStatus("先把转速送进共鸣区，让第一声蝉鸣响起来。", "ready");
    }

    function startRound() {
      var now = performance.now();
      resetRound(now);
      audio.resume();
      arena.focus({ preventScroll: true });
    }

    function metricValue(value) {
      return Math.round(clamp(value, 0, 1) * 100);
    }

    function finishRound() {
      state.running = false;
      state.finished = true;
      state.dragging = false;
      state.pointerId = null;
      state.keyDirection = 0;
      state.velocity *= 0.3;
      root.dataset.cicadaRunning = "false";
      root.dataset.cicadaEvent = "none";
      root.dataset.cicadaJudgment = "ready";
      eventNode.dataset.active = "false";
      setText(judgmentNode, "终了");
      judgmentNode.dataset.level = "ready";
      if (layout) layout.inert = true;

      var finalScore = Math.round(state.score);
      var roundSeconds = ROUND_DURATION / 1000;
      var power = metricValue(state.powerIntegral / roundSeconds);
      var stability = metricValue(state.stabilityIntegral / roundSeconds);
      var judgments = state.perfect + state.good + state.miss;
      var rhythm = judgments ? Math.round(((state.perfect + state.good * 0.62) / judgments) * 100) : 0;
      var response = state.reverseResponseMs === null ? 0 : Math.round(clamp(1 - Math.max(0, state.reverseResponseMs - 300) / 2600, 0, 1) * 100);
      var rating = power * 0.28 + stability * 0.25 + rhythm * 0.32 + response * 0.15;
      var grade = rating >= 88 ? "S" : rating >= 74 ? "A" : rating >= 58 ? "B" : "C";
      var title = grade === "S" ? "一鸣入林" : grade === "A" ? "余音绕梁" : grade === "B" ? "竹声渐稳" : "再寻共鸣";

      if (finalScore > state.best) {
        state.best = finalScore;
        setText(bestNode, paddedScore(state.best));
        writeBestScore(state.best);
      }
      setText(resultScore, finalScore);
      setText(resultGrade, grade);
      setText(resultTitle, title);
      setText(resultPower, power);
      setText(resultStability, stability);
      setText(resultRhythm, rhythm);
      setText(resultResponse, response);
      root.dataset.cicadaGrade = grade.toLowerCase();
      result.hidden = false;
      retryButton.focus({ preventScroll: true });
      setStatus("三段蝉鸣已经落定，看看这一轮的共鸣分项。", "finished");
      audio.setIntensity(0, false, state.angle, 0);
    }

    function beginPointer(event) {
      if (event.pointerType === "mouse" && event.button !== 0) return;
      if (state.pointerId !== null) return;
      if (!state.running) startRound();
      audio.resume();
      state.dragging = true;
      state.pointerId = event.pointerId;
      state.pointerAngle = angleFromPointer(event);
      state.pointerTime = performance.now();
      state.angle = state.pointerAngle;
      arena.setPointerCapture(event.pointerId);
      event.preventDefault();
    }

    function movePointer(event) {
      if (!state.dragging || event.pointerId !== state.pointerId) return;
      var now = performance.now();
      var nextAngle = angleFromPointer(event);
      var delta = normalizeAngle(nextAngle - state.pointerAngle);
      var elapsed = Math.max((now - state.pointerTime) / 1000, 0.008);
      var instantVelocity = clamp(delta / elapsed, -12, 12);
      state.velocity = state.velocity * 0.54 + instantVelocity * 0.46;
      state.angle += delta;
      state.pointerAngle = nextAngle;
      state.pointerTime = now;
      trackRotation(delta, now);
      event.preventDefault();
    }

    function endPointer(event) {
      if (event.pointerId !== state.pointerId) return;
      if (arena.hasPointerCapture(event.pointerId)) arena.releasePointerCapture(event.pointerId);
      state.dragging = false;
      state.pointerId = null;
    }

    function handleKeydown(event) {
      if (event.key === " " || event.key === "Enter") {
        if (!state.running) startRound();
        else state.velocity = clamp(state.velocity + (Math.sign(state.velocity) || 1) * 1.05, -11, 11);
        audio.resume();
        event.preventDefault();
        return;
      }
      if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
      if (!state.running) startRound();
      audio.resume();
      state.keyDirection = event.key === "ArrowRight" ? 1 : -1;
      event.preventDefault();
    }

    function handleKeyup(event) {
      if (event.key === "ArrowRight" && state.keyDirection === 1) state.keyDirection = 0;
      if (event.key === "ArrowLeft" && state.keyDirection === -1) state.keyDirection = 0;
    }

    function updateSoundButton() {
      soundButton.setAttribute("aria-pressed", state.soundEnabled ? "true" : "false");
      soundButton.textContent = state.soundEnabled ? "声音：开" : "声音：关";
    }

    function updateBeatClock(now) {
      var period = FULL_TURN / Math.max(state.targetCenter * MAX_VELOCITY, 2.2) * 1000;
      if (!state.lastTargetBeatAt) {
        state.lastTargetBeatAt = now;
        state.nextTargetBeatAt = now + period;
      }
      if (now >= state.nextTargetBeatAt) {
        state.lastTargetBeatAt = state.nextTargetBeatAt;
        state.nextTargetBeatAt = state.lastTargetBeatAt + period;
        if (state.nextTargetBeatAt <= now) state.nextTargetBeatAt = now + period;
        if (state.stageIndex > 0 && state.soundEnabled) audio.playCue("tick");
      }
      var phase = clamp((now - state.lastTargetBeatAt) / Math.max(state.nextTargetBeatAt - state.lastTargetBeatAt, 1), 0, 1);
      if (beatRing) {
        var scale = 1.08 - phase * 0.22;
        beatRing.style.transform = reduceMotion ? "translate(-50%, -50%)" : "translate(-50%, -50%) scale(" + scale.toFixed(3) + ")";
        beatRing.style.opacity = state.stageIndex === 0 ? "0.38" : String((0.55 + phase * 0.35).toFixed(3));
      }
    }

    function updateToySpring(elapsed) {
      if (reduceMotion) {
        toy.style.transform = "rotate(90deg)";
        return;
      }
      var targetLag = clamp(-state.velocity * 0.045, -0.42, 0.42);
      var acceleration = (targetLag - state.toyLag) * 72 - state.toyLagVelocity * 15;
      state.toyLagVelocity += acceleration * elapsed;
      state.toyLag += state.toyLagVelocity * elapsed;
      toy.style.transform = "rotate(" + (90 + (state.toyLag * 180) / Math.PI).toFixed(3) + "deg)";
    }

    function frame(now) {
      if (!root.isConnected) {
        if (observer) observer.disconnect();
        audio.dispose();
        return;
      }

      var elapsed = Math.min((now - state.lastFrame) / 1000, 0.05);
      state.lastFrame = now;

      if (!state.dragging) {
        var movement = state.velocity * elapsed;
        state.angle += movement;
        trackRotation(movement, now);
        state.velocity *= Math.pow(0.9, elapsed * 60);
      }

      if (state.running) {
        var gameElapsed = now - state.startedAt;
        var remaining = Math.max(0, ROUND_DURATION - gameElapsed);
        updateStage(stageIndexForElapsed(gameElapsed));
        updateEvent(gameElapsed, now);

        var currentEvent = eventForElapsed(gameElapsed);
        if (currentEvent === "wind-one") state.velocity = clamp(state.velocity + state.windDirection * elapsed * 0.72, -11, 11);
        if (currentEvent === "wind-two") state.velocity = clamp(state.velocity - state.windDirection * elapsed * 0.72, -11, 11);
        if (state.keyDirection) state.velocity = clamp(state.velocity + state.keyDirection * elapsed * 34, -11, 11);

        var target = targetForElapsed(gameElapsed, currentEvent);
        state.targetCenter = target.center;
        state.targetWidth = target.width;
        var targetLeft = clamp(target.center - target.width / 2, 0, 1 - target.width);
        targetNode.style.transform = "translateX(" + (targetLeft * 100).toFixed(2) + "%) scaleX(" + target.width.toFixed(3) + ")";

        var intensity = clamp(Math.abs(state.velocity) / MAX_VELOCITY, 0, 1);
        var lower = target.center - target.width / 2;
        var upper = target.center + target.width / 2;
        var directionOk = !state.requiredDirection || Math.sign(state.velocity) === state.requiredDirection;
        var sweet = intensity >= lower && intensity <= upper && directionOk;

        if (!state.baseDirection && intensity > 0.16) state.baseDirection = Math.sign(state.velocity) || 1;
        if (state.reverseActivated && state.reverseResponseMs === null && directionOk && intensity >= lower) {
          state.reverseResponseMs = now - state.reverseStartedAt;
          if (state.soundEnabled) audio.playCue("perfect");
          haptic([12, 28, 12]);
        }

        if (sweet) state.energy += elapsed * 0.13;
        else state.energy -= elapsed * (intensity < 0.09 ? 0.14 : 0.08);
        if (intensity > upper + 0.12) state.energy -= elapsed * 0.18;
        state.energy = clamp(state.energy, 0, 1);

        var powerQuality = clamp(1 - Math.abs(intensity - target.center) / Math.max(target.center, 0.2), 0, 1);
        var intensityDelta = Math.abs(intensity - state.lastIntensity);
        var stabilityQuality = intensity > 0.08 ? clamp(1 - intensityDelta / Math.max(elapsed * 1.8, 0.028), 0, 1) : 0;
        state.powerIntegral += powerQuality * elapsed;
        state.stabilityIntegral += stabilityQuality * elapsed;
        state.lastIntensity = intensity;

        if (intensity > 0.05) {
          var control = directionOk ? clamp(1 - Math.abs(intensity - target.center) / target.width, 0.15, 1) : 0.08;
          state.score += elapsed * 100 * intensity * (0.6 + control * 1.4) * (1 + (state.combo - 1) * 0.05) * (0.65 + state.energy * 0.45);
          setText(scoreNode, paddedScore(state.score));
        }

        setText(timeNode, (remaining / 1000).toFixed(1));
        setText(energyLabel, Math.round(state.energy * 100) + "%");
        setText(
          directionNode,
          state.requiredDirection ? (state.requiredDirection > 0 ? "顺时针 →" : "← 逆时针") : state.stageIndex === 2 ? "准备换向" : "顺逆皆可"
        );
        speedNode.style.transform = "scaleX(" + intensity.toFixed(3) + ")";
        energyNode.style.transform = "scaleX(" + state.energy.toFixed(3) + ")";
        rig.style.transform = "rotate(" + state.angle.toFixed(5) + "rad)";
        if (resonance) resonance.style.opacity = String((intensity * (0.35 + state.energy * 0.65)).toFixed(3));
        updateBeatClock(now);
        updateToySpring(elapsed);

        if (now > state.judgmentUntil && root.dataset.cicadaJudgment !== "ready") root.dataset.cicadaJudgment = "ready";

        if (currentEvent === "reverse-warning") setStatus("收住一点惯性，等红色共鸣环出现后立刻反向。", "warning");
        else if (state.requiredDirection && !directionOk) setStatus("方向不对，跟着箭头换向甩动。", "wrong");
        else if (state.energy <= 0.04) setStatus("鸣力快断了，先回到亮起的共鸣区。", "quiet");
        else if (intensity < lower) setStatus("再加一点力，追上正在移动的共鸣区。", "warming");
        else if (intensity <= upper) setStatus(state.stageIndex === 0 ? "起鸣成功，保持圆周。" : "共鸣正稳，等环收紧时完成这一圈。", "sweet");
        else setStatus("转得过急，收力避免鸣力散掉。", "fast");

        audio.setIntensity(state.soundEnabled && state.visible ? intensity : 0, sweet, state.angle, state.energy);
        if (remaining <= 0) finishRound();
      } else {
        rig.style.transform = "rotate(" + state.angle.toFixed(5) + "rad)";
        updateToySpring(elapsed);
        if (!state.finished) audio.setIntensity(0, false, state.angle, 0);
      }

      window.requestAnimationFrame(frame);
    }

    arena.addEventListener("pointerdown", beginPointer);
    arena.addEventListener("pointermove", movePointer);
    arena.addEventListener("pointerup", endPointer);
    arena.addEventListener("pointercancel", endPointer);
    arena.addEventListener("keydown", handleKeydown);
    arena.addEventListener("keyup", handleKeyup);
    arena.addEventListener("blur", function () {
      state.keyDirection = 0;
    });
    startButton.addEventListener("click", startRound);
    retryButton.addEventListener("click", startRound);
    soundButton.addEventListener("click", function () {
      state.soundEnabled = !state.soundEnabled;
      updateSoundButton();
      if (state.soundEnabled) audio.resume();
      else audio.setIntensity(0, false, state.angle, 0);
    });

    if ("IntersectionObserver" in window) {
      observer = new IntersectionObserver(function (entries) {
        state.visible = entries[0] ? entries[0].isIntersecting : true;
        root.dataset.cicadaVisible = state.visible ? "true" : "false";
        if (!state.visible) audio.setIntensity(0, false, state.angle, 0);
      });
      observer.observe(root);
    }

    updateSoundButton();
    updateCounts();
    window.requestAnimationFrame(frame);
  }

  function init(scope) {
    var target = scope || document;
    target.querySelectorAll("[data-bamboo-cicada-game]").forEach(initGame);
  }

  window.PingFangBambooCicada = { init: init };
  if (document.readyState === "loading")
    document.addEventListener(
      "DOMContentLoaded",
      function () {
        init(document);
      },
      { once: true }
    );
  else init(document);
})();
