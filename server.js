const ModbusRTU   = require ("modbus-serial");
const schedule    = require ('node-schedule');
const { convertFromUtcToLocalDate, monthsAsTextList, numDaysInMonth } = require ('./src/helper');
const { dbHandler, createDbDayObject, createDbMonthObj } = require ('./src/db');

const networkErrors = ["ESOCKETTIMEDOUT", "ETIMEDOUT", "ECONNRESET", "ECONNREFUSED", "EHOSTUNREACH"];

// create an empty modbus client
const client = new ModbusRTU();

let mbsStatus   = "Initializing...";    // holds a status of Modbus

// Modbus 'state' constants
const MBS_STATE_INIT          = "State init";
const MBS_STATE_IDLE          = "State idle";
const MBS_STATE_NEXT          = "State next";
const MBS_STATE_GOOD_READ     = "State good (read)";
const MBS_STATE_FAIL_READ     = "State fail (read)";
const MBS_STATE_GOOD_CONNECT  = "State good (port)";
const MBS_STATE_FAIL_CONNECT  = "State fail (port)";

// Modbus TCP configuration values
const mbsId       = 1;
const mbsPort     = `${process.env.MBS_PORT}`;;
const mbsHost     = `${process.env.MBS_HOST}`;
const mbsScan     = 2000;
const mbsTimeout  = 5000;
let mbsState      = MBS_STATE_INIT;

// Meas data containers
let total_acc_pwr = 0;
let total_dayly_pwr = 0;
let current_hourly_acc_pwr  = {
  startVal:  0.0,
  accHrVal:  0.0,
  currentHr: 0,
  date: null,
  startValIsFromMin0: false
};
let dbHrCache = {
  sendMeToDb: false,
  accHrValue: 0,
  date: null,
  hour: null,
  isComplete: false
}

console.log("Server started: ", convertFromUtcToLocalDate(new Date()));

// schedule poll and update DB tasks
const poll_job     = schedule.scheduleJob('* * * * *', function() {  // Every minute
  console.log('Scheduled task: Poll registers!'); 
  runModbus();
});
const updateDb_job = schedule.scheduleJob('*/5 * * * *', function() { // Every 5th minute
  console.log()
  console.log('Scheduled task: Update DB!');
  // Defer for a short while incase there are any pending poll jobs
  setTimeout(updateDb, 10000); // 10 seconds
});

const connectClient = function()
{
  // set requests parameters
  client.setID      (mbsId);
  client.setTimeout (mbsTimeout);

  // try to connect
  client.connectTCP (mbsHost, { port: mbsPort })
  .then(function() {
    mbsState  = MBS_STATE_GOOD_CONNECT;
    mbsStatus = "Connected, wait for reading...";
    console.log(mbsStatus);
  })
  .catch(function(e) {
    mbsState  = MBS_STATE_FAIL_CONNECT;
    mbsStatus = e.message;
    console.log(e);
  });
  /*.catch(function(e) {
    if (e.errno) {
      if(networkErrors.includes(e.errno)) {
        console.log("Need to reconnect...");
      }
    }
    console.log(e.message);
  });*/
};

const readModbusData = async function()
{
  // try to read data
  await get_daily_yield_energy();
  setTimeout(get_accumulated_yield_energy, 500);
};

const get_daily_yield_energy = async function () {
  console.log("GET DAILY")
  client.readHoldingRegisters (32114, 2)
  .then(function(data) {
    mbsState   = MBS_STATE_GOOD_READ;
    mbsStatus  = "success";
    handle_daily_data(data.buffer.readInt32BE(0)/100);
  })
  .catch(function(e){
    mbsState  = MBS_STATE_FAIL_READ;
    mbsStatus = e.message;
    console.log(e);
  });
  return;
}

const get_accumulated_yield_energy = async function () {
  console.log("GET TOTAL")
  client.readHoldingRegisters (32106, 2)
  .then(function(data) {
    mbsState   = MBS_STATE_GOOD_READ;
    mbsStatus  = "success";
    total_acc_pwr = parseFloat(data.buffer.readInt32BE(0)/100);
  })
  .catch(function(e){
    mbsState  = MBS_STATE_FAIL_READ;
    mbsStatus = e.message;
    console.log(e);
  });
  return;
}

const handle_daily_data = function (value) {
  let date = convertFromUtcToLocalDate(new Date());
  let hour, minute, rest;
  [hour, minute, ...rest] = date.toISOString().split('T')[1].split(':');

  total_dayly_pwr = value;
  console.log("DAILY: ", total_dayly_pwr);
  console.log("   minute: ", minute);
  console.log
  if (current_hourly_acc_pwr.startVal === 0) {
    current_hourly_acc_pwr.startVal  = value;
    if (minute == 0) {
      current_hourly_acc_pwr.startValIsFromMin0 = true
    }
  } else {
    current_hourly_acc_pwr.accHrVal = value - current_hourly_acc_pwr.startVal;
  }

  if (minute != 0) {
    current_hourly_acc_pwr.currentHr = hour;
    current_hourly_acc_pwr.date = date;
  } else { // minute = 0: Hour completed/starting
    // Copy to cache object that will be sent to DB
    dbHrCache.accHrValue = value - current_hourly_acc_pwr.startVal;
    dbHrCache.hour       = current_hourly_acc_pwr.currentHr;
    dbHrCache.date       = current_hourly_acc_pwr.date;
    dbHrCache.isComplete = current_hourly_acc_pwr.startValIsFromMin0;
    dbHrCache.sendMeToDb = true;
    current_hourly_acc_pwr.accHrVal = 0;
    current_hourly_acc_pwr.startVal = hour == 0 ? 0:value //Day wrap and no sun at midnight. Clear startVal
    current_hourly_acc_pwr.startValIsFromMin0 = true;
  }
}

