const form = document.getElementById('search-form');
const input = document.getElementById('query');
const submitBtn = document.getElementById('submit-btn');

const heroEl = document.getElementById('hero');
const loadingEl = document.getElementById('loading');
const loadingText = document.getElementById('loading-text');
const errorEl = document.getElementById('error');
const errorText = document.getElementById('error-text');
const errorRetry = document.getElementById('error-retry');

const resultsEl = document.getElementById('results');
const resultsCount = document.getElementById('results-count');
const resultsTopic = document.getElementById('results-topic');
const resultsTopicHighlight = document.getElementById('results-topic-highlight');

const deckWrap = document.getElementById('deck-wrap');
const deckEl = document.getElementById('deck');
const deckPrev = document.getElementById('deck-prev');
const deckNext = document.getElementById('deck-next');
const deckMeta = document.getElementById('deck-meta');
const deckDots = document.getElementById('deck-dots');

const cardsEl = document.getElementById('cards');
const shuffleBtn = document.getElementById('shuffle');
const chipsContainer = document.getElementById('chips');

const viewDeckBtn = document.getElementById('view-deck');
const viewGridBtn = document.getElementById('view-grid');

const LOADING_LINES = [
  'Digging through Reddit threads…',
  'Sifting through r/ communities…',
  'Finding the most upvoted takes…',
  'Separating gold from noise…',
  "Reading comments so you don't have to…",
  'Distilling the good stuff…',
  'Almost there — just one more thread…',
];

let loadingTimer = null;
let currentFacts = [];
let currentTopic = '';
let deckOrder = [];          
let currentPosition = 0;     
let isAnimating = false;
let currentView = 'deck';    

function stripBullet(text) {
  if (!text) return '';
  let s = text.trim();
  s = s.replace(/^[\u2022\u00B7\u25AA\u2023\u25B8\u25BA\u25E6\u25CF\u25CB\-\*>\u2043\u204C\u204D\u2219\u25C6\u25C7\s]+/, '');
  s = s.replace(/^\(?\d{1,3}\)?\s*[\.\)\:\-]\s*/, '');
  s = s.replace(/^[\-\*\u2022\u00B7\s]+/, '');
  return s.trim();
}

function showLoading() {
  loadingEl.hidden = false;
  errorEl.hidden = true;
  resultsEl.hidden = true;

  let i = 0;
  loadingText.textContent = LOADING_LINES[0];
  loadingText.style.opacity = '1';

  loadingTimer = setInterval(() => {
    i = (i + 1) % LOADING_LINES.length;
    loadingText.style.opacity = '0';
    setTimeout(() => {
      loadingText.textContent = LOADING_LINES[i];
      loadingText.style.opacity = '1';
    }, 250);
  }, 2800);
}

function hideLoading() {
  if (loadingTimer) clearInterval(loadingTimer);
  loadingTimer = null;
  loadingEl.hidden = true;
}

function showError(msg) {
  hideLoading();
  errorText.textContent = msg;
  errorEl.hidden = false;
  resultsEl.hidden = true;
}

function hideError() { errorEl.hidden = true; }

function buildDeckCard(fact, idx, topic) {
  const card = document.createElement('article');
  card.className = 'deck-card';
  card.setAttribute('data-variant', String(fact.variant));
  card.setAttribute('data-idx', String(idx));

  const tagText = topic.replace(/\s+/g, '').toLowerCase().slice(0, 20) || 'facts';

  card.innerHTML = `
    <div class="deck-card__header">
      <span class="deck-card__num">FACT ${String(idx + 1).padStart(2, '0')}</span>
      <span class="deck-card__badge">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
          <path d="M12 2v20M6 8l6-6 6 6"/>
        </svg>
        Did you know?
      </span>
    </div>
    <div class="deck-card__body">
      <p class="deck-card__text"></p>
    </div>
    <div class="deck-card__footer">
      <span class="deck-card__tag">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="12" cy="12" r="10"/>
          <path d="M8 14s1.5 2 4 2 4-2 4-2M9 9h.01M15 9h.01"/>
        </svg>
        r/${tagText}
      </span>
      <button class="deck-card__copy" type="button">Copy</button>
    </div>
  `;
  card.querySelector('.deck-card__text').textContent = fact.text;

  const copyBtn = card.querySelector('.deck-card__copy');
  copyBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    navigator.clipboard.writeText(fact.text).then(() => {
      copyBtn.textContent = 'Copied!';
      setTimeout(() => { copyBtn.textContent = 'Copy'; }, 1400);
    }).catch(() => { copyBtn.textContent = 'Error'; });
  });

  return card;
}

