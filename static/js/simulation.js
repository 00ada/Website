import * as THREE from 'https://unpkg.com/three@latest/build/three.module.js';
import { OrbitControls } from 'https://unpkg.com/three@0.127.0/examples/jsm/controls/OrbitControls.js';
import { LineBasicMaterial, BufferGeometry, Line } from 'https://unpkg.com/three@latest/build/three.module.js';

// Global simulation settings:
const dt = 0.005;
const radius = 0.3;
const maxVelocity = 10.0;
const maxForce = 40.0;
const boxSize = 5;

const defaultMass = 1.0;
const defaultCharge = 0.0;
const defaultColor = 0xffffff;

let selectedParticles = [];
let bonds = [];



// Lennard-Jones parameters (globally adjustable)
let eps = 0.5; // Depth of the potential well
let sig = 0.5; // Finite distance at which inter-particle potential is zero

// THREE.JS Render setup
const container = document.getElementById('simulation-container');
const width = container.clientWidth;
const height = container.clientHeight;
const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
renderer.setSize(width, height);
renderer.setClearColor(0x2b2b2b);
container.appendChild(renderer.domElement);

const scene = new THREE.Scene();

const camera = new THREE.PerspectiveCamera(
  75,
  width / height,
  0.1,
  1000
);
camera.position.set(0, 5, 15);
camera.lookAt(0, 0, 0);

const controls = new OrbitControls(camera, renderer.domElement);
controls.target.set(0, 0, 0);
controls.enableDamping = true;
controls.dampingFactor = 0.1;

const axesHelper = new THREE.AxesHelper(5);
scene.add(axesHelper);

const boxGeometry = new THREE.BoxGeometry(boxSize, boxSize, boxSize);
const boxMaterial = new THREE.MeshBasicMaterial({
  color: 0xffffff,
  wireframe: true,
  transparent: true,
  opacity: 0.5,
});
const box = new THREE.Mesh(boxGeometry, boxMaterial);
scene.add(box);

// Particle class
class Particle {
  static lastID = 0;
  constructor({
    id,
    x = 0,
    y = 0,
    z = 0,
    vx = 0,
    vy = 0,
    vz = 0,
    
    mass = defaultMass,
    charge = defaultCharge,
    radius = 0.3,
    color = defaultColor,
  }) {
    this.id = id || ++Particle.lastID;

    this.mass = mass;
    this.charge = charge;
    this.radius = radius;

    this.position = new THREE.Vector3(x, y, z);

    this.vx = vx;
    this.vy = vy;
    this.vz = vz;

    this.fx = 0;
    this.fy = 0;
    this.fz = 0;

    this.ax = 0;
    this.ay = 0;
    this.az = 0;

    const geom = new THREE.SphereGeometry(radius, 16, 16);
    const mat = new THREE.MeshBasicMaterial({ color });
    this.mesh = new THREE.Mesh(geom, mat);

    this.mesh.position.set(x, y, z);
    scene.add(this.mesh);
  }

  syncMeshPosition() {
    this.mesh.position.set(this.position.x, this.position.y, this.position.z);
  }

  updateRadius(newRadius) {
    this.radius = newRadius;
    // Create a new geometry with the updated radius
    const newGeometry = new THREE.SphereGeometry(newRadius, 16, 16);
    this.mesh.geometry.dispose(); // Clean up the old geometry
    this.mesh.geometry = newGeometry;
  }
}

// Grid Based Spartial Partitioning Class
class SpatialGrid {
  constructor(boxSize, cellSize) {
    this.boxSize = boxSize;
    this.cellSize = cellSize;
    this.grid = new Map();
  }

  getCellKey(x, y, z) {
    const i = Math.floor((x + this.boxSize / 2) / this.cellSize);
    const j = Math.floor((y + this.boxSize / 2) / this.cellSize);
    const k = Math.floor((z + this.boxSize / 2) / this.cellSize);
    return `${i},${j},${k}`;
  }

