import type { WalletDataStateAccount } from "@radixdlt/radix-dapp-toolkit";
import { type Balances, type Integration } from "./integrations.svelte";

interface State {
    items: Integration[];
}
export let instructions = $state({ items: new Array() } as State);

export let manifest = $state({
    string: new Promise<string>(() => {
        return '';
    })
});


export let current_epoch = $state({
    number: 0
});

interface Worktops {
    [key: number]: Balances;  // Specify the type of the values; change as needed
}

export let isConnected = $state({ bool: false });
export let accounts = $state({ accounts: [] as WalletDataStateAccount[] });
export let gatewayApi = $state({ api: null } as any);


export let worktops = $state({
} as Worktops);

for (let i = 0; i < 100; i++) {
    worktops[i] = {
        fungibles: [],
        nonFungibles: []
    }
}

