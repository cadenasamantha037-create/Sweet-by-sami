(function () {
  const CONFIG = window.SWEET_CONFIG || {};
  const browserSupabaseKey = CONFIG.supabaseKey || CONFIG.supabaseAnonKey || "";
  const hasSupabase = Boolean(CONFIG.supabaseUrl && browserSupabaseKey && window.supabase);
  const client = hasSupabase ? window.supabase.createClient(CONFIG.supabaseUrl, browserSupabaseKey) : null;

  const KEYS = {
    categories: "sweet_by_sami_demo_categories_v5",
    catalog: "sweet_by_sami_demo_catalog_v5",
    orders: "sweet_by_sami_demo_orders_v2",
    customers: "sweet_by_sami_demo_customers_v2",
    settings: "sweet_by_sami_demo_settings_v2"
  };

  const DEFAULT_PRODUCT_IMAGES = {
    p: "assets/cuchara-p.jpg",
    m: "assets/cuchara-m.jpg",
    g: "assets/cuchara-g.jpg"
  };

  const demoCategories = [
    {
      id: "spoons",
      name: "Scoops",
      description: "Elige P, M o G y después selecciona la presentación disponible para tu cajita.",
      active: true,
      sort_order: 1
    },
    {
      id: "boxes",
      name: "Mega Caja",
      description: "La Mega Caja tiene su propio apartado con productos completos, snacks, dulces y sorpresas.",
      active: true,
      sort_order: 2
    }
  ];

  const demoProducts = [
    {
      id: "p", category_id: "spoons", name: "Scoop P", short_name: "P", subtitle: "La más pequeña",
      description: "Pequeña, bonita y llena de dulces sorpresas.", price: 45, active: true, sort_order: 1,
      spoon_color: "#eb7f93", image_url: "assets/cuchara-p.jpg",
      variants: [
        { id: "p-1", name: "Diseño 1", description: "Primera presentación disponible para el Scoop P.", image_url: "", active: true, sort_order: 1 },
        { id: "p-2", name: "Diseño 2", description: "Segunda presentación disponible para el Scoop P.", image_url: "", active: true, sort_order: 2 },
        { id: "p-3", name: "Diseño 3", description: "Tercera presentación disponible para el Scoop P.", image_url: "", active: true, sort_order: 3 }
      ]
    },
    {
      id: "m", category_id: "spoons", name: "Scoop M", short_name: "M", subtitle: "Tamaño mediano",
      description: "Más perlitas, más emoción y una cajita personalizada.", price: 75, active: true, sort_order: 2,
      spoon_color: "#e5b43e", image_url: "assets/cuchara-m.jpg",
      variants: [
        { id: "m-1", name: "Caja blanca personalizada", description: "Presentación blanca lista para personalizar con lettering.", image_url: "", active: true, sort_order: 1 }
      ]
    },
    {
      id: "g", category_id: "spoons", name: "Scoop G", short_name: "G", subtitle: "La más grande",
      description: "La experiencia más grande para quienes quieren más sorpresa.", price: 145, active: true, sort_order: 3,
      spoon_color: "#df6d83", image_url: "assets/cuchara-g.jpg",
      variants: [
        { id: "g-1", name: "Diseño Sweet G", description: "Presentación especial del Scoop G, ya personalizada.", image_url: "", active: true, sort_order: 1 }
      ]
    },
    {
      id: "mega-box", category_id: "boxes", name: "Mega Caja", short_name: "MEGA", subtitle: "La experiencia completa",
      description: "Una caja especial con paquetes de productos enteros y snacks variados, preparada para sorprender.", price: 250, active: true, sort_order: 1,
      spoon_color: "#ef7da5", image_url: "assets/mega-caja.png",
      variants: [
        { id: "mega-box-1", name: "Mega Caja Sweet", description: "Presentación especial con productos completos y snacks variados. El contenido visual es referencial.", image_url: "assets/mega-caja.png", active: true, sort_order: 1 }
      ]
    }
  ];

  const defaultSettings = {
    id: "main",
    payment_qr_url: "assets/qr-banco-bisa.png",
    pickup_address: "Sweet by Sami · Cochabamba · ubicación exacta en Google Maps",
    pickup_map_url: "https://maps.app.goo.gl/FsLshw8DKRAXytGF9",
    pickup_hours: "7:30 a 9:00 am · 2:00 a 3:00 pm",
    danae_map_url: "https://maps.app.goo.gl/YHXgj9gWhiJ3pkgH7?g_st=awb",
    danae_location_name: "Paquetería DANAE · 1er piso · local 20",
    danae_hours: "Lunes a viernes · 8:00 am a 8:30 pm",
    coordination_phone_1: "59172751732",
    coordination_phone_2: "",
    historical_order_count: 500,
    milestone_target: 1000,
    payment_instructions: "Escanea el QR, realiza el pago y luego adjunta una captura de tu comprobante."
  };

  const clone = value => JSON.parse(JSON.stringify(value));
  const getJson = (key, fallback) => {
    try { return JSON.parse(localStorage.getItem(key)) ?? clone(fallback); }
    catch { return clone(fallback); }
  };
  const setJson = (key, value) => localStorage.setItem(key, JSON.stringify(value));
  const normalizePhone = value => String(value || "").replace(/\D/g, "");
  const normalizeBoliviaPhone = value => {
    const digits = normalizePhone(value);
    if (digits.length === 8) return `591${digits}`;
    if (digits.length === 11 && digits.startsWith("591")) return digits;
    return digits;
  };
  const uuid = () => (crypto?.randomUUID ? crypto.randomUUID() : `id-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  const orderCode = () => `SBS-${new Date().toISOString().slice(2,10).replace(/-/g, "")}-${Math.random().toString(36).slice(2,6).toUpperCase()}`;

  function getLocalCategories() {
    const categories = getJson(KEYS.categories, demoCategories);
    let changed = false;
    categories.forEach(category => {
      if (String(category.id) === "spoons" && /cucharas/i.test(category.name || "")) {
        category.name = "Scoops";
        changed = true;
      }
    });
    if (changed) setJson(KEYS.categories, categories);
    return categories;
  }
  function saveLocalCategories(categories) { setJson(KEYS.categories, categories); }
  function getLocalCatalog() {
    const products = getJson(KEYS.catalog, demoProducts);
    let changed = false;
    products.forEach(product => {
      const defaultImage = DEFAULT_PRODUCT_IMAGES[String(product.id)];
      if (defaultImage && !String(product.image_url || "").trim()) {
        product.image_url = defaultImage;
        changed = true;
      }
      if (String(product.category_id) === "spoons" && /^Cuchara\b/i.test(product.name || "")) {
        product.name = String(product.name).replace(/^Cuchara\b/i, "Scoop");
        changed = true;
      }
      (product.variants || []).forEach(variant => {
        if (/Cuchara P/i.test(variant.description || "")) { variant.description = String(variant.description).replace(/Cuchara P/gi, "Scoop P"); changed = true; }
        if (/Cuchara G/i.test(variant.description || "")) { variant.description = String(variant.description).replace(/Cuchara G/gi, "Scoop G"); changed = true; }
      });
    });
    if (changed) setJson(KEYS.catalog, products);
    return products;
  }
  function saveLocalCatalog(products) { setJson(KEYS.catalog, products); }
  function getLocalOrders() { return getJson(KEYS.orders, []); }
  function saveLocalOrders(orders) { setJson(KEYS.orders, orders); }
  function getLocalCustomers() { return getJson(KEYS.customers, []); }
  function saveLocalCustomers(customers) { setJson(KEYS.customers, customers); }
  function getLocalSettings() {
    const saved = getJson(KEYS.settings, defaultSettings);
    return { ...defaultSettings, ...saved, payment_qr_url: String(saved.payment_qr_url || "").trim() || defaultSettings.payment_qr_url };
  }

  async function getCategories() {
    if (!client) return getLocalCategories().filter(c => c.active !== false).sort((a,b) => Number(a.sort_order||0) - Number(b.sort_order||0));
    const { data, error } = await client.from("categories").select("*").eq("active", true).order("sort_order", { ascending: true });
    if (error) throw error;
    return data || [];
  }

  async function getAllCategoriesAdmin() {
    if (!client) return getLocalCategories().sort((a,b) => Number(a.sort_order||0) - Number(b.sort_order||0));
    const { data, error } = await client.from("categories").select("*").order("sort_order", { ascending: true });
    if (error) throw error;
    return data || [];
  }

  async function saveCategory(category) {
    const row = { ...category, sort_order: Number(category.sort_order || 0) };
    if (!client) {
      const categories = getLocalCategories();
      const index = categories.findIndex(c => String(c.id) === String(row.id));
      if (index >= 0) categories[index] = clone(row); else categories.push(clone(row));
      saveLocalCategories(categories);
      return row;
    }
    const { data, error } = await client.from("categories").upsert(row).select().single();
    if (error) throw error;
    return data;
  }

  async function deleteCategory(categoryId) {
    if (!client) {
      if (getLocalCatalog().some(p => String(p.category_id) === String(categoryId))) throw new Error("Mueve o elimina los items de esta categoría primero.");
      saveLocalCategories(getLocalCategories().filter(c => String(c.id) !== String(categoryId)));
      return true;
    }
    const { count, error: countError } = await client.from("products").select("id", { count: "exact", head: true }).eq("category_id", categoryId);
    if (countError) throw countError;
    if (count) throw new Error("Mueve o elimina los items de esta categoría primero.");
    const { error } = await client.from("categories").delete().eq("id", categoryId);
    if (error) throw error;
    return true;
  }

  async function getProducts() {
    if (!client) {
      return getLocalCatalog().filter(p => p.active !== false).sort((a,b) => Number(a.sort_order||0) - Number(b.sort_order||0)).map(product => ({
        ...product,
        variants: (product.variants || []).filter(v => v.active !== false).sort((a,b) => Number(a.sort_order||0)-Number(b.sort_order||0))
      }));
    }
    const { data: products, error } = await client.from("products").select("*").eq("active", true).order("sort_order", { ascending: true });
    if (error) throw error;
    if (!products?.length) return [];
    const ids = products.map(p => p.id);
    const { data: variants, error: variantsError } = await client.from("product_variants").select("*").in("product_id", ids).eq("active", true).order("sort_order", { ascending: true });
    if (variantsError) throw variantsError;
    return products.map(product => ({ ...product, variants: (variants || []).filter(v => v.product_id === product.id) }));
  }

  async function getCatalog() {
    const [categories, products] = await Promise.all([getCategories(), getProducts()]);
    const activeIds = new Set(categories.map(c => String(c.id)));
    return { categories, products: products.filter(p => activeIds.has(String(p.category_id))) };
  }

  async function getAllProductsAdmin() {
    if (!client) return getLocalCatalog().sort((a,b) => Number(a.sort_order||0) - Number(b.sort_order||0));
    const { data: products, error } = await client.from("products").select("*").order("sort_order", { ascending: true });
    if (error) throw error;
    const { data: variants, error: variantsError } = await client.from("product_variants").select("*").order("sort_order", { ascending: true });
    if (variantsError) throw variantsError;
    return (products || []).map(product => ({ ...product, variants: (variants || []).filter(v => v.product_id === product.id) }));
  }

  async function saveProduct(product) {
    if (!client) {
      const catalog = getLocalCatalog();
      const index = catalog.findIndex(p => String(p.id) === String(product.id));
      if (index >= 0) catalog[index] = clone(product); else catalog.push(clone(product));
      saveLocalCatalog(catalog);
      return product;
    }
    const { variants = [], ...productRow } = product;
    const { error } = await client.from("products").upsert(productRow);
    if (error) throw error;
    const { data: existing, error: existingError } = await client.from("product_variants").select("id").eq("product_id", product.id);
    if (existingError) throw existingError;
    const keepIds = variants.map(v => v.id).filter(Boolean);
    const removeIds = (existing || []).map(v => v.id).filter(id => !keepIds.includes(id));
    if (removeIds.length) {
      const { error: deleteError } = await client.from("product_variants").delete().in("id", removeIds);
      if (deleteError) throw deleteError;
    }
    if (variants.length) {
      const rows = variants.map(v => ({ ...v, product_id: product.id }));
      const { error: upsertError } = await client.from("product_variants").upsert(rows);
      if (upsertError) throw upsertError;
    }
    return product;
  }

  async function deleteProduct(productId) {
    if (!client) {
      saveLocalCatalog(getLocalCatalog().filter(p => String(p.id) !== String(productId)));
      return true;
    }
    const { error } = await client.from("products").delete().eq("id", productId);
    if (error) throw error;
    return true;
  }

  function imageToDataUrl(file, maxSide = 1500, quality = 0.78) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = reject;
      reader.onload = () => {
        const image = new Image();
        image.onerror = () => resolve(reader.result);
        image.onload = () => {
          const ratio = Math.min(1, maxSide / Math.max(image.width, image.height));
          const canvas = document.createElement("canvas");
          canvas.width = Math.max(1, Math.round(image.width * ratio));
          canvas.height = Math.max(1, Math.round(image.height * ratio));
          canvas.getContext("2d").drawImage(image, 0, 0, canvas.width, canvas.height);
          resolve(canvas.toDataURL("image/jpeg", quality));
        };
        image.src = reader.result;
      };
      reader.readAsDataURL(file);
    });
  }

  async function uploadImage(file, pathHint) {
    if (!file) return "";
    if (!client) return imageToDataUrl(file, 1400, .8);
    const ext = (file.name.split(".").pop() || "jpg").toLowerCase();
    const path = `${pathHint}-${Date.now()}.${ext}`;
    const { error } = await client.storage.from("product-images").upload(path, file, { upsert: true });
    if (error) throw error;
    return client.storage.from("product-images").getPublicUrl(path).data.publicUrl;
  }

  async function getSettings() {
    if (!client) return getLocalSettings();
    const { data, error } = await client.from("site_settings").select("*").eq("id", "main").maybeSingle();
    if (error) throw error;
    return { ...defaultSettings, ...(data || {}) };
  }

  async function saveSettings(settings) {
    const row = { ...defaultSettings, ...settings, id: "main", updated_at: new Date().toISOString() };
    if (!client) { setJson(KEYS.settings, row); return row; }
    const { data, error } = await client.from("site_settings").upsert(row).select().single();
    if (error) throw error;
    return data;
  }

  async function uploadPaymentQr(file) {
    if (!file) return "";
    if (!client) return imageToDataUrl(file, 1200, .88);
    const ext = (file.name.split(".").pop() || "jpg").toLowerCase();
    const path = `payment-qr.${ext}`;
    const { error } = await client.storage.from("site-assets").upload(path, file, { upsert: true, cacheControl: "60" });
    if (error) throw error;
    return `${client.storage.from("site-assets").getPublicUrl(path).data.publicUrl}?v=${Date.now()}`;
  }

  function upsertLocalCustomer(name, phone) {
    const customers = getLocalCustomers();
    const clean = normalizePhone(phone);
    const now = new Date().toISOString();
    const existing = customers.find(c => c.phone === clean);
    if (existing) { existing.name = name; existing.updated_at = now; existing.last_order_at = now; }
    else customers.push({ id: uuid(), name, phone: clean, created_at: now, updated_at: now, last_order_at: now });
    saveLocalCustomers(customers);
    return customers.find(c => c.phone === clean);
  }

  async function checkCashEligibility(phone) {
    const clean = normalizeBoliviaPhone(phone);
    if (clean.length !== 11 || !clean.startsWith("591")) return false;
    if (!client) return !getLocalOrders().some(order => normalizeBoliviaPhone(order.customer_phone) === clean);
    const { data, error } = await client.rpc("check_cash_eligibility", { p_phone: clean });
    if (error) throw error;
    return Boolean(data);
  }

  async function createOrder(payload, receiptFile) {
    if (!payload?.items?.length) throw new Error("El pedido está vacío.");
    const paymentMethod = payload.payment_method === "cash" ? "cash" : "qr";
    if (paymentMethod === "qr" && !receiptFile) throw new Error("Debes subir el comprobante de pago.");
    const code = orderCode();
    const trackingToken = uuid();
    const cleanPhone = normalizeBoliviaPhone(payload.customer_phone);
    if (cleanPhone.length !== 11 || !cleanPhone.startsWith("591")) throw new Error("Número de WhatsApp inválido.");

    if (!client) {
      if (paymentMethod === "cash" && !(await checkCashEligibility(cleanPhone))) throw new Error("El pago en efectivo solo está disponible para el primer pedido.");
      const receipt = receiptFile ? await imageToDataUrl(receiptFile, 1500, .74) : "";
      const total = payload.items.reduce((sum, item) => sum + Number(item.unit_price) * Number(item.quantity || 1), 0);
      const customer = upsertLocalCustomer(payload.customer_name, cleanPhone);
      const now = new Date().toISOString();
      const orders = getLocalOrders();
      const orderSerial = orders.reduce((max, order) => Math.max(max, Number(order.order_serial || 0)), 0) + 1;
      const settings = getLocalSettings();
      const displayOrderNumber = Number(settings.historical_order_count || 0) + orderSerial;
      const order = {
        id: uuid(), order_code: code, tracking_token: trackingToken, order_serial: orderSerial, customer_id: customer.id,
        customer_name: payload.customer_name, customer_phone: cleanPhone,
        total, fulfillment_method: payload.fulfillment_method, department: payload.department || "", shipping_province: payload.shipping_province || "", city: payload.city || "", address: payload.address || "", reference: payload.reference || "",
        shipping_recipient_name: payload.shipping_recipient_name || "", shipping_recipient_phone: normalizeBoliviaPhone(payload.shipping_recipient_phone || ""), shipping_recipient_ci: payload.shipping_recipient_ci || "",
        dedication_from: payload.dedication_from || "", dedication_to: payload.dedication_to || "",
        refund_amount: 0, refund_status: "none", refunded_at: null, refund_note: "",
        preparation_mode: payload.preparation_mode || "live", payment_method: paymentMethod,
        delivery_latitude: null, delivery_longitude: null, delivery_accuracy_m: null,
        payment_receipt_path: receipt, payment_status: paymentMethod === "cash" ? "cash_pending" : "pending_review", order_status: "received", admin_note: "",
        created_at: now, updated_at: now,
        order_items: payload.items.map(item => ({
          id: uuid(), product_id: item.product_id, product_name: item.product_name, variant_id: item.variant_id,
          variant_name: item.variant_name, quantity: Number(item.quantity || 1), unit_price: Number(item.unit_price),
          subtotal: Number(item.unit_price) * Number(item.quantity || 1)
        }))
      };
      orders.unshift(order); saveLocalOrders(orders);
      window.dispatchEvent(new CustomEvent("sweet-new-order", { detail: order }));
      return { order_code: code, tracking_token: trackingToken, total, order_serial: orderSerial, display_order_number: displayOrderNumber, payment_method: paymentMethod };
    }

    let receiptPath = "";
    if (paymentMethod === "qr") {
      const ext = (receiptFile.name.split(".").pop() || "jpg").toLowerCase();
      receiptPath = `checkout/${uuid()}.${ext}`;
      const { error: uploadError } = await client.storage.from("payment-receipts").upload(receiptPath, receiptFile, { upsert: false });
      if (uploadError) throw uploadError;
    }

    const rpcPayload = {
      order_code: code,
      tracking_token: trackingToken,
      customer_name: payload.customer_name,
      customer_phone: cleanPhone,
      fulfillment_method: payload.fulfillment_method,
      preparation_mode: payload.preparation_mode || "live",
      payment_method: paymentMethod,
      department: payload.department || "",
      shipping_province: payload.shipping_province || "",
      city: payload.city || "",
      address: payload.address || "",
      reference: payload.reference || "",
      shipping_recipient_name: payload.shipping_recipient_name || "",
      shipping_recipient_phone: normalizeBoliviaPhone(payload.shipping_recipient_phone || ""),
      shipping_recipient_ci: payload.shipping_recipient_ci || "",
      dedication_from: payload.dedication_from || "",
      dedication_to: payload.dedication_to || "",
      payment_receipt_path: receiptPath,
      items: payload.items.map(item => ({ product_id: item.product_id, variant_id: item.variant_id, quantity: Number(item.quantity || 1) }))
    };
    const { data, error } = await client.rpc("create_public_order", { p_payload: rpcPayload });
    if (error) throw error;
    return data;
  }

  async function getPublicOrderStatus(code, token) {
    if (!code || !token) return null;
    if (!client) {
      const order = getLocalOrders().find(o => o.order_code === code && o.tracking_token === token);
      if (!order) return null;
      return { order_code: order.order_code, payment_status: order.payment_status, order_status: order.order_status, payment_method: order.payment_method || "qr", order_serial: order.order_serial || null, updated_at: order.updated_at };
    }
    const { data, error } = await client.rpc("get_public_order_status", { p_order_code: code, p_tracking_token: token });
    if (error) throw error;
    return Array.isArray(data) ? data[0] : data;
  }

  async function getAdminOrders() {
    if (!client) return getLocalOrders();

    // Consultamos pedidos e items por separado. Esto evita depender del
    // "embedded relationship" de PostgREST y de que su schema cache ya haya
    // detectado la foreign key inmediatamente después de ejecutar el SQL.
    const { data: orders, error: ordersError } = await client
      .from("orders")
      .select("*")
      .order("created_at", { ascending: false });

    if (ordersError) {
      ordersError.source = "orders";
      throw ordersError;
    }

    if (!orders?.length) return [];

    const orderIds = orders.map(order => order.id);
    const { data: items, error: itemsError } = await client
      .from("order_items")
      .select("*")
      .in("order_id", orderIds)
      .order("created_at", { ascending: true });

    if (itemsError) {
      itemsError.source = "order_items";
      throw itemsError;
    }

    return orders.map(order => ({
      ...order,
      order_items: (items || []).filter(item => item.order_id === order.id)
    }));
  }

  async function getAdminCustomers() {
    if (!client) return getLocalCustomers();
    const { data, error } = await client.from("customers").select("*").order("last_order_at", { ascending: false });
    if (error) throw error;
    return data || [];
  }

  async function updateOrder(orderId, changes) {
    const next = { ...changes, updated_at: new Date().toISOString() };
    if (!client) {
      const orders = getLocalOrders();
      const index = orders.findIndex(o => o.id === orderId);
      if (index < 0) throw new Error("Pedido no encontrado");
      if (Object.prototype.hasOwnProperty.call(changes, "payment_status")) {
        if (changes.payment_status === "confirmed" && orders[index].payment_status !== "confirmed") next.payment_confirmed_at = new Date().toISOString();
        if (changes.payment_status !== "confirmed") next.payment_confirmed_at = null;
      }
      orders[index] = { ...orders[index], ...next };
      saveLocalOrders(orders);
      window.dispatchEvent(new CustomEvent("sweet-order-updated", { detail: orders[index] }));
      return orders[index];
    }
    const { data, error } = await client
      .from("orders")
      .update(next)
      .eq("id", orderId)
      .select("*")
      .single();

    if (error) {
      error.source = "orders";
      throw error;
    }

    const { data: items, error: itemsError } = await client
      .from("order_items")
      .select("*")
      .eq("order_id", orderId)
      .order("created_at", { ascending: true });

    if (itemsError) {
      itemsError.source = "order_items";
      throw itemsError;
    }

    return { ...data, order_items: items || [] };
  }

  async function getReceiptViewUrl(path) {
    if (!path) return "";
    if (!client) return path;
    const { data, error } = await client.storage.from("payment-receipts").createSignedUrl(path, 180);
    if (error) throw error;
    return data.signedUrl;
  }


  function subscribeToNewOrders(callback, statusCallback) {
    if (typeof callback !== "function") return () => {};
    const reportStatus = typeof statusCallback === "function" ? statusCallback : () => {};
    if (!client) {
      const handler = event => callback(event.detail || {});
      window.addEventListener("sweet-new-order", handler);
      reportStatus("SUBSCRIBED");
      return () => window.removeEventListener("sweet-new-order", handler);
    }
    const channel = client
      .channel(`sweet-admin-orders-${Math.random().toString(36).slice(2)}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "orders" }, payload => callback(payload.new || {}))
      .subscribe(status => {
        reportStatus(status);
        if (status !== "SUBSCRIBED") console.warn("[Sweet by Sami] Realtime status:", status);
      });
    return () => { try { client.removeChannel(channel); } catch {} };
  }

  async function diagnoseAdminAccess() {
    if (!client) return { ok: true, mode: "demo", email: "demo" };

    const { data: sessionData, error: sessionError } = await client.auth.getSession();
    if (sessionError) return { ok: false, step: "session", error: sessionError };
    const session = sessionData?.session;
    if (!session) return { ok: false, step: "session", error: new Error("No hay sesión iniciada.") };

    const checks = [
      ["categories", () => client.from("categories").select("id").limit(1)],
      ["products", () => client.from("products").select("id").limit(1)],
      ["product_variants", () => client.from("product_variants").select("id").limit(1)],
      ["site_settings", () => client.from("site_settings").select("id").limit(1)],
      ["customers", () => client.from("customers").select("id").limit(1)],
      ["orders", () => client.from("orders").select("id").limit(1)],
      ["order_items", () => client.from("order_items").select("id").limit(1)]
    ];

    for (const [name, run] of checks) {
      const { error } = await run();
      if (error) return { ok: false, step: name, error, email: session.user?.email || "" };
    }

    return { ok: true, mode: "supabase", email: session.user?.email || "" };
  }

  async function getSession() {
    if (!client) return { user: { id: "demo-admin" } };
    const { data } = await client.auth.getSession();
    return data.session;
  }
  async function signInAdmin(email, password) {
    const allowedEmail = String(CONFIG.adminEmail || "").trim().toLowerCase();
    const normalizedEmail = String(email || "").trim().toLowerCase();
    if (allowedEmail && normalizedEmail !== allowedEmail) {
      throw new Error("Este correo no tiene acceso al panel de administración.");
    }
    if (!client) return { user: { id: "demo-admin", email: normalizedEmail } };
    const { data, error } = await client.auth.signInWithPassword({ email: normalizedEmail, password });
    if (error) throw error;
    if (allowedEmail && String(data?.user?.email || "").toLowerCase() !== allowedEmail) {
      await client.auth.signOut();
      throw new Error("Usuario no autorizado para administración.");
    }
    return data;
  }
  async function signOutAdmin() { if (client) await client.auth.signOut(); }

  function resetDemo() {
    Object.values(KEYS).forEach(key => localStorage.removeItem(key));
    localStorage.removeItem("sweet_by_sami_last_order_v2");
  }

  window.SweetStore = {
    mode: client ? "supabase" : "demo",
    client,
    demoCategories,
    demoProducts,
    getCatalog,
    getCategories,
    getAllCategoriesAdmin,
    saveCategory,
    deleteCategory,
    getProducts,
    getAllProductsAdmin,
    saveProduct,
    deleteProduct,
    uploadImage,
    getSettings,
    saveSettings,
    uploadPaymentQr,
    checkCashEligibility,
    createOrder,
    getPublicOrderStatus,
    getAdminOrders,
    getAdminCustomers,
    updateOrder,
    getReceiptViewUrl,
    subscribeToNewOrders,
    getSession,
    diagnoseAdminAccess,
    signInAdmin,
    signOutAdmin,
    normalizePhone,
    normalizeBoliviaPhone,
    resetDemo
  };
})();
