const fs = require('fs');
const path = require('path');
const http = require('http');
const https = require('https');
const net = require('net');
const crypto = require('crypto');
const dataHandler = require('./datahandler');
const storage = require('./storage');
const consoleCmd = require('./console');
const { serverConfig, configSave } = require('./server_config');

let geoip = null;
try {
  geoip = require('geoip-lite');
} catch (e) {
  geoip = null;
}

function parseMarkdown(parsed) {
  parsed = parsed.replace(/<\/?[^>]+(>|$)/g, '');

  var grayTextRegex = /--(.*?)--/g;
  parsed = parsed.replace(grayTextRegex, '<span class="text-gray">$1</span>');

  var boldRegex = /\*\*(.*?)\*\*/g;
  parsed = parsed.replace(boldRegex, '<strong>$1</strong>');

  var italicRegex = /\*(.*?)\*/g;
  parsed = parsed.replace(italicRegex, '<em>$1</em>');

  var linkRegex = /\[([^\]]+)]\(([^)]+)\)/g;
  parsed = parsed.replace(linkRegex, '<a href="$2" target="_blank">$1</a>');

  return parsed.replace(/\n/g, '<br>');
}

function removeMarkdown(parsed) {
  parsed = parsed.replace(/<\/?[^>]+(>|$)/g, '');

  var grayTextRegex = /--(.*?)--/g;
  parsed = parsed.replace(grayTextRegex, '$1');

  var boldRegex = /\*\*(.*?)\*\*/g;
  parsed = parsed.replace(boldRegex, '$1');

  var italicRegex = /\*(.*?)\*/g;
  parsed = parsed.replace(italicRegex, '$1');

  var linkRegex = /\[([^\]]+)]\(([^)]+)\)/g;

  return parsed.replace(linkRegex, '$1');
}

function authenticateWithXdrd(client, salt, password) {
  const sha1 = crypto.createHash('sha1');
  const saltBuffer = Buffer.from(salt, 'utf-8');
  const passwordBuffer = Buffer.from(password, 'utf-8');
  sha1.update(saltBuffer);
  sha1.update(passwordBuffer);

  const hashedPassword = sha1.digest('hex');
  client.write(hashedPassword + '\n');
  client.write('x\n');
}

const ipCache = new Map();
const ipInfoInFlight = new Map();

function fetchIpWhoisInfo(ip, timeoutMs = 1500) {
  return new Promise((resolve) => {
    if (!ip || !net.isIP(ip)) return resolve({});

    const url = `https://ipwho.is/${encodeURIComponent(ip)}`;
    const req = https.get(url, { timeout: timeoutMs }, (res) => {
      if (res.statusCode !== 200) {
        res.resume();
        return resolve({});
      }

      let body = '';
      res.on('data', (chunk) => (body += chunk));
      res.on('end', () => {
        try {
          const data = JSON.parse(body);
          if (!data || data.success === false) return resolve({});

          const connection = data.connection || {};
          const isp = connection.isp || connection.org;
          const asnRaw = connection.asn;
          const as =
            typeof asnRaw === 'string'
              ? asnRaw
              : typeof asnRaw === 'number'
                ? `AS${asnRaw}`
                : undefined;

          resolve({
            isp: typeof isp === 'string' && isp.trim() ? isp.trim() : undefined,
            as,
          });
        } catch (e) {
          resolve({});
        }
      });
    });

    req.on('timeout', () => {
      req.destroy();
      resolve({});
    });

    req.on('error', () => resolve({}));
  });
}


