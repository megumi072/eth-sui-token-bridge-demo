import { useMemo, useState } from "react";
import axios from "axios";

export default function App() {
  const API = useMemo(() => "http://localhost:5050", []);

  const [busy, setBusy] = useState(false);

  const [status, setStatus] = useState("Idle");
  const [events, setEvents] = useState([]);

  
  const SUI_BRIDGE_ID =
    "0x542c42ac6282e4e0beceda33aabae9eb29bc0c3f11d7f1675b0717202d361318";
  const SUI_CAP_ID =
    "0xf9ee4563c8379033ab71185612ffcaa6ce788b7db9b674c6a44e09057b185a24";

  
  const [suiRecipient, setSuiRecipient] = useState(
    "0xe9de041c9eabae6ff64e36701acfff3da8868f8b7bc594a132886c30564d73ff"
  );

  const [suiAmountU64, setSuiAmountU64] = useState("1000000000");

  const [ethRecipient, setEthRecipient] = useState(
    "0x70997970C51812dc3A010C7d01b50e0d17dc79C8"
  );

  const [ethAmountWei, setEthAmountWei] = useState("1000000000000000000");

  const [suiCoinId, setSuiCoinId] = useState(
    "0xf8dcbd12235382b1a1bd4025444f6cef4748dc7c881ee817db20338874388d61"
  );
  const [lastSuiLockDigest, setLastSuiLockDigest] = useState("");

  function pushEvent(e) {
    setEvents((prev) => [e, ...prev].slice(0, 30)); // keep last 30
  }

  function clearLog() {
    setEvents([]);
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

  const box = {
    border: "1px solid #ddd",
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    maxWidth: 980,
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

  const btn = {
    padding: "10px 14px",
    borderRadius: 10,
    border: "1px solid #333",
    cursor: "pointer",
    marginRight: 10,
    marginBottom: 10,
    background: "white",
  };

  const smallNote = { opacity: 0.8, fontSize: 13 };

  return (
    <div style={{ padding: 18, fontFamily: "system-ui, Arial" }}>
      <h2 style={{ marginTop: 0 }}>ETH ↔ Sui Bridge Demo UI</h2>

      <div style={{ marginBottom: 14 }}>
        <b>Status:</b> {status} {busy ? "⏳" : ""}
        <button style={{ ...btn, marginLeft: 12 }} disabled={busy} onClick={clearLog}>
          Clear log
        </button>
      </div>

      <div style={box}>
        <h3 style={{ marginTop: 0 }}>Config (read-only)</h3>
        <div style={smallNote}>
          API: <code>{API}</code>
          <br />
          Sui Bridge (shared): <code>{SUI_BRIDGE_ID}</code>
          <br />
          Sui TreasuryCap: <code>{SUI_CAP_ID}</code>
        </div>
      </div>

      <div style={box}>
        <h3 style={{ marginTop: 0 }}>Basic checks</h3>

        <button style={btn} disabled={busy} onClick={() => doGet("/health", "Check API /health")}>
          Check API /health
        </button>

        <button
          style={btn}
          disabled={busy}
          onClick={() =>
            doPost(
              "/eth/balance",
              { address: ethRecipient },
              "Check ETH balance (ethRecipient)",
              ["ok", "step", "address", "balance", "balanceEth", "token"]
            )
          }
        >
          Check ETH IBT balance
        </button>

        <div style={{ marginTop: 8 }}>
          ETH recipient:
          <input style={input} value={ethRecipient} onChange={(e) => setEthRecipient(e.target.value)} />
        </div>
      </div>

      <div style={box}>
        <h3 style={{ marginTop: 0 }}>Init Sui Bridge</h3>
        <button
          style={btn}
          disabled={busy}
          onClick={() =>
            doPost("/sui/init-bridge", {}, "Init Sui Bridge", ["ok", "step", "relayer", "digest"])
          }
        >
          Init Sui Bridge
        </button>
        <div style={smallNote}>Do once per fresh localnet / regenesis.</div>
      </div>

      <div style={box}>
        <h3 style={{ marginTop: 0 }}>ETH → Sui</h3>

        <div>
          Sui recipient:
          <input style={input} value={suiRecipient} onChange={(e) => setSuiRecipient(e.target.value)} />
        </div>

        <div>
          Amount on ETH (wei):
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
              ["ok", "step", "txHash", "event", "amountWei", "suiRecipientBytes"]
            );

            // If API doesn't return txHash as a field, try to extract from castOutput
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

        <hr style={{ margin: "14px 0" }} />

        <div>
          Amount on Sui (u64):
          <input style={input} value={suiAmountU64} onChange={(e) => setSuiAmountU64(e.target.value)} />
          <div style={{ ...smallNote, marginTop: -8 }}>
            Sui IBT has 9 decimals → 1 token = <code>1,000,000,000</code>
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

      <div style={box}>
        <h3 style={{ marginTop: 0 }}>Sui → ETH</h3>
	<button
          style={btn}
          disabled={busy}
          onClick={async () => {
            const r = await doGet("/sui/latest-ibt-coin", "Find latest Sui Coin<IBT>");
            if (r.found) {
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
            if (r.found) setSuiCoinId(r.objectId);
          }}
        >
          Mint + Auto-fill Coin&lt;IBT&gt;
        </button>

        <div>
          IBT coin objectId (on Sui):
          <input style={input} value={suiCoinId} onChange={(e) => setSuiCoinId(e.target.value)} />
          <div style={{ ...smallNote, marginTop: -8 }}>
            After minting on Sui, copy the created Coin&lt;IBT&gt; objectId here. Lock will consume (delete) it.
          </div>
        </div>

        <div>
          ETH recipient:
          <input style={input} value={ethRecipient} onChange={(e) => setEthRecipient(e.target.value)} />
          <div style={{ ...smallNote, marginTop: -8 }}>
            Sent as bytes (20 bytes): <code>{ethAddressToBytes20(ethRecipient)}</code>
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

        <div>
          Sui lock digest:
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
              "Sui → ETH: relayer mint on ETH (from digest)",
              ["ok", "step", "digest", "digestKeccak", "txHash"]
            )
          }
        >
          2) Relayer: Mint on ETH (from Sui digest)
        </button>

        <div style={{ marginTop: 8, ...smallNote }}>
          Demo note: you lock <code>1e9</code> on Sui and mint <code>1e18</code> on ETH (decimals differ).
        </div>
      </div>

      <div style={box}>
        <h3 style={{ marginTop: 0 }}>Clean log</h3>
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
                <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
                  <b>{e.action}</b>
                  <span style={{ ...smallNote }}>{e.at}</span>
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

