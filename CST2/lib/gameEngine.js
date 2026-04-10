const GRID_SIZE = 4;

const debrisTypes = [
  { type: "leaf", points: 10, emoji: "🍃" },
  { type: "branch", points: 20, emoji: "🌿" },
  { type: "bird", points: 25, emoji: "💩" },
  { type: "dust", points: 5, emoji: "☁️" }
];

function getRandomDebris() {
  return debrisTypes[Math.floor(Math.random() * debrisTypes.length)];
}

function generateGrid() {
  const grid = [];

  for (let i = 0; i < GRID_SIZE * GRID_SIZE; i++) {
    const hasDebris = Math.random() < 0.6;
    grid.push(hasDebris ? { ...getRandomDebris(), cleaned: false } : null);
  }

  return grid;
}

function cleanCell(grid, index) {
  const cell = grid[index];

  if (!cell || cell.cleaned) {
    return { grid, points: 0 };
  }

  const newGrid = [...grid];
  newGrid[index] = { ...cell, cleaned: true };

  return {
    grid: newGrid,
    points: cell.points
  };
}

function calculateCleanliness(grid) {
  const total = grid.filter(cell => cell !== null).length;
  const cleaned = grid.filter(cell => cell && cell.cleaned).length;

  if (total === 0) return 100;
  return Math.floor((cleaned / total) * 100);
}

function isAllClean(grid) {
  return grid.every(cell => cell === null || cell.cleaned);
}

export {
  GRID_SIZE,
  debrisTypes,
  generateGrid,
  cleanCell,
  calculateCleanliness,
  isAllClean
};