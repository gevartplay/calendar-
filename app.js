/* ===== Календарь съёмок — вся логика ===== */

const STORAGE_KEY = 'shootings_calendar_v1';

let events = load();          // массив всех записей
let viewDate = new Date();    // какой месяц показываем
let selectedDate = null;      // выбранный день (YYYY-MM-DD)
let editingId = null;         // id редактируемой записи

const MONTHS = ['Январь','Февраль','Март','Апрель','Май','Июнь',
  'Июль','Август','Сентябрь','Октябрь','Ноябрь','Декабрь'];

/* ---------- Хранилище ---------- */
function load(){
  try{ return JSON.parse(localStorage.getItem(STORAGE_KEY)) || []; }
  catch(e){ return []; }
}
function save(){
  localStorage.setItem(STORAGE_KEY, JSON.stringify(events));
  document.getElementById('totalCount').textContent = events.length;
}

/* ---------- Утилиты дат ---------- */
function ymd(d){
  const y=d.getFullYear();
  const m=String(d.getMonth()+1).padStart(2,'0');
  const day=String(d.getDate()).padStart(2,'0');
  return `${y}-${m}-${day}`;
}
function todayStr(){ return ymd(new Date()); }

/* ---------- Рендер календаря ---------- */
function renderCalendar(){
  const grid = document.getElementById('calGrid');
  grid.innerHTML = '';

  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();
  document.getElementById('monthLabel').textContent = `${MONTHS[month]} ${year}`;

  const first = new Date(year, month, 1);
  // в JS воскресенье=0, делаем понедельник первым
  let startWeekday = first.getDay();
  startWeekday = startWeekday === 0 ? 6 : startWeekday - 1;

  const daysInMonth = new Date(year, month+1, 0).getDate();

  // пустые ячейки до первого дня
  for(let i=0;i<startWeekday;i++){
    const c=document.createElement('div');
    c.className='cal-cell empty';
    grid.appendChild(c);
  }

  for(let day=1; day<=daysInMonth; day++){
    const dateObj = new Date(year, month, day);
    const dateKey = ymd(dateObj);
    const weekday = dateObj.getDay(); // 0=вс 6=сб
    const dayEvents = events.filter(e=>e.date===dateKey)
                            .sort((a,b)=>a.timeStart.localeCompare(b.timeStart));

    const cell=document.createElement('div');
    cell.className='cal-cell';
    if(dateKey===todayStr()) cell.classList.add('today');
    if(weekday===0||weekday===6) cell.classList.add('weekend');

    let html = `<div class="cell-num">${day}</div>`;
    if(dayEvents.length){
      html += `<span class="cell-count">${dayEvents.length}</span>`;
      html += `<div class="cell-events">`;
      dayEvents.slice(0,2).forEach(ev=>{
        html += `<div class="cell-event">${ev.timeStart} ${escapeHtml(ev.title)}</div>`;
      });
      if(dayEvents.length>2) html += `<div class="cell-more">+${dayEvents.length-2} ещё</div>`;
      html += `</div>`;
    }
    cell.innerHTML = html;
    cell.addEventListener('click',()=>openDay(dateKey));
    grid.appendChild(cell);
  }
}

/* ---------- Панель дня ---------- */
function openDay(dateKey){
  selectedDate = dateKey;
  const panel = document.getElementById('dayPanel');
  panel.style.display='block';

  const [y,m,d] = dateKey.split('-');
  const dObj = new Date(+y,+m-1,+d);
  const wd = ['Воскресенье','Понедельник','Вторник','Среда','Четверг','Пятница','Суббота'][dObj.getDay()];
  document.getElementById('dayTitle').textContent = `${+d} ${MONTHS[+m-1]} ${y} · ${wd}`;

  renderDayEvents();
  panel.scrollIntoView({behavior:'smooth',block:'start'});
}

