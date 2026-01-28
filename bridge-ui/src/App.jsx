import { useMemo, useState } from "react";
import axios from "axios";

export default function App() {
  const API = useMemo(() => "http://localhost:5050", []);

  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("Idle");
  const [events, setEvents] = useState([]);
  const [toast, setToast] = useState("");

  const SUI_BRIDGE_ID =
    "0x542c42ac6282e4e0beceda33aabae9eb29bc0c3f11d7f1675b0717202d361318";
  const SUI_CAP_ID =
    "0xf9ee4563c8379033ab71185612ffcaa6ce788b7db9b674c6a44e09057b185a24";


  const [ethRecipient, setEthRecipient] = useState(
    "0x70997970C51812dc3A010C7d01b50e0d17dc79C8"
  );
  const [suiRecipient, setSuiRecipient] = useState(
    "0xe9de041c9eabae6ff64e36701acfff3da8868f8b7bc594a132886c30564d73ff"
  );


  const [ethAmountWei, setEthAmountWei] = useState("1000000000000000000"); // 1e18
  const [suiAmountU64, setSuiAmountU64] = useState("1000000000"); // 1e9 (9 decimals)

  const [suiCoinId, setSuiCoinId] = useState(
    "0xf8dcbd12235382b1a1bd4025444f6cef4748dc7c881ee817db20338874388d61"
  );
  const [lastSuiLockDigest, setLastSuiLockDigest] = useState("");


  const [ethBalance, setEthBalance] = useState(null); 
  const [suiBalance, setSuiBalance] = useState(null); 

  function pushEvent(e) {
    setEvents((prev) => [e, ...prev].slice(0, 30));
  }

  function clearLog() {
    setEvents([]);
  }

  function shortAddr(a) {
    if (!a) return "";
    const s = String(a);
    if (s.length <= 12) return s;
    return `${s.slice(0, 6)}…${s.slice(-4)}`;
  }

  async function copyToClipboard(text) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      return false;
    }
  }

  function suiAddressToBytes32(addr) {
    const hex = addr.toLowerCase().replace(/^0x/, "");
    return "0x" + hex.padStart(64, "0");
  }

  function ethAddressToBytes20(addr) {
    return "0x" + addr.toLowerCase().replace(/^0x/, "");
  }

  function pick(obj, keys) {
    const out = {};
    for (const k of keys) if (obj?.[k] !== undefined) out[k] = obj[k];
    return out;
  }

  function extractEthTxHashFromCastOutput(castOutput) {
    if (!castOutput) return null;
    const m = castOutput.match(/transactionHash\s+0x[0-9a-fA-F]{64}/);
    return m ? m[0].split(/\s+/).pop() : null;
  }

  function showToast(msg) {
    setToast(msg);
    setTimeout(() => setToast(""), 900);
  }

  async function doGet(path, label) {
    setBusy(true);
    setStatus("Working...");
    try {
      const r = await axios.get(`${API}${path}`);
      setStatus("OK ✅");
      pushEvent({
        at: new Date().toISOString(),
        action: label || `GET ${path}`,
        ok: true,
        data: r.data,
      });
      return r.data;
    } catch (e) {
      setStatus("Error ❌");
      pushEvent({
        at: new Date().toISOString(),
        action: label || `GET ${path}`,
        ok: false,
        error: e?.response?.data || String(e),
      });
      throw e;
    } finally {
      setBusy(false);
    }
  }

  async function doPost(path, body, label, pickKeys = null) {
    setBusy(true);
    setStatus("Working...");
    try {
      const r = await axios.post(`${API}${path}`, body);
      setStatus("OK ✅");

      const small = pickKeys ? pick(r.data, pickKeys) : r.data;

      pushEvent({
        at: new Date().toISOString(),
        action: label || `POST ${path}`,
        ok: true,
        data: small,
      });

      return r.data;
    } catch (e) {
      setStatus("Error ❌");
      pushEvent({
        at: new Date().toISOString(),
        action: label || `POST ${path}`,
        ok: false,
        error: e?.response?.data || String(e),
      });
      throw e;
    } finally {
      setBusy(false);
    }
  }

  async function refreshBalances() {
    setBusy(true);
    setStatus("Refreshing balances...");
    try {
      const eth = await axios.post(`${API}/eth/balance`, { address: ethRecipient });
      setEthBalance(eth.data?.balance ?? null);

      const sui = await axios.get(`${API}/sui/balance`);
      setSuiBalance(sui.data?.balanceIbt ?? null);

      setStatus("OK ✅");
      pushEvent({
        at: new Date().toISOString(),
        action: "Refresh balances",
        ok: true,
        data: { eth: eth.data, sui: sui.data },
      });
    } catch (e) {
      setStatus("Error ❌");
      pushEvent({
        at: new Date().toISOString(),
        action: "Refresh balances",
        ok: false,
        error: e?.response?.data || String(e),
      });
    } finally {
      setBusy(false);
    }
  }

  const btn = {
    padding: "10px 14px",
    borderRadius: 10,
    border: "1px solid #333",
    cursor: "pointer",
    marginRight: 10,
    marginBottom: 10,
    background: "white",
  };

  const input = {
    width: "100%",
    padding: 10,
    marginTop: 6,
    marginBottom: 12,
    borderRadius: 10,
    border: "1px solid #ccc",
    fontFamily: "monospace",
  };

  const box = {
    border: "1px solid #ddd",
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  };

  const smallNote = { opacity: 0.8, fontSize: 13 };

  return (
    <div
      style={{
        padding: 18,
        fontFamily: "system-ui, Arial",
        maxWidth: 1100,
        margin: "0 auto",
      }}
    >
      {/* Topbar */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
          marginBottom: 16,
        }}
      >
        <div>
          <div style={{ fontSize: 22, fontWeight: 700 }}>IBT Bridge</div>
          <div style={{ opacity: 0.8 }}>
            Ethereum ↔ Sui 
          </div>
        </div>

        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <button style={btn} onClick={refreshBalances} disabled={busy}>
            {busy ? "Refreshing..." : "Refresh balances"}
          </button>
          <button style={btn} onClick={clearLog} disabled={busy}>
            Clear log
          </button>
        </div>
      </div>

      {/* Wallet cards */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 14,
          marginBottom: 14,
        }}
      >
        {/* ETH wallet */}
        <div style={{ ...box, marginBottom: 0 }}>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: 10,
            }}
          >
            <div style={{ fontWeight: 700 }}>Ethereum Wallet</div>
            <span style={{ ...smallNote, border: "1px solid #ddd", padding: "4px 8px", borderRadius: 999 }}>
              Anvil
            </span>
          </div>

          <div style={{ marginBottom: 10 }}>
            <div style={smallNote}>Address</div>
            <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
              <code style={{ fontSize: 14 }}>{ethRecipient}</code>
              <button
                style={{ ...btn, marginBottom: 0, padding: "6px 10px" }}
                onClick={async () => {
                  const ok = await copyToClipboard(ethRecipient);
                  showToast(ok ? "Copied ETH address" : "Copy failed");
                }}
              >
                Copy
              </button>
            </div>
          </div>

          <div style={{ borderTop: "1px solid #eee", paddingTop: 10 }}>
            <div style={smallNote}>IBT balance</div>
            <div style={{ fontSize: 22, fontWeight: 700, fontFamily: "monospace" }}>
              {ethBalance === null ? "—" : `${ethBalance} IBT`}
            </div>
          </div>
        </div>

        {/* Sui wallet */}
        <div style={{ ...box, marginBottom: 0 }}>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: 10,
            }}
          >
            <div style={{ fontWeight: 700 }}>Sui Wallet</div>
            <span style={{ ...smallNote, border: "1px solid #ddd", padding: "4px 8px", borderRadius: 999 }}>
              Localnet
            </span>
          </div>

          <div style={{ marginBottom: 10 }}>
            <div style={smallNote}>Address</div>
            <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
              <code style={{ fontSize: 14 }}>{suiRecipient}</code>
              <button
                style={{ ...btn, marginBottom: 0, padding: "6px 10px" }}
                onClick={async () => {
                  const ok = await copyToClipboard(suiRecipient);
                  showToast(ok ? "Copied Sui address" : "Copy failed");
                }}
              >
                Copy
              </button>
            </div>
          </div>

          <div style={{ borderTop: "1px solid #eee", paddingTop: 10 }}>
            <div style={smallNote}>IBT balance</div>
            <div style={{ fontSize: 22, fontWeight: 700, fontFamily: "monospace" }}>
              {suiBalance === null ? "—" : `${suiBalance} IBT`}
            </div>
          </div>
        </div>
      </div>

      {/* Status row */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
        <div
          style={{
            width: 10,
            height: 10,
            borderRadius: 999,
            background: status.includes("Error") ? "#d33" : status.includes("OK") ? "#2a7" : "#999",
          }}
        />
        <div style={{ fontWeight: 600 }}>{status}</div>
        {busy ? <div style={smallNote}>⏳ busy</div> : null}
        {toast ? (
          <div style={{ marginLeft: "auto", border: "1px solid #ddd", padding: "6px 10px", borderRadius: 999 }}>
            {toast}
          </div>
        ) : null}
      </div>

      {/* Config */}
      <div style={box}>
        <div style={{ fontWeight: 700, marginBottom: 8 }}>Config (read-only)</div>
        <div style={smallNote}>
          API: <code>{API}</code>
          <br />
          Sui Bridge (shared): <code>{SUI_BRIDGE_ID}</code>
          <br />
          Sui TreasuryCap: <code>{SUI_CAP_ID}</code>
        </div>
      </div>

      {/* Basic checks */}
      <div style={box}>
        <div style={{ fontWeight: 700, marginBottom: 8 }}>Basic checks</div>

        <button style={btn} disabled={busy} onClick={() => doGet("/health", "Check API /health")}>
          Check API /health
        </button>
      </div>

      {/* Init Sui bridge */}
      <div style={box}>
        <div style={{ fontWeight: 700, marginBottom: 8 }}>Init Sui Bridge</div>
        <button
          style={btn}
          disabled={busy}
          onClick={() => doPost("/sui/init-bridge", {}, "Init Sui Bridge", ["ok", "step", "digest"])}
        >
          Init Sui Bridge
        </button>
        <div style={smallNote}>Run once per fresh localnet / regenesis.</div>
      </div>

      {/* ETH -> Sui */}
      <div style={box}>
        <div style={{ fontWeight: 700, marginBottom: 8 }}>ETH → Sui</div>

        <div>
          <div style={smallNote}>Sui recipient</div>
          <input style={input} value={suiRecipient} onChange={(e) => setSuiRecipient(e.target.value)} />
        </div>

        <div>
          <div style={smallNote}>Amount on ETH (wei)</div>
          <input style={input} value={ethAmountWei} onChange={(e) => setEthAmountWei(e.target.value)} />
        </div>

        <button
          style={btn}
          disabled={busy}
          onClick={async () => {
            const r = await doPost(
              "/eth/bridge-to-sui",
              {
                amountWei: ethAmountWei,
                suiRecipientBytes: suiAddressToBytes32(suiRecipient),
              },
              "ETH → Sui: burn on ETH (emit event)",
              ["ok", "step", "txHash", "amountWei"]
            );

            // if your API doesn’t return txHash as field, we try to extract it
            if (!r.txHash && r.castOutput) {
              const txHash = extractEthTxHashFromCastOutput(r.castOutput);
              if (txHash) {
                pushEvent({
                  at: new Date().toISOString(),
                  action: "ETH txHash (extracted)",
                  ok: true,
                  data: { txHash },
                });
              }
            }
          }}
        >
          1) Burn on ETH (emit event)
        </button>

        <div style={{ height: 10 }} />

        <div>
          <div style={smallNote}>Amount on Sui (u64)</div>
          <input style={input} value={suiAmountU64} onChange={(e) => setSuiAmountU64(e.target.value)} />
          <div style={{ ...smallNote, marginTop: -6 }}>
            IBT on Sui has 9 decimals → 1 token = <code>1,000,000,000</code>
          </div>
        </div>

        <button
          style={btn}
          disabled={busy}
          onClick={() =>
            doPost(
              "/sui/mint",
              { capId: SUI_CAP_ID, amountU64: suiAmountU64, recipient: suiRecipient },
              "ETH → Sui: relayer mint on Sui",
              ["ok", "step", "digest"]
            )
          }
        >
          2) Relayer: Mint on Sui
        </button>
      </div>

      {/* Sui -> ETH */}
      <div style={box}>
        <div style={{ fontWeight: 700, marginBottom: 8 }}>Sui → ETH</div>

        <button
          style={btn}
          disabled={busy}
          onClick={async () => {
            const r = await doGet("/sui/latest-ibt-coin", "Find latest Sui Coin<IBT>");
            if (r?.found) {
              setSuiCoinId(r.objectId);
              pushEvent({
                at: new Date().toISOString(),
                action: "Auto-filled Coin<IBT>",
                ok: true,
                data: { suiCoinId: r.objectId },
              });
            } else {
              pushEvent({
                at: new Date().toISOString(),
                action: "Auto-filled Coin<IBT>",
                ok: false,
                error: { message: "No Coin<IBT> found. Mint on Sui first." },
              });
            }
          }}
        >
          Auto-fill Coin&lt;IBT&gt;
        </button>

        <button
          style={btn}
          disabled={busy}
          onClick={async () => {
            await doPost(
              "/sui/mint",
              { capId: SUI_CAP_ID, amountU64: suiAmountU64, recipient: suiRecipient },
              "Mint on Sui (prepare coin for lock)",
              ["ok", "step", "digest"]
            );
            const r = await doGet("/sui/latest-ibt-coin", "Find latest Sui Coin<IBT>");
            if (r?.found) setSuiCoinId(r.objectId);
          }}
        >
          Mint + Auto-fill Coin&lt;IBT&gt;
        </button>

        <div style={{ marginTop: 8 }}>
          <div style={smallNote}>IBT coin objectId (on Sui) — will be consumed on lock</div>
          <input style={input} value={suiCoinId} onChange={(e) => setSuiCoinId(e.target.value)} />
        </div>

        <div>
          <div style={smallNote}>
            ETH recipient bytes (20 bytes): <code>{ethAddressToBytes20(ethRecipient)}</code>
          </div>
        </div>

        <button
          style={btn}
          disabled={busy || !suiCoinId}
          onClick={async () => {
            const r = await doPost(
              "/sui/lock",
              {
                bridgeObjectId: SUI_BRIDGE_ID,
                coinObjectId: suiCoinId,
                ethRecipientBytes: ethAddressToBytes20(ethRecipient),
              },
              "Sui → ETH: lock on Sui",
              ["ok", "step", "digest"]
            );
            setLastSuiLockDigest(r.digest || "");
          }}
        >
          1) Lock on Sui (gets digest)
        </button>

        <div style={{ marginTop: 8 }}>
          <div style={smallNote}>Sui lock digest</div>
          <input
            style={input}
            value={lastSuiLockDigest}
            onChange={(e) => setLastSuiLockDigest(e.target.value)}
            placeholder="digest..."
          />
        </div>

        <button
          style={btn}
          disabled={busy || !lastSuiLockDigest}
          onClick={() =>
            doPost(
              "/eth/mint-from-sui",
              { to: ethRecipient, amountWei: ethAmountWei, suiDigest: lastSuiLockDigest },
              "Sui → ETH: relayer mint on ETH (from Sui digest)",
              ["ok", "step", "digest", "digestKeccak"]
            )
          }
        >
          2) Relayer: Mint on ETH (from Sui digest)
        </button>

        <div style={{ marginTop: 8, ...smallNote }}>
          Note: you lock <code>1e9</code> on Sui and mint <code>1e18</code> on ETH (unit mapping).
        </div>
      </div>

      {/* Activity log */}
      <div style={box}>
        <div style={{ fontWeight: 700, marginBottom: 8 }}>Activity</div>
        {events.length === 0 ? (
          <div style={smallNote}>(empty)</div>
        ) : (
          <div style={{ display: "grid", gap: 10 }}>
            {events.map((e, idx) => (
              <div
                key={idx}
                style={{
                  border: "1px solid #eee",
                  borderRadius: 12,
                  padding: 12,
                  background: "#fafafa",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
                  <b>{e.action}</b>
                  <span style={smallNote}>{e.at}</span>
                </div>

                {e.ok ? (
                  <pre style={{ margin: 0, whiteSpace: "pre-wrap" }}>
                    {JSON.stringify(e.data, null, 2)}
                  </pre>
                ) : (
                  <pre style={{ margin: 0, whiteSpace: "pre-wrap", color: "#b00020" }}>
                    {JSON.stringify(e.error, null, 2)}
                  </pre>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