  addParticle(particle) {
    const key = this.getCellKey(particle.position.x, particle.position.y, particle.position.z);
    if (!this.grid.has(key)) this.grid.set(key, []);
    this.grid.get(key).push(particle);
  }

  clear() {
    this.grid.clear();
  }

  getNeighbors(particle) {
    const key = this.getCellKey(particle.position.x, particle.position.y, particle.position.z);
    const [i, j, k] = key.split(',').map(Number);
    const neighbors = [];
  
    for (let di = -1; di <= 1; di++) {
      for (let dj = -1; dj <= 1; dj++) {
        for (let dk = -1; dk <= 1; dk++) {
          const neighborKey = `${i + di},${j + dj},${k + dk}`;  // Fixed typo (removed '2')
          if (this.grid.has(neighborKey)) {
            neighbors.push(...this.grid.get(neighborKey));
          }
        }
      }
    }
    return neighbors.filter(p => p.id !== particle.id);  // Exclude self
  }
}

// Initialize grid
const cellSize = 2 * radius;
const spatialGrid = new SpatialGrid(boxSize, cellSize);

function updateGrid() {
  spatialGrid.clear();
  particles.forEach(p => spatialGrid.addParticle(p));
}

// Spring Bond class
class SpringBond {
  constructor(particle1, particle2) {
    if (!particle1 || !particle2) {
      console.error("Invalid particles for bond creation");
      return;
    }

    this.particle1 = particle1;
    this.particle2 = particle2;
    this.springConstant = 10000; 
    this.restLength = (particle1.radius + particle2.radius) * 0.95; // Make them touch (95% of sum of radii)

    // Safer line initialization
    this.lineMaterial = new LineBasicMaterial({ color: 0x00ff00 });
    this.lineGeometry = new BufferGeometry();
    this.line = new Line(this.lineGeometry, this.lineMaterial);
    this.updateVisual();
    scene.add(this.line);
    
    // Immediately adjust positions to be at rest length
    this.adjustPositionsToBondLength();
  }

  adjustPositionsToBondLength() {
    const currentVec = new THREE.Vector3().subVectors(
      this.particle2.position, 
      this.particle1.position
    );
    const currentLength = currentVec.length();
    
    if (currentLength === 0) return; // Avoid division by zero
    
    const adjustmentFactor = (currentLength - this.restLength) / 2;
    const direction = currentVec.normalize();
    
    // Move particles towards each other to achieve rest length
    this.particle1.position.addScaledVector(direction, adjustmentFactor);
    this.particle2.position.addScaledVector(direction, -adjustmentFactor);
    
    // Update velocities to maintain momentum
    const totalMass = this.particle1.mass + this.particle2.mass;
    const massRatio1 = this.particle2.mass / totalMass;
    const massRatio2 = this.particle1.mass / totalMass;
    
    const relativeVelocity = new THREE.Vector3(
      this.particle2.vx - this.particle1.vx,
      this.particle2.vy - this.particle1.vy,
      this.particle2.vz - this.particle1.vz
    );
    
    const velocityAlongBond = relativeVelocity.dot(direction);
    const impulse = 2 * velocityAlongBond / totalMass;
    
    this.particle1.vx += direction.x * impulse * massRatio1;
    this.particle1.vy += direction.y * impulse * massRatio1;
    this.particle1.vz += direction.z * impulse * massRatio1;
    
    this.particle2.vx -= direction.x * impulse * massRatio2;
    this.particle2.vy -= direction.y * impulse * massRatio2;
    this.particle2.vz -= direction.z * impulse * massRatio2;
    
    // Update mesh positions
    this.particle1.syncMeshPosition();
    this.particle2.syncMeshPosition();
  }

