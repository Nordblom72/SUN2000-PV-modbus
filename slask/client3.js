const modbus = require("modbus-stream");
const EventEmitter=require('events');
var eventEmitter=new EventEmitter();

eventEmitter.addListener('error', ev_1)

function ev_1 (event){
  console.log("GOT EVENT ", event);
}

function readclient(ip) {
  //modbus.tcp.connect(502, "192.168.1.212", { debug: "automaton-2454", slaveId:1 }, (err, connection) => {
  modbus.tcp.connect(502, "192.168.1.212", {  debug: "automaton-2454" }, (err, connection) => {
    // do something with connection
    if (err) throw err;
    connection.transport.slaveId = 0;
    //connection.readCoils({ address: 30000, quantity: 15, extra: { unitId: 25 } }, (err, res) => {
    /*connection.readCoils({ address: 32087, quantity: 1 }, (err, res) => {
      if (err) throw err;
      console.log(res); // response
    })*/

    /*connection.readInputRegisters({ address: 32087, quantity: 1 }, (err, res) => {
      if (err) throw err;
      console.log(res.response.data); // response
    })*/
    
    connection.readHoldingRegisters({ address: 0, quantity: 1 }, (err, res) => {
      if (err) throw err;
      console.log(res.response.data); // response
    })
  });
}

function readclient2(ip) {
  modbus.tcp.connect(502, "192.168.1.212", { unitId: 1, debug: "client" }, (err, connection) => {
    if (err) throw err;
    console.log("Connected...")
    
    
    //connection.transport.unitId = 0;
    connection.readHoldingRegisters({ address: 32106,quantity: 2, retry: 5000, retries: 3 }, (err, res) => {
      if (err) throw err;
      console.log("response", res);
      console.log(res); 
      console.log(res.response.data);
      console.log(res.pdu);
      });
  });
}

readclient2();