function handleConnect(clientIp, currentUsers, ws, callback) {
  if (ipCache.has(clientIp)) {
    processConnection(clientIp, ipCache.get(clientIp), currentUsers, ws, callback);
    return;
  }

  if (ipInfoInFlight.has(clientIp)) {
    ipInfoInFlight
      .get(clientIp)
      .then((info) => processConnection(clientIp, info, currentUsers, ws, callback))
      .catch(() => processConnection(clientIp, { country: undefined }, currentUsers, ws, callback));
    return;
  }

  let locationInfo = { country: undefined };
  if (geoip && clientIp && net.isIP(clientIp)) {
    const geo = geoip.lookup(clientIp);
    if (geo) {
      locationInfo = {
        country: geo.country,
        countryCode: geo.country,
        city: geo.city,
        regionName: geo.region,
      };
    }
  } else if (!geoip) {
    consoleCmd.logWarn('geoip-lite is not installed; location will be Unknown.');
  }

  const inFlightPromise = fetchIpWhoisInfo(clientIp)
    .then((whoisInfo) => {
      const merged = { ...locationInfo, ...whoisInfo };
      ipCache.set(clientIp, merged);
      ipInfoInFlight.delete(clientIp);
      return merged;
    })
    .catch(() => {
      ipCache.set(clientIp, locationInfo);
      ipInfoInFlight.delete(clientIp);
      return locationInfo;
    });

  ipInfoInFlight.set(clientIp, inFlightPromise);
  inFlightPromise.then((info) => processConnection(clientIp, info, currentUsers, ws, callback));
}

let bannedASCache = { data: null, timestamp: 0 };

function fetchBannedAS(callback) {
  const now = Date.now();
  if (bannedASCache.data && now - bannedASCache.timestamp < 10 * 60 * 1000) return callback(bannedASCache.data);

  const req = https.get("https://fmdx.org/banned_as.json", { family: 4 }, (banResponse) => {
    let banData = "";

    banResponse.on("data", (chunk) => {
      banData += chunk;
    });

    banResponse.on("end", () => {
      try {
        const bannedAS = JSON.parse(banData).banned_as || [];
        bannedASCache = { data: bannedAS, timestamp: now };
        callback(bannedAS);
      } catch (error) {
        console.error("Error parsing banned AS list:", error);
        callback([]); // Default to allowing user
      }
    });
  });

  // Set timeout for the request (5 seconds)
  req.setTimeout(5000, () => {
    console.error("Error: Request timed out while fetching banned AS list.");
    req.abort();
    callback([]); // Default to allowing user
  });

  req.on("error", (err) => {
    console.error("Error fetching banned AS list:", err);
    callback([]); // Default to allowing user
  });
}

const recentBannedIps = new Map(); // Store clientIp -> timestamp

