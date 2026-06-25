const axios = require("axios");

module.exports.config = {
  name: "help",
  version: "2.0.0",
  permission: 0,
  credits: "IMRAN",
  description: "Bot command guide with image",
  prefix: true,
  premium: false,
  category: "guide",
  usages: "[page] or [command name]",
  cooldowns: 5,
};

module.exports.languages = {
  en: {
    moduleInfo:
      `⚡ 𝗖𝗢𝗠𝗠𝗔𝗡𝗗 𝗜𝗡𝗙𝗢 ⚡\n` +
      `━━━━━━━━━━━━━━━━━━\n` +
      `🗡️ 𝗡𝗮𝗺𝗲 » %1\n` +
      `📝 𝗗𝗲𝘀𝗰 » %2\n` +
      `🧩 𝗨𝘀𝗮𝗴𝗲 » ${global.config ? global.config.PREFIX : '-'}%3\n` +
      `📦 𝗖𝗮𝘁𝗲𝗴𝗼𝗿𝘆 » %4\n` +
      `⏱️ 𝗖𝗼𝗼𝗹𝗱𝗼𝘄𝗻 » %5s\n` +
      `🔒 𝗣𝗲𝗿𝗺𝗶𝘀𝘀𝗶𝗼𝗻 » %6\n` +
      `✨ 𝗖𝗿𝗲𝗱𝗶𝘁𝘀 » %7`,
    user: "👤 User",
    adminGroup: "👑 Group Admin",
    adminBot: "🤖 Bot Admin",
  },
};

// GIF URLs for help command
const HELP_GIFS = [
  "https://i.imgur.com/XmNEVDv.gif",
  "https://media.giphy.com/media/l4FGGafcOHmrlQxG0/giphy.gif",
  "https://media.giphy.com/media/3o7TKO3AC2o5aSyM1i/giphy.gif",
];

function getHelpGif() {
  return HELP_GIFS[Math.floor(Math.random() * HELP_GIFS.length)];
}

async function fetchGifStream(url) {
  try {
    const res = await axios.get(url, { responseType: "stream", timeout: 6000 });
    return res.data;
  } catch (e) {
    return null;
  }
}

module.exports.run = async function({ api, event, args, getText }) {
  const { commands } = global.client;
  const { threadID, messageID } = event;
  const PREFIX = global.config.PREFIX;

  // Single command info
  if (args[0] && isNaN(args[0])) {
    const command = commands.get(args[0].toLowerCase());
    if (command) {
      const permLabel =
        command.config.permission === 0 ? getText("user")
        : command.config.permission === 1 ? getText("adminGroup")
        : getText("adminBot");

      const info =
        `⚡ 𝗖𝗢𝗠𝗠𝗔𝗡𝗗 𝗜𝗡𝗙𝗢 ⚡\n` +
        `━━━━━━━━━━━━━━━━━━\n` +
        `🗡️ 𝗡𝗮𝗺𝗲 » ${command.config.name}\n` +
        `📝 𝗗𝗲𝘀𝗰 » ${command.config.description || "N/A"}\n` +
        `🧩 𝗨𝘀𝗮𝗴𝗲 » ${PREFIX}${command.config.name} ${command.config.usages || ""}\n` +
        `📦 𝗖𝗮𝘁𝗲𝗴𝗼𝗿𝘆 » ${command.config.category || "N/A"}\n` +
        `⏱️ 𝗖𝗼𝗼𝗹𝗱𝗼𝘄𝗻 » ${command.config.cooldowns || 1}s\n` +
        `🔒 𝗣𝗲𝗿𝗺𝗶𝘀𝘀𝗶𝗼𝗻 » ${permLabel}\n` +
        `✨ 𝗖𝗿𝗲𝗱𝗶𝘁𝘀 » ${command.config.credits || "N/A"}`;

      const gifStream = await fetchGifStream(getHelpGif());
      const msg = gifStream
        ? { body: info, attachment: gifStream }
        : { body: info };

      return api.sendMessage(msg, threadID, messageID);
    }
  }

  // Full command list with page
  const commandList = Array.from(commands.values());
  const categories = [...new Set(commandList.map(cmd => cmd.config.category ? cmd.config.category.toLowerCase() : "other"))];
  const itemsPerPage = 6;
  const totalPages = Math.ceil(categories.length / itemsPerPage);
  let currentPage = parseInt(args[0]) || 1;
  if (currentPage < 1) currentPage = 1;
  if (currentPage > totalPages) currentPage = totalPages;

  const startIdx = (currentPage - 1) * itemsPerPage;
  const endIdx = Math.min(startIdx + itemsPerPage, categories.length);
  const visibleCategories = categories.slice(startIdx, endIdx);

  let msg = `\n🤖 𝗥 𝗘 𝗩 𝗘 𝗥 𝗦 𝗘   𝗕 𝗢 𝗧   𝗖 𝗢 𝗠 𝗠 𝗔 𝗡 𝗗 𝗦\n`;
  msg += `✧･ﾟ: *✧･ﾟ:* ༻ ༺ *:･ﾟ✧*:･ﾟ✧\n\n`;

  for (const category of visibleCategories) {
    const categoryName = category.charAt(0).toUpperCase() + category.slice(1);
    const cmds = commandList
      .filter(cmd => (cmd.config.category || "other").toLowerCase() === category)
      .map(cmd => cmd.config.name);
    msg += `⦿ ━━━━『 ${categoryName} 』━━━━ ⦿\n`;
    msg += `│  ${cmds.join(", ")}\n`;
    msg += `✧･ﾟ: *✧･ﾟ:* *:･ﾟ✧*:･ﾟ✧\n\n`;
  }

  msg += `📄 Page ${currentPage}/${totalPages}\n`;
  msg += `🔰 Type ${PREFIX}help [command] for info\n`;
  msg += `📊 Total: ${commands.size} commands | ${categories.length} categories`;

  const gifStream = await fetchGifStream(getHelpGif());
  const payload = gifStream
    ? { body: msg, attachment: gifStream }
    : { body: msg };

  return api.sendMessage(payload, threadID, messageID);
};
