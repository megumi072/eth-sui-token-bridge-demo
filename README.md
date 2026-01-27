# ETH ↔ Sui Token Bridge Demo (IBT)

This repository contains a demo implementation of a token bridge between
Ethereum and Sui using Solidity (Foundry) and Sui Move.

The project shows how tokens can be locked/burned on one chain and minted
on the other chain using events and a simple manual relayer flow.

---

## Project structure

eth_ibt/  
- Solidity smart contracts  
- IBT token (ERC20-like)  
- BridgeEth contract (burn + mint with replay protection)

sui_ibt/  
- Sui Move package  
- Bridge shared object  
- IBT coin implementation  

---

## Technologies

- Ethereum local chain (Anvil + Foundry)  
- Solidity smart contracts  
- Sui localnet + Move  
- Manual relayer using transaction events and hashes  

---

## Bridge logic

### ETH → Sui

1. User holds IBT tokens on Ethereum  
2. User approves BridgeEth contract  
3. Tokens are burned on Ethereum  
4. Bridge emits event containing Sui recipient  
5. Relayer reads event and mints tokens on Sui  

---

### Sui → ETH

1. User locks/burns IBT tokens on Sui  
2. Sui transaction digest is generated  
3. Relayer computes:

   keccak256(Sui transaction digest)

4. Relayer calls mintFromSui on Ethereum  
5. BridgeEth mints IBT tokens on Ethereum  

Replay protection is enforced by storing used digests.

---

## How to run

### Ethereum side

cd eth_ibt
anvil
forge build
Deploy IBT and BridgeEth contracts and run transactions using cast.

### Sui side

cd sui_ibt
sui client active-env
sui client call ...
Use Sui CLI to mint and lock tokens.


## Notes
This is an educational demo and does not include production security
mechanisms such as light clients or cryptographic verification.

## Author
Madalina
