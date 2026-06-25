console.clear();
const { spawn } = require("child_process");
const express = require("express");
const fs = require("fs-extra");
const path = require("path");
const chalk = require('chalk');
const logger = require("./IMRANC.js");

const app = express();
const PORT = process.env.PORT || 5000;
const CONFIG_PATH = path.join(__dirname, "../../Config.json");
const APPSTATE_PATH = path.join(__dirname, "../../appstate.json");

app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

// Static files
app.use(express.static(path.join(__dirname, "website")));

// Main dashboard
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "website/imran.html"));
});

// === API ROUTES ===

// Get bot config
app.get("/api/config", (req, res) => {
  try {
    delete require.cache[require.resolve(CONFIG_PATH)];
    const config = require(CONFIG_PATH);
    const mainConfig = fs.readJsonSync(path.join(__dirname, "../configs/Config.json"));
    res.json({ success: true, config, mainConfig });
  } catch (e) {
    res.json({ success: false, error: e.message });
  }
});

// Update main config (prefix, bot name, adminOnly, etc.)
app.post("/api/config", (req, res) => {
  try {
    delete require.cache[require.resolve(CONFIG_PATH)];
    const config = require(CONFIG_PATH);
    const allowed = ["BOTNAME", "PREFIX", "language", "approval", "premium", "developermode"];
    for (const key of allowed) {
      if (req.body[key] !== undefined) config[key] = req.body[key];
    }
    fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2), "utf8");
    if (global.config) Object.assign(global.config, config);
    res.json({ success: true, message: "Config updated" });
  } catch (e) {
    res.json({ success: false, error: e.message });
  }
});

// Get admin list
app.get("/api/admins", (req, res) => {
  try {
    delete require.cache[require.resolve(CONFIG_PATH)];
    const config = require(CONFIG_PATH);
    res.json({
      success: true,
      ADMINBOT: config.ADMINBOT || [],
      OPERATOR: config.OPERATOR || [],
      OWNER: config.OWNER || []
    });
  } catch (e) {
    res.json({ success: false, error: e.message });
  }
});

// Add admin
app.post("/api/admins/add", (req, res) => {
  try {
    const { uid } = req.body;
    if (!uid) return res.json({ success: false, error: "UID required" });
    delete require.cache[require.resolve(CONFIG_PATH)];
    const config = require(CONFIG_PATH);
    if (!config.ADMINBOT.includes(String(uid))) {
      config.ADMINBOT.push(String(uid));
      if (global.config) global.config.ADMINBOT.push(String(uid));
    }
    fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2), "utf8");
    res.json({ success: true, message: `Admin ${uid} added`, ADMINBOT: config.ADMINBOT });
  } catch (e) {
    res.json({ success: false, error: e.message });
  }
});

// Remove admin
app.post("/api/admins/remove", (req, res) => {
  try {
    const { uid } = req.body;
    if (!uid) return res.json({ success: false, error: "UID required" });
    delete require.cache[require.resolve(CONFIG_PATH)];
    const config = require(CONFIG_PATH);
    config.ADMINBOT = config.ADMINBOT.filter(id => id !== String(uid));
    if (global.config) global.config.ADMINBOT = config.ADMINBOT;
    fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2), "utf8");
    res.json({ success: true, message: `Admin ${uid} removed`, ADMINBOT: config.ADMINBOT });
  } catch (e) {
    res.json({ success: false, error: e.message });
  }
});

// Get/Update appstate (cookies)
app.get("/api/appstate", (req, res) => {
  try {
    const raw = fs.readFileSync(APPSTATE_PATH, "utf8");
    res.json({ success: true, appstate: raw });
  } catch (e) {
    res.json({ success: false, error: e.message });
  }
});

app.post("/api/appstate", (req, res) => {
  try {
    const { appstate } = req.body;
    if (!appstate) return res.json({ success: false, error: "Appstate required" });
    let parsed;
    try {
      parsed = typeof appstate === "string" ? JSON.parse(appstate) : appstate;
    } catch (e) {
      return res.json({ success: false, error: "Invalid JSON appstate" });
    }
    fs.writeFileSync(APPSTATE_PATH, JSON.stringify(parsed, null, 2), "utf8");
    res.json({ success: true, message: "Appstate updated. Restart bot to apply changes." });
  } catch (e) {
    res.json({ success: false, error: e.message });
  }
});

