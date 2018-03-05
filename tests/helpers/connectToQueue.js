const config = require('../../config');

module.exports = async (channel) => {
    await channel.assertExchange('events', 'topic', {durable: false});
    const processorQueue = await channel.assertQueue(`app_${config.rabbit.serviceName}_test.chrono_eth20_processor_queue`)
    await channel.bindQueue(`app_${config.rabbit.serviceName}_test.chrono_eth20_processor_queue`, 'events', `${config.rabbit.serviceName}_chrono_eth20_processor.*`);

    return processorQueue;
};