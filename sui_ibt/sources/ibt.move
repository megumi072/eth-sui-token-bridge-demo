module sui_ibt::ibt {

    use sui::coin::{Self, Coin, TreasuryCap, CoinMetadata};
    use sui::tx_context::TxContext;
    use sui::transfer;
    use sui::object::UID;
    use sui::balance;
    use sui::event;

    /// ================= TOKEN =================

    /// One-Time Witness pentru token
    public struct IBT has drop {}

    /// Init corect cu OTW
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

    /// ================= BRIDGE =================

    public struct Bridge has key {
        id: UID,
        relayer: address,
        nonce: u64,
        vault: balance::Balance<IBT>,
    }

    public struct LockEvent has copy, drop {
        nonce: u64,
        sender: address,
        amount: u64,
        eth_recipient: vector<u8>,
    }

    public struct ReleaseEvent has copy, drop {
        nonce: u64,
        recipient: address,
        amount: u64,
    }

    public fun init_bridge(relayer: address, ctx: &mut TxContext) {
        let b = Bridge {
            id: object::new(ctx),
            relayer,
            nonce: 0,
            vault: balance::zero<IBT>(),
        };
        transfer::share_object(b);
    }

    public fun lock(
        bridge: &mut Bridge,
        c: Coin<IBT>,
        eth_recipient: vector<u8>,
        ctx: &mut TxContext
    ) {
        let sender = tx_context::sender(ctx);
        let amount = coin::value(&c);

        let bal = coin::into_balance(c);
        balance::join(&mut bridge.vault, bal);

        let n = bridge.nonce;
        bridge.nonce = n + 1;

        event::emit(
            LockEvent { nonce: n, sender, amount, eth_recipient }
        );
    }

    public fun release(
        bridge: &mut Bridge,
        amount: u64,
        recipient: address,
        ctx: &mut TxContext
    ) {
        assert!(tx_context::sender(ctx) == bridge.relayer, 0);

        let n = bridge.nonce;
        bridge.nonce = n + 1;

        let c = coin::take(&mut bridge.vault, amount, ctx);
        transfer::public_transfer(c, recipient);

        event::emit(
            ReleaseEvent { nonce: n, recipient, amount }
        );
    }
}

