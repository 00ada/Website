import numpy as np
import json
import time
import copy

from particle import Particle

class System():
    def __init__(
            self,
            covalent_lines: bool = False,
            lennard_overlay: bool = False,
            frame_rate: int = 30
    ):
        
        # Rendering settings
        self.covalent_lines = covalent_lines
        self.lennard_overlay = lennard_overlay
        self.frame_rate = frame_rate
        
        # Initial system configuration
        self.n_particles = 10
        self.width = 20
        self.dt = 0.001
        self.speed_scale = 70
        self.borders = False
        self.T = 90
        self.name = ""
        self.simcount = 0

        self.particles = []
        self.pseudo_particles = []

    def __repr__(self):
        text_grid = ""
        for y in range(self.width + 1):
            for x in range (self.width + 1):
                for p in self.particles:
                    if round(p.x) == x and round(p.y) == y:
                        text_grid += "o"
                    else: 
                        text_grid = " "
            text_grid += "|\n|"
        return text_grid
    
    def generate_psuedo(self):
        pseudo_particles = self.particles.copy()
        if not self.borders:
            self.pseudo_particles = pseudo_particles
            return
    
    def create_system(self):
        # This creates a perfect grid for the particles
        sqrt_ngrid = np.ceil(np.sqrt(self.n_particles))

        n = 0 

        for y in range(round(sqrt_ngrid)):
            for x in range(round(sqrt_ngrid)):
                self.particles.append(
                    Particle(
                        system = self,
                        n = n*2,
                        x = x / sqrt_ngrid * (self.width * 0.9) + self.width * 0.1, # Normalises the value between 0-1, while keeping it within only 90% of container
                        y = y / sqrt_ngrid * (self.width * 0.9) + self.width * 0.1,
                        vx = self.speed_scale * 2 * (np.random.random()-0.5), # Assigns random speed between 0-1, shift by -0.5 then * by 2 to shift (-1,1)
                        vy = self.speed_scale * 2 * (np.random.random()-0.5), # Speed scale, scales the velocity to make sure our velocity actually updates
                        r = .5
                    )
                )
                n += 1

        self.particles = self.particles[:self.n_particles]
        #self.generate_pseudo()
    
    



