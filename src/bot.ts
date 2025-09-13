import { Client, GatewayIntentBits, Partials, Events, Message } from 'discord.js';
import fetch from 'node-fetch';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// TypeScript interfaces for API responses
interface RegistrationResponse {
  success: boolean;
  error?: string;
  message?: string;
  user?: {
    discordId: string;
    email: string;
    username?: string;
    registeredAt: Date;
  };
}

interface StatusResponse {
  success: boolean;
  error?: string;
  registered: boolean;
  user?: {
    discordId: string;
    email: string;
    username?: string;
    registeredAt: Date;
  };
}

class DiscordBotService {
  private client: Client | null = null;
  private isRunning = false;

  private get config() {
    return {
      BOT_TOKEN: process.env.DISCORD_BOT_TOKEN,
      RECEIVER_URL: process.env.RECEIVER_URL || 'http://localhost:3000/api/receiver/image',
      RECEIVER_TOKEN: process.env.IMAGE_RECEIVER_TOKEN || '',
      ALLOWED_CHANNELS: (process.env.ALLOWED_CHANNELS || '')
        .split(',')
        .map(s => s.trim())
        .filter(Boolean)
    };
  }

  private validateConfig() {
    const { BOT_TOKEN, RECEIVER_TOKEN, RECEIVER_URL } = this.config;
    
    if (!BOT_TOKEN) {
      throw new Error('Missing DISCORD_BOT_TOKEN in environment variables');
    }
    if (!RECEIVER_TOKEN) {
      throw new Error('Missing IMAGE_RECEIVER_TOKEN in environment variables');
    }
    if (!RECEIVER_URL) {
      throw new Error('Missing RECEIVER_URL in environment variables');
    }
  }

  async start() {
    if (this.isRunning) {
      console.log('Discord bot is already running');
      return;
    }

    try {
      this.validateConfig();
      
      this.client = new Client({
        intents: [
          GatewayIntentBits.Guilds,
          GatewayIntentBits.GuildMessages,
          GatewayIntentBits.DirectMessages,
          GatewayIntentBits.MessageContent,
        ],
        partials: [Partials.Channel, Partials.Message]
      });

      this.setupEventHandlers();
      
      await this.client.login(this.config.BOT_TOKEN);
      this.isRunning = true;
      console.log('🤖 Discord bot service started successfully');
    } catch (error) {
      console.error('Failed to start Discord bot:', error);
      throw error;
    }
  }

  async stop() {
    if (!this.isRunning || !this.client) {
      return;
    }

    try {
      await this.client.destroy();
      this.client = null;
      this.isRunning = false;
      console.log('🤖 Discord bot service stopped');
    } catch (error) {
      console.error('Error stopping Discord bot:', error);
    }
  }

  private setupEventHandlers() {
    if (!this.client) return;

    this.client.once(Events.ClientReady, (c) => {
      console.log(`🤖 Logged in as ${c.user.tag}`);
    });

    this.client.on(Events.MessageCreate, async (message) => {
      await this.handleMessage(message);
    });
  }

  private async forwardAttachment(message: Message, attachmentUrl: string, originalName?: string): Promise<boolean> {
    try {
      const { RECEIVER_URL, RECEIVER_TOKEN } = this.config;
      
      console.log('🔄 [DISCORD] Starting attachment forward process');
      console.log('🔄 [DISCORD] Attachment URL:', attachmentUrl);
      console.log('🔄 [DISCORD] Original name:', originalName);
      console.log('🔄 [DISCORD] Receiver URL:', RECEIVER_URL);
      console.log('🔄 [DISCORD] Token length:', RECEIVER_TOKEN?.length || 0);
      
      // Get user's registered email
      const userEmail = await this.getUserEmail(message.author.id);
      if (!userEmail) {
        console.log('❌ [DISCORD] User not registered, sending registration prompt');
        await message.reply(`❌ **You need to register first!**\n\nTo link your Discord account with your email, use:\n\`!register your.email@example.com\`\n\nAfter registration, you can upload images and they will be saved to your calendar account.`);
        return false;
      }
      
      console.log('✅ [DISCORD] User registered with email:', userEmail);
      
      // Fetch the attachment bytes
      console.log('📥 [DISCORD] Fetching attachment from Discord...');
      const res = await fetch(attachmentUrl);
      if (!res.ok) {
        console.error('❌ [DISCORD] Failed to fetch attachment:', res.status, res.statusText);
        throw new Error(`Failed to fetch attachment: ${res.status} ${res.statusText}`);
      }
      const contentType = res.headers.get('content-type') || 'application/octet-stream';
      const buffer = Buffer.from(await res.arrayBuffer());
      console.log('📥 [DISCORD] Attachment fetched successfully, size:', buffer.length, 'bytes, type:', contentType);

      // Build multipart using FormData compatible with node-fetch@3
      console.log('📦 [DISCORD] Building FormData...');
      const formData = new FormData();
      const blob = new Blob([buffer], { type: contentType });
      formData.set('file', blob, originalName || 'image');
      formData.set('source', 'discord');
      formData.set('discordMessageId', message.id);
      formData.set('discordChannelId', message.channelId);
      formData.set('discordAuthorId', message.author.id);
      formData.set('userEmail', userEmail);
      console.log('📦 [DISCORD] FormData built with keys:', Array.from(formData.keys()));
      console.log('📦 [DISCORD] User email included:', userEmail);

      console.log('🚀 [DISCORD] Sending POST request to receiver...');
      const upload = await fetch(RECEIVER_URL, {
        method: 'POST',
        headers: {
          'x-receiver-token': RECEIVER_TOKEN,
        },
        body: formData as any,
      });

      console.log('📡 [DISCORD] Received response, status:', upload.status, upload.statusText);
      console.log('📡 [DISCORD] Response headers:', Object.fromEntries(upload.headers.entries()));
      
      const json = await upload.json();
      console.log('📡 [DISCORD] Response body:', JSON.stringify(json, null, 2));
      
      if (!upload.ok || !json) {
        console.error('❌ [DISCORD] Receiver responded with error', upload.status, json);
        return false;
      }

      console.log('✅ [DISCORD] Successfully forwarded image:', json ? 'SUCCESS' : 'FAILED');
      return true;
    } catch (err) {
      console.error('❌ [DISCORD] Error forwarding attachment:', err);
      console.error('❌ [DISCORD] Error stack:', err instanceof Error ? err.stack : 'No stack trace');
      return false;
    }
  }

