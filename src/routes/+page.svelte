<script lang="ts">
	import { dev } from '$app/environment';
	import type { ConnectionStatus, GamepadCommand, SensorData } from '$lib/scrubmarine';
	import { onMount, onDestroy } from 'svelte';
	import GamepadController from '$lib/components/GamepadController.svelte';

	// stateful so we can update the values when the websocket receives a message
	let items: Record<string, any> = $state({
		'Current depth': 0.0,
		'Dive direction': 'Up',
		'Auto depth': 'Off',
		'Depth status': 'Idle',
		'Depth set': 0.0,
		'Water pressure': 0.0,
		'Water temperature': 0.0
	});
	let position: Record<string, any> = $state({
		Latitude: 0.0,
		Longitude: 0.0
	});
	let thrust: [number, number] = $state([0, 0]);
	let surfaceThickness: number = $state(0);
	let cameraTilt: number = $state(0);

	// yaw roll pitch
	// yaw: rotation around the vertical axis
	// roll: rotation around the front-to-back axis
	// pitch: rotation around the side-to-side axis
	let attitude: [number, number, number] = $state([0, 0, 0]);

	let suffix: Record<string, string> = {
		'Current depth': ' m'
	};

	// Create the store with Svelte 5's $state
	export const subCleanerState = $state({
		connection: { connected: false, error: null } as ConnectionStatus,
		sensorData: {} as SensorData
	});
	
	// WebSocket connection reference
	let websocket: WebSocket | null = null;

	// Initialize WebSocket connection
	function connectToSubCleaner(serverUrl: string) {
		// Close existing connection if any
		if (websocket) {
			websocket.close();
		}

		try {
			websocket = new WebSocket(serverUrl);

			// Connection opened
			websocket.onopen = () => {
				subCleanerState.connection.connected = true;
				subCleanerState.connection.error = null;
				console.log('Connected to SubCleaner WebSocket server');
			};

			// Connection error
			websocket.onerror = (event) => {
				subCleanerState.connection.error = 'Failed to connect to SubCleaner';
				console.error('WebSocket error:', event);
			};

			// Connection closed
			websocket.onclose = () => {
				subCleanerState.connection.connected = false;
				console.log('Disconnected from SubCleaner WebSocket server');
			};

			// Listen for messages
			websocket.onmessage = (event) => {
				// console.log(event)
				try {
					const message = JSON.parse(event.data);

					// Handle different message types from the server
					if (message.type === 'sensor_data' || message.type === 'initial_state') {
						// Update the state with new sensor data
						subCleanerState.sensorData = { ...message.data };
						
						// Update UI state variables based on the received data
						if (message.data.depth) {
							const depthData = message.data.depth;
							items['Current depth'] = parseFloat(depthData.depth?.toFixed(4)) || 0;
							items['Water temperature'] = parseFloat(depthData.temperature?.toFixed(4)) || 0;
							items['Water pressure'] = parseFloat(depthData.pressure?.toFixed(4)) || 0;
						}
						
						// Update position if available
						if (message.data.position) {
							position.Latitude = parseFloat(message.data.position.latitude?.toFixed(4)) || 0;
							position.Longitude = parseFloat(message.data.position.longitude?.toFixed(4)) || 0;
						}
						
						// Update thrust values if available
						if (message.data.thrust) {
							thrust = [
								parseFloat(message.data.thrust.x?.toFixed(4)) || 0,
								parseFloat(message.data.thrust.y?.toFixed(4)) || 0
							];
						}
						
						// Update surface thickness from NDT data if available
						if (message.data.ndt && message.data.ndt.thickness !== undefined) {
							surfaceThickness = parseFloat(message.data.ndt.thickness?.toFixed(4)) || 0;
						}
						
						// Update camera tilt if available
						if (message.data.camera_tilt !== undefined) {
							cameraTilt = parseFloat(message.data.camera_tilt?.toFixed(4)) || 0;
						}
						
						// Update attitude (yaw, roll, pitch) if available
						// Ensure values are in their correct ranges:
						// Yaw: -180 to 180 degrees
						// Roll: -180 to 180 degrees
						// Pitch: -90 to 90 degrees
						if (message.data.attitude) {
							// Parse the values and ensure they're within correct ranges
							// For server data, we assume the values are already in degrees
							let yaw = message.data.attitude.yaw || 0;
							let roll = message.data.attitude.roll || 0;
							let pitch = message.data.attitude.pitch || 0;
							
							// Normalize to the correct ranges if needed
							// Yaw and Roll: -180 to 180
							yaw = ((yaw + 180) % 360) - 180;
							roll = ((roll + 180) % 360) - 180;
							// Pitch: -90 to 90
							pitch = Math.max(-90, Math.min(90, pitch));
							
							attitude = [
								parseFloat(yaw.toFixed(4)),
								parseFloat(roll.toFixed(4)),
								parseFloat(pitch.toFixed(4))
							];
						}
						
						// Update other diving related values if available
						if (message.data.dive) {
							items['Dive direction'] = message.data.dive.direction || 'Up';
							items['Auto depth'] = message.data.dive.auto ? 'On' : 'Off';
							items['Depth status'] = message.data.dive.status || 'Idle';
							items['Depth set'] = parseFloat(message.data.dive.target_depth?.toFixed(4)) || 0;
						}
					}
				} catch (err) {
					subCleanerState.connection.error = 'Failed to parse server message';
					console.error('Error parsing WebSocket message:', err);
				}
			};

			return true;
		} catch (err) {
			subCleanerState.connection.error = 'Failed to establish WebSocket connection';
			console.error('Error establishing WebSocket connection:', err);
			return false;
		}
	}

	// Base function to send any message to the server
	function sendMessage(message: any): boolean {
		if (!websocket || websocket.readyState !== WebSocket.OPEN) {
			console.log('WebSocket not connected');
			return false;
		}
		
		console.log('Sending message:', message);
		try {
			websocket.send(JSON.stringify(message));
			return true;
		} catch (err) {
			subCleanerState.connection.error = 'Failed to send message';
			console.error('Error sending message:', err);
			return false;
		}
	}

	// Send gamepad input to the server
	function sendGamepadInput(command: GamepadCommand): boolean {
		// Format the message for the server
		const message = { type: 'gamepad', data: command };
		const success = sendMessage(message);
		
		// Update UI immediately to reflect the sent command
		if (success) {
			// Update attitude and thrust values for movement commands
			if (command.type === 'movement') {
				const movementValue = command.value as {roll: number, pitch: number, yaw: number, throttle: number};
				
				 // Convert controller inputs (-1 to 1) to proper degree ranges
				// Yaw: -180 to 180 degrees
				// Roll: -180 to 180 degrees
				// Pitch: -90 to 90 degrees
				const yawDegrees = movementValue.yaw !== undefined ? movementValue.yaw * 180 : attitude[0];
				const rollDegrees = movementValue.roll !== undefined ? movementValue.roll * 180 : attitude[1]; 
				const pitchDegrees = movementValue.pitch !== undefined ? movementValue.pitch * 90 : attitude[2]; // half range for pitch
				
				// Update attitude with the converted degrees
				attitude = [
					yawDegrees,
					rollDegrees,
					pitchDegrees
				];
				
				// Update thrust based on movement command
				// This is a simplified representation
				thrust = [
					movementValue.roll !== undefined ? movementValue.roll : thrust[0],
					movementValue.throttle !== undefined ? movementValue.throttle : thrust[1]
				];
			}
			
			// Update camera tilt for camera commands
			if (command.type === 'camera' && typeof command.value === 'number') {
				cameraTilt = command.value;
			}
		}
		
		return success;
	}

	// Send a command to the server
	function sendCommand(commandString: string): boolean {
		const message = { type: 'command', command: commandString };
		return sendMessage(message);
	}

	// Helper function for sending emergency surface command
	export function emergencySurface(): boolean {
		return sendCommand('emergency_surface');
	}

	// Helper function for sending shutdown command
	export function shutdown(): boolean {
		return sendCommand('shutdown');
	}

	// Helper function for sending thruster check command
	export function thrusterCheck(): boolean {
		return sendCommand('thruster_check');
	}

	function sendHardwareCommand(target: string, data: string): boolean {
		const message = { type: 'hardware_command', target, data };
		return sendMessage(message);
	}

	// Disconnect from the server
	export function disconnectFromSubCleaner(): void {
		if (websocket) {
			websocket.close();
			websocket = null;
		}
	}

	// State for gamepad modal visibility
	let isGamepadModalOpen = $state(false);

	// Toggle gamepad modal visibility
	function toggleGamepadModal() {
		isGamepadModalOpen = !isGamepadModalOpen;
	}

	// Call the connect function when the component mounts
	// This is a placeholder URL, replace with your actual WebSocket server URL
	const serverUrl = 'ws://172.21.176.250:8080'; // Replace with your WebSocket server URL
	onMount(() => {
		if (connectToSubCleaner(serverUrl)) {
			console.log('Connected to SubCleaner WebSocket server');
		} else {
			console.error('Failed to connect to SubCleaner WebSocket server');
		}
	});