  applyForce() {
    try {
      const dx = this.particle2.position.x - this.particle1.position.x;
      const dy = this.particle2.position.y - this.particle1.position.y;
      const dz = this.particle2.position.z - this.particle1.position.z;
      
      const distance = Math.sqrt(dx*dx + dy*dy + dz*dz);
      if (distance === 0) return;

      // Very strong spring force to keep them at rest length
      const displacement = distance - this.restLength;
      const forceMagnitude = this.springConstant * displacement;

      const fx = (dx / distance) * forceMagnitude;
      const fy = (dy / distance) * forceMagnitude;
      const fz = (dz / distance) * forceMagnitude;

      this.particle1.fx += fx;
      this.particle1.fy += fy;
      this.particle1.fz += fz;

      this.particle2.fx -= fx;
      this.particle2.fy -= fy;
      this.particle2.fz -= fz;
      
      // Additional position correction to ensure they stay exactly at rest length
      if (Math.abs(displacement) > 0.01) {
        this.adjustPositionsToBondLength();
      }
    } catch (error) {
      console.error("Error applying bond force:", error);
    }
  }


  updateVisual() {
    try {
      const positions = new Float32Array([
        this.particle1.position.x, this.particle1.position.y, this.particle1.position.z,
        this.particle2.position.x, this.particle2.position.y, this.particle2.position.z
      ]);
      this.lineGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
      this.lineGeometry.attributes.position.needsUpdate = true;
    } catch (error) {
      console.error("Error updating bond visual:", error);
    }
  }

  remove() {
    try {
      scene.remove(this.line);
      this.lineGeometry.dispose();
      this.lineMaterial.dispose();
    } catch (error) {
      console.error("Error removing bond:", error);
    }
  }
}


async function saveSimulation(title, description) {
  try {
    const simulationData = {
      title: title,
      description: description,
      particles: particles.map(p => ({
        id: p.id,
        position: { x: p.position.x, y: p.position.y, z: p.position.z },
        velocity: { x: p.vx, y: p.vy, z: p.vz },
        mass: p.mass,
        charge: p.charge,
        radius: p.radius,
        color: p.mesh.material.color.getHex()
      })),
      bonds: bonds.map(b => ({
        particle1Id: b.particle1.id,
        particle2Id: b.particle2.id,
        springConstant: b.springConstant,
        restLength: b.restLength
      })),
      settings: {  // Properly structured settings
        boxSize: boxSize,
        dt: dt,
        maxVelocity: maxVelocity,
        maxForce: maxForce,
        eps: eps,
        sig: sig,
        temperature: parseFloat(temperatureSlider.value)
      }
    };

    console.log("Saving simulation data:", simulationData);

    const response = await fetch('/save_post', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(simulationData)
    });

    const result = await response.json();
    
    if (!response.ok) {
      throw new Error(result.error || 'Failed to save simulation');
    }

    return result;
  } catch (error) {
    console.error("Save error:", error);
    throw error;
  }
}

function gaussianRandom(mean = 0, stdev = 1) {
  const u = 1 - Math.random();
  const v = Math.random();
  const z = Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
  return z * stdev + mean;
}

// Selection Management
function toggleSelection(particle) {
  const index = selectedParticles.indexOf(particle);
  if(index === -1) {
    if(selectedParticles.length < 2) {
      selectedParticles.push(particle);
      particle.mesh.material.color.set(0xff0000); // Red for selected
    }
  } else {
    selectedParticles.splice(index, 1);
    particle.mesh.material.color.set(defaultColor);
  }
  
  if(selectedParticles.length === 2) {
    const bond = new SpringBond(selectedParticles[0], selectedParticles[1]);
    bonds.push(bond);
    
    // Reset selection
    selectedParticles.forEach(p => p.mesh.material.color.set(defaultColor));
    selectedParticles = [];
  }
  updateParticleList();
}

const particles = [];


// Add Particle function: Responsible for adding and assigning each particle with random
// position and velocity, and setting a default mass, charge and colour
function addParticle({ x, y, z, vx, vy, vz, mass = defaultMass, charge = defaultCharge, radius = 0.3, color = defaultColor }) {
  const newParticle = new Particle({
    x, y, z,
    vx, vy, vz,
    mass,
    charge,
    radius,
    color,
  });

  particles.push(newParticle);
  updateParticleList();
}

