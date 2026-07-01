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

# Set environment variables (for production)
os.environ.setdefault('SECRET_KEY', 'bilingual-playhouse-prod-2026-stella')
os.environ.setdefault('ADMIN_SETUP_KEY', 'playhouse2026')

# Read OpenAI API key from a separate file (not in git)
try:
    with open('/home/Stella0930/.openai_key', 'r') as f:
        os.environ['OPENAI_API_KEY'] = f.read().strip()
except:
    pass

# Set the Flask app
from app import app as application

# Make sure uploads directory exists
os.makedirs(os.path.join(project_dir, 'static', 'uploads'), exist_ok=True)
