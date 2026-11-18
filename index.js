const { 
    Client, 
    GatewayIntentBits, 
    EmbedBuilder, 
    PermissionFlagsBits,
    ActivityType,
    ActionRowBuilder,
    StringSelectMenuBuilder,
    ButtonBuilder,
    ButtonStyle,
    ChannelType 
} = require('discord.js');
const fs = require('fs');

let config = JSON.parse(fs.readFileSync('./config.json', 'utf8'));

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
const disabledChannels = new Set();

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

    if (message.content.startsWith(PREFIX + 'ticof')) {
        if (message.guild.id !== config.officialGuildId) {
            return message.reply('عذرا، هذا الأمر يخص السيرفر الرسمي للبوت فقط.');
        }
        if (message.author.id !== config.ownerId) {
            return message.reply('عذرا، هذا الأمر مخصص لمالك البوت فقط.');
        }

        const args = message.content.slice(PREFIX.length + 5).trim().split(/\s+/);
        const role = message.mentions.roles.first();
        const type = args[1] ? args[1].toLowerCase() : '';

        if (!role || (type !== 'ar' && type !== 'en')) {
            return message.reply('الاستخدام الصحيح:\n`!ticof @رتبة_العربي ar`\n`!ticof @رتبة_الانجليزي en`');
        }

        if (type === 'ar') {
            config.arabicRole = role.id;
            fs.writeFileSync('./config.json', JSON.stringify(config, null, 2));
            return message.reply(`تم تحديث رتبة الدعم العربي بنجاح إلى: ${role.name}.`);
        } else if (type === 'en') {
            config.englishRole = role.id;
            fs.writeFileSync('./config.json', JSON.stringify(config, null, 2));
            return message.reply(`تم تحديث رتبة الدعم الإنجليزي بنجاح إلى: ${role.name}.`);
        }
    }

    if (message.content === PREFIX + 'setup-ticket') {
        if (message.guild.id !== config.officialGuildId || message.author.id !== config.ownerId) {
            return message.reply('عذرا، ليس لديك صلاحية لاستخدام هذا الأمر.');
        }

        const embed = new EmbedBuilder()
            .setTitle('مركز الدعم الفني والخدمات')
            .setDescription('يرجى اختيار أحد الخيارات أدناه لفتح تذكرة جديدة وسيقوم فريق المختصين بمساعدتكم في أسرع وقت ممكن.\nPlease select an option below to open a support ticket.')
            .setColor(0x1da1f2)
            .setFooter({ text: `${config.brandName} - جميع الحقوق محفوظة` })
            .setTimestamp();

        const row = new ActionRowBuilder().addComponents(
            new StringSelectMenuBuilder()
                .setCustomId('ticket_select_menu')
                .setPlaceholder('اختر خيارا مناسبا...')
                .addOptions([
                    {
                        label: 'عطل فني او مشاكل',
                        description: 'فتح تذكرة دعم فني باللغة العربية',
                        value: 'create_arabic_ticket'
                    },
                    {
                        label: 'English Support Ticket',
                        description: 'Open a technical support ticket in English',
                        value: 'create_english_ticket'
                    },
                    {
                        label: 'Reset Menu',
                        description: 'إعادة تعيين القائمة أو الخيارات الإضافية',
                        value: 'reset_ticket_menu'
                    }
                ])
        );

        await message.channel.send({ embeds: [embed], components: [row] });
        return message.delete().catch(() => {});
    }

    // أمر إضافة شخص للتذكرة يدويًا عبر المحادثة
    if (message.content.startsWith(PREFIX + 'add')) {
        const member = message.mentions.members.first();
        if (!member) return message.reply('الاستخدام الصحيح: `!add @العضو`');
        
        try {
            await message.channel.permissionOverwrites.edit(member.id, {
                ViewChannel: true,
                SendMessages: true,
                ReadMessageHistory: true
            });
            return message.reply(`تم إضافة العضو ${member} إلى التذكرة بنجاح.`);
        } catch (e) {
            return message.reply('حدث خطأ أثناء محاولة إضافة العضو.');
        }
    }

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

    if (command === 'help' || command === 'هيلب' || command === 'اوامر') {
        const helpEmbed = new EmbedBuilder()
            .setTitle('قائمة أوامر خدمة غرد العامة')
            .setDescription('قائمة الأوامر المتاحة للاستخدام في السيرفرات:')
            .setColor(0x1da1f2)
            .addFields(
                { name: 'أوامر الأعضاء', value: '`!هيلب` - لعرض قائمة الأوامر.\n`!غرد [النص]` - لنشر خاطرة أو منشور في المحادثة.\n`!الاصدار` - لمعرفة إصدار النظام الحالي.' },
                { name: 'أوامر الإدارة والتحكم', value: '`!ايقاف-تغريد` - لإيقاف استقبال التغريدات في الروم الحالي.\n`!تشغيل-تغريد` - لإعادة تفعيل التغريدات في الروم الحالي.\n`!طرد [@العضو] [السبب]` - لطرد عضو مخالف.\n`!بان [@العضو] [السبب]` - لحظر عضو نهائيا.\n`!ميوت [@العضو] [الدقائق] [السبب]` - لتقييد العضو مؤقتا.\n`!مسح [العدد]` - لمسح الرسائل دفعة واحدة.\n`!قفل` - لقفل الروم الحالي.\n`!فتح` - لفتح الروم الحالي.\n`!add [@العضو]` - لإضافة شخص إلى التذكرة.' }
            )
            .setFooter({ text: `Gharred Service - الإصدار ${config.version}` })
            .setTimestamp();

        return message.reply({ embeds: [helpEmbed] });
    }

    if (command === 'version' || command === 'الاصدار') {
        return message.reply(`إصدار النظام الحالي: v${config.version}.`);
    }

    if (command === 'ايقاف-تغريد' || command === 'stoptweet') {
        if (!message.member.permissions.has(PermissionFlagsBits.Administrator)) return message.reply('عذرا، ليس لديك صلاحية.');
        if (disabledChannels.has(message.channel.id)) return message.reply('خدمة التغريد متوقفة مسبقا في هذا الروم.');
        
        disabledChannels.add(message.channel.id);
        return message.reply('تم إيقاف خدمة التغريد في هذا الروم بنجاح.');
    }

    if (command === 'تشغيل-تغريد' || command === 'starttweet') {
        if (!message.member.permissions.has(PermissionFlagsBits.Administrator)) return message.reply('عذرا، ليس لديك صلاحية.');
        if (!disabledChannels.has(message.channel.id)) return message.reply('خدمة التغريد مفعلة أساسا في هذا الروم.');
        
        disabledChannels.delete(message.channel.id);
        return message.reply('تم إعادة تفعيل خدمة التغريد في هذا الروم بنجاح.');
    }

    if (command === 'غرد' || command === 'tweet') {
        if (disabledChannels.has(message.channel.id)) {
            return message.reply('عذرا، خدمة التغريد متوقفة في هذا الروم حاليا من قبل الإدارة.');
        }

        const text = args.join(' ');
        if (!text) return message.reply('يرجى كتابة النص المراد نشره بعد الأمر.');

        await message.delete().catch(() => {});

        const embed = new EmbedBuilder()
            .setAuthor({ name: message.author.tag, iconURL: message.author.displayAvatarURL() })
            .setDescription(text)
            .setColor(0x1da1f2)
            .setFooter({ text: `${config.brandName} - تم النشر بواسطة العضو` })
            .setTimestamp();

        const sentMsg = await message.channel.send({ embeds: [embed] });
        await sentMsg.react('👍').catch(() => {});
        await sentMsg.react('👎').catch(() => {});
        return;
    }

    if (command === 'طرد' || command === 'kick') {
        if (!message.member.permissions.has(PermissionFlagsBits.KickMembers)) return message.reply('عذرا، ليس لديك صلاحية.');
        const member = message.mentions.members.first();
        const reason = args.slice(1).join(' ') || 'بدون سبب';
        if (!member) return message.reply('الاستخدام الصحيح: !طرد @العضو السبب.');

        try {
            await member.kick(reason);
            message.reply(`تم طرد العضو ${member.user.tag} بنجاح.`);
        } catch (e) {
            message.reply('حدث خطأ أثناء تنفيذ الأمر.');
        }
    }

    if (command === 'بان' || command === 'ban') {
        if (!message.member.permissions.has(PermissionFlagsBits.BanMembers)) return message.reply('عذرا، ليس لديك صلاحية.');
        const member = message.mentions.members.first();
        const reason = args.slice(1).join(' ') || 'بدون سبب';
        if (!member) return message.reply('الاستخدام الصحيح: !بان @العضو السبب.');

        try {
            await member.ban({ reason });
            message.reply(`تم حظر العضو ${member.user.tag} نهائيا.`);
        } catch (e) {
            message.reply('حدث خطأ أثناء تنفيذ الأمر.');
        }
    }

    if (command === 'ميوت' || command === 'timeout') {
        if (!message.member.permissions.has(PermissionFlagsBits.ModerateMembers)) return message.reply('عذرا، ليس لديك صلاحية.');
        const member = message.mentions.members.first();
        const duration = parseInt(args[1]) || 5;
        const reason = args.slice(2).join(' ') || 'بدون سبب';
        if (!member) return message.reply('الاستخدام الصحيح: !ميوت @العضو الدقائق السبب.');

        try {
            await member.timeout(duration * 60 * 1000, reason);
            message.reply(`تم تقييد العضو ${member.user.tag} لمدة ${duration} دقائق.`);
        } catch (e) {
            message.reply('حدث خطأ أثناء تنفيذ الأمر.');
        }
    }

    if (command === 'مسح' || command === 'clear') {
        if (!message.member.permissions.has(PermissionFlagsBits.ManageMessages)) return message.reply('عذرا، ليس لديك صلاحية.');
        const count = parseInt(args[0]);
        if (!count || count < 1 || count > 100) return message.reply('الاستخدام الصحيح: !مسح [عدد من 1 إلى 100].');

        try {
            await message.channel.bulkDelete(count, true);
            const msg = await message.channel.send(`تم مسح ${count} رسالة بنجاح.`);
            setTimeout(() => msg.delete().catch(() => {}), 3000);
        } catch (e) {
            message.reply('لا يمكن مسح رسائل أقدم من أسبوعين.');
        }
    }

    if (command === 'قفل' || command === 'lock') {
        if (!message.member.permissions.has(PermissionFlagsBits.ManageChannels)) return message.reply('عذرا، ليس لديك صلاحية.');
        try {
            await message.channel.permissionOverwrites.edit(message.guild.roles.everyone, { SendMessages: false });
            message.reply('تم قفل الروم بنجاح.');
        } catch (e) {
            message.reply('فشل قفل الروم.');
        }
    }

    if (command === 'فتح' || command === 'unlock') {
        if (!message.member.permissions.has(PermissionFlagsBits.ManageChannels)) return message.reply('عذرا، ليس لديك صلاحية.');
        try {
            await message.channel.permissionOverwrites.edit(message.guild.roles.everyone, { SendMessages: null });
            message.reply('تم فتح الروم بنجاح.');
        } catch (e) {
            message.reply('فشل فتح الروم.');
        }
    }
});

