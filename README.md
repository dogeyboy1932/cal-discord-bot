# Calendar Discord Bot

A Discord bot that forwards messages and images from Discord channels to a calendar application's receiver endpoint. This bot helps integrate Discord conversations with your calendar system by automatically processing and forwarding relevant content.

## Features

- 🖼️ **Image Processing**: Automatically detects and forwards image attachments (JPEG, PNG, WebP, GIF)
- 📝 **Text Forwarding**: Forwards text messages to the configured receiver endpoint
- 🔒 **Channel Restrictions**: Optional whitelist of allowed channels for bot operation
- 💬 **Direct Message Support**: Works in both guild channels and direct messages
- 🛡️ **Error Handling**: Robust error handling with detailed logging
- 🚀 **TypeScript**: Built with TypeScript for better development experience

## Prerequisites

- Node.js 18.0.0 or higher
- A Discord bot token
- A receiver endpoint URL and token

## Quick Setup

1. **Clone the repository**:
   ```bash
   git clone https://github.com/dogeyboy1932/cal-discord-bot.git
   cd cal-discord-bot
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Configure environment variables**:
   ```bash
   cp .env.example .env
   ```
   
   Edit `.env` with your configuration:
   ```env
   DISCORD_BOT_TOKEN=your_discord_bot_token_here
   RECEIVER_URL=https://your-calendar-app-domain.com/api/receiver/image
   IMAGE_RECEIVER_TOKEN=your_receiver_token_here
   ALLOWED_CHANNELS=  # Optional: comma-separated channel IDs
   ```
   
   **Important**: Replace `https://your-calendar-app-domain.com` with your actual calendar app URL.

4. **Build and run**:
   ```bash
   # Development mode
   npm run dev
   
   # Production build and run
   npm run build
   npm start
   ```

## Discord Bot Setup

1. Go to the [Discord Developer Portal](https://discord.com/developers/applications)
2. Create a new application
3. Go to the "Bot" section
4. Create a bot and copy the token
5. Enable the following bot permissions:
   - Read Messages
   - Send Messages
   - Read Message History
6. Invite the bot to your server with the required permissions

## Configuration

### Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `DISCORD_BOT_TOKEN` | Yes | Your Discord bot token |
| `RECEIVER_URL` | Yes | The endpoint URL to forward messages to |
| `IMAGE_RECEIVER_TOKEN` | Yes | Authentication token for the receiver endpoint |
| `ALLOWED_CHANNELS` | No | Comma-separated list of channel IDs to restrict bot operation |

### Channel Restrictions

- If `ALLOWED_CHANNELS` is empty, the bot will respond to all channels it has access to
- If `ALLOWED_CHANNELS` is set, the bot will only process messages from those specific channels
- Direct messages are always processed regardless of channel restrictions

## API Integration

The bot sends data to your receiver endpoint with the following format:

### Image Upload
- **Method**: POST
- **Content-Type**: multipart/form-data
- **Headers**: `x-receiver-token: YOUR_TOKEN`
- **Body**:
  - `file`: The image file
  - `source`: "discord"
  - `discordMessageId`: Message ID
  - `discordChannelId`: Channel ID
  - `discordAuthorId`: Author ID

### Text Message
- **Method**: POST
- **Content-Type**: multipart/form-data
- **Headers**: `x-receiver-token: YOUR_TOKEN`
- **Body**:
  - `text`: The message content
  - `source`: "discord"
  - `discordMessageId`: Message ID
  - `discordChannelId`: Channel ID
  - `discordAuthorId`: Author ID

## Development

### Scripts

- `npm run dev` - Start in development mode with hot reload
- `npm run build` - Build TypeScript to JavaScript
- `npm start` - Run the built application
- `npm run clean` - Clean the dist directory

### Project Structure

```
src/
├── bot.ts          # Main Discord bot service class
└── index.ts        # Application entry point
```

## Deployment

The bot can be deployed to any Node.js hosting service:

1. **Railway/Heroku**: Use the provided configuration files
2. **VPS/Cloud**: Run with PM2 or similar process manager
3. **Docker**: Build a container with the provided setup

### Production Considerations

- Set `NODE_ENV=production`
- Use a process manager like PM2
- Configure proper logging
- Set up monitoring and health checks

## Railway Deployment

### Quick Deploy to Railway

1. **Connect Repository**:
   - Go to [Railway](https://railway.app)
   - Create a new project
   - Connect this GitHub repository

2. **Set Environment Variables**:
   In Railway dashboard, add these environment variables:
   ```
   DISCORD_BOT_TOKEN=your_discord_bot_token_here
   RECEIVER_URL=https://your-calendar-app-domain.com/api/receiver/image
   IMAGE_RECEIVER_TOKEN=your_receiver_token_here
   ALLOWED_CHANNELS=  # Optional
   ```

3. **Important Configuration**:
   - ⚠️ **RECEIVER_URL**: Must be your deployed calendar app URL, NOT localhost
   - ✅ Railway will automatically detect Node.js and build the project
   - ✅ The bot will start automatically after successful deployment

### Environment Variable Setup

**Critical**: The `RECEIVER_URL` must point to your deployed calendar application, not localhost. Examples:
- ✅ `https://my-calendar-app.railway.app/api/receiver/image`
- ✅ `https://calendar.mydomain.com/api/receiver/image`
- ❌ `http://localhost:3000/api/receiver/image` (will fail in production)

## Troubleshooting

### Common Issues

1. **Bot not responding**:
   - Check if the bot token is correct
   - Verify bot permissions in Discord
   - Check if the bot is online in Discord

2. **Images not forwarding**:
   - Verify the receiver URL is accessible
   - Check the receiver token is correct
   - Ensure the receiver endpoint accepts multipart/form-data

3. **Channel restrictions not working**:
   - Verify channel IDs are correct
   - Check that `ALLOWED_CHANNELS` is properly formatted (comma-separated)

### Logs

The bot provides detailed console logging:
- ✅ Successful operations
- ❌ Errors with details
- 🤖 Bot status updates

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## License

MIT License - see LICENSE file for details

## Support

For issues and questions:
- Open an issue on GitHub
- Check the troubleshooting section
- Review the logs for error details