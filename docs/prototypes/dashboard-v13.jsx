import { useState, useEffect, useRef, useCallback } from "react";

// ═══════════════════════════════════════════════════════════════
//  ANALYSIS SERVICE — swap for real API
// ═══════════════════════════════════════════════════════════════

const MOCK_SCENARIOS = [
  { delay: 2400, result: { ticker: "AAPL", direction: "long", priceTargetLow: 185, priceTargetHigh: 190, priceConfirmation: 172, stopLoss: 165, support: 168.5, resistance: 192, projectedDate: "Mar 20, 2026", postText: "$AAPL looking strong. PT $185-190. Confirmed above $172. Should hit by 3/20. SL $165.", confidence: 0.88, summary: "AAPL daily — ascending channel, entry $172, target $185–190", sourceType: "combined" }},
  { delay: 2800, result: { ticker: "MAGS", direction: "short", priceTargetLow: 48, priceTargetHigh: 49, priceConfirmation: 62, stopLoss: null, support: 48, resistance: 63.5, projectedDate: "Q2 2026", postText: "Magnificent 7 — MAGS showing Wyckoff Distribution. LPSY phase around $63. SOW confirmed. Gap fill target $48-49.", confidence: 0.84, summary: "MAGS weekly — Wyckoff distribution, LPSY $63, target $48–49", sourceType: "combined" }},
  { delay: 2100, result: { ticker: "SOXS", direction: "long", priceTargetLow: 55, priceTargetHigh: 65, priceConfirmation: 40, stopLoss: 34, support: 36, resistance: 42, projectedDate: "2026", postText: "SOXS will move much higher as semis let go. Downtrend breached. Target $55-65+.", confidence: 0.76, summary: "SOXS daily — trendline break, resistance $42, target $55–65", sourceType: "combined" }},
  { delay: 3000, result: { ticker: "TSLA", direction: "short", priceTargetLow: null, priceTargetHigh: 875, priceConfirmation: 920, stopLoss: null, support: 875, resistance: 920, projectedDate: null, postText: "👀", confidence: 0.72, summary: "TSLA daily — ascending channel, resistance $920, support $875", sourceType: "image" }},
];
let mockIdx = 0;

async function analyzeScreenshot(blob) {
  const s = MOCK_SCENARIOS[mockIdx % MOCK_SCENARIOS.length]; mockIdx++;
  return new Promise(r => setTimeout(() => r(s.result), s.delay));
}

function parseText(text) {
  if (!text.trim()) return null;
  var m1 = text.match(/\$([A-Z]{1,5})\b/);
  var m2 = text.match(/\b([A-Z]{2,5})\b(?=\s+(?:looking|target|PT|confirmed|bearish|bullish|calls|puts|showing|will|has|could))/i);
  var tk = (m1 && m1[1]) || (m2 && m2[1]) || null;
  var pt = text.match(/(?:PT|target|price target)[:\s]*\$?([\d,.]+)(?:\s*[-–]\s*\$?([\d,.]+))?/i);
  var cf = text.match(/(?:confirm(?:ed|ation)?|entry|break)\s+(?:above|below|at)\s+\$?([\d,.]+)/i);
  var sl = text.match(/(?:SL|stop\s*loss|stop)\s+(?:at\s+)?\$?([\d,.]+)/i);
  var dt = text.match(/(?:by|before|should hit|hit by|end of|Q[1-4])\s+([\w\s/,]+?)(?:\.|$)/i);
  var isShort = /bearish|puts|short|downside|distribution|SOW|LPSY/i.test(text);
  var isLong = /bullish|calls|long|upside|accumulation|rip/i.test(text);
  var p = {
    ticker: tk,
    direction: isShort ? "short" : isLong ? "long" : null,
    priceTargetLow: (pt && pt[1]) ? parseFloat(pt[1].replace(",","")) : null,
    priceTargetHigh: (pt && pt[2]) ? parseFloat(pt[2].replace(",","")) : ((pt && pt[1]) ? parseFloat(pt[1].replace(",","")) : null),
    priceConfirmation: (cf && cf[1]) ? parseFloat(cf[1].replace(",","")) : null,
    stopLoss: (sl && sl[1]) ? parseFloat(sl[1].replace(",","")) : null,
    projectedDate: (dt && dt[1]) ? dt[1].trim() : null,
    sourceType: "text",
    confidence: 0,
  };
  var n = 0;
  if (p.ticker) n++;
  if (p.direction) n++;
  if (p.priceTargetLow || p.priceTargetHigh) n++;
  if (p.priceConfirmation) n++;
  if (p.projectedDate) n++;
  if (p.stopLoss) n++;
  p.confidence = Math.min(0.95, n * 0.15 + 0.1);
  return p.ticker ? p : null;
}

function mergeResults(tr, ir) {
  const m = {}, s = {};
  const F = ["ticker","direction","priceTargetLow","priceTargetHigh","priceConfirmation","stopLoss","support","resistance","projectedDate"];
  F.forEach(function(f) { var tv = tr ? tr[f] : null; var iv = ir ? ir[f] : null; if(tv!=null&&tv!==""){m[f]=tv;s[f]=(iv!=null&&iv!=="")?"combined":"text";}else if(iv!=null&&iv!==""){m[f]=iv;s[f]="image";}else{m[f]=null;s[f]=null;} });
  var tc = (tr && tr.confidence) ? tr.confidence : 0;
  var ic = (ir && ir.confidence) ? ir.confidence : 0;
  m.confidence=Math.min(0.95,Math.max(tc,ic)+(tc>0&&ic>0?0.05:0));
  return {merged:m,sources:s};
}


// ═══════════════════════════════════════════════════════════════
//  MOCK DATA
// ═══════════════════════════════════════════════════════════════

const MOCK_DATA = {
  posts: [
    { id:"p1",ticker:"MAGS",content:"13. Magnificent 7 — MAGS showing Wyckoff Distribution Schematics. Currently in LPSY phase around $63. SOW in phase B confirmed. Gap fill target around $48-49. Significant downside projected once distribution completes.",postedAt:"2026-03-05T14:42:00Z",priceTarget:"$48–49",targetPercent:"-22%",projectedDate:"Q2 2026",confidence:0.84,confirmationPrice:62.0,direction:"short"},
    { id:"p2",ticker:"RUT",content:"14. Russell 2000 — As long as the trendline holds, it's safe. Otherwise, a breach changes the dynamics significantly. I cannot see it holding..majors have already breached or are near major breaches. Structure looks vulnerable..stay on guard.",postedAt:"2026-03-05T14:42:00Z",priceTarget:"$2,200",targetPercent:"-12%",projectedDate:"Q2 2026",confidence:0.72,confirmationPrice:2450.0,direction:"short"},
    { id:"p3",ticker:"SOX",content:"15. Semiconductor index — The semiconductor index (SOX) has topped. Ascending broadening pattern. Expect erratic behaviour/chop before it lets go...substantial downside exists once momentum picks up. Vigilance required. Target 3500.",postedAt:"2026-03-05T14:43:00Z",priceTarget:"3,500",targetPercent:"-30%",projectedDate:"2026",confidence:0.78,confirmationPrice:4800.0,direction:"short"},
    { id:"p4",ticker:"SOXS",content:"15. Semiconductor index — As the semis let go THE SOXS will OBVIOUSLY MOVE MUCH Higher. Downtrend has been breached... all that is needed is momentum to pick up.",postedAt:"2026-03-05T14:43:00Z",priceTarget:"$65+",targetPercent:"+70%",projectedDate:"2026",confidence:0.76,confirmationPrice:40.0,direction:"long"},
    { id:"p5",ticker:"MAGS",content:"Mag 7 update — distribution pattern still intact. Watching for break below $62 support to confirm next leg down. Patience.",postedAt:"2026-03-03T10:15:00Z",priceTarget:"$48–49",targetPercent:"-22%",projectedDate:"Q2 2026",confidence:0.79,confirmationPrice:62.0,direction:"short"},
    { id:"p6",ticker:"SOX",content:"Semis looking heavy. Broadening top pattern forming. Mentioned this yesterday — watching for momentum shift.",postedAt:"2026-03-04T09:30:00Z",priceTarget:"3,500",targetPercent:"-30%",projectedDate:"2026",confidence:0.71,confirmationPrice:4800.0,direction:"short"},
  ],
  tickers: [
    { symbol:"MAGS",currentPrice:62.85,confirmationPrice:62.0,confidence:0.84,status:"active",direction:"short" },
    { symbol:"RUT",currentPrice:2485.0,confirmationPrice:2450.0,confidence:0.72,status:"watching",direction:"short" },
    { symbol:"SOX",currentPrice:4920.0,confirmationPrice:4800.0,confidence:0.78,status:"watching",direction:"short" },
    { symbol:"SOXS",currentPrice:38.50,confirmationPrice:40.0,confidence:0.76,status:"watching",direction:"long" },
  ],
};

function formatTime(iso) { const d=new Date(iso),now=new Date(),h=Math.floor((now-d)/3600000); if(h<1)return"Just now"; if(h<24)return`${h}h ago`; return`${Math.floor(h/24)}d ago`; }
function getConfidenceColor(c) { if(c>=0.85)return"var(--semantic-positive)"; if(c>=0.7)return"var(--semantic-warning)"; return"var(--text-tertiary)"; }
function isConfirmed(cur,conf,dir) { return dir==="short"?cur<=conf:cur>=conf; }
function getProximityPct(cur,conf,dir) { if(dir==="short"){if(cur<=conf)return 0;return(cur-conf)/conf*100;} if(cur>=conf)return 0;return(conf-cur)/conf*100; }
function getProximityColor(cur,conf,dir) { if(isConfirmed(cur,conf,dir))return"var(--semantic-positive)"; const p=getProximityPct(cur,conf,dir); if(p<=2)return"#8ED4A8"; if(p<=5)return"var(--semantic-warning)"; return"var(--semantic-negative)"; }
function getProximityBg(cur,conf,dir) { if(isConfirmed(cur,conf,dir))return"var(--semantic-positive-muted)"; const p=getProximityPct(cur,conf,dir); if(p<=2)return"rgba(142,212,168,0.12)"; if(p<=5)return"var(--semantic-warning-muted)"; return"var(--semantic-negative-muted)"; }

const ALERT_TYPES = {
  confirmation:{label:"Price Confirmed",color:"var(--semantic-positive)",bg:"var(--semantic-positive-muted)",icon:"✓"},
  target:{label:"Target Reached",color:"var(--semantic-warning)",bg:"var(--semantic-warning-muted)",icon:"🎯"},
  stopLoss:{label:"Stop Loss Hit",color:"var(--semantic-negative)",bg:"var(--semantic-negative-muted)",icon:"⚠"},
  newPost:{label:"New Post",color:"var(--semantic-info)",bg:"var(--semantic-info-muted)",icon:"💬"},
};

