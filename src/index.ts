import discordBotService from './bot.js';

async function main() {
  console.log('🚀 Starting Discord Bot for Calendar Integration...');
  
  try {
    await discordBotService.start();
    console.log('✅ Discord Bot is running and ready to receive messages');
    console.log('📝 Bot will forward images and text to the configured receiver endpoint');
  } catch (error) {
    console.error('❌ Failed to start Discord Bot:', error);
    process.exit(1);
  }

  // Graceful shutdown handling
  process.on('SIGINT', async () => {
    console.log('\n🛑 Received SIGINT, shutting down gracefully...');
    await discordBotService.stop();
    process.exit(0);
  });

  process.on('SIGTERM', async () => {
    console.log('\n🛑 Received SIGTERM, shutting down gracefully...');
    await discordBotService.stop();
    process.exit(0);
  });
}

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
  process.exit(1);
});

main().catch(console.error);