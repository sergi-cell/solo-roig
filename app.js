/* ===== SISTEMA — Señor Roig ============================================
   App de gamificación local estilo Solo Leveling. Todo el estado vive en
   localStorage, no hay backend ni login.
   ======================================================================= */

const STORAGE_KEY = 'soloRoigState_v1';

const DEFAULT_QUESTS = [
  // Señor Roig
  { id:'roig-grabar',    area:'roig',     name:'Grabar contenido (reel/vídeo)',        xp:30, freq:'daily' },
  { id:'roig-guion',     area:'roig',     name:'Escribir o mejorar un guion',          xp:20, freq:'daily' },
  { id:'roig-publicar',  area:'roig',     name:'Publicar en Instagram',                xp:25, freq:'daily' },
  { id:'roig-comunidad', area:'roig',     name:'Responder comentarios y DMs',          xp:10, freq:'daily' },
  { id:'roig-estudiar',  area:'roig',     name:'Estudiar referencias / competencia',   xp:15, freq:'daily' },
  { id:'roig-metricas',  area:'roig',     name:'Revisar métricas de la semana',        xp:20, freq:'weekly' },
  // Disciplina / hábitos
  { id:'hab-dormir',     area:'habitos',  name:'Dormir 7-8h',                          xp:15, freq:'daily' },
  { id:'hab-entrenar',   area:'habitos',  name:'Entrenar / mover el cuerpo',            xp:20, freq:'daily' },
  { id:'hab-leer',       area:'habitos',  name:'Leer 20-30 min',                        xp:15, freq:'daily' },
  { id:'hab-nutricion',  area:'habitos',  name:'Nutrición limpia todo el día',          xp:15, freq:'daily' },
  { id:'hab-deepwork',   area:'habitos',  name:'Bloque de trabajo profundo sin móvil',  xp:25, freq:'daily' },
  { id:'hab-sinpantalla',area:'habitos',  name:'Sin pantallas la 1ª hora del día',      xp:10, freq:'daily' },
  { id:'hab-planificar', area:'habitos',  name:'Planificar el día siguiente',           xp:10, freq:'daily' },
];

const DEFAULT_REWARDS = [
  { id:'rw-choco',   name:'Chocolate',        cost:60  },
  { id:'rw-alcohol', name:'Copa de alcohol',  cost:120 },
  { id:'rw-peta',    name:'Fumar un peta',    cost:150 },
  { id:'rw-cenar',   name:'Cenar fuera',      cost:400 },
];

const DEFAULT_PENALTIES = [
  { id:'pn-flexiones', name:'40 flexiones ahora mismo' },
  { id:'pn-fria',      name:'Ducha fría de 1 minuto' },
  { id:'pn-dulce',     name:'Nada de dulce en 24h' },
  { id:'pn-movil',     name:'1 hora sin móvil' },
  { id:'pn-reflexion', name:'Escribir 3 cosas que hiciste mal hoy' },
  { id:'pn-madrugar',  name:'Levantarte 1h antes mañana' },
];

const DEFAULT_EXTRA_POOL = [
  { id:'ex-3piezas',      area:'roig',    name:'Grabar 3 piezas de contenido en un día',              xp:60 },
  { id:'ex-carrusel',     area:'roig',    name:'Publicar un carrusel completo',                       xp:50 },
  { id:'ex-5ideas',       area:'roig',    name:'Escribir 5 ideas nuevas de guion',                    xp:40 },
  { id:'ex-competencia',  area:'roig',    name:'Analizar a fondo un competidor y sacar 3 aprendizajes', xp:40 },
  { id:'ex-sitionuevo',   area:'roig',    name:'Salir a grabar en un sitio nuevo',                    xp:50 },
  { id:'ex-entrenardoble',area:'habitos', name:'Entrenar el doble de lo normal',                      xp:50 },
  { id:'ex-ayuno',        area:'habitos', name:'Ayunar 16 horas',                                     xp:40 },
  { id:'ex-desconexion',  area:'habitos', name:'Día entero sin redes sociales (fuera de publicar)',   xp:60 },
];

const RANK_TITLES = { E:'Novato', D:'Aprendiz', C:'Competente', B:'Profesional', A:'Experto', S:'Maestro', SS:'Leyenda' };

