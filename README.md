# middleware-eth-erc20 [![Build Status](https://travis-ci.org/ChronoBank/middleware-eth-erc20.svg?branch=master)](https://travis-ci.org/ChronoBank/middleware-eth-erc20)

Middleware service for handling ERC20 token smart contracts

### Installation

This module is a part of middleware services. You can install it in 2 ways:

1) Through core middleware installer  [middleware installer](https://github.com/ChronoBank/middleware)
2) By hands: just clone the repo, do 'npm install', set your .env - and you are ready to go

#### About
This module is used for processing events, emitted on chronobank ERC20 smart contracts, and handling balance update of certain address, who subscribed to this token (see a description of token routes in [rest](https://github.com/ChronoBank/middleware-eth-rest)).

#### How does it work

This how does it work:
1) This module load a sample contract (TokenContract) and use signatures for ERC20 token events;
2) Blockprocessor populate Ethtransactions collection with matched transactions by tx.to, tx.from, addresses from logs and EthAccounts.erc20token collection;
3) Erc20Processor listen to RabbitMQ "eth_transaction.\*" routing keys and filter out those txs which corresponds to the ERC20 tokens by signature in logs.topics[0];
4) Module extracts event's data from matched transactions and save it to DB (Transfers, Approvals collections for ERC20).
5) Moreover ERC20Processor push balance update to the RabbitMQ under the following route  <RABBIT_SERVICE_NAME>_chrono_eth20_processor.<event_name>,  and to DB (EthAccounts.erc20token collection).

##### сonfigure your .env

To apply your configuration, create a .env file in root folder of repo (in case it's not present already).
Below is the expamle configuration:

```
MONGO_ACCOUNTS_URI=mongodb://localhost:27017/data
MONGO_ACCOUNTS_COLLECTION_PREFIX=eth
RABBIT_URI=amqp://localhost:5672
RABBIT_SERVICE_NAME=app_eth
NETWORK=development
WEB3_URI=/tmp/development/geth.ipc
```

The options are presented below:

| name | description|
| ------ | ------ |
| MONGO_URI   | the URI string for mongo connection
| MONGO_COLLECTION_PREFIX   | the default prefix for all mongo collections. The default value is 'eth'
| MONGO_ACCOUNTS_URI   | the URI string for mongo connection, which holds users accounts (if not specified, then default MONGO_URI connection will be used)
| MONGO_ACCOUNTS_COLLECTION_PREFIX   | the collection prefix for accounts collection in mongo (If not specified, then the default MONGO_COLLECTION_PREFIX will be used)
| RABBIT_URI   | rabbitmq URI connection string
| RABBIT_SERVICE_NAME   | namespace for all rabbitmq queues, like 'app_eth_transaction'
| NETWORK   | network name (alias)- is used for connecting via ipc (see block processor section)
| WEB3_URI   | the path to ipc interface

License
----
 [GNU AGPLv3](LICENSE)

Copyright
----
LaborX PTY