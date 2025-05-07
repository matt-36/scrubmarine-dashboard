// lib/subcleaner-store.ts
// Define types for the data from the server
export type CameraData = {
	camera_id: string;
	frame: string; // base64 encoded image
	timestamp: number;
	resolution: [number, number];
};

export type NDTData = {
	thickness: number;
	anomalies: Array<{ position: number; value: number }>;
	timestamp: number;
	alert?: { type: string; previous: number; current: number; difference: number };
};

export type DepthData = { depth: number; temperature: number; pressure: number; timestamp: number };

export type SensorData = {
	camera_front?: CameraData;
	camera_rear?: CameraData;
	ndt?: NDTData;
	depth?: DepthData;
};

export type ConnectionStatus = { connected: boolean; error: string | null };

// Define types for gamepad inputs
export type GamepadMovement = {
	roll: number; // -1 to 1
	pitch: number; // -1 to 1
	yaw: number; // -1 to 1
	throttle: number; // -1 to 1
};

export type GamepadCommand = {
	type: 'movement' | 'speed' | 'arm' | 'mode' | 'emergency';
	value: GamepadMovement | number | boolean | string;
};

// Define gamepad binding structure for mapping controller inputs to submarine commands
export interface GamepadBindings {
	// Movement controls
	movementAxes: {
		roll: number;  // Axis index for roll control
		pitch: number; // Axis index for pitch control
		yaw: number;   // Axis index for yaw control
		throttle: number; // Axis index for throttle control
	};
	
	// Button controls
	buttons: {
		arm: number;         // Button index to arm/disarm
		emergencySurface: number; // Button index for emergency surface
		increaseSpeed: number;    // Button index to increase speed
		decreaseSpeed: number;    // Button index to decrease speed
		shutdown: number;         // Button index for shutdown command
	};
	
	// Configuration
	deadzone: number;  // Deadzone for analog inputs (0.0 to 1.0)
	sensitivity: number; // Sensitivity multiplier for movements
}

// Default gamepad bindings for standard controllers
export const defaultGamepadBindings: GamepadBindings = {
	movementAxes: {
		// Left stick: horizontal (roll), vertical (pitch)
		roll: 0,
		pitch: 1,
		// Right stick: horizontal (yaw)
		yaw: 2,
		// Triggers: throttle
		throttle: 3
	},
	buttons: {
		arm: 0,              // A/Cross button
		emergencySurface: 1, // B/Circle button
		increaseSpeed: 4,    // Right bumper
		decreaseSpeed: 5,    // Left bumper
		shutdown: 9          // Start button
	},
	deadzone: 0.1,
	sensitivity: 1.0
};



