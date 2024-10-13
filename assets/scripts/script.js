const numSteps = 32;  // Number of steps in our sequence
const numGrids = 4;
let sequences = Array(numGrids).fill().map(() => Array(9).fill().map(() => Array(numSteps).fill(false)));
let activeGrids = [true, false, false, false];
let currentGrid = 0;
let isPlaying = false;
let currentStep = 0;
let intervalId = null;
let activeGridIndex = 0;
let currentTempo = 120; // Default tempo in BPM

const padColors = {
    'pad1': '#5c7cfa',
    'pad2': '#ffa94d',
    'pad3': '#ff8787',
    'pad4': '#da77f2',
    'pad5': '#69db7c',
    'pad6': '#4ecdc4',
    'pad7': '#f7b731',
    'pad8': '#ff6b6b',
    'pad9': '#45b7d1'
};

// Add these new variables
let isChangingSounds = false;
let samples = {};
let preloadedAudio = {};
const padSoundLists = {};
const padVolumes = {};
const padPitches = {};
const padPans = {};


// Add this variable at the top of your script file
const padCurrentIndex = {}

// Add this at the top of your file
const audioContext = new (window.AudioContext || window.webkitAudioContext)();

// Add this function to load samples
async function loadSamples() {
    const response = await fetch('./samples/sample_list.json');
    samples = await response.json();
    await preloadAudioFiles(samples);
}

// Add this function to preload audio files
async function preloadAudioFiles(sampleList) {
    const preloadPromises = [];

    function preloadCategory(category, path = '') {
        for (const [key, value] of Object.entries(category)) {
            if (typeof value === 'string') {
                const audioPath = `./samples/${path}${value}`;
                preloadPromises.push(preloadAudio(audioPath));
            } else if (typeof value === 'object') {
                preloadCategory(value, `${path}${key}/`);
            }
        }
    }

    preloadCategory(sampleList);
    await Promise.all(preloadPromises);
    console.log('All samples preloaded');
}

// Modify the preloadAudio function
async function preloadAudio(audioPath) {
    return new Promise((resolve, reject) => {
        fetch(audioPath)
            .then(response => response.arrayBuffer())
            .then(arrayBuffer => audioContext.decodeAudioData(arrayBuffer))
            .then(audioBuffer => {
                preloadedAudio[audioPath] = audioBuffer;
                resolve();
            })
            .catch(error => {
                console.error(`Error preloading audio ${audioPath}:`, error);
                reject(error);
            });
    });
}

function calculateIntervalFromBPM(bpm) {
    return 60000 / bpm / 4; // Assuming 16th notes (4 steps per beat)
}

function updateTempo(newTempo) {
    currentTempo = newTempo;
    document.getElementById('tempo-display').textContent = newTempo;
    if (isPlaying) {
        stopSequence();
        startSequence();
    }
}

async function loadPadSoundLists() {
    const pads = document.querySelectorAll('.pad');
    for (const pad of pads) {
        const soundListPath = pad.getAttribute('data-sound-list');
        console.log(`Attempting to load sound list for ${pad.id} from ${soundListPath}`);
        try {
            const response = await fetch(soundListPath);
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            const soundList = await response.json();
            padSoundLists[pad.id] = soundList;
            console.log(`Successfully loaded sound list for ${pad.id}:`, soundList);
            setInitialPadSound(pad);
        } catch (error) {
            console.error(`Error loading sound list for ${pad.id}:`, error);
        }
    }
}

// Modify the playSound function
async function playSound(input, isSequencerTrigger = false) {
    let button, padId;
    if (typeof input === 'string') {
        padId = input;
        button = document.getElementById(padId);
    } else if (input instanceof Event) {
        button = input.target;
        padId = button.id;
    } else {
        console.error('Invalid input for playSound function');
        return;
    }

    if (isChangingSounds && !isSequencerTrigger) {
        await changePadSound(button);
    }

    const soundPath = button.getAttribute('data-sound');
    if (!soundPath) {
        console.error(`No sound path found for ${padId}`);
        return;
    }
    const volume = padVolumes[padId] || 1;
    const pitch = padPitches[padId] || 1;
    const pan = padPans[padId] || 0;

    if (preloadedAudio[soundPath]) {
        const source = audioContext.createBufferSource();
        source.buffer = preloadedAudio[soundPath];
        
        const gainNode = audioContext.createGain();
        gainNode.gain.setValueAtTime(volume, audioContext.currentTime);

        const panNode = audioContext.createStereoPanner();
        panNode.pan.setValueAtTime(pan, audioContext.currentTime);

        source.playbackRate.setValueAtTime(pitch, audioContext.currentTime);

        source.connect(gainNode);
        gainNode.connect(panNode);
        panNode.connect(audioContext.destination);

        source.start();
        console.log(`Pad: ${padId}, Volume: ${volume}, Pitch: ${pitch}, Pan: ${pan}`);
    } else {
        console.warn(`Audio not preloaded: ${soundPath}`);
        // Optionally, you could add a fallback method here to load and play the sound
    }
}

