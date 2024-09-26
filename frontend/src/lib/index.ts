// place files you want to import through the `$lib` alias in this folder.

import { ResourceAggregationLevel, type GatewayApiClient } from "@radixdlt/babylon-gateway-api-sdk";

export interface FungibleResourceBalance {
    discriminator: "fungible";
    resourceAddress: string;
    name: string;
    symbol: string | null;
    icon?: string;
    amount: string;
}

export interface NonFungibleResourceBalance {
    discriminator: "nonFungible";
    resourceAddress: string;
    name: string;
    symbol: string | null;
    icon?: string;
    nonFungibleLocals: {
        id: string;
        keyImageUrl?: string;
        name?: string;
        description?: string;
    }[]
}

export async function getBalancesForAccount(gatewayApi: GatewayApiClient, address: string): Promise<{ nonFungibles: NonFungibleResourceBalance[], fungibles: FungibleResourceBalance[] }> {
    const fungibles = await gatewayApi.state.innerClient.entityFungiblesPage({
        stateEntityFungiblesPageRequest: {
            address: address,
            aggregation_level: ResourceAggregationLevel.Global,
        }
    });
    let next_cursor = fungibles.next_cursor;
    while (next_cursor) {
        const nextBalances = await gatewayApi.state.innerClient.entityFungiblesPage({
            stateEntityFungiblesPageRequest: {
                address: address,
                aggregation_level: ResourceAggregationLevel.Global,
                cursor: next_cursor,
                at_ledger_state: {
                    state_version: fungibles.ledger_state.state_version
                }
            }
        });
        next_cursor = nextBalances.next_cursor;
        fungibles.items.push(...nextBalances.items);
    }


    const nonFungibles = await gatewayApi.state.innerClient.entityNonFungiblesPage({
        stateEntityNonFungiblesPageRequest: {
            address: address,
            aggregation_level: ResourceAggregationLevel.Vault,
            opt_ins: {
                non_fungible_include_nfids: true
            }
        }
    });
    let next_cursor_non_fungibles = nonFungibles.next_cursor;
    while (next_cursor_non_fungibles) {
        const nextBalances = await gatewayApi.state.innerClient.entityNonFungiblesPage({
            stateEntityNonFungiblesPageRequest: {
                address: address,
                aggregation_level: ResourceAggregationLevel.Vault,
                cursor: next_cursor_non_fungibles,
                at_ledger_state: {
                    state_version: nonFungibles.ledger_state.state_version
                }
            }
        });
        next_cursor_non_fungibles = nextBalances.next_cursor;
        nonFungibles.items.push(...nextBalances.items);
    }


    const tokenAddresses = fungibles.items.map(item => item.resource_address).concat(nonFungibles.items.map(item => item.resource_address));
    const tokenInfoItems = await gatewayApi.state.getEntityDetailsVaultAggregated(tokenAddresses);


    const fungibleResults = fungibles.items.flatMap((item) => {
        if (item.aggregation_level !== ResourceAggregationLevel.Global) {
            throw new Error("Expected global aggregation level");
        }
        const tokenInfoItem = tokenInfoItems.find(tokenInfo => tokenInfo.address == item.resource_address);
        if (!tokenInfoItem) {
            return [];
        }
        if (tokenInfoItem?.details?.type != "FungibleResource") {
            return [];
        }

        const tokenName: string = (tokenInfoItem?.metadata.items.find(item => item.key == "name")?.value.programmatic_json as any).fields[0].value;
        let tokenSymbol;
        if (tokenInfoItem?.metadata.items.find(item => item.key == "symbol")?.value.programmatic_json) {
            tokenSymbol = (tokenInfoItem?.metadata.items.find(item => item.key == "symbol")?.value.programmatic_json as any).fields[0].value;
        } else {
            tokenSymbol = null;
        }

        let icon;
        if (tokenInfoItem?.metadata.items.find(item => item.key == "icon_url")?.value.programmatic_json) {
            icon = (tokenInfoItem?.metadata.items.find(item => item.key == "icon_url")?.value.programmatic_json as any).fields[0].value;
        } else {
            icon = null;
        }

        let balance: FungibleResourceBalance = {
            discriminator: "fungible",
            name: tokenName,
            symbol: tokenSymbol,
            resourceAddress: item.resource_address,
            amount: item.amount,
            icon,
        };
        return balance
    })

    const nonFungibleResults = nonFungibles.items.flatMap(async (item) => {
        if (item.aggregation_level !== ResourceAggregationLevel.Vault) {
            throw new Error("Expected global aggregation level");
        }
        const tokenInfoItem = tokenInfoItems.find(tokenInfo => tokenInfo.address == item.resource_address);
        if (!tokenInfoItem) {
            return [];
        }
        if (tokenInfoItem?.details?.type != "NonFungibleResource") {
            return [];
        }

        const tokenName: string = (tokenInfoItem?.metadata.items.find(item => item.key == "name")?.value.programmatic_json as any).fields[0].value;
        let tokenSymbol;
        if (tokenInfoItem?.metadata.items.find(item => item.key == "symbol")?.value.programmatic_json) {
            tokenSymbol = (tokenInfoItem?.metadata.items.find(item => item.key == "symbol")?.value.programmatic_json as any).fields[0].value;
        } else {
            tokenSymbol = null;
        }

        let icon;
        if (tokenInfoItem?.metadata.items.find(item => item.key == "icon_url")?.value.programmatic_json) {
            icon = (tokenInfoItem?.metadata.items.find(item => item.key == "icon_url")?.value.programmatic_json as any).fields[0].value;
        } else {
            icon = null;
        }


        let balance: NonFungibleResourceBalance = {
            discriminator: "nonFungible",
            name: tokenName,
            symbol: tokenSymbol,
            resourceAddress: item.resource_address,
            nonFungibleLocals: item.vaults.items[0].items ?
                (await gatewayApi.state.getNonFungibleData(item.resource_address, item.vaults.items[0].items)).map((item) => {
                    const getNFTDataValue = (fieldname: string) => {
                        return (item.data?.programmatic_json as any).fields.find((field: any) => {
                            return field.field_name == fieldname
                        })?.value as string || undefined
                    }
                    const keyImageUrl = getNFTDataValue("key_image_url")
                    const name = getNFTDataValue("name")


                    return { id: item.non_fungible_id, keyImageUrl: keyImageUrl, name, chosen: false, description: getNFTDataValue("description") }
                })
                : [],
            icon
        };
        return balance
    })

    return {
        nonFungibles: (await Promise.all(nonFungibleResults) as NonFungibleResourceBalance[]).filter((item) => item.nonFungibleLocals.length > 0),
        fungibles: fungibleResults.filter((item) => item.amount != "0") as FungibleResourceBalance[]
    }
}