const FlagIcon=({color="var(--accent-primary)",size=14})=>(<svg width={size} height={size} viewBox="0 0 24 24" fill={color} stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/><line x1="4" y1="22" x2="4" y2="15"/></svg>);
const SparkleIcon=({color="currentColor",size=14})=>(<svg width={size} height={size} viewBox="0 0 24 24" fill={color} stroke="none"><path d="M12 2L13.09 8.26L18 6L14.74 10.91L21 12L14.74 13.09L18 18L13.09 15.74L12 22L10.91 15.74L6 18L9.26 13.09L3 12L9.26 10.91L6 6L10.91 8.26L12 2Z"/></svg>);

// QP sub-components
function SourceIcon(props) {
  var source = props.source;
  if (!source) return null;
  var map = {
    text: { i: "📝", l: "From text" },
    image: { i: "📊", l: "From image" },
    combined: { i: "🔗", l: "Text + image" },
  };
  var s = map[source] || map.text;
  return <span title={s.l} style={{ fontSize: 12, cursor: "default", opacity: 0.7 }}>{s.i}</span>;
}

function ShimmerField() {
  return (
    <div style={{
      height: 36, borderRadius: 8,
      background: "linear-gradient(90deg, var(--bg-input) 25%, var(--bg-surface-hover) 50%, var(--bg-input) 75%)",
      backgroundSize: "200% 100%",
      animation: "shimmer 1.5s ease-in-out infinite",
    }} />
  );
}
function QPField(props) {
  var label = props.label;
  var value = props.value;
  var onChange = props.onChange;
  var mono = props.mono;
  var placeholder = props.placeholder || "—";
  var shimmer = props.shimmer;
  var displayValue = (value != null) ? value : "";

  return (
    <div style={{ flex: 1, minWidth: 0 }}>
      <div style={{ marginBottom: 4 }}>
        <span style={{ fontSize: 11, fontWeight: 500, textTransform: "uppercase", letterSpacing: "0.04em", color: "var(--text-tertiary)" }}>{label}</span>
      </div>
      {shimmer ? <ShimmerField /> : (
        <input
          type="text"
          value={displayValue}
          onChange={function(e) { onChange(e.target.value); }}
          placeholder={placeholder}
          style={{
            width: "100%", height: 36, padding: "0 10px",
            background: "var(--bg-input)",
            border: "1px solid var(--border-strong)",
            borderRadius: 8,
            fontFamily: mono ? "'DM Mono', monospace" : "'DM Sans', sans-serif",
            fontSize: 14, color: "var(--text-primary)", outline: "none",
            transition: "border-color 120ms ease",
          }}
          onFocus={function(e) { e.target.style.borderColor = "var(--border-focus)"; }}
          onBlur={function(e) { e.target.style.borderColor = "var(--border-strong)"; }}
        />
      )}
    </div>
  );
}


