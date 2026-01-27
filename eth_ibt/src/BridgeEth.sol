// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

interface IIBT {
    function mint(address to, uint256 amount) external;
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
}

import {Ownable} from "openzeppelin-contracts/contracts/access/Ownable.sol";

contract BridgeEth is Ownable {
    // NOTE: forge-lint suggests SCREAMING_SNAKE_CASE for immutables, so IBT instead of ibt
    IIBT public immutable IBT;

    /// @dev replay protection: Sui burn/lock digest (or any unique id) -> processed?
    mapping(bytes32 => bool) public processedSuiDigests;

    error AlreadyProcessed(bytes32 digest);

    event BurnToSui(address indexed from, uint256 amount, bytes suiRecipient);
    event MintFromSui(address indexed to, uint256 amount, bytes32 suiBurnTxDigest);

    constructor(address ibtAddress) Ownable(msg.sender) {
        IBT = IIBT(ibtAddress);
    }

    /// @notice User burns/locks on Ethereum side (here: transfer to this contract then emit)
    function bridgeToSui(uint256 amount, bytes calldata suiRecipient) external {
        // pull tokens from user (requires approve(user -> BridgeEth))
        bool ok = IBT.transferFrom(msg.sender, address(this), amount);
        require(ok, "transferFrom failed");

        emit BurnToSui(msg.sender, amount, suiRecipient);
    }

    /// @notice Relayer/owner mints on Ethereum based on unique Sui digest
    function mintFromSui(address to, uint256 amount, bytes32 suiBurnTxDigest) external onlyOwner {
        if (processedSuiDigests[suiBurnTxDigest]) revert AlreadyProcessed(suiBurnTxDigest);

        // mark BEFORE external call (safer)
        processedSuiDigests[suiBurnTxDigest] = true;

        IBT.mint(to, amount);
        emit MintFromSui(to, amount, suiBurnTxDigest);
    }
}

 