// Add this function to change pad sound
async function changePadSound(pad) {
    const soundList = padSoundLists[pad.id];
    if (!soundList) {
        console.error(`No sound list found for ${pad.id}`);
        return;
    }

    const category = Object.keys(soundList)[0];
    const samples = soundList[category];
    let nextSample;
    let fullPath;

    if (Array.isArray(samples)) {
        if (!(pad.id in padCurrentIndex)) {
            padCurrentIndex[pad.id] = 0; // Start at -1 so first increment sets it to 0
        }
        padCurrentIndex[pad.id] = (padCurrentIndex[pad.id] + 1) % samples.length;
        nextSample = samples[padCurrentIndex[pad.id]];
        fullPath = `./samples/${category}/${nextSample}`;
    } else {
        const subCategories = Object.keys(samples);
        if (!(pad.id in padCurrentIndex)) {
            padCurrentIndex[pad.id] = { subCategoryIndex: 0, sampleIndex: 0 }; // Start sampleIndex at -1
        }
        const currentIndex = padCurrentIndex[pad.id];
        currentIndex.sampleIndex++;
        if (currentIndex.sampleIndex >= samples[subCategories[currentIndex.subCategoryIndex]].length) {
            currentIndex.sampleIndex = 0;
            currentIndex.subCategoryIndex = (currentIndex.subCategoryIndex + 1) % subCategories.length;
        }
        nextSample = samples[subCategories[currentIndex.subCategoryIndex]][currentIndex.sampleIndex];
        fullPath = `./samples/${category}/${subCategories[currentIndex.subCategoryIndex]}/${nextSample}`;
    }

    pad.setAttribute('data-sound', fullPath);
    pad.textContent = nextSample.replace('.wav', '');

    // Update the corresponding label
    const label = document.getElementById(`label-${pad.id}`);
    if (label) {
        label.textContent = pad.textContent;
    }

    // Preload the new sound
    try {
        await preloadAudio(fullPath);
        console.log(`New sound preloaded for ${pad.id}: ${fullPath}`);
    } catch (error) {
        console.error(`Failed to preload new sound for ${pad.id}: ${fullPath}`, error);
    }

    // // Play the new sound - This causing infinite loop
    // playSound(pad.id);
}

// Add this function to toggle change sounds mode
function toggleChangeSoundsMode() {
    isChangingSounds = !isChangingSounds;
    const changeSoundsBtn = document.getElementById('change-sounds-btn');
    changeSoundsBtn.textContent = isChangingSounds ? 'Play' : 'Switch Samples';
    console.log('Change sounds mode:', isChangingSounds ? 'ON' : 'OFF');
}

// Function to create grid
function createSequenceGrids() {
    const grids = document.querySelectorAll('.sequence-grid');
    const padOrder = ['pad3', 'pad2', 'pad1', 'pad6', 'pad5', 'pad4', 'pad9', 'pad8', 'pad7'];

    grids.forEach((grid, gridIndex) => {
        padOrder.forEach((padId, rowIndex) => {
            const pad = document.getElementById(padId);
            if (!pad) {
                console.warn(`Pad not found for id: ${padId}`);
                return;
            }

            const row = document.createElement('div');
            row.className = 'sequence-row';

            for (let step = 0; step < numSteps; step++) {
                const cell = document.createElement('div');
                cell.className = 'sequence-cell';
                if (step % 8 === 0) {
                    cell.classList.add('bar-start');
                } else if (step % 4 === 0) {
                    cell.classList.add('beat-start');
                }
                if (step % 4 === 0) {
                    cell.classList.add('quarter-note');
                }
                cell.dataset.grid = gridIndex;
                cell.dataset.row = padOrder.indexOf(padId);
                cell.dataset.step = step;
                cell.addEventListener('click', toggleStep);
                row.appendChild(cell);
            }
            grid.appendChild(row);
        });
    });

    // Show only the first grid initially
    switchGrid(0);
}

