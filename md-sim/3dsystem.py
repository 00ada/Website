import matplotlib.pyplot as plt
import numpy as np
from matplotlib.animation import FuncAnimation
from particle import Particle
from system import System

class ParticleSystemVisualization:
    def __init__(self, system):
        self.system = system
        self.fig, self.ax = plt.subplots()
        self.scat = None

        # Setting up the limits for the visualization
        self.ax.set_xlim(0, self.system.width)
        self.ax.set_ylim(0, self.system.width)
        
        self.init_plot()

    def init_plot(self):
        # Create scatter plot for particles
        x_data = [p.x for p in self.system.particles]
        y_data = [p.y for p in self.system.particles]

        self.scat = self.ax.scatter(x_data, y_data, s=100)

    def update_plot(self, frame):
        # Update the positions of particles for each frame
        self.system.simcount += 1
        for particle in self.system.particles:
            particle.move(self.system.dt)
            particle.check_bounding()
        
        # Update data in the scatter plot
        x_data = [p.x for p in self.system.particles]
        y_data = [p.y for p in self.system.particles]

        self.scat.set_offsets(np.c_[x_data, y_data])

        return self.scat,

    def animate(self):
        # Create the animation
        ani = FuncAnimation(
            self.fig, 
            self.update_plot, 
            frames=np.arange(0, self.system.T, self.system.dt),
            interval=1000 // self.system.frame_rate,
            blit=True
        )
        plt.show()


system = System()
system.create_system()

visualization = ParticleSystemVisualization(system)
visualization.animate()