function renderDeck() {
  deckEl.innerHTML = '';
  currentFacts.forEach((fact, idx) => {
    deckEl.appendChild(buildDeckCard(fact, idx, currentTopic));
  });
  applyDeckPositions();
  updateDeckMeta();
  renderDots();
}

function applyDeckPositions() {
  const cards = Array.from(deckEl.children);
  deckOrder.forEach((factIdx, orderPos) => {
    const card = cards.find(c => c.getAttribute('data-idx') === String(factIdx));
    if (!card) return;
    if (orderPos === 0) card.setAttribute('data-pos', '0');
    else if (orderPos === 1) card.setAttribute('data-pos', '1');
    else if (orderPos === 2) card.setAttribute('data-pos', '2');
    else if (orderPos === 3) card.setAttribute('data-pos', '3');
    else card.setAttribute('data-pos', 'hidden');
  });
}

function updateDeckMeta() {
  
}

function renderDots() {
  deckDots.innerHTML = '';
  if (currentFacts.length <= 1) return;
  for (let i = 0; i < currentFacts.length; i++) {
    const dot = document.createElement('button');
    dot.className = 'deck-dot';
    dot.type = 'button';
    dot.setAttribute('aria-label', `Go to fact ${i + 1}`);
    if (i === currentPosition) dot.classList.add('deck-dot--active');
    dot.addEventListener('click', () => jumpToPosition(i));
    deckDots.appendChild(dot);
  }
}

function updateActiveDot() {
  const dots = deckDots.querySelectorAll('.deck-dot');
  dots.forEach((d, i) => d.classList.toggle('deck-dot--active', i === currentPosition));
}

function goNext() {
  if (isAnimating || currentFacts.length < 2) return;
  isAnimating = true;

  const cards = Array.from(deckEl.children);
  const frontFactIdx = deckOrder[0];
  const frontCard = cards.find(c => c.getAttribute('data-idx') === String(frontFactIdx));
  if (!frontCard) { isAnimating = false; return; }

  frontCard.setAttribute('data-pos', 'exit-right');

  setTimeout(() => {
    
    const first = deckOrder.shift();
    deckOrder.push(first);
    
    currentPosition = (currentPosition + 1) % currentFacts.length;
    applyDeckPositions();
    updateDeckMeta();
    updateActiveDot();
    isAnimating = false;
  }, 450);
}

function goPrev() {
  if (isAnimating || currentFacts.length < 2) return;
  isAnimating = true;

  const last = deckOrder.pop();
  deckOrder.unshift(last);
  
  currentPosition = (currentPosition - 1 + currentFacts.length) % currentFacts.length;

  const cards = Array.from(deckEl.children);
  const newFrontCard = cards.find(c => c.getAttribute('data-idx') === String(last));
  if (newFrontCard) {
    newFrontCard.setAttribute('data-pos', 'enter-left');
  }

  void deckEl.offsetWidth;

  requestAnimationFrame(() => {
    applyDeckPositions();
    updateDeckMeta();
    updateActiveDot();
    setTimeout(() => { isAnimating = false; }, 500);
  });
}

function jumpToPosition(targetPos) {
  if (isAnimating) return;
  if (targetPos === currentPosition) return;
  if (targetPos < 0 || targetPos >= currentFacts.length) return;

  const steps = (targetPos - currentPosition + currentFacts.length) % currentFacts.length;

  for (let i = 0; i < steps; i++) {
    const first = deckOrder.shift();
    deckOrder.push(first);
  }
  currentPosition = targetPos;
  applyDeckPositions();
  updateDeckMeta();
  updateActiveDot();
}