function createRowLabels() {
    const rowLabelsContainer = document.querySelector('.row-labels');
    const padOrder = ['pad3', 'pad2', 'pad1', 'pad6', 'pad5', 'pad4', 'pad9', 'pad8', 'pad7'];

    padOrder.forEach(padId => {
        const label = document.createElement('div');
        label.className = 'row-label';
        label.id = `label-${padId}`;
        label.textContent = document.getElementById(padId).textContent;
        label.style.backgroundColor = document.getElementById(padId).dataset.color;
        rowLabelsContainer.appendChild(label);
    });
}

// Function to toggle steps
function toggleStep(event) {
    const cell = event.target;
    const grid = parseInt(cell.dataset.grid);
    const row = parseInt(cell.dataset.row);
    const step = parseInt(cell.dataset.step);
    sequences[grid][row][step] = !sequences[grid][row][step];
    updateCellDisplay(cell, grid, row, step);
}

function updateCellDisplay(cell, grid, row, step) {
    const padOrder = ['pad3', 'pad2', 'pad1', 'pad6', 'pad5', 'pad4', 'pad9', 'pad8', 'pad7'];
    const padColors = {
        'pad1': '#5c7cfa',
        'pad2': '#ffa94d',
        'pad3': '#ff8787',
        'pad4': '#da77f2',
        'pad5': '#69db7c',
        'pad6': '#4ecdc4',
        'pad7': '#f7b731',
        'pad8': '#ff6b6b',
        'pad9': '#45b7d1'
    };

    if (sequences[grid][row][step]) {
        const padId = padOrder[row];
        const color = padColors[padId];
        cell.style.backgroundColor = color;
        cell.classList.add('active');
    } else {
        cell.style.backgroundColor = '';
        cell.classList.remove('active');
    }
}

// Function to play a single step of the sequence
// Function to play a single step of the sequence
function playStep() {
    // Check if there are any active grids
    if (!activeGrids.some(grid => grid)) {
        stopSequence();
        return;
    }

    const padOrder = ['pad3', 'pad2', 'pad1', 'pad6', 'pad5', 'pad4', 'pad9', 'pad8', 'pad7'];

    // Find the next active grid
    while (!activeGrids[activeGridIndex]) {
        activeGridIndex = (activeGridIndex + 1) % numGrids;
    }

    // Play sounds for the current step of the active grid
    padOrder.forEach((padId, index) => {
        if (sequences[activeGridIndex][index][currentStep]) {
            playSound(padId, true);  // Pass true for isSequencerTrigger
        }
    });

    // Highlight current step in all grids
    document.querySelectorAll('.sequence-cell').forEach(cell => {
        if (parseInt(cell.dataset.step) === currentStep) {
            const row = parseInt(cell.dataset.row);
            const padId = padOrder[row];
            const padColor = padColors[padId];
            cell.style.border = `2px solid ${padColor}`;
        } else {
            cell.style.border = '';
        }
    });

    // Move to the next step
    currentStep = (currentStep + 1) % numSteps;

    // If we've completed a full sequence, move to the next active grid
    if (currentStep === 0) {
        do {
            activeGridIndex = (activeGridIndex + 1) % numGrids;
        } while (!activeGrids[activeGridIndex]);
    }
}

// Function to start playing the sequence
function startSequence() {
    // Check if there are any active grids
    if (!activeGrids.some(grid => grid)) {
        alert("Please activate at least one grid before playing.");
        return;
    }

    if (!isPlaying) {
        isPlaying = true;
        currentStep = 0;
        activeGridIndex = 0;
        // Find the first active grid
        const intervalTime = calculateIntervalFromBPM(currentTempo);
    intervalId = setInterval(playStep, intervalTime);
    }
}

// Function to stop playing the sequence
function stopSequence() {
    if (isPlaying) {
        isPlaying = false;
        clearInterval(intervalId);
        document.querySelectorAll('.sequence-cell').forEach(cell => {
            cell.style.border = '';
        });
    }
}

// Function to switch grid
function switchGrid(gridIndex) {
    document.querySelectorAll('.sequence-grid').forEach((grid, index) => {
        grid.style.display = index === gridIndex ? 'block' : 'none';
    });
    currentGrid = gridIndex;
    updateGridDisplay();

    // Update active state of grid selector buttons
    document.querySelectorAll('.grid-selector').forEach((button, index) => {
        if (index === gridIndex) {
            button.classList.add('active');
        } else {
            button.classList.remove('active');
        }
    });
}

