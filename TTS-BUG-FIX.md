# TTS Bug Fix - Early Round Transition

## Problem
When sliding to the next round early, the TTS would miss exercises or announce them in the wrong order. This was causing confusion during workouts.

## Root Cause
The `announceAllExercisesInRound()` function uses `setTimeout` to schedule all exercise announcements based on calculated timing (rep duration + gaps). When you moved to the next round early:

1. Old `setTimeout` calls from the previous round were still scheduled
2. `nextRound()` shuffled the exercises and updated reps
3. The old timers would fire with the NEW (shuffled) exercise data
4. This caused announcements to be out of sync or reference wrong exercises

## Solution
Implemented a timeout tracking system:

1. **Added `announcementTimeouts` array** - Tracks all setTimeout IDs for announcements
2. **Updated `announceAllExercisesInRound()`** - Stores all setTimeout IDs in the tracking array
3. **Updated `stopTTS()`** - Clears all pending announcement timeouts
4. **Updated slider handler** - Calls `stopTTS()` before transitioning to next round

## Changes Made

### 1. Added timeout tracking (line 824)
```javascript
let announcementTimeouts = []; // Track all announcement timeouts for cleanup
```

### 2. Updated stopTTS() function (lines 1037-1052)
```javascript
function stopTTS() {
    console.log('TTS: Stopping all speech');
    
    // Clear all pending announcement timeouts
    announcementTimeouts.forEach(timeoutId => clearTimeout(timeoutId));
    announcementTimeouts = [];
    
    // ... rest of cleanup
}
```

### 3. Updated announceAllExercisesInRound() (lines 1226-1318)
- Clears existing timeouts at start
- Stores each setTimeout ID in announcementTimeouts array
- Ensures clean slate for each round

### 4. Updated slider event handler (line 367)
```javascript
// Stop all TTS announcements and clear pending timeouts
stopTTS();
```

## Result
Now when you slide to the next round early:
- All pending announcements are immediately cancelled
- Speech queue is cleared
- New round starts with fresh, correct announcements
- No more mixed up or missed exercises!

## Testing
Test by:
1. Start a workout
2. Let first exercise announcement begin
3. Immediately slide to next round
4. Verify announcements stop and new round announces correctly
