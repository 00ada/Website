import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

const particleCount = 30;
const dt = 0.005;
const radius = 0.3;
const maxVelocity = 2.0;
// The maximum (absolute) pairwise force you allow, for stability
const maxForce = 10.0;

// Thermostat parameters
let T = 0.1; // Target temperature (can be adjusted)
const mass = 1.0; // Assume unit mass for simplicity

const eps = 1.0;
const sig = 1.0;
const k = 1.38*10**-23;
// Two charge types: one is slightly negative (-0.05), the other is near neutral (+0.0001).
// Like charges (e.g., both negative) should repel with the correct sign fix.
const chargeTypes = [-0.05, 0.0001];

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setClearColor(0x2b2b2b);
document.body.appendChild(renderer.domElement);

const scene = new THREE.Scene();

const camera = new THREE.PerspectiveCamera(
  75,
  window.innerWidth / window.innerHeight,
  0.1,
  1000
);
camera.position.set(0, 2, 15);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.1;

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

const particles = [];
const charges = [];

/**
 * Create initial particles with random positions (non-overlapping)
 * and small random velocities.
 */
function createParticles() {
  while (particles.length < particleCount) {
    const geometry = new THREE.SphereGeometry(radius, 16, 16);
    const charge = chargeTypes[Math.floor(Math.random() * chargeTypes.length)];
    const material = new THREE.MeshBasicMaterial({
      color: charge === -0.05 ? 0x0000ff : 0xff0000,
    });

    const sphere = new THREE.Mesh(geometry, material);

    const x = (Math.random() - 0.5) * 8;
    const y = (Math.random() - 0.5) * 8;
    const z = (Math.random() - 0.5) * 8;

    // Check for overlap
    let overlaps = false;
    for (const p of particles) {
      const dx = p.position.x - x;
      const dy = p.position.y - y;
      const dz = p.position.z - z;
      const distance = Math.sqrt(dx * dx + dy * dy + dz * dz);
      if (distance < 2 * radius) {
        overlaps = true;
        break;
      }
    }
    if (overlaps) continue;

    sphere.position.set(x, y, z);
    sphere.vx = (Math.random() - 0.5) * 0.5;
    sphere.vy = (Math.random() - 0.5) * 0.5;
    sphere.vz = (Math.random() - 0.5) * 0.5;

    sphere.forceX = 0;
    sphere.forceY = 0;
    sphere.forceZ = 0;

    particles.push(sphere);
    charges.push(charge);
    scene.add(sphere);
  }
}

/**
 * Compute Lennard-Jones + Coulomb forces among all particle pairs
 * with the correct sign for repulsion of like charges.
 */
function LJ_and_Coulomb_forces() {
  // Reset forces
  for (const p of particles) {
    p.forceX = 0;
    p.forceY = 0;
    p.forceZ = 0;
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
      if (r2 < 1e-6) continue;

      const r = Math.sqrt(r2);

      // Lennard-Jones
      const sigma6 = Math.pow(sig, 6);
      const sigma12 = Math.pow(sig, 12);
      const r6 = Math.pow(r, 6);
      const r12 = r6 * r6;

      // LJ magnitude (derivative)
      // For reference: F_LJ = 24 * eps * [ (2*(sigma/r)^12 - (sigma/r)^6 ) / r ]
      const ljForceMag = 24 * eps * ((2 * sigma12 / (r12 * r)) - (sigma6 / (r6 * r)));

      // Coulomb: F_coul = k*(q_i*q_j)/r^2
      // The direction we use (dx/r, dy/r, dz/r) is already from j->i if dx = x_i - x_j
      const coulombForceMag = (k * charges[i] * charges[j]) / r2;

      // Bonds: 
      const bonds = [];
      for (let i = 0; i < particles / 3; i++) {
        bonds.push([3*i, 3*i+1, 1.0, 100.0]);
        bonds.push([3*i+1, 3*i+2, 1.0, 100.0])
      }

      for (let i = 0; i < particles; i++) {
        for (let j = 0; j < bonds; j++) {
          if (bonds[j][0] === i || bonds[j][1] === i) {
            if (bonds[j][0] === i) {
              let ii = bonds[j][1]
            } else {
              let ii = bonds[j][0]
            }
            const dr0 = bonds[j][2]
            const e0 = bonds[j][3]
            dr = r2
          }
        }
      }

      // Combine
      let combined = ljForceMag + coulombForceMag;

      // Clamp the magnitude (both positive or negative)
      if (combined > maxForce) combined = maxForce;
      if (combined < -maxForce) combined = -maxForce;

      // Force components
      const fx = combined * (dx / r);
      const fy = combined * (dy / r);
      const fz = combined * (dz / r);

      // Apply to i, j (Newton's 3rd law)
      pi.forceX += fx;
      pi.forceY += fy;
      pi.forceZ += fz;

      pj.forceX -= fx;
      pj.forceY -= fy;
      pj.forceZ -= fz;
    }
  }
}


