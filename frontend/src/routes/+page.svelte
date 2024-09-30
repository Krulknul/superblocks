<script lang="ts">
    import {
        globalState,
        current_epoch,
        isConnected,
        rdt,
        accounts,
        EvaluateStatus,
    } from "$lib/state.svelte";
    import Dragula from "../components/Dragula.svelte";
    import InstructionList from "../components/InstructionList.svelte";
    import { integrations } from "$lib/integrations.svelte";

    let debug = false;

    let blocks = integrations;

    let timeout: any;
    $inspect(globalState.instructions);
    $inspect(accounts);

    setInterval(async () => {
        const status = await rdt.gatewayApi.status.getCurrent();
        current_epoch.number = status.ledger_state.epoch;
    }, 10000);

    $inspect(globalState.results.stuckAt);
</script>

<div class="flex-col flex w-[100vw] h-[100vh]">
    <div
        class="w-full h-[10%] flex flex-row justify-between items-center text-black p-5"
    >
        <h1>Superblocks</h1>

        <radix-connect-button></radix-connect-button>
    </div>
    <div class="flex-col flex h-[90%] bg-blue-50">
        <h1 class="m-5">
            Superblocks allows you to easily compose existing dapps and actions
            on Radix together into one "all-or-nothing" (atomic) transaction,
            using the power of Transaction Manifest.
            <br />
            Drag "blocks" from the block list on the right, and compose them on the
            left side of the screen to build your transaction.
        </h1>
        {#if isConnected.bool}
            <div class=" h-[80%] flex items-center justify-center flex-row">
                <div
                    class="w-[50%] h-full bg-gray-300 rounded-lg flex flex-col m-6 overflow-scroll"
                >
                    <InstructionList></InstructionList>
                </div>
                <div class="w-[50%] h-full bg-blue-400 rounded-lg m-6">
                    <Dragula items={blocks}></Dragula>
                    {#if globalState.evaluateStatus == EvaluateStatus.Success}
                        <button
                            class="p-4 m-4 bg-purple-400 rounded-lg"
                            onclick={() => {
                                const manifestMinusFee =
                                    globalState.results.manifest
                                        .split(";")

                                        .filter(
                                            (line) =>
                                                !line.includes("lock_fee"),
                                        )
                                        .join(";");
                                console.log(manifestMinusFee);
                                rdt.walletApi.sendTransaction({
                                    transactionManifest: manifestMinusFee,
                                    message: "Superblocks transaction",
                                });
                            }}>Submit</button
                        >
                    {:else}
                        <button
                            class="p-4 m-4 bg-purple-400 rounded-lg disabled"
                            >Submit</button
                        >
                    {/if}
                    {#if debug}
                        {#await globalState.results}
                            <p>loading...</p>
                        {:then { manifest }}
                            <textarea class="w-[100%] h-[100%] p-2"
                                >{manifest}</textarea
                            >
                        {:catch error}
                            <p>{error.message}</p>
                        {/await}
                    {/if}
                </div>
            </div>
        {:else}
            <div class="h-full flex items-center justify-center">
                <p>Connect your wallet to get started</p>
            </div>
        {/if}
    </div>
</div>

<!-- <button
    onclick={() =>
        console.log($state.snapshot(globalState.instructions[1].item.inputs))}
    >asd
</button> -->
