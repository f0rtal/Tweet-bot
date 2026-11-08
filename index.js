const { 
    Client, 
    GatewayIntentBits, 
    EmbedBuilder, 
    PermissionFlagsBits,
    ActivityType 
} = require('discord.js');
const fs = require('fs');

const config = JSON.parse(fs.readFileSync('./config.json', 'utf8'));

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers
    ]
});

const PREFIX = config.prefix;
const cooldowns = new Map();
const disabledChannels = new Set(); // لتخزين الأروم الموقوف فيها التغريد مؤقتاً

client.once('ready', () => {
    console.log(`تم تشغيل البوت بنجاح باسم: ${client.user.tag}`);
    
    const updatePresence = () => {
        const guildCount = client.guilds.cache.size;
        client.user.setActivity(`Gharred Service | ${guildCount} Servers`, { type: ActivityType.Watching });
    };
    
    updatePresence();
    setInterval(updatePresence, 60000);
});

client.on('guildCreate', () => {
    const guildCount = client.guilds.cache.size;
    client.user.setActivity(`Gharred Service | ${guildCount} Servers`, { type: ActivityType.Watching });
});

client.on('guildDelete', () => {
    const guildCount = client.guilds.cache.size;
    client.user.setActivity(`Gharred Service | ${guildCount} Servers`, { type: ActivityType.Watching });
});

