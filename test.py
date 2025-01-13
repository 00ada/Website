import numpy as np

natoms = 2
ndims = 2

class Particle:
    def __init__(self, pos, vel, acc):
        self.pos = pos
        self.vel = vel
        self.acc = acc
        
        

position1 = [np.random.rand(), np.random.rand()]
velocity1 = [np.random.rand(), np.random.rand()]

position2 = [np.random.rand(), np.random.rand()]
velocity2 = [np.random.rand(), np.random.rand()]

particle1 = Particle(position1, velocity1)
particle2 = Particle(position2, velocity2)
mass = 39.948 / 6.022*(10**23) # mass of an argon atom divided by avogadros constant to find the grams

def calcEnergy(particle1, particle2, mass):
    x1, y1 = particle1.pos[0], particle1.pos[1]
    x2, y2 = particle2.pos[0], particle2.pos[1]
    xv1, yv1 = particle1.vel[0], particle1.vel[1]
    xv2, yv2 = particle2.vel[0], particle2.vel[1]
    
    x_diff = x2 - x1
    y_diff = y2 - y1
    dist = np.sqrt((x_diff**2)+ (y_diff)**2) # Finds the distance between particle1 and particle2 using simple pythag
    
    avg_vel1 = (xv1+yv1)/2
    avg_vel2 = (xv2+yv2)/2
    
    epsilon = 1.65**-21 # well depth constant for argon
    sigma = 3.4 # van der waals constant for argon
    force = (4*epsilon) * ((-12*sigma**12*dist**-13)+(6*sigma**6*dist**-7)) # This is the differentiated Lennard-jones potential using distance calculated
    acc = force/mass # Finds the acceleration by simply dividing the force by mass 
    
    # We use suvat here, equation "v^2 = u^2 + 2as" to find the new velocity
    new_dist = (0+t) + (1*1) + (((1**2)*force*1)/mass)
    print(new_dist)
    
    for t in range(100): # t is going to be the seconds, we are just going to 1 second 100 times
        
        
        x_velocity1 = np.sqrt(xv1**2 + 2*acc*new_dist)
        
        
        
    
    
    
    