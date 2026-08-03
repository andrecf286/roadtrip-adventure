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
  .navbar button{flex:1;border:0;background:none;font:inherit;font-size:12px;color:var(--ink-3);
    display:flex;flex-direction:column;align-items:center;justify-content:center;gap:5px;cursor:pointer;padding:10px 4px;border-radius:12px;margin:6px 4px}
  .navbar button .ic{font-size:26px;line-height:1}
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

  <div class="queued" id="queued"></div>

  <nav class="navbar">
    <button class="on" data-tab="today"><span class="ic">&#128205;</span>Today</button>
    <button data-tab="trip"><span class="ic">&#128197;</span>Trip</button>
    <button data-tab="map"><span class="ic">&#128506;</span>Map</button>
    <button data-tab="places"><span class="ic">&#9968;</span>Places</button>
  </nav>

<script>
var ME = null, POS = null;

function esc(s){ return String(s==null?"":s).replace(/[&<>"]/g, function(c){
  return {"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]; }); }
function el(id){ return document.getElementById(id); }
function get(u){ return fetch(u,{credentials:"same-origin"}).then(function(r){ return r.json(); }); }
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
  if(name==="map") loadMap();
  if(name==="places") loadPlaces();
}

function loadToday(){
  show("today");
  get("/api/today").then(function(d){
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
    el("s-today").innerHTML =
      live +
      '<h1>Day '+d.day_number+'</h1><p class="sub">'+fmtDay(d.date)+'</p>' +
      '<div class="stats">' +
        '<div class="stat"><span>'+(d.miles_today||0)+'</span><small>miles today</small></div>' +
        '<div class="stat"><span>'+(d.miles_total||0)+'</span><small>miles total</small></div>' +
        mpg +
        '<div class="stat"><span>'+d.day_number+'</span><small>days out</small></div>' +
      '</div>' + tonight + last +
      (ME && ME.role==="author"
        ? '<div class="actionbar"><button class="bigbtn" onclick="openStop()">Record a stop</button></div>'
        : '');
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

function finishStop(id){
  var g = el("f-gal"), p = el("f-ppg"), c = el("f-cost"), n = el("f-note");
  var patch = { id:id };
  if (g && g.value) patch.gallons = parseFloat(g.value);
  if (p && p.value) patch.price_per_gallon = parseFloat(p.value);
  if (c && c.value) patch.cost = parseFloat(c.value);
  if (n && n.value.trim()) patch.note = n.value.trim();
  var done = function(){ tab("today"); };
  if (Object.keys(patch).length > 1) {
    flush().then(function(){ return send("/api/stop","PATCH",patch); }).then(done, done);
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
    var past = d.days.map(function(x){
      var bits=[]; if(x.places) bits.push(esc(x.places));
      if(x.photos) bits.push(x.photos+" photo"+(x.photos===1?"":"s"));
      if(x.stops) bits.push(x.stops+" stop"+(x.stops===1?"":"s"));
      return '<div class="day" onclick="loadDay(\''+x.date+'\')">' +
        '<div class="daynum"><b>'+x.day_number+'</b><small>'+fmtShort(x.date)+'</small></div>' +
        '<div style="flex:1"><div class="row"><b>'+esc(x.title||(x.places?x.places.split(", ")[0]:"On the road"))+
        '</b><span class="tiny">'+(x.miles!=null?x.miles+" mi":"")+'</span></div>' +
        (bits.length?'<p class="tiny" style="margin:3px 0 0">'+bits.join(" &middot; ")+'</p>':'') +
        '</div></div>';
    }).join("") || '<p class="empty">No days yet.</p>';

    var ahead = d.ahead.map(function(i){
      return '<div class="day" style="opacity:.62" onclick="loadPlace(\''+i.id+'\')">' +
        '<div class="daynum"><b>&middot;</b><small>'+(i.planned_arrival?fmtShort(i.planned_arrival):"&mdash;")+'</small></div>' +
        '<div style="flex:1"><div class="row"><b>'+esc(i.name)+'</b><span class="tiny">'+
        esc(i.drive_time_from_prev||"")+'</span></div><p class="tiny" style="margin:3px 0 0">'+
        i.activities+' to see'+(i.booked?' &middot; booked':'')+'</p></div></div>';
    }).join("");

    el("s-trip").innerHTML = '<h1>The trip</h1><p class="sub">'+d.days.length+
      ' day'+(d.days.length===1?"":"s")+' so far</p>' + past +
      (ahead ? '<h2>Coming up</h2>'+ahead : '');
  });
}

function loadDay(date){
  show("day");
  get("/api/day?date="+encodeURIComponent(date)).then(function(d){
    var s = d.summary || {};
    var stops = d.stops.map(function(x){
      return '<div class="card"><div class="row"><span>'+(ICON[x.kind]||"")+' '+esc(x.kind)+
        (x.place?' &middot; '+esc(x.place):'')+'</span><span class="tiny">'+fmtTime(x.occurred_at)+
        '</span></div>'+(x.note?'<p class="tiny" style="margin:6px 0 0">'+esc(x.note)+'</p>':'')+'</div>';
    }).join("") || '<p class="empty">No stops recorded.</p>';
    var journal = d.journal.map(function(j){
      return '<div class="card"><p style="margin:0;font-size:15px;line-height:1.5">'+esc(j.body)+
        '</p><p class="tiny" style="margin:9px 0 0">'+esc(j.author||"")+' &middot; '+fmtTime(j.written_at)+'</p></div>';
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
      '<h2>Journal</h2>' + (journal || '<p class="empty">Nothing written yet.</p>') +
      (ME && ME.role==="author"
        ? '<div class="card" style="margin-top:9px"><textarea id="j-body" placeholder="What happened today?"></textarea>' +
          '<button class="ghostbtn" onclick="saveJournal(\''+date+'\')">Save entry</button></div>' : '') +
      '<h2>Stops</h2>' + stops;
  });
}

function saveJournal(date){
  var t = el("j-body"); if(!t || !t.value.trim()) return;
  send("/api/journal","POST",{ body:t.value, written_at:new Date().toISOString() })
    .then(function(){ loadDay(date); });
}

function loadPlaces(){
  show("places");
  get("/api/places").then(function(d){
    el("s-places").innerHTML = '<h1>Places</h1><p class="sub">'+d.places.length+
      ' on the route</p>' + d.places.map(function(p){
      return '<div class="day" onclick="loadPlace(\''+p.id+'\')">' +
        '<div style="flex:1"><div class="row"><b'+(p.visited?'':' style="opacity:.62"')+'>'+esc(p.name)+
        '</b><span class="tiny">'+(p.wanted?p.did+"/"+p.wanted:"")+'</span></div>' +
        '<p class="tiny" style="margin:3px 0 0">'+esc(p.kind||"")+
        (p.planned_arrival?' &middot; '+fmtShort(p.planned_arrival):'')+'</p></div></div>';
    }).join("");
  });
}

function loadPlace(id){
  show("place");
  get("/api/place?id="+encodeURIComponent(id)).then(function(d){
    var i = d.intention;
    var acts = d.activities.map(function(a){
      return '<li onclick="tickActivity(\''+a.id+'\','+(a.done?0:1)+',\''+id+'\')">' +
        '<span class="box'+(a.done?" done":"")+'"></span><span'+(a.done?' class="done-txt"':'')+'>' +
        esc(a.name)+(a.distance_mi?' &middot; '+a.distance_mi+' mi':'') +
        (a.detail&&!a.done?'<span class="hers">'+esc(a.detail)+'</span>':'')+'</span></li>';
    }).join("");
    var res = d.reservations.map(function(r){
      return '<div class="card tapme" onclick="loadRes(\''+r.id+'\')"><div class="row"><span>'+esc(r.name)+
        '</span><b>'+(r.cost!=null?'$'+r.cost.toFixed(2):'')+'</b></div>' +
        '<p class="tiny" style="margin:6px 0 0">'+(r.booked?'Booked':'Not booked')+'</p></div>';
    }).join("");
    el("s-place").innerHTML =
      '<button class="back" onclick="tab(\'places\')">&larr;</button>' +
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

function loadRes(id){
  show("res");
  get("/api/reservation?id="+encodeURIComponent(id)).then(function(r){
    var kv = "";
    if(r.check_in_at)  kv += '<div class="kv"><span>Check in</span><b>'+esc(r.check_in_at)+'</b></div>';
    if(r.check_out_at) kv += '<div class="kv"><span>Check out</span><b>'+esc(r.check_out_at)+'</b></div>';
    if(r.confirmation) kv += '<div class="kv"><span>Confirmation</span><b class="conf">'+esc(r.confirmation)+'</b></div>';
    if(r.site)         kv += '<div class="kv"><span>Site</span><b>'+esc(r.site)+'</b></div>';
    if(r.cost!=null)   kv += '<div class="kv"><span>Cost</span><b>$'+r.cost.toFixed(2)+'</b></div>';
    kv += '<div class="kv"><span>Booked</span><b>'+(r.booked?"Yes":"Not yet")+'</b></div>';
    if(r.cancel_by)    kv += '<div class="kv"><span>Cancel by</span><b>'+esc(r.cancel_by)+'</b></div>';
    el("s-res").innerHTML =
      '<button class="back" onclick="tab(\'today\')">&larr;</button>' +
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
function geo(){
  if (GEO) return Promise.resolve(GEO);
  return get("/geo/states.json").then(function(g){ GEO = g; return g; });
}

function loadMap(){
  show("map");
  Promise.all([get("/api/map"), geo()]).then(function(res){
    var d = res[0], arcs = res[1] || [];

    var pts = [];
    (d.tracks||[]).forEach(function(t){ t.forEach(function(c){ pts.push(c); }); });
    if (d.current) pts.push([d.current.lon, d.current.lat]);

    if (!pts.length){
      el("s-map").innerHTML = '<h1>Where they have been</h1><div class="maparea">' +
        '<p class="empty" style="padding:20px">No track yet.</p></div>';
      return;
    }

    // Fit to the route, then widen so there is recognisable country around it
    // rather than a line filling the frame edge to edge.
    var xs = pts.map(function(p){ return p[0]; }), ys = pts.map(function(p){ return p[1]; });
    var x0 = Math.min.apply(null,xs), x1 = Math.max.apply(null,xs);
    var y0 = Math.min.apply(null,ys), y1 = Math.max.apply(null,ys);
    var cx = (x0+x1)/2, cy = (y0+y1)/2;
    var W = 360, H = 340;

    // Equirectangular with a latitude correction, so the country is not
    // horizontally stretched the way a naive lon/lat plot makes it.
    var kx = Math.cos(cy * Math.PI/180);
    var spanX = Math.max((x1-x0) * kx, 0.01), spanY = Math.max(y1-y0, 0.01);
    var pad = 2.2;
    var scale = Math.min(W/(spanX*pad), H/(spanY*pad));
    var px = function(lon){ return W/2 + (lon-cx) * kx * scale; };
    var py = function(lat){ return H/2 - (lat-cy) * scale; };

    var land = arcs.map(function(a){
      var dd = "", any = false;
      for (var i=0;i<a.length;i++){
        var X = px(a[i][0]), Y = py(a[i][1]);
        if (X < -400 || X > W+400 || Y < -400 || Y > H+400) { dd += ""; }
        dd += (i? "L":"M") + X.toFixed(1) + " " + Y.toFixed(1);
        any = true;
      }
      return any ? '<path d="'+dd+'" fill="none" stroke="#d3ddd6" stroke-width="1"/>' : "";
    }).join("");

    var route = pts.map(function(p,i){
      return (i?"L":"M") + px(p[0]).toFixed(1) + " " + py(p[1]).toFixed(1);
    }).join(" ");

    var pins = (d.stops||[]).map(function(st){
      return '<circle cx="'+px(st.lon).toFixed(1)+'" cy="'+py(st.lat).toFixed(1)+
             '" r="3.5" fill="#c8621f" stroke="#fff" stroke-width="1"/>';
    }).join("");

    var start = pts[0];
    var here = d.current
      ? '<circle cx="'+px(d.current.lon).toFixed(1)+'" cy="'+py(d.current.lat).toFixed(1)+
        '" r="10" fill="#1f6f5c" opacity=".22"/>' +
        '<circle cx="'+px(d.current.lon).toFixed(1)+'" cy="'+py(d.current.lat).toFixed(1)+
        '" r="5" fill="#1f6f5c" stroke="#fff" stroke-width="1.5"/>' : "";

    var svg = '<svg viewBox="0 0 '+W+' '+H+'" style="width:100%;height:100%">' +
      '<rect width="'+W+'" height="'+H+'" fill="#f4f7f4"/>' + land +
      '<path d="'+route+'" fill="none" stroke="#1f6f5c" stroke-width="2.6" ' +
        'stroke-linejoin="round" stroke-linecap="round"/>' +
      '<circle cx="'+px(start[0]).toFixed(1)+'" cy="'+py(start[1]).toFixed(1)+
        '" r="4" fill="#14110e" stroke="#fff" stroke-width="1.5"/>' +
      pins + here + '</svg>';

    el("s-map").innerHTML =
      '<h1>Where they have been</h1><p class="sub">'+d.miles+' miles</p>' +
      '<div class="maparea">'+svg+'</div>' +
      '<p class="tiny" style="margin-top:9px">' +
        '<span style="color:#14110e">&#9679;</span> home &middot; ' +
        '<span style="color:#c8621f">&#9679;</span> stops &middot; ' +
        '<span style="color:#1f6f5c">&#9679;</span> where they are now</p>';
  });
}

/* --- boot ---------------------------------------------------------------- */
var nav = document.querySelectorAll(".navbar button");
for(var i=0;i<nav.length;i++)(function(b){ b.onclick=function(){ tab(b.dataset.tab); }; })(nav[i]);

get("/api/me").then(function(m){ ME=m; paintQueue(); flush(); tab("today"); });
</script>
</body>
</html>`;
