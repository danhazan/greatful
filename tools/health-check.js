#!/usr/bin/env node

var spawn = require('child_process').spawn;
var exec = require('child_process').exec;
var http = require('http');
var https = require('https');
var fs = require('fs');
var path = require('path');

function DevServerHealthCheck() {
  this.devProcess = null;
  this.isCleaningUp = false;
  this.devErrors = [];
  this.consoleErrors = [];
  this.targetPath = process.argv[2] || '/';
  this.enableConsoleCheck = !process.argv.includes('--no-console');
  this.puppeteerAvailable = false;
  
  // Check if Puppeteer is available
  try {
    require.resolve('puppeteer');
    this.puppeteerAvailable = true;
  } catch (e) {
    this.puppeteerAvailable = false;
  }
  
  // Normalize path
  if (this.targetPath && !this.targetPath.startsWith('/')) {
    this.targetPath = '/' + this.targetPath;
  }
  
  console.log('🎯 Target path: ' + this.targetPath);
  
  if (this.enableConsoleCheck) {
    if (this.puppeteerAvailable) {
      console.log('🕵️  Console error detection: ENABLED');
    } else {
      console.log('⚠️  Console error detection: DISABLED (Puppeteer not installed)');
      console.log('   Install with: npm install puppeteer --save-dev');
    }
  } else {
    console.log('🚫 Console error detection: DISABLED (--no-console flag)');
  }
}

DevServerHealthCheck.prototype.run = function() {
  var self = this;
  
  console.log('🚀 Starting dev server health check...');
  
  return this.startDevServer()
    .then(function() {
      return self.waitForServer();
    })
    .then(function() {
      return self.testLandingPage();
    })
    .then(function(result) {
      if (self.enableConsoleCheck && self.puppeteerAvailable) {
        return self.checkConsoleErrors(result.url).then(function() {
          return result;
        });
      }
      return result;
    })
    .then(function(result) {
      console.log('✅ Health check completed: ' + result.status + ' - ' + result.message);
      
      // Print collected dev server errors
      if (self.devErrors.length > 0) {
        console.log('\n📋 Dev server errors encountered:');
        for (var i = 0; i < self.devErrors.length; i++) {
          console.log('❌ ' + self.devErrors[i]);
        }
      }
      
      // Print collected console errors
      if (self.consoleErrors.length > 0) {
        console.log('\n🕵️  Browser console errors detected:');
        for (var j = 0; j < self.consoleErrors.length; j++) {
          console.log('🔴 ' + self.consoleErrors[j]);
        }
      }
      
      return result;
    })
    .catch(function(error) {
      console.error('❌ Health check failed: ' + error.message);
      return { status: 'ERROR', message: error.message };
    })
    .finally(function() {
      return self.cleanup();
    });
};

DevServerHealthCheck.prototype.checkConsoleErrors = function(url) {
  var self = this;
  
  if (!this.puppeteerAvailable) {
    return Promise.resolve();
  }
  
  console.log('🕵️  Checking for console errors...');
  
  return new Promise(function(resolve, reject) {
    var puppeteer;
    try {
      puppeteer = require('puppeteer');
    } catch (e) {
      console.log('⚠️  Puppeteer not available, skipping console check');
      return resolve();
    }
    
    var browser;
    
    puppeteer.launch({ 
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    })
    .then(function(browserInstance) {
      browser = browserInstance;
      return browser.newPage();
    })
    .then(function(page) {
      // Listen for console messages
      page.on('console', function(msg) {
        var type = msg.type();
        var text = msg.text();
        
        if (type === 'error') {
          self.consoleErrors.push('[CONSOLE ERROR] ' + text);
        } else if (type === 'warning' && text.toLowerCase().includes('error')) {
          self.consoleErrors.push('[CONSOLE WARNING] ' + text);
        }
      });
      
      // Listen for page errors
      page.on('pageerror', function(error) {
        self.consoleErrors.push('[PAGE ERROR] ' + error.message);
      });
      
      // Listen for request failures
      page.on('requestfailed', function(request) {
        self.consoleErrors.push('[REQUEST FAILED] ' + request.url() + ' - ' + request.failure().errorText);
      });
      
      // Set a timeout for the page load
      return Promise.race([
        page.goto(url, { 
          waitUntil: 'networkidle2',
          timeout: 15000
        }),
        new Promise(function(_, timeoutReject) {
          setTimeout(function() {
            timeoutReject(new Error('Page load timeout'));
          }, 15000);
        })
      ]);
    })
    .then(function() {
      // Wait a bit more for any async errors
      return new Promise(function(waitResolve) {
        setTimeout(waitResolve, 2000);
      });
    })
    .then(function() {
      if (self.consoleErrors.length === 0) {
        console.log('✅ No console errors detected');
      } else {
        console.log('⚠️  Found ' + self.consoleErrors.length + ' console error(s)');
      }
      
      if (browser) {
        return browser.close();
      }
    })
    .then(function() {
      resolve();
    })
    .catch(function(error) {
      console.log('⚠️  Console check failed: ' + error.message);
      if (browser) {
        browser.close().catch(function() {});
      }
      resolve(); // Don't fail the entire health check
    });
  });
};

