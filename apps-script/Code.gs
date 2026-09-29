/**
 * Wedding site ↔ Google Sheets bridge.
 *
 * Paste into the workbook's Apps Script editor (Extensions → Apps Script), set the
 * SITE_SECRET script property, run "Wedding site → Set up tabs & protections" once,
 * and deploy as a web app. Full steps: README → "Google Sheets via Apps Script".
 *
 * Tabs
 *   Guests     the guest list. One row per person; the script fills Code and the links.
 *   Asoebi     responses from /asoebi   (Status: Pending → Confirmed / Declined)
 *   Groomsmen  responses from /join     (same)
 *   RSVPs      responses from /rsvp
 * Confirming a response (here or on the site's /admin page) marks the person on
 * Guests: Source gains "Asoebi"/"Groomsmen" and Plus One becomes at least 1.
 *
 * The site POSTs JSON { secret, action, ... }:
 *   append     { sheet, headers?, rows }             add rows (tab created if missing)
 *   read       { sheet }                             tab values as text (READABLE_TABS only)
 *   setStatus  { sheet, submittedAt, code, status }  update a response's Status
 * Replies are JSON: { ok: true, values? } or { ok: false, error }.
 */

/** Your site's address, no trailing slash. Used to build personal links. */
const SITE_URL = "https://cynthiaandkelechi.com";

const TABS = { guests: "Guests", asoebi: "Asoebi", groomsmen: "Groomsmen", rsvps: "RSVPs" };

const GUEST_HEADERS = [
  "Code", "Name", "Category", "Source", "Plus One",
  "Asoebi", "Groomsmen", "Asoebi Link", "Groomsmen Link",
];
const RESPONSE_HEADERS = ["Submitted At", "Code", "Name", "Email", "WhatsApp", "Events", "Status"];

const CATEGORIES = [
  "Friends of groom", "Friends of bride", "Family of groom",
  "Family of bride", "Work colleagues", "Others",
];
const STATUSES = ["Pending", "Confirmed", "Declined"];

/** Response tab → the Source value it adds on Guests, and the page its link opens. */
const RESPONSE_TABS = {
  Asoebi: { source: "Asoebi", flag: "Asoebi", linkHeader: "Asoebi Link", path: "/asoebi" },
  Groomsmen: { source: "Groomsmen", flag: "Groomsmen", linkHeader: "Groomsmen Link", path: "/join" },
};

const READABLE_TABS = [TABS.guests, TABS.asoebi, TABS.groomsmen];
const PROTECTION_NOTE = "Filled by the website — edit through /admin or ask the sheet owner";
const CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"; // no 0/O, 1/I/L
const ROWS_TO_FORMAT = 1000;

/* ───────────────────────── Web app ───────────────────────── */

function doPost(e) {
  let body;
  try {
    body = JSON.parse(e.postData.contents);
  } catch (err) {
    return reply_({ ok: false, error: "invalid_json" });
  }

  const secret = PropertiesService.getScriptProperties().getProperty("SITE_SECRET");
  if (!secret || body.secret !== secret) return reply_({ ok: false, error: "unauthorized" });

  try {
    if (body.action === "append") return reply_(append_(body));
    if (body.action === "read") return reply_(read_(body));
    if (body.action === "setStatus") return reply_(setStatus_(body));
    return reply_({ ok: false, error: "unknown_action" });
  } catch (err) {
    console.error(err);
    return reply_({ ok: false, error: "server_error" });
  }
}

function append_(body) {
  if (typeof body.sheet !== "string" || !body.sheet || !Array.isArray(body.rows)) {
    return { ok: false, error: "bad_request" };
  }
  return withLock_(function () {
    const tab = tabOrCreate_(body.sheet);
    const out = [];
    if (tab.getLastRow() === 0 && Array.isArray(body.headers) && body.headers.length) {
      out.push(body.headers);
    }
    body.rows.forEach(function (row) { out.push(row.map(String)); });
    if (!out.length) return { ok: true };

    const width = Math.max.apply(null, out.map(function (r) { return r.length; }));
    const padded = out.map(function (r) { return r.concat(new Array(width - r.length).fill("")); });
    const range = tab.getRange(tab.getLastRow() + 1, 1, padded.length, width);
    range.setNumberFormat("@"); // plain text: keeps leading zeros, never runs a formula
    range.setValues(padded);
    return { ok: true };
  });
}

function read_(body) {
  if (READABLE_TABS.indexOf(body.sheet) === -1) return { ok: false, error: "not_readable" };
  const tab = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(body.sheet);
  if (!tab) return { ok: false, error: "no_such_tab" };
  return { ok: true, values: tab.getDataRange().getDisplayValues() };
}

