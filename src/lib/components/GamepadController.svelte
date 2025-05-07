<script lang="ts">
    import type { ConnectionStatus, GamepadBindings, GamepadCommand, GamepadMovement } from '$lib/scrubmarine';
    import { defaultGamepadBindings } from '$lib/scrubmarine';
    import { onMount, onDestroy } from 'svelte';
	import { fade, fly } from 'svelte/transition';

    // Props
    // export let sendGamepadInput: (command: GamepadCommand) => boolean;
    // export let sendCommand: (command: string) => boolean;
    // export let autoStart: boolean = true;
    let { 
        sendGamepadInput, 
        sendCommand, 
        autoStart = true,
        isOpen = false 
    } = $props();

    // State variables
    let gamepadConnected = $state(false);
    let gamepadPolling = $state(false);
    let currentGamepadIndex = $state(-1);
    let speedLevel = $state(5);  // Speed level from 1-10
    let isArmed = $state(false); // Whether the submarine is armed
    let bindings = $state(defaultGamepadBindings);
    let lastButtonStates: boolean[] = [];
    let animationFrameId: number | null = null;

    // Close the modal
    function closeModal() {
        isOpen = false;
    }

    // Handle click outside modal content to close
    function handleOutsideClick(event: MouseEvent) {
        const target = event.target as HTMLElement;
        if (target.classList.contains('modal-backdrop')) {
            closeModal();
        }
    }

    // Handle ESC key to close modal
    function handleKeydown(event: KeyboardEvent) {
        if (event.key === 'Escape') {
            closeModal();
        }
    }

    // Function to apply deadzone to analog input
    function applyDeadzone(value: number, deadzone: number): number {
        if (Math.abs(value) < deadzone) {
            return 0;
        }
        
        // Rescale the remaining range from deadzone to 1.0 to be 0.0 to 1.0
        return (value > 0)
            ? (value - deadzone) / (1 - deadzone)
            : (value + deadzone) / (1 - deadzone);
    }

    // Process gamepad input and send appropriate commands
    function processGamepadInput(): void {
        // Get the gamepad
        const gamepad = navigator.getGamepads()[currentGamepadIndex];
        if (!gamepad) {
            if (gamepadConnected) {
                gamepadConnected = false;
                console.log('Gamepad disconnected');
            }
            return;
        }

        if (!gamepadConnected) {
            gamepadConnected = true;
            console.log('Gamepad connected:', gamepad.id);
            lastButtonStates = Array(gamepad.buttons.length).fill(false);
        }

        // Process movement axes
        const movementData: GamepadMovement = {
            roll: applyDeadzone(gamepad.axes[bindings.movementAxes.roll] || 0, bindings.deadzone) * bindings.sensitivity,
            pitch: applyDeadzone(-1 * (gamepad.axes[bindings.movementAxes.pitch] || 0), bindings.deadzone) * bindings.sensitivity, // Invert Y axis
            yaw: applyDeadzone(gamepad.axes[bindings.movementAxes.yaw] || 0, bindings.deadzone) * bindings.sensitivity,
            throttle: applyDeadzone(gamepad.axes[bindings.movementAxes.throttle] || 0, bindings.deadzone) * bindings.sensitivity
        };

        // Only send movement commands if significant change or if armed
        if (isArmed && (Math.abs(movementData.roll) > 0.05 || 
                        Math.abs(movementData.pitch) > 0.05 || 
                        Math.abs(movementData.yaw) > 0.05 ||
                        Math.abs(movementData.throttle) > 0.05)) {
            sendGamepadInput({
                type: 'movement',
                value: movementData
            });
        }

        // Process button presses (only on button state change)
        for (let i = 0; i < gamepad.buttons.length; i++) {
            const isPressed = gamepad.buttons[i].pressed;
            const wasPressed = lastButtonStates[i];
            
            // Button just pressed (state transition from not pressed to pressed)
            if (isPressed && !wasPressed) {
                // Arm/disarm
                if (i === bindings.buttons.arm) {
                    isArmed = !isArmed;
                    sendGamepadInput({
                        type: 'arm',
                        value: isArmed
                    });
                    console.log(`Submarine ${isArmed ? 'armed' : 'disarmed'}`);
                }
                
                // Emergency surface
                else if (i === bindings.buttons.emergencySurface) {
                    emergencySurface();
                    console.log('Emergency surface activated');
                }
                
                // Increase speed
                else if (i === bindings.buttons.increaseSpeed) {
                    if (speedLevel < 10) {
                        speedLevel++;
                        sendGamepadInput({
                            type: 'speed',
                            value: speedLevel / 10 // Convert to 0.1-1.0 range
                        });
                        console.log(`Speed increased to ${speedLevel}/10`);
                    }
                }
                
                // Decrease speed
                else if (i === bindings.buttons.decreaseSpeed) {
                    if (speedLevel > 1) {
                        speedLevel--;
                        sendGamepadInput({
                            type: 'speed',
                            value: speedLevel / 10 // Convert to 0.1-1.0 range
                        });
                        console.log(`Speed decreased to ${speedLevel}/10`);
                    }
                }
                
                // Shutdown
                else if (i === bindings.buttons.shutdown) {
                    shutdown();
                    console.log('Shutdown command sent');
                }
            }
            
            // Update button state
            lastButtonStates[i] = isPressed;
        }
    }

    // Start gamepad polling
    export function startGamepadPolling(): void {
        if (gamepadPolling) return;
        
        gamepadPolling = true;
        
        // Check for gamepads and update
        function pollGamepads() {
            processGamepadInput();
            animationFrameId = requestAnimationFrame(pollGamepads);
        }
        
        // Initialize gamepad listeners
        window.addEventListener('gamepadconnected', (e) => {
            console.log('Gamepad connected:', e.gamepad.id);
            currentGamepadIndex = e.gamepad.index;
            gamepadConnected = true;
            lastButtonStates = Array(e.gamepad.buttons.length).fill(false);
        });
        
        window.addEventListener('gamepaddisconnected', (e) => {
            if (e.gamepad.index === currentGamepadIndex) {
                console.log('Gamepad disconnected:', e.gamepad.id);
                gamepadConnected = false;
                currentGamepadIndex = -1;
            }
        });
        
        // Start the polling loop
        animationFrameId = requestAnimationFrame(pollGamepads);
    }
    
    // Stop gamepad polling
    export function stopGamepadPolling(): void {
        if (!gamepadPolling) return;
        
        gamepadPolling = false;
        if (animationFrameId !== null) {
            cancelAnimationFrame(animationFrameId);
            animationFrameId = null;
        }
    }

    // Make the gamepad bindings configurable
    export function updateGamepadBindings(newBindings: Partial<GamepadBindings>): void {
        bindings = { ...bindings, ...newBindings };
        console.log('Updated gamepad bindings:', bindings);
    }

    // Helper function for sending emergency surface command
    function emergencySurface(): boolean {
        return sendCommand('emergency_surface');
    }

    // Helper function for sending shutdown command
    function shutdown(): boolean {
        return sendCommand('shutdown');
    }

    // Helper function for sending thruster check command
    function thrusterCheck(): boolean {
        return sendCommand('thruster_check');
    }

    onMount(() => {
        if (autoStart) {
            startGamepadPolling();
        }
    });

    onDestroy(() => {
        stopGamepadPolling();
    });
