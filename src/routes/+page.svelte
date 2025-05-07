<script lang="ts">
	// stateful so we can update the values when the websocket recieves a message
	let items: Record<string, any> = $state({
		"Current depth": 0.00,
		"Dive direction": "Up",
		"Auto depth": "Off",
		"Depth status": "Idle",
		"Depth set": 0.00,
		"Water pressure": 0.00,
		"Water temperature": 0.00,
	})
	let position: Record<string, any> = $state({
		"Latitude": 0.00,
		"Longitude": 0.00,
	})
	let thrust: [number, number] = $state([0, 0])
	let surfaceThickness: number = $state(0)
	let cameraTilt: number = $state(0)

	// yaw roll pitch
	// yaw: rotation around the vertical axis
	// roll: rotation around the front-to-back axis
	// pitch: rotation around the side-to-side axis
	let attitude: [number, number, number] = $state([0, 0, 0])

	let suffix: Record<string, string> = {
		"Current depth": " m",
	}

	
</script>

<svelte:head>
	<title>Scrubmarine</title>
</svelte:head>

{#snippet dataItem(item: string, value: any, suffix?: string)}
<div class="flex-1 flex flex-row justify-between w-full">
	<span class="text-xl font-semibold text-indigo-500">
		{item}:
	</span>
	<span class="text-xl font-semibold text-indigo-500">
		{value}{suffix ?? ''}
	</span>
</div>
{/snippet}

<div class="flex flex-row w-full h-full gap-2">
	<div class="flex flex-col flex-2 bg-indigo-50 gap-2 p-2">
		<div class="flex-2 bg-indigo-100 rounded-3xl mx-4 my-2">

		</div>
		<div class="flex-2 bg-indigo-100 rounded-3xl mx-4 my-2">
			
		</div>
		<div class="flex flex-row flex-1 bg-indigo-100 gap-1">
			<div class="flex flex-1 flex-col bg-indigo-200">
				<!-- Switches -->
			</div>
			<div class="flex flex-1 flex-col bg-indigo-200">
				<!-- Switches -->
			</div>
			<div class="flex flex-1 flex-col bg-indigo-200">
				<!-- Switches -->
			</div>
			<div class="flex flex-1 flex-col gap-2">
				<!-- Buttons -->
				<button class="flex-1 flex flex-col bg-red-400 rounded-xl items-center justify-center">
					<span class="text-xl font-semibold text-zinc-800">
						Shutdown
					</span>
				</button>
				<button class="flex-1 flex flex-col bg-blue-400 rounded-xl items-center justify-center">
					<span class="text-xl font-semibold text-zinc-800">
						Emergency surface
					</span>
				</button>
				<button class="flex-1 flex flex-col bg-cyan-400 rounded-xl items-center justify-center">
					<span class="text-xl font-semibold text-zinc-800">
						Thruster check
					</span>
				</button>
			</div>
		</div>
	</div>
	<div class="flex flex-1 flex-col bg-indigo-50 justify-start items-center gap-2 p-2">
		<div class="flex flex-1">
			<span class="text-3xl text-indigo-500 font-bold">
				ScrubMarine
			</span>
		</div>
		{#each Object.keys(items) as item}
			{@render dataItem(item, items[item], suffix[item])}
		{/each}
		<div class="flex-3 w-full bg-indigo-100 mb-2">
			depth graph
		</div>
		<div class="flex-1 flex flex-col w-full items-center justify-start gap-1">
			<span class="flex-1 text-xl text-indigo-500 font-bold">
				Current position:
			</span>
			<span class="flex-1 text-xl text-indigo-500 font-semibold">
				Longitude: {position["Longitude"]}°
				Latitude: {position["Latitude"]}°
			</span>
		</div>
		{@render dataItem("Thrust X", thrust[0])}
		{@render dataItem("Thrust Y", thrust[1])}
		{@render dataItem("Surface thickness", surfaceThickness, " m")}
		{@render dataItem("Camera tilt", cameraTilt, "°")}
		
		<div class="flex-1 flex flex-col w-full items-center justify-start gap-1">
			<span class="flex-1 text-2xl text-indigo-500 font-bold">
				Attitude:
			</span>
			<div class="flex-3 text-xl text-indigo-500 font-semibold flex flex-row gap-1">
				<div class="flex flex-1 flex-col">
					<span class="flex-1">
						Yaw
					</span>
					<span class="flex-1">
						{attitude[0]}°
					</span>
				</div>
				<div class="flex flex-1 flex-col">
					<span class="flex-1">
						Roll
					</span>
					<span class="flex-1">
						{attitude[1]}°
					</span>
				</div>
				<div class="flex flex-1 flex-col">
					<span class="flex-1">
						Pitch
					</span>
					<span class="flex-1">
						{attitude[2]}°
					</span>
				</div>
			</div>
		</div>
	</div>
</div>