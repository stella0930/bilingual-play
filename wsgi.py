#!/usr/bin/env python3
"""
Bilingual Playhouse - WSGI entry point for PythonAnywhere
"""
import sys
import os

# Add the project directory to the path
project_dir = '/home/Stella0930/bilingual-play'
if project_dir not in sys.path:
    sys.path.insert(0, project_dir)

# Set the Flask app
from app import app as application

# Make sure uploads directory exists
os.makedirs(os.path.join(project_dir, 'static', 'uploads'), exist_ok=True)
