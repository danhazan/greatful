"""
Temporary debug route for Railway volume persistence debugging.
Remove after debugging is complete.
"""

from fastapi import APIRouter
import os
import stat
import subprocess

router = APIRouter()

@router.get("/_debug/uploads-status")
async def debug_uploads():
    """Debug endpoint to check upload path configuration and volume mounting."""
    path = os.environ.get("UPLOAD_PATH", "uploads")
    abs_path = os.path.abspath(path)
    exists = os.path.exists(abs_path)
    
    listing = []
    try:
        listing = os.listdir(abs_path)
    except Exception as e:
        listing = [f"error listing dir: {e}"]
    
    # Read mounts
    mounts = None
    try:
        with open("/proc/mounts") as f:
            mounts = f.read()
    except Exception:
        mounts = "cannot read /proc/mounts"
    
    # Check permissions
    permissions = None
    try:
        stat_info = os.stat(abs_path)
        permissions = {
            "mode": oct(stat_info.st_mode),
            "uid": stat_info.st_uid,
            "gid": stat_info.st_gid
        }
    except Exception as e:
        permissions = f"error getting permissions: {e}"
    
    # Check disk usage
    disk_usage = None
    try:
        statvfs = os.statvfs(abs_path)
        disk_usage = {
            "total_bytes": statvfs.f_frsize * statvfs.f_blocks,
            "free_bytes": statvfs.f_frsize * statvfs.f_bavail,
            "used_bytes": statvfs.f_frsize * (statvfs.f_blocks - statvfs.f_bavail)
        }
    except Exception as e:
        disk_usage = f"error getting disk usage: {e}"
    
    return {
        "UPLOAD_PATH_env": os.environ.get("UPLOAD_PATH"),
        "abs_path": abs_path,
        "exists": exists,
        "listing_preview": listing[:20],
        "mounts_head": mounts.splitlines()[:20] if isinstance(mounts, str) else mounts,
        "permissions": permissions,
        "disk_usage": disk_usage,
        "current_working_dir": os.getcwd(),
        "process_uid": os.getuid(),
        "process_gid": os.getgid()
    }

@router.post("/_debug/create-sentinel")
async def create_sentinel():
    """Create a sentinel file to test persistence across deployments."""
    import datetime
    
    path = os.environ.get("UPLOAD_PATH", "uploads")
    abs_path = os.path.abspath(path)
    
    # Ensure directory exists
    os.makedirs(abs_path, exist_ok=True)
    
    timestamp = datetime.datetime.now().isoformat()
    sentinel_filename = f"sentinel-{timestamp.replace(':', '-')}.txt"
    sentinel_path = os.path.join(abs_path, sentinel_filename)
    
    try:
        with open(sentinel_path, 'w') as f:
            f.write(f"Sentinel file created at {timestamp}\n")
            f.write(f"Process PID: {os.getpid()}\n")
            f.write(f"Working directory: {os.getcwd()}\n")
            f.write(f"Upload path: {abs_path}\n")
        
        return {
            "success": True,
            "sentinel_file": sentinel_filename,
            "full_path": sentinel_path,
            "timestamp": timestamp
        }
    except Exception as e:
        return {
            "success": False,
            "error": str(e),
            "attempted_path": sentinel_path
        }