client.on('interactionCreate', async (interaction) => {
    // 1. القائمة الأساسية لإنشاء التذكرة
    if (interaction.isStringSelectMenu()) {
        if (interaction.customId === 'ticket_select_menu') {
            const choice = interaction.values[0];

            if (choice === 'reset_ticket_menu') {
                return interaction.reply({ content: 'تم إعادة تعيين القائمة بنجاح.', ephemeral: true });
            }

            const isArabic = choice === 'create_arabic_ticket';
            const ticketName = isArabic ? `ticket-ar-${interaction.user.username}` : `ticket-en-${interaction.user.username}`;
            const targetRoleId = isArabic ? config.arabicRole : config.englishRole;

            const channel = await interaction.guild.channels.create({
                name: ticketName,
                type: ChannelType.GuildText,
                topic: `ticket_owner_${interaction.user.id}`, // حفظ أيدي صاحب التذكرة في الوصف
                permissionOverwrites: [
                    {
                        id: interaction.guild.id,
                        deny: [PermissionFlagsBits.ViewChannel]
                    },
                    {
                        id: interaction.user.id,
                        allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory]
                    },
                    ...(targetRoleId ? [{
                        id: targetRoleId,
                        allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory]
                    }] : [])
                ]
            });

            const welcomeEmbed = new EmbedBuilder()
                .setTitle(isArabic ? 'تذكرة دعم فني جديدة' : 'New Support Ticket')
                .setDescription(isArabic ? 'مرحباً بك، يرجى شرح مشكلتك بالتفصيل وسيقوم فريق الدعم بالرد عليك قريباً.\n\nاستخدم القائمة أدناه للتحكم بخيارات التذكرة.' : 'Welcome, please describe your issue in detail and our support team will assist you shortly.\n\nUse the menu below to control ticket options.')
                .setColor(0x1da1f2)
                .setTimestamp();

            // قائمة التحكم داخل التذكرة
            const controlMenu = new ActionRowBuilder().addComponents(
                new StringSelectMenuBuilder()
                    .setCustomId('ticket_control_menu')
                    .setPlaceholder('اختر عملية لإدارة التذكرة...')
                    .addOptions([
                        {
                            label: 'استلام التكت',
                            description: 'تسجيل استلام التذكرة ومباشرتها رسميا',
                            value: 'claim_ticket'
                        },
                        {
                            label: 'استدعاء فاتح التذكرة',
                            description: 'تنبيه صاحب التذكرة للرد والمتابعة',
                            value: 'call_owner'
                        },
                        {
                            label: 'إضافة شخص للتذكرة',
                            description: 'منح شخص آخر صلاحية دخول التذكرة',
                            value: 'add_member'
                        },
                        {
                            label: 'إغلاق التكت',
                            description: 'إغلاق التذكرة وحذف الغرفة نهائيا',
                            value: 'close_ticket'
                        }
                    ])
            );

            await channel.send({ content: `${interaction.user} ${targetRoleId ? `<@&${targetRoleId}>` : ''}`, embeds: [welcomeEmbed], components: [controlMenu] });
            return interaction.reply({ content: `تم إنشاء تذكرتك بنجاح: ${channel}.`, ephemeral: true });
        }

        // 2. قائمة إدارة والتحكم داخل التذكرة (Menu)
        if (interaction.customId === 'ticket_control_menu') {
            const action = interaction.values[0];
            const member = interaction.member;
            
            const hasPermission = (config.arabicRole && member.roles.cache.has(config.arabicRole)) || 
                                  (config.englishRole && member.roles.cache.has(config.englishRole)) || 
                                  member.permissions.has(PermissionFlagsBits.Administrator);

            // استلام التكت
            if (action === 'claim_ticket') {
                if (!hasPermission) {
                    return interaction.reply({ content: 'عذرا، هذا الخيار مخصص لفريق الدعم المسؤول عن التذاكر فقط.', ephemeral: true });
                }

                const claimEmbed = new EmbedBuilder()
                    .setDescription(`تم استلام هذه التذكرة بواسطة: ${interaction.user}`)
                    .setColor(0x00ff00);

                await interaction.reply({ embeds: [claimEmbed] });
                return;
            }

            // استدعاء فاتح التذكرة
            if (action === 'call_owner') {
                if (!hasPermission) {
                    return interaction.reply({ content: 'عذرا، هذا الخيار مخصص لفريق الدعم فقط.', ephemeral: true });
                }

                const channelTopic = interaction.channel.topic;
                if (!channelTopic || !channelTopic.startsWith('ticket_owner_')) {
                    return interaction.reply({ content: 'عذرا، لم يتم العثور على صاحب هذه التذكرة.', ephemeral: true });
                }

                const ownerId = channelTopic.replace('ticket_owner_', '');
                return interaction.reply({ content: `نرجو التواجد والمتابعة هنا: <@${ownerId}>.` });
            }

            // إضافة شخص للتذكرة
            if (action === 'add_member') {
                if (!hasPermission) {
                    return interaction.reply({ content: 'عذرا، هذا الخيار مخصص لفريق الدعم فقط.', ephemeral: true });
                }

                return interaction.reply({ content: 'لإضافة شخص إلى التذكرة، يرجى كتابة الأمر التالي في المحادثة:\n`!add @العضو`', ephemeral: true });
            }

            // إغلاق التكت
            if (action === 'close_ticket') {
                if (!interaction.member.permissions.has(PermissionFlagsBits.ManageChannels) && !hasPermission) {
                    return interaction.reply({ content: 'عذرا، ليس لديك صلاحية لإغلاق التذكرة.', ephemeral: true });
                }

                await interaction.reply('جاري إغلاق التذكرة وحذف الروم خلال خمس ثوان.');
                setTimeout(() => interaction.channel.delete().catch(() => {}), 5000);
            }
        }
    }
});

const TOKEN = process.env.DISCORD_TOKEN;

if (!TOKEN) {
    console.error('خطأ: لم يتم وضع التوكن في إعدادات الاستضافة.');
    process.exit(1);
}

client.login(TOKEN);
