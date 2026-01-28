# ETH ↔ Sui Token Bridge (IBT Demo)

This project is a local demo implementation of a bidirectional token bridge between Ethereum and Sui.

It allows:

- Locking tokens on Sui and minting wrapped tokens on Ethereum  
- Locking tokens on Ethereum and minting wrapped tokens on Sui  

The bridge is implemented using:

- Ethereum smart contracts (Foundry)
- Sui Move modules
- A simple relayer-style API
- A React UI for end-to-end interaction

## 📁 Project Structure

- bridge-project/
- │
- ├── eth_ibt/ 
- ├── sui_ibt/ 
- ├── bridge-api/ 
- ├── bridge-ui/
- └── README.md

## ⚙️ Prerequisites

Make sure you have installed:

- Node.js (v18+ recommended)
- Foundry (`forge`, `anvil`)
- Sui CLI

---

## 🚀 Running the Demo (Local)

### 1️ Start Ethereum local network


anvil

### 2 Deploy Ethereum bridge contracts
cd eth_ibt
forge script script/DeployBridge.s.sol --broadcast --rpc-url http://localhost:8545
### 3️ Start Sui localnet (or use existing genesis)
sui start
#### In another terminal:

cd sui_ibt
sui client publish --gas-budget 200000000
### 4️ Start the API (relayer)
cd bridge-api
npm install
node server.js
API runs on:

http://localhost:5050
### 5️ Start the UI
cd bridge-ui
npm install
npm run dev
UI runs on:

http://localhost:5173
## 🔁 Bridge Flow Overview
### ▶️ Sui → Ethereum
Mint IBT tokens on Sui

Lock tokens in Sui Bridge object

Sui emits LockEvent

API takes Sui transaction digest

Ethereum mints wrapped tokens

### ▶️ Ethereum → Sui
Lock tokens on Ethereum bridge contract

Ethereum emits event

API triggers mint on Sui using TreasuryCap

User receives IBT tokens on Sui

## 🖥️ UI Demo
The React UI allows:

Minting tokens on Sui

Locking tokens on Sui

Minting on Ethereum using Sui digest

(and vice-versa for ETH → Sui)

All interactions are performed from the browser without manual CLI calls.

## 📌 Notes
This is a local demo for educational purposes

Uses manual relayer logic via API (not decentralized)

Replay protection implemented using digests

## Author
Madalina
