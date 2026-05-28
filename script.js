const pasteBox = document.getElementById("pasteBox");
const preview = document.getElementById("preview");
const statusEl = document.getElementById("status");
const printTitle = document.getElementById("printTitle");

let rows = [];

function normaliseText(value) {
  return String(value || "")
    .replaceAll("\u00a0", " ")
    .trim();
}

function colourLooksHighlighted(styleText) {
  const style = String(styleText || "").toLowerCase();
  return style.includes("background") && (
    style.includes("yellow") ||
    style.includes("#ffff00") ||
    style.includes("#fff200") ||
    style.includes("rgb(255, 255, 0)") ||
    style.includes("rgb(255,255,0)")
  );
}

function elementIsHighlighted(element) {
  if (!element || element.nodeType !== 1) return false;

  if (colourLooksHighlighted(element.getAttribute("style"))) return true;

  const bgcolor = String(element.getAttribute("bgcolor") || "").toLowerCase();
  return ["yellow", "#ffff00", "#fff200", "ffff00"].includes(bgcolor);
}

function rowHasExcelHighlight(tr) {
  if (elementIsHighlighted(tr)) return true;
  return Array.from(tr.querySelectorAll("td, th, span, font, div")).some(elementIsHighlighted);
}

function isDeceasedEntry(name) {
  const nameRaw = String(name || "").trim().toLowerCase();

  return (
    nameRaw.startsWith("故") ||
    nameRaw.startsWith("已故") ||
    nameRaw.startsWith("仙逝") ||
    nameRaw.startsWith("往生") ||
    nameRaw.includes("众生") ||
    nameRaw.includes("眾生") ||
    nameRaw.includes("歷代") ||
    nameRaw.includes("历代") ||
    nameRaw.includes("祖宗") ||
    nameRaw.includes("祖先") ||
    nameRaw.includes("冤亲债主") ||
    nameRaw.includes("冤親債主") ||
    nameRaw.includes("sentient beings") ||
    nameRaw.includes("all sentient beings") ||
    nameRaw.includes("karmic creditors")
  );
}

function prepareRow(no, name, excelHighlighted = false) {
  const exactNo = String(no || "").trim();
  const exactName = String(name || "").trim();

  return {
    no: exactNo,
    name: exactName,
    deceased: isDeceasedEntry(exactName),
    highlight: excelHighlighted || isDeceasedEntry(exactName)
  };
}

function parseHtmlTable(html) {
  const doc = new DOMParser().parseFromString(html, "text/html");
  const trs = Array.from(doc.querySelectorAll("tr"));
  if (!trs.length) return [];

  return trs.map(tr => {
    const cells = Array.from(tr.querySelectorAll("td, th")).map(td => normaliseText(td.textContent));
    const useful = cells.filter(Boolean);
    if (!useful.length) return null;

    let no = useful[0] || "";
    let name = useful.slice(1).join(" ");

    if (!name) {
      const match = useful[0].match(/^(\S+)\s+(.+)$/);
      if (match) {
        no = match[1];
        name = match[2];
      }
    }

    return prepareRow(no, name, rowHasExcelHighlight(tr));
  }).filter(Boolean);
}

