module sui_ibt::ibt {

    use sui::coin::{Self, Coin, TreasuryCap, CoinMetadata};
    use sui::tx_context::TxContext;
    use sui::transfer;
    use sui::object::UID;
    use sui::event;

    /// ================= TOKEN =================

    public struct IBT has drop {}

    fun init(otw: IBT, ctx: &mut TxContext) {
        let (cap, metadata): (TreasuryCap<IBT>, CoinMetadata<IBT>) =
            coin::create_currency<IBT>(
                otw,
                9,
                b"InterBridgeToken",
                b"IBT",
                b"InterBridgeToken",
                option::none(),
                ctx
            );

        transfer::public_transfer(cap, tx_context::sender(ctx));
        transfer::public_transfer(metadata, tx_context::sender(ctx));
    }

    public fun mint(
        cap: &mut TreasuryCap<IBT>,
        amount: u64,
        recipient: address,
        ctx: &mut TxContext
    ) {
        let c: Coin<IBT> = coin::mint(cap, amount, ctx);
        transfer::public_transfer(c, recipient);
    }

    public fun burn(cap: &mut TreasuryCap<IBT>, c: Coin<IBT>) {
        coin::burn(cap, c);
    }

    /// ================= BRIDGE EVENTS =================

    public struct BurnEvent has copy, drop {
        sender: address,
        amount: u64,
        eth_recipient: vector<u8>,
    }

    public struct MintEvent has copy, drop {
        recipient: address,
        amount: u64,
    }

    /// User burns IBT on Sui → bridge to Ethereum
    public fun burn_for_bridge(
        cap: &mut TreasuryCap<IBT>,
        c: Coin<IBT>,
        eth_recipient: vector<u8>,
        ctx: &mut TxContext
    ) {
        let sender = tx_context::sender(ctx);
        let amount = coin::value(&c);

        coin::burn(cap, c);

        event::emit(
            BurnEvent { sender, amount, eth_recipient }
        );
    }

    /// Relayer mints IBT on Sui ← from Ethereum
    public fun mint_from_bridge(
        cap: &mut TreasuryCap<IBT>,
        amount: u64,
        recipient: address,
        ctx: &mut TxContext
    ) {
        let c = coin::mint(cap, amount, ctx);
        transfer::public_transfer(c, recipient);

        event::emit(
            MintEvent { recipient, amount }
        );
    }
}

