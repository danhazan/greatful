"""
Install additional dependencies required for load testing.

This script installs the extra packages needed for comprehensive load testing
that are not included in the base requirements.txt.
"""

import subprocess
import sys
import os


def install_package(package):
    """Install a package using pip."""
    try:
        subprocess.check_call([sys.executable, "-m", "pip", "install", package])
        print(f"✓ Successfully installed {package}")
        return True
    except subprocess.CalledProcessError as e:
        print(f"✗ Failed to install {package}: {e}")
        return False


def main():
    """Install load testing dependencies."""
    print("Installing load testing dependencies...")
    
    # Additional packages needed for load testing
    load_test_packages = [
        "psutil>=5.9.0",  # System metrics
        "Pillow>=10.1.0",  # Image processing for upload tests
        "httpx>=0.25.2",   # Already in requirements but ensure version
    ]
    
    success_count = 0
    total_packages = len(load_test_packages)
    
    for package in load_test_packages:
        if install_package(package):
            success_count += 1
    
    print(f"\nInstallation complete: {success_count}/{total_packages} packages installed successfully")
    
    if success_count == total_packages:
        print("✓ All load testing dependencies installed successfully!")
        print("\nYou can now run load tests with:")
        print("  python tests/load/run_load_tests.py")
        return 0
    else:
        print("✗ Some packages failed to install. Please check the errors above.")
        return 1


if __name__ == "__main__":
    sys.exit(main())