DevServerHealthCheck.prototype.startDevServer = function() {
  var self = this;
  
  return new Promise(function(resolve, reject) {
    console.log('📦 Starting npm run dev...');
    
    self.devProcess = spawn('npm', ['run', 'dev'], {
      stdio: 'pipe',
      shell: true,
      detached: !process.platform.startsWith('win')
    });

    var hasStarted = false;
    var startupTimeout;

    self.devProcess.stdout.on('data', function(data) {
      var output = data.toString();
      console.log('[DEV] ' + output.trim());
      
      if (!hasStarted && (
        output.includes('Local:') || 
        output.includes('localhost') ||
        output.includes('ready') ||
        output.includes('compiled') ||
        output.includes('started')
      )) {
        hasStarted = true;
        clearTimeout(startupTimeout);
        resolve();
      }
    });

    self.devProcess.stderr.on('data', function(data) {
      var error = data.toString();
      console.error('[DEV ERROR] ' + error.trim());
      
      // Store error for later reporting
      self.devErrors.push(error.trim());
      
      if (error.toLowerCase().includes('error') && !error.toLowerCase().includes('warning')) {
        if (!hasStarted) {
          clearTimeout(startupTimeout);
          reject(new Error('Dev server failed to start: ' + error));
        }
      }
    });

    self.devProcess.on('close', function(code) {
      if (!hasStarted && code !== 0) {
        clearTimeout(startupTimeout);
        reject(new Error('Dev server exited with code ' + code));
      }
    });

    self.devProcess.on('error', function(error) {
      if (!hasStarted) {
        clearTimeout(startupTimeout);
        reject(new Error('Failed to start dev server: ' + error.message));
      }
    });

    startupTimeout = setTimeout(function() {
      if (!hasStarted) {
        reject(new Error('Dev server startup timeout (30s)'));
      }
    }, 30000);
  });
};

DevServerHealthCheck.prototype.waitForServer = function(maxAttempts, delay) {
  var self = this;
  maxAttempts = maxAttempts || 20;
  delay = delay || 1000;
  
  console.log('⏳ Waiting for server to be ready...');
  
  function attemptConnection(attempt) {
    return self.makeRequest('http://localhost:3000' + self.targetPath)
      .then(function() {
        console.log('✅ Server is ready!');
        return Promise.resolve();
      })
      .catch(function(error) {
        if (attempt >= maxAttempts) {
          throw new Error('Server not ready after ' + maxAttempts + ' attempts');
        }
        console.log('⏳ Attempt ' + attempt + '/' + maxAttempts + ' - waiting...');
        return self.sleep(delay).then(function() {
          return attemptConnection(attempt + 1);
        });
      });
  }
  
  return attemptConnection(1);
};

DevServerHealthCheck.prototype.testLandingPage = function() {
  var self = this;
  console.log('🔍 Testing landing page at path: ' + this.targetPath);
  
  var testUrls = [
    'http://localhost:3000' + this.targetPath,
    'http://localhost:5173' + this.targetPath,
    'http://localhost:8080' + this.targetPath
  ];

  function tryUrl(index) {
    if (index >= testUrls.length) {
      throw new Error('Landing page not accessible at path "' + self.targetPath + '" on any common ports');
    }
    
    var url = testUrls[index];
    return self.makeRequest(url)
      .then(function(response) {
        if (response.statusCode >= 200 && response.statusCode < 400) {
          return {
            status: response.statusCode + ' ' + self.getStatusText(response.statusCode),
            message: 'Page accessible at ' + url,
            url: url,
            statusCode: response.statusCode
          };
        } else {
          console.log('⚠️ ' + url + ' returned status ' + response.statusCode);
          return tryUrl(index + 1);
        }
      })
      .catch(function(error) {
        console.log('⚠️ ' + url + ' failed: ' + error.message);
        return tryUrl(index + 1);
      });
  }
  
  return tryUrl(0);
};