function renderDayEvents(){
  const list = document.getElementById('dayEventsList');
  const dayEvents = events.filter(e=>e.date===selectedDate)
                          .sort((a,b)=>a.timeStart.localeCompare(b.timeStart));
  list.innerHTML='';

  if(!dayEvents.length){
    list.innerHTML = `<div class="empty-day">На этот день записей пока нет.</div>`;
    return;
  }

  dayEvents.forEach(ev=>{
    const card=document.createElement('div');
    card.className='event-card';

    let paidClass='unpaid', paidTxt=ev.paid||'Не оплачено';
    if(paidTxt==='Оплачено полностью') paidClass='paid';
    else if(paidTxt==='Предоплата') paidClass='prepaid';

    const timeStr = ev.timeEnd ? `${ev.timeStart}–${ev.timeEnd}` : ev.timeStart;

    card.innerHTML = `
      <h4>
        <span>${escapeHtml(ev.title)}</span>
        <span class="ev-time">${timeStr}</span>
      </h4>
      <div class="ev-row"><b>${escapeHtml(ev.type||'')}</b></div>
      ${ev.client?`<div class="ev-row">👤 <b>${escapeHtml(ev.client)}</b></div>`:''}
      ${ev.phone?`<div class="ev-row">📞 ${escapeHtml(ev.phone)}</div>`:''}
      ${ev.address?`<div class="ev-row">📍 ${escapeHtml(ev.address)}</div>`:''}
      ${ev.price?`<div class="ev-row">💰 ${escapeHtml(String(ev.price))} ₽ <span class="badge ${paidClass}">${escapeHtml(paidTxt)}</span></div>`:`<div class="ev-row"><span class="badge ${paidClass}">${escapeHtml(paidTxt)}</span></div>`}
      ${ev.note?`<div class="ev-row">📝 ${escapeHtml(ev.note)}</div>`:''}
    `;
    card.addEventListener('click',()=>openModal(ev.id));
    list.appendChild(card);
  });
}

/* ---------- Модалка ---------- */
function openModal(id){
  editingId = id || null;
  const modal = document.getElementById('eventModal');
  modal.classList.add('open');

  const [y,m,d]=selectedDate.split('-');
  document.getElementById('modalDateInfo').textContent =
    `Дата: ${+d} ${MONTHS[+m-1]} ${y}`;

  const delBtn = document.getElementById('deleteEventBtn');

  if(id){
    const ev = events.find(e=>e.id===id);
    document.getElementById('modalTitle').textContent='Редактировать съёмку';
    document.getElementById('fTitle').value = ev.title||'';
    document.getElementById('fType').value = ev.type||'📸 Фотосъёмка';
    document.getElementById('fTimeStart').value = ev.timeStart||'10:00';
    document.getElementById('fTimeEnd').value = ev.timeEnd||'';
    document.getElementById('fPrice').value = ev.price||'';
    document.getElementById('fPaid').value = ev.paid||'Не оплачено';
    document.getElementById('fClient').value = ev.client||'';
    document.getElementById('fPhone').value = ev.phone||'';
    document.getElementById('fAddress').value = ev.address||'';
    document.getElementById('fNote').value = ev.note||'';
    delBtn.style.display='inline-block';
  } else {
    document.getElementById('modalTitle').textContent='Новая съёмка';
    document.getElementById('fTitle').value='';
    document.getElementById('fType').value='📸 Фотосъёмка';
    document.getElementById('fTimeStart').value='10:00';
    document.getElementById('fTimeEnd').value='14:00';
    document.getElementById('fPrice').value='';
    document.getElementById('fPaid').value='Не оплачено';
    document.getElementById('fClient').value='';
    document.getElementById('fPhone').value='';
    document.getElementById('fAddress').value='';
    document.getElementById('fNote').value='';
    delBtn.style.display='none';
  }
}
function closeModal(){ document.getElementById('eventModal').classList.remove('open'); }

function saveEvent(){
  const title = document.getElementById('fTitle').value.trim();
  const timeStart = document.getElementById('fTimeStart').value;
  if(!title){ alert('Введите название мероприятия'); return; }
  if(!timeStart){ alert('Укажите время начала'); return; }

  const data = {
    date: selectedDate,
    title,
    type: document.getElementById('fType').value,
    timeStart,
    timeEnd: document.getElementById('fTimeEnd').value,
    price: document.getElementById('fPrice').value,
    paid: document.getElementById('fPaid').value,
    client: document.getElementById('fClient').value.trim(),
    phone: document.getElementById('fPhone').value.trim(),
    address: document.getElementById('fAddress').value.trim(),
    note: document.getElementById('fNote').value.trim(),
  };

  if(editingId){
    const idx = events.findIndex(e=>e.id===editingId);
    events[idx] = {...events[idx], ...data};
  } else {
    data.id = Date.now().toString(36)+Math.random().toString(36).slice(2,6);
    events.push(data);
  }

  save();
  closeModal();
  renderCalendar();
  renderDayEvents();
}

function deleteEvent(){
  if(!editingId) return;
  if(!confirm('Удалить эту запись?')) return;
  events = events.filter(e=>e.id!==editingId);
  save();
  closeModal();
  renderCalendar();
  renderDayEvents();
}

/* ---------- Экспорт истории ---------- */
function sortedAll(){
  return [...events].sort((a,b)=>
    (a.date+a.timeStart).localeCompare(b.date+b.timeStart));
}