const PENALTY_THRESHOLD = 0.5; // si completas menos de la mitad de misiones diarias, hay castigo
const EXTRA_SPAWN_CHANCE = 0.4; // probabilidad diaria de que aparezca una misión extraordinaria

function defaultState(){
  const today = todayStr();
  return {
    quests: DEFAULT_QUESTS.map(q => ({...q, custom:false, streak:0, lastDone:null, createdDate:today, totalCompletions:0})),
    rewards: DEFAULT_REWARDS.map(r => ({...r, custom:false})),
    penalties: DEFAULT_PENALTIES.map(p => ({...p, custom:false})),
    extraPool: DEFAULT_EXTRA_POOL.map(t => ({...t, custom:false})),
    activeExtra: null,
    lastExtraCheckDate: null,
    dailyLog: {},
    pendingPenalties: 0,
    roigXp: 0,
    habitosXp: 0,
    wallet: 0,
    totalCompleted: 0,
    totalRedeemed: 0,
    bestStreak: 0,
    globalStreak: 0,
    lastActiveDate: null,
    firstUseDate: today,
    activeDays: [today],
  };
}

let state = loadState();

function loadState(){
  try{
    const raw = localStorage.getItem(STORAGE_KEY);
    if(!raw) return defaultState();
    const parsed = JSON.parse(raw);
    if(!parsed.quests || !Array.isArray(parsed.quests)) return defaultState();

    if(!parsed.rewards || !Array.isArray(parsed.rewards)) parsed.rewards = DEFAULT_REWARDS.map(r => ({...r, custom:false}));
    if(!parsed.penalties || !Array.isArray(parsed.penalties)) parsed.penalties = DEFAULT_PENALTIES.map(p => ({...p, custom:false}));
    if(!parsed.extraPool || !Array.isArray(parsed.extraPool)) parsed.extraPool = DEFAULT_EXTRA_POOL.map(t => ({...t, custom:false}));
    if(parsed.activeExtra === undefined) parsed.activeExtra = null;
    if(!parsed.lastExtraCheckDate) parsed.lastExtraCheckDate = null;
    if(!parsed.dailyLog || typeof parsed.dailyLog !== 'object') parsed.dailyLog = {};
    if(typeof parsed.pendingPenalties !== 'number') parsed.pendingPenalties = 0;
    if(typeof parsed.wallet !== 'number') parsed.wallet = 0;
    if(typeof parsed.totalRedeemed !== 'number') parsed.totalRedeemed = 0;
    if(typeof parsed.globalStreak !== 'number') parsed.globalStreak = 0;
    if(!parsed.lastActiveDate) parsed.lastActiveDate = null;

    // migraciones puntuales pedidas por Sergi
    parsed.quests = parsed.quests.filter(q => q.id !== 'roig-007');
    parsed.quests.forEach(q => {
      if(!q.createdDate) q.createdDate = parsed.firstUseDate || todayStr();
      if(typeof q.totalCompletions !== 'number') q.totalCompletions = 0;
    });
    const flex = parsed.penalties.find(p => p.id === 'pn-flexiones');
    if(flex) flex.name = '40 flexiones ahora mismo';

    return parsed;
  }catch(e){
    return defaultState();
  }
}

