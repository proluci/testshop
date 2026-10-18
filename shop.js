// Testshop-Logik: Warenkorb, Bestellungen und dataLayer-Meldungen.
// Die Meldungen folgen dem Google-Analytics-4-Format für Onlineshops.

const PRODUKTE = [
  { item_id: "J-527", item_name: "Levi's 527 Bootcut", item_brand: "Levi's", item_category: "Jeans", price: 59 },
  { item_id: "J-ZAT", item_name: "Diesel Zatiny Bootcut", item_brand: "Diesel", item_category: "Jeans", price: 79 },
  { item_id: "J-JOE", item_name: "True Religion Joey", item_brand: "True Religion", item_category: "Jeans", price: 69 },
];
const WAEHRUNG = "EUR";

window.dataLayer = window.dataLayer || [];

// ---------- Speicher (Warenkorb, letzte Bestellung) ----------
function lesen(schluessel, standard) {
  try {
    const wert = localStorage.getItem(schluessel);
    return wert ? JSON.parse(wert) : standard;
  } catch (e) {
    return standard;
  }
}
function schreiben(schluessel, wert) {
  try {
    localStorage.setItem(schluessel, JSON.stringify(wert));
  } catch (e) {}
}
function warenkorb() { return lesen("testshop_warenkorb", []); }
function warenkorbSpeichern(liste) { schreiben("testshop_warenkorb", liste); }

function summe(liste) {
  return liste.reduce((s, p) => s + p.price * p.quantity, 0);
}
function euro(betrag) {
  return betrag.toLocaleString("de-DE", { style: "currency", currency: "EUR" });
}

// ---------- Meldung an den dataLayer ----------
function melden(eventName, ecommerce) {
  window.dataLayer.push({ ecommerce: null }); // alte E-Commerce-Daten leeren (Best Practice)
  window.dataLayer.push({ event: eventName, ecommerce: ecommerce });
}

// ---------- Seiten ----------
function startseite() {
  const grid = document.getElementById("produkte");
  grid.innerHTML = PRODUKTE.map((p) => `
    <article class="produkt">
      <div class="bild" aria-hidden="true">${p.item_brand.charAt(0)}</div>
      <h3>${p.item_name}</h3>
      <p class="preis">${euro(p.price)}</p>
      <button type="button" data-id="${p.item_id}">In den Warenkorb</button>
    </article>`).join("");

  melden("view_item_list", {
    item_list_name: "Startseite",
    items: PRODUKTE.map((p, i) => ({ ...p, index: i })),
  });

  grid.addEventListener("click", (e) => {
    const knopf = e.target.closest("button[data-id]");
    if (!knopf) return;
    const produkt = PRODUKTE.find((p) => p.item_id === knopf.dataset.id);
    const liste = warenkorb();
    const vorhanden = liste.find((p) => p.item_id === produkt.item_id);
    if (vorhanden) vorhanden.quantity += 1;
    else liste.push({ ...produkt, quantity: 1 });
    warenkorbSpeichern(liste);
    melden("add_to_cart", {
      currency: WAEHRUNG,
      value: produkt.price,
      items: [{ ...produkt, quantity: 1 }],
    });
    knopf.textContent = "Hinzugefügt ✓";
    setTimeout(() => (knopf.textContent = "In den Warenkorb"), 1200);
    zaehlerAktualisieren();
  });
}

function kasse() {
  const liste = warenkorb();
  const box = document.getElementById("warenkorb");
  const kaufen = document.getElementById("kaufen");
  if (!liste.length) {
    box.innerHTML = `<p>Dein Warenkorb ist leer. <a href="index.html">Zurück zum Shop</a></p>`;
    kaufen.hidden = true;
    return;
  }
  box.innerHTML = `
    <table>
      <thead><tr><th>Artikel</th><th>Menge</th><th>Preis</th></tr></thead>
      <tbody>${liste.map((p) => `<tr><td>${p.item_name}</td><td>${p.quantity}</td><td>${euro(p.price * p.quantity)}</td></tr>`).join("")}</tbody>
      <tfoot><tr><td colspan="2">Summe</td><td>${euro(summe(liste))}</td></tr></tfoot>
    </table>`;

  melden("begin_checkout", { currency: WAEHRUNG, value: summe(liste), items: liste });

  kaufen.addEventListener("click", () => {
    const bestellung = {
      transaction_id: "T-" + Date.now(),
      value: summe(liste),
      currency: WAEHRUNG,
      shipping: 4.9,
      items: liste,
    };
    schreiben("testshop_bestellung", bestellung);
    warenkorbSpeichern([]);
    location.href = "danke.html";
  });
}

function danke() {
  const bestellung = lesen("testshop_bestellung", null);
  const box = document.getElementById("bestellung");
  if (!bestellung) {
    box.innerHTML = `<p>Keine Bestellung gefunden. <a href="index.html">Zurück zum Shop</a></p>`;
    return;
  }
  box.innerHTML = `
    <p>Bestellnummer: <strong>${bestellung.transaction_id}</strong></p>
    <p>Betrag: <strong>${euro(bestellung.value)}</strong> (plus ${euro(bestellung.shipping)} Versand)</p>`;
  // Wie in vielen echten Shops: Diese Seite meldet den Kauf bei JEDEM Laden.
  melden("purchase", bestellung);
}

// ---------- Warenkorb-Zähler ----------
function zaehlerAktualisieren() {
  const el = document.getElementById("zaehler");
  if (el) el.textContent = warenkorb().reduce((s, p) => s + p.quantity, 0);
}

// ---------- Data-Layer-Monitor (zeigt live, was gemeldet wird) ----------
function monitorStarten() {
  const liste = document.getElementById("monitor-liste");
  const hinweis = document.getElementById("gtm-status");
  if (hinweis) {
    hinweis.textContent = window.GTM_AKTIV
      ? "Google Tag Manager ist eingebunden."
      : "Google Tag Manager ist noch nicht eingebunden. Trag deine GTM-ID in gtm.js ein.";
    hinweis.className = window.GTM_AKTIV ? "status ok" : "status fehlt";
  }
  let gezeigt = 0;
  function zeichnen() {
    const dl = window.dataLayer;
    while (gezeigt < dl.length) {
      const eintrag = dl[gezeigt];
      gezeigt += 1;
      if (!eintrag || typeof eintrag !== "object" || Array.isArray(eintrag)) continue;
      if (!("event" in eintrag) && "ecommerce" in eintrag && eintrag.ecommerce === null) continue;
      const name = eintrag.event || "(ohne Event)";
      const intern = String(name).startsWith("gtm.");
      const li = document.createElement("li");
      li.className = intern ? "intern" : "";
      let text;
      try { text = JSON.stringify(eintrag, null, 2); } catch (e) { text = "[nicht darstellbar]"; }
      li.innerHTML = `<span class="ev"></span><pre></pre>`;
      li.querySelector(".ev").textContent = name + (intern ? " (intern vom Tag Manager)" : "");
      li.querySelector("pre").textContent = text;
      liste.prepend(li);
    }
  }
  zeichnen();
  setInterval(zeichnen, 300);
}

document.addEventListener("DOMContentLoaded", () => {
  zaehlerAktualisieren();
  const seite = document.body.dataset.seite;
  if (seite === "start") startseite();
  if (seite === "kasse") kasse();
  if (seite === "danke") danke();
  monitorStarten();
});
