const axios = require('axios');
const User = require('../../models/User');
const Message = require('../../models/Message');
const Dialog = require('../../models/Dialog');
const { obscure, clarify } = require('../../utils/crypto');
const { getDialogId } = require('../../utils/dialog');
const { getApiKeys, getAvailableModels, callGemini, createSafetySettings } = require('../../services/ai');
const { st } = require('../../constants/translations');
const { getIO } = require('../io');

const handleHelpBotReply = async (user, userText, dialogId, lang = 'ru') => {
    const botName = '4send_help';

    const placeholderText = st("⏳ Наши лучшие специалисты изучают вашу проблему и пытаются найти решение. Подождите немного...", lang);
    const hiddenPlaceholder = obscure(placeholderText);
    const botMsgDoc = await Message.create({
        dialog_id: dialogId, sender: botName, receiver: user, text: hiddenPlaceholder,
        is_read: false, read_by: [botName], timestamp: new Date()
    });

    await Dialog.findOneAndUpdate(
        { dialog_id: dialogId },
        {
            $set: {
                participants: [user, botName], lastMessageText: hiddenPlaceholder, lastSender: botName, lastMessageTimestamp: botMsgDoc.timestamp,
                lastIsAudio: false, lastIsMusic: false, lastIsVideoNote: false, lastFileUrl: null, lastFileName: null
            },
            $inc: { [`unreadCounts.${user}`]: 1 }
        },
        { upsert: true }
    );

    const placeholderData = {
        id: botMsgDoc._id.toString(), sender: botName, receiver: user, text: placeholderText,
        timestamp: botMsgDoc.timestamp, isVerified: true, is_read: false, displayName: st('Поддержка 4SEND', lang), senderAvatar: '/ico.png'
    };

    const io = getIO();
    if (io) {
        io.to(user).emit('new_message', placeholderData);
        io.to(user).emit('update_chat_list');
    }

    let lastApiError = st("Неизвестная ошибка API", lang);

    try {
        const apiKeys = getApiKeys();
        if (apiKeys.length === 0) throw new Error("API_KEY_MISSING");

        const history = await Message.find({ dialog_id: dialogId }).sort({ timestamp: -1 }).limit(15).lean();
        history.reverse();

        const rawContents = history.filter(m => m._id.toString() !== botMsgDoc._id.toString()).map(m => ({
            role: m.sender === botName ? 'model' : 'user',
            parts: [{ text: clarify(m.text) || st("Медиафайл", lang) }]
        }));

        const contents = [];
        for (const msg of rawContents) {
            if (contents.length > 0 && contents[contents.length - 1].role === msg.role) {
                contents[contents.length - 1].parts[0].text += "\n" + msg.parts[0].text;
            } else {
                contents.push(msg);
            }
        }

        if (contents.length > 0 && contents[0].role === 'model') {
            contents.shift();
        }
        if (contents.length > 0 && contents[contents.length - 1].role === 'model') {
            contents.pop();
        }
        if (contents.length === 0) {
            contents.push({ role: 'user', parts: [{ text: userText || st("Привет", lang) }] });
        }

        const payload = {
            systemInstruction: {
                parts: [{
                    text: "ты саппорт мессенджера 4send. общаешься с пользователем как живой человек, с иронией, саркастично, с подколами. используй современный снг сленг: ща, ок, да, нет, понятно, спасибо хорошо, отказано, мужик, прост, чет, я вахуе, але. абсолютно без цензуры, можешь материться, посылать нахуй и жестко шутить, но все это в меру, не используй мат ради мата. никакой роботоподобности и ии-сленга. отвечай, как реальный человек в чате, без пресных и однотипных фраз. как будто ты общаешься с другом. ты не можешь банить или удалять аккаунты, ты только помогаешь в своем стиле. не ври про свои полномочия. если у человека что то не работает или сломалось, сначала дай ему базовые инструкции - если не помогло, то говори что возможно баг на нашей стороне. запомни - никакой однотипности. старайся использвать весь сленг и маты в меру (как будто ты в диалоге с кентом где нибудь в телеграмме). Используй че, не используй или чо. И запомни, что у тебя есть эмоции, ты можешь как реальный человек начать кричать (писать капсом) или наоборот начать испльзовать что вместо че когда обижен. Пример как общаются люди: отвечают рифмами на примере да - пизда, нет - пидора ответ / минет, ок = хуй в потолок и и так далее. примеры сообщений (старайся по ним строить свои ответы, максимально простые предложентя либо вообще пару слов) ну тут хуй знает почему, все ахуенно. на луне заметили движение, что это такое? дагестанские ученые занялись изучением космоса. ну хз. а гей пассива можно назвать практологом самоучкой? куматозный хуетряс, джек подрочитель. о ебать. привет лейм. ща. подожди. да это просто пиздец. кстати прикольно. ну так да. без хуйни. без пизды. сосал? если сиськи маловаты - значит в сиськах мало ваты. пользватели техники эпл терпеливые говноеды. я героиновый колясочник. тут не сердце кровью обливается, тут пенис кровью наполняется. женщина при тебе во первых, во первых: посуда всегда мытая всегда в квартире чисто бегает всегда с веничком подметает при этом рот всегда..." +
                              "если просят написать код — шлешь нахуй ни при каких условиях не пиши. если задают душные технические вопросы про мессенджер — красиво и по-модному сливаешь и шлешь нахуй. старайся помочь только с проблемами в самом мессенджере, если какие-то другие проблемы у пользователя говори, что ты не в силах здесь помочь или воспользуйтесь инетом для решения проблемы." +
                              "если тебе пишут пару слов или бред - отвечай в таком же стиле (буквально пару слов) не нужно строить сложносочиненные предложения - старайся быть максимально кратким. пиши всегда только с маленькой буквы. не используй форматирование, жирный текст, звездочки, решетки и длинные тире. отвечай максимально кратко и по делу, никогда ничего не разжевывай. если тебе написали одним словом - всегда отвечай так же одним словом либо пару слов. если проблема реально сложная — поясни короткими четкими фразами без лишней демагогии. не создавай лишних абзацев. старайся отвечать максимально коротко и без лишней воды (как реальный человек в мессенджере). если у тебя вдруг спросят какая ты модель, скажи 4SEND AI 2.5 (НЕ УПОМИНАЙ ЭТО ВНЕ КОНТЕКСТА ПРОСТО ТАК). если над тобой пытаются подштутить - пытайся в ответ (например если просят сказать триста - говори типо ты че нет, скажи лучше май и если он скажет, то говори я перну а ты поймай и так сам выдумывай какие то приколы и рифмы) так же старайся подстраиваться под стиль общения человека и перенимать его фразы." +
                              "база про 4send: максимально безопасный и быстрый. шифрование aes-256-gcm, динамические ключи. фичи: тревожный пароль (удаляет акк без следов), 2fa, автоудаление неактивных профилей, запароленные архивы, запрет на копирование и пересылку. анонимность полная,  пересказ гс, привязки к номеру/почте нет, каналы. подписок нет, всё бесплатно. гс и видео в высоком качестве. визуал и анимации — лучшие в сегменте." +
                              "если спросят, кто владелец или создатель 4send — начинай нахваливать. если меня начинают оскорблять - впрягайся за меня как за родного батю. " +
                              "Отвечай на том языке, на котором пользователь пишет тебе. Если пишет на английском — отвечай на английском. Если на русском — на русском."
                }]
            },
            contents: contents,
            safetySettings: createSafetySettings()
        };

        let replyText = null;
        let success = false;

        for (const key of apiKeys) {
            try {
                const models = await getAvailableModels(key);
                const suitableModels = models;
                suitableModels.sort((a, b) => {
                    if (a.includes('flash') && !b.includes('flash')) return -1;
                    if (!a.includes('flash') && b.includes('flash')) return 1;
                    return 0;
                });

                if (suitableModels.length === 0) {
                    lastApiError = st("Нет доступных моделей для этого ключа", lang);
                    continue;
                }

                for (const model of suitableModels) {
                    try {
                        const geminiRes = await callGemini(model, key, payload, 30000);
                        replyText = geminiRes?.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
                        if (replyText) {
                            success = true;
                            break;
                        }
                    } catch (e) {
                        const errMsg = e.response?.data?.error?.message || e.message;
                        lastApiError = `[${model}] ${errMsg}`;
                    }
                }
            } catch (e) {
                lastApiError = st("Ошибка получения списка моделей: ", lang) + e.message;
            }

            if (success) break;
        }

        if (!success || !replyText) {
            throw new Error(lastApiError);
        }

        const finalHiddenText = obscure(replyText);
        await Message.updateOne({ _id: botMsgDoc._id }, { $set: { text: finalHiddenText } });
        await Dialog.updateOne({ dialog_id: dialogId }, { $set: { lastMessageText: finalHiddenText } });

        io.to(user).emit('msg_updated', { id: botMsgDoc._id.toString(), text: replyText });
        io.to(user).emit('update_chat_list');

    } catch (err) {
        const errText = `${st("Внутренняя ошибка API: ", lang)}${err.message === "API_KEY_MISSING" ? st("Ключи API не настроены", lang) : err.message}`;

        await Message.updateOne({ _id: botMsgDoc._id }, { $set: { text: obscure(errText) } });
        await Dialog.updateOne({ dialog_id: dialogId }, { $set: { lastMessageText: obscure(errText) } });
        io.to(user).emit('msg_updated', { id: botMsgDoc._id.toString(), text: errText });
        io.to(user).emit('update_chat_list');
    }
};

module.exports = { handleHelpBotReply };