  private async forwardText(message: Message): Promise<boolean> {
    try {
      const { RECEIVER_URL, RECEIVER_TOKEN } = this.config;
      const content = (message.content || '').trim();
      if (!content) {
        console.log('⚠️ [DISCORD] No text content to forward');
        return false;
      }

      console.log('📝 [DISCORD] Forwarding text message, length:', content.length);
      console.log('📝 [DISCORD] Text preview:', content.substring(0, 100) + (content.length > 100 ? '...' : ''));

      const formData = new FormData();
      formData.set('text', content);
      formData.set('source', 'discord');
      formData.set('discordMessageId', message.id);
      formData.set('discordChannelId', message.channelId);
      formData.set('discordAuthorId', message.author.id);

      console.log('🚀 [DISCORD] Sending text POST request to receiver...');
      const res = await fetch(RECEIVER_URL, {
        method: 'POST',
        headers: {
          'x-receiver-token': RECEIVER_TOKEN,
        },
        body: formData as any,
      });

      console.log('📡 [DISCORD] Text response status:', res.status, res.statusText);
      const json = await res.json();
      console.log('📡 [DISCORD] Text response body:', JSON.stringify(json, null, 2));
      
      if (!res.ok || !json) {
        console.error('❌ [DISCORD] Receiver responded with error for text', res.status, json);
        return false;
      }
      console.log('✅ [DISCORD] Successfully forwarded text:', json ? 'SUCCESS' : 'FAILED');
      return true;
    } catch (err) {
      console.error('❌ [DISCORD] Error forwarding text:', err);
      console.error('❌ [DISCORD] Text error stack:', err instanceof Error ? err.stack : 'No stack trace');
      return false;
    }
  }

