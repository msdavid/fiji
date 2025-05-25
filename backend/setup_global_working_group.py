#!/usr/bin/env python3
"""
Simple script to setup the global working group.
Run this once to create the 'Organization Wide' working group and assign all existing users to it.

Usage:
    python setup_global_working_group.py
"""

import asyncio
import sys
import os

# Add the backend directory to Python path for imports
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from utils.create_global_working_group import main

if __name__ == "__main__":
    asyncio.run(main())