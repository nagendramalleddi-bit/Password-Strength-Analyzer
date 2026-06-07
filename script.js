/* ============================================================
   PassGuard — Password Strength Analyzer
   script.js
   ============================================================ */

/* ── DOM REFERENCES ── */
const pwInput    = document.getElementById('pwInput');
const eyeBtn     = document.getElementById('eyeBtn');
const meterFill  = document.getElementById('meterFill');
const meterScore = document.getElementById('meterScore');
const crackRow   = document.getElementById('crackRow');
const crackText  = document.getElementById('crackText');
const crackIcon  = document.getElementById('crackIcon');
const checksGrid = document.getElementById('checksGrid');
const sugList    = document.getElementById('sugList');
const historyList = document.getElementById('historyList');
const statLen    = document.getElementById('statLen');
const statPool   = document.getElementById('statPool');
const statBits   = document.getElementById('statBits');
const tierDots   = [0, 1, 2, 3].map(i => document.getElementById('td' + i));

/* ── DATA CONSTANTS ── */
const COMMON = new Set([
  'password', '123456', 'qwerty', 'letmein', 'monkey', 'dragon',
  'sunshine', 'princess', 'football', 'abc123', 'password1', 'iloveyou',
  'admin', 'welcome', 'login', 'master', 'hello', 'shadow', 'superman',
  'batman', '123456789', '12345678', 'password123', '1234567', '111111',
  '000000', 'test', 'user'
]);

const WORDS = [
  'Solar', 'Crimson', 'Phantom', 'Nebula', 'Glacier', 'Vortex',
  'Ember', 'Mystic', 'Quartz', 'Thunder', 'Sapphire', 'Onyx',
  'Atlas', 'Zenith', 'Falcon', 'Raven', 'Storm', 'Blaze', 'Frost', 'Cipher'
];

const SYMS = ['!', '@', '#', '$', '%', '&', '*', '^'];

const TIER_COLORS = ['#ff4d6a', '#ff9340', '#ffd060', '#3ecf8e'];

/* ── STATE ── */
let history = JSON.parse(localStorage.getItem('psa_history') || '[]');

/* ── TOGGLE VISIBILITY ── */
eyeBtn.addEventListener('click', () => {
  const isHidden = pwInput.type === 'password';
  pwInput.type = isHidden ? 'text' : 'password';
  eyeBtn.textContent = isHidden ? '🙈' : '👁️';
});

/* ── HELPER: Character pool size ── */
function calcPool(pw) {
  let pool = 0;
  if (/[a-z]/.test(pw)) pool += 26;
  if (/[A-Z]/.test(pw)) pool += 26;
  if (/[0-9]/.test(pw)) pool += 10;
  if (/[^a-zA-Z0-9]/.test(pw)) pool += 32;
  return pool;
}

/* ── HELPER: Shannon entropy in bits ── */
function calcEntropy(pw) {
  const pool = calcPool(pw);
  return pool > 0 ? Math.round(pw.length * Math.log2(pool)) : 0;
}

/* ── HELPER: Estimated crack time ── */
function crackTime(bits) {
  const guesses = Math.pow(2, bits) / 2;
  const rate    = 1e10; // 10 billion guesses per second (GPU attack)
  const secs    = guesses / rate;

  if (secs < 1)         return ['less than 1 second',              'danger', '⚡'];
  if (secs < 60)        return [Math.round(secs) + ' seconds',     'danger', '⚡'];
  if (secs < 3600)      return [Math.round(secs / 60) + ' minutes','warn',   '⏱️'];
  if (secs < 86400)     return [Math.round(secs / 3600) + ' hours','warn',   '⏱️'];
  if (secs < 31536000)  return [Math.round(secs / 86400) + ' days','warn',   '📅'];
  if (secs < 3.15e9)    return [Math.round(secs / 31536000) + ' years', 'ok', '🛡️'];
  return ['centuries or more', 'ok', '🔒'];
}

/* ── HELPER: Simple non-cryptographic hash (for display only) ── */
function hashPw(pw) {
  let h = 5381;
  for (let i = 0; i < pw.length; i++) {
    h = ((h << 5) + h) ^ pw.charCodeAt(i);
  }
  return (h >>> 0).toString(16).padStart(8, '0');
}

/* ── HELPER: Generate suggested strong passwords ── */
function makeSuggestions() {
  const rand = arr => arr[Math.floor(Math.random() * arr.length)];
  const num  = ()  => Math.floor(100 + Math.random() * 900);
  const sym  = ()  => rand(SYMS);

  return [
    rand(WORDS) + rand(WORDS) + num() + sym(),
    rand(WORDS).toLowerCase() + '-' + rand(WORDS).toLowerCase() + '-' + num(),
    rand(WORDS) + sym() + rand(WORDS) + sym() + num(),
  ];
}

/* ── HELPER: Update the 4 tier indicator dots ── */
function setTierDots(score) {
  tierDots.forEach((dot, i) => {
    dot.style.background = i < score
      ? TIER_COLORS[score - 1]
      : 'var(--surface2)';
  });
}

