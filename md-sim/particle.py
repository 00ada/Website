import numpy as np
import copy

from utils import Spring, Lennard, Charge

class Particle:
    def __init__(
        self, 
        system,
        n: int, # This is the particles "ID"
        x: float, # This is the x-coordinate for the particle
        y: float, # This is the y-coordinate for the particle
        vx: float, # This is the velocity's horizontal component 
        vy: float, # This is the velocity's vertical component
        r: float, # This is the radius of the particle
        m: int = 1, # This is the mass of the particle with a default value of 1 
        charge: int = 0, # Charge of the particle, default value of 0
        connected: list = []
    ):
        self.n = n 
        self.system = system

        self.x = x
        self.y = y
        self.vx = vx
        self.vy = vy 
        self.m = m
        self.r = r
        self.charge = charge
        self.connected = connected

        self.force_x = 0
        self.force_y = 0
        self.old_forces = (0,0)

    def __repr__(self):
        return f"<Particle x.{self.x} y.{self.y}>"

    def save_forces_old(self):
        # Saves the old forces for Verlet Integration
        self.old_forces = (
            copy.copy(self.force_x), 
            copy.copy(self.force_y)
        )

        self.force_x = 0
        self.force_y = 0

    """
    It is worth mentioning that the variable "p" is to represent the other particle
    that the current one is interacting with.

    """

    def get_dist(self, p):
        # Gets the distance between two particles
        return np.sqrt((p.x - self.x)**2 + (p.y - self.y)**2) # This is just pythag to find the maginute of the distance

    def get_angle(self, p):
        # Gets the angle between two particles
        return np.arcsin((p.y-self.y) / self.get_dist(p)) # Just trig between the vertical distance and the actual distance

    def move(self, dt: float):
        # Move the particle
        self.x += dt*self.vx + 0.5*dt**2*self.force_x # Uses SUVAT to calculate new distances: s = v*t + 1/2*a*t^2
        self.y += dt*self.vy + 0.5*dt**2*self.force_y # We can use a=f*m to get acceleration (where mass=1)

    def check_bounding(self):
        # If the particle moves across the screen, then move it to the opposite side back into the system

        # Change the border type when the border is updated
        if self.system.borders:
            if self.x > self.system.width: 
                self.x -= self.system.width
                self.system.collision(self)

            elif self.x < 0: 
                self.x += self.system.width 
                self.system.collision(self)

            if self.y > self.system.width: 
                self.y -= self.system.width
                self.system.collision(self)

            elif self.y < 0: 
                self.y += self.system.width 
                self.system.collision(self)
        else:
            if self.x > self.system.width or self.x < 0:
                self.vx *= -1
            if self.y > self.system.width or self.y < 0:
                self.vy *= -1

    def lennard_jones(self, p):
        # Calculates the lennard jones force from one particle in relation to another particle

        # Check if the two particles are bonded already
        if p.n not in self.connected and self.n not in p.connected:
            # Get the closest particle that is to self with the same n, if using psedo particles it may return a psudo particle
            min_dist = sorted(
                [
                    (i, i.get_dist(self)) 
                    for i in self.system.pseudo_particles 
                    if i.n == p.n
                ],
                key=lambda x: x[1]
            )[0][0]

            # Calculate distance and angle to the paticle and then
            # calculate the lennard jones induced forces for x and y components
            lennard_force = Lennard(
                self.get_dist(min_dist), 
                abs(self.get_angle(min_dist))
            )

            # Apply the forces
            self.force_x += lennard_force[0] * (1 if self.x > min_dist.x else -1)
            self.force_y += lennard_force[1] * (1 if self.y > min_dist.y else -1)
            p.force_x    -= lennard_force[0] * (1 if self.x > min_dist.x else -1)
            p.force_y    -= lennard_force[1] * (1 if self.y > min_dist.y else -1)

    def spring_forces(self):
        """Covalent bonds between molecules, to enable set n to be one higher than the current molecule"""
        for p in self.system.particles:
            if p.n in self.connected or self.n in p.connected:
                # Get the closest particle that is the bond, if using psudo particles it may return a psudo particle
                min_dist = sorted(
                    [
                        (i, i.get_dist(self)) 
                        for i in self.system.pseudo_particles 
                        if i.n == p.n
                    ],
                    key=lambda x: x[1] # List comprehension to create a list of all pseudo particles (sorted) then find the lowest distance by selecting the first tuple
                )[0][0]
                
                # Calculate the ang and get the forces
                spring_force = Spring(
                    self.get_dist(min_dist), 
                    abs(self.get_angle(min_dist))
                )

                # Apply the forces
                self.force_x += spring_force[0] * (-1 if self.x > min_dist.x else 1)
                self.force_y += spring_force[1] * (-1 if self.y > min_dist.y else 1)
                p.force_x    -= spring_force[0] * (-1 if self.x > min_dist.x else 1)
                p.force_y    -= spring_force[1] * (-1 if self.y > min_dist.y else 1)

    def columb_forces(self, p):
        # Calculate the Coulomb forces for the particle in relation to another particle

        # Check if the two particles are bonded already
        if p.n not in self.connected and self.n not in p.connected:
            # Get the closest particle that is to self with the same n, if using psudo particles it may return a psudo particle
            min_dist = sorted(
                [
                    (i, i.get_dist(self)) 
                    for i in self.system.pseudo_particles 
                    if i.n == p.n
                ],
                key=lambda x: x[1]
            )[0][0]

            # Calculate distance and angle to the paticle and then
            # calculate the lennard jones induced forces for x and y components
            coulomb_force = Charge(
                self.get_dist(min_dist), 
                abs(self.get_angle(min_dist)),
                self.charge,
                p.charge
            )

            # Apply the forces
            self.force_x += coulomb_force[0] * (1 if self.x > min_dist.x else -1)
            self.force_y += coulomb_force[1] * (1 if self.y > min_dist.y else -1)
            p.force_x    -= coulomb_force[0] * (1 if self.x > min_dist.x else -1)
            p.force_y    -= coulomb_force[1] * (1 if self.y > min_dist.y else -1)#
            
            
            
            
            
            