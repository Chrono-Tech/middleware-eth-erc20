const config = require('../../config');

module.exports = async (amqpInstance) => {
    const channel = await amqpInstance.createChannel();
    await channel.assertQueue(`app_${config.rabbit.serviceName}_test.chrono_eth20_processor_queue`);
    await channel.purgeQueue(`app_${config.rabbit.serviceName}_test.chrono_eth20_processor_queue`);
    await channel.unbindQueue(`app_${config.rabbit.serviceName}_test.chrono_eth20_processor_queue`, 'events', `${config.rabbit.serviceName}_chrono_eth20_processor.*`);
    
};