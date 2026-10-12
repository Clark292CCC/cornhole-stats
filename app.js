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
    return saved === "monday" || saved === "thursday" ? saved : null;
  }
  function setLeague(l) {
    document.body.setAttribute("data-league", l);
    try { localStorage.setItem("league", l); } catch (e) { /* ignore */ }
    var btns = document.querySelectorAll("[data-set-league]");
    for (var i = 0; i < btns.length; i++) btns[i].classList.toggle("on", btns[i].getAttribute("data-set-league") === l);
  }
  function league() { return document.body.getAttribute("data-league"); }
  function L() { return DATA.leagues[league()]; }
  function title(l) { return l === "monday" ? "Monday Night Cornhole" : "Thursday Cornhole"; }

  var MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  var LONG = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  function d8(s, long) {
    var p = String(s).split("-");
    if (p.length < 3) return s;
    var m = parseInt(p[1], 10) - 1, d = parseInt(p[2], 10);
    return long ? LONG[m] + " " + d + ", " + p[0] : MONTHS[m] + " " + d;
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
  function home() {
    var lg = L(), ev = lg.events[0];
    var html = "<h1>" + esc(title(league())) + "</h1>";
    html += '<p class="sub">' + lg.events.length + " nights &bull; " + lg.players.length + " players</p>";
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
    html += "<h2>Career leaders</h2><div class=\"grid g3\">" +
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
    var html = "<h1>Players</h1><p class=\"sub\">" + esc(title(league())) + " &bull; tap a column to sort &bull; grey = fewer than " + lg.minNights + " nights</p>";
    html += '<div style="margin:14px 0"><input class="search" id="pq" type="search" placeholder="Search players&hellip;" autocomplete="off"></div>';
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
      var other = DATA.leagues[league() === "monday" ? "thursday" : "monday"].players.some(function (x) { return x.name === name; });
      view.innerHTML = '<a class="back" href="#/players">&larr; Players</a><div class="empty"><h1>' + esc(name) + "</h1><p class=\"muted\">No " + esc(title(league())) +
        " nights yet." + (other ? ' <a href="#" id="flip">See their ' + (league() === "monday" ? "Thursday" : "Monday") + " stats &rarr;</a>" : "") + "</p></div>";
      var flip = document.getElementById("flip");
      if (flip) flip.addEventListener("click", function (e) { e.preventDefault(); setLeague(league() === "monday" ? "thursday" : "monday"); route(); });
      return;
    }
    var html = '<a class="back" href="#/players">&larr; Players</a><h1>' + esc(p.name) + "</h1>";
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
    html += "<h2>Recent nights</h2><div class=\"table-wrap\"><table><thead><tr><th class=\"l\">Night</th><th class=\"l\">Partner</th><th>Finish</th><th>Record</th><th>PPR</th><th class=\"hide-sm\">DPR</th><th class=\"hide-sm\">4-Bag</th></tr></thead><tbody>";
    p.recent.forEach(function (r) {
      html += '<tr><td class="l"><a href="#/night/' + r.date + '">' + d8(r.date) + '</a></td><td class="l">' + playerLink(r.partner) + "</td><td>" + ord(r.place) +
        "</td><td>" + (r.wins == null ? "-" : r.wins + "-" + r.losses) + "</td><td>" + num(r.ppr) + '</td><td class="hide-sm">' + signed(r.dpr) + '</td><td class="hide-sm">' + (r.fours || 0) + "</td></tr>";
    });
    view.innerHTML = html + "</tbody></table></div>";
  }

  function nights() {
    var lg = L();
    var html = "<h1>Nights</h1><p class=\"sub\">" + esc(title(league())) + " &bull; " + lg.events.length + " nights</p><div class=\"card\" style=\"margin-top:14px;padding:0\">";
    lg.events.forEach(function (ev) {
      var win = ev.standings[0];
      html += '<a class="list-link" href="#/night/' + ev.date + '"><span class="date">' + d8(ev.date) + " " + ev.date.slice(0, 4) + '</span><span class="who">' +
        (win ? "1st: " + esc(win.team) + " (" + win.wins + "-" + win.losses + ")" : "") + '</span><span class="count">' + ev.players + " players</span></a>";
    });
    view.innerHTML = html + "</div>";
  }

  function night(date) {
    var lg = L();
    var ev = lg.events.filter(function (e) { return e.date === date; })[0];
    if (!ev) {
      var other = league() === "monday" ? "thursday" : "monday";
      if (DATA.leagues[other].events.some(function (e) { return e.date === date; })) { setLeague(other); return night(date); }
      view.innerHTML = '<a class="back" href="#/nights">&larr; Nights</a><p class="muted">No night on ' + esc(date) + ".</p>";
      return;
    }
    var html = '<a class="back" href="#/nights">&larr; Nights</a><h1>' + d8(ev.date, true) + "</h1><p class=\"sub\">" + esc(title(league())) + " &bull; " + ev.players + " players</p>";
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

  var recordSection = "Career Totals";
  function records() {
    var lg = L();
    var sections = ["Career Totals", "Best Single Nights"];
    var html = "<h1>Record Book</h1><p class=\"sub\">" + esc(title(league())) + " &bull; all-time</p><div class=\"pills\">" + sections.map(function (s) {
      return '<button type="button" data-sec="' + s + '" class="' + (s === recordSection ? "on" : "") + '">' + s + "</button>";
    }).join("") + '</div><div class="grid g3">';
    lg.records.filter(function (b) { return b.section === recordSection; }).forEach(function (b) {
      html += '<div class="card board"><h3>' + esc(b.title) + '</h3><p class="rule">' + esc(b.rule || "") + '</p><ul class="leader-list">';
      b.rows.slice(0, 5).forEach(function (r, i) {
        html += '<li><span class="n">' + (i + 1) + "</span><span>" + playerLink(r.name) + '<span class="note">' + esc(r.note) + '</span></span><span class="v">' + esc(r.value) + "</span></li>";
      });
      html += "</ul></div>";
    });
    view.innerHTML = html + "</div>";
    var btns = view.querySelectorAll("[data-sec]");
    for (var i = 0; i < btns.length; i++) btns[i].addEventListener("click", function () { recordSection = this.getAttribute("data-sec"); records(); });
  }

  function leaguePage() {
    if (league() !== "thursday") { setLeague("thursday"); }
    var s = DATA.leagues.thursday.season;
    if (!s) { view.innerHTML = "<h1>Thursday League</h1><p class=\"muted\">No league season yet.</p>"; return; }
    var html = "<h1>" + esc(s.name) + "</h1><p class=\"sub\">" + d8(s.start, true) + " &ndash; " + d8(s.end, true) + " &bull; best " + s.bestResults + " of " + s.weeks +
      " weeks count &bull; " + s.winBonus + "-point win bonus</p>";
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

  // ------------------------------------------------------------------ routing
  function route() {
    tip.style.display = "none";
    var hash = location.hash.replace(/^#\/?/, "");
    var parts = hash.split("/"), page = parts[0] || "home", arg = decodeURIComponent(parts.slice(1).join("/"));
    var tabs = document.querySelectorAll("[data-tab]");
    var tabName = { player: "players", night: "nights" }[page] || page;
    for (var i = 0; i < tabs.length; i++) tabs[i].classList.toggle("on", tabs[i].getAttribute("data-tab") === tabName);
    if (page === "players") players();
    else if (page === "player") player(arg);
    else if (page === "nights") nights();
    else if (page === "night") night(arg);
    else if (page === "records") records();
    else if (page === "league") leaguePage();
    else home();
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
      if (league() === "monday" && /^#\/league/.test(location.hash)) location.hash = "#/";
      else route();
    });
  }
  window.addEventListener("hashchange", route);

  fetch("data/site.json?v=" + Date.now()).then(function (r) {
    if (!r.ok) throw new Error(r.status);
    return r.json();
  }).then(function (data) {
    DATA = data;
    var latest = function (l) { var e = data.leagues[l].events[0]; return e ? e.date : ""; };
    setLeague(getLeague() || (latest("thursday") >= latest("monday") ? "thursday" : "monday"));
    var g = String(data.generatedAt || "");
    document.getElementById("updated").textContent = "Updated " + d8(g.slice(0, 10), true) + (g.length > 11 ? " at " + g.slice(11, 16) : "") + ".";
    route();
  }).catch(function () {
    view.innerHTML = '<p class="muted">The stats could not be loaded. Please try again in a minute.</p>';
  });
})();