</script>

<svelte:head>
	<title>Scrubmarine</title>
</svelte:head>

{#snippet dataItem(item: string, value: any, suffix?: string)}
	<div class="flex w-full flex-1 flex-row justify-between">
		<span class="text-xl font-semibold text-indigo-500">
			{item}:
		</span>
		<span class="text-xl font-semibold text-indigo-500">
				{typeof value === 'number' ? value.toFixed(4) : value}{suffix ?? ''}
		</span>
	</div>
{/snippet}

<div class="flex h-full w-full flex-row gap-2">
	<div class="flex flex-2 flex-col gap-2 p-2">
		<div class="flex flex-1 flex-row gap-2">
			<div class={`flex-1 rounded-2xl w-full flex justify-center items-center ${subCleanerState.connection.connected ? 'bg-green-300' : 'bg-red-300'}`}>
				<span class="text-xl font-bold text-zinc-900"> {subCleanerState.connection.connected ? 'Connected' : 'Disconnected'} </span>
			</div>
			
			<!-- Gamepad Controller Button -->
			<button 
				class="flex-none px-4 flex items-center justify-center rounded-2xl bg-indigo-400 hover:bg-indigo-500 transition-colors"
				onclick={toggleGamepadModal}
			>
				<span class="text-white font-semibold">🎮</span>
			</button>
		</div>
		
		<!-- Gamepad Controller Component (as a modal) -->
		<GamepadController 
			{sendGamepadInput}
			{sendCommand}
			autoStart={subCleanerState.connection.connected}
			isOpen={isGamepadModalOpen}
		/>
		
		<div class="mx-4 my-2 flex-8 rounded-3xl bg-indigo-50">Front camera</div>
		<div class="mx-4 my-2 flex-8 rounded-3xl bg-indigo-50">Back camera</div>
		<div class="flex flex-4 flex-row gap-1">
			<div class="flex flex-1 flex-col">
				<!-- Switches -->
			</div>
			<div class="flex flex-1 flex-col">
				<!-- Switches -->
			</div>
			<div class="flex flex-1 flex-col">
				<!-- Switches -->
			</div>
			<div class="flex flex-1 flex-col gap-2">
				<!-- Buttons -->
				<button class="flex flex-1 flex-col items-center justify-center rounded-xl bg-red-400"
	onclick={() => shutdown()}>
					<span class="text-xl font-semibold text-zinc-800"> Shutdown </span>
				</button>
				<button class="flex flex-1 flex-col items-center justify-center rounded-xl bg-blue-400"
	onclick={() => emergencySurface()}>
					<span class="text-xl font-semibold text-zinc-800"> Emergency surface </span>
				</button>
				<button class="flex flex-1 flex-col items-center justify-center rounded-xl bg-cyan-400"
	onclick={() => thrusterCheck()}>
					<span class="text-xl font-semibold text-zinc-800"> Thruster check </span>
				</button>
			</div>
		</div>
	</div>
	<div class="flex flex-1 flex-col items-center justify-start gap-2 bg-indigo-50 p-2">
		<div class="flex flex-1">
			<span class="text-3xl font-bold text-indigo-500"> ScrubMarine </span>
		</div>
		{#each Object.keys(items) as item}
			{@render dataItem(item, items[item], suffix[item])}
		{/each}
		<div class="mb-2 w-full flex-3 bg-indigo-100">depth graph</div>
		<div class="flex w-full flex-1 flex-col items-center justify-start gap-1">
			<span class="flex-1 text-xl font-bold text-indigo-500"> Current position: </span>
			<span class="flex-1 text-xl font-semibold text-indigo-500">
				Longitude: {position['Longitude']}° Latitude: {position['Latitude']}°
			</span>
		</div>
		{@render dataItem('Thrust X', thrust[0])}
		{@render dataItem('Thrust Y', thrust[1])}
		{@render dataItem('Surface thickness', surfaceThickness, ' m')}
		{@render dataItem('Camera tilt', cameraTilt, '°')}

		<div class="flex w-full flex-1 flex-col items-center justify-start gap-1">
			<span class="flex-1 text-2xl font-bold text-indigo-500"> Attitude: </span>
			<div class="flex flex-3 flex-row gap-1 text-xl font-semibold text-indigo-500">
				<div class="flex flex-1 flex-col">
					<span class="flex-1"> Yaw </span>
					<span class="flex-1">
						{attitude[0].toFixed(4)}°
					</span>
				</div>
				<div class="flex flex-1 flex-col">
					<span class="flex-1"> Roll </span>
					<span class="flex-1">
						{attitude[1].toFixed(4)}°
					</span>
				</div>
				<div class="flex flex-1 flex-col">
					<span class="flex-1"> Pitch </span>
					<span class="flex-1">
						{attitude[2].toFixed(4)}°
					</span>
				</div>
			</div>
		</div>
	</div>
</div>
