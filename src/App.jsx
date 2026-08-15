import { useState, useEffect, useMemo, useRef } from "react";

const storage = {
  get: async (key) => {
    const value = localStorage.getItem(key);
    return value === null ? null : { value };
  },

  set: async (key, value) => {
    localStorage.setItem(key, value);
    return true;
  },
};

/* ---------------------------------------------------------------- tokens */

const PALETTE = [
  "#6E9BD8", // blue
  "#E88BA6", // pink
  "#48BFA8", // teal
  "#E8B646", // yellow
  "#9880D8", // lavender
  "#E89268", // peach
  "#6FBF77", // green
];

const WEEK_TINT = ["#6E9BD8", "#E88BA6", "#48BFA8", "#E8B646", "#9880D8"];

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

const SEED = [
  { id: "h1", time: "5:30 AM", name: "Wake up", color: 0 },
  { id: "h2", time: "5:30–6:00 AM", name: "Fajr + Quran", color: 4 },
  { id: "h3", time: "6:00–7:30 AM", name: "Exercise", color: 2 },
  { id: "h4", time: "9:30 AM–5:30 PM", name: "Project work", color: 3 },
];

/* ----------------------------------------------------------------- utils */

const daysIn = (y, m) => new Date(y, m + 1, 0).getDate();
const uid = () => "h" + Math.random().toString(36).slice(2, 9);
const pct = (n, d) => (d > 0 ? Math.round((n / d) * 100) : null);
const monthKey = (y, m) => `checks:${y}-${String(m + 1).padStart(2, "0")}`;

function weekOf(day) {
  return Math.min(4, Math.floor((day - 1) / 7));
}

/* ------------------------------------------------------------------ ring */

function Ring({ value, size = 108, stroke = 9, color, label, caption }) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const v = value == null ? 0 : value;
  return (
    <div className="ring" style={{ width: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--track)" strokeWidth={stroke} />
        <circle
          cx={size / 2} cy={size / 2} r={r} fill="none"
          stroke={color} strokeWidth={stroke} strokeLinecap="round"
          strokeDasharray={c} strokeDashoffset={c - (c * v) / 100}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
          className="ring-arc"
        />
      </svg>
      <div className="ring-mid" style={{ height: size }}>
        <span className="ring-val">{value == null ? "—" : value}</span>
        {value != null && <span className="ring-pc">%</span>}
      </div>
      {label && <div className="ring-label">{label}</div>}
      {caption && <div className="ring-caption">{caption}</div>}
    </div>
  );
}

/* ------------------------------------------------------------------- app */

