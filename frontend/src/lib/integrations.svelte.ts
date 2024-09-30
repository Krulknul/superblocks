import { getBalancesForAccount, getTokensMetadata } from "$lib"
import type { WalletDataStateAccount } from "@radixdlt/radix-dapp-toolkit"
import { GatewayApiClient, RadixNetwork } from "@radixdlt/babylon-gateway-api-sdk";

function generateRandomNumberString(length: number) {
    let result = '';
    for (let i = 0; i < length; i++) {
        result += Math.floor(Math.random() * 10); // Generates a random number between 0 and 9
    }
    return result;
}

export enum OptionType {
    ResourceAddress = "ResourceAddress",
    ComponentAddress = "ComponentAddress",
    Decimal = "Decimal",
}

const gateway = GatewayApiClient.initialize({
    applicationName: "Dapp",
    applicationVersion: "1.0.0",
    networkId: RadixNetwork.Mainnet,
});

type Inputs = {
    [key: string]: {
        name: string,
        type: OptionType,
        value: string
        resolver?: (accounts: WalletDataStateAccount[], worktop: Balances | null, inputs: Inputs) => Promise<{ value: string, label: string }[]>
    }
}

export interface Balances {
    fungibles: FungibleBalance[],
    nonFungibles: NFTBalance[]
}

export interface NFTBalance {
    resouceAddress: string,
    localIds: string[],
}

export interface FungibleBalance {
    resouceAddress: string,
    symbol: string | null,
    name: string | null,
    iconUrl: string | null,
    amount: string,
}

export interface Integration {
    name: string,
    inputs: Inputs,
    evaluate: () => Promise<string>,
    // instantiate: () => Integration
}


export class OciswapSwapPlugin implements Integration {
    name = "Ociswap routed swap"
    #tokenResolver = async (accounts: WalletDataStateAccount[], worktop: Balances) => {
        const options = { method: 'GET', headers: { accept: 'application/json' } };

        const result = await fetch('https://api.ociswap.com/tokens?limit=100', options)
        const body = await result.json()
        console.log("ociswap tokens", body)

        return body.data.map((token: any) => { return { value: token.address, label: token.name } })
    }
    inputs = $state({
        input_address: {
            name: "Input Resource",
            type: OptionType.ResourceAddress,
            value: "",
            resolver: (accounts, worktop) => {
                if (!worktop) return []
                return worktop.fungibles.map(fungible => { return { value: fungible.resouceAddress, label: fungible.symbol || "no symbol" } })
            }
        },
        input_amount: {
            name: "Input Amount",
            type: OptionType.Decimal,
            value: ""
        },
        output_address: {
            name: "Output Resource",
            type: OptionType.ResourceAddress,
            value: "",
            resolver: this.#tokenResolver
        }
    })

    async evaluate() {
        const options = { method: 'GET', headers: { accept: 'application/json' } }
        const { input_address, input_amount, output_address } = this.inputs
        console.log("input_address", input_address)
        const response = await fetch(`https://api.ociswap.com/preview/swap?input_address=${input_address.value}&input_amount=${input_amount.value}&output_address=${output_address.value}`, options)
        const body = await response.json()
        let manifest = ''
        console.log("body", body)
        for (const swap of body.swaps) {
            let bucket = generateRandomNumberString(5)

            manifest += `
                TAKE_FROM_WORKTOP
                    Address("${swap.input_address}")
                    Decimal("${swap.input_amount.token}")
                    Bucket("${bucket}")
                ;
                `

            manifest += `
            CALL_METHOD
                Address("${swap.pool_address}")
                "swap"
                    Bucket("${bucket}")
            ;
            `
        }

        return manifest
    }
}