function saveState(){
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

/* ---------------- date helpers ---------------- */
function todayStr(){
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}
function yesterdayStr(){
  const d = new Date();
  d.setDate(d.getDate()-1);
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}
function weekStr(){
  const d = new Date();
  const target = new Date(d.valueOf());
  const dayNr = (d.getDay()+6)%7;
  target.setDate(target.getDate()-dayNr+3);
  const firstThursday = new Date(target.getFullYear(),0,4);
  const diff = target - firstThursday;
  const week = 1 + Math.round(diff/(7*24*3600*1000));
  return `${target.getFullYear()}-W${week}`;
}
function periodKey(freq){
  return freq === 'weekly' ? weekStr() : todayStr();
}
function daysSinceInclusive(dateStr){
  const d1 = new Date(dateStr + 'T00:00:00');
  const d2 = new Date(todayStr() + 'T00:00:00');
  return Math.max(1, Math.round((d2 - d1) / 86400000) + 1);
}

/* ---------------- level / rank math ---------------- */
function levelFromXp(totalXp){
  let level = 1, xpNeeded = 100, remaining = totalXp;
  while(remaining >= xpNeeded){
    remaining -= xpNeeded;
    level++;
    xpNeeded = 100 + (level-1)*25;
  }
  return { level, xpInto: remaining, xpNeeded };
}

const RANKS = [
  { key:'E',  min:1 },
  { key:'D',  min:5 },
  { key:'C',  min:10 },
  { key:'B',  min:15 },
  { key:'A',  min:20 },
  { key:'S',  min:30 },
  { key:'SS', min:40 },
];
function rankFromLevel(level){
  let cur = RANKS[0].key;
  for(const r of RANKS){ if(level >= r.min) cur = r.key; }
  return cur;
}

/* ---------------- rendimiento por misión (radiografía) ---------------- */
function expectedForQuest(q){
  const days = daysSinceInclusive(q.createdDate || state.firstUseDate);
  return q.freq === 'weekly' ? Math.max(1, Math.ceil(days/7)) : days;
}
function completionRate(q){
  const expected = expectedForQuest(q);
  return Math.min(1, (q.totalCompletions || 0) / expected);
}

/* ---------------- feedback: sonido, vibración, flash ---------------- */
let audioCtx = null;
function getCtx(){
  if(!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  if(audioCtx.state === 'suspended') audioCtx.resume();
  return audioCtx;
}
function beep(freq, duration, type, startTime, gainVal){
  try{
    const ctx = getCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    osc.connect(gain).connect(ctx.destination);
    const t = ctx.currentTime + startTime;
    osc.start(t);
    gain.gain.setValueAtTime(gainVal, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + duration);
    osc.stop(t + duration + 0.02);
  }catch(e){ /* audio no disponible, se ignora */ }
}
function playQuestComplete(){
  beep(880, 0.08, 'square', 0, 0.14);
  beep(1320, 0.12, 'square', 0.08, 0.12);
}
function playUndo(){
  beep(300, 0.15, 'sine', 0, 0.09);
}
function playLevelUp(){
  [523.25, 659.25, 783.99, 1046.5].forEach((f,i) => beep(f, 0.18, 'sawtooth', i*0.12, 0.11));
}
function playRankUp(){
  [392, 523.25, 659.25, 783.99, 1046.5, 1318.5].forEach((f,i) => beep(f, 0.22, 'triangle', i*0.09, 0.12));
}
function playRedeem(){
  beep(660, 0.1, 'sine', 0, 0.14);
  beep(990, 0.16, 'sine', 0.1, 0.14);
}
function playPenalty(){
  beep(220, 0.2, 'sawtooth', 0, 0.13);
  beep(185, 0.25, 'sawtooth', 0.15, 0.13);
  beep(140, 0.35, 'sawtooth', 0.3, 0.14);
}
function vibrate(pattern){
  try{ if(navigator.vibrate) navigator.vibrate(pattern); }catch(e){ /* no soportado */ }
}
function flashScreen(gold){
  const el = document.createElement('div');
  el.className = 'flash-overlay' + (gold ? ' gold' : '');
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 650);
}

/* ---------------- registro diario, castigos y misiones extraordinarias ---------------- */
function updateTodayLog(){
  const today = todayStr();
  const dailyQuests = state.quests.filter(q => q.freq === 'daily');
  if(dailyQuests.length === 0) return;
  const completed = dailyQuests.filter(isDoneNow).length;
  state.dailyLog[today] = { completed, total: dailyQuests.length, processed: false };
}

function checkPenalties(){
  const today = todayStr();
  let changed = false;
  Object.keys(state.dailyLog).forEach(day => {
    if(day === today) return;
    const entry = state.dailyLog[day];
    if(entry.processed) return;
    entry.processed = true;
    changed = true;
    const rate = entry.total > 0 ? entry.completed / entry.total : 1;
    if(rate < PENALTY_THRESHOLD) state.pendingPenalties += 1;
  });
  if(changed) saveState();
}

function checkExtraSpawn(){
  const today = todayStr();
  if(state.lastExtraCheckDate === today) return;
  state.lastExtraCheckDate = today;
  if(!state.activeExtra && state.extraPool.length > 0 && Math.random() < EXTRA_SPAWN_CHANCE){
    const tmpl = state.extraPool[Math.floor(Math.random() * state.extraPool.length)];
    state.activeExtra = { id:'extra-'+Date.now(), templateId:tmpl.id, name:tmpl.name, xp:tmpl.xp, area:tmpl.area };
  }
  saveState();
}

function updateGlobalStreak(){
  const today = todayStr();
  if(state.lastActiveDate === today) return;
  state.globalStreak = (state.lastActiveDate === yesterdayStr()) ? state.globalStreak + 1 : 1;
  state.lastActiveDate = today;
}

/* ---------------- rendering ---------------- */
function render(){
  updateTodayLog();
  checkPenalties();
  checkExtraSpawn();

  const totalXp = state.roigXp + state.habitosXp;
  const global = levelFromXp(totalXp);
  const rank = rankFromLevel(global.level);

  document.getElementById('rank-badge').textContent = rank;
  document.getElementById('level-num').textContent = global.level;
  document.getElementById('hunter-title').textContent = RANK_TITLES[rank] || '';
  document.getElementById('xp-current').textContent = global.xpInto;
  document.getElementById('xp-needed').textContent = global.xpNeeded;
  document.getElementById('xp-fill').style.width = `${Math.min(100,(global.xpInto/global.xpNeeded)*100)}%`;
  document.getElementById('wallet-num').textContent = state.wallet;
  document.getElementById('global-streak').textContent = state.globalStreak;

  const roigLvl = levelFromXp(state.roigXp);
  const habLvl = levelFromXp(state.habitosXp);
  document.getElementById('roig-level').textContent = roigLvl.level;
  document.getElementById('habitos-level').textContent = habLvl.level;
  document.getElementById('roig-fill').style.width = `${Math.min(100,(roigLvl.xpInto/roigLvl.xpNeeded)*100)}%`;
  document.getElementById('habitos-fill').style.width = `${Math.min(100,(habLvl.xpInto/habLvl.xpNeeded)*100)}%`;

  renderExtraQuest();
  renderQuestList('daily');
  renderQuestList('weekly');
  renderRadar();
  renderRewardList();
  renderExtraPoolList();
  renderPenaltyList();
  renderPenaltyBox();

  document.getElementById('stat-total').textContent = state.totalCompleted;
  document.getElementById('stat-streak').textContent = state.bestStreak;
  document.getElementById('stat-days').textContent = state.activeDays.length;
}

function isDoneNow(q){
  return q.lastDone === periodKey(q.freq);
}

function renderQuestList(freq){
  const listEl = document.getElementById(freq === 'daily' ? 'daily-list' : 'weekly-list');
  const countEl = document.getElementById(freq === 'daily' ? 'daily-count' : 'weekly-count');
  const quests = state.quests.filter(q => q.freq === freq);
  const doneCount = quests.filter(isDoneNow).length;
  countEl.textContent = `${doneCount}/${quests.length}`;

  listEl.innerHTML = '';
  quests.forEach(q => {
    const done = isDoneNow(q);
    const item = document.createElement('div');
    item.className = 'quest-item' + (done ? ' done' : '');

    const check = document.createElement('div');
    check.className = 'quest-check';
    check.textContent = '✓';
    check.addEventListener('click', () => toggleQuest(q.id));

    const body = document.createElement('div');
    body.className = 'quest-body';
    const name = document.createElement('div');
    name.className = 'quest-name';
    name.textContent = q.name;
    const meta = document.createElement('div');
    meta.className = 'quest-meta';
    const tag = document.createElement('span');
    tag.className = q.area === 'roig' ? 'quest-tag-roig' : 'quest-tag-habitos';
    tag.textContent = q.area === 'roig' ? 'SEÑOR ROIG' : 'DISCIPLINA';
    meta.appendChild(tag);
    if(q.freq === 'daily' && q.streak > 0){
      const streak = document.createElement('span');
      streak.className = 'quest-streak';
      streak.textContent = `🔥 ${q.streak}`;
      meta.appendChild(streak);
    }
    body.appendChild(name);
    body.appendChild(meta);

    const xp = document.createElement('div');
    xp.className = 'quest-xp';
    xp.textContent = `+${q.xp} XP`;

    item.appendChild(check);
    item.appendChild(body);
    item.appendChild(xp);

    if(q.custom){
      const del = document.createElement('button');
      del.className = 'quest-del';
      del.textContent = '✕';
      del.addEventListener('click', (e) => { e.stopPropagation(); deleteQuest(q.id); });
      item.appendChild(del);
    }

    listEl.appendChild(item);
  });
}

function renderExtraQuest(){
  const section = document.getElementById('extra-quest-section');
  if(state.activeExtra){
    section.classList.remove('hidden');
    document.getElementById('extra-quest-name').textContent = state.activeExtra.name;
    document.getElementById('extra-quest-xp').textContent = `+${state.activeExtra.xp} XP`;
  } else {
    section.classList.add('hidden');
  }
}

function renderExtraPoolList(){
  const listEl = document.getElementById('extra-pool-list');
  listEl.innerHTML = '';
  state.extraPool.forEach(t => {
    const item = document.createElement('div');
    item.className = 'quest-item';

    const body = document.createElement('div');
    body.className = 'quest-body';
    const name = document.createElement('div');
    name.className = 'quest-name';
    name.textContent = t.name;
    const meta = document.createElement('div');
    meta.className = 'quest-meta';
    const tag = document.createElement('span');
    tag.className = t.area === 'roig' ? 'quest-tag-roig' : 'quest-tag-habitos';
    tag.textContent = t.area === 'roig' ? 'SEÑOR ROIG' : 'DISCIPLINA';
    meta.appendChild(tag);
    body.appendChild(name);
    body.appendChild(meta);

    const xp = document.createElement('div');
    xp.className = 'quest-xp';
    xp.textContent = `+${t.xp} XP`;

    item.appendChild(body);
    item.appendChild(xp);

    if(t.custom){
      const del = document.createElement('button');
      del.className = 'quest-del';
      del.textContent = '✕';
      del.addEventListener('click', (e) => { e.stopPropagation(); deleteExtraTemplate(t.id); });
      item.appendChild(del);
    }

    listEl.appendChild(item);
  });
}

function renderRadar(){
  const listEl = document.getElementById('radar-list');
  listEl.innerHTML = '';
  const trackedQuests = state.quests.filter(q => q.freq === 'daily' || q.freq === 'weekly');

  if(trackedQuests.length === 0){
    const empty = document.createElement('div');
    empty.className = 'radar-empty';
    empty.textContent = 'Aún no hay datos suficientes.';
    listEl.appendChild(empty);
    return;
  }

  const rows = trackedQuests.map(q => ({ q, rate: completionRate(q) }));
  rows.sort((a,b) => b.rate - a.rate);

  rows.forEach(({q, rate}) => {
    const pct = Math.round(rate * 100);
    const color = rate >= 0.7 ? 'var(--green)' : (rate >= 0.4 ? 'var(--gold)' : 'var(--danger)');

    const item = document.createElement('div');
    item.className = 'radar-item';

    const top = document.createElement('div');
    top.className = 'radar-top';

    const nameWrap = document.createElement('span');
    nameWrap.className = 'radar-name';
    const tagDot = document.createElement('span');
    tagDot.className = 'radar-tag';
    tagDot.style.color = q.area === 'roig' ? 'var(--roig-color)' : 'var(--habitos-color)';
    tagDot.textContent = '●';
    nameWrap.appendChild(tagDot);
    nameWrap.appendChild(document.createTextNode(q.name));

    const pctEl = document.createElement('span');
    pctEl.className = 'radar-pct';
    pctEl.style.color = color;
    pctEl.textContent = `${pct}%`;

    top.appendChild(nameWrap);
    top.appendChild(pctEl);

    const bar = document.createElement('div');
    bar.className = 'radar-bar';
    const fill = document.createElement('div');
    fill.className = 'radar-fill';
    fill.style.width = `${pct}%`;
    fill.style.background = color;
    bar.appendChild(fill);

    item.appendChild(top);
    item.appendChild(bar);
    listEl.appendChild(item);
  });
}

function renderRewardList(){
  const listEl = document.getElementById('reward-list');
  listEl.innerHTML = '';
  state.rewards.forEach(r => {
    const item = document.createElement('div');
    item.className = 'quest-item';

    const body = document.createElement('div');
    body.className = 'quest-body';
    const name = document.createElement('div');
    name.className = 'quest-name';
    name.textContent = r.name;
    const meta = document.createElement('div');
    meta.className = 'quest-meta';
    meta.innerHTML = `<span class="reward-cost">💎 ${r.cost} pts</span>`;
    body.appendChild(name);
    body.appendChild(meta);

    const btn = document.createElement('button');
    btn.className = 'redeem-btn';
    btn.textContent = 'CANJEAR';
    btn.disabled = state.wallet < r.cost;
    btn.addEventListener('click', () => redeemReward(r.id));

    item.appendChild(body);
    item.appendChild(btn);

    if(r.custom){
      const del = document.createElement('button');
      del.className = 'quest-del';
      del.textContent = '✕';
      del.addEventListener('click', (e) => { e.stopPropagation(); deleteReward(r.id); });
      item.appendChild(del);
    }

    listEl.appendChild(item);
  });
}

function renderPenaltyBox(){
  const section = document.getElementById('penalty-box-section');
  const countEl = document.getElementById('penalty-pending-count');
  if(state.pendingPenalties > 0){
    section.classList.remove('hidden');
    countEl.textContent = state.pendingPenalties === 1 ? '1 caja sin abrir' : `${state.pendingPenalties} cajas sin abrir`;
  } else {
    section.classList.add('hidden');
  }
}

function renderPenaltyList(){
  const listEl = document.getElementById('penalty-list');
  listEl.innerHTML = '';
  state.penalties.forEach(p => {
    const item = document.createElement('div');
    item.className = 'quest-item';

    const body = document.createElement('div');
    body.className = 'quest-body';
    const name = document.createElement('div');
    name.className = 'quest-name';
    name.textContent = p.name;
    body.appendChild(name);
    item.appendChild(body);

    if(p.custom){
      const del = document.createElement('button');
      del.className = 'quest-del';
      del.textContent = '✕';
      del.addEventListener('click', (e) => { e.stopPropagation(); deletePenalty(p.id); });
      item.appendChild(del);
    }

    listEl.appendChild(item);
  });
}

function deletePenalty(id){
  if(!confirm('¿Eliminar este castigo?')) return;
  state.penalties = state.penalties.filter(p => p.id !== id);
  saveState();
  render();
}

function deleteExtraTemplate(id){
  if(!confirm('¿Eliminar esta misión extraordinaria del banco?')) return;
  state.extraPool = state.extraPool.filter(t => t.id !== id);
  saveState();
  render();
}

/* ---------------- quest actions ---------------- */
function toggleQuest(id){
  const q = state.quests.find(x => x.id === id);
  if(!q) return;
  const key = periodKey(q.freq);
  const wasDone = q.lastDone === key;

  const beforeTotal = state.roigXp + state.habitosXp;
  const beforeGlobal = levelFromXp(beforeTotal);
  const beforeRank = rankFromLevel(beforeGlobal.level);

  if(wasDone){
    q.lastDone = null;
    if(q.freq === 'daily' && q.streak > 0) q.streak -= 1;
    q.totalCompletions = Math.max(0, (q.totalCompletions || 0) - 1);
    addXp(q.area, -q.xp);
    state.wallet = Math.max(0, state.wallet - q.xp);
    state.totalCompleted = Math.max(0, state.totalCompleted - 1);
    playUndo();
  } else {
    if(q.freq === 'daily'){
      q.streak = (q.lastDone === yesterdayStr()) ? q.streak + 1 : 1;
      if(q.streak > state.bestStreak) state.bestStreak = q.streak;
    }
    q.lastDone = key;
    q.totalCompletions = (q.totalCompletions || 0) + 1;
    addXp(q.area, q.xp);
    state.wallet += q.xp;
    state.totalCompleted += 1;
    const today = todayStr();
    if(!state.activeDays.includes(today)) state.activeDays.push(today);
    updateGlobalStreak();
    playQuestComplete();
    vibrate(15);
  }

  saveState();
  render();

  if(!wasDone){
    const afterTotal = state.roigXp + state.habitosXp;
    const afterGlobal = levelFromXp(afterTotal);
    const afterRank = rankFromLevel(afterGlobal.level);
    if(afterGlobal.level > beforeGlobal.level){
      showLevelUp(beforeGlobal.level, afterGlobal.level);
    }
    if(afterRank !== beforeRank){
      setTimeout(() => showRankUp(beforeRank, afterRank), afterGlobal.level > beforeGlobal.level ? 1500 : 0);
    }
  }
}

function addXp(area, amount){
  if(area === 'roig') state.roigXp = Math.max(0, state.roigXp + amount);
  else state.habitosXp = Math.max(0, state.habitosXp + amount);
}

function deleteQuest(id){
  if(!confirm('¿Eliminar esta misión?')) return;
  state.quests = state.quests.filter(q => q.id !== id);
  saveState();
  render();
}

function completeExtraQuest(){
  const extra = state.activeExtra;
  if(!extra) return;

  const beforeTotal = state.roigXp + state.habitosXp;
  const beforeGlobal = levelFromXp(beforeTotal);
  const beforeRank = rankFromLevel(beforeGlobal.level);

  addXp(extra.area, extra.xp);
  state.wallet += extra.xp;
  state.totalCompleted += 1;
  updateGlobalStreak();
  state.activeExtra = null;

  saveState();
  render();
  playQuestComplete();
  vibrate([20,30,20,30,40]);

  const afterTotal = state.roigXp + state.habitosXp;
  const afterGlobal = levelFromXp(afterTotal);
  const afterRank = rankFromLevel(afterGlobal.level);
  if(afterGlobal.level > beforeGlobal.level) showLevelUp(beforeGlobal.level, afterGlobal.level);
  if(afterRank !== beforeRank){
    setTimeout(() => showRankUp(beforeRank, afterRank), afterGlobal.level > beforeGlobal.level ? 1500 : 0);
  }
}

/* ---------------- reward actions ---------------- */
function redeemReward(id){
  const r = state.rewards.find(x => x.id === id);
  if(!r || state.wallet < r.cost) return;
  if(!confirm(`¿Canjear "${r.name}" por ${r.cost} 💎?`)) return;
  state.wallet -= r.cost;
  state.totalRedeemed += 1;
  saveState();
  render();
  playRedeem();
  vibrate(20);
  showReward(r);
}

function deleteReward(id){
  if(!confirm('¿Eliminar esta recompensa?')) return;
  state.rewards = state.rewards.filter(r => r.id !== id);
  saveState();
  render();
}

/* ---------------- overlays ---------------- */
function showLevelUp(beforeLevel, afterLevel){
  document.getElementById('levelup-before').textContent = `Nivel ${beforeLevel}`;
  document.getElementById('levelup-after').textContent = `Nivel ${afterLevel}`;
  document.getElementById('levelup-overlay').classList.remove('hidden');
  playLevelUp();
  vibrate([40,30,40]);
  flashScreen(false);
}
function showRankUp(beforeRank, afterRank){
  document.getElementById('rankup-before').textContent = `Rango ${beforeRank}`;
  document.getElementById('rankup-after').textContent = `Rango ${afterRank}`;
  document.getElementById('rankup-overlay').classList.remove('hidden');
  playRankUp();
  vibrate([50,50,50,50,90]);
  flashScreen(true);
}
function showReward(reward){
  document.getElementById('reward-title').textContent = reward.name;
  document.getElementById('reward-cost-used').textContent = `${reward.cost} 💎`;
  document.getElementById('reward-overlay').classList.remove('hidden');
}

document.getElementById('levelup-close').addEventListener('click', () => {
  document.getElementById('levelup-overlay').classList.add('hidden');
});
document.getElementById('rankup-close').addEventListener('click', () => {
  document.getElementById('rankup-overlay').classList.add('hidden');
});
document.getElementById('reward-close').addEventListener('click', () => {
  document.getElementById('reward-overlay').classList.add('hidden');
});
document.getElementById('penalty-close').addEventListener('click', () => {
  document.getElementById('penalty-overlay').classList.add('hidden');
});
document.getElementById('open-penalty-btn').addEventListener('click', () => {
  if(state.pendingPenalties <= 0 || state.penalties.length === 0) return;
  const pick = state.penalties[Math.floor(Math.random() * state.penalties.length)];
  state.pendingPenalties -= 1;
  saveState();
  render();
  playPenalty();
  vibrate([80,40,80]);
  document.getElementById('penalty-text').textContent = pick.name;
  document.getElementById('penalty-overlay').classList.remove('hidden');
});
document.getElementById('extra-quest-complete').addEventListener('click', completeExtraQuest);

/* ---------------- add quest modal ---------------- */
let newQuestArea = 'roig';
let newQuestFreq = 'daily';
let newQuestXp = 15;

function setupChoiceGroup(containerId, onPick){
  const container = document.getElementById(containerId);
  container.querySelectorAll('.choice-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      container.querySelectorAll('.choice-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      onPick(btn.dataset.val);
    });
  });
}
setupChoiceGroup('new-quest-area', v => newQuestArea = v);
setupChoiceGroup('new-quest-freq', v => newQuestFreq = v);
setupChoiceGroup('new-quest-xp', v => newQuestXp = parseInt(v,10));

