const WORKER_BASE = 'https://custard.chriskaschner.com';

const QUIZ_CONFIG_PATHS = [
  'quizzes/quiz-classic-v1.json',
  'quizzes/quiz-weather-v1.json',
  'quizzes/quiz-date-night-v1.json',
];

const state = {
  traits: [],
  archetypes: [],
  quizzes: [],
  activeQuiz: null,
};

const els = {
  form: document.getElementById('quiz-form'),
  locationInput: document.getElementById('quiz-location'),
  radiusSelect: document.getElementById('quiz-radius'),
  variantSelect: document.getElementById('quiz-variant'),
  geoBtn: document.getElementById('quiz-geo'),
  questionsWrap: document.getElementById('quiz-questions'),
  submitBtn: document.getElementById('quiz-submit'),
  status: document.getElementById('quiz-status'),
  resultSection: document.getElementById('quiz-result'),
  resultTitle: document.getElementById('result-title'),
  resultFlavor: document.getElementById('result-flavor'),
  resultBlurb: document.getElementById('result-blurb'),
  resultTraits: document.getElementById('result-traits'),
  resultAvailability: document.getElementById('result-availability'),
  resultAlternates: document.getElementById('result-alternates'),
  resultMapLink: document.getElementById('result-map-link'),
};

function setStatus(message, tone = 'neutral') {
  if (!els.status) return;
  els.status.textContent = message;
  els.status.className = `quiz-status quiz-status-${tone}`;
}

