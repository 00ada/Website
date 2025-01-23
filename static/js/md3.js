import * as THREE from 'https://unpkg.com/three@latest/build/three.module.js'
import { OrbitControls } from 'https://unpkg.com/three@0.127.0/examples/jsm/controls/OrbitControls.js'

// -----------------------------------------------------------------------------
// GLOBAL SIMULATION SETTINGS
// -----------------------------------------------------------------------------
const particleCount = 30;
const dt = 0.005;
const radius = 0.3;
const maxVelocity = 2.0;
const maxForce = 10.0;

let T = 0.1;          // Thermostat target temperature
const mass = 1.0;     // Default mass if user doesn't specify

const eps = 1.0;
const sig = 1.0;
const kCoulomb = 1.38e-23; // Coulomb constant factor (for demonstration)

// Available charge types (you can let a user pick from a UI)
const chargeTypes = [-0.05, 0.0001];

// -----------------------------------------------------------------------------
// THREE.js SETUP
// -----------------------------------------------------------------------------
const container = document.getElementById('simulation-container');
const width = container.clientWidth;
const height = container.clientHeight;
const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
renderer.setSize(width, height);
renderer.setClearColor(0x2b2b2b);
container.appendChild(renderer.domElement);

const scene = new THREE.Scene();

const camera = new THREE.PerspectiveCamera(
  75,           // FOV
  width/height, // Aspect ratio
  0.1,
  1000
);
camera.position.set(0, 5, 15);  // Move back a bit from the origin
camera.lookAt(0, 0, 0);         // Ensure the camera looks at the origin

const controls = new OrbitControls(camera, renderer.domElement);
controls.target.set(0, 0, 0);
controls.enableDamping = true;
controls.dampingFactor = 0.1;

// Optional axes + bounding box
const axesHelper = new THREE.AxesHelper(5);
scene.add(axesHelper);


const boxGeometry = new THREE.BoxGeometry(5, 5, 5);
const boxMaterial = new THREE.MeshBasicMaterial({
  color: 0xffffff,
  wireframe: true,
  transparent: true,
  opacity: 0.5,
});
const box = new THREE.Mesh(boxGeometry, boxMaterial);
scene.add(box);

// -----------------------------------------------------------------------------
// PARTICLE CLASS & ARRAYS
// -----------------------------------------------------------------------------

/**
 * Particle class to store all relevant properties.
 */
class Particle {
  constructor({
    x = 0, 
    y = 0, 
    z = 0, 
    vx = 0, 
    vy = 0, 
    vz = 0,
    mass = 1.0,
    charge = 0.0,
    radius = 0.3,
    color = 0xff0000,  // default red
  }) {
    this.mass = mass;
    this.charge = charge;
    this.radius = radius;

    // Position
    this.position = new THREE.Vector3(x, y, z);

    // Velocity
    this.vx = vx;
    this.vy = vy;
    this.vz = vz;

    // Force (accumulator)
    this.fx = 0;
    this.fy = 0;
    this.fz = 0;

    // THREE.js mesh
    const geom = new THREE.SphereGeometry(radius, 16, 16);
    const mat  = new THREE.MeshBasicMaterial({ color });
    this.mesh  = new THREE.Mesh(geom, mat);

    // Put the mesh at the initial position
    this.mesh.position.set(x, y, z);
    scene.add(this.mesh);
  }

  // Helper to update the THREE.Mesh position from this.position
  syncMeshPosition() {
    this.mesh.position.set(
      this.position.x,
      this.position.y,
      this.position.z
    );
  }
}

// Global arrays
const particles = [];    // Array<Particle>
const bonds = [];        // e.g. [{ i: number, j: number, r0: number, kSpring: number }, ...]
let pairDistances = [];  // 2D array or 1D array to store distances among pairs

// -----------------------------------------------------------------------------
// CREATE PARTICLES (initially random) - DEMO
// In a real UI, you'd have a function `addParticle(params)` and let the user
// specify mass, charge, color, etc. We'll just auto-generate for now.
// -----------------------------------------------------------------------------
function createParticles() {
  while (particles.length < particleCount) {
    const charge = chargeTypes[Math.floor(Math.random() * chargeTypes.length)];
    const color  = (charge === -0.05) ? 0x0000ff : 0xff0000;

    // Random position in ±4 range
    const x = (Math.random() - 0.5) * 8;
    const y = (Math.random() - 0.5) * 8;
    const z = (Math.random() - 0.5) * 8;

    // Check overlap
    let overlaps = false;
    for (const p of particles) {
      const dx = p.position.x - x;
      const dy = p.position.y - y;
      const dz = p.position.z - z;
      const dist = Math.sqrt(dx*dx + dy*dy + dz*dz);
      if (dist < 2*radius) {
        overlaps = true;
        break;
      }
    }
    if (overlaps) continue;

    const vx = (Math.random()-0.5)*0.5;
    const vy = (Math.random()-0.5)*0.5;
    const vz = (Math.random()-0.5)*0.5;

    const newParticle = new Particle({
      x, y, z,
      vx, vy, vz,
      mass: 1.0,
      charge,
      radius,
      color
    });
    particles.push(newParticle);
  }
}