function renderGrid() {
  cardsEl.innerHTML = '';
  currentFacts.forEach((fact, idx) => {
    const card = document.createElement('div');
    card.className = 'card';
    card.setAttribute('data-variant', String(fact.variant));

    const tagText = currentTopic.replace(/\s+/g, '').toLowerCase().slice(0, 20) || 'facts';

    card.innerHTML = `
      <div class="card__header">
        <span class="card__num">FACT ${String(idx + 1).padStart(2, '0')}</span>
        <span class="card__badge">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
            <path d="M12 2v20M6 8l6-6 6 6"/>
          </svg>
          Did you know?
        </span>
      </div>
      <div class="card__body"></div>
      <div class="card__footer">
        <span class="card__tag">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="12" cy="12" r="10"/>
            <path d="M8 14s1.5 2 4 2 4-2 4-2M9 9h.01M15 9h.01"/>
          </svg>
          <span>r/${tagText}</span>
        </span>
        <button class="card__copy" type="button">Copy</button>
      </div>
    `;
    card.querySelector('.card__body').textContent = fact.text;

    const copyBtn = card.querySelector('.card__copy');
    copyBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      navigator.clipboard.writeText(fact.text).then(() => {
        copyBtn.textContent = 'Copied!';
        setTimeout(() => { copyBtn.textContent = 'Copy'; }, 1400);
      });
    });

    cardsEl.appendChild(card);
  });
}

function setView(view) {
  currentView = view;

  if (view === 'deck') {
    viewDeckBtn.classList.add('view-toggle__btn--active');
    viewDeckBtn.setAttribute('aria-pressed', 'true');
    viewGridBtn.classList.remove('view-toggle__btn--active');
    viewGridBtn.setAttribute('aria-pressed', 'false');

    deckWrap.hidden = false;
    deckMeta.hidden = false;
    cardsEl.hidden = true;
  } else {
    viewGridBtn.classList.add('view-toggle__btn--active');
    viewGridBtn.setAttribute('aria-pressed', 'true');
    viewDeckBtn.classList.remove('view-toggle__btn--active');
    viewDeckBtn.setAttribute('aria-pressed', 'false');

    deckWrap.hidden = true;
    deckMeta.hidden = true;
    cardsEl.hidden = false;
  }
}

function displayResults(topic, bullets) {
  hideLoading();
  hideError();

  const rawFacts = bullets.map(stripBullet).filter(f => f && f.length > 3);
  if (rawFacts.length === 0) {
    showError("We couldn't find any facts for that topic. Try something else!");
    return;
  }

  const facts = rawFacts.map((text, idx) => ({
    text,
    variant: (idx % 6) + 1
  }));

  currentFacts = facts;
  currentTopic = topic;
  deckOrder = facts.map((_, i) => i);
  currentPosition = 0;

  resultsCount.textContent = `${facts.length} fact${facts.length === 1 ? '' : 's'}`;
  resultsTopic.textContent = topic;
  resultsTopicHighlight.textContent = topic;

  renderDeck();
  renderGrid();
  setView(currentView);

  resultsEl.hidden = false;

  setTimeout(() => {
    resultsEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, 80);
}

async function submitTopic(query) {
  submitBtn.disabled = true;
  showLoading();

  try {
    const res = await fetch('/api/facts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query }),
    });
    const data = await res.json();

    if (!res.ok) {
      showError(data.error || "Something went wrong. Try again in a moment.");
      return;
    }
    if (!data.bullets || data.bullets.length === 0) {
      showError("No facts came back for that topic. Try being more specific or pick a different subject.");
      return;
    }
    displayResults(data.query || query, data.bullets);
  } catch (err) {
    console.error(err);
    showError("We lost the connection. Check your network and try again.");
  } finally {
    submitBtn.disabled = false;
  }
}

form.addEventListener('submit', (e) => {
  e.preventDefault();
  const q = input.value.trim();
  if (!q) return;
  submitTopic(q);
});

