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
  const r = await run(
    "cast",
    ["call", to, sig, ...args, "--rpc-url", rpc],
    ETH_DIR
  );
  return r.stdout.trim();
}

async function castSend(pk, to, sig, args = []) {
  const rpc = process.env.ETH_RPC;
  const r = await run(
    "cast",
    ["send", "--rpc-url", rpc, "--private-key", pk, to, sig, ...args],
    ETH_DIR
  );
  return r.stdout.trim();
}

// --------- HEALTH ----------
app.get("/health", (req, res) => {
  res.json({
    ok: true,
    repo: REPO_ROOT,
    ethRpc: process.env.ETH_RPC,
    ethIbt: process.env.ETH_IBT_ADDRESS,
    ethBridge: process.env.ETH_BRIDGE_ADDRESS,
    suiEnv: process.env.SUI_ENV,
    suiPackageId: process.env.SUI_PACKAGE_ID,
  });
});

// --------- ETH ----------
app.post("/eth/balance", async (req, res) => {
  try {
    const { address } = req.body;
    const bal = await castCall(
      process.env.ETH_IBT_ADDRESS,
      "balanceOf(address)(uint256)",
      [address]
    );
    res.json({ ok: true, address, balance: bal });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

app.post("/eth/bridge-to-sui", async (req, res) => {
  const { amountWei, suiRecipientBytes } = req.body;
  try {
    // approve
    await castSend(
      process.env.ETH_USER_PK,
      process.env.ETH_IBT_ADDRESS,
      "approve(address,uint256)(bool)",
      [process.env.ETH_BRIDGE_ADDRESS, amountWei]
    );

    // bridgeToSui
    const out = await castSend(
      process.env.ETH_USER_PK,
      process.env.ETH_BRIDGE_ADDRESS,
      "bridgeToSui(uint256,bytes)",
      [amountWei, suiRecipientBytes]
    );

    res.json({ ok: true, step: "ETH_TO_SUI_SENT", castOutput: out });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

app.post("/eth/mint-from-sui", async (req, res) => {
  const { to, amountWei, suiDigest } = req.body;
  try {
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
      castOutput: out,
    });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

// --------- SUI ----------
app.post("/sui/init-bridge", async (req, res) => {
  try {
    const packageId = process.env.SUI_PACKAGE_ID;

    // relayer = active address
    const rel = (await bash("sui client active-address")).stdout.trim();

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

    const r = await bash(
      `sui client call --package ${packageId} --module ibt --function mint ` +
      `--args ${capId} ${amountU64} ${recipient} --gas-budget 20000000`
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

    const r = await bash(
      `sui client call --package ${packageId} --module ibt --function lock ` +
      `--args ${bridgeObjectId} ${coinObjectId} ${ethRecipientBytes} --gas-budget 40000000`
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

    const r = await bash(
      `sui client call --package ${packageId} --module ibt --function release ` +
      `--args ${bridgeObjectId} ${amountU64} ${recipient} --gas-budget 20000000`
    );

    const output = r.stdout;
    const m = output.match(/Transaction Digest:\s*([A-Za-z0-9]+)/);
    const digest = m ? m[1] : null;

    res.json({ ok: true, step: "SUI_RELEASE_SENT", digest, raw: output });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

app.get("/sui/latest-ibt-coin", async (req, res) => {
  try {
    const packageId = process.env.SUI_PACKAGE_ID;
    // list objects as JSON
    const r = await bash(`sui client objects --json`);
    const objs = JSON.parse(r.stdout);

    // Find first object of type Coin<...::ibt::IBT> for your package
    const targetSuffix = `0x2::coin::Coin<${packageId}::ibt::IBT>`;

    const found = objs.find((o) => (o?.data?.type || "").toLowerCase() === targetSuffix.toLowerCase());

    if (!found) {
      return res.json({ ok: true, found: false });
    }

    res.json({
      ok: true,
      found: true,
      objectId: found.data.objectId,
      type: found.data.type,
    });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

const PORT = process.env.PORT || 5050;
app.listen(PORT, () => console.log(`Bridge API on http://localhost:${PORT}`));

