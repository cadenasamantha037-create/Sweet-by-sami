const $ = id => document.getElementById(id);
const fmtMoney = value => `${window.SWEET_CONFIG.currency || "Bs."} ${Number(value || 0).toFixed(0)}`;
const esc = value => String(value ?? "").replace(/[&<>'"]/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'"':"&quot;"}[c]));
const uid = (prefix="v") => `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2,8)}`;
const categoryListEl = $("adminCategoryList");
const categoryTemplate = $("categoryEditorTemplate");
const productTemplate = $("productEditorTemplate");
const variantTemplate = $("variantTemplate");
let adminCategories = [];
let adminProducts = [];
let adminOrders = [];
let adminCustomers = [];
let adminSettings = null;

const pageMeta = {
  dashboard:["Panel general","Resumen del negocio","Controla ingresos, pagos, clientes y pedidos desde un solo lugar."],
  orders:["Ventas","Pedidos y comprobantes","Revisa el pago de cada pedido, cambia su estado y consulta los datos de entrega."],
  customers:["Base de datos","Clientes registrados","Nombres, números de WhatsApp y comportamiento de compra de tus clientes."],
  payments:["Configuración","QR y entregas","Actualiza el QR de cobro y los datos que se muestran durante el checkout."],
  products:["Catálogo","Categorías, items y variantes","Crea categorías, añade productos y administra sus presentaciones sin tocar el código."]
};

function setMode() {
  if (window.SweetStore.mode === "supabase") {
    $("modeBadge").textContent = "SUPABASE";
    $("modeText").textContent = "Datos conectados a Supabase. El panel requiere sesión de administrador.";
    $("logoutBtn").classList.remove("hidden");
    $("resetDemoBtn").classList.add("hidden");
  }
}

function goSection(section) {
  document.querySelectorAll("[data-admin-section]").forEach(el => el.classList.toggle("active", el.dataset.adminSection === section));
  document.querySelectorAll("#adminNav button[data-section]").forEach(btn => btn.classList.toggle("active", btn.dataset.section === section));
  const meta = pageMeta[section] || pageMeta.dashboard;
  $("pageKicker").textContent = meta[0]; $("pageTitle").textContent = meta[1]; $("pageDescription").textContent = meta[2];
  window.scrollTo({top:0,behavior:"smooth"});
}

document.querySelectorAll("#adminNav button[data-section]").forEach(btn => btn.addEventListener("click", () => goSection(btn.dataset.section)));
document.querySelectorAll("[data-go-section]").forEach(btn => btn.addEventListener("click", () => goSection(btn.dataset.goSection)));

function parseDate(value){ const d = new Date(value); return Number.isNaN(d.getTime()) ? new Date(0) : d; }
function startOfWeek(date = new Date()) { const d = new Date(date); d.setHours(0,0,0,0); const day = d.getDay() || 7; d.setDate(d.getDate() - day + 1); return d; }
function startOfMonth(date = new Date()) { return new Date(date.getFullYear(), date.getMonth(), 1); }
function formatDate(value){ return parseDate(value).toLocaleString("es-BO",{day:"2-digit",month:"short",year:"numeric",hour:"2-digit",minute:"2-digit"}); }
function monthName(){ return new Date().toLocaleDateString("es-BO",{month:"long",year:"numeric"}); }
function cleanPhone(value){ return window.SweetStore.normalizePhone(value); }
function waNumber(value){ const d=cleanPhone(value); if(d.startsWith("591")) return d; return d.length===8?`591${d}`:d; }
function waLink(phone, text="Hola") { return `https://wa.me/${waNumber(phone)}?text=${encodeURIComponent(text)}`; }
function paymentClass(status){ return status === "confirmed" ? "confirmed" : status === "rejected" ? "rejected" : "pending"; }
function paymentLabel(status){ return ({pending_review:"Pendiente QR",cash_pending:"Efectivo pendiente",confirmed:"Confirmado",rejected:"Con observación"})[status] || status; }
function orderLabel(status){ return ({received:"Recibido",preparing:"Preparando",ready:"Listo para recoger",shipped:"Enviado",completed:"Completado",cancelled:"Cancelado"})[status] || status; }
function fulfillmentLabel(method){ return ({pickup:"Recojo en local",customer_delivery:"Manda tu delivery",delivery:"Manda tu delivery",national:"Envío nacional · sábado",danae:"Paquetería DANAE · jueves"})[method] || method; }
function preparationLabel(mode){ return ({live:"Armado en LIVE",tiktok:"Video para TikTok"})[mode] || mode || "Armado en LIVE"; }
function paymentMethodLabel(method){ return ({qr:"QR",cash:"Efectivo"})[method] || method || "QR"; }
function displayOrderNumber(order){ const base=Number(adminSettings?.historical_order_count||0); const serial=Number(order?.order_serial||0); return serial>0 ? base+serial : null; }

function confirmedOrders() { return adminOrders.filter(o => o.payment_status === "confirmed"); }
function refundAmount(order){ return Math.max(0, Number(order?.refund_amount || 0)); }
function netOrderTotal(order){ return Math.max(0, Number(order?.total || 0) - refundAmount(order)); }

function buildCustomerStats() {
  const map = new Map();
  adminCustomers.forEach(c => map.set(cleanPhone(c.phone), { ...c, phone:cleanPhone(c.phone), order_count:0, confirmed_total:0, last_order_at:c.last_order_at || c.created_at }));
  adminOrders.forEach(order => {
    const phone = cleanPhone(order.customer_phone);
    if (!map.has(phone)) map.set(phone,{id:order.customer_id || phone,name:order.customer_name,phone,order_count:0,confirmed_total:0,last_order_at:order.created_at});
    const c = map.get(phone); c.name = order.customer_name || c.name; c.order_count += 1;
    if (order.payment_status === "confirmed") c.confirmed_total += netOrderTotal(order);
    if (parseDate(order.created_at) > parseDate(c.last_order_at)) c.last_order_at = order.created_at;
  });
  return [...map.values()].sort((a,b)=>parseDate(b.last_order_at)-parseDate(a.last_order_at));
}

function renderDashboard() {
  const now = new Date(), weekStart = startOfWeek(now), monthStart = startOfMonth(now);
  const confirmed = confirmedOrders();
  const weekly = confirmed.filter(o => parseDate(o.payment_confirmed_at || o.created_at) >= weekStart).reduce((s,o)=>s+netOrderTotal(o),0);
  const monthly = confirmed.filter(o => parseDate(o.payment_confirmed_at || o.created_at) >= monthStart).reduce((s,o)=>s+netOrderTotal(o),0);
  const pending = adminOrders.filter(o=>["pending_review","cash_pending"].includes(o.payment_status)).length;
  const customers = buildCustomerStats();
  $("weeklyIncome").textContent = fmtMoney(weekly); $("monthlyIncome").textContent = fmtMoney(monthly); $("pendingPayments").textContent = pending; $("customerCount").textContent = customers.length; $("pendingNavBadge").textContent = pending; $("rankingMonth").textContent = monthName();
  const highestSerial = adminOrders.reduce((max,o)=>Math.max(max,Number(o.order_serial||0)),0);
  const lifetime = Number(adminSettings?.historical_order_count||0) + (highestSerial || adminOrders.length);
  const milestone = Number(adminSettings?.milestone_target||1000);
  if ($("lifetimeOrderCount")) $("lifetimeOrderCount").textContent = lifetime;
  if ($("milestoneProgress")) $("milestoneProgress").textContent = lifetime >= milestone ? `¡Hito #${milestone} alcanzado!` : `${Math.max(0,milestone-lifetime)} pedidos para llegar al #${milestone}`;

  const monthlyOrders = confirmed.filter(o=>parseDate(o.payment_confirmed_at || o.created_at)>=monthStart);
  const buyers = new Map();
  monthlyOrders.forEach(o=>{ const p=cleanPhone(o.customer_phone); if(!buyers.has(p)) buyers.set(p,{name:o.customer_name,phone:p,total:0,orders:0}); const b=buyers.get(p); b.total+=netOrderTotal(o); b.orders+=1; });
  const top=[...buyers.values()].sort((a,b)=>b.total-a.total).slice(0,5);
  $("topBuyersList").innerHTML = top.length ? top.map((b,i)=>`<div class="ranking-row"><div class="ranking-number">${i+1}</div><div class="ranking-main"><strong>${esc(b.name)}</strong><small>${b.orders} pedido${b.orders===1?"":"s"} este mes</small></div><div class="ranking-total">${fmtMoney(b.total)}</div><a class="wa-btn" target="_blank" rel="noopener" href="${waLink(b.phone,`Hola ${b.name}, te escribimos de Sweet by Sami.`)}">WhatsApp</a></div>`).join("") : `<div class="empty-state">Todavía no hay compradores con pagos confirmados este mes.</div>`;

  const recent=adminOrders.slice(0,6);
  $("recentOrders").innerHTML=recent.length?recent.map(o=>`<div class="recent-row"><div><strong>${displayOrderNumber(o)?`#${displayOrderNumber(o)} · `:""}${esc(o.order_code)} · ${esc(o.customer_name)}</strong><small>${formatDate(o.created_at)} · ${fmtMoney(o.total)}</small></div><span class="status-chip ${paymentClass(o.payment_status)}">${paymentLabel(o.payment_status)}</span></div>`).join(""):`<div class="empty-state">Los nuevos pedidos aparecerán aquí.</div>`;
}

function deliveryDetails(order) {
  const parts=[];
  if(order.department) parts.push(order.department);
  if(order.shipping_province) parts.push(`Provincia: ${order.shipping_province}`);
  if(order.city) parts.push(order.city);
  if(order.address) parts.push(order.address);
  if(order.reference) parts.push(`Ref: ${order.reference}`);
  return parts.join(" · ");
}

function nationalRecipientDetails(order) {
  if (order.fulfillment_method !== "national") return "";
  const name = order.shipping_recipient_name || "";
  const phone = cleanPhone(order.shipping_recipient_phone || "");
  const ci = order.shipping_recipient_ci || "";
  if (!name && !phone && !ci) return "";
  return `<div class="national-recipient-admin"><span>Datos del destinatario</span>${name ? `<strong>${esc(name)}</strong>` : ""}${phone ? `<div class="customer-name-row"><div class="customer-phone">+${esc(phone)}</div><a class="wa-btn" target="_blank" rel="noopener" href="${waLink(phone,`Hola ${name || ""}, te escribimos de Sweet by Sami sobre la recepción de un envío.`)}">WhatsApp</a></div>` : ""}${ci ? `<small>CI: ${esc(ci)}</small>` : ""}</div>`;
}


function dedicationDetails(order){
  const from = String(order?.dedication_from || "").trim();
  const to = String(order?.dedication_to || "").trim();
  if(!from && !to) return "";
  return `<div class="dedication-admin"><span>Dedicatoria</span><strong>De: ${esc(from || "—")} · Para: ${esc(to || "—")}</strong></div>`;
}

function deliveryLocationLink(order) {
  const lat = Number(order.delivery_latitude);
  const lng = Number(order.delivery_longitude);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return "";
  const accuracy = Number(order.delivery_accuracy_m);
  const label = Number.isFinite(accuracy) && accuracy > 0 ? `Abrir ubicación · ±${Math.round(accuracy)} m` : "Abrir ubicación";
  return `<a class="location-map-btn" target="_blank" rel="noopener noreferrer" href="https://www.google.com/maps?q=${encodeURIComponent(`${lat},${lng}`)}">⌖ ${esc(label)}</a>`;
}

function renderOrders() {
  const q=$("orderSearch").value.trim().toLowerCase();
  const filter=$("paymentFilter").value;
  const fulfillment=$("fulfillmentFilter")?.value || "all";
  const orders=adminOrders.filter(o=>{
    const haystack=`${o.order_code} ${o.customer_name} ${o.customer_phone} ${o.shipping_recipient_name || ""} ${o.shipping_recipient_phone || ""} ${o.shipping_recipient_ci || ""} ${o.shipping_province || ""}`.toLowerCase();
    return (!q||haystack.includes(q)) && (filter==="all"||o.payment_status===filter) && (fulfillment==="all"||o.fulfillment_method===fulfillment);
  });
  $("ordersList").innerHTML = orders.length ? orders.map(o=>{
    const items=(o.order_items||[]).map(i=>`<div class="order-item-mini"><span>${esc(i.product_name)} · ${esc(i.variant_name)} × ${i.quantity}</span><strong>${fmtMoney(i.subtotal ?? Number(i.unit_price)*Number(i.quantity))}</strong></div>`).join("");
    const shippingFee=Number(o.shipping_fee||0);
    const shippingFeeLine=shippingFee>0?`<div class="order-item-mini provincial-admin-fee"><span>Adelanto de envío provincial</span><strong>${fmtMoney(shippingFee)}</strong></div>`:"";
    const number=displayOrderNumber(o);
    const receiptButton=o.payment_receipt_path ? `<button class="receipt-btn" type="button" data-receipt="${esc(o.id)}">Ver comprobante</button>` : `<span class="status-chip pending">Sin comprobante · efectivo</span>`;
    return `<article class="order-card" data-order-id="${esc(o.id)}">
      <div class="order-head"><div class="order-code"><div><strong>${number?`#${number} · `:""}${esc(o.order_code)}</strong><small>${formatDate(o.created_at)}</small></div><span class="status-chip ${paymentClass(o.payment_status)}">${paymentLabel(o.payment_status)}</span></div><div class="order-total">${fmtMoney(o.total)}</div></div>
      <div class="order-grid">
        <div class="order-block"><span>Cliente</span><div class="customer-name-row"><strong>${esc(o.customer_name)}</strong><a class="wa-btn" target="_blank" rel="noopener" href="${waLink(o.customer_phone,`Hola ${o.customer_name}, te escribimos de Sweet by Sami sobre tu pedido ${o.order_code}.`)}">WhatsApp</a></div><div class="customer-phone">+${esc(o.customer_phone)}</div>${receiptButton}</div>
        <div class="order-block"><span>Pedido y entrega</span><div class="order-items-mini">${(items || "<small>Sin items</small>") + shippingFeeLine}</div><div class="order-meta" style="margin-top:9px"><b>${esc(fulfillmentLabel(o.fulfillment_method))}</b><br>${esc(deliveryDetails(o))}${deliveryLocationLink(o)}</div>${nationalRecipientDetails(o)}${dedicationDetails(o)}<div class="order-extra-badges"><span>${esc(preparationLabel(o.preparation_mode))}</span><span class="gold">Pago: ${esc(paymentMethodLabel(o.payment_method))}</span>${o.fulfillment_method==="national"?'<span class="blue">Despacho sábado</span>':''}${shippingFee>0?`<span class="gold">Adelanto envío: ${fmtMoney(shippingFee)}</span>`:""}${o.fulfillment_method==="danae"?'<span class="blue">DANAE jueves</span>':''}</div></div>
        <div class="order-block order-status-controls"><label>Estado del pago<select class="js-payment-status"><option value="pending_review" ${o.payment_status==="pending_review"?"selected":""}>Pendiente de revisión</option><option value="cash_pending" ${o.payment_status==="cash_pending"?"selected":""}>Efectivo pendiente</option><option value="confirmed" ${o.payment_status==="confirmed"?"selected":""}>Confirmado</option><option value="rejected" ${o.payment_status==="rejected"?"selected":""}>Comprobante con observación</option></select></label><label>Estado del pedido<select class="js-order-status"><option value="received" ${o.order_status==="received"?"selected":""}>Pedido recibido</option><option value="preparing" ${o.order_status==="preparing"?"selected":""}>Preparando</option><option value="ready" ${o.order_status==="ready"?"selected":""}>Listo para recoger</option><option value="shipped" ${o.order_status==="shipped"?"selected":""}>Enviado</option><option value="completed" ${o.order_status==="completed"?"selected":""}>Completado</option><option value="cancelled" ${o.order_status==="cancelled"?"selected":""}>Cancelado</option></select></label><label>Nota interna<textarea class="js-admin-note" rows="2" placeholder="Opcional">${esc(o.admin_note||"")}</textarea></label>
          <div class="refund-admin-box ${refundAmount(o)>0?"refunded":""}">
            <div><strong>${refundAmount(o)>0?`Reembolso registrado: ${fmtMoney(refundAmount(o))}`:"Reembolso"}</strong><small>${refundAmount(o)>0?`${o.refund_note?esc(o.refund_note):"Registrado en administración"}${o.refunded_at?` · ${formatDate(o.refunded_at)}`:""}`:"Registra aquí un reembolso realizado al cliente. En pedidos provinciales se sugiere Bs. 20 como máximo inicial."}</small></div>
            <button class="btn btn-soft js-refund-btn" type="button">${refundAmount(o)>0?"Editar reembolso":"Registrar reembolso"}</button>
          </div>
          <small class="save-inline"></small></div>
      </div></article>`;
  }).join("") : `<div class="empty-state">No hay pedidos que coincidan con este filtro.</div>`;

  $("ordersList").querySelectorAll(".order-card").forEach(card=>{
    const id=card.dataset.orderId;
    const save=async()=>{
      const indicator=card.querySelector(".save-inline"); indicator.textContent="Guardando...";
      try{
        const updated=await window.SweetStore.updateOrder(id,{payment_status:card.querySelector(".js-payment-status").value,order_status:card.querySelector(".js-order-status").value,admin_note:card.querySelector(".js-admin-note").value.trim()});
        const idx=adminOrders.findIndex(o=>String(o.id)===String(id)); if(idx>=0) adminOrders[idx]={...adminOrders[idx],...updated};
        indicator.textContent="Guardado"; renderDashboard(); renderCustomers();
        setTimeout(()=>{indicator.textContent="";},1400);
      }catch(error){console.error(error);indicator.textContent="Error al guardar";}
    };
    card.querySelector(".js-payment-status").addEventListener("change",save); card.querySelector(".js-order-status").addEventListener("change",save); card.querySelector(".js-admin-note").addEventListener("change",save);
    card.querySelector(".js-refund-btn")?.addEventListener("click", async()=>{
      const order=adminOrders.find(o=>String(o.id)===String(id)); if(!order)return;
      const suggested=refundAmount(order) || Number(order.shipping_fee||0) || 0;
      const raw=prompt("Monto reembolsado en Bs.", String(suggested || ""));
      if(raw===null)return;
      const amount=Number(String(raw).replace(",","."));
      if(!Number.isFinite(amount) || amount<0 || amount>Number(order.total||0)){alert("Ingresa un monto válido entre Bs. 0 y el total del pedido.");return;}
      const promptedNote=prompt("Motivo o nota del reembolso (opcional):", order.refund_note||""); const note=promptedNote===null?(order.refund_note||""):promptedNote;
      const indicator=card.querySelector(".save-inline"); indicator.textContent="Guardando reembolso...";
      try{
        const changes={refund_amount:amount,refund_status:amount>0?"refunded":"none",refunded_at:amount>0?new Date().toISOString():null,refund_note:note.trim()};
        const updated=await window.SweetStore.updateOrder(id,changes);
        const idx=adminOrders.findIndex(o=>String(o.id)===String(id)); if(idx>=0)adminOrders[idx]={...adminOrders[idx],...updated};
        renderOrders();renderDashboard();renderCustomers();
      }catch(error){console.error(error);indicator.textContent="Error al registrar reembolso";}
    });
  });
  $("ordersList").querySelectorAll("[data-receipt]").forEach(btn=>btn.addEventListener("click",()=>openReceipt(btn.dataset.receipt)));
}

async function openReceipt(orderId) {
  const order=adminOrders.find(o=>String(o.id)===String(orderId)); if(!order) return;
  try{ const url=await window.SweetStore.getReceiptViewUrl(order.payment_receipt_path); if(!url){alert("Este pedido no tiene comprobante.");return;} $("receiptOrderTitle").textContent=order.order_code; $("receiptLightboxImage").src=url; $("receiptLightbox").classList.remove("hidden"); }catch(error){console.error(error);alert("No se pudo abrir el comprobante.");}
}
$("closeReceiptLightbox").addEventListener("click",()=>$("receiptLightbox").classList.add("hidden"));
$("receiptLightbox").addEventListener("click",e=>{if(e.target===$("receiptLightbox"))$("receiptLightbox").classList.add("hidden")});

function renderCustomers() {
  const q=$("customerSearch").value.trim().toLowerCase();
  const fromValue=$("customerDateFrom")?.value||"";
  const toValue=$("customerDateTo")?.value||"";
  const minRaw=$("customerOrdersMin")?.value||"";
  const maxRaw=$("customerOrdersMax")?.value||"";
  const from=fromValue?new Date(`${fromValue}T00:00:00`):null;
  const to=toValue?new Date(`${toValue}T23:59:59.999`):null;
  const min=minRaw===""?null:Number(minRaw);
  const max=maxRaw===""?null:Number(maxRaw);
  const rows=buildCustomerStats().filter(c=>{
    if(q && !`${c.name} ${c.phone}`.toLowerCase().includes(q))return false;
    const last=parseDate(c.last_order_at);
    if(from && last<from)return false;
    if(to && last>to)return false;
    if(min!==null && Number(c.order_count||0)<min)return false;
    if(max!==null && Number(c.order_count||0)>max)return false;
    return true;
  });
  $("customersTableBody").innerHTML=rows.length?rows.map(c=>`<tr><td><strong>${esc(c.name)}</strong></td><td><span>${esc(c.phone)}</span></td><td>${c.order_count}</td><td><strong>${fmtMoney(c.confirmed_total)}</strong></td><td>${formatDate(c.last_order_at)}</td><td><a class="wa-btn" target="_blank" rel="noopener" href="${waLink(c.phone,`Hola ${c.name}, te escribimos de Sweet by Sami.`)}">WhatsApp</a></td></tr>`).join(""):`<tr><td colspan="6"><div class="empty-state">No hay clientes que coincidan con los filtros.</div></td></tr>`;
}

function renderSettings(){
  const s=adminSettings||{};
  $("pickupAddressInput").value=s.pickup_address||"";
  $("pickupMapUrlInput").value=s.pickup_map_url||"";
  $("pickupHoursInput").value=s.pickup_hours||"";
  $("danaeMapUrlInput").value=s.danae_map_url||"";
  $("danaeLocationInput").value=s.danae_location_name||"";
  $("danaeHoursInput").value=s.danae_hours||"";
  $("coordPhone1Input").value=s.coordination_phone_1||"";
  $("historicalOrderCountInput").value=Number(s.historical_order_count||0);
  $("milestoneTargetInput").value=Number(s.milestone_target||1000);
  $("paymentInstructionsInput").value=s.payment_instructions||"";
  $("adminQrPreview").innerHTML=s.payment_qr_url?`<img src="${esc(s.payment_qr_url)}" alt="QR de pago">`:`<span>Sin QR</span>`;
}

$("saveSettingsBtn").addEventListener("click",async()=>{
  const status=$("settingsSaveStatus"); status.textContent="Guardando...";
  try{
    adminSettings=await window.SweetStore.saveSettings({...adminSettings,
      pickup_address:$("pickupAddressInput").value.trim(),pickup_map_url:$("pickupMapUrlInput").value.trim(),pickup_hours:$("pickupHoursInput").value.trim(),
      danae_map_url:$("danaeMapUrlInput").value.trim(),danae_location_name:$("danaeLocationInput").value.trim(),danae_hours:$("danaeHoursInput").value.trim(),
      coordination_phone_1:$("coordPhone1Input").value.replace(/\D/g,""),coordination_phone_2:"",
      historical_order_count:Number($("historicalOrderCountInput").value||0),milestone_target:Number($("milestoneTargetInput").value||1000),
      payment_instructions:$("paymentInstructionsInput").value.trim()});
    status.textContent="Configuración guardada"; renderDashboard(); setTimeout(()=>status.textContent="",1600);
  }
  catch(error){console.error(error);status.textContent="Error al guardar";}
});

$("qrFileInput").addEventListener("change",async e=>{
  const file=e.target.files?.[0]; if(!file)return; const preview=$("adminQrPreview"); preview.innerHTML="<span>Subiendo...</span>";
  try{ const url=await window.SweetStore.uploadPaymentQr(file); adminSettings=await window.SweetStore.saveSettings({...adminSettings,payment_qr_url:url}); renderSettings(); }
  catch(error){console.error(error);preview.innerHTML="<span>Error al subir</span>";}
});

function setPreview(el,url){el.innerHTML=url?`<img src="${esc(url)}" alt="Vista previa">`:`<span>Sin foto</span>`;}

function currentMonthValue(){
  const d=new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}`;
}

function monthlyCustomerReport(monthValue){
  const [year,month]=String(monthValue||"").split("-").map(Number);
  if(!year||!month)return{rows:[],orders:[],confirmedTotal:0};
  const orders=adminOrders.filter(order=>{const d=parseDate(order.created_at);return d.getFullYear()===year&&d.getMonth()+1===month;});
  const map=new Map();
  orders.forEach(order=>{
    const phone=cleanPhone(order.customer_phone);
    if(!map.has(phone))map.set(phone,{name:order.customer_name||"",phone,orders:0,confirmed:0,last:null});
    const row=map.get(phone);row.name=order.customer_name||row.name;row.orders+=1;
    if(order.payment_status==="confirmed")row.confirmed+=netOrderTotal(order);
    const when=parseDate(order.created_at);if(!row.last||when>row.last)row.last=when;
  });
  const rows=[...map.values()].sort((a,b)=>(b.last?.getTime()||0)-(a.last?.getTime()||0));
  return{rows,orders,confirmedTotal:orders.filter(o=>o.payment_status==="confirmed").reduce((sum,o)=>sum+netOrderTotal(o),0)};
}

function downloadMonthlyCustomersPdf(){
  const monthValue=$("customerReportMonth")?.value||currentMonthValue();
  const report=monthlyCustomerReport(monthValue);
  const JsPdf=window.jspdf?.jsPDF;
  if(!JsPdf){alert("No se pudo cargar el generador de PDF. Verifica tu conexión e inténtalo nuevamente.");return;}
  const doc=new JsPdf({orientation:"landscape",unit:"mm",format:"a4"});
  const [year,month]=monthValue.split("-").map(Number);
  const monthLabel=new Date(year,month-1,1).toLocaleDateString("es-BO",{month:"long",year:"numeric"});
  doc.setFont("helvetica","bold");doc.setFontSize(18);doc.text("Sweet by Sami - Registro mensual de clientes",14,17);
  doc.setFont("helvetica","normal");doc.setFontSize(10);doc.text(`Periodo: ${monthLabel}`,14,24);
  doc.text(`Clientes: ${report.rows.length}   Pedidos: ${report.orders.length}   Total confirmado: ${fmtMoney(report.confirmedTotal)}`,14,30);
  const body=report.rows.map((row,index)=>[String(index+1),row.name||"-",`+${row.phone}`,String(row.orders),fmtMoney(row.confirmed),row.last?row.last.toLocaleDateString("es-BO"):"-"]);
  if(typeof doc.autoTable==="function"){
    doc.autoTable({startY:36,head:[["#","Cliente","WhatsApp","Pedidos","Total confirmado","Ultimo pedido"]],body:body.length?body:[["-","Sin clientes registrados en este mes","-","-","-","-"]],styles:{font:"helvetica",fontSize:9,cellPadding:3},headStyles:{fillColor:[226,92,138]},columnStyles:{0:{cellWidth:10},2:{cellWidth:38},3:{cellWidth:22},4:{cellWidth:38},5:{cellWidth:32}},margin:{left:14,right:14}});
  }else{
    let y=39;doc.setFontSize(9);(body.length?body:[["-","Sin clientes registrados en este mes","-","-","-","-"]]).forEach(row=>{doc.text(row.join("   |   ").slice(0,150),14,y);y+=6;if(y>190){doc.addPage();y=18;}});
  }
  doc.setFontSize(8);doc.setTextColor(110);doc.text(`Generado desde el panel de Sweet by Sami · ${new Date().toLocaleString("es-BO")}`,14,203);
  doc.save(`sweet-by-sami-clientes-${monthValue}.pdf`);
}

function categoryProducts(categoryId){
  return adminProducts.filter(p=>String(p.category_id)===String(categoryId)).sort((a,b)=>Number(a.sort_order||0)-Number(b.sort_order||0));
}

function categoryOptions(selectedId){
  return adminCategories.map(c=>`<option value="${esc(c.id)}" ${String(c.id)===String(selectedId)?"selected":""}>${esc(c.name)}</option>`).join("");
}

function syncCategory(category,editor){
  category.name=editor.querySelector(".js-category-name").value.trim()||"Nueva categoría";
  category.description=editor.querySelector(".js-category-description").value.trim();
  category.active=editor.querySelector(".js-category-active").checked;
}

async function saveCategoryEditor(category,editor){
  const btn=editor.querySelector(".js-save-category");
  syncCategory(category,editor); btn.disabled=true; btn.textContent="Guardando...";
  try{ await window.SweetStore.saveCategory(category); btn.textContent="Guardado"; setTimeout(()=>{btn.textContent="Guardar categoría";btn.disabled=false;},1100); }
  catch(error){ console.error(error); btn.textContent="Error"; setTimeout(()=>{btn.textContent="Guardar categoría";btn.disabled=false;},1500); }
}

async function moveCategory(index,direction){
  const next=index+direction; if(next<0||next>=adminCategories.length)return;
  const[item]=adminCategories.splice(index,1); adminCategories.splice(next,0,item);
  adminCategories.forEach((c,i)=>c.sort_order=i+1); renderCatalogAdmin();
  try{await Promise.all(adminCategories.map(c=>window.SweetStore.saveCategory(c)));}catch(error){console.error(error);}
}

async function addCategory(){
  const category={id:uid("cat"),name:"Nueva categoría",description:"Agrega una descripción para tus clientes.",active:true,sort_order:adminCategories.length+1};
  adminCategories.push(category); renderCatalogAdmin();
  try{await window.SweetStore.saveCategory(category);}catch(error){console.error(error);alert("No se pudo crear la categoría.");}
}

async function removeCategory(category){
  if(categoryProducts(category.id).length){alert("Esta categoría todavía tiene items. Muévelos o elimínalos antes de borrar la categoría.");return;}
  if(!confirm(`¿Eliminar la categoría “${category.name}”?`))return;
  try{await window.SweetStore.deleteCategory(category.id);adminCategories=adminCategories.filter(c=>String(c.id)!==String(category.id));adminCategories.forEach((c,i)=>c.sort_order=i+1);renderCatalogAdmin();}
  catch(error){console.error(error);alert(error?.message||"No se pudo eliminar la categoría.");}
}

async function addProduct(category){
  const products=categoryProducts(category.id);
  const productId=uid("prod");
  const product={
    id:productId,category_id:category.id,name:"Nuevo item",short_name:"♡",subtitle:"Nueva presentación",description:"Describe aquí este producto.",
    price:0,image_url:"",spoon_color:"#eb7f93",active:true,sort_order:products.length+1,
    variants:[{id:uid(`${productId}-v`),name:"Presentación estándar",description:"Presentación disponible.",image_url:"",active:true,sort_order:1}]
  };
  adminProducts.push(product); renderCatalogAdmin();
  try{await window.SweetStore.saveProduct(product);}catch(error){console.error(error);alert("No se pudo crear el item.");}
}

function renderCatalogAdmin(){
  categoryListEl.innerHTML="";
  const categories=[...adminCategories].sort((a,b)=>Number(a.sort_order||0)-Number(b.sort_order||0));
  if(!categories.length){categoryListEl.innerHTML='<div class="empty-state">No hay categorías. Crea la primera para empezar a organizar el catálogo.</div>';return;}
  categories.forEach((category,categoryIndex)=>{
    const fragment=categoryTemplate.content.cloneNode(true); const editor=fragment.querySelector(".category-editor");
    editor.dataset.categoryId=category.id;
    editor.querySelector(".js-category-name").value=category.name||"";
    editor.querySelector(".js-category-description").value=category.description||"";
    editor.querySelector(".js-category-active").checked=category.active!==false;
    editor.querySelector(".js-save-category").addEventListener("click",()=>saveCategoryEditor(category,editor));
    editor.querySelector(".js-delete-category").addEventListener("click",()=>removeCategory(category));
    editor.querySelector(".js-category-up").addEventListener("click",()=>moveCategory(categoryIndex,-1));
    editor.querySelector(".js-category-down").addEventListener("click",()=>moveCategory(categoryIndex,1));
    editor.querySelector(".js-add-product").addEventListener("click",()=>addProduct(category));
    const productContainer=editor.querySelector(".js-category-products");
    const products=categoryProducts(category.id);
    editor.querySelector(".js-empty-category").classList.toggle("hidden",products.length>0);
    products.forEach(product=>renderProductEditor(product,productContainer));
    categoryListEl.appendChild(fragment);
  });
}

function renderProductEditor(product,container){
  const fragment=productTemplate.content.cloneNode(true); const editor=fragment.querySelector(".product-editor");
  editor.dataset.productId=product.id;
  editor.querySelector(".product-badge").textContent=product.short_name||"♡";
  editor.querySelector(".js-name").value=product.name||"";
  editor.querySelector(".js-subtitle").value=product.subtitle||"";
  editor.querySelector(".js-active").checked=product.active!==false;
  editor.querySelector(".js-price").value=product.price||0;
  editor.querySelector(".js-short-name").value=product.short_name||"";
  editor.querySelector(".js-description").value=product.description||"";
  editor.querySelector(".js-category-select").innerHTML=categoryOptions(product.category_id);
  const productPreview=editor.querySelector(".js-product-photo"); setPreview(productPreview,product.image_url);
  editor.querySelector(".js-product-file").addEventListener("change",async e=>{
    const file=e.target.files?.[0];if(!file)return;productPreview.innerHTML="<span>Subiendo...</span>";
    try{product.image_url=await window.SweetStore.uploadImage(file,`products/${product.id}`);setPreview(productPreview,product.image_url);}catch(error){console.error(error);productPreview.innerHTML="<span>Error</span>";}
  });
  editor.querySelector(".js-add-variant").addEventListener("click",()=>{product.variants=product.variants||[];product.variants.push({id:uid(`${product.id}-v`),name:`Nueva variante ${product.variants.length+1}`,description:"",image_url:"",active:true,sort_order:product.variants.length+1});renderVariants(editor.querySelector(".js-variants-list"),product,editor);});
  editor.querySelector(".js-save-product").addEventListener("click",()=>saveProductEditor(product,editor));
  editor.querySelector(".js-remove-product").addEventListener("click",()=>removeProduct(product));
  renderVariants(editor.querySelector(".js-variants-list"),product,editor); container.appendChild(fragment);
}

function syncEditor(product,editor){
  product.name=editor.querySelector(".js-name").value.trim()||"Producto";
  product.subtitle=editor.querySelector(".js-subtitle").value.trim();
  product.active=editor.querySelector(".js-active").checked;
  product.price=Number(editor.querySelector(".js-price").value||0);
  product.short_name=editor.querySelector(".js-short-name").value.trim();
  product.description=editor.querySelector(".js-description").value.trim();
  product.category_id=editor.querySelector(".js-category-select").value;
}

async function saveProductEditor(product,editor){
  const status=editor.querySelector(".js-save-status"); const oldCategory=product.category_id; syncEditor(product,editor);
  product.variants=(product.variants||[]).map((v,i)=>({...v,sort_order:i+1}));
  const peers=categoryProducts(product.category_id).filter(p=>String(p.id)!==String(product.id)); if(String(oldCategory)!==String(product.category_id))product.sort_order=peers.length+1;
  status.textContent="Guardando...";
  try{await window.SweetStore.saveProduct(product);status.textContent="Cambios guardados";editor.querySelector(".product-badge").textContent=product.short_name||"♡";if(String(oldCategory)!==String(product.category_id))setTimeout(renderCatalogAdmin,450);else setTimeout(()=>status.textContent="",1600);}
  catch(error){console.error(error);status.textContent="Error al guardar";}
}

async function removeProduct(product){
  if(!confirm(`¿Eliminar “${product.name}” y todas sus variantes?`))return;
  try{await window.SweetStore.deleteProduct(product.id);adminProducts=adminProducts.filter(p=>String(p.id)!==String(product.id));renderCatalogAdmin();}
  catch(error){console.error(error);alert("No se pudo eliminar el item.");}
}

function renderVariants(container,product,editor){
  container.innerHTML=""; (product.variants||[]).forEach((variant,index)=>{
    const fragment=variantTemplate.content.cloneNode(true); const row=fragment.querySelector(".variant-row"); const preview=row.querySelector(".js-photo-preview"); setPreview(preview,variant.image_url);
    row.querySelector(".js-variant-name").value=variant.name||""; row.querySelector(".js-variant-description").value=variant.description||""; row.querySelector(".js-variant-active").checked=variant.active!==false;
    row.querySelector(".js-variant-name").addEventListener("input",e=>variant.name=e.target.value); row.querySelector(".js-variant-description").addEventListener("input",e=>variant.description=e.target.value); row.querySelector(".js-variant-active").addEventListener("change",e=>variant.active=e.target.checked);
    row.querySelector(".js-variant-file").addEventListener("change",async e=>{const file=e.target.files?.[0];if(!file)return;preview.innerHTML="<span>Subiendo...</span>";try{variant.image_url=await window.SweetStore.uploadImage(file,`variants/${product.id}/${variant.id}`);setPreview(preview,variant.image_url);}catch(error){console.error(error);preview.innerHTML="<span>Error</span>";}});
    row.querySelector(".js-up").addEventListener("click",()=>moveVariant(product,index,-1,container,editor)); row.querySelector(".js-down").addEventListener("click",()=>moveVariant(product,index,1,container,editor)); row.querySelector(".js-remove-variant").addEventListener("click",()=>{if(!confirm(`¿Eliminar la variante “${variant.name}”?`))return;product.variants.splice(index,1);renderVariants(container,product,editor);}); container.appendChild(fragment);
  });
}
function moveVariant(product,index,direction,container,editor){const newIndex=index+direction;if(newIndex<0||newIndex>=product.variants.length)return;const[item]=product.variants.splice(index,1);product.variants.splice(newIndex,0,item);renderVariants(container,product,editor);}

$("addCategoryBtn").addEventListener("click",addCategory);

let unsubscribeOrderAlerts = null;
let orderPollTimer = null;
let liveRefreshInFlight = false;
let alertsEnabled = true;
let alertAudioContext = null;
let pendingBell = false;
let realtimeStatus = "CONNECTING";
const knownOrderKeys = new Set();

function orderKey(order){
  return String(order?.id || order?.order_code || `${order?.created_at || ""}-${order?.customer_phone || ""}`);
}

function seedKnownOrders(){
  adminOrders.forEach(order => knownOrderKeys.add(orderKey(order)));
}

function getAlertAudioContext(){
  try{
    const Ctx=window.AudioContext||window.webkitAudioContext;
    if(!Ctx) return null;
    if(!alertAudioContext) alertAudioContext=new Ctx();
    return alertAudioContext;
  }catch(error){
    console.warn("audio context",error);
    return null;
  }
}

async function unlockAlertAudio(){
  const ctx=getAlertAudioContext();
  if(!ctx) return false;
  try{
    if(ctx.state==="suspended") await ctx.resume();
    const ready=ctx.state==="running";
    if(ready && pendingBell){
      pendingBell=false;
      scheduleBikeBell(ctx);
    }
    updateAlertStatus();
    return ready;
  }catch(error){
    console.warn("audio unlock",error);
    updateAlertStatus();
    return false;
  }
}

function scheduleBikeBell(ctx){
  if(!ctx || ctx.state!=="running") return;
  const now=ctx.currentTime;
  [0,0.16].forEach((delay,index)=>{
    const gain=ctx.createGain();
    const osc1=ctx.createOscillator();
    const osc2=ctx.createOscillator();
    osc1.type="sine";
    osc2.type="sine";
    osc1.frequency.value=1250+index*70;
    osc2.frequency.value=1870+index*80;
    gain.gain.setValueAtTime(.0001,now+delay);
    gain.gain.exponentialRampToValueAtTime(.24,now+delay+.01);
    gain.gain.exponentialRampToValueAtTime(.0001,now+delay+.85);
    osc1.connect(gain);
    osc2.connect(gain);
    gain.connect(ctx.destination);
    osc1.start(now+delay);
    osc2.start(now+delay);
    osc1.stop(now+delay+.9);
    osc2.stop(now+delay+.9);
  });
}

async function playBikeBell(){
  if(!alertsEnabled) return false;
  const ctx=getAlertAudioContext();
  if(!ctx) return false;
  if(ctx.state!=="running"){
    try{ await ctx.resume(); }catch(error){ console.warn("bell resume",error); }
  }
  if(ctx.state==="running"){
    scheduleBikeBell(ctx);
    updateAlertStatus();
    return true;
  }
  // El navegador todavía no recibió una interacción en ESTA pestaña.
  // Guardamos la alerta y la campana sonará en la primera interacción posterior.
  pendingBell=true;
  updateAlertStatus();
  return false;
}

function updateAlertStatus(){
  const el=$("alertConnectionStatus");
  if(!el) return;
  const audioReady=alertAudioContext?.state==="running";
  const realtimeReady=realtimeStatus==="SUBSCRIBED";
  if(realtimeReady && audioReady){
    el.textContent="🔔 Alertas conectadas · sonido listo";
    el.className="alert-connection-status ready";
  }else if(realtimeReady){
    el.textContent="🔔 Alertas conectadas · toca una vez esta página para habilitar sonido";
    el.className="alert-connection-status waiting";
  }else{
    el.textContent="🔔 Alertas activas · actualización automática cada 3 s";
    el.className="alert-connection-status fallback";
  }
}

function showNewOrderToast(order){
  document.querySelectorAll(".admin-alert-toast").forEach(el=>el.remove());
  const number=displayOrderNumber(order);
  const toast=document.createElement("div"); toast.className="admin-alert-toast";
  toast.innerHTML=`<div class="bell">🔔</div><div><strong>Nuevo pedido ${number?`#${number}`:""}</strong><span>${esc(order.customer_name||"Nuevo cliente")} · ${fmtMoney(order.total||0)}</span></div>`;
  document.body.appendChild(toast); setTimeout(()=>toast.remove(),6500);
}
function adminConfetti(){
  const wrap=document.createElement("div");wrap.className="admin-confetti";const colors=["#ef5f91","#f7c95d","#91d3e8","#f0a5bd"];
  for(let i=0;i<100;i++){const x=document.createElement("i");x.style.left=`${Math.random()*100}%`;x.style.background=colors[i%colors.length];x.style.setProperty("--drift",`${(Math.random()-.5)*260}px`);x.style.animationDelay=`${Math.random()*.6}s`;wrap.appendChild(x);}document.body.appendChild(wrap);setTimeout(()=>wrap.remove(),4200);
}

async function notifyNewOrder(order, source="realtime"){
  const key=orderKey(order);
  if(!key || knownOrderKeys.has(key)) return false;
  knownOrderKeys.add(key);
  console.log(`[Sweet by Sami] Nuevo pedido detectado por ${source}:`, order);
  await playBikeBell();
  showNewOrderToast(order);
  const number=displayOrderNumber(order);
  if(Number(number)===Number(adminSettings?.milestone_target||1000)) adminConfetti();
  return true;
}

// Actualiza los datos visibles del panel sin recargar el navegador completo.
// Así un pedido nuevo aparece solo en Pedidos/Resumen y no se pierde la sección
// que la administradora esté mirando.
async function refreshLiveOrders({refreshCustomers=false, source="actualización automática"}={}){
  if(liveRefreshInFlight) return;
  liveRefreshInFlight=true;
  try{
    const latest=await window.SweetStore.getAdminOrders();
    const unseen=latest.filter(order=>!knownOrderKeys.has(orderKey(order))).reverse();

    // La lista se reemplaza SIEMPRE, aunque Realtime no haya avisado.
    // Esto hace que el panel se mantenga sincronizado sin F5.
    adminOrders=latest;
    renderOrders();
    renderDashboard();

    for(const order of unseen) await notifyNewOrder(order,source);

    // Un pedido nuevo también puede crear/actualizar un cliente, por eso
    // refrescamos clientes cuando detectamos novedades o lo pide Realtime.
    if(refreshCustomers || unseen.length){
      try{
        adminCustomers=await window.SweetStore.getAdminCustomers();
        renderCustomers();
        renderDashboard();
      }catch(error){
        console.warn("[Sweet by Sami] No se pudieron refrescar clientes:",error);
      }
    }
  }catch(error){
    console.warn("[Sweet by Sami] No se pudo actualizar pedidos automáticamente:",error);
  }finally{
    liveRefreshInFlight=false;
  }
}

async function handleRealtimeOrder(order){
  // Realtime da el aviso instantáneo y acto seguido volvemos a consultar el
  // pedido completo (incluyendo sus items) para pintarlo en el panel.
  await notifyNewOrder(order,"Supabase Realtime");
  await refreshLiveOrders({refreshCustomers:true,source:"Supabase Realtime"});
}

async function pollForNewOrders(){
  if(window.SweetStore.mode!=="supabase") return;
  await refreshLiveOrders({source:"respaldo automático"});
}

function startRealtimeAlerts(){
  seedKnownOrders();
  if(!unsubscribeOrderAlerts){
    unsubscribeOrderAlerts=window.SweetStore.subscribeToNewOrders?.(
      handleRealtimeOrder,
      status=>{
        realtimeStatus=status;
        console.log("[Sweet by Sami] Realtime:",status);
        updateAlertStatus();
      }
    ) || null;
  }
  if(!orderPollTimer){
    // Respaldo: aunque Supabase Realtime se corte, el panel se sincroniza solo.
    orderPollTimer=setInterval(pollForNewOrders,3000);
    setTimeout(pollForNewOrders,900);
  }
  updateAlertStatus();
}

// Si el teléfono/PC vuelve a la pestaña después de estar en segundo plano,
// sincronizamos de inmediato en vez de esperar al siguiente intervalo.
window.addEventListener("focus",()=>refreshLiveOrders({refreshCustomers:true,source:"al volver al panel"}));
document.addEventListener("visibilitychange",()=>{
  if(!document.hidden) refreshLiveOrders({refreshCustomers:true,source:"al volver al panel"});
});

// No hay botón de “activar alertas”. El audio se desbloquea con cualquier
// interacción normal dentro del panel (login, clic, toque o tecla).
// Esto respeta la política de audio del navegador sin añadir pasos al flujo.
function installAutomaticAudioUnlock(){
  const events=["click","pointerup","touchend","keydown","mousedown","mouseup"];
  const unlock=async()=>{
    const ok=await unlockAlertAudio();
    if(ok) events.forEach(name=>document.removeEventListener(name,unlock,true));
  };
  events.forEach(name=>document.addEventListener(name,unlock,true));
}
installAutomaticAudioUnlock();

function readableSupabaseError(error){
  if(!error) return "Error desconocido";
  return [error.message,error.details,error.hint,error.code].filter(Boolean).join(" · ");
}

async function loadAll(){
  const tasks = [
    ["categorías", window.SweetStore.getAllCategoriesAdmin()],
    ["productos", window.SweetStore.getAllProductsAdmin()],
    ["pedidos", window.SweetStore.getAdminOrders()],
    ["clientes", window.SweetStore.getAdminCustomers()],
    ["configuración", window.SweetStore.getSettings()]
  ];

  const results = await Promise.allSettled(tasks.map(([,promise])=>promise));
  const failures = [];

  results.forEach((result,index)=>{
    const name = tasks[index][0];
    if(result.status === "fulfilled"){
      if(index===0) adminCategories = result.value;
      if(index===1) adminProducts = result.value;
      if(index===2) adminOrders = result.value;
      if(index===3) adminCustomers = result.value;
      if(index===4) adminSettings = result.value;
    } else {
      console.error(`[Sweet by Sami] Error cargando ${name}:`, result.reason);
      failures.push(`${name}: ${readableSupabaseError(result.reason)}`);
    }
  });

  renderDashboard();
  renderOrders();
  renderCustomers();
  renderSettings();
  renderCatalogAdmin();

  if(failures.length){
    const diagnostic = await window.SweetStore.diagnoseAdminAccess?.();
    const extra = diagnostic && !diagnostic.ok
      ? `\n\nDiagnóstico: falló "${diagnostic.step}". ${readableSupabaseError(diagnostic.error)}`
      : "";
    alert(`El panel cargó parcialmente.\n\n${failures.join("\n")} ${extra}\n\nSi acabas de ejecutar el SQL, recarga la página después de correr el archivo SQL de actualización V20.`);
  }
}

$("orderSearch").addEventListener("input",renderOrders); $("paymentFilter").addEventListener("change",renderOrders); $("fulfillmentFilter")?.addEventListener("change",renderOrders); $("customerSearch").addEventListener("input",renderCustomers); $("refreshBtn").addEventListener("click",loadAll);
["customerDateFrom","customerDateTo","customerOrdersMin","customerOrdersMax"].forEach(id=>$(id)?.addEventListener("input",renderCustomers));
$("clearCustomerFiltersBtn")?.addEventListener("click",()=>{["customerDateFrom","customerDateTo","customerOrdersMin","customerOrdersMax"].forEach(id=>{if($(id))$(id).value="";});$("customerSearch").value="";renderCustomers();});
if($("customerReportMonth"))$("customerReportMonth").value=currentMonthValue();
$("downloadCustomersPdfBtn")?.addEventListener("click",downloadMonthlyCustomersPdf);
$("resetDemoBtn").addEventListener("click",()=>{if(window.SweetStore.mode!=="demo")return;if(!confirm("¿Restaurar los datos demo? Se borrarán pedidos, clientes, QR y cambios del catálogo de este navegador."))return;window.SweetStore.resetDemo();location.reload();});
$("logoutBtn").addEventListener("click",async()=>{await window.SweetStore.signOutAdmin();location.reload();});

async function setupAuth(){
  setMode();
  if(window.SweetStore.mode==="demo"){ $("adminLogin").classList.add("hidden"); $("adminApp").classList.remove("hidden"); await loadAll(); startRealtimeAlerts(); return; }
  const session=await window.SweetStore.getSession();
  if(session){$("adminLogin").classList.add("hidden");$("adminApp").classList.remove("hidden");await loadAll();startRealtimeAlerts();}
  else{$("adminApp").classList.add("hidden");$("adminLogin").classList.remove("hidden");}
}
$("adminLoginForm").addEventListener("submit",async e=>{e.preventDefault();$("loginError").textContent="";await unlockAlertAudio();try{await window.SweetStore.signInAdmin($("adminEmail").value.trim(),$("adminPassword").value);$("adminLogin").classList.add("hidden");$("adminApp").classList.remove("hidden");await loadAll();startRealtimeAlerts();}catch(error){console.error(error);$("loginError").textContent="Correo o contraseña incorrectos.";}});

setupAuth();