/**
 * Example of how you'd let a user add a new Particle from a UI:
 * function addParticleFromUI(params) {
 *   const p = new Particle({...params});
 *   particles.push(p);
 * }
 */

// -----------------------------------------------------------------------------
// BONDING - Optional: user can pick which particles to bond
// For demonstration, let's define an empty bonds array now.
// In a UI, the user might call e.g. addBond(i, j, 1.0, 100)...
// -----------------------------------------------------------------------------

function addBond(i, j, r0, kSpring) {
  bonds.push({ i, j, r0, kSpring });
}

/**
 * Example usage:
 * addBond(0, 1, 1.0, 100.0);
 * addBond(1, 2, 1.0, 100.0);
 * etc.
 */

// -----------------------------------------------------------------------------
// FORCE CALCULATIONS
// -----------------------------------------------------------------------------

function resetForces() {
  for (const p of particles) {
    p.fx = 0;
    p.fy = 0;
    p.fz = 0;
  }
}

function LJ_and_Coulomb_forces() {
  // We also update pairDistances[][] here
  // Initialize/resize pairDistances
  const N = particles.length;
  pairDistances = Array.from({ length: N }, () => new Array(N).fill(0));

  for (let i = 0; i < N; i++) {
    for (let j = i+1; j < N; j++) {
      const pi = particles[i];
      const pj = particles[j];

      const dx = pi.position.x - pj.position.x;
      const dy = pi.position.y - pj.position.y;
      const dz = pi.position.z - pj.position.z;
      const r2 = dx*dx + dy*dy + dz*dz;
      if (r2 < 1e-6) continue;

      const r = Math.sqrt(r2);
      // Store distance
      pairDistances[i][j] = r;
      pairDistances[j][i] = r;

      // Lennard-Jones
      const sigma6  = Math.pow(sig, 6);
      const sigma12 = Math.pow(sig, 12);
      const r6      = Math.pow(r, 6);
      const r12     = r6 * r6;

      const ljMag = 24 * eps * ((2 * sigma12/(r12*r)) - (sigma6/(r6*r)));

      // Coulomb
      const coulombMag = (kCoulomb * pi.charge * pj.charge) / r2;

      let combined = ljMag + coulombMag;

      // clamp
      if (combined > maxForce)  combined = maxForce;
      if (combined < -maxForce) combined = -maxForce;

      const fx = combined * (dx / r);
      const fy = combined * (dy / r);
      const fz = combined * (dz / r);

      // apply
      pi.fx += fx;
      pi.fy += fy;
      pi.fz += fz;

      pj.fx -= fx;
      pj.fy -= fy;
      pj.fz -= fz;
    }
  }
}

/**
 * If the user has set up some bonds, apply spring forces:
 * F = -kSpring * (r - r0).
 */
function applyBondForces() {
  for (const bond of bonds) {
    const { i, j, r0, kSpring } = bond;
    const pi = particles[i];
    const pj = particles[j];

    // Vector i->j
    const dx = pj.position.x - pi.position.x;
    const dy = pj.position.y - pi.position.y;
    const dz = pj.position.z - pi.position.z;

    const r2 = dx*dx + dy*dy + dz*dz;
    if (r2 < 1e-12) continue;
    const r = Math.sqrt(r2);

    const dr = r - r0;
    let f = -kSpring * dr;  // negative => restoring
    if (f >  maxForce) f =  maxForce;
    if (f < -maxForce) f = -maxForce;

    const nx = dx / r;
    const ny = dy / r;
    const nz = dz / r;

    const fx = f*nx;
    const fy = f*ny;
    const fz = f*nz;

    pi.fx += fx;
    pi.fy += fy;
    pi.fz += fz;

    pj.fx -= fx;
    pj.fy -= fy;
    pj.fz -= fz;
  }
}

// -----------------------------------------------------------------------------
// THERMOSTAT (velocity rescaling)
// -----------------------------------------------------------------------------
function applyThermostat() {
  // compute current KE
  let totalKE = 0;
  for (const p of particles) {
    const speed2 = p.vx*p.vx + p.vy*p.vy + p.vz*p.vz;
    totalKE += 0.5 * p.mass * speed2;
  }

  const currentTemp = (2 * totalKE) / (3 * particles.length);

  const sf = Math.sqrt(T / currentTemp);
  for (const p of particles) {
    p.vx *= sf;
    p.vy *= sf;
    p.vz *= sf;
  }
}

