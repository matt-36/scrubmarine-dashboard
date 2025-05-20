<script lang="ts">
  // Props for the video stream
  export let streamId: string = ''; // Unique ID for the stream
  export let frameData: string = ''; // Base64 encoded image data
  export let width: string = '100%';
  export let height: string = '100%';
  export let resolution: [number, number] = [640, 480];
  export let label: string = ''; // Optional label for the stream
  
  // Create an image URL from base64 data
  let imageUrl: string = '';
  
  // Update the image URL whenever frameData changes
  $: {
    if (frameData) {
      // Check if the frameData already has the data URL prefix
      if (!frameData.startsWith('data:image')) {
        imageUrl = `data:image/jpeg;base64,${frameData}`;
      } else {
        imageUrl = frameData;
      }
    }
  }
</script>

<div class="video-stream-container" style="width: {width}; height: {height};">
  {#if imageUrl}
    <img 
      src={imageUrl} 
      alt="{label || 'Video stream'}"
      width={resolution[0]} 
      height={resolution[1]} 
      style="width: 100%; height: 100%; object-fit: contain;"
    />
  {:else}
    <div class="no-signal">
      <p>No signal</p>
    </div>
  {/if}
  
  {#if label}
    <div class="stream-label">{label}</div>
  {/if}
</div>

<style>
  .video-stream-container {
    position: relative;
    background-color: #000;
    border-radius: 8px;
    overflow: hidden;
    display: flex;
    justify-content: center;
    align-items: center;
  }
  
  .no-signal {
    display: flex;
    justify-content: center;
    align-items: center;
    width: 100%;
    height: 100%;
    color: white;
    font-size: 1.2rem;
  }
  
  .stream-label {
    position: absolute;
    bottom: 10px;
    left: 10px;
    background-color: rgba(0, 0, 0, 0.5);
    color: white;
    padding: 4px 8px;
    border-radius: 4px;
    font-size: 0.9rem;
  }
</style>