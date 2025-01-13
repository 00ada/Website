import numpy as np

def Spring(distance, angle): # Hookes law
    return (
        np.cos(angle) * (-300 * (1-distance)),
        np.sin(angle) * (-300 * (1-distance)),
    )

def Lennard(r_ij, angle): # Lennard jones potential
    return (
        np.cos(angle) * (48 * ( (1/r_ij)**13 - 0.5 * (1/(r_ij))**7)), 
        np.sin(angle) * (48 * ( (1/r_ij)**13 - 0.5 * (1/(r_ij))**7)),
    )

def Charge(r_ij, angle, q1, q2): # Coulombs law
    return ( 
        np.cos(angle) * (332 * (q1 * q2)/r_ij**2), 
        np.sin(angle) * (332 * (q1 * q2)/r_ij**2), 
    )