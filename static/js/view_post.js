import * as THREE from 'https://unpkg.com/three@latest/build/three.module.js';
import { OrbitControls } from 'https://unpkg.com/three@0.127.0/examples/jsm/controls/OrbitControls.js';

document.addEventListener('DOMContentLoaded', () => {
  const container = document.getElementById('particle-container');
  if (!container) {
    console.error('Particle container not found.');
    return;
  }

  // Parse the embedded simulation data: particles, bonds, and settings.
  let parsedParticles = [];
  let parsedBonds = [];
  let settings = {};
  try {
    parsedParticles = JSON.parse(container.dataset.particles);
    parsedBonds = JSON.parse(container.dataset.bonds);
    settings = JSON.parse(container.dataset.settings);
  } catch (error) {
    console.error('Error parsing simulation data:', error,
      'Raw particles:', container.dataset.particles,
      'Raw bonds:', container.dataset.bonds,
      'Raw settings:', container.dataset.settings);
  }
  console.log("Parsed particles:", parsedParticles);
  console.log("Parsed bonds:", parsedBonds);
  console.log("Settings:", settings);

  // Extract simulation parameters from settings, with sensible defaults:
  const dt = settings.dt || 0.005;
  const boxSize = settings.boxSize || 5;
  const maxVelocity = settings.maxVelocity || 10.0;
  const maxForce = settings.maxForce || 40.0;
  const eps = settings.eps || 0.5;
  const sig = settings.sig || 0.5;
  const temperature = settings.temperature || 25; // Default temperature if not provided
  const gamma = 0.5; // Damping coefficient for thermostat
  const k_B = 1.0; // Boltzmann constant

  // Compute sigma for the Langevin thermostat random force:
  const sigmaThermostat = Math.sqrt((2 * gamma * k_B * temperature) / dt);

  // THREE.js setup
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x2b2b2b);
  const width = container.offsetWidth;
  const height = container.offsetHeight;
  const camera = new THREE.PerspectiveCamera(75, width / height, 0.1, 1000);
  camera.position.z = 10;
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(width, height);
  container.appendChild(renderer.domElement);
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;

  // Add a bounding box to indicate simulation limits
  const boxGeometry = new THREE.BoxGeometry(boxSize, boxSize, boxSize);
  const boxMaterial = new THREE.MeshBasicMaterial({
    color: 0xffffff,
    wireframe: true,
    transparent: true,
    opacity: 0.5,
  });
  const boxMesh = new THREE.Mesh(boxGeometry, boxMaterial);
  scene.add(boxMesh);

  // Utility: Gaussian random number generator
  function gaussianRandom(mean = 0, stdev = 1) {
    const u = 1 - Math.random();
    const v = Math.random();
    return Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v) * stdev + mean;
  }

  // Particle class that stores simulation properties and creates a THREE.js sphere.
  class Particle {
    constructor(data) {
      this.id = data.id || 0;
      this.mass = data.mass || 1.0;
      this.charge = data.charge || 0.0;
      this.radius = data.radius || 0.3;
      this.position = new THREE.Vector3(
        (data.position && data.position.x) || 0,
        (data.position && data.position.y) || 0,
        (data.position && data.position.z) || 0
      );
      this.velocity = new THREE.Vector3(
        (data.velocity && data.velocity.x) || 0,
        (data.velocity && data.velocity.y) || 0,
        (data.velocity && data.velocity.z) || 0
      );
      this.force = new THREE.Vector3(0, 0, 0);

      let color = data.color;
      if (typeof color === "string") {
        if (color.startsWith('#')) {
          color = parseInt(color.substring(1), 16);
        } else {
          color = parseInt(color, 16);
        }
      }
      this.color = color || 0xffffff;
      const geometry = new THREE.SphereGeometry(this.radius, 16, 16);
      const material = new THREE.MeshBasicMaterial({ color: this.color });
      this.mesh = new THREE.Mesh(geometry, material);
      this.mesh.position.copy(this.position);
      scene.add(this.mesh);
    }
    updateMesh() {
      this.mesh.position.copy(this.position);
    }
  }

  // Create particles from parsed data.
  const particles = [];
  parsedParticles.forEach(data => {
    particles.push(new Particle(data));
  });

  // SpringBond class to represent bonds between particles.
  class SpringBond {
    constructor(bondData, particles) {
      // bondData should include: particle1Id, particle2Id, springConstant, restLength.
      this.particle1 = particles.find(p => p.id === bondData.particle1Id);
      this.particle2 = particles.find(p => p.id === bondData.particle2Id);
      this.springConstant = bondData.springConstant || 10000;
      this.restLength = bondData.restLength || ((this.particle1.radius + this.particle2.radius) * 0.95);
      // Create a line to visually represent the bond.
      const material = new THREE.LineBasicMaterial({ color: 0x00ff00 });
      const geometry = new THREE.BufferGeometry();
      this.line = new THREE.Line(geometry, material);
      scene.add(this.line);
      this.updateVisual();
    }
    updateVisual() {
      if (!this.particle1 || !this.particle2) return;
      const positions = new Float32Array([
        this.particle1.position.x, this.particle1.position.y, this.particle1.position.z,
        this.particle2.position.x, this.particle2.position.y, this.particle2.position.z
      ]);
      this.line.geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
      this.line.geometry.attributes.position.needsUpdate = true;
    }
    applyForce() {
      if (!this.particle1 || !this.particle2) return;
      const diff = new THREE.Vector3().subVectors(this.particle2.position, this.particle1.position);
      const currentLength = diff.length();
      if (currentLength === 0) return;
      const displacement = currentLength - this.restLength;
      const forceMagnitude = this.springConstant * displacement;
      const direction = diff.normalize();
      const forceVec = direction.multiplyScalar(forceMagnitude);
      // Apply equal and opposite forces.
      this.particle1.force.add(forceVec);
      this.particle2.force.sub(forceVec);
    }
  }

  // Create bonds from parsed data.
  const bonds = [];
  parsedBonds.forEach(bondData => {
    // Only add bond if both particles exist.
    const p1Exists = particles.some(p => p.id === bondData.particle1Id);
    const p2Exists = particles.some(p => p.id === bondData.particle2Id);
    if (p1Exists && p2Exists) {
      bonds.push(new SpringBond(bondData, particles));
    }
  });

  // Calculate forces: includes inter-particle forces and bonds.
  function calculateForces() {
    // Reset forces for all particles.
    particles.forEach(p => p.force.set(0, 0, 0));

    // Compute pairwise forces (Lennard-Jones + Coulomb).
    for (let i = 0; i < particles.length; i++) {
      for (let j = i + 1; j < particles.length; j++) {
        const p1 = particles[i];
        const p2 = particles[j];
        const diff = new THREE.Vector3().subVectors(p1.position, p2.position);
        const r2 = diff.lengthSq();
        if (r2 < 1e-6) continue;
        const r = Math.sqrt(r2);

        const sigma6 = Math.pow(sig, 6);
        const sigma12 = Math.pow(sig, 12);
        const r6 = Math.pow(r, 6);
        const r12 = r6 * r6;
        let ljForceMag = 24 * eps * ((2 * sigma12) / (r12 * r) - (sigma6) / (r6 * r));

        let coulombForceMag = (8.99e9 * p1.charge * p2.charge) / r2;

        let forceMag = ljForceMag + coulombForceMag;
        forceMag = Math.max(-maxForce, Math.min(maxForce, forceMag));

        const direction = diff.normalize();
        const forceVec = direction.multiplyScalar(forceMag);
        p1.force.add(forceVec);
        p2.force.sub(forceVec);
      }
    }

    // Apply bond forces.
    bonds.forEach(bond => {
      bond.applyForce();
    });

    // Apply a simple Langevin thermostat based on the temperature.
    particles.forEach(p => {
      // Add random force scaled by temperature.
      const randomForce = new THREE.Vector3(
        sigmaThermostat * gaussianRandom() * Math.sqrt(p.mass),
        sigmaThermostat * gaussianRandom() * Math.sqrt(p.mass),
        sigmaThermostat * gaussianRandom() * Math.sqrt(p.mass)
      );
      // Apply damping force.
      const dampingForce = p.velocity.clone().multiplyScalar(-gamma * p.mass);
      p.force.add(randomForce).add(dampingForce);
    });
  }

  // Update particle positions, velocities, and handle collisions.
  function moveParticles() {
    particles.forEach(p => {
      const acceleration = p.force.clone().divideScalar(p.mass);
      p.velocity.add(acceleration.multiplyScalar(dt));
      if (p.velocity.length() > maxVelocity) {
        p.velocity.setLength(maxVelocity);
      }
      p.position.add(p.velocity.clone().multiplyScalar(dt));

      // Reflect off the box boundaries.
      const halfBox = boxSize / 2;
      if (p.position.x > halfBox) {
        p.position.x = halfBox;
        p.velocity.x *= -1;
      } else if (p.position.x < -halfBox) {
        p.position.x = -halfBox;
        p.velocity.x *= -1;
      }
      if (p.position.y > halfBox) {
        p.position.y = halfBox;
        p.velocity.y *= -1;
      } else if (p.position.y < -halfBox) {
        p.position.y = -halfBox;
        p.velocity.y *= -1;
      }
      if (p.position.z > halfBox) {
        p.position.z = halfBox;
        p.velocity.z *= -1;
      } else if (p.position.z < -halfBox) {
        p.position.z = -halfBox;
        p.velocity.z *= -1;
      }
      p.updateMesh();
    });
  }

  // Main animation loop.
  function animate() {
    requestAnimationFrame(animate);
    calculateForces();
    moveParticles();
    bonds.forEach(bond => bond.updateVisual());
    controls.update();
    renderer.render(scene, camera);
  }
  animate();

  // Update renderer and camera on window resize.
  window.addEventListener('resize', () => {
    const newWidth = container.offsetWidth;
    const newHeight = container.offsetHeight;
    camera.aspect = newWidth / newHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(newWidth, newHeight);
  });
});
