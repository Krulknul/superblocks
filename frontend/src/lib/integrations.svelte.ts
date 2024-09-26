import { getBalancesForAccount } from "$lib"
import type { WalletDataStateAccount } from "@radixdlt/radix-dapp-toolkit"
import { gatewayApi } from "./state.svelte"
import { GatewayApiClient, RadixNetwork } from "@radixdlt/babylon-gateway-api-sdk";

function generateRandomNumberString(length) {
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
        resolver?: (accounts: WalletDataStateAccount[], worktop: Balances, inputs: Inputs) => Promise<{ value: string, label: string }[]>
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
    amount: string,
}

export interface Integration {
    id: number,
    name: string,
    inputs: Inputs,
    evaluate: (inputs: Inputs) => Promise<string>,
    instantiate: () => Integration
}



function createOciswapSwapIntegration(): Integration {
    let id = 1;

    let inputs = $state({
        input_address: {
            name: "Input Resource",
            type: OptionType.ResourceAddress,
            value: ""
        },
        input_amount: {
            name: "Input Amount",
            type: OptionType.Decimal,
            value: ""
        },
        output_address: {
            name: "Output Resource",
            type: OptionType.ResourceAddress,
            value: ""
        }
    })

    async function evaluate() {
        const options = { method: 'GET', headers: { accept: 'application/json' } }
        const { input_address, input_amount, output_address } = inputs
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



    return {
        id,
        name: "Ociswap routed swap",
        get inputs() { return inputs },
        evaluate,
        instantiate: createOciswapSwapIntegration
    };
}

function createDepositIntegration(): Integration {
    let id = 3;

    let inputs = $state({
        account_address: {
            name: "Account Address",
            type: OptionType.ResourceAddress,
            value: "",
            resolver: async (accounts, worktop, inputs) => {
                return accounts.map(account => { return { value: account.address, label: account.label } })
            }
        },
        resource_address: {
            name: "Resource Address",
            type: OptionType.ResourceAddress,
            value: "",
        },
        amount: {
            name: "Amount",
            type: OptionType.Decimal,
            value: ""
        }
    } as Inputs)

    async function evaluate() {
        const bucket = generateRandomNumberString(5)
        return `
        TAKE_FROM_WORKTOP
            Address("${inputs.resource_address.value}")
            Decimal("${inputs.amount.value}")
            Bucket("${bucket}")
        ;
        CALL_METHOD
            Address("${inputs.account_address.value}")
            "deposit"
            Bucket("${bucket}")
        ;`
    }

    return {
        id,
        name: "Deposit",
        get inputs() { return inputs },
        evaluate,
        instantiate: createDepositIntegration
    };
}

function createDepositAllIntegration(): Integration {
    let id = 2;

    let inputs = $state({
        account_address: {
            name: "Account Address",
            type: OptionType.ResourceAddress,
            value: "",
            resolver: async (accounts, worktop, inputs) => {
                return accounts.map(account => { return { value: account.address, label: account.label } })
            }
        },
    } as Inputs)

    async function evaluate() {
        const bucket = generateRandomNumberString(5)
        return `
        CALL_METHOD
            Address("${inputs.account_address.value}")
            "deposit_batch"
            Expression("ENTIRE_WORKTOP")
        ;`
    }

    return {
        id,
        name: "Deposit All",
        get inputs() { return inputs },
        evaluate,
        instantiate: createDepositAllIntegration
    };
}

function createWithdrawalIntegration(): Integration {
    let id = 4;



    let inputs = $state({
        account_address: {
            name: "Account Address",
            type: OptionType.ResourceAddress,
            value: "",
            resolver: async (accounts, worktop, inputs) => {
                return accounts.map(account => { return { value: account.address, label: account.label } })
            }
        },
        resource_address: {
            name: "Resource Address",
            type: OptionType.ResourceAddress,
            value: "",
            resolver: async (accounts, worktop, inputs) => {
                console.log("wallet in resolver", inputs.account_address.value)

                const tokenBalances = await getBalancesForAccount(gateway, inputs.account_address.value)
                console.log("token balances", tokenBalances)
                return tokenBalances.fungibles.map(fungible => { return { value: fungible.resourceAddress, label: fungible.symbol } })
            }
        },
        amount: {
            name: "Amount",
            type: OptionType.Decimal,
            value: ""
        }
    } as Inputs)

    async function evaluate() {
        return `
        CALL_METHOD
            Address("${inputs.account_address.value}")
            "withdraw"
            Address("${inputs.resource_address.value}")
            Decimal("${inputs.amount.value}")
        ;`
    }

    return {
        id,
        name: "Withdrawal",
        get inputs() { return inputs },
        evaluate,
        instantiate: createWithdrawalIntegration
    };

}



export const integrations: Integration[] = [
    createWithdrawalIntegration(),
    createOciswapSwapIntegration(),
    createDepositIntegration(),
    createDepositAllIntegration(),
]