document.getElementById('add-quest-btn').addEventListener('click', () => {
  document.getElementById('new-quest-name').value = '';
  document.getElementById('modal-overlay').classList.remove('hidden');
});
document.getElementById('modal-cancel').addEventListener('click', () => {
  document.getElementById('modal-overlay').classList.add('hidden');
});
document.getElementById('modal-confirm').addEventListener('click', () => {
  const name = document.getElementById('new-quest-name').value.trim();
  if(!name) return;

  if(newQuestFreq === 'extra'){
    state.extraPool.push({
      id: 'extratmpl-' + Date.now(),
      area: newQuestArea,
      name,
      xp: newQuestXp,
      custom: true,
    });
  } else {
    state.quests.push({
      id: 'custom-' + Date.now(),
      area: newQuestArea,
      name,
      xp: newQuestXp,
      freq: newQuestFreq,
      custom: true,
      streak: 0,
      lastDone: null,
      createdDate: todayStr(),
      totalCompletions: 0,
    });
  }

  saveState();
  render();
  document.getElementById('modal-overlay').classList.add('hidden');
});

/* ---------------- add reward modal ---------------- */
document.getElementById('add-reward-btn').addEventListener('click', () => {
  document.getElementById('new-reward-name').value = '';
  document.getElementById('new-reward-cost').value = 100;
  document.getElementById('reward-modal-overlay').classList.remove('hidden');
});
document.getElementById('reward-modal-cancel').addEventListener('click', () => {
  document.getElementById('reward-modal-overlay').classList.add('hidden');
});
document.getElementById('reward-modal-confirm').addEventListener('click', () => {
  const name = document.getElementById('new-reward-name').value.trim();
  const cost = parseInt(document.getElementById('new-reward-cost').value, 10);
  if(!name || !cost || cost <= 0) return;
  state.rewards.push({
    id: 'reward-' + Date.now(),
    name,
    cost,
    custom: true,
  });
  saveState();
  render();
  document.getElementById('reward-modal-overlay').classList.add('hidden');
});

/* ---------------- add penalty modal ---------------- */
document.getElementById('add-penalty-btn').addEventListener('click', () => {
  document.getElementById('new-penalty-name').value = '';
  document.getElementById('penalty-modal-overlay').classList.remove('hidden');
});
document.getElementById('penalty-modal-cancel').addEventListener('click', () => {
  document.getElementById('penalty-modal-overlay').classList.add('hidden');
});
document.getElementById('penalty-modal-confirm').addEventListener('click', () => {
  const name = document.getElementById('new-penalty-name').value.trim();
  if(!name) return;
  state.penalties.push({
    id: 'penalty-' + Date.now(),
    name,
    custom: true,
  });
  saveState();
  render();
  document.getElementById('penalty-modal-overlay').classList.add('hidden');
});

/* ---------------- reset ---------------- */
document.getElementById('reset-btn').addEventListener('click', () => {
  if(!confirm('Esto borrará todo tu progreso (nivel, XP, rachas, puntos). ¿Continuar?')) return;
  state = defaultState();
  saveState();
  render();
});

/* ---------------- init ---------------- */
render();

if('serviceWorker' in navigator){
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  });
}
