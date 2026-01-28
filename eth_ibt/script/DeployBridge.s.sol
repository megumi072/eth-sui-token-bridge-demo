// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Script.sol";
import {IBT} from "../src/IBT.sol";
import {BridgeEth} from "../src/BridgeEth.sol";

contract DeployBridgeScript is Script {
    function run() external returns (IBT token, BridgeEth bridge) {
        address user = 0x70997970C51812dc3A010C7d01b50e0d17dc79C8;

        vm.startBroadcast();

        token = new IBT();
        bridge = new BridgeEth(address(token));

        token.mint(user, 10_000 ether);
        token.transferOwnership(address(bridge));

        vm.stopBroadcast();
    }
}

