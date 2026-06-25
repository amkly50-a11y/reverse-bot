module.exports = function({ api, models, Users, Threads, Currencies }) {
  const stringSimilarity = require('string-similarity'),
    escapeRegex = (str) => str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"),
    logger = require("../../catalogs/IMRANC.js");
  const axios = require('axios');
  const moment = require("moment-timezone");

  // Deduplication: prevent same message from triggering twice
  const processedMessages = new Map();

  return async function({ event }) {
    const dateNow = Date.now();
    const time = moment.tz("Asia/Dhaka").format("HH:MM:ss DD/MM/YYYY");
    const { allowInbox, adminOnly, keyAdminOnly } = global.ryuko;
    const { PREFIX, ADMINBOT, OWNER, developermode, OPERATOR, approval, disabledcmds } = global.config;
    const { APPROVED } = global.approved;
    const { userBanned, threadBanned, threadInfo, threadData, commandBanned } = global.data;
    const { commands, cooldowns } = global.client;
    var { body, senderID, threadID, messageID } = event;
    senderID = String(senderID);
    threadID = String(threadID);

    // --- DEDUPLICATION: skip if already processed this messageID ---
    if (messageID && processedMessages.has(messageID)) return;
    if (messageID) {
      processedMessages.set(messageID, dateNow);
      // Clean old entries (older than 5 seconds)
      if (processedMessages.size > 500) {
        for (const [k, v] of processedMessages) {
          if (dateNow - v > 5000) processedMessages.delete(k);
        }
      }
    }

    // Only handle messages that start with PREFIX
    if (!body || typeof body !== 'string' || !body.startsWith(PREFIX)) return;

    const threadSetting = threadData.get(threadID) || {};
    const args = (body || '').trim().split(/ +/);
    const commandName = args.shift()?.toLowerCase();
    var command = commands.get(commandName.slice(PREFIX.length));
    const send = global.send;

    // Check disabled commands
    if (command && disabledcmds && disabledcmds.includes(command.config.name)) {
      return api.sendMessage(`❌ The command "${command.config.name}" is currently disabled.`, threadID, messageID);
    }

    const replyAD = '🔒 Admin only mode is active. Only bot admins can use the bot.';
    const notApproved = `❌ This group is not approved.\nUse "${PREFIX}request" to send an approval request to bot operators.`;

    // --- APPROVAL SYSTEM ---
    if (body.startsWith(`${PREFIX}request`) && approval) {
      if (APPROVED.includes(threadID)) {
        return api.sendMessage('✅ This group is already approved.', threadID, messageID);
      }
      try {
        var groupname = global.data.threadInfo.get(threadID)?.threadName || "Unknown Group";
        var request = `${groupname} is requesting approval`;
        send('box approval request', request + '\n\nGroup: ' + groupname + '\nID: ' + threadID);
        api.sendMessage('✅ Your request has been sent to bot operators.', threadID, messageID);
      } catch (error) {
        logger.err(error);
      }
      return;
    }

    // Check approval
    if (!APPROVED.includes(threadID) && !OPERATOR.includes(senderID) && !OWNER.includes(senderID) && !ADMINBOT.includes(senderID) && approval) {
      return api.sendMessage(notApproved, threadID, async (err, info) => {
        await new Promise(resolve => setTimeout(resolve, 5 * 1000));
        if (info) return api.unsendMessage(info.messageID);
      });
    }

    // --- ADMIN ONLY MODE ---
    // If adminOnly is ON, ONLY admins (ADMINBOT, OPERATOR, OWNER, and group self) can use bot
    if (adminOnly && !ADMINBOT.includes(senderID) && !OPERATOR.includes(senderID) && !OWNER.includes(senderID) && senderID !== api.getCurrentUserID()) {
      // Silently ignore (don't even reply to non-admins in admin-only mode)
      return;
    }

    // --- BANNED USERS / THREADS ---
    if (!ADMINBOT.includes(senderID) && !OWNER.includes(senderID) && !OPERATOR.includes(senderID)) {
      if (userBanned.has(senderID)) {
        const { reason, dateAdded } = userBanned.get(senderID) || {};
        return api.sendMessage(`🚫 You are banned from using the bot.\nReason: ${reason}\nDate: ${dateAdded}`, threadID, async (err, info) => {
          await new Promise(resolve => setTimeout(resolve, 5 * 1000));
          if (info) return api.unsendMessage(info.messageID);
        }, messageID);
      }
      if (threadBanned.has(threadID)) {
        const { reason, dateAdded } = threadBanned.get(threadID) || {};
        return api.sendMessage(global.getText("handleCommand", "threadBanned", reason, dateAdded), threadID, async (err, info) => {
          await new Promise(resolve => setTimeout(resolve, 5 * 1000));
          if (info) return api.unsendMessage(info.messageID);
        }, messageID);
      }
      if (allowInbox === false && senderID === threadID) return;
    }

    // --- FIND COMMAND ---
    const nameWithoutPrefix = commandName.startsWith(PREFIX) ? commandName.slice(PREFIX.length) : commandName;
    if (!command) {
      command = commands.get(nameWithoutPrefix);
    }

    if (!command) {
      // Try fuzzy match
      const allCommandName = Array.from(commands.keys());
      if (allCommandName.length > 0) {
        const checker = stringSimilarity.findBestMatch(nameWithoutPrefix, allCommandName);
        if (checker.bestMatch.rating >= 0.5) {
          command = commands.get(checker.bestMatch.target);
        } else {
          return api.sendMessage(global.getText("handleCommand", "commandNotExist", checker.bestMatch.target), threadID, messageID);
        }
      }
    }

    if (!command) return;

    // --- COMMAND BANNED ---
    if (commandBanned.get(threadID) || commandBanned.get(senderID)) {
      if (!ADMINBOT.includes(senderID) && !OPERATOR.includes(senderID)) {
        const banThreads = commandBanned.get(threadID) || [];
        const banUsers = commandBanned.get(senderID) || [];
        if (banThreads.includes(command.config.name))
          return api.sendMessage(global.getText("handleCommand", "commandThreadBanned", command.config.name), threadID, async (err, info) => {
            await new Promise(resolve => setTimeout(resolve, 5 * 1000));
            if (info) return api.unsendMessage(info.messageID);
          }, messageID);
        if (banUsers.includes(command.config.name))
          return api.sendMessage(global.getText("handleCommand", "commandUserBanned", command.config.name), threadID, async (err, info) => {
            await new Promise(resolve => setTimeout(resolve, 5 * 1000));
            if (info) return api.unsendMessage(info.messageID);
          }, messageID);
      }
    }

    // --- PREMIUM ---
    const premium = global.config.premium;
    const premiumlists = global.premium.PREMIUMUSERS;
    if (premium && command.config && command.config.premium && !premiumlists.includes(senderID)) {
      return api.sendMessage(`⭐ This command is for premium users only.\nContact the bot admins or type ${PREFIX}requestpremium.`, event.threadID, async (err, eventt) => {
        if (err) return;
        await new Promise(resolve => setTimeout(resolve, 5 * 1000));
        if (eventt) return api.unsendMessage(eventt.messageID);
      }, event.messageID);
    }

    // --- PREFIX CHECK ---
    if (command.config && command.config.prefix === false && nameWithoutPrefix.toLowerCase() !== command.config.name.toLowerCase()) {
      api.sendMessage(global.getText("handleCommand", "notMatched", command.config.name), event.threadID, event.messageID);
      return;
    }
    if (command.config && command.config.prefix === true && !body.startsWith(PREFIX)) return;
    if (command.config && typeof command.config.prefix === 'undefined') {
      api.sendMessage(global.getText("handleCommand", "noPrefix", command.config.name), event.threadID, event.messageID);
      return;
    }

    // --- NSFW ---
    if (command.config && command.config.category && command.config.category.toLowerCase() === 'nsfw' && !global.data.threadAllowNSFW.includes(threadID) && !ADMINBOT.includes(senderID))
      return api.sendMessage(global.getText("handleCommand", "threadNotAllowNSFW"), threadID, async (err, info) => {
        await new Promise(resolve => setTimeout(resolve, 5 * 1000));
        if (info) return api.unsendMessage(info.messageID);
      }, messageID);

    // --- PERMISSION ---
    var permssion = 0;
    try {
      var threadInfoo = (threadInfo.get(threadID) || await Threads.getInfo(threadID));
      const Find = threadInfoo && threadInfoo.adminIDs ? threadInfoo.adminIDs.find(el => el.id == senderID) : null;
      if (OWNER.includes(senderID.toString())) permssion = 4;
      else if (OPERATOR.includes(senderID.toString())) permssion = 3;
      else if (ADMINBOT.includes(senderID.toString())) permssion = 2;
      else if (Find) permssion = 1;
    } catch (e) {
      // permission stays 0
    }

    if (command.config && command.config.permission && command.config.permission > permssion) {
      return api.sendMessage(global.getText("handleCommand", "permissionNotEnough", command.config.name), event.threadID, event.messageID);
    }

    // --- COOLDOWN ---
    if (!client.cooldowns.has(command.config.name)) {
      client.cooldowns.set(command.config.name, new Map());
    }
    const timestamps = client.cooldowns.get(command.config.name);
    const expirationTime = (command.config.cooldowns || 1) * 1000;
    if (timestamps.has(senderID) && dateNow < timestamps.get(senderID) + expirationTime) {
      return api.setMessageReaction('🕚', event.messageID, err => {}, true);
    }

    // --- LANGUAGE ---
    var getText2;
    if (command.languages && typeof command.languages === 'object' && command.languages.hasOwnProperty(global.config.language)) {
      getText2 = (...values) => {
        var lang = command.languages[global.config.language][values[0]] || '';
        for (var i = values.length; i > 1; i--) {
          const expReg = RegExp('%' + i, 'g');
          lang = lang.replace(expReg, values[i]);
        }
        return lang;
      };
    } else getText2 = () => '';

    // --- RUN ---
    try {
      const Obj = {
        api, event, args, models, Users, Threads, Currencies,
        permssion, getText: getText2
      };
      if (command && typeof command.run === 'function') {
        command.run(Obj);
        timestamps.set(senderID, dateNow);
        if (developermode) {
          logger(global.getText("handleCommand", "executeCommand", time, command.config.name, senderID, threadID, args.join(" "), (Date.now()) - dateNow) + '\n', "command");
        }
        return;
      }
    } catch (e) {
      return api.sendMessage(global.getText("handleCommand", "commandError", command.config.name, e), threadID);
    }
  };
};