// Function to update grid display
function updateGridDisplay() {
    const cells = document.querySelectorAll(`#grid-${currentGrid} .sequence-cell`);
    cells.forEach(cell => {
        const row = parseInt(cell.dataset.row);
        const step = parseInt(cell.dataset.step);
        updateCellDisplay(cell, currentGrid, row, step);
    });
}

// Function to toggle grid active
function toggleGridActive(gridIndex) {
    activeGrids[gridIndex] = !activeGrids[gridIndex];
    document.querySelector(`.grid-toggle[data-grid="${gridIndex}"]`).checked = activeGrids[gridIndex];

    // If we're turning off the current active grid, find the next active one
    if (!activeGrids[activeGridIndex]) {
        let nextActiveGrid = (activeGridIndex + 1) % numGrids;
        while (!activeGrids[nextActiveGrid] && nextActiveGrid !== activeGridIndex) {
            nextActiveGrid = (nextActiveGrid + 1) % numGrids;
        }
        activeGridIndex = nextActiveGrid;
    }
}

function clearCurrentGrid() {
    sequences[currentGrid] = Array(9).fill().map(() => Array(numSteps).fill(false));
    const grid = document.getElementById(`grid-${currentGrid}`);
    const cells = grid.querySelectorAll('.sequence-cell');
    cells.forEach((cell) => {
        const row = parseInt(cell.dataset.row);
        const step = parseInt(cell.dataset.step);
        updateCellDisplay(cell, currentGrid, row, step);
    });
}


// Function to set up event listeners
function setupEventListeners() {
    document.getElementById('play-button').addEventListener('click', startSequence);
    document.getElementById('stop-button').addEventListener('click', stopSequence);

    document.querySelectorAll('.grid-selector').forEach(button => {
        button.addEventListener('click', (e) => {
            const gridIndex = parseInt(e.target.dataset.grid);
            switchGrid(gridIndex);
        });
    });

    document.querySelectorAll('.grid-toggle').forEach(checkbox => {
        checkbox.addEventListener('change', (e) => toggleGridActive(parseInt(e.target.dataset.grid)));
    });

    // Add event listener for the change sounds button
    document.getElementById('change-sounds-btn').addEventListener('click', toggleChangeSoundsMode);

    const clearGridBtn = document.getElementById('clear-grid-btn');
    clearGridBtn.addEventListener('click', clearCurrentGrid);

       const tempoSlider = document.getElementById('tempo-slider');
    tempoSlider.addEventListener('input', (e) => {
        updateTempo(parseInt(e.target.value));
    });
}


// SETUP VOLUME KNOBS

// function easeInOutQuad(t) {
//     return t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
// }

// let knobAnimationFrame = null;

// function updateKnobRotation(knob, value) {
//     const targetRotation = (value / 100) * 270 - 135;
//     const indicator = knob.nextElementSibling;
    
//     let currentRotation = parseFloat(indicator.dataset.currentRotation || "0");
    
//     function animateRotation() {
//         if (Math.abs(targetRotation - currentRotation) < 0.1) {
//             currentRotation = targetRotation;
//             indicator.style.transform = `rotate(${currentRotation}deg)`;
//             indicator.dataset.currentRotation = currentRotation;
//             knobAnimationFrame = null;
//             return;
//         }
        
//         currentRotation += (targetRotation - currentRotation) * 0.1;
//         const easedRotation = easeInOutQuad(currentRotation / 270) * 270;
        
//         indicator.style.transform = `rotate(${easedRotation}deg)`;
//         indicator.dataset.currentRotation = currentRotation;
        
//         knobAnimationFrame = requestAnimationFrame(animateRotation);
//     }
    
//     if (knobAnimationFrame) {
//         cancelAnimationFrame(knobAnimationFrame);
//     }
//     knobAnimationFrame = requestAnimationFrame(animateRotation);
// }



function setupVolumeKnobs() {
    const volumeKnobs = document.querySelectorAll('.volume-knob');
    volumeKnobs.forEach(knob => {
        const padId = knob.id.replace('volume-', '');
        padVolumes[padId] = 1; // Default volume
        setupKnobBehavior(knob, updateVolume);
    });
}

function setupPitchKnobs() {
    const pitchKnobs = document.querySelectorAll('.pitch-knob');
    pitchKnobs.forEach(knob => {
        const padId = knob.id.replace('pitch-', '');
        padPitches[padId] = 1; // Default pitch (no change)
        knob.value = 50; // Set to middle position
        setupPitchPanKnobBehavior(knob, updatePitch);
    });
}