/* ── COPY suggestion to clipboard ── */
function copySug(pw, idx) {
  navigator.clipboard.writeText(pw).catch(() => {});
  const btn = document.getElementById('sc' + idx);
  const orig = btn.textContent;
  btn.textContent = '✓ Copied';
  btn.classList.add('ok');
  setTimeout(() => {
    btn.textContent = orig;
    btn.classList.remove('ok');
  }, 1500);
}

/* ── MAIN ANALYSIS ── */
function analyze() {
  const pw = pwInput.value;

  /* Reset UI when input is empty */
  if (!pw) {
    meterFill.style.width = '0%';
    meterScore.textContent = '—';
    meterScore.style.color = 'var(--muted)';
    crackRow.className = 'crack-row hidden';
    checksGrid.innerHTML = '';
    sugList.innerHTML = '';
    statLen.textContent  = '0';
    statPool.textContent = '0';
    statBits.textContent = '0';
    setTierDots(0);
    return;
  }

  /* ── Stats ── */
  const pool = calcPool(pw);
  const bits = calcEntropy(pw);

  statLen.textContent  = pw.length;
  statPool.textContent = pool;
  statBits.textContent = bits;

  /* ── Checks ── */
  const checks = [
    { label: '8+ characters',    pass: pw.length >= 8 },
    { label: '12+ characters',   pass: pw.length >= 12 },
    { label: 'Uppercase letter', pass: /[A-Z]/.test(pw) },
    { label: 'Lowercase letter', pass: /[a-z]/.test(pw) },
    { label: 'Digit (0–9)',      pass: /[0-9]/.test(pw) },
    { label: 'Special symbol',   pass: /[^a-zA-Z0-9]/.test(pw) },
    { label: 'Not a common pw',  pass: !COMMON.has(pw.toLowerCase()) },
    { label: 'No repeat chars',  pass: !/(.)\1{2,}/.test(pw) },
  ];

  const passed = checks.filter(c => c.pass).length;
  const score  = passed <= 2 ? 1 : passed <= 4 ? 2 : passed <= 6 ? 3 : 4;

  const labels      = ['', 'Weak', 'Fair', 'Good', 'Strong'];
  const scoreColors = ['', '#ff4d6a', '#ff9340', '#ffd060', '#3ecf8e'];
  const widths      = ['', '25%', '50%', '75%', '100%'];

  /* ── Meter ── */
  meterFill.style.width      = widths[score];
  meterFill.style.background = scoreColors[score];
  meterScore.textContent     = labels[score];
  meterScore.style.color     = scoreColors[score];
  setTierDots(score);

  /* ── Crack time banner ── */
  const [time, severity, icon] = crackTime(bits);
  crackRow.className   = 'crack-row ' + severity;
  crackIcon.textContent = icon;
  crackText.textContent = 'Estimated crack time at 10B guesses/sec: ' + time;

  /* ── Security checks grid ── */
  checksGrid.innerHTML = checks.map(c => `
    <div class="check ${c.pass ? 'pass' : 'fail'}">
      <span class="check-icon">${c.pass ? '✓' : '○'}</span>
      <span>${c.label}</span>
    </div>
  `).join('');

  /* ── Suggestions ── */
  const sugs = makeSuggestions();
  sugList.innerHTML = sugs.map((s, i) => `
    <div class="sug-card">
      <span class="sug-pw" id="sp${i}">${s}</span>
      <button class="sug-copy" id="sc${i}" onclick="copySug('${s}', ${i})">Copy</button>
    </div>
  `).join('');
}

/* ── RENDER HISTORY LIST ── */
function renderHistory() {
  if (!history.length) {
    historyList.innerHTML = '<p class="history-empty">Press Enter after typing to log a password hash</p>';
    return;
  }

  historyList.innerHTML = history
    .slice()
    .reverse()
    .slice(0, 8)
    .map(h => `
      <div class="history-item">
        <span class="history-mask">
          ${'•'.repeat(Math.min(h.len, 14))}
          <span style="font-size:11px;color:var(--muted)">(${h.len} chars)</span>
        </span>
        <span class="history-hash">hash: ${h.hash}</span>
      </div>
    `)
    .join('');
}

/* ── CLEAR HISTORY ── */
function clearHistory() {
  history = [];
  localStorage.setItem('psa_history', JSON.stringify(history));
  renderHistory();
}

/* ── EVENT: Live analysis on input ── */
pwInput.addEventListener('input', analyze);

/* ── EVENT: Log hash on Enter, check for reuse ── */
pwInput.addEventListener('keydown', e => {
  if (e.key === 'Enter' && pwInput.value) {
    const entry = { hash: hashPw(pwInput.value), len: pwInput.value.length };
    const isDuplicate = history.some(x => x.hash === entry.hash);

    if (!isDuplicate) {
      history.push(entry);
      if (history.length > 20) history.shift(); // keep last 20
    }

    localStorage.setItem('psa_history', JSON.stringify(history));
    renderHistory();

    if (isDuplicate) {
      crackText.textContent = '⚠️ This password was used before! Choose a different one.';
      crackRow.className = 'crack-row danger';
    }
  }
});

/* ── INIT ── */
renderHistory();
