<script lang="ts">
    import { flip } from "svelte/animate";
    import { dndzone } from "svelte-dnd-action";
    import { accounts, instructions, worktops } from "$lib/state.svelte";
    import Select from "svelte-select";
    import {
        GatewayApiClient,
        RadixNetwork,
    } from "@radixdlt/babylon-gateway-api-sdk";

    const flipDurationMs = 300;
    function handleDndConsider(e) {
        instructions.items = e.detail.items;
    }
    function handleDndFinalize(e) {
        instructions.items = e.detail.items;
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
        items: instructions.items,
        flipDurationMs,
    }}
    on:consider={handleDndConsider}
    on:finalize={handleDndFinalize}
>
    {#each instructions.items.entries() as [index, item] (item.id)}
        <div
            animate:flip={{ duration: flipDurationMs }}
            class="p-3 m-3 border-blue-500 border-2 rounded-lg relative"
        >
            {item.name}
            <button
                on:click={() => {
                    instructions.items = instructions.items.filter(
                        (i) => i.id !== item.id,
                    );
                }}
                class="top-1 absolute right-1 bg-red-500 rounded-lg p-1"
                >Remove</button
            >
            {#each Object.values(item.inputs) as input}
                <div class="p-2 m-2 bg-blue-200 rounded-lg">
                    {input.name}
                    {#if input.resolver}
                        {#await input.resolver(accounts.accounts, worktops[index], item.inputs) then resolved}
                            {console.log(input.value)}
                            <Select
                                items={resolved}
                                on:change={(e) => {
                                    console.log("new value", e.detail.value);
                                    console.log("old value", input.value);
                                    input.value = e.detail.value;
                                }}
                                value={input.value}
                                on:clear={() => {
                                    input.value = "";
                                }}
                            />
                        {/await}
                    {:else}
                        <input
                            class="m-auto"
                            type="text"
                            bind:value={input.value}
                        />
                    {/if}
                </div>
            {/each}
            <div>
                <h1>Resulting worktop</h1>
                <h2>Fungibles:</h2>
                {#each worktops[index].fungibles as fungible}
                    <div class="p-2 m-2 bg-blue-200 rounded-lg">
                        {fungible.amount}
                        {fungible.resouceAddress}
                    </div>
                {/each}
            </div>
        </div>
    {/each}
</section>