function setupPanKnobs() {
    const panKnobs = document.querySelectorAll('.pan-knob');
    panKnobs.forEach(knob => {
        const padId = knob.id.replace('pan-', '');
        padPans[padId] = 0; // Default pan (center)
        knob.value = 50; // Set to middle position
        setupPitchPanKnobBehavior(knob, updatePan);
    });
}

function setupPitchPanKnobBehavior(knob, updateFunction) {
    const indicator = knob.nextElementSibling;
    let isDragging = false;
    let hasDragged = false;
    let startY, startValue, currentValue;

    function setKnobValue(newValue) {
        newValue = Math.min(100, Math.max(0, newValue));
        knob.value = newValue;
        currentValue = newValue;
        updateFunction(knob);
        
        const rotation = (newValue - 50) * 2.7 + 45; // -135 to 135 degrees
        indicator.style.transform = `rotate(${rotation}deg)`;
        
        console.log(`Setting knob value: ${newValue}`);
    }

    function handleDragStart(e) {
        isDragging = true;
        hasDragged = false;
        startY = e.clientY;
        startValue = parseFloat(knob.value);
        currentValue = startValue;
        
        console.log(`Drag start - startY: ${startY}, startValue: ${startValue}, knob.value: ${knob.value}`);
        
        document.addEventListener('mousemove', handleDrag);
        document.addEventListener('mouseup', handleDragEnd);
    }

    function handleDrag(e) {
        if (!isDragging) return;
        hasDragged = true;
        const currentY = e.clientY;
        const deltaY = startY - currentY;
        const sensitivity = 2;
        
        const newValue = startValue + (deltaY * sensitivity);
        currentValue = Math.min(100, Math.max(0, newValue));
        
        console.log(`Drag - deltaY: ${deltaY}, newValue: ${currentValue}, startValue: ${startValue}`);
        
        setKnobValue(currentValue);
    }

    function handleDragEnd() {
        isDragging = false;
        document.removeEventListener('mousemove', handleDrag);
        document.removeEventListener('mouseup', handleDragEnd);
        
        // Ensure we're using the last known good value
        setKnobValue(currentValue);
        
        console.log(`Drag end - final value: ${currentValue}, knob.value: ${knob.value}`);
    }

    function handleClick(e) {
        if (!hasDragged) {
            setKnobValue(50);
        }
        hasDragged = false;
    }

    knob.addEventListener('mousedown', handleDragStart);
    knob.addEventListener('click', handleClick);

    // Initialize knob position
    setKnobValue(parseFloat(knob.value) || 50);
    console.log(`Knob initialized with value: ${knob.value}`);
}


function setupKnobBehavior(knob, updateFunction) {
    const indicator = knob.nextElementSibling;
    let isDragging = false;
    let startY, startValue;

    function setKnobValue(newValue) {
        newValue = Math.min(100, Math.max(0, newValue));
        knob.value = newValue;
        updateFunction(knob);
        
        const rotation = (newValue / 100) * 270 - 135;
        indicator.style.transform = `rotate(${rotation}deg)`;
    }

    function handleClick(e) {
        const knobRect = knob.getBoundingClientRect();
        const knobCenter = {
            x: knobRect.left + knobRect.width / 2,
            y: knobRect.top + knobRect.height / 2
        };
        const clickPos = {
            x: e.clientX,
            y: e.clientY
        };
        
        let angle = Math.atan2(clickPos.y - knobCenter.y, clickPos.x - knobCenter.x);
        angle = (angle + Math.PI * 6/4) % (Math.PI * 2);
        
        let newValue = (angle / (Math.PI * 3/2)) * 100;
        setKnobValue(newValue);
    }

    function handleDragStart(e) {
        isDragging = true;
        startY = e.clientY;
        startValue = parseFloat(knob.value);
        document.addEventListener('mousemove', handleDrag);
        document.addEventListener('mouseup', handleDragEnd);
    }

    function handleDrag(e) {
        if (!isDragging) return;
        hasDragged = true;
        const currentY = e.clientY;
        const deltaY = startY - currentY;
        const sensitivity = 2;
        
        const newValue = startValue + (deltaY * sensitivity);
        currentValue = Math.min(100, Math.max(0, newValue));
        
        console.log(`Drag - deltaY: ${deltaY}, newValue: ${currentValue}, startValue: ${startValue}`);
        
        setKnobValue(currentValue);
    }

    function handleDragEnd() {
        isDragging = false;
        document.removeEventListener('mousemove', handleDrag);
        document.removeEventListener('mouseup', handleDragEnd);
    }

    knob.addEventListener('mousedown', (e) => {
        handleClick(e);
        handleDragStart(e);
    });

    // Initialize knob position
    setKnobValue(parseFloat(knob.value) || 50);
}

