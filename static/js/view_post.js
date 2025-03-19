import * as THREE from 'https://unpkg.com/three@latest/build/three.module.js';
import { OrbitControls } from 'https://unpkg.com/three@0.127.0/examples/jsm/controls/OrbitControls.js';

console.log('Initializing Three.js...');

// -----------------------
// Global simulation config
// -----------------------
const dt = 0.005;
const maxVelocity = 10.0;
const maxForce = 40.0;
const boxSize = 5;

// Default particle properties
const defaultMass = 1.0;
const defaultCharge = 0.0;
const defaultColor = 0xffffff;
const defaultRadius = 0.3;

// Lennard-Jones parameters
let eps = 0.5; // Depth of potential well
let sig = 0.5; // Distance at which potential = 0

// ------------------------
// Three.js scene setup
// ------------------------
const container = document.getElementById('simulation-container');
if (!container) {
  console.error('Simulation container not found!');
}

const width = container.clientWidth;
const height = container.clientHeight;
console.log('Container dimensions:', width, height);

const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
renderer.setSize(width, height);
renderer.setClearColor(0x2b2b2b);
container.appendChild(renderer.domElement);

const scene = new THREE.Scene();
console.log('Scene created.');

const camera = new THREE.PerspectiveCamera(75, width / height, 0.1, 1000);
camera.position.set(0, 5, 15);
camera.lookAt(0, 0, 0);
console.log('Camera set up.');

const controls = new OrbitControls(camera, renderer.domElement);
controls.target.set(0, 0, 0);
controls.enableDamping = true;
controls.dampingFactor = 0.1;
console.log('OrbitControls initialized.');

// Helper visuals
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
console.log('Box added to the scene.');

// --------------
// Particle class
// --------------
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
    radius = defaultRadius,
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

    // Mesh
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

// Particle container
const particles = [];

// ---------------------
// Add particle function
// ---------------------
function addParticle({
  x,
  y,
  z,
  vx,
  vy,
  vz,
  mass = defaultMass,
  charge = defaultCharge,
  radius = defaultRadius,
  color = defaultColor,
}) {
  const newParticle = new Particle({
    x,
    y,
    z,
    vx,
    vy,
    vz,
    mass,
    charge,
    radius,
    color,
  });
  particles.push(newParticle);
}

// -----------------------------------
// Load particle data from the DOM
// -----------------------------------
let particleData;
try {
  const rawData = container.dataset.particleData;
  console.log('Raw particle data:', rawData);
  
  // Parse the JSON data
  particleData = JSON.parse(rawData);
  console.log('Parsed particle data:', particleData);

  particleData.forEach((p) => {
    try {
      // Handle missing properties with defaults
      addParticle({
        x: p.position?.x || 0,
        y: p.position?.y || 0,
        z: p.position?.z || 0,
        vx: 0,
        vy: 0,
        vz: 0,
        mass: typeof p.mass === 'number' ? p.mass : defaultMass,
        charge: typeof p.charge === 'number' ? p.charge : defaultCharge,
        color: p.color ? 
          parseInt(p.color.replace('#', '0x')) : 
          defaultColor,
      });
    } catch (particleError) {
      console.error('Error adding particle:', particleError);
    }
  });
} catch (parseError) {
  console.error('Data parsing error:', parseError);
  console.error('Problematic data:', container.dataset.particleData);
}

// ----------------------------------------
// Lennard-Jones + Coulomb force calculation
// ----------------------------------------
function LJ_and_Coulomb_forces() {
  // Coulomb constant (approx.)
  const k = 8.99e9;

  // Reset all forces
  for (const p of particles) {
    p.fx = 0;
    p.fy = 0;
    p.fz = 0;
  }

  for (let i = 0; i < particles.length; i++) {
    for (let j = i + 1; j < particles.length; j++) {
      const pi = particles[i];
      const pj = particles[j];

      const dx = pi.position.x - pj.position.x;
      const dy = pi.position.y - pj.position.y;
      const dz = pi.position.z - pj.position.z;

      const r2 = dx * dx + dy * dy + dz * dz;
      if (r2 < 1e-6) continue;

      const r = Math.sqrt(r2);

      // Lennard-Jones
      const sigma6 = Math.pow(sig, 6);
      const sigma12 = Math.pow(sig, 12);
      const r6 = Math.pow(r, 6);
      const r12 = r6 * r6;

      // 4 * eps * [ (sigma/r)^12 - (sigma/r)^6 ]
      // The force magnitude is the derivative of that potential:
      // F_LJ = 24*eps * [ 2*(sigma^12)/(r^13) - (sigma^6)/(r^7) ]
      const ljForceMag =
        24 * eps * ((2 * sigma12) / (r12 * r) - sigma6 / (r6 * r));

      // Coulomb
      const coulombForceMag = (k * pi.charge * pj.charge) / r2;

      // Combine
      let combined = ljForceMag + coulombForceMag;

      // Clamp the force
      if (combined > maxForce) combined = maxForce;
      if (combined < -maxForce) combined = -maxForce;

      // Direction
      const fx = combined * (dx / r);
      const fy = combined * (dy / r);
      const fz = combined * (dz / r);

      // Apply equal and opposite forces
      pi.fx += fx;
      pi.fy += fy;
      pi.fz += fz;

      pj.fx -= fx;
      pj.fy -= fy;
      pj.fz -= fz;
    }
  }
}

// -----------------------
// Move & boundary checks
// -----------------------
function moveParticles() {
  for (const p of particles) {
    // Update velocity from force
    p.vx += (p.fx / p.mass) * dt;
    p.vy += (p.fy / p.mass) * dt;
    p.vz += (p.fz / p.mass) * dt;

    // Clamp velocity
    const speed = Math.sqrt(p.vx * p.vx + p.vy * p.vy + p.vz * p.vz);
    if (speed > maxVelocity) {
      const scale = maxVelocity / speed;
      p.vx *= scale;
      p.vy *= scale;
      p.vz *= scale;
    }

    // Update position
    p.position.x += p.vx * dt;
    p.position.y += p.vy * dt;
    p.position.z += p.vz * dt;

    // Boundary collisions (reflect)
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

    // Sync the mesh to the updated position
    p.syncMeshPosition();
  }
}

// ------------------
// Animation loop
// ------------------
function animate() {
  requestAnimationFrame(animate);

  // 1) Move particles based on last frame's forces
  moveParticles();

  // 2) Compute new forces for the *next* iteration
  LJ_and_Coulomb_forces();

  // 3) Update controls and render
  controls.update();
  renderer.render(scene, camera);
}

// Kick off the simulation
animate();