function parsePlainText(text) {
  return String(text || "")
    .split(/\r?\n/)
    .map(line => line.trim())
    .filter(Boolean)
    .map(line => {
      const parts = line.split(/\t+/).map(normaliseText).filter(Boolean);

      if (parts.length >= 2) {
        return prepareRow(parts[0], parts.slice(1).join("\t"), false);
      }

      const match = line.match(/^(\S+)\s+(.+)$/);
      return match
        ? prepareRow(match[1], match[2], false)
        : prepareRow("", line, false);
    });
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

pasteBox.addEventListener("paste", event => {
  event.preventDefault();

  const html = event.clipboardData.getData("text/html");
  const text = event.clipboardData.getData("text/plain");

  rows = html ? parseHtmlTable(html) : parsePlainText(text);

  pasteBox.innerHTML = rows.map(row => {
    const style = row.highlight ? " style='background:#fff200;color:#d71920;font-weight:800;'" : "";
    return `<div${style}>${escapeHtml(row.no)}\t${escapeHtml(row.name)}</div>`;
  }).join("");

  updateStatus();
  buildPreview();
});

function readRowsFromPasteBoxIfNeeded() {
  if (rows.length) return;
  rows = parsePlainText(pasteBox.innerText);
}

function chunkRows(items, columns) {
  const perColumn = Math.ceil(items.length / columns);
  return Array.from({ length: columns }, (_, index) => {
    const start = index * perColumn;
    return items.slice(start, start + perColumn);
  });
}

function buildPreview() {
  readRowsFromPasteBoxIfNeeded();
  applySettings();

  if (!rows.length) {
    preview.className = "emptyHint";
    preview.textContent = "Paste your Excel list, then click Build Preview.";
    updateStatus();
    return;
  }

  const columns = Number(document.getElementById("columnsInput").value) || 4;
  const groups = chunkRows(rows, columns);

  preview.className = "grid";
  preview.style.gridTemplateColumns = `repeat(${columns}, 1fr)`;
  preview.innerHTML = "";

  groups.forEach(group => {
    const table = document.createElement("table");
    table.className = "nameTable";
    const tbody = document.createElement("tbody");

    group.forEach(row => {
      const tr = document.createElement("tr");
      if (row.highlight) tr.classList.add("highlight");

      const tdNo = document.createElement("td");
      tdNo.className = "num";
      tdNo.textContent = row.no;

      const tdName = document.createElement("td");
      tdName.textContent = row.name;

      tr.append(tdNo, tdName);
      tbody.appendChild(tr);
    });

    table.appendChild(tbody);
    preview.appendChild(table);
  });

  updateStatus();
}

function applySettings() {
  const title = document.getElementById("titleInput").value.trim();
  const fontSize = Number(document.getElementById("fontInput").value) || 8;
  const rowHeight = Number(document.getElementById("rowHeightInput").value) || 5.1;
  const paperMode = document.getElementById("paperSelect").value;

  printTitle.textContent = title;
  document.documentElement.style.setProperty("--print-font-size", `${fontSize}pt`);
  document.documentElement.style.setProperty("--row-height", `${rowHeight}mm`);

  if (paperMode === "A3P") {
    document.documentElement.style.setProperty("--paper-width", "297mm");
    document.documentElement.style.setProperty("--paper-height", "420mm");
  } else {
    document.documentElement.style.setProperty("--paper-width", "420mm");
    document.documentElement.style.setProperty("--paper-height", "297mm");
  }
}

function autoFit() {
  readRowsFromPasteBoxIfNeeded();

  const count = rows.length;
  if (!count) return;

  let columns = 4;
  let font = 8;
  let rowHeight = 5.1;

  if (count > 900) columns = 6;
  else if (count > 650) columns = 5;
  else if (count > 380) columns = 4;
  else columns = 3;

  if (count > 1100) {
    font = 6.2;
    rowHeight = 3.8;
  } else if (count > 900) {
    font = 6.8;
    rowHeight = 4.2;
  } else if (count > 650) {
    font = 7.2;
    rowHeight = 4.6;
  }

  document.getElementById("columnsInput").value = columns;
  document.getElementById("fontInput").value = font;
  document.getElementById("rowHeightInput").value = rowHeight;

  buildPreview();
}

function updateStatus() {
  const highlighted = rows.filter(row => row.highlight).length;
  const deceased = rows.filter(row => row.deceased).length;
  statusEl.textContent = `${rows.length} rows loaded. ${highlighted} highlighted rows detected. ${deceased} deceased or special dedication rows auto highlighted.`;
}

document.getElementById("buildBtn").addEventListener("click", buildPreview);

document.getElementById("fitBtn").addEventListener("click", autoFit);

document.getElementById("printBtn").addEventListener("click", () => {
  buildPreview();
  window.print();
});

document.getElementById("clearBtn").addEventListener("click", () => {
  rows = [];
  pasteBox.innerHTML = "";
  buildPreview();
});

document.getElementById("sampleBtn").addEventListener("click", () => {
  rows = [
    prepareRow("M0001", "何呂艾璇"),
    prepareRow("M0002", "SMJ地毯私人有限公司"),
    prepareRow("M0022", "十方法界一切众生"),
    prepareRow("M0023", "蔡门冤亲债主"),
    prepareRow("M0031", "故 郑碧英 @花"),
    prepareRow("M0040", "故 Chew Soh Choo"),
    prepareRow("M0085", "Mr And Mrs Yeo Eng Teck")
  ];

  pasteBox.innerHTML = rows.map(row => {
    const style = row.highlight ? " style='background:#fff200;color:#d71920;font-weight:800;'" : "";
    return `<div${style}>${escapeHtml(row.no)}\t${escapeHtml(row.name)}</div>`;
  }).join("");

  buildPreview();
});

["titleInput", "columnsInput", "fontInput", "rowHeightInput", "paperSelect"].forEach(id => {
  document.getElementById(id).addEventListener("input", buildPreview);
});