DevServerHealthCheck.prototype.getStatusText = function(statusCode) {
  var statusTexts = {
    200: 'OK',
    201: 'Created',
    202: 'Accepted',
    204: 'No Content',
    301: 'Moved Permanently',
    302: 'Found',
    304: 'Not Modified',
    400: 'Bad Request',
    401: 'Unauthorized',
    403: 'Forbidden',
    404: 'Not Found',
    405: 'Method Not Allowed',
    500: 'Internal Server Error',
    502: 'Bad Gateway',
    503: 'Service Unavailable'
  };
  
  return statusTexts[statusCode] || 'Unknown';
};

DevServerHealthCheck.prototype.makeRequest = function(url) {
  return new Promise(function(resolve, reject) {
    var urlObj = new URL(url);
    var client = urlObj.protocol === 'https:' ? https : http;
    
    var options = {
      hostname: urlObj.hostname,
      port: urlObj.port,
      path: urlObj.pathname + urlObj.search,
      method: 'GET',
      timeout: 5000
    };

    var req = client.request(options, function(res) {
      var data = '';
      res.on('data', function(chunk) {
        data += chunk;
      });
      res.on('end', function() {
        resolve({
          statusCode: res.statusCode,
          headers: res.headers,
          body: data
        });
      });
    });

    req.on('error', function(error) {
      reject(error);
    });

    req.on('timeout', function() {
      req.destroy();
      reject(new Error('Request timeout'));
    });

    req.end();
  });
};

DevServerHealthCheck.prototype.cleanup = function() {
  var self = this;
  
  if (this.isCleaningUp) return Promise.resolve();
  this.isCleaningUp = true;
  
  console.log('🧹 Cleaning up processes...');
  
  if (this.devProcess) {
    var pid = this.devProcess.pid;
    console.log('📋 Killing process tree for PID: ' + pid);
    
    return this.killProcessTree(pid)
      .then(function() {
        return self.sleep(1000);
      })
      .then(function() {
        return self.killProcessesOnPorts([3000, 5173, 8080]);
      })
      .then(function() {
        console.log('✅ Cleanup completed');
      })
      .catch(function(error) {
        console.error('⚠️ Cleanup warning: ' + error.message);
      });
  }
  
  return Promise.resolve();
};

DevServerHealthCheck.prototype.killProcessTree = function(pid) {
  var isWindows = process.platform === 'win32';
  
  return new Promise(function(resolve) {
    if (isWindows) {
      exec('taskkill /F /T /PID ' + pid, function(error, stdout, stderr) {
        if (error) {
          console.log('Process ' + pid + ' may have already terminated');
        } else {
          console.log('✅ Killed process tree for PID ' + pid);
        }
        resolve();
      });
    } else {
      try {
        process.kill(-pid, 'SIGTERM');
        
        setTimeout(function() {
          try {
            process.kill(-pid, 'SIGKILL');
            console.log('✅ Killed process group for PID ' + pid);
          } catch (e) {
            // Process already terminated
          }
          resolve();
        }, 1000);
      } catch (error) {
        try {
          process.kill(pid, 'SIGTERM');
          setTimeout(function() {
            try {
              process.kill(pid, 'SIGKILL');
            } catch (e) {
              // Process already terminated
            }
            resolve();
          }, 1000);
        } catch (e) {
          console.log('Process ' + pid + ' may have already terminated');
          resolve();
        }
      }
    }
  });
};

