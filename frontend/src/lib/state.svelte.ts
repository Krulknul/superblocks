import { DataRequestBuilder, RadixDappToolkit, type WalletDataStateAccount } from "@radixdlt/radix-dapp-toolkit";
import { type Balances, type Integration } from "./integrations.svelte";
import { getTokensMetadata } from "$lib";
import { GatewayApiClient } from "@radixdlt/babylon-gateway-api-sdk";

export const rdt = RadixDappToolkit({
    gatewayBaseUrl: "https://mainnet.radixdlt.com",
    dAppDefinitionAddress:
        "account_rdx12x2ecj3kp4mhq9u34xrdh7njzyz0ewcz4szv0jw5jksxxssnjh7z6z",
    networkId: 1,
    applicationName: "Radix Web3 dApp",
    applicationVersion: "1.0.0",
});

const gateway = GatewayApiClient.initialize({
    applicationName: "Dapp",
    applicationVersion: "1.0.0",
    networkId: 1,
});

rdt.walletApi.walletData$.subscribe((walletData) => {
    if (walletData.accounts.length > 0) {
        isConnected.bool = true;
    } else {
        isConnected.bool = false;
    }
    accounts.accounts = walletData.accounts;
});

rdt.walletApi.setRequestData(DataRequestBuilder.accounts().atLeast(1));


const deposit_batch = `
CALL_METHOD
   Address("account_rdx12yspdmpd6jdgcffkk6vjkqa9fagf3wnha5xd06s3uje5wr9664arkf")
   "deposit_batch"
   Expression("ENTIRE_WORKTOP")
   ;
`;

class Worktops {
    private worktopsByID: Map<number, Balances> = new Map()
    private worktopsByIndex: Map<number, Balances> = new Map()


    getByIndex(index: number): Balances | null {
        return this.worktopsByIndex.get(index) || null
    }

    getByID(id: number): Balances {
        return this.worktopsByID.get(id) || {
            fungibles: [], nonFungibles: []
        };
    }

    set(id: number, index: number, balances: Balances) {
        this.worktopsByID.set(id, balances);
        this.worktopsByIndex.set(index, balances);
    }
}

export enum EvaluateStatus {
    Pending,
    Success,
    Error
}
class GlobalState {
    #instructions: { item: Integration, id: number }[] = $state([]);
    get instructions() {
        return this.#instructions;
    }

    #evaluateStatus: EvaluateStatus = $state(EvaluateStatus.Pending);
    get evaluateStatus() {
        return this.#evaluateStatus;
    }

    #results: {
        manifest: string,
        worktops: Worktops,
        stuckAt: number
    } = $state({
        manifest: "",
        worktops: new Worktops(),
        stuckAt: 0
    });
    get results() {
        return this.#results;
    }

    #timeout: number = 0;

    async updateResultsInternal() {
        const worktops = new Worktops();
        this.#evaluateStatus = EvaluateStatus.Pending;
        let manifest = `
        CALL_METHOD
        Address("${accounts.accounts[0]?.address}")
        "lock_fee"
        Decimal("5")
        ;
        `

        for (const [itemIndex, item] of this.instructions.entries()) {
            const result = await item.item.evaluate();
            manifest += result;
            console.log(manifest);
            try {
                const localManifest = manifest + deposit_batch;
                const previewResult =
                    await rdt.gatewayApi.transaction.innerClient.transactionPreview(
                        {
                            transactionPreviewRequest: {
                                start_epoch_inclusive:
                                    current_epoch.number,
                                end_epoch_exclusive:
                                    current_epoch.number + 10,
                                manifest: localManifest,
                                tip_percentage: 0,
                                nonce: Math.random() * 1000,
                                signer_public_keys: [],
                                flags: {
                                    skip_epoch_check: true,
                                    assume_all_signature_proofs: true,
                                    use_free_credit: false,
                                },
                            },
                        },
                    );
                console.log(previewResult);
                const worktop = (
                    Array.from(
                        previewResult.resource_changes.values(),
                    ).slice(-1)[0] as any
                ).resource_changes;
                let balances: Balances = {
                    fungibles: [],
                    nonFungibles: [],
                };
                const resources = worktop.map((item) => item.resource_address);
                const tokenMetadatas = await getTokensMetadata(gateway, resources);
                worktop.forEach((item) => {
                    balances.fungibles.push({
                        amount: item.amount,
                        resouceAddress: item.resource_address,
                        symbol: tokenMetadatas[item.resource_address]?.symbol || "No Symbol",
                        iconUrl: tokenMetadatas[item.resource_address]?.icon || null,
                        name: tokenMetadatas[item.resource_address]?.name || "No Name"
                    });
                });

                worktops.set(item.id, itemIndex, balances);
            } catch (e) {
                console.error(e);
                this.#results = {
                    manifest: manifest,
                    worktops: worktops,
                    stuckAt: itemIndex
                }
                this.#evaluateStatus = EvaluateStatus.Error;
                this.#results.stuckAt = itemIndex;
                return
            }
        }
        this.#results = {
            manifest: manifest,
            worktops: worktops,
            stuckAt: this.instructions.length
        }
        this.#evaluateStatus = EvaluateStatus.Success;
    }

    async updateResults() {
        clearTimeout(this.#timeout);
        this.#timeout = setTimeout(() => this.updateResultsInternal(), 1000);
    }

    updateInstructions(instructions: { item: Integration, id: number }[]) {
        this.#instructions = instructions;
        this.updateResults();
    }

    removeInstructionWithID(id: number) {
        this.#instructions = this.#instructions.filter((item) => item.id !== id);
        this.updateResults();
    }
}

export let globalState = new GlobalState();


export let current_epoch = $state({
    number: 0
});



export let isConnected = $state({ bool: false });
export let accounts = $state({ accounts: [] as WalletDataStateAccount[] });



export class InstructionsState {
    instructions = $state()
}