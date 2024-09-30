<script>
    import { flip } from "svelte/animate";
    import {
        dndzone,
        TRIGGERS,
        SHADOW_ITEM_MARKER_PROPERTY_NAME,
    } from "svelte-dnd-action";
    export let items;
    const flipDurationMs = 300;
    let shouldIgnoreDndEvents = false;
    function handleDndConsider(e) {
        const { trigger, id } = e.detail.info;
        if (trigger === TRIGGERS.DRAG_STARTED) {
            const idx = items.findIndex((item) => item.id === id);
            const newId = `${id}_copy_${Math.round(Math.random() * 100000)}`;
            // the line below was added in order to be compatible with version svelte-dnd-action 0.7.4 and above
            e.detail.items = e.detail.items.filter(
                (item) => !item[SHADOW_ITEM_MARKER_PROPERTY_NAME],
            );

            e.detail.items.splice(idx, 0, {
                item: new items[idx].item.constructor(),
                id: newId,
            });
            items = e.detail.items;

            console.log("new items", items);

            shouldIgnoreDndEvents = true;
        } else if (!shouldIgnoreDndEvents) {
            items = e.detail.items;
        } else {
            items = [...items];
        }
    }
    function handleDndFinalize(e) {
        if (!shouldIgnoreDndEvents) {
            // items = e.detail.items;
        } else {
            items = [...items];
            shouldIgnoreDndEvents = false;
        }
    }
</script>

<section
    use:dndzone={{
        items,
        flipDurationMs,
        dropFromOthersDisabled: true,
        centreDraggedOnCursor: true,
    }}
    on:consider={handleDndConsider}
    on:finalize={handleDndFinalize}
    class="p-2"
>
    {#each items as { id, item } (id)}
        <div
            animate:flip={{ duration: flipDurationMs }}
            class="p-3 m-2 bg-green-300"
        >
            {item.name}
        </div>
    {/each}
</section>
