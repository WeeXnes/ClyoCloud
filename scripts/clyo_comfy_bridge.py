#!/usr/bin/env python3
"""
ClyoCloud <-> ComfyUI Workstation Bridge & Diagnostic Tool

Usage:
  # 1. Test local ComfyUI connectivity
  python3 scripts/clyo_comfy_bridge.py --test

  # 2. Test connection to a remote ClyoCloud instance
  python3 scripts/clyo_comfy_bridge.py --server https://cloud.example.com --token <jwt_token>

How Network Modes Work:
  Mode A: Direct Connection (Recommended)
    - If ClyoCloud and your PC are on the same local network, or connected via Tailscale / VPN:
      Go to ClyoCloud Settings -> ComfyUI Upscaling Pipeline -> Set ComfyUI URL to http://<your-pc-ip>:8188.
      No bridge daemon required!

  Mode B: Remote Server Tunnel
    - If ClyoCloud is on a remote VPS and your PC is behind NAT:
      Use Tailscale (e.g. http://my-pc.tailscale.net:8188) or Cloudflare Tunnel (cloudflared tunnel --url http://localhost:8188).
"""

import sys
import json
import argparse
import urllib.request
import urllib.error

def check_comfyui(url="http://localhost:8188"):
    url = url.rstrip("/")
    print(f"[*] Testing connection to ComfyUI at {url}...")
    try:
        req = urllib.request.Request(f"{url}/system_stats", headers={"User-Agent": "ClyoBridge/1.0"})
        with urllib.request.urlopen(req, timeout=5) as resp:
            data = json.loads(resp.read().decode())
            sys_info = data.get("system", {})
            devices = data.get("devices", [])
            print(f"[+] Successfully connected to ComfyUI!")
            print(f"    - Version: v{sys_info.get('comfyui_version', 'Unknown')}")
            print(f"    - OS: {sys_info.get('os', 'Unknown')}")
            print(f"    - Python: {sys_info.get('python_version', 'Unknown')}")
            for d in devices:
                print(f"    - GPU: {d.get('name', 'Unknown')}")
            return True
    except Exception as e:
        print(f"[-] Could not connect to ComfyUI: {e}")
        print("    Ensure ComfyUI is running with: python main.py --listen 0.0.0.0")
        return False

def check_clyocloud(server_url, token):
    server_url = server_url.rstrip("/")
    print(f"[*] Testing connection to ClyoCloud at {server_url}...")
    try:
        req = urllib.request.Request(
            f"{server_url}/api/verify",
            headers={"Authorization": f"Bearer {token}", "User-Agent": "ClyoBridge/1.0"}
        )
        with urllib.request.urlopen(req, timeout=5) as resp:
            data = json.loads(resp.read().decode())
            print(f"[+] ClyoCloud authentication successful! User: {data.get('user', {}).get('name', 'Unknown')}")
            return True
    except Exception as e:
        print(f"[-] ClyoCloud verification failed: {e}")
        return False

def main():
    parser = argparse.ArgumentParser(description="ClyoCloud <-> ComfyUI Bridge")
    parser.add_argument("--comfy", default="http://localhost:8188", help="ComfyUI URL (default: http://localhost:8188)")
    parser.add_argument("--server", help="ClyoCloud Server URL (e.g. https://cloud.example.com)")
    parser.add_argument("--token", help="ClyoCloud JWT Token")
    parser.add_argument("--test", action="store_true", help="Test local ComfyUI connectivity")
    args = parser.parse_args()

    check_comfyui(args.comfy)

    if args.server and args.token:
        check_clyocloud(args.server, args.token)

if __name__ == "__main__":
    main()
