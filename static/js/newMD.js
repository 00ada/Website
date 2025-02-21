import * as THREE from 'https://unpkg.com/three@latest/build/three.module.js';
    import { OrbitControls } from 'https://unpkg.com/three@0.127.0/examples/jsm/controls/OrbitControls.js';

    // Global simulation settings: 
    const dt = 0.005;
    const radius = 0.3;
    const maxVelocity = 5.0;
    const maxForce = 20.0;
    const boxSize = 5;

    const defaultMass = 1.0;  
    const defaultCharge = 0.0;
    const defaultColor = 0xffffff; 

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
    function addParticle() {
      const halfBoxSize = boxSize / 2;
      const x = (Math.random() - 0.5) * boxSize;
      const y = (Math.random() - 0.5) * boxSize;
      const z = (Math.random() - 0.5) * boxSize;

      const vx = (Math.random() - 0.5) * maxVelocity;
      const vy = (Math.random() - 0.5) * maxVelocity;
      const vz = (Math.random() - 0.5) * maxVelocity;

      const newParticle = new Particle({
        x, y, z,
        vx, vy, vz,
        mass: defaultMass,
        charge: defaultCharge,
        radius,
        color: defaultColor,
      });

      particles.push(newParticle);

      // Clear the particle grid and display all particles again
      const particleGrid = document.getElementById("particle-grid");
      particleGrid.innerHTML = ""; // Clear existing content

      particles.forEach((particle) => {
      const particleP = document.createElement("p");
      const particleItem = document.createTextNode(
      `Particle ${particle.id}: Mass = ${particle.mass}, Charge = ${particle.charge}`
      );
      particleP.appendChild(particleItem);
      particleGrid.appendChild(particleP);
  });
    }

    document.getElementById('add-particle-button').addEventListener('click', () => {
      addParticle();  
    });

    function particleList() {
      
    }

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
      const eps = 1.0; // Depth of the potential well (Lennard-Jones)
      const sig = 1.0; // Finite distance at which inter-particle potential is zero (Lennard-Jones)
      const k = 1.0; // Coulomb constant
    
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

    // Animation loop 
    function animate() {
      requestAnimationFrame(animate);
      moveParticles();
      LJ_and_Coulomb_forces();
      calculateTotalEnergy();
      particleList();
      controls.update();
      renderer.render(scene, camera);
    }

    animate();