export default function HabitTracker() {
  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth());
  const [habits, setHabits] = useState(SEED);
  const [checks, setChecks] = useState({});
  const [editing, setEditing] = useState(false);
  const [ready, setReady] = useState(false);
  const [saveState, setSaveState] = useState("idle");
  const loadedMonth = useRef(null);

  const nDays = daysIn(year, month);
  const isThisMonth = year === today.getFullYear() && month === today.getMonth();
  const isPast = year < today.getFullYear() || (year === today.getFullYear() && month < today.getMonth());
  const lastDay = isThisMonth ? today.getDate() : isPast ? nDays : 0;

  /* ------- load habits once */
  useEffect(() => {
    (async () => {
      try {
        const r = await storage.get("habits-v1", false);
        if (r?.value) setHabits(JSON.parse(r.value));
      } catch (e) {
        /* first run — seed stands */
      }
      setReady(true);
    })();
  }, []);

  /* ------- load checks per month */
  useEffect(() => {
    let alive = true;
    (async () => {
      const key = monthKey(year, month);
      let next = {};
      try {
        const r = await storage.get(key, false);
        if (r?.value) next = JSON.parse(r.value);
      } catch (e) {
        next = {};
      }
      if (!alive) return;
      setChecks(next);
      loadedMonth.current = key;
    })();
    return () => { alive = false; };
  }, [year, month]);

  /* ------- save */
  useEffect(() => {
    if (!ready) return;
    storage.set("habits-v1", JSON.stringify(habits), false).catch(() => {});
  }, [habits, ready]);

  useEffect(() => {
    const key = monthKey(year, month);
    if (loadedMonth.current !== key) return;
    setSaveState("saving");
    storage
      .set(key, JSON.stringify(checks), false)
      .then(() => setSaveState("saved"))
      .catch(() => setSaveState("error"));
  }, [checks, year, month]);

  /* ------- derived */
  const applicableDays = useMemo(
    () => Array.from({ length: lastDay }, (_, i) => i + 1),
    [lastDay]
  );

  const dayScore = useMemo(() => {
    const out = {};
    for (let d = 1; d <= nDays; d++) {
      let done = 0;
      habits.forEach((h) => { if (checks[h.id]?.[d]) done++; });
      out[d] = { done, total: habits.length, pc: pct(done, habits.length) };
    }
    return out;
  }, [checks, habits, nDays]);

  const monthPc = useMemo(() => {
    if (!applicableDays.length || !habits.length) return null;
    const sum = applicableDays.reduce((a, d) => a + dayScore[d].pc, 0);
    return Math.round(sum / applicableDays.length);
  }, [applicableDays, dayScore, habits.length]);

  const weeks = useMemo(() => {
    const buckets = [[], [], [], [], []];
    for (let d = 1; d <= nDays; d++) buckets[weekOf(d)].push(d);
    return buckets.map((days, i) => {
      const live = days.filter((d) => d <= lastDay);
      const value = live.length
        ? Math.round(live.reduce((a, d) => a + dayScore[d].pc, 0) / live.length)
        : null;
      return { i, days, live, value, span: days.length ? `${days[0]}–${days[days.length - 1]}` : "" };
    });
  }, [nDays, lastDay, dayScore]);

  const ranked = useMemo(() => {
    return habits
      .map((h) => {
        const done = applicableDays.filter((d) => checks[h.id]?.[d]).length;
        return { ...h, done, pc: pct(done, applicableDays.length) };
      })
      .sort((a, b) => (b.pc ?? -1) - (a.pc ?? -1));
  }, [habits, checks, applicableDays]);

  const perfectDays = applicableDays.filter((d) => dayScore[d].pc === 100).length;
  const todayPc = isThisMonth ? dayScore[today.getDate()]?.pc : null;

  const streak = useMemo(() => {
    let s = 0;
    for (let d = lastDay; d >= 1; d--) {
      if (dayScore[d].done > 0) s++; else break;
    }
    return s;
  }, [lastDay, dayScore]);

  /* ------- actions */
  const toggle = (hid, day) =>
    setChecks((prev) => {
      const row = { ...(prev[hid] || {}) };
      if (row[day]) delete row[day]; else row[day] = 1;
      return { ...prev, [hid]: row };
    });

  const patch = (id, field, value) =>
    setHabits((hs) => hs.map((h) => (h.id === id ? { ...h, [field]: value } : h)));

  const addHabit = () =>
    setHabits((hs) => [
      ...hs,
      { id: uid(), time: "", name: "New habit", color: hs.length % PALETTE.length },
    ]);

  const removeHabit = (id) => setHabits((hs) => hs.filter((h) => h.id !== id));

  const move = (id, dir) =>
    setHabits((hs) => {
      const i = hs.findIndex((h) => h.id === id);
      const j = i + dir;
      if (i < 0 || j < 0 || j >= hs.length) return hs;
      const copy = [...hs];
      [copy[i], copy[j]] = [copy[j], copy[i]];
      return copy;
    });

  const shiftMonth = (dir) => {
    let m = month + dir, y = year;
    if (m < 0) { m = 11; y--; }
    if (m > 11) { m = 0; y++; }
    setMonth(m); setYear(y);
  };

  /* -------------------------------------------------------------- render */

  return (
    <div className="app">
      <style>{CSS}</style>

      {/* ---- header */}
      <header className="top">
        <div className="top-left">
          <div className="eyebrow">Monthly habit tracker</div>
          <div className="monthpick">
            <button className="nav" onClick={() => shiftMonth(-1)} aria-label="Previous month">‹</button>
            <h1>
              {MONTHS[month]} <span className="yr">{year}</span>
            </h1>
            <button className="nav" onClick={() => shiftMonth(1)} aria-label="Next month">›</button>
          </div>
          <div className="sub">
            {nDays} days · {habits.length} habits ·{" "}
            <span className={`save save-${saveState}`}>
              {saveState === "saving" ? "Saving" : saveState === "error" ? "Not saved" : "Saved"}
            </span>
          </div>
        </div>

        <div className="top-right">
          <Ring value={todayPc} color="var(--ink)" size={96} stroke={8}
            label={isThisMonth ? `Today · ${MONTHS[month].slice(0, 3)} ${today.getDate()}` : "Not this month"} />
        </div>
      </header>

      {/* ---- signature: the month ribbon */}
      <section className="ribbon-card">
        <div className="card-head">
          <h2>The month, day by day</h2>
          <span className="hint">Bar height = habits completed that day</span>
        </div>
        <div className="ribbon" role="img" aria-label="Daily completion across the month">
          {Array.from({ length: nDays }, (_, i) => i + 1).map((d) => {
            const s = dayScore[d];
            const live = d <= lastDay;
            const isToday = isThisMonth && d === today.getDate();
            return (
              <div className={`bar-slot${isToday ? " is-today" : ""}`} key={d} title={`Day ${d} · ${s.done}/${s.total}`}>
                <div className="bar-track">
                  <div
                    className="bar-fill"
                    style={{
                      height: `${live ? Math.max(s.pc, s.pc > 0 ? 6 : 0) : 0}%`,
                      background: WEEK_TINT[weekOf(d)],
                      opacity: live ? 1 : 0.25,
                    }}
                  />
                </div>
                <span className="bar-num">{d % 5 === 0 || d === 1 ? d : ""}</span>
              </div>
            );
          })}
        </div>
      </section>

      {/* ---- stats */}
      <section className="stats">
        <div className="stat">
          <span className="stat-val">{monthPc == null ? "—" : `${monthPc}%`}</span>
          <span className="stat-key">Month so far</span>
        </div>
        <div className="stat">
          <span className="stat-val">{perfectDays}</span>
          <span className="stat-key">Perfect days</span>
        </div>
        <div className="stat">
          <span className="stat-val">{streak}</span>
          <span className="stat-key">Day streak</span>
        </div>
        <div className="stat">
          <span className="stat-val">{lastDay || "—"}</span>
          <span className="stat-key">Days counted</span>
        </div>
      </section>

      {/* ---- weeks + top habits */}
      <div className="split">
        <section className="card">
          <div className="card-head"><h2>Weeks</h2></div>
          <div className="weeks">
            {weeks.filter((w) => w.days.length).map((w) => (
              <div className="week" key={w.i}>
                <Ring value={w.value} size={74} stroke={7} color={WEEK_TINT[w.i]} />
                <div className="week-meta">
                  <strong>Week {w.i + 1}</strong>
                  <span>{w.span}</span>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="card">
          <div className="card-head">
            <h2>Top habits</h2>
            <span className="hint">Ranked by completion</span>
          </div>
          <ol className="ranks">
            {ranked.map((h, i) => (
              <li key={h.id}>
                <span className="rank-n">{i + 1}</span>
                <span className="rank-name">{h.name || "Untitled"}</span>
                <span className="rank-bar">
                  <span style={{ width: `${h.pc ?? 0}%`, background: PALETTE[h.color] }} />
                </span>
                <span className="rank-pc">{h.pc == null ? "—" : `${h.pc}%`}</span>
              </li>
            ))}
            {!ranked.length && <li className="empty">No habits yet. Add one below.</li>}
          </ol>
        </section>
      </div>

      {/* ---- grid */}
      <section className="card grid-card">
        <div className="card-head">
          <h2>Daily habits</h2>
          <div className="head-actions">
            <button className={`chip${editing ? " on" : ""}`} onClick={() => setEditing((e) => !e)}>
              {editing ? "Done editing" : "Edit rows"}
            </button>
            <button className="chip primary" onClick={addHabit}>Add habit</button>
          </div>
        </div>

        <div className={`gridwrap${editing ? " editing" : ""}`}>
          <div className="grow head">
            <div className="rowhead" />
            <div className="cells">
              {Array.from({ length: nDays }, (_, i) => i + 1).map((d) => (
                <span className={`daynum${isThisMonth && d === today.getDate() ? " is-today" : ""}`} key={d}>{d}</span>
              ))}
            </div>
          </div>

          {habits.map((h) => (
            <div className="grow" key={h.id}>
              <div className="rowhead">
                <button
                  className="swatch"
                  style={{ background: PALETTE[h.color] }}
                  onClick={() => patch(h.id, "color", (h.color + 1) % PALETTE.length)}
                  aria-label="Change colour"
                />
                <div className="labels">
                  <input
                    className="in-name" value={h.name} placeholder="Habit name"
                    onChange={(e) => patch(h.id, "name", e.target.value)}
                  />
                  <input
                    className="in-time" value={h.time} placeholder="Add a time"
                    onChange={(e) => patch(h.id, "time", e.target.value)}
                  />
                </div>
                {editing && (
                  <div className="rowctl">
                    <button onClick={() => move(h.id, -1)} aria-label="Move up">↑</button>
                    <button onClick={() => move(h.id, 1)} aria-label="Move down">↓</button>
                    <button className="del" onClick={() => removeHabit(h.id)} aria-label="Delete habit">✕</button>
                  </div>
                )}
              </div>
              <div className="cells">
                {Array.from({ length: nDays }, (_, i) => i + 1).map((d) => {
                  const on = !!checks[h.id]?.[d];
                  return (
                    <button
                      key={d}
                      className={`cell${on ? " on" : ""}`}
                      style={on ? { background: PALETTE[h.color], borderColor: PALETTE[h.color] } : undefined}
                      onClick={() => toggle(h.id, d)}
                      aria-pressed={on}
                      aria-label={`${h.name}, day ${d}`}
                    />
                  );
                })}
              </div>
            </div>
          ))}

          <div className="grow foot">
            <div className="rowhead"><span className="foot-key">Day total</span></div>
            <div className="cells">
              {Array.from({ length: nDays }, (_, i) => i + 1).map((d) => (
                <span className="foot-cell" key={d}>{dayScore[d].done || ""}</span>
              ))}
            </div>
          </div>
        </div>

        {!habits.length && (
          <p className="empty-state">Nothing to track yet. Add your first habit and it shows up here as a row.</p>
        )}
      </section>

      <footer className="foot-note">
        Everything saves automatically per month. Switch months with the arrows — each month keeps its own checkmarks.
      </footer>
    </div>
  );
}

/* ------------------------------------------------------------------- css */

const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,400;12..96,600;12..96,800&family=Inter:wght@400;500;600&family=DM+Mono:wght@400;500&display=swap');

.app {
  --paper:#EEF1F7; --card:#FFFFFF; --ink:#1E2029; --muted:#7C808F;
  --line:#E4E8F0; --track:#EDF0F6;
  --display:'Bricolage Grotesque','Inter',system-ui,sans-serif;
  --body:'Inter',system-ui,-apple-system,sans-serif;
  --mono:'DM Mono',ui-monospace,monospace;
  background:var(--paper); color:var(--ink); font-family:var(--body);
  padding:22px; min-height:100%; -webkit-font-smoothing:antialiased;
}
.app *{box-sizing:border-box}
.app button{font-family:inherit;cursor:pointer}
.app h1,.app h2{margin:0;font-family:var(--display);letter-spacing:-.02em}
.app :focus-visible{outline:2px solid var(--ink);outline-offset:2px;border-radius:4px}

/* header */
.top{display:flex;justify-content:space-between;align-items:flex-start;gap:20px;margin-bottom:18px}
.eyebrow{font-size:11px;letter-spacing:.14em;text-transform:uppercase;color:var(--muted);font-weight:600}
.monthpick{display:flex;align-items:center;gap:6px;margin:4px 0 2px -6px}
.monthpick h1{font-size:38px;font-weight:800;line-height:1.05}
.monthpick .yr{font-weight:400;color:var(--muted)}
.nav{border:none;background:none;font-size:28px;line-height:1;color:var(--muted);padding:0 6px;border-radius:8px}
.nav:hover{color:var(--ink)}
.sub{font-size:13px;color:var(--muted)}
.save-saving{color:var(--muted)} .save-error{color:#C04A4A}

/* ring */
.ring{position:relative;text-align:center}
.ring svg{display:block}
.ring-arc{transition:stroke-dashoffset .45s cubic-bezier(.4,0,.2,1)}
.ring-mid{position:absolute;left:0;right:0;top:0;display:flex;align-items:center;justify-content:center;
  pointer-events:none}
.ring-val{font-family:var(--display);font-size:22px;font-weight:700}
.ring-pc{font-size:11px;color:var(--muted);margin-left:1px;align-self:flex-start;margin-top:6px}
.ring-label{font-size:11px;color:var(--muted);margin-top:6px;line-height:1.3}

/* cards */
.card,.ribbon-card{background:var(--card);border:1px solid var(--line);border-radius:16px;padding:16px 18px}
.card-head{display:flex;align-items:baseline;justify-content:space-between;gap:12px;margin-bottom:14px;flex-wrap:wrap}
.card-head h2{font-size:15px;font-weight:600}
.hint{font-size:11px;color:var(--muted)}

/* ribbon */
.ribbon{display:flex;gap:3px;align-items:flex-end;height:120px}
.bar-slot{flex:1;display:flex;flex-direction:column;align-items:center;gap:6px;height:100%}
.bar-track{flex:1;width:100%;background:var(--track);border-radius:5px;display:flex;align-items:flex-end;overflow:hidden}
.bar-fill{width:100%;border-radius:5px;transition:height .4s cubic-bezier(.4,0,.2,1)}
.bar-num{font-family:var(--mono);font-size:9px;color:var(--muted);height:11px}
.bar-slot.is-today .bar-track{box-shadow:0 0 0 2px var(--ink)}

/* stats */
.stats{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin:14px 0}
.stat{background:var(--card);border:1px solid var(--line);border-radius:14px;padding:14px}
.stat-val{display:block;font-family:var(--display);font-size:26px;font-weight:700;line-height:1}
.stat-key{display:block;font-size:11px;color:var(--muted);margin-top:5px}

/* split */
.split{display:grid;grid-template-columns:1.1fr 1fr;gap:12px;margin-bottom:12px}

/* weeks */
.weeks{display:flex;gap:14px;flex-wrap:wrap}
.week{display:flex;flex-direction:column;align-items:center;gap:7px;flex:1;min-width:74px}
.week-meta{text-align:center;line-height:1.3}
.week-meta strong{display:block;font-size:12px;font-weight:600}
.week-meta span{font-family:var(--mono);font-size:10px;color:var(--muted)}

/* ranks */
.ranks{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:11px}
.ranks li{display:grid;grid-template-columns:16px 1fr 76px 38px;align-items:center;gap:9px;font-size:13px}
.rank-n{font-family:var(--mono);font-size:11px;color:var(--muted)}
.rank-name{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.rank-bar{height:7px;background:var(--track);border-radius:99px;overflow:hidden}
.rank-bar span{display:block;height:100%;border-radius:99px;transition:width .4s ease}
.rank-pc{font-family:var(--mono);font-size:12px;text-align:right}
.ranks .empty{display:block;color:var(--muted);font-size:12px}

/* grid */
.head-actions{display:flex;gap:7px}
.chip{border:1px solid var(--line);background:var(--card);border-radius:99px;padding:6px 13px;font-size:12px;font-weight:500;color:var(--ink)}
.chip:hover{border-color:var(--muted)}
.chip.on{background:var(--ink);color:#fff;border-color:var(--ink)}
.chip.primary{background:var(--ink);color:#fff;border-color:var(--ink)}
.gridwrap{overflow-x:auto;padding-bottom:4px}
.grow{display:flex;align-items:center;min-width:max-content}
.grow+.grow{margin-top:4px}
.rowhead{position:sticky;left:0;z-index:2;flex:0 0 168px;width:168px;background:var(--card);
  display:flex;align-items:center;gap:8px;padding-right:12px}
.gridwrap.editing .rowhead{flex-basis:236px;width:236px}
.swatch{width:11px;height:26px;border:none;border-radius:99px;flex:0 0 11px;padding:0}
.labels{min-width:0;flex:1;display:flex;flex-direction:column;gap:1px}
.in-name,.in-time{border:none;background:none;padding:0;width:100%;font-family:inherit;color:var(--ink)}
.in-name{font-size:13px;font-weight:500}
.in-time{font-family:var(--mono);font-size:10px;color:var(--muted)}
.in-name:focus,.in-time:focus{outline:none;background:var(--track);border-radius:4px}
.rowctl{display:flex;gap:2px}
.rowctl button{border:1px solid var(--line);background:var(--card);border-radius:6px;width:22px;height:22px;
  font-size:11px;color:var(--muted);padding:0;line-height:1}
.rowctl .del:hover{color:#C04A4A;border-color:#C04A4A}
.cells{display:flex;gap:4px}
.cell{width:26px;height:26px;flex:0 0 26px;border:1px solid var(--line);background:var(--track);
  border-radius:7px;padding:0;transition:transform .12s ease,background .15s ease}
.cell:hover{transform:scale(1.14)}
.cell.on{border-style:solid}
.daynum,.foot-cell{width:26px;flex:0 0 26px;text-align:center;font-family:var(--mono);font-size:10px;color:var(--muted)}
.daynum.is-today{color:var(--ink);font-weight:500;text-decoration:underline}
.head{margin-bottom:6px}
.foot{margin-top:8px;border-top:1px solid var(--line);padding-top:8px}
.foot-key{font-size:10px;letter-spacing:.1em;text-transform:uppercase;color:var(--muted)}
.foot-cell{color:var(--ink)}
.empty-state{color:var(--muted);font-size:13px;margin:6px 0 0}
.foot-note{font-size:11px;color:var(--muted);text-align:center;margin-top:16px}

/* responsive */
@media (max-width:820px){
  .app{padding:14px}
  .split,.stats{grid-template-columns:repeat(2,1fr)}
  .monthpick h1{font-size:28px}
  .top{flex-direction:row;align-items:center}
  .ribbon{height:92px}
  .rowhead{flex-basis:130px;width:130px}
  .gridwrap.editing .rowhead{flex-basis:198px;width:198px}
  .cell,.daynum,.foot-cell{width:30px;flex-basis:30px}
  .cell{height:30px}
}
@media (prefers-reduced-motion:reduce){
  .app *{transition:none!important;animation:none!important}
}
`;
