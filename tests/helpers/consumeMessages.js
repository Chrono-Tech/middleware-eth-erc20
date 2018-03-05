const config = require('../../config');
module.exports = async(maxCount = 1, channel, parseMessage) => {
    return new Promise(res  => {
        let messageCount = 1;
        channel.consume(`app_${config.rabbit.serviceName}_test.chrono_eth20_processor_queue`, async (message) => {
            await parseMessage(message);

            if (messageCount === maxCount) {
                await channel.cancel(message.fields.consumerTag);
                res();
            } else {
                messageCount++;
            }
        }, {noAck: true});
  });
}
