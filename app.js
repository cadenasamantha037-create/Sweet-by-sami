const state = {
  categories: [],
  products: [],
  settings: null,
  activeProduct: null,
  activeVariant: null,
  cart: [],
  receiptFile: null,
  cashEligible: null,
  tracking: null,
  trackingTimer: null
};

const $ = id => document.getElementById(id);
const productGrid = $("productGrid");
const modal = $("productModal");
const modalImage = $("modalImage");
const modalPlaceholder = $("modalPlaceholder");
const variantPills = $("variantPills");
const cartDrawer = $("cartDrawer");
const drawerOverlay = $("drawerOverlay");
const checkoutModal = $("checkoutModal");
const statusModal = $("statusModal");
const LAST_ORDER_KEY = "sweet_by_sami_last_order_v2";

const formatMoney = value => `${window.SWEET_CONFIG.currency || "Bs."} ${Number(value || 0).toFixed(0)}`;
const escapeHtml = value => String(value ?? "").replace(/[&<>'"]/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'"':"&quot;"}[c]));
const cartTotalValue = () => state.cart.reduce((sum, item) => sum + Number(item.price) * Number(item.quantity || 1), 0);
const PROVINCIAL_SHIPPING_FEE = 20;
const PROVINCIAL_DESTINATIONS = ["Ivirgarzama", "Eterazama", "Mariposas"];
const isCochabambaProvincialOrder = () => {
  const fulfillment = document.querySelector('input[name="fulfillment"]:checked')?.value;
  const department = $("shippingDepartment")?.value?.trim() || "";
  const province = $("shippingProvince")?.value?.trim() || "";
  return fulfillment === "national" && department === "Cochabamba" && PROVINCIAL_DESTINATIONS.includes(province);
};
const provincialShippingFeeValue = () => isCochabambaProvincialOrder() ? PROVINCIAL_SHIPPING_FEE : 0;
const orderTotalValue = () => cartTotalValue() + provincialShippingFeeValue();

function spoonIllustration(product) {
  return `<div class="spoon-illustration" style="--spoon-color:${escapeHtml(product.spoon_color || '#e77b86')}">
    <div class="spoon-handle">${escapeHtml(product.short_name || "")}</div><div class="spoon-bowl"></div><div class="pearls"></div></div>`;
}

function genericProductIllustration(product) {
  return `<div class="generic-product-illustration"><span>${escapeHtml(product.short_name || "♡")}</span><i></i><b>Sweet by Sami</b></div>`;
}

function megaBoxIllustration() {
  return `<div class="mega-box-illustration" aria-hidden="true">
    <div class="mega-box-lid"><span></span></div>
    <div class="mega-box-body"><b>Sweet</b><small>by Sami</small></div>
    <div class="mega-box-bow"><i></i><i></i><span>♡</span></div>
    <div class="mega-pearl mp1"></div><div class="mega-pearl mp2"></div><div class="mega-pearl mp3"></div><div class="mega-pearl mp4"></div>
  </div>`;
}

function productArtwork(product) {
  const isSpoon = String(product.category_id) === "spoons" || /^(?:cuchara|scoop)\b/i.test(product.name || "");
  const isMega = String(product.id) === "mega-box" || /mega\s*caja/i.test(product.name || "");
  if (product.image_url) return `<img src="${escapeHtml(product.image_url)}" alt="${escapeHtml(product.name)}">`;
  if (isSpoon) return spoonIllustration(product);
  if (isMega) return `<img src="assets/mega-caja.png" alt="Mega Caja Sweet by Sami">`;
  return genericProductIllustration(product);
}

function productCard(product) {
  const megaClass = String(product.id) === "mega-box" || /mega\s*caja/i.test(product.name || "") ? " mega-card" : "";
  const spoonClass = String(product.category_id) === "spoons" || /^(?:cuchara|scoop)\b/i.test(product.name || "") ? " spoon-card-v8" : "";
  return `<article class="product-card${megaClass}${spoonClass}" data-product-id="${escapeHtml(product.id)}" tabindex="0" role="button" aria-label="Ver ${escapeHtml(product.name)}">
      <div class="product-image">${productArtwork(product)}</div>
      <div class="product-card-body">
        <div class="product-topline"><h3>${escapeHtml(product.name)}</h3><span class="product-price">${formatMoney(product.price)}</span></div>
        <p>${escapeHtml(product.description || "")}</p>
        <div class="product-link"><span>Ver presentaciones</span><span>→</span></div>
      </div>
    </article>`;
}

function renderProducts() {
  const categories = [...state.categories].sort((a,b)=>(a.sort_order||0)-(b.sort_order||0));
  const html = categories.map((category,index) => {
    const products = state.products.filter(p => String(p.category_id) === String(category.id)).sort((a,b)=>(a.sort_order||0)-(b.sort_order||0));
    if (!products.length) return "";
    return `<section class="catalog-category" id="category-${escapeHtml(category.id)}">
      <div class="category-public-head">
        <div><span class="category-count">${String(index+1).padStart(2,"0")}</span><span class="eyebrow">Categoría</span><h3>${escapeHtml(category.name)}</h3></div>
        <p>${escapeHtml(category.description || "")}</p>
      </div>
      <div class="product-grid">${products.map(productCard).join("")}</div>
    </section>`;
  }).join("");

  productGrid.innerHTML = html || `<div class="catalog-empty">El catálogo todavía no tiene productos visibles.</div>`;
  productGrid.querySelectorAll(".product-card").forEach(card => {
    const open = () => openProduct(card.dataset.productId);
    card.addEventListener("click", open);
    card.addEventListener("keydown", event => {
      if (event.key === "Enter" || event.key === " ") { event.preventDefault(); open(); }
    });
  });
}
function openProduct(productId) {
  const product = state.products.find(p => String(p.id) === String(productId));
  if (!product) return;
  state.activeProduct = product;
  const variants = (product.variants || []).filter(v => v.active !== false).sort((a,b) => (a.sort_order || 0) - (b.sort_order || 0));
  state.activeVariant = variants[0] || null;

  $("modalEyebrow").textContent = product.subtitle || "Tu elección";
  $("modalTitle").textContent = product.name;
  $("modalSubtitle").textContent = product.description || "";
  $("modalPrice").textContent = formatMoney(product.price);
  const category = state.categories.find(c => String(c.id) === String(product.category_id));
  const spoonProduct = String(product.category_id) === "spoons" || /^(?:cuchara|scoop)\b/i.test(product.name || "");
  $("modalReferenceCopy").textContent = spoonProduct
    ? "Cada perlita representa una golosina. Las fotos y el contenido mostrado son referenciales; tu cajita final dependerá de las perlitas obtenidas."
    : `Las fotografías de ${category?.name || "este producto"} son referenciales. Revisa la presentación seleccionada antes de agregarla al pedido.`;
  $("variantHelp").textContent = variants.length === 1 ? "1 opción disponible" : `${variants.length} opciones disponibles`;

  variantPills.innerHTML = variants.length
    ? variants.map((variant, index) => `<button type="button" class="variant-pill ${index === 0 ? "active" : ""}" data-variant-id="${escapeHtml(variant.id)}">${escapeHtml(variant.name)}</button>`).join("")
    : `<span style="color:#7c6763;font-size:13px">No hay presentaciones activas.</span>`;

  variantPills.querySelectorAll(".variant-pill").forEach(button => button.addEventListener("click", () => selectVariant(button.dataset.variantId)));
  updateSelectedVariant();
  modal.classList.add("open");
  modal.setAttribute("aria-hidden", "false");
  document.body.classList.add("locked");
}

function selectVariant(variantId) {
  const variant = (state.activeProduct?.variants || []).find(v => String(v.id) === String(variantId));
  if (!variant) return;
  state.activeVariant = variant;
  variantPills.querySelectorAll(".variant-pill").forEach(btn => btn.classList.toggle("active", btn.dataset.variantId === String(variantId)));
  updateSelectedVariant();
}

function updateSelectedVariant() {
  const variant = state.activeVariant;
  $("selectedVariantName").textContent = variant ? variant.name : "Sin presentación";
  $("selectedVariantDescription").textContent = variant ? (variant.description || "") : "Este producto todavía no tiene una presentación activa.";
  const isMegaProduct = String(state.activeProduct?.id) === "mega-box" || /mega\s*caja/i.test(state.activeProduct?.name || "");
  const imageUrl = variant?.image_url || state.activeProduct?.image_url || (isMegaProduct ? "assets/mega-caja.png" : "");
  if (imageUrl) {
    modalImage.src = imageUrl;
    modalImage.alt = `${state.activeProduct.name} - ${variant?.name || "presentación"}`;
    modalImage.classList.add("visible");
    modalPlaceholder.style.display = "none";
  } else {
    modalImage.classList.remove("visible");
    modalImage.removeAttribute("src");
    modalPlaceholder.style.display = "block";
  }
  $("addToCartBtn").disabled = !variant;
}

function closeProduct() {
  modal.classList.remove("open");
  modal.setAttribute("aria-hidden", "true");
  if (!cartDrawer.classList.contains("open")) document.body.classList.remove("locked");
}

function addToCart() {
  if (!state.activeProduct || !state.activeVariant) return;
  const existing = state.cart.find(item => item.productId === state.activeProduct.id && item.variantId === state.activeVariant.id);
  if (existing) existing.quantity += 1;
  else state.cart.push({
    key: `${state.activeProduct.id}-${state.activeVariant.id}`,
    productId: state.activeProduct.id,
    name: state.activeProduct.name,
    shortName: state.activeProduct.short_name,
    variantId: state.activeVariant.id,
    variantName: state.activeVariant.name,
    price: Number(state.activeProduct.price),
    quantity: 1
  });
  closeProduct(); renderCart(); openCart();
}

function renderCart() {
  const count = state.cart.reduce((sum, item) => sum + item.quantity, 0);
  $("cartCount").textContent = count;
  $("cartTotal").textContent = formatMoney(cartTotalValue());
  $("cartEmpty").style.display = state.cart.length ? "none" : "grid";
  $("cartItems").style.display = state.cart.length ? "block" : "none";
  $("startCheckoutBtn").disabled = !state.cart.length;
  $("cartItems").innerHTML = state.cart.map(item => `
    <div class="cart-item cart-item-v32" data-cart-key="${escapeHtml(item.key)}">
      <div class="cart-thumb">${escapeHtml(item.shortName || "♡")}</div>
      <div class="cart-info cart-info-v32">
        <strong class="cart-item-title">${escapeHtml(item.name)}</strong>
        <span class="cart-item-meta">${escapeHtml(item.variantName)} · ${formatMoney(item.price)} c/u</span>
      </div>
      <div class="cart-item-controls-v32">
        <div class="cart-qty-controls cart-qty-controls-v32" aria-label="Cantidad de ${escapeHtml(item.name)}">
          <button type="button" data-cart-action="decrease" data-cart-key="${escapeHtml(item.key)}" aria-label="Quitar una unidad">−</button>
          <span class="cart-qty-value-v32" aria-live="polite">${item.quantity}</span>
          <button type="button" data-cart-action="increase" data-cart-key="${escapeHtml(item.key)}" aria-label="Añadir una unidad">+</button>
        </div>
        <strong class="cart-line-total-v32">${formatMoney(item.price * item.quantity)}</strong>
        <button class="cart-remove-button cart-remove-v32" type="button" data-cart-action="remove" data-cart-key="${escapeHtml(item.key)}">Eliminar</button>
      </div>
    </div>`).join("");

  $("cartItems").querySelectorAll("[data-cart-action]").forEach(button => button.addEventListener("click", () => {
    const item = state.cart.find(entry => entry.key === button.dataset.cartKey);
    if (!item) return;
    const action = button.dataset.cartAction;
    if (action === "increase") item.quantity += 1;
    if (action === "decrease") item.quantity -= 1;
    if (action === "remove" || item.quantity <= 0) state.cart = state.cart.filter(entry => entry.key !== item.key);
    renderCart();
  }));
}

function openCart() {
  cartDrawer.classList.add("open"); drawerOverlay.classList.add("open"); cartDrawer.setAttribute("aria-hidden", "false"); document.body.classList.add("locked");
}
function closeCart() {
  cartDrawer.classList.remove("open"); drawerOverlay.classList.remove("open"); cartDrawer.setAttribute("aria-hidden", "true"); document.body.classList.remove("locked");
}

function renderCheckoutSummary() {
  const productsTotal = cartTotalValue();
  const shippingFee = provincialShippingFeeValue();
  const total = productsTotal + shippingFee;
  $("checkoutTotal").textContent = formatMoney(productsTotal);
  $("checkoutGrandTotal").textContent = formatMoney(total);
  $("checkoutItems").innerHTML = state.cart.map(item => `<div class="checkout-item"><span>${escapeHtml(item.name)} · ${escapeHtml(item.variantName)} × ${item.quantity}</span><strong>${formatMoney(item.price * item.quantity)}</strong></div>`).join("");
  ["provincialShippingPaymentRow", "provincialShippingSummaryRow"].forEach(id => {
    const el = $(id);
    if (el) el.classList.toggle("hidden", shippingFee <= 0);
  });
}

function applySettings() {
  const s = state.settings || {};
  $("pickupAddressText").textContent = s.pickup_address || "Sweet by Sami · Cochabamba";
  if ($("deliveryPickupAddressText")) $("deliveryPickupAddressText").textContent = s.pickup_address || "Sweet by Sami · Cochabamba";
  $("paymentInstructions").textContent = s.payment_instructions || "Escanea el QR, realiza el pago y luego adjunta una captura del comprobante.";
  const pickupUrl = s.pickup_map_url || "https://maps.app.goo.gl/FsLshw8DKRAXytGF9";
  const danaeUrl = s.danae_map_url || "https://maps.app.goo.gl/YHXgj9gWhiJ3pkgH7?g_st=awb";
  ["pickupMapLink","deliveryPickupMapLink"].forEach(id => { const el=$(id); if(el) el.href=pickupUrl; });
  if ($("danaeMapLink")) $("danaeMapLink").href = danaeUrl;
  if ($("danaeLocationText")) $("danaeLocationText").textContent = s.danae_location_name || "Paquetería DANAE · 1er piso · local 20";
  const renderSchedule = (id, value, fallback) => {
    const el=$(id); if(!el) return;
    const parts=String(value||fallback).split("·").map(x=>x.trim()).filter(Boolean);
    el.innerHTML=parts.map(x=>`<span>${escapeHtml(x)}</span>`).join("");
  };
  renderSchedule("pickupHoursDisplay",s.pickup_hours,"7:30 a 9:00 am · 2:00 a 3:00 pm");
  renderSchedule("deliveryPickupHoursDisplay",s.pickup_hours,"7:30 a 9:00 am · 2:00 a 3:00 pm");
  renderSchedule("danaeHoursDisplay",s.danae_hours,"Lunes a viernes · 8:00 am a 8:30 pm");
  const p1=String(s.coordination_phone_1||"59172947659").replace(/\D/g,"");
  const p2=String(s.coordination_phone_2||"59164329209").replace(/\D/g,"");
  const setWa=(id,phone,message)=>{const el=$(id);if(!el)return;el.href=`https://wa.me/${phone}?text=${encodeURIComponent(message)}`;el.textContent=`WhatsApp ${phone.startsWith("591")?phone.slice(3):phone}`;};
  setWa("pickupCoord1",p1,"Hola Sweet by Sami, quisiera coordinar otro horario para recoger mi pedido.");
  setWa("pickupCoord2",p2,"Hola Sweet by Sami, quisiera coordinar otro horario para recoger mi pedido.");
  setWa("deliveryCoord1",p1,"Hola Sweet by Sami, quiero coordinar el horario para que mi delivery recoja el pedido.");
  setWa("deliveryCoord2",p2,"Hola Sweet by Sami, quiero coordinar el horario para que mi delivery recoja el pedido.");
  if (s.payment_qr_url) {
    $("paymentQrImage").src = s.payment_qr_url;
    $("paymentQrImage").classList.add("visible");
    $("qrPlaceholder").classList.add("hidden");
    if ($("downloadQrBtn")) $("downloadQrBtn").disabled = false;
  } else {
    $("paymentQrImage").classList.remove("visible");
    $("qrPlaceholder").classList.remove("hidden");
    if ($("downloadQrBtn")) $("downloadQrBtn").disabled = true;
  }
}

function resetCheckoutView() {
  $("checkoutForm").classList.remove("hidden");
  $("orderSuccess").classList.add("hidden");
  $("checkoutError").classList.add("hidden");
  $("checkoutError").textContent = "";
  state.receiptFile = null;
  state.cashEligible = null;
  $("paymentReceipt").value = "";
  $("paymentReceipt").required = true;
  $("receiptPreview").classList.add("hidden");
  $("receiptDrop").classList.remove("hidden");
  const cashRadio = $("cashPaymentRadio");
  if (cashRadio) { cashRadio.disabled = true; cashRadio.checked = false; }
  const qrRadio = document.querySelector('input[name="paymentMethod"][value="qr"]');
  if (qrRadio) qrRadio.checked = true;
  if ($("cashEligibilityText")) $("cashEligibilityText").textContent = "Escribe tu número para verificar si está disponible.";
  updatePaymentMethod();
}

function openCheckout() {
  if (!state.cart.length) return;
  closeCart(); resetCheckoutView(); renderCheckoutSummary(); applySettings(); updateFulfillmentFields(); updatePreparationFields();
  checkoutModal.classList.add("open"); checkoutModal.setAttribute("aria-hidden", "false"); document.body.classList.add("locked");
}
function closeCheckout() {
  checkoutModal.classList.remove("open"); checkoutModal.setAttribute("aria-hidden", "true"); document.body.classList.remove("locked");
}

function updateNationalDestinationFields() {
  const isNational = document.querySelector('input[name="fulfillment"]:checked')?.value === "national";
  const department = $("shippingDepartment")?.value?.trim() || "";
  const isCochabamba = isNational && department === "Cochabamba";
  const provinceWrap = $("shippingProvinceWrap");
  const province = $("shippingProvince");
  if (provinceWrap) provinceWrap.classList.toggle("hidden", !isCochabamba);
  if (province) {
    province.required = isCochabamba;
    province.disabled = !isCochabamba;
    if (!isCochabamba) province.value = "";
  }
  renderCheckoutSummary();
  updateCashWhatsappButton();
}

function updateFulfillmentFields() {
  const selected = document.querySelector('input[name="fulfillment"]:checked')?.value || "pickup";
  $("pickupFields").classList.toggle("hidden", selected !== "pickup");
  $("deliveryFields").classList.toggle("hidden", selected !== "customer_delivery");
  $("nationalFields").classList.toggle("hidden", selected !== "national");
  $("danaeFields").classList.toggle("hidden", selected !== "danae");
  $("shippingDepartment").required = selected === "national";
  $("shippingAddress").required = selected === "national";
  $("shippingRecipientName").required = selected === "national";
  $("shippingRecipientPhone").required = selected === "national";
  $("shippingRecipientCi").required = selected === "national";

  if (selected === "national") {
    const recipientName = $("shippingRecipientName");
    const recipientPhone = $("shippingRecipientPhone");
    if (recipientName && !recipientName.value.trim() && $("customerName")?.value?.trim()) recipientName.value = $("customerName").value.trim();
    if (recipientPhone && !recipientPhone.value.trim() && $("customerPhone")?.value?.trim()) recipientPhone.value = normalizeLocalPhoneInput();
  }
  updateNationalDestinationFields();
}

function updatePreparationFields() {
  const selected = document.querySelector('input[name="preparationMode"]:checked')?.value || "live";
  const panel = $("liveCommunityPanel");
  if (panel) panel.classList.toggle("hidden", selected !== "live");
}

function previewReceipt(file) {
  if (!file) return;
  state.receiptFile = file;
  const reader = new FileReader();
  reader.onload = () => { $("receiptPreviewImg").src = reader.result; $("receiptPreview").classList.remove("hidden"); $("receiptDrop").classList.add("hidden"); };
  reader.readAsDataURL(file);
}

function normalizeLocalPhoneInput() {
  const input = $("customerPhone");
  const local = String(input?.value || "").replace(/\D/g, "").slice(0, 8);
  if (input && input.value !== local) input.value = local;
  return local;
}

function fullBoliviaPhone() {
  const local = normalizeLocalPhoneInput();
  return local.length === 8 ? `591${local}` : local;
}

function normalizeNationalRecipientPhoneInput() {
  const input = $("shippingRecipientPhone");
  const local = String(input?.value || "").replace(/\D/g, "").slice(0, 8);
  if (input && input.value !== local) input.value = local;
  return local;
}

function fullNationalRecipientPhone() {
  const local = normalizeNationalRecipientPhoneInput();
  return local.length === 8 ? `591${local}` : local;
}

function buildOrderPayload() {
  const fulfillment = document.querySelector('input[name="fulfillment"]:checked')?.value || "pickup";
  const preparationMode = document.querySelector('input[name="preparationMode"]:checked')?.value || "live";
  const paymentMethod = document.querySelector('input[name="paymentMethod"]:checked')?.value || "qr";
  let department = ""; let province = ""; let city = ""; let address = ""; let reference = "";
  if (fulfillment === "pickup") address = state.settings?.pickup_address || "Sweet by Sami · Cochabamba";
  if (fulfillment === "customer_delivery") { city = "Cochabamba"; address = state.settings?.pickup_address || "Sweet by Sami · Cochabamba"; reference = $("deliveryReference").value.trim(); }
  if (fulfillment === "national") { department = $("shippingDepartment").value.trim(); province = department === "Cochabamba" ? $("shippingProvince").value.trim() : ""; city = ""; address = $("shippingAddress").value.trim(); }
  if (fulfillment === "danae") { city = "Cochabamba"; address = state.settings?.danae_location_name || "Paquetería DANAE · 1er piso · local 20"; }
  return {
    customer_name: $("customerName").value.trim(),
    customer_phone: fullBoliviaPhone(),
    fulfillment_method: fulfillment,
    preparation_mode: preparationMode,
    payment_method: paymentMethod,
    department, shipping_province: province, city, address, reference,
    shipping_recipient_name: fulfillment === "national" ? $("shippingRecipientName").value.trim() : "",
    shipping_recipient_phone: fulfillment === "national" ? fullNationalRecipientPhone() : "",
    shipping_recipient_ci: fulfillment === "national" ? $("shippingRecipientCi").value.trim() : "",
    shipping_fee: provincialShippingFeeValue(),
    items: state.cart.map(item => ({ product_id:item.productId, product_name:item.name, variant_id:item.variantId, variant_name:item.variantName, quantity:item.quantity, unit_price:item.price }))
  };
}

async function downloadPaymentQr() {
  const button = $("downloadQrBtn");
  const src = state.settings?.payment_qr_url || $("paymentQrImage")?.getAttribute("src") || "";
  if (!src) return;
  const old = button?.textContent;
  if (button) { button.disabled = true; button.textContent = "Preparando descarga..."; }
  try {
    const response = await fetch(src);
    if (!response.ok) throw new Error("No se pudo descargar el QR");
    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = "QR-Sweet-by-Sami.png"; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1200);
  } catch (error) {
    console.warn("Descarga QR", error);
    const a = document.createElement("a"); a.href = src; a.target = "_blank"; a.rel = "noopener"; a.download = "QR-Sweet-by-Sami.png"; document.body.appendChild(a); a.click(); a.remove();
  } finally {
    if (button) { button.disabled = false; button.textContent = old || "Descargar QR de pago"; }
  }
}

function cashWhatsappMessage(orderCode = "") {
  const name = $("customerName")?.value?.trim() || "";
  const phone = fullBoliviaPhone();
  const lines = state.cart.map(item => `• ${item.name} · ${item.variantName} × ${item.quantity} — ${formatMoney(item.price * item.quantity)}`);
  const shippingFee = provincialShippingFeeValue();
  const total = formatMoney(orderTotalValue());
  return [
    "Hola Sweet by Sami, quiero pagar mi pedido en efectivo.",
    orderCode ? `Pedido: ${orderCode}` : "",
    name ? `Nombre: ${name}` : "",
    phone?.length === 11 ? `WhatsApp: +${phone}` : "",
    "",
    "Mi pedido:",
    ...lines,
    shippingFee ? `• Adelanto de envío provincial — ${formatMoney(shippingFee)}` : "",
    `Total: ${total}`
  ].filter(Boolean).join("\n");
}

function updateCashWhatsappButton(orderCode = "") {
  const btn = $("cashWhatsappBtn");
  if (!btn) return;
  btn.href = whatsappUrl(cashWhatsappMessage(orderCode));
}

let cashCheckTimer = null;
async function refreshCashEligibility() {
  const local = normalizeLocalPhoneInput();
  const radio = $("cashPaymentRadio");
  const text = $("cashEligibilityText");
  const help = $("cashEligibilityWhatsapp");
  if (!radio || !text) return;
  if (help) help.classList.add("hidden");
  radio.disabled = true;
  state.cashEligible = null;
  if (local.length !== 8) {
    text.textContent = "Escribe los 8 dígitos de tu celular para verificar.";
    if (radio.checked) document.querySelector('input[name="paymentMethod"][value="qr"]').checked = true;
    updatePaymentMethod();
    return;
  }
  text.textContent = "Verificando si es tu primer pedido…";
  try {
    const eligible = await window.SweetStore.checkCashEligibility(`591${local}`);
    state.cashEligible = Boolean(eligible);
    radio.disabled = !eligible;
    text.textContent = eligible ? "Disponible: el pago en efectivo puede usarse en tu primera compra." : "No disponible: el efectivo es únicamente para el primer pedido.";
    if (!eligible && radio.checked) document.querySelector('input[name="paymentMethod"][value="qr"]').checked = true;
    updateCashWhatsappButton();
    updatePaymentMethod();
  } catch (error) {
    console.error("cash eligibility", error);
    text.textContent = "No pudimos validar automáticamente si es tu primera compra.";
    radio.disabled = true;
    updateCashWhatsappButton();
    if (help) { help.href = whatsappUrl(cashWhatsappMessage()); help.classList.remove("hidden"); }
  }
}
function scheduleCashEligibilityCheck() { clearTimeout(cashCheckTimer); cashCheckTimer = setTimeout(refreshCashEligibility, 350); }

function updatePaymentMethod() {
  const method = document.querySelector('input[name="paymentMethod"]:checked')?.value || "qr";
  const qr = method === "qr";
  $("qrPaymentPanel").classList.toggle("hidden", !qr);
  $("cashPaymentPanel").classList.toggle("hidden", qr);
  $("paymentReceipt").required = qr;
  $("submitOrderBtn").textContent = qr ? "Enviar pedido y comprobante" : "Registrar pedido en efectivo";
  updateCashWhatsappButton();
}

function celebrateMilestone(number) {
  if (Number(number) !== Number(state.settings?.milestone_target || 1000)) return;
  const wrap = document.createElement("div"); wrap.className = "sweet-confetti";
  const colors = ["#ed5f91","#f5c757","#91d2e9","#f2a7bd","#ffffff"];
  for (let i=0;i<90;i++) {
    const piece=document.createElement("i"); piece.style.left=`${Math.random()*100}%`; piece.style.background=colors[i%colors.length]; piece.style.setProperty("--drift",`${(Math.random()-.5)*240}px`); piece.style.animationDelay=`${Math.random()*.7}s`; wrap.appendChild(piece);
  }
  document.body.appendChild(wrap); setTimeout(()=>wrap.remove(),4200);
}

function whatsappUrl(message = "") {
  const phone = String(window.SWEET_CONFIG.whatsappNumber || "").replace(/\D/g, "");
  return `https://wa.me/${phone}${message ? `?text=${encodeURIComponent(message)}` : ""}`;
}

async function submitOrder(event) {
  event.preventDefault();
  const errorEl = $("checkoutError");
  errorEl.classList.add("hidden");
  const payload = buildOrderPayload();
  const localPhone = normalizeLocalPhoneInput();
  if (localPhone.length !== 8) { errorEl.textContent = "Escribe los 8 dígitos de tu número de WhatsApp."; errorEl.classList.remove("hidden"); return; }
  if (payload.fulfillment_method === "national") {
    if (payload.shipping_recipient_name.length < 3) { errorEl.textContent = "Escribe el nombre completo de la persona que recibirá el envío."; errorEl.classList.remove("hidden"); return; }
    if (normalizeNationalRecipientPhoneInput().length !== 8) { errorEl.textContent = "Escribe los 8 dígitos del celular del destinatario."; errorEl.classList.remove("hidden"); return; }
    if (payload.shipping_recipient_ci.length < 4) { errorEl.textContent = "Escribe el número de carnet del destinatario."; errorEl.classList.remove("hidden"); return; }
    if (!payload.department) { errorEl.textContent = "Selecciona el departamento para el envío nacional."; errorEl.classList.remove("hidden"); return; }
    if (payload.department === "Pando") { errorEl.textContent = "Actualmente no realizamos envíos al departamento de Pando."; errorEl.classList.remove("hidden"); return; }
    if (payload.department === "Cochabamba" && !["Ivirgarzama","Eterazama","Mariposas"].includes(payload.shipping_province)) { errorEl.textContent = "Selecciona Ivirgarzama, Eterazama o Mariposas como destino habilitado en Cochabamba."; errorEl.classList.remove("hidden"); return; }
    if (payload.department !== "Cochabamba" && payload.shipping_province) { errorEl.textContent = "Fuera de Cochabamba no realizamos envíos a provincias."; errorEl.classList.remove("hidden"); return; }
    if (!payload.address) { errorEl.textContent = "Ingresa la dirección o agencia de destino."; errorEl.classList.remove("hidden"); return; }
  }
  if (payload.payment_method === "qr") {
    if (!state.settings?.payment_qr_url) { errorEl.textContent = "El QR de pago todavía no está configurado."; errorEl.classList.remove("hidden"); return; }
    if (!state.receiptFile) { errorEl.textContent = "Debes subir una foto del comprobante."; errorEl.classList.remove("hidden"); return; }
  } else if (payload.payment_method === "cash" && state.cashEligible !== true) {
    errorEl.textContent = "El pago en efectivo solo está disponible para el primer pedido. Verifica tu número o paga por QR."; errorEl.classList.remove("hidden"); return;
  }

  const button = $("submitOrderBtn");
  const cashCartSnapshot = payload.payment_method === "cash" ? state.cart.map(item => ({...item})) : null;
  button.disabled = true; button.textContent = "Registrando pedido...";
  try {
    const created = await window.SweetStore.createOrder(payload, payload.payment_method === "qr" ? state.receiptFile : null);
    state.tracking = { order_code: created.order_code, tracking_token: created.tracking_token, phone: payload.customer_phone, display_order_number: created.display_order_number, payment_method: payload.payment_method };
    localStorage.setItem(LAST_ORDER_KEY, JSON.stringify(state.tracking));
    $("successOrderCode").textContent = created.order_code;
    $("successOrderNumber").textContent = created.display_order_number ? ` · Pedido #${created.display_order_number}` : "";
    $("successOrderNumber").classList.toggle("order-number-celebration", Boolean(created.display_order_number));
    $("successTitle").textContent = payload.payment_method === "cash" ? "¡Pedido registrado!" : "¡Ya recibimos tu comprobante!";
    const suffix = payload.payment_method === "cash" ? ". Coordina el pago en efectivo con Sweet by Sami." : ". Sweet by Sami revisará el pago desde administración.";
    const p = $("successOrderText"); if (p?.lastChild?.nodeType === Node.TEXT_NODE) p.lastChild.textContent = suffix;
    $("checkoutForm").classList.add("hidden");
    $("orderSuccess").classList.remove("hidden");
    $("openStatusBtn").classList.remove("hidden");
    if (payload.payment_method === "cash") {
      const lines = (cashCartSnapshot || []).map(item => `• ${item.name} · ${item.variantName} × ${item.quantity} — ${formatMoney(item.price * item.quantity)}`);
      const shippingFee = Number(created.shipping_fee ?? payload.shipping_fee ?? 0);
      const total = formatMoney(created.total ?? ((cashCartSnapshot || []).reduce((sum,item)=>sum + Number(item.price)*Number(item.quantity||1),0) + shippingFee));
      const cashMessage = [
        "Hola Sweet by Sami, quiero pagar mi pedido en efectivo.",
        `Pedido: ${created.order_code}${created.display_order_number ? ` · #${created.display_order_number}` : ""}`,
        `Nombre: ${payload.customer_name}`,
        `WhatsApp: +${payload.customer_phone}`,
        "",
        "Mi pedido:",
        ...lines,
        shippingFee ? `• Adelanto de envío provincial — ${formatMoney(shippingFee)}` : "",
        `Total: ${total}`
      ].filter(Boolean).join("\n");
      const successWa = $("successWhatsAppBtn");
      successWa.textContent = "Quiero pagar mi pedido en efectivo";
      successWa.dataset.cashMessage = cashMessage;
      updatePaymentConfirmationMessage({ payment_status: "cash_pending" });
      $("livePaymentStatus").textContent = "Pago en efectivo pendiente";
      $("liveOrderStatus").textContent = "Pedido recibido";
    } else {
      const successWa = $("successWhatsAppBtn");
      successWa.textContent = "Contactar por WhatsApp";
      delete successWa.dataset.cashMessage;
    }
    state.cart = []; renderCart();
    celebrateMilestone(created.display_order_number);
    await refreshTrackingStatus(true);
    startTracking();
  } catch (error) {
    console.error(error);
    errorEl.textContent = error?.message || "No se pudo registrar el pedido. Intenta nuevamente.";
    errorEl.classList.remove("hidden");
  } finally {
    button.disabled = false; updatePaymentMethod();
  }
}

const paymentLabels = {
  pending_review: "Esperando confirmación del pago",
  cash_pending: "Pago en efectivo pendiente",
  confirmed: "Pago confirmado",
  rejected: "El comprobante tiene una observación"
};
const orderLabels = {
  received: "Pedido recibido",
  preparing: "Preparando tu pedido",
  ready: "Listo para recoger",
  shipped: "Pedido enviado",
  completed: "Pedido completado",
  cancelled: "Pedido cancelado"
};

function statusMessage(status) {
  if (!status) return "No se pudo consultar el estado.";
  if (status.payment_status === "confirmed") return "Pago confirmado. ¡Gracias por tu compra!";
  if (status.payment_status === "rejected") return "Hay una observación con el comprobante. Puedes contactar a Sweet by Sami por WhatsApp para corregirlo.";
  if (status.payment_status === "cash_pending") return "Tu pedido está registrado con pago en efectivo. Coordina el pago y recojo con Sweet by Sami.";
  return "Espera a la confirmación del pago, por favor. Tu comprobante ya fue enviado y está pendiente de revisión.";
}

function updatePaymentConfirmationMessage(status) {
  const box = $("paymentConfirmationMessage");
  const title = $("paymentConfirmationTitle");
  const text = $("paymentConfirmationText");
  if (!box || !title || !text || !status) return;

  box.classList.remove("pending", "confirmed", "rejected");
  const icon = box.querySelector(".payment-confirmation-icon");

  if (status.payment_status === "confirmed") {
    box.classList.add("confirmed");
    if (icon) icon.textContent = "✓";
    title.textContent = "Pago confirmado. ¡Gracias por tu compra!";
    text.textContent = "Tu pago fue aprobado correctamente y tu pedido ya puede continuar con la preparación.";
    return;
  }

  if (status.payment_status === "cash_pending") {
    box.classList.add("pending");
    if (icon) icon.textContent = "Bs.";
    title.textContent = "Pedido registrado con pago en efectivo.";
    text.textContent = "Pulsa “Quiero pagar mi pedido en efectivo” para enviar a Sweet by Sami los datos y productos de tu pedido por WhatsApp.";
    return;
  }

  if (status.payment_status === "rejected") {
    box.classList.add("rejected");
    if (icon) icon.textContent = "!";
    title.textContent = "Tu comprobante necesita revisión.";
    text.textContent = "Hay una observación con el pago. Contacta a Sweet by Sami para corregirla.";
    return;
  }

  box.classList.add("pending");
  if (icon) icon.textContent = "⌛";
  title.textContent = "Espera a la confirmación del pago, por favor.";
  text.textContent = "Tu comprobante fue enviado correctamente. Te avisaremos aquí en cuanto el pago sea confirmado.";
}

function paintStatus(card, paymentEl, orderEl, status) {
  if (!status) return;
  card.classList.remove("confirmed", "rejected");
  if (status.payment_status === "confirmed") card.classList.add("confirmed");
  if (status.payment_status === "rejected") card.classList.add("rejected");
  paymentEl.textContent = paymentLabels[status.payment_status] || status.payment_status;
  orderEl.textContent = orderLabels[status.order_status] || status.order_status;
}

async function refreshTrackingStatus(showInSuccess = false) {
  if (!state.tracking) return null;
  try {
    const status = await window.SweetStore.getPublicOrderStatus(state.tracking.order_code, state.tracking.tracking_token);
    if (!status) return null;
    paintStatus($("liveStatusCard"), $("livePaymentStatus"), $("liveOrderStatus"), status);
    updatePaymentConfirmationMessage(status);
    paintStatus(statusModal.querySelector(".status-live-card"), $("savedPaymentStatus"), $("savedOrderStatus"), status);
    const savedNumber = state.tracking.display_order_number || (status.order_serial ? Number(state.settings?.historical_order_count||0) + Number(status.order_serial) : null);
    $("statusOrderCode").textContent = savedNumber ? `Pedido #${savedNumber} · ${state.tracking.order_code}` : state.tracking.order_code;
    $("savedStatusMessage").textContent = statusMessage(status);
    return status;
  } catch (error) { console.error("status", error); return null; }
}

function startTracking() {
  if (state.trackingTimer) clearInterval(state.trackingTimer);
  if (!state.tracking) return;
  state.trackingTimer = setInterval(() => refreshTrackingStatus(false), 4000);
}

async function openSavedStatus() {
  if (!state.tracking) return;
  await refreshTrackingStatus(false);
  statusModal.classList.add("open"); statusModal.setAttribute("aria-hidden", "false"); document.body.classList.add("locked");
}
function closeSavedStatus() { statusModal.classList.remove("open"); statusModal.setAttribute("aria-hidden", "true"); document.body.classList.remove("locked"); }

function restoreTracking() {
  try { state.tracking = JSON.parse(localStorage.getItem(LAST_ORDER_KEY)) || null; } catch { state.tracking = null; }
  if (state.tracking) { $("openStatusBtn").classList.remove("hidden"); refreshTrackingStatus(false); startTracking(); }
}

$("closeModalBtn").addEventListener("click", closeProduct);
modal.addEventListener("click", event => { if (event.target === modal) closeProduct(); });
$("addToCartBtn").addEventListener("click", addToCart);
$("openCartBtn").addEventListener("click", openCart);
$("closeCartBtn").addEventListener("click", closeCart);
drawerOverlay.addEventListener("click", closeCart);
$("continueShoppingBtn")?.addEventListener("click", closeCart);
$("startCheckoutBtn").addEventListener("click", openCheckout);
$("closeCheckoutBtn").addEventListener("click", closeCheckout);
checkoutModal.addEventListener("click", event => { if (event.target === checkoutModal) closeCheckout(); });
document.querySelectorAll('input[name="fulfillment"]').forEach(input => input.addEventListener("change", updateFulfillmentFields));
document.querySelectorAll('input[name="preparationMode"]').forEach(input => input.addEventListener("change", updatePreparationFields));
$("shippingDepartment")?.addEventListener("change", updateNationalDestinationFields);
$("shippingProvince")?.addEventListener("change", () => { renderCheckoutSummary(); updateCashWhatsappButton(); });
$("downloadQrBtn")?.addEventListener("click", downloadPaymentQr);
document.querySelectorAll('input[name="paymentMethod"]').forEach(input => input.addEventListener("change", updatePaymentMethod));
$("customerPhone").addEventListener("input", () => { normalizeLocalPhoneInput(); scheduleCashEligibilityCheck(); });
$("customerPhone").addEventListener("blur", refreshCashEligibility);
$("shippingRecipientPhone")?.addEventListener("input", normalizeNationalRecipientPhoneInput);
$("paymentReceipt").addEventListener("change", event => previewReceipt(event.target.files?.[0]));
$("changeReceiptBtn").addEventListener("click", () => $("paymentReceipt").click());
$("checkoutForm").addEventListener("submit", submitOrder);
$("closeSuccessBtn").addEventListener("click", closeCheckout);
$("successWhatsAppBtn").addEventListener("click", () => {
  const custom = $("successWhatsAppBtn").dataset.cashMessage;
  window.open(whatsappUrl(custom || `Hola Sweet by Sami, quisiera consultar mi pedido ${state.tracking?.order_code || ""}.`), "_blank", "noopener,noreferrer");
});
$("openStatusBtn").addEventListener("click", openSavedStatus);
$("closeStatusBtn").addEventListener("click", closeSavedStatus);
statusModal.addEventListener("click", event => { if (event.target === statusModal) closeSavedStatus(); });
$("statusWhatsAppBtn").addEventListener("click", () => window.open(whatsappUrl(`Hola Sweet by Sami, quisiera consultar mi pedido ${state.tracking?.order_code || ""}.`), "_blank", "noopener,noreferrer"));
window.addEventListener("sweet-order-updated", () => refreshTrackingStatus(false));
window.addEventListener("storage", event => { if (event.key?.includes("sweet_by_sami_demo_orders")) refreshTrackingStatus(false); });
document.addEventListener("keydown", event => { if (event.key === "Escape") { closeProduct(); closeCart(); closeCheckout(); closeSavedStatus(); } });


function bindHeroProductShortcuts() {
  document.querySelectorAll("[data-open-product]").forEach(button => {
    button.addEventListener("click", () => openProduct(button.dataset.openProduct));
  });
}

(async function init() {
  try {
    const [catalog, settings] = await Promise.all([window.SweetStore.getCatalog(), window.SweetStore.getSettings()]);
    state.categories = catalog.categories || [];
    state.products = catalog.products || [];
    state.settings = settings;
    renderProducts(); renderCart(); applySettings(); updatePreparationFields(); restoreTracking(); bindHeroProductShortcuts();
    const requestedProduct = new URLSearchParams(window.location.search).get("producto");
    if (requestedProduct) {
      window.setTimeout(() => openProduct(requestedProduct), 80);
    }
  } catch (error) {
    console.error(error);
    productGrid.innerHTML = `<p style="grid-column:1/-1;text-align:center;color:#7c6763">No se pudieron cargar los productos. Revisa la configuración de Supabase.</p>`;
  }
})();
