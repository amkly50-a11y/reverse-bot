const moment = require("moment-timezone");
const axios = require("axios");
const pidusage = require("pidusage");
const { performance } = require("perf_hooks");

moment.tz.setDefault("Asia/Dhaka");

module.exports.config = {
  name: "uptime",
  version: "2.0.0",
  permission: 0,
  credits: "IMRAN",
  description: "Shows bot uptime and status with GIF",
  prefix: true,
  category: "info",
  usages: "",
  cooldowns: 5,
};

// Status GIF URLs
const STATUS_GIFS = [
  "https://i.imgur.com/wGW4KHn.gif",
  "https://media.giphy.com/media/26tn33aiTi1jkl6H6/giphy.gif",
  "https://media.giphy.com/media/l0MYt5jPR6QX5pnqM/giphy.gif",
];

function getStatusGif() {
  return STATUS_GIFS[Math.floor(Math.random() * STATUS_GIFS.length)];
}

module.exports.run = async({ api, event }) => {
  try {
    const timeStart = performance.now();

    let usageInfo = null;
    try {
      usageInfo = await pidusage(process.pid);
    } catch (e) {}

    const currentTime = moment().format("h:mm:ss A");
    const currentDate = moment().format("DD/MM/YYYY");
    const uptimeInSeconds = process.uptime();
    const hours = Math.floor(uptimeInSeconds / 3600);
    const minutes = Math.floor((uptimeInSeconds % 3600) / 60);
    const seconds = Math.floor(uptimeInSeconds % 60);
    const formattedUptime = `${hours}h ${minutes}m ${seconds}s`;
    const timeEnd = performance.now();
    const ping = Math.round(timeEnd - timeStart);

    const memMB = usageInfo
      ? Math.round(usageInfo.memory / 1024 / 1024)
      : Math.round(process.memoryUsage().rss / 1024 / 1024);

    const cpuPercent = usageInfo ? usageInfo.cpu.toFixed(1) : "N/A";

    const bodyText =
      `🤖 𝗕𝗢𝗧 𝗦𝗧𝗔𝗧𝗨𝗦\n` +
      `━━━━━━━━━━━━━━━━\n` +
      `⏳ 𝗨𝗽𝘁𝗶𝗺𝗲  : ${formattedUptime}\n` +
      `📶 𝗣𝗶𝗻𝗴    : ${ping}ms\n` +
      `💾 𝗠𝗲𝗺𝗼𝗿𝘆  : ${memMB} MB\n` +
      `🖥️ 𝗖𝗣𝗨     : ${cpuPercent}%\n` +
      `⏰ 𝗧𝗶𝗺𝗲    : ${currentTime}\n` +
      `📅 𝗗𝗮𝘁𝗲    : ${currentDate}\n` +
      `━━━━━━━━━━━━━━━━\n` +
      `👑 𝗕𝗼𝘁     : ${global.config ? global.config.BOTNAME : "Reverse Bot"}\n` +
      `🔤 𝗣𝗿𝗲𝗳𝗶𝘅  : ${global.config ? global.config.PREFIX : "-"}`;

    // Try to get uptime image from API
    const apiUrl = "https://uptime-imran.onrender.com/up";
    const messagePayload = { body: bodyText };

    try {
      const response = await axios.get(apiUrl, {
        responseType: "stream",
        params: {
          uptime: formattedUptime,
          ping: `${ping}ms`,
          time: currentTime,
          date: currentDate,
          owner: global.config ? global.config.BOTNAME : "Reverse Bot",
        },
        timeout: 6000,
      });
      if (response && response.data) {
        messagePayload.attachment = response.data;
      }
    } catch (err) {
      // Fallback: try GIF
      try {
        const gifRes = await axios.get(getStatusGif(), { responseType: "stream", timeout: 5000 });
        if (gifRes && gifRes.data) messagePayload.attachment = gifRes.data;
      } catch (e2) {}
    }

    return api.sendMessage(messagePayload, event.threadID, event.messageID);
  } catch (error) {
    return api.sendMessage("❌ Failed to get bot status.\nError: " + error.message, event.threadID, event.messageID);
  }
};