const TOPIC_POOL = [
  { emoji: '🐙', label: 'octopuses',          topic: 'octopuses' },
  { emoji: '🏛️', label: 'Roman Empire',        topic: 'the Roman Empire' },
  { emoji: '🌊', label: 'deep sea',            topic: 'deep sea creatures' },
  { emoji: '🚀', label: 'space',               topic: 'space exploration' },
  { emoji: '🔺', label: 'ancient Egypt',       topic: 'ancient Egypt' },
  { emoji: '🦕', label: 'dinosaurs',           topic: 'dinosaurs' },
  { emoji: '🧠', label: 'the human brain',     topic: 'the human brain' },
  { emoji: '🌙', label: 'the Moon',            topic: 'the Moon' },
  { emoji: '⚡', label: 'Nikola Tesla',        topic: 'Nikola Tesla' },
  { emoji: '🐝', label: 'bees',                topic: 'bees' },
  { emoji: '🗽', label: 'New York City',       topic: 'New York City' },
  { emoji: '🍄', label: 'mushrooms',           topic: 'mushrooms' },
  { emoji: '🐋', label: 'whales',              topic: 'whales' },
  { emoji: '🏔️', label: 'Mount Everest',       topic: 'Mount Everest' },
  { emoji: '🎹', label: 'Mozart',              topic: 'Mozart' },
  { emoji: '🦑', label: 'the Kraken',          topic: 'the Kraken' },
  { emoji: '🏴‍☠️', label: 'pirates',            topic: 'pirates' },
  { emoji: '🧛', label: 'vampires',            topic: 'vampires' },
  { emoji: '🌋', label: 'volcanoes',           topic: 'volcanoes' },
  { emoji: '⚔️', label: 'Vikings',             topic: 'Vikings' },
  { emoji: '🐺', label: 'wolves',              topic: 'wolves' },
  { emoji: '🕷️', label: 'spiders',             topic: 'spiders' },
  { emoji: '🦈', label: 'sharks',              topic: 'sharks' },
  { emoji: '🐘', label: 'elephants',           topic: 'elephants' },
  { emoji: '🧬', label: 'DNA',                 topic: 'DNA' },
  { emoji: '🌌', label: 'black holes',         topic: 'black holes' },
  { emoji: '⏳', label: 'time travel',         topic: 'time travel' },
  { emoji: '🏰', label: 'medieval castles',    topic: 'medieval castles' },
  { emoji: '👑', label: 'Cleopatra',           topic: 'Cleopatra' },
  { emoji: '☕', label: 'coffee',              topic: 'coffee' },
  { emoji: '🍫', label: 'chocolate',           topic: 'chocolate' },
  { emoji: '🍕', label: 'pizza',               topic: 'pizza' },
  { emoji: '🐱', label: 'cats',                topic: 'cats' },
  { emoji: '🐶', label: 'dogs',                topic: 'dogs' },
  { emoji: '🎬', label: 'Hollywood',           topic: 'classic Hollywood' },
  { emoji: '🎸', label: 'The Beatles',         topic: 'The Beatles' },
  { emoji: '🧪', label: 'Marie Curie',         topic: 'Marie Curie' },
  { emoji: '📐', label: 'ancient Greece',      topic: 'ancient Greece' },
  { emoji: '🏺', label: 'Pompeii',             topic: 'Pompeii' },
  { emoji: '🗿', label: 'Easter Island',       topic: 'Easter Island' },
  { emoji: '🦖', label: 'T. rex',              topic: 'Tyrannosaurus rex' },
  { emoji: '🐊', label: 'crocodiles',          topic: 'crocodiles' },
  { emoji: '🪐', label: 'Saturn',              topic: 'Saturn' },
  { emoji: '☄️', label: 'comets',              topic: 'comets' },
  { emoji: '🧊', label: 'Antarctica',          topic: 'Antarctica' },
  { emoji: '🏜️', label: 'the Sahara',          topic: 'the Sahara Desert' },
  { emoji: '🎨', label: 'Van Gogh',            topic: 'Vincent van Gogh' },
  { emoji: '📚', label: 'Shakespeare',         topic: 'Shakespeare' },
  { emoji: '🕳️', label: 'the Bermuda Triangle', topic: 'the Bermuda Triangle' },
  { emoji: '🛸', label: 'UFOs',                topic: 'UFO sightings' },
  { emoji: '🧙', label: 'witches',             topic: 'the Salem witch trials' },
  { emoji: '🚂', label: 'steam trains',        topic: 'steam trains' },
  { emoji: '🎭', label: 'Greek mythology',     topic: 'Greek mythology' },
  { emoji: '🐉', label: 'dragons',             topic: 'dragons in mythology' },
  { emoji: '🦠', label: 'viruses',             topic: 'viruses' },
  { emoji: '🏴', label: 'Scotland',            topic: 'Scotland' },
  { emoji: '🗾', label: 'feudal Japan',        topic: 'feudal Japan' },
  { emoji: '🥋', label: 'samurai',             topic: 'samurai' },
  { emoji: '🐆', label: 'cheetahs',            topic: 'cheetahs' },
  { emoji: '🦜', label: 'parrots',             topic: 'parrots' },
  { emoji: '🐢', label: 'sea turtles',         topic: 'sea turtles' },
];