DevServerHealthCheck.prototype.killProcessesOnPorts = function(ports) {
  var self = this;
  
  function killPort(index) {
    if (index >= ports.length) {
      return Promise.resolve();
    }
    
    var port = ports[index];
    console.log('🔍 Checking for processes on port ' + port + '...');
    
    var isWindows = process.platform === 'win32';
    
    return new Promise(function(resolve) {
      if (isWindows) {
        exec('netstat -ano | findstr :' + port, function(error, stdout) {
          if (stdout) {
            console.log('🎯 Found processes on port ' + port + ', killing them...');
            var lines = stdout.split('\n');
            var pids = [];
            
            for (var i = 0; i < lines.length; i++) {
              var line = lines[i];
              var parts = line.trim().split(/\s+/);
              var pid = parts[parts.length - 1];
              if (pid && pid !== '0' && !isNaN(pid)) {
                pids.push(pid);
              }
            }
            
            var killPromises = pids.map(function(pid) {
              return new Promise(function(killResolve) {
                exec('taskkill /F /PID ' + pid, function(killError) {
                  if (!killError) {
                    console.log('✅ Killed PID ' + pid + ' on port ' + port);
                  }
                  killResolve();
                });
              });
            });
            
            Promise.all(killPromises).then(resolve);
          } else {
            resolve();
          }
        });
      } else {
        exec('lsof -ti tcp:' + port, function(error, stdout) {
          if (stdout) {
            console.log('🎯 Found processes on port ' + port + ', killing them...');
            var pids = stdout.trim().split('\n').filter(function(pid) {
              return pid;
            });
            
            var killPromises = pids.map(function(pid) {
              return new Promise(function(killResolve) {
                exec('kill -9 ' + pid, function(killError) {
                  if (!killError) {
                    console.log('✅ Killed PID ' + pid + ' on port ' + port);
                  }
                  killResolve();
                });
              });
            });
            
            Promise.all(killPromises).then(resolve);
          } else {
            resolve();
          }
        });
      }
    }).then(function() {
      return killPort(index + 1);
    }).catch(function(error) {
      console.log('⚠️ Could not clean port ' + port + ': ' + error.message);
      return killPort(index + 1);
    });
  }
  
  return killPort(0);
};

DevServerHealthCheck.prototype.sleep = function(ms) {
  return new Promise(function(resolve) {
    setTimeout(resolve, ms);
  });
};

// Handle process signals for cleanup
var healthCheck = new DevServerHealthCheck();

process.on('SIGINT', function() {
  console.log('\n🛑 Received SIGINT, cleaning up...');
  healthCheck.cleanup().then(function() {
    process.exit(0);
  });
});

process.on('SIGTERM', function() {
  console.log('\n🛑 Received SIGTERM, cleaning up...');
  healthCheck.cleanup().then(function() {
    process.exit(0);
  });
});

process.on('uncaughtException', function(error) {
  console.error('💥 Uncaught Exception:', error);
  healthCheck.cleanup().then(function() {
    process.exit(1);
  });
});

// Run the health check
if (require.main === module) {
  // Show usage if help is requested
  if (process.argv.includes('--help') || process.argv.includes('-h')) {
    console.log('Usage: node health-check.js [path] [--no-console]');
    console.log('');
    console.log('Examples:');
    console.log('  node health-check.js                 # Test root path (/) with console check');
    console.log('  node health-check.js /auth/signup    # Test /auth/signup path with console check');
    console.log('  node health-check.js --no-console    # Test root path without console check');
    console.log('  node health-check.js /login --no-console # Test /login without console check');
    console.log('  node health-check.js --help          # Show this help');
    console.log('');
    console.log('Console Error Detection:');
    console.log('  Requires: npm install puppeteer --save-dev');
    console.log('  Detects: JavaScript errors, React errors, network failures');
    console.log('  Skip with: --no-console flag');
    console.log('');
    console.log('The script will:');
    console.log('  1. Start your dev server (npm run dev)');
    console.log('  2. Test the specified path on common ports (3000, 5173, 8080)');
    console.log('  3. Check for browser console errors (if Puppeteer available)');
    console.log('  4. Report success/failure and any errors');
    console.log('  5. Clean up all processes');
    process.exit(0);
  }
  
  healthCheck.run().then(function(result) {
    var hasErrors = healthCheck.devErrors.length > 0 || healthCheck.consoleErrors.length > 0;
    var isSuccess = (result.status.includes('OK') || result.statusCode < 400) && !hasErrors;
    process.exit(isSuccess ? 0 : 1);
  }).catch(function(error) {
    console.error('💥 Fatal error:', error);
    process.exit(1);
  });
}

module.exports = DevServerHealthCheck;