// -----------------------------------------------------------------------------
// MOTION
// -----------------------------------------------------------------------------
function moveParticles() {
  for (const p of particles) {
    // Position
    p.position.x += p.vx*dt + 0.5*(p.fx/p.mass)*dt*dt;
    p.position.y += p.vy*dt + 0.5*(p.fy/p.mass)*dt*dt;
    p.position.z += p.vz*dt + 0.5*(p.fz/p.mass)*dt*dt;

    // Velocity
    p.vx += (p.fx / p.mass)*dt;
    p.vy += (p.fy / p.mass)*dt;
    p.vz += (p.fz / p.mass)*dt;

    // clamp velocity
    p.vx = Math.max(-maxVelocity, Math.min(maxVelocity, p.vx));
    p.vy = Math.max(-maxVelocity, Math.min(maxVelocity, p.vy));
    p.vz = Math.max(-maxVelocity, Math.min(maxVelocity, p.vz));

    // walls
    if (p.position.x > 2.5) {
      p.position.x = 2.5;
      p.vx *= -1;
    } else if (p.position.x < -2.5) {
      p.position.x = -2.5;
      p.vx *= -1;
    }

    if (p.position.y > 2.5) {
      p.position.y = 2.5;
      p.vy *= -1;
    } else if (p.position.y < -2.5) {
      p.position.y = -2.5;
      p.vy *= -1;
    }

    if (p.position.z > 2.5) {
      p.position.z = 2.5;
      p.vz *= -1;
    } else if (p.position.z < -2.5) {
      p.position.z = -2.5;
      p.vz *= -1;
    }

    // Update mesh
    p.syncMeshPosition();
  }
}

// -----------------------------------------------------------------------------
// OPTIONAL HARD-SPHERE COLLISIONS ON TOP OF LJ
// -----------------------------------------------------------------------------
function checkCollisions() {
  const N = particles.length;
  for (let i = 0; i < N; i++) {
    for (let j = i+1; j < N; j++) {
      const pi = particles[i];
      const pj = particles[j];

      const dx = pj.position.x - pi.position.x;
      const dy = pj.position.y - pi.position.y;
      const dz = pj.position.z - pi.position.z;
      const dist2 = dx*dx + dy*dy + dz*dz;
      const minDist = pi.radius + pj.radius;

      if (dist2 < minDist*minDist) {
        const dist = Math.sqrt(dist2);
        if (dist < 1e-12) continue;

        // Normal
        const nx = dx/dist;
        const ny = dy/dist;
        const nz = dz/dist;

        // relative velocity
        const rvx = pj.vx - pi.vx;
        const rvy = pj.vy - pi.vy;
        const rvz = pj.vz - pi.vz;

        const relDot = rvx*nx + rvy*ny + rvz*nz;
        if (relDot > 0) continue; // separating

        // equal masses => impulse = -relDot
        const impulse = -relDot;

        // apply
        pi.vx -= impulse*nx;
        pi.vy -= impulse*ny;
        pi.vz -= impulse*nz;

        pj.vx += impulse*nx;
        pj.vy += impulse*ny;
        pj.vz += impulse*nz;

        // push out overlap
        const overlap = minDist - dist;
        const halfOverlap = overlap*0.5;
        pi.position.x -= nx*halfOverlap;
        pi.position.y -= ny*halfOverlap;
        pi.position.z -= nz*halfOverlap;

        pj.position.x += nx*halfOverlap;
        pj.position.y += ny*halfOverlap;
        pj.position.z += nz*halfOverlap;
      }
    }
  }
}

// -----------------------------------------------------------------------------
// MEASUREMENT
// -----------------------------------------------------------------------------
function measureSystem() {
  let totalKE = 0;
  for (const p of particles) {
    const speed2 = p.vx*p.vx + p.vy*p.vy + p.vz*p.vz;
    totalKE += 0.5 * p.mass * speed2;
  }
  const currentTemp = (2 * totalKE) / (3 * particles.length);
  console.log(`KE = ${totalKE.toFixed(4)}, T = ${currentTemp.toFixed(4)}`);
}

// -----------------------------------------------------------------------------
// MAIN
// -----------------------------------------------------------------------------
createParticles(); 
// If you want to see bond forces in action, try e.g.
// addBond(0, 1, 1.0, 100.0); // etc.
addBond(0, 1, 1.0, 100.0); // etc.

function animate() {
  requestAnimationFrame(animate);

  // 1) Clear forces
  resetForces();

  // 2) LJ + Coulomb
  LJ_and_Coulomb_forces();

  // 2b) If any bonds => spring forces
  applyBondForces();

  // 3) Move
  moveParticles();

  // 4) Hard-sphere collisions?
  checkCollisions();

  // 5) Thermostat
  applyThermostat();

  // 6) measure
  measureSystem();

  controls.update();
  renderer.render(scene, camera);
}
animate();