function buildRandomChips() {
  
  const pool = [...TOPIC_POOL];
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  const picks = pool.slice(0, 5);

  const label = chipsContainer.querySelector('.chips__label');
  chipsContainer.innerHTML = '';
  if (label) chipsContainer.appendChild(label);

  picks.forEach(({ emoji, label: lbl, topic }) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'chip';
    btn.textContent = `${emoji} ${lbl}`;
    btn.addEventListener('click', () => {
      input.value = topic;
      submitTopic(topic);
    });
    chipsContainer.appendChild(btn);
  });
}

shuffleBtn.addEventListener('click', () => {
  if (currentFacts.length < 2) return;
  const indices = [...deckOrder];
  for (let i = indices.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [indices[i], indices[j]] = [indices[j], indices[i]];
  }

  const shuffledFacts = indices.map(idx => currentFacts[idx]);
  currentFacts = shuffledFacts;
  deckOrder = shuffledFacts.map((_, i) => i);
  currentPosition = 0;
  renderDeck();
  renderGrid();
});

errorRetry.addEventListener('click', () => {
  hideError();
  input.focus();
});

deckPrev.addEventListener('click', goPrev);
deckNext.addEventListener('click', goNext);

viewDeckBtn.addEventListener('click', () => setView('deck'));
viewGridBtn.addEventListener('click', () => setView('grid'));

document.addEventListener('keydown', (e) => {
  if (currentView !== 'deck') return;
  if (resultsEl.hidden) return;
  const tag = document.activeElement && document.activeElement.tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA') return;

  if (e.key === 'ArrowRight') { e.preventDefault(); goNext(); }
  else if (e.key === 'ArrowLeft') { e.preventDefault(); goPrev(); }
});

let touchStartX = 0;
let touchStartY = 0;
let touching = false;

deckEl.addEventListener('touchstart', (e) => {
  if (e.touches.length !== 1) return;
  touchStartX = e.touches[0].clientX;
  touchStartY = e.touches[0].clientY;
  touching = true;
}, { passive: true });

deckEl.addEventListener('touchend', (e) => {
  if (!touching) return;
  touching = false;
  const t = e.changedTouches[0];
  const dx = t.clientX - touchStartX;
  const dy = t.clientY - touchStartY;
  
  if (Math.abs(dy) > Math.abs(dx)) return;
  if (dx < -50) goNext();
  else if (dx > 50) goPrev();
}, { passive: true });

deckEl.addEventListener('click', (e) => {
  
  if (e.target.closest('button')) return;
  const card = e.target.closest('.deck-card');
  if (!card) return;
  if (card.getAttribute('data-pos') === '0') goNext();
});

loadingText.style.transition = 'opacity 0.25s ease';

window.addEventListener('load', () => {
  buildRandomChips();
  input.focus();
});