function exportCSV(){
  if(!events.length){ alert('Записей пока нет.'); return; }
  const headers = ['Дата','Начало','Конец','Название','Тип','Клиент',
    'Телефон/контакт','Адрес','Стоимость','Оплата','Детали'];
  const rows = sortedAll().map(e=>[
    e.date, e.timeStart, e.timeEnd||'', e.title, e.type||'',
    e.client||'', e.phone||'', e.address||'', e.price||'',
    e.paid||'', (e.note||'').replace(/\n/g,' ')
  ]);
  let csv = '\uFEFF' + headers.join(';') + '\n';   // BOM для Excel + кириллицы
  rows.forEach(r=>{
    csv += r.map(cell=>`"${String(cell).replace(/"/g,'""')}"`).join(';')+'\n';
  });
  downloadFile(csv, `Съёмки_история_${todayStr()}.csv`, 'text/csv;charset=utf-8');
}

function exportTXT(){
  if(!events.length){ alert('Записей пока нет.'); return; }
  let txt = `ИСТОРИЯ СЪЁМОК (выгружено ${todayStr()})\n`;
  txt += '='.repeat(50)+'\n\n';
  let total=0;
  sortedAll().forEach((e,i)=>{
    const time = e.timeEnd?`${e.timeStart}–${e.timeEnd}`:e.timeStart;
    txt += `${i+1}) ${e.date}  ${time}\n`;
    txt += `   Мероприятие: ${e.title}\n`;
    txt += `   Тип: ${e.type||'-'}\n`;
    if(e.client)  txt += `   Клиент: ${e.client}\n`;
    if(e.phone)   txt += `   Контакт: ${e.phone}\n`;
    if(e.address) txt += `   Адрес: ${e.address}\n`;
    if(e.price){ txt += `   Стоимость: ${e.price} ₽ (${e.paid||'-'})\n`; total+=Number(e.price)||0; }
    else txt += `   Оплата: ${e.paid||'-'}\n`;
    if(e.note)    txt += `   Детали: ${e.note}\n`;
    txt += '\n';
  });
  txt += '='.repeat(50)+'\n';
  txt += `Всего записей: ${events.length}\n`;
  txt += `Сумма по указанным стоимостям: ${total} ₽\n`;
  downloadFile(txt, `Съёмки_история_${todayStr()}.txt`, 'text/plain;charset=utf-8');
}

function backupJSON(){
  const data = JSON.stringify(events, null, 2);
  downloadFile(data, `backup_календарь_${todayStr()}.json`, 'application/json');
}

function importJSON(file){
  const reader = new FileReader();
  reader.onload = e=>{
    try{
      const arr = JSON.parse(e.target.result);
      if(!Array.isArray(arr)) throw 0;
      if(confirm(`Импортировать ${arr.length} записей? Текущие будут заменены.`)){
        events = arr;
        save();
        renderCalendar();
        if(selectedDate) renderDayEvents();
        alert('Импорт завершён ✅');
      }
    }catch(err){ alert('Неверный файл бэкапа.'); }
  };
  reader.readAsText(file);
}

/* ---------- Помощники ---------- */
function downloadFile(content, filename, mime){
  const blob = new Blob([content], {type:mime});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href=url; a.download=filename;
  document.body.appendChild(a); a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
function escapeHtml(s){
  return String(s).replace(/[&<>"']/g,m=>({
    '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
}

/* ---------- События интерфейса ---------- */
document.getElementById('prevMonth').onclick = ()=>{ viewDate.setMonth(viewDate.getMonth()-1); renderCalendar(); };
document.getElementById('nextMonth').onclick = ()=>{ viewDate.setMonth(viewDate.getMonth()+1); renderCalendar(); };
document.getElementById('todayBtn').onclick = ()=>{ viewDate=new Date(); renderCalendar(); openDay(todayStr()); };

document.getElementById('dayClose').onclick = ()=>{ document.getElementById('dayPanel').style.display='none'; };
document.getElementById('addEventBtn').onclick = ()=> openModal(null);

document.getElementById('saveEventBtn').onclick = saveEvent;
document.getElementById('deleteEventBtn').onclick = deleteEvent;
document.getElementById('cancelEventBtn').onclick = closeModal;

document.getElementById('exportCsvBtn').onclick = exportCSV;
document.getElementById('exportTxtBtn').onclick = exportTXT;
document.getElementById('backupBtn').onclick = backupJSON;
document.getElementById('importBtn').onclick = ()=> document.getElementById('importFile').click();
document.getElementById('importFile').onchange = e=>{ if(e.target.files[0]) importJSON(e.target.files[0]); };

// закрытие модалки кликом по фону / Esc
document.getElementById('eventModal').addEventListener('click', e=>{
  if(e.target.id==='eventModal') closeModal();
});
document.addEventListener('keydown', e=>{ if(e.key==='Escape') closeModal(); });

/* ---------- Старт ---------- */
save(); // обновит счётчик
renderCalendar();
