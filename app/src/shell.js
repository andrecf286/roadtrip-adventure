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
  .screen{display:none;min-height:100vh;min-height:100dvh;padding:calc(20px + var(--safe-top)) 18px calc(var(--nav-h) + 58px + var(--safe-bot))}
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
  .actionbar{position:fixed;left:0;right:0;bottom:calc(var(--nav-h) + var(--safe-bot));padding:12px 18px 14px;
    background:linear-gradient(to top,var(--paper) 62%,transparent);z-index:40;max-width:640px;margin:0 auto}
  .bigbtn{display:block;width:100%;border:0;border-radius:16px;background:var(--sun);color:#fff;
    font:inherit;font-size:17.5px;font-weight:660;padding:19px;cursor:pointer;box-shadow:0 5px 16px rgba(200,98,31,.32)}
  .bigbtn:active{transform:translateY(1px)}
  .bigbtn[disabled]{opacity:.5}
  .ghostbtn{display:block;width:100%;border:1px solid var(--line);border-radius:14px;background:var(--card);
    color:var(--ink);font:inherit;font-size:15.5px;font-weight:600;padding:15px;cursor:pointer;margin-top:9px;text-decoration:none;text-align:center}
  /* Shrikhand, self-hosted from our own origin — no third party in any asset
     path, same rule as the map tiles. */
  @font-face{font-family:'Bling';src:url('/font/title.woff2') format('woff2');
    font-weight:400;font-style:normal;font-display:swap}
  /* min(100%,384px), NOT min(96vw,384px). 96vw is measured against the
     VIEWPORT and .screen carries 18px of padding each side, so on a 390px
     phone the dial came out 374px inside a 354px content box — 20px too wide.
     Auto margins resolve to ZERO when there is no free space, so instead of
     centring, the box pinned to the left edge of the content box and spilled
     20px past the right padding, right off the viewport (scrollWidth 392 on a
     390 screen). It has been off-centre since the dial shipped; what made it
     visible was the alert banner, which is correctly inset and gave the eye a
     straight edge to measure against for the first time.
     Costs ~20px of diameter and buys alignment with every card, the banner and
     the caption — one gutter down the whole screen. Buttons stay 67px, well
     over the 44px tap floor. */
  .dial{position:relative;width:min(100%,384px);aspect-ratio:1;margin:16px auto 4px}
  /* aspect-ratio needs Safari 15. Without these the dial gets width and NO
     height, taking the six record buttons and the photo down with it — the
     whole capture surface would simply not be there. */
  @supports not (aspect-ratio: 1){
    .dial{height:0;padding-bottom:min(100%,384px)}
    .dialbtn{height:auto;padding:14px 0}
    .dialcentre{height:0;padding-bottom:98%}
    .parkposter img{height:150px}
  }
  /* Buttons sit ON the picture, small, around its edge — the photo is the
     ground rather than a hole in the middle of a ring. z-index over the
     scrim so a dark shot never swallows one. */
  .dialbtn{position:absolute;z-index:3;transform:translate(-50%,-50%);width:19%;aspect-ratio:1;
    border-radius:50%;border:1px solid rgba(255,255,255,.9);background:var(--btn,var(--card));
    display:flex;flex-direction:column;align-items:center;justify-content:center;gap:1px;
    font:inherit;cursor:pointer;box-shadow:0 3px 12px rgba(20,12,6,.45);
    transition:transform .13s ease, box-shadow .13s ease, background .3s ease}
  .dialbtn .ic{font-size:27px;line-height:1}
  /* Shrikhand ships in ONE weight. Asking for 700 made the browser synthesise
     a bold, which is what read as smeared at this size — 400 is the real face. */
  .dialbtn .lb{font-family:'Bling',-apple-system,sans-serif;font-size:13px;font-weight:400;
    color:var(--ink);letter-spacing:0;line-height:1.05}
  .dialbtn:active{transform:translate(-50%,-50%) scale(.92)}
  .dialbtn.lit{box-shadow:0 0 0 3px var(--sun), 0 5px 16px rgba(200,98,31,.45)}
  .dialcentre{position:absolute;z-index:1;left:50%;top:50%;transform:translate(-50%,-50%);
    width:98%;aspect-ratio:1;border-radius:50%;overflow:hidden;cursor:pointer;
    background:var(--tap);box-shadow:0 5px 20px rgba(60,40,20,.26)}
  .dialcentre img{width:100%;height:100%;object-fit:cover;display:block}
  .dial.solo{margin:16px auto 2px}
  .herocap{margin:0 0 14px;text-align:center;font-size:12.5px;color:var(--ink-2)}
  /* Darkest where the words are, clearing toward the rim so the picture still
     reads as a picture. Pulled back from .74/.66/.30/.10 on 2026-08-06 — Andy:
     "a bit too dark". The prompt still reads at .52; the photograph survives. */
  .dialscrim{position:absolute;inset:0;background:radial-gradient(circle at 50% 50%,
    rgba(20,12,6,.52) 0%, rgba(20,12,6,.44) 32%, rgba(20,12,6,.18) 64%, rgba(20,12,6,.06) 100%)}
  /* The recessive dial. The four who watch get the same instrument the two who
     drive get, visibly theirs-to-see rather than theirs-to-use: buttons at 40%,
     no scrim, so the photograph stays a photograph. Touching one brings the
     whole thing up to the girls' version — prompt, arrow, lit button — for six
     seconds. That is the point of showing it at all: a parent who can read
     "Where are you sleeping? Is it cool?" has something to text about, and
     those prompts are aimed at the surfaces sitting at zero. */
  .dial.ghost .dialbtn{opacity:.40;border-color:rgba(255,255,255,.65);
    transition:opacity .3s ease, box-shadow .3s ease}
  .dial.ghost .dialscrim,.dial.ghost .dialprompt,.dial.ghost .dialarrow{
    opacity:0;transition:opacity .3s ease}
  /* At rest the cycling highlight would be a blinking orange ring on somebody's
     photograph, so the flattened shadow is scoped to :not(.awake) — and the lit
     ring is restated at .awake. Both halves matter: .dial.ghost .dialbtn is
     three classes and .dialbtn.lit is two, so an unscoped shadow here wins on
     specificity and silently swallows the highlight in BOTH states. It did.
     The class was set correctly the whole time; only the rendered picture
     showed it. */
  .dial.ghost:not(.awake) .dialbtn{box-shadow:0 2px 7px rgba(20,12,6,.28)}
  .dial.ghost.awake .dialbtn{opacity:.94}
  .dial.ghost.awake .dialbtn.lit{box-shadow:0 0 0 3px var(--sun), 0 5px 16px rgba(200,98,31,.45)}
  .dial.ghost.awake .dialscrim,.dial.ghost.awake .dialprompt,.dial.ghost.awake .dialarrow{opacity:1}
  /* Fixed, like the offline-queue banner, because a viewer can touch a control
     on five different screens and the line has to land the same way on all of
     them. */
  /* Alerts are the only red in the app. Everything else here is warm paper and
     orange; a Red Flag Warning has to not look like the rest of the trip. */
  /* The badge wall. Every category renders into the SAME tile — family
     photograph, state outline, park poster, interstate shield, fuel pill — so
     one grid holds all five and a sixth would need no new layout. Square tiles
     with contained art rather than cover: a 600x797 park poster and a wide
     state outline both have to sit in the same box without being cropped into
     nonsense. */
  /* The seam. A labelled line across the timeline where the past stops and the
     plan starts, so "now" is a place on the page rather than something you have
     to work out from the dates. */
  .maplinks{display:flex;align-items:center;gap:10px;margin:10px 0 2px}
  .maplinks .ghostbtn{margin:0;flex:1}
  .maplinks .gmap{flex:none;font-size:12.5px;color:var(--ink-3);text-decoration:none;
    padding:8px 4px}
  .maplinks .gmap:active{color:var(--sun)}
  .seam{display:flex;align-items:center;gap:10px;margin:16px 0 10px;
    color:var(--sun);font-size:12px;font-weight:700;letter-spacing:.4px;
    text-transform:uppercase}
  .seam:before,.seam:after{content:"";flex:1;height:2px;border-radius:2px;
    background:linear-gradient(90deg,transparent,var(--sun),transparent)}
  .bwall{display:grid;grid-template-columns:repeat(auto-fill,minmax(98px,1fr));
    gap:10px;margin:0 0 4px}
  .btile{background:var(--card);border:1px solid var(--line);border-radius:14px;
    padding:9px 6px 8px;text-align:center;cursor:pointer;
    box-shadow:0 2px 8px rgba(80,60,30,.08);transition:transform .12s ease}
  .btile:active{transform:scale(.96)}
  .btile .art{height:76px;display:flex;align-items:center;justify-content:center;margin-bottom:5px}
  .btile .art img{max-width:100%;max-height:76px;object-fit:contain;border-radius:5px;display:block}
  .btile .art svg{max-height:76px;max-width:100%}
  .btile .art .glyph{font-size:44px;line-height:1}
  /* Two lines then ellipsis: "Theodore Roosevelt National Park" must not push
     its neighbours down the grid. The full name is on the detail screen. */
  .btile .bname{font-size:11.5px;font-weight:650;line-height:1.2;
    display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
  .btile .bsub{font-size:10.5px;opacity:.6;margin-top:2px}
  .btile.locked{opacity:.42}
  .bdart{display:flex;justify-content:center;margin:4px 0 14px}
  .bdart img{max-width:100%;max-height:340px;border-radius:14px;display:block;
    box-shadow:0 4px 18px rgba(80,60,30,.18)}
  .bdart .glyph{font-size:96px;line-height:1}
  .bfact{display:flex;justify-content:space-between;gap:12px;padding:9px 0;
    border-bottom:1px solid var(--line);font-size:14px}
  .bfact:last-child{border-bottom:0}
  .bfact b{font-weight:650}
  .wxalert{border-radius:12px;padding:10px 12px;margin:0 0 10px;cursor:pointer;
    border:1px solid;line-height:1.35}
  .wxalert.bad{background:#fdecea;border-color:#e3a49c;color:#7d1f14}
  .wxalert.warn{background:#fdf3e3;border-color:#e6c48c;color:#7a5210}
  .wxalert .tiny{color:inherit;opacity:.72}
  .wxbody{display:none}
  .wxalert.open .wxbody{display:block}
  .wxmore{margin-top:2px;opacity:.7}
  .wxalert.open .wxmore{display:none}
  .denytoast{position:fixed;left:50%;transform:translateX(-50%);
    bottom:calc(var(--nav-h) + var(--safe-bot) + 12px);width:min(92vw,420px);z-index:60;
    background:rgba(20,12,6,.94);color:#fff;border-radius:13px;padding:11px 14px;
    font-size:13px;line-height:1.4;box-shadow:0 6px 24px rgba(0,0,0,.4);
    opacity:0;pointer-events:none;transition:opacity .22s ease, transform .22s ease}
  .denytoast.on{opacity:1;transform:translateX(-50%) translateY(-4px)}
  .dialprompt{position:absolute;z-index:2;left:50%;top:50%;transform:translate(-50%,-50%);
    width:52%;color:#fff;font-size:13px;font-weight:700;line-height:1.3;text-align:center;
    text-shadow:0 1px 4px rgba(0,0,0,.75);pointer-events:none}
  /* Swings around to whichever button the sentence is talking about. */
  .dialarrow{position:absolute;z-index:2;color:#fff;font-size:23px;line-height:1;
    text-shadow:0 1px 5px rgba(0,0,0,.95), 0 0 12px rgba(0,0,0,.7);pointer-events:none;
    transition:left .5s cubic-bezier(.34,1.25,.5,1), top .5s cubic-bezier(.34,1.25,.5,1),
               transform .5s cubic-bezier(.34,1.25,.5,1)}
  .rtpop .maplibregl-popup-content{padding:0;border-radius:14px;overflow:hidden;
    box-shadow:0 6px 22px rgba(30,20,10,.26)}
  .popimg{display:block;width:100%;height:150px;object-fit:cover}
  .popbody{padding:9px 11px 11px}
  .popt{font-weight:700;font-size:14px;color:var(--ink)}
  .popm{color:var(--ink-2);font-size:12px;margin-top:2px;line-height:1.35}
  .popq{margin:6px 0 0;font-size:13px;line-height:1.4;color:var(--ink)}
  .pophint{margin-top:8px;font-size:11.5px;color:var(--sun);font-weight:660}
  /* The popup IS the button now. Padding so the hint has room inside the card,
     and :active so a tap on a MapLibre popup feels like a tap on anything else
     in the app. */
  .popgo{cursor:pointer;-webkit-tap-highlight-color:transparent}
  .popgo:active{background:var(--tap)}
  .popgo .pophint{padding:0 11px 11px}
  .rtpop .popbody{padding-bottom:4px}
  .parkwall{display:grid;grid-template-columns:repeat(auto-fill,minmax(132px,1fr));gap:11px;margin-bottom:11px}
  .parkposter{margin:0;background:var(--card);border:1px solid var(--line);border-radius:12px;
    overflow:hidden;box-shadow:0 2px 8px rgba(80,60,30,.10)}
  .parkposter img{display:block;width:100%;aspect-ratio:600/797;object-fit:cover;background:var(--tap)}
  .parkposter.noart img{display:none}
  .parkposter figcaption{font-size:11.5px;line-height:1.3;padding:7px 9px 8px;color:var(--ink);font-weight:640}
  .parkposter figcaption span{opacity:.55;font-weight:400}
  .blingwrap{margin:0 0 12px}
  .blingtitle{font-family:'Bling',Georgia,serif;font-weight:400;margin:0;
    font-size:clamp(27px,8.4vw,36px);line-height:1.1;letter-spacing:.2px;
    background:linear-gradient(96deg,#e8952f 0%,#c8621f 42%,#b0431f 70%,#e8b04a 100%);
    -webkit-background-clip:text;background-clip:text;color:transparent;
    -webkit-text-fill-color:transparent;
    filter:drop-shadow(0 1px 0 rgba(255,255,255,.85)) drop-shadow(0 2px 3px rgba(80,40,10,.22))}
  /* Every other control has an :active state; ghostbtn was missed, and
     -webkit-tap-highlight-color:transparent removed the system flash — so
     "Try again", "Save entry", "Award it", "Booking page" and the map controls
     all looked dead until the network came back. */
  .ghostbtn:active{background:var(--tap)}
  .navbar button:active{background:var(--tap)}
  .back:active{opacity:.55}
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
  /* --paper-soft is computed in JS, because color-mix() needs Safari 16.2 and
     an unsupported value invalidates the WHOLE declaration — leaving the nav
     with no background at all, so the page scrolled visibly through it. That
     is the "nav floats with the scroll" report. Height no longer includes the
     safe-area inset either: Safari reports that inset as 0 with the toolbar
     open and ~34px once it collapses on scroll, so the bar was resizing
     mid-gesture. Only the padding varies now; the button row never moves. */
  .navbar{position:fixed;left:0;right:0;bottom:0;height:var(--nav-h);box-sizing:content-box;
    background:var(--paper-soft,var(--paper));
    -webkit-backdrop-filter:blur(12px);backdrop-filter:blur(12px);border-top:1px solid var(--line);
    display:flex;z-index:45;padding-bottom:var(--safe-bot);max-width:640px;margin:0 auto}
  .navbar button{flex:1;min-width:0;overflow:hidden;border:0;background:none;font:inherit;font-size:10.5px;
    letter-spacing:-.1px;color:var(--ink-3);display:flex;flex-direction:column;align-items:center;
    justify-content:center;gap:4px;cursor:pointer;padding:8px 2px;border-radius:11px;margin:6px 2px;
    /* Wraps rather than clips. overflow:hidden stopped a long label painting
       outside its box, but then cut "Photos · Journal" to "Photos · Journa".
       That label became "Memories" on 2026-08-06 and every label is now one
       short word, so nothing wraps — this stays as the guard for the next
       long one rather than as a live fix. */
    white-space:normal;text-align:center;line-height:1.15}
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
  <section class="screen" id="s-day"></section>
  <section class="screen" id="s-place"></section>
  <section class="screen" id="s-res"></section>
  <section class="screen" id="s-stop"></section>
  <section class="screen" id="s-staying"></section>
  <section class="screen" id="s-memories"></section>
  <section class="screen" id="s-badges"></section>
  <section class="screen" id="s-badge"></section>

  <div class="queued" id="queued"></div>
  <div class="denytoast" id="denytoast"></div>

  <nav class="navbar">
    <button class="on" data-tab="today"><span class="ic">&#128205;</span>Today</button>
    <button data-tab="trip"><span class="ic">&#128197;</span>Trip</button>
    <button data-tab="map"><span class="ic">&#128506;</span>Map</button>
    <button data-tab="memories"><span class="ic">&#128247;&#9997;</span>Memories</button>
    <button data-tab="badges"><span class="ic">&#127941;</span>Badges</button>
  </nav>

<script>
var ME = null, POS = null;

/* The apostrophe is escaped too: esc() output is interpolated into
   single-quoted JS string literals inside double-quoted HTML attributes in
   about fifteen places, and this file already carries a note about a prior
   stored-XSS hole from an id reaching an attribute unescaped. */
/* esc() is for TEXT and for ordinary attribute VALUES. It is NOT what makes an
   inline handler safe, and the shape of the code implies otherwise, which is
   the dangerous part.

   onclick="loadPlace('X')" is a double-quoted HTML attribute containing
   single-quoted JavaScript, and the HTML parser decodes entities BEFORE the JS
   parser ever sees the string. So esc() turning ' into &#39; buys nothing
   there: the entity decodes back to a quote and closes the JS string exactly
   as the raw character would have. Half the handler sites in this file called
   esc() and half did not, and the difference between them was never security —
   it was whoever wrote them last.

   jsId() is the rule made structural instead of remembered. It keeps only
   characters that cannot close the JS string or the HTML attribute — letters,
   digits, space, and _ . : / - — and drops the quote, the backslash, the
   ampersand and the angle brackets, which are the entire escape surface here.

   The first draft of this said "ids only, never names" and reduced to the id
   charset, and a render diff across every screen caught it doing damage:
   openPhoto carries an R2 PATH with slashes in it, and openBadge carries a
   state's display NAME with a space in it. Neither is an id and both are
   legitimate, so the guard is a character filter rather than a naming
   convention — the honest rule is what a value may CONTAIN, not what it is
   called. On every value the app produces today jsId is the identity
   function, which is the point: it costs nothing now and it holds when
   somebody later interpolates something that did not come from safeId(). */
function esc(s){ return String(s==null?"":s).replace(/[&<>"']/g, function(c){
  return {"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]; }); }
function jsId(s){ return String(s==null?"":s).replace(/[^A-Za-z0-9 _.:\/-]/g, ""); }
/* Notes are full of links they found. Split the RAW text on URLs and escape
   each piece separately — never regex over already-escaped text, which is how
   the earlier stored-XSS hole opened (an id flowed into an attribute unescaped).
   Only https?:// can match, so no javascript: URL can survive this. */
function linkify(s){
  var out = "", rest = String(s==null?"":s), re = /https?:\/\/[^\s<>"')\]]+/, m;
  while ((m = re.exec(rest))) {
    var u = m[0].replace(/[.,;:]+$/, "");
    out += esc(rest.slice(0, m.index)) +
      '<a href="'+esc(u)+'" target="_blank" rel="noopener noreferrer">'+esc(u)+'</a>';
    rest = rest.slice(m.index + u.length);
  }
  return out + esc(rest);
}
function el(id){ return document.getElementById(id); }
function get(u){
  // no-store: iOS was serving /api/version from its heuristic cache, which is
  // how a phone could stop noticing new deploys entirely.
  return fetch(u,{credentials:"same-origin",cache:"no-store"})
    // A JSON error body is TRUTHY, so it slipped past every if(!d) guard and
    // then threw on d.days / d.stops / d.places inside the .then — a blank
    // screen with a nav bar, which is the failure boot was hardened against.
    // An expired 120-day cookie on a page left open would do exactly this.
    .then(function(r){ return r.ok ? r.json() : null; })
    .catch(function(){ return null; });
}
/* Renders a recoverable message into a screen whose data never arrived,
   instead of leaving it blank. */
function offlineInto(id, retry){
  var e = el(id); if (!e) return;
  e.innerHTML = '<h1>No connection</h1><p class="sub">Can\'t load this right now.</p>' +
    '<button class="ghostbtn" onclick="' + retry + '">Try again</button>';
}
/* Same contract as get(): the caller gets a parsed body or it gets null, and
   it never gets a rejection. Seven call sites had no rejection handler, so a
   dropped connection — the ordinary state of a phone in a canyon — threw into
   nothing and the screen just sat there, which is the failure that reads as
   "the app is broken" rather than "try again". Every one of those sites
   already tests !r || !r.ok, or ignores the body entirely, so null lands on a
   path that was written before this change.

   NOT get()'s literal shape (r.ok ? r.json() : null): flush() retires a
   permanently-unacceptable stop from the offline queue by reading
   error === "bad kind" off a 400, and discarding non-ok bodies would turn
   that into null and wedge the queue on that item forever. The error BODY
   survives. Only a response carrying no JSON at all — a proxy's HTML 502 —
   degrades to null, which is the case that used to throw. */
function send(u,m,b){ return fetch(u,{method:m,credentials:"same-origin",
  headers:{"content-type":"application/json"},body:JSON.stringify(b)})
  .then(function(r){ return r.json().catch(function(){ return r.ok ? { ok:true } : null; }); })
  .catch(function(){ return null; }); }

/* --- Handing off to a real map -------------------------------------------
   The basemap in this app is a 30km-wide corridor at z0-14. That is a deliberate
   trade — no third-party key anywhere in the map path — but it means no z15+
   detail, no search, no satellite, and no directions, ever. The moment somebody
   needs "how do I actually get in there" or "what IS that place", this app
   cannot answer and should hand over rather than pretend.

   Andy asked for it after being caught by exactly that gap: the app said "near
   Forsyth, MT" while Google, on the same coordinates, said "Rosebud East
   Campground" — a near-anagram of the East Rosebud Campground on Lily's list,
   160 miles away. One tap to a real map is how he settled it, and it should not
   have required leaving the app.

   Labelled by intent rather than by button count: somewhere still ahead of them
   wants DIRECTIONS (two teenagers arriving after dark), somewhere already
   behind wants a LOOK (three parents at home wondering where their kids
   actually were). Apple first because all six are on iPhones and
   maps.apple.com opens the app natively; Google alongside because navigation
   preference is personal and is not the app's business. */
/* The phone's own date. Only used to ask "is this booking still ahead of us",
   where being an hour off at midnight changes nothing. */
function todayISO(){
  var d = new Date();
  return d.getFullYear() + "-" + String(d.getMonth()+1).padStart(2,"0") +
    "-" + String(d.getDate()).padStart(2,"0");
}
/* Two clocks for the Today heading: where the car is, and Ohio. Everybody
   sees the same line — "their time and our time" means one thing at dinner
   in Forsyth and one thing at a kitchen table in Ohio, and now both are on
   it. The car's zone comes off its own breadcrumbs (tz_offset in the Today
   payload); Ohio is Ohio, DST and all, via the browser's own zone tables. */
function fmtClock(dt){
  var h = dt.getUTCHours(), m = dt.getUTCMinutes();
  var ap = h < 12 ? "a" : "p"; h = h % 12 || 12;
  return h + ":" + (m < 10 ? "0" : "") + m + ap;
}
function clocksLine(off){
  var m = /^([+-])(\d{2}):?(\d{2})$/.exec(off || "-0500");
  var mins = m ? (m[1] === "-" ? -1 : 1) * (Number(m[2]) * 60 + Number(m[3])) : -300;
  var car = fmtClock(new Date(Date.now() + mins * 60000));
  var oh;
  try {
    oh = new Date().toLocaleTimeString("en-US",
      { timeZone: "America/New_York", hour: "numeric", minute: "2-digit" })
      .replace(" AM", "a").replace(" PM", "p");
  } catch (e) { oh = fmtClock(new Date(Date.now() - 240 * 60000)); }
  return car + " &middot; " + oh + " Ohio";
}
var TODAY_TZ = "-0500";
function mapsLinks(lat, lon, name, drive){
  if (lat == null || lon == null) return "";
  var ll = Number(lat).toFixed(5) + "," + Number(lon).toFixed(5);
  var q = encodeURIComponent(name || "");
  var apple = drive
    ? "https://maps.apple.com/?daddr=" + ll + "&dirflg=d"
    : "https://maps.apple.com/?ll=" + ll + "&q=" + (q || ll);
  var google = drive
    ? "https://www.google.com/maps/dir/?api=1&destination=" + ll
    : "https://www.google.com/maps/search/?api=1&query=" + ll;
  return '<div class="maplinks">' +
    '<a class="ghostbtn" href="'+apple+'" target="_blank" rel="noopener">' +
      (drive ? "Directions" : "Open in Maps") + '</a>' +
    '<a class="gmap" href="'+google+'" target="_blank" rel="noopener">Google</a></div>';
}

/* "8h", "8h 20m", "45 min". Nobody wants 485 minutes. */
function hoursish(mins){
  if (mins == null) return "";
  if (mins < 60) return mins + " min";
  var h = Math.floor(mins/60), m = mins % 60;
  return h + "h" + (m ? " " + m + "m" : "");
}
function fmtTime(iso){ if(!iso) return ""; var d=new Date(iso);
  return d.toLocaleTimeString([], {hour:"numeric", minute:"2-digit"}); }
/* "August 7th". toLocaleDateString has no ordinal, and Andy asked for one by
   writing the header out longhand. 11th/12th/13th are the exceptions every
   naive implementation gets wrong. */
function fmtLong(ds){
  if (!ds) return "";
  var d = new Date(ds+"T12:00:00"), n = d.getDate();
  var suf = (n % 100 >= 11 && n % 100 <= 13) ? "th"
    : ["th","st","nd","rd"][n % 10] || "th";
  return d.toLocaleDateString([], { month:"long" }) + " " + n + suf;
}
function fmtDay(ds){ if(!ds) return ""; var d=new Date(ds+"T12:00:00");
  return d.toLocaleDateString([], {weekday:"long", month:"long", day:"numeric"}); }
function fmtShort(ds){ if(!ds) return ""; var d=new Date(ds+"T12:00:00");
  return d.toLocaleDateString([], {month:"short", day:"numeric"}); }
/* Andy's words, lightly corrected. "Click" became "tap" — this app has only
   ever been opened on a phone. */
/* WMO weather codes. Open-Meteo returns a number; a person wants a picture and
   three words. Codes are sparse and grouped rather than continuous, so this is
   a lookup with a range fallback rather than arithmetic. Night swaps only the
   clear-sky glyph — a moon over a thunderstorm is a worse lie than a sun. */
var WMO = {
  0:["Clear","&#9728;&#65039;","&#127761;"], 1:["Mostly clear","&#127780;&#65039;","&#127761;"],
  2:["Partly cloudy","&#9925;","&#9925;"],   3:["Overcast","&#9729;&#65039;","&#9729;&#65039;"],
  45:["Fog","&#127787;&#65039;"], 48:["Freezing fog","&#127787;&#65039;"],
  51:["Light drizzle","&#127782;&#65039;"], 53:["Drizzle","&#127782;&#65039;"], 55:["Heavy drizzle","&#127782;&#65039;"],
  56:["Freezing drizzle","&#127784;&#65039;"], 57:["Freezing drizzle","&#127784;&#65039;"],
  61:["Light rain","&#127782;&#65039;"], 63:["Rain","&#127783;&#65039;"], 65:["Heavy rain","&#127783;&#65039;"],
  66:["Freezing rain","&#127784;&#65039;"], 67:["Freezing rain","&#127784;&#65039;"],
  71:["Light snow","&#127784;&#65039;"], 73:["Snow","&#127784;&#65039;"], 75:["Heavy snow","&#127784;&#65039;"],
  77:["Snow grains","&#127784;&#65039;"],
  80:["Showers","&#127782;&#65039;"], 81:["Showers","&#127783;&#65039;"], 82:["Downpour","&#127783;&#65039;"],
  85:["Snow showers","&#127784;&#65039;"], 86:["Snow showers","&#127784;&#65039;"],
  95:["Thunderstorm","&#9928;&#65039;"], 96:["Thunderstorm, hail","&#9928;&#65039;"], 99:["Thunderstorm, hail","&#9928;&#65039;"]
};
function wx(code, isDay){
  if (code == null) return null;
  var e = WMO[code];
  if (!e) {
    // Unknown code: keep the decade's meaning rather than printing a number.
    if (code >= 95) e = ["Thunderstorm","&#9928;&#65039;"];
    else if (code >= 71) e = ["Snow","&#127784;&#65039;"];
    else if (code >= 51) e = ["Rain","&#127782;&#65039;"];
    else e = ["Cloudy","&#9729;&#65039;"];
  }
  return { word: e[0], icon: (isDay === false && e[2]) ? e[2] : e[1] };
}
/* Temperatures render as whole degrees. Nobody on a road trip has ever wanted
   the tenth of a degree, and 90.4 next to 28.5 mpg reads as a second decimal
   quantity rather than as weather. */
function degF(t){ return t == null ? "" : Math.round(t) + "&deg;"; }

var PROMPT = {
  gas:      "Got gas? Tap me!",
  food:     "Eat something? Tell us about it!",
  campsite: "Where are you sleeping? Is it cool?",
  lodging:  "Couch surfing? Motel? Tell us!",
  event:    "Where&rsquo;d you go? Worth remembering?",
  journal:  "Write about it!"
};
var HERO = [], HERO_I = 0, DIAL_I = 0, DIAL_T = null;
var DIAL_KINDS = ["gas","food","campsite","lodging","event","journal"];

function paintHero(){
  var img = el("dialphoto"); if (!img || !HERO.length) return;
  var h = HERO[Math.abs(HERO_I) % HERO.length];
  if (h && img.getAttribute("data-k") !== h.thumb) {
    img.setAttribute("data-k", h.thumb);
    img.src = "/photo/" + h.thumb;
  }
  var cap = el("herocap");
  if (cap && h) {
    cap.innerHTML = (h.author ? esc(h.author) + ' &middot; ' : '') + fmtDay(h.date) +
      '<span style="opacity:.6"> &middot; tap for another</span>';
  }
}
/* Tapping the picture deals another one. It used to open the photo full size;
   Andy would rather it shuffle, and photos are still openable from the
   Memories tab. */
/* Tap to read the forecaster's instruction. Collapsed by default: the alert
   itself is the news, and three paragraphs of all-caps advisory prose above the
   trip title every time Today loads would train everyone to scroll past it. */
/* NWS timestamps carry their OWN offset ("...T21:00:00-06:00") and that is the
   right clock to read them on: the warning is about a place, and a Fire Weather
   Watch over Montana ends at nine in the evening in Montana no matter whose
   phone is looking. Rendering it through the device clock produced "until 3:00
   AM" for an alert ending Saturday evening — right instant, useless sentence.
   The weekday appears whenever the end is not today in that same local zone,
   because "until 9:00 PM" for something two days out is a small lie. */
function alertUntil(iso){
  if (!iso) return "";
  var m = /([+-])(\d{2}):?(\d{2})$/.exec(iso);
  var offMin = m ? (m[1] === "-" ? -1 : 1) * (parseInt(m[2],10)*60 + parseInt(m[3],10)) : 0;
  var end = new Date(new Date(iso).getTime() + offMin*60000);
  var now = new Date(Date.now() + offMin*60000);
  var h = end.getUTCHours(), mm = end.getUTCMinutes();
  var ampm = h >= 12 ? "PM" : "AM", h12 = h % 12 === 0 ? 12 : h % 12;
  var t = h12 + ":" + (mm < 10 ? "0" : "") + mm + " " + ampm;
  var DOW = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];
  var sameDay = end.getUTCFullYear() === now.getUTCFullYear() &&
                end.getUTCMonth() === now.getUTCMonth() &&
                end.getUTCDate() === now.getUTCDate();
  return sameDay ? t : DOW[end.getUTCDay()] + " " + t;
}
function toggleAlert(i){
  var b = el("wxb-"+i); if (!b) return;
  var card = b.parentNode;
  card.classList.toggle("open");
}
function openHero(){
  if (!HERO.length) { tab("memories"); return; }
  HERO_I++;
  paintHero();
}
function showPrompt(){
  var p = el("dialprompt"); if (!p) return;
  var i = Math.abs(DIAL_I) % DIAL_KINDS.length, k = DIAL_KINDS[i];
  p.innerHTML = PROMPT[k] || "";
  DIAL_KINDS.forEach(function(x){
    var b = el("dial-"+x); if (b) b.className = "dialbtn" + (x === k ? " lit" : "");
  });
  /* The arrow rides the same ring the buttons do, at a smaller radius, and
     rotates to point outward at the one being described. The glyph points east
     at 0deg, which is where the angle maths starts too, so the rotation is the
     angle itself with nothing to correct. */
  var arrow = el("dialarrow");
  if (arrow) {
    // 21%, not 27%: the buttons sit at 36% with a 9.5% radius, so their inner
    // edge is at 26.5% and an arrow at 27% is drawn UNDERNEATH the very button
    // it is pointing at. At 21% it sits in clear air between the words and the
    // button, and clears the text block at all six angles.
    var deg = -90 + i*60, a = deg * Math.PI/180, R = 21;
    arrow.style.left = (50 + R*Math.cos(a)).toFixed(2) + "%";
    arrow.style.top  = (50 + R*Math.sin(a)).toFixed(2) + "%";
    arrow.style.transform = "translate(-50%,-50%) rotate(" + deg + "deg)";
  }
}
function promptFor(k){
  var i = DIAL_KINDS.indexOf(k);
  if (i >= 0) { DIAL_I = i; showPrompt(); startDial(); }
}
/* Restarted rather than stacked: promptFor() fires on touch, and two timers
   would race each other for the highlight. */
function startDial(){
  if (DIAL_T) clearInterval(DIAL_T);
  DIAL_T = setInterval(function(){
    if (document.hidden || !el("dialprompt")) return;
    DIAL_I++; showPrompt();
  }, 4200);
}

/* The app changes its look on every vehicle stop. Andy's reasoning: they should
   notice something is different at the moment they get out of the car, because
   that is when there is something worth recording. Pinks, reds and purples per
   his ask; no greens, because the route line is green and the map needs to keep
   winning. Every one of these was checked against the ink and control colours —
   the worst case sits within 7% of the old warm white. */
var PALETTE = ["#ffdce8","#ffd9d9","#ffe2cd","#ffe9c9","#fbd9f0","#eddcfb","#dfe2fc","#d3e9fb"];
var CYCLE = 0;
function applyCycle(n){
  CYCLE = n || 0;
  var c = PALETTE[Math.abs(CYCLE) % PALETTE.length];
  document.documentElement.style.setProperty("--paper", c);
  // Same colour at 96%, built here so the nav never depends on color-mix().
  var r = parseInt(c.slice(1,3),16), g = parseInt(c.slice(3,5),16), b = parseInt(c.slice(5,7),16);
  document.documentElement.style.setProperty("--paper-soft",
    "rgba(" + r + "," + g + "," + b + ",.96)");
  /* The dial buttons take a palette colour too, offset by three so it is
     always clearly a DIFFERENT colour from today's background rather than the
     neighbouring shade — and never the background itself, which would make the
     buttons disappear into it. */
  document.documentElement.style.setProperty("--btn",
    PALETTE[(Math.abs(CYCLE) + 3) % PALETTE.length]);
  var m = document.querySelector('meta[name="theme-color"]');
  if (m) m.setAttribute("content", c);
}
/* Whose name comes first also alternates — deterministically, from the same
   counter. Random per render would flip the title mid-glance, because Today
   re-pulls itself every 90 seconds. */
function tripTitle(){
  return (Math.abs(CYCLE) % 2 === 0)
    ? "Lily &amp; Ada&rsquo;s<br>Roadtrip Adventure"
    : "Ada &amp; Lily&rsquo;s<br>Roadtrip Adventure";
}

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

/* Fixed actionbars float over the content; the gas-stop form's last fields
   were hiding under Done/Discard. Instead of hand-tuning padding per screen
   (and forgetting on the next one), watch the DOM: whenever the active
   screen contains an .actionbar, pad the screen by the bar's real height so
   everything scrolls clear. New screens inherit the fix by existing. */
function padForActionbar(){
  var sc = document.querySelector(".screen.on"); if (!sc) return;
  var bar = sc.querySelector(".actionbar");
  var nav = document.querySelector(".navbar");
  var want = bar ? (bar.offsetHeight + (nav ? nav.offsetHeight : 64) + 18) + "px" : "";
  if (sc.style.paddingBottom !== want) sc.style.paddingBottom = want;
}
new MutationObserver(padForActionbar).observe(document.body, { childList: true, subtree: true });
window.addEventListener("resize", padForActionbar);

/* The app updates many times a day right now, and open phones kept serving
   the old shell until somebody texted "close it and reopen." The served
   shell hashes itself; when the hash moves, a bar offers one-tap refresh.
   Never auto-reloads — half-typed journal entries outrank freshness. */
/* Substituted at serve time with the hash of this very shell. Inferring it
   from the first poll meant a phone that opened with no signal adopted the
   NEXT deploy's hash as its own and never offered a refresh again. */
var APP_V = "__APPV__";
function checkVersion(){
  get("/api/version").then(function(v){
    if (!v || !v.v) return;
    // Only seed if the placeholder somehow survived substitution.
    if (APP_V === "__APP" + "V__") { APP_V = v.v; return; }
    if (v.v !== APP_V) {
      var q = el("updatebar");
      if (!q) {
        q = document.createElement("div");
        q.id = "updatebar"; q.className = "queued on";
        // Sits ABOVE the offline-queue pill, which shares this class and this
        // box. Stale code and unsent stops both follow a dead zone, so the two
        // bars turn up together and the later one was burying the other.
        q.style.bottom = "calc(var(--nav-h) + var(--safe-bot) + 132px)";
        q.style.cursor = "pointer";
        q.innerHTML = "The app has been updated &mdash; tap to refresh";
        q.onclick = function(){ location.reload(); };
        document.body.appendChild(q);
      }
    }
  });
}
document.addEventListener("visibilitychange", function(){ if (!document.hidden) checkVersion(); });
/* iOS restores from the back-forward cache without re-running anything — after
   the reservation's "Booking page" link, or a standalone resume. visibilitychange
   does not always fire on that path. */
window.addEventListener("pageshow", function(e){ if (e.persisted) checkVersion(); });

/* Today keeps itself current: while it is the visible screen, re-pull every
   90 seconds so the live miles tick along without anyone tab-hopping. The
   screen has no text inputs, so a re-render never eats a keystroke. */
setInterval(function(){
  if (document.hidden) return;
  var sc = document.querySelector(".screen.on");
  if (sc && sc.id === "s-today") loadToday();
}, 90000);
setInterval(checkVersion, 8 * 60 * 1000);
checkVersion();

/* The two clocks tick between Today polls; a heading that says 3:07 at 3:19
   reads as broken. Cheap: one span, thirty seconds, no re-render. */
setInterval(function(){
  var s = el("t-clocks");
  if (s) s.innerHTML = clocksLine(TODAY_TZ);
}, 30000);

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
    else if (kind === "journal" || kind === "observation" || kind === "photo") tab("memories");
    else tab("today");
  });
}
/* --- Role as presentation, not as a gate --------------------------------
   Until 2026-08-06 role was a gate: eleven places in this file rendered a
   control for the two authors and an empty string for the four viewers, so
   the parents were running a visibly thinner app than the girls. It was never
   a security mechanism — all ten write endpoints answer a viewer with
   403 "authors only" and the two badge routes mirror the owner-or-author rule
   exactly, so nothing here is load-bearing for safety.

   Now the same markup renders for everyone and role decides only how it LOOKS
   and what a touch DOES. One rule governs which controls appear:

     capture and edit affordances render for all six; DESTRUCTIVE ones render
     only for the people who can actually use them.

   You show someone the instrument. You do not hand them the shredder — and
   Delete is two taps, so a viewer would arm it, commit it, and only then be
   told no, which reads as "I broke something". delBtn and the lightbox's
   Delete stay gated for that reason and no other. */
function canWrite(){ return !!(ME && ME.role === "author"); }

/* Named people, not roles. "Insufficient permissions" is what software says;
   these three already know exactly who is driving. */
var DENY = {
  gas:      "This is the button Lily and Ada tap at the pump. Recording stops is theirs and Andy's — you get to watch it happen.",
  food:     "Lily and Ada tap this when they eat somewhere worth remembering.",
  campsite: "This is what Lily and Ada tap when they pull in somewhere for the night.",
  lodging:  "Lily and Ada tap this for a motel, or somebody's couch.",
  event:    "Lily and Ada tap this when they go somewhere worth remembering.",
  journal:  "Writing is Lily and Ada's. This is where an entry of theirs would go.",
  photo:    "Adding photographs here is Lily and Ada's. Yours arrive on their own, out of the message thread.",
  activity: "Ticking things off the list is Lily's to do.",
  staying:  "Lily and Ada say where they actually ended up. This is that button.",
  _:        "Only Lily, Ada, and Andy can change this — you get to watch it happen."
};
var DENY_T = null;
function deny(kind, ev){
  if (ev) ev.stopPropagation();
  var t = el("denytoast");
  if (t) { t.innerHTML = DENY[kind] || DENY._; t.classList.add("on"); }
  /* Waking the dial is the whole idea: for six seconds the parents are looking
     at exactly the girls' Today screen, prompt and all. */
  var d = el("dial");
  if (d) { d.classList.add("awake"); if (el("dialprompt")) promptFor(kind); }
  if (DENY_T) clearTimeout(DENY_T);
  DENY_T = setTimeout(function(){
    var tt = el("denytoast"); if (tt) tt.classList.remove("on");
    var dd = el("dial"); if (dd) dd.classList.remove("awake");
  }, 6000);
}

function delBtn(kind, id){
  if (!canWrite()) return "";
  return '<button id="del-' + jsId(id) + '" onclick="armDelete(\'' + jsId(kind) + '\',\'' + jsId(id) +
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
  if(name==="memories") loadMemories();
  if(name==="badges") loadBadges();
  /* "places" no longer has a tab — Plan merged into Trip 2026-08-06. Kept as a
     route so PLACE_FROM values stored by an older shell still land somewhere
     real instead of on a blank screen. */
  if(name==="places") loadTrip();
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
        (t.actual ? '' : ' onclick="loadRes(\'' + jsId(t.id) + '\')"') + '>' +
        '<div class="row"><b>' + esc(t.name) + '</b>' +
        (t.place_name ? '<span class="muted">' + esc(t.place_name) + '</span>' : '') + '</div>' +
        (line ? '<p class="muted" style="margin:7px 0 0">' + line + '</p>' : '') +
        '<p class="tiny" style="margin:5px 0 0">' +
          (t.confirmation ? 'Receipt <span class="conf">' + esc(t.confirmation) + '</span> &middot; ' : '') +
          (t.cost != null ? '$' + t.cost.toFixed(2) : '') + '</p></div>' +
        '<button class="ghostbtn" onclick="' +
          (canWrite() ? 'openStaying()' : 'deny(\'staying\',event)') + '">' +
          (t.actual ? "Change where we are staying" : "We are staying somewhere else") +
        '</button>';
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
    /* Live conditions ride on l1, which is the where-they-are-right-now line —
       day, town, miles today, moving or parked. The temperature belongs with
       those and not with the cumulative totals underneath. */
    var w = d.weather ? wx(d.weather.code, d.weather.is_day) : null;
    /* "Day 6, August 7th, Forsyth, MT" — Andy's wording. The heading answers
       WHEN and WHERE in one breath and the numbers move below it, which also
       stops the old single line from wrapping to two on every phone. */
    TODAY_TZ = d.tz_offset || TODAY_TZ;
    var l1 = 'Day '+d.day_number + ', ' + fmtLong(d.date) +
      (d.town ? ', '+esc(d.town) : '') +
      /* nowrap so a narrow phone breaks BEFORE the clocks, never inside them */
      ' <span id="t-clocks" style="white-space:nowrap">&middot; ' + clocksLine(TODAY_TZ) + '</span>';
    var l1b = (d.miles_today||0)+' mi today &middot; ' + state +
      (w ? ' &middot; '+w.icon+' '+degF(d.weather.temp_f) : '');
    /* Fuel goes right after mpg, per Andy. It used to be SUPPRESSED past six
       hours, on the theory that a stale percentage beside the word "Parked"
       reads as current. True, but the cure was worse: Bouncie only reports a
       level while the engine is running, so the gauge blanked itself every
       single night and was missing every morning — which is exactly when
       somebody opens the app. Four gaps over six hours in the first five days,
       the longest fourteen. Qualify it instead of hiding it: an overnight
       reading still tells you what is in the tank, and the timestamp makes it
       honest rather than absent. */
    var fuelBit = "";
    if (d.fuel && d.fuel.level != null) {
      var fuelAge = Date.now() - new Date(d.fuel.at).getTime();
      fuelBit = ' &middot; &#9981; '+Math.round(d.fuel.level)+'% fuel' +
        (fuelAge > 90*60000
          ? '<span style="opacity:.6"> at '+fmtTime(d.fuel.at)+'</span>' : '');
    }
    var l2 = (d.miles_total||0).toLocaleString()+' mi total &middot; ' +
      (d.mpg ? d.mpg.value+' mpg' : 'mpg after two fills') + fuelBit;
    var kinds = ["gas","food","campsite","lodging","event","journal"];
    var KLABEL = { gas:"Gas", food:"Food", campsite:"Campsite", lodging:"Lodging",
                   event:"Event", journal:"Journal" };
    // A fresh recording leaves a five-minute undo on Today — the back button
    // was the silent escape path that left Lily's test taps recorded.
    var undo = "";
    if (LAST_REC && Date.now() - new Date(LAST_REC.at).getTime() < 5*60000) {
      undo = '<div class="card" style="margin-top:10px"><div class="row">' +
        '<span class="tiny">'+(ICON[LAST_REC.kind]||"")+' '+
        LAST_REC.kind.charAt(0).toUpperCase()+LAST_REC.kind.slice(1)+
        ' recorded '+fmtTime(LAST_REC.at)+'</span>' +
        '<button class="ghostbtn" id="undo-stop" style="margin:0;padding:4px 14px" ' +
          'onclick="armUndoStop()">Undo</button></div></div>';
    } else if (LAST_REC) LAST_REC = null;

    /* The dial. The 2x3 grid was six identical slabs and in four days exactly
       one of them was ever pressed. Six buttons on a ring around a picture from
       the trip reads as something to play with rather than a form to fill in,
       and the centre carries the invitation: the prompts cycle through all six
       so every button explains itself without anyone tapping first, and the
       matching button lights up so the sentence and its target are visibly
       connected. Touching a button switches the centre to that button's line.
       The photo behind it changes hourly and again at every vehicle stop. */
    /* ONE dial for all six. It used to fork: the girls got the instrument, the
       parents got a bare photograph — which meant four of the six were running
       a visibly thinner app and none of them could see what the other two were
       looking at. Now the same markup renders for everyone; a viewer's copy
       carries .ghost, which recesses the buttons and hides the scrim so the
       photograph is a photograph, and a touch wakes it to the girls' version
       for six seconds while the toast names who the buttons belong to.

       The caption is no longer viewer-only either. It was the one place the
       asymmetry ran BACKWARDS — the parents were told who took the picture and
       when, and the girls were not. */
    var author = canWrite();
    var grid =
      '<div class="dial' + (author ? '' : ' ghost') + '" id="dial">' +
        '<div class="dialcentre" id="dialcentre" onclick="openHero()">' +
          '<img id="dialphoto" alt="">' +
          '<div class="dialscrim"></div>' +
        '</div>' +
        '<div class="dialprompt" id="dialprompt"></div>' +
        '<span class="dialarrow" id="dialarrow">&#10148;</span>' +
        kinds.map(function(k,i){
          var act = author ? (k === "journal" ? "openJot()" : "saveStop(\'"+k+"\')")
                           : "deny(\'"+k+"\',event)";
          var ic = k === "journal" ? "&#9997;" : ICON[k];
          var a = (-90 + i*60) * Math.PI/180, R = 36;
          var x = (50 + R*Math.cos(a)).toFixed(2), y = (50 + R*Math.sin(a)).toFixed(2);
          return '<button class="dialbtn" id="dial-'+k+'" style="left:'+x+'%;top:'+y+'%" ' +
            'onclick="'+act+'" ontouchstart="promptFor(\''+jsId(k)+'\')" ' +
            'onmouseenter="promptFor(\''+k+'\')">' +
            '<span class="ic">'+ic+'</span><span class="lb">'+KLABEL[k]+'</span></button>';
        }).join("") +
      '</div>' +
      '<p class="herocap" id="herocap"></p>';
    applyCycle(d.cycle);
    HERO = d.hero || [];
    // Hourly, and again at every stop — so the picture is different when they
    // get out of the car even if an hour has not passed.
    HERO_I = Math.floor(Date.now() / 3600000) + (d.cycle || 0);
    /* NWS alerts are the one part of this feature that is not decoration, so
       they go ABOVE the title rather than into a metric line. A Red Flag
       Warning is not a number about the trip; it is a thing two teenagers in a
       tent should know. Tap to read what the forecaster says to do. */
    var alerts = (d.alerts||[]).map(function(a,i){
      var sev = (a.severity === "Extreme" || a.severity === "Severe") ? "bad" : "warn";
      /* Collapsed is deliberately ONE line. The first build put areaDesc in the
         resting banner and NWS returns every county and ranger district in the
         zone — 176px of a 844px screen, pushing the trip title below the fold
         on a screen whose job is the trip. The county list is real information
         for deciding whether you are inside the warning, so it moves into the
         body where somebody who taps has asked for it. */
      return '<div class="wxalert '+sev+'" onclick="toggleAlert('+i+')">' +
        '<div class="row"><b>&#9888;&#65039; '+esc(a.event)+'</b>' +
        (a.ends ? '<span class="tiny">until '+alertUntil(a.ends)+'</span>' : '') + '</div>' +
        '<div class="wxbody" id="wxb-'+i+'">' +
          (a.headline ? '<p style="margin:7px 0 0;font-size:13px">'+esc(a.headline)+'</p>' : '') +
          (a.instruction ? '<p style="margin:7px 0 0;font-size:13px;line-height:1.45">'+esc(a.instruction)+'</p>' : '') +
          (a.area ? '<p class="tiny" style="margin:7px 0 0">'+esc(a.area)+'</p>' : '') +
          '<p class="tiny" style="margin:7px 0 0">National Weather Service</p>' +
        '</div>' +
        '<div class="tiny wxmore">Tap for what it says</div></div>';
    }).join("");

    /* Last night. Nobody taps a campsite button — five days and zero taps said
       so — but the car sat still for eight hours somewhere, and that is the
       record. Sits under the dial, before tonight's plan, so the screen reads
       in order: where they woke, where they are, where they are going. */
    var lastNight = "";
    if (d.last_night && d.last_night.place) {
      var ln = d.last_night;
      lastNight = '<div class="card" style="margin-top:10px"><div class="row">' +
        '<span><span style="opacity:.6">Last night &middot; </span><b>'+esc(ln.place)+'</b></span>' +
        (ln.mins ? '<span class="tiny">'+hoursish(ln.mins)+'</span>' : '') + '</div>' +
        mapsLinks(ln.lat, ln.lon, ln.place, false) + '</div>';
    }

    el("s-today").innerHTML = alerts +
      '<div class="blingwrap"><h1 class="blingtitle">'+tripTitle()+'</h1></div>' +
      '<h1 style="font-size:19px;line-height:1.35">'+l1+'</h1>' +
      '<p class="sub" style="margin-bottom:2px">'+l1b+'</p>' +
      '<p class="sub">'+l2+'</p>' +
      undo + grid + lastNight + tonight + last;
    if (el("dial")) {
      paintHero();
      /* Cycles for all six. On a viewer's dial the prompt and the lit ring are
         held at opacity 0 by CSS until a touch wakes it, so the cycle costs
         them nothing and is already in the right place when it does. */
      if (el("dialprompt")) { DIAL_I = 0; showPrompt(); startDial(); }
    }
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
      return '<div class="kind" onclick="saveStop(\''+jsId(k)+'\')"><span class="ic">'+ICON[k]+
             '</span><span class="lb">'+k.charAt(0).toUpperCase()+k.slice(1)+'</span></div>';
    }).join("") +
    '</div><p class="tiny" style="margin-top:16px">One tap is enough. Everything else is optional and can wait until tonight.</p>';
}

function saveStop(kind){
  // The Today grid calls this directly, and the saved screen was rendering
  // into a HIDDEN section — a tap that visibly did nothing. That silence is
  // what eleven of Lily's taps looked like. Switch screens IMMEDIATELY with
  // an interim state; the saved screen replaces it when the fix (or the 5s
  // latch) lands.
  show("stop");
  el("s-stop").innerHTML =
    '<div style="text-align:center;padding-top:120px"><div style="font-size:52px">'+(ICON[kind]||"")+'</div>' +
    '<h1 style="margin-top:14px">Recording&hellip;</h1>' +
    '<p class="sub">Getting a fix on where you are</p></div>';
  var id = (crypto.randomUUID ? crypto.randomUUID() : String(Date.now())+Math.random());
  var item = { client_id:id, kind:kind, occurred_at:new Date().toISOString(), tz_offset:tzOffset() };

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
      '<div class="actionbar"><button class="bigbtn" onclick="finishStop(\''+jsId(id)+'\')">Done</button>' +
      '<button class="ghostbtn" id="disc-btn" style="color:#a8332a;border-color:#e8cdc9" ' +
        'onclick="armDiscard(\''+jsId(id)+'\')">Discard this stop</button></div>';
    LAST_REC = { id: id, kind: kind, at: item.occurred_at };
  }

  // Latched: an unanswered permission prompt fires NEITHER callback, and a
  // stop must never hang on one — record after 5s regardless. The server
  // fills a missing position from the car's freshest breadcrumb anyway.
  var done = false;
  function finishOnce(){ if (!done){ done = true; finish(); } }
  if (navigator.geolocation) {
    navigator.geolocation.getCurrentPosition(function(p){
      item.lat = p.coords.latitude; item.lon = p.coords.longitude; finishOnce();
    }, finishOnce, { timeout: 4000, maximumAge: 60000 });
    setTimeout(finishOnce, 5000);
  } else finishOnce();
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
/* Undo-with-confirm, Andy's ask after Lily's eleven exploratory taps: every
   path away from a fresh recording gets a way back, and every way back asks
   once. Same arm-then-commit shape as delete — no browser confirm() ever. */
var LAST_REC = null, DISC_ARMED = null;

function armDiscard(id){
  var b = el("disc-btn");
  if (DISC_ARMED === id) { discardStop(id); return; }
  DISC_ARMED = id;
  if (b) { b.textContent = "Really discard?"; b.style.fontWeight = "700"; }
  setTimeout(function(){
    if (DISC_ARMED === id) {
      DISC_ARMED = null;
      var bb = el("disc-btn");
      if (bb) { bb.textContent = "Discard this stop"; bb.style.fontWeight = ""; }
    }
  }, 4000);
}

function discardStop(id){
  DISC_ARMED = null;
  if (LAST_REC && LAST_REC.id === id) LAST_REC = null;
  var q = queue().filter(function(x){ return x.client_id !== id; });
  setQueue(q);
  // 404 here just means the stop was still queued and never reached the
  // server — removing it from the queue was the whole deletion.
  send("/api/stop","DELETE",{ id:id }).then(function(){ tab("today"); }, function(){ tab("today"); });
}

var UNDO_ARMED = false;
function armUndoStop(){
  var b = el("undo-stop"); if (!b || !LAST_REC) return;
  if (UNDO_ARMED) {
    UNDO_ARMED = false;
    var id = LAST_REC.id; LAST_REC = null;
    var q = queue().filter(function(x){ return x.client_id !== id; });
    setQueue(q);
    send("/api/stop","DELETE",{ id:id }).then(function(){ loadToday(); }, function(){ loadToday(); });
    return;
  }
  UNDO_ARMED = true;
  b.textContent = "Undo?"; b.style.color = "#a8332a"; b.style.fontWeight = "700";
  setTimeout(function(){
    UNDO_ARMED = false;
    var bb = el("undo-stop");
    if (bb) { bb.textContent = "Undo"; bb.style.color = ""; bb.style.fontWeight = ""; }
  }, 4000);
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
  var item = { client_id:id, kind:kind, occurred_at:new Date().toISOString(), tz_offset:tzOffset(),
               place:(n && n.value.trim()) || null, note:(note && note.value.trim()) || null };
  function done(){ enqueue(item); tab("today"); }
  // Latched, exactly as saveStop is: an unanswered iOS permission prompt fires
  // NEITHER callback, and without this the stay was never enqueued and the tap
  // did nothing at all.
  var fired = false;
  function once(){ if (!fired) { fired = true; done(); } }
  setTimeout(once, 5000);
  if (navigator.geolocation) {
    navigator.geolocation.getCurrentPosition(function(p){
      item.lat = p.coords.latitude; item.lon = p.coords.longitude; once();
    }, once, { timeout: 4000, maximumAge: 60000 });
  } else once();
}

function loadTrip(){
  show("trip");
  get("/api/trip").then(function(d){
    if (!d) { offlineInto("s-trip", "loadTrip()"); return; }

    /* Trip and Plan were two tabs over ONE table. Plan listed every intention;
       Trip listed the next eight of those same rows under a different heading;
       both opened the same detail screen; and the tab said "Plan" while the
       heading said "Itinerary". The merge is one continuous timeline with NOW
       as the seam — behind above, ahead below — because that is what a road
       trip actually is, and because it puts the two things worth deciding
       between (what just happened, what is next) either side of where the
       screen opens.

       Days ascend rather than descend now. Reverse-chronological was right for
       a screen that only showed the past; on a timeline it would mean walking
       backwards into the future. */
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
      // The night that ENDED this day, on the day it began — so the row reads
      // "…and then they slept at Medora campground."
      if (x.slept && x.slept.place) bits.push("&#127957; " + esc(x.slept.place));
      return '<div class="day" onclick="loadDay(\'' + jsId(x.date) + '\',\'trip\')">' +
        '<div class="daynum"><b>'+x.day_number+'</b><small>'+fmtShort(x.date)+'</small></div>' +
        '<div style="flex:1"><div class="row"><b>'+esc(x.title||(x.places?x.places:"On the road"))+
        '</b><span class="tiny">'+(x.miles!=null?x.miles+" mi":"")+'</span></div>' +
        (bits.length?'<p class="tiny" style="margin:3px 0 0">'+bits.join(" &middot; ")+'</p>':'') +
        '</div></div>';
    }).join("") || '<p class="empty">No days yet.</p>';

    var all = d.places || [];
    /* Three bands, one rule each. Dated-and-unreached is the road ahead;
       undated-and-unreached is Someday, which is honest about an itinerary the
       README calls aspirational rather than pretending every hope has a date;
       dropped is Skipped, kept rather than deleted because Andy would rather
       see the whole thread than a tidy one. Already-reached places are not a
       band at all — they are in the day rows above, which is where they
       actually happened. */
    var ahead   = all.filter(function(p){ return !p.visited && !p.dropped && p.planned_arrival; });
    var someday = all.filter(function(p){ return !p.visited && !p.dropped && !p.planned_arrival; });
    var skipped = all.filter(function(p){ return p.dropped; });

    function placeRow(p, faded){
      return '<div class="day"' + (faded ? ' style="opacity:.55"' : '') +
        ' onclick="loadPlace(\'' + jsId(p.id) + '\',\'trip\')">' +
        '<div class="daynum"><b>&middot;</b><small>' +
          (p.planned_arrival ? fmtShort(p.planned_arrival) : '&mdash;') + '</small></div>' +
        '<div style="flex:1"><div class="row"><b>'+esc(p.name)+'</b>' +
          '<span class="tiny">'+esc(p.drive_time_from_prev||"")+'</span></div>' +
        '<p class="tiny" style="margin:3px 0 0">'+esc(p.kind||"") +
          (p.activities ? ' &middot; '+p.did+'/'+p.activities+' to see' : '') +
          (p.planned_nights ? ' &middot; '+p.planned_nights+' night'+(p.planned_nights===1?'':'s') : '') +
          (p.booked ? ' &middot; booked' : '') + '</p></div></div>';
    }

    var reached = all.filter(function(p){ return p.visited; }).length;
    el("s-trip").innerHTML =
      '<h1>The Trip</h1><p class="sub">'+d.days.length+' day'+(d.days.length===1?"":"s")+
        ' &middot; '+reached+' of '+all.filter(function(p){ return !p.dropped; }).length+
        ' places reached</p>' +
      '<div class="maparea" id="trip-map" style="height:210px;margin-bottom:6px"></div>' +
      '<p class="tiny" style="margin:0 0 4px">Tap the map to open it full size.</p>' +
      past +
      '<div class="seam" id="now"><span>' + fmtDay(d.today) + '</span></div>' +
      (ahead.length ? ahead.map(function(p){ return placeRow(p, true); }).join("")
        : '<p class="empty">Nothing dated ahead.</p>') +
      (someday.length ? '<h2>Someday</h2>' +
        '<p class="tiny" style="margin:-6px 0 8px">No date on these &mdash; they happen if they happen.</p>' +
        someday.map(function(p){ return placeRow(p, true); }).join("") : '') +
      (skipped.length ? '<h2>Skipped</h2>' +
        skipped.map(function(p){ return placeRow(p, true); }).join("") : '');

    // tab(), not show(): show() swaps screens without moving the nav highlight,
    // the same stale-highlight defect QA already found on deletes.
    drawMap("trip-map", 210, function(){ tab("map"); });

    /* Open at the seam. By week five there are thirty-odd day rows above it and
       landing on day one would mean scrolling past the whole trip to find out
       what is next. Guarded because the seam is near the top for the first few
       days, where scrolling would just be a jolt. */
    var seam = el("now");
    if (seam && seam.getBoundingClientRect().top > window.innerHeight * 0.75) {
      seam.scrollIntoView({ block: "center" });
    }
  });
}

/* Where the Day screen's back button goes. It was hardcoded to Trip, which was
   right while Trip was the only way in. Map popups now open a day on ONE tap
   instead of two, so arriving from the map is about to become common — and
   backing out of it landed you on Trip with the nav still lit on Map. Same
   origin-aware-back family QA closed for Place and Reservation; Day was the one
   left, because until tonight it was hard to reach from anywhere else. */
var DAY_FROM = "trip";
function loadDay(date, from){
  if (from) DAY_FROM = from;
  show("day");
  LAST_DAY = date;
  get("/api/day?date="+encodeURIComponent(date)).then(function(d){
    if (!d) { offlineInto("s-day", "loadDay('"+date+"')"); return; }
    var s = d.summary || {};
    var stops = d.stops.map(function(x){
      /* The weather this stop happened in, frozen at the moment of the tap.
         This is the reading that survives to the viewbook — "gas in Miles
         City, 4:12pm, 101 degrees" is the sentence worth keeping. */
      var sw = wx(x.weather_code);
      var wline = sw ? '<p class="tiny" style="margin:6px 0 0">'+sw.icon+' '+esc(sw.word)+
          (x.temp_f != null ? ' &middot; '+degF(x.temp_f) : '') +
          (x.feels_f != null && Math.abs(x.feels_f - x.temp_f) >= 4 ? ' (felt '+degF(x.feels_f)+')' : '') +
          (x.wind_mph != null ? ' &middot; '+Math.round(x.wind_mph)+' mph wind' : '') +
          /* Says out loud that this is a snapshot. Today's temperature is live
             and sits among other live things, so it reads as now; this one sits
             under a stop from three days ago with nothing to mark it as
             historical, and Andy did not want a parent taking yesterday's 64
             degrees for this afternoon's. */
          '<span style="opacity:.6"> when they stopped</span>' +
        '</p>' : '';
      return '<div class="card"><div class="row"><span>'+(ICON[x.kind]||"")+' '+esc(x.kind)+
        (x.place?' &middot; '+esc(x.place):'')+'</span><span class="tiny">'+fmtTime(x.occurred_at)+
        '</span></div>'+(x.note?'<p class="tiny" style="margin:6px 0 0">'+esc(x.note)+'</p>':'')+
        wline+'</div>';
    }).join("") || '<p class="empty">No stops recorded.</p>';
    var journal = d.journal.map(function(j){
      return '<div class="card"><p style="margin:0;font-size:15px;line-height:1.5">'+esc(j.body)+
        '</p><div class="row" style="margin-top:9px"><span class="tiny">'+esc(j.author||"")+
        ' &middot; '+fmtTime(j.written_at)+'</span>'+delBtn("journal", j.id)+'</div></div>';
    }).join("");
    // Derived from where the car stopped — nothing to add or remove by hand.
    var placeRows = (d.places||[]).map(function(p){
      return '<div class="card tapme" onclick="loadPlace(\''+jsId(p.id)+'\',\'trip\')">' +
        '<div class="row"><span>&#128205; '+esc(p.name)+'</span><span></span></div></div>';
    }).join("");
    el("s-day").innerHTML =
      '<button class="back" onclick="tab(\''+DAY_FROM+'\')">&larr;</button>' +
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
      '<div class="card" style="margin-top:9px"><textarea id="j-body" placeholder="What happened today?"' +
        (canWrite() ? '' : ' readonly') + '></textarea>' +
        '<button class="ghostbtn" onclick="' +
        (canWrite() ? 'saveJournal(\''+date+'\')' : 'deny(\'journal\',event)') +
        '">Save entry</button></div>' +
      (d.slept && d.slept.place
        ? '<h2>The night</h2><div class="card"><div class="row">' +
          '<span>&#127957; <b>'+esc(d.slept.place)+'</b></span>' +
          '<span class="tiny">'+(d.slept.ongoing ? 'still there'
            : (d.slept.mins ? hoursish(d.slept.mins) : ''))+'</span></div>' +
          (d.slept.source === "town"
            ? '<p class="tiny" style="margin:6px 0 0">Where the car spent the night &mdash; ' +
              'nothing booked here.</p>' : '') +
          mapsLinks(d.slept.lat, d.slept.lon, d.slept.place, false) + '</div>'
        : '') +
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
  /* todayISO(), not toISOString(): UTC rolls over at 6pm Mountain, and the
     wrong answer here silently skips the location grab — evening entries
     were saving without their map pin. */
  var today = todayISO();
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
      loadMemories();
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
    BADGEDATA = d;
    BADGES = {};
    (d.bespoke||[]).forEach(function(b){ BADGES[b.id] = b; });

    var wall = function(items){ return '<div class="bwall">'+items.join("")+'</div>'; };

    /* Every category collapses to the same call. Before this the screen had
       five bespoke renderers — full cards for the family ones, a poster wall
       for parks, inline SVG tiles for states, shields for miles, text pills
       for tanks — which is why it ran to several screens and why thirteen park
       posters would have made it unreadable. One tile, five feeders. */
    function tile(kind, key, art, name, sub, locked){
      return '<div class="btile'+(locked?' locked':'')+'" ' +
        'onclick="openBadge(\'' + jsId(kind) + '\',\'' + jsId(key) + '\')">' +
        '<div class="art">'+art+'</div>' +
        '<div class="bname">'+esc(name)+'</div>' +
        (sub ? '<div class="bsub">'+sub+'</div>' : '') + '</div>';
    }

    var states = (d.states||[]).map(function(st){
      return tile("state", st.state, stateSvg(st.shape, 70), st.state, fmtShort(st.first_date));
    });

    /* Every park in Lily's list appears, earned or not. A greyed poster for a
       park they have not reached yet is the whole point of a badge wall — you
       can see what is still out there. */
    var parks = (d.parks||[]).map(function(p){
      return tile("park", p.id,
        p.image_key
          ? '<img src="/photo/'+esc(p.image_key)+'" alt="" loading="lazy">'
          : '<span class="glyph">&#127966;</span>',
        p.name, fmtShort(p.first_date), !p.first_date);
    });

    var miles = [];
    for (var i = 1; i <= d.miles.earned; i++)
      miles.push(tile("miles", i, mileShield(i*1000), (i*1000).toLocaleString()+" miles", ""));
    miles.push(tile("miles", d.miles.earned+1, mileShield((d.miles.earned+1)*1000),
      ((d.miles.earned+1)*1000).toLocaleString()+" miles",
      d.miles.to_next.toLocaleString()+" to go", true));

    var tanks = [];
    for (var j = 1; j <= d.tanks.earned; j++)
      tanks.push(tile("tank", j, '<span class="glyph">&#9981;</span>', (j*10)+" tanks", ""));
    tanks.push(tile("tank", d.tanks.earned+1, '<span class="glyph">&#9981;</span>',
      ((d.tanks.earned+1)*10)+" tanks", d.tanks.fills+" filled", true));

    var bespoke = (d.bespoke||[]).map(function(b){
      return tile("bespoke", b.id,
        b.image_key
          ? '<img src="/photo/'+esc(b.image_key)+'" alt="" loading="lazy">'
          : '<span class="glyph">'+(b.emoji?esc(b.emoji):'&#127941;')+'</span>',
        b.title, esc(b.awarded_by_name||""));
    });

    el("s-badges").innerHTML =
      '<h1>Badges</h1><p class="sub">'+(d.states||[]).length+' state'+
      ((d.states||[]).length===1?"":"s")+' &middot; '+
      (d.parks||[]).filter(function(p){ return p.first_date; }).length+' of '+
      (d.parks||[]).length+' parks &middot; '+d.miles.total.toLocaleString()+' miles</p>' +
      '<h2>From the family</h2>' +
      (bespoke.length ? wall(bespoke)
        : '<p class="empty">None yet. Anyone can award one &mdash; make one up.</p>') +
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
      '<h2>National parks</h2>' + wall(parks) +
      '<h2>States</h2>' +
      (states.length ? wall(states) : '<p class="empty">No states yet &mdash; that changes fast.</p>') +
      '<h2>The odometer</h2>' + wall(miles) +
      '<h2>The pump</h2>' + wall(tanks);
  });
}

/* The state outline, filled route-green. Pulled out of loadBadges so the wall
   tile and the detail screen draw the same shape at different sizes. */
function stateSvg(shape, px){
  if (!shape || !shape.rings) return '<span class="glyph">&#128506;</span>';
  var polys = shape.rings.map(function(r){
    return '<polygon points="'+r.map(function(pt){ return pt[0]+','+pt[1]; }).join(' ')+
      '" fill="#1f6f5c22" stroke="#1f6f5c" stroke-width="2.5" stroke-linejoin="round"/>';
  }).join('');
  return '<svg viewBox="-4 -4 '+(shape.w+8)+' '+(shape.h+8)+'" ' +
    'style="width:'+px+'px;height:auto">'+polys+'</svg>';
}

/* Mile markers as interstate-style shields — red crest, blue field, white
   number. A road trip's odometer deserves highway iconography. */
function mileShield(n, px){
  px = px || 70;
  return '<svg viewBox="0 0 100 100" style="width:'+px+'px;height:'+px+'px">' +
    '<path d="M50 4 C62 12 80 14 96 12 C99 44 92 76 50 97 C8 76 1 44 4 12 C20 14 38 12 50 4 Z" ' +
      'fill="#124a8f" stroke="#ffffff" stroke-width="3.5"/>' +
    '<path d="M50 4 C62 12 80 14 96 12 C96.5 17 96.6 21 96.4 26 L3.6 26 C3.4 21 3.5 17 4 12 C20 14 38 12 50 4 Z" ' +
      'fill="#b3282d"/>' +
    '<text x="50" y="21" text-anchor="middle" fill="#fff" font-size="11.5" font-weight="700" ' +
      'font-family="system-ui,sans-serif" letter-spacing="1">MILES</text>' +
    '<text x="50" y="65" text-anchor="middle" fill="#fff" font-size="25" font-weight="800" ' +
      'font-family="system-ui,sans-serif">'+n.toLocaleString()+'</text></svg>';
}
var BADGES = {}, BADGEDATA = null;

/* ---- the badge detail screen ------------------------------------------
   A full screen with a back pill, not a modal: this codebase has twice written
   down that it does not want modals, the app already swaps screens this way for
   Place and Reservation, and a badge has real content — a poster, a photograph,
   a paragraph somebody wrote about their sister. It does not fit in a grid tile
   and it should not have to.

   The derived four (state, park, miles, tank) fetch their numbers on tap rather
   than shipping them in /api/badges, which keeps the wall to one light request
   even as the badge count grows. The family ones need no fetch at all — they
   arrived whole with the wall. */
function badgeFacts(rows){
  return rows.filter(function(r){ return r[1] !== null && r[1] !== undefined && r[1] !== ""; })
    .map(function(r){ return '<div class="bfact"><span>'+r[0]+'</span><b>'+r[1]+'</b></div>'; })
    .join("");
}
function openBadge(kind, key){
  show("badge");
  var back = '<button class="back" onclick="tab(\'badges\')">&larr;</button>';

  if (kind === "bespoke") {
    var b = BADGES[key];
    if (!b) { el("s-badge").innerHTML = back + '<h1>Not found</h1>'; return; }
    var mine = ME && (ME.id === b.awarded_by || canWrite());
    el("s-badge").innerHTML = back +
      '<div class="bdart">' + (b.image_key
        ? '<img src="/photo/'+esc(b.image_key)+'" alt="">'
        : '<span class="glyph">'+(b.emoji?esc(b.emoji):'&#127941;')+'</span>') + '</div>' +
      '<h1 id="bd-title">'+(b.emoji&&b.image_key?esc(b.emoji)+' ':'')+esc(b.title)+'</h1>' +
      '<p class="sub">Awarded by '+esc(b.awarded_by_name||"someone")+
        (b.date?' &middot; for '+fmtShort(b.date):'')+'</p>' +
      (b.note?'<p style="margin:0 0 14px;font-size:15px;line-height:1.5">'+esc(b.note)+'</p>':'') +
      badgeFacts([["Given", fmtShort(b.created_at.slice(0,10))]]) +
      (mine ? '<div class="row" style="margin-top:16px;gap:10px">' +
        '<button class="ghostbtn" style="margin:0;flex:1" onclick="editBadge(\''+jsId(key)+'\')">Edit</button>' +
        '<button class="ghostbtn" id="del-'+esc(key)+'" style="margin:0;flex:1" ' +
          'onclick="armDelete(\'badge\',\''+jsId(key)+'\',event)">Delete</button></div>'
        : '') +
      '<div id="bd-edit"></div>';
    return;
  }

  /* Art and title come from the wall's own data, so the screen paints instantly
     and the numbers fill in underneath. A spinner over a poster somebody is
     already looking at would be worse than a short wait for two counts. */
  var d = BADGEDATA || {}, art = '', title = '', sub = '';
  if (kind === "state") {
    var st = (d.states||[]).filter(function(x){ return x.state === key; })[0];
    art = stateSvg(st && st.shape, 190); title = key;
  } else if (kind === "park") {
    var pk = (d.parks||[]).filter(function(x){ return x.id === key; })[0];
    title = pk ? pk.name : "Park";
    art = pk && pk.image_key ? '<img src="/photo/'+esc(pk.image_key)+'" alt="">'
                             : '<span class="glyph">&#127966;</span>';
  } else if (kind === "miles") {
    art = mileShield(parseInt(key,10)*1000, 150);
    title = (parseInt(key,10)*1000).toLocaleString() + " miles";
  } else if (kind === "tank") {
    art = '<span class="glyph">&#9981;</span>';
    title = (parseInt(key,10)*10) + " tanks";
  }
  el("s-badge").innerHTML = back + '<div class="bdart">'+art+'</div>' +
    '<h1>'+esc(title)+'</h1><p class="sub" id="bd-sub">&hellip;</p><div id="bd-facts"></div>';

  get("/api/badge-detail?kind="+encodeURIComponent(kind)+"&key="+encodeURIComponent(key))
    .then(function(r){
      var subEl = el("bd-sub"), factEl = el("bd-facts");
      if (!subEl || !factEl) return;              // they navigated away
      if (!r || r.error) { subEl.textContent = "Couldn't load the details."; return; }
      if (kind === "state") {
        subEl.innerHTML = r.first_date
          ? "First crossed " + fmtDay(r.first_date) : "Not yet";
        factEl.innerHTML = badgeFacts([
          ["Days in this state", r.days || null],
          ["Photographs here", r.photos || null],
          ["Stops recorded", r.stops || null]
        ]) || '<p class="empty">Just passing through, so far.</p>';
      } else if (kind === "park") {
        subEl.innerHTML = r.first_date
          ? "First reached " + fmtDay(r.first_date)
          : "Still ahead of them";
        /* "here" claims the photograph was taken at the park; the 25-mile disc
           around a centroid cannot support that claim for a park 70 miles
           across, so when the disc is empty we fall back to the claim the data
           does support — the same day. */
        factEl.innerHTML = badgeFacts([
          [r.photos ? "Photographs here" : "Photographs that day",
           r.photos || r.photos_that_day || null],
          ["Things to see ticked off",
           r.activities_total ? r.activities_done + " of " + r.activities_total : null],
          ["Nights planned", r.planned_nights || null],
          ["Artwork", r.credit ? esc(r.credit) : null]
        ]) || '<p class="empty">Nothing recorded here yet.</p>';
      } else if (kind === "miles") {
        subEl.innerHTML = r.date
          ? "Crossed on " + fmtDay(r.date) + " &middot; day " + r.day_number
          : (r.miles_total.toLocaleString() + " miles so far &mdash; not yet");
        factEl.innerHTML = badgeFacts([["Miles so far", r.miles_total.toLocaleString()]]);
      } else if (kind === "tank") {
        subEl.innerHTML = r.fills >= r.milestone
          ? "Earned &middot; " + r.fills + " fill-ups"
          : r.fills + " of " + r.milestone + " fill-ups";
        /* These four numbers are the reason this screen exists. Lily has been
           typing gallons and dollars into the pump form since day one and the
           app has never once shown them back to her. */
        factEl.innerHTML = badgeFacts([
          ["Fill-ups", r.fills || null],
          ["Gallons", r.gallons != null ? r.gallons : null],
          ["Spent on fuel", r.cost != null ? "$" + r.cost.toFixed(2) : null],
          ["Average", r.avg_price != null ? "$" + r.avg_price.toFixed(2) + " a gallon" : null],
          ["Cheapest", r.cheapest ? "$" + r.cheapest.price.toFixed(2) +
            (r.cheapest.place ? " &middot; " + esc(r.cheapest.place) : "") +
            " &middot; " + fmtShort(r.cheapest.date) : null],
          ["Priciest", r.priciest ? "$" + r.priciest.price.toFixed(2) +
            (r.priciest.place ? " &middot; " + esc(r.priciest.place) : "") +
            " &middot; " + fmtShort(r.priciest.date) : null]
        ]) || '<p class="empty">No fill-ups recorded yet.</p>';
      }
    });
}

/* Editing happens IN the card rather than in a modal, so the thing being
   renamed stays visible while you rename it. Same permission as Delete:
   whoever awarded it, or any author. */
function editBadge(id){
  var b = BADGES[id], card = el("bd-edit");
  if (!b || !card) return;
  card.innerHTML =
    '<div class="row" style="gap:8px"><input type="text" id="be-emoji-'+id+'" ' +
      'style="width:64px;flex:none;text-align:center" value="'+esc(b.emoji||"")+'" placeholder="&#127941;">' +
    '<input type="text" id="be-title-'+id+'" value="'+esc(b.title||"")+'"></div>' +
    '<textarea id="be-note-'+id+'" style="min-height:64px;margin-top:8px" ' +
      'placeholder="What earned it?">'+esc(b.note||"")+'</textarea>' +
    '<div class="row" style="margin-top:8px;gap:8px">' +
      '<button class="ghostbtn" style="margin:0;flex:1" onclick="saveBadge(\''+jsId(id)+'\')">Save</button>' +
      '<button class="ghostbtn" style="margin:0;flex:1" onclick="openBadge(\'bespoke\',\''+jsId(id)+'\')">Cancel</button></div>';
  var t = el("be-title-"+id); if (t) t.focus();
}

function saveBadge(id){
  var t = el("be-title-"+id); if (!t) return;
  // Same lesson as the award composer: a tap that does nothing reads as broken.
  if (!t.value.trim()) { alertInline(t, "Give the badge a name first."); t.focus(); return; }
  send("/api/badge", "PATCH", {
    id: id,
    title: t.value,
    emoji: (el("be-emoji-"+id)||{}).value || "",
    note:  (el("be-note-"+id)||{}).value || ""
  }).then(function(r){
    if (!r || !r.ok) { alertInline(t, (r && r.error) || "Couldn't save — try again."); return; }
    /* Refresh the wall's cache, then re-open the detail so the change is
       visible where the person is standing rather than two screens back. */
    get("/api/badges").then(function(d){
      if (d) { BADGEDATA = d; BADGES = {}; (d.bespoke||[]).forEach(function(x){ BADGES[x.id] = x; }); }
      openBadge("bespoke", id);
    });
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
    msg.textContent = "Give the badge a name first — the wide box next to the emoji.";
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
    'onclick="openPhoto(\''+jsId(p.id)+'\',\''+jsId(p.r2_key)+'\',\''+jsId(from||"memories")+'\')">';
}

var PHOTO_META = {};
/* Photos and journal, one stream, grouped by day — pictures and words
   together. This is the trip reading itself back; the eventual viewbook is
   this screen with better paper. */
function loadMemories(){
  show("memories");
  Promise.all([get("/api/photos"), get("/api/journal-feed")]).then(function(res){
    var d = res[0], j = res[1];
    if (!d) { offlineInto("s-memories", "loadMemories()"); return; }
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
          g.photos.map(function(p){ return photoThumbHtml(p, "memories"); }).join("") + '</div>'
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

    /* Both render for all six now. A viewer's file input is deliberately not
       wired: opening a picker and then refusing the upload is a worse lie than
       never opening it. */
    var uploader =
      (canWrite() ? '<input type="file" id="ph-files" accept="image/*" multiple style="display:none" ' +
          'onchange="uploadPhotos(this.files)">' : '') +
        // Progress lives IN the fixed bar with the button; it used to render at
        // the bottom of a long scroll, so the tap looked dead on slow wifi.
        '<div class="actionbar"><div id="ph-progress"></div><button class="bigbtn" ' +
          'onclick="' + (canWrite() ? 'el(\'ph-files\').click()' : 'deny(\'photo\',event)') +
          '">Add photos</button></div>';
    var composer = '<div class="card"><textarea id="jf-body" placeholder="What happened today?"' +
        (canWrite() ? '' : ' readonly') + '></textarea>' +
        '<button class="ghostbtn" onclick="' +
        (canWrite() ? 'saveJournalFeed()' : 'deny(\'journal\',event)') +
        '">Save entry</button></div>';
    var nP = d.photos.length, nW = ((j && j.entries) || []).length;
    el("s-memories").innerHTML = '<h1>Memories</h1><p class="sub">' +
      (nP || nW ? nP + ' photo' + (nP===1?'':'s') + ' &middot; ' + nW + ' entr' + (nW===1?'y':'ies')
                : 'Nothing here yet') + '</p>' +
      '<div id="ph-viewer"></div>' + composer +
      (stream || '<p class="empty">Photos from the camera roll and anything written — the whole trip, day by day.</p>') +
      uploader;
  });
}


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
      (canWrite()
        ? '<button id="del-'+jsId(id)+'" onclick="armDelete(\'photo\',\''+jsId(id)+'\',event)" ' +
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
    if (!f) { done && loadMemories(); return; }
    f.arrayBuffer().then(function(buf){
      var meta = exifGps(buf);
      // The server has always been able to dedupe on sha256 and to treat
      // client_id as an idempotency key — the client just never sent either,
      // so "tap Add photos to retry those" made a SECOND copy of every photo
      // that had already succeeded. Both are derived from the original bytes,
      // so they are stable across any number of retries.
      return crypto.subtle.digest("SHA-256", buf).then(function(h){
        var sha = Array.prototype.map.call(new Uint8Array(h), function(b){
          return ("0"+b.toString(16)).slice(-2); }).join("");
      return createImageBitmap(new Blob([buf]), { imageOrientation: "from-image" })
        .then(function(img){
          return Promise.all([scaleToBlob(img, 1800, 0.82), scaleToBlob(img, 420, 0.75)]);
        })
        .then(function(blobs){
          var fd = new FormData();
          fd.append("file", blobs[0], "p.jpg");
          fd.append("thumb", blobs[1], "t.jpg");
          fd.append("sha256", sha);
          fd.append("client_id", "ph" + sha.slice(0, 40));
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
      });
    }).catch(function(){ failed++; note(); next(); });
  })();
}

var PLACE_FROM = "trip";
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
      /* The row stays tappable for a viewer — it just answers with a line
         about whose list it is instead of a silent cursor:default, which read
         as the app being broken. */
      return '<li onclick="' + (canWrite()
        ? 'tickActivity(\''+a.id+'\','+(a.done?0:1)+',\''+id+'\')'
        : 'deny(\'activity\',event)') + '">' +
        '<span class="box'+(a.done?" done":"")+'"></span><span'+(a.done?' class="done-txt"':'')+'>' +
        esc(a.name)+(a.distance_mi?' &middot; '+a.distance_mi+' mi':'') +
        (a.detail&&!a.done?'<span class="hers">'+esc(a.detail)+'</span>':'')+'</span></li>';
    }).join("");
    var res = d.reservations.map(function(r){
      return '<div class="card tapme" onclick="loadRes(\''+jsId(r.id)+'\',\'place\')"><div class="row"><span>'+esc(r.name)+
        '</span><b>'+(r.cost!=null?'$'+r.cost.toFixed(2):'')+'</b></div>' +
        '<p class="tiny" style="margin:6px 0 0">'+(r.booked?'Booked':'Not booked')+'</p></div>';
    }).join("");
    el("s-place").innerHTML =
      '<button class="back" onclick="tab(\''+PLACE_FROM+'\')">&larr;</button>' +
      '<h1>'+esc(i.name)+'</h1><p class="sub">' +
      (i.planned_arrival?'Hoped for '+fmtShort(i.planned_arrival):'No date') +
      (i.planned_nights?' &middot; '+i.planned_nights+' night'+(i.planned_nights===1?'':'s'):'') +
      (i.drive_time_from_prev?' &middot; '+esc(i.drive_time_from_prev)+' away':'') + '</p>' +
      (d.activities.length ? '<h2>'+d.activities.length+' thing'+(d.activities.length===1?'':'s')+' to see</h2>' +
        '<div class="card" style="padding:4px 14px"><ul class="check">'+acts+'</ul></div>' : '') +
      /* Her research, exactly as she typed it into the vault — newlines and
         tab indentation intact via pre-wrap, because the shape of the list IS
         her thinking. Never normalise this into prose. */
      /* NOT class="hers" — that is styled for a one-line aside next to an
         activity (italic, small, accent-coloured). Her place notes run to
         ~800 characters and up to 3,800; the same styling makes a wall.
         Left rule in the accent colour says "hers"; the body reads as body. */
      /* visited_on is the derived-visit set the timeline bands on, so "still
         ahead" here can never disagree with where the place was listed. */
      mapsLinks(i.lat, i.lon, i.name, !(d.visited_on && d.visited_on.length)) +
      (i.notes ? '<h2>Notes</h2><div class="card" style="border-left:3px solid var(--sun)">' +
        '<p style="margin:0;color:var(--ink-2);font-size:14.5px;line-height:1.6;' +
        'white-space:pre-wrap;word-break:break-word">' +
        linkify(i.notes)+'</p></div>' : '') +
      (res ? '<h2>Staying / getting in</h2>'+res : '');
  });
}

