document.addEventListener('DOMContentLoaded', function () {
    console.log('DOM loaded, initializing workout app');

    // Check if button exists
    const createButton = document.getElementById('create-workout-button');
    if (!createButton) {
        console.error('Create workout button not found!');
        return;
    }
    console.log('Create workout button found:', createButton);

    // Screen Wake Lock functionality
    let wakeLock = null;
    let fallbackInterval = null;
    let isScreenLockActive = false;

    const exerciseCategories = {
        'Full Body': ['squats', 'Crunches', 'Plank knee taps', 'Shoulder press ups', 'Mountain climbers', 'Wide press ups', 'Press up walk out', 'Plank up & down', 'Superman', 'Jump squats', 'Burpees press ups', 'Dips', 'Lungs', 'Situps hands to wall', 'Pressups Diamonds', 'Situps crunches', 'Situps knife Jacks', 'Russian twist', 'Leg raises', 'Pressup claps', 'Over sit ups'],
        'Abs': ['Elbow to knees', 'ankle taps', 'Crunches', 'Plank knee taps', 'Plank up & down', 'Superman', 'Situps hands to wall', 'Situps crunches', 'Situps knife Jacks', 'Russian twist', 'Leg raises', 'Over sit ups'],
        'Arms': ['mid body press ups', 'touch knee press up', 'side to side walk outs', 'wide side to sides', 'single arm press ups', 'close press ups', 'Shoulder press ups', 'Wide press ups', 'Press up walk out', 'Dips', 'Pressups Diamonds', 'Pressup claps'],
        'Legs': ['Squats', 'Lunges', 'Calf Raises', 'High Knees', 'Side Lunges']
    };
    let selectedExercises = [];
    let exerciseReps = {};
    let totalReps = 0;
    let startTime, endTime, roundStartTime, roundEndTime;
    let currentRound = 0;
    const totalRounds = 10;
    let timerInterval;
    let roundTimerInterval;
    let totalRoundTime = 0;
    let roundTimes = [];
    let isGeneratingWorkout = false; // Prevent duplicate workout generation
    let customSelectedExercises = []; // Store custom selected exercises
    let customExerciseList = []; // Store custom added exercises
    let isPaused = false;
    let pauseStartTime = null;
    let totalPausedTime = 0;
    let roundPausedTime = 0;

    // Workout statistics tracking
    let workoutStats = {
        roundData: [],  // Array of objects: { round: 1, exercises: {}, startTime: timestamp, endTime: timestamp, duration: seconds }
        totalExerciseReps: {}  // Total reps per exercise across all rounds
    };

    // Screen Wake Lock Functions
    async function requestScreenWakeLock() {
        try {
            // Check if Screen Wake Lock API is supported
            if ('wakeLock' in navigator) {
                console.log('Screen Wake Lock API supported');
                wakeLock = await navigator.wakeLock.request('screen');
                isScreenLockActive = true;
                console.log('Screen wake lock activated');

                // Handle wake lock release
                wakeLock.addEventListener('release', () => {
                    console.log('Screen wake lock released');
                    isScreenLockActive = false;
                });

                return true;
            } else {
                console.log('Screen Wake Lock API not supported, using fallback method');
                startFallbackScreenLock();
                return true;
            }
        } catch (err) {
            console.error('Failed to request screen wake lock:', err);
            // Fallback to alternative method
            startFallbackScreenLock();
            return false;
        }
    }

    function startFallbackScreenLock() {
        console.log('Starting fallback screen lock method');

        // Method 1: Hidden video element to keep screen active
        if (!document.getElementById('keep-screen-on-video')) {
            const video = document.createElement('video');
            video.id = 'keep-screen-on-video';
            video.style.display = 'none';
            video.style.position = 'absolute';
            video.style.top = '-9999px';
            video.loop = true;
            video.muted = true;
            video.playsInline = true;

            // Create a minimal video stream (1x1 pixel, very short duration)
            const canvas = document.createElement('canvas');
            canvas.width = 1;
            canvas.height = 1;
            const ctx = canvas.getContext('2d');
            ctx.fillStyle = 'black';
            ctx.fillRect(0, 0, 1, 1);

            const stream = canvas.captureStream(1); // 1 FPS
            video.srcObject = stream;

            document.body.appendChild(video);

            video.play().catch(e => {
                console.log('Video fallback failed:', e);
            });
        }

        // Method 2: Periodic user activity simulation
        if (fallbackInterval) {
            clearInterval(fallbackInterval);
        }

        fallbackInterval = setInterval(() => {
            // Simulate minimal user activity
            const event = new Event('visibilitychange');
            document.dispatchEvent(event);

            // Keep video playing
            const video = document.getElementById('keep-screen-on-video');
            if (video && video.paused) {
                video.play().catch(e => console.log('Video play failed:', e));
            }
        }, 30000); // Every 30 seconds

        isScreenLockActive = true;
    }

    function releaseScreenWakeLock() {
        console.log('Releasing screen wake lock');

        // Release native wake lock
        if (wakeLock) {
            wakeLock.release();
            wakeLock = null;
        }

        // Clear fallback interval
        if (fallbackInterval) {
            clearInterval(fallbackInterval);
            fallbackInterval = null;
        }

        // Remove fallback video
        const video = document.getElementById('keep-screen-on-video');
        if (video) {
            video.pause();
            video.remove();
        }

        isScreenLockActive = false;
    }

    // Handle page visibility changes to release wake lock when user leaves
    document.addEventListener('visibilitychange', function () {
        if (document.hidden && isScreenLockActive) {
            console.log('Page hidden, releasing screen wake lock');
            releaseScreenWakeLock();
        }
    });

    // Handle page unload to ensure wake lock is released
    window.addEventListener('beforeunload', function () {
        if (isScreenLockActive) {
            releaseScreenWakeLock();
        }
    });

    // Get exercise limit based on difficulty
    function getExerciseLimit() {
        const difficulty = document.getElementById('difficulty').value;
        switch (difficulty) {
            case 'easy': return 5;   // 20 minutes
            case 'medium': return 8; // 30 minutes
            case 'hard': return 11;  // 40 minutes
            default: return 8;
        }
    }

    // Update exercise limit info display
    function updateExerciseLimitInfo() {
        const limit = getExerciseLimit();
        const difficultyText = document.getElementById('difficulty').selectedOptions[0].text;
        document.getElementById('exercise-limit-info').textContent =
            `${difficultyText}: Select exactly ${limit} exercises for your custom workout`;
    }

    // Initialize custom exercise selection
    function initializeCustomExerciseSelection() {
        const exerciseGrid = document.getElementById('exercise-checkboxes');
        const allExercises = [...exerciseCategories['Full Body'], ...customExerciseList];

        exerciseGrid.innerHTML = allExercises.map(exercise => `
            <div class="exercise-checkbox-item">
                <input type="checkbox" id="exercise-${exercise.replace(/\s+/g, '-').toLowerCase()}" value="${exercise}">
                <label for="exercise-${exercise.replace(/\s+/g, '-').toLowerCase()}">${exercise}</label>
            </div>
        `).join('');

        updateExerciseCount();
        updateExerciseLimitInfo();
    }

    // Add custom exercise
    function addCustomExercise() {
        const input = document.getElementById('custom-exercise-input');
        const exerciseName = input.value.trim();

        if (!exerciseName) {
            alert('Please enter an exercise name.');
            return;
        }

        if (customExerciseList.includes(exerciseName)) {
            alert('This exercise already exists.');
            return;
        }

        // Check if it's already in the main exercise list
        const allExercises = [...exerciseCategories['Full Body'], ...customExerciseList];
        if (allExercises.includes(exerciseName)) {
            alert('This exercise already exists.');
            return;
        }

        customExerciseList.push(exerciseName);
        input.value = '';
        initializeCustomExerciseSelection();
    }

    // Update exercise count display
    function updateExerciseCount() {
        const checkboxes = document.querySelectorAll('#exercise-checkboxes input[type="checkbox"]:checked');
        const count = checkboxes.length;
        const limit = getExerciseLimit();

        document.getElementById('exercise-count').innerHTML =
            `Selected: ${count}/${limit} exercises`;

        // Update custom selected exercises array
        customSelectedExercises = Array.from(checkboxes).map(cb => cb.value);

        // Change color based on limit
        const countElement = document.getElementById('exercise-count');
        countElement.classList.remove('at-limit', 'over-limit', 'under-limit');
        if (count === limit) {
            countElement.classList.add('at-limit');
        } else if (count > limit) {
            countElement.classList.add('over-limit');
        } else {
            countElement.classList.add('under-limit');
        }
    }

    // Show/hide custom exercise selection based on workout type
    function toggleCustomExerciseSelection() {
        const workoutType = document.getElementById('workout-type').value;
        const customSelection = document.getElementById('custom-exercise-selection');

        if (workoutType === 'customize') {
            customSelection.classList.remove('hidden');
            initializeCustomExerciseSelection();
        } else {
            customSelection.classList.add('hidden');
        }
    }

    // Event listeners for custom exercise selection
    document.getElementById('workout-type').addEventListener('change', toggleCustomExerciseSelection);
    document.getElementById('difficulty').addEventListener('change', function () {
        if (document.getElementById('workout-type').value === 'customize') {
            updateExerciseLimitInfo();
            updateExerciseCount();
        }
    });

    document.getElementById('add-custom-exercise-btn').addEventListener('click', addCustomExercise);

    document.getElementById('custom-exercise-input').addEventListener('keypress', function (e) {
        if (e.key === 'Enter') {
            addCustomExercise();
        }
    });

    document.getElementById('select-all-exercises').addEventListener('click', function () {
        const limit = getExerciseLimit();
        const checkboxes = document.querySelectorAll('#exercise-checkboxes input[type="checkbox"]');

        // Only select up to the limit
        checkboxes.forEach((cb, index) => {
            cb.checked = index < limit;
        });
        updateExerciseCount();
    });

    document.getElementById('clear-all-exercises').addEventListener('click', function () {
        const checkboxes = document.querySelectorAll('#exercise-checkboxes input[type="checkbox"]');
        checkboxes.forEach(cb => cb.checked = false);
        updateExerciseCount();
    });

    // Add event listeners to exercise checkboxes
    document.addEventListener('change', function (e) {
        if (e.target.matches('#exercise-checkboxes input[type="checkbox"]')) {
            updateExerciseCount();
        }
    });

    document.getElementById('create-workout-button').addEventListener('click', function () {
        console.log('Create workout button clicked');

        // Prevent duplicate calls
        if (isGeneratingWorkout) {
            console.log('Workout generation already in progress, skipping');
            return;
        }

        isGeneratingWorkout = true;
        generateWorkout();
        document.getElementById('start-workout-button').classList.remove('hidden');
        document.getElementById('regenerate-workout-button').classList.remove('hidden');

        // Reset flag after a short delay
        setTimeout(() => {
            isGeneratingWorkout = false;
        }, 1000);
    });

    document.getElementById('regenerate-workout-button').addEventListener('click', function () {
        generateWorkout();
        document.getElementById('start-workout-button').classList.remove('hidden');
        document.querySelector('.timer-container').classList.add('hidden');
        document.getElementById('progress-bar').classList.add('hidden');
        updateProgressBar(); // Reset progress
    });

    document.getElementById('start-workout-button').addEventListener('click', async function () {
        startWorkout();
        nextRound();
        document.getElementById('start-workout-button').classList.add('hidden');
        document.getElementById('active-controls').classList.remove('hidden');
        document.getElementById('regenerate-workout-button').classList.add('hidden');
        document.querySelector('.timer-container').classList.remove('hidden');
        document.getElementById('progress-bar').classList.remove('hidden');
        updateProgressBar();
        playMusic();
        announceWorkoutStart();

        // Activate screen wake lock to keep screen on during workout
        await requestScreenWakeLock();
    });

    // Next Round Slider
    const nextRoundSlider = document.getElementById('next-round-slider');
    const sliderFill = document.getElementById('slider-fill');
    let isSliding = false;

    nextRoundSlider.addEventListener('input', function () {
        const value = this.value;
        sliderFill.style.width = value + '%';

        // When slider reaches 100%, move to next round
        if (value >= 100 && !isSliding) {
            isSliding = true;

            // Stop all TTS announcements and clear pending timeouts
            stopTTS();

            // Store the completed round number before nextRound() increments it
            const completedRound = currentRound;

            // Announce the round is complete (before moving to next round)
            if (completedRound > 0) {
                announceRoundComplete(completedRound);
            }

            // Check if this is the last round before proceeding
            const isLastRound = completedRound === totalRounds;

            // Wait a moment, then proceed to next round
            setTimeout(() => {
                if (!isLastRound) {
                    nextRound(); // Proceed to the next round (this increments currentRound)
                    // Announce round start and then exercises (same format as first round)
                    announceNextRound(currentRound);
                    // Announce exercises after round start announcement
                    setTimeout(() => {
                        announceAllExercisesInRound();
                    }, 2000); // 2 second delay to let round announcement finish first
                } else {
                    // Last round completed, show finish button
                    document.getElementById('active-controls').classList.add('hidden');
                    document.getElementById('finish-workout-button').classList.remove('hidden');
                }
            }, 1500); // 1.5 second delay to let round complete announcement finish

            // Reset slider after a short delay
            setTimeout(() => {
                this.value = 0;
                sliderFill.style.width = '0%';
                isSliding = false;
            }, 2000);
        }
    });

    // Reset slider on mouse up if not at 100%
    nextRoundSlider.addEventListener('mouseup', function () {
        if (this.value < 100) {
            this.value = 0;
            sliderFill.style.width = '0%';
        }
    });

    nextRoundSlider.addEventListener('touchend', function () {
        if (this.value < 100) {
            this.value = 0;
            sliderFill.style.width = '0%';
        }
    });


    document.getElementById('finish-workout-button').addEventListener('click', function () {
        // Save final round's data
        if (currentRound > 0) {
            const finalRoundData = workoutStats.roundData[currentRound - 1];
            if (finalRoundData && !finalRoundData.endTime) {
                finalRoundData.endTime = Date.now();
                finalRoundData.duration = (finalRoundData.endTime - finalRoundData.startTime) / 1000;

                // Update total reps for final round
                Object.keys(finalRoundData.exercises).forEach(exercise => {
                    if (!workoutStats.totalExerciseReps[exercise]) {
                        workoutStats.totalExerciseReps[exercise] = 0;
                    }
                    workoutStats.totalExerciseReps[exercise] += finalRoundData.exercises[exercise];
                });
            }
        }

        endTime = new Date();
        stopTimer();
        clearInterval(roundTimerInterval);
        stopMusic();
        stopTTS();
        playCompletionSound();
        announceWorkoutComplete();

        // Display workout statistics
        displayWorkoutStats();

        // Release screen wake lock when workout is finished
        releaseScreenWakeLock();
    });

    document.getElementById('restart-workout-button').addEventListener('click', function () {
        // Reset all workout state
        currentRound = 0;
        totalReps = 0;
        exerciseReps = {};
        selectedExercises = [];

        // Hide workout display and show generator
        document.getElementById('workout-display').classList.add('hidden');
        document.getElementById('workout-generator').classList.remove('hidden');

        // Hide all workout buttons
        document.getElementById('start-workout-button').classList.add('hidden');
        document.getElementById('regenerate-workout-button').classList.add('hidden');
        document.getElementById('active-controls').classList.add('hidden');
        document.getElementById('finish-workout-button').classList.add('hidden');
        document.getElementById('restart-workout-button').classList.add('hidden');

        // Hide timers and progress bar
        document.querySelector('.timer-container').classList.add('hidden');
        document.getElementById('progress-bar').classList.add('hidden');

        // Reset progress bar
        updateProgressBar();

        // Stop any ongoing timers and music
        stopTimer();
        clearInterval(roundTimerInterval);
        stopMusic();
        stopTTS();

        // Release screen wake lock when restarting
        releaseScreenWakeLock();
    });

    function generateWorkout() {
        console.log('generateWorkout function called');
        currentRound = 0;
        const selectedDifficulty = document.getElementById('difficulty').value;
        const workoutType = document.getElementById('workout-type').value;
        console.log('Selected difficulty:', selectedDifficulty);
        console.log('Workout type:', workoutType);

        // Handle custom workout
        if (workoutType === 'customize') {
            const limit = getExerciseLimit();
            if (customSelectedExercises.length !== limit) {
                alert(`Please select exactly ${limit} exercises for your ${document.getElementById('difficulty').selectedOptions[0].text} custom workout.`);
                return;
            }
            selectedExercises = [...customSelectedExercises]; // Use custom selected exercises
            console.log('Custom selected exercises:', selectedExercises);
        } else {
            // Handle regular workout types
            let numExercises = 0;
            switch (selectedDifficulty) {
                case 'easy':
                    numExercises = 5;
                    break;
                case 'medium':
                    numExercises = 8;
                    break;
                case 'hard':
                    numExercises = 11;
                    break;
                default:
                    numExercises = 8;
            }
            console.log('Number of exercises:', numExercises);

            // Get exercises based on workout type
            let exercisePool = [];
            if (workoutType in exerciseCategories) {
                exercisePool = exerciseCategories[workoutType];
            } else {
                exercisePool = exerciseCategories['Full Body']; // Default fallback
            }

            selectedExercises = getRandomExercises(exercisePool, numExercises);
            console.log('Selected exercises:', selectedExercises);
        }

        exerciseReps = {};
        selectedExercises.forEach(exercise => exerciseReps[exercise] = 0);
        totalReps = 0;

        displayInitialExercises();
    }

    function displayInitialExercises() {
        console.log('displayInitialExercises function called');
        const workoutList = document.getElementById('workout-list');
        console.log('Workout list element:', workoutList);

        workoutList.innerHTML = selectedExercises.map((exercise, index) => {
            return `<li><div class="number-badge">${index + 1}</div><span>${exercise}</span></li>`;
        }).join('');

        console.log('Hiding workout generator, showing workout display');
        document.getElementById('workout-generator').classList.add('hidden');
        document.getElementById('workout-display').classList.remove('hidden');
    }

    function startWorkout() {
        startTime = new Date();
        startTimer();

        // Announce all exercises after workout starts (like original BD2)
        setTimeout(() => {
            announceAllExercisesInRound();
        }, 2000); // Delay to let workout start announcement finish first
    }

    function startTimer() {
        timerInterval = setInterval(() => {
            if (!isPaused) {
                const currentTime = new Date();
                const totalTime = currentTime - startTime - totalPausedTime;
                document.getElementById('timer').textContent = `Total: ${formatTime(totalTime)}`;
            } else {
                totalPausedTime += 1000;
            }
        }, 1000);
    }

    function nextRound() {
        // Save previous round's end time and calculate duration
        if (currentRound > 0) {
            const previousRoundData = workoutStats.roundData[currentRound - 1];
            if (previousRoundData) {
                previousRoundData.endTime = Date.now();
                previousRoundData.duration = (previousRoundData.endTime - previousRoundData.startTime) / 1000; // seconds

                // Update total reps for each exercise
                Object.keys(previousRoundData.exercises).forEach(exercise => {
                    if (!workoutStats.totalExerciseReps[exercise]) {
                        workoutStats.totalExerciseReps[exercise] = 0;
                    }
                    workoutStats.totalExerciseReps[exercise] += previousRoundData.exercises[exercise];
                });
            }
        }

        currentRound++;
        roundStartTime = new Date();
        roundEndTime = roundStartTime;
        roundTimes.push(roundEndTime.getTime());

        // Initialize round data for statistics
        workoutStats.roundData.push({
            round: currentRound,
            exercises: { ...exerciseReps },  // Copy current round's reps
            startTime: Date.now(),
            endTime: null,
            duration: 0
        });

        document.getElementById('current-round-info').innerHTML = `<h3>Round ${currentRound}:</h3>`;
        document.getElementById('round-timer').classList.remove('red');

        updateExerciseReps();
        updateProgressBar();
        if (currentRound > 1) {
            clearInterval(roundTimerInterval);
        }
        if (currentRound <= totalRounds) {
            startRoundTimer();
        }
    }

    function updateExerciseReps() {
        const workoutList = document.getElementById('workout-list');
        selectedExercises = shuffleArray(selectedExercises);
        selectedExercises.forEach((exercise, index) => {
            const reps = Math.floor(Math.random() * 11) + 1;
            exerciseReps[exercise] = reps; // Use = instead of += to set new reps for each round
            totalReps += reps;
            workoutList.children[index].innerHTML = `<div class="number-badge reps">${reps}</div><span>${exercise}: ${reps} reps</span>`;
        });
    }

    function startRoundTimer() {
        let roundSeconds = 0;
        let hasPlayedBellSound = false;

        roundTimerInterval = setInterval(() => {
            if (isPaused) {
                roundPausedTime += 1000;
                return;
            }
            roundSeconds++;

            if (roundSeconds === 180 && !hasPlayedBellSound) {
                document.getElementById('round-timer').classList.add('red');
                playBellSound();
                hasPlayedBellSound = true;
            }

            document.getElementById('round-timer').textContent = `Round: ${formatTime(roundSeconds * 1000)}`;
            roundEndTime = new Date();
        }, 1000);
    }

    function stopTimer() {
        clearInterval(timerInterval);
    }

    function showSummary() {
        const averageRoundTime = calculateAverageRoundTime();
        const totalWorkoutTime = endTime - startTime;

        const summaryHtml = `<h2>Workout Complete!</h2>
                         <p>Total Time: ${formatTime(totalWorkoutTime)}</p>
                         <p>Average Round Time: ${formatTime(averageRoundTime)}</p>
                         <p>Total Reps: ${totalReps}</p>` +
            Object.entries(exerciseReps).map(([exercise, reps]) => `<p>${exercise}: ${reps} reps</p>`).join('');

        document.getElementById('workout-display').innerHTML = summaryHtml;
    }

    function calculateAverageRoundTime() {
        if (roundTimes.length === 0) return 0;

        const totalRoundTimes = roundTimes.reduce((acc, curr, index) => {
            if (index > 0) {
                return acc + (curr - roundTimes[index - 1]);
            }
            return acc;
        }, 0);

        return totalRoundTimes / (roundTimes.length - 1);
    }

    function showChart() {
        const labels = Array.from({ length: currentRound }, (_, i) => `Round ${i + 1}`);
        const roundTimesMinutes = [];
        for (let i = 1; i < roundTimes.length; i++) {
            const roundTimeDiff = roundTimes[i] - roundTimes[i - 1];
            const roundTimeMinutes = roundTimeDiff / (1000 * 60);
            roundTimesMinutes.push(roundTimeMinutes);
        }

        if (currentRound === totalRounds) {
            const lastRoundTimeDiff = endTime - roundTimes[roundTimes.length - 1];
            const lastRoundTimeMinutes = lastRoundTimeDiff / (1000 * 60);
            roundTimesMinutes.push(lastRoundTimeMinutes);
        }

        const chartContainer = document.getElementById('round-times-graph');
        chartContainer.style.backgroundColor = 'black';
        chartContainer.style.borderRadius = '20px';
        chartContainer.style.display = 'block';

        const ctx = chartContainer.getContext('2d');
        new Chart(ctx, {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [{
                    label: 'Performance Round Times',
                    data: roundTimesMinutes,
                    backgroundColor: 'rgba(54, 162, 235, 0.5)',
                    borderColor: 'rgba(255, 165, 0, 1)',
                    borderWidth: 3
                }]
            },
            options: {
                scales: {
                    y: {
                        beginAtZero: true,
                        title: {
                            display: true,
                            text: 'Time (Minutes)'
                        }
                    },
                    x: {
                        title: {
                            display: true,
                            text: ''
                        }
                    }
                },
                plugins: {
                    legend: {
                        labels: {
                            color: 'white'
                        }
                    },
                    title: {
                        display: true,
                        text: 'Chart Title',
                        color: 'white'
                    }
                },
                layout: {
                    padding: {
                        left: 10,
                        right: 10,
                        top: 10,
                        bottom: 10
                    }
                }
            }
        });
    }

    document.getElementById('music-selection').addEventListener('change', function () {
        const musicChoice = this.value;
        manageMusic(musicChoice);
    });


    function manageMusic(musicChoice) {
        console.log('=== MANAGE MUSIC CALLED ===');
        console.log('Music choice:', musicChoice);

        let audioPlayer = document.getElementById('music-player');
        console.log('Audio player before:', audioPlayer);

        if (audioPlayer) {
            audioPlayer.pause();
            audioPlayer.currentTime = 0;
        }

        if (musicChoice) {
            if (!audioPlayer) {
                console.log('Creating new audio element');
                audioPlayer = new Audio();
                audioPlayer.id = 'music-player';
                document.body.appendChild(audioPlayer);
            }

            if (musicChoice !== "") {
                let musicPath = "";
                if (musicChoice === "popular-mix") {
                    musicPath = "popular.mp3";
                } else if (musicChoice === "house") {
                    musicPath = "house.mp3";
                } else if (musicChoice === "hiphop") {
                    musicPath = "hop.mp3";
                }

                console.log('Setting audio src to:', musicPath);
                audioPlayer.src = musicPath;
                audioPlayer.volume = 0.7; // Set initial volume
                console.log('Audio configured - src:', audioPlayer.src, 'volume:', audioPlayer.volume);

                // Add event listeners for debugging
                audioPlayer.addEventListener('loadeddata', () => {
                    console.log('✅ Audio file loaded successfully');
                }, { once: true });

                audioPlayer.addEventListener('error', (e) => {
                    console.error('❌ Audio loading error:', e);
                    console.error('Error details:', audioPlayer.error);
                }, { once: true });
            }
        }
    }

    function playCompletionSound() {
        let completionSound = new Audio('done.mp3');
        completionSound.play().catch(e => {
            console.error("Failed to play completion sound:", e);
        });
    }

    // TTS Integration - Hybrid (Backend + Browser Fallback)
    let currentAudio = null;
    let speechQueue = [];
    let isSpeaking = false;
    let isAnnouncing = false;
    let announcementTimeouts = []; // Track all announcement timeouts for cleanup

    function speakText(text, options = {}) {
        console.log('TTS: Attempting to speak:', text);

        // Add to queue
        return new Promise((resolve, reject) => {
            speechQueue.push({ text, options, resolve, reject });
            processSpeechQueue();
        });
    }

    async function processSpeechQueue() {
        // Only process if not currently speaking and queue has items
        if (isSpeaking || speechQueue.length === 0) {
            return;
        }

        const { text, options, resolve, reject } = speechQueue.shift();
        isSpeaking = true;

        // Try Backend TTS first
        try {
            await speakWithBackend(text, options);
            console.log('TTS: Backend speech completed');
            isSpeaking = false;
            resolve();
            // Process next item in queue after a small delay
            setTimeout(() => {
                processSpeechQueue();
            }, 200);
        } catch (backendError) {
            console.warn('TTS: Backend failed, falling back to browser TTS:', backendError);

            // Fallback to Browser TTS
            try {
                await speakWithBrowser(text, options);
                console.log('TTS: Browser speech completed');
                isSpeaking = false;
                resolve();
                // Process next item in queue after a small delay
                setTimeout(() => {
                    processSpeechQueue();
                }, 200);
            } catch (browserError) {
                console.error('TTS: All methods failed:', browserError);
                isSpeaking = false;
                reject(browserError);
                // Continue processing queue even on error
                setTimeout(() => {
                    processSpeechQueue();
                }, 200);
            }
        }
    }

    async function speakWithBackend(text, options) {
        const voiceSelect = document.getElementById('voice-select');
        const selectedVoice = voiceSelect ? voiceSelect.value : 'Female';

        // Map selection to Google Cloud voices
        let voiceName = 'en-GB-Neural2-A'; // Default Female
        let gender = 'FEMALE';

        if (selectedVoice === 'Male') {
            voiceName = 'en-GB-Neural2-B';
            gender = 'MALE';
        }

        // Use relative URL for same-domain deployment, or use environment variable
        const ttsUrl = window.location.origin + '/api/tts/synthesize';
        const response = await fetch(ttsUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                text,
                voice: voiceName,
                gender: gender,
                speakingRate: options.rate || 0.95,
                pitch: options.pitch || 0
            })
        });

        if (!response.ok) {
            throw new Error(`Backend responded with ${response.status}`);
        }

        const data = await response.json();
        if (!data.audioContent) {
            throw new Error('No audio content received');
        }

        return new Promise((resolve, reject) => {
            const audio = new Audio(`data:audio/mp3;base64,${data.audioContent}`);
            currentAudio = audio;

            audio.onended = () => {
                currentAudio = null;
                resolve();
            };

            audio.onerror = (e) => {
                currentAudio = null;
                reject(e);
            };

            audio.play().catch(reject);
        });
    }

    function speakWithBrowser(text, options) {
        console.log('=== BROWSER TTS CALLED ===');
        console.log('Text to speak:', text);
        console.log('Options:', options);

        return new Promise((resolve, reject) => {
            if (!('speechSynthesis' in window)) {
                console.error('❌ Browser TTS not supported');
                reject(new Error('Browser TTS not supported'));
                return;
            }

            console.log('Speech synthesis available');
            // Don't cancel - the queue ensures only one speech at a time
            // Only cancel if we're explicitly stopping (handled by stopTTS)
            const utterance = new SpeechSynthesisUtterance(text);

            // Store reference to current utterance for potential cleanup
            let utteranceRef = utterance;

            // Settings
            utterance.rate = options.rate || 0.95;
            utterance.pitch = options.pitch || 0;
            utterance.volume = options.volume || 1;
            utterance.lang = 'en-GB';

            console.log('Utterance settings:', {
                rate: utterance.rate,
                pitch: utterance.pitch,
                volume: utterance.volume,
                lang: utterance.lang
            });

            // Voice selection logic (simplified for fallback)
            const voices = speechSynthesis.getVoices();
            console.log('Available voices:', voices.length);

            const voiceSelect = document.getElementById('voice-select');
            const selectedType = voiceSelect ? voiceSelect.value : 'Female';
            console.log('Selected voice type:', selectedType);

            let selectedVoice = voices.find(v =>
                v.lang.includes('GB') &&
                (selectedType === 'Female' ? v.name.includes('Female') || v.name.includes('Susan') : v.name.includes('Male') || v.name.includes('George'))
            );

            if (!selectedVoice) {
                selectedVoice = voices.find(v => v.lang.includes('GB')) || voices[0];
            }

            if (selectedVoice) {
                utterance.voice = selectedVoice;
                console.log('Using voice:', selectedVoice.name);
            } else {
                console.warn('⚠️ No voice selected, using default');
            }

            utterance.onend = () => {
                console.log('✅ TTS completed');
                utteranceRef = null;
                resolve();
            };

            utterance.onerror = (e) => {
                console.error('❌ TTS error:', e);
                utteranceRef = null;
                // If interrupted, it means something else canceled it (like stopTTS)
                // In that case, we should reject so the queue knows it didn't complete
                if (e.error === 'interrupted') {
                    console.log('TTS interrupted - likely by explicit stopTTS call');
                    reject(new Error('Speech interrupted'));
                } else {
                    reject(e);
                }
            };

            // Check if speech synthesis is already speaking
            // This shouldn't happen with proper queueing, but add a safety check
            if (speechSynthesis.speaking) {
                console.log('⚠️ Warning: Speech synthesis is already speaking (queue should prevent this)');
                // Wait a bit and try again - queue should handle this but add safety
                const checkInterval = setInterval(() => {
                    if (!speechSynthesis.speaking) {
                        clearInterval(checkInterval);
                        console.log('Starting speech after wait...');
                        speechSynthesis.speak(utterance);
                    }
                }, 100);

                // Timeout after 5 seconds to prevent infinite wait
                setTimeout(() => {
                    clearInterval(checkInterval);
                    if (!speechSynthesis.speaking) {
                        console.log('Starting speech after timeout...');
                        speechSynthesis.speak(utterance);
                    }
                }, 5000);
            } else {
                console.log('Starting speech...');
                speechSynthesis.speak(utterance);
            }
        });
    }

    function stopTTS() {
        console.log('TTS: Stopping all speech');

        // Clear all pending announcement timeouts
        announcementTimeouts.forEach(timeoutId => clearTimeout(timeoutId));
        announcementTimeouts = [];

        if (currentAudio) {
            currentAudio.pause();
            currentAudio = null;
        }
        speechSynthesis.cancel();
        speechQueue = [];
        isSpeaking = false;
        isAnnouncing = false;
    }

    function updateVoiceSelection() {
        const voiceSelect = document.getElementById('voice-select');
        voiceSelect.innerHTML = '';

        const option1 = document.createElement('option');
        option1.value = 'Female';
        option1.textContent = 'Female';
        voiceSelect.appendChild(option1);

        const option2 = document.createElement('option');
        option2.value = 'Male';
        option2.textContent = 'Male';
        voiceSelect.appendChild(option2);
    }

    // Check browser TTS capabilities
    function checkBrowserTTSStatus() {
        if (!('speechSynthesis' in window)) {
            console.error('❌ Speech synthesis not supported');
            return false;
        }

        const voices = speechSynthesis.getVoices();
        console.log('✅ Browser TTS supported, voices available:', voices.length);
        console.log('All available voices:', voices.map(v => `${v.name} (${v.lang})`));

        // Check for en-GB voices
        const enGBVoices = voices.filter(v => v.lang.startsWith('en-GB'));
        console.log('en-GB voices found:', enGBVoices.length);

        // Check for all English voices
        const englishVoices = voices.filter(v => v.lang.startsWith('en'));
        console.log('English voices found:', englishVoices.length);

        return true;
    }


    // Run browser TTS check when page loads
    setTimeout(() => {
        checkBrowserTTSStatus();
        updateVoiceSelection();
    }, 1000);

    // Force voice loading immediately on any user interaction
    const forceVoiceLoad = () => {
        console.log('User interaction detected - forcing voice load');
        const voices = speechSynthesis.getVoices();
        console.log('Voices after user interaction:', voices.length);

        if (voices.length > 0) {
            updateVoiceSelection();
        }
    };

    // Add multiple event listeners for user interaction
    document.addEventListener('click', forceVoiceLoad, { once: true });
    document.addEventListener('touchstart', forceVoiceLoad, { once: true });
    document.addEventListener('mousedown', forceVoiceLoad, { once: true });
    document.addEventListener('keydown', forceVoiceLoad, { once: true });

    // Initialize Voice Selection
    updateVoiceSelection();

    // Optional: Check browser support for fallback
    if ('speechSynthesis' in window) {
        speechSynthesis.onvoiceschanged = () => {
            console.log('Browser voices changed');
        };
    }

    // TTS Announcements for workout events (matching original BD2 style)
    function announceWorkoutStart() {
        if (document.getElementById('tts-enabled').checked) {
            speakText("Workout starting now! Get ready for your first exercise.", {
                rate: 0.95,
                pitch: 0,
                volume: 0.8,
                lang: 'en-GB'
            });
        }
    }

    function announceNextRound(roundNumber) {
        if (document.getElementById('tts-enabled').checked) {
            speakText(`Round ${roundNumber} starting now. Let's go!`, {
                rate: 0.95,
                pitch: 0,
                volume: 0.7,
                lang: 'en-GB'
            });
        }
    }

    function announceAllExercisesInRound() {
        if (!document.getElementById('tts-enabled').checked) return;

        // Prevent duplicate announcements
        if (isAnnouncing) {
            console.log('TTS: Already announcing, skipping duplicate call');
            return;
        }

        isAnnouncing = true;

        // Clear any existing announcement timeouts from previous round
        announcementTimeouts.forEach(timeoutId => clearTimeout(timeoutId));
        announcementTimeouts = [];

        // Don't stop current speech - let the queue handle it naturally
        // This ensures each speech finishes before the next starts

        // Original BD2 timing calculations
        const REP_DURATION_MS = 2630; // 2.63 seconds per rep (from original BD2)
        const EXERCISE_GAP_MS = 6000; // 6 seconds between exercises (from original BD2)

        // Announce all exercises in the round with proper timing
        let cumulativeTime = 0; // Start immediately (no delay since workout start already announced)

        selectedExercises.forEach((exercise, index) => {
            const reps = exerciseReps[exercise];
            const isLastExercise = index === selectedExercises.length - 1;
            const isFirstExercise = index === 0;

            // Calculate exercise duration based on reps
            const exerciseDuration = reps * REP_DURATION_MS;

            if (isFirstExercise) {
                // First exercise announcement with next exercise
                const timeoutId = setTimeout(() => {
                    const repText = reps === 1 ? "repetition" : "repetitions";
                    const nextExercise = selectedExercises[1];
                    const nextReps = exerciseReps[nextExercise];
                    const nextRepText = nextReps === 1 ? "repetition" : "repetitions";

                    speakText(`First exercise: ${exercise}. Do ${reps} ${repText}. Coming up next ${nextExercise} with ${nextReps} ${nextRepText}.`, {
                        rate: 0.95,
                        pitch: 0,
                        volume: 0.7,
                        lang: 'en-GB'
                    });
                }, 1000); // Short delay for first exercise
                announcementTimeouts.push(timeoutId);
            } else if (!isLastExercise) {
                // Middle exercises with next exercise
                const timeoutId = setTimeout(() => {
                    const repText = reps === 1 ? "repetition" : "repetitions";
                    const nextExercise = selectedExercises[index + 1];
                    const nextReps = exerciseReps[nextExercise];
                    const nextRepText = nextReps === 1 ? "repetition" : "repetitions";

                    speakText(`Exercise ${index + 1}: ${exercise}. Do ${reps} ${repText}. Coming up next ${nextExercise} with ${nextReps} ${nextRepText}.`, {
                        rate: 0.95,
                        pitch: 0,
                        volume: 0.7,
                        lang: 'en-GB'
                    });
                }, cumulativeTime);
                announcementTimeouts.push(timeoutId);
            } else {
                // Final exercise announcement
                const timeoutId = setTimeout(() => {
                    const repText = reps === 1 ? "repetition" : "repetitions";
                    speakText(`Final exercise: ${exercise}. Do ${reps} ${repText}.`, {
                        rate: 0.95,
                        pitch: 0,
                        volume: 0.7,
                        lang: 'en-GB'
                    });
                }, cumulativeTime);
                announcementTimeouts.push(timeoutId);
            }

            // Add time for this exercise plus gap
            cumulativeTime += exerciseDuration + EXERCISE_GAP_MS;

            // Reset announcement flag after last exercise (no round complete announcement here)
            if (isLastExercise) {
                const timeoutId = setTimeout(() => {
                    // Reset announcement flag after completion
                    isAnnouncing = false;
                }, cumulativeTime - EXERCISE_GAP_MS + 1000);
                announcementTimeouts.push(timeoutId);
            }
        });
    }

    function announceWorkoutComplete() {
        if (document.getElementById('tts-enabled').checked) {
            speakText("Amazing work! Your workout is complete. Great job!", {
                rate: 0.95,
                pitch: 0,
                volume: 0.8,
                lang: 'en-GB'
            });
        }
    }

    function announceRoundComplete(roundNumber) {
        if (document.getElementById('tts-enabled').checked) {
            speakText(`Round ${roundNumber} complete!`, {
                rate: 0.95,
                pitch: 0,
                volume: 0.7,
                lang: 'en-GB'
            });
        }
    }

    function playBellSound() {
        const bellSound = new Audio('bell-98033.mp3');
        bellSound.play().catch(e => {
            console.error("Failed to play bell sound:", e);
        });
    }

    // TTS Controls - stopTTS function is defined above



    function getRandomExercises(exercises, num) {
        return shuffleArray([...exercises]).slice(0, num);
    }

    function shuffleArray(array) {
        for (let i = array.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [array[i], array[j]] = [array[j], array[i]];
        }
        return array;
    }

    function formatTime(milliseconds) {
        const totalSeconds = Math.floor(milliseconds / 1000);
        const minutes = Math.floor(totalSeconds / 60);
        const seconds = totalSeconds % 60;
        return `${minutes}m ${seconds}s`;
    }

    // Update Progress Bar - Light up circles as rounds complete
    function updateProgressBar() {
        const circles = document.querySelectorAll('.progress-circle');
        circles.forEach((circle, index) => {
            const roundNumber = index + 1;
            circle.classList.remove('completed', 'active');

            if (roundNumber < currentRound) {
                // Past rounds - green (completed)
                circle.classList.add('completed');
            } else if (roundNumber === currentRound) {
                // Current round - active (blue with pulse)
                circle.classList.add('active');
            }
            // Future rounds remain default (gray)
        });
    }

    function playMusic() {
        let audioPlayer = document.getElementById('music-player');
        if (audioPlayer && audioPlayer.src) {
            audioPlayer.play().catch(e => {
                console.error("Failed to play music:", e);
            });
        }
    }

    function stopMusic() {
        let audioPlayer = document.getElementById('music-player');
        if (audioPlayer) {
            audioPlayer.pause();
            audioPlayer.currentTime = 0;
            console.log("Music stopped");
        }
    }

    // Music Controls
    const musicPlayPauseBtn = document.getElementById('music-play-pause');
    const musicStopBtn = document.getElementById('music-stop');
    const musicRewindBtn = document.getElementById('music-rewind');
    const musicVolumeSlider = document.getElementById('music-volume');
    const audioPlayer = document.getElementById('music-player');

    if (musicPlayPauseBtn) {
        musicPlayPauseBtn.onclick = function () {
            if (audioPlayer && audioPlayer.src) {
                if (audioPlayer.paused) {
                    audioPlayer.play();
                    musicPlayPauseBtn.innerHTML = '<i class="fas fa-pause"></i>';
                } else {
                    audioPlayer.pause();
                    musicPlayPauseBtn.innerHTML = '<i class="fas fa-play"></i>';
                }
            }
        };
    }

    if (musicStopBtn) {
        musicStopBtn.onclick = function () {
            if (audioPlayer) {
                audioPlayer.pause();
                audioPlayer.currentTime = 0;
                if (musicPlayPauseBtn) {
                    musicPlayPauseBtn.innerHTML = '<i class="fas fa-play"></i>';
                }
            }
        };
    }

    if (musicRewindBtn) {
        musicRewindBtn.onclick = function () {
            if (audioPlayer) {
                audioPlayer.currentTime = Math.max(0, audioPlayer.currentTime - 10);
            }
        };
    }

    if (musicVolumeSlider) {
        musicVolumeSlider.oninput = function () {
            if (audioPlayer) {
                audioPlayer.volume = this.value / 100;
            }
        };
        // Set initial volume
        if (audioPlayer) {
            audioPlayer.volume = 0.7;
        }
    }

    // Music Selection
    const musicSelection = document.getElementById('music-selection');

    // Music file mapping
    const musicFiles = {
        'popular-mix': 'popular.mp3',
        'hiphop': 'hop.mp3',
        'house': 'house.mp3'
    };

    // Track display names
    const trackNames = {
        'popular-mix': 'Popular',
        'hiphop': 'Hip-Hop',
        'house': 'House',
        '': 'No Music'
    };

    // Array of music options for cycling
    const musicOptions = ['popular-mix', 'hiphop', 'house', ''];

    // Function to update change track button text
    function updateChangeTrackButton() {
        const changeTrackBtn = document.getElementById('music-change-track');
        if (changeTrackBtn) {
            const currentTrack = musicSelection ? musicSelection.value : '';
            const trackName = trackNames[currentTrack] || 'No Music';
            changeTrackBtn.innerHTML = `<i class="fas fa-music"></i> <span class="track-name">${trackName}</span>`;
        }
    }

    if (musicSelection) {
        musicSelection.onchange = function () {
            const selectedMusic = this.value;
            if (selectedMusic && musicFiles[selectedMusic]) {
                audioPlayer.src = musicFiles[selectedMusic];
                console.log('Music loaded:', musicFiles[selectedMusic]);
            } else {
                audioPlayer.src = '';
                console.log('No music selected');
            }
            // Update change track button to show current track
            updateChangeTrackButton();
        };

        // Initialize button text on page load
        updateChangeTrackButton();
    }

    // Change Track Button - Cycles through available tracks
    const changeTrackBtn = document.getElementById('music-change-track');
    if (changeTrackBtn) {
        changeTrackBtn.addEventListener('click', function () {
            const currentTrack = musicSelection.value;
            const currentIndex = musicOptions.indexOf(currentTrack);

            // Find next track (cycle through)
            let nextIndex = (currentIndex + 1) % musicOptions.length;
            const nextTrack = musicOptions[nextIndex];

            // Update selection
            musicSelection.value = nextTrack;

            // Trigger change event to load new track (this will also update button text)
            if (musicSelection.onchange) {
                musicSelection.onchange();
            } else {
                // Fallback if onchange not set
                const event = new Event('change');
                musicSelection.dispatchEvent(event);
                updateChangeTrackButton();
            }

            // If music is playing, restart with new track
            if (audioPlayer && !audioPlayer.paused) {
                audioPlayer.currentTime = 0;
                audioPlayer.play().catch(e => {
                    console.error('Failed to play new track:', e);
                });
            } else if (audioPlayer && audioPlayer.src) {
                // If paused, just load the new track
                audioPlayer.currentTime = 0;
            }

            console.log('Changed track to:', nextTrack || 'No Music');
        });
    }

    // Workout Statistics Display Functions
    function displayWorkoutStats() {
        // Hide workout display
        document.getElementById('workout-display').classList.add('hidden');

        // Show stats
        const statsDiv = document.getElementById('workout-stats');
        statsDiv.classList.remove('hidden');

        // Calculate total reps
        const totalReps = Object.values(workoutStats.totalExerciseReps).reduce((sum, reps) => sum + reps, 0);

        // Display total reps
        const totalRepsDiv = document.getElementById('total-reps-display');
        totalRepsDiv.innerHTML = `
            <div class="total-reps-card">
                <div class="total-reps-label">Total Reps Completed</div>
                <div class="total-reps-value">${totalReps}</div>
            </div>
        `;

        // Display total reps per exercise
        const summaryDiv = document.getElementById('stats-summary');
        let summaryHTML = '<div class="stats-grid">';

        Object.entries(workoutStats.totalExerciseReps)
            .sort((a, b) => b[1] - a[1])  // Sort by reps descending
            .forEach(([exercise, reps]) => {
                summaryHTML += `
                    <div class="exercise-reps-card">
                        <div class="exercise-reps-value">${reps}</div>
                        <div class="exercise-reps-name">${exercise}</div>
                    </div>
                `;
            });

        summaryHTML += '</div>';
        summaryDiv.innerHTML = summaryHTML;

        // Create round times chart
        createRoundTimesChart();
    }

    function createRoundTimesChart() {
        const ctx = document.getElementById('round-times-chart').getContext('2d');

        const labels = workoutStats.roundData.map(r => `Round ${r.round}`);
        const data = workoutStats.roundData.map(r => {
            // Convert seconds to minutes for better readability
            return (r.duration / 60).toFixed(1);
        });

        new Chart(ctx, {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [{
                    label: 'Time (minutes)',
                    data: data,
                    backgroundColor: 'rgba(99, 102, 241, 0.6)',
                    borderColor: 'rgba(99, 102, 241, 1)',
                    borderWidth: 2
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: true,
                scales: {
                    y: {
                        beginAtZero: true,
                        ticks: {
                            color: '#e2e8f0',
                            callback: function (value) {
                                return value + ' min';
                            }
                        },
                        grid: {
                            color: 'rgba(255, 255, 255, 0.1)'
                        }
                    },
                    x: {
                        ticks: {
                            color: '#e2e8f0'
                        },
                        grid: {
                            color: 'rgba(255, 255, 255, 0.1)'
                        }
                    }
                },
                plugins: {
                    legend: {
                        labels: {
                            color: '#e2e8f0'
                        }
                    }
                }
            }
        });
    }

    // Close stats button
    document.getElementById('close-stats-button').addEventListener('click', function () {
        document.getElementById('workout-stats').classList.add('hidden');
        document.getElementById('workout-generator').classList.remove('hidden');

        // Reset workout stats for next workout
        workoutStats = {
            roundData: [],
            totalExerciseReps: {}
        };
        currentRound = 0;
    });

});