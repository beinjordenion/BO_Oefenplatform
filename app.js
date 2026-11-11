const TEACHER_PIN = "2468";
const STORAGE_KEY = "BO_Oefenplatform_bank";
const MODULES_KEY = "BO_Oefenplatform_modules";
const modules = [
  {id:"keypad", icon:"⌨️", title:"Numeriek klavier", desc:"Test je snelheid met tien willekeurige getallen en verbeter je tijd.", tag:"Snelheidstest"},
  {id:"invoice", icon:"🧾", title:"Factuurberekening", desc:"Bereken goederenbedragen, kortingen, kosten, btw en het te betalen factuurtotaal.", tag:"Btw & facturen"},
  {id:"payroll", icon:"💶", title:"Loonberekening", desc:"Bereken het nettoloon op basis van brutoloon, RSZ en bedrijfsvoorheffing uit de opgave.", tag:"Bruto & netto"},
  {id:"ledger", icon:"📚", title:"Dubbel boekhouden", desc:"Oefen met MAR-rekeningen, schulden, documenten en boekingen in het journaal.", tag:"MAR & boekingen"},
  {id:"credit", icon:"↩️", title:"Creditnota", desc:"Bereken de bedragen en btw op creditnota's voor aankoop of verkoop.", tag:"Aankoop & verkoop"},
  {id:"documents", icon:"📂", title:"Documentenstroom", desc:"Herken aankoop- en verkoopdocumenten en bepaal hoe ze worden verwerkt.", tag:"Documenten"}
];

let bank = loadBank();
let moduleVisibility = loadModuleVisibility();
let currentQuestion = null;
let invoiceScenario = null;
let creditScenario = null;
let currentInvoiceExercise = null;
let currentCreditExercise = null;
let adminModuleFilter = "";
let keypadNumbers = [];
let keypadIndex = 0;
let keypadStartedAt = 0;
let keypadBestTimes = [];
let currentRole = sessionStorage.getItem("boRole");
let dialogAction = null;
let dialogReturnFocus = null;

const $ = (s, root=document) => root.querySelector(s);
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const money = n => Number(n).toLocaleString("nl-BE",{minimumFractionDigits:2,maximumFractionDigits:2});
const formatSeconds = seconds => Number(seconds).toLocaleString("nl-BE",{minimumFractionDigits:2,maximumFractionDigits:2});
const moduleById = id => modules.find(m=>m.id===id);

function escapeRegExp(value){
  return value.replace(/[.*+?^${}()|[\]\\]/g,"\\$&");
}
function nextSequentialTitle(title, questions){
  const cleanTitle=String(title||"Oefening").trim()||"Oefening";
  const match=cleanTitle.match(/^(.*?)(\d+)$/);
  const prefix=match?match[1]:`${cleanTitle} `;
  const initialNumber=match?Number(match[2]):1;
  const width=match?match[2].length:1;
  const pattern=new RegExp(`^${escapeRegExp(prefix)}(\\d+)$`,"i");
  const existingNumbers=questions.map(question=>pattern.exec(String(question.title||"").trim())).filter(Boolean).map(result=>Number(result[1]));
  const nextNumber=existingNumbers.length?Math.max(...existingNumbers)+1:initialNumber;
  return `${prefix}${String(nextNumber).padStart(width,"0")}`;
}
function uniqueQuestionId(id, questions){
  const used=new Set(questions.map(question=>question.id));
  const base=String(id||"oefening").trim()||"oefening";
  if(!used.has(base))return base;
  let suffix=2;
  while(used.has(`${base}-${suffix}`))suffix++;
  return `${base}-${suffix}`;
}
function uniqueExerciseTitle(title, questions, excludedId=""){
  const cleanTitle=String(title||"Oefening").trim()||"Oefening";
  const used=questions.filter(question=>question.id!==excludedId);
  if(!used.some(question=>String(question.title||"").trim().toLowerCase()===cleanTitle.toLowerCase()))return cleanTitle;
  let candidate=nextSequentialTitle(cleanTitle,used);
  while(used.some(question=>String(question.title||"").trim().toLowerCase()===candidate.toLowerCase())){
    candidate=nextSequentialTitle(candidate,used);
    used.push({title:candidate});
  }
  return candidate;
}
function showActionDialog({title,message,cancelText="Annuleer",confirmText,confirmClass="btn-primary",inputValue=null,onConfirm=null}){
  const dialog=$("#logoutDialog");
  dialogReturnFocus=document.activeElement;
  dialogAction=onConfirm;
  $("#logoutDialogTitle").textContent=title;
  $("#logoutDialogMessage").textContent=message;
  const inputField=$("#dialogInputField");
  inputField.hidden=inputValue===null;
  if(inputValue!==null){
    $("#dialogInput").value=inputValue;
    $("#dialogInput").required=true;
  }else{
    $("#dialogInput").value="";
    $("#dialogInput").required=false;
  }
  $("#cancelLogout").textContent=cancelText;
  const confirmButton=$("#confirmLogout");
  confirmButton.textContent=confirmText;
  confirmButton.className=`btn ${confirmClass}`;
  dialog.showModal();
  if(inputValue!==null){
    $("#dialogInput").focus();
    $("#dialogInput").select();
  }else $("#cancelLogout").focus();
}
function closeActionDialog(){
  const dialog=$("#logoutDialog");
  if(dialog.open)dialog.close();
  dialogAction=null;
  if(dialogReturnFocus instanceof HTMLElement&&dialogReturnFocus.isConnected&&!dialogReturnFocus.hidden)dialogReturnFocus.focus();
}