export class DefiPlazaPlugin implements Integration {
    name = "DefiPlaza Swap"
    inputs: Inputs = $state({
        inputAddress: {
            name: "Input Resource",
            type: OptionType.ResourceAddress,
            value: "",
            resolver: async (accounts, worktop) => {
                return worktop?.fungibles.map(fungible => { return { value: fungible.resouceAddress, label: fungible.symbol || "no symbol" } })
            }
        },
        inputAmount: {
            name: "Input Amount",
            type: OptionType.Decimal,
            value: ""
        },
        outputAddress: {
            name: "Output Resource",
            type: OptionType.ResourceAddress,
            value: "",
            resolver: async (accounts, worktop) => {
                const url = 'https://corsproxy.io/?' + encodeURIComponent("https://radix.defiplaza.net/api/pairs");
                const response = await fetch(url)
                const body = await response.json()
                const metadatas = await getTokensMetadata(gateway, body.data.map((pair: any) => pair.baseToken))
                console.log("pairs", body)
                console.log("metadatas", metadatas)
                return body.data.map((pair: any) => { return { value: pair.baseToken, label: metadatas[pair.baseToken].name } })
            }
        }
    })
    evaluate = async () => {
        const { inputAddress, inputAmount, outputAddress } = this.inputs

        const url = 'https://corsproxy.io/?' + encodeURIComponent("https://radix.defiplaza.net/api/pairs");
        const response = await fetch(url)
        const body = await response.json()
        let bucket = generateRandomNumberString(5)

        const exchange = body.data.find((pair: any) => pair.baseToken == outputAddress.value)
        const manifest = `
            TAKE_FROM_WORKTOP
                Address("${inputAddress.value}")
                Decimal("${inputAmount.value}")
                Bucket("${bucket}")
            ;
            CALL_METHOD
                Address("${exchange.dexAddress}")
                "swap"
                Bucket("${bucket}")
                Address("${outputAddress.value}")
            ;
            `
        return manifest
    }
}


export class DepositPlugin implements Integration {
    name = "Deposit"
    inputs: Inputs = $state({
        account_address: {
            name: "Account",
            type: OptionType.ResourceAddress,
            value: "",
            resolver: async (accounts, worktop, inputs) => {
                return accounts.map(account => { return { value: account.address, label: account.label } })
            }
        },
        resource_address: {
            name: "Resource",
            type: OptionType.ResourceAddress,
            value: "",
        },
        amount: {
            name: "Amount",
            type: OptionType.Decimal,
            value: ""
        }
    })

    async evaluate() {
        const bucket = generateRandomNumberString(5)
        return `
        TAKE_FROM_WORKTOP
            Address("${this.inputs.resource_address.value}")
            Decimal("${this.inputs.amount.value}")
            Bucket("${bucket}")
        ;
        CALL_METHOD
            Address("${this.inputs.account_address.value}")
            "deposit"
            Bucket("${bucket}")
        ;`
    }
}


export class DepositAllPlugin implements Integration {
    name = "Deposit All"
    inputs: Inputs = $state({
        account_address: {
            name: "Account Address",
            type: OptionType.ResourceAddress,
            value: "",
            resolver: async (accounts, worktop) => {
                return accounts.map(account => { return { value: account.address, label: account.label } })
            }
        },
    })

    async evaluate() {
        const bucket = generateRandomNumberString(5)
        return `
        CALL_METHOD
            Address("${this.inputs.account_address.value}")
            "deposit_batch"
            Expression("ENTIRE_WORKTOP")
        ;`
    }
}

export class WithdrawalPlugin implements Integration {
    name = "Withdrawal"
    inputs: Inputs = $state({
        account_address: {
            name: "Account",
            type: OptionType.ResourceAddress,
            value: "",
            resolver: async (accounts, worktop, inputs) => {
                return accounts.map(account => { return { value: account.address, label: account.label } })
            }
        },
        resource_address: {
            name: "Resource",
            type: OptionType.ResourceAddress,
            value: "",
            resolver: async (accounts, worktop) => {
                console.log("wallet in resolver", this.inputs.account_address.value)

                const tokenBalances = await getBalancesForAccount(gateway, this.inputs.account_address.value)
                console.log("token balances", tokenBalances)
                return tokenBalances.fungibles.map(fungible => { return { value: fungible.resourceAddress, label: fungible.symbol || "no symbol" } })
            }
        },
        amount: {
            name: "Amount",
            type: OptionType.Decimal,
            value: ""
        }
    })

    async evaluate() {
        return `
        CALL_METHOD
            Address("${this.inputs.account_address.value}")
            "withdraw"
            Address("${this.inputs.resource_address.value}")
            Decimal("${this.inputs.amount.value}")
        ;`
    }
}






export const integrations: { id: number, item: Integration }[] = [
    { id: 0, item: new OciswapSwapPlugin() },
    { id: 1, item: new DepositPlugin() },
    { id: 2, item: new DepositAllPlugin() },
    { id: 3, item: new WithdrawalPlugin() },
    { id: 4, item: new DefiPlazaPlugin() },
]
