/* ===== Календарь съёмок — Синхронизация с GitHub ===== */
let events = [];
let viewDate = new Date();
let selectedDate = null;
let editingId = null;
let ghSha = null; // Хэш файла на GitHub для перезаписи

const MONTHS = ['Январь','Февраль','Март','Апрель','Май','Июнь','Июль','Август','Сентябрь','Октябрь','Ноябрь','Декабрь'];

// База для кодировки кириллицы в base64 (требование GitHub API)
function utf8_to_b64(str) { return window.btoa(unescape(encodeURIComponent(str))); }
function b64_to_utf8(str) { return decodeURIComponent(escape(window.atob(str))); }
function ymd(d) { const y=d.getFullYear(); const m=String(d.getMonth()+1).padStart(2,'0'); const day=String(d.getDate()).padStart(2,'0'); return `${y}-${m}-${day}`; }
function todayStr() { return ymd(new Date()); }

/* ---------- Работа с GitHub API ---------- */
function getGhConfig() {
  return {
    user: localStorage.getItem('ghUser'),
    repo: localStorage.getItem('ghRepo'),
    token: localStorage.getItem('ghToken')
  };
}

function showLoader(show) { document.getElementById('loader').style.display = show ? 'flex' : 'none'; }
function updateStatus(isOk) {
  const dot = document.getElementById('syncStatus');
  if (isOk) { dot.className = 'status-dot green'; dot.title = 'Синхронизировано'; } 
  else { dot.className = 'status-dot red'; dot.title = 'Ошибка синхронизации или не настроено'; }
}

async function syncFromGitHub() {
  const cfg = getGhConfig();
  if (!cfg.user || !cfg.repo || !cfg.token) {
    updateStatus(false); renderCalendar(); return;
  }
  showLoader(true);
  try {
    const url = `https://api.github.com/repos/${cfg.user}/${cfg.repo}/contents/data.json`;
    const res = await fetch(url, { headers: { "Authorization": `token ${cfg.token}` } });
    
    if (res.status === 404) {
      events = []; ghSha = null; updateStatus(true);
    } else if (res.ok) {
      const data = await res.json();
      ghSha = data.sha;
      events = JSON.parse(b64_to_utf8(data.content));
      updateStatus(true);
    } else { throw new Error('Ошибка API'); }
  } catch(e) {
    alert('Ошибка скачивания с GitHub. Проверь токен и интернет.'); updateStatus(false);
  }
  document.getElementById('totalCount').textContent = events.length;
  renderCalendar();
  if (selectedDate) renderDayEvents();
  showLoader(false);
}

async function syncToGitHub() {
  const cfg = getGhConfig();
  if (!cfg.user || !cfg.repo || !cfg.token) return;
  showLoader(true);
  try {
    const url = `https://api.github.com/repos/${cfg.user}/${cfg.repo}/contents/data.json`;
    const contentB64 = utf8_to_b64(JSON.stringify(events, null, 2));
    
    const bodyObj = { message: "Обновление календаря", content: contentB64 };
    if (ghSha) bodyObj.sha = ghSha; // Если файл уже есть, нужен его SHA

    const res = await fetch(url, {
      method: 'PUT',
      headers: { "Authorization": `token ${cfg.token}`, "Content-Type": "application/json" },
      body: JSON.stringify(bodyObj)
    });

    if (res.ok) {
      const data = await res.json();
      ghSha = data.content.sha; // Обновляем SHA
      updateStatus(true);
    } else { throw new Error('Ошибка сохранения'); }
  } catch(e) {
    alert('Не удалось сохранить данные в GitHub!'); updateStatus(false);
  }
  document.getElementById('totalCount').textContent = events.length;
  showLoader(false);
}

/* ---------- Интерфейс ---------- */
function renderCalendar() {
  const grid = document.getElementById('calGrid'); grid.innerHTML = '';
  const year = viewDate.getFullYear(); const month = viewDate.getMonth();
  document.getElementById('monthLabel').textContent = `${MONTHS[month]} ${year}`;

  let startWeekday = new Date(year, month, 1).getDay();
  startWeekday = startWeekday === 0 ? 6 : startWeekday - 1;
  const daysInMonth = new Date(year, month+1, 0).getDate();

  for(let i=0; i<startWeekday; i++) {
    const c=document.createElement('div'); c.className='cal-cell empty'; grid.appendChild(c);
  }

  for(let day=1; day<=daysInMonth; day++) {
    const dateKey = ymd(new Date(year, month, day));
    const dayEvents = events.filter(e=>e.date===dateKey).sort((a,b)=>a.timeStart.localeCompare(b.timeStart));
    const cell=document.createElement('div');
    cell.className='cal-cell';
    if(dateKey===todayStr()) cell.classList.add('today');

    let html = `<div class="cell-num">${day}</div>`;
    if(dayEvents.length) {
      html += `<span class="cell-count">${dayEvents.length}</span><div class="cell-events">`;
      dayEvents.slice(0,2).forEach(ev => html += `<div class="cell-event">${ev.timeStart} ${ev.title}</div>`);
      html += `</div>`;
    }
    cell.innerHTML = html;
    cell.onclick = () => openDay(dateKey);
    grid.appendChild(cell);
  }
}

