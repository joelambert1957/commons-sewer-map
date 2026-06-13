(function(){
  "use strict";

  const API_URL = "/.netlify/functions/markers";
  const CACHE_KEY = "commons_sewer_markers_cache_v1";

  const TYPE_META = {
    manhole:  { color: "var(--manhole)", label: "Manhole",   short: "MH" },
    cleanout: { color: "var(--cleanout)", label: "Cleanout",  short: "CO" },
    root:     { color: "var(--root)",     label: "Root/Repair", short: "RT" },
    note:     { color: "var(--accent)",   label: "Note",     short: "N" }
  };

  const stage = document.getElementById("stage");
  const img = document.getElementById("blueprint");
  const layer = document.getElementById("markers-layer");
  const entryList = document.getElementById("entry-list");
  const entryCount = document.getElementById("entry-count");
  const hintText = document.getElementById("hint-text");

  const popupBackdrop = document.getElementById("popup-backdrop");
  const popupTitle = document.getElementById("popup-title-icon");
  const popupLabel = document.getElementById("popup-label");
  const popupNotes = document.getElementById("popup-notes");
  const popupMeta = document.getElementById("popup-meta");
  const popupSave = document.getElementById("popup-save");
  const popupDelete = document.getElementById("popup-delete");
  const popupCancel = document.getElementById("popup-cancel");

  let currentMode = "none";
  let pendingMarker = null;
  let editingMarker = null;
  let markers = [];
  let saving = false;

  // ---------- Status banner ----------
  const statusBanner = document.createElement("div");
  statusBanner.style.cssText = "text-align:center;font-family:'Trebuchet MS',sans-serif;font-size:0.78rem;padding:4px;color:#9a93a8;";
  document.querySelector(".toolbar").insertAdjacentElement("afterend", statusBanner);
  function setStatus(msg, isError){
    statusBanner.textContent = msg;
    statusBanner.style.color = isError ? "#8a3b3b" : "#9a93a8";
  }

  // ---------- Persistence (shared via Netlify function) ----------
  async function loadMarkers(){
    // show cached copy instantly while we fetch the live version
    try{
      const cached = localStorage.getItem(CACHE_KEY);
      if(cached){
        markers = JSON.parse(cached);
        renderMarkers();
      }
    }catch(e){ /* ignore */ }

    try{
      setStatus("Loading shared map data…");
      const res = await fetch(API_URL);
      if(!res.ok) throw new Error("Server returned " + res.status);
      const data = await res.json();
      if(Array.isArray(data) && data.length > 0){
        markers = data;
      } else if(markers.length === 0 && window.SEED_MARKERS){
        // first-ever load: seed the shared store
        markers = JSON.parse(JSON.stringify(window.SEED_MARKERS));
        await saveMarkers();
      }
      localStorage.setItem(CACHE_KEY, JSON.stringify(markers));
      setStatus("Showing the latest shared map data.");
      renderMarkers();
    }catch(err){
      console.error("Failed to load shared markers", err);
      if(markers.length === 0 && window.SEED_MARKERS){
        markers = JSON.parse(JSON.stringify(window.SEED_MARKERS));
        renderMarkers();
      }
      setStatus("Couldn't reach the shared map server — showing your last saved copy. Changes may not be shared until the connection is restored.", true);
    }
  }

  async function saveMarkers(){
    localStorage.setItem(CACHE_KEY, JSON.stringify(markers));
    try{
      saving = true;
      setStatus("Saving…");
      const res = await fetch(API_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(markers)
      });
      if(!res.ok) throw new Error("Server returned " + res.status);
      setStatus("Saved — visible to everyone with this link.");
    }catch(err){
      console.error("Failed to save shared markers", err);
      setStatus("Saved on this device only — couldn't reach the shared map server. Try again later.", true);
    }finally{
      saving = false;
    }
  }

  // ---------- Mode toggling ----------
  const modeButtons = document.querySelectorAll(".toolbar button[data-mode]");
  modeButtons.forEach(btn => {
    btn.addEventListener("click", () => {
      currentMode = btn.dataset.mode;
      modeButtons.forEach(b => b.classList.toggle("active", b === btn));
      if(currentMode === "none"){
        stage.classList.remove("placing");
        hintText.textContent = "Click a marker type, then click on the map to place it.";
      } else {
        stage.classList.add("placing");
        hintText.textContent = "Click on the map to drop a " + TYPE_META[currentMode].label.toLowerCase() + " marker.";
      }
    });
  });

  // ---------- Placing markers ----------
  stage.addEventListener("click", (e) => {
    if(currentMode === "none") return;
    if(e.target.closest(".marker")) return;

    const rect = img.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    if(x < 0 || x > 100 || y < 0 || y > 100) return;

    pendingMarker = {
      id: "m_" + Date.now() + "_" + Math.floor(Math.random()*1000),
      type: currentMode,
      x: x, y: y,
      label: "",
      notes: ""
    };
    editingMarker = null;
    openPopup(pendingMarker, true);
  });

  // ---------- Rendering ----------
  function renderMarkers(){
    layer.innerHTML = "";
    markers.forEach(m => {
      const el = document.createElement("div");
      el.className = "marker " + m.type;
      el.style.left = m.x + "%";
      el.style.top = m.y + "%";

      let shapeHtml = "";
      if(m.type === "manhole"){
        shapeHtml = `<div class="circle"></div>`;
      } else if(m.type === "cleanout"){
        shapeHtml = `<div class="tri-shape"></div>`;
      } else if(m.type === "root"){
        shapeHtml = `<div class="diamond-shape"></div>`;
      } else {
        shapeHtml = `<div class="note-shape">!</div>`;
      }
      el.innerHTML = shapeHtml + (m.label ? `<div class="label-pill">${escapeHtml(m.label)}</div>` : "");

      el.addEventListener("click", (ev) => {
        ev.stopPropagation();
        if(currentMode !== "none") return;
        editingMarker = m;
        pendingMarker = null;
        openPopup(m, false);
      });

      layer.appendChild(el);
    });
    renderEntryList();
  }

  function renderEntryList(){
    entryCount.textContent = markers.length;
    if(markers.length === 0){
      entryList.innerHTML = `<p class="empty-msg">No markers yet — start by placing a manhole or cleanout above.</p>`;
      return;
    }
    const order = { manhole:0, cleanout:1, root:2, note:3 };
    const sorted = [...markers].sort((a,b) => (order[a.type]-order[b.type]) || a.label.localeCompare(b.label));
    entryList.innerHTML = sorted.map(m => {
      const meta = TYPE_META[m.type];
      return `<div class="entry" data-id="${m.id}">
        <div class="e-left">
          <span class="e-tag" style="background:${meta.color}">${meta.short}</span>
          <div>
            <div><strong>${escapeHtml(m.label || "(unlabeled)")}</strong></div>
            ${m.notes ? `<div class="e-note">${escapeHtml(truncate(m.notes, 90))}</div>` : ""}
          </div>
        </div>
        <div class="e-meta">${m.seeded ? "est." : ""}</div>
      </div>`;
    }).join("");

    entryList.querySelectorAll(".entry").forEach(el => {
      el.addEventListener("click", () => {
        const m = markers.find(mm => mm.id === el.dataset.id);
        if(m){
          editingMarker = m;
          pendingMarker = null;
          openPopup(m, false);
        }
      });
    });
  }

  function truncate(s, n){ return s.length > n ? s.slice(0,n-1) + "…" : s; }
  function escapeHtml(s){
    return String(s).replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  }

  // ---------- Popup ----------
  function openPopup(marker, isNew){
    const meta = TYPE_META[marker.type];
    popupTitle.innerHTML = `<span class="type-tag" style="background:${meta.color}">${meta.label}</span> ${isNew ? "New marker" : "Edit marker"}`;
    popupLabel.value = marker.label || "";
    popupNotes.value = marker.notes || "";
    popupMeta.textContent = marker.seeded ? "Estimated location from the original utility plan — please verify on-site." : "";
    popupDelete.style.display = isNew ? "none" : "inline-block";
    popupBackdrop.classList.add("open");
    popupLabel.focus();
  }
  function closePopup(){
    popupBackdrop.classList.remove("open");
    pendingMarker = null;
    editingMarker = null;
  }

  popupCancel.addEventListener("click", closePopup);
  popupBackdrop.addEventListener("click", (e) => {
    if(e.target === popupBackdrop) closePopup();
  });

  popupSave.addEventListener("click", async () => {
    const label = popupLabel.value.trim();
    const notes = popupNotes.value.trim();
    if(pendingMarker){
      pendingMarker.label = label;
      pendingMarker.notes = notes;
      markers.push(pendingMarker);
    } else if(editingMarker){
      editingMarker.label = label;
      editingMarker.notes = notes;
      delete editingMarker.seeded;
    }
    renderMarkers();
    closePopup();
    await saveMarkers();
  });

  popupDelete.addEventListener("click", async () => {
    if(editingMarker){
      markers = markers.filter(m => m.id !== editingMarker.id);
      renderMarkers();
      await saveMarkers();
    }
    closePopup();
  });

  // ---------- Export / Import ----------
  document.getElementById("export-btn").addEventListener("click", () => {
    const blob = new Blob([JSON.stringify(markers, null, 2)], {type: "application/json"});
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    const ts = new Date().toISOString().slice(0,10);
    a.href = url;
    a.download = `commons-sewer-markers-${ts}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  });

  const importInput = document.getElementById("import-file");
  document.getElementById("import-btn").addEventListener("click", () => importInput.click());
  importInput.addEventListener("change", (e) => {
    const file = e.target.files[0];
    if(!file) return;
    const reader = new FileReader();
    reader.onload = async (ev) => {
      try{
        const incoming = JSON.parse(ev.target.result);
        if(!Array.isArray(incoming)) throw new Error("Invalid file format");
        let added = 0, skipped = 0;
        incoming.forEach(m => {
          if(!m.id || markers.some(existing => existing.id === m.id)){
            m.id = "m_" + Date.now() + "_" + Math.floor(Math.random()*100000);
          }
          if(m.type && TYPE_META[m.type] && typeof m.x === "number" && typeof m.y === "number"){
            markers.push(m);
            added++;
          } else {
            skipped++;
          }
        });
        renderMarkers();
        await saveMarkers();
        alert(`Imported ${added} marker(s) into the shared map.` + (skipped ? ` Skipped ${skipped} invalid entr${skipped===1?"y":"ies"}.` : ""));
      }catch(err){
        alert("Could not read that file — make sure it's a markers .json file exported from this map.");
      }
    };
    reader.readAsText(file);
    importInput.value = "";
  });

  // ---------- Print ----------
  document.getElementById("print-btn").addEventListener("click", () => window.print());

  // ---------- Zoom ----------
  let zoom = 1;
  function applyZoom(){
    const inner = document.getElementById("zoom-inner");
    inner.style.transform = `scale(${zoom})`;
    inner.style.transformOrigin = "top left";
    inner.style.width = (100/zoom) + "%";
  }
  document.getElementById("zoom-in").addEventListener("click", () => { zoom = Math.min(zoom + 0.25, 3); applyZoom(); });
  document.getElementById("zoom-out").addEventListener("click", () => { zoom = Math.max(zoom - 0.25, 1); applyZoom(); });
  document.getElementById("zoom-reset").addEventListener("click", () => { zoom = 1; applyZoom(); });

  // ---------- Init ----------
  function positionLayer(){
    layer.style.position = "absolute";
    layer.style.top = "0";
    layer.style.left = "0";
    layer.style.width = "100%";
    layer.style.height = "100%";
  }
  window.addEventListener("resize", positionLayer);
  img.addEventListener("load", positionLayer);

  positionLayer();
  loadMarkers();

  // Refresh from server periodically so people see others' new pins
  setInterval(() => {
    if(!saving && popupBackdrop.classList.contains("open") === false){
      loadMarkers();
    }
  }, 30000);
})();
