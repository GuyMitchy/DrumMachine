const numSteps = 32;  // Number of steps in our sequence
const numGrids = 4;
let sequences = Array(numGrids).fill().map(() => Array(9).fill().map(() => Array(numSteps).fill(false)));
let activeGrids = [true, false, false, false];
let currentGrid = 0;
let isPlaying = false;
let currentStep = 0;
let intervalId = null;
let activeGridIndex = 0;

// Add these new variables
let isChangingSounds = false;
let samples = {};
let preloadedAudio = {};
const padSoundLists = {};

// Add this variable at the top of your script file
const padCurrentIndex = {}

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
                preloadPromises.push(new Promise((resolve) => {
                    const audio = new Audio(audioPath);
                    audio.addEventListener('canplaythrough', () => {
                        preloadedAudio[audioPath] = audio;
                        resolve();
                    }, { once: true });
                }));
            } else if (typeof value === 'object') {
                preloadCategory(value, `${path}${key}/`);
            }
        }
    }

    preloadCategory(sampleList);
    await Promise.all(preloadPromises);
    console.log('All samples preloaded');
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
function playSound(event) {
    const button = event.target;
    if (isChangingSounds) {
        changePadSound(button);
    } else {
        const soundPath = button.getAttribute('data-sound');
        console.log(`Attempting to play sound for ${button.id}:`, soundPath);
        if (!soundPath) {
            console.error(`No sound path found for ${button.id}`);
            return;
        }
        if (preloadedAudio[soundPath]) {
            preloadedAudio[soundPath].currentTime = 0;
            preloadedAudio[soundPath].play().catch(error => {
                console.error(`Error playing preloaded audio ${soundPath}:`, error);
            });
        } else {
            console.warn(`Audio not preloaded: ${soundPath}`);
            const sound = new Audio(soundPath);
            sound.play().catch(error => {
                console.error(`Error playing audio ${soundPath}:`, error);
            });
        }
    }
}

// Add this function to change pad sound
function changePadSound(pad) {
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
            padCurrentIndex[pad.id] = 0;
        }
        padCurrentIndex[pad.id] = (padCurrentIndex[pad.id] + 1) % samples.length;
        nextSample = samples[padCurrentIndex[pad.id]];
        fullPath = `./samples/${category}/${nextSample}`;
    } else {
        const subCategories = Object.keys(samples);
        if (!(pad.id in padCurrentIndex)) {
            padCurrentIndex[pad.id] = { subCategoryIndex: 0, sampleIndex: 0 };
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
}

// Add this function to toggle change sounds mode
function toggleChangeSoundsMode() {
    isChangingSounds = !isChangingSounds;
    const changeSoundsBtn = document.getElementById('change-sounds-btn');
    changeSoundsBtn.textContent = isChangingSounds ? 'Play Sounds' : 'Change Sounds';
}

// Function to create grid
function createSequenceGrids() {
    const grids = document.querySelectorAll('.sequence-grid');
    const pads = document.getElementsByClassName('pad');

    grids.forEach((grid, gridIndex) => {
        for (let i = 0; i < pads.length; i++) {
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
                if (step % 4 === 0) {  // Changed from step % 2 to step % 4
                    cell.classList.add('quarter-note');
                }
                cell.dataset.grid = gridIndex;
                cell.dataset.row = i;
                cell.dataset.step = step;
                cell.addEventListener('click', toggleStep);
                row.appendChild(cell);
            }
            grid.appendChild(row);
        }
    });

    // Show only the first grid initially
    switchGrid(0);
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
    const pads = document.getElementsByClassName('pad');
    if (sequences[grid][row][step]) {
        const padColor = pads[row].dataset.color;
        cell.style.backgroundColor = padColor;
        cell.classList.add('active');
    } else {
        cell.style.backgroundColor = '';
        cell.classList.remove('active');
    }
}

// Function to play a single step of the sequence
function playStep() {
    // Check if there are any active grids
    if (!activeGrids.some(grid => grid)) {
        stopSequence();
        return;
    }

    const pads = document.getElementsByClassName('pad');
    
    // Find the next active grid
    while (!activeGrids[activeGridIndex]) {
        activeGridIndex = (activeGridIndex + 1) % numGrids;
    }

    // Play sounds for the current step of the active grid
    for (let i = 0; i < pads.length; i++) {
        if (sequences[activeGridIndex][i][currentStep]) {
            const soundPath = pads[i].getAttribute('data-sound');
            const sound = new Audio(soundPath);
            sound.play();
        }
    }

    // Highlight current step in all grids
    document.querySelectorAll('.sequence-cell').forEach(cell => {
        if (parseInt(cell.dataset.step) === currentStep) {
            const row = parseInt(cell.dataset.row);
            const padColor = pads[row].dataset.color;
            cell.style.border = `1px solid ${padColor}`;
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
        while (!activeGrids[activeGridIndex]) {
            activeGridIndex = (activeGridIndex + 1) % numGrids;
        }
        intervalId = setInterval(playStep, 125); // Changed from 250ms to 125ms
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

// Function to set up event listeners
function setupEventListeners() {
    document.getElementById('play-button').addEventListener('click', startSequence);
    document.getElementById('stop-button').addEventListener('click', stopSequence);

    document.querySelectorAll('.grid-selector').forEach(button => {
        button.addEventListener('click', (e) => switchGrid(parseInt(e.target.dataset.grid)));
    });

    document.querySelectorAll('.grid-toggle').forEach(checkbox => {
        checkbox.addEventListener('change', (e) => toggleGridActive(parseInt(e.target.dataset.grid)));
    });

    // Add event listener for the change sounds button
    document.getElementById('change-sounds-btn').addEventListener('click', toggleChangeSoundsMode);
}

// Modify the setupDrumMachine function
async function setupDrumMachine() {
    await loadSamples();
    await loadPadSoundLists();
    createSequenceGrids();
    setupEventListeners();

    // Add event listeners to drum pads
    const pads = document.getElementsByClassName('pad');
    for (let i = 0; i < pads.length; i++) {
        pads[i].addEventListener('click', playSound);
    }
}

// Change this line at the end of the file
window.addEventListener('load', setupDrumMachine);

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