function updateParticleList() {
  const particleGrid = document.getElementById("particle-grid");
  particleGrid.innerHTML = ""; // Clear existing content

  particles.forEach((particle) => {
    const particleDiv = document.createElement("div");
    particleDiv.className = "particle-item";

    const particleInfo = document.createElement("p");
    particleInfo.textContent = `Particle ${particle.id}: Mass = ${particle.mass}, Charge = ${particle.charge}, Radius = ${particle.radius}, Color = ${particle.mesh.material.color.getHexString()}`;

    // Mass input
    const massInput = document.createElement("input");
    massInput.type = "number";
    massInput.value = particle.mass;
    massInput.placeholder = "Mass";
    massInput.addEventListener("change", (e) => {
      const newMass = parseFloat(e.target.value);
      if (isNaN(newMass)) {
        particle.mass = defaultMass;
        massInput.value = defaultMass;
      } else if (newMass <= 0) {
        particle.mass = 0.1;
        massInput.value = 0.1;
      } else {
        particle.mass = newMass;
      }
      updateParticleList();
    });

    // Charge input
    const chargeInput = document.createElement("input");
    chargeInput.type = "number";
    chargeInput.value = particle.charge;
    chargeInput.placeholder = "Charge";
    chargeInput.addEventListener("change", (e) => {
      const newCharge = parseFloat(e.target.value);
      if (isNaN(newCharge)) {
        particle.charge = defaultCharge;
        chargeInput.value = defaultCharge;
      } else {
        particle.charge = newCharge;
      }
      updateParticleList();
    });

    // Radius input
    const radiusInput = document.createElement("input");
    radiusInput.type = "number";
    radiusInput.step = "0.1";
    radiusInput.min = "0.1";
    radiusInput.value = particle.radius;
    radiusInput.placeholder = "Radius";
    radiusInput.addEventListener("change", (e) => {
      const newRadius = parseFloat(e.target.value);
      if (isNaN(newRadius)) {
        particle.updateRadius(0.3);
        radiusInput.value = 0.3;
      } else if (newRadius <= 0) {
        particle.updateRadius(0.1);
        radiusInput.value = 0.1;
      } else {
        particle.updateRadius(newRadius);
      }
      // Update bonds if this particle has any
      updateBondsForParticle(particle);
      updateParticleList();
    });

    // Colour input
    const colorInput = document.createElement("input");
    colorInput.type = "color";
    colorInput.value = `#${particle.mesh.material.color.getHexString()}`;
    colorInput.addEventListener("change", (e) => {
      particle.mesh.material.color.set(e.target.value);
      updateParticleList();
    });

    // Add this button creation code right after creating colorInput
    const selectButton = document.createElement("button");
    selectButton.textContent = "Select";
    selectButton.className = "select-button";
    selectButton.addEventListener("click", () => toggleSelection(particle));

    // Duplicate button
    const duplicateButton = document.createElement("button");
    duplicateButton.textContent = "Duplicate";
    duplicateButton.className = "duplicate-button";
    duplicateButton.addEventListener("click", () => {
      // Create a new particle with the same properties
      addParticle({
        x: particle.position.x + 0.5, // Slightly offset to avoid overlap
        y: particle.position.y + 0.5,
        z: particle.position.z + 0.5,
        vx: particle.vx,
        vy: particle.vy,
        vz: particle.vz,
        mass: particle.mass,
        charge: particle.charge,
        radius: particle.radius,
        color: particle.mesh.material.color.getHex(),
      });
    });

    // Delete button
    const deleteButton = document.createElement("button");
    deleteButton.textContent = "Delete";
    deleteButton.className = "delete-button";
    deleteButton.addEventListener("click", () => {
      // Remove the particle from the scene
      scene.remove(particle.mesh);

      const index = particles.indexOf(particle);
      if (index !== -1) {
        particles.splice(index, 1); // Remove the particle from the array
      }

      // Remove the corresponding HTML element from the particle list
      particleDiv.remove();

      // Update the particle list
      updateParticleList();
    });

    // Append elements to the particle item
    particleDiv.appendChild(particleInfo);
    particleDiv.appendChild(massInput);
    particleDiv.appendChild(chargeInput);
    particleDiv.appendChild(radiusInput);
    particleDiv.appendChild(colorInput);
    particleDiv.appendChild(selectButton);
    particleDiv.appendChild(duplicateButton);
    particleDiv.appendChild(deleteButton);
    particleGrid.appendChild(particleDiv);
    
  });
}