// Bot status
app.get("/api/status", (req, res) => {
  try {
    const uptime = process.uptime();
    const hours = Math.floor(uptime / 3600);
    const minutes = Math.floor((uptime % 3600) / 60);
    const seconds = Math.floor(uptime % 60);
    res.json({
      success: true,
      status: "running",
      uptime: `${hours}h ${minutes}m ${seconds}s`,
      botName: (global.config && global.config.BOTNAME) || "reverse bot",
      prefix: (global.config && global.config.PREFIX) || "-",
      adminOnly: (global.ryuko && global.ryuko.adminOnly) || false,
      pid: process.pid,
      memory: Math.round(process.memoryUsage().rss / 1024 / 1024) + " MB"
    });
  } catch (e) {
    res.json({ success: false, error: e.message });
  }
});

// Get commands list with enabled/disabled status
app.get("/api/commands", (req, res) => {
  try {
    delete require.cache[require.resolve(CONFIG_PATH)];
    const config = require(CONFIG_PATH);
    const disabled = config.disabledcmds || [];
    const scriptsDir = path.join(__dirname, "../../scripts/commands");
    const files = fs.readdirSync(scriptsDir).filter(f => f.endsWith(".js"));
    const commands = files.map(f => {
      try {
        delete require.cache[require.resolve(path.join(scriptsDir, f))];
        const cmd = require(path.join(scriptsDir, f));
        return {
          name: cmd.config ? cmd.config.name : f.replace(".js", ""),
          description: cmd.config ? cmd.config.description : "",
          category: cmd.config ? cmd.config.category : "unknown",
          permission: cmd.config ? cmd.config.permission : 0,
          enabled: cmd.config ? !disabled.includes(cmd.config.name) : true
        };
      } catch (e) {
        return { name: f.replace(".js", ""), enabled: true, error: e.message };
      }
    });
    res.json({ success: true, commands });
  } catch (e) {
    res.json({ success: false, error: e.message });
  }
});

// Toggle command enable/disable
app.post("/api/commands/toggle", (req, res) => {
  try {
    const { name, enabled } = req.body;
    if (!name) return res.json({ success: false, error: "Command name required" });
    delete require.cache[require.resolve(CONFIG_PATH)];
    const config = require(CONFIG_PATH);
    if (!config.disabledcmds) config.disabledcmds = [];
    if (enabled) {
      config.disabledcmds = config.disabledcmds.filter(n => n !== name);
      if (global.config) global.config.disabledcmds = config.disabledcmds;
    } else {
      if (!config.disabledcmds.includes(name)) {
        config.disabledcmds.push(name);
        if (global.config) global.config.disabledcmds.push(name);
      }
    }
    fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2), "utf8");
    res.json({ success: true, message: `Command ${name} ${enabled ? "enabled" : "disabled"}` });
  } catch (e) {
    res.json({ success: false, error: e.message });
  }
});

// Toggle adminOnly mode
app.post("/api/toggle-admin-only", (req, res) => {
  try {
    const mainConfigPath = path.join(__dirname, "../configs/Config.json");
    const mainConfig = fs.readJsonSync(mainConfigPath);
    mainConfig.adminOnly = !mainConfig.adminOnly;
    fs.writeJsonSync(mainConfigPath, mainConfig, { spaces: 2 });
    if (global.ryuko) global.ryuko.adminOnly = mainConfig.adminOnly;
    res.json({ success: true, adminOnly: mainConfig.adminOnly });
  } catch (e) {
    res.json({ success: false, error: e.message });
  }
});

// Restart bot child process
let currentChild = null;
app.post("/api/restart", (req, res) => {
  try {
    if (currentChild) {
      currentChild.kill("SIGTERM");
    }
    res.json({ success: true, message: "Bot restarting..." });
    setTimeout(() => spawnBot(), 1000);
  } catch (e) {
    res.json({ success: false, error: e.message });
  }
});

// === BOT CHILD PROCESS ===
let appListening = false;

function spawnBot() {
  if (currentChild) {
    try { currentChild.kill("SIGTERM"); } catch (e) {}
    currentChild = null;
  }
  
  const child = spawn("node", ["--trace-warnings", "--async-stack-traces", "IMRANB.js"], {
    cwd: __dirname,
    stdio: "inherit",
    shell: true
  });
  
  currentChild = child;

  child.on("close", (codeExit) => {
    currentChild = null;
    if (codeExit !== 0) {
      logger("Bot exited, restarting in 3 seconds...", "warn");
      setTimeout(() => spawnBot(), 3000);
    }
  });

  child.on("error", (error) => {
    logger("an error occurred : " + JSON.stringify(error), "error");
  });
}

function startBot() {
  console.log(chalk.blue("DEPLOYING MAIN SYSTEM"));
  logger.loader(`deploying app on port ${chalk.blueBright(PORT)}`);

  if (!appListening) {
    app.listen(PORT, "0.0.0.0", () => {
      logger.loader(`app deployed on port ${chalk.blueBright(PORT)}`);
    });
    appListening = true;
  }

  spawnBot();
}

startBot();