  private async handleMessage(message: Message) {
    try {
      console.log('💬 [DISCORD] Received message from:', message.author.tag, 'in channel:', message.channelId);
      console.log('💬 [DISCORD] Message ID:', message.id, 'Guild ID:', message.guildId || 'DM');
      
      if (message.author.bot) {
        console.log('🤖 [DISCORD] Ignoring bot message');
        return;
      }

      // Handle registration command
      if (message.content.startsWith('!register ')) {
        await this.handleRegistrationCommand(message);
        return;
      }

      // Handle status check command
      if (message.content === '!status' || message.content === '!whoami') {
        await this.handleStatusCommand(message);
        return;
      }

      const { ALLOWED_CHANNELS } = this.config;
      
      // In guild channels, optionally restrict by ALLOWED_CHANNELS; always allow DMs
      if (message.guildId && ALLOWED_CHANNELS.length > 0 && !ALLOWED_CHANNELS.includes(message.channelId)) {
        console.log('🚫 [DISCORD] Channel not in whitelist, ignoring message');
        return; // ignore channels not whitelisted
      }

      // If message has attachments, forward the first image-type attachment
      const attachments = Array.from(message.attachments.values());
      console.log('📎 [DISCORD] Message has', attachments.length, 'attachments');
      
      if (attachments.length > 0) {
        for (const att of attachments) {
          console.log('📎 [DISCORD] Processing attachment:', att.name, 'type:', att.contentType, 'size:', att.size);
          const lower = (att.contentType || '').toLowerCase();
          if (lower.includes('image/jpeg') || lower.includes('image/png') || lower.includes('image/webp') || lower.includes('image/gif')) {
            console.log('🖼️ [DISCORD] Found image attachment, forwarding...');
            const ok = await this.forwardAttachment(message, att.url, att.name || undefined);
            // Acknowledge in DMs so users get feedback
            if (!message.guildId) {
              if (ok) {
                console.log('✅ [DISCORD] Sending success reply to DM');
                await message.reply('Got it! I received your image and started processing.');
              } else {
                console.log('❌ [DISCORD] Sending error reply to DM');
                await message.reply('Sorry, I could not process that image. Please try again.');
              }
            }
          } else {
            console.log('⚠️ [DISCORD] Attachment is not a supported image type');
          }
        }
        return;
      }

      // No attachments; if there's text content, forward it
      if (message.content && message.content.trim().length > 0) {
        console.log('📝 [DISCORD] Message has text content, forwarding...');
        await this.forwardText(message);
        // We intentionally do not reply to text to avoid noise; logging happens on the server
        return;
      }
      
      console.log('⚠️ [DISCORD] Message has no processable content');
    } catch (err) {
      console.error('❌ [DISCORD] Message handler error:', err);
      console.error('❌ [DISCORD] Handler error stack:', err instanceof Error ? err.stack : 'No stack trace');
    }
  }

  private async handleRegistrationCommand(message: Message) {
    try {
      const content = message.content.trim();
      const emailMatch = content.match(/^!register\s+([^\s]+@[^\s]+\.[^\s]+)$/i);
      
      if (!emailMatch) {
        await message.reply('❌ Invalid format. Use: `!register your.email@example.com`');
        return;
      }

      const email = emailMatch[1].toLowerCase();
      const discordId = message.author.id;
      const username = message.author.username;
      const discriminator = message.author.discriminator;

      console.log(`📝 [DISCORD-REG] Registration attempt: ${discordId} -> ${email}`);

      // Call the registration API
      const { RECEIVER_URL } = this.config;
      const registrationUrl = RECEIVER_URL.replace('/api/receiver/image', '/api/discord/register');
      
      const response = await fetch(registrationUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          discordId,
          email,
          username,
          discriminator
        })
      });

      const result = await response.json() as RegistrationResponse;

      if (response.ok && result.success) {
        console.log(`✅ [DISCORD-REG] Registration successful for ${discordId}`);
        await message.reply(`✅ Successfully registered! Your Discord account is now linked to **${email}**. You can now upload images and they will be saved to your calendar account.`);
      } else {
        console.error(`❌ [DISCORD-REG] Registration failed:`, result.error);
        await message.reply(`❌ Registration failed: ${result.error || 'Unknown error'}`);
      }
    } catch (error) {
      console.error('❌ [DISCORD-REG] Registration command error:', error);
      await message.reply('❌ Registration failed due to a technical error. Please try again later.');
    }
  }

  private async handleStatusCommand(message: Message) {
    try {
      const discordId = message.author.id;
      console.log(`🔍 [DISCORD-STATUS] Status check for ${discordId}`);

      // Call the registration check API
      const { RECEIVER_URL } = this.config;
      const statusUrl = RECEIVER_URL.replace('/api/receiver/image', '/api/discord/register') + `?discordId=${discordId}`;
      
      const response = await fetch(statusUrl);
      const result = await response.json() as StatusResponse;

      if (response.ok && result.success && result.registered) {
        const user = result.user;
        await message.reply(`✅ **Registration Status: ACTIVE**\n📧 Email: **${user?.email}**\n📅 Registered: ${user?.registeredAt ? new Date(user.registeredAt).toLocaleDateString() : 'Unknown'}`);
      } else {
        await message.reply(`❌ **Registration Status: NOT REGISTERED**\n\nTo register your Discord account with your email, use:\n\`!register your.email@example.com\``);
      }
    } catch (error) {
      console.error('❌ [DISCORD-STATUS] Status command error:', error);
      await message.reply('❌ Unable to check registration status. Please try again later.');
    }
  }

  private async getUserEmail(discordId: string): Promise<string | null> {
    try {
      const { RECEIVER_URL } = this.config;
      const statusUrl = RECEIVER_URL.replace('/api/receiver/image', '/api/discord/register') + `?discordId=${discordId}`;
      
      const response = await fetch(statusUrl);
      const result = await response.json() as StatusResponse;

      if (response.ok && result.success && result.registered && result.user?.email) {
        return result.user.email;
      }
      return null;
    } catch (error) {
      console.error('❌ [DISCORD] Error getting user email:', error);
      return null;
    }
  }
}

// Export singleton instance
const discordBotService = new DiscordBotService();
export default discordBotService;