(()=>{"use strict";
const START="2026-12-01",OPENING=2400000,RESERVE=1200000,DAY=86400000;
const add=(s,n)=>new Date(Date.parse(s+"T12:00:00Z")+n*DAY).toISOString().slice(0,10);
const fmt=s=>new Date(s+"T12:00:00Z").toLocaleDateString("ru-RU",{timeZone:"UTC",day:"2-digit",month:"2-digit",year:"numeric"});
const money=n=>new Intl.NumberFormat("ru-RU",{maximumFractionDigits:0}).format(Math.round(n))+" ₽";
const safe=s=>String(s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const customers=["АО «Северная генерация»","АО «Промышленная энергетика»","ПАО «ТеплоЭнерго»","АО «Волжский металлургический комбинат»","ООО «РегионЭнерго»","АО «СеверХим»","ПАО «ЭнергоПром»","АО «Индустриальные системы»"];
const jobs=["Капитальный ремонт турбинного агрегата","Средний ремонт насосной станции","Ремонт компрессорного оборудования","Капитальный ремонт питательного насоса","Средний ремонт редукторного механизма","Капитальный ремонт дымососа","Ремонт циркуляционных насосов","Средний ремонт электродвигателя","Капитальный ремонт теплообменного узла","Ремонт турбинного вспомогательного оборудования","Ремонт насосного агрегата","Средний ремонт компрессора"];
const finishOffsets=[-94,-74,-55,-43,-32,-15,2,15,31,46,65,85],deferrals=[60,90,60,60,90,30,60,90,60,60,90,60],amounts=[4200000,2800000,3100000,2200000,3500000,1800000,3900000,2600000,4100000,2900000,3200000,3600000];
const contracts=jobs.map((job,i)=>{const finish=add(START,finishOffsets[i]),signed=add(finish,3),due=add(signed,deferrals[i]);return{id:"D"+(i+1),job,customer:customers[i%customers.length],finish,signed,due,deferral:deferrals[i],amount:amounts[i]}});
const ops=[];
contracts.forEach(c=>ops.push({id:"R"+c.id,kind:"in",date:c.due,amount:c.amount,name:"Оплата по договору "+c.id,party:c.customer,contract:c.id,mandatory:false}));
const suppliers=["ООО «МеталлКомплект»","АО «ПромПодшипник»","ООО «РемСнаб»","ООО «СпецИнструмент»","АО «ТехСервис»","ООО «ПромЛогистика»"];
for(let i=0;i<90;i++){const offset=(i*7+Math.floor(i/6)*3)%180,day=add(START,offset),type=i%9;
let name,party,amount,mandatory=true,category;
if(type===0||type===1)continue;
if(type===2){name="Погашение кредита";party="Банк";amount=340000;category="Кредиты"}
else if(type===3){name="Проценты по кредиту";party="Банк";amount=118000;category="Кредиты"}
else if(type===4){name="Материалы для ремонта";party=suppliers[i%6];amount=350000+(i%4)*65000;category="Материалы"}
else if(type===5){name="Комплектующие";party=suppliers[i%6];amount=260000+(i%3)*70000;category="Материалы"}
else if(type===6){name="Субподрядные работы";party=suppliers[i%6];amount=280000;category="Субподряд";mandatory=false}
else if(type===7){name="Логистика";party=suppliers[5];amount=85000;category="Логистика";mandatory=true}
else{name="Административные расходы";party="Администрация";amount=70000;category="Административные";mandatory=false}
ops.push({id:"E"+i,kind:"out",date:day,amount,name,party,mandatory,category})}
// Регулярные платежи демонстрационной модели: зарплата дважды в месяц,
// налоги один раз в месяц. Даты условные и не заменяют налоговый календарь.
const previousWeekday=date=>{let d=date;while([0,6].includes(new Date(d+"T12:00:00Z").getUTCDay()))d=add(d,-1);return d};
for(let month=0;month<6;month++){
 const ym=new Date(Date.UTC(2026,11+month,1)).toISOString().slice(0,7);
 const last=new Date(Date.UTC(2026,12+month,0)).toISOString().slice(0,10);
 for(const [part,date] of [["Аванс",ym+"-15"],["Окончательный расчёт",last]]){
  ops.push({id:"SAL-"+ym+"-"+part,kind:"out",date:previousWeekday(date),amount:420000,name:"Заработная плата · "+part,party:"Сотрудники",mandatory:true,category:"Персонал"});
 }
 ops.push({id:"TAX-"+ym,kind:"out",date:previousWeekday(ym+"-12"),amount:215000,name:"Налоги и взносы",party:"Бюджет",mandatory:true,category:"Налоги"});
}
// Командировочные расходы выездных ремонтных бригад (демо):
// три самостоятельные выплаты по 350 000 ₽ ежемесячно.
for(let month=0;month<6;month++){
 const ym=new Date(Date.UTC(2026,11+month,1)).toISOString().slice(0,7);
 for(const day of ["05","15","25"]){
  ops.push({id:"TRAVEL-"+ym+"-"+day,kind:"out",date:previousWeekday(ym+"-"+day),amount:350000,name:"Командировочные расходы",party:"Выездные бригады",mandatory:true,category:"Командировочные расходы"});
 }
}
// Исключаем точные дубли в демонстрационных операциях до расчёта остатков.
const seenOps=new Set();
for(let i=ops.length-1;i>=0;i--){const o=ops[i],key=[o.kind,o.date,o.name,o.party,o.amount].join("|");if(seenOps.has(key))ops.splice(i,1);else seenOps.add(key)}
// Корректировки плановых операций хранятся отдельно от исходного DEMO-набора.
const BASE_OPS=ops.map(o=>({...o}));
const OPS_KEY="cash-flow-radar-operations-v1";
function loadOperations(){try{
 const saved=JSON.parse(localStorage.getItem(OPS_KEY)||"null");
 if(!saved||!Array.isArray(saved.edits)||!Array.isArray(saved.added)||!Array.isArray(saved.deleted))return;
 const edits=new Map(saved.edits.filter(x=>x&&typeof x.id==="string").map(x=>[x.id,x]));
 const deleted=new Set(saved.deleted);
 const validate=o=>o&&typeof o.id==="string"&&["in","out"].includes(o.kind)&&/^\d{4}-\d{2}-\d{2}$/.test(o.date)&&Number.isSafeInteger(o.amount)&&o.amount>0&&typeof o.name==="string"&&typeof o.party==="string"&&typeof o.mandatory==="boolean";
 const updated=BASE_OPS.filter(o=>!deleted.has(o.id)).map(o=>{const e=edits.get(o.id);return e&&validate(e)?{...o,...e,id:o.id,contract:o.contract}:o});
 const added=saved.added.filter(o=>validate(o)&&o.id.startsWith("USER-")&&!BASE_OPS.some(b=>b.id===o.id));
 ops.splice(0,ops.length,...updated,...added);
 }catch(e){/* Неверные сохранённые данные не ломают демо */}}
function saveOperations(){try{
 const base=new Map(BASE_OPS.map(o=>[o.id,o]));
 localStorage.setItem(OPS_KEY,JSON.stringify({edits:ops.filter(o=>base.has(o.id)&&JSON.stringify(o)!==JSON.stringify(base.get(o.id))),added:ops.filter(o=>!base.has(o.id)),deleted:BASE_OPS.filter(o=>!ops.some(x=>x.id===o.id)).map(o=>o.id)}));
 }catch(e){alert("Не удалось сохранить изменения в браузере. Проверьте доступность хранилища.")}}
loadOperations();
const defaultScenario=()=>({receipt:"D4",receiptShift:0,expense:ops.find(o=>o.kind==="out"&&!o.mandatory).id,expenseShift:0,saving:0});
const STORAGE_KEY="cash-flow-radar-scenario-v1";
let days=90,page="overview",filter="all",scenario=defaultScenario();
const clamp=(v,min,max)=>Number.isFinite(Number(v))?Math.min(max,Math.max(min,Math.round(Number(v)))):0;
function saveScenario(){try{localStorage.setItem(STORAGE_KEY,JSON.stringify({scenario,days}))}catch(e){/* Хранилище может быть недоступно */}}
function restoreScenario(){try{
 const saved=JSON.parse(localStorage.getItem(STORAGE_KEY)||"null");if(!saved||!saved.scenario)return;
 const x=saved.scenario;
 scenario={receipt:contracts.some(c=>c.id===x.receipt)?x.receipt:"D4",receiptShift:clamp(x.receiptShift,-30,60),expense:ops.some(o=>o.id===x.expense&&o.kind==="out"&&!o.mandatory)?x.expense:defaultScenario().expense,expenseShift:clamp(x.expenseShift,0,90),saving:clamp(x.saving,0,30)};
 if([30,90,180].includes(saved.days))days=saved.days;
 }catch(e){scenario=defaultScenario()}}
restoreScenario();
const $=id=>document.getElementById(id);
function currentOps(sc=false){return ops.map(o=>{if(!sc)return o;let date=o.date,amount=o.amount;if(o.kind==="in"&&o.contract===scenario.receipt)date=add(date,scenario.receiptShift);if(o.kind==="out"&&o.id===scenario.expense)date=add(date,scenario.expenseShift);if(o.kind==="out"&&!o.mandatory)amount=Math.round(amount*(1-scenario.saving/100));return {...o,date,amount}})}
function calc(n,sc=false){const endDate=add(START,n-1),selected=currentOps(sc).filter(o=>o.date>=START&&o.date<=endDate),byDate=new Map();for(const o of selected){if(!byDate.has(o.date))byDate.set(o.date,[]);byDate.get(o.date).push(o)}
let balance=OPENING,inflow=0,outflow=0,min=Infinity,first=null;const series=[];for(let i=0;i<n;i++){const date=add(START,i),dayOps=byDate.get(date)||[];let ins=0,outs=0;for(const o of dayOps){if(o.kind==="in")ins+=o.amount;else outs+=o.amount}inflow+=ins;outflow+=outs;balance+=ins-outs;if(balance<min)min=balance;if(balance<0&&!first)first=date;series.push({date,balance,ins,outs,dayOps})}return{series,selected,inflow,outflow,end:balance,min,first,endDate}}
function chart(a,b){const w=900,h=250,p=45,all=[...a.series.map(x=>x.balance),...(b?b.series.map(x=>x.balance):[]),0,RESERVE],lo=Math.min(...all),hi=Math.max(...all),span=hi-lo||1,x=i=>p+i/(a.series.length-1)*(w-p-15),y=v=>25+(hi-v)/span*(h-70),path=s=>s.map((o,i)=>(i?"L":"M")+x(i).toFixed(1)+","+y(o.balance).toFixed(1)).join(" ");let s='<svg viewBox="0 0 '+w+' '+h+'" role="img" aria-label="Прогноз ежедневного остатка"><rect x="'+p+'" y="'+y(0)+'" width="'+(w-p-15)+'" height="'+Math.max(0,h-40-y(0))+'" fill="#fff1f0"/><line x1="'+p+'" x2="'+(w-15)+'" y1="'+y(0)+'" y2="'+y(0)+'" stroke="#c87979" stroke-dasharray="5 5"/>';s+='<line x1="'+p+'" x2="'+(w-15)+'" y1="'+y(RESERVE)+'" y2="'+y(RESERVE)+'" stroke="#d59a35" stroke-width="1.8" stroke-dasharray="8 5"/><rect x="'+(w-198)+'" y="'+Math.max(7,y(RESERVE)-22)+'" width="180" height="18" rx="4" fill="#fffaf0" fill-opacity=".94"/><text x="'+(w-24)+'" y="'+Math.max(20,y(RESERVE)-9)+'" text-anchor="end" font-size="11" font-weight="600" fill="#a16c17">Резерв: '+money(RESERVE)+'</text><text x="'+(w-24)+'" y="'+Math.min(h-42,y(0)-6)+'" text-anchor="end" font-size="10" fill="#c87979">Нулевой остаток</text>';s+='<path d="'+path(a.series)+'" stroke="#347e8a" stroke-width="3" stroke-dasharray="7 5" fill="none"/>';if(b)s+='<path d="'+path(b.series)+'" stroke="#d2a65e" stroke-width="2.5" fill="none"/>';for(let i=0;i<a.series.length;i+=Math.max(1,Math.floor(a.series.length/6)))s+='<text x="'+x(i)+'" y="'+(h-9)+'" text-anchor="middle" font-size="11" fill="#839799">'+fmt(a.series[i].date).slice(0,5)+'</text>';s+='<g class="hover-layer">';for(let i=0;i<a.series.length;i++){const left=i===0?p:x(i)-((w-p-15)/(a.series.length-1))/2;const width=i===0||i===a.series.length-1?((w-p-15)/(a.series.length-1))/2:((w-p-15)/(a.series.length-1));s+='<rect data-day="'+i+'" x="'+left+'" y="15" width="'+width+'" height="'+(h-45)+'" fill="transparent" style="cursor:crosshair"/>'}s+='</g></svg>';return s}
function setupChartTooltip(){for(const id of ["chart","scenarioChart"]){const host=$(id);host.style.position="relative";let tip=host.querySelector(".chart-tip");if(!tip){tip=document.createElement("div");tip.className="chart-tip";Object.assign(tip.style,{position:"absolute",display:"none",pointerEvents:"none",background:"#183944",color:"#fff",padding:"11px 13px",borderRadius:"9px",fontSize:"12px",lineHeight:"1.7",boxShadow:"0 8px 20px #0003",zIndex:"3",whiteSpace:"nowrap"});host.appendChild(tip)}host.onpointermove=e=>{const hit=e.target.closest("[data-day]");if(!hit||!host.contains(hit)){tip.style.display="none";return}const idx=+hit.dataset.day,base=calc(days).series[idx],other=id==="scenarioChart"?calc(days,true).series[idx]:null;if(!base)return;tip.innerHTML='<b>'+fmt(base.date)+'</b><div>Остаток: <b style="color:'+(base.balance<0?"#ff8e8e":"#9ce6cb")+'">'+money(base.balance)+'</b></div><div>Поступления: '+money(base.ins)+'</div><div>Выплаты: '+money(base.outs)+'</div>'+(other?'<div style="border-top:1px solid #64818a;margin-top:5px;padding-top:5px">Сценарий: <b style="color:'+(other.balance<0?"#ff8e8e":"#f3d89c")+'">'+money(other.balance)+'</b></div>':'');tip.style.display="block";const rect=host.getBoundingClientRect();let left=e.clientX-rect.left+14,top=e.clientY-rect.top-105;const tw=tip.offsetWidth;if(left+tw>rect.width)left=e.clientX-rect.left-tw-14;tip.style.left=Math.max(0,left)+"px";tip.style.top=Math.max(0,top)+"px"};host.onpointerleave=()=>{tip.style.display="none"}}}
function card(name,value,desc,cls=""){return'<div class="kpi"><small>'+name+'</small><strong class="'+cls+'">'+value+'</strong><span>'+desc+'</span></div>'}
function overview(){const a=calc(days),state=a.first?"danger":a.min<RESERVE?"warning":"normal";$("radar").dataset.state=state;$("radarState").textContent=state==="danger"?"КАССОВЫЙ РАЗРЫВ":state==="warning"?"ТРЕБУЕТСЯ ВНИМАНИЕ":"ДЕНЕЖНЫЙ ПОТОК В НОРМЕ";$("radarReason").textContent=state==="danger"?"Первый отрицательный остаток: "+fmt(a.first):state==="warning"?"Минимальный остаток ниже резерва":"Резерв ликвидности соблюдён";$("kpis").innerHTML=card("Деньги на начало",money(OPENING),"01.12.2026")+card("Плановые поступления",money(a.inflow),"За "+days+" дней")+card("Плановые выплаты",money(a.outflow),"За "+days+" дней")+card("Остаток на конец",money(a.end),"Расчёт по всем операциям",a.end<0?"bad":"good")+card("Минимальный остаток",money(a.min),"На выбранном горизонте",a.min<0?"bad":"")+card("Первый кассовый разрыв",a.first?fmt(a.first):"Не выявлен","Резерв: "+money(RESERVE),a.first?"bad":"good");$("chart").innerHTML=chart(a);$("risk").className="risk"+(a.first?"":" ok");$("risk").textContent=a.first?"Риск: "+fmt(a.first)+" прогнозный остаток становится отрицательным. Минимальный остаток "+money(a.min)+". Требуется проработать график поступлений и обязательных платежей.":a.min<RESERVE?"Кассового разрыва нет, но минимальный остаток "+money(a.min)+" ниже установленного резерва "+money(RESERVE)+".":"Кассовых разрывов и снижения ниже установленного резерва в выбранном периоде не выявлено."}
function calendar(){const a=calc(days),rows=[];for(const d of a.series){const os=d.dayOps.filter(o=>filter==="all"||o.kind===filter);for(const o of os)rows.push('<tr><td>'+fmt(d.date)+'</td><td>'+safe(o.name)+'</td><td>'+safe(o.party)+'</td><td>'+(o.kind==="in"?money(o.amount):"—")+'</td><td>'+(o.kind==="out"?money(o.amount):"—")+'</td><td class="'+(d.balance<0?"bad":"")+'">'+money(d.balance)+'</td><td class="op-actions"><button class="outline small-btn" data-edit="'+safe(o.id)+'" aria-label="Редактировать операцию">Изменить</button> <button class="outline small-btn" data-delete="'+safe(o.id)+'" aria-label="Удалить операцию">Удалить</button></td></tr>')} $("calRows").innerHTML=rows.join("")||'<tr><td colspan="7">Операций по фильтру нет</td></tr>'}
function refreshSelectors(){
 const selectedReceipt=scenario.receipt,selectedExpense=scenario.expense;
 $("receipt").innerHTML=contracts.filter(c=>ops.some(o=>o.kind==="in"&&o.contract===c.id)).map(c=>'<option value="'+safe(c.id)+'">'+safe(c.id+" · "+c.customer+" · "+money(ops.find(o=>o.contract===c.id&&o.kind==="in").amount))+'</option>').join("");
 $("expense").innerHTML=ops.filter(o=>o.kind==="out"&&!o.mandatory).map(o=>'<option value="'+safe(o.id)+'">'+fmt(o.date)+" · "+safe(o.name)+" · "+money(o.amount)+'</option>').join("");
 if(![...$("receipt").options].some(o=>o.value===selectedReceipt))scenario.receipt=$("receipt").options[0]?.value||"";
 if(![...$("expense").options].some(o=>o.value===selectedExpense))scenario.expense=$("expense").options[0]?.value||"";
 $("receipt").value=scenario.receipt;$("expense").value=scenario.expense;
 saveScenario();
}
function openOperation(id=""){
 const o=id?ops.find(x=>x.id===id):null;if(id&&!o)return;
 $("operationForm").reset();$("operationId").value=o?.id||"";
 $("operationKind").value=o?.kind||"out";
 $("operationDate").value=o?.date||START;
 $("operationAmount").value=o?.amount||"";
 $("operationName").value=o?.name||"";
 $("operationParty").value=o?.party||"";
 $("operationMandatory").checked=o?.mandatory??true;
 $("operationHeading").textContent=o?"Изменить плановую операцию":"Добавить плановую операцию";
 $("operationDialog").showModal();
}
function deleteOperation(id){
 const o=ops.find(x=>x.id===id);if(!o||!confirm("Удалить плановую операцию «"+o.name+"» на "+money(o.amount)+"?"))return;
 ops.splice(ops.indexOf(o),1);saveOperations();refreshSelectors();render();
}
function saveOperation(e){
 e.preventDefault();const form=$("operationForm");if(!form.reportValidity())return;
 const id=$("operationId").value,old=id?ops.find(o=>o.id===id):null;
 const date=$("operationDate").value,amount=Number($("operationAmount").value),name=$("operationName").value.trim(),party=$("operationParty").value.trim();
 if(!/^\d{4}-\d{2}-\d{2}$/.test(date)){alert("Некорректная дата. Выберите дату в календаре.");return}if(!Number.isSafeInteger(amount)||amount<=0){alert("Сумма должна быть положительным целым числом.");return}if(!name){alert("Заполните наименование операции.");return}if(!party){alert("Заполните контрагента.");return}
 const operation={...(old||{}),id:old?.id||"USER-"+Date.now()+"-"+Math.random().toString(36).slice(2,8),kind:$("operationKind").value,date,amount,name,party,mandatory:$("operationMandatory").checked};
 if(operation.kind==="in")operation.mandatory=false;
 if(old)ops.splice(ops.indexOf(old),1,operation);else ops.push(operation);
 saveOperations();$("operationDialog").close();refreshSelectors();render();
}
function debt(){
 const linked=contracts.map(c=>{
  const payments=ops.filter(o=>o.kind==="in"&&o.contract===c.id);
  const planned=payments.reduce((sum,o)=>sum+o.amount,0);
  const dates=payments.map(o=>o.date).sort();
  const status=!payments.length?"Нет в прогнозе":planned!==c.amount?"Расхождение суммы":dates.some(d=>d!==c.due)?"Дата скорректирована":"По графику";
  return{c,payments,planned,dates,status};
 });
 const contractual=linked.reduce((sum,x)=>sum+x.c.amount,0);
 const forecast=linked.reduce((sum,x)=>sum+x.planned,0);
 const exceptions=linked.filter(x=>x.status!=="По графику").length;
 const otherReceipts=ops.filter(o=>o.kind==="in"&&!o.contract).reduce((sum,o)=>sum+o.amount,0);
 $("debtKpis").innerHTML=card("Сумма по договорам",money(contractual),"12 ремонтных договоров")+card("Плановые поступления по договорам",money(forecast),"По актуальному платёжному календарю")+card("Расхождения с графиком",String(exceptions),"Договоров требуют внимания")+card("Прочие плановые поступления",money(otherReceipts),"Без привязки к договору");
 $("debtRows").innerHTML=linked.map(({c,planned,dates,status})=>'<tr><td>'+safe(c.id+" · "+c.job)+'</td><td>'+safe(c.customer)+'</td><td>'+fmt(c.finish)+'</td><td>'+fmt(c.signed)+'</td><td>'+c.deferral+' дн.</td><td>'+fmt(c.due)+'</td><td>'+money(c.amount)+'</td><td>'+(dates.length?dates.map(fmt).join(", "):"Не запланировано")+'</td><td>'+money(planned)+'</td><td class="'+(status==="По графику"?"good":"bad")+'">'+safe(status)+'</td></tr>').join("");
}
function scenarioRender(){if(!ops.some(o=>o.kind==="in"&&o.contract===scenario.receipt)||!ops.some(o=>o.kind==="out"&&o.id===scenario.expense&&!o.mandatory)){refreshSelectors()}const a=calc(days),b=calc(days,true),delta=b.end-a.end;$("receiptValue").textContent=scenario.receiptShift+" дней";$("expenseValue").textContent=scenario.expenseShift+" дней";$("savingValue").textContent=scenario.saving+"%";$("comparison").innerHTML='<div><small>Базовый остаток на конец</small><strong class="'+(a.end<0?"bad":"")+'">'+money(a.end)+'</strong><small>Первый разрыв: '+(a.first?fmt(a.first):"нет")+'</small><small>Минимальный остаток: <span class="'+(a.min<0?"bad":"")+'">'+money(a.min)+'</span></small><small>Максимальный кассовый дефицит: <span class="'+(a.min<0?"bad":"")+'">'+money(Math.max(0,-a.min))+'</span></small></div><div><small>Остаток после изменений</small><strong class="'+(b.end<0?"bad":"")+'">'+money(b.end)+'</strong><small>Первый разрыв: '+(b.first?fmt(b.first):"нет")+'</small><small>Минимальный остаток: <span class="'+(b.min<0?"bad":"")+'">'+money(b.min)+'</span></small><small>Максимальный кассовый дефицит: <span class="'+(b.min<0?"bad":"")+'">'+money(Math.max(0,-b.min))+'</span></small><small class="'+(b.min<RESERVE?"bad":"good")+'">'+(b.min>=RESERVE?"Резерв ликвидности соблюдён: запас ":"Резерв ликвидности нарушен: недостаток ")+money(Math.abs(b.min-RESERVE))+'</small></div>';$("scenarioChart").innerHTML=chart(a,b);const selectedContract=contracts.find(c=>c.id===scenario.receipt)||contracts[0],receiptOp=ops.find(o=>o.contract===scenario.receipt&&o.kind==="in"),baseReceiptDate=receiptOp?receiptOp.date:selectedContract.due,shiftedDate=add(baseReceiptDate,scenario.receiptShift),inBase=!!receiptOp&&baseReceiptDate>=START&&baseReceiptDate<=a.endDate,inScenario=shiftedDate>=START&&shiftedDate<=a.endDate;const dateNotice=!inBase&&!inScenario?" Внимание: обе даты поступления ("+fmt(baseReceiptDate)+" и "+fmt(shiftedDate)+") вне выбранного горизонта, поэтому данный платёж не влияет на прогноз.":!inBase?" Внимание: исходная дата оплаты ("+fmt(selectedContract.due)+") вне горизонта; в сценарии поступление включено.":!inScenario?" Внимание: новая дата оплаты ("+fmt(shiftedDate)+") вне горизонта, поступление не учитывается в сценарии.":"";const differentDays=a.series.filter((row,i)=>row.balance!==b.series[i].balance).length;$("scenarioNote").textContent="Изменение конечного остатка: "+money(delta)+". Дней с отличием от базового прогноза: "+differentDays+"."+dateNotice+" Бирюзовый пунктир — базовый прогноз; золотая сплошная линия — изменённый сценарий. На совпадающих участках золотая линия перекрывает пунктир. Сдвиг платежа за горизонт не отменяет обязательство. Изменение ожидаемой оплаты не гарантирует поступление."}
function render(){document.querySelectorAll(".page").forEach(el=>el.classList.toggle("active",el.id===page));document.querySelectorAll("#nav button").forEach(el=>el.classList.toggle("active",el.dataset.page===page));document.querySelectorAll("#horizon button").forEach(el=>el.classList.toggle("active",+el.dataset.days===days));$("title").textContent=({overview:"Финансовый радар",calendar:"Платёжный календарь",debt:"Дебиторская задолженность",scenario:"Сценарный анализ"})[page];overview();calendar();debt();scenarioRender();setupChartTooltip()}
refreshSelectors();for(const key of Object.keys(scenario))$(key).value=scenario[key];
$("addOperation").onclick=()=>openOperation();$("operationCancel").onclick=()=>$("operationDialog").close();$("operationForm").onsubmit=saveOperation;$("calRows").onclick=e=>{const edit=e.target.closest("[data-edit]"),del=e.target.closest("[data-delete]");if(edit)openOperation(edit.dataset.edit);if(del)deleteOperation(del.dataset.delete)};
document.querySelectorAll("#nav button").forEach(b=>b.onclick=()=>{page=b.dataset.page;render()});document.querySelectorAll("#horizon button").forEach(b=>b.onclick=()=>{days=+b.dataset.days;saveScenario();render()});$("calFilter").onchange=e=>{filter=e.target.value;calendar()};
for(const [id,key] of [["receipt","receipt"],["expense","expense"],["receiptShift","receiptShift"],["expenseShift","expenseShift"],["saving","saving"]])$(id).oninput=e=>{scenario[key]=["receiptShift","expenseShift","saving"].includes(key)?+e.target.value:e.target.value;saveScenario();render()};
$("reset").onclick=()=>{scenario=defaultScenario();refreshSelectors();saveScenario();for(const key of Object.keys(scenario))$(key).value=scenario[key];$("receipt").selectedIndex=contracts.findIndex(c=>c.id==="D4");render()};
for(const n of [30,90,180]){const a=calc(n);if(a.end!==OPENING+a.inflow-a.outflow||a.min!==Math.min(...a.series.map(x=>x.balance)))throw Error("Нарушена сверка денежных потоков")}
render();
})();