function tickActivity(id, done, placeId){
  send("/api/activity","POST",{ id:id, done:!!done }).then(function(){ loadPlace(placeId); });
}

/* Deleted by accident in the viewer-unification pass; every read happens to
   be short-circuit-guarded, but one code motion away from a ReferenceError. */
var LAST_DAY = null, LAST_PLACE = null;
var RES_BACK = "tab('today')";
function loadRes(id, from){
  show("res");
  RES_BACK = (from === "place" && LAST_PLACE)
    ? "loadPlace('" + LAST_PLACE + "')" : "tab('today')";
  get("/api/reservation?id="+encodeURIComponent(id)).then(function(r){
    if (r && r.error === "not found") {
      el("s-res").innerHTML = '<button class="back" onclick="'+RES_BACK+'">&larr;</button>' +
        '<h1>Not found</h1><p class="sub">That booking is no longer in the plan.</p>';
      return;
    }
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
      (r.notes ? '<h2>Notes</h2><div class="card"><p class="hers" style="margin:0;font-size:14.5px;line-height:1.5">'+
        esc(r.notes)+'</p></div>' : '') +
      mapsLinks(r.place_lat, r.place_lon, r.place_name || r.name,
                r.check_in_date ? r.check_in_date >= todayISO() : false) +
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
    // mapSvg dereferences d immediately, so a failed fetch threw inside the
    // .then: the mini-map stayed an empty grey box AND the tap handler below
    // never got wired, making the caption under it a lie.
    if (!d) { box.innerHTML = '<p class="empty" style="padding:20px">Map unavailable offline.</p>'; return; }
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
  /* One subpath PER SEGMENT. Flattening every track into a single path drew a
     straight chord from the end of each segment to the start of the next —
     invisible while segments were consecutive, but map() appends the
     breadcrumb-derived tracks after the polyline ones, so the join between the
     two groups leapt from North Dakota back to Ohio across the whole map. */
  var route = (d.tracks||[]).map(function(t){
    return t.map(function(p,i){
      return (i?"L":"M")+px(p[0]).toFixed(1)+" "+py(p[1]).toFixed(1); }).join(" ");
  }).filter(function(x){ return x; }).join(" ");
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
    var c = document.createElement("canvas"); c.width = 64; c.height = 64;
    var x = c.getContext("2d");
    x.beginPath(); x.arc(32,32,29,0,7); x.fillStyle="#ffffff"; x.fill();
    x.strokeStyle="rgba(0,0,0,.22)"; x.lineWidth=2.5; x.stroke();
    x.font = "36px serif"; x.textAlign="center"; x.textBaseline="middle";
    x.fillText(glyph, 32, 35);
    if (!map.hasImage(name)) map.addImage(name, x.getImageData(0,0,64,64), { pixelRatio: 2 });
  }
  emojiIcon("pin-photo", "📷");
  emojiIcon("pin-journal", "✏️");

  // Photos located by the same breadcrumb share EXACT coordinates and their
  // pins stack invisibly — Lily's two camp photos looked like one. Spread
  // coincident pins in a small deterministic ring so each stays tappable.
  var photoRows = (d.photos||[]).map(function(p){ return Object.assign({}, p); });
  var seenAt = {};
  photoRows.forEach(function(p){
    var k = p.lat.toFixed(4) + "," + p.lon.toFixed(4);
    var n = seenAt[k] = (seenAt[k] || 0) + 1;
    if (n > 1) {
      var ang = (n - 1) * 2.4; // golden-angle-ish, no two overlap
      p.lat += 0.0011 * Math.sin(ang);
      p.lon += 0.0011 * Math.cos(ang) / Math.cos(p.lat * Math.PI / 180);
    }
  });
  map.addSource("photopins", { type:"geojson", data: feats(photoRows, function(p){
    return { id:p.id, thumb:p.thumb_key||"", date:p.date||"", icon:"ph-"+p.id }; }) });
  var pinSize = ["interpolate", ["linear"], ["zoom"], 4, 0.7, 8, 1.1, 12, 1.5, 15, 1.9];
  map.addLayer({ id:"photo-pins", type:"symbol", source:"photopins",
    layout:{ // the real photo once it has loaded; the camera glyph until then
             "icon-image":["coalesce",["image",["get","icon"]],["image","pin-photo"]],
             "icon-size":pinSize, "icon-allow-overlap":true } });

  /* Real thumbnails instead of a camera glyph. /photo/* already serves
     'private, max-age=31536000, immutable', so each one is fetched once and
     then lives in the phone's cache — the second look at the map costs
     nothing. Drawn into a rounded tile with a white border so a dark photo
     still reads as a pin against the map. */
  (function loadPhotoPins(){
    var SZ = 84, R = 15, pending = 0;
    photoRows.forEach(function(p){
      if (!p.thumb_key || map.hasImage("ph-"+p.id)) return;
      pending++;
      var img = new Image();
      img.onload = function(){
        var c = document.createElement("canvas"); c.width = c.height = SZ;
        var x = c.getContext("2d");
        x.beginPath();
        if (x.roundRect) x.roundRect(2, 2, SZ-4, SZ-4, R); else x.rect(2, 2, SZ-4, SZ-4);
        x.fillStyle = "#fff"; x.fill();
        x.save(); x.clip();
        // cover-crop: fill the tile, never letterbox
        var s = Math.max((SZ-8) / img.width, (SZ-8) / img.height);
        var w = img.width * s, h = img.height * s;
        x.drawImage(img, 4 + (SZ-8-w)/2, 4 + (SZ-8-h)/2, w, h);
        x.restore();
        x.beginPath();
        if (x.roundRect) x.roundRect(2, 2, SZ-4, SZ-4, R); else x.rect(2, 2, SZ-4, SZ-4);
        x.strokeStyle = "#fff"; x.lineWidth = 4; x.stroke();
        x.strokeStyle = "rgba(0,0,0,.20)"; x.lineWidth = 1.5; x.stroke();
        try { if (!map.hasImage("ph-"+p.id))
                map.addImage("ph-"+p.id, x.getImageData(0,0,SZ,SZ), { pixelRatio: 2 }); } catch(e){}
        if (--pending === 0) map.triggerRepaint();
      };
      img.onerror = function(){ if (--pending === 0) map.triggerRepaint(); };
      img.src = "/photo/" + p.thumb_key;
    });
  })();

  map.addSource("journalpins", { type:"geojson", data: feats(d.journal||[], function(j){
    return { id:j.id, date:j.date||"", excerpt:j.excerpt||"", author:j.author||"" }; }) });
  map.addLayer({ id:"journal-pins", type:"symbol", source:"journalpins",
    layout:{ "icon-image":"pin-journal", "icon-size":pinSize, "icon-allow-overlap":true } });

  /* Everything on the map opens the thing it stands for. */
  /* One popup at a time. Tapping a pin shows the card; tapping the CARD opens
     the day (see openable). */
  var POPUP = null;
  function popupAt(coord, html){
    if (POPUP) { try { POPUP.remove(); } catch(e){} }
    POPUP = new maplibregl.Popup({ maxWidth:"260px", closeButton:true, className:"rtpop" })
      .setLngLat(coord).setHTML(html).addTo(map);
  }
  /* Tap the POPUP to open the day, not the pin a second time.
     Tap-the-pin-again asked the finger to hit a 4.5px target twice, with the
     popup that just appeared covering part of the map and no visible state to
     say the pin was "armed" — so a miss silently re-armed a different pin, or
     nothing happened at all. Andy: "that doesn't work well." The popup is a
     260px card that is already under the thumb; making the card itself the
     button removes the second aim entirely. */
  function openable(date, html, lat, lon, name){
    return '<div class="popgo" onclick="loadDay(\''+jsId(date)+'\',\'map\')">' + html +
      '<div class="pophint">Open this day &rarr;</div></div>' +
      /* Outside the popgo wrapper: a link inside a div that navigates on click
         would fire both. */
      (lat != null ? '<div style="padding:0 11px 11px">' +
        mapsLinks(lat, lon, name, false) + '</div>' : '');
  }
  function dayLine(date){
    var di = (d.day_index || {})[date];
    var when = fmtDay(date);
    return (di && di.day ? 'Day ' + di.day + ' &middot; ' : '') + when;
  }
  function dayPlace(date){
    var di = (d.day_index || {})[date];
    return di && di.place ? di.place : '';
  }
  function countOn(list, date){
    var n = 0;
    for (var i = 0; i < list.length; i++) if (list[i].date === date) n++;
    return n;
  }
  map.on("click", "place-dots", function(e){
    var f = e.features[0];
    popupAt(f.geometry.coordinates,
      '<b>'+esc(f.properties.name)+'</b><br>' +
      '<button class="ghostbtn" style="margin-top:6px" ' +
        'onclick="loadPlace(\''+jsId(f.properties.id)+'\',\'map\')">Open the plan</button>');
  });
  map.on("click", "place-labels", function(e){
    var f = e.features[0];
    loadPlace(f.properties.id, "map");
  });
  map.on("click", "vstop-dots", function(e){
    var f = e.features[0], pr = f.properties;
    // Derived stops carry no id, so the date and time identify the pin.
    popupAt(f.geometry.coordinates, openable(pr.date,
      '<div class="popbody"><div class="popt">Car stopped here</div>' +
      '<div class="popm">' +
      (pr.ongoing ? 'Still there' : (pr.mins ? 'For ' + (pr.mins >= 60
        ? Math.floor(pr.mins/60) + 'h ' + (pr.mins%60) + 'm' : pr.mins + ' min') : '')) +
      (pr.at ? ' &middot; ' + fmtTime(pr.at) : '') + '</div></div>',
      f.geometry.coordinates[1], f.geometry.coordinates[0], "Where the car stopped"));
  });
  map.on("click", "stop-dots", function(e){
    var f = e.features[0], pr = f.properties;
    popupAt(f.geometry.coordinates, openable(pr.date,
      '<div class="popbody">' +
        '<div class="popt">'+(ICON[pr.kind]||"")+' '+esc(pr.place || pr.kind)+'</div>' +
        '<div class="popm">'+dayLine(pr.date)+
          (pr.occurred_at ? ' &middot; '+fmtTime(pr.occurred_at) : '')+
          (wx(pr.weather_code)
            ? ' &middot; '+wx(pr.weather_code).icon+' '+degF(pr.temp_f) : '')+'</div>' +
        (dayPlace(pr.date) ? '<div class="popm">'+esc(dayPlace(pr.date))+'</div>' : '') +
      '</div>',
      f.geometry.coordinates[1], f.geometry.coordinates[0], pr.place || pr.kind));
  });
  map.on("click", "photo-pins", function(e){
    var f = e.features[0], pr = f.properties;
    var n = countOn(d.photos || [], pr.date);
    popupAt(f.geometry.coordinates, openable(pr.date,
      (pr.thumb ? '<img src="/photo/'+esc(pr.thumb)+'" class="popimg">' : '') +
      '<div class="popbody">' +
        '<div class="popt">'+dayLine(pr.date)+'</div>' +
        (dayPlace(pr.date) ? '<div class="popm">'+esc(dayPlace(pr.date))+'</div>' : '') +
        /* Joined, not concatenated: an iMessage photo can arrive with no
           author name and no EXIF timestamp, and the old form then rendered a
           leading " · 39 photos that day". Seen in the wild on the very first
           pin this popup was tested against. */
        '<div class="popm">'+[
          pr.author ? esc(pr.author) : '',
          fmtTime(pr.taken_at),
          n > 1 ? n + ' photos that day' : ''
        ].filter(function(x){ return x; }).join(' &middot; ')+'</div>' +
      '</div>'));
  });
  map.on("click", "journal-pins", function(e){
    var f = e.features[0], pr = f.properties;
    popupAt(f.geometry.coordinates, openable(pr.date,
      '<div class="popbody">' +
        '<div class="popt">'+dayLine(pr.date)+'</div>' +
        (dayPlace(pr.date) ? '<div class="popm">'+esc(dayPlace(pr.date))+'</div>' : '') +
        '<p class="popq">'+esc(pr.excerpt)+(pr.excerpt.length >= 120 ? '&hellip;' : '')+'</p>' +
        '<div class="popm">'+esc(pr.author||'')+'</div>' +
      '</div>'));
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
  // Each visit built a fresh WebGL context and abandoned the last; iOS starts
  // dropping contexts after a dozen or so.
  if (ML_MAP) { try { ML_MAP.remove(); } catch(e){} ML_MAP = null; }
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