document.getElementById('add-particle-button').addEventListener('click', () => {
  const halfBoxSize = boxSize / 2;
  const x = (Math.random() - 0.5) * boxSize;
  const y = (Math.random() - 0.5) * boxSize;
  const z = (Math.random() - 0.5) * boxSize;

  const vx = (Math.random() - 0.5) * maxVelocity;
  const vy = (Math.random() - 0.5) * maxVelocity;
  const vz = (Math.random() - 0.5) * maxVelocity;

  addParticle({
    x, y, z,
    vx, vy, vz,
    mass: defaultMass,
    charge: defaultCharge,
    radius,
    color: defaultColor,
  });
});

// Move Particles
function moveParticles() {
  // First phase: update positions based on current velocity and acceleration
  for (const p of particles) {
    p.ax = p.fx / p.mass;
    p.ay = p.fy / p.mass;
    p.az = p.fz / p.mass;

    p.position.x += p.vx * dt + 0.5 * p.ax * dt * dt;
    p.position.y += p.vy * dt + 0.5 * p.ay * dt * dt;
    p.position.z += p.vz * dt + 0.5 * p.az * dt * dt;
  }

  // Recalculate forces after moving particles
  LJ_and_Coulomb_forces();
  bonds.forEach(bond => bond.applyForce());

  // Second phase: update velocities using new acceleration
  for (const p of particles) {
    const newAx = p.fx / p.mass;
    const newAy = p.fy / p.mass;
    const newAz = p.fz / p.mass;

    p.vx += 0.5 * (p.ax + newAx) * dt;
    p.vy += 0.5 * (p.ay + newAy) * dt;
    p.vz += 0.5 * (p.az + newAz) * dt;

    // Handle boundary collisions (same as before)
    if (p.position.x > boxSize / 2) {
      p.position.x = boxSize / 2;
      p.vx *= -1;
    } else if (p.position.x < -boxSize / 2) {
      p.position.x = -boxSize / 2;
      p.vx *= -1;
    }

    if (p.position.y > boxSize / 2) {
      p.position.y = boxSize / 2;
      p.vy *= -1;
    } else if (p.position.y < -boxSize / 2) {
      p.position.y = -boxSize / 2;
      p.vy *= -1;
    }

    if (p.position.z > boxSize / 2) {
      p.position.z = boxSize / 2;
      p.vz *= -1;
    } else if (p.position.z < -boxSize / 2) {
      p.position.z = -boxSize / 2;
      p.vz *= -1;
    }

    p.syncMeshPosition();
  }
}