function loadBank(){
  try { const parsed=JSON.parse(localStorage.getItem(STORAGE_KEY)); return Array.isArray(parsed)?parsed:[]; }
  catch { return []; }
}
function loadModuleVisibility(){
  try{
    const saved=JSON.parse(localStorage.getItem(MODULES_KEY));
    return Object.fromEntries(modules.map(module=>[module.id,typeof saved?.[module.id]==="boolean"?saved[module.id]:false]));
  }catch{return Object.fromEntries(modules.map(module=>[module.id,false]));}
}
function saveBank(){ localStorage.setItem(STORAGE_KEY,JSON.stringify(bank)); }
function page(name){
  if(currentRole==="teacher"&&name!=="beheer")return;
  if(currentRole==="student"&&!["start","oefeningen","exercise"].includes(name))return;
  if(!currentRole)return;
  document.querySelectorAll(".page").forEach(p=>p.classList.remove("active"));
  $(`#${name}Page`)?.classList.add("active");
  document.querySelectorAll(".nav-link").forEach(a=>a.classList.toggle("active",a.dataset.page===name));
  $("#mainNav").classList.remove("open");
  window.scrollTo({top:0,behavior:"instant"});
}
function showRoleChooser(){
  currentRole="";
  sessionStorage.removeItem("boRole");
  sessionStorage.removeItem("boTeacherUnlocked");
  document.querySelectorAll(".page").forEach(p=>p.classList.remove("active"));
  $("#rolePage").classList.add("active");
  $("#mainNav").hidden=true;
  $("#menuToggle").hidden=true;
  $("#logoutBtn").hidden=true;
  $("#studentImportPanel").hidden=true;
  $("#teacherLoginPanel").hidden=true;
  $("#rolePage").querySelector(".role-options").hidden=false;
  $("#learnerImportFeedback").textContent="";
  $("#teacherPin").value="";
  $("#loginFeedback").textContent="";
  $("#loginFeedback").className="feedback";
  window.scrollTo({top:0,behavior:"instant"});
}
function activateRole(role){
  currentRole=role;
  sessionStorage.setItem("boRole",role);
  $("#rolePage").classList.remove("active");
  $("#mainNav").hidden=false;
  $("#menuToggle").hidden=false;
  $("#logoutBtn").hidden=false;
  document.querySelectorAll(".nav-link").forEach(link=>{
    link.hidden=role==="teacher"?link.dataset.page!=="beheer":link.dataset.page==="beheer";
  });
  if(role==="teacher"){
    renderAdmin();
    page("beheer");
  }else{
    renderModuleCards();
    page("start");
  }
}
function renderModuleCards(){
  const card = m=>`<article class="module-card module-card-link" data-module="${m.id}" role="button" tabindex="0" aria-label="Open ${esc(m.title)}"><div class="module-icon" aria-hidden="true">${m.icon}</div><h3>${esc(m.title)}</h3><p>${esc(m.desc)}</p><span class="btn btn-primary module-card-action">Open oefeningen →</span></article>`;
  const available=modules.filter(module=>isModuleAvailable(module.id));
  $("#allModules").innerHTML=available.length?available.map(card).join(""):'<p class="muted">Er zijn momenteel geen oefenmodules beschikbaar.</p>';
}
function hasModuleExercises(moduleId){
  if(moduleId==="keypad")return true;
  if(moduleId==="invoice")return bank.some(isInvoiceExercise);
  if(moduleId==="credit")return bank.some(question=>question.module==="credit");
  return bank.some(question=>question.module===moduleId);
}
function isModuleAvailable(moduleId){
  return Boolean(moduleVisibility[moduleId]&&hasModuleExercises(moduleId));
}
function openModule(id){
  if(!isModuleAvailable(id))return;
  $("#exercisePage").classList.toggle("keypad-exercise",id==="keypad");
  if(id==="keypad"){openKeypad();return;}
  if(id==="invoice"){openInvoiceExercise();return;}
  if(id==="credit"){openCreditExercise();return;}
  const list=bank.filter(q=>q.module===id);
  page("exercise");
  $("#exerciseContent").innerHTML=`<div class="exercise-shell"><div class="module-heading"><div class="exercise-title"><div class="module-icon">${moduleById(id)?.icon||"📘"}</div><div><h1>${esc(moduleById(id)?.title||"Oefening")}</h1><p>${esc(moduleById(id)?.tag||"Oefenen")}</p></div></div></div>${list.length?`<div class="question-grid">${list.map(q=>`<article class="question-card"><span class="tag">${esc(q.level)}</span><h3>${esc(q.title)}</h3><p>${esc(q.prompt)}</p><button class="btn btn-primary" data-question="${esc(q.id)}">Start deze oefening →</button></article>`).join("")}</div>`:`<p class="muted">Er zijn nog geen oefeningen in dit onderdeel. Vraag je leerkracht om opdrachten toe te voegen.</p>`}</div>`;
}
function openInvoiceExercise(){
  if(!isModuleAvailable("invoice"))return;
  $("#exercisePage").classList.remove("keypad-exercise");
  page("exercise");
  $("#exerciseContent").innerHTML=`<div class="exercise-shell invoice-shell">
    <div class="invoice-heading">
      <div class="exercise-title"><div class="module-icon">${moduleById("invoice").icon}</div><div><h1>Factuurberekening</h1><p>Bereken de factuur stap voor stap.</p></div></div>
      <div class="invoice-controls">
        <label for="invoiceLevel">Niveau
          <select id="invoiceLevel"><option value="all">Alle niveaus</option>${invoiceLevels.map((level,index)=>`<option value="${index+1}">Niveau ${index+1}</option>`).join("")}</select>
        </label>
      </div>
    </div>
    <div class="invoice-start-controls"><button class="btn btn-primary" id="newInvoiceExercise" type="button">Nieuwe opgave</button></div>
    <p id="invoiceExerciseStatus" class="notice">Klik op <strong>Nieuwe opgave</strong> om te starten.</p>
    <section class="invoice-task" id="invoiceTask" hidden>
      <div class="invoice-task-heading"><div><span class="tag">OPGAVE</span><h2 id="invoiceTaskTitle">Bereken de factuur</h2></div><p id="invoiceLevelDescription"></p></div>
      <div id="invoicePrompt" class="invoice-prompt"></div>
      <p class="invoice-instructions">Vul alle lege vakken in, ook het btw-percentage. Gebruik € 0,00 voor onderdelen die niet in de opgave staan en rond bedragen af op twee decimalen.</p>
    </section>
    <section class="invoice-table-section" id="invoiceTableSection" aria-label="Factuurberekening invultabel" hidden>
      <div class="invoice-table-wrap"><table class="invoice-table">
        <caption>Vul per btw-tarief alle onderdelen van de factuur aan.</caption>
        <colgroup><col><col><col><col><col><col><col><col><col></colgroup>
        <thead><tr><th scope="col">BTW-%</th><th scope="col">Bedrag goederen</th><th scope="col">Handelskorting</th><th scope="col">Extra kosten</th><th scope="col">Subtotaal</th><th scope="col">Financiële korting</th><th scope="col">MvH</th><th scope="col">BTW-bedrag</th><th scope="col">Borg terugstuurbare verpakking</th></tr></thead>
        <tbody id="invoiceRows"></tbody>
      </table></div>
      <div class="invoice-summary" id="invoiceSummary"></div>
      <div class="invoice-actions"><button class="btn btn-primary" id="checkInvoice" type="button">Oplossing nakijken</button><button class="btn btn-outline" id="showInvoiceSolution" type="button">Toon antwoorden</button></div>
      <p id="invoiceFeedback" class="feedback" aria-live="polite"></p>
      <div id="invoiceSolution" class="invoice-solution" hidden></div>
    </section>
  </div>`;
  $("#newInvoiceExercise").onclick=startInvoiceExercise;
  $("#checkInvoice").onclick=checkInvoiceExercise;
  $("#showInvoiceSolution").onclick=showInvoiceSolution;
}
function isInvoiceExercise(question){return Boolean(question&&question.module==="invoice"&&question.kind==="invoice-exercise"&&Array.isArray(question.rows));}
const invoiceLevels=[
  {description:"Goederen en btw berekenen."},
  {description:"Goederen met handelskorting en btw berekenen."},
  {description:"Extra kosten verwerken, eventueel met handelskorting."},
  {description:"Financiële korting toepassen, eventueel met andere kosten of kortingen."},
  {description:"Borg voor terugstuurbare verpakking verwerken, eventueel met andere factuuronderdelen."},
  {description:"Alle factuuronderdelen combineren."}
];
const invoiceVatRates=[0,6,12,21];
function invoiceLevelForRows(rows){
  const has=key=>rows.some(row=>Number(row[key]||0)>0);
  const trade=has("tradeRate");
  const extra=has("extraCostCents");
  const financial=has("financialRate");
  const packaging=has("packagingCents");
  if(trade&&extra&&financial&&packaging)return 6;
  if(packaging)return 5;
  if(financial)return 4;
  if(extra)return 3;
  if(trade)return 2;
  return 1;
}
function calculateInvoiceExercise(question){
  const rows=question.rows.map(row=>{
    const goodsCents=Number(row.goodsCents);
    const tradeDiscountCents=Math.round(goodsCents*Number(row.tradeRate||0)/100);
    const extraCostCents=Number(row.extraCostCents||0);
    const subtotalCents=goodsCents-tradeDiscountCents+extraCostCents;
    const financialDiscountCents=Math.round(subtotalCents*Number(row.financialRate||0)/100);
    const taxableBaseCents=subtotalCents-financialDiscountCents;
    const vatCents=Math.round(taxableBaseCents*Number(row.rate)/100);
    const packagingCents=Number(row.packagingCents||0);
    return {...row,goodsCents,tradeDiscountCents,extraCostCents,subtotalCents,financialDiscountCents,taxableBaseCents,vatCents,packagingCents};
  });
  const totalCents=rows.reduce((total,row)=>total+row.subtotalCents+row.vatCents+row.packagingCents,0);
  const discountCents=rows.reduce((total,row)=>total+row.financialDiscountCents,0);
  return {...question,level:invoiceLevelForRows(rows),rows,hasFinancialDiscount:discountCents>0,answers:{
    total:totalCents/100,
    discount:discountCents/100,
    earlyPayment:(totalCents-discountCents)/100
  }};
}
function isCreditExercise(question){
  return Boolean(question&&question.module==="credit"&&question.kind==="credit-exercise"&&Array.isArray(question.rows));
}
function calculateCreditExercise(question){
  const calculated=calculateInvoiceExercise(question);
  return {...calculated,module:"credit",kind:"credit-exercise",hasFinancialDiscount:calculated.hasFinancialDiscount};
}
const creditLevels=[
  {description:"Goederen en btw op de creditnota berekenen."},
  {description:"Handelskorting en btw op de creditnota berekenen."},
  {description:"Extra kosten verwerken, eventueel met handelskorting."},
  {description:"Financiële korting toepassen, eventueel met andere correcties."},
  {description:"Borg voor terugstuurbare verpakking verwerken."},
  {description:"Alle onderdelen van de creditnota combineren."}
];
function openCreditExercise(){
  if(!isModuleAvailable("credit"))return;
  $("#exercisePage").classList.remove("keypad-exercise");
  page("exercise");
  const otherExercises=bank.filter(question=>question.module==="credit"&&!isCreditExercise(question));
  const otherExercisesSection=otherExercises.length?`<section class="invoice-task"><h2>Andere creditnota-oefeningen</h2><div class="question-grid">${otherExercises.map(question=>`<article class="question-card"><span class="tag">${esc(question.level||"Basis")}</span><h3>${esc(question.title)}</h3><p>${esc(question.prompt)}</p><button class="btn btn-primary" data-question="${esc(question.id)}">Start deze oefening →</button></article>`).join("")}</div></section>`:"";
  $("#exerciseContent").innerHTML=`<div class="exercise-shell invoice-shell">
    <div class="invoice-heading">
      <div class="exercise-title"><div class="module-icon">${moduleById("credit").icon}</div><div><h1>Creditnota berekenen</h1><p>Bereken de creditnota stap voor stap.</p></div></div>
      <div class="invoice-controls">
        <label for="creditLevel">Niveau
          <select id="creditLevel"><option value="all">Alle niveaus</option>${creditLevels.map((level,index)=>`<option value="${index+1}">Niveau ${index+1}</option>`).join("")}</select>
        </label>
      </div>
    </div>
    ${otherExercisesSection}
    <div class="invoice-start-controls"><button class="btn btn-primary" id="newCreditExercise" type="button">Nieuwe opgave</button></div>
    <p id="creditExerciseStatus" class="notice">Klik op <strong>Nieuwe opgave</strong> om te starten.</p>
    <section class="invoice-task" id="creditTask" hidden>
      <div class="invoice-task-heading"><div><span class="tag">OPGAVE</span><h2 id="creditTaskTitle">Bereken de creditnota</h2></div><p id="creditLevelDescription"></p></div>
      <div id="creditPrompt" class="invoice-prompt"></div>
      <p class="invoice-instructions">Vul alle lege vakken in, ook het btw-percentage. Gebruik positieve bedragen en vul € 0,00 in voor onderdelen die niet in de opgave staan. Rond af op twee decimalen.</p>
    </section>
    <section class="invoice-table-section" id="creditTableSection" aria-label="Creditnota invultabel" hidden>
      <div class="invoice-table-wrap"><table class="invoice-table">
        <caption>Vul per btw-tarief alle onderdelen van de creditnota aan.</caption>
        <colgroup><col><col><col><col><col><col><col><col><col></colgroup>
        <thead><tr><th scope="col">BTW-%</th><th scope="col">Bedrag goederen</th><th scope="col">Handelskorting</th><th scope="col">Extra kosten</th><th scope="col">Subtotaal</th><th scope="col">Financiële korting</th><th scope="col">MvH</th><th scope="col">BTW-bedrag</th><th scope="col">Borg terugstuurbare verpakking</th></tr></thead>
        <tbody id="creditRows"></tbody>
      </table></div>
      <div class="invoice-summary" id="creditSummary"></div>
      <div class="invoice-actions"><button class="btn btn-primary" id="checkCredit" type="button">Oplossing nakijken</button><button class="btn btn-outline" id="showCreditSolution" type="button">Toon antwoorden</button></div>
      <p id="creditFeedback" class="feedback" aria-live="polite"></p>
      <div id="creditSolution" class="invoice-solution" hidden></div>
    </section>
  </div>`;
  $("#newCreditExercise").onclick=startCreditExercise;
  $("#checkCredit").onclick=checkCreditExercise;
  $("#showCreditSolution").onclick=showCreditSolution;
}
function startCreditExercise(){
  const level=$("#creditLevel").value;
  const available=bank.filter(isCreditExercise).map(calculateCreditExercise)
    .filter(question=>level==="all"||question.level===Number(level));
  $("#creditTask").hidden=true;
  $("#creditTableSection").hidden=true;
  $("#creditSolution").hidden=true;
  $("#creditFeedback").textContent="";
  if(!available.length){
    $("#creditExerciseStatus").hidden=false;
    $("#creditExerciseStatus").textContent=level==="all"
      ?"Er zijn nog geen gestructureerde creditnota-oefeningen beschikbaar. Vraag de leerkracht om oefeningen toe te voegen."
      :`Er zijn geen creditnota-oefeningen op niveau ${level}. Kies een ander niveau of vraag de leerkracht om oefeningen toe te voegen.`;
    return;
  }
  const choices=available.filter(question=>question.id!==currentCreditExercise?.id);
  currentCreditExercise=choices[Math.floor(Math.random()*choices.length)]||available[0];
  renderCreditExercise(currentCreditExercise);
}
function creditInput(key,label){
  return `<input inputmode="decimal" autocomplete="off" data-credit-answer="${key}" aria-label="${label}">`;
}
function renderCreditExercise(question){
  creditScenario=calculateCreditExercise(question);
  const scenario=creditScenario;
  const formatCents=cents=>money(cents/100);
  const formatRate=rate=>new Intl.NumberFormat("nl-BE",{maximumFractionDigits:2}).format(rate);
  $("#creditExerciseStatus").hidden=true;
  $("#creditTask").hidden=false;
  $("#creditTableSection").hidden=false;
  $("#creditTaskTitle").textContent=scenario.title;
  $("#creditLevelDescription").textContent=`Niveau ${scenario.level}: ${creditLevels[scenario.level-1].description}`;
  const euro=cents=>`€ ${formatCents(cents)}`;
  const list=items=>`<ul>${items.map(item=>`<li>${item}</li>`).join("")}</ul>`;
  const promptItems=[`<li><strong>Te crediteren goederen (exclusief btw):</strong>${list(scenario.rows.map(row=>`${euro(row.goodsCents)} aan ${row.rate}% btw`))}</li>`];
  const tradeRows=scenario.rows.filter(row=>Number(row.tradeRate)>0);
  if(tradeRows.length)promptItems.push(`<li><strong>Handelskorting:</strong>${list(tradeRows.map(row=>`${formatRate(row.tradeRate)}% op de goederen aan ${row.rate}% btw`))}</li>`);
  const extraRows=scenario.rows.filter(row=>Number(row.extraCostCents)>0);
  if(extraRows.length)promptItems.push(`<li><strong>Extra kosten:</strong>${list(extraRows.map(row=>`${euro(row.extraCostCents)} toe te rekenen aan ${row.rate}% btw`))}</li>`);
  const financialRows=scenario.rows.filter(row=>Number(row.financialRate)>0);
  if(financialRows.length)promptItems.push(`<li><strong>Financiële korting:</strong>${list(financialRows.map(row=>`${formatRate(row.financialRate)}% bij ${row.rate}% btw`))}</li>`);
  const packagingRows=scenario.rows.filter(row=>Number(row.packagingCents)>0);
  if(packagingRows.length)promptItems.push(`<li><strong>Borg terugstuurbare verpakking:</strong>${list(packagingRows.map(row=>`${euro(row.packagingCents)} bij ${row.rate}% btw`))}</li>`);
  $("#creditPrompt").innerHTML=`<p>Vul de creditnota aan met de volgende gegevens:</p><ul>${promptItems.join("")}</ul>`;
  $("#creditRows").innerHTML=scenario.rows.map((row,index)=>{
    const cell=(label,key)=>`<td data-label="${label}">${creditInput(`row-${index}-${key}`,`Rij ${index+1}: ${label}`)}</td>`;
    return `<tr>
      <th scope="row" data-label="BTW-%">${creditInput(`row-${index}-rate`,`Rij ${index+1}: BTW-%`)}</th>
      ${cell("Bedrag goederen","goods")}
      ${cell("Handelskorting","tradeDiscount")}
      ${cell("Extra kosten","extraCosts")}
      ${cell("Subtotaal","subtotal")}
      ${cell("Financiële korting","financialDiscount")}
      ${cell("MvH","taxableBase")}
      ${cell("BTW-bedrag","vat")}
      ${cell("Borg terugstuurbare verpakking","packaging")}
    </tr>`;
  }).join("");
  const summary=[`<label>Totaal creditnota${creditInput("total","Totaal creditnota")}</label>`];
  if(scenario.hasFinancialDiscount)summary.push(`<label>Totale financiële korting${creditInput("discount","Totale financiële korting")}</label>`);
  $("#creditSummary").innerHTML=summary.join("");
  document.querySelectorAll("[data-credit-answer]").forEach(input=>{
    input.value="";
    input.classList.remove("is-correct","is-incorrect");
  });
  $("#creditFeedback").textContent="";
  $("#creditFeedback").className="feedback";
  $("#creditSolution").hidden=true;
  $("#creditSolution").innerHTML="";
}
function getCreditAnswers(){
  const answers={};
  creditScenario.rows.forEach((row,index)=>{
    answers[`row-${index}-rate`]=Number(row.rate);
    answers[`row-${index}-goods`]=row.goodsCents/100;
    answers[`row-${index}-tradeDiscount`]=row.tradeDiscountCents/100;
    answers[`row-${index}-extraCosts`]=row.extraCostCents/100;
    answers[`row-${index}-subtotal`]=row.subtotalCents/100;
    answers[`row-${index}-financialDiscount`]=row.financialDiscountCents/100;
    answers[`row-${index}-taxableBase`]=row.taxableBaseCents/100;
    answers[`row-${index}-vat`]=row.vatCents/100;
    answers[`row-${index}-packaging`]=row.packagingCents/100;
  });
  return {...answers,...creditScenario.answers};
}
function checkCreditExercise(){
  const answers=getCreditAnswers();
  let correctCount=0;
  const inputs=[...document.querySelectorAll("[data-credit-answer]")];
  inputs.forEach(input=>{
    const value=parseNumber(input.value);
    const correct=Number.isFinite(value)&&Math.abs(value-answers[input.dataset.creditAnswer])<0.011;
    input.classList.toggle("is-correct",correct);
    input.classList.toggle("is-incorrect",!correct);
    if(correct)correctCount++;
  });
  const feedback=$("#creditFeedback");
  const complete=correctCount===inputs.length;
  feedback.textContent=complete?"Alles correct. Goed gewerkt!":`${correctCount} van de ${inputs.length} antwoorden zijn correct. Controleer de gemarkeerde bedragen.`;
  feedback.className=`feedback ${complete?"good":"bad"}`;
}
function showCreditSolution(){
  const scenario=creditScenario;
  const fmt=cents=>`€ ${money(cents/100)}`;
  const rows=scenario.rows.map(row=>`<tr><th scope="row">${row.rate}%</th><td>${fmt(row.goodsCents)}</td><td>${fmt(row.tradeDiscountCents)}</td><td>${fmt(row.extraCostCents)}</td><td>${fmt(row.subtotalCents)}</td><td>${fmt(row.financialDiscountCents)}</td><td>${fmt(row.taxableBaseCents)}</td><td>${fmt(row.vatCents)}</td><td>${fmt(row.packagingCents)}</td></tr>`).join("");
  const discount=scenario.hasFinancialDiscount?`<p>Totale financiële korting: <strong>€ ${money(scenario.answers.discount)}</strong>.</p>`:"";
  $("#creditSolution").innerHTML=`<h3>Antwoorden</h3><div class="invoice-solution-table-wrap"><table class="invoice-solution-table"><thead><tr><th>BTW-%</th><th>Bedrag goederen</th><th>Handelskorting</th><th>Extra kosten</th><th>Subtotaal</th><th>Financiële korting</th><th>MvH</th><th>BTW-bedrag</th><th>Borg verpakking</th></tr></thead><tbody>${rows}</tbody></table></div><p>Totaal creditnota: <strong>${fmt(Math.round(scenario.answers.total*100))}</strong>.</p>${discount}`;
  $("#creditSolution").hidden=false;
}
function startInvoiceExercise(){
  const level=$("#invoiceLevel").value;
  const available=bank.filter(isInvoiceExercise).map(calculateInvoiceExercise)
    .filter(question=>level==="all"||question.level===Number(level));
  $("#invoiceTask").hidden=true;
  $("#invoiceTableSection").hidden=true;
  $("#invoiceSolution").hidden=true;
  $("#invoiceFeedback").textContent="";
  if(!available.length){
    $("#invoiceExerciseStatus").hidden=false;
    $("#invoiceExerciseStatus").textContent=level==="all"
      ?"Er zijn nog geen factuuroefeningen beschikbaar. Vraag de leerkracht om een oefeningenset toe te voegen."
      :`Er zijn geen oefeningen op niveau ${level}. Kies een ander niveau of vraag de leerkracht om een oefening toe te voegen.`;
    return;
  }
  const currentId=currentInvoiceExercise?.id;
  const choices=available.filter(question=>question.id!==currentId);
  currentInvoiceExercise=choices[Math.floor(Math.random()*choices.length)]||available[0];
  renderInvoiceExercise(currentInvoiceExercise);
}
function invoiceInput(key,label){
  return `<input inputmode="decimal" autocomplete="off" data-invoice-answer="${key}" aria-label="${label}">`;
}
function renderInvoiceExercise(question){
  invoiceScenario=calculateInvoiceExercise(question);
  const scenario=invoiceScenario;
  const formatCents=cents=>money(cents/100);
  const formatRate=rate=>new Intl.NumberFormat("nl-BE",{maximumFractionDigits:2}).format(rate);
  $("#invoiceExerciseStatus").hidden=true;
  $("#invoiceTask").hidden=false;
  $("#invoiceTableSection").hidden=false;
  $("#invoiceTaskTitle").textContent=scenario.title;
  $("#invoiceLevelDescription").textContent=`Niveau ${scenario.level}: ${invoiceLevels[scenario.level-1].description}`;
  const euro=cents=>`€ ${formatCents(cents)}`;
  const list=items=>`<ul>${items.map(item=>`<li>${item}</li>`).join("")}</ul>`;
  const promptItems=[`<li><strong>Goederen (exclusief btw):</strong>${list(scenario.rows.map(row=>`${euro(row.goodsCents)} aan ${row.rate}% btw`))}</li>`];
  const tradeRows=scenario.rows.filter(row=>Number(row.tradeRate)>0);
  if(tradeRows.length){
    promptItems.push(`<li><strong>Handelskorting:</strong>${list(tradeRows.map(row=>`${formatRate(row.tradeRate)}% op de goederen aan ${row.rate}% btw`))}</li>`);
  }
  const extraRows=scenario.rows.filter(row=>Number(row.extraCostCents)>0);
  if(extraRows.length){
    promptItems.push(`<li><strong>Extra kosten:</strong>${list(extraRows.map(row=>`${euro(row.extraCostCents)} toe te rekenen aan ${row.rate}% btw`))}</li>`);
  }
  const financialRows=scenario.rows.filter(row=>Number(row.financialRate)>0);
  if(financialRows.length){
    promptItems.push(`<li><strong>Financiële korting:</strong>${list(financialRows.map(row=>`${formatRate(row.financialRate)}% bij ${row.rate}% btw`))}</li>`);
  }
  const packagingRows=scenario.rows.filter(row=>Number(row.packagingCents)>0);
  if(packagingRows.length){
    promptItems.push(`<li><strong>Borg terugstuurbare verpakking:</strong>${list(packagingRows.map(row=>`${euro(row.packagingCents)} bij ${row.rate}% btw`))}</li>`);
  }
  $("#invoicePrompt").innerHTML=`<p>Vul de factuur aan met de volgende gegevens:</p><ul>${promptItems.join("")}</ul>`;
  $("#invoiceRows").innerHTML=scenario.rows.map((row,index)=>{
    const cell=(label,key)=>`<td data-label="${label}">${invoiceInput(`row-${index}-${key}`,`Rij ${index+1}: ${label}`)}</td>`;
    return `<tr>
      <th scope="row" data-label="BTW-%">${invoiceInput(`row-${index}-rate`,`Rij ${index+1}: BTW-%`)}</th>
      ${cell("Bedrag goederen","goods")}
      ${cell("Handelskorting","tradeDiscount")}
      ${cell("Extra kosten","extraCosts")}
      ${cell("Subtotaal","subtotal")}
      ${cell("Financiële korting","financialDiscount")}
      ${cell("MvH","taxableBase")}
      ${cell("BTW-bedrag","vat")}
      ${cell("Borg terugstuurbare verpakking","packaging")}
    </tr>`;
  }).join("");
  const summary=[`<label>Te betalen${invoiceInput("total","Te betalen")}</label>`];
  if(scenario.hasFinancialDiscount)summary.push(`<label>Financiële korting${invoiceInput("discount","Totale financiële korting")}</label>`);
  $("#invoiceSummary").innerHTML=summary.join("");
  document.querySelectorAll("[data-invoice-answer]").forEach(input=>{
    input.value="";
    input.classList.remove("is-correct","is-incorrect");
  });
  $("#invoiceFeedback").textContent="";
  $("#invoiceFeedback").className="feedback";
  $("#invoiceSolution").hidden=true;
  $("#invoiceSolution").innerHTML="";
}
function getInvoiceAnswers(){
  const answers={};
  invoiceScenario.rows.forEach((row,index)=>{
    answers[`row-${index}-rate`]=Number(row.rate);
    answers[`row-${index}-goods`]=row.goodsCents/100;
    answers[`row-${index}-tradeDiscount`]=row.tradeDiscountCents/100;
    answers[`row-${index}-extraCosts`]=row.extraCostCents/100;
    answers[`row-${index}-subtotal`]=row.subtotalCents/100;
    answers[`row-${index}-financialDiscount`]=row.financialDiscountCents/100;
    answers[`row-${index}-taxableBase`]=row.taxableBaseCents/100;
    answers[`row-${index}-vat`]=row.vatCents/100;
    answers[`row-${index}-packaging`]=row.packagingCents/100;
  });
  return {...answers,...invoiceScenario.answers};
}
function checkInvoiceExercise(){
  const answers=getInvoiceAnswers();
  let correctCount=0;
  const inputs=[...document.querySelectorAll("[data-invoice-answer]")];
  inputs.forEach(input=>{
    const value=parseNumber(input.value);
    const correct=Number.isFinite(value)&&Math.abs(value-answers[input.dataset.invoiceAnswer])<0.011;
    input.classList.toggle("is-correct",correct);
    input.classList.toggle("is-incorrect",!correct);
    if(correct)correctCount++;
  });
  const feedback=$("#invoiceFeedback");
  const complete=correctCount===inputs.length;
  feedback.textContent=complete?"Alles correct. Goed gewerkt!":`${correctCount} van de ${inputs.length} antwoorden zijn correct. Controleer de gemarkeerde bedragen.`;
  feedback.className=`feedback ${complete?"good":"bad"}`;
}
function showInvoiceSolution(){
  const scenario=invoiceScenario;
  const fmt=cents=>`€ ${money(cents/100)}`;
  const total=`<p>Te betalen: <strong>${fmt(Math.round(scenario.answers.total*100))}</strong>.</p>`;
  const discount=scenario.hasFinancialDiscount?`<p>Totale financiële korting: <strong>€ ${money(scenario.answers.discount)}</strong>.</p>`:"";
  const rows=scenario.rows.map(row=>`<tr><th scope="row">${row.rate}%</th><td>${fmt(row.goodsCents)}</td><td>${fmt(row.tradeDiscountCents)}</td><td>${fmt(row.extraCostCents)}</td><td>${fmt(row.subtotalCents)}</td><td>${fmt(row.financialDiscountCents)}</td><td>${fmt(row.taxableBaseCents)}</td><td>${fmt(row.vatCents)}</td><td>${fmt(row.packagingCents)}</td></tr>`).join("");
  $("#invoiceSolution").innerHTML=`<h3>Antwoorden</h3><div class="invoice-solution-table-wrap"><table class="invoice-solution-table"><thead><tr><th>BTW-%</th><th>Bedrag goederen</th><th>Handelskorting</th><th>Extra kosten</th><th>Subtotaal</th><th>Financiële korting</th><th>MvH</th><th>BTW-bedrag</th><th>Borg verpakking</th></tr></thead><tbody>${rows}</tbody></table></div>${total}${discount}`;
  $("#invoiceSolution").hidden=false;
}
function formatInvoicePercent(rate){
  return `${new Intl.NumberFormat("nl-BE",{maximumFractionDigits:2}).format(rate)}%`;
}
function openQuestion(id){
  const q=bank.find(x=>x.id===id); if(!q)return;
  if(!isModuleAvailable(q.module))return;
  $("#exercisePage").classList.remove("keypad-exercise");
  currentQuestion=q; page("exercise");
  $("#exerciseContent").innerHTML=`<div class="exercise-shell">
    <div class="module-heading"><div class="exercise-title"><div class="module-icon">${moduleById(q.module)?.icon||"📘"}</div><div><h1>${esc(q.title)}</h1><p>${esc(moduleById(q.module)?.title||q.module)} · ${esc(q.level)}${q.goal?` · ${esc(q.goal)}`:""}</p></div></div></div>
    <div class="exercise-layout">
      <section class="exercise-box"><span class="tag">OPGAVE</span><h3>${esc(q.title)}</h3><p>${esc(q.prompt)}</p>${q.hint?`<p class="muted small">${esc(q.hint)}</p>`:""}
        <label>Jouw antwoord<input id="studentAnswer" ${q.type==="number"?'inputmode="decimal"':''} autocomplete="off" placeholder="Vul je antwoord in"></label>
        <button class="btn btn-primary" id="checkAnswer">Controleer antwoord</button>
        <div id="answerFeedback" class="feedback" aria-live="polite"></div>
        <div class="form-actions"><button class="btn btn-outline" id="showSolution">Toon oplossing</button><button class="btn btn-outline" id="nextQuestion">Volgende oefening →</button></div>
      </section>
      <section class="exercise-box"><span class="tag">OPLOSSING</span><h3>Uitwerking</h3><div id="solutionBox" class="solution" hidden>${esc(q.solution||"Er is nog geen uitwerking toegevoegd.")}</div><p id="solutionPlaceholder" class="muted">Klik op ‘Toon oplossing’ om de uitwerking te bekijken.</p></section>
    </div></div>`;
  $("#checkAnswer").onclick=()=>checkQuestion(q);
  $("#showSolution").onclick=()=>{$("#solutionBox").hidden=false;$("#solutionPlaceholder").hidden=true;};
  $("#nextQuestion").onclick=()=>{const next=bank.find(x=>x.module===q.module&&x.id!==q.id);if(next)openQuestion(next.id);else openModule(q.module);};
  $("#studentAnswer").addEventListener("keydown",e=>{if(e.key==="Enter")checkQuestion(q);});
}
function normaliseText(s){return String(s??"").trim().toLowerCase().replace(/\s+/g," ").replace(/[’']/g,"'");}
function parseNumber(s){return Number(String(s??"").trim().replace(/\s/g,"").replace(/€/g,"").replace(/\.(?=\d{3}(?:\D|$))/g,"").replace(",", "."));}
function checkQuestion(q){
  const value=$("#studentAnswer").value;
  let correct=false;
  if(q.type==="number"){const n=parseNumber(value),a=parseNumber(q.answer);correct=Number.isFinite(n)&&Number.isFinite(a)&&Math.abs(n-a)<=Number(q.tolerance||0.01);}
  else correct=normaliseText(value)===normaliseText(q.answer);
  const fb=$("#answerFeedback");fb.textContent=correct?"Correct! Goed gewerkt. Je kunt de oplossing bekijken om je tussenstappen te controleren.":"Nog niet juist. Probeer opnieuw of bekijk de oplossing en vergelijk je tussenstappen.";
  fb.className="feedback "+(correct?"good":"bad");
}
function openKeypad(){
 page("exercise");
 renderKeypadHome();
}
function renderKeypadHome(){
 const results=keypadBestTimes.length
   ?`<section class="keypad-leaderboard" aria-labelledby="keypadLeaderboardHeading"><h2 id="keypadLeaderboardHeading">Jouw 3 snelste tijden</h2><ol>${keypadBestTimes.slice(0,3).map(time=>`<li><span>${formatSeconds(time)} seconden</span></li>`).join("")}</ol></section>`
   :"";
 $("#exerciseContent").innerHTML=`<div class="exercise-shell keypad-shell">
   <div class="module-heading"><div class="exercise-title"><div class="module-icon">⌨️</div><div><h1>Numeriek klavier</h1><p>Snelheidstest · 10 getallen</p></div></div></div>
   <section class="keypad-home"><p>Typ de 10 getallen die na elkaar verschijnen zo snel mogelijk in het tekstvak. De tijd start zodra je op start drukt.</p><button class="btn btn-primary" id="startKeypad" type="button">Start</button></section>
   ${results}
 </div>`;
 $("#startKeypad").onclick=startKeypadSet;
}
function startKeypadSet(){
 keypadNumbers=Array.from({length:10},()=>Math.floor(Math.random()*1000000));
 keypadIndex=0;
 keypadStartedAt=performance.now();
 renderKeypadRound();
 $("#keypadAnswer").focus();
}
function renderKeypadRound(){
 const target=keypadNumbers[keypadIndex];
 $("#exerciseContent").innerHTML=`<div class="exercise-shell keypad-shell">
   <div class="module-heading"><div class="exercise-title"><div class="module-icon">⌨️</div><div><h1>Numeriek klavier</h1><p>Snelheidstest · 10 getallen</p></div></div></div>
   <section class="keypad-round" aria-labelledby="keypadTarget">
     <div class="keypad-round-heading"><span class="tag">GETAL ${keypadIndex+1} VAN 10</span><button class="btn btn-outline" id="restartKeypad" type="button">Herstart oefeningenset</button></div>
     <h2 id="keypadTarget" aria-live="polite">${money(target/100)}</h2>
     <form id="keypadAnswerForm">
       <label for="keypadAnswer">Typ het getal en druk op Enter</label>
       <input id="keypadAnswer" type="text" inputmode="decimal" autocomplete="off" spellcheck="false" aria-describedby="keypadFeedback">
       <button class="btn btn-primary" type="submit">Volgende</button>
       <p id="keypadFeedback" class="feedback" aria-live="polite"></p>
     </form>
   </section>
 </div>`;
 $("#restartKeypad").onclick=startKeypadSet;
 $("#keypadAnswerForm").onsubmit=submitKeypadAnswer;
 $("#keypadAnswer").oninput=()=>{
   if(isCorrectKeypadAnswer($("#keypadAnswer").value))advanceKeypadRound();
 };
}
function isCorrectKeypadAnswer(value){
 const normalized=String(value??"").trim().replace(/\s/g,"").replace(/€/g,"");
 if(!/[,.]\d{2}$/.test(normalized))return false;
 const cents=parseNumber(normalized)*100;
 return Number.isFinite(cents)&&Math.round(cents)===keypadNumbers[keypadIndex];
}
function submitKeypadAnswer(event){
 event.preventDefault();
 const input=$("#keypadAnswer");
 if(isCorrectKeypadAnswer(input.value)){
   advanceKeypadRound();
   return;
 }
 $("#keypadFeedback").textContent="Dat getal is niet juist. Probeer opnieuw.";
 $("#keypadFeedback").className="feedback bad";
 input.select();
}
function advanceKeypadRound(){
 keypadIndex++;
 if(keypadIndex<keypadNumbers.length){
   renderKeypadRound();
   $("#keypadAnswer").focus();
   return;
 }
 const elapsed=(performance.now()-keypadStartedAt)/1000;
 keypadBestTimes.push(elapsed);
 keypadBestTimes.sort((a,b)=>a-b);
 keypadBestTimes=keypadBestTimes.slice(0,3);
 renderKeypadHome();
 showActionDialog({
   title:"Snelheidstest voltooid",
   message:`Je tijd voor de 10 getallen is ${formatSeconds(elapsed)} seconden.`,
   cancelText:"Sluiten",
   confirmText:"Verder"
 });
}
function renderModuleVisibility(){
 $("#moduleVisibilityList").innerHTML=modules.map(module=>{
   const hasExercises=hasModuleExercises(module.id);
   const checked=moduleVisibility[module.id];
   const note=hasExercises?(checked?"Ingeschakeld voor leerlingen.":"Uitgeschakeld voor leerlingen."):"Geen oefeningen beschikbaar; voeg eerst oefeningen toe.";
   return `<label class="module-visibility-item ${hasExercises?"":"is-unavailable"}"><input type="checkbox" data-module-visibility="${module.id}" ${hasExercises&&checked?"checked":""} ${hasExercises?"":"disabled"}><span><strong>${esc(module.title)}</strong><small>${esc(note)}</small></span></label>`;
 }).join("");
 $("#moduleVisibilityList").querySelectorAll("[data-module-visibility]").forEach(input=>input.onchange=()=>{
   const moduleId=input.dataset.moduleVisibility;
   const previous=moduleVisibility[moduleId];
   moduleVisibility={...moduleVisibility,[moduleId]:input.checked};
   try{
     localStorage.setItem(MODULES_KEY,JSON.stringify(moduleVisibility));
     $("#moduleVisibilityStatus").textContent=`${moduleById(moduleId).title} is ${input.checked?"ingeschakeld":"uitgeschakeld"} voor leerlingen.`;
     renderModuleCards();
     renderModuleVisibility();
   }catch(error){
     moduleVisibility={...moduleVisibility,[moduleId]:previous};
     input.checked=previous;
     $("#moduleVisibilityStatus").textContent=`De module-instelling kon niet worden bewaard: ${error.message}`;
   }
 });
}
function addInvoiceParameterRow(values={}){
 const options=invoiceVatRates.map(rate=>`<option value="${rate}" ${Number(values.rate)===rate?"selected":""}>${rate}%</option>`).join("");
 const moneyValue=cents=>cents===undefined||cents===null?"":(Number(cents)/100).toFixed(2);
 $("#invoiceParameterRows").insertAdjacentHTML("beforeend",`<tr>
   <td><select data-invoice-parameter="rate" aria-label="Btw-percentage"><option value="">Kies tarief</option>${options}</select></td>
   <td><input data-invoice-parameter="goods" aria-label="Prijs goederen exclusief btw" type="number" min="0.01" step="0.01" value="${moneyValue(values.goodsCents)}"></td>
   <td><input data-invoice-parameter="tradeRate" aria-label="Handelskorting in procent" type="number" min="0" max="100" step="0.01" value="${values.tradeRate||""}"></td>
   <td><input data-invoice-parameter="extraCosts" aria-label="Extra kosten" type="number" min="0" step="0.01" value="${moneyValue(values.extraCostCents)}"></td>
   <td><input data-invoice-parameter="financialRate" aria-label="Financiële korting in procent" type="number" min="0" max="100" step="0.01" value="${values.financialRate||""}"></td>
   <td><input data-invoice-parameter="packaging" aria-label="Borg verpakking" type="number" min="0" step="0.01" value="${moneyValue(values.packagingCents)}"></td>
   <td><button class="delete-btn" type="button" data-remove-invoice-row aria-label="Verwijder btw-tarief">×</button></td>
 </tr>`);
}
function readInvoiceBuilder(){
 const rows=[];
 $("#invoiceParameterRows").querySelectorAll("tr").forEach((tr,index)=>{
   const rate=tr.querySelector('[data-invoice-parameter="rate"]').value;
   const goods=tr.querySelector('[data-invoice-parameter="goods"]').value.trim();
   const fields=["tradeRate","extraCosts","financialRate","packaging"];
   const optional=Object.fromEntries(fields.map(key=>[key,tr.querySelector(`[data-invoice-parameter="${key}"]`).value.trim()]));
   if(!rate&&!goods&&!Object.values(optional).some(Boolean))return;
   if(!rate||!goods)throw new Error(`Vul op rij ${index+1} minstens het btw-percentage en de prijs van de goederen in.`);
   const numeric={};
   for(const [key,value] of Object.entries(optional)){
     numeric[key]=value?parseNumber(value):0;
     if(!Number.isFinite(numeric[key])||numeric[key]<0||(key.endsWith("Rate")&&numeric[key]>100))throw new Error(`Controleer de korting of het bedrag op rij ${index+1}.`);
   }
   const goodsAmount=parseNumber(goods);
   if(!Number.isFinite(goodsAmount)||goodsAmount<=0)throw new Error(`De goederenprijs op rij ${index+1} moet groter zijn dan € 0,00.`);
   rows.push({
     rate:Number(rate),goodsCents:Math.round(goodsAmount*100),
     tradeRate:numeric.tradeRate,extraCostCents:Math.round(numeric.extraCosts*100),
     financialRate:numeric.financialRate,packagingCents:Math.round(numeric.packaging*100)
   });
 });
 if(!rows.length)throw new Error("Voeg minstens één btw-tarief met een goederenprijs toe.");
 if(new Set(rows.map(row=>row.rate)).size!==rows.length)throw new Error("Gebruik elk btw-tarief maar één keer in dezelfde oefening.");
 return rows.sort((a,b)=>a.rate-b.rate);
}
function invoiceBuilderModel(){
 const rows=readInvoiceBuilder();
 const exercise=calculateInvoiceExercise({id:"preview",kind:"invoice-exercise",module:"invoice",title:"Voorbeeldberekening",rows});
 return exercise;
}
function renderInvoiceBuilderPreview(){
 const preview=$("#invoiceBuilderPreview");
 try{
   const exercise=invoiceBuilderModel();
   preview.innerHTML=`<h3>Controle van de oefening</h3><p>Automatisch niveau: <strong>Niveau ${exercise.level}</strong> — ${invoiceLevels[exercise.level-1].description}</p><p>${exercise.rows.map(row=>`${row.rate}% btw: ${money(row.goodsCents/100)} goederen, ${money(row.subtotalCents/100)} subtotaal, ${money(row.vatCents/100)} btw`).join(" · ")}</p><p>Te betalen: <strong>€ ${money(exercise.answers.total)}</strong></p>`;
   preview.dataset.level=String(exercise.level);
 }catch(error){
   preview.textContent=error.message;
   preview.dataset.level="";
 }
}
function resetInvoiceBuilder(){
 $("#invoiceBuilderForm").reset();
 $("#invoiceSetId").value="";
 $("#invoiceSetTitle").value=nextInvoiceTitle();
 $("#invoiceBuilderHeading").textContent="Factuuroefening samenstellen";
 $("#saveInvoiceSet").textContent="Oefening toevoegen";
 $("#invoiceParameterRows").replaceChildren();
 addInvoiceParameterRow();
 renderInvoiceBuilderPreview();
}
function nextInvoiceTitle(questions=bank){
 return nextYearlyTitle("F",["F"],"invoice",questions);
}
function nextYearlyTitle(prefix,acceptedPrefixes,moduleId,questions){
 const year=new Date().getFullYear();
 const prefixes=[prefix,...acceptedPrefixes.filter(item=>item!==prefix)];
 const patterns=prefixes.map(item=>new RegExp(`^${escapeRegExp(item)}(\\d+)(?:-(\\d{4}))?$`,"i"));
 const moduleQuestions=questions.filter(question=>question.module===moduleId);
 const numbers=moduleQuestions.map(question=>{
   const title=String(question.title||"").trim();
   for(const pattern of patterns){
     const match=pattern.exec(title);
     if(match&&(!match[2]||Number(match[2])===year))return Number(match[1]);
   }
   return null;
 }).filter(number=>number!==null);
 const used=new Set(moduleQuestions.map(question=>String(question.title||"").trim().toUpperCase()));
 let number=(numbers.length?Math.max(...numbers):0)+1;
 let title;
 do{title=`${prefix}${String(number++).padStart(4,"0")}-${year}`;}while(used.has(title.toUpperCase()));
 return title;
}
function editInvoiceExercise(id){
 const exercise=bank.find(question=>question.id===id&&isInvoiceExercise(question));
 if(!exercise)return;
 $("#genericQuestionPanel").hidden=true;
 $("#creditBuilderPanel").hidden=true;
 $("#invoiceBuilderPanel").hidden=false;
 $("#invoiceSetId").value=exercise.id;
 $("#invoiceSetTitle").value=exercise.title;
 $("#invoiceBuilderHeading").textContent="Factuuroefening bewerken";
 $("#saveInvoiceSet").textContent="Wijzigingen bewaren";
 $("#invoiceParameterRows").replaceChildren();
 exercise.rows.forEach(row=>addInvoiceParameterRow(row));
 renderInvoiceBuilderPreview();
 $("#invoiceBuilderForm").scrollIntoView({behavior:"smooth",block:"start"});
}
function isValidInvoiceExercise(question){
 return question&&question.module==="invoice"&&question.kind==="invoice-exercise"&&typeof question.id==="string"&&question.id.trim()&&typeof question.title==="string"&&question.title.trim()&&Array.isArray(question.rows)&&question.rows.length>=1&&question.rows.every(row=>
   invoiceVatRates.includes(Number(row.rate))&&Number.isFinite(Number(row.goodsCents))&&Number(row.goodsCents)>0&&
   ["tradeRate","extraCostCents","financialRate","packagingCents"].every(key=>Number.isFinite(Number(row[key]||0))&&Number(row[key]||0)>=0)
 )&&new Set(question.rows.map(row=>Number(row.rate))).size===question.rows.length;
}
function addCreditParameterRow(values={}){
 const options=invoiceVatRates.map(rate=>`<option value="${rate}" ${Number(values.rate)===rate?"selected":""}>${rate}%</option>`).join("");
 const moneyValue=cents=>cents===undefined||cents===null?"":(Number(cents)/100).toFixed(2);
 $("#creditParameterRows").insertAdjacentHTML("beforeend",`<tr>
   <td><select data-credit-parameter="rate" aria-label="Btw-percentage"><option value="">Kies tarief</option>${options}</select></td>
   <td><input data-credit-parameter="goods" aria-label="Prijs goederen exclusief btw" type="number" min="0.01" step="0.01" value="${moneyValue(values.goodsCents)}"></td>
   <td><input data-credit-parameter="tradeRate" aria-label="Handelskorting in procent" type="number" min="0" max="100" step="0.01" value="${values.tradeRate||""}"></td>
   <td><input data-credit-parameter="extraCosts" aria-label="Extra kosten" type="number" min="0" step="0.01" value="${moneyValue(values.extraCostCents)}"></td>
   <td><input data-credit-parameter="financialRate" aria-label="Financiële korting in procent" type="number" min="0" max="100" step="0.01" value="${values.financialRate||""}"></td>
   <td><input data-credit-parameter="packaging" aria-label="Borg verpakking" type="number" min="0" step="0.01" value="${moneyValue(values.packagingCents)}"></td>
   <td><button class="delete-btn" type="button" data-remove-credit-row aria-label="Verwijder btw-tarief">×</button></td>
 </tr>`);
}
function readCreditBuilder(){
 const rows=[];
 $("#creditParameterRows").querySelectorAll("tr").forEach((tr,index)=>{
   const rate=tr.querySelector('[data-credit-parameter="rate"]').value;
   const goods=tr.querySelector('[data-credit-parameter="goods"]').value.trim();
   const fields=["tradeRate","extraCosts","financialRate","packaging"];
   const optional=Object.fromEntries(fields.map(key=>[key,tr.querySelector(`[data-credit-parameter="${key}"]`).value.trim()]));
   if(!rate&&!goods&&!Object.values(optional).some(Boolean))return;
   if(!rate||!goods)throw new Error(`Vul op rij ${index+1} minstens het btw-percentage en het te crediteren goederenbedrag in.`);
   const numeric={};
   for(const [key,value] of Object.entries(optional)){
     numeric[key]=value?parseNumber(value):0;
     if(!Number.isFinite(numeric[key])||numeric[key]<0||(key.endsWith("Rate")&&numeric[key]>100))throw new Error(`Controleer de korting of het bedrag op rij ${index+1}.`);
   }
   const goodsAmount=parseNumber(goods);
   if(!Number.isFinite(goodsAmount)||goodsAmount<=0)throw new Error(`Het goederenbedrag op rij ${index+1} moet groter zijn dan € 0,00.`);
   rows.push({
     rate:Number(rate),goodsCents:Math.round(goodsAmount*100),
     tradeRate:numeric.tradeRate,extraCostCents:Math.round(numeric.extraCosts*100),
     financialRate:numeric.financialRate,packagingCents:Math.round(numeric.packaging*100)
   });
 });
 if(!rows.length)throw new Error("Voeg minstens één btw-tarief met een te crediteren goederenbedrag toe.");
 if(new Set(rows.map(row=>row.rate)).size!==rows.length)throw new Error("Gebruik elk btw-tarief maar één keer in dezelfde oefening.");
 return rows.sort((a,b)=>a.rate-b.rate);
}
function creditBuilderModel(){
 return calculateCreditExercise({id:"preview",kind:"credit-exercise",module:"credit",title:"Voorbeeldcreditnota",rows:readCreditBuilder()});
}
function renderCreditBuilderPreview(){
 const preview=$("#creditBuilderPreview");
 try{
   const exercise=creditBuilderModel();
   preview.innerHTML=`<h3>Controle van de oefening</h3><p>Automatisch niveau: <strong>Niveau ${exercise.level}</strong> — ${creditLevels[exercise.level-1].description}</p><p>${exercise.rows.map(row=>`${row.rate}% btw: ${money(row.goodsCents/100)} te crediteren, ${money(row.subtotalCents/100)} subtotaal, ${money(row.vatCents/100)} btw`).join(" · ")}</p><p>Totaal creditnota: <strong>€ ${money(exercise.answers.total)}</strong></p>`;
   preview.dataset.level=String(exercise.level);
 }catch(error){
   preview.textContent=error.message;
   preview.dataset.level="";
 }
}
function resetCreditBuilder(){
 $("#creditBuilderForm").reset();
 $("#creditSetId").value="";
 $("#creditSetTitle").value=nextCreditTitle();
 $("#creditBuilderHeading").textContent="Creditnota-oefening samenstellen";
 $("#saveCreditSet").textContent="Oefening toevoegen";
 $("#creditParameterRows").replaceChildren();
 addCreditParameterRow();
 renderCreditBuilderPreview();
}
function nextCreditTitle(questions=bank){
 return nextYearlyTitle("CN",["C"],"credit",questions);
}
function editCreditExercise(id){
 const exercise=bank.find(question=>question.id===id&&isCreditExercise(question));
 if(!exercise)return;
 $("#genericQuestionPanel").hidden=true;
 $("#invoiceBuilderPanel").hidden=true;
 $("#creditBuilderPanel").hidden=false;
 $("#creditSetId").value=exercise.id;
 $("#creditSetTitle").value=exercise.title;
 $("#creditBuilderHeading").textContent="Creditnota-oefening bewerken";
 $("#saveCreditSet").textContent="Wijzigingen bewaren";
 $("#creditParameterRows").replaceChildren();
 exercise.rows.forEach(row=>addCreditParameterRow(row));
 renderCreditBuilderPreview();
 $("#creditBuilderForm").scrollIntoView({behavior:"smooth",block:"start"});
}
function isValidCreditExercise(question){
 return question&&question.module==="credit"&&question.kind==="credit-exercise"&&typeof question.id==="string"&&question.id.trim()&&typeof question.title==="string"&&question.title.trim()&&Array.isArray(question.rows)&&question.rows.length>=1&&question.rows.every(row=>
   invoiceVatRates.includes(Number(row.rate))&&Number.isFinite(Number(row.goodsCents))&&Number(row.goodsCents)>0&&
   ["tradeRate","extraCostCents","financialRate","packagingCents"].every(key=>Number.isFinite(Number(row[key]||0))&&Number(row[key]||0)>=0)&&
   Number(row.tradeRate||0)<=100&&Number(row.financialRate||0)<=100
 )&&new Set(question.rows.map(row=>Number(row.rate))).size===question.rows.length;
}
function renderAdmin(){
 adminModuleFilter="";
 $("#adminModuleFilter").innerHTML=`<option value="">Kies een onderdeel</option>${modules.map(m=>`<option value="${m.id}">${esc(m.title)}</option>`).join("")}`;
 $("#adminModuleFilter").value="";
 $("#exportBtn").disabled=true;
 $("#importBtn").disabled=true;
 $("#adminModuleWorkspace").hidden=true;
 $("#keypadAdminNotice").hidden=true;
 $("#genericQuestionPanel").hidden=true;
 $("#invoiceBuilderPanel").hidden=true;
 $("#creditBuilderPanel").hidden=true;
 $("#adminListHeading").textContent="Bestaande oefeningen";
 $("#questionCount").textContent="";
 $("#adminQuestionList").replaceChildren();
 $("#moduleVisibilityStatus").textContent="";
 renderModuleVisibility();
 $("#adminModuleFilter").onchange=()=>{
   adminModuleFilter=$("#adminModuleFilter").value;
   const selected=Boolean(moduleById(adminModuleFilter));
   const keypadModule=adminModuleFilter==="keypad";
   $("#exportBtn").disabled=!selected||keypadModule;
   $("#importBtn").disabled=!selected||keypadModule;
   $("#keypadAdminNotice").hidden=!keypadModule;
   $("#adminModuleWorkspace").hidden=!selected||keypadModule;
   clearQuestionForm();
   $("#qModule").value=selected?adminModuleFilter:"";
   $("#genericQuestionPanel").hidden=!selected||adminModuleFilter==="invoice"||adminModuleFilter==="credit";
   $("#invoiceBuilderPanel").hidden=!selected||adminModuleFilter!=="invoice";
   $("#creditBuilderPanel").hidden=!selected||adminModuleFilter!=="credit";
   if(adminModuleFilter==="invoice")resetInvoiceBuilder();
   if(adminModuleFilter==="credit")resetCreditBuilder();
   $("#adminListHeading").textContent=selected?`Oefeningen: ${moduleById(adminModuleFilter).title}`:"Bestaande oefeningen";
   renderAdminList();
 };
}
function renderAdminList(){
 if(!moduleById(adminModuleFilter))return;
 const search=($("#adminSearch").value||"").toLowerCase();
 const scoped=bank.filter(q=>q.module===adminModuleFilter);
 const filtered=scoped.filter(q=>(q.title+" "+(q.prompt||"")).toLowerCase().includes(search));
 $("#questionCount").textContent=`${filtered.length} van ${scoped.length} oefening(en)`;
 $("#adminQuestionList").innerHTML=filtered.length?filtered.map(q=>{
   const structured=isInvoiceExercise(q);
   const structuredCredit=isCreditExercise(q);
   const invoiceLevel=structured||structuredCredit?invoiceLevelForRows(q.rows):0;
   const level=structured?`Niveau ${invoiceLevel}`:q.level?`Niveau ${q.level}`:"";
   const displayLevel=structuredCredit?`Niveau ${invoiceLevel}`:level;
   const description=structured||structuredCredit?"":q.prompt||"";
   const editButton=structured
     ?`<button class="btn btn-outline" data-edit-invoice="${esc(q.id)}">Bewerken</button>`
     :structuredCredit
       ?`<button class="btn btn-outline" data-edit-credit="${esc(q.id)}">Bewerken</button>`
       :`<button class="btn btn-outline" data-edit="${esc(q.id)}">Bewerken</button>`;
   return `<article class="admin-item"><strong>${esc(q.title||"Oefening")}</strong>${displayLevel?`<small>${esc(displayLevel)}</small>`:""}${description?`<p>${esc(description)}</p>`:""}<div class="admin-item-actions">${editButton}<button class="delete-btn" data-delete="${esc(q.id)}">Verwijderen</button></div></article>`;
 }).join(""):`<p class="muted">Geen oefeningen gevonden.</p>`;
 $("#adminQuestionList").querySelectorAll("[data-edit-invoice]").forEach(b=>b.onclick=()=>editInvoiceExercise(b.dataset.editInvoice));
 $("#adminQuestionList").querySelectorAll("[data-edit-credit]").forEach(b=>b.onclick=()=>editCreditExercise(b.dataset.editCredit));
 $("#adminQuestionList").querySelectorAll("[data-edit]").forEach(b=>b.onclick=()=>editQuestion(b.dataset.edit));
 $("#adminQuestionList").querySelectorAll("[data-delete]").forEach(b=>b.onclick=()=>{
   const question=bank.find(item=>item.id===b.dataset.delete);
   if(!question)return;
   showActionDialog({
     title:"Oefening verwijderen?",
     message:`Wil je ‘${question.title}’ definitief verwijderen?`,
     confirmText:"Verwijderen",
     confirmClass:"btn-danger",
     onConfirm:()=>{
       bank=bank.filter(item=>item.id!==b.dataset.delete);
       saveBank();
       renderAdminList();renderModuleVisibility();renderModuleCards();
     }
   });
 });
}
function editQuestion(id){
 const q=bank.find(x=>x.id===id);if(!q)return;
 $("#invoiceBuilderPanel").hidden=true;$("#creditBuilderPanel").hidden=true;$("#genericQuestionPanel").hidden=false;
 $("#qId").value=q.id;$("#qModule").value=q.module;$("#qTitle").value=q.title;$("#qPrompt").value=q.prompt;$("#qType").value=q.type||"number";$("#qLevel").value=q.level||"Basis";$("#qHint").value=q.hint||"";$("#qAnswer").value=q.answer;$("#qTolerance").value=q.tolerance??0.01;$("#qSolution").value=q.solution||"";$("#qGoal").value=q.goal||"";
 $("#formHeading").textContent="Oefening bewerken";$("#questionForm").scrollIntoView({behavior:"smooth",block:"start"});
}
function clearQuestionForm(){
 $("#questionForm").reset();$("#qId").value="";$("#qTolerance").value="0.01";$("#formHeading").textContent="Nieuwe oefening";
 $("#qModule").value=adminModuleFilter;
}
function bindTeacher(){
 $("#chooseStudent").onclick=()=>{
   $("#rolePage").querySelector(".role-options").hidden=true;
   $("#studentImportPanel").hidden=false;
   $("#learnerImportFile").focus();
 };
 $("#chooseTeacher").onclick=()=>{
   $("#rolePage").querySelector(".role-options").hidden=true;
   $("#teacherLoginPanel").hidden=false;
   $("#teacherPin").focus();
 };
 $("#backToRolesFromStudent").onclick=showRoleChooser;
 $("#backToRolesFromTeacher").onclick=showRoleChooser;
 $("#loginForm").onsubmit=e=>{
   e.preventDefault();
   if($("#teacherPin").value===TEACHER_PIN)activateRole("teacher");
   else{$("#loginFeedback").textContent="De code is niet correct. Probeer opnieuw.";$("#loginFeedback").className="feedback bad";}
 };
 const logoutDialog=$("#logoutDialog");
 $("#logoutBtn").onclick=()=>showActionDialog({
   title:"Uitloggen?",
   message:currentRole==="student"
     ?"Je staat op het punt om uit te loggen. De oefeningen uit de geïmporteerde oefeningenset worden verwijderd. Bevestig om door te gaan."
     :"Je staat op het punt om uit te loggen. Bevestig om door te gaan.",
   confirmText:"Uitloggen",
   confirmClass:"btn-danger",
   onConfirm:()=>{
     if(currentRole==="student"){
       const previousBank=bank;
       bank=[];
       try{saveBank();}
       catch(error){
         bank=previousBank;
         $("#logoutDialogMessage").textContent=`Uitloggen is niet uitgevoerd, want de oefeningen konden niet worden verwijderd: ${error.message}`;
         return false;
       }
     }
     showRoleChooser();
   }
 });
 $("#cancelLogout").onclick=closeActionDialog;
 $("#confirmLogout").onclick=()=>{
   const action=dialogAction;
   if(action&&action()===false)return;
   closeActionDialog();
 };
 logoutDialog.addEventListener("cancel",e=>{e.preventDefault();closeActionDialog();});
 $("#questionForm").onsubmit=e=>{
   e.preventDefault();
   if(adminModuleFilter==="keypad"){
     $("#moduleVisibilityStatus").textContent="Voor Numeriek klavier kun je geen oefeningen aanmaken; gebruik de module-instelling om het onderdeel in of uit te schakelen.";
     $("#moduleVisibilityStatus").className="feedback bad";
     return;
   }
   const id=$("#qId").value||`q-${Date.now()}`;
   const q={id,module:$("#qModule").value,title:uniqueExerciseTitle($("#qTitle").value,bank,id),prompt:$("#qPrompt").value.trim(),type:$("#qType").value,level:$("#qLevel").value,hint:$("#qHint").value.trim(),answer:$("#qAnswer").value.trim(),tolerance:Math.max(0,Number($("#qTolerance").value)||0),solution:$("#qSolution").value.trim(),goal:$("#qGoal").value.trim()};
   const existing=bank.some(question=>question.id===id);
   showActionDialog({
     title:existing?"Wijzigingen bewaren?":"Oefening toevoegen?",
     message:existing?`Wil je de wijzigingen aan ‘${q.title}’ bewaren?`:`Wil je de oefening ‘${q.title}’ toevoegen?`,
     confirmText:existing?"Bewaren":"Oefening toevoegen",
     confirmClass:"btn-primary",
     onConfirm:()=>{
       const index=bank.findIndex(question=>question.id===id);
       if(index>=0)bank[index]=q;else bank.push(q);
       saveBank();clearQuestionForm();renderAdminList();renderModuleVisibility();renderModuleCards();
     }
   });
 };
 $("#addInvoiceParameterRow").onclick=()=>{addInvoiceParameterRow();renderInvoiceBuilderPreview();};
 $("#invoiceParameterRows").addEventListener("input",renderInvoiceBuilderPreview);
 $("#invoiceParameterRows").addEventListener("change",renderInvoiceBuilderPreview);
 $("#invoiceParameterRows").addEventListener("click",e=>{
   const remove=e.target.closest("[data-remove-invoice-row]");
   if(remove){remove.closest("tr").remove();renderInvoiceBuilderPreview();}
 });
 $("#clearInvoiceBuilder").onclick=resetInvoiceBuilder;
 $("#invoiceBuilderForm").onsubmit=e=>{
   e.preventDefault();
   let calculated;
   try{calculated=invoiceBuilderModel();}
   catch(error){$("#invoiceBuilderPreview").textContent=error.message;return;}
   let title=$("#invoiceSetTitle").value.trim()||nextInvoiceTitle();
   const existingId=$("#invoiceSetId").value;
   title=uniqueExerciseTitle(title,bank,existingId);
   const question={id:$("#invoiceSetId").value||`invoice-${Date.now()}`,module:"invoice",kind:"invoice-exercise",title,level:calculated.level,rows:calculated.rows.map(({rate,goodsCents,tradeRate,extraCostCents,financialRate,packagingCents})=>({rate,goodsCents,tradeRate,extraCostCents,financialRate,packagingCents}))};
   const existing=bank.some(item=>item.id===question.id);
   showActionDialog({
     title:existing?"Wijzigingen bewaren?":"Oefening toevoegen?",
     message:existing?`Wil je de wijzigingen aan ‘${question.title}’ bewaren?`:`Wil je de factuuroefening ‘${question.title}’ toevoegen?`,
     confirmText:existing?"Bewaren":"Oefening toevoegen",
     confirmClass:"btn-primary",
     onConfirm:()=>{
       const previousBank=bank;
       const index=bank.findIndex(item=>item.id===question.id);
       if(index<0)bank=[...bank,question];else{bank=[...bank];bank[index]=question;}
       try{saveBank();}
       catch(error){bank=previousBank;$("#invoiceBuilderPreview").textContent=`Oefening kon niet worden bewaard: ${error.message}`;return;}
       resetInvoiceBuilder();renderAdminList();renderModuleVisibility();renderModuleCards();
     }
   });
 };
 $("#addCreditParameterRow").onclick=()=>{addCreditParameterRow();renderCreditBuilderPreview();};
 $("#creditParameterRows").addEventListener("input",renderCreditBuilderPreview);
 $("#creditParameterRows").addEventListener("change",renderCreditBuilderPreview);
 $("#creditParameterRows").addEventListener("click",e=>{
   const remove=e.target.closest("[data-remove-credit-row]");
   if(remove){remove.closest("tr").remove();renderCreditBuilderPreview();}
 });
 $("#clearCreditBuilder").onclick=resetCreditBuilder;
 $("#creditBuilderForm").onsubmit=e=>{
   e.preventDefault();
   let calculated;
   try{calculated=creditBuilderModel();}
   catch(error){$("#creditBuilderPreview").textContent=error.message;return;}
   const existingId=$("#creditSetId").value;
   const title=uniqueExerciseTitle($("#creditSetTitle").value.trim()||nextCreditTitle(),bank,existingId);
   const question={id:existingId||`credit-${Date.now()}`,module:"credit",kind:"credit-exercise",title,level:calculated.level,rows:calculated.rows.map(({rate,goodsCents,tradeRate,extraCostCents,financialRate,packagingCents})=>({rate,goodsCents,tradeRate,extraCostCents,financialRate,packagingCents}))};
   const existing=bank.some(item=>item.id===question.id);
   showActionDialog({
     title:existing?"Wijzigingen bewaren?":"Oefening toevoegen?",
     message:existing?`Wil je de wijzigingen aan ‘${question.title}’ bewaren?`:`Wil je de creditnota-oefening ‘${question.title}’ toevoegen?`,
     confirmText:existing?"Bewaren":"Oefening toevoegen",
     confirmClass:"btn-primary",
     onConfirm:()=>{
       const previousBank=bank;
       const index=bank.findIndex(item=>item.id===question.id);
       if(index<0)bank=[...bank,question];else{bank=[...bank];bank[index]=question;}
       try{saveBank();}
       catch(error){bank=previousBank;$("#creditBuilderPreview").textContent=`Oefening kon niet worden bewaard: ${error.message}`;return;}
       resetCreditBuilder();renderAdminList();renderModuleVisibility();renderModuleCards();
     }
   });
 };
 $("#clearForm").onclick=clearQuestionForm;
 $("#adminSearch").oninput=renderAdminList;
 $("#importBtn").onclick=()=>{
   if(adminModuleFilter==="keypad")return;
   $("#importFile").click();
 };
 $("#exportBtn").onclick=()=>{
   const module=moduleById(adminModuleFilter);
   if(!module||adminModuleFilter==="keypad")return;
   const now=new Date();
   const date=`${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,"0")}-${String(now.getDate()).padStart(2,"0")}`;
   const suggestedName=`${module.title}-${date}`;
   showActionDialog({
     title:"Oefeningenset exporteren",
     message:"Kies een naam voor deze oefeningenset.",
     cancelText:"Annuleer",
     confirmText:"Download oefeningenset",
     confirmClass:"btn-primary",
     inputValue:suggestedName,
     onConfirm:()=>{
       const filename=$("#dialogInput").value.trim();
       if(!filename){
         $("#logoutDialogMessage").textContent="Vul een bestandsnaam in om de oefeningenset te downloaden.";
         $("#dialogInput").focus();
         return false;
       }
       const safeFilename=filename.replace(/[<>:"/\\|?*\x00-\x1f]/g,"-").replace(/\.json$/i,"").replace(/[. ]+$/g,"")||"oefeningenset";
       const questions=bank.filter(q=>q.module===adminModuleFilter);
       const set={format:"bo-oefenbank",exportedAt:new Date().toISOString(),module:adminModuleFilter,questions};
       const blob=new Blob([JSON.stringify(set,null,2)],{type:"application/json"});
       const url=URL.createObjectURL(blob),a=document.createElement("a");a.href=url;
       a.download=`${safeFilename}.json`;
       a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
     }
   });
 };
 const importFile=e=>{
   const file=e.target.files[0];if(!file)return;
   const isLearnerImport=e.target.id==="learnerImportFile";
   const reader=new FileReader();reader.onerror=()=>{
     showActionDialog({title:"Importeren mislukt",message:"Het oefeningensetbestand kon niet worden gelezen.",confirmText:"OK"});
     e.target.value="";
   };reader.onload=()=>{
     try{
       const parsed=JSON.parse(reader.result),incoming=Array.isArray(parsed)?parsed:parsed.questions;
       const validQuestion=q=>isValidInvoiceExercise(q)||isValidCreditExercise(q)||(q&&typeof q.id==="string"&&q.id.trim()&&modules.some(m=>m.id===q.module)&&typeof q.title==="string"&&q.title.trim()&&typeof q.prompt==="string"&&q.prompt.trim()&&(typeof q.answer==="string"||typeof q.answer==="number")&&["number","text"].includes(q.type||"number"));
       if(!Array.isArray(incoming)||!incoming.length||!incoming.every(validQuestion))throw new Error("Ongeldig oefeningensetbestand of onbekend formaat.");
       if(new Set(incoming.map(q=>q.id)).size!==incoming.length)throw new Error("Het bestand bevat dubbele oefening-ID's.");
       if(!isLearnerImport&&!moduleById(adminModuleFilter))throw new Error("Kies eerst het onderdeel waarin je de oefeningenset wilt importeren.");
       if(!isLearnerImport&&adminModuleFilter==="keypad")throw new Error("Numeriek klavier is een vaste snelheidstest en ondersteunt geen geïmporteerde oefeningen.");
       if(!isLearnerImport&&incoming.some(q=>q.module!==adminModuleFilter))throw new Error(`Selecteer eerst het juiste onderdeel; dit bestand bevat oefeningen buiten ${moduleById(adminModuleFilter).title}.`);
       const importedModules=[...new Set(incoming.map(q=>q.module))];
       const nextBank=[...bank];
       incoming.forEach(source=>{
         const question=isInvoiceExercise(source)||isCreditExercise(source)
           ?{...source,id:source.id.trim(),title:source.title.trim(),level:invoiceLevelForRows(source.rows),rows:source.rows.map(row=>({rate:Number(row.rate),goodsCents:Math.round(Number(row.goodsCents)),tradeRate:Number(row.tradeRate||0),extraCostCents:Math.round(Number(row.extraCostCents||0)),financialRate:Number(row.financialRate||0),packagingCents:Math.round(Number(row.packagingCents||0))}))}
           :{...source,id:source.id.trim(),title:source.title.trim(),prompt:source.prompt.trim(),type:source.type||"number",hint:typeof source.hint==="string"?source.hint:"",tolerance:Number.isFinite(Number(source.tolerance))?Math.max(0,Number(source.tolerance)):0.01,solution:typeof source.solution==="string"?source.solution:"",goal:typeof source.goal==="string"?source.goal:"",level:typeof source.level==="string"?source.level:"Basis",answer:String(source.answer)};
         question.title=question.module==="invoice"
           ?nextInvoiceTitle(nextBank)
           :question.module==="credit"
             ?nextCreditTitle(nextBank)
             :nextSequentialTitle(source.title,nextBank);
         question.id=uniqueQuestionId(question.id,nextBank);
         nextBank.push(question);
       });
       const previousBank=bank;bank=nextBank;
       try{saveBank();}catch(error){bank=previousBank;throw new Error(`De oefenset kon niet worden bewaard: ${error.message}`);}
       if(isLearnerImport){
         const nextVisibility={...moduleVisibility,...Object.fromEntries(importedModules.map(moduleId=>[moduleId,true]))};
         try{localStorage.setItem(MODULES_KEY,JSON.stringify(nextVisibility));moduleVisibility=nextVisibility;}
         catch(error){throw new Error(`De oefenset is bewaard, maar de modules konden niet worden ingeschakeld: ${error.message}`);}
         showActionDialog({
           title:"Oefeningenset geïmporteerd",
           message:`${incoming.length} oefening(en) uit de set zijn geïmporteerd. Je kunt nu beginnen met oefenen.`,
           cancelText:"Sluiten",
           confirmText:"Doorgaan",
           onConfirm:()=>activateRole("student")
         });
       }else{
         renderAdminList();renderModuleVisibility();renderModuleCards();
         showActionDialog({
           title:"Oefeningenset geïmporteerd",
           message:`${incoming.length} oefening(en) uit de set zijn geïmporteerd. Bestaande onderdelen zijn behouden.`,
           confirmText:"OK"
         });
       }
     }catch(error){
       showActionDialog({
         title:"Importeren mislukt",
         message:error.message||"Dit bestand is geen geldige oefeningenset.",
         confirmText:"OK"
       });
     }
     e.target.value="";
   };reader.readAsText(file);
 };
 $("#importFile").onchange=importFile;
 $("#learnerImportFile").onchange=importFile;
}
function init(){
 $("#year") && ($("#year").textContent=new Date().getFullYear());
 document.addEventListener("click",e=>{
   const module=e.target.closest("[data-module]");if(module)openModule(module.dataset.module);
   const question=e.target.closest("[data-question]");if(question)openQuestion(question.dataset.question);
   const goto=e.target.closest("[data-goto]");if(goto){e.preventDefault();page(goto.dataset.goto);}
   const nav=e.target.closest(".nav-link");if(nav){e.preventDefault();page(nav.dataset.page);}
 });
 document.addEventListener("keydown",e=>{
   const card=e.target.closest(".module-card-link");
   if(card&&(e.key==="Enter"||e.key===" ")){e.preventDefault();openModule(card.dataset.module);}
 });
 $("#menuToggle").onclick=()=>$("#mainNav").classList.toggle("open");
 $("#backToExercises").onclick=()=>page("oefeningen");
 $("#brandHome").onclick=e=>{
   e.preventDefault();
   if(currentRole==="student")page("start");
 };
 bindTeacher();
 if(currentRole==="teacher"||currentRole==="student")activateRole(currentRole);
 else showRoleChooser();
}
init();
