import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

const particleCount = 10;
const dt = 0.01;

const eps = 1.0;
const sig = 1.0;

const renderer = new THREE.WebGLRenderer();
renderer.setSize(window.innerWidth, window.innerHeight);
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

const boxGeometry = new THREE.BoxGeometry(10, 10, 10);
const boxMaterial = new THREE.MeshBasicMaterial({
    color: 0xffffff,
    wireframe: true,
    transparent: true,
    opacity: 0.5,
});
const box = new THREE.Mesh(boxGeometry, boxMaterial);
scene.add(box);

// Mass and types
const m = [1.0, 10.0]; // Masses of the two particle types
const tp = new Array(particleCount).fill(0); // Initialize particle types with 0
const mm = new Array(particleCount); // Mass lookup table

// Set particle types
for (let i = 0; i < particleCount; i++) {
    if (i < particleCount / 2) {
        tp[i] = 0; // First half of particles are type 0
    } else {
        tp[i] = 1; // Second half of particles are type 1
    }
}

// Create mass lookup table
for (let j = 0; j < particleCount; j++) {
    mm[j] = m[tp[j]]; // Lookup mass based on particle type
}

// Output the results
console.log("Particle Types (tp):", tp);
console.log("Mass Lookup Table (mm):", mm);

const particles = [];
function createParticles() {
    for (let i = 0; i < particleCount; i++) {
        const geometry = new THREE.SphereGeometry(0.5, 16, 16);

        // Assign color based on type
        const color = tp[i] === 0 ? 0xffffff : 0xff0000; // White for type 0, red for type 1
        const material = new THREE.MeshBasicMaterial({ color });

        const sphere = new THREE.Mesh(geometry, material);

        sphere.position.set(
            (Math.random() - 0.5) * 8,
            (Math.random() - 0.5) * 8,
            (Math.random() - 0.5) * 8
        );

        sphere.vx = (Math.random() - 0.5) * 2;
        sphere.vy = (Math.random() - 0.5) * 2;
        sphere.vz = (Math.random() - 0.5) * 2;

        sphere.forceX = 0;
        sphere.forceY = 0;
        sphere.forceZ = 0;

        particles.push(sphere);
        scene.add(sphere);
    }
}

function LJ_potential() {
    for (const p of particles) {
        p.forceX = 0;
        p.forceY = 0;
        p.forceZ = 0;
    }

    for (let i = 0; i < particles.length; i++) {
        for (let j = i + 1; j < particles.length; j++) {
            const pi = particles[i];
            const pj = particles[j];

            const dx = pj.position.x - pi.position.x;
            const dy = pj.position.y - pi.position.y;
            const dz = pj.position.z - pi.position.z;
            const r2 = dx * dx + dy * dy + dz * dz;

            if (r2 === 0) continue;

            const r = Math.sqrt(r2);

            const sigma6 = Math.pow(sig, 6);
            const sigma12 = Math.pow(sig, 12);
            const r6 = Math.pow(r, 6);
            const r12 = r6 * r6;

            const fMag = 24 * eps * ((2 * sigma12 / (r12 * r)) - (sigma6 / (r6 * r)));

            const fx = fMag * (dx / r);
            const fy = fMag * (dy / r);
            const fz = fMag * (dz / r);

            pi.forceX += fx;
            pi.forceY += fy;
            pi.forceZ += fz;

            pj.forceX -= fx;
            pj.forceY -= fy;
            pj.forceZ -= fz;
        }
    }
}

function moveParticles() {
    for (const p of particles) {
        p.position.x += p.vx * dt + 0.5 * p.forceX * dt * dt;
        p.position.y += p.vy * dt + 0.5 * p.forceY * dt * dt;
        p.position.z += p.vz * dt + 0.5 * p.forceZ * dt * dt;

        p.vx += p.forceX * dt;
        p.vy += p.forceY * dt;
        p.vz += p.forceZ * dt;

        if (p.position.x > 5) {
            p.position.x = 5;
            p.vx *= -1;
        } else if (p.position.x < -5) {
            p.position.x = -5;
            p.vx *= -1;
        }

        if (p.position.y > 5) {
            p.position.y = 5;
            p.vy *= -1;
        } else if (p.position.y < -5) {
            p.position.y = -5;
            p.vy *= -1;
        }

        if (p.position.z > 5) {
            p.position.z = 5;
            p.vz *= -1;
        } else if (p.position.z < -5) {
            p.position.z = -5;
            p.vz *= -1;
        }
    }
}

createParticles();

function animate() {
    requestAnimationFrame(animate);
    LJ_potential();
    moveParticles();
    controls.update();
    renderer.render(scene, camera);
}
animate();