const updateYearlyYieldInDb = async (dateStr, totalPwrValue) => {
  const newCacheData = { type: 'totalPwr', 'lastUpdate': dateStr, totalPwr: totalPwrValue };
  let cache = await dbHandler('get', { type: 'totalPwr' })
  .then(function(value) {
    return value;
  });
  if (cache !== null) {
    let setQuery = { identifier: { _id: cache._id }, data: { $set: newCacheData } };
    await dbHandler('update', setQuery)
    .then((acknowledged) => {
      if (!acknowledged) {
        console.log("ERROR:   updateMeasCacheinDb(), FAILED to update DB with hourly start-up data!");
      } else {console.log("DB updated with new total yield data.")}
    });
  } else {
    await dbHandler('create', newCacheData)
    .then(function(acknowledged) {
      if (!acknowledged) { 
        console.log("ERROR:   updateMeasCacheinDb(), FAILED to create new measCache object in DB!");
      } else {console.log("DB updated/created with new total yield object.")}
    });
  }
}

const updateDb = async function () {
  let date = convertFromUtcToLocalDate(new Date());
  let year, month, day, hour, rest;
  let produced = 0;
  let isComplete = false;
    console.log("   *** Prepping data and sending to DB *** ", date.toISOString());

  if (dbHrCache.sendMeToDb) {
    console.log("Sending to DB on full HR: ", dbHrCache);
    produced   = dbHrCache.accHrValue;
    hour       = dbHrCache.hour;
    date       = dbHrCache.date;
    isComplete = dbHrCache.isComplete;
    dbHrCache.accHrValue  = 0;
    dbHrCache.sendMeToDb  = false;
    dbHrCache.hour        = null;
  } else {
    console.log("Sending casual update");
    produced = current_hourly_acc_pwr.accHrVal;
  }

  [year, month, day, ...rest] = date.toISOString().split('T')[0].split('-');
  [hour, ...rest]             = date.toISOString().split('T')[1].split(':');

  // Handle month & hr
  let monthName = monthsAsTextList[month-1]; // monthNr  0-11
  let query = { year: parseInt(year), monthName: monthName };
  let dbMonthObj = await dbHandler('get', query)
                  .then(function(value) {
                    return value;
                  });

  if (dbMonthObj === null) {
    dbMonthObj = createDbMonthObj(date.toISOString());
    let dbDayObj = createDbDayObject(date.toISOString());
    dbDayObj.hours[parseInt(hour)].produced   = parseFloat(produced);
    dbDayObj.hours[parseInt(hour)].isComplete = isComplete;
    dbDayObj.produced = parseFloat(total_dayly_pwr);
    dbMonthObj.dailyPwrData[parseInt(day)-1]=(dbDayObj);
    await dbHandler('create', dbMonthObj)
    .then(function(acknowledged) {
      if (!acknowledged) { 
        console.log("ERROR: Failed to create new month object in DB!")
      } else {console.log("DB updated/created new month object.")}
    });
  } else {
    // Check if current dayObj exists in the received monthObj. If not, then create one.
    if (!dbMonthObj.dailyPwrData[parseInt(day)-1]) {
      dbDayObj = createDbDayObject(date.toISOString());
      dbMonthObj.dailyPwrData[parseInt(day)-1] = dbDayObj;
    }
    dbMonthObj.dailyPwrData[parseInt(day)-1].hours[parseInt(hour)].produced   = parseFloat(produced);
    dbMonthObj.dailyPwrData[parseInt(day)-1].hours[parseInt(hour)].isComplete = isComplete;

    // Daily yield 
    dbMonthObj.dailyPwrData[parseInt(day)-1].produced = parseFloat(total_dayly_pwr);

    // Ackumulate monthly data
    // Days may be missing in the mounthly array. Check for null entries in array!
    dbMonthObj.monthlyPwrData.produced =  dbMonthObj.dailyPwrData.reduce(function (acc, obj) { 
      let prod = 0.0;
      if (obj !== null && obj.hasOwnProperty('produced')) {prod=obj.produced}
      return parseFloat(acc) + prod;
    }, 0.0);

    // Save to DB
    let setQuery = { identifier: { _id: dbMonthObj._id }, data: { $set: { dailyPwrData: dbMonthObj.dailyPwrData, monthlyPwrData: dbMonthObj.monthlyPwrData } } };
    await dbHandler('update', setQuery)
    .then((acknowledged) => {
        if (!acknowledged) {
            console.log("ERROR:   updateDb(), FAILED to update DB with PWR data");
        } else {console.log("DB updated with new measueremnt data.")}
    });
  }
  
  // Handle total yield
  updateYearlyYieldInDb(date.toISOString(), total_acc_pwr);
}

const runModbus = function()
{
  let nextAction;

  switch (mbsState) {
    case MBS_STATE_INIT:
      nextAction = connectClient;
      break;
    case MBS_STATE_NEXT:
      nextAction = readModbusData;
      break;
    case MBS_STATE_GOOD_CONNECT:
      nextAction = readModbusData;
      break;
    case MBS_STATE_FAIL_CONNECT:
      nextAction = connectClient;
      break;
    case MBS_STATE_GOOD_READ:
      nextAction = readModbusData;
      break;
    case MBS_STATE_FAIL_READ:
      if (client.isOpen)  { mbsState = MBS_STATE_NEXT;  }
      else                { nextAction = connectClient; }
        break;
    default:
      // nothing to do, keep scanning until actionable case
  }
  console.log();
  console.log(nextAction);

  // execute "next action" function if defined
  if (nextAction !== undefined) {
    nextAction();
    mbsState = MBS_STATE_IDLE;
  }

  // set for next run
  //setTimeout (runModbus, mbsScan);
};

runModbus();