# SUN2000-PV-modbus
[Link to project's main page](https://github.com/Nordblom72/SolarAndPwrOverview)<br/>

## Description
This MODBUS-TCP service polls two registers on the inverter for power values (total yield and day-yield) and stores them in a MongoDb database. The inverter must be equipped with a dongle for wifi/fe communication. In this case, the Huawei Sdongle-A05 is used for that purpose.<br/>

Furthermore, the MODBUS-TCP must be enabled, which by default is disabled.
[MODBUS TCP Guide](https://www.photovoltaikforum.com/core/attachment/260120-sdonglea-05-modbus-tcp-guide-pdf/)

The service uses two node-scheduler functions for polling and storing the data. Currently, the inverter registers are polled once every minute and the ackumulated data is stored in a MongoDB database every 5:th minute. The database object holds power values with granuality of on hour. The scheduler functions have a simple crone-style API and can easely be reconfigured for other intervals.

## References
* [MODBUS TCP Guide](https://www.photovoltaikforum.com/core/attachment/260120-sdonglea-05-modbus-tcp-guide-pdf/)
* [SUN2000 series MODBUS Interface definition V3 (2019-10-31)](https://www.photovoltaikforum.com/core/attachment/180219-solar-inverter-modbus-interface-definitions-v3-0-pdf/)
* [Python library for connecting to Huawei SUN2000 Inverters over Modbus](https://github.com/wlcrs/huawei-solar-lib)
* [An interesting discussion thread](https://forum.logicmachine.net/showthread.php?tid=3861)

## ToDo
* Increase DbMongo timeout
* Implement proper error handling for database failures
* Implement some kind of critical logging to be stored in MongoDb
* Make it possible to configure schedulers at service startup via environment vars