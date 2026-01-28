require("dotenv").config();

const express = require("express");
const cors = require("cors");
const { spawn } = require("child_process");
const path = require("path");

const app = express();
app.use(cors());
app.use(express.json());

const REPO_ROOT = path.resolve(__dirname, "..");
const ETH_DIR = path.join(REPO_ROOT, "eth_ibt");

function toBigIntAny(x) {
  if (x === null || x === undefined) throw new Error("toBigIntAny: empty value");
  let s = String(x).trim();
  s = s.split(" [")[0].split(/\s+/)[0].trim();
  if (s.startsWith("0x") || s.startsWith("0X")) return BigInt(s);
  if (/^[0-9]+$/.test(s)) return BigInt(s);

  const m = s.match(/^([0-9]+)(?:\.([0-9]+))?[eE]([+-]?[0-9]+)$/);
  if (!m) throw new Error(`Cannot convert "${s}" to BigInt`);

  const intPart = m[1];
  const fracPart = m[2] || "";
  const exp = parseInt(m[3], 10);

  const digits = (intPart + fracPart).replace(/^0+/, "") || "0";
  const fracLen = fracPart.length;
  const pow = exp - fracLen;

  if (pow >= 0) return BigInt(digits + "0".repeat(pow));

  const cut = digits.length + pow;
  if (cut <= 0) return 0n;
  return BigInt(digits.slice(0, cut));
}

function run(cmd, args, cwd = REPO_ROOT) {
  return new Promise((resolve, reject) => {
    const p = spawn(cmd, args, { cwd, env: process.env });
    let stdout = "";
    let stderr = "";
    p.stdout.on("data", (d) => (stdout += d.toString()));
    p.stderr.on("data", (d) => (stderr += d.toString()));
    p.on("close", (code) => {
      if (code === 0) resolve({ stdout, stderr });
      else reject(new Error(`FAILED (${code})\n${stderr || stdout}`));
    });
  });
}

function bash(cmd, cwd = REPO_ROOT) {
  return run("bash", ["-lc", cmd], cwd);
}

async function castCall(to, sig, args = []) {
  const rpc = process.env.ETH_RPC;
  if (!rpc) throw new Error("Missing ETH_RPC");
  const r = await run("cast", ["call", to, sig, ...args, "--rpc-url", rpc], ETH_DIR);
  return r.stdout.trim();
}

async function castSend(pk, to, sig, args = []) {
  const rpc = process.env.ETH_RPC;
  if (!rpc) throw new Error("Missing ETH_RPC");
  if (!pk) throw new Error("Missing private key for castSend");
  const r = await run(
    "cast",
    ["send", "--rpc-url", rpc, "--private-key", pk, to, sig, ...args],
    ETH_DIR
  );
  return r.stdout.trim();
}

function extractEthTxHash(castOutput) {
  const m = String(castOutput || "").match(/transactionHash\s+0x[0-9a-fA-F]{64}/);
  return m ? m[0].split(/\s+/).pop() : null;
}

function safeJsonParse(s) {
  try {
    return JSON.parse(s);
  } catch {
    return null;
  }
}

async function suiActiveAddress() {
  return (await bash("sui client active-address")).stdout.trim();
}

function formatUnits9(u64Like) {
  const x = BigInt(String(u64Like).trim());
  const whole = x / 10n ** 9n;
  const frac = x % 10n ** 9n;
  const fracStr = frac.toString().padStart(9, "0").slice(0, 6);
  return `${whole.toString()}.${fracStr}`.replace(/\.?0+$/, "");
}

app.get("/health", (req, res) => {
  res.json({
    ok: true,
    repo: REPO_ROOT,
    ethDir: ETH_DIR,
    ethRpc: process.env.ETH_RPC,
    ethIbt: process.env.ETH_IBT_ADDRESS,
    ethBridge: process.env.ETH_BRIDGE_ADDRESS,
    suiEnv: process.env.SUI_ENV,
    suiPackageId: process.env.SUI_PACKAGE_ID,
  });
});