function processConnection(clientIp, locationInfo, currentUsers, ws, callback) {
  const options = { year: "numeric", month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" };
  const connectionTime = new Date().toLocaleString([], options);

  fetchBannedAS((bannedAS) => {
    if (bannedAS.some((as) => locationInfo.as?.includes(as))) {
      const now = Date.now();
      const lastSeen = recentBannedIps.get(clientIp) || 0;

      if (now - lastSeen > 300 * 1000) {
        consoleCmd.logWarn(`Banned AS list client kicked (${clientIp})`);
        recentBannedIps.set(clientIp, now);
      }

      return callback("User banned");
    }

    const userLocation =
      locationInfo && locationInfo.country !== undefined
        ? [
            locationInfo.city,
            locationInfo.regionName && /\p{L}/u.test(String(locationInfo.regionName))
              ? locationInfo.regionName
              : undefined,
            locationInfo.countryCode,
          ]
            .filter(Boolean)
            .join(', ')
        : 'Unknown';
    const userLocationForLog = locationInfo?.isp ? `${userLocation} (${locationInfo.isp})` : userLocation;
  
    storage.connectedUsers.push({
      ip: clientIp,
      location: userLocation,
      isp: locationInfo?.isp,
      as: locationInfo?.as,
      time: connectionTime,
      instance: ws,
    });

    consoleCmd.logInfo(`Web client \x1b[32mconnected\x1b[0m (${clientIp}) \x1b[90m[${currentUsers}]\x1b[0m Location: ${userLocationForLog}`);

    callback("User allowed");
  });
}

function formatUptime(uptimeInSeconds) {
  const secondsInHour = 60 ** 2;
  const secondsInDay = secondsInHour * 24;

  const days = Math.floor(uptimeInSeconds / secondsInDay);
  const hours = Math.floor((uptimeInSeconds % secondsInDay) / secondsInHour);
  const minutes = Math.floor((uptimeInSeconds % secondsInHour) / 60);

  return `${days}d ${hours}h ${minutes}m`;
}

let incompleteDataBuffer = '';

function resolveDataBuffer(data, wss, rdsWss) {
  var receivedData = incompleteDataBuffer + data.toString();
  const isIncomplete = (receivedData.slice(-1) != '\n');

  if (isIncomplete) {
    const position = receivedData.lastIndexOf('\n');
    if (position < 0) {
      incompleteDataBuffer = receivedData;
      receivedData = '';
    } else {
      incompleteDataBuffer = receivedData.slice(position + 1);
      receivedData = receivedData.slice(0, position + 1);
    }
  } else incompleteDataBuffer = '';

  if (receivedData.length) dataHandler.handleData(wss, receivedData, rdsWss);
}

function kickClient(ipAddress) {
  // Find the entry in connectedClients associated with the provided IP address
  const targetClient = storage.connectedUsers.find(client => client.ip === ipAddress);
  if (targetClient && targetClient.instance) {
    // Send a termination message to the client
    targetClient.instance.send('KICK');

    // Close the WebSocket connection after a short delay to allow the client to receive the message
    setTimeout(() => {
      targetClient.instance.close();
      consoleCmd.logInfo(`Web client kicked (${ipAddress})`);
    }, 500);
  } else consoleCmd.logInfo(`Kicking client ${ipAddress} failed. No suitable client found.`);
}

function checkLatency(host, port = 80, timeout = 2000) {
  return new Promise(resolve => {
    const start = Date.now();

    const socket = net.connect({ host, port });

    socket.setTimeout(timeout);

    socket.on("connect", () => {
      const latency = Date.now() - start;
      socket.destroy();
      resolve(latency);  // ms
    });

    socket.on("timeout", () => {
      socket.destroy();
      resolve(null);     // timed out
    });

    socket.on("error", () => {
      resolve(null);     // offline
    });
  });
}

function antispamProtection(message, clientIp, ws, userCommands, lastWarn, userCommandHistory, lengthCommands, endpointName, maxPayloadSize = 1024 * 1024) {
  const rawCommand = message.toString();
  const command = rawCommand.replace(/[\r\n]+/g, '');
  const now = Date.now();
  if (endpointName === 'text') consoleCmd.logDebug(`Command received from \x1b[90m${clientIp}\x1b[0m: ${command}`);

  if (command.length > maxPayloadSize) {
    consoleCmd.logWarn(`Command from \x1b[90m${clientIp}\x1b[0m on \x1b[90m/${endpointName}\x1b[0m exceeded maximum payload size (${parseInt(command.length / 1024)} KB / ${parseInt(maxPayloadSize / 1024)} KB).`);
    return "";
  }

  // Initialize user command history if not present
  if (!userCommandHistory[clientIp]) userCommandHistory[clientIp] = [];

  // Record the current timestamp for the user
  userCommandHistory[clientIp].push(now);

  // Remove timestamps older than 20 ms from the history
  userCommandHistory[clientIp] = userCommandHistory[clientIp].filter(timestamp => now - timestamp <= 20);

  // Check if there are 8 or more commands in the last 20 ms
  if (userCommandHistory[clientIp].length >= 8) {
    consoleCmd.logWarn(`User \x1b[90m${clientIp}\x1b[0m is spamming with rapid commands. Connection will be terminated and user will be banned.`);

    // Check if the normalized IP is already in the banlist
    const isAlreadyBanned = serverConfig.webserver.banlist.some(banEntry => banEntry[0] === clientIp);

    if (!isAlreadyBanned) {
        // Add the normalized IP to the banlist
        serverConfig.webserver.banlist.push([clientIp, 'Unknown', Date.now(), '[Auto ban] Spam']);
        consoleCmd.logInfo(`User \x1b[90m${clientIp}\x1b[0m has been added to the banlist due to extreme spam.`);
        configSave();
    }

    ws.close(1008, 'Bot-like behavior detected');
    return command; // Return command value before closing connection
  }

  // Update the last message time for general spam detection
  lastMessageTime = now;

  // Initialize command history for rate-limiting checks
  if (!userCommands[command]) userCommands[command] = [];

  // Record the current timestamp for this command
  userCommands[command].push(now);

  // Remove timestamps older than 1 second
  userCommands[command] = userCommands[command].filter(timestamp => now - timestamp <= 1000);

  // If command count exceeds limit, close connection
  if (userCommands[command].length > lengthCommands) {
      if (now - lastWarn.time > 1000) { // Check if 1 second has passed
          consoleCmd.logWarn(`User \x1b[90m${clientIp}\x1b[0m is spamming command "${command}" in /${endpointName}. Connection will be terminated.`);
          lastWarn.time = now; // Update the last warning time
      }
      ws.close(1008, 'Spamming detected');
      return command; // Return command value before closing connection
  }

  return command; // Return command value for normal execution
}

const escapeHtml = (unsafe) => {
  return unsafe.replace(/&/g, "&amp;")
    .replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&#039;");
};

// Start plugins with delay
function startPluginsWithDelay(plugins, delay) {
  plugins.forEach((pluginPath, index) => {
    setTimeout(() => {
      const pluginName = path.basename(pluginPath, '.js'); // Extract plugin name from path
      consoleCmd.logInfo(`-----------------------------------------------------------------`);
      consoleCmd.logInfo(`Plugin ${pluginName} loaded successfully!`);
      require(pluginPath);
    }, delay * index);
  });

  // Add final log line after all plugins are loaded
  setTimeout(() => {
    consoleCmd.logInfo(`-----------------------------------------------------------------`);
  }, delay * plugins.length);
}

// Function to find server files based on the plugins listed in config
function findServerFiles(plugins) {
  let results = [];
  plugins.forEach(plugin => {
    // Remove .js extension if present
    if (plugin.endsWith('.js')) plugin = plugin.slice(0, -3);

    const pluginPath = path.join(__dirname, '..', 'plugins', `${plugin}_server.js`);
    if (fs.existsSync(pluginPath) && fs.statSync(pluginPath).isFile()) results.push(pluginPath);
  });
  return results;
}

function normalizeIp(ip) {
  if(ip && ip.startsWith('::ffff:')) return ip.substring(7);
  return ip;
}

function isLocalhost(ip) {
  const normalized = normalizeIp(ip);
  return normalized === '127.0.0.1' || normalized === '::1';
}

function isTrustedProxy(ip) {
  return serverConfig.trustedProxies.includes(normalizeIp(ip));
}

function getIpAddress(request) {
  const remoteIpRaw = request.socket.remoteAddress;
  const remoteIp = normalizeIp(remoteIpRaw);
  const xff = request.headers['x-forwarded-for'];

  if (xff && !isLocalhost(remoteIp) && !isTrustedProxy(remoteIp)) {
    consoleCmd.logSecurity(`Untrusted proxy tried to set X-Forwarded-For: ${xff} (remote: ${remoteIpRaw})`);
    return remoteIp;
  }

  if (xff) return normalizeIp(xff.split(',')[0].trim());

  return remoteIp;
}

module.exports = {
  authenticateWithXdrd, parseMarkdown, handleConnect,
  removeMarkdown, formatUptime, resolveDataBuffer,
  kickClient, checkLatency,
  antispamProtection, escapeHtml, findServerFiles,
  startPluginsWithDelay, getIpAddress
}