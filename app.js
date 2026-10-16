/* Cincinnati Cornhole Club stats site. Data comes from data/site.json, published by the club's stats app. */
(function () {
  "use strict";
  var DATA = null;
  var COLORS = ["#2a78d6", "#eb6834", "#1baf7a", "#eda100", "#e87ba4", "#008300", "#6250d6", "#e34948"];
  var view = document.getElementById("view");
  var tip = document.createElement("div");
  tip.className = "tip";
  document.body.appendChild(tip);

  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  function slug(s) { return encodeURIComponent(s); }
  function getLeague() {
    var saved = null;
    try { saved = localStorage.getItem("league"); } catch (e) { /* private mode */ }
    return saved === "monday" || saved === "thursday" || (saved === "all" && (!DATA || DATA.leagues.all)) ? saved : null;
  }
  function setLeague(l) {
    document.body.setAttribute("data-league", l);
    try { localStorage.setItem("league", l); } catch (e) { /* ignore */ }
    var btns = document.querySelectorAll("[data-set-league]");
    for (var i = 0; i < btns.length; i++) btns[i].classList.toggle("on", btns[i].getAttribute("data-set-league") === l);
  }
  function league() { return document.body.getAttribute("data-league"); }
  function L() { return DATA.leagues[league()]; }
  function title(l) { return l === "monday" ? "Monday Night Cornhole" : l === "all" ? "Monday + Thursday" : "Thursday Cornhole"; }
  // In All, a small Mon / Thu tag says which night it was.
  function tag(r) { return league() === "all" && r.league ? ' <span class="lg-tag lg-' + r.league + '">' + (r.league === "monday" ? "Mon" : "Thu") + "</span>" : ""; }

  var MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  var LONG = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  function d8(s, long) {
    var p = String(s).split("-");
    if (p.length < 3) return s;
    var m = parseInt(p[1], 10) - 1, d = parseInt(p[2], 10);
    return long ? LONG[m] + " " + d + ", " + p[0] : MONTHS[m] + " " + d;
  }
  // The period a league's stats cover, e.g. "January 5 \u2013 October 5, 2026" (first night to latest night).
  function span(lg) {
    if (!lg.events.length) return "";
    var first = lg.events[lg.events.length - 1].date, last = lg.events[0].date;
    if (first === last) return d8(last, true);
    var a = d8(first, true), b = d8(last, true);
    if (first.slice(0, 4) === last.slice(0, 4)) a = a.replace(/, \d{4}$/, "");
    return a + " \u2013 " + b;
  }
  function pct(v, digits) { return v == null ? "-" : (v * 100).toFixed(digits == null ? 1 : digits) + "%"; }
  function num(v, digits) { return v == null ? "-" : Number(v).toFixed(digits == null ? 2 : digits); }
  function signed(v) { return v == null ? "-" : (v > 0 ? "+" : "") + Number(v).toFixed(2); }
  function ord(n) {
    if (n == null) return "-";
    var s = ["th", "st", "nd", "rd"], v = n % 100;
    return n + (s[(v - 20) % 10] || s[v] || s[0]);
  }
  function playerLink(name) {
    if (!name || name === "Ghost" || name === "Player") return esc(name || "");
    return '<a href="#/player/' + slug(name) + '">' + esc(name) + "</a>";
  }
  function teamLinks(team) {
    return team.split(" & ").map(playerLink).join(" &amp; ");
  }

  // ------------------------------------------------------------------ pages
  // ------------------------------------------------------------------ Me + Share (96.23)
  function getMe() { try { return localStorage.getItem("me") || ""; } catch (e) { return ""; } }
  function setMe(name) { try { if (name) localStorage.setItem("me", name); else localStorage.removeItem("me"); } catch (e) { /* private mode */ } }
  function showMeButton() {
    var me = getMe(), btn = document.getElementById("me-btn");
    if (!btn) {
      btn = document.createElement("a");
      btn.id = "me-btn";
      btn.className = "me-btn";
      var row = document.querySelector(".top-row");
      if (row) row.insertBefore(btn, row.querySelector(".switch"));
    }
    btn.style.display = me ? "" : "none";
    btn.href = "#/player/" + slug(me);
    btn.innerHTML = "&#9733;<span> Me</span>";
    btn.title = me;
  }
  function toast(text) {
    var t = document.createElement("div");
    t.className = "toast";
    t.textContent = text;
    document.body.appendChild(t);
    setTimeout(function () { t.classList.add("go"); }, 1800);
    setTimeout(function () { if (t.parentNode) t.parentNode.removeChild(t); }, 2400);
  }
  function shareLink(what) {
    // Links open in the same league the sharer is looking at.
    var url = location.href.split("#")[0].split("?")[0] + "?l=" + league() + location.hash;
    if (navigator.share) {
      navigator.share({ title: what + " - Cincinnati Cornhole Club", url: url }).catch(function () {});
    } else if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(url).then(function () { toast("Link copied - paste it anywhere"); }, function () { prompt("Copy this link:", url); });
    } else {
      prompt("Copy this link:", url);
    }
  }
  function actionRow(buttons) {
    return '<div class="actions">' + buttons.map(function (b) {
      return '<button type="button" class="act' + (b.on ? " on" : "") + '" data-act="' + b.act + '">' + b.label + "</button>";
    }).join("") + "</div>";
  }

  // ------------------------------------------------------------------ milestones (96.23)
  var TIERS = {
    wins: [10, 25, 50, 100, 150, 200, 250, 300, 400, 500, 750, 1000],
    fours: [10, 25, 50, 100, 250, 500, 750, 1000, 1500, 2000],
    nights: [5, 10, 25, 50, 75, 100, 150, 200],
    titles: [1, 5, 10, 15, 20, 25, 50],
    perfect: [1, 5, 10, 25, 50]
  };
  function milestones(p) {
    var items = [
      { key: "titles", icon: "&#127942;", value: p.titles, label: "titles", one: "title" },
      { key: "fours", icon: "&#127919;", value: p.fours, label: "four-baggers", one: "four-bagger" },
      { key: "wins", icon: "&#128170;", value: p.wins, label: "wins", one: "win" },
      { key: "nights", icon: "&#128197;", value: p.nights, label: "nights", one: "night" },
      { key: "perfect", icon: "&#128293;", value: p.perfect || 0, label: "perfect games", one: "perfect game" }
    ];
    var badges = [], next = [];
    items.forEach(function (it) {
      var tiers = TIERS[it.key], reached = null, upcoming = null;
      tiers.forEach(function (t) { if (it.value >= t) reached = t; else if (upcoming == null) upcoming = t; });
      if (reached != null) badges.push('<div class="badge"><div class="ic">' + it.icon + '</div><div class="bn">' + it.value + '</div><div class="bl">' +
        (it.value === 1 ? it.one : it.label) + "</div></div>");
      if (upcoming != null && it.value > 0) next.push({ text: upcoming + " " + (upcoming === 1 ? it.one : it.label), left: upcoming - it.value, share: it.value / upcoming });
    });
    if (p.firstTitle) badges.push('<div class="badge"><div class="ic">&#11088;</div><div class="bn">1st</div><div class="bl">title &bull; ' + d8(p.firstTitle) + "</div></div>");
    if (!badges.length) return "";
    next.sort(function (a, b) { return b.share - a.share; });
    var html = '<h2>Milestones</h2><div class="badges">' + badges.join("") + "</div>";
    if (next.length) {
      html += '<h3 class="next-h">Next up</h3><div class="card next">' + next.slice(0, 3).map(function (n) {
        return '<div class="next-row"><b>' + n.text + '</b><span class="muted">' + n.left + " to go</span></div>" +
          '<div class="bar"><i style="width:' + Math.round(n.share * 100) + '%"></i></div>';
      }).join("") + "</div>";
    }
    return html;
  }

  // ------------------------------------------------------------------ Add to Home Screen tip (96.28)
  // A one-time card on Home explaining how to put the stats app on the phone's home screen.
  // Hidden once dismissed, and never shown when it's already opened from the home screen.
  var installEvent = null;
  window.addEventListener("beforeinstallprompt", function (e) {
    e.preventDefault();
    installEvent = e;
    var b = document.getElementById("a2hs-install");
    if (b) b.style.display = "";
  });
  window.addEventListener("appinstalled", function () { remember("a2hs", "done"); var c = document.getElementById("a2hs"); if (c) c.remove(); });
  function remember(key, value) { try { localStorage.setItem(key, value); } catch (e) { /* private mode */ } }
  function recall(key) { try { return localStorage.getItem(key); } catch (e) { return null; } }
  function installed() {
    return (window.matchMedia && window.matchMedia("(display-mode: standalone)").matches) || window.navigator.standalone === true;
  }
  function homeScreenTip() {
    if (installed() || recall("a2hs")) return "";
    var ua = navigator.userAgent || "";
    var ios = /iPhone|iPad|iPod/i.test(ua) || (/Macintosh/.test(ua) && "ontouchend" in document);
    var android = /Android/i.test(ua);
    if (!ios && !android) return "";
    var how = ios
      ? "In Safari, tap the Share button <b>&#8679;</b> at the bottom, then <b>Add to Home Screen</b>."
      : "Tap the browser menu <b>&#8942;</b>, then <b>Add to Home screen</b> (or <b>Install app</b>).";
    return '<div class="card a2hs" id="a2hs"><button class="a2hs-x" data-a2hs="close" aria-label="Close">&times;</button>' +
      '<img src="icon-192.png" alt="" width="44" height="44"><div><b>Put CCC Stats on your home screen</b>' +
      '<div class="note">Opens like an app, full screen, one tap away. ' + how + "</div>" +
      '<button class="act a2hs-go" id="a2hs-install" data-a2hs="install"' + (installEvent ? "" : ' style="display:none"') + ">Install</button></div></div>";
  }
  function bindHomeScreenTip() {
    var card = document.getElementById("a2hs");
    if (!card) return;
    card.addEventListener("click", function (e) {
      var act = e.target.closest && e.target.closest("[data-a2hs]");
      if (!act) return;
      if (act.getAttribute("data-a2hs") === "install" && installEvent) {
        installEvent.prompt();
        installEvent.userChoice.then(function (r) { if (r && r.outcome === "accepted") { remember("a2hs", "done"); card.remove(); } });
        installEvent = null;
      } else {
        remember("a2hs", "closed");
        card.remove();
      }
    });
  }

  function home() {
    var lg = L(), ev = lg.events[0];
    var html = "<h1>" + esc(title(league())) + "</h1>";
    html += '<p class="sub">' + esc(span(lg)) + " &bull; " + lg.events.length + " nights &bull; " + lg.players.length + " players</p>";
    html += homeScreenTip();
    html += '<div style="margin-top:14px"><input class="search" id="q" type="search" placeholder="Find a player&hellip;" autocomplete="off"></div>';
    html += '<div id="results"></div>';
    if (ev) {
      html += "<h2>Latest night &bull; " + esc(d8(ev.date, true)) + "</h2>";
      html += '<div class="grid g2"><div class="card"><div class="podium">';
      ev.standings.slice(0, 3).forEach(function (t) {
        html += '<div class="pod"><span class="place">' + ord(t.place).toUpperCase() + '</span><span class="team">' + teamLinks(t.team) +
          '</span><span class="rec">' + t.wins + "-" + t.losses + "</span></div>";
      });
      html += '</div><p class="muted" style="margin:10px 0 0">' + ev.players + ' players &bull; <a href="#/night/' + ev.date + '">Full results &rarr;</a></p></div>';
      html += '<div class="card"><h3 class="label" style="font:800 15px \'Saira Extra Condensed\',sans-serif;letter-spacing:1.2px;color:var(--ink-2);text-transform:uppercase">Top PPR that night</h3><ul class="leader-list">';
      ev.leaders.filter(function (r) { return (r.rounds || 0) >= 20; }).slice(0, 5).forEach(function (r, i) {
        html += '<li><span class="n">' + (i + 1) + "</span><span>" + playerLink(r.name) + '<span class="note">' + (r.fours || 0) + " four-baggers &bull; DPR " + signed(r.dpr) +
          '</span></span><span class="v">' + num(r.ppr) + "</span></li>";
      });
      html += "</ul></div></div>";
    }
    var ranked = lg.players.filter(function (p) { return p.ranked; });
    function top(key, fmt, label) {
      var rows = ranked.filter(function (p) { return p[key] != null; }).sort(function (a, b) { return b[key] - a[key]; }).slice(0, 5);
      var h = '<div class="card board"><h3>' + label + '</h3><p class="rule">' + lg.minNights + "+ nights</p><ul class=\"leader-list\">";
      rows.forEach(function (p, i) {
        h += '<li><span class="n">' + (i + 1) + "</span><span>" + playerLink(p.name) + '<span class="note">' + p.nights + " nights</span></span><span class=\"v\">" + fmt(p[key]) + "</span></li>";
      });
      return h + "</ul></div>";
    }
    html += "<h2>Career leaders</h2><p class=\"muted\" style=\"margin:-4px 0 10px\">" + esc(span(lg)) + "</p><div class=\"grid g3\">" +
      top("ppr", function (v) { return num(v); }, "PPR") +
      top("dpr", signed, "DPR") +
      top("winPct", function (v) { return pct(v); }, "Win %") +
      top("fourPct", function (v) { return pct(v); }, "4-Bagger %") +
      top("inPct", function (v) { return pct(v); }, "In the Hole %") +
      top("titles", function (v) { return v; }, "Titles") + "</div>";
    view.innerHTML = html;
    var q = document.getElementById("q"), res = document.getElementById("results");
    q.addEventListener("input", function () {
      var s = q.value.trim().toLowerCase();
      if (!s) { res.innerHTML = ""; return; }
      var hits = lg.players.filter(function (p) { return p.name.toLowerCase().indexOf(s) >= 0; }).slice(0, 8);
      res.innerHTML = '<div class="card" style="margin-top:8px;padding:4px 14px">' + (hits.length ? hits.map(function (p) {
        return '<a class="list-link" href="#/player/' + slug(p.name) + '"><span>' + esc(p.name) + '</span><span class="count">' + p.nights + " nights &bull; " + num(p.ppr) + " PPR</span></a>";
      }).join("") : '<p class="muted">No ' + esc(league()) + " player by that name.</p>") + "</div>";
    });
  }

  var sortState = { key: "ppr", dir: -1 };
  function players() {
    var lg = L();
    var cols = [
      ["name", "Player", "l"], ["nights", "Nights"], ["record", "W-L", "hide-sm"], ["winPct", "Win %"], ["ppr", "PPR"], ["dpr", "DPR"],
      ["fourPct", "4-Bag %", "hide-sm"], ["inPct", "In %", "hide-sm"], ["titles", "Titles"]
    ];
    var html = "<h1>Players</h1><p class=\"sub\">" + esc(title(league())) + " &bull; " + esc(span(lg)) + "</p><p class=\"muted\" style=\"margin:2px 0 0\">Tap a column to sort &bull; grey = fewer than " + lg.minNights + " nights</p>";
    html += '<div class="search-row"><input class="search" id="pq" type="search" placeholder="Search players&hellip;" autocomplete="off"><a class="act" href="#/vs">&#8644; Head to Head</a></div>';
    html += '<div class="table-wrap"><table><thead><tr>' + cols.map(function (c) {
      return '<th data-k="' + c[0] + '" class="' + (c[2] || "") + (sortState.key === c[0] ? " sorted" : "") + '">' + c[1] + (sortState.key === c[0] ? (sortState.dir < 0 ? " &darr;" : " &uarr;") : "") + "</th>";
    }).join("") + '</tr></thead><tbody id="ptb"></tbody></table></div>';
    view.innerHTML = html;
    function fill() {
      var s = document.getElementById("pq").value.trim().toLowerCase();
      var rows = lg.players.filter(function (p) { return !s || p.name.toLowerCase().indexOf(s) >= 0; });
      var k = sortState.key;
      rows.sort(function (a, b) {
        if (k === "name") return sortState.dir * a.name.localeCompare(b.name);
        if (k === "record") return sortState.dir * ((a.wins - a.losses) - (b.wins - b.losses));
        var av = a[k], bv = b[k];
        if (a.ranked !== b.ranked) return a.ranked ? -1 : 1;
        if (av == null) return 1;
        if (bv == null) return -1;
        return sortState.dir * (av - bv);
      });
      document.getElementById("ptb").innerHTML = rows.map(function (p) {
        return '<tr class="' + (p.ranked ? "" : "dim") + '"><td class="l">' + playerLink(p.name) + "</td><td>" + p.nights + '</td><td class="hide-sm">' + p.wins + "-" + p.losses +
          "</td><td>" + pct(p.winPct) + "</td><td>" + num(p.ppr) + "</td><td>" + signed(p.dpr) + '</td><td class="hide-sm">' + pct(p.fourPct) +
          '</td><td class="hide-sm">' + pct(p.inPct) + "</td><td>" + p.titles + "</td></tr>";
      }).join("");
    }
    document.getElementById("pq").addEventListener("input", fill);
    var ths = view.querySelectorAll("th[data-k]");
    for (var i = 0; i < ths.length; i++) {
      ths[i].addEventListener("click", function () {
        var k = this.getAttribute("data-k");
        sortState = { key: k, dir: sortState.key === k ? -sortState.dir : (k === "name" ? 1 : -1) };
        var q = document.getElementById("pq").value;
        players();
        document.getElementById("pq").value = q;
        fill();
      });
    }
    fill();
  }

  function player(name) {
    var lg = L();
    var p = lg.players.filter(function (x) { return x.name === name; })[0];
    if (!p) {
      var other = league() !== "all" && DATA.leagues[league() === "monday" ? "thursday" : "monday"].players.some(function (x) { return x.name === name; });
      view.innerHTML = '<a class="back" href="#/players">&larr; Players</a><div class="empty"><h1>' + esc(name) + "</h1><p class=\"muted\">No " + esc(title(league())) +
        " nights yet." + (other ? ' <a href="#" id="flip">See their ' + (league() === "monday" ? "Thursday" : "Monday") + " stats &rarr;</a>" : "") + "</p></div>";
      var flip = document.getElementById("flip");
      if (flip) flip.addEventListener("click", function (e) { e.preventDefault(); setLeague(league() === "monday" ? "thursday" : "monday"); route(); });
      return;
    }
    var html = '<a class="back" href="#/players">&larr; Players</a><h1>' + esc(p.name) + "</h1>";
    var mine = getMe() === p.name;
    html += actionRow([{ act: "me", label: (mine ? "&#9733;" : "&#9734;") + " This is me", on: mine },
                       { act: "share", label: "&#8599; Share" }, { act: "vs", label: "&#8644; Compare" }]);
    html += '<p class="sub">' + esc(title(league())) + " &bull; " + d8(p.first, true) + " &ndash; " + d8(p.last, true) + "</p>";
    html += '<div class="chips"><span class="chip"><b>' + p.nights + "</b> nights</span><span class=\"chip\"><b>" + p.wins + "-" + p.losses + "</b> record</span>" +
      '<span class="chip"><b>' + p.titles + "</b> titles</span><span class=\"chip\"><b>" + p.podiums + "</b> top-3 finishes</span>" +
      '<span class="chip"><b>' + p.fours + "</b> four-baggers</span></div>";
    function tile(label, big, note) {
      return '<div class="card tile"><div class="label">' + label + '</div><div class="big">' + big + '</div><div class="note">' + (note || "") + "</div></div>";
    }
    html += '<div class="grid g4" style="margin-top:14px">' +
      tile("PPR", num(p.ppr), p.bestNight ? "best " + num(p.bestNight.ppr) + " on " + d8(p.bestNight.date) : "") +
      tile("DPR", signed(p.dpr), "points per round over opponents") +
      tile("Win %", pct(p.winPct), p.wins + "-" + p.losses) +
      tile("4-Bagger %", pct(p.fourPct), p.fours + " in " + p.rounds + " rounds") +
      tile("Bags in / on / off", p.inPct == null ? "-" : pct(p.inPct, 0) + " / " + pct(p.onPct, 0) + " / " + pct(p.offPct, 0), "in the hole / on the board / off") + "</div>";
    html += milestones(p);
    var lines = [];
    if (p.bestGame) {
      var g = p.bestGame;
      lines.push('<div class="hl"><div class="label">Best game ever</div><div class="hlbig">' + num(g.ppr) + ' PPR <span class="muted">over ' + g.rounds + " rounds" +
        (g.fours ? " &bull; " + g.fours + " four-bagger" + (g.fours === 1 ? "" : "s") : "") + '</span></div><div class="note">' +
        (g.partner ? "with " + esc(g.partner) + " " : "") + (g.opponents ? "vs " + esc(g.opponents) : "") +
        (g.score ? " &bull; " + (g.won ? "won " : "") + esc(g.score) : "") + " &bull; " + d8(g.date, true) + "</div></div>");
    }
    if (p.improved) {
      var im = p.improved;
      lines.push('<div class="hl"><div class="label">Most improved' +
        '</div><div class="hlbig">+' + num(im.change) + ' PPR</div><div class="note">' + num(im.from) + " &rarr; " + num(im.to) +
        " from their first 5 nights to their last 5</div></div>");
    }
    if (lines.length) html += '<div class="grid g2 hls" style="margin-top:14px">' + lines.map(function (x) { return '<div class="card">' + x + "</div>"; }).join("") + "</div>";
    if (p.trend && p.trend.length > 1) html += "<h2>PPR night by night</h2><div class=\"card\">" + trendChart(p) + "</div>";
    html += pairTable("partners", "With each partner", "Every game played together, most played first", "Partner", "Win %", p.partners,
      function (r) { return pct(r.w / (r.w + r.l), 0); });
    html += pairTable("versus", "Head to head", "Most played first. Record when they threw against each other at the boards, every game in brackets", "Opponent", "Avg score", p.versus,
      function (r) { var g = r.w + r.l; return (r.pf / g).toFixed(1) + "-" + (r.pa / g).toFixed(1); });
    html += "<h2>Recent nights</h2><div class=\"table-wrap\"><table><thead><tr><th class=\"l\">Night</th><th class=\"l\">Partner</th><th>Finish</th><th>Record</th><th>PPR</th><th class=\"hide-sm\">DPR</th><th class=\"hide-sm\">4-Bag</th></tr></thead><tbody>";
    p.recent.forEach(function (r) {
      html += '<tr><td class="l" data-sort="' + r.date + '"><a href="#/night/' + r.date + '">' + d8(r.date) + "</a>" + tag(r) + '</td><td class="l">' + playerLink(r.partner) + "</td><td>" + ord(r.place) +
        "</td><td>" + (r.wins == null ? "-" : r.wins + "-" + r.losses) + "</td><td>" + num(r.ppr) + '</td><td class="hide-sm">' + signed(r.dpr) + '</td><td class="hide-sm">' + (r.fours || 0) + "</td></tr>";
    });
    view.innerHTML = html + "</tbody></table></div>";
    var more = view.querySelectorAll("[data-more]");
    for (var i = 0; i < more.length; i++) more[i].addEventListener("click", function (e) {
      e.preventDefault();
      var rows = view.querySelectorAll("tr.extra-" + this.getAttribute("data-more"));
      for (var j = 0; j < rows.length; j++) rows[j].style.display = "";
      this.style.display = "none";
    });
  }

  var PAIR_ROWS = 8;
  function pairTable(key, heading, sub, who, lastCol, rows, cell) {
    if (!rows || !rows.length) return "";
    var html = "<h2>" + heading + '</h2><p class="sub pair-sub">' + sub + '</p><div class="table-wrap"><table><thead><tr><th class="l">' + who +
      "</th><th>Record</th><th>" + lastCol + '</th><th class="hide-sm">Last</th></tr></thead><tbody>';
    rows.forEach(function (r, i) {
      var record = r.bw != null ? r.bw + "-" + r.bl + ' <span class="muted">(' + r.w + "-" + r.l + ")</span>" : r.w + "-" + r.l;
      html += "<tr" + (i >= PAIR_ROWS ? ' class="extra-' + key + '" style="display:none"' : "") + '><td class="l">' + playerLink(r.name) + "</td><td>" +
        record + "</td><td>" + cell(r) + '</td><td class="hide-sm" data-sort="' + esc(r.last || "") + '">' + d8(r.last) + "</td></tr>";
    });
    html += "</tbody></table></div>";
    if (rows.length > PAIR_ROWS) html += '<a href="#" class="more" data-more="' + key + '">Show all ' + rows.length + " &darr;</a>";
    return html;
  }

  function trendChart(p) {
    var t = p.trend, avg = p.ppr;
    var narrow = window.innerWidth < 640, W = narrow ? 360 : 700, H = narrow ? 200 : 230, left = 30, right = 14, top = 16, bottom = 30;
    var vals = t.map(function (r) { return r.ppr; }).concat(avg == null ? [] : [avg]);
    var lo = Math.floor(Math.min.apply(null, vals) - 0.3), hi = Math.ceil(Math.max.apply(null, vals) + 0.3);
    var step = hi - lo > 6 ? 2 : 1;
    function x(i) { return left + (W - left - right) * (t.length > 1 ? i / (t.length - 1) : 0.5); }
    function y(v) { return top + (hi - v) / (hi - lo) * (H - top - bottom); }
    // Date labels: every night when there's room, otherwise spread out, always including the latest night.
    var every = Math.max(1, Math.ceil(t.length / (narrow ? 4 : 8)));
    var g = '<svg class="chart" viewBox="0 0 ' + W + " " + H + '" role="img" aria-label="PPR each night">';
    for (var v = lo; v <= hi; v += step) g += '<line x1="' + left + '" x2="' + (W - right) + '" y1="' + y(v) + '" y2="' + y(v) + '" stroke="#2a2a2a"/><text x="' +
      (left - 6) + '" y="' + (y(v) + 4) + '" text-anchor="end">' + v + "</text>";
    if (avg != null) g += '<line x1="' + left + '" x2="' + (W - right) + '" y1="' + y(avg) + '" y2="' + y(avg) + '" stroke="var(--accent-2)" stroke-dasharray="5 5"/>';
    g += '<polyline fill="none" stroke="var(--accent)" stroke-width="' + (t.length > 20 ? 2 : 3) + '" stroke-linejoin="round" points="' +
      t.map(function (r, i) { return x(i).toFixed(1) + "," + y(r.ppr).toFixed(1); }).join(" ") + '"/>';
    t.forEach(function (r, i) {
      var won = r.place === 1, last = i === t.length - 1, crowded = (W - left - right) / Math.max(1, t.length - 1) < 16;
      g += '<circle cx="' + x(i).toFixed(1) + '" cy="' + y(r.ppr).toFixed(1) + '" r="' + (won ? (crowded ? 4.5 : 6.5) : (crowded ? 2.5 : 4)) + '" fill="' + (won ? "var(--accent)" : "#0b0b0b") +
        '" stroke="var(--accent)" stroke-width="2"><title>' + d8(r.date) + ": " + num(r.ppr) + " PPR" + (r.place ? " • " + ord(r.place) : "") + "</title></circle>";
      if (last || (i % every === 0 && t.length - 1 - i >= every))
        g += '<text x="' + x(i).toFixed(1) + '" y="' + (H - 8) + '" text-anchor="' + (last && t.length > 1 ? "end" : i === 0 ? "start" : "middle") + '">' + d8(r.date) + "</text>";
    });
    return g + '</svg><div class="legend"><span><i style="background:var(--accent)"></i>PPR each night</span>' +
      (avg != null ? '<span><i style="background:var(--accent-2)"></i>their average (' + num(avg) + ")</span>" : "") +
      "<span>big dot = 1st place</span></div>";
  }

  function nights() {

    var lg = L();
    var html = "<h1>Nights</h1><p class=\"sub\">" + esc(title(league())) + " &bull; " + lg.events.length + " nights &bull; " + esc(span(lg)) + "</p><div class=\"card\" style=\"margin-top:14px;padding:0\">";
    lg.events.forEach(function (ev) {
      var win = ev.standings[0];
      html += '<a class="list-link" href="#/night/' + ev.date + '"><span class="date">' + d8(ev.date) + " " + ev.date.slice(0, 4) + tag(ev) + '</span><span class="who">' +
        (win ? "1st: " + esc(win.team) + " (" + win.wins + "-" + win.losses + ")" : "") + '</span><span class="count">' + ev.players + " players</span></a>";
    });
    view.innerHTML = html + "</div>";
  }

  function night(date) {
    var lg = L();
    var ev = lg.events.filter(function (e) { return e.date === date; })[0];
    if (!ev) {
      var other = league() === "monday" ? "thursday" : "monday";
      if (league() !== "all" && DATA.leagues[other].events.some(function (e) { return e.date === date; })) { setLeague(other); return night(date); }
      view.innerHTML = '<a class="back" href="#/nights">&larr; Nights</a><p class="muted">No night on ' + esc(date) + ".</p>";
      return;
    }
    var html = '<a class="back" href="#/nights">&larr; Nights</a><h1>' + d8(ev.date, true) + "</h1><p class=\"sub\">" + esc(title(ev.league || league())) + " &bull; " + ev.players + " players</p>";
    html += actionRow([{ act: "share", label: "&#8599; Share this night" }]);
    html += highlights(ev.highlights);
    if (ev.slides && ev.slides.length) {
      html += "<h2>This week&rsquo;s slides</h2><div class=\"slides\">" + ev.slides.map(function (src, i) {
        return '<a href="' + esc(src) + '" target="_blank" rel="noopener"><img loading="lazy" src="' + esc(src) + '" alt="Slide ' + (i + 1) + ' for ' + esc(d8(ev.date, true)) + '"></a>';
      }).join("") + "</div>";
    }
    html += "<h2>Final standings</h2><div class=\"table-wrap\"><table><thead><tr><th>Place</th><th class=\"l\">Team</th><th>Record</th><th>Team PPR</th><th class=\"hide-sm\">Team DPR</th></tr></thead><tbody>";
    ev.standings.forEach(function (t) {
      html += "<tr><td>" + ord(t.place) + '</td><td class="l">' + teamLinks(t.team) + "</td><td>" + t.wins + "-" + t.losses + "</td><td>" + num(t.ppr) + '</td><td class="hide-sm">' + signed(t.dpr) + "</td></tr>";
    });
    html += "</tbody></table></div><h2>Every player</h2><div class=\"table-wrap\"><table><thead><tr><th class=\"l\">Player</th><th>PPR</th><th>DPR</th><th>4-Bag</th><th class=\"hide-sm\">Rounds</th></tr></thead><tbody>";
    ev.leaders.forEach(function (r) {
      html += '<tr><td class="l">' + playerLink(r.name) + "</td><td>" + num(r.ppr) + "</td><td>" + signed(r.dpr) + "</td><td>" + (r.fours || 0) + '</td><td class="hide-sm">' + (r.rounds || 0) + "</td></tr>";
    });
    view.innerHTML = html + "</tbody></table></div>";
  }

  function highlights(h) {
    if (!h) return "";
    var cards = [];
    function card(label, big, note) {
      cards.push('<div class="card"><div class="label">' + label + '</div><div class="big">' + big + '</div>' + (note ? '<div class="note">' + note + "</div>" : "") + "</div>");
    }
    if (h.best) {
      var b = h.best;
      card("Best game of the night", playerLink(b.name) + " &bull; " + num(b.ppr) + " PPR",
        (b.fours ? b.fours + " four-bagger" + (b.fours === 1 ? "" : "s") + " in " : "") + b.rounds + " rounds" +
        (b.partner ? " &bull; with " + esc(b.partner) : "") + (b.opponents ? " vs " + esc(b.opponents) : "") +
        (b.score ? ", " + (b.won ? "won " : "") + esc(b.score) : ""));
    }
    if (h.comeback) card("Comeback of the night", teamLinks(h.comeback.team) + " &bull; down " + h.comeback.down,
      "from " + esc(h.comeback.low) + " to win " + esc(h.comeback.final));
    if (h.longest) card("Longest game", h.longest.rounds + " rounds", esc(h.longest.teams) + " &bull; " + esc(h.longest.score));
    if (h.fours) card("Most four-baggers", playerLink(h.fours.name) + " &bull; " + h.fours.count, "");
    if (h.streak) card("Most rounds won in a row", playerLink(h.streak.name) + " &bull; " + h.streak.count,
      h.streak.record ? "A new club record!" : "");
    return cards.length ? '<h2>Night highlights</h2><div class="hl-grid">' + cards.join("") + "</div>" : "";
  }

  // ------------------------------------------------------------------ Head to Head (96.23)
  function versus(a, b) {
    var lg = L();
    var names = lg.players.map(function (p) { return p.name; }).sort(function (x, y) { return x.toLowerCase() < y.toLowerCase() ? -1 : 1; });
    function plain(n) { return String(n || "").toLowerCase().replace(/[^a-z0-9.&' -]/g, "").replace(/\s+/g, " ").trim(); }
    function find(n) {      // exact name, or the same name without its emoji ("Figure Skater")
      if (!n) return "";
      if (names.indexOf(n) >= 0) return n;
      var hit = names.filter(function (x) { return plain(x) === plain(n); })[0];
      return hit || "";
    }
    a = find(a) || find(getMe()) || names[0];
    b = find(b);
    if (b === a) b = "";
    function picker(id, val) {
      return '<select id="' + id + '"><option value="">Pick a player&hellip;</option>' + names.map(function (n) {
        return "<option" + (n === val ? " selected" : "") + ' value="' + esc(n) + '">' + esc(n) + "</option>";
      }).join("") + "</select>";
    }
    var html = "<h1>Head to Head</h1><p class=\"sub\">Pick any two players &bull; " + esc(title(league())) + '</p><div class="card vs-pick">' +
      picker("vsa", a) + '<span class="vs-word">VS</span>' + picker("vsb", b) + "</div>";
    if (a && b) {
      var pa = lg.players.filter(function (p) { return p.name === a; })[0], pb = lg.players.filter(function (p) { return p.name === b; })[0];
      var pairs = lg.pairs || { vs: {}, duo: {} }, ab = a + "\t" + b, ba = b + "\t" + a;
      var flip = !(ab in pairs.vs) && (ba in pairs.vs);           // stored from the first name's side
      var v = pairs.vs[ab] || pairs.vs[ba] || null, d = pairs.duo[ab] || pairs.duo[ba] || null;
      function side(arr, i, j) { return flip ? [arr[j], arr[i]] : [arr[i], arr[j]]; }
      function row(label, x, y, fmt, higherIsBetter) {
        var fx = fmt ? fmt(x) : x, fy = fmt ? fmt(y) : y;
        var lead = (x == null || y == null || x === y) ? 0 : ((x > y) === (higherIsBetter !== false) ? 1 : 2);
        return '<div class="vs-row"><b class="' + (lead === 1 ? "lead" : "") + '">' + fx + '</b><span class="lab">' + label + '</span><b class="' + (lead === 2 ? "lead" : "") + '">' + fy + "</b></div>";
      }
      html += "<h2>Against each other</h2>";
      if (v && v[0] + v[1] > 0) {
        var g = side(v, 0, 1), bk = side(v, 2, 3), bd = side(v, 4, 5), rd = side(v, 6, 7);
        html += '<div class="card vs-card"><div class="vs-big"><div><div class="n' + (g[0] > g[1] ? " lead" : "") + '">' + g[0] + '</div><div class="muted">' + esc(a) +
          '</div></div><div class="vs-word">GAMES</div><div><div class="n' + (g[1] > g[0] ? " lead" : "") + '">' + g[1] + '</div><div class="muted">' + esc(b) + "</div></div></div>";
        if (bd[0] + bd[1] > 0) html += row("Games at the board", bd[0], bd[1]) + row("Rounds won at the board", rd[0], rd[1]);
        if (bk[0] + bk[1] > 0) html += row("Bracket games", bk[0], bk[1]);
        html += '<div class="vs-row"><span></span><span class="lab">Last met &bull; ' + d8(v[8], true) + "</span><span></span></div></div>";
      } else {
        html += '<div class="card"><p class="muted" style="margin:0">' + esc(a) + " and " + esc(b) + " haven't played against each other yet.</p></div>";
      }
      html += "<h2>As partners</h2>";
      if (d && d[0] + d[1] > 0) {
        html += '<div class="card vs-card"><div class="vs-one"><div class="n lead">' + d[0] + "-" + d[1] + '</div><div class="muted">' + pct(d[0] / (d[0] + d[1]), 0) +
          (d[2] ? " &bull; " + d[2] + " title" + (d[2] === 1 ? "" : "s") + " together" : "") + " &bull; last " + d8(d[3]) + "</div></div></div>";
      } else {
        html += '<div class="card"><p class="muted" style="margin:0">They haven\'t teamed up yet.</p></div>';
      }
      if (pa && pb) {
        html += '<h2>Side by side</h2><div class="card vs-card">' +
          row("PPR", pa.ppr, pb.ppr, function (x) { return num(x); }) +
          row("Win %", pa.winPct, pb.winPct, function (x) { return pct(x, 0); }) +
          row("Titles", pa.titles, pb.titles) +
          row("4-Bagger %", pa.fourPct, pb.fourPct, function (x) { return pct(x, 0); }) +
          row("Nights", pa.nights, pb.nights) + "</div>";
      }
    }
    view.innerHTML = html;
    function pick() {
      var x = document.getElementById("vsa").value, y = document.getElementById("vsb").value;
      location.hash = "#/vs/" + slug(x) + (y ? "/" + slug(y) : "");
    }
    document.getElementById("vsa").addEventListener("change", pick);
    document.getElementById("vsb").addEventListener("change", pick);
  }

  var recordSection = "Career Totals";
  function recordLimit() {
    var n = 5;
    try { n = parseInt(localStorage.getItem("recordLimit"), 10) || 5; } catch (e) { /* private mode */ }
    return [5, 10, 25].indexOf(n) >= 0 ? n : 5;
  }
  function records() {
    var lg = L(), limit = recordLimit();
    var sections = [];
    lg.records.forEach(function (b) { if (sections.indexOf(b.section) < 0) sections.push(b.section); });
    if (sections.indexOf(recordSection) < 0) recordSection = sections[0];
    var known = {};
    lg.players.forEach(function (p) { known[p.name] = true; });
    function who(text) {
      // "A", "A & B" or "A & B vs C & D"; anything that isn't a player (a court) is plain text.
      return String(text).split(" vs ").map(function (side) {
        return side.split(" & ").map(function (n) { return known[n] ? playerLink(n) : esc(n); }).join(" &amp; ");
      }).join(' <span class="muted">vs</span> ');
    }
    var html = "<h1>Record Book</h1><p class=\"sub\">" + esc(title(league())) + " &bull; all-time &bull; " + esc(span(lg)) + "</p><div class=\"pills records-bar\">" + sections.map(function (s) {
      return '<button type="button" data-sec="' + s + '" class="' + (s === recordSection ? "on" : "") + '">' + s + "</button>";
    }).join("") + '<label class="limit">Show <select id="limit" aria-label="How many per record">' + [5, 10, 25].map(function (n) {
      return '<option value="' + n + '"' + (n === limit ? " selected" : "") + ">Top " + n + "</option>";
    }).join("") + '</select></label></div><div class="grid g3">';
    lg.records.filter(function (b) { return b.section === recordSection; }).forEach(function (b) {
      html += '<div class="card board"><h3>' + esc(b.title) + '</h3><p class="rule">' + esc(b.rule || "") + '</p><ul class="leader-list">';
      b.rows.slice(0, limit).forEach(function (r, i) {
        html += '<li><span class="n">' + (i + 1) + "</span><span>" + who(r.name) + '<span class="note">' + esc(r.note) + '</span></span><span class="v">' + esc(r.value) + "</span></li>";
      });
      html += "</ul></div>";
    });
    view.innerHTML = html + "</div>";
    var btns = view.querySelectorAll("[data-sec]");
    for (var i = 0; i < btns.length; i++) btns[i].addEventListener("click", function () { recordSection = this.getAttribute("data-sec"); records(); });
    document.getElementById("limit").addEventListener("change", function () {
      try { localStorage.setItem("recordLimit", this.value); } catch (e) { /* ignore */ }
      records();
    });
  }

  function leaguePage() {
    if (league() !== "thursday") { setLeague("thursday"); }
    var s = DATA.leagues.thursday.season;
    if (!s) { view.innerHTML = "<h1>Thursday League</h1><p class=\"muted\">No league season yet.</p>"; return; }
    var html = "<h1>" + esc(s.name) + "</h1><p class=\"sub\">" + d8(s.start, true) + " &ndash; " + d8(s.end, true) + " &bull; best " + s.bestResults + " of " + s.weeks +
      " weeks count &bull; " + s.winBonus + "-point win bonus</p>";
    html += seasonCard(s);
    html += "<h2>Standings race</h2><p class=\"muted\" style=\"margin:-4px 0 10px\">Place after each week for the current top 8.</p>" +
      '<div class="card"><div class="legend" id="legend"></div><div id="race"></div></div>';
    html += "<h2>Standings</h2><p class=\"muted\" style=\"margin:-4px 0 10px\">Order only - league points aren't posted.</p>" +
      "<div class=\"table-wrap\"><table><thead><tr><th>Place</th><th class=\"l\">Player</th></tr></thead><tbody>";
    s.standings.forEach(function (r) {
      html += "<tr><td>" + ord(r.place) + '</td><td class="l">' + playerLink(r.name) + "</td></tr>";
    });
    view.innerHTML = html + "</tbody></table></div>";
    drawRace(s.race);
  }

  // Before the finale: how many league nights are left. After Finalize Season: the champion (places only, no points).
  function seasonCard(s) {
    if (s.final && s.final.champion) {
      var medals = ["&#129352;", "&#129353;"];
      return '<div class="card champ-card"><div class="cup">&#127942;</div><div class="champ-k">' + esc(s.name) + ' champion</div>' +
        '<div class="champ-n">' + playerLink(s.final.champion) + "</div>" +
        (s.final.podium.length ? '<div class="champ-p">' + s.final.podium.map(function (n, i) {
          return "<span>" + medals[i] + " " + playerLink(n) + "</span>";
        }).join("") + "</div>" : "") + "</div>";
    }
    var c = s.countdown;
    if (!c || !s.weeks) return "";
    var finale = "Thursday, " + d8(s.end);
    var big = c.left === 0 ? "Final standings coming soon" : c.left === 1 ? "Finale night is next!" : c.left + " league nights left";
    var line = (c.left ? "Finale " + esc(finale) : "Season complete") +
      (c.left && c.canWin ? " &bull; " + c.canWin + " player" + (c.canWin === 1 ? "" : "s") + " can still win" : "");
    return '<div class="card count-card"><div class="label">Title race</div><div class="count-big">' + big + "</div>" +
      '<div class="note">' + line + '</div><div class="bar"><i style="width:' + Math.round(100 * c.played / s.weeks) + '%"></i></div>' +
      '<div class="muted count-sm">' + c.played + " of " + s.weeks + " nights played</div></div>";
  }

  function drawRace(race) {
    var box = document.getElementById("race"), legend = document.getElementById("legend");
    if (!race || !race.dates.length) { box.innerHTML = '<p class="muted">No weeks yet.</p>'; return; }
    legend.innerHTML = race.series.map(function (s, i) {
      return '<span><i style="background:' + COLORS[i % COLORS.length] + '"></i>' + (i + 1) + ". " + esc(s.player) + "</span>";
    }).join("");
    var W = 760, H = 380, left = 44, right = 112, top = 14, bottom = 40;
    var key = "places";
    var vals = [];
    race.series.forEach(function (s) { s[key].forEach(function (v) { if (v != null) vals.push(v); }); });
    var lo = 1;
    var hi = Math.max.apply(null, vals.concat([race.series.length]));
    var span = Math.max(hi - lo, 1);
    function x(i) { return left + (W - left - right) * (race.dates.length > 1 ? i / (race.dates.length - 1) : 0.5); }
    function y(v) { return top + (v - lo) / span * (H - top - bottom); }
    var svg = '<svg class="chart" viewBox="0 0 ' + W + " " + H + '" role="img" aria-label="Standings race chart">';
    for (var k = 0; k <= 4; k++) {
      var t = lo + span * k / 4, yy = y(t);
      svg += '<line x1="' + left + '" x2="' + (W - right) + '" y1="' + yy + '" y2="' + yy + '" stroke="#262626"/>';
      svg += '<text x="' + (left - 6) + '" y="' + (yy + 4) + '" text-anchor="end">' + ord(Math.round(t)) + "</text>";
    }
    race.dates.forEach(function (d, i) {
      if (race.dates.length > 8 && i % 2 && i !== race.dates.length - 1) return;
      svg += '<text x="' + x(i) + '" y="' + (H - bottom + 18) + '" text-anchor="middle">' + d8(d) + "</text>";
    });
    var ends = [], dots = "";
    race.series.forEach(function (s, idx) {
      var c = COLORS[idx % COLORS.length], pts = [];
      s[key].forEach(function (v, i) { if (v != null) pts.push([x(i), y(v), i]); });
      if (pts.length > 1) svg += '<polyline fill="none" stroke="' + c + '" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round" points="' +
        pts.map(function (p) { return p[0].toFixed(1) + "," + p[1].toFixed(1); }).join(" ") + '"/>';
      pts.forEach(function (p) {
        dots += '<circle cx="' + p[0].toFixed(1) + '" cy="' + p[1].toFixed(1) + '" r="5" fill="' + c + '" stroke="#151515" stroke-width="2" data-s="' + idx + '" data-i="' + p[2] + '"/>';
      });
      if (pts.length) ends.push([pts[pts.length - 1][1], s.player, s[key][pts[pts.length - 1][2]]]);
    });
    ends.sort(function (a, b) { return a[0] - b[0]; });
    for (var e = 1; e < ends.length; e++) if (ends[e][0] - ends[e - 1][0] < 14) ends[e][0] = ends[e - 1][0] + 14;
    ends.forEach(function (en) {
      var label = en[1].length > 14 ? en[1].slice(0, 13) + "…" : en[1];
      svg += '<text class="end" x="' + (W - right + 8) + '" y="' + (en[0] + 4) + '">' + esc(label) + " " + ord(en[2]) + "</text>";
    });
    box.innerHTML = svg + dots + "</svg>";
    var circles = box.querySelectorAll("circle");
    for (var j = 0; j < circles.length; j++) {
      circles[j].addEventListener("mouseenter", showTip);
      circles[j].addEventListener("click", showTip);
      circles[j].addEventListener("mouseleave", function () { tip.style.display = "none"; });
    }
    function showTip(ev) {
      var s = race.series[+this.getAttribute("data-s")], i = +this.getAttribute("data-i");
      tip.innerHTML = "<b>" + esc(s.player) + "</b><br>" + d8(race.dates[i]) + " (week " + (i + 1) + ")<br>" + ord(s.places[i]) + " place";
      tip.style.display = "block";
      var r = this.getBoundingClientRect();
      tip.style.left = Math.min(window.innerWidth - tip.offsetWidth - 8, r.left + 12) + "px";
      tip.style.top = Math.max(8, r.top - tip.offsetHeight - 8) + "px";
    }
  }

  // ------------------------------------------------------------------ sort any table by tapping a column heading
  // (the Players list has its own sorter; every other table gets this one)
  function sortValue(td) {
    if (!td) return { n: null, t: "" };
    var raw = td.getAttribute("data-sort");
    var t = (raw != null ? raw : td.textContent).trim();
    var m;
    if (raw != null && /^\d{4}-\d{2}-\d{2}/.test(t)) return { n: Number(t.slice(0, 10).replace(/-/g, "")), t: t };
    if ((m = t.match(/^(\d+)-(\d+)(\s|$)/))) {                       // a record: 9-10 (13-13) sorts by win %, then games
      var w = +m[1], l = +m[2];
      return { n: w + l ? w / (w + l) + (w + l) / 1e6 : -1, t: t };
    }
    if ((m = t.match(/^(-?\d+(?:\.\d+)?)-(\d+(?:\.\d+)?)$/))) return { n: +m[1] - +m[2], t: t };   // average score 21.0-14.3
    if ((m = t.match(/^(\d+)(st|nd|rd|th)$/))) return { n: -Number(m[1]), t: t };                    // 1st is best
    var n = parseFloat(t.replace(/[,%+]/g, ""));
    if (t !== "" && t !== "-" && !isNaN(n) && /^[+-]?[\d.,]+%?$/.test(t)) return { n: n, t: t };
    return { n: null, t: t.toLowerCase() };
  }
  function makeSortable(root) {
    var tables = root.querySelectorAll("table");
    for (var i = 0; i < tables.length; i++) {
      var table = tables[i];
      if (table.querySelector("th[data-k]") || table.getAttribute("data-sortable")) continue;
      table.setAttribute("data-sortable", "1");
      var ths = table.querySelectorAll("thead th");
      for (var c = 0; c < ths.length; c++) {
        ths[c].addEventListener("click", (function (tbl, col) {
          return function () {
            var heads = tbl.querySelectorAll("thead th");
            var dir = this.getAttribute("data-dir") === "desc" ? "asc" : "desc";
            for (var h = 0; h < heads.length; h++) {
              heads[h].classList.remove("sorted");
              heads[h].removeAttribute("data-dir");
            }
            this.classList.add("sorted");
            this.setAttribute("data-dir", dir);
            var body = tbl.tBodies[0];
            var rows = Array.prototype.slice.call(body.rows);
            var text = rows.every(function (r) { return sortValue(r.cells[col]).n == null; });
            rows.sort(function (a, b) {
              var x = sortValue(a.cells[col]), y = sortValue(b.cells[col]);
              if (text) return (x.t < y.t ? -1 : x.t > y.t ? 1 : 0) * (dir === "desc" ? 1 : -1);   // names: A-Z first
              if (x.n == null && y.n == null) return 0;
              if (x.n == null) return 1;
              if (y.n == null) return -1;
              return (y.n - x.n) * (dir === "desc" ? 1 : -1);
            });
            rows.forEach(function (r) { r.style.display = ""; body.appendChild(r); });   // sorting shows every row
            var wrap = tbl.closest(".table-wrap");
            var more = wrap && wrap.nextElementSibling;
            if (more && more.hasAttribute("data-more")) more.style.display = "none";
          };
        })(table, c));
      }
    }
  }

  function bindActions(name) {
    var acts = view.querySelectorAll("[data-act]");
    for (var i = 0; i < acts.length; i++) {
      acts[i].addEventListener("click", function () {
        var act = this.getAttribute("data-act");
        if (act === "me") {
          var was = getMe() === name;
          setMe(was ? "" : name);
          toast(was ? "Okay - not you." : "Saved! Tap the \u2605 at the top to come back here.");
          route();
        } else if (act === "share") {
          shareLink(name || "Cincinnati Cornhole Club stats");
        } else if (act === "vs") {
          location.hash = "#/vs/" + slug(name);
        }
      });
    }
  }

  // ------------------------------------------------------------------ routing
  function route() {
    tip.style.display = "none";
    var hash = location.hash.replace(/^#\/?/, "");
    var parts = hash.split("/"), page = parts[0] || "home", arg = decodeURIComponent(parts.slice(1).join("/"));
    var tabs = document.querySelectorAll("[data-tab]");
    var tabName = { player: "players", night: "nights", vs: "players" }[page] || page;
    for (var i = 0; i < tabs.length; i++) tabs[i].classList.toggle("on", tabs[i].getAttribute("data-tab") === tabName);
    if (page === "players") players();
    else if (page === "player") player(arg);
    else if (page === "nights") nights();
    else if (page === "night") night(arg);
    else if (page === "records") records();
    else if (page === "league") leaguePage();
    else if (page === "vs") versus(decodeURIComponent(parts[1] || ""), decodeURIComponent(parts[2] || ""));
    else { home(); bindHomeScreenTip(); }
    makeSortable(view);
    bindActions(page === "player" ? arg : page === "night" ? d8(arg, true) : "");
    showMeButton();
    window.scrollTo(0, 0);
    countView(league() + "/" + (hash || "home"), document.title);
  }

  // Visitor counts: one per page viewed, e.g. "thursday/player/Josh R." (the counter script loads after this one).
  var lastCounted = "";
  function countView(path, pageTitle, tries) {
    path = "/" + decodeURIComponent(path);
    if (path === lastCounted) return;
    if (window.goatcounter && typeof window.goatcounter.count === "function") {
      lastCounted = path;
      try { window.goatcounter.count({ path: path, title: pageTitle }); } catch (e) { /* never break the site over counting */ }
    } else if ((tries || 0) < 20) {
      setTimeout(function () { countView(path.slice(1), pageTitle, (tries || 0) + 1); }, 500);
    }
  }

  var btns = document.querySelectorAll("[data-set-league]");
  for (var i = 0; i < btns.length; i++) {
    btns[i].addEventListener("click", function () {
      setLeague(this.getAttribute("data-set-league"));
      if (league() !== "thursday" && /^#\/league/.test(location.hash)) location.hash = "#/";
      else route();
    });
  }
  window.addEventListener("hashchange", route);

  fetch("data/site.json?v=" + Date.now()).then(function (r) {
    if (!r.ok) throw new Error(r.status);
    return r.json();
  }).then(function (data) {
    DATA = data;
    if (!data.leagues.all) {   // older data without the All view
      var allBtn = document.querySelector('[data-set-league="all"]');
      if (allBtn) allBtn.style.display = "none";
    }
    var shared = (location.search.match(/[?&]l=(monday|thursday|all)/) || [])[1];
    setLeague(shared || getLeague() || "monday");   // first visit opens on Monday; after that, whichever they picked last
    var g = String(data.generatedAt || "");
    document.getElementById("updated").textContent = "Updated " + d8(g.slice(0, 10), true) + (g.length > 11 ? " at " + g.slice(11, 16) : "") + ".";
    route();
  }).catch(function () {
    view.innerHTML = '<p class="muted">The stats could not be loaded. Please try again in a minute.</p>';
  });
})();