function updateVolume(knob) {
    const padId = knob.id.replace('volume-', '');
    const volume = Math.max(0.0001, knob.value / 100);
    padVolumes[padId] = volume;
}

function updatePitch(knob) {
    const padId = knob.id.replace('pitch-', '');
    const pitchValue = (knob.value - 50) / 50; // -1 to 1 range
    padPitches[padId] = Math.pow(2, pitchValue); // Convert to pitch multiplier
}

function updatePan(knob) {
    const padId = knob.id.replace('pan-', '');
    const panValue = (knob.value - 50) / 50; // -1 to 1 range
    padPans[padId] = panValue;
}


async function setupDrumMachine() {
    await loadSamples();
    await loadPadSoundLists();
    await setInitialPadSounds(); // New function to set and preload initial sounds
    createRowLabels();
    createSequenceGrids();
    setupEventListeners();

    // Initialize padVolumes
    const pads = document.getElementsByClassName('pad');
    for (let i = 0; i < pads.length; i++) {
        padVolumes[pads[i].id] = 1; // Set initial volume to maximum
    }

    setupVolumeKnobs();
    setupPitchKnobs();
    setupPanKnobs();

    // Add event listeners to drum pads
    for (let i = 0; i < pads.length; i++) {
        pads[i].addEventListener('click', playSound);
    }

    // Set the first grid as active by default
    switchGrid(0);
}

async function setInitialPadSounds() {
    const pads = document.getElementsByClassName('pad');
    const preloadPromises = [];

    for (let i = 0; i < pads.length; i++) {
        const pad = pads[i];
        const soundList = padSoundLists[pad.id];
        if (!soundList) {
            console.error(`No sound list found for ${pad.id}`);
            continue;
        }

        const category = Object.keys(soundList)[0];
        const samples = soundList[category];
        let initialSample, fullPath;

        if (Array.isArray(samples)) {
            initialSample = samples[0];
            fullPath = `./samples/${category}/${initialSample}`;
        } else {
            const subCategory = Object.keys(samples)[0];
            initialSample = samples[subCategory][0];
            fullPath = `./samples/${category}/${subCategory}/${initialSample}`;
        }

        pad.setAttribute('data-sound', fullPath);
        pad.textContent = initialSample.replace('.wav', '');

        // Preload the initial sound
        preloadPromises.push(preloadAudio(fullPath));
    }

    await Promise.all(preloadPromises);
    console.log('All initial pad sounds preloaded');
}

document.addEventListener('DOMContentLoaded', async () => {
    console.log('DOM content loaded, initializing drum machine...');
    await loadPadSoundLists();
    console.log('Pad sound lists loaded');
    // Any other initialization code...
});

function setInitialPadSound(pad) {
    const soundList = padSoundLists[pad.id];
    if (!soundList) {
        console.error(`No sound list found for ${pad.id}`);
        return;
    }

    const category = Object.keys(soundList)[0];
    if (!category) {
        console.error(`No category found in sound list for ${pad.id}`);
        return;
    }

    const samples = soundList[category];
    let initialSample;
    let fullPath;

    if (Array.isArray(samples) && samples.length > 0) {
        initialSample = samples[0];
        fullPath = `./samples/${category}/${initialSample}`;
    } else if (typeof samples === 'object') {
        const subCategory = Object.keys(samples)[0];
        if (subCategory && Array.isArray(samples[subCategory]) && samples[subCategory].length > 0) {
            initialSample = samples[subCategory][0];
            fullPath = `./samples/${category}/${subCategory}/${initialSample}`;
        } else {
            console.error(`Invalid sample structure for ${pad.id}`);
            return;
        }
    } else {
        console.error(`Invalid sample structure for ${pad.id}`);
        return;
    }

    pad.setAttribute('data-sound', fullPath);
    pad.textContent = initialSample.replace('.wav', '');
    console.log(`Set initial sound for ${pad.id}:`, fullPath);
}

window.addEventListener('load', setupDrumMachine);
