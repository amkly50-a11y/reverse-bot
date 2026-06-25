module.exports = function({ api, models, Users, Threads, Currencies }) {
    const logger = require("../../catalogs/IMRANC.js");
    return function({ event }) {
        const { allowInbox } = global.ryuko;
        const { userBanned, threadBanned } = global.data;
        const { commands, eventRegistered } = global.client;
        const { PREFIX, ADMINBOT, OWNER, OPERATOR } = global.config;
        const { adminOnly } = global.ryuko;
        var { senderID, threadID, body } = event;
        senderID = String(senderID);
        threadID = String(threadID);

        // Skip messages that start with PREFIX — handled by handleCommand
        if (body && typeof body === 'string' && body.startsWith(PREFIX)) return;

        // Skip banned users/threads
        if (userBanned.has(senderID) || threadBanned.has(threadID)) return;
        if (allowInbox === false && senderID === threadID) return;

        // Admin-only mode: only admins can trigger event handlers too
        if (adminOnly && !ADMINBOT.includes(senderID) && !OPERATOR.includes(senderID) && !OWNER.includes(senderID) && senderID !== api.getCurrentUserID()) {
            return;
        }

        for (const eventReg of eventRegistered) {
            const cmd = commands.get(eventReg);
            if (!cmd || !cmd.handleEvent) continue;

            var getText2;
            if (cmd.languages && typeof cmd.languages === 'object') {
                getText2 = (...values) => {
                    const commandModule = cmd.languages || {};
                    if (!commandModule.hasOwnProperty(global.config.language)) return '';
                    var lang = cmd.languages[global.config.language][values[0]] || '';
                    for (var i = values.length; i > 1; i--) {
                        const expReg = RegExp('%' + i, 'g');
                        lang = lang.replace(expReg, values[i]);
                    }
                    return lang;
                };
            } else getText2 = () => '';

            try {
                const Obj = {
                    event, api, models, Users, Threads, Currencies,
                    getText: getText2
                };
                cmd.handleEvent(Obj);
            } catch (error) {
                logger(global.getText('handleCommandEvent', 'moduleError', cmd.config.name), 'error');
            }
        }
    };
};