</script>

<svelte:window on:keydown={handleKeydown} />

<!-- Modal Container -->
{#if isOpen}
<div class="fixed inset-0 z-50 flex items-center justify-center bg-zinc-700/90 modal-backdrop" 
    onclick={handleOutsideClick} in:fade={{ duration: 200 }} out:fade={{ duration: 200 }}>
    <div class="relative p-4 bg-white rounded-lg shadow-lg max-w-md w-full max-h-[90vh] overflow-y-auto" in:fly={{ y: 100 }} out:fly={{ y: 100 }}>
        <!-- Modal Header -->
        <div class="flex justify-between items-center mb-4 border-b pb-2">
            <h3 class="text-xl font-semibold text-zinc-900">Gamepad Controls</h3>
            <button 
                class="text-zinc-900 text-2xl font-medium"
                onclick={closeModal}
            >x</button>
        </div>

        <!-- Gamepad Status -->
        <div class={`mb-2 p-2 rounded-lg flex justify-center items-center ${gamepadConnected ? 'bg-green-300' : 'bg-yellow-300'}`}>
            <span class="text-lg font-bold text-zinc-900"> Gamepad: {gamepadConnected ? 'Connected' : 'Not Connected'} </span>
        </div>

        <!-- Arm Status -->
        <div class={`mb-2 p-2 rounded-lg flex justify-center items-center ${isArmed ? 'bg-green-300' : 'bg-red-300'}`}>
            <span class="text-lg font-bold text-zinc-900"> {isArmed ? 'Armed' : 'Disarmed'} </span>
        </div>

        <!-- Speed Level -->
        <div class="mb-2 p-2 rounded-lg flex justify-center items-center bg-blue-300">
            <span class="text-lg font-bold text-zinc-900"> Speed: {speedLevel}/10 </span>
        </div>

        <!-- Gamepad Control Panel -->
        <div class="p-3 bg-indigo-100 rounded-lg">
            <div class="flex flex-col items-center gap-2">
                <div class="flex flex-row justify-between w-full">
                    <button class="px-3 py-1 rounded-lg bg-indigo-400 text-white"
                        onclick={() => gamepadPolling ? stopGamepadPolling() : startGamepadPolling()}>
                        {gamepadPolling ? 'Disable Gamepad' : 'Enable Gamepad'}
                    </button>
                    <button class="px-3 py-1 rounded-lg bg-indigo-400 text-white"
                        onclick={() => bindings = defaultGamepadBindings}>
                        Reset Bindings
                    </button>
                </div>
                {#if gamepadConnected}
                <div class="text-sm text-zinc-700 mt-1 w-full">
                    <div><strong>Movement:</strong> Left/Right sticks</div>
                    <div><strong>Throttle:</strong> Triggers</div>
                    <div><strong>Arm/Disarm:</strong> A/X Button</div>
                    <div><strong>Speed:</strong> Bumpers</div>
                </div>
                {:else}
                <div class="text-sm text-zinc-700 mt-1">
                    Connect a controller to use gamepad controls
                </div>
                {/if}
            </div>
        </div>
    </div>
</div>
{/if}