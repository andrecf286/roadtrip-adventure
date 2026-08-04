/**
 * The client. One HTML document, rendered from JSON.
 *
 * Written without template literals on purpose: this whole thing lives inside a
 * String.raw template, so a backtick or a dollar-brace in here would interpolate
 * at build time and corrupt the page. Concatenation is the price of shipping the
 * client as a string, and it is a small one.
 *
 * The design is the prototype Andy approved: light and high-contrast because it
 * gets used outdoors where glare kills dark mode, and the primary action pinned
 * low because the top third of a 6.3in phone is unreachable one-handed and
 * "record a stop" gets pressed while holding a fuel nozzle.
 */

export const SHELL = String.raw`<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-status-bar-style" content="default">
<meta name="theme-color" content="#fbf9f6">
<title>Roadtrip Adventure</title>
<style>
  :root{
    --ink:#14110e; --ink-2:#57514a; --ink-3:#8b837a;
    --paper:#fbf9f6; --card:#fff; --line:#e6e0d8;
    --road:#1f6f5c; --road-soft:#e7f2ee;
    --sun:#c8621f; --sun-soft:#fdefe3;
    --tap:#f2ede6; --r:14px; --nav-h:76px;
    --safe-top:env(safe-area-inset-top,0px);
    --safe-bot:env(safe-area-inset-bottom,0px);
  }
  *{box-sizing:border-box;-webkit-tap-highlight-color:transparent}
  html,body{margin:0;padding:0;background:var(--paper);color:var(--ink);
    font-family:-apple-system,BlinkMacSystemFont,"SF Pro Text","Segoe UI",Roboto,sans-serif;
    overscroll-behavior-y:none}
  .screen{display:none;min-height:100dvh;padding:calc(20px + var(--safe-top)) 18px calc(var(--nav-h) + 58px + var(--safe-bot))}
  .screen.on{display:block}
  h1{font-size:27px;line-height:1.15;margin:0 0 3px;letter-spacing:-.5px}
  h2{font-size:12px;text-transform:uppercase;letter-spacing:.9px;color:var(--ink-3);margin:24px 0 9px;font-weight:600}
  .sub{color:var(--ink-2);font-size:14px;margin:0 0 18px}
  .card{background:var(--card);border:1px solid var(--line);border-radius:var(--r);padding:14px}
  .card + .card{margin-top:9px}
  .tapme{cursor:pointer;position:relative;padding-right:34px}
  .tapme:active{background:var(--tap)}
  .tapme::after{content:"\203A";position:absolute;right:15px;top:50%;transform:translateY(-52%);font-size:25px;color:#c3bab0;line-height:1}
  .live{display:inline-flex;align-items:center;gap:6px;background:var(--road-soft);color:var(--road);
    font-size:12px;font-weight:600;padding:5px 10px;border-radius:99px;margin-bottom:12px}
  .live.parked{background:#f1eee9;color:var(--ink-3)}
  .dot{width:7px;height:7px;border-radius:50%;background:currentColor;animation:p 2s infinite}
  @keyframes p{0%,100%{opacity:1}50%{opacity:.25}}
  .stats{display:grid;grid-template-columns:1fr 1fr;gap:11px;margin:16px 0 4px}
  .stat{background:var(--card);border:1px solid var(--line);border-radius:var(--r);padding:12px 13px}
  .stat span{display:block;font-size:25px;font-weight:640;letter-spacing:-.5px;line-height:1.1}
  .stat small{color:var(--ink-3);font-size:11px;text-transform:uppercase;letter-spacing:.6px}
  .stat .qual{color:var(--ink-3);font-size:10.5px;letter-spacing:0;text-transform:none;display:block;margin-top:1px}
  .actionbar{position:fixed;left:0;right:0;bottom:var(--nav-h);padding:12px 18px 14px;
    background:linear-gradient(to top,var(--paper) 62%,rgba(251,249,246,0));z-index:40;max-width:640px;margin:0 auto}
  .bigbtn{display:block;width:100%;border:0;border-radius:16px;background:var(--sun);color:#fff;
    font:inherit;font-size:17.5px;font-weight:660;padding:19px;cursor:pointer;box-shadow:0 5px 16px rgba(200,98,31,.32)}
  .bigbtn:active{transform:translateY(1px)}
  .bigbtn[disabled]{opacity:.5}
  .ghostbtn{display:block;width:100%;border:1px solid var(--line);border-radius:14px;background:var(--card);
    color:var(--ink);font:inherit;font-size:15.5px;font-weight:600;padding:15px;cursor:pointer;margin-top:9px;text-decoration:none;text-align:center}
  .grid{display:grid;grid-template-columns:1fr 1fr;gap:10px}
  .kind{background:var(--card);border:1px solid var(--line);border-radius:var(--r);padding:17px 12px;
    text-align:center;cursor:pointer;min-height:96px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:7px}
  .kind:active{background:var(--tap)}
  .kind .ic{font-size:26px;line-height:1}
  .kind .lb{font-size:14.5px;font-weight:600}
  .row{display:flex;justify-content:space-between;align-items:baseline;gap:10px}
  .muted{color:var(--ink-2);font-size:13.5px}
  .tiny{color:var(--ink-3);font-size:12px}
  .conf{font-variant-numeric:tabular-nums;font-weight:640}
  .kv{display:flex;justify-content:space-between;padding:11px 0;border-bottom:1px solid var(--line);font-size:14.5px;gap:12px}
  .kv:last-child{border-bottom:0}
  .kv b{text-align:right}
  ul.check{list-style:none;margin:0;padding:0}
  ul.check li{display:flex;gap:10px;padding:11px 0;border-bottom:1px solid var(--line);font-size:14.5px;line-height:1.35;cursor:pointer}
  ul.check li:last-child{border-bottom:0}
  .box{width:21px;height:21px;border-radius:6px;border:1.5px solid #cbc3b8;flex:none;margin-top:1px}
  .box.done{background:var(--road);border-color:var(--road);position:relative}
  .box.done::after{content:"";position:absolute;left:6.5px;top:2.5px;width:5px;height:10px;border:solid #fff;border-width:0 2px 2px 0;transform:rotate(42deg)}
  .done-txt{color:var(--ink-3);text-decoration:line-through}
  .hers{color:var(--sun);font-size:13px;font-style:italic;margin-top:3px;display:block}
  .day{display:flex;gap:13px;padding:13px 0;border-bottom:1px solid var(--line);cursor:pointer}
  .day:active{background:var(--tap)}
  .daynum{width:38px;flex:none;text-align:center}
  .daynum b{display:block;font-size:19px;line-height:1;font-weight:660}
  .daynum small{font-size:10px;color:var(--ink-3);text-transform:uppercase}
  .maparea{position:relative;height:340px;border-radius:var(--r);overflow:hidden;border:1px solid var(--line);background:#eef1ec}
  .badges{display:flex;flex-wrap:wrap;gap:7px;margin-top:12px}
  .badge{background:var(--road-soft);color:var(--road);border-radius:99px;padding:7px 12px;font-size:12.5px;font-weight:600}
  .navbar{position:fixed;left:0;right:0;bottom:0;height:calc(var(--nav-h) + var(--safe-bot));
    background:rgba(251,249,246,.96);backdrop-filter:blur(12px);border-top:1px solid var(--line);
    display:flex;z-index:45;padding-bottom:var(--safe-bot);max-width:640px;margin:0 auto}
  .navbar button{flex:1;min-width:0;border:0;background:none;font:inherit;font-size:10.5px;
    letter-spacing:-.1px;color:var(--ink-3);display:flex;flex-direction:column;align-items:center;
    justify-content:center;gap:4px;cursor:pointer;padding:8px 2px;border-radius:11px;margin:6px 2px;
    white-space:nowrap}
  .navbar button .ic{font-size:22px;line-height:1}
  .navbar button.on{color:var(--sun);font-weight:640;background:var(--sun-soft)}
  .back{position:sticky;top:calc(6px + var(--safe-top));z-index:50;border:0;background:rgba(255,255,255,.92);
    border-radius:99px;width:38px;height:38px;font-size:18px;cursor:pointer;box-shadow:0 1px 4px rgba(0,0,0,.1);margin-bottom:6px}
  textarea{width:100%;border:1px solid var(--line);border-radius:var(--r);padding:13px;font:inherit;font-size:15px;min-height:130px;resize:vertical;background:var(--card)}
  input[type=number],input[type=text]{width:100%;border:1px solid var(--line);border-radius:12px;padding:13px;font:inherit;font-size:16px;background:var(--card)}
  .queued{position:fixed;left:12px;right:12px;bottom:calc(var(--nav-h) + var(--safe-bot) + 84px);z-index:60;
    background:var(--ink);color:#fff;border-radius:12px;padding:11px 14px;font-size:13px;display:none;max-width:616px;margin:0 auto}
  .queued.on{display:block}
  .empty{color:var(--ink-3);font-size:14px;padding:14px 0}
  body{max-width:640px;margin:0 auto}
</style>
</head>
<body>
  <section class="screen on" id="s-today"></section>
  <section class="screen" id="s-trip"></section>
  <section class="screen" id="s-map"></section>
  <section class="screen" id="s-places"></section>
  <section class="screen" id="s-day"></section>
  <section class="screen" id="s-place"></section>
  <section class="screen" id="s-res"></section>
  <section class="screen" id="s-stop"></section>
  <section class="screen" id="s-staying"></section>
  <section class="screen" id="s-journal"></section>
  <section class="screen" id="s-photos"></section>
  <section class="screen" id="s-badges"></section>

  <div class="queued" id="queued"></div>

  <nav class="navbar">
    <button class="on" data-tab="today"><span class="ic">&#128205;</span>Today</button>
    <button data-tab="trip"><span class="ic">&#128197;</span>Trip</button>
    <button data-tab="map"><span class="ic">&#128506;</span>Map</button>
    <button data-tab="photos" style="font-size:9px"><span class="ic">&#128247;&#9997;</span>Photos &middot; Journal</button>
    <button data-tab="badges"><span class="ic">&#127941;</span>Badges</button>
    <button data-tab="places"><span class="ic">&#128204;</span>Plan</button>
  </nav>

<script>
var ME = null, POS = null;

function esc(s){ return String(s==null?"":s).replace(/[&<>"]/g, function(c){
  return {"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]; }); }
function el(id){ return document.getElementById(id); }
function get(u){
  return fetch(u,{credentials:"same-origin"})
    .then(function(r){ return r.json(); })
    .catch(function(){ return null; });
}
/* Renders a recoverable message into a screen whose data never arrived,
   instead of leaving it blank. */
function offlineInto(id, retry){
  var e = el(id); if (!e) return;
  e.innerHTML = '<h1>No connection</h1><p class="sub">Can\'t load this right now.</p>' +
    '<button class="ghostbtn" onclick="' + retry + '">Try again</button>';
}
function send(u,m,b){ return fetch(u,{method:m,credentials:"same-origin",
  headers:{"content-type":"application/json"},body:JSON.stringify(b)}).then(function(r){ return r.json(); }); }

function fmtTime(iso){ if(!iso) return ""; var d=new Date(iso);
  return d.toLocaleTimeString([], {hour:"numeric", minute:"2-digit"}); }
function fmtDay(ds){ if(!ds) return ""; var d=new Date(ds+"T12:00:00");
  return d.toLocaleDateString([], {weekday:"long", month:"long", day:"numeric"}); }
function fmtShort(ds){ if(!ds) return ""; var d=new Date(ds+"T12:00:00");
  return d.toLocaleDateString([], {month:"short", day:"numeric"}); }
var ICON = {gas:"⛽",food:"🍔",campsite:"⛺",lodging:"🛏",
  event:"🎫",observation:"👀"};

/* --- Offline queue -------------------------------------------------------
   Stops are the one write that happens in a dead zone. They go to
   localStorage first and the screen says saved, because it is saved — just
   not yet on the server. Flushed whenever we regain connectivity or the app
   is reopened. The client mints the id, so a retry can never double-record. */
function queue(){ try { return JSON.parse(localStorage.getItem("rt_q")||"[]"); } catch(e){ return []; } }
function setQueue(q){ localStorage.setItem("rt_q", JSON.stringify(q)); paintQueue(); }
function enqueue(item){ var q=queue(); q.push(item); setQueue(q); flush(); }
function paintQueue(){ var n=queue().length, b=el("queued");
  b.className = n ? "queued on" : "queued";
  b.textContent = n===1 ? "1 stop waiting for signal" : n+" stops waiting for signal"; }
function flush(){
  var q=queue(); if(!q.length) return Promise.resolve();
  var item=q[0];
  return send("/api/stop","POST",item).then(function(r){
    if(r && (r.ok || r.error==="bad kind")){ var rest=queue().slice(1); setQueue(rest); return flush(); }
  }).catch(function(){ /* still offline; try again later */ });
}
window.addEventListener("online", flush);

/* The app updates many times a day right now, and open phones kept serving
   the old shell until somebody texted "close it and reopen." The served
   shell hashes itself; when the hash moves, a bar offers one-tap refresh.
   Never auto-reloads — half-typed journal entries outrank freshness. */
var APP_V = null;
function checkVersion(){
  get("/api/version").then(function(v){
    if (!v || !v.v) return;
    if (APP_V === null) { APP_V = v.v; return; }
    if (v.v !== APP_V) {
      var q = el("updatebar");
      if (!q) {
        q = document.createElement("div");
        q.id = "updatebar"; q.className = "queued on";
        q.style.cursor = "pointer";
        q.innerHTML = "The app has been updated &mdash; tap to refresh";
        q.onclick = function(){ location.reload(); };
        document.body.appendChild(q);
      }
    }
  });
}
document.addEventListener("visibilitychange", function(){ if (!document.hidden) checkVersion(); });
setInterval(checkVersion, 8 * 60 * 1000);
checkVersion();

/* Delete is two taps, not a browser confirm(): a modal dialog blocks the page,
   reads as an error, and on iOS looks like the site has crashed. The first tap
   arms, the second commits, and anything else disarms it. */
var ARMED = null;
function armDelete(kind, id, ev){
  if (ev) ev.stopPropagation();
  if (ARMED === kind + ":" + id) { doDelete(kind, id); return; }
  ARMED = kind + ":" + id;
  var b = el("del-" + id);
  if (b) { b.textContent = "Delete?"; b.style.color = "#a8332a"; b.style.fontWeight = "700"; }
  setTimeout(function(){
    if (ARMED === kind + ":" + id) {
      ARMED = null;
      var bb = el("del-" + id);
      if (bb) { bb.textContent = "Delete"; bb.style.color = ""; bb.style.fontWeight = ""; }
    }
  }, 4000);
}
function doDelete(kind, id){
  ARMED = null;
  var url = kind === "journal" ? "/api/journal"
    : kind === "badge" ? "/api/badge"
    : kind === "photo" ? "/api/photo" : "/api/stop";
  // Re-render the screen the user is actually ON. Deleting a journal entry
  // from a Day screen used to teleport them to the Journal tab with a stale
  // nav highlight (QA finding) — the delete is an edit of the current view,
  // not a navigation.
  var day = el("s-day").classList.contains("on") && LAST_DAY;
  send(url, "DELETE", { id: id }).then(function(){
    if (day) loadDay(LAST_DAY);
    else if (kind === "badge") tab("badges");
    else if (kind === "journal" || kind === "observation" || kind === "photo") tab("photos");
    else tab("today");
  });
}
function delBtn(kind, id){
  if (!ME || ME.role !== "author") return "";
  return '<button id="del-' + id + '" onclick="armDelete(\'' + kind + '\',\'' + id +
    '\',event)" style="border:0;background:none;font:inherit;font-size:12px;' +
    'color:#a49a8e;cursor:pointer;padding:4px 0">Delete</button>';
}

/* --- Screens ------------------------------------------------------------- */
function show(id){
  var all=document.querySelectorAll(".screen");
  for(var i=0;i<all.length;i++) all[i].classList.toggle("on", all[i].id==="s-"+id);
  window.scrollTo(0,0);
}
function tab(name){
  var bs=document.querySelectorAll(".navbar button");
  for(var i=0;i<bs.length;i++) bs[i].classList.toggle("on", bs[i].dataset.tab===name);
  if(name==="today") loadToday();
  if(name==="trip") loadTrip();
  if(name==="map") loadMapScreen();
  if(name==="photos") loadPhotos();
  if(name==="badges") loadBadges();
  if(name==="places") loadPlaces();
  // "map" is no longer a tab — it lives at the head of Trip and opens full
  // size from there via loadMapScreen().
}

function loadToday(){
  show("today");
  get("/api/today").then(function(d){
    if (!d) { offlineInto("s-today", "loadToday()"); return; }
    POS = d.position;
    var mpg = d.mpg ? '<div class="stat"><span>'+d.mpg.value+'</span><small>mpg</small>'+
        '<span class="qual">'+esc(d.mpg.method)+'</span></div>'
      : '<div class="stat"><span>&mdash;</span><small>mpg</small><span class="qual">needs two fills</span></div>';
    var live = d.moving
      ? '<div class="live"><span class="dot"></span> Moving &middot; '+d.speed+' mph</div>'
      : '<div class="live parked"><span class="dot"></span> Parked</div>';
    var t = d.tonight;
    var tonight = "";
    if (t) {
      var when = t.actual ? "Tonight &middot; where they actually are"
        : (t.whenish === "tonight" ? "Tonight"
        : "Next stay &middot; " + fmtShort(t.check_in_date));
      var line = t.check_in_time ? "Check in " + esc(t.check_in_time)
        : (t.check_in_date ? "Arriving " + fmtShort(t.check_in_date) : "");
      if (t.check_out_time) line += " &middot; out " + esc(t.check_out_time);
      else if (t.check_out_date) line += " &middot; until " + fmtShort(t.check_out_date);
      tonight = '<h2>' + when + '</h2><div class="card' + (t.actual ? '' : ' tapme') + '"' +
        (t.actual ? '' : ' onclick="loadRes(\'' + t.id + '\')"') + '>' +
        '<div class="row"><b>' + esc(t.name) + '</b>' +
        (t.place_name ? '<span class="muted">' + esc(t.place_name) + '</span>' : '') + '</div>' +
        (line ? '<p class="muted" style="margin:7px 0 0">' + line + '</p>' : '') +
        '<p class="tiny" style="margin:5px 0 0">' +
          (t.confirmation ? 'Receipt <span class="conf">' + esc(t.confirmation) + '</span> &middot; ' : '') +
          (t.cost != null ? '$' + t.cost.toFixed(2) : '') + '</p></div>' +
        (ME && ME.role === "author"
          ? '<button class="ghostbtn" onclick="openStaying()">' +
            (t.actual ? "Change where we are staying" : "We are staying somewhere else") +
            '</button>' : '');
      if (d.planned_tonight) {
        tonight += '<p class="tiny" style="margin:9px 0 0">Plan said: ' +
          esc(d.planned_tonight.name) + '. Left as it was — it is a plan, not a promise.</p>';
      }
    }
    var last = d.last_stop
      ? '<h2>Last stop</h2><div class="card"><div class="row"><span>'+(ICON[d.last_stop.kind]||"")+' '+
        esc(d.last_stop.kind)+(d.last_stop.place?' &middot; '+esc(d.last_stop.place):'')+
        '</span><span class="tiny">'+fmtTime(d.last_stop.occurred_at)+'</span></div>'+
        (d.last_stop.gallons?'<p class="tiny" style="margin:6px 0 0">'+d.last_stop.gallons+' gal'+
          (d.last_stop.cost?' &middot; $'+d.last_stop.cost.toFixed(2):'')+'</p>':'')+'</div>'
      : '';
    // Two dense lines, Andy's spec verbatim: the day, where, how far, and
    // whether the wheels are turning — then the trip totals. The old stat
    // boxes and Days Out are gone; nobody marks places anymore (the car
    // stopping is the record), so the mark-it affordance is gone too.
    var state = d.moving
      ? '<span style="color:#1f6f5c">&#9679;</span> Moving &middot; '+d.speed+' mph'
      : '<span style="color:#a49a8e">&#9679;</span> Parked';
    var l1 = 'Day '+d.day_number +
      (d.town ? ' &middot; '+esc(d.town) : '') +
      ' &middot; '+(d.miles_today||0)+' mi today &middot; ' + state;
    var l2 = (d.miles_total||0).toLocaleString()+' mi total &middot; ' +
      (d.mpg ? d.mpg.value+' mpg' : 'mpg after two fills');
    var kinds = ["gas","food","campsite","lodging","event","journal"];
    var KLABEL = { gas:"Gas", food:"Food", campsite:"Campsite", lodging:"Lodging",
                   event:"Event", journal:"Journal" };
    var grid = (ME && ME.role==="author")
      ? '<div class="grid" style="margin-top:14px">' + kinds.map(function(k){
          var act = k === "journal" ? "openJot()" : "saveStop(\'"+k+"\')";
          var ic = k === "journal" ? "&#9997;" : ICON[k];
          return '<div class="kind" onclick="'+act+'"><span class="ic">'+ic+
                 '</span><span class="lb">'+KLABEL[k]+'</span></div>';
        }).join("") + '</div>'
      : '';
    el("s-today").innerHTML =
      '<h1 style="font-size:19px;line-height:1.35">'+l1+'</h1>' +
      '<p class="sub">'+l2+'</p>' +
      grid + tonight + last;
  });
}

/* Quick journal capture from the Today grid — the gesture that used to be an
   "observation" stop. Same artifact either way (a timestamped, located note
   in their own words), so the two write paths merged; old observation rows
   still render everywhere they always did. */
function openJot(){
  show("stop");
  el("s-stop").innerHTML =
    '<button class="back" onclick="tab(\'today\')">&larr;</button>' +
    '<h1>Journal</h1><p class="sub">' + fmtTime(new Date().toISOString()) +
    ' &middot; location comes along automatically</p>' +
    '<div class="card"><textarea id="jot-body" ' +
      'placeholder="What is happening out there?"></textarea></div>' +
    '<div class="actionbar"><button class="bigbtn" onclick="saveJot()">Save</button></div>';
  var t = el("jot-body"); if (t) t.focus();
}
function saveJot(){
  var t = el("jot-body"); if (!t || !t.value.trim()) { tab("today"); return; }
  var body = t.value;
  withLocation(function(loc){
    var payload = { body: body, written_at: new Date().toISOString(), tz_offset: tzOffset() };
    if (loc) { payload.lat = loc.lat; payload.lon = loc.lon; }
    send("/api/journal", "POST", payload).then(function(r){
      if (!r || !r.ok) { alertInline(t, "Couldn\'t save — try again."); return; }
      tab("today");
    });
  });
}

function openStop(){
  show("stop");
  el("s-stop").innerHTML =
    '<button class="back" onclick="tab(\'today\')">&larr;</button>' +
    '<h1>What kind of stop?</h1><p class="sub">' + fmtTime(new Date().toISOString()) +
    ' &middot; recorded automatically</p><div class="grid">' +
    ["gas","food","campsite","lodging","event","observation"].map(function(k){
      return '<div class="kind" onclick="saveStop(\''+k+'\')"><span class="ic">'+ICON[k]+
             '</span><span class="lb">'+k.charAt(0).toUpperCase()+k.slice(1)+'</span></div>';
    }).join("") +
    '</div><p class="tiny" style="margin-top:16px">One tap is enough. Everything else is optional and can wait until tonight.</p>';
}

function saveStop(kind){
  var id = (crypto.randomUUID ? crypto.randomUUID() : String(Date.now())+Math.random());
  var mins = -new Date().getTimezoneOffset();
  var sign = mins < 0 ? "-" : "+";
  var off = sign + String(Math.floor(Math.abs(mins)/60)).padStart(2,"0") + String(Math.abs(mins)%60).padStart(2,"0");
  var item = { client_id:id, kind:kind, occurred_at:new Date().toISOString(), tz_offset:off };

  function finish(){
    enqueue(item);
    // Note first. It is the only field worth anything in twenty years — the
    // cost of a tank is not the memory. Money follows, and for gas the two
    // numbers actually printed on the pump come last, with the total derived.
    var extra =
      '<div class="card"><label class="muted">What happened here?</label>' +
      '<textarea id="f-note" style="min-height:96px;margin-top:8px" placeholder="Optional. A line is plenty."></textarea></div>';
    if (kind === "gas") {
      extra +=
        '<div class="card"><label class="muted">Gallons</label>' +
        '<input type="number" step="0.001" id="f-gal" inputmode="decimal" oninput="calcFuel()" style="margin-top:8px">' +
        '<p class="tiny" style="margin:6px 0 0">Three decimals, straight off the pump.</p></div>' +
        '<div class="card"><label class="muted">Price per gallon</label>' +
        '<input type="number" step="0.001" id="f-ppg" inputmode="decimal" oninput="calcFuel()" style="margin-top:8px"></div>' +
        '<div class="card"><div class="row"><span class="muted">Total</span>' +
        '<b id="f-total">&mdash;</b></div><p class="tiny" style="margin:6px 0 0">Computed. Keeps mpg honest.</p></div>';
    } else {
      extra +=
        '<div class="card"><label class="muted">Cost</label>' +
        '<input type="number" step="0.01" id="f-cost" inputmode="decimal" style="margin-top:8px"></div>';
    }

    el("s-stop").innerHTML =
      '<div style="text-align:center;padding-top:44px"><div style="font-size:52px">'+ICON[kind]+'</div>' +
      '<h1 style="margin-top:14px">'+kind.charAt(0).toUpperCase()+kind.slice(1)+' stop saved</h1>' +
      '<p class="sub">'+fmtTime(item.occurred_at)+'</p></div>' +
      '<h2>Add anything? (optional)</h2>' + extra +
      '<div class="actionbar"><button class="bigbtn" onclick="finishStop(\''+id+'\')">Done</button>' +
      '<button class="ghostbtn" style="color:#a8332a;border-color:#e8cdc9" onclick="discardStop(\''+id+'\')">Discard this stop</button></div>';
  }

  if (navigator.geolocation) {
    navigator.geolocation.getCurrentPosition(function(p){
      item.lat = p.coords.latitude; item.lon = p.coords.longitude; finish();
    }, finish, { timeout: 4000, maximumAge: 60000 });
  } else finish();
}

function calcFuel(){
  var g = el("f-gal"), p = el("f-ppg"), t = el("f-total");
  if(!t) return;
  var gv = g && parseFloat(g.value), pv = p && parseFloat(p.value);
  t.innerHTML = (gv && pv) ? "$" + (Math.round(gv*pv*100)/100).toFixed(2) : "&mdash;";
}

/* A stop saves on the first tap, which is what makes it fast enough to use at
   a pump — so a mis-tap is inevitable and there has to be a way out. Clears the
   offline queue entry too, in case it never reached the server. */
function discardStop(id){
  var q = queue().filter(function(x){ return x.client_id !== id; });
  setQueue(q);
  send("/api/stop","DELETE",{ id:id }).then(function(){ tab("today"); }, function(){ tab("today"); });
}

/* Patch a stop that may not have reached the server yet.
   The original sent the PATCH straight to the API. Offline that failed
   silently, and when signal returned the queue POSTed the ORIGINAL bare stop —
   so the gallons, the price and the note, typed standing at a pump, were gone
   with no error. Exactly the case the queue exists for. Now the queued item is
   amended in place if it is still waiting; only an already-delivered stop goes
   over the wire. */
function patchStopLocal(id, patch){
  var q = queue(), found = false;
  for (var i=0;i<q.length;i++){
    if (q[i].client_id === id){
      for (var k in patch) if (k !== "id") q[i][k] = patch[k];
      found = true;
    }
  }
  if (found){ setQueue(q); return flush(); }
  return flush().then(function(){ return send("/api/stop","PATCH",patch); });
}

function finishStop(id){
  var g = el("f-gal"), p = el("f-ppg"), c = el("f-cost"), n = el("f-note");
  var patch = { id:id };
  if (g && g.value) patch.gallons = parseFloat(g.value);
  if (p && p.value) patch.price_per_gallon = parseFloat(p.value);
  if (c && c.value) patch.cost = parseFloat(c.value);
  if (n && n.value.trim()) patch.note = n.value.trim();
  var done = function(){ tab("today"); };
  if (Object.keys(patch).length > 1) {
    patchStopLocal(id, patch).then(done, done);
  } else done();
}

/* Somewhere unplanned. Recorded as a stop rather than by editing the
   itinerary: the plan stays as Lily wrote it and reality is stored alongside,
   which is the whole aspirational-itinerary premise. */
function openStaying(){
  show("staying");
  el("s-staying").innerHTML =
    '<button class="back" onclick="tab(\'today\')">&larr;</button>' +
    '<h1>Where are you staying?</h1>' +
    '<p class="sub">This does not change the itinerary. It records where you actually are.</p>' +
    '<div class="card"><label class="muted">Name of the place</label>' +
    '<input type="text" id="stay-name" placeholder="Whatever you would call it" style="margin-top:8px"></div>' +
    '<div class="card"><label class="muted">A note (optional)</label>' +
    '<textarea id="stay-note" style="min-height:90px;margin-top:8px"></textarea></div>' +
    '<h2>What kind?</h2><div class="grid">' +
    '<div class="kind" onclick="saveStaying(\'campsite\')"><span class="ic">' + ICON.campsite +
      '</span><span class="lb">Campsite</span></div>' +
    '<div class="kind" onclick="saveStaying(\'lodging\')"><span class="ic">' + ICON.lodging +
      '</span><span class="lb">Lodging</span></div>' +
    '</div>';
}

function saveStaying(kind){
  var n = el("stay-name"), note = el("stay-note");
  var id = (crypto.randomUUID ? crypto.randomUUID() : String(Date.now())+Math.random());
  var mins = -new Date().getTimezoneOffset();
  var sign = mins < 0 ? "-" : "+";
  var off = sign + String(Math.floor(Math.abs(mins)/60)).padStart(2,"0") +
            String(Math.abs(mins)%60).padStart(2,"0");
  var item = { client_id:id, kind:kind, occurred_at:new Date().toISOString(), tz_offset:off,
               place:(n && n.value.trim()) || null, note:(note && note.value.trim()) || null };
  function done(){ enqueue(item); tab("today"); }
  if (navigator.geolocation) {
    navigator.geolocation.getCurrentPosition(function(p){
      item.lat = p.coords.latitude; item.lon = p.coords.longitude; done();
    }, done, { timeout: 4000, maximumAge: 60000 });
  } else done();
}

function loadTrip(){
  show("trip");
  get("/api/trip").then(function(d){
    if (!d) { offlineInto("s-trip", "loadTrip()"); return; }
    var past = d.days.map(function(x){
      // The row tells the day's story: the stops themselves, in order, with
      // their icons — not a count. Amelia's ask, verbatim: "what they did on
      // each of the days (stops and locations) instead of just on the road."
      var bits=[];
      var sl = x.stop_list || [];
      sl.slice(0, 4).forEach(function(s){
        bits.push((ICON[s.kind]||"") + " " + esc(s.place || s.kind));
      });
      if (sl.length > 4) bits.push("+" + (sl.length - 4) + " more");
      if (x.photos) bits.push(x.photos + " photo" + (x.photos===1?"":"s"));
      return '<div class="day" onclick="loadDay(\''+x.date+'\')">' +
        '<div class="daynum"><b>'+x.day_number+'</b><small>'+fmtShort(x.date)+'</small></div>' +
        '<div style="flex:1"><div class="row"><b>'+esc(x.title||(x.places?x.places:"On the road"))+
        '</b><span class="tiny">'+(x.miles!=null?x.miles+" mi":"")+'</span></div>' +
        (bits.length?'<p class="tiny" style="margin:3px 0 0">'+bits.join(" &middot; ")+'</p>':'') +
        '</div></div>';
    }).join("") || '<p class="empty">No days yet.</p>';

    var ahead = d.ahead.map(function(i){
      return '<div class="day" style="opacity:.62" onclick="loadPlace(\''+i.id+'\',\'trip\')">' +
        '<div class="daynum"><b>&middot;</b><small>'+(i.planned_arrival?fmtShort(i.planned_arrival):"&mdash;")+'</small></div>' +
        '<div style="flex:1"><div class="row"><b>'+esc(i.name)+'</b><span class="tiny">'+
        esc(i.drive_time_from_prev||"")+'</span></div><p class="tiny" style="margin:3px 0 0">'+
        i.activities+' to see'+(i.booked?' &middot; booked':'')+'</p></div></div>';
    }).join("");

    el("s-trip").innerHTML = '<h1>The trip</h1><p class="sub">'+d.days.length+
      ' day'+(d.days.length===1?"":"s")+' so far</p>' +
      '<div class="maparea" id="trip-map" style="height:210px;margin-bottom:6px"></div>' +
      '<p class="tiny" style="margin:0 0 4px">Tap the map to open it full size.</p>' +
      past + (ahead ? '<h2>Coming up</h2>'+ahead : '');
    drawMap("trip-map", 210, function(){ show("map"); loadMapScreen(); });
  });
}

var LAST_DAY = null, LAST_PLACE = null;
function loadDay(date){
  show("day");
  LAST_DAY = date;
  get("/api/day?date="+encodeURIComponent(date)).then(function(d){
    if (!d) { offlineInto("s-day", "loadDay('"+date+"')"); return; }
    var s = d.summary || {};
    var stops = d.stops.map(function(x){
      return '<div class="card"><div class="row"><span>'+(ICON[x.kind]||"")+' '+esc(x.kind)+
        (x.place?' &middot; '+esc(x.place):'')+'</span><span class="tiny">'+fmtTime(x.occurred_at)+
        '</span></div>'+(x.note?'<p class="tiny" style="margin:6px 0 0">'+esc(x.note)+'</p>':'')+'</div>';
    }).join("") || '<p class="empty">No stops recorded.</p>';
    var journal = d.journal.map(function(j){
      return '<div class="card"><p style="margin:0;font-size:15px;line-height:1.5">'+esc(j.body)+
        '</p><div class="row" style="margin-top:9px"><span class="tiny">'+esc(j.author||"")+
        ' &middot; '+fmtTime(j.written_at)+'</span>'+delBtn("journal", j.id)+'</div></div>';
    }).join("");
    // Derived from where the car stopped — nothing to add or remove by hand.
    var placeRows = (d.places||[]).map(function(p){
      return '<div class="card tapme" onclick="loadPlace(\''+esc(p.id)+'\',\'trip\')">' +
        '<div class="row"><span>&#128205; '+esc(p.name)+'</span><span></span></div></div>';
    }).join("");
    el("s-day").innerHTML =
      '<button class="back" onclick="tab(\'trip\')">&larr;</button>' +
      '<h1>Day '+(s.day_number||"")+'</h1><p class="sub">'+fmtDay(date)+
      (s.places?' &middot; '+esc(s.places):'')+'</p>' +
      '<div class="stats">' +
        '<div class="stat"><span>'+(s.miles||0)+'</span><small>miles</small></div>' +
        '<div class="stat"><span>'+(s.stops||0)+'</span><small>stops</small></div>' +
        '<div class="stat"><span>'+(s.photos||0)+'</span><small>photos</small></div>' +
        '<div class="stat"><span>'+d.segments.length+'</span><small>drives</small></div>' +
      '</div>' +
      ((d.photos||[]).length
        ? '<h2>Photos</h2><div id="d-ph-viewer"></div>' +
          '<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:6px">' +
          d.photos.map(function(p){ PHOTO_META[p.id] = p; return photoThumbHtml(p, "day"); }).join("") +
          '</div>'
        : '') +
      '<h2>Places</h2>' + (placeRows || '<p class="empty">The car didn\'t stop near a planned place this day.</p>') +
      '<h2>Journal</h2>' + (journal || '<p class="empty">Nothing written yet.</p>') +
      (ME && ME.role==="author"
        ? '<div class="card" style="margin-top:9px"><textarea id="j-body" placeholder="What happened today?"></textarea>' +
          '<button class="ghostbtn" onclick="saveJournal(\''+date+'\')">Save entry</button></div>' : '') +
      '<h2>Stops</h2>' + stops;
  });
}



/* Two bugs lived here. The entry carried no tz_offset, so the server defaulted
   to Central and anything written after ~7pm once they were in Mountain or
   Pacific landed on TOMORROW's page. And writing on a past day still stamped
   today, so the author watched their entry vanish from the day they wrote it
   on. Both halves are sent now. */
function tzOffset(){
  var mins = -new Date().getTimezoneOffset();
  var sign = mins < 0 ? "-" : "+";
  return sign + String(Math.floor(Math.abs(mins)/60)).padStart(2,"0") +
         String(Math.abs(mins)%60).padStart(2,"0");
}
/* Where the entry was written, from the phone, best-effort. 4s budget then
   give up — a journal save must never hang on a permission prompt or a canyon
   with no GPS. Backdated entries skip it entirely: the phone's position today
   says nothing about where a past day's entry happened. */
function withLocation(cb){
  if (!navigator.geolocation) { cb(null); return; }
  var done = false;
  function finish(pos){ if (!done){ done = true; cb(pos); } }
  navigator.geolocation.getCurrentPosition(
    function(p){ finish({ lat: +p.coords.latitude.toFixed(5),
                          lon: +p.coords.longitude.toFixed(5) }); },
    function(){ finish(null); },
    { timeout: 3500, maximumAge: 120000 });
  setTimeout(function(){ finish(null); }, 4000);
}

function saveJournal(date){
  var t = el("j-body"); if(!t || !t.value.trim()) return;
  var body = t.value;
  var today = new Date().toISOString().slice(0,10);
  var go = function(loc){
    var payload = { body:body, date:date,
         written_at:new Date().toISOString(), tz_offset:tzOffset() };
    if (loc) { payload.lat = loc.lat; payload.lon = loc.lon; }
    send("/api/journal","POST",payload).then(function(r){
      if (!r || !r.ok) { alertInline(t, "Couldn't save — try again."); return; }
      loadDay(date);
    });
  };
  if (date === today) withLocation(go); else go(null);
}
/* A failed write used to re-render the list and silently discard what was
   typed. Keep the text, say what happened. */
function alertInline(field, msg){
  if (!field) return;
  var p = document.createElement("p");
  p.className = "tiny"; p.style.color = "#a8332a"; p.textContent = msg;
  field.parentNode.appendChild(p);
}

/* One stream: written entries and observation stops, interleaved by time.
   The capture gestures differ — a thumb at 70mph versus a picnic table at
   dusk — but what comes out is the same thing and reads as one narrative. */
function saveJournalFeed(){
  var t = el("jf-body"); if(!t || !t.value.trim()) return;
  var body = t.value;
  withLocation(function(loc){
    var payload = { body:body, written_at:new Date().toISOString(), tz_offset:tzOffset() };
    if (loc) { payload.lat = loc.lat; payload.lon = loc.lon; }
    send("/api/journal","POST",payload).then(function(r){
      if (!r || !r.ok) { alertInline(t, "Couldn't save — try again."); return; }
      loadPhotos();
    });
  });
}

/* --- Badges: what the trip has earned. States, parks and milestones are
   DERIVED from the data (never stored); the bespoke ones are invented and
   awarded by the family — the one write everyone can make, viewers included.
   Amelia's design, near-verbatim. --- */
function loadBadges(){
  show("badges");
  get("/api/badges").then(function(d){
    if (!d) { offlineInto("s-badges", "loadBadges()"); return; }

    // Each state badge IS the state: its outline, filled route-green, with
    // the name and the day they first crossed in.
    var states = (d.states||[]).map(function(st){
      var art = '';
      if (st.shape && st.shape.rings) {
        var polys = st.shape.rings.map(function(r){
          return '<polygon points="'+r.map(function(pt){ return pt[0]+','+pt[1]; }).join(' ')+
            '" fill="#1f6f5c22" stroke="#1f6f5c" stroke-width="2.5" stroke-linejoin="round"/>';
        }).join('');
        art = '<svg viewBox="-4 -4 '+(st.shape.w+8)+' '+(st.shape.h+8)+'" ' +
          'style="width:64px;height:'+Math.round(64*(st.shape.h+8)/(st.shape.w+8))+'px;max-height:72px">'+polys+'</svg>';
      }
      return '<div style="width:31%;min-width:96px;text-align:center;padding:10px 4px;' +
        'background:var(--card);border:1px solid var(--line);border-radius:14px">' + art +
        '<div style="font-size:12.5px;font-weight:650;margin-top:4px">'+esc(st.state)+'</div>' +
        '<div class="tiny" style="opacity:.65">'+fmtShort(st.first_date)+'</div></div>';
    }).join("") || '<p class="empty">No states yet — that changes fast.</p>';

    var parks = (d.parks||[]).map(function(p){
      return '<span class="badge">&#127966; '+esc(p.name)+'<span style="opacity:.6;font-weight:400"> &middot; '+
        fmtShort(p.first_date)+'</span></span>';
    }).join("") || '<p class="empty">Parks appear when the car stops inside one.</p>';

    var miles = "";
    for (var i = 1; i <= d.miles.earned; i++)
      miles += '<span class="badge">&#128739; '+(i*1000).toLocaleString()+' miles</span>';
    miles += '<span class="badge" style="opacity:.55">'+d.miles.to_next.toLocaleString()+
      ' mi to '+((d.miles.earned+1)*1000).toLocaleString()+'</span>';

    var tanks = "";
    for (var j = 1; j <= d.tanks.earned; j++)
      tanks += '<span class="badge">&#9981; '+(j*10)+' tanks</span>';
    tanks += '<span class="badge" style="opacity:.55">'+d.tanks.fills+' fill'+
      (d.tanks.fills===1?"":"s")+' so far</span>';

    var bespoke = (d.bespoke||[]).map(function(b){
      // The awarder can always remove their own (delBtn is authors-only, and
      // a viewer must be able to undo a mistaken award).
      var mine = ME && (ME.id === b.awarded_by || ME.role === "author");
      var rm = mine
        ? '<button id="del-'+b.id+'" onclick="armDelete(\'badge\',\''+b.id+'\',event)" ' +
          'style="border:0;background:none;font:inherit;font-size:12px;' +
          'color:#a49a8e;cursor:pointer;padding:4px 0">Delete</button>'
        : '<span></span>';
      return '<div class="card"><div class="row"><b>'+(b.emoji?esc(b.emoji)+' ':'&#127941; ')+
        esc(b.title)+'</b>'+rm+'</div>'+
        (b.image_key?'<img src="/photo/'+esc(b.image_key)+'" loading="lazy" '+
          'style="width:100%;max-width:260px;border-radius:12px;margin-top:8px;display:block">':'')+
        (b.note?'<p style="margin:7px 0 0;font-size:14px;line-height:1.45">'+esc(b.note)+'</p>':'')+
        '<p class="tiny" style="margin:6px 0 0">from '+esc(b.awarded_by_name||"someone")+
        (b.date?' &middot; for '+fmtShort(b.date):'')+
        ' &middot; '+fmtShort(b.created_at.slice(0,10))+'</p></div>';
    }).join("");

    el("s-badges").innerHTML =
      '<h1>Badges</h1><p class="sub">'+(d.states||[]).length+' state'+
      ((d.states||[]).length===1?"":"s")+' &middot; '+(d.parks||[]).length+' park'+
      ((d.parks||[]).length===1?"":"s")+' &middot; '+d.miles.total.toLocaleString()+' miles</p>' +
      '<h2>From the family</h2>' +
      (bespoke || '<p class="empty">None yet. Anyone can award one &mdash; make one up.</p>') +
      '<button class="ghostbtn" id="bg-open" onclick="el(\'bg-composer\').style.display=\'block\';this.style.display=\'none\'">' +
        'Award a badge</button>' +
      '<div class="card" id="bg-composer" style="margin-top:9px;display:none">' +
        '<div class="row" style="gap:8px"><input type="text" id="bg-emoji" placeholder="&#127941;" ' +
          'style="width:64px;flex:none;text-align:center">' +
        '<input type="text" id="bg-title" placeholder="The Zotz Badge"></div>' +
        '<textarea id="bg-note" style="min-height:64px;margin-top:8px" ' +
          'placeholder="What earned it?"></textarea>' +
        '<input type="file" id="bg-image" accept="image/*" style="display:none" ' +
          'onchange="el(\'bg-image-note\').textContent = this.files.length ? this.files[0].name : \'\'">' +
        '<div class="row" style="margin-top:8px"><button class="ghostbtn" style="margin:0;flex:1" ' +
          'onclick="el(\'bg-image\').click()">Add a picture</button>' +
          '<span class="tiny" id="bg-image-note" style="max-width:45%;overflow:hidden;text-overflow:ellipsis"></span></div>' +
        '<button class="ghostbtn" onclick="awardBadge()">Award it</button></div>' +
      '<h2>States</h2><div class="badges">'+states+'</div>' +
      '<h2>National parks</h2><div class="badges">'+parks+'</div>' +
      '<h2>The odometer</h2><div class="badges">'+miles+'</div>' +
      '<h2>The pump</h2><div class="badges">'+tanks+'</div>';
  });
}

function awardBadge(){
  var t = el("bg-title"); if (!t) return;
  // Amelia pressed Award with this box empty and NOTHING happened — a silent
  // no-op reads as broken. Every tap gets a response now.
  var old = t.parentNode.parentNode.querySelector("p.tiny[data-err]");
  if (old) old.parentNode.removeChild(old);
  if (!t.value.trim()) {
    var msg = document.createElement("p");
    msg.className = "tiny"; msg.setAttribute("data-err","1");
    msg.style.color = "#a8332a"; msg.style.margin = "6px 0 0";
    msg.textContent = "Give the badge a name first — the big box.";
    t.parentNode.parentNode.appendChild(msg);
    t.focus();
    return;
  }
  var fileInput = el("bg-image");
  var file = fileInput && fileInput.files && fileInput.files[0];
  var done = function(r){
    if (!r || !r.ok) { alertInline(t, "Couldn't award — try again."); return; }
    loadBadges();
  };
  if (file) {
    // Amelia's cool tags: resize to 640px so a generated image costs ~60KB.
    file.arrayBuffer().then(function(buf){
      return createImageBitmap(new Blob([buf]), { imageOrientation: "from-image" })
        .then(function(img){ return scaleToBlob(img, 640, 0.82); });
    }).then(function(blob){
      var fd = new FormData();
      fd.append("title", t.value);
      fd.append("emoji", (el("bg-emoji")||{}).value||"");
      fd.append("note", (el("bg-note")||{}).value||"");
      fd.append("image", blob, "badge.jpg");
      return fetch("/api/badge/upload", { method:"POST", credentials:"same-origin", body: fd })
        .then(function(r){ return r.json(); });
    }).then(done, function(){ alertInline(t, "Couldn't award — try again."); });
  } else {
    send("/api/badge","POST",{ title:t.value, emoji:(el("bg-emoji")||{}).value||"",
         note:(el("bg-note")||{}).value||"" }).then(done);
  }
}

/* ---- Photos: straight from the camera roll. The phone resizes before
   upload (campground wifi carries ~300KB, not a 12MP original), EXIF GPS
   rides along when the photo has one, and the whole trip so far backfills
   the moment somebody selects it. ---- */

function photoThumbHtml(p, from){
  var src = p.thumb_key ? "/photo/"+p.thumb_key : "/photo/"+p.r2_key;
  return '<img class="thumb" loading="lazy" src="'+esc(src)+'" ' +
    'style="width:100%;height:112px;border-radius:10px;object-fit:cover;cursor:pointer;background:#eceae6" ' +
    'onclick="openPhoto(\''+esc(p.id)+'\',\''+esc(p.r2_key)+'\',\''+(from||"photos")+'\')">';
}

var PHOTO_META = {};
/* Photos and journal, one stream, grouped by day — pictures and words
   together. This is the trip reading itself back; the eventual viewbook is
   this screen with better paper. */
function loadPhotos(){
  show("photos");
  Promise.all([get("/api/photos"), get("/api/journal-feed")]).then(function(res){
    var d = res[0], j = res[1];
    if (!d) { offlineInto("s-photos", "loadPhotos()"); return; }
    PHOTO_META = {};
    d.photos.forEach(function(p){ PHOTO_META[p.id] = p; });

    var byDate = {};
    d.photos.forEach(function(p){
      var k = p.date || (p.taken_at||"").slice(0,10) || "undated";
      (byDate[k] = byDate[k] || { photos:[], words:[] }).photos.push(p);
    });
    ((j && j.entries) || []).forEach(function(e){
      var k = e.date || "undated";
      (byDate[k] = byDate[k] || { photos:[], words:[] }).words.push(e);
    });

    var dates = Object.keys(byDate).sort().reverse();
    var stream = dates.map(function(dt){
      var g = byDate[dt];
      var photos = g.photos.length
        ? '<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:6px;margin-bottom:8px">' +
          g.photos.map(function(p){ return photoThumbHtml(p, "photos"); }).join("") + '</div>'
        : '';
      var words = g.words.map(function(e){
        var tag = e.source === "observation"
          ? '<span class="badge" style="font-size:11px;padding:3px 9px">' + ICON.observation + ' seen</span>' : '';
        return '<div class="card"><div class="row"><span class="tiny">' +
          fmtTime(e.written_at) + (e.author ? ' &middot; ' + esc(e.author) : '') + '</span>' + tag + '</div>' +
          '<p style="margin:8px 0 0;font-size:15px;line-height:1.5">' + esc(e.body) + '</p>' +
          '<div style="text-align:right;margin-top:2px">' +
            delBtn(e.source === "observation" ? "observation" : "journal", e.id) + '</div></div>';
      }).join("");
      return '<h2>' + fmtDay(dt) + '</h2>' + photos + words;
    }).join("");

    var uploader = (ME && ME.role === "author")
      ? '<input type="file" id="ph-files" accept="image/*" multiple style="display:none" ' +
          'onchange="uploadPhotos(this.files)">' +
        '<div class="actionbar"><button class="bigbtn" ' +
          'onclick="el(\'ph-files\').click()">Add photos</button></div>' +
        '<div id="ph-progress"></div>'
      : '';
    var composer = (ME && ME.role === "author")
      ? '<div class="card"><textarea id="jf-body" placeholder="What happened today?"></textarea>' +
        '<button class="ghostbtn" onclick="saveJournalFeed()">Save entry</button></div>'
      : '';
    var nP = d.photos.length, nW = ((j && j.entries) || []).length;
    el("s-photos").innerHTML = '<h1>Photos &amp; Journal</h1><p class="sub">' +
      (nP || nW ? nP + ' photo' + (nP===1?'':'s') + ' &middot; ' + nW + ' entr' + (nW===1?'y':'ies')
                : 'Nothing here yet') + '</p>' +
      '<div id="ph-viewer"></div>' + composer +
      (stream || '<p class="empty">Photos from the camera roll and anything written — the whole trip, day by day.</p>') +
      uploader;
  });
}
function loadJournal(){ loadPhotos(); }


function openPhoto(id, key, from){
  var p = PHOTO_META[id] || {};
  // Pick the viewer on the screen the user is LOOKING at — the Photos tab's
  // viewer persists in its hidden DOM, and filling it from the Day screen
  // opened the photo invisibly (QA finding).
  var v = (from === "day") ? el("d-ph-viewer") : el("ph-viewer");
  if (!v) v = el("ph-viewer") || el("d-ph-viewer");
  if (!v) return;
  v.innerHTML = '<div class="card" style="padding:8px">' +
    '<img src="/photo/'+esc(key)+'" style="width:100%;border-radius:10px;background:#eceae6">' +
    '<div class="row" style="margin-top:8px"><span class="tiny">' +
      esc(p.author||"") + (p.taken_at ? ' &middot; '+fmtTime(p.taken_at) : '') +
      (p.date ? ' &middot; '+fmtShort(p.date) : '') + '</span>' +
    '<span>' +
      (p.lat != null ? '<button class="ghostbtn" style="margin:0;padding:4px 10px" ' +
        'onclick="tab(\'map\')">On the map</button> ' : '') +
      (ME && ME.role === "author"
        ? '<button id="del-'+esc(id)+'" onclick="armDelete(\'photo\',\''+esc(id)+'\',event)" ' +
          'style="border:0;background:none;font:inherit;font-size:12px;color:#a49a8e;' +
          'cursor:pointer;padding:4px 0">Delete</button>' : '') +
    '</span></div>' +
    '<button class="ghostbtn" onclick="this.parentNode.parentNode.innerHTML=\'\'">Close</button></div>';
  v.scrollIntoView({ behavior: "smooth", block: "start" });
}

/* Minimal EXIF walk: JPEG APP1 -> TIFF -> GPS IFD. Returns {lat, lon,
   taken_at} with any of them possibly missing. Wrong-endian, truncated, or
   EXIF-less files just return {} — the photo still uploads, merely unpinned. */
function exifGps(buf){
  try {
    var v = new DataView(buf);
    if (v.getUint16(0) !== 0xFFD8) return {};
    var o = 2;
    while (o + 4 < v.byteLength) {
      var marker = v.getUint16(o), size = v.getUint16(o + 2);
      if (marker === 0xFFE1) break;
      if ((marker & 0xFF00) !== 0xFF00) return {};
      o += 2 + size;
    }
    if (o + 4 >= v.byteLength) return {};
    var t = o + 4 + 6; // past APP1 size + "Exif\0\0"
    var little = v.getUint16(t) === 0x4949;
    function u16(p){ return v.getUint16(p, little); }
    function u32(p){ return v.getUint32(p, little); }
    function rational(p){ var n = u32(p), d = u32(p + 4); return d ? n / d : 0; }
    function ifdEntries(p, fn){
      var n = u16(p);
      for (var i = 0; i < n; i++) fn(p + 2 + i * 12);
    }
    var gpsOff = 0, exifOff = 0, out = {};
    ifdEntries(t + u32(t + 4), function(e){
      var tag = u16(e);
      if (tag === 0x8825) gpsOff = u32(e + 8);
      if (tag === 0x8769) exifOff = u32(e + 8);
    });
    if (exifOff) ifdEntries(t + exifOff, function(e){
      if (u16(e) === 0x9003) { // DateTimeOriginal "YYYY:MM:DD HH:MM:SS"
        var p = t + u32(e + 8), s = "";
        for (var i = 0; i < 19; i++) s += String.fromCharCode(v.getUint8(p + i));
        var m = s.match(/^(\d{4}):(\d\d):(\d\d) (\d\d:\d\d:\d\d)$/);
        if (m) out.taken_local = m[1]+"-"+m[2]+"-"+m[3]+"T"+m[4];
      }
    });
    if (gpsOff) {
      var latRef = "N", lonRef = "E", lat = null, lon = null;
      ifdEntries(t + gpsOff, function(e){
        var tag = u16(e), p = t + u32(e + 8);
        if (tag === 1) latRef = String.fromCharCode(v.getUint8(e + 8));
        if (tag === 3) lonRef = String.fromCharCode(v.getUint8(e + 8));
        if (tag === 2) lat = rational(p) + rational(p+8)/60 + rational(p+16)/3600;
        if (tag === 4) lon = rational(p) + rational(p+8)/60 + rational(p+16)/3600;
      });
      if (lat != null && lon != null && (lat || lon)) {
        out.lat = +( (latRef === "S" ? -lat : lat).toFixed(5) );
        out.lon = +( (lonRef === "W" ? -lon : lon).toFixed(5) );
      }
    }
    return out;
  } catch (e) { return {}; }
}

function scaleToBlob(img, maxDim, quality){
  var w = img.width, h = img.height;
  var k = Math.min(1, maxDim / Math.max(w, h));
  var c = document.createElement("canvas");
  c.width = Math.round(w * k); c.height = Math.round(h * k);
  c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
  return new Promise(function(res){ c.toBlob(res, "image/jpeg", quality); });
}

function uploadPhotos(files){
  var list = Array.prototype.slice.call(files || []);
  if (!list.length) return;
  var prog = el("ph-progress"), done = 0, failed = 0;
  function note(){
    if (prog) prog.innerHTML = '<p class="tiny">'+done+' of '+list.length+' uploaded'+
      (failed ? ' &middot; '+failed+' failed (tap Add photos to retry those)' : '')+'</p>';
  }
  note();
  // Sequential on purpose: three parallel 300KB uploads on one bar of LTE
  // starve each other; one at a time finishes sooner and reports honestly.
  (function next(){
    var f = list.shift();
    if (!f) { done && loadPhotos(); return; }
    f.arrayBuffer().then(function(buf){
      var meta = exifGps(buf);
      return createImageBitmap(new Blob([buf]), { imageOrientation: "from-image" })
        .then(function(img){
          return Promise.all([scaleToBlob(img, 1800, 0.82), scaleToBlob(img, 420, 0.75)]);
        })
        .then(function(blobs){
          var fd = new FormData();
          fd.append("file", blobs[0], "p.jpg");
          fd.append("thumb", blobs[1], "t.jpg");
          fd.append("tz_offset", tzOffset());
          // EXIF local time + the phone's offset beats file mtime; mtime beats now.
          fd.append("taken_at", meta.taken_local
            ? meta.taken_local + tzOffset().replace(/(\d\d)(\d\d)/, "$1:$2")
            : new Date(f.lastModified || Date.now()).toISOString());
          if (meta.lat != null) { fd.append("lat", meta.lat); fd.append("lon", meta.lon); }
          return fetch("/api/photo/upload", { method: "POST", credentials: "same-origin", body: fd })
            .then(function(r){ return r.json(); });
        })
        .then(function(r){ if (r && r.ok) done++; else failed++; note(); next(); });
    }).catch(function(){ failed++; note(); next(); });
  })();
}

function loadPlaces(){
  show("places");
  get("/api/places").then(function(d){
    if (!d) { offlineInto("s-places", "loadPlaces()"); return; }
    var visited = d.places.filter(function(p){ return p.visited; }).length;
    el("s-places").innerHTML = '<h1>Itinerary</h1><p class="sub">'+d.places.length+
      ' places &middot; '+visited+' reached so far</p>' +
      '<p class="tiny" style="margin:-10px 0 14px">Lily\'s plan, in her order. Nothing here is ever late.</p>' +
      d.places.map(function(p){
      return '<div class="day" onclick="loadPlace(\''+p.id+'\')">' +
        '<div style="flex:1"><div class="row"><b'+(p.visited?'':' style="opacity:.62"')+'>'+esc(p.name)+
        '</b><span class="tiny">'+(p.wanted?p.did+"/"+p.wanted:"")+'</span></div>' +
        '<p class="tiny" style="margin:3px 0 0">'+esc(p.kind||"")+
        (p.planned_arrival?' &middot; '+fmtShort(p.planned_arrival):'')+'</p></div></div>';
    }).join("");
  });
}

var PLACE_FROM = "places";
function loadPlace(id, from){
  show("place");
  LAST_PLACE = id;
  if (from) PLACE_FROM = from;
  get("/api/place?id="+encodeURIComponent(id)).then(function(d){
    if (!d) { offlineInto("s-place", "loadPlace('"+id+"')"); return; }
    if (!d.intention) {
      el("s-place").innerHTML =
        '<button class="back" onclick="tab(\''+PLACE_FROM+'\')">&larr;</button>' +
        '<h1>Not found</h1><p class="sub">That place is no longer in the plan.</p>';
      return;
    }
    var i = d.intention;
    var acts = d.activities.map(function(a){
      var tappable = ME && ME.role === "author";
      return '<li' + (tappable
        ? ' onclick="tickActivity(\''+a.id+'\','+(a.done?0:1)+',\''+id+'\')"'
        : ' style="cursor:default"') + '>' +
        '<span class="box'+(a.done?" done":"")+'"></span><span'+(a.done?' class="done-txt"':'')+'>' +
        esc(a.name)+(a.distance_mi?' &middot; '+a.distance_mi+' mi':'') +
        (a.detail&&!a.done?'<span class="hers">'+esc(a.detail)+'</span>':'')+'</span></li>';
    }).join("");
    var res = d.reservations.map(function(r){
      return '<div class="card tapme" onclick="loadRes(\''+r.id+'\',\'place\')"><div class="row"><span>'+esc(r.name)+
        '</span><b>'+(r.cost!=null?'$'+r.cost.toFixed(2):'')+'</b></div>' +
        '<p class="tiny" style="margin:6px 0 0">'+(r.booked?'Booked':'Not booked')+'</p></div>';
    }).join("");
    el("s-place").innerHTML =
      '<button class="back" onclick="tab(\''+PLACE_FROM+'\')">&larr;</button>' +
      '<h1>'+esc(i.name)+'</h1><p class="sub">' +
      (i.planned_arrival?'Hoped for '+fmtShort(i.planned_arrival):'No date') +
      (i.planned_nights?' &middot; '+i.planned_nights+' nights':'') +
      (i.drive_time_from_prev?' &middot; '+esc(i.drive_time_from_prev)+' away':'') + '</p>' +
      (d.activities.length ? '<h2>'+d.activities.length+' things she wanted to see</h2>' +
        '<div class="card" style="padding:4px 14px"><ul class="check">'+acts+'</ul></div>' : '') +
      (res ? '<h2>Staying / getting in</h2>'+res : '');
  });
}

function tickActivity(id, done, placeId){
  send("/api/activity","POST",{ id:id, done:!!done }).then(function(){ loadPlace(placeId); });
}

var RES_BACK = "tab('today')";
function loadRes(id, from){
  show("res");
  RES_BACK = (from === "place" && LAST_PLACE)
    ? "loadPlace('" + LAST_PLACE + "')" : "tab('today')";
  get("/api/reservation?id="+encodeURIComponent(id)).then(function(r){
    if (!r || r.error) { offlineInto("s-res", "loadRes('"+id+"')"); return; }
    var kv = "";
    if(r.check_in_at)  kv += '<div class="kv"><span>Check in</span><b>'+esc(r.check_in_at)+'</b></div>';
    if(r.check_out_at) kv += '<div class="kv"><span>Check out</span><b>'+esc(r.check_out_at)+'</b></div>';
    if(r.confirmation) kv += '<div class="kv"><span>Confirmation</span><b class="conf">'+esc(r.confirmation)+'</b></div>';
    if(r.site)         kv += '<div class="kv"><span>Site</span><b>'+esc(r.site)+'</b></div>';
    if(r.cost!=null)   kv += '<div class="kv"><span>Cost</span><b>$'+r.cost.toFixed(2)+'</b></div>';
    kv += '<div class="kv"><span>Booked</span><b>'+(r.booked?"Yes":"Not yet")+'</b></div>';
    if(r.cancel_by)    kv += '<div class="kv"><span>Cancel by</span><b>'+esc(r.cancel_by)+'</b></div>';
    el("s-res").innerHTML =
      '<button class="back" onclick="'+RES_BACK+'">&larr;</button>' +
      '<h1>'+esc(r.name)+'</h1><p class="sub">'+esc(r.place_name||"")+'</p>' +
      '<div class="card" style="padding:4px 14px">'+kv+'</div>' +
      (r.notes ? '<h2>Her notes</h2><div class="card"><p class="hers" style="margin:0;font-size:14.5px;line-height:1.5">'+
        esc(r.notes)+'</p></div>' : '') +
      '<div class="actionbar">' +
        (r.url ? '<a class="ghostbtn" href="'+esc(r.url)+'" target="_blank" rel="noopener">Booking page</a>' : '') +
      '</div>';
  });
}

var GEO = null;

/* Draws the route into any container. Used inline on Trip and full-size on the
   map screen; one projection, one code path, no chance of the two disagreeing. */
function drawMap(containerId, height, onTap){
  Promise.all([get("/api/map"), geo()]).then(function(res){
    var d = res[0], arcs = res[1] || [], box = el(containerId);
    if (!box) return;
    box.innerHTML = mapSvg(d, arcs, 360, height);
    if (onTap) { box.style.cursor = "pointer"; box.onclick = onTap; }
  });
}

var PROJ = null;
function mapSvg(d, arcs, W, H){
  var pts = [];
  (d.tracks||[]).forEach(function(t){ t.forEach(function(c){ pts.push(c); }); });
  if (d.current) pts.push([d.current.lon, d.current.lat]);
  if (!pts.length) return '<p class="empty" style="padding:20px">No track yet.</p>';

  var xs = pts.map(function(p){ return p[0]; }), ys = pts.map(function(p){ return p[1]; });
  var x0=Math.min.apply(null,xs), x1=Math.max.apply(null,xs);
  var y0=Math.min.apply(null,ys), y1=Math.max.apply(null,ys);
  var cx=(x0+x1)/2, cy=(y0+y1)/2;
  var kx = Math.cos(cy*Math.PI/180);
  var spanX = Math.max((x1-x0)*kx, 0.01), spanY = Math.max(y1-y0, 0.01);
  var pad = 2.2;
  var scale = Math.min(W/(spanX*pad), H/(spanY*pad));
  var px=function(lon){ return W/2 + (lon-cx)*kx*scale; };
  var py=function(lat){ return H/2 - (lat-cy)*scale; };
  // Kept so a detail fetch can reproject its points into the same frame
  // without redrawing the boundaries underneath.
  PROJ = { px:px, py:py, W:W, H:H,
           lon:function(X){ return cx + (X - W/2)/(kx*scale); },
           lat:function(Y){ return cy - (Y - H/2)/scale; } };

  var land = arcs.map(function(a){
    var dd="";
    for (var i=0;i<a.length;i++) dd += (i?"L":"M")+px(a[i][0]).toFixed(1)+" "+py(a[i][1]).toFixed(1);
    return '<path d="'+dd+'" fill="none" stroke="#d3ddd6" stroke-width="1" vector-effect="non-scaling-stroke"/>';
  }).join("");
  var route = pts.map(function(p,i){ return (i?"L":"M")+px(p[0]).toFixed(1)+" "+py(p[1]).toFixed(1); }).join(" ");
  var pins = (d.stops||[]).map(function(st){
    return '<circle cx="'+px(st.lon).toFixed(1)+'" cy="'+py(st.lat).toFixed(1)+
           '" r="3.5" data-r="3.5" fill="#c8621f" stroke="#fff" stroke-width="1" vector-effect="non-scaling-stroke"/>'; }).join("");
  var st0 = pts[0];
  var here = d.current
    ? '<circle cx="'+px(d.current.lon).toFixed(1)+'" cy="'+py(d.current.lat).toFixed(1)+'" r="10" data-r="10" fill="#1f6f5c" opacity=".22"/>' +
      '<circle cx="'+px(d.current.lon).toFixed(1)+'" cy="'+py(d.current.lat).toFixed(1)+'" r="5" data-r="5" fill="#1f6f5c" stroke="#fff" stroke-width="1.5" vector-effect="non-scaling-stroke"/>' : "";
  // Markers and strokes are kept screen-constant across zoom: strokes via
  // vector-effect=non-scaling-stroke, marker RADII via applyVB() counter-scaling
  // (data-r holds the fit-size radius). Without this, zooming the viewBox
  // magnifies the fixed-radius "now" dot into a screen-filling blob.
  return '<svg viewBox="0 0 '+W+' '+H+'" style="width:100%;height:100%">' +
    '<rect width="'+W+'" height="'+H+'" fill="#f4f7f4"/>' + '<g id="landlayer">' + land + '</g>' +
    '<g id="routelayer"><path d="'+route+'" fill="none" stroke="#1f6f5c" stroke-width="2.6" vector-effect="non-scaling-stroke" stroke-linejoin="round" stroke-linecap="round"/></g>' +
    '<g id="marklayer">' +
    '<circle cx="'+px(st0[0]).toFixed(1)+'" cy="'+py(st0[1]).toFixed(1)+'" r="4" data-r="4" fill="#14110e" stroke="#fff" stroke-width="1.5" vector-effect="non-scaling-stroke"/>' +
    pins + here + '</g></svg>';
}
function geo(){
  if (GEO) return Promise.resolve(GEO);
  return get("/geo/states.json").then(function(g){ GEO = g; return g; });
}

/* 90 KB against the coarse tier's 25 — not worth spending on a campground
   connection until somebody actually zooms in. Fetched on first zoom, then
   cached immutably for the rest of the trip. */
var GEO_FINE = null, GEO_FINE_PENDING = false;
function geoFine(){
  if (GEO_FINE) return Promise.resolve(GEO_FINE);
  if (GEO_FINE_PENDING) return Promise.resolve(null);
  GEO_FINE_PENDING = true;
  return get("/geo/states-fine.json").then(function(g){
    GEO_FINE = g; GEO_FINE_PENDING = false; return g;
  }, function(){ GEO_FINE_PENDING = false; return null; });
}

/* ---- Real basemap: MapLibre + self-hosted Protomaps tiles on R2. ----
   The library, style, fonts, sprites and tiles all come from our own
   tiles.roadtripadventure.app — no key, no cap, no third party. Everything is
   lazy: nothing map-related loads until someone opens the Map tab, so Today
   stays light on campground wifi. If the library cannot load (offline, tiles
   host unreachable), the screen falls back to the original in-house vector
   map below; if only the TILES fail, MapLibre still draws the route and
   markers on a blank ground — route-on-blank, never a white screen. */
var TILES_BASE = "https://tiles.roadtripadventure.app";
var ML_FAILED = false, ML_MAP = null;

function ensureMapLibre(){
  if (window.maplibregl) return Promise.resolve(true);
  if (ML_FAILED) return Promise.resolve(false);
  return new Promise(function(resolve){
    var done = false;
    function finish(ok){ if (!done){ done = true; ML_FAILED = !ok; resolve(ok); } }
    var l = document.createElement("link");
    l.rel = "stylesheet"; l.href = TILES_BASE + "/lib/maplibre-gl.css";
    document.head.appendChild(l);
    var s = document.createElement("script");
    s.src = TILES_BASE + "/lib/maplibre-gl.js";
    s.onload = function(){ finish(!!window.maplibregl); };
    s.onerror = function(){ finish(false); };
    document.head.appendChild(s);
    setTimeout(function(){ finish(!!window.maplibregl); }, 12000);
  });
}

function trackBounds(d){
  var lons = [], lats = [];
  (d.tracks||[]).forEach(function(t){ t.forEach(function(c){ lons.push(c[0]); lats.push(c[1]); }); });
  if (d.current){ lons.push(d.current.lon); lats.push(d.current.lat); }
  if (!lons.length) return null;
  var pad = 0.15;
  return [[Math.min.apply(null,lons)-pad, Math.min.apply(null,lats)-pad],
          [Math.max.apply(null,lons)+pad, Math.max.apply(null,lats)+pad]];
}

function mlFit(){ if (ML_MAP){ var b = ML_MAP.__fitBounds; if (b) ML_MAP.fitBounds(b, { padding: 36, duration: 400 }); } }
function mlZoom(dz){ if (ML_MAP) ML_MAP.zoomTo(ML_MAP.getZoom()+dz, { duration: 250 }); }

function basemapOverlays(map, d){
  var feats = function(rows, props){ return { type:"FeatureCollection", features: rows.map(function(r){
    return { type:"Feature", properties: props(r),
             geometry:{ type:"Point", coordinates:[r.lon, r.lat] } }; }) }; };
  map.addSource("route", { type:"geojson", data:{ type:"Feature", properties:{},
    geometry:{ type:"MultiLineString", coordinates:(d.tracks||[]).filter(function(t){ return t.length>1; }) } } });
  map.addLayer({ id:"route-casing", type:"line", source:"route",
    layout:{ "line-join":"round", "line-cap":"round" },
    paint:{ "line-color":"#ffffff", "line-width":5.5, "line-opacity":0.75 } });
  map.addLayer({ id:"route-line", type:"line", source:"route",
    layout:{ "line-join":"round", "line-cap":"round" },
    paint:{ "line-color":"#1f6f5c", "line-width":3 } });

  // Itinerary places: dots always, names once you're close enough to care.
  map.addSource("places", { type:"geojson", data: feats(d.places||[], function(p){ return { name:p.name, id:p.id }; }) });
  map.addLayer({ id:"place-dots", type:"circle", source:"places",
    paint:{ "circle-radius":4, "circle-color":"#4a6fa5",
            "circle-stroke-color":"#ffffff", "circle-stroke-width":1.3 } });
  map.addLayer({ id:"place-labels", type:"symbol", source:"places", minzoom:5.2,
    layout:{ "text-field":["get","name"], "text-font":["Noto Sans Medium"],
             "text-size":11.5, "text-anchor":"top", "text-offset":[0,0.8], "text-optional":true },
    paint:{ "text-color":"#31435c", "text-halo-color":"#ffffff", "text-halo-width":1.4 } });

  // Where the car itself stopped (>=12 min between trips) — dropped
  // automatically, nobody taps anything. THE marker, per Andy, literally.
  map.addSource("vstops", { type:"geojson", data: feats(
    (d.vehicle_stops||[]).filter(function(v){ return v.lat != null; }),
    function(v){ return { date:v.date||"", mins:v.mins, ongoing:v.ongoing?1:0, at:v.at||"" }; }) });
  map.addLayer({ id:"vstop-dots", type:"circle", source:"vstops",
    paint:{ "circle-radius":3.5, "circle-color":"#6b6459",
            "circle-stroke-color":"#ffffff", "circle-stroke-width":1.2 } });

  map.addSource("stops", { type:"geojson", data: feats(d.stops||[], function(s){
    return { kind:s.kind, place:s.place||"", date:s.date||(s.occurred_at||"").slice(0,10) }; }) });
  map.addLayer({ id:"stop-dots", type:"circle", source:"stops",
    paint:{ "circle-radius":4.5, "circle-color":"#c8621f",
            "circle-stroke-color":"#ffffff", "circle-stroke-width":1.3 } });

  // Photos and journal entries, as emoji icons drawn into sprites (the font
  // PBFs carry no emoji, but a canvas does).
  function emojiIcon(name, glyph){
    var c = document.createElement("canvas"); c.width = 48; c.height = 48;
    var x = c.getContext("2d");
    x.beginPath(); x.arc(24,24,22,0,7); x.fillStyle="#ffffff"; x.fill();
    x.strokeStyle="rgba(0,0,0,.18)"; x.lineWidth=2; x.stroke();
    x.font = "26px serif"; x.textAlign="center"; x.textBaseline="middle";
    x.fillText(glyph, 24, 26);
    if (!map.hasImage(name)) map.addImage(name, x.getImageData(0,0,48,48), { pixelRatio: 2 });
  }
  emojiIcon("pin-photo", "📷");
  emojiIcon("pin-journal", "✏️");

  map.addSource("photopins", { type:"geojson", data: feats(d.photos||[], function(p){
    return { id:p.id, thumb:p.thumb_key||"", date:p.date||"" }; }) });
  map.addLayer({ id:"photo-pins", type:"symbol", source:"photopins",
    layout:{ "icon-image":"pin-photo", "icon-size":0.75, "icon-allow-overlap":true } });

  map.addSource("journalpins", { type:"geojson", data: feats(d.journal||[], function(j){
    return { id:j.id, date:j.date||"", excerpt:j.excerpt||"", author:j.author||"" }; }) });
  map.addLayer({ id:"journal-pins", type:"symbol", source:"journalpins",
    layout:{ "icon-image":"pin-journal", "icon-size":0.75, "icon-allow-overlap":true } });

  /* Everything on the map opens the thing it stands for. */
  function popupAt(coord, html){
    new maplibregl.Popup({ maxWidth:"250px", closeButton:true })
      .setLngLat(coord).setHTML(html).addTo(map);
  }
  map.on("click", "place-dots", function(e){
    var f = e.features[0];
    popupAt(f.geometry.coordinates,
      '<b>'+esc(f.properties.name)+'</b><br>' +
      '<button class="ghostbtn" style="margin-top:6px" ' +
        'onclick="loadPlace(\''+esc(f.properties.id)+'\',\'map\')">Open the plan</button>');
  });
  map.on("click", "place-labels", function(e){
    var f = e.features[0];
    loadPlace(f.properties.id, "map");
  });
  map.on("click", "vstop-dots", function(e){
    var f = e.features[0], pr = f.properties;
    popupAt(f.geometry.coordinates,
      '<b>Car stopped here</b><br>' +
      '<span style="font-size:12px;color:#666">' +
      (pr.ongoing ? 'Still there' : (pr.mins ? 'For ' + (pr.mins >= 60
        ? Math.floor(pr.mins/60) + 'h ' + (pr.mins%60) + 'm' : pr.mins + ' min') : '')) +
      (pr.at ? ' &middot; ' + fmtTime(pr.at) : '') + '</span><br>' +
      '<button class="ghostbtn" style="margin-top:6px" ' +
        'onclick="loadDay(\''+esc(pr.date)+'\')">Open that day</button>');
  });
  map.on("click", "stop-dots", function(e){
    var f = e.features[0], pr = f.properties;
    popupAt(f.geometry.coordinates,
      '<b>'+(ICON[pr.kind]||"")+' '+esc(pr.place || pr.kind)+'</b><br>' +
      '<button class="ghostbtn" style="margin-top:6px" ' +
        'onclick="loadDay(\''+esc(pr.date)+'\')">Open that day</button>');
  });
  map.on("click", "photo-pins", function(e){
    var f = e.features[0], pr = f.properties;
    popupAt(f.geometry.coordinates,
      (pr.thumb ? '<img src="/photo/'+esc(pr.thumb)+'" style="width:100%;border-radius:8px" ' +
        'onclick="loadDay(\''+esc(pr.date)+'\')">' : '') +
      '<button class="ghostbtn" style="margin-top:6px" ' +
        'onclick="loadDay(\''+esc(pr.date)+'\')">Open that day</button>');
  });
  map.on("click", "journal-pins", function(e){
    var f = e.features[0], pr = f.properties;
    popupAt(f.geometry.coordinates,
      '<p style="margin:0;font-size:13px;line-height:1.4">'+esc(pr.excerpt)+
      (pr.excerpt.length >= 120 ? '&hellip;' : '')+'</p>' +
      '<p style="margin:4px 0 0;font-size:11px;color:#888">'+esc(pr.author)+'</p>' +
      '<button class="ghostbtn" style="margin-top:6px" ' +
        'onclick="loadDay(\''+esc(pr.date)+'\')">Open that day</button>');
  });
  ["place-dots","place-labels","stop-dots","photo-pins","journal-pins","vstop-dots"].forEach(function(l){
    map.on("mouseenter", l, function(){ map.getCanvas().style.cursor = "pointer"; });
    map.on("mouseleave", l, function(){ map.getCanvas().style.cursor = ""; });
  });

  var t0 = (d.tracks && d.tracks[0] && d.tracks[0][0]) || null;
  if (t0) {
    map.addSource("home", { type:"geojson", data:{ type:"Feature", properties:{},
      geometry:{ type:"Point", coordinates:t0 } } });
    map.addLayer({ id:"home-dot", type:"circle", source:"home",
      paint:{ "circle-radius":5, "circle-color":"#14110e",
              "circle-stroke-color":"#ffffff", "circle-stroke-width":1.5 } });
  }
  if (d.current) {
    map.addSource("here", { type:"geojson", data:{ type:"Feature", properties:{},
      geometry:{ type:"Point", coordinates:[d.current.lon, d.current.lat] } } });
    map.addLayer({ id:"here-halo", type:"circle", source:"here",
      paint:{ "circle-radius":11, "circle-color":"#1f6f5c", "circle-opacity":0.22 } });
    map.addLayer({ id:"here-dot", type:"circle", source:"here",
      paint:{ "circle-radius":5.5, "circle-color":"#1f6f5c",
              "circle-stroke-color":"#ffffff", "circle-stroke-width":1.5 } });
  }
}

function renderBasemap(d){
  el("s-map").innerHTML =
    '<h1>Where they have been</h1><p class="sub">'+(d.miles||0)+' miles</p>' +
    '<div class="maparea" id="bigmap" style="height:62vh"></div>' +
    '<div class="row" style="margin-top:8px;gap:8px">' +
      '<button class="ghostbtn" style="margin:0;flex:1" onclick="mlZoom(-1)">&minus;</button>' +
      '<button class="ghostbtn" style="margin:0;flex:1" onclick="mlZoom(1)">+</button>' +
      '<button class="ghostbtn" style="margin:0;flex:2" onclick="mlFit()">Fit</button>' +
    '</div>' +
    '<p class="tiny" style="margin-top:9px">' +
      '<span style="color:#14110e">&#9679;</span> home &middot; ' +
      '<span style="color:#6b6459">&#9679;</span> car stops &middot; ' +
      '<span style="color:#c8621f">&#9679;</span> recorded stops &middot; ' +
      '<span style="color:#4a6fa5">&#9679;</span> the plan &middot; ' +
      '<span style="color:#1f6f5c">&#9679;</span> now &middot; ' +
      '&#128247; photos &middot; &#9999;&#65039; journal &mdash; tap anything to open it</p>';
  var b = trackBounds(d);
  var opts = { container:"bigmap", style: TILES_BASE + "/style.json?v=3",
               minZoom:3, maxZoom:17.5, attributionControl:false };
  if (b) { opts.bounds = b; opts.fitBoundsOptions = { padding: 36 }; }
  else { opts.center = [-98, 42]; opts.zoom = 3.5; }
  var map = new maplibregl.Map(opts);
  map.addControl(new maplibregl.AttributionControl({ compact:true }));
  ML_MAP = map; map.__fitBounds = b;
  map.on("error", function(){ /* per-tile failures: basemap goes blank there,
    overlays keep rendering. Deliberate: route-on-blank beats white screen. */ });
  var loaded = false;
  map.on("load", function(){ loaded = true; basemapOverlays(map, d); });
  setTimeout(function(){
    if (!loaded) {
      // Style never arrived (offline / tiles host down). Tear down and use
      // the in-house vector map instead.
      try { map.remove(); } catch(e){}
      ML_MAP = null;
      loadMapScreenVector(d);
    }
  }, 10000);
}

function loadMapScreen(){
  show("map");
  Promise.all([get("/api/map"), ensureMapLibre()]).then(function(res){
    var d = res[0], libOk = res[1];
    if (!d) { offlineInto("s-map", "loadMapScreen()"); return; }
    if (libOk) renderBasemap(d);
    else loadMapScreenVector(d);
  });
}

/* The original in-house vector map, kept as the offline fallback until the
   basemap has proven itself on the road. Reached when maplibre-gl cannot be
   fetched at all, or when the style/tiles never load. */
function loadMapScreenVector(d){
  geo().then(function(arcs){
    arcs = arcs || [];

    // ONE renderer, shared with the Trip mini-map. A second copy lived here and
    // that duplication was exactly what killed progressive zoom: this screen
    // emitted an SVG with no routelayer for detail to paint into, and left PROJ
    // holding the mini-map's 210px projection, so every detail fetch computed a
    // bounding box for the wrong region of the wrong map.
    el("s-map").innerHTML =
      '<h1>Where they have been</h1><p class="sub">'+(d.miles||0)+' miles</p>' +
      '<div class="maparea" id="bigmap" style="height:58vh;touch-action:none">' +
        mapSvg(d, arcs, 360, 340) + '</div>' +
      '<div class="row" style="margin-top:8px;gap:8px">' +
        '<button class="ghostbtn" style="margin:0;flex:1" onclick="zoomBy(1/1.6)">&minus;</button>' +
        '<button class="ghostbtn" style="margin:0;flex:1" onclick="zoomBy(1.6)">+</button>' +
        '<button class="ghostbtn" style="margin:0;flex:2" onclick="zoomReset()">Fit</button>' +
      '</div>' +
      '<p class="tiny" style="margin-top:9px">' +
        '<span style="color:#14110e">&#9679;</span> home &middot; ' +
        '<span style="color:#c8621f">&#9679;</span> stops &middot; ' +
        '<span style="color:#1f6f5c">&#9679;</span> where they are now' +
        ' &mdash; pinch to zoom, drag to pan, double-tap to fit</p>';
    attachZoom();
  });
}

/* Pinch, drag and double-tap on the map. Implemented by moving the SVG viewBox
   rather than a CSS transform, so the route and state outlines stay crisp at
   any zoom instead of turning into a blurry upscaled bitmap. Restored 2026-08-03
   (session-daap0w) — the eb8bdf1 mapSvg() consolidation dropped these four
   definitions while keeping every caller, so attachZoom() threw on svgEl() and
   the whole Map screen was frozen. Verbatim from fd64341. */
var VB0 = null, VB = null;
function svgEl(){ var b = el("bigmap"); return b && b.querySelector("svg"); }
function applyVB(){
  var sv = svgEl(); if (!sv || !VB) return;
  sv.setAttribute("viewBox", VB.x.toFixed(2)+" "+VB.y.toFixed(2)+" "+VB.w.toFixed(2)+" "+VB.h.toFixed(2));
  // Keep marker dots a constant SCREEN size: as the viewBox shrinks on zoom-in,
  // shrink each marker's user-space radius by the same factor. Strokes handle
  // themselves via vector-effect=non-scaling-stroke.
  if (VB0) {
    var k = VB.w / VB0.w;
    var ml = document.getElementById("marklayer");
    if (ml) {
      var cs = ml.querySelectorAll("circle");
      for (var i = 0; i < cs.length; i++) {
        var br = parseFloat(cs[i].getAttribute("data-r"));
        if (br) cs[i].setAttribute("r", (br * k).toFixed(2));
      }
    }
  }
}
function zoomAt(factor, cx, cy){
  if (!VB) return;
  var nw = VB.w / factor, nh = VB.h / factor;
  // Clamp: 12x in, and never further out than the original fit.
  if (nw < VB0.w/12 || nw > VB0.w) return;
  VB = { x: cx - (cx - VB.x) * (nw/VB.w), y: cy - (cy - VB.y) * (nh/VB.h), w: nw, h: nh };
  applyVB();
}
function zoomBy(f){ if (VB) { zoomAt(f, VB.x + VB.w/2, VB.y + VB.h/2); wantDetail(); } }

var DETAIL_T = null, DETAIL_KEY = null;
function wantDetail(){ clearTimeout(DETAIL_T); DETAIL_T = setTimeout(fetchDetail, 260); }

function fetchDetail(){
  if (!VB || !VB0 || !PROJ) return;
  var layer = document.getElementById("routelayer");
  if (!layer) return;
  var zoom = VB0.w / VB.w;

  if (zoom < 1.35) {                       // back at the overview
    if (DETAIL_KEY !== null) { DETAIL_KEY = null; loadMapScreen(); }
    return;
  }
  var w = PROJ.lon(VB.x), e = PROJ.lon(VB.x + VB.w);
  var n = PROJ.lat(VB.y), s2 = PROJ.lat(VB.y + VB.h);
  var key = [w,s2,e,n].map(function(v){ return v.toFixed(2); }).join(",");
  if (key === DETAIL_KEY) return;
  DETAIL_KEY = key;

  // Swap in finer coastlines at the same moment the route gets finer,
  // otherwise the road sharpens against borders that stay visibly polygonal.
  geoFine().then(function(fine){
    var lay = document.getElementById("landlayer");
    if (!fine || !lay || !PROJ) return;
    lay.innerHTML = fine.map(function(a){
      var dd = "";
      for (var i=0;i<a.length;i++) dd += (i?"L":"M")+PROJ.px(a[i][0]).toFixed(1)+" "+PROJ.py(a[i][1]).toFixed(1);
      return '<path d="'+dd+'" fill="none" stroke="#d3ddd6" stroke-width="1" vector-effect="non-scaling-stroke"/>';
    }).join("");
  });

  get("/api/track?w="+w+"&s="+s2+"&e="+e+"&n="+n+"&max=2500").then(function(r){
    if (!r || !r.tracks || DETAIL_KEY !== key) return;
    layer.innerHTML = r.tracks.map(function(t){
      return '<path d="' + t.map(function(p,i){
        return (i?"L":"M") + PROJ.px(p[0]).toFixed(2) + " " + PROJ.py(p[1]).toFixed(2);
      }).join(" ") + '" fill="none" stroke="#1f6f5c" stroke-width="2.6"' +
      ' vector-effect="non-scaling-stroke" stroke-linejoin="round" stroke-linecap="round"/>';
    }).join("");
  });
}
function zoomReset(){ if (VB0) { VB = Object.assign({}, VB0); applyVB(); DETAIL_KEY = null; loadMapScreen(); } }

function attachZoom(){
  var box = el("bigmap"), sv = svgEl();
  if (!box || !sv) return;
  var parts = (sv.getAttribute("viewBox")||"0 0 360 340").split(/\s+/).map(Number);
  VB0 = { x:parts[0], y:parts[1], w:parts[2], h:parts[3] };
  VB = Object.assign({}, VB0);

  function toSvg(clientX, clientY){
    var r = box.getBoundingClientRect();
    return { x: VB.x + (clientX - r.left)/r.width * VB.w,
             y: VB.y + (clientY - r.top)/r.height * VB.h };
  }

  var pts = {}, lastDist = null, lastMid = null, dragFrom = null, lastTap = 0;

  box.addEventListener("pointerdown", function(e){
    box.setPointerCapture(e.pointerId);
    pts[e.pointerId] = { x:e.clientX, y:e.clientY };
    var n = Object.keys(pts).length;
    if (n === 1) {
      dragFrom = toSvg(e.clientX, e.clientY);
      var now = Date.now();
      if (now - lastTap < 300) zoomReset();
      lastTap = now;
    } else { dragFrom = null; }
  });

  box.addEventListener("pointermove", function(e){
    if (!pts[e.pointerId]) return;
    pts[e.pointerId] = { x:e.clientX, y:e.clientY };
    var ids = Object.keys(pts);
    if (ids.length >= 2) {
      var a = pts[ids[0]], b = pts[ids[1]];
      var dist = Math.hypot(a.x-b.x, a.y-b.y);
      var mid = toSvg((a.x+b.x)/2, (a.y+b.y)/2);
      if (lastDist) zoomAt(dist/lastDist, mid.x, mid.y);
      lastDist = dist; lastMid = mid;
    } else if (dragFrom) {
      var p = toSvg(e.clientX, e.clientY);
      VB.x -= (p.x - dragFrom.x); VB.y -= (p.y - dragFrom.y);
      applyVB();
    }
  });

  function up(e){
    delete pts[e.pointerId];
    if (Object.keys(pts).length < 2) lastDist = null;
    if (Object.keys(pts).length === 0) { dragFrom = null; wantDetail(); }
  }
  box.addEventListener("pointerup", up);
  box.addEventListener("pointercancel", up);

  // Desktop wheel, for reviewing it on a laptop.
  box.addEventListener("wheel", function(e){
    e.preventDefault();
    var p = toSvg(e.clientX, e.clientY);
    zoomAt(e.deltaY < 0 ? 1.15 : 1/1.15, p.x, p.y);
    wantDetail();
  }, { passive:false });
}

/* --- boot ---------------------------------------------------------------- */
var nav = document.querySelectorAll(".navbar button");
for(var i=0;i<nav.length;i++)(function(b){ b.onclick=function(){ tab(b.dataset.tab); }; })(nav[i]);

/* Every screen fetches, and none of them had an error path: one failed request
   on campground wifi left a white page with a nav bar and no way to recover.
   Boot degrades to a readable message with a retry instead. */
function bootFail(){
  document.getElementById("s-today").innerHTML =
    '<h1>No connection</h1>' +
    '<p class="sub">Can\'t reach the trip right now. Anything you record is still saved on your phone ' +
    'and will send itself when you have signal.</p>' +
    '<button class="ghostbtn" onclick="boot()">Try again</button>';
  show("today");
}
function boot(){
  get("/api/me").then(function(m){
    if (!m || !m.id) return bootFail();
    ME = m; paintQueue(); flush(); tab("today");
  }, bootFail);
}
boot();
</script>
</body>
</html>`;