function LJ_and_Coulomb_forces() {
  const k = 8.99 * 10 ** 9;

  // Reset forces
  particles.forEach(p => {
    p.fx = 0;
    p.fy = 0;
    p.fz = 0;
  });

  // Update grid
  updateGrid();

  // Calculate forces using grid
  particles.forEach(p => {
    const neighbors = spatialGrid.getNeighbors(p);
    neighbors.forEach(neighbor => {
      if (neighbor.id <= p.id) return;

      const dx = p.position.x - neighbor.position.x;
      const dy = p.position.y - neighbor.position.y;
      const dz = p.position.z - neighbor.position.z;

      const r2 = dx * dx + dy * dy + dz * dz;
      if (r2 < 1e-6) return;

      const r = Math.sqrt(r2);

      // Lennard-Jones
      const sigma6 = Math.pow(sig, 6);
      const sigma12 = Math.pow(sig, 12);
      const r6 = Math.pow(r, 6);
      const r12 = r6 * r6;
      const ljForceMag = 24 * eps * ((2 * sigma12 / (r12 * r)) - (sigma6 / (r6 * r)));

      // Coulomb
      const coulombForceMag = (k * p.charge * neighbor.charge) / r2;

      let combined = ljForceMag + coulombForceMag;
      if (combined > maxForce) combined = maxForce;
      if (combined < -maxForce) combined = -maxForce;

      const fx = combined * (dx / r);
      const fy = combined * (dy / r);
      const fz = combined * (dz / r);

      p.fx += fx;
      p.fy += fy;
      p.fz += fz;

      neighbor.fx -= fx;
      neighbor.fy -= fy;
      neighbor.fz -= fz;
    });
  });
}

function calculateTotalEnergy() {
  const energyDisplay = document.getElementById("energy-display");
  if (!energyDisplay) return;

  let kineticEnergy = 0;
  particles.forEach(p => {
    kineticEnergy += 0.5 * p.mass * (p.vx ** 2 + p.vy ** 2 + p.vz ** 2);
  }); 

  energyDisplay.textContent = `Energy: ${kineticEnergy.toFixed(2)} J`;
}


// Langevin Thermostat
const k_B = 1.0; // Boltzmann constant
function applyLangevinThermostat(targetTemperature) {
    const gamma = 0.5; // Damping coefficient
    
    if (targetTemperature <= 0) {
        particles.forEach(p => {
            p.vx = 0;
            p.vy = 0;
            p.vz = 0;
        });
        return;
    }

    const sigma = Math.sqrt((2 * gamma * k_B * targetTemperature) / dt);

    particles.forEach(p => {
        // Random force with proper scaling
        const randomForceX = sigma * gaussianRandom() * Math.sqrt(p.mass);
        const randomForceY = sigma * gaussianRandom() * Math.sqrt(p.mass);
        const randomForceZ = sigma * gaussianRandom() * Math.sqrt(p.mass);

        // Damping force (proportional to velocity)
        p.fx += (-gamma * p.vx * p.mass) + randomForceX;
        p.fy += (-gamma * p.vy * p.mass) + randomForceY;
        p.fz += (-gamma * p.vz * p.mass) + randomForceZ;
    });
}

// Update temperature slider value display
const temperatureSlider = document.getElementById("temperature-slider");
const temperatureValue = document.getElementById("temperature-value");

temperatureSlider.min = 0;
temperatureSlider.max = 100;
temperatureSlider.value = 25; // Default temperature
temperatureValue.textContent = temperatureSlider.value;

temperatureSlider.addEventListener("input", (e) => {
  const value = parseFloat(e.target.value);
  temperatureValue.textContent = value.toFixed(1);
  
  // Force reset velocities when increasing from 0
  if (value > 0 && particles.some(p => p.vx === 0 && p.vy === 0 && p.vz === 0)) {
    particles.forEach(p => {
      p.vx = (Math.random() - 0.5) * maxVelocity;
      p.vy = (Math.random() - 0.5) * maxVelocity;
      p.vz = (Math.random() - 0.5) * maxVelocity;
    });
  }
});

function calculateTemperature() {
let k_B = 1.0
  let totalKE = 0;
  const degreesOfFreedom = particles.length * 3 - 3;
  particles.forEach(p => {
    totalKE += 0.5 * p.mass * (p.vx**2 + p.vy**2 + p.vz**2);
  });
  return (2 * totalKE) / (degreesOfFreedom * k_B);
}

// Add epsilon and sigma controls
const epsilonInput = document.createElement("input");
epsilonInput.type = "number";
epsilonInput.value = eps; // Default value is 0.5
epsilonInput.step = "0.1";
epsilonInput.addEventListener("input", (e) => {
  const value = parseFloat(e.target.value);
  if (e.target.value === "") {
    // Allow the field to be empty while typing
    eps = 0.5; // Temporarily set to default 
  } else if (isNaN(value) || value <= 0) {
    // Reset to default if the input is invalid
    eps = 0.5;
    epsilonInput.value = eps;
  } else {
    // Update epsilon with the new valid value
    eps = value;
  }
});