function setStatus_(body) {
  if (!RESPONSE_TABS[body.sheet] || STATUSES.indexOf(body.status) === -1) {
    return { ok: false, error: "bad_request" };
  }
  return withLock_(function () {
    const tab = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(body.sheet);
    if (!tab) return { ok: false, error: "no_such_tab" };
    const cols = headerIndex_(tab);
    const values = tab.getDataRange().getDisplayValues();
    for (let r = 1; r < values.length; r++) {
      if (values[r][cols["Submitted At"]] === body.submittedAt && values[r][cols["Code"]] === body.code) {
        tab.getRange(r + 1, cols["Status"] + 1).setValue(body.status);
        if (body.status === "Confirmed") {
          confirmGuest_(body.code, values[r][cols["Name"]], RESPONSE_TABS[body.sheet]);
        }
        return { ok: true };
      }
    }
    return { ok: false, error: "no_such_response" };
  });
}

/* ───────────────────────── Sheet automation ───────────────────────── */

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu("Wedding site")
    .addItem("Set up tabs & protections", "setup")
    .addItem("Generate missing codes & links", "refreshGuests")
    .addToUi();
}

/**
 * Installable edit trigger (created by setup), so it runs as the owner and can
 * write to protected columns even when a helper makes the edit.
 */
function handleEdit(e) {
  const tab = e.range.getSheet();
  const name = tab.getName();

  if (name === TABS.guests) {
    fillCodesAndLinks_(tab, e.range.getRow(), e.range.getNumRows());
    return;
  }

  const responseTab = RESPONSE_TABS[name];
  if (!responseTab) return;
  const cols = headerIndex_(tab);
  const statusCol = cols["Status"] + 1;
  const first = e.range.getRow();
  const last = first + e.range.getNumRows() - 1;
  if (statusCol < e.range.getColumn() || statusCol > e.range.getLastColumn()) return;

  for (let r = Math.max(first, 2); r <= last; r++) {
    const row = tab.getRange(r, 1, 1, tab.getLastColumn()).getDisplayValues()[0];
    if (row[cols["Status"]] === "Confirmed") {
      confirmGuest_(row[cols["Code"]], row[cols["Name"]], responseTab);
    }
  }
}

/** Marks a confirmed asoebi/groomsmen guest on the Guests tab. */
function confirmGuest_(code, name, responseTab) {
  const guests = tabOrCreate_(TABS.guests);
  const cols = headerIndex_(guests);
  const values = guests.getDataRange().getValues();

  let rowIndex = -1;
  for (let r = 1; r < values.length; r++) {
    if (code && String(values[r][cols["Code"]]) === code) { rowIndex = r; break; }
  }

  if (rowIndex === -1) {
    // Their Guests row was deleted after they registered: add them back.
    const row = new Array(GUEST_HEADERS.length).fill("");
    row[cols["Code"]] = code || newCode_(values, cols["Code"]);
    row[cols["Name"]] = name;
    row[cols["Category"]] = "Others";
    row[cols["Source"]] = responseTab.source;
    row[cols["Plus One"]] = 1;
    row[cols[responseTab.flag]] = true;
    guests.appendRow(row);
    fillCodesAndLinks_(guests, guests.getLastRow(), 1);
    return;
  }

  const sheetRow = rowIndex + 1;
  const source = String(values[rowIndex][cols["Source"]] || "");
  const sources = source.split(",").map(function (s) { return s.trim(); })
    .filter(function (s) { return s && s !== "Direct"; });
  if (sources.indexOf(responseTab.source) === -1) sources.push(responseTab.source);
  guests.getRange(sheetRow, cols["Source"] + 1).setValue(sources.join(", "));

  const plusOne = Number(values[rowIndex][cols["Plus One"]]) || 0;
  if (plusOne < 1) guests.getRange(sheetRow, cols["Plus One"] + 1).setValue(1);
}

/** Gives rows with a name a unique code, and writes their personal links. */
function fillCodesAndLinks_(guests, startRow, numRows) {
  const cols = headerIndex_(guests);
  if (cols["Code"] === undefined || cols["Name"] === undefined) return;
  const all = guests.getDataRange().getValues();
  const from = Math.max(startRow, 2);
  const to = Math.min(startRow + numRows - 1, all.length);

  for (let r = from; r <= to; r++) {
    const row = all[r - 1];
    const name = String(row[cols["Name"]] || "").trim();
    if (!name) continue;

    let code = String(row[cols["Code"]] || "");
    if (!code) {
      code = newCode_(all, cols["Code"]);
      all[r - 1][cols["Code"]] = code;
      guests.getRange(r, cols["Code"] + 1).setValue(code);
    }

    const first = encodeURIComponent(name.split(/\s+/)[0].toLowerCase());
    Object.keys(RESPONSE_TABS).forEach(function (key) {
      const t = RESPONSE_TABS[key];
      if (cols[t.linkHeader] === undefined) return;
      const link = row[cols[t.flag]] === true ? SITE_URL + t.path + "?n=" + first + "&c=" + code : "";
      guests.getRange(r, cols[t.linkHeader] + 1).setValue(link);
    });
  }
}