/**
 * Simple Berendsen-like velocity rescaling (or direct rescaling) to maintain temperature.
 */
function applyThermostat() {
  // Compute current KE
  let totalKE = 0;
  for (const p of particles) {
    const speed2 = p.vx * p.vx + p.vy * p.vy + p.vz * p.vz;
    totalKE += 0.5 * mass * speed2;
  }

  // 3D system => T = 2/3 * ( KE / (N * (3/2) ) ), simplified => (2 * KE) / (3*N)
  const currentTemp = (2 * totalKE) / (3 * particles.length);

  // Rescaling factor
  const scalingFactor = Math.sqrt(T / currentTemp);
  for (const p of particles) {
    p.vx *= scalingFactor;
    p.vy *= scalingFactor;
    p.vz *= scalingFactor;
  }
}

/**
 * Integrate motion (simple Verlet-like update).
 */
function moveParticles() {
  for (const p of particles) {
    // Position update
    p.position.x += p.vx * dt + 0.5 * p.forceX * dt * dt;
    p.position.y += p.vy * dt + 0.5 * p.forceY * dt * dt;
    p.position.z += p.vz * dt + 0.5 * p.forceZ * dt * dt;

    // Velocity update
    p.vx += p.forceX * dt;
    p.vy += p.forceY * dt;
    p.vz += p.forceZ * dt;

    // Clamp velocities
    p.vx = Math.max(-maxVelocity, Math.min(maxVelocity, p.vx));
    p.vy = Math.max(-maxVelocity, Math.min(maxVelocity, p.vy));
    p.vz = Math.max(-maxVelocity, Math.min(maxVelocity, p.vz));

    // Bounce off walls (elastic collisions)
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
  }
}

/**
 * Particle-Particle collision detection for "hard-sphere" bounce
 * on top of LJ. If distance < 2*r => we do an elastic collision in 3D.
 */
function checkCollisions() {
    for (let i = 0; i < particles.length; i++) {
      for (let j = i+1; j < particles.length; j++) {
        const pi = particles[i];
        const pj = particles[j];
  
        // distance
        const dx = pj.position.x - pi.position.x;
        const dy = pj.position.y - pi.position.y;
        const dz = pj.position.z - pi.position.z;
        const dist2 = dx*dx + dy*dy + dz*dz;
        const minDist = 2 * radius; // sums of radii
  
        if (dist2 < minDist*minDist) {
          const dist = Math.sqrt(dist2);
          if (dist < 1e-8) continue;
  
          // =========== 3D Elastic Collision (equal mass) ==========
  
          // 1) Normalize collision normal
          const nx = dx / dist;
          const ny = dy / dist;
          const nz = dz / dist;
  
          // 2) Relative velocity
          const rvx = pj.vx - pi.vx;
          const rvy = pj.vy - pi.vy;
          const rvz = pj.vz - pi.vz;
  
          // 3) Relative velocity along normal = dot(rv, n)
          const relDot = rvx*nx + rvy*ny + rvz*nz;
  
          // If relDot>0 => they're separating or stationary, skip
          if (relDot > 0) continue;
  
          // 4) For equal masses => factor = -relDot
          const impulse = -relDot;
  
          // 5) Apply impulse * normal to each
          // vA' = vA - (impulse * n)
          // vB' = vB + (impulse * n)
          pi.vx -= (impulse * nx);
          pi.vy -= (impulse * ny);
          pi.vz -= (impulse * nz);
  
          pj.vx += (impulse * nx);
          pj.vy += (impulse * ny);
          pj.vz += (impulse * nz);
  
          // 6) Optional: push them so they no longer overlap
          // We'll separate them by half overlap each
          const overlap = minDist - dist;
          const halfOverlap = overlap * 0.5;
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
  

/**
 * Measure total kinetic energy and (instantaneous) temperature each timestep.
 */
function measureSystem() {
  let totalKE = 0;
  for (const p of particles) {
    const speed2 = p.vx * p.vx + p.vy * p.vy + p.vz * p.vz;
    totalKE += 0.5 * mass * speed2;
  }
  const currentTemp = (2 * totalKE) / (3 * particles.length);

  // Print or store
  console.log(`KE = ${totalKE.toFixed(4)},  T = ${currentTemp.toFixed(4)}`);
}

// -------------------------------------------------
// Main
// -------------------------------------------------
createParticles();

function animate() {
  requestAnimationFrame(animate);

  // 1) Compute forces
  LJ_and_Coulomb_forces();

  // 2) Move particles
  moveParticles();

  // 3) Thermostat
  applyThermostat();

  // 4) Optionally measure system KE and T
  measureSystem(); // or call this every N steps if you prefer

  controls.update();
  renderer.render(scene, camera);
}
animate();