client.on('messageCreate', async (message) => {
    if (message.author.bot || !message.guild) return;

    if (!message.member.permissions.has(PermissionFlagsBits.Administrator)) {
        const now = Date.now();
        const cooldownTime = 2500;
        if (cooldowns.has(message.author.id)) {
            const expirationTime = cooldowns.get(message.author.id) + cooldownTime;
            if (now < expirationTime) {
                return message.delete().catch(() => {});
            }
        }
        cooldowns.set(message.author.id, now);
        setTimeout(() => cooldowns.delete(message.author.id), cooldownTime);
    }

    if (!message.content.startsWith(PREFIX)) return;

    const args = message.content.slice(PREFIX.length).trim().split(/\s+/);
    const command = args.shift().toLowerCase();

    // 1. أمر المساعدة (هيلب) في مقدمة الأوامر
    if (command === 'help' || command === 'هيلب' || command === 'اوامر') {
        const helpEmbed = new EmbedBuilder()
            .setTitle(`أوامر خدمة غرد العامة`)
            .setDescription('قائمة الأوامر المتاحة للاستخدام في سيرفرك:')
            .setColor(0x1da1f2)
            .addFields(
                { name: 'أوامر الأعضاء', value: '`!هيلب` - لعرض قائمة الأوامر\n`!غرد [النص]` - لنشر تغريدة أو خاطرة في الشات\n`!الاصدار` - لمعرفة إصدار البوت' },
                { name: 'أوامر الإدارة والتحكم', value: '`!ايقاف-تغريد` - لإيقاف استقبال التغريدات في هذا الروم\n`!تشغيل-تغريد` - لإعادة تفعيل التغريدات في هذا الروم\n`!طرد [@العضو] [السبب]` - لطرد عضو\n`!بان [@العضو] [السبب]` - لحظر عضو\n`!ميوت [@العضو] [الدقائق] [السبب]` - لإعطاء ميوت مؤقت\n`!مسح [العدد]` - لمسح الرسائل (1-100)\n`!قفل` - لقفل الروم الحالي\n`!فتح` - لفتح الروم الحالي' }
            )
            .setFooter({ text: `Gharred Service • الإصدار ${config.version}` })
            .setTimestamp();

        return message.reply({ embeds: [helpEmbed] });
    }

    // 2. أمر الإصدار
    if (command === 'version' || command === 'الاصدار') {
        return message.reply(`إصدار النظام الحالي: v${config.version}`);
    }

    // 3. أمر إيقاف التغريد في الروم الحالي
    if (command === 'ايقاف-تغريد' || command === 'stoptweet') {
        if (!message.member.permissions.has(PermissionFlagsBits.Administrator)) return message.reply('ليس لديك صلاحية');
        if (disabledChannels.has(message.channel.id)) return message.reply('التغريد متوقف مسبقاً في هذا الروم.');
        
        disabledChannels.add(message.channel.id);
        return message.reply('تم إيقاف خدمة التغريد في هذا الروم بنجاح.');
    }

    // 4. أمر تشغيل التغريد في الروم الحالي
    if (command === 'تشغيل-تغريد' || command === 'starttweet') {
        if (!message.member.permissions.has(PermissionFlagsBits.Administrator)) return message.reply('ليس لديك صلاحية');
        if (!disabledChannels.has(message.channel.id)) return message.reply('التغريد مَفعل أساساً في هذا الروم.');
        
        disabledChannels.delete(message.channel.id);
        return message.reply('تم إعادة تشغيل وتفعيل خدمة التغريد في هذا الروم بنجاح.');
    }

    // 5. نظام التغريد العام (مع التحقق إذا كان الروم موقوفاً)
    if (command === 'غرد' || command === 'tweet') {
        if (disabledChannels.has(message.channel.id)) {
            return message.reply('عذراً، خدمة التغريد متوقفة في هذا الروم حالياً من قبل الإدارة.');
        }

        const text = args.join(' ');
        if (!text) return message.reply('اكتب النص بعد الأمر');

        await message.delete().catch(() => {});

        const embed = new EmbedBuilder()
            .setAuthor({ name: message.author.tag, iconURL: message.author.displayAvatarURL() })
            .setDescription(text)
            .setColor(0x1da1f2)
            .setFooter({ text: `${config.brandName} • نشر بواسطة العضو` })
            .setTimestamp();

        const sentMsg = await message.channel.send({ embeds: [embed] });
        await sentMsg.react('👍').catch(() => {});
        await sentMsg.react('👎').catch(() => {});
        await sentMsg.react('⁉️').catch(() => {});
        return;
    }

    // 6. أوامر الإدارة
    if (command === 'طرد' || command === 'kick') {
        if (!message.member.permissions.has(PermissionFlagsBits.KickMembers)) return message.reply('ليس لديك صلاحية');
        const member = message.mentions.members.first();
        const reason = args.slice(1).join(' ') || 'بدون سبب';
        if (!member) return message.reply('الاستخدام: !طرد @العضو السبب');

        try {
            await member.kick(reason);
            message.reply(`تم طرد العضو ${member.user.tag}`);
        } catch (e) {
            message.reply('حدث خطأ أثناء تنفيذ الأمر');
        }
    }

    if (command === 'بان' || command === 'ban') {
        if (!message.member.permissions.has(PermissionFlagsBits.BanMembers)) return message.reply('ليس لديك صلاحية');
        const member = message.mentions.members.first();
        const reason = args.slice(1).join(' ') || 'بدون سبب';
        if (!member) return message.reply('الاستخدام: !بان @العضو السبب');

        try {
            await member.ban({ reason });
            message.reply(`تم حظر العضو ${member.user.tag}`);
        } catch (e) {
            message.reply('حدث خطأ أثناء تنفيذ الأمر');
        }
    }

    if (command === 'ميوت' || command === 'timeout') {
        if (!message.member.permissions.has(PermissionFlagsBits.ModerateMembers)) return message.reply('ليس لديك صلاحية');
        const member = message.mentions.members.first();
        const duration = parseInt(args[1]) || 5;
        const reason = args.slice(2).join(' ') || 'بدون سبب';
        if (!member) return message.reply('الاستخدام: !ميوت @العضو الدقائق السبب');

        try {
            await member.timeout(duration * 60 * 1000, reason);
            message.reply(`تم تقييد العضو ${member.user.tag} لمدة ${duration} دقائق`);
        } catch (e) {
            message.reply('حدث خطأ أثناء تنفيذ الأمر');
        }
    }

    if (command === 'مسح' || command === 'clear') {
        if (!message.member.permissions.has(PermissionFlagsBits.ManageMessages)) return message.reply('ليس لديك صلاحية');
        const count = parseInt(args[0]);
        if (!count || count < 1 || count > 100) return message.reply('الاستخدام: !مسح العدد من 1 الى 100');

        try {
            await message.channel.bulkDelete(count, true);
            const msg = await message.channel.send(`تم مسح ${count} رسالة`);
            setTimeout(() => msg.delete().catch(() => {}), 3000);
        } catch (e) {
            message.reply('لا يمكن مسح رسائل أقدم من أسبوعين');
        }
    }

    if (command === 'قفل' || command === 'lock') {
        if (!message.member.permissions.has(PermissionFlagsBits.ManageChannels)) return message.reply('ليس لديك صلاحية');
        try {
            await message.channel.permissionOverwrites.edit(message.guild.roles.everyone, { SendMessages: false });
            message.reply('تم قفل الروم');
        } catch (e) {
            message.reply('فشل قفل الروم');
        }
    }

    if (command === 'فتح' || command === 'unlock') {
        if (!message.member.permissions.has(PermissionFlagsBits.ManageChannels)) return message.reply('ليس لديك صلاحية');
        try {
            await message.channel.permissionOverwrites.edit(message.guild.roles.everyone, { SendMessages: null });
            message.reply('تم فتح الروم');
        } catch (e) {
            message.reply('فشل فتح الروم');
        }
    }
});

const TOKEN = process.env.DISCORD_TOKEN;

if (!TOKEN) {
    console.error('خطأ: لم يتم وضع التوكن في إعدادات الاستضافة');
    process.exit(1);
}

client.login(TOKEN);