function normalizeFlavor(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/\boreo(?:\u00ae)?\b/g, 'oreo')
    .replace(/['’]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

const SIMILARITY_GROUPS = {
  mint: ['andes mint avalanche', 'mint cookie', 'mint explosion'],
  chocolate: [
    'chocolate caramel twist', 'chocolate heath crunch',
    'dark chocolate decadence', 'dark chocolate pb crunch',
    'brownie thunder', 'chocolate volcano', 'chocolate oreo volcano',
  ],
  caramel: [
    'caramel cashew', 'caramel fudge cookie dough', 'caramel pecan',
    'caramel turtle', 'salted caramel pecan pie',
    'salted double caramel pecan', 'caramel peanut buttercup',
    'caramel chocolate pecan',
  ],
  cheesecake: [
    'oreo cheesecake', 'oreo cookie cheesecake',
    'raspberry cheesecake', 'strawberry cheesecake', 'turtle cheesecake',
  ],
  turtle: ['turtle', 'turtle dove', 'turtle cheesecake', 'caramel turtle'],
  cookie: [
    'crazy for cookie dough', 'caramel fudge cookie dough',
    'oreo cookies and cream',
  ],
  peanutButter: [
    'dark chocolate pb crunch', 'peanut butter cup',
    'really reeses', 'caramel peanut buttercup',
  ],
  berry: [
    'blackberry cobbler', 'raspberry cheesecake',
    'double strawberry', 'chocolate covered strawberry',
    'strawberry cheesecake', 'georgia peach',
    'lemon berry layer cake',
  ],
  pecan: [
    'butter pecan', 'caramel pecan', 'salted caramel pecan pie',
    'georgia peach pecan', 'caramel chocolate pecan',
  ],
};

function findSimilarFlavors(target, availableFlavors) {
  const normalizedTarget = normalizeFlavor(target);
  const normalizedAvailable = new Set(availableFlavors.map((f) => normalizeFlavor(f)));
  const similar = new Set();
  for (const members of Object.values(SIMILARITY_GROUPS)) {
    if (members.includes(normalizedTarget)) {
      for (const member of members) {
        if (member !== normalizedTarget && normalizedAvailable.has(member)) {
          similar.add(member);
        }
      }
    }
  }
  return [...similar];
}

// Culver's typical hours end around 10pm local. After that, today's flavors
// are wrapping up. We note this in result messaging.
function isAfterClosing() {
  return new Date().getHours() >= 22;
}

function parseLatLon(value) {
  if (typeof value !== 'string') return null;
  const match = value.trim().match(/^(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)$/);
  if (!match) return null;
  const lat = Number(match[1]);
  const lon = Number(match[2]);
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
  if (lat < -90 || lat > 90 || lon < -180 || lon > 180) return null;
  return { lat, lon, source: 'manual-coords' };
}

async function geocodeLocation(locationText) {
  const manual = parseLatLon(locationText);
  if (manual) return manual;

  const url = 'https://nominatim.openstreetmap.org/search?format=json&limit=1&q='
    + encodeURIComponent(locationText);
  const resp = await fetch(url);
  if (!resp.ok) throw new Error(`Geocoder returned ${resp.status}`);
  const rows = await resp.json();
  if (!Array.isArray(rows) || rows.length === 0) return null;
  const row = rows[0];
  const lat = Number(row.lat);
  const lon = Number(row.lon);
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
  return { lat, lon, source: 'geocoder' };
}

function haversineMiles(lat1, lon1, lat2, lon2) {
  const toRad = (deg) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2
    + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 3958.8 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

async function loadJson(path) {
  const resp = await fetch(path);
  if (!resp.ok) throw new Error(`Failed to load ${path}: ${resp.status}`);
  return resp.json();
}

async function loadConfigs() {
  const [archetypeData, ...quizConfigs] = await Promise.all([
    loadJson('quizzes/flavor-archetypes.json'),
    ...QUIZ_CONFIG_PATHS.map((path) => loadJson(path)),
  ]);
  state.traits = Array.isArray(archetypeData?.traits) ? archetypeData.traits : [];
  state.archetypes = Array.isArray(archetypeData?.archetypes) ? archetypeData.archetypes : [];
  state.quizzes = quizConfigs.filter((quiz) => quiz && quiz.id && Array.isArray(quiz.questions));
}

function populateVariantSelect() {
  els.variantSelect.innerHTML = '';
  for (const quiz of state.quizzes) {
    const opt = document.createElement('option');
    opt.value = quiz.id;
    opt.textContent = quiz.name || quiz.title || quiz.id;
    els.variantSelect.appendChild(opt);
  }
  if (state.quizzes.length > 0) {
    state.activeQuiz = state.quizzes[0];
    els.variantSelect.value = state.activeQuiz.id;
  }
}

function renderQuestions(quiz) {
  els.questionsWrap.innerHTML = '';
  const template = document.getElementById('quiz-header-template');
  if (template) {
    const clone = template.content.cloneNode(true);
    clone.querySelector('[data-quiz-title]').textContent = quiz.title;
    clone.querySelector('[data-quiz-description]').textContent = quiz.description || '';
    els.questionsWrap.appendChild(clone);
  }

  quiz.questions.forEach((question, idx) => {
    const fieldset = document.createElement('fieldset');
    fieldset.className = 'quiz-question';
    fieldset.dataset.questionId = question.id;

    const legend = document.createElement('legend');
    legend.textContent = `${idx + 1}. ${question.prompt}`;
    fieldset.appendChild(legend);

    const grid = document.createElement('div');
    grid.className = 'quiz-options-grid';
    fieldset.appendChild(grid);

    question.options.forEach((option) => {
      const label = document.createElement('label');
      label.className = 'quiz-option';

      const input = document.createElement('input');
      input.type = 'radio';
      input.name = question.id;
      input.value = option.id;

      const copy = document.createElement('span');
      copy.className = 'quiz-option-copy';
      copy.textContent = option.label;

      label.appendChild(input);
      label.appendChild(copy);
      grid.appendChild(label);
    });

    els.questionsWrap.appendChild(fieldset);
  });
}

function getQuizById(id) {
  return state.quizzes.find((quiz) => quiz.id === id) || null;
}

function collectAnswers(quiz, formEl) {
  const data = new FormData(formEl);
  const traitScores = {};
  const selected = {};

  for (const trait of state.traits) {
    traitScores[trait] = 0;
  }

  for (const question of quiz.questions) {
    const selectedId = data.get(question.id);
    if (!selectedId) {
      throw new Error('Please answer all questions before running your custard forecast.');
    }
    selected[question.id] = String(selectedId);
    const selectedOption = question.options.find((opt) => opt.id === selectedId);
    if (!selectedOption) continue;
    const deltas = selectedOption.traits || {};
    for (const [trait, delta] of Object.entries(deltas)) {
      if (typeof traitScores[trait] !== 'number') traitScores[trait] = 0;
      const value = Number(delta);
      if (!Number.isFinite(value)) continue;
      traitScores[trait] += value;
    }
  }

  return { traitScores, selected };
}

function chooseArchetype(traitScores) {
  const ranked = state.archetypes.map((archetype) => {
    const profile = archetype.profile || {};
    let score = 0;
    for (const [trait, weight] of Object.entries(profile)) {
      const traitValue = Number(traitScores[trait] || 0);
      const profileWeight = Number(weight || 0);
      score += traitValue * profileWeight;
    }
    return { archetype, score };
  }).sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return a.archetype.id.localeCompare(b.archetype.id);
  });

  return ranked[0]?.archetype || null;
}

function pickResultFlavor(quizId, archetype) {
  const flavors = Array.isArray(archetype?.flavors) ? archetype.flavors : [];
  if (flavors.length === 0) return null;
  const storageKey = `quiz:last:${quizId}:${archetype.id}`;
  const previous = localStorage.getItem(storageKey);
  const fallback = flavors[0];
  const next = flavors.find((f) => f !== previous) || fallback;
  localStorage.setItem(storageKey, next);
  return next;
}

async function fetchNearby(locationText) {
  const url = `${WORKER_BASE}/api/v1/nearby-flavors?location=${encodeURIComponent(locationText)}&limit=100`;
  const resp = await fetch(url);
  if (!resp.ok) {
    throw new Error(`Nearby lookup failed (${resp.status})`);
  }
  const data = await resp.json();
  return {
    nearby: Array.isArray(data?.nearby) ? data.nearby : [],
    all_flavors_today: Array.isArray(data?.all_flavors_today) ? data.all_flavors_today : [],
  };
}

function rankAvailabilityMatches(stores, candidateFlavors, center, radiusMiles) {
  const flavorOrder = new Map(candidateFlavors.map((flavor, idx) => [normalizeFlavor(flavor), idx]));
  const within = [];
  const outside = [];

  for (const store of stores) {
    const normalizedStoreFlavor = normalizeFlavor(store.flavor);
    if (!flavorOrder.has(normalizedStoreFlavor)) continue;

    const lat = Number(store.lat);
    const lon = Number(store.lon);
    let distanceMiles = null;
    if (center && Number.isFinite(lat) && Number.isFinite(lon)) {
      distanceMiles = haversineMiles(center.lat, center.lon, lat, lon);
    }

    const row = {
      store,
      flavorOrder: flavorOrder.get(normalizedStoreFlavor),
      distanceMiles,
    };

    if (distanceMiles == null || distanceMiles <= radiusMiles) {
      within.push(row);
    } else {
      outside.push(row);
    }
  }

  const sorter = (a, b) => {
    if (a.flavorOrder !== b.flavorOrder) return a.flavorOrder - b.flavorOrder;
    if (a.distanceMiles != null && b.distanceMiles != null && a.distanceMiles !== b.distanceMiles) {
      return a.distanceMiles - b.distanceMiles;
    }
    return (a.store.rank || 9999) - (b.store.rank || 9999);
  };

  within.sort(sorter);
  outside.sort(sorter);
  return { within, outside };
}

function topTraits(traitScores, limit = 3) {
  return Object.entries(traitScores)
    .sort((a, b) => b[1] - a[1])
    .filter((entry) => entry[1] > 0)
    .slice(0, limit)
    .map(([trait, score]) => ({
      trait,
      score: Math.round(score * 10) / 10,
    }));
}

function formatMiles(value) {
  if (!Number.isFinite(value)) return null;
  return `${value.toFixed(1)} mi`;
}

function renderAlternates(rows, locationText, radiusMiles) {
  els.resultAlternates.innerHTML = '';
  if (!rows || rows.length === 0) {
    const li = document.createElement('li');
    li.textContent = `No additional archetype matches within ${radiusMiles} miles of ${locationText}.`;
    els.resultAlternates.appendChild(li);
    return;
  }
  for (const row of rows.slice(0, 4)) {
    const li = document.createElement('li');
    const store = row.store;
    const distance = row.distanceMiles != null ? ` (${formatMiles(row.distanceMiles)})` : '';
    li.textContent = `${store.flavor} at ${store.name}${distance}`;
    els.resultAlternates.appendChild(li);
  }
}

async function sendQuizEvent(payload) {
  try {
    await fetch(`${WORKER_BASE}/api/v1/quiz/events`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
  } catch {
    // Telemetry is best-effort only.
  }
}

async function runQuiz(evt) {
  evt.preventDefault();
  if (!state.activeQuiz) return;

  const locationText = els.locationInput.value.trim();
  if (!locationText) {
    setStatus('Add a city, ZIP, or coordinates first so we can find nearby flavors.', 'error');
    els.locationInput.focus();
    return;
  }
  const radiusMiles = Number(els.radiusSelect.value || 20);

  els.submitBtn.disabled = true;
  setStatus('Running your personality forecast and checking live nearby flavors...', 'loading');
  els.resultSection.hidden = true;

  try {
    const { traitScores } = collectAnswers(state.activeQuiz, els.form);
    const archetype = chooseArchetype(traitScores);
    if (!archetype) {
      throw new Error('Could not determine an archetype from the selected answers.');
    }
    const candidateFlavors = archetype.flavors || [];
    const lateNight = isAfterClosing();

    // Fetch nearby data and geocode in parallel
    const [nearbyData, center] = await Promise.all([
      fetchNearby(locationText),
      geocodeLocation(locationText).catch(() => null),
    ]);

    const stores = nearbyData.nearby;
    const allFlavorsToday = nearbyData.all_flavors_today;

    // -- Step 1: Match archetype candidates against what is actually available --
    const normalizedCandidates = new Map(candidateFlavors.map((f) => [normalizeFlavor(f), f]));
    const normalizedAvailable = new Map(allFlavorsToday.map((f) => [normalizeFlavor(f), f]));

    let matchedFlavor = null;
    for (const [normCandidate, originalCandidate] of normalizedCandidates) {
      if (normalizedAvailable.has(normCandidate)) {
        matchedFlavor = originalCandidate;
        break;
      }
    }

    // -- Step 2: If no exact match, try similarity groups --
    let similarMatch = null;
    if (!matchedFlavor) {
      for (const candidate of candidateFlavors) {
        const similar = findSimilarFlavors(candidate, allFlavorsToday);
        if (similar.length > 0) {
          const normSimilar = similar[0];
          for (const avail of allFlavorsToday) {
            if (normalizeFlavor(avail) === normSimilar) {
              similarMatch = avail;
              break;
            }
          }
          if (similarMatch) break;
        }
      }
    }

    // -- Step 3: Find the best store serving the matched flavor --
    const resultFlavor = matchedFlavor || similarMatch;
    let bestStore = null;
    let bestDistance = null;
    if (resultFlavor && center) {
      const normalizedResult = normalizeFlavor(resultFlavor);
      const matchingStores = stores
        .filter((s) => normalizeFlavor(s.flavor) === normalizedResult)
        .map((s) => {
          const lat = Number(s.lat);
          const lon = Number(s.lon);
          let dist = null;
          if (Number.isFinite(lat) && Number.isFinite(lon)) {
            dist = haversineMiles(center.lat, center.lon, lat, lon);
          }
          return { ...s, _dist: dist };
        })
        .filter((s) => s._dist != null && s._dist <= radiusMiles)
        .sort((a, b) => a._dist - b._dist);
      if (matchingStores.length > 0) {
        bestStore = matchingStores[0];
        bestDistance = matchingStores[0]._dist;
      }
    }

    // -- Step 4: Fallback if nothing matched --
    const fallbackFlavor = resultFlavor ? null : pickResultFlavor(state.activeQuiz.id, archetype);
    const displayFlavor = resultFlavor || fallbackFlavor;

    // -- Step 5: Build ranked alternates from any archetype + similarity matches --
    // Collect all available flavors that match archetype or similarity groups
    const alternateRows = [];
    const usedFlavors = new Set();
    if (resultFlavor) usedFlavors.add(normalizeFlavor(resultFlavor));

    for (const candidate of candidateFlavors) {
      const normCand = normalizeFlavor(candidate);
      if (usedFlavors.has(normCand)) continue;
      if (!normalizedAvailable.has(normCand)) continue;
      // Find stores serving this flavor within radius
      for (const s of stores) {
        if (normalizeFlavor(s.flavor) !== normCand) continue;
        const lat = Number(s.lat);
        const lon = Number(s.lon);
        let dist = null;
        if (center && Number.isFinite(lat) && Number.isFinite(lon)) {
          dist = haversineMiles(center.lat, center.lon, lat, lon);
        }
        if (dist != null && dist <= radiusMiles) {
          alternateRows.push({ store: s, distanceMiles: dist });
          usedFlavors.add(normCand);
          break;
        }
      }
    }
    alternateRows.sort((a, b) => (a.distanceMiles || 0) - (b.distanceMiles || 0));

    // -- Render results --
    els.resultTitle.textContent = `${archetype.name}: ${archetype.headline}`;
    els.resultFlavor.textContent = displayFlavor || 'Flavor signal unavailable';
    els.resultBlurb.textContent = archetype.blurb || '';

    const traits = topTraits(traitScores, 3);
    els.resultTraits.textContent = traits.length
      ? `Top traits: ${traits.map((t) => `${t.trait} (${t.score})`).join(', ')}`
      : 'Top traits: balanced profile';

    const lateNote = lateNight ? ' Last chance tonight -- stores close around 10pm.' : '';

    if (resultFlavor && bestStore) {
      const dist = bestDistance != null ? ` (${formatMiles(bestDistance)})` : '';
      const addr = bestStore.address ? ` ${bestStore.address}` : '';
      els.resultAvailability.textContent =
        `Available now: ${resultFlavor} at ${bestStore.name}${dist}.${addr}${lateNote}`.trim();
      if (similarMatch && !matchedFlavor) {
        setStatus(
          `No exact archetype flavor today, but ${similarMatch} is a close match and available nearby.`,
          'success',
        );
      } else {
        setStatus('Forecast locked: your archetype flavor is scooping nearby right now.', 'success');
      }
    } else if (resultFlavor && !bestStore) {
      els.resultAvailability.textContent =
        `${resultFlavor} is scooping today, but not within ${radiusMiles} miles of your location.${lateNote}`.trim();
      setStatus('Your flavor is available today, just outside your drive radius.', 'neutral');
    } else {
      const tomorrow = lateNight ? ' Check back tomorrow morning for fresh forecasts.' : ' Check back tomorrow.';
      els.resultAvailability.textContent =
        `Your archetype flavor ${fallbackFlavor} is not scooping nearby today.${tomorrow}`.trim();
      setStatus('No live matches today; showing your archetype flavor for reference.', 'neutral');
    }

    renderAlternates(alternateRows, locationText, radiusMiles);
    const mapFlavor = resultFlavor || fallbackFlavor || '';
    els.resultMapLink.href = `map.html?location=${encodeURIComponent(locationText)}&flavor=${encodeURIComponent(mapFlavor)}`;

    await sendQuizEvent({
      event_type: 'quiz_result',
      quiz_id: state.activeQuiz.id,
      archetype: archetype.id,
      result_flavor: displayFlavor,
      matched_flavor: resultFlavor || null,
      similar_match: similarMatch ? true : false,
      matched_store_slug: bestStore?.slug || null,
      matched_distance_miles: bestDistance ?? null,
      radius_miles: radiusMiles,
      has_radius_match: Boolean(bestStore),
      trait_scores: traitScores,
    });

    els.resultSection.hidden = false;
    els.resultSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
  } catch (err) {
    setStatus(`Unable to run quiz right now: ${err.message}`, 'error');
  } finally {
    els.submitBtn.disabled = false;
  }
}

async function setLocationFromCloudflare() {
  if (els.locationInput.value.trim()) return;
  try {
    const resp = await fetch(`${WORKER_BASE}/api/v1/geolocate`);
    if (!resp.ok) return;
    const geo = await resp.json();
    if (geo?.city && geo?.state) {
      els.locationInput.value = `${geo.city}, ${geo.state}`;
    }
  } catch {
    // no-op
  }
}

async function setLocationFromBrowser() {
  if (!navigator.geolocation) {
    setStatus('Browser geolocation is unavailable. Enter city, ZIP, or coordinates manually.', 'error');
    return;
  }
  setStatus('Detecting your location...', 'loading');
  await new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lat = pos.coords.latitude.toFixed(4);
        const lon = pos.coords.longitude.toFixed(4);
        els.locationInput.value = `${lat},${lon}`;
        setStatus('Location set from browser GPS. Radius filtering will use exact distance.', 'success');
        resolve();
      },
      () => {
        setStatus('Could not access browser location. Enter city, ZIP, or coordinates manually.', 'error');
        resolve();
      },
      { timeout: 7000 },
    );
  });
}

function bindEvents() {
  els.variantSelect.addEventListener('change', () => {
    const next = getQuizById(els.variantSelect.value);
    if (!next) return;
    state.activeQuiz = next;
    renderQuestions(next);
    setStatus(`Loaded quiz: ${next.name}.`, 'neutral');
  });
  els.form.addEventListener('submit', runQuiz);
  els.geoBtn.addEventListener('click', (evt) => {
    evt.preventDefault();
    setLocationFromBrowser();
  });
}

async function init() {
  try {
    await loadConfigs();
    if (!state.quizzes.length || !state.archetypes.length) {
      throw new Error('Quiz configuration is missing.');
    }
    populateVariantSelect();
    renderQuestions(state.activeQuiz);
    bindEvents();
    await setLocationFromCloudflare();
    setStatus('Pick a quiz mode, answer five prompts, then get a live in-radius flavor match.', 'neutral');
  } catch (err) {
    setStatus(`Failed to initialize quiz engine: ${err.message}`, 'error');
    if (els.submitBtn) els.submitBtn.disabled = true;
  }
}

init();