// ── Inline editable value for madlib ──
function InlineValue(props) {
  var value = props.value;
  var field = props.field;
  var editing = props.editing;
  var onStartEdit = props.onStartEdit;
  var onEndEdit = props.onEndEdit;
  var onChange = props.onChange;
  var mono = props.mono;
  var placeholder = props.placeholder || "___";
  var suffix = props.suffix || "";

  var hasValue = value != null && value !== "";
  var inputRef = useRef(null);

  useEffect(function() {
    if (editing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editing]);

  if (editing) {
    return (
      <input
        ref={inputRef}
        type="text"
        value={hasValue ? String(value) : ""}
        onChange={function(e) { onChange(e.target.value); }}
        onBlur={function() { onEndEdit(); }}
        onKeyDown={function(e) { if (e.key === "Enter") onEndEdit(); if (e.key === "Escape") onEndEdit(); }}
        style={{
          background: "var(--bg-input)",
          border: "1px solid var(--border-focus)",
          borderRadius: 4,
          padding: "2px 6px",
          fontFamily: mono ? "'DM Mono', monospace" : "'DM Sans', sans-serif",
          fontSize: 15,
          color: "var(--text-primary)",
          outline: "none",
          width: Math.max(40, (hasValue ? String(value).length : placeholder.length) * 9 + 20),
          lineHeight: "1.6",
        }}
      />
    );
  }

  return (
    <span
      className="ml-value"
      onClick={function() { onStartEdit(field); }}
      style={{
        fontFamily: mono ? "'DM Mono', monospace" : "inherit",
        color: hasValue ? "var(--text-primary)" : "var(--text-tertiary)",
        fontWeight: hasValue ? 500 : 400,
        cursor: "pointer",
      }}
    >
      {hasValue ? (mono && suffix !== "%" ? "$" + value : value) : placeholder}{suffix}
    </span>
  );
}


// ═══════════════════════════════════════════════════════════════
//  DASHBOARD
// ═══════════════════════════════════════════════════════════════

export default function Dashboard() {
  // ── Core dashboard state ──
  const [selected, setSelected] = useState("all");
  const [expandedPosts, setExpandedPosts] = useState({});
  const [watchlist, setWatchlist] = useState({ MAGS:"p5", SOX:"p6" });
  const [tickers, setTickers] = useState(MOCK_DATA.tickers);
  const [newTickerSymbol, setNewTickerSymbol] = useState(null);
  const [toasts, setToasts] = useState([]);
  const [windowWidth, setWindowWidth] = useState(typeof window !== "undefined" ? window.innerWidth : 1200);
  const [mobileShowDetail, setMobileShowDetail] = useState(false);
  const [reportOpen, setReportOpen] = useState({});
  const [feedbackText, setFeedbackText] = useState("");
  const [feedbackSubmitted, setFeedbackSubmitted] = useState({});
  const [tickerAlerts, setTickerAlerts] = useState({ MAGS:{type:"confirmation",message:"MAGS dropped below $62.00 — Coach's confirmation price reached! Distribution pattern confirmed.",active:true} });
  const [unreadAlerts, setUnreadAlerts] = useState({ MAGS: true });
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);

  // ── Quick Paste state ──
  const [qpOpen, setQpOpen] = useState(false);
  const [qpClosing, setQpClosing] = useState(false);
  const [qpText, setQpText] = useState("");
  const [qpScreenshot, setQpScreenshot] = useState(null);
  const [qpUrlDetected, setQpUrlDetected] = useState(false);
  const [qpTextParsed, setQpTextParsed] = useState(null);
  const [qpAnalyzing, setQpAnalyzing] = useState(false);
  const [qpOcrText, setQpOcrText] = useState(null);
  const [qpSaved, setQpSaved] = useState(null);
  const [qpFields, setQpFields] = useState({ ticker:"",direction:"long",priceTargetLow:"",priceTargetHigh:"",priceConfirmation:"",stopLoss:"",projectedDate:"",support:"",resistance:"",confidence:0 });
  const [qpSources, setQpSources] = useState({});
  const [qpDragging, setQpDragging] = useState(false);
  const [qpRevealStep, setQpRevealStep] = useState(0);
  const [qpShowText, setQpShowText] = useState(false);
  const [qpShowOcr, setQpShowOcr] = useState(false);
  const [qpEditingField, setQpEditingField] = useState(null); // which field is being inline-edited

  const qpTextRef = useRef(null);
  const qpFileRef = useRef(null);
  const tickerListRef = useRef(null);

  const isMobile = windowWidth < 768;

  useEffect(() => { const h=()=>setWindowWidth(window.innerWidth); window.addEventListener("resize",h); return()=>window.removeEventListener("resize",h); }, []);
  useEffect(function() {
    var t1 = setTimeout(function() { setToasts([{id:"t1",type:"confirmation",ticker:"MAGS",message:"MAGS dropped below $62.00 — Coach's confirmation price reached!",time:"Just now"}]); }, 2000);
    var t2 = setTimeout(function() { setToasts(function(p) { return p.concat([{id:"t2",type:"newPost",ticker:"SOX",message:"Coach posted a new update about SOX",time:"Just now"}]); }); }, 5000);
    return function() { clearTimeout(t1); clearTimeout(t2); };
  }, []);

  // Auto-dismiss toasts after 5 seconds
  var scheduledDismissals = useRef({});
  useEffect(function() {
    toasts.forEach(function(toast) {
      if (scheduledDismissals.current[toast.id]) return;
      scheduledDismissals.current[toast.id] = true;
      setTimeout(function() {
        setToasts(function(prev) { return prev.filter(function(t) { return t.id !== toast.id; }); });
        delete scheduledDismissals.current[toast.id];
      }, 5000);
    });
  }, [toasts]);

  // ── Dashboard functions ──
  const getAddState=(post)=>{const tid=watchlist[post.ticker];if(!tid)return"add";if(post.id===tid)return"added";const tp=MOCK_DATA.posts.find(p=>p.id===tid);if(tp&&new Date(post.postedAt)>new Date(tp.postedAt))return"update";return"added";};
  const addToWatchlist=(post)=>setWatchlist(p=>({...p,[post.ticker]:post.id}));
  const handleSelect=(val)=>{setSelected(val);if(isMobile)setMobileShowDetail(true);};
  const handleMobileBack=()=>setMobileShowDetail(false);
  const toggleExpand=(id)=>setExpandedPosts(p=>({...p,[id]:!p[id]}));
  const dismissToast=(id)=>setToasts(p=>p.filter(t=>t.id!==id));
  const dismissTickerAlert=(sym)=>{setTickerAlerts(p=>({...p,[sym]:{...p[sym],active:false}}));setUnreadAlerts(p=>({...p,[sym]:false}));};
  const reportPostId=Object.keys(reportOpen).find(k=>reportOpen[k]);
  const closeReport=()=>{setReportOpen({});setFeedbackText("");};
  const submitFeedback=(pid)=>{setFeedbackSubmitted(p=>({...p,[pid]:true}));closeReport();setTimeout(()=>setFeedbackSubmitted(p=>({...p,[pid]:false})),3000);};
  const confirmDelete=()=>{setDeleteConfirmOpen(false);if(isMobile)setMobileShowDetail(false);setSelected("all");};
  const filteredPosts=selected==="all"?MOCK_DATA.posts:MOCK_DATA.posts.filter(p=>p.ticker===selected);
  const latestPost = selected !== "all" ? filteredPosts[0] : null;
  const olderPosts = selected !== "all" ? filteredPosts.slice(1) : [];
  const selectedTicker=tickers.find(function(t){return t.symbol===selected;});
  const activeAlert = (selected !== "all" && tickerAlerts[selected] && tickerAlerts[selected].active) ? tickerAlerts[selected] : null;

  // ── Quick Paste functions ──
  const qpReset = useCallback(() => {
    setQpText(""); setQpScreenshot(null); setQpUrlDetected(false);
    setQpTextParsed(null); setQpAnalyzing(false); setQpOcrText(null);
    setQpFields({ticker:"",direction:"long",priceTargetLow:"",priceTargetHigh:"",priceConfirmation:"",stopLoss:"",projectedDate:"",support:"",resistance:"",confidence:0});
    setQpSources({}); setQpDragging(false); setQpRevealStep(0); setQpShowText(false); setQpShowOcr(false); setQpEditingField(null);
  }, []);

  const qpOpenPanel = useCallback(() => { setQpOpen(true); setQpClosing(false); qpReset(); }, [qpReset]);
  const qpClosePanel = useCallback(() => { setQpClosing(true); setTimeout(()=>{setQpOpen(false);setQpClosing(false);qpReset();},350); }, [qpReset]);

  const qpApplyMerged = useCallback((md, sd) => {
    setQpFields(p => ({
      ...p,
      ticker: String(md.ticker||p.ticker||""),
      direction: md.direction||p.direction||"long",
      priceTargetLow: md.priceTargetLow!=null?String(md.priceTargetLow):p.priceTargetLow,
      priceTargetHigh: md.priceTargetHigh!=null?String(md.priceTargetHigh):p.priceTargetHigh,
      priceConfirmation: md.priceConfirmation!=null?String(md.priceConfirmation):p.priceConfirmation,
      stopLoss: md.stopLoss!=null?String(md.stopLoss):p.stopLoss,
      support: md.support!=null?String(md.support):p.support,
      resistance: md.resistance!=null?String(md.resistance):p.resistance,
      projectedDate: md.projectedDate||p.projectedDate||"",
      confidence: md.confidence||p.confidence,
    }));
    setQpSources(function(p) { var n = Object.assign({}, p); Object.keys(sd).forEach(function(k) { if(sd[k]) n[k] = sd[k]; }); return n; });
  }, []);

  function readBlobAsDataURL(blob) {
    return new Promise(function(resolve) {
      var reader = new FileReader();
      reader.onloadend = function() { resolve(reader.result); };
      reader.readAsDataURL(blob);
    });
  }

  const qpProcessScreenshot = useCallback(async function(dataUrl) {
    setQpScreenshot({ dataUrl: dataUrl, status: "analyzing", result: null });
    setQpAnalyzing(true);
    try {
      var result = await analyzeScreenshot(null);
      setQpScreenshot(function(prev) { return prev ? Object.assign({}, prev, { status: "done", result: result }) : null; });
      if (result.postText && result.postText.length > 5) setQpOcrText(result.postText);
      var m = mergeResults(qpTextParsed, result);
      qpApplyMerged(m.merged, m.sources);
      setQpRevealStep(6);
    } catch (err) { setQpScreenshot(function(prev) { return prev ? Object.assign({}, prev, { status: "error" }) : null; }); }
    finally { setQpAnalyzing(false); }
  }, [qpTextParsed, qpApplyMerged]);

  // Clipboard paste listener — reads image to data URL before setting state
  useEffect(function() {
    if (!qpOpen) return;
    function handler(e) {
      var items = (e.clipboardData && e.clipboardData.items) ? Array.from(e.clipboardData.items) : [];
      var imgItem = items.find(function(i) { return i.type.startsWith("image/"); });
      if (imgItem) {
        e.preventDefault();
        var blob = imgItem.getAsFile();
        if (blob) {
          readBlobAsDataURL(blob).then(function(dataUrl) {
            qpProcessScreenshot(dataUrl);
          });
        }
      }
    }
    window.addEventListener("paste", handler);
    return function() { window.removeEventListener("paste", handler); };
  }, [qpOpen, qpProcessScreenshot]);

  // Text debounce parse
  useEffect(() => {
    if (!qpText.trim()) { setQpTextParsed(null); setQpUrlDetected(false); return; }
    if (/^https?:\/\//i.test(qpText.trim())) { setQpUrlDetected(true); setQpTextParsed(null); return; }
    setQpUrlDetected(false);
    const t = setTimeout(() => {
      const r = parseText(qpText);
      setQpTextParsed(r);
      if (r) { var sr = (qpScreenshot && qpScreenshot.result) || null; var merged2 = mergeResults(r, sr); qpApplyMerged(merged2.merged, merged2.sources); setQpRevealStep(6); }
    }, 500);
    return () => clearTimeout(t);
  }, [qpText]);

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e) => {
      if (e.metaKey && e.shiftKey && e.key === "v") { e.preventDefault(); qpOpenPanel(); }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [qpOpen, qpOpenPanel]);

  var qpSave = function(type) {
    var sym = qpFields.ticker;
    if (!sym) return;

    // Save ticker name for the toast (before reset clears qpFields)
    setQpSaved(sym);

    // Build ticker object from parsed fields
    var newTicker = {
      symbol: sym,
      currentPrice: parseFloat(qpFields.priceConfirmation) || 0,
      confirmationPrice: parseFloat(qpFields.priceConfirmation) || 0,
      confidence: qpFields.confidence || 0.7,
      status: "watching",
      direction: qpFields.direction || "long",
    };

    // Check if already in list
    var exists = false;
    for (var i = 0; i < tickers.length; i++) {
      if (tickers[i].symbol === sym) { exists = true; break; }
    }

    if (exists) {
      // Update existing
      setTickers(function(prev) {
        return prev.map(function(t) { return t.symbol === sym ? Object.assign({}, t, newTicker) : t; });
      });
    } else {
      // Phase 1: panel closes (350ms)
      // Phase 2: after 500ms pause, new card expands in
      // Phase 3: after card is settled, auto-select it
      setTimeout(function() {
        setTickers(function(prev) { return [newTicker].concat(prev); });
        setNewTickerSymbol(sym);

        // Scroll list to top
        if (tickerListRef.current) {
          tickerListRef.current.scrollTo({ top: 0, behavior: "smooth" });
        }

        // Auto-select after entrance is fully settled (~1s)
        setTimeout(function() { setSelected(sym); }, 1100);

        // Clear animation class after glow fades
        setTimeout(function() { setNewTickerSymbol(null); }, 3200);
      }, 550);
    }

    // Close panel
    qpClosePanel();
  };
  const qpRemoveScreenshot = () => { setQpScreenshot(null); setQpOcrText(null); setQpAnalyzing(false); if(qpTextParsed){const{merged,sources}=mergeResults(qpTextParsed,null);qpApplyMerged(merged,sources);} };
  var qpHandleFiles = useCallback(function(files) {
    var v = Array.from(files).filter(function(f) { return /^image\//i.test(f.type); });
    if (v.length && !qpScreenshot) {
      readBlobAsDataURL(v[0]).then(function(dataUrl) {
        qpProcessScreenshot(dataUrl);
      });
    }
  }, [qpScreenshot, qpProcessScreenshot]);

  useEffect(function() { if (qpOpen && !qpScreenshot && qpTextRef.current) { setTimeout(function() { if (qpTextRef.current) qpTextRef.current.focus(); }, 120); } }, [qpOpen, qpScreenshot]);

  const qpHasParsed = qpFields.ticker || qpTextParsed || (qpScreenshot && qpScreenshot.result);
  const qpConfPct = Math.round(qpFields.confidence * 100);

  // Stagger field reveals when data first appears
  useEffect(function() {
    // During analysis, rows are visible via the qpAnalyzing class check — no stagger needed
    if (qpAnalyzing) return;
    if (!qpHasParsed) return;
    // Already fully revealed
    if (qpRevealStep >= 6) return;
    var step = qpRevealStep;
    var interval = setInterval(function() {
      step++;
      setQpRevealStep(step);
      if (step >= 6) clearInterval(interval);
    }, 80);
    return function() { clearInterval(interval); };
  }, [qpAnalyzing, qpHasParsed]);

  // Auto-dismiss QP save toast after 5 seconds
  useEffect(function() {
    if (!qpSaved) return;
    var timer = setTimeout(function() { setQpSaved(null); }, 5000);
    return function() { clearTimeout(timer); };
  }, [qpSaved]);

  // ═══════════════════════════════════════════════════════════════
  //  RENDER
  // ═══════════════════════════════════════════════════════════════

  return (
    <div style={{ display:"flex", height:"100vh", background:"var(--bg-base)", color:"var(--text-primary)", fontFamily:"'DM Sans',sans-serif", position:"relative" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Mono:wght@400&family=DM+Sans:wght@400;500;600&display=swap');
        :root{--bg-base:#111113;--bg-surface:#18181B;--bg-surface-hover:#1F1F23;--bg-elevated:#26262B;--bg-overlay:rgba(0,0,0,0.6);--bg-input:#18181B;--text-primary:#ECECEF;--text-secondary:#A0A0AB;--text-tertiary:#63636E;--text-inverse:#111113;--border-default:rgba(255,255,255,0.08);--border-subtle:rgba(255,255,255,0.04);--border-strong:rgba(255,255,255,0.15);--border-focus:#7C7CFF;--accent-primary:#7C7CFF;--accent-primary-hover:#9B9BFF;--accent-muted:rgba(124,124,255,0.12);--semantic-positive:#3FCF8E;--semantic-negative:#F06E6E;--semantic-warning:#F0B85F;--semantic-info:#6EB0F0;--semantic-positive-muted:rgba(63,207,142,0.12);--semantic-negative-muted:rgba(240,110,110,0.12);--semantic-warning-muted:rgba(240,184,95,0.12);--semantic-info-muted:rgba(110,176,240,0.12);--shadow-sm:0 1px 2px rgba(0,0,0,0.3);--shadow-md:0 4px 12px rgba(0,0,0,0.4);--shadow-lg:0 8px 24px rgba(0,0,0,0.5);--radius-sm:6px;--radius-md:8px;--radius-lg:12px;--duration-fast:120ms;--duration-normal:200ms;--duration-slow:350ms;--ease-default:cubic-bezier(0.25,0.1,0.25,1);--ease-out:cubic-bezier(0,0,0.2,1);}
        *{box-sizing:border-box;margin:0;padding:0;}
        @keyframes shimmer{0%{background-position:200% 0}100%{background-position:-200% 0}}
        @keyframes pulse{0%,100%{opacity:1}50%{opacity:.5}}
        @keyframes fadeInUp{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}
        .left-card{display:flex;align-items:stretch;border-radius:var(--radius-md);border:1px solid var(--border-default);background:var(--bg-surface);cursor:pointer;user-select:none;transition:background 120ms ease,border-color 120ms ease,box-shadow 300ms ease;overflow:hidden;margin-bottom:8px;}
        .left-card:hover{background:var(--bg-surface-hover);}
        .left-card.selected{border-color:var(--accent-primary);background:var(--accent-muted);}

        /* New ticker entrance — space opens, content reveals, gentle glow */
        .ticker-new{
          animation:tickerExpand 700ms cubic-bezier(0.4,0,0.2,1) both, tickerReveal 500ms cubic-bezier(0.4,0,0.2,1) 350ms both, tickerGlow 2.2s ease 800ms both;
          transform-origin:top center;
        }
        @keyframes tickerExpand{
          0%{max-height:0;margin-bottom:0;padding:0;border-color:transparent;overflow:hidden;}
          60%{max-height:80px;overflow:hidden;}
          100%{max-height:80px;margin-bottom:8px;overflow:visible;}
        }
        @keyframes tickerReveal{
          0%{opacity:0;transform:scale(0.98) translateY(-2px);}
          100%{opacity:1;transform:scale(1) translateY(0);}
        }
        @keyframes tickerGlow{
          0%{box-shadow:0 0 0 0 rgba(124,124,255,0.18);}
          25%{box-shadow:0 0 0 3px rgba(124,124,255,0.1);}
          100%{box-shadow:none;}
        }
        .card-flag{width:28px;min-width:28px;display:flex;align-items:center;justify-content:center;flex-shrink:0;border-right:1px solid var(--border-subtle);transition:background var(--duration-fast) var(--ease-default);}
        .post-card{background:var(--bg-surface);border:1px solid var(--border-default);border-radius:var(--radius-md);overflow:hidden;transition:border-color var(--duration-fast) var(--ease-default);}
        .post-card:hover{border-color:var(--border-strong);}
        .action-btn{width:32px;height:32px;border-radius:var(--radius-sm);border:1px solid var(--border-default);background:var(--bg-elevated);color:var(--text-secondary);cursor:pointer;display:flex;align-items:center;justify-content:center;font-size:16px;transition:all var(--duration-fast) var(--ease-default);}
        .action-btn:hover{background:var(--bg-surface-hover);color:var(--text-primary);border-color:var(--border-strong);}
        .show-btn{display:inline-flex;align-items:center;gap:6px;padding:4px 10px;border-radius:var(--radius-sm);border:none;background:transparent;color:var(--text-tertiary);font-family:'DM Sans',sans-serif;font-size:12px;font-weight:500;cursor:pointer;transition:color var(--duration-fast) var(--ease-default);}
        .show-btn:hover{color:var(--text-secondary);}
        .sparkle-btn{display:inline-flex;align-items:center;gap:4px;background:none;border:none;padding:2px;cursor:pointer;border-radius:var(--radius-sm);transition:all var(--duration-fast) var(--ease-default);opacity:0.6;}
        .sparkle-btn:hover{opacity:1;background:var(--accent-muted);}
        .meta-row{display:flex;}.meta-item{flex:1;padding:0 16px;border-right:1px solid var(--border-default);}.meta-item:last-child{border-right:none;}
        .meta-label{font-size:11px;font-weight:500;letter-spacing:0.04em;text-transform:uppercase;color:var(--text-tertiary);margin-bottom:2px;}
        .meta-value{font-family:'DM Mono',monospace;font-size:14px;color:var(--text-primary);}
        .expand-text{padding:12px 20px 16px;font-size:13px;line-height:1.6;color:var(--text-secondary);background:var(--bg-base);border-top:1px solid var(--border-subtle);}
        .chart-placeholder{width:100%;height:180px;background:var(--bg-elevated);display:flex;align-items:center;justify-content:center;color:var(--text-tertiary);font-size:13px;border-bottom:1px solid var(--border-subtle);}
        .inline-alert{display:flex;align-items:center;gap:12px;padding:12px 16px;border-radius:var(--radius-md);border:1px solid;animation:fadeInUp var(--duration-normal) var(--ease-default);}

        /* Action panel (shared: Report, Delete, Quick Paste) */
        .ap-overlay{position:fixed;inset:0;z-index:900;background:var(--bg-overlay);animation:apFI var(--duration-normal) var(--ease-default);}
        .ap-overlay.closing{animation:apFO var(--duration-slow) var(--ease-default) forwards;}
        @keyframes apFI{from{opacity:0}to{opacity:1}} @keyframes apFO{from{opacity:1}to{opacity:0}}
        .ap-desktop{position:fixed;top:0;right:0;bottom:0;width:400px;max-width:90vw;z-index:901;background:var(--bg-surface);border-left:1px solid var(--border-default);box-shadow:var(--shadow-lg);display:flex;flex-direction:column;animation:apSIR var(--duration-slow) var(--ease-out);}
        .ap-desktop.closing{animation:apSOR var(--duration-slow) var(--ease-default) forwards;}
        .ap-desktop.wide{width:460px;}
        @keyframes apSIR{from{transform:translateX(100%)}to{transform:translateX(0)}} @keyframes apSOR{from{transform:translateX(0)}to{transform:translateX(100%)}}
        .ap-mobile{position:fixed;left:0;right:0;bottom:0;z-index:901;background:var(--bg-surface);border-top:1px solid var(--border-default);border-radius:var(--radius-lg) var(--radius-lg) 0 0;box-shadow:0 -8px 30px rgba(0,0,0,0.5);display:flex;flex-direction:column;max-height:85vh;animation:apSU var(--duration-slow) var(--ease-out);}
        .ap-mobile.closing{animation:apSD var(--duration-slow) var(--ease-default) forwards;}
        @keyframes apSU{from{transform:translateY(100%)}to{transform:translateY(0)}} @keyframes apSD{from{transform:translateY(0)}to{transform:translateY(100%)}}
        .ap-handle{width:32px;height:4px;border-radius:2px;background:var(--border-strong);margin:8px auto 0;flex-shrink:0;}
        .ap-header{display:flex;align-items:center;justify-content:space-between;padding:16px 20px 12px;border-bottom:1px solid var(--border-default);flex-shrink:0;}
        .ap-body{flex:1;overflow-y:auto;padding:20px;}
        .ap-body::-webkit-scrollbar{width:4px;} .ap-body::-webkit-scrollbar-track{background:transparent;} .ap-body::-webkit-scrollbar-thumb{background:rgba(255,255,255,0.1);border-radius:4px;}
        .ap-footer{padding:12px 20px 16px;border-top:1px solid var(--border-default);flex-shrink:0;}
        .ap-close{background:none;border:none;color:var(--text-tertiary);cursor:pointer;font-size:18px;padding:4px;transition:color 120ms;}
        .ap-close:hover{color:var(--text-primary);}

        /* Quick Paste specific */
        .qp-dropzone{border:1.5px dashed var(--border-strong);border-radius:var(--radius-md);padding:20px;text-align:center;cursor:pointer;transition:all 120ms ease;}
        .qp-dropzone.active,.qp-dropzone:hover{border-color:var(--accent-primary);background:rgba(124,124,255,0.05);}
        .qp-dropzone.active{background:var(--accent-muted);}

        .qp-ss{position:relative;width:100%;border-radius:var(--radius-md);overflow:hidden;border:1px solid var(--border-default);background:var(--bg-base);}
        .qp-ss-rm{position:absolute;top:8px;right:8px;width:26px;height:26px;border-radius:50%;background:rgba(0,0,0,0.7);border:1px solid rgba(255,255,255,0.15);color:var(--text-secondary);cursor:pointer;display:flex;align-items:center;justify-content:center;font-size:13px;transition:all 120ms;z-index:2;}
        .qp-ss-rm:hover{background:var(--semantic-negative);color:#fff;border-color:transparent;}

        /* Analyzing overlay — frosted glass over dimmed image */
        .qp-ss-analyzing{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:10px;background:rgba(17,17,19,0.6);backdrop-filter:blur(4px);-webkit-backdrop-filter:blur(4px);z-index:1;}
        .qp-ss-analyzing .qp-progress-track{width:140px;height:3px;border-radius:2px;background:rgba(255,255,255,0.08);overflow:hidden;}
        .qp-ss-analyzing .qp-progress-fill{height:100%;border-radius:2px;background:var(--accent-primary);animation:qpProgress 2.4s ease-in-out infinite;}
        @keyframes qpProgress{0%{width:0%;opacity:0.6}50%{width:80%;opacity:1}100%{width:100%;opacity:0.3}}

        /* Done badge — bottom gradient bar */
        .qp-ss-done{position:absolute;bottom:0;left:0;right:0;padding:10px 14px;background:linear-gradient(transparent,rgba(17,17,19,0.92));display:flex;align-items:center;gap:8px;animation:fadeInUp 350ms ease;}

        /* OCR text reveal */
        .qp-ocr-wrap{overflow:hidden;animation:qpOcrReveal 400ms ease both;}
        @keyframes qpOcrReveal{from{max-height:0;opacity:0;margin-top:0}to{max-height:200px;opacity:1;margin-top:10px}}
        .qp-ocr{background:var(--bg-base);border:1px solid var(--border-subtle);border-radius:var(--radius-md);padding:10px 12px;font-size:13px;color:var(--text-secondary);line-height:1.6;font-family:'DM Mono',monospace;max-height:72px;overflow-y:auto;}
        .qp-ocr::-webkit-scrollbar{width:3px;} .qp-ocr::-webkit-scrollbar-thumb{background:rgba(255,255,255,0.1);border-radius:2px;}

        /* Staggered field reveal */
        .qp-field-row{opacity:0;transform:translateY(6px);transition:opacity 280ms ease,transform 280ms ease;}
        .qp-field-row.revealed{opacity:1;transform:translateY(0);}

        /* Text toggle button */
        .qp-text-toggle{display:inline-flex;align-items:center;gap:6px;padding:6px 0;background:none;border:none;color:var(--text-tertiary);font-family:'DM Sans',sans-serif;font-size:12px;font-weight:500;cursor:pointer;transition:color 120ms;}
        .qp-text-toggle:hover{color:var(--text-secondary);}
        .qp-text-toggle svg{transition:transform 200ms ease;transform:rotate(-90deg);}
        .qp-text-toggle.open svg{transform:rotate(0deg);}
        .qp-text-collapse{overflow:hidden;transition:max-height 250ms ease,opacity 200ms ease;max-height:0;opacity:0;}
        .qp-text-collapse.open{max-height:200px;opacity:1;}

        /* Madlib sentence */
        .ml-sentence{font-size:15px;line-height:2;color:var(--text-secondary);}
        .ml-value{display:inline;border-bottom:1px dashed var(--border-strong);padding:1px 2px;border-radius:2px;transition:all 150ms ease;}
        .ml-value:hover{background:var(--accent-muted);border-bottom-color:var(--accent-primary);color:var(--text-primary);}
        .ml-direction{display:inline;font-weight:500;cursor:pointer;padding:1px 2px;border-radius:2px;border-bottom:1px dashed var(--border-strong);transition:all 150ms ease;}
        .ml-direction:hover{background:var(--accent-muted);border-bottom-color:var(--accent-primary);}
        .ml-shimmer{display:inline-block;width:48px;height:16px;border-radius:3px;vertical-align:middle;background:linear-gradient(90deg, var(--bg-elevated) 25%, var(--bg-surface-hover) 50%, var(--bg-elevated) 75%);background-size:200% 100%;animation:shimmer 1.5s ease-in-out infinite;}
        .ml-edit-hint{font-size:11px;color:var(--text-tertiary);margin-top:8px;opacity:0;transition:opacity 200ms;}
        .dir-toggle{display:flex;border-radius:8px;border:1px solid var(--border-strong);overflow:hidden;}
        .dir-toggle button{flex:1;padding:7px 0;border:none;font-family:'DM Sans',sans-serif;font-size:13px;font-weight:500;cursor:pointer;transition:all 120ms;background:transparent;color:var(--text-tertiary);}
        .dir-toggle button.on-l{background:var(--semantic-positive-muted);color:var(--semantic-positive);}
        .dir-toggle button.on-s{background:var(--semantic-negative-muted);color:var(--semantic-negative);}
        .qp-save{padding:9px 16px;border-radius:8px;font-family:'DM Sans',sans-serif;font-size:13px;font-weight:500;cursor:pointer;transition:all 120ms;white-space:nowrap;}
        .qp-save:disabled{opacity:.35;cursor:default;}
        .qp-kbd{display:inline-block;padding:1px 5px;border-radius:3px;background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.1);font-family:'DM Mono',monospace;font-size:10px;color:var(--text-tertiary);margin-left:6px;vertical-align:middle;}
        .qp-conf{height:4px;border-radius:2px;background:var(--bg-elevated);overflow:hidden;flex:1;}

        /* Toasts */
        .toast-container{position:fixed;top:16px;right:16px;display:flex;flex-direction:column;gap:8px;z-index:1000;pointer-events:none;}
        .toast{pointer-events:auto;display:flex;align-items:flex-start;gap:12px;padding:14px 16px;background:var(--bg-elevated);border:1px solid var(--border-default);border-radius:var(--radius-md);box-shadow:var(--shadow-lg);min-width:340px;max-width:400px;animation:toastIn var(--duration-slow) var(--ease-default);}
        @keyframes toastIn{from{transform:translateX(100%);opacity:0}to{transform:translateX(0);opacity:1}}
        .flag-alert{animation:flagPulse 2s ease-in-out infinite;} @keyframes flagPulse{0%,100%{opacity:1}50%{opacity:0.4}}
        .scrollbar-hide::-webkit-scrollbar{width:4px;} .scrollbar-hide::-webkit-scrollbar-track{background:transparent;} .scrollbar-hide::-webkit-scrollbar-thumb{background:rgba(255,255,255,0.1);border-radius:4px;}
        .mobile-detail-enter{animation:mobileSlideIn var(--duration-slow) var(--ease-default);} @keyframes mobileSlideIn{from{transform:translateX(100%)}to{transform:translateX(0)}}
        .back-btn{display:inline-flex;align-items:center;gap:4px;background:none;border:none;padding:4px 0;color:var(--accent-primary);cursor:pointer;font-family:'DM Sans',sans-serif;font-size:13px;font-weight:500;transition:color var(--duration-fast) var(--ease-default);} .back-btn:hover{color:var(--accent-primary-hover);}
        @media(max-width:767px){.meta-row{flex-direction:column!important;gap:8px;}.meta-item{border-right:none!important;padding:0!important;border-bottom:1px solid var(--border-subtle);padding-bottom:8px!important;}.meta-item:last-child{border-bottom:none;padding-bottom:0!important;}.chart-placeholder{height:150px!important;}.toast-container{left:16px!important;right:16px!important;top:auto!important;bottom:16px!important;flex-direction:column-reverse!important;}.toast{min-width:unset!important;max-width:unset!important;}}
      `}</style>

      {/* ══════════ LEFT PANEL ══════════ */}
      {(!isMobile || !mobileShowDetail) && (
      <div style={{ width:isMobile?"100%":290, minWidth:isMobile?"100%":290, borderRight:isMobile?"none":"1px solid var(--border-default)", display:"flex", flexDirection:"column" }}>
        {/* Logo header */}
        <div style={{ padding:"16px 16px 12px", borderBottom:"1px solid var(--border-default)", display:"flex", alignItems:"center", justifyContent:"space-between" }}>
          <div style={{ display:"flex", alignItems:"center", gap:10 }}>
            <div style={{ width:28,height:28,borderRadius:7,background:"#7C7CFF",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,overflow:"hidden" }}>
              <svg width="22" height="22" viewBox="0 0 22 22" fill="none"><circle cx="4" cy="18" r="6" stroke="rgba(255,255,255,0.15)" strokeWidth="1.5" fill="none"/><circle cx="4" cy="18" r="11" stroke="rgba(255,255,255,0.12)" strokeWidth="1.5" fill="none"/><circle cx="4" cy="18" r="16" stroke="rgba(255,255,255,0.09)" strokeWidth="1.5" fill="none"/><line x1="4" y1="18" x2="18" y2="4" stroke="rgba(255,255,255,0.9)" strokeWidth="1.5" strokeLinecap="round"/><circle cx="13" cy="9" r="2" fill="#fff" opacity="0.9"/></svg>
            </div>
            <span style={{ fontSize:15,fontWeight:600,letterSpacing:"-0.02em" }}>Coachtrack</span>
          </div>
          <a href="https://x.com/great_martis/superfollows" target="_blank" rel="noopener noreferrer" style={{ display:"flex",alignItems:"center",justifyContent:"center",width:28,height:28,borderRadius:6,color:"#3A3A42",transition:"color 120ms ease, background 120ms ease",textDecoration:"none" }} onMouseEnter={e=>{e.currentTarget.style.color="#63636E";e.currentTarget.style.background="rgba(255,255,255,0.04)";}} onMouseLeave={e=>{e.currentTarget.style.color="#3A3A42";e.currentTarget.style.background="transparent";}} title="Open Coach's X feed">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>
          </a>
        </div>

        {/* Ticker list */}
        <div ref={tickerListRef} className="scrollbar-hide" style={{ flex:1,overflowY:"auto",padding:12,display:"flex",flexDirection:"column" }}>
          {/* All Posts */}
          <div className={`left-card ${selected==="all"?"selected":""}`} onClick={()=>handleSelect("all")} style={{display:"block"}}>
            <div style={{padding:"12px 14px"}}>
              <div style={{fontSize:14,fontWeight:500,color:selected==="all"?"var(--accent-primary)":"var(--text-primary)"}}>All Posts</div>
              <div style={{fontSize:12,color:"var(--text-tertiary)",marginTop:2}}>{MOCK_DATA.posts.length} posts from Coach</div>
            </div>
          </div>
          <div style={{fontSize:11,fontWeight:500,textTransform:"uppercase",letterSpacing:"0.06em",color:"var(--text-tertiary)",padding:"12px 4px 4px"}}>Watchlist</div>
          {tickers.map(function(t) {
            var conf=isConfirmed(t.currentPrice,t.confirmationPrice,t.direction);
            var pp=getProximityPct(t.currentPrice,t.confirmationPrice,t.direction);
            var pc=getProximityColor(t.currentPrice,t.confirmationPrice,t.direction);
            var pb=getProximityBg(t.currentPrice,t.confirmationPrice,t.direction);
            var hasU=unreadAlerts[t.symbol];
            var isSel=selected===t.symbol;
            var isNew=t.symbol===newTickerSymbol;
            var cardClass = "left-card" + (isSel ? " selected" : "") + (isNew ? " ticker-new" : "");
            return (
              <div key={t.symbol} className={cardClass} onClick={function(){handleSelect(t.symbol);}} style={hasU?{}:{display:"block"}}>
                {hasU && <div className="card-flag flag-alert" style={{background:"var(--semantic-positive-muted)"}}><FlagIcon color="var(--semantic-positive)" size={13}/></div>}
                <div style={hasU?{flex:1,padding:"12px 14px",minWidth:0}:{padding:"12px 14px"}}>
                  <div style={{display:"flex",alignItems:"center",justifyContent:"space-between"}}>
                    <span style={{fontSize:16,fontWeight:600,color:isSel?"var(--accent-primary)":"var(--text-primary)",letterSpacing:"0.02em"}}>{t.symbol}</span>
                    {conf?<span style={{fontSize:11,fontWeight:500,padding:"2px 8px",borderRadius:"var(--radius-sm)",background:"var(--semantic-positive-muted)",color:"var(--semantic-positive)"}}>Confirmed ✓</span>
                    :<span style={{fontFamily:"'DM Mono',monospace",fontSize:11,padding:"2px 7px",borderRadius:"var(--radius-sm)",background:pb,color:pc}}>{pp.toFixed(1)}% away</span>}
                  </div>
                  <div style={{display:"flex",alignItems:"baseline",justifyContent:"space-between",marginTop:6}}>
                    <span style={{fontFamily:"'DM Mono',monospace",fontSize:14,color:"var(--text-primary)"}}>${t.currentPrice.toFixed(2)}</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* ── QUICK PASTE BUTTON ── */}
        <div style={{ padding:12, borderTop:"1px solid var(--border-default)" }}>
          <button onClick={qpOpenPanel} style={{
            width:"100%",padding:"10px 0",borderRadius:"var(--radius-md)",border:"none",
            background:"var(--accent-primary)",color:"var(--text-inverse)",
            fontFamily:"'DM Sans',sans-serif",fontSize:13,fontWeight:500,cursor:"pointer",
            letterSpacing:"0.01em",transition:"background var(--duration-fast) var(--ease-default)",
          }} onMouseEnter={e=>e.target.style.background="var(--accent-primary-hover)"} onMouseLeave={e=>e.target.style.background="var(--accent-primary)"}>+ Quick Paste</button>
        </div>
      </div>
      )}

      {/* ══════════ RIGHT PANEL ══════════ */}
      {(!isMobile || mobileShowDetail) && (
      <div className={isMobile?"mobile-detail-enter":""} style={{flex:1,display:"flex",flexDirection:"column",minWidth:0}}>
        {/* Header */}
        <div style={{ padding:isMobile?"16px 20px 12px":"20px 32px 16px", borderBottom:"1px solid var(--border-default)", display:"flex",alignItems:"flex-start",justifyContent:"space-between" }}>
          <div>
            {isMobile && <button className="back-btn" onClick={handleMobileBack} style={{marginBottom:8}}><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>Back</button>}
            <div style={{fontSize:isMobile?18:20,fontWeight:500,letterSpacing:"-0.02em",display:"flex",alignItems:"center",gap:10,flexWrap:"wrap"}}>
              {selected==="all"?"All Posts":selected}
              {selected!=="all"&&selectedTicker&&<span style={{fontFamily:"'DM Mono',monospace",fontSize:14,fontWeight:400,color:"var(--text-secondary)"}}>${selectedTicker.currentPrice.toFixed(2)}</span>}
              {selected !== "all" && selectedTicker && (
                isConfirmed(selectedTicker.currentPrice, selectedTicker.confirmationPrice, selectedTicker.direction)
                  ? <span style={{fontSize:12,fontWeight:500,padding:"2px 8px",borderRadius:"var(--radius-sm)",background:"var(--semantic-positive-muted)",color:"var(--semantic-positive)"}}>Confirmed ✓</span>
                  : <span style={{fontSize:12,fontWeight:500,padding:"2px 8px",borderRadius:"var(--radius-sm)",background:getProximityBg(selectedTicker.currentPrice,selectedTicker.confirmationPrice,selectedTicker.direction),color:getProximityColor(selectedTicker.currentPrice,selectedTicker.confirmationPrice,selectedTicker.direction)}}>{getProximityPct(selectedTicker.currentPrice,selectedTicker.confirmationPrice,selectedTicker.direction).toFixed(1)}% away</span>
              )}
            </div>
            <div style={{fontSize:12,color:"var(--text-tertiary)",marginTop:4}}>{filteredPosts.length} post{filteredPosts.length!==1?"s":""}{selected!=="all"&&selectedTicker&&` · ${selectedTicker.status==="active"?"Active trade":"Watching"}`}</div>
          </div>
          {selected!=="all"&&<button className="action-btn" title="Remove from watchlist" onClick={()=>setDeleteConfirmOpen(true)} style={{marginTop:2}}><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg></button>}
        </div>

        {/* Scrollable content */}
        <div className="scrollbar-hide" style={{ flex:1,overflowY:"auto",padding:isMobile?16:32,display:"flex",flexDirection:"column",gap:24 }}>
          {activeAlert && (
            <div className="inline-alert" style={{borderColor:ALERT_TYPES[activeAlert.type].color,background:ALERT_TYPES[activeAlert.type].bg}}>
              <div style={{width:28,height:28,borderRadius:"var(--radius-sm)",background:"rgba(0,0,0,0.15)",color:ALERT_TYPES[activeAlert.type].color,display:"flex",alignItems:"center",justifyContent:"center",fontSize:14,fontWeight:600,flexShrink:0}}>{ALERT_TYPES[activeAlert.type].icon}</div>
              <div style={{flex:1,minWidth:0}}>
                <div style={{fontSize:11,fontWeight:500,textTransform:"uppercase",letterSpacing:"0.04em",color:ALERT_TYPES[activeAlert.type].color,marginBottom:2}}>{ALERT_TYPES[activeAlert.type].label}</div>
                <div style={{fontSize:13,color:"var(--text-primary)",lineHeight:1.4}}>{activeAlert.message}</div>
              </div>
              <button onClick={()=>dismissTickerAlert(selected)} style={{padding:"5px 12px",borderRadius:"var(--radius-sm)",border:"1px solid rgba(255,255,255,0.15)",background:"rgba(0,0,0,0.15)",color:"var(--text-primary)",fontFamily:"'DM Sans',sans-serif",fontSize:12,fontWeight:500,cursor:"pointer",flexShrink:0}}>Dismiss</button>
            </div>
          )}

          {selected==="all" ? (
            filteredPosts.map(post => {
              const addS=getAddState(post); const snip=post.content.substring(0,80)+"...";
              return (
                <div key={post.id} className="post-card" style={{padding:16}}>
                  <div style={{fontSize:16,fontWeight:600,marginBottom:4}}>{post.ticker}</div>
                  <div style={{fontSize:12,color:"var(--text-tertiary)",marginBottom:8}}>{formatTime(post.postedAt)}</div>
                  <div style={{fontSize:13,color:"var(--text-secondary)",marginBottom:12,lineHeight:1.5}}>{snip}</div>
                  <div>
                    {addS==="add"&&<button onClick={()=>addToWatchlist(post)} style={{padding:"6px 12px",borderRadius:6,border:"1px solid var(--border-strong)",background:"transparent",color:"var(--text-primary)",fontSize:12,cursor:"pointer"}}>+ Add to Watchlist</button>}
                    {addS==="update"&&<button onClick={()=>addToWatchlist(post)} style={{padding:"6px 12px",borderRadius:6,border:"1px solid var(--accent-primary)",background:"var(--accent-muted)",color:"var(--accent-primary)",fontSize:12,cursor:"pointer"}}>Update Watchlist</button>}
                    {addS==="added"&&<span style={{padding:"6px 12px",borderRadius:6,background:"var(--semantic-positive-muted)",color:"var(--semantic-positive)",fontSize:12}}>✓ Added</span>}
                  </div>
                </div>
              );
            })
          ) : (
            filteredPosts.length > 0 && (<>
                <div>
                  <div className="post-card">
                    <div className="chart-placeholder"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 15l4-4 3 3 4-4 7 7"/></svg><span style={{marginLeft:8}}>Technical chart from X post</span></div>
                    <div style={{padding:isMobile?"12px 16px 0":"16px 20px 0"}}>
                      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:12,flexWrap:"wrap",gap:8}}>
                        <div style={{display:"flex",alignItems:"center",gap:10}}>
                          <span style={{fontSize:11,fontWeight:500,textTransform:"uppercase",letterSpacing:"0.04em",color:"var(--accent-primary)"}}>Latest</span>
                          <span style={{fontSize:12,color:"var(--text-tertiary)"}}>{formatTime(latestPost.postedAt)}</span>
                        </div>
                        <div style={{display:"flex",alignItems:"center",gap:6}}>
                          <button className="show-btn" onClick={()=>toggleExpand(latestPost.id)}><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg>{expandedPosts[latestPost.id]?"Hide":"Show"}</button>
                          <div style={{width:1,height:16,background:"var(--border-default)",margin:"0 4px"}}/>
                          <button style={{display:"inline-flex",alignItems:"center",gap:5,padding:"5px 10px",borderRadius:"var(--radius-sm)",border:"1px solid var(--border-strong)",background:"transparent",color:"var(--text-secondary)",fontFamily:"'DM Sans',sans-serif",fontSize:12,fontWeight:500,cursor:"pointer",transition:"all 120ms"}} onMouseEnter={e=>{e.target.style.color="var(--text-primary)";e.target.style.borderColor="var(--accent-primary)";}} onMouseLeave={e=>{e.target.style.color="var(--text-secondary)";e.target.style.borderColor="var(--border-strong)";}} title="Paste a new Coach post for this ticker" onClick={qpOpenPanel}>
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 5v14M5 12h14"/></svg>Update
                          </button>
                        </div>
                      </div>
                      <div className="meta-row">
                        <div className="meta-item" style={{paddingLeft:0}}><div className="meta-label">Target</div><div className="meta-value">{latestPost.priceTarget} <span style={{color:"var(--semantic-positive)",fontSize:12}}>({latestPost.targetPercent})</span></div></div>
                        <div className="meta-item"><div className="meta-label">Date</div><div className="meta-value">{latestPost.projectedDate}</div></div>
                        <div className="meta-item"><div className="meta-label">Confidence</div><div className="meta-value" style={{display:"flex",alignItems:"center",gap:6,color:getConfidenceColor(latestPost.confidence)}}>{Math.round(latestPost.confidence*100)}%<button className="sparkle-btn" title="View AI analysis" style={{color:getConfidenceColor(latestPost.confidence)}}><SparkleIcon size={13}/></button></div></div>
                      </div>
                      <div style={{borderTop:"1px solid var(--border-subtle)",padding:"5px 20px 5px",marginTop:14,display:"flex",alignItems:"center",justifyContent:isMobile?"center":"flex-start"}}>
                        {feedbackSubmitted[latestPost.id]?<div style={{display:"flex",alignItems:"center",gap:6,fontSize:12,color:"var(--semantic-positive)"}}><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 6L9 17l-5-5"/></svg>Feedback saved</div>
                        :<div style={{fontSize:12,color:"var(--text-tertiary)"}}>Analysis not right?{" "}<button onClick={()=>setReportOpen(p=>({...p,[latestPost.id]:true}))} style={{background:"none",border:"none",padding:0,color:"var(--accent-primary)",cursor:"pointer",fontFamily:"'DM Sans',sans-serif",fontSize:12,fontWeight:500,transition:"color 120ms"}} onMouseEnter={e=>e.target.style.color="var(--accent-primary-hover)"} onMouseLeave={e=>e.target.style.color="var(--accent-primary)"}>Report</button></div>}
                      </div>
                    </div>
                    {expandedPosts[latestPost.id]&&<div className="expand-text">{latestPost.content}</div>}
                  </div>
                </div>
                {olderPosts.length>0&&<div>
                  <div style={{fontSize:11,fontWeight:500,textTransform:"uppercase",letterSpacing:"0.06em",color:"var(--text-tertiary)",padding:"4px 0 8px"}}>Previous posts ({olderPosts.length})</div>
                  <div style={{display:"flex",flexDirection:"column",gap:6}}>
                    {olderPosts.map(post=>(
                      <div key={post.id} style={{background:"var(--bg-surface)",border:"1px solid var(--border-subtle)",borderRadius:"var(--radius-md)",overflow:"hidden",transition:"border-color 120ms"}} onMouseEnter={e=>e.currentTarget.style.borderColor="var(--border-default)"} onMouseLeave={e=>e.currentTarget.style.borderColor="var(--border-subtle)"}>
                        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"10px 14px"}}>
                          <div style={{display:"flex",alignItems:"center",gap:8}}><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--text-tertiary)" strokeWidth="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg><span style={{fontSize:13,color:"var(--text-secondary)"}}>{formatTime(post.postedAt)}</span></div>
                          <div style={{display:"flex",alignItems:"center",gap:4}}>
                            <button className="show-btn" onClick={()=>toggleExpand(post.id)} style={{fontSize:12}}>{expandedPosts[post.id]?"Hide":"View"}</button>
                            <button style={{background:"transparent",border:"none",color:"var(--text-tertiary)",cursor:"pointer",padding:4,display:"flex",alignItems:"center",transition:"color 120ms"}} onMouseEnter={e=>e.target.style.color="var(--semantic-negative)"} onMouseLeave={e=>e.target.style.color="var(--text-tertiary)"} title="Delete post"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/></svg></button>
                          </div>
                        </div>
                        {expandedPosts[post.id]&&<div style={{padding:"0 14px 12px",fontSize:13,lineHeight:1.6,color:"var(--text-secondary)",borderTop:"1px solid var(--border-subtle)",paddingTop:10}}>{post.content}</div>}
                      </div>
                    ))}
                  </div>
                </div>}
              </>)
          )}
        </div>
      </div>
      )}

      {/* ══════════ TOASTS ══════════ */}
      <div className="toast-container">
        {toasts.map(toast=>{const at=ALERT_TYPES[toast.type];return(
          <div key={toast.id} className="toast">
            <div style={{width:3,height:36,borderRadius:2,flexShrink:0,background:at.color,marginTop:2}}/>
            <div style={{width:28,height:28,borderRadius:"var(--radius-sm)",background:at.bg,color:at.color,display:"flex",alignItems:"center",justifyContent:"center",fontSize:14,flexShrink:0}}>{at.icon}</div>
            <div style={{flex:1,minWidth:0}}>
              <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:2}}><span style={{fontSize:11,fontWeight:500,textTransform:"uppercase",letterSpacing:"0.04em",color:at.color}}>{at.label}</span><span style={{fontSize:11,color:"var(--text-tertiary)"}}>· {toast.time}</span></div>
              <div style={{fontSize:13,color:"var(--text-primary)",lineHeight:1.4}}>{toast.message}</div>
            </div>
            <button onClick={()=>dismissToast(toast.id)} style={{background:"transparent",border:"none",color:"var(--text-tertiary)",cursor:"pointer",fontSize:14,padding:4,flexShrink:0}}>✕</button>
          </div>
        );})}
      </div>

      {/* Quick Paste save toast */}
      {qpSaved && (
        <div style={{ position:"fixed",top:isMobile?"auto":16,bottom:isMobile?16:"auto",right:16,left:isMobile?16:"auto",zIndex:1100,display:"flex",alignItems:"center",gap:10,padding:"14px 18px",background:"var(--bg-elevated)",border:"1px solid var(--border-default)",borderRadius:"var(--radius-md)",boxShadow:"var(--shadow-lg)",borderLeft:"3px solid var(--semantic-positive)",animation:"fadeInUp var(--duration-slow) var(--ease-out)" }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--semantic-positive)" strokeWidth="2"><path d="M20 6L9 17l-5-5"/></svg>
          <div>
            <div style={{fontSize:13,fontWeight:500,color:"var(--text-primary)"}}>Added to feed</div>
            <div style={{fontSize:12,color:"var(--text-tertiary)",marginTop:1}}>{qpSaved} saved</div>
          </div>
        </div>
      )}

      {/* ══════════ ACTION PANEL — Report ══════════ */}
      {reportPostId && (<>
        <div className="ap-overlay" onClick={closeReport}/>
        <div className={isMobile?"ap-mobile":"ap-desktop"}>
          {isMobile&&<div className="ap-handle"/>}
          <div className="ap-header"><div><div style={{fontSize:15,fontWeight:500}}>Report Issue</div><div style={{fontSize:12,color:"var(--text-tertiary)",marginTop:2}}>Help improve how the system interprets Coach's posts</div></div><button className="ap-close" onClick={closeReport}>✕</button></div>
          <div className="ap-body">
            <div style={{marginBottom:16}}><div className="meta-label" style={{marginBottom:6}}>What did the system get wrong?</div><textarea value={feedbackText} onChange={e=>setFeedbackText(e.target.value)} placeholder='e.g., "Target should be $190 not $185"' style={{width:"100%",minHeight:100,maxHeight:200,resize:"vertical",background:"var(--bg-input)",border:"1px solid var(--border-strong)",borderRadius:"var(--radius-md)",padding:"10px 12px",fontFamily:"'DM Sans',sans-serif",fontSize:14,color:"var(--text-primary)",lineHeight:1.6,outline:"none",transition:"border-color 120ms"}} onFocus={e=>e.target.style.borderColor="var(--border-focus)"} onBlur={e=>e.target.style.borderColor="var(--border-strong)"} autoFocus/></div>
            <div style={{fontSize:12,color:"var(--text-tertiary)",lineHeight:1.5}}>Your feedback is stored alongside the original post and used to train the parser.</div>
          </div>
          <div className="ap-footer" style={{display:"flex",gap:8,justifyContent:"flex-end"}}>
            <button onClick={closeReport} style={{padding:"8px 16px",borderRadius:"var(--radius-md)",border:"1px solid var(--border-strong)",background:"transparent",color:"var(--text-secondary)",fontFamily:"'DM Sans',sans-serif",fontSize:13,fontWeight:500,cursor:"pointer"}}>Cancel</button>
            <button onClick={()=>submitFeedback(reportPostId)} disabled={!feedbackText.trim()} style={{padding:"8px 20px",borderRadius:"var(--radius-md)",border:"none",background:feedbackText.trim()?"var(--accent-primary)":"var(--bg-elevated)",color:feedbackText.trim()?"var(--text-inverse)":"var(--text-tertiary)",fontFamily:"'DM Sans',sans-serif",fontSize:13,fontWeight:500,cursor:feedbackText.trim()?"pointer":"default"}}>Submit Report</button>
          </div>
        </div>
      </>)}

      {/* ══════════ ACTION PANEL — Delete ══════════ */}
      {deleteConfirmOpen&&selected!=="all"&&(<>
        <div className="ap-overlay" onClick={()=>setDeleteConfirmOpen(false)}/>
        <div className={isMobile?"ap-mobile":"ap-desktop"}>
          {isMobile&&<div className="ap-handle"/>}
          <div className="ap-header"><div><div style={{fontSize:15,fontWeight:500}}>Remove {selected} from Watchlist</div><div style={{fontSize:12,color:"var(--text-tertiary)",marginTop:2}}>This action can't be undone</div></div><button className="ap-close" onClick={()=>setDeleteConfirmOpen(false)}>✕</button></div>
          <div className="ap-body">
            <div style={{background:"var(--semantic-negative-muted)",border:"1px solid rgba(240,110,110,0.2)",borderRadius:"var(--radius-md)",padding:16}}>
              <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:8}}><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--semantic-negative)" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg><span style={{fontSize:13,fontWeight:500,color:"var(--semantic-negative)"}}>You're about to remove {selected}</span></div>
              <div style={{fontSize:13,color:"var(--text-secondary)",lineHeight:1.5}}>This will remove <strong style={{color:"var(--text-primary)",fontWeight:500}}>{selected}</strong> from your watchlist and delete all {filteredPosts.length} associated Coach post{filteredPosts.length!==1?"s":""}.</div>
            </div>
          </div>
          <div className="ap-footer" style={{display:"flex",gap:8,justifyContent:"flex-end"}}>
            <button onClick={()=>setDeleteConfirmOpen(false)} style={{padding:"8px 16px",borderRadius:"var(--radius-md)",border:"1px solid var(--border-strong)",background:"transparent",color:"var(--text-secondary)",fontFamily:"'DM Sans',sans-serif",fontSize:13,fontWeight:500,cursor:"pointer"}}>Cancel</button>
            <button onClick={confirmDelete} style={{padding:"8px 20px",borderRadius:"var(--radius-md)",border:"none",background:"var(--semantic-negative)",color:"#fff",fontFamily:"'DM Sans',sans-serif",fontSize:13,fontWeight:500,cursor:"pointer"}}>Remove {selected}</button>
          </div>
        </div>
      </>)}

      {/* ══════════ ACTION PANEL — Quick Paste ══════════ */}
      {qpOpen && (<>
        <div className={`ap-overlay ${qpClosing?"closing":""}`} onClick={qpClosePanel}/>
        <div className={`${isMobile?"ap-mobile":"ap-desktop wide"} ${qpClosing?"closing":""}`}>
          {isMobile&&<div className="ap-handle"/>}

          {/* Header */}
          <div className="ap-header">
            <div>
              <div style={{fontSize:15,fontWeight:500,display:"flex",alignItems:"center",gap:8}}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--accent-primary)" strokeWidth="2"><path d="M16 4h2a2 2 0 012 2v14a2 2 0 01-2 2H6a2 2 0 01-2-2V6a2 2 0 012-2h2"/><rect x="8" y="2" width="8" height="4" rx="1"/></svg>
                Quick Paste
              </div>
              <div style={{fontSize:12,color:"var(--text-tertiary)",marginTop:2}}>Paste text, screenshot, or both</div>
            </div>
            <button className="ap-close" onClick={qpClosePanel}>✕</button>
          </div>

          {/* Body */}
          <div className="ap-body"
            onDragOver={e=>{e.preventDefault();setQpDragging(true);}}
            onDragLeave={()=>setQpDragging(false)}
            onDrop={e=>{e.preventDefault();setQpDragging(false);if(e.dataTransfer.files.length)qpHandleFiles(e.dataTransfer.files);}}
          >
            {/* Screenshot preview */}
            {qpScreenshot && (
              <div style={{marginBottom:16,animation:"fadeInUp 300ms ease"}}>
                <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:6}}>
                  <span style={{fontSize:11,fontWeight:500,textTransform:"uppercase",letterSpacing:"0.04em",color:"var(--text-tertiary)"}}>Chart</span>
                  {qpScreenshot.status === "done" && (
                    <span style={{fontSize:11,color:"var(--semantic-positive)",fontWeight:500,display:"flex",alignItems:"center",gap:4}}>
                      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M20 6L9 17l-5-5"/></svg>
                      Analyzed
                    </span>
                  )}
                  {qpScreenshot.status === "analyzing" && (
                    <span style={{fontSize:11,color:"var(--text-tertiary)"}}>Processing...</span>
                  )}
                </div>
                <div className="qp-ss">
                  {/* Artifact sandbox blocks rendering pasted images — show styled placeholder */}
                  <div style={{
                    width: "100%", height: 140, display: "flex",
                    flexDirection: "column", alignItems: "center", justifyContent: "center",
                    gap: 8, background: "var(--bg-base)",
                    transition: "opacity 0.6s ease",
                    opacity: qpScreenshot.status === "analyzing" ? 0.5 : 1,
                  }}>
                    {qpScreenshot.status === "analyzing" ? (
                      <>
                        <div className="qp-progress-track" style={{width: 140}}>
                          <div className="qp-progress-fill" />
                        </div>
                        <span style={{fontSize: 12, color: "var(--text-tertiary)"}}>Analyzing image...</span>
                      </>
                    ) : (
                      <>
                        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="var(--text-tertiary)" strokeWidth="1.2" style={{opacity: 0.5}}>
                          <rect x="3" y="3" width="18" height="18" rx="2" />
                          <circle cx="8.5" cy="8.5" r="1.5" />
                          <path d="M21 15l-5-5L5 21" />
                        </svg>
                        <span style={{fontSize: 12, color: "var(--text-tertiary)"}}>
                          Screenshot captured
                        </span>
                      </>
                    )}
                  </div>
                  <button className="qp-ss-rm" onClick={qpRemoveScreenshot}>✕</button>

                  {/* Error */}
                  {qpScreenshot.status === "error" && (
                    <div className="qp-ss-done">
                      <span style={{fontSize:12,color:"var(--semantic-negative)"}}>Analysis failed — try again</span>
                    </div>
                  )}
                </div>

                {/* OCR text — collapsible */}
                {qpOcrText && (
                  <div style={{marginTop:10}}>
                    <button
                      className={"qp-text-toggle" + (qpShowOcr ? " open" : "")}
                      onClick={function() { setQpShowOcr(function(v) { return !v; }); }}
                    >
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M6 9l6 6 6-6"/></svg>
                      <span style={{fontSize:11,fontWeight:500,textTransform:"uppercase",letterSpacing:"0.04em"}}>Extracted Text</span>
                    </button>
                    <div className={"qp-text-collapse" + (qpShowOcr ? " open" : "")}>
                      <div className="qp-ocr" style={{marginTop:6}}>{qpOcrText}</div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Text + image input */}
            {qpScreenshot ? (
              /* When screenshot exists: collapsible text field */
              <div style={{marginBottom:16}}>
                <button
                  className={"qp-text-toggle" + (qpShowText ? " open" : "")}
                  onClick={function() { setQpShowText(function(v) { return !v; }); }}
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M6 9l6 6 6-6"/></svg>
                  <span style={{fontSize:11,fontWeight:500,textTransform:"uppercase",letterSpacing:"0.04em"}}>Coach's Guidance</span>
                </button>
                <div className={"qp-text-collapse" + (qpShowText ? " open" : "")}>
                  <div style={{paddingTop:8}}>
                    <textarea ref={qpTextRef} value={qpText} onChange={function(e) { setQpText(e.target.value); }}
                      placeholder="Paste additional post text..."
                      style={{width:"100%",minHeight:64,maxHeight:140,resize:"vertical",background:"var(--bg-input)",border:"1px solid var(--border-strong)",borderRadius:8,padding:"10px 12px",fontFamily:"'DM Sans',sans-serif",fontSize:14,color:"var(--text-primary)",lineHeight:1.6,outline:"none",transition:"border-color 120ms"}}
                      onFocus={function(e){e.target.style.borderColor="var(--border-focus)";}}
                      onBlur={function(e){e.target.style.borderColor="var(--border-strong)";}}
                    />
                  </div>
                </div>
              </div>
            ) : (
              /* No screenshot: full text + image drop layout */
              <div style={{display:"flex",gap:12,marginBottom:20,flexDirection:isMobile?"column":"row"}}>
                <div style={{flex:1,minWidth:0}}>
                  <textarea ref={qpTextRef} value={qpText} onChange={function(e) { setQpText(e.target.value); }}
                    placeholder={"Paste Coach\u2019s post or \u2318V a screenshot..."}
                    style={{width:"100%",minHeight:isMobile?72:90,maxHeight:160,resize:"vertical",background:"var(--bg-input)",border:"1px solid var(--border-strong)",borderRadius:8,padding:"10px 12px",fontFamily:"'DM Sans',sans-serif",fontSize:14,color:"var(--text-primary)",lineHeight:1.6,outline:"none",transition:"border-color 120ms"}}
                    onFocus={function(e){e.target.style.borderColor="var(--border-focus)";}}
                    onBlur={function(e){e.target.style.borderColor="var(--border-strong)";}}
                  />
                  {qpUrlDetected && <div style={{marginTop:6,padding:"6px 10px",background:"var(--semantic-warning-muted)",borderRadius:6,fontSize:12,color:"var(--semantic-warning)"}}>URLs can't be fetched — please paste the post text directly.</div>}
                </div>
                <div style={{width:isMobile?"100%":130,flexShrink:0}}>
                  <div className={"qp-dropzone" + (qpDragging ? " active" : "")} onClick={function() { if (qpFileRef.current) qpFileRef.current.click(); }} style={{minHeight:isMobile?52:70}}>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--text-tertiary)" strokeWidth="1.5" style={{display:"block",margin:"0 auto 4px"}}><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="M21 15l-5-5L5 21"/></svg>
                    <div style={{fontSize:11,color:"var(--text-tertiary)"}}>Drop or <span style={{color:"var(--accent-primary)"}}>browse</span></div>
                  </div>
                </div>
              </div>
            )}
            <input ref={qpFileRef} type="file" accept="image/*" hidden onChange={function(e){qpHandleFiles(e.target.files);e.target.value="";}} />

            {/* Parsed data — madlib format */}
            {(qpHasParsed||qpAnalyzing) ? (
              <div style={{animation:"fadeInUp 300ms ease"}}>
                <div className="ml-sentence" style={{
                  padding:"16px 18px",
                  background:"var(--bg-base)",
                  borderRadius:8,
                  border:"1px solid var(--border-subtle)",
                }}>
                  {/* Line 1: Direction + Ticker + Target + Date */}
                  <span>Coach is </span>
                  {qpAnalyzing && !qpFields.direction ? <span className="ml-shimmer" /> : (
                    <span
                      className="ml-direction"
                      onClick={function() {
                        setQpFields(function(p) {
                          return Object.assign({}, p, { direction: p.direction === "long" ? "short" : "long" });
                        });
                      }}
                      style={{
                        color: qpFields.direction === "long" ? "var(--semantic-positive)" : "var(--semantic-negative)",
                      }}
                    >
                      {qpFields.direction === "long" ? "Bullish" : "Bearish"}
                    </span>
                  )}
                  <span> on </span>
                  {qpAnalyzing && !qpFields.ticker ? <span className="ml-shimmer" /> : (
                    <InlineValue
                      value={qpFields.ticker} field="ticker" mono={false}
                      editing={qpEditingField === "ticker"}
                      onStartEdit={function(f) { setQpEditingField(f); }}
                      onEndEdit={function() { setQpEditingField(null); }}
                      onChange={function(v) { setQpFields(function(p) { return Object.assign({}, p, {ticker: v.toUpperCase()}); }); }}
                      placeholder="TICKER"
                    />
                  )}

                  {/* Target range */}
                  <span> targeting </span>
                  {qpAnalyzing && !qpFields.priceTargetLow ? <span className="ml-shimmer" /> : (
                    <InlineValue
                      value={qpFields.priceTargetLow} field="priceTargetLow" mono
                      editing={qpEditingField === "priceTargetLow"}
                      onStartEdit={function(f) { setQpEditingField(f); }}
                      onEndEdit={function() { setQpEditingField(null); }}
                      onChange={function(v) { setQpFields(function(p) { return Object.assign({}, p, {priceTargetLow: v}); }); }}
                      placeholder="___"
                    />
                  )}
                  {(qpFields.priceTargetHigh && qpFields.priceTargetHigh !== qpFields.priceTargetLow) ? (
                    <>
                      <span style={{color:"var(--text-tertiary)"}}> – </span>
                      <InlineValue
                        value={qpFields.priceTargetHigh} field="priceTargetHigh" mono
                        editing={qpEditingField === "priceTargetHigh"}
                        onStartEdit={function(f) { setQpEditingField(f); }}
                        onEndEdit={function() { setQpEditingField(null); }}
                        onChange={function(v) { setQpFields(function(p) { return Object.assign({}, p, {priceTargetHigh: v}); }); }}
                        placeholder="___"
                      />
                    </>
                  ) : null}

                  {/* Date */}
                  {(qpFields.projectedDate || qpAnalyzing) ? (
                    <>
                      <span> by </span>
                      {qpAnalyzing && !qpFields.projectedDate ? <span className="ml-shimmer" style={{width:72}} /> : (
                        <InlineValue
                          value={qpFields.projectedDate} field="projectedDate"
                          editing={qpEditingField === "projectedDate"}
                          onStartEdit={function(f) { setQpEditingField(f); }}
                          onEndEdit={function() { setQpEditingField(null); }}
                          onChange={function(v) { setQpFields(function(p) { return Object.assign({}, p, {projectedDate: v}); }); }}
                          placeholder="date"
                        />
                      )}
                    </>
                  ) : null}
                  <span>.</span>

                  {/* Line 2: Confirmation */}
                  {(qpFields.priceConfirmation || qpAnalyzing) ? (
                    <div style={{marginTop:4}}>
                      <span>Confirmation when price closes {qpFields.direction === "short" ? "below" : "above"} </span>
                      {qpAnalyzing && !qpFields.priceConfirmation ? <span className="ml-shimmer" /> : (
                        <InlineValue
                          value={qpFields.priceConfirmation} field="priceConfirmation" mono
                          editing={qpEditingField === "priceConfirmation"}
                          onStartEdit={function(f) { setQpEditingField(f); }}
                          onEndEdit={function() { setQpEditingField(null); }}
                          onChange={function(v) { setQpFields(function(p) { return Object.assign({}, p, {priceConfirmation: v}); }); }}
                          placeholder="___"
                        />
                      )}
                      <span>.</span>
                    </div>
                  ) : null}

                  {/* Line 3: Stop Loss */}
                  {qpFields.stopLoss ? (
                    <div style={{marginTop:4}}>
                      <span>Set stop at </span>
                      <InlineValue
                        value={qpFields.stopLoss} field="stopLoss" mono
                        editing={qpEditingField === "stopLoss"}
                        onStartEdit={function(f) { setQpEditingField(f); }}
                        onEndEdit={function() { setQpEditingField(null); }}
                        onChange={function(v) { setQpFields(function(p) { return Object.assign({}, p, {stopLoss: v}); }); }}
                        placeholder="___"
                      />
                      <span>.</span>
                    </div>
                  ) : null}

                  {/* Line 3: Support + Resistance */}
                  {(qpFields.support || qpFields.resistance) ? (
                    <div style={{marginTop:4}}>
                      {qpFields.support ? (
                        <>
                          <span>Support at </span>
                          <InlineValue
                            value={qpFields.support} field="support" mono
                            editing={qpEditingField === "support"}
                            onStartEdit={function(f) { setQpEditingField(f); }}
                            onEndEdit={function() { setQpEditingField(null); }}
                            onChange={function(v) { setQpFields(function(p) { return Object.assign({}, p, {support: v}); }); }}
                            placeholder="___"
                          />
                        </>
                      ) : null}
                      {qpFields.support && qpFields.resistance ? <span>, </span> : null}
                      {qpFields.resistance ? (
                        <>
                          <span>{qpFields.support ? "r" : "R"}esistance at </span>
                          <InlineValue
                            value={qpFields.resistance} field="resistance" mono
                            editing={qpEditingField === "resistance"}
                            onStartEdit={function(f) { setQpEditingField(f); }}
                            onEndEdit={function() { setQpEditingField(null); }}
                            onChange={function(v) { setQpFields(function(p) { return Object.assign({}, p, {resistance: v}); }); }}
                            placeholder="___"
                          />
                        </>
                      ) : null}
                      <span>.</span>
                    </div>
                  ) : null}
                </div>

                {/* Edit hint */}
                <div style={{fontSize:11,color:"var(--text-tertiary)",marginTop:10,textAlign:"center"}}>
                  Click any value to edit
                </div>
              </div>
            ) : !qpText&&!qpScreenshot&&(
              <div style={{textAlign:"center",padding:"28px 16px",color:"var(--text-tertiary)",fontSize:13,lineHeight:1.6}}>
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2" style={{display:"block",margin:"0 auto 10px",opacity:0.35}}><path d="M16 4h2a2 2 0 012 2v14a2 2 0 01-2 2H6a2 2 0 01-2-2V6a2 2 0 012-2h2"/><rect x="8" y="2" width="8" height="4" rx="1"/></svg>
                <span style={{color:"var(--text-primary)",fontWeight:500}}>⌘V</span> to paste a screenshot or text.
                <br/>You can also drop chart images here.
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="ap-footer">
            <button
              className="qp-save"
              disabled={!qpHasParsed || qpAnalyzing}
              onClick={function() { qpSave("feed"); }}
              style={{
                width: "100%", padding: "10px 0", border: "none",
                borderRadius: 8,
                background: qpHasParsed && !qpAnalyzing ? "var(--accent-primary)" : "var(--bg-elevated)",
                color: qpHasParsed && !qpAnalyzing ? "var(--text-inverse)" : "var(--text-tertiary)",
              }}
            >Add</button>
          </div>
        </div>
      </>)}

    </div>
  );
}