const sigmaInput = document.createElement("input");
sigmaInput.type = "number";
sigmaInput.value = sig; // Default value is 0.5
sigmaInput.step = "0.1";
sigmaInput.addEventListener("input", (e) => {
  const value = parseFloat(e.target.value);
  if (e.target.value === "") {
    // Allow the field to be empty while typing
    sig = 0.5; // Temporarily set to default 
  } else if (isNaN(value) || value <= 0) {
    // Reset to default if the input is invalid
    sig = 0.5;
    sigmaInput.value = sig;
  } else {
    // Update sigma with the new valid value
    sig = value;
  }
});

const epsilonLabel = document.createElement("label");
epsilonLabel.textContent = "Epsilon (ε): ";
epsilonLabel.appendChild(epsilonInput);

const sigmaLabel = document.createElement("label");
sigmaLabel.textContent = "Sigma (σ): ";
sigmaLabel.appendChild(sigmaInput);

const controlsContainer = document.getElementById("controls-container");
controlsContainer.appendChild(epsilonLabel);
controlsContainer.appendChild(sigmaLabel);

// Animation loop
function animate() {
  requestAnimationFrame(animate);

  try {
    // Clear forces first
    particles.forEach(p => {
      p.fx = 0;
      p.fy = 0;
      p.fz = 0;
    });

    // Calculate inter-particle forces (LJ + Coulomb)
    LJ_and_Coulomb_forces();

    // Apply bond forces (if any bonds exist)
    bonds.forEach(bond => {
      if (bond.particle1 && bond.particle2) {
        bond.applyForce();
      }
    });

    // Apply thermostat (only if temperature > 0)
    const targetTemp = parseFloat(temperatureSlider.value);
    if (targetTemp > 0) {
      applyLangevinThermostat(targetTemp);
    }

    // Move particles
    moveParticles();

    // Update bond visuals
    bonds.forEach(bond => {
      if (bond.particle1 && bond.particle2) {
        bond.updateVisual();
      }
    });

    // Update controls
    controls.update();

    // Update energy display
    calculateTotalEnergy();

    // Update temperature display
    const tempDisplay = document.getElementById("actual-temp");
    if (tempDisplay && particles.length > 0) {
      const avgSpeed = particles.reduce((sum, p) =>
        sum + Math.sqrt(p.vx ** 2 + p.vy ** 2 + p.vz ** 2), 0) / particles.length;
      tempDisplay.textContent = `Temp: ${(avgSpeed * 100).toFixed(1)} K`;
    }

    // Render the scene
    renderer.render(scene, camera);

  } catch (error) {
    console.error("Animation error:", error);
  }
}

animate()


// Get references to the modal and button
const postButton = document.getElementById("post-button");
const postModal = document.getElementById("post-modal");
const closeModal = document.querySelector(".close");
const postForm = document.getElementById("post-form");

// Show the modal when the "Post" button is clicked
postButton.addEventListener("click", () => {
  postModal.style.display = "flex";
});

// Hide the modal when the close button is clicked
closeModal.addEventListener("click", () => {
  postModal.style.display = "none";
});

// Hide the modal when clicking outside the modal content
window.addEventListener("click", (event) => {
  if (event.target === postModal) {
    postModal.style.display = "none";
  }
});

// Handle form submission
postForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  
  const title = document.getElementById("post-title").value;
  const description = document.getElementById("post-description").value;
  
  try {
      const result = await saveSimulation(title, description);
      alert('Post saved successfully!');
      postModal.style.display = "none";
      postForm.reset();
      window.location.href = `/post/${result.post_id}`;
  } catch (error) {
      alert(`Failed to save: ${error.message}`);
  }
});