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

    // Position = Position + Velocty*Time
    function moveParticles() {
        for (const p of particles) {
            p.position.x += p.vx * dt;
            p.position.y += p.vy * dt;
            p.position.z += p.vz * dt;
    
            // Boundary Collision: Keep particles within the box
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

    // Animation loop 
    function animate() {
      requestAnimationFrame(animate);
      moveParticles();
      particleList();
      controls.update();
      renderer.render(scene, camera);
    }

    animate();
