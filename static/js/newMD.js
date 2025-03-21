import * as THREE from 'https://unpkg.com/three@latest/build/three.module.js';
import { OrbitControls } from 'https://unpkg.com/three@0.127.0/examples/jsm/controls/OrbitControls.js';

// Global simulation settings:
const dt = 0.005;
const radius = 0.3;
const maxVelocity = 10.0;
const maxForce = 40.0;
const boxSize = 5;

const defaultMass = 1.0;
const defaultCharge = 0.0;
const defaultColor = 0xffffff;

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

    const geom = new THREE.SphereGeometry(radius, 16, 16);
    const mat = new THREE.MeshBasicMaterial({ color });
    this.mesh = new THREE.Mesh(geom, mat);

    this.mesh.position.set(x, y, z);
    scene.add(this.mesh);
  }

  syncMeshPosition() {
    this.mesh.position.set(this.position.x, this.position.y, this.position.z);
  }
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
    particleInfo.textContent = `Particle ${particle.id}: Mass = ${particle.mass}, Charge = ${particle.charge}, Color = ${particle.mesh.material.color.getHexString()}`;

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

    // Color input
    const colorInput = document.createElement("input");
    colorInput.type = "color";
    colorInput.value = `#${particle.mesh.material.color.getHexString()}`;
    colorInput.addEventListener("change", (e) => {
      particle.mesh.material.color.set(e.target.value);
      updateParticleList();
    });

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
    particleDiv.appendChild(colorInput);
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
  for (const p of particles) {
    // Update velocity based on force and mass (F = ma => a = F/m)
    p.vx += (p.fx / p.mass) * dt;
    p.vy += (p.fy / p.mass) * dt;
    p.vz += (p.fz / p.mass) * dt;

    // Clamp velocity to prevent unrealistic speeds
    const speed = Math.sqrt(p.vx * p.vx + p.vy * p.vy + p.vz * p.vz);
    if (speed > maxVelocity) {
      const scale = maxVelocity / speed;
      p.vx *= scale;
      p.vy *= scale;
      p.vz *= scale;
    }

    // Update position based on velocity
    p.position.x += p.vx * dt;
    p.position.y += p.vy * dt;
    p.position.z += p.vz * dt;

    // Boundary collision (reflect particles off the walls)
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

    // Sync particle mesh position
    p.syncMeshPosition();
  }
}

function LJ_and_Coulomb_forces() {
  // Constants for Lennard-Jones and Coulomb interactions
  const k = 8.99 * 10 ** 9; // Coulomb constant

  // Reset forces
  for (const p of particles) {
    p.fx = 0;
    p.fy = 0;
    p.fz = 0;
  }

  for (let i = 0; i < particles.length; i++) {
    for (let j = i + 1; j < particles.length; j++) {
      const pi = particles[i];
      const pj = particles[j];

      // Vector from j to i => r_ij = r_i - r_j
      const dx = pi.position.x - pj.position.x;
      const dy = pi.position.y - pj.position.y;
      const dz = pi.position.z - pj.position.z;

      const r2 = dx * dx + dy * dy + dz * dz;
      if (r2 < 1e-6) continue; // Avoid division by zero

      const r = Math.sqrt(r2);

      // Lennard-Jones force calculation
      const sigma6 = Math.pow(sig, 6);
      const sigma12 = Math.pow(sig, 12);
      const r6 = Math.pow(r, 6);
      const r12 = r6 * r6;

      // LJ magnitude (derivative)
      const ljForceMag = 24 * eps * ((2 * sigma12 / (r12 * r)) - (sigma6 / (r6 * r)));

      // Coulomb force calculation
      const coulombForceMag = (k * pi.charge * pj.charge) / r2;

      // Combine forces
      let combined = ljForceMag + coulombForceMag;

      // Clamp the magnitude to prevent unrealistic forces
      if (combined > maxForce) combined = maxForce;
      if (combined < -maxForce) combined = -maxForce;

      // Force components
      const fx = combined * (dx / r);
      const fy = combined * (dy / r);
      const fz = combined * (dz / r);

      // Apply forces to particles (Newton's 3rd law)
      pi.fx += fx;
      pi.fy += fy;
      pi.fz += fz;

      pj.fx -= fx;
      pj.fy -= fy;
      pj.fz -= fz;
    }
  }
}

function calculateTotalEnergy() {
  let kineticEnergy = 0;
  for (const p of particles) {
    kineticEnergy += 0.5 * p.mass * (p.vx ** 2 + p.vy ** 2 + p.vz ** 2);
  }
  document.getElementById("energy-display").textContent = `Energy: ${kineticEnergy.toFixed(2)}`;
}

function applyThermostat(targetTemperature) {
  let kineticEnergy = 0;
  for (const p of particles) {
    kineticEnergy += 0.5 * p.mass * (p.vx ** 2 + p.vy ** 2 + p.vz ** 2);
  }

  const currentTemperature = (2 * kineticEnergy) / (3 * particles.length);
  const scaleFactor = Math.sqrt(targetTemperature / currentTemperature);

  for (const p of particles) {
    p.vx *= scaleFactor;
    p.vy *= scaleFactor;
    p.vz *= scaleFactor;
  }
}

document.getElementById("temperature-slider").addEventListener("input", (e) => {
  applyThermostat(parseFloat(e.target.value));
});

// Add epsilon and sigma controls
const epsilonInput = document.createElement("input");
epsilonInput.type = "number";
epsilonInput.value = eps; // Default value is 0.5
epsilonInput.step = "0.1";
epsilonInput.addEventListener("input", (e) => {
  const value = parseFloat(e.target.value);
  if (e.target.value === "") {
    // Allow the field to be empty while typing
    eps = 0.5; // Temporarily set to default (this won't break the simulation)
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
    sig = 0.5; // Temporarily set to default (this won't break the simulation)
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
  moveParticles();
  LJ_and_Coulomb_forces();
  calculateTotalEnergy();
  controls.update();
  renderer.render(scene, camera);
}

animate();

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
  event.preventDefault(); // Prevent the form from submitting

  // Get the title and description
  const title = document.getElementById("post-title").value;
  const description = document.getElementById("post-description").value;

  // Get the particle list data
  const particleData = particles.map(particle => ({
    id: particle.id,
    mass: particle.mass,
    charge: particle.charge,
    color: `#${particle.mesh.material.color.getHexString()}`,
    position: {
      x: particle.position.x,
      y: particle.position.y,
      z: particle.position.z
    }
  }));

    // Send the data to the backend
    try {
      const response = await fetch('/save_post', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          title,
          description,
          particle_data: JSON.stringify(particleData) // Convert to JSON string
        }),
      });
  
      const responseData = await response.json(); // Parse the JSON response
  
      console.log('Response:', response); // Debugging: Log the full response
      console.log('Response Data:', responseData); // Debugging: Log the response data
  
      if (response.ok) {
        // Success: Post saved successfully
        alert('Post saved successfully!');
        postForm.reset(); // Clear the form
        postModal.style.display = "none"; // Hide the modal
      } else if (response.status === 401) {
        // Unauthorized: User is not logged in
        alert(responseData.error); // Show error message
        window.location.href = '/login'; // Redirect to login page
      } else {
        // Other errors (e.g., missing data, server error)
        alert(`Error: ${responseData.error}`);
      }
    } catch (error) {
      console.error('Error:', error);
      alert('An error occurred while saving the post.');
    }
  });