app.post("/eth/balance", async (req, res) => {
  try {
    const { address } = req.body;
    if (!address) return res.status(400).json({ ok: false, error: "Need address" });
    if (!process.env.ETH_IBT_ADDRESS) return res.status(400).json({ ok: false, error: "Missing ETH_IBT_ADDRESS" });

    const balWeiRaw = await castCall(
      process.env.ETH_IBT_ADDRESS,
      "balanceOf(address)(uint256)",
      [address]
    );

    const balWeiBig = toBigIntAny(balWeiRaw);

    const whole = balWeiBig / 10n ** 18n;
    const frac = balWeiBig % 10n ** 18n;
    const fracStr = frac.toString().padStart(18, "0").slice(0, 6);
    const balanceEth = `${whole.toString()}.${fracStr}`.replace(/\.?0+$/, "");

    res.json({
      ok: true,
      address,
      balance: balWeiBig.toString(),
      balanceEth,
      token: "IBT",
    });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

app.post("/eth/bridge-to-sui", async (req, res) => {
  try {
    const { amountWei, suiRecipientBytes } = req.body;
    if (!amountWei || !suiRecipientBytes) {
      return res.status(400).json({ ok: false, error: "Need amountWei, suiRecipientBytes" });
    }
    if (!process.env.ETH_IBT_ADDRESS) return res.status(400).json({ ok: false, error: "Missing ETH_IBT_ADDRESS" });
    if (!process.env.ETH_BRIDGE_ADDRESS) return res.status(400).json({ ok: false, error: "Missing ETH_BRIDGE_ADDRESS" });
    if (!process.env.ETH_USER_PK) return res.status(400).json({ ok: false, error: "Missing ETH_USER_PK" });

    await castSend(
      process.env.ETH_USER_PK,
      process.env.ETH_IBT_ADDRESS,
      "approve(address,uint256)(bool)",
      [process.env.ETH_BRIDGE_ADDRESS, amountWei]
    );

    const out = await castSend(
      process.env.ETH_USER_PK,
      process.env.ETH_BRIDGE_ADDRESS,
      "bridgeToSui(uint256,bytes)",
      [amountWei, suiRecipientBytes]
    );

    res.json({
      ok: true,
      step: "ETH_TO_SUI_SENT",
      txHash: extractEthTxHash(out),
      amountWei,
      castOutput: out,
    });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

app.post("/eth/mint-from-sui", async (req, res) => {
  try {
    const { to, amountWei, suiDigest } = req.body;
    if (!to || !amountWei || !suiDigest) {
      return res.status(400).json({ ok: false, error: "Need to, amountWei, suiDigest" });
    }
    if (!process.env.ETH_BRIDGE_ADDRESS) return res.status(400).json({ ok: false, error: "Missing ETH_BRIDGE_ADDRESS" });
    if (!process.env.ETH_OWNER_PK) return res.status(400).json({ ok: false, error: "Missing ETH_OWNER_PK" });

    const k = (await run("cast", ["keccak", suiDigest], ETH_DIR)).stdout.trim();

    const out = await castSend(
      process.env.ETH_OWNER_PK,
      process.env.ETH_BRIDGE_ADDRESS,
      "mintFromSui(address,uint256,bytes32)",
      [to, amountWei, k]
    );

    res.json({
      ok: true,
      step: "MINTED_ON_ETH",
      digest: suiDigest,
      digestKeccak: k,
      txHash: extractEthTxHash(out),
      castOutput: out,
    });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

app.post("/sui/init-bridge", async (req, res) => {
  try {
    const packageId = process.env.SUI_PACKAGE_ID;
    if (!packageId) return res.status(400).json({ ok: false, error: "Missing SUI_PACKAGE_ID" });

    const rel = await suiActiveAddress();

    const r = await bash(
      `sui client call --package ${packageId} --module ibt --function init_bridge --args ${rel} --gas-budget 20000000`
    );

    const output = r.stdout;
    const m = output.match(/Transaction Digest:\s*([A-Za-z0-9]+)/);
    const digest = m ? m[1] : null;

    res.json({ ok: true, step: "SUI_BRIDGE_INIT", relayer: rel, digest, raw: output });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

app.post("/sui/mint", async (req, res) => {
  try {
    const { capId, amountU64, recipient } = req.body;
    if (!capId || !amountU64 || !recipient) {
      return res.status(400).json({ ok: false, error: "Need capId, amountU64, recipient" });
    }

    const packageId = process.env.SUI_PACKAGE_ID;
    if (!packageId) return res.status(400).json({ ok: false, error: "Missing SUI_PACKAGE_ID" });

    const r = await bash(
      `sui client call --package ${packageId} --module ibt --function mint --args ${capId} ${amountU64} ${recipient} --gas-budget 20000000`
    );

    const output = r.stdout;
    const m = output.match(/Transaction Digest:\s*([A-Za-z0-9]+)/);
    const digest = m ? m[1] : null;

    res.json({ ok: true, step: "SUI_MINT_SENT", digest, raw: output });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

app.post("/sui/lock", async (req, res) => {
  try {
    const { bridgeObjectId, coinObjectId, ethRecipientBytes } = req.body;

    if (!bridgeObjectId || !coinObjectId || !ethRecipientBytes) {
      return res.status(400).json({ ok: false, error: "Need bridgeObjectId, coinObjectId, ethRecipientBytes" });
    }

    const packageId = process.env.SUI_PACKAGE_ID;
    if (!packageId) return res.status(400).json({ ok: false, error: "Missing SUI_PACKAGE_ID" });

    const r = await bash(
      `sui client call --package ${packageId} --module ibt --function lock --args ${bridgeObjectId} ${coinObjectId} ${ethRecipientBytes} --gas-budget 40000000`
    );

    const output = r.stdout;
    const m = output.match(/Transaction Digest:\s*([A-Za-z0-9]+)/);
    const digest = m ? m[1] : null;

    res.json({ ok: true, step: "SUI_LOCK_SENT", digest, raw: output });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

app.post("/sui/release", async (req, res) => {
  try {
    const { bridgeObjectId, amountU64, recipient } = req.body;

    if (!bridgeObjectId || !amountU64 || !recipient) {
      return res.status(400).json({ ok: false, error: "Need bridgeObjectId, amountU64, recipient" });
    }

    const packageId = process.env.SUI_PACKAGE_ID;
    if (!packageId) return res.status(400).json({ ok: false, error: "Missing SUI_PACKAGE_ID" });

    const r = await bash(
      `sui client call --package ${packageId} --module ibt --function release --args ${bridgeObjectId} ${amountU64} ${recipient} --gas-budget 20000000`
    );

    const output = r.stdout;
    const m = output.match(/Transaction Digest:\s*([A-Za-z0-9]+)/);
    const digest = m ? m[1] : null;

    res.json({ ok: true, step: "SUI_RELEASE_SENT", digest, raw: output });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

app.get("/sui/balance", async (req, res) => {
  try {
    const packageId = process.env.SUI_PACKAGE_ID;
    if (!packageId) return res.status(400).json({ ok: false, error: "Missing SUI_PACKAGE_ID" });

    const owner = await suiActiveAddress();
    const coinType = `${packageId}::ibt::IBT`;
    const fullType = `0x2::coin::Coin<${coinType}>`.toLowerCase();

    const r = await bash(`sui client objects ${owner} --json`);
    const parsed = safeJsonParse(r.stdout);

    const items = Array.isArray(parsed) ? parsed : (parsed?.data || parsed?.objects || []);
    if (!Array.isArray(items)) {
      return res.status(500).json({ ok: false, error: "Unexpected sui client objects JSON shape" });
    }

    let total = 0n;
    const coins = [];

    for (const o of items) {
      const data = o.data || o;
      const type = (data.type || data.objectType || "").toLowerCase();
      const objectId = data.objectId;
      if (!objectId || type !== fullType) continue;

      const objJson = safeJsonParse((await bash(`sui client object ${objectId} --json`)).stdout);
      const balStr =
        objJson?.data?.content?.fields?.balance ??
        objJson?.content?.fields?.balance ??
        "0";

      const bal = BigInt(balStr);
      total += bal;
      coins.push({ objectId, balanceU64: balStr });
    }

    const balanceIbt = formatUnits9(total.toString());

    res.json({
      ok: true,
      owner,
      coinType,
      balanceU64: total.toString(),
      balanceIbt,
      coins,
    });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

app.get("/sui/latest-ibt-coin", async (req, res) => {
  try {
    const packageId = process.env.SUI_PACKAGE_ID;
    if (!packageId) return res.status(400).json({ ok: false, error: "Missing SUI_PACKAGE_ID" });

    const owner = await suiActiveAddress();

    const r = await bash(`sui client objects ${owner} --json`);
    const parsed = safeJsonParse(r.stdout);

    const items = Array.isArray(parsed) ? parsed : (parsed?.data || parsed?.objects || []);
    const targetType = `0x2::coin::Coin<${packageId}::ibt::IBT>`.toLowerCase();

    const coins = (Array.isArray(items) ? items : [])
      .map((o) => {
        const data = o.data || o;
        return {
          objectId: data.objectId,
          type: (data.type || data.objectType || "").toLowerCase(),
          version: Number(data.version || 0),
        };
      })
      .filter((x) => x.objectId && x.type === targetType);

    if (coins.length === 0) {
      return res.json({ ok: true, found: false, owner, coinType: targetType });
    }

    coins.sort((a, b) => b.version - a.version);
    const best = coins[0];

    res.json({
      ok: true,
      found: true,
      owner,
      objectId: best.objectId,
      version: best.version,
      type: `0x2::coin::Coin<${packageId}::ibt::IBT>`,
    });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

const PORT = process.env.PORT || 5050;
app.listen(PORT, () => console.log(`Bridge API on http://localhost:${PORT}`));
