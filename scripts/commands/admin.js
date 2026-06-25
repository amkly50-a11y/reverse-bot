module.exports.config = {
  name: "admin",
  version: "2.1.0",
  permission: 0,
  credits: "IMRAN",
  description: "Control admin lists",
  prefix: true,
  premium: false,
  category: "admin",
  usages: "admin [add/remove/list] [uid or @mention]",
  cooldowns: 5,
};

module.exports.languages = {
  "en": {
    "listAdmin": "📋 Admin list:\n\n%1",
    "notHavePermssion": "❌ You don't have permission to use \"%1\"",
    "addedNewAdmin": "✅ Added %1 admin(s):\n\n%2",
    "removedAdmin": "✅ Removed %1 admin(s):\n\n%2"
  }
};

module.exports.run = async function({ api, event, args, Users, permssion, getText }) {
  const content = args.slice(1);
  const { threadID, messageID, mentions } = event;
  const { configPath } = global.client;
  const { ADMINBOT, OWNER, OPERATOR } = global.config;
  const { writeFileSync } = global.nodemodule["fs-extra"];
  const mention = Object.keys(mentions);
  
  delete require.cache[require.resolve(configPath)];
  var config = require(configPath);

  // Allow OWNER (4), OPERATOR (3), or ADMINBOT (2) to manage admins
  // list is open to all
  const canManage = permssion >= 2;

  switch (args[0]) {
    case "list":
    case "all":
    case "-a": {
      const listAdmin = config.ADMINBOT || [];
      var msg = [];
      for (const idAdmin of listAdmin) {
        if (parseInt(idAdmin)) {
          try {
            const name = await Users.getNameUser(idAdmin);
            msg.push(`• ${name} (${idAdmin})`);
          } catch (e) {
            msg.push(`• UID: ${idAdmin}`);
          }
        }
      }
      return api.sendMessage(`👑 Bot Admins:\n${msg.length > 0 ? msg.join('\n') : 'No admins found.'}`, threadID, messageID);
    }

    case "add": {
      if (!canManage) return api.sendMessage(getText("notHavePermssion", "add"), threadID, messageID);

      if (mention.length > 0 && isNaN(content[0])) {
        var listAdd = [];
        for (const id of mention) {
          if (!ADMINBOT.includes(id)) {
            ADMINBOT.push(id);
            config.ADMINBOT.push(id);
          }
          listAdd.push(`${event.mentions[id] || id} (${id})`);
        }
        writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf8');
        return api.sendMessage(getText("addedNewAdmin", mention.length, listAdd.join("\n").replace(/\@/g, "")), threadID, messageID);
      } else if (content.length > 0 && !isNaN(content[0])) {
        const uid = String(content[0]);
        if (!ADMINBOT.includes(uid)) {
          ADMINBOT.push(uid);
          config.ADMINBOT.push(uid);
        }
        let name = uid;
        try { name = await Users.getNameUser(uid); } catch (e) {}
        writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf8');
        return api.sendMessage(getText("addedNewAdmin", 1, `${name} (${uid})`), threadID, messageID);
      } else {
        return api.sendMessage(`❌ Usage: ${global.config.PREFIX}admin add [UID or @mention]`, threadID, messageID);
      }
    }

    case "remove":
    case "rm":
    case "delete": {
      if (!canManage) return api.sendMessage(getText("notHavePermssion", "remove"), threadID, messageID);

      if (mention.length > 0) {
        const mentions2 = Object.keys(event.mentions);
        var listRemoved = [];
        for (const id of mentions2) {
          const idx = config.ADMINBOT.findIndex(item => item == id);
          if (idx !== -1) {
            ADMINBOT.splice(idx, 1);
            config.ADMINBOT.splice(idx, 1);
            listRemoved.push(`${event.mentions[id] || id} (${id})`);
          }
        }
        writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf8');
        return api.sendMessage(getText("removedAdmin", listRemoved.length, listRemoved.join("\n").replace(/\@/g, "")), threadID, messageID);
      } else if (content.length > 0 && !isNaN(content[0])) {
        const uid = String(content[0]);
        const idx = config.ADMINBOT.findIndex(item => item.toString() == uid);
        if (idx !== -1) {
          ADMINBOT.splice(idx, 1);
          config.ADMINBOT.splice(idx, 1);
        }
        let name = uid;
        try { name = await Users.getNameUser(uid); } catch (e) {}
        writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf8');
        return api.sendMessage(getText("removedAdmin", 1, `${name} (${uid})`), threadID, messageID);
      } else {
        return api.sendMessage(`❌ Usage: ${global.config.PREFIX}admin remove [UID or @mention]`, threadID, messageID);
      }
    }

    default: {
      return api.sendMessage(
        `👑 Admin Commands:\n` +
        `• ${global.config.PREFIX}admin list - Show all admins\n` +
        `• ${global.config.PREFIX}admin add [UID/@mention] - Add admin\n` +
        `• ${global.config.PREFIX}admin remove [UID/@mention] - Remove admin`,
        threadID, messageID
      );
    }
  }
};
