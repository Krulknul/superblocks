<script lang="ts">
    import {
        dndzone,
        SHADOW_ITEM_MARKER_PROPERTY_NAME,
    } from "svelte-dnd-action";
    import { accounts, EvaluateStatus, globalState } from "$lib/state.svelte";
    import Select from "svelte-select";
    import {
        GatewayApiClient,
        RadixNetwork,
    } from "@radixdlt/babylon-gateway-api-sdk";
    import getItems from "svelte-select/get-items";
    import { formatTokenAmount } from "$lib";



    const flipDurationMs = 300;
    function handleDndConsider(e: any) {
        console.log("items in consider", e.detail.items);
        globalState.updateInstructions(e.detail.items);
    }
    function handleDndFinalize(e: any) {
        console.log("items in finalize", e.detail.items[0].item.inputs);
        globalState.updateInstructions(e.detail.items);
        console.log(globalState.instructions[0].item.inputs);
    }

    const gateway = GatewayApiClient.initialize({
        applicationName: "Dapp",
        applicationVersion: "1.0.0",
        networkId: RadixNetwork.Mainnet,
    });
</script>


<section
    class="w-[100%] h-[100%] overflow-scroll"
    use:dndzone={{
        items: globalState.instructions,
        flipDurationMs,
    }}
    on:consider={handleDndConsider}
    on:finalize={handleDndFinalize}
>



{#each globalState.instructions.entries() as [index, item] (item.id)}
    {#if (item as any)[SHADOW_ITEM_MARKER_PROPERTY_NAME]}
        <div class="p-3 m-3 border-blue-500 border-2 rounded-lg">
            hoi
        </div>
    {/if}
    <div class={"p-3 m-3  border-2 rounded-lg relative " + (index >= globalState.results.stuckAt ?"border-red-500" :"border-blue-500" )}>
        {item.item.name}
        <button
            on:click={() => {
                globalState.removeInstructionWithID(item.id);
            }}
            class="top-1 absolute right-1 bg-red-500 rounded-lg p-1"
            >Remove</button
        >
        {#each Object.values(item.item.inputs) as input}
            <div class="p-2 m-2 bg-blue-200 rounded-lg flex flex-row items-center ">
                <h2 class="m-2">
                    {input.name}
                </h2>
                    {#if input.resolver}


                        {#await input.resolver(accounts.accounts, globalState.results.worktops.getByIndex(index-1) || null, item.item.inputs) }
                            <Select
                                disabled
                                on:change={(e) => {
                                    input.value = e.detail.value;
                                    globalState.updateResults()
                                }}
                                value={input.value}
                                on:clear={() => {
                                    globalState.updateResults()
                                    input.value = "";
                                }}
                            />
                        {:then resolved}
                            <Select
                                items={resolved}
                                on:change={(e) => {
                                    input.value = e.detail.value;
                                    globalState.updateResults()
                                }}
                                value={input.value}
                                on:clear={() => {
                                    globalState.updateResults()
                                    input.value = "";
                                }}
                            />
                        {/await}

                {:else}
                    <input
                        class="p-1 m-1 rounded-lg"
                        type="text"
                        bind:value={input.value}
                        on:input={() => {
                            globalState.updateResults();
                        }}
                    />
                {/if}

            </div>
         {/each}
        <div>

            {#if globalState.results.stuckAt > index}

                <h1>Resulting worktop</h1>
                <h2>Fungibles:</h2>
                {console.log("fungible when rendering",globalState.results.worktops.getByIndex(index))}
                <div class="p-2 m-2 bg-blue-200 rounded-lg flex flex-row gap-1 flex-wrap">
                    {#each globalState.results.worktops.getByIndex(index).fungibles as fungible}
                    <div class="flex-row flex items-center justify-center border-red-500 border-2 rounded-md">
                        <img class="m-1 rounded-full" src={fungible.iconUrl} alt="token icon" width="25" height="25" />
                        <p class="m-1">
                            {formatTokenAmount(fungible.amount)}
                        </p>
                        <p class="m-1">
                            {fungible.name} ({fungible.symbol})
                        </p>
                    </div>
                    {/each}
                </div>
            {/if}

        </div>
    </div>
{/each}

</section>
