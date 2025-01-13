import cv2
import os
from PIL import Image, ImageDraw

from system import System

class Video:
    def save(self, system, filename='test.png'):
        # Creates an image from all the positions of the particles
        scale = 20
        rightbar = 170 

        img = Image.new("RGB", (system.width * scale + rightbar, system.width * scale), "black")
        draw = ImageDraw.Draw(img)

pic = Video()
pic.save