function newCode_(rows, codeCol) {
  const used = {};
  rows.forEach(function (row) { used[String(row[codeCol])] = true; });
  for (;;) {
    let code = "";
    for (let i = 0; i < 6; i++) {
      code += CODE_ALPHABET.charAt(Math.floor(Math.random() * CODE_ALPHABET.length));
    }
    if (!used[code]) return code;
  }
}

/* ───────────────────────── Menu actions ───────────────────────── */

/** Creates/repairs tabs, headers, dropdowns, checkboxes, protections and the edit trigger. */
function setup() {
  const book = SpreadsheetApp.getActiveSpreadsheet();

  const guests = tabOrCreate_(TABS.guests);
  ensureHeaders_(guests, GUEST_HEADERS);
  const g = headerIndex_(guests);
  column_(guests, g["Category"]).setDataValidation(
    SpreadsheetApp.newDataValidation().requireValueInList(CATEGORIES, true).build(),
  );
  column_(guests, g["Asoebi"]).insertCheckboxes();
  column_(guests, g["Groomsmen"]).insertCheckboxes();
  column_(guests, g["Plus One"]).setDataValidation(
    SpreadsheetApp.newDataValidation().requireNumberBetween(0, 10).build(),
  );
  guests.setFrozenRows(1);

  Object.keys(RESPONSE_TABS).forEach(function (name) {
    const tab = tabOrCreate_(name);
    ensureHeaders_(tab, RESPONSE_HEADERS);
    const c = headerIndex_(tab);
    column_(tab, c["Status"]).setDataValidation(
      SpreadsheetApp.newDataValidation().requireValueInList(STATUSES, true).build(),
    );
    tab.setFrozenRows(1);
  });

  // Lock the columns the website writes. Status (and the couple's own columns) stay editable.
  book.getProtections(SpreadsheetApp.ProtectionType.RANGE).forEach(function (p) {
    if (p.getDescription() === PROTECTION_NOTE) p.remove();
  });
  ["Code", "Source", "Asoebi Link", "Groomsmen Link"].forEach(function (h) {
    protect_(column_(guests, g[h], true));
  });
  Object.keys(RESPONSE_TABS).forEach(function (name) {
    const tab = book.getSheetByName(name);
    const c = headerIndex_(tab);
    RESPONSE_HEADERS.forEach(function (h) {
      if (h !== "Status") protect_(column_(tab, c[h], true));
    });
  });

  const hasTrigger = ScriptApp.getProjectTriggers().some(function (t) {
    return t.getHandlerFunction() === "handleEdit";
  });
  if (!hasTrigger) ScriptApp.newTrigger("handleEdit").forSpreadsheet(book).onEdit().create();

  refreshGuests();
}

function refreshGuests() {
  const guests = tabOrCreate_(TABS.guests);
  fillCodesAndLinks_(guests, 2, Math.max(guests.getLastRow() - 1, 0));
}

/* ───────────────────────── Helpers ───────────────────────── */

function reply_(payload) {
  return ContentService.createTextOutput(JSON.stringify(payload)).setMimeType(
    ContentService.MimeType.JSON,
  );
}

function withLock_(fn) {
  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    return fn();
  } finally {
    lock.releaseLock();
  }
}

function tabOrCreate_(name) {
  const book = SpreadsheetApp.getActiveSpreadsheet();
  return book.getSheetByName(name) || book.insertSheet(name);
}

/** Header text → 0-based column index. */
function headerIndex_(tab) {
  const width = Math.max(tab.getLastColumn(), 1);
  const headers = tab.getRange(1, 1, 1, width).getDisplayValues()[0];
  const index = {};
  headers.forEach(function (h, i) { if (h) index[h.trim()] = i; });
  return index;
}

/** Writes any missing headers at the end of row 1, keeping existing columns in place. */
function ensureHeaders_(tab, headers) {
  const existing = headerIndex_(tab);
  let next = tab.getLastColumn() + 1;
  headers.forEach(function (h) {
    if (existing[h] === undefined) {
      tab.getRange(1, next).setValue(h).setFontWeight("bold");
      next++;
    }
  });
}

/** Data rows (2…ROWS_TO_FORMAT) of a column; with includeHeader, the whole column. */
function column_(tab, index, includeHeader) {
  const startRow = includeHeader ? 1 : 2;
  return tab.getRange(startRow, index + 1, ROWS_TO_FORMAT - startRow + 1, 1);
}

function protect_(range) {
  const p = range.protect().setDescription(PROTECTION_NOTE);
  p.removeEditors(p.getEditors());
  if (p.canDomainEdit()) p.setDomainEdit(false);
}
