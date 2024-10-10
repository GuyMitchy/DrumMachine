const numSteps = 8;  // Number of steps in our sequence
const numGrids = 4;
let sequences = Array(numGrids).fill().map(() => Array(9).fill().map(() => Array(numSteps).fill(false)));
let activeGrids = [true, false, false, false];
let currentGrid = 0;
let isPlaying = false;
let currentStep = 0;
let intervalId = null;
let activeGridIndex = 0;

// Function to play sound when a drum pad is clicked
function playSound(event) {
    const button = event.target;
    const soundPath = button.getAttribute('data-sound');
    const sound = new Audio(soundPath);
    sound.play();
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
        while (!activeGrids[activeGridIndex]) {
            activeGridIndex = (activeGridIndex + 1) % numGrids;
        }
        intervalId = setInterval(playStep, 250); // 250ms = 1/4 second
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
}

// Function to set up drum machine
function setupDrumMachine() {
    createSequenceGrids();
    setupEventListeners();

    // Add event listeners to drum pads
    const pads = document.getElementsByClassName('pad');
    for (let i = 0; i < pads.length; i++) {
        pads[i].addEventListener('click', playSound);
    }
}

// Set up the drum machine when the page finishes loading
window.onload = setupDrumMachine;