function openDay(dateKey) {
  selectedDate = dateKey;
  document.getElementById('dayPanel').style.display='block';
  const [y,m,d] = dateKey.split('-');
  document.getElementById('dayTitle').textContent = `${+d} ${MONTHS[+m-1]} ${y}`;
  renderDayEvents();
  document.getElementById('dayPanel').scrollIntoView({behavior:'smooth'});
}

function renderDayEvents() {
  const list = document.getElementById('dayEventsList');
  const dayEvents = events.filter(e=>e.date===selectedDate).sort((a,b)=>a.timeStart.localeCompare(b.timeStart));
  list.innerHTML='';
  if(!dayEvents.length) { list.innerHTML = `<div style="color:#8b93a7;text-align:center">Пусто</div>`; return; }
  
  dayEvents.forEach(ev => {
    const card=document.createElement('div');
    card.className='event-card';
    card.innerHTML = `<h4><span>${ev.title}</span> <span class="ev-time">${ev.timeStart}</span></h4>
      <div class="ev-row"><b>${ev.type}</b> | ${ev.price} ₽ (${ev.paid})</div>
      ${ev.client ? `<div class="ev-row">👤 ${ev.client} (${ev.phone})</div>` : ''}
      ${ev.address ? `<div class="ev-row">📍 ${ev.address}</div>` : ''}`;
    card.onclick = () => openModal(ev.id);
    list.appendChild(card);
  });
}

function openModal(id) {
  editingId = id || null;
  document.getElementById('eventModal').classList.add('open');
  if(id) {
    const ev = events.find(e=>e.id===id);
    document.getElementById('modalTitle').textContent='Редактировать';
    document.getElementById('fTitle').value = ev.title; document.getElementById('fType').value = ev.type;
    document.getElementById('fTimeStart').value = ev.timeStart; document.getElementById('fPrice').value = ev.price;
    document.getElementById('fPaid').value = ev.paid; document.getElementById('fClient').value = ev.client;
    document.getElementById('fPhone').value = ev.phone; document.getElementById('fAddress').value = ev.address;
    document.getElementById('fNote').value = ev.note;
    document.getElementById('deleteEventBtn').style.display='inline-block';
  } else {
    document.getElementById('modalTitle').textContent='Новая съёмка';
    ['fTitle','fPrice','fClient','fPhone','fAddress','fNote'].forEach(id => document.getElementById(id).value='');
    document.getElementById('fTimeStart').value='10:00';
    document.getElementById('deleteEventBtn').style.display='none';
  }
}
function closeModal() { document.getElementById('eventModal').classList.remove('open'); }

async function saveEvent() {
  const title = document.getElementById('fTitle').value.trim();
  if(!title) return alert('Введите название');
  
  const data = {
    date: selectedDate, title, type: document.getElementById('fType').value,
    timeStart: document.getElementById('fTimeStart').value, price: document.getElementById('fPrice').value,
    paid: document.getElementById('fPaid').value, client: document.getElementById('fClient').value.trim(),
    phone: document.getElementById('fPhone').value.trim(), address: document.getElementById('fAddress').value.trim(),
    note: document.getElementById('fNote').value.trim()
  };

  if(editingId) { events[events.findIndex(e=>e.id===editingId)] = {...data, id: editingId}; } 
  else { data.id = Date.now().toString(); events.push(data); }

  closeModal(); renderCalendar(); renderDayEvents();
  await syncToGitHub();
}

async function deleteEvent() {
  if(!confirm('Удалить?')) return;
  events = events.filter(e=>e.id!==editingId);
  closeModal(); renderCalendar(); renderDayEvents();
  await syncToGitHub();
}

// Настройки GitHub
document.getElementById('syncSettingsBtn').onclick = () => {
  document.getElementById('ghUser').value = localStorage.getItem('ghUser') || '';
  document.getElementById('ghRepo').value = localStorage.getItem('ghRepo') || '';
  document.getElementById('ghToken').value = localStorage.getItem('ghToken') || '';
  document.getElementById('githubModal').classList.add('open');
};
document.getElementById('closeGithubBtn').onclick = () => document.getElementById('githubModal').classList.remove('open');
document.getElementById('saveGithubBtn').onclick = () => {
  localStorage.setItem('ghUser', document.getElementById('ghUser').value.trim());
  localStorage.setItem('ghRepo', document.getElementById('ghRepo').value.trim());
  localStorage.setItem('ghToken', document.getElementById('ghToken').value.trim());
  document.getElementById('githubModal').classList.remove('open');
  syncFromGitHub();
};

document.getElementById('prevMonth').onclick = () => { viewDate.setMonth(viewDate.getMonth()-1); renderCalendar(); };
document.getElementById('nextMonth').onclick = () => { viewDate.setMonth(viewDate.getMonth()+1); renderCalendar(); };
document.getElementById('todayBtn').onclick = () => { viewDate=new Date(); renderCalendar(); openDay(todayStr()); };
document.getElementById('dayClose').onclick = () => document.getElementById('dayPanel').style.display='none';
document.getElementById('addEventBtn').onclick = () => openModal(null);
document.getElementById('saveEventBtn').onclick = saveEvent;
document.getElementById('deleteEventBtn').onclick = deleteEvent;
document.getElementById('cancelEventBtn').onclick = closeModal;

// Старт
syncFromGitHub();
