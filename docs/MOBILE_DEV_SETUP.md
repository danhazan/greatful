# 📱 Mobile Development Setup Guide

## 🚀 Quick Setup (No Port Forwarding Required!)

### Method 1: Local Network Access (Recommended)

#### Step 1: Start Dev Server with Network Access
```bash
cd apps/web

# Option A: Next.js with host binding (recommended)
npm run dev -- --hostname 0.0.0.0

# Option B: Alternative if above doesn't work
npm run dev -- -H 0.0.0.0 -p 3000
```

#### Step 2: Connect from Phone
1. **Connect phone to same WiFi network**
2. **Open browser on phone**
3. **Navigate to:** `http://172.25.208.218:3000`

**✅ That's it! No port forwarding needed!**

---

## 🔧 Alternative Methods

### Method 2: Ngrok Tunnel (If local network blocked)

#### Install Ngrok
```bash
# Option A: Download from https://ngrok.com/download
# Option B: Install via npm
npm install -g ngrok

# Option C: Install via package manager
# Ubuntu/Debian: sudo apt install ngrok
# macOS: brew install ngrok
```

#### Setup Tunnel
```bash
# Terminal 1: Start your dev server
cd apps/web && npm run dev

# Terminal 2: Create tunnel
ngrok http 3000
```

#### Use HTTPS URL on Phone
- Ngrok shows: `https://abc123.ngrok.io`
- Open this URL on your phone

### Method 3: Tailscale (Advanced - Best for Teams)

#### Install Tailscale
```bash
# Install on your dev machine and phone
# Visit: https://tailscale.com/download
```

#### Access via Tailscale IP
- Get Tailscale IP: `tailscale ip -4`
- Access: `http://TAILSCALE_IP:3000`

---

## 🛠️ Troubleshooting

### Issue: "Connection Refused" on Phone

#### Solution 1: Check Firewall
```bash
# Ubuntu/Debian - Allow port 3000
sudo ufw allow 3000

# CentOS/RHEL - Allow port 3000  
sudo firewall-cmd --add-port=3000/tcp --permanent
sudo firewall-cmd --reload

# macOS - Check System Preferences > Security & Privacy > Firewall
```

#### Solution 2: Verify Server Binding
```bash
# Check if server is listening on all interfaces
netstat -tlnp | grep :3000

# Should show: 0.0.0.0:3000 (not 127.0.0.1:3000)
```

#### Solution 3: Try Different Port
```bash
# If port 3000 is blocked, try 8080
npm run dev -- --hostname 0.0.0.0 --port 8080

# Then access: http://172.25.208.218:8080
```

### Issue: "Site Can't Be Reached"

#### Check Network Configuration
```bash
# Verify you're on same network
# On dev machine:
ip route | grep default

# Should match your phone's gateway
```

#### Test Connectivity
```bash
# From phone, try pinging your dev machine
# (Use network scanner app or terminal app)
ping 172.25.208.218
```

---

## 📊 Network Requirements

### ✅ **What You DON'T Need:**
- ❌ Port forwarding on router
- ❌ DMZ configuration  
- ❌ External IP access
- ❌ VPN setup (unless using Tailscale)

### ✅ **What You DO Need:**
- ✅ Same WiFi network (phone + dev machine)
- ✅ Dev server bound to `0.0.0.0` (not `127.0.0.1`)
- ✅ Firewall allowing port 3000
- ✅ Network allowing device-to-device communication

---

## 🔍 Network Diagnostics

### Check Your Setup
```bash
# 1. Verify local IP
hostname -I | awk '{print $1}'

# 2. Check server is running
curl http://localhost:3000

# 3. Check server binding
netstat -tlnp | grep :3000

# 4. Test from another device on network
curl http://172.25.208.218:3000
```

### Phone Network Scanner Apps
- **Android**: "Network Scanner" by First Row
- **iOS**: "Network Analyzer" by Technet

---

## 🚀 Quick Commands Reference

### Start Dev Server for Mobile
```bash
# Next.js (recommended)
cd apps/web && npm run dev -- --hostname 0.0.0.0

# Alternative syntax
cd apps/web && npm run dev -- -H 0.0.0.0

# With custom port
cd apps/web && npm run dev -- --hostname 0.0.0.0 --port 8080
```

### Test Connectivity
```bash
# From dev machine - test local access
curl http://localhost:3000

# From dev machine - test network access  
curl http://172.25.208.218:3000

# Check what's listening on port 3000
lsof -i :3000
```

### Get Network Info
```bash
# Your local IP
hostname -I | awk '{print $1}'

# Network interface info
ip addr show | grep inet

# Gateway info
ip route | grep default
```

---

## 📱 Testing Haptic Feedback

Once connected, test these features on your phone:

### 1. **Follow Button** (Light Haptic - 10ms)
- Navigate to any post
- Tap follow/unfollow button
- Should feel light vibration

### 2. **Emoji Picker** (Medium Haptic - 20ms)
- Tap heart button on any post  
- Select any emoji
- Should feel medium vibration

### 3. **Visual Feedback**
- All buttons should scale down when pressed
- Touch targets should be minimum 44px
- No double-tap zoom on interactive elements

---

## 🔒 Security Notes

### Local Network Access is Safe Because:
- ✅ Only accessible from same WiFi network
- ✅ No external internet exposure
- ✅ Development server (not production)
- ✅ Temporary access (server stops when you stop it)

### Best Practices:
- 🔒 Only use on trusted networks (home/office WiFi)
- 🔒 Stop dev server when not needed
- 🔒 Don't use on public WiFi for sensitive projects
- 🔒 Use HTTPS tunnels (ngrok) for external access

---

## 🎯 Expected Results

After setup, you should be able to:
- ✅ Access your dev server from phone browser
- ✅ Feel haptic feedback on supported interactions
- ✅ Test touch optimizations and accessibility
- ✅ Debug mobile-specific issues in real-time
- ✅ Hot reload works across devices

**Your dev server IP: `http://172.25.208.218:3000`**