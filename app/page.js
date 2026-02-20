"use client";

import { useState, useEffect, useRef, useCallback } from "react";

function detectBrowser() {
  if (typeof navigator === "undefined") return { browser: "Unknown", os: "Unknown", device: "Unknown", ua: "", isBrave: false };

  const ua = navigator.userAgent;
  let browser = "Unknown";
  let os = "Unknown";
  let device = "Desktop";

  if (/iPad|iPhone|iPod/.test(ua)) { os = "iOS"; device = "Mobile"; }
  else if (/Android/.test(ua)) { os = "Android"; device = "Mobile"; }
  else if (/Mac OS X/.test(ua)) os = "macOS";
  else if (/Windows/.test(ua)) os = "Windows";
  else if (/Linux/.test(ua)) os = "Linux";

  if (/CriOS/.test(ua)) browser = "Chrome (iOS)";
  else if (/FxiOS/.test(ua)) browser = "Firefox (iOS)";
  else if (/EdgiOS/.test(ua)) browser = "Edge (iOS)";
  else if (/SamsungBrowser/.test(ua)) browser = "Samsung Internet";
  else if (/Firefox\//.test(ua)) browser = "Firefox";
  else if (/Edg\//.test(ua)) browser = "Edge";
  else if (/OPR\//.test(ua)) browser = "Opera";
  else if (/Arc\//.test(ua)) browser = "Arc";
  else if (/Dia\//.test(ua)) browser = "Dia";
  else if (/Chrome\//.test(ua) && !/Edg\//.test(ua)) browser = "Chrome";
  else if (/Safari\//.test(ua) && !/Chrome\//.test(ua)) browser = "Safari";

  if (/iPad/.test(ua) || (os === "Android" && !/Mobile/.test(ua))) device = "Tablet";

  return { browser, os, device, ua };
}

// Brave hides itself in the UA string, so we need to check navigator.brave
async function checkBrave() {
  if (typeof navigator !== "undefined" && navigator.brave) {
    try {
      return await navigator.brave.isBrave();
    } catch { return false; }
  }
  return false;
}

// Arc hides itself in the UA string, but injects CSS variables for its theming
function checkArc() {
  if (typeof document === "undefined") return false;
  const styles = getComputedStyle(document.documentElement);
  return !!(
    styles.getPropertyValue("--arc-palette-title") ||
    styles.getPropertyValue("--arc-palette-background") ||
    styles.getPropertyValue("--arc-palette-foreground")
  );
}

function getMatrixKey(browser, os) {
  const b = browser.toLowerCase();
  if (b.includes("chrome") && os === "iOS") return "chrome-ios";
  if (b.includes("firefox") && os === "iOS") return "firefox-ios";
  if (b.includes("edge") && os === "iOS") return "edge-ios";
  if (b.includes("safari") && os === "iOS") return "safari-ios";
  if (os === "Android" && b.includes("samsung")) return "android-samsung";
  if (os === "Android" && b.includes("firefox")) return "android-firefox";
  if (os === "Android" && b === "brave") return "android-brave";
  if (os === "Android" && b.includes("edge")) return "android-edge";
  if (os === "Android") return "android-chrome";
  if (b.includes("firefox")) return "firefox";
  if (b.includes("safari")) return "safari";
  if (b.includes("edge")) return "edge";
  if (b.includes("opera")) return "opera";
  if (b === "brave") return "brave";
  if (b === "arc") return "arc";
  if (b === "dia") return "dia";
  if (b.includes("chrome")) return "chrome";
  return "unknown";
}

const MATRIX_ROWS = [
  { key: "chrome", label: "Chrome", note: "1" },
  { key: "brave", label: "Brave", note: "1" },
  { key: "arc", label: "Arc", note: "1" },
  { key: "dia", label: "Dia", note: "1" },
  { key: "edge", label: "Edge", note: "1" },
  { key: "firefox", label: "Firefox" },
  { key: "opera", label: "Opera", note: "1" },
  { key: "safari", label: "Safari" },
  { key: "chrome-ios", label: "Chrome on iOS 16+" },
  { key: "safari-ios", label: "Safari on iOS 16+" },
  { key: "firefox-ios", label: "Firefox on iOS 16+" },
  { key: "edge-ios", label: "Edge on iOS 16+" },
  { key: "android-chrome", label: "Chrome on Android" },
  { key: "android-samsung", label: "Samsung Internet on Android" },
  { key: "android-firefox", label: "Firefox on Android" },
  { key: "android-brave", label: "Brave on Android" },
  { key: "android-edge", label: "Edge on Android" },
];

function StatusCell({ status, note, testers, showCount }) {
  if (!status) {
    return <td className="px-3 py-2.5"><span className="text-gray-400">&mdash; Untested</span></td>;
  }
  const cls =
    status === "supported" ? "text-green-600 font-semibold" :
    status === "unsupported" ? "text-red-600 font-semibold" :
    status === "fallback" ? "text-orange-600 font-semibold" :
    "text-gray-400";

  const icon =
    status === "supported" ? "\u2713" :
    status === "unsupported" ? "\u2717" :
    status === "fallback" ? "\u26A0" :
    "\u2014";

  const label =
    status === "supported" ? "Supported" :
    status === "unsupported" ? "Not supported" :
    status === "fallback" ? "Fallback" :
    "Untested";

  return (
    <td className="px-3 py-2.5">
      <span className={cls}>{icon} {label}</span>
      {note && <span className="block text-[11px] text-slate-400">{note}</span>}
      {showCount && testers && testers.length > 0 && (
        <span className="block text-[10px] text-slate-300">
          Tested by: {testers.join(", ")}
        </span>
      )}
    </td>
  );
}

export default function Home() {
  const [info, setInfo] = useState({ browser: "...", os: "...", device: "...", ua: "" });
  const [matrixKey, setMatrixKey] = useState("");
  const [loading, setLoading] = useState(null);
  const [iframeUrl, setIframeUrl] = useState(null);
  const [iframeType, setIframeType] = useState(null);
  const [logs, setLogs] = useState([]);
  const [orderInfo, setOrderInfo] = useState(null);
  const [applePayAvailable, setApplePayAvailable] = useState(null);
  const [liveResults, setLiveResults] = useState({});
  const [sharedResults, setSharedResults] = useState({});
  const [matrixView, setMatrixView] = useState("shared");
  const [testerName, setTesterName] = useState("");
  const [nameInput, setNameInput] = useState("");
  const iframeRef = useRef(null);

  // Load saved results and tester name from localStorage on mount
  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem("onramp-matrix-results") || "{}");
      if (Object.keys(saved).length > 0) setLiveResults(saved);
    } catch { /* ignore */ }
    const savedName = localStorage.getItem("onramp-tester-name") || "";
    setTesterName(savedName);
    setNameInput(savedName);
    fetchSharedResults();
  }, []);

  // Save results to localStorage whenever they change
  useEffect(() => {
    if (Object.keys(liveResults).length > 0) {
      localStorage.setItem("onramp-matrix-results", JSON.stringify(liveResults));
    }
  }, [liveResults]);

  useEffect(() => {
    const detected = detectBrowser();

    checkBrave().then((isBrave) => {
      if (isBrave) {
        detected.browser = "Brave";
      } else if (checkArc()) {
        detected.browser = "Arc";
      }
      setInfo(detected);
      setMatrixKey(getMatrixKey(detected.browser, detected.os));
    });

    if (typeof window !== "undefined" && window.ApplePaySession) {
      setApplePayAvailable(window.ApplePaySession.canMakePayments());
    } else {
      setApplePayAvailable(false);
    }
  }, []);

  const addLog = useCallback((type, message) => {
    const time = new Date().toLocaleTimeString("en-US", { hour12: false });
    setLogs((prev) => [...prev, { time, type, message }]);
  }, []);

  async function fetchSharedResults() {
    try {
      const res = await fetch("/api/results");
      const data = await res.json();
      setSharedResults(data);
    } catch { /* ignore */ }
  }

  function updateMatrixResult(column, status, note) {
    if (!matrixKey) return;
    setLiveResults((prev) => ({
      ...prev,
      [matrixKey]: {
        ...prev[matrixKey],
        [column]: { status, note, testedAt: new Date().toISOString() },
      },
    }));
    fetch("/api/results", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        browserKey: matrixKey,
        column,
        status,
        note,
        userAgent: info.ua,
        testerName: testerName || "Anonymous",
      }),
    })
      .then((res) => res.json())
      .then((data) => setSharedResults(data))
      .catch(() => {});
  }

  // Listen for postMessage events from iframe
  useEffect(() => {
    function handleMessage(event) {
      if (!event.origin.includes("coinbase.com") && !event.origin.includes("pay.coinbase.com")) return;

      let data = event.data;
      if (typeof data === "string") {
        try { data = JSON.parse(data); } catch { /* leave as string */ }
      }

      const eventName = data?.eventName || data?.type || data?.event || (typeof data === "string" ? data : "message");
      const isError = String(eventName).includes("error");
      const isSuccess = String(eventName).includes("success");

      addLog(
        isError ? "error" : isSuccess ? "success" : "info",
        `${eventName}: ${typeof data === "object" ? JSON.stringify(data) : data}`
      );

      if (String(eventName).includes("load_success")) {
        updateMatrixResult("applePay", "supported", "Tested live");
        addLog("success", "MATRIX UPDATED: Apple Pay button rendered successfully on this browser");
      } else if (String(eventName).includes("load_error")) {
        const errorCode = data?.errorCode || data?.error_code || "";
        if (String(errorCode).includes("NOT_SUPPORTED")) {
          updateMatrixResult("applePay", "unsupported", "Not supported on this browser");
          addLog("error", "MATRIX UPDATED: Apple Pay not supported on this browser");
        } else if (String(errorCode).includes("NOT_SETUP")) {
          updateMatrixResult("applePay", "fallback", "Apple Pay not set up on device");
          addLog("error", "MATRIX UPDATED: Apple Pay not set up on this device");
        } else {
          updateMatrixResult("applePay", "fallback", `Error: ${errorCode || eventName}`);
        }
      }
    }

    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, [addLog, matrixKey]);

  async function generateLink(type) {
    setLoading(type);
    setIframeUrl(null);
    setOrderInfo(null);
    addLog("info", `Generating ${type} link...`);

    try {
      const res = await fetch("/api/generate-link", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type }),
      });

      const data = await res.json();

      if (data.error) {
        addLog("error", `API error: ${data.error}`);
        return;
      }

      addLog("success", `Link generated: ${data.url}`);
      setIframeUrl(data.url);
      setIframeType(type);
      setOrderInfo(data);

      if (type === "hosted") {
        updateMatrixResult("debitCard", "supported", "Tested live");
      }
    } catch (err) {
      addLog("error", `Fetch error: ${err.message}`);
    } finally {
      setLoading(null);
    }
  }

  function clearResults() {
    setLiveResults({});
    if (typeof window !== "undefined") {
      localStorage.removeItem("onramp-matrix-results");
    }
    addLog("info", "Personal results cleared");
  }

  async function clearSharedResultsFn() {
    try {
      await fetch("/api/results", { method: "DELETE" });
      setSharedResults({});
      addLog("info", "Shared results cleared");
    } catch { /* ignore */ }
  }

  function getResult(key, column) {
    const source = matrixView === "shared" ? sharedResults : liveResults;
    return source[key]?.[column] || null;
  }

  function saveName() {
    if (nameInput.trim()) {
      setTesterName(nameInput.trim());
      localStorage.setItem("onramp-tester-name", nameInput.trim());
    }
  }

  return (
    <div className="max-w-[900px] mx-auto px-4 py-6">
      <h1 className="text-2xl font-bold mb-1">Coinbase Onramp Compatibility Tester</h1>
      <p className="text-sm text-gray-500 mb-6">
        Generate sandbox payment links and test them on this device/browser. The matrix updates live based on what actually renders. All transactions use sandbox mode.
      </p>

      {/* Tester Name */}
      {!testerName && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg px-5 py-4 mb-4 flex items-center justify-between gap-3 flex-wrap">
          <span className="text-sm font-medium">Who&apos;s testing?</span>
          <div className="flex gap-2 items-center">
            <input
              type="text"
              placeholder="Enter your name"
              value={nameInput}
              onChange={(e) => setNameInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") saveName(); }}
              className="px-3 py-2 border border-gray-300 rounded text-sm w-48 outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-600/10"
            />
            <button
              className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded hover:bg-blue-700 disabled:opacity-50"
              disabled={!nameInput.trim()}
              onClick={saveName}
            >
              Start Testing
            </button>
          </div>
        </div>
      )}

      {/* Browser Detection */}
      <div className="bg-white border border-gray-200 rounded-lg p-4 mb-6 flex flex-wrap gap-4">
        {testerName && (
          <div className="flex flex-col gap-0.5">
            <span className="text-[11px] uppercase tracking-wide text-gray-500 font-semibold">Tester</span>
            <span className="text-sm font-medium flex items-center gap-1.5">
              {testerName}
              <button
                className="text-[10px] text-gray-400 underline cursor-pointer bg-transparent border-none"
                onClick={() => {
                  setTesterName("");
                  setNameInput("");
                  localStorage.removeItem("onramp-tester-name");
                }}
              >
                change
              </button>
            </span>
          </div>
        )}
        <div className="flex flex-col gap-0.5">
          <span className="text-[11px] uppercase tracking-wide text-gray-500 font-semibold">Browser</span>
          <span className="text-sm font-medium">{info.browser}</span>
        </div>
        <div className="flex flex-col gap-0.5">
          <span className="text-[11px] uppercase tracking-wide text-gray-500 font-semibold">OS</span>
          <span className="text-sm font-medium">{info.os}</span>
        </div>
        <div className="flex flex-col gap-0.5">
          <span className="text-[11px] uppercase tracking-wide text-gray-500 font-semibold">Device</span>
          <span className="text-sm font-medium">{info.device}</span>
        </div>
        <div className="flex flex-col gap-0.5">
          <span className="text-[11px] uppercase tracking-wide text-gray-500 font-semibold">Apple Pay API</span>
          <span className={`text-sm font-medium ${applePayAvailable ? "text-green-600" : "text-red-600"}`}>
            {applePayAvailable === null ? "Checking..." : applePayAvailable ? "Available" : "Not available"}
          </span>
        </div>
        <div className="flex flex-col gap-0.5">
          <span className="text-[11px] uppercase tracking-wide text-gray-500 font-semibold">Matrix Key</span>
          <span className="text-sm font-medium">{matrixKey || "..."}</span>
        </div>
      </div>

      {/* Test Buttons */}
      <div className="bg-white border border-gray-200 rounded-lg p-5 mb-4">
        <h2 className="text-base font-semibold mb-1">Generate Test Links</h2>
        <p className="text-[13px] text-gray-500 mb-4">Click a button to generate a fresh sandbox payment link. The matrix below will update based on what actually renders.</p>
        <div className="flex gap-2 flex-wrap">
          <button
            className="px-5 py-2.5 rounded-lg bg-blue-600 text-white text-sm font-medium border border-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer transition-all"
            onClick={() => generateLink("apple_pay")}
            disabled={loading !== null}
          >
            {loading === "apple_pay" && <span className="spinner" />}
            Test Apple Pay (Headless)
          </button>
          <button
            className="px-5 py-2.5 rounded-lg bg-white text-gray-900 text-sm font-medium border border-gray-200 hover:border-blue-600 hover:text-blue-600 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer transition-all"
            onClick={() => generateLink("hosted")}
            disabled={loading !== null}
          >
            {loading === "hosted" && <span className="spinner" />}
            Test Hosted Onramp
          </button>
        </div>

        {orderInfo && (
          <div className="mt-3 text-xs text-gray-500">
            {orderInfo.orderId && <span>Order: {orderInfo.orderId} | </span>}
            {orderInfo.paymentTotal && <span>${orderInfo.paymentTotal} &rarr; {orderInfo.purchaseAmount} USDC | </span>}
            Type: {orderInfo.type}
          </div>
        )}

        {/* Render area */}
        <div className={`mt-4 border-2 rounded-lg min-h-[200px] flex items-center justify-center relative overflow-hidden ${iframeUrl ? "border-solid border-blue-600" : "border-dashed border-gray-200"}`}>
          {iframeUrl ? (
            iframeType === "apple_pay" ? (
              <div className="w-full">
                <iframe
                  ref={iframeRef}
                  src={iframeUrl}
                  sandbox="allow-scripts allow-same-origin allow-popups allow-forms"
                  referrerPolicy="no-referrer"
                  allow="payment"
                  title="Apple Pay Onramp"
                  className="w-full h-[500px] border-none"
                />
                <div className="px-4 py-2 border-t border-gray-200 flex items-center gap-2">
                  <a href={iframeUrl} target="_blank" rel="noopener noreferrer" className="px-3 py-1 text-xs rounded border border-gray-200 bg-white hover:border-blue-600 hover:text-blue-600 no-underline">
                    Open in New Tab
                  </a>
                  <input
                    type="text" readOnly value={iframeUrl}
                    onClick={(e) => { e.target.select(); navigator.clipboard?.writeText(iframeUrl); addLog("info", "URL copied"); }}
                    className="flex-1 px-2 py-1 text-[11px] font-mono border border-gray-200 rounded bg-gray-50 cursor-pointer"
                  />
                </div>
              </div>
            ) : (
              <div className="text-center p-10 w-full">
                <p className="mb-2 text-sm font-semibold">Hosted Onramp Link</p>
                <p className="mb-4 text-[13px] text-gray-500">
                  Hosted onramp cannot be embedded in an iframe. Open in a new tab to test.
                </p>
                <a href={iframeUrl} target="_blank" rel="noopener noreferrer" className="inline-block px-5 py-2.5 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 no-underline mb-3">
                  Open Hosted Onramp
                </a>
                <div className="mt-3">
                  <input
                    type="text" readOnly value={iframeUrl}
                    onClick={(e) => { e.target.select(); navigator.clipboard?.writeText(iframeUrl); addLog("info", "URL copied"); }}
                    className="w-full px-3 py-2 text-xs font-mono border border-gray-200 rounded bg-gray-50 cursor-pointer"
                  />
                </div>
              </div>
            )
          ) : (
            <div className="text-gray-400 text-sm text-center p-10">
              Click a button above to generate a payment link.<br />
              The result will render here and the matrix will update.
            </div>
          )}
        </div>
      </div>

      {/* Event Log */}
      <div className="bg-white border border-gray-200 rounded-lg p-5 mb-4">
        <h2 className="text-base font-semibold mb-3 flex items-center justify-between">
          Event Log
          {logs.length > 0 && (
            <button className="text-xs text-gray-400 bg-transparent border-none cursor-pointer underline" onClick={() => setLogs([])}>Clear</button>
          )}
        </h2>
        <div className="font-mono text-xs max-h-48 overflow-y-auto bg-gray-50 rounded p-3">
          {logs.length === 0 ? (
            <div className="text-gray-400">No events yet. Generate a link to see events.</div>
          ) : (
            logs.map((log, i) => (
              <div key={i} className={`py-0.5 border-b border-gray-200 last:border-b-0 ${
                log.type === "success" ? "text-green-600" :
                log.type === "error" ? "text-red-600" :
                "text-blue-600"
              }`}>
                <span className="text-gray-400 mr-2">{log.time}</span>
                {log.message}
              </div>
            ))
          )}
        </div>
      </div>

      {/* Compatibility Matrix */}
      <div className="bg-white border border-gray-200 rounded-lg p-5 mb-4 overflow-x-auto">
        <h2 className="text-base font-semibold mb-3 flex justify-between items-center">
          Compatibility Matrix
          <div className="flex gap-2 items-center">
            <button
              className={`text-xs font-medium px-3 py-1 rounded border cursor-pointer transition-all ${
                matrixView === "shared"
                  ? "bg-blue-600 text-white border-blue-600"
                  : "bg-gray-50 text-gray-500 border-gray-200 hover:border-blue-600 hover:text-blue-600"
              }`}
              onClick={() => setMatrixView("shared")}
            >
              All Testers
            </button>
            <button
              className={`text-xs font-medium px-3 py-1 rounded border cursor-pointer transition-all ${
                matrixView === "personal"
                  ? "bg-blue-600 text-white border-blue-600"
                  : "bg-gray-50 text-gray-500 border-gray-200 hover:border-blue-600 hover:text-blue-600"
              }`}
              onClick={() => setMatrixView("personal")}
            >
              My Results
            </button>
            {matrixView === "personal" && Object.keys(liveResults).length > 0 && (
              <button className="text-xs text-gray-400 bg-transparent border-none cursor-pointer underline" onClick={clearResults}>Reset mine</button>
            )}
            {matrixView === "shared" && Object.keys(sharedResults).length > 0 && (
              <button className="text-xs text-gray-400 bg-transparent border-none cursor-pointer underline" onClick={clearSharedResultsFn}>Reset shared</button>
            )}
          </div>
        </h2>
        <p className="text-[13px] text-gray-500 mb-3">
          {matrixView === "shared"
            ? "Aggregated results from all testers. Test on any browser and results are shared with everyone."
            : "Your personal results from this browser. Saved in localStorage."}
        </p>
        <table className="w-full border-collapse text-[13px]">
          <thead>
            <tr>
              <th className="px-3 py-2.5 text-left text-[11px] uppercase tracking-wide text-gray-500 font-semibold bg-gray-50 border-b border-gray-200"></th>
              <th className="px-3 py-2.5 text-left text-[11px] uppercase tracking-wide text-gray-500 font-semibold bg-gray-50 border-b border-gray-200">Apple Pay (Guest)</th>
              <th className="px-3 py-2.5 text-left text-[11px] uppercase tracking-wide text-gray-500 font-semibold bg-gray-50 border-b border-gray-200">Debit Card (Guest)</th>
              <th className="px-3 py-2.5 text-left text-[11px] uppercase tracking-wide text-gray-500 font-semibold bg-gray-50 border-b border-gray-200">Coinbase Login</th>
            </tr>
          </thead>
          <tbody>
            {MATRIX_ROWS.map((row) => {
              const isCurrent = row.key === matrixKey;
              const apResult = getResult(row.key, "applePay");
              const dcResult = getResult(row.key, "debitCard");
              const clResult = getResult(row.key, "coinbaseLogin");
              return (
                <tr key={row.key} className={isCurrent ? "bg-blue-50" : ""}>
                  <td className="px-3 py-2.5 font-medium border-b border-gray-200">
                    {row.label}
                    {row.note && <sup>{row.note}</sup>}
                    {isCurrent && <span className="inline-block text-[10px] px-1.5 py-0.5 rounded bg-blue-100 text-blue-600 font-semibold uppercase ml-1.5">YOU</span>}
                  </td>
                  <StatusCell status={apResult?.status} note={apResult?.note} testers={apResult?.testers} showCount={matrixView === "shared"} />
                  <StatusCell status={dcResult?.status} note={dcResult?.note} testers={dcResult?.testers} showCount={matrixView === "shared"} />
                  <StatusCell status={clResult?.status} note={clResult?.note} testers={clResult?.testers} showCount={matrixView === "shared"} />
                </tr>
              );
            })}
          </tbody>
        </table>
        <div className="mt-3 text-[11px] text-gray-400">
          <p><sup>1</sup> Chromium-based browser (Chrome, Brave, Arc, Dia, Edge, Opera).</p>
          <p className="mt-1">Test on each browser to fill in the matrix. Shared results are aggregated from all testers. Personal results are saved in localStorage.</p>
        </div>
      </div>
    </